import type {
  CandidatePath,
  ClimateProfile,
  DataNote,
  HomeFeasibilityProfile,
  HouseholdProfile,
  RankedPath,
  ScoringWarning,
} from "../global/types";
import { DIMENSION_KEYS } from "./config";
import type { DimensionKey } from "./config";
import {
  resolveOperatingCarrier,
  resolveEmissionKey,
  baselineCarrierFromHeatingMethod,
  baselineCarrierFromCoolingMethod,
} from "./carriers";
import type { Carrier } from "./carriers";
import { resolveScoringValue, valueOf } from "./dataPoint";
import type { GeoQuery, ScoringDataset } from "./dataPoint";
import { computeDegreeDays, candidateEnergyUse, serviceWeights, usefulDemandFromSpend } from "./derived";
import { scoreAffordability } from "./affordability";
import type { EnergyLine } from "./affordability";
import {
  combineClimate,
  coolingMargin,
  heatingMargin,
  normalizeSeasonalScores,
  scoreTemperatureMargin,
  violatesSafetyGuardrail,
} from "./climate";
import { scoreEnvironment } from "./environment";
import type { EmissionLine } from "./environment";
import { scorePracticality } from "./practicality";
import type { InfrastructureEvidence } from "./practicality";
import { computeFitness, rankPaths } from "./fitness";
import type { DimensionScores } from "./fitness";

/* ---------------------------------------------------------------------------
 * §7.1 Scoring engine 入口
 *
 * 输入 → 硬筛选后的候选路径 + LOCAL_PUBLIC 数据 → RankedPath[]
 *
 * 三条不可妥协的性质：
 *   1. 确定性：相同输入必须得到逐字节相同的输出（§7.1 / §11 Phase 1 验收）
 *   2. AI 不参与任何计算
 *   3. 缺数据时给 null 与 insufficient_data，绝不编造（§7.4 / §7.11）
 * ------------------------------------------------------------------------- */

/** technology_performance 数据集里的指标键 */
export const PERF = {
  seasonalHeating: "seasonal_heating_efficiency",
  seasonalCooling: "seasonal_cooling_efficiency",
  minOperatingTemp: "minimum_operating_temp_c",
  maxOperatingTemp: "maximum_operating_temp_c",
} as const;

export function perfKey(techId: string, metric: string): string {
  return `${techId}|${metric}`;
}

export interface ScoringDataBundle {
  residential_energy_prices?: ScoringDataset | null;
  technology_performance?: ScoringDataset | null;
  technology_installed_costs?: ScoringDataset | null;
  electricity_emission_factors?: ScoringDataset | null;
  fuel_emission_factors?: ScoringDataset | null;
  infrastructure_availability?: ScoringDataset<boolean> | null;
}

/** 供打分读取的技术目录条目（只取客观字段） */
export interface CatalogEntryLike {
  tech_id: string;
  display_name_en: string;
  display_name_zh: string;
  services: string[];
  screening?: {
    installation_level?: string;
    outdoor_space_required?: string;
    permanent_modification_required?: boolean;
    infrastructure_required?: string[];
  };
  g4_defaults?: {
    operating_cost_model?: string;
    carbon_model?: string;
  };
  climate_constraints_confidence?: "high" | "medium" | "low";
  backup_option_supported?: boolean;
  fallback_possible?: boolean;
}

export interface ScoringContext {
  household: HouseholdProfile;
  feasibility: HomeFeasibilityProfile;
  climate: ClimateProfile | null;
  geo: GeoQuery;
  data: ScoringDataBundle;
  catalog: Map<string, CatalogEntryLike>;
}

function warn(
  code: string,
  en: string,
  zh: string,
  source: ScoringWarning["source"],
): ScoringWarning {
  return { code, message_en: en, message_zh: zh, source };
}

function note(field_key: string, en: string, zh: string): DataNote {
  return { field_key, note_en: en, note_zh: zh };
}

/** 单价查询：拿不到就是 null，不做任何地理外推之外的替代 */
function priceFor(ctx: ScoringContext, carrier: Carrier | null): number | null {
  if (!carrier) return null;
  return valueOf(resolveScoringValue(ctx.data.residential_energy_prices, carrier, ctx.geo));
}

function perfFor(ctx: ScoringContext, techId: string, metric: string): number | null {
  return valueOf(resolveScoringValue(ctx.data.technology_performance, perfKey(techId, metric), ctx.geo));
}

function emissionFactorFor(ctx: ScoringContext, subject: string | null): number | null {
  if (!subject) return null;
  if (subject === "grid") {
    return valueOf(resolveScoringValue(ctx.data.electricity_emission_factors, "grid", ctx.geo));
  }
  return valueOf(resolveScoringValue(ctx.data.fuel_emission_factors, subject, ctx.geo));
}

/** §7.9.3 基础设施证据等级 */
function infrastructureEvidence(
  ctx: ScoringContext,
  required: string[] | undefined,
): InfrastructureEvidence {
  if (!required || required.length === 0) return "household_confirmed";

  const services = ctx.feasibility.current_energy_services ?? [];
  const householdHasAll = required.every((req) => {
    if (req === "electricity") return services.includes("electricity");
    if (req === "piped_gas") return services.includes("piped_gas");
    if (req === "delivered_fuel") return services.includes("delivered_fuel");
    if (req === "solid_fuel_supply") return services.includes("solid_fuel");
    if (req === "district_heating_network" || req === "district_cooling_network") {
      return services.includes("district_energy");
    }
    return false; // ground_access / water_supply / usable_heat_source：G3 问不到
  });
  if (householdHasAll) return "household_confirmed";

  const localAll = required.every(
    (req) => valueOf(resolveScoringValue(ctx.data.infrastructure_availability, req, ctx.geo)) === true,
  );
  if (localAll) return "local_public_available";

  return "unknown";
}

interface PathWork {
  path: CandidatePath;
  primary: CatalogEntryLike | undefined;
  annualHeatingInput: number | null;
  annualCoolingInput: number | null;
  energyLines: EnergyLine[];
  emissionLines: EmissionLine[];
  installedCost: number | null;
  warnings: ScoringWarning[];
  notes: DataNote[];
  guardrailViolated: boolean;
  extremeHeating: number | null;
  extremeCooling: number | null;
}

export interface ScoringOutput {
  ranked: RankedPath[];
  /** status === "insufficient_data" 的路径，按 §7.10 单独展示为 "Could not rank" */
  unrankable: RankedPath[];
}

export function scorePaths(paths: CandidatePath[], ctx: ScoringContext): ScoringOutput {
  const { feasibility, climate } = ctx;

  /* ---- 货币一致性守卫（CS-DECISIONS D13；HANDOFF §3.2.1 矛盾的自裁） ----
   * G2 的收入与账单金额在用户自选货币里，价格条目是当地货币。币种不一致时，
   * spend÷price（§7.5.3 账单反推）与 cost÷income（§7.6.2 负担率）都是
   * 无意义比值，且会一路传染到运行费、排放与四个维度——不报错、只算错。
   * §0.5 禁止这种静默错误数值，故币种不一致时把三个货币量整体按 §7.11
   * 视为缺失，并给每条路径挂警告说明。规格把 fx_rate 标为 display-only，
   * 不得拿汇率来"修"这个比值——那是规格层面待裁定的事，引擎不越权。
   * 本守卫不改变任何打分公式，只决定"哪些输入有资格进公式"。
   */
  const localCurrencyPoint = resolveScoringValue(
    ctx.data.residential_energy_prices, "electricity", ctx.geo,
  ) as { currency?: string } | null;
  const localCurrency = localCurrencyPoint?.currency?.toUpperCase() ?? null;
  const incomeCurrency = ctx.household.currency ? ctx.household.currency.toUpperCase() : null;
  const currencyMismatch =
    incomeCurrency != null && localCurrency != null && incomeCurrency !== localCurrency;
  const household = currencyMismatch
    ? {
        ...ctx.household,
        annual_income: null,
        heating_spend_annual: null,
        cooling_spend_annual: null,
      }
    : ctx.household;
  const currencyWarning = currencyMismatch
    ? warn(
        "currency_mismatch",
        `Your income and bills are in ${incomeCurrency}, but local prices here are in ${localCurrency}. ` +
          "Cost, burden, and bill-based estimates are treated as unavailable instead of mixing currencies.",
        `你填写的收入与账单货币是 ${incomeCurrency}，而当地价格数据是 ${localCurrency}。` +
          "为避免跨币种混算，涉及金额的估算按数据缺失处理。",
        "user_answer",
      )
    : null;

  const degreeDays = computeDegreeDays(climate);

  /* ---- 基线有用负荷（§7.5.3 / §7.5.4）---------------------------------- */
  const heatingBaselineCarrier =
    (feasibility.current_heating_methods ?? [])
      .map((m) => baselineCarrierFromHeatingMethod(m, feasibility.delivered_fuel_kind))
      .find((c): c is Carrier => c != null) ?? null;
  const coolingBaselineCarrier =
    (feasibility.current_cooling_methods ?? [])
      .map(baselineCarrierFromCoolingMethod)
      .find((c): c is Carrier => c != null) ?? null;

  // 当前设备的公开季节效率同样必须来自数据；没有就反推不出有用负荷
  const baselineHeatingEff = heatingBaselineCarrier
    ? perfFor(ctx, `baseline:${heatingBaselineCarrier}`, PERF.seasonalHeating)
    : null;
  const baselineCoolingEff = coolingBaselineCarrier
    ? perfFor(ctx, `baseline:${coolingBaselineCarrier}`, PERF.seasonalCooling)
    : null;

  const heatingBaselinePrice = priceFor(ctx, heatingBaselineCarrier);
  const coolingBaselinePrice = priceFor(ctx, coolingBaselineCarrier);

  const usefulHeatingDemand = household.needs_heating
    ? usefulDemandFromSpend(household.heating_spend_annual, heatingBaselinePrice, baselineHeatingEff)
    : null;
  const usefulCoolingDemand = household.needs_cooling
    ? usefulDemandFromSpend(household.cooling_spend_annual, coolingBaselinePrice, baselineCoolingEff)
    : null;

  /* ---- §7.8.2 参照排放：住户当前设备的年排放 --------------------------
   * ReferenceEmissions = Σ (当前购入能源量 × 当地排放因子)
   * 当前购入能源量 = 年支出 / 当地单价（注意这里是**购入能源**，不是有用热，
   * 所以不乘效率——效率已经体现在“同样的钱买到多少有用热”里了）。
   *
   * 任一侧算不出就整体为 null：§7.8.2 明令不得把 reference 当 0，
   * 那会让任何方案都显示成“恶化”。也不能只算能算的那侧，那等于
   * 拿半个基线跟完整路径比。
   */
  function baselinePurchasedEnergy(
    spend: number | null | undefined,
    price: number | null,
  ): number | null {
    if (spend == null || price == null || !(price > 0)) return null;
    return spend / price;
  }

  function baselineCarrierEmissions(carrier: Carrier | null, energy: number | null): number | null {
    if (carrier == null || energy == null) return null;
    const subject = carrier === "electricity" ? "grid" : carrier;
    const factor = emissionFactorFor(ctx, subject);
    return factor == null ? null : energy * factor;
  }

  let referenceEmissions: number | null = 0;
  let referenceType: "household_baseline" | "regional_equivalent_service" | null = "household_baseline";

  if (household.needs_heating) {
    const e = baselineCarrierEmissions(
      heatingBaselineCarrier,
      baselinePurchasedEnergy(household.heating_spend_annual, heatingBaselinePrice),
    );
    referenceEmissions = e == null || referenceEmissions == null ? null : referenceEmissions + e;
  }
  if (household.needs_cooling) {
    const e = baselineCarrierEmissions(
      coolingBaselineCarrier,
      baselinePurchasedEnergy(household.cooling_spend_annual, coolingBaselinePrice),
    );
    referenceEmissions = e == null || referenceEmissions == null ? null : referenceEmissions + e;
  }
  if (referenceEmissions === 0) {
    // 没有任何可算的基线（例如 no_current_heating）——§7.8.2 要求此时优先用
    // 当地同等服务基线；该数据源尚未定义，因此如实置 null 而不是当作 0。
    referenceEmissions = null;
    referenceType = null;
  }

  const weights = serviceWeights(
    household.needs_heating,
    household.needs_cooling,
    usefulHeatingDemand,
    usefulCoolingDemand,
    degreeDays,
  );

  /* ---- 逐路径的能耗、成本、排放、极端温度裕度 -------------------------- */
  const work: PathWork[] = paths.map((path) => {
    const primaryId = path.primary_tech_ids[0];
    const primary = ctx.catalog.get(primaryId);
    const warnings: ScoringWarning[] = [];
    if (currencyWarning) warnings.push(currencyWarning);
    const notes: DataNote[] = [];

    if (!primary) {
      notes.push(
        note(
          "technology_catalog",
          `Technology ${primaryId} is not in the runtime catalog.`,
          `技术 ${primaryId} 不在运行时技术目录中。`,
        ),
      );
      return {
        path, primary, annualHeatingInput: null, annualCoolingInput: null,
        energyLines: [], emissionLines: [], installedCost: null,
        warnings, notes, guardrailViolated: false, extremeHeating: null, extremeCooling: null,
      };
    }

    const resolution = resolveOperatingCarrier(
      primary.g4_defaults?.operating_cost_model,
      primary.tech_id,
      primary.services,
    );

    if (resolution.unresolved_reason === "needs_dispatch_model") {
      notes.push(
        note(
          "operating_cost_model",
          "This hybrid system needs a documented dispatch model before its running cost can be estimated.",
          "该混合系统需要一份有据可查的调度模型才能估算运行费。",
        ),
      );
    } else if (resolution.unresolved_reason === "no_public_price_model") {
      notes.push(
        note(
          "operating_cost_model",
          "Running cost for this option depends on a local quote, so no public price applies.",
          "该方案的运行费依赖当地报价，没有可用的公开价格。",
        ),
      );
    }

    const servesHeating = path.services.includes("heating");
    const servesCooling = path.services.includes("cooling");

    const heatEff = perfFor(ctx, primary.tech_id, PERF.seasonalHeating);
    const coolEff = perfFor(ctx, primary.tech_id, PERF.seasonalCooling);

    const annualHeatingInput = servesHeating
      ? candidateEnergyUse(usefulHeatingDemand, heatEff)
      : null;
    const annualCoolingInput = servesCooling
      ? candidateEnergyUse(usefulCoolingDemand, coolEff)
      : null;

    const price = priceFor(ctx, resolution.carrier);
    const energyLines: EnergyLine[] = [];
    const emissionLines: EmissionLine[] = [];

    if (resolution.passive) {
      // 被动措施本身不直接耗能，零是物理定义而非缺数据
      energyLines.push({ carrier: "passive", annual_energy_use: 0, local_unit_price: 0 });
      emissionLines.push({ carrier: "passive", annual_energy_use: 0, local_emission_factor: 0 });
    } else {
      const emissionKey = resolveEmissionKey(primary.g4_defaults?.carbon_model, resolution.carrier);
      const factor = emissionKey.operationalZero ? 0 : emissionFactorFor(ctx, emissionKey.subject);

      if (servesHeating) {
        energyLines.push({
          carrier: resolution.carrier ?? "unknown",
          annual_energy_use: annualHeatingInput,
          local_unit_price: price,
        });
        emissionLines.push({
          carrier: resolution.carrier ?? "unknown",
          annual_energy_use: annualHeatingInput,
          local_emission_factor: factor,
        });
      }
      if (servesCooling) {
        energyLines.push({
          carrier: resolution.carrier ?? "unknown",
          annual_energy_use: annualCoolingInput,
          local_unit_price: price,
        });
        emissionLines.push({
          carrier: resolution.carrier ?? "unknown",
          annual_energy_use: annualCoolingInput,
          local_emission_factor: factor,
        });
      }
      if (price == null && resolution.carrier) {
        warnings.push(
          warn(
            "LOCAL_PRICE_UNAVAILABLE",
            "No published residential energy price is available for this location, so running cost could not be estimated.",
            "当地没有可引用的居民能源价格，因此无法估算运行费。",
            "scoring_data",
          ),
        );
      }
    }

    const installedCost = valueOf(
      resolveScoringValue(ctx.data.technology_installed_costs, primary.tech_id, ctx.geo),
    );
    if (installedCost == null) {
      notes.push(
        note(
          "installed_cost_local",
          "Upfront-cost data unavailable for this location. Affordability is based on available operating-cost data only.",
          "当地暂无装机成本数据，可负担性仅依据可得的运行费数据计算。",
        ),
      );
    }

    /* §7.7.3–§7.7.5 极端温度裕度与安全护栏 */
    const minTemp = perfFor(ctx, primary.tech_id, PERF.minOperatingTemp);
    const maxTemp = perfFor(ctx, primary.tech_id, PERF.maxOperatingTemp);
    const extremeHeating = servesHeating
      ? scoreTemperatureMargin(heatingMargin(climate?.extreme_low_temp_proxy_c, minTemp))
      : null;
    const extremeCooling = servesCooling
      ? scoreTemperatureMargin(coolingMargin(maxTemp, climate?.extreme_high_temp_proxy_c))
      : null;

    const guardrailViolated =
      violatesSafetyGuardrail({
        extremeScore: extremeHeating,
        operatingRangeConfidence: climate?.extreme_proxy_confidence,
        backupSupported: primary.backup_option_supported === true,
        fallbackPossible: primary.fallback_possible === true,
      }) ||
      violatesSafetyGuardrail({
        extremeScore: extremeCooling,
        operatingRangeConfidence: climate?.extreme_proxy_confidence,
        backupSupported: primary.backup_option_supported === true,
        fallbackPossible: primary.fallback_possible === true,
      });

    return {
      path, primary, annualHeatingInput, annualCoolingInput,
      energyLines, emissionLines, installedCost,
      warnings, notes, guardrailViolated, extremeHeating, extremeCooling,
    };
  });

  /* ---- §7.7.1 季节性能在候选集内相对归一化 ---------------------------- */
  const seasonalHeating = normalizeSeasonalScores(work.map((w) => w.annualHeatingInput));
  const seasonalCooling = normalizeSeasonalScores(work.map((w) => w.annualCoolingInput));

  /* ---- 逐路径合成四维 ------------------------------------------------- */
  const scored = work.map((w, i) => {
    const affordability = scoreAffordability({
      energyLines: w.energyLines,
      annualIncome: household.annual_income,
      installedCost: w.installedCost,
      upfrontPreference: feasibility.upfront_cost_preference,
    });

    const climateResult = combineClimate({
      needsHeating: household.needs_heating && w.path.services.includes("heating"),
      needsCooling: household.needs_cooling && w.path.services.includes("cooling"),
      seasonalHeatingScore: seasonalHeating[i],
      seasonalCoolingScore: seasonalCooling[i],
      extremeHeatingScore: w.extremeHeating,
      extremeCoolingScore: w.extremeCooling,
      weights,
      degreeDays,
    });

    const environment = scoreEnvironment({
      lines: w.emissionLines,
      reference: { value: referenceEmissions, type: referenceType },
    });

    const practicality = scorePracticality({
      renovationTolerance: feasibility.renovation_tolerance,
      techInstallationLevel: w.primary?.screening?.installation_level,
      outdoorSpace: feasibility.outdoor_space,
      techOutdoorSpaceRequired: w.primary?.screening?.outdoor_space_required,
      infrastructureEvidence: infrastructureEvidence(ctx, w.primary?.screening?.infrastructure_required),
      permanentModificationRequired: w.primary?.screening?.permanent_modification_required === true,
      housingStatus: feasibility.housing_status,
    });

    const dimensions: DimensionScores = {
      affordability: affordability.score,
      climate_resilience: climateResult.score,
      environment: environment.score,
      practicality: practicality.score,
    };

    const outcome = computeFitness(dimensions);
    const warnings = w.warnings.slice();
    if (outcome.soft_capped) {
      warnings.push(
        warn(
          "CLIMATE_SOFT_CAP",
          "Climate resilience is weak for this location.",
          "该方案在当地的气候适应性较弱。",
          "climate_data",
        ),
      );
    }

    const ranked: RankedPath = {
      ...w.path,
      display_name_en: w.primary?.display_name_en ?? w.path.path_id,
      display_name_zh: w.primary?.display_name_zh ?? w.path.path_id,
      rank: null,
      status: outcome.status,
      fitness: outcome.fitness,
      dimensions: {
        affordability: dimensions.affordability,
        climate_resilience: dimensions.climate_resilience,
        environment: dimensions.environment,
        practicality: dimensions.practicality,
      },
      dimension_details: {
        affordability: affordability.detail,
        climate_resilience: climateResult.detail,
        environment: environment.detail,
        practicality: practicality.detail,
      },
      score_coverage: outcome.score_coverage,
      estimates: {
        currency: household.currency,
        upfront_cost: w.installedCost,
        annual_run_cost: affordability.detail.annual_run_cost ?? null,
        operating_burden_pct: affordability.detail.operating_burden_pct ?? null,
        annual_emissions_kgco2e: environment.detail.path_emissions_kgco2e ?? null,
      },
      warnings,
      data_notes: w.notes.length ? w.notes : undefined,
    };
    return ranked;
  });

  /* ---- §7.10 分流与排序 ----------------------------------------------- */
  const rankable = scored.filter((p) => p.status !== "insufficient_data");
  const unrankable = scored.filter((p) => p.status === "insufficient_data");

  const ordered = rankPaths(
    rankable.map((p) => ({
      path_id: p.path_id,
      fitness: p.fitness,
      score_coverage: p.score_coverage,
      dimensions: p.dimensions as DimensionScores,
      status: p.status,
      _ref: p,
    })),
  ).map((row, index) => {
    const ref = (row as unknown as { _ref: RankedPath })._ref;
    ref.rank = index + 1;
    return ref;
  });

  return { ranked: ordered, unrankable };
}

export { DIMENSION_KEYS };
export type { DimensionKey };
