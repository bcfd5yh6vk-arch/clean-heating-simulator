import type { AffordabilityDetail, UpfrontCostPreference } from "../global/types";
import {
  AFFORDABILITY_MIX,
  UPFRONT_SCORE_SLOPE,
  UPFRONT_TOLERANCE,
  clamp,
} from "./config";

/* ---------------------------------------------------------------------------
 * §7.6 Affordability — 35%
 * ------------------------------------------------------------------------- */

/** 一条能源线的年用量与当地单价；单价必须是 §7.4 允许的 LOCAL_PUBLIC */
export interface EnergyLine {
  /** 能源键：electricity / natural_gas / lpg / heating_oil / district_heating … */
  carrier: string;
  annual_energy_use: number | null;
  local_unit_price: number | null;
}

/**
 * §7.6.1 AnnualRunCost = Σ (AnnualEnergyUse_i × LocalResidentialEnergyPrice_i)
 *
 * 任意一条能源线缺用量或缺价格 → 整条路径的运行费不可算（返回 null）。
 * 不允许只把能算的部分加起来当作总运行费——那会让缺数据的路径显得更便宜。
 */
export function annualRunCost(lines: EnergyLine[]): number | null {
  if (lines.length === 0) return null;
  let total = 0;
  for (const line of lines) {
    if (line.annual_energy_use == null || line.local_unit_price == null) return null;
    if (!(line.annual_energy_use >= 0) || !(line.local_unit_price >= 0)) return null;
    total += line.annual_energy_use * line.local_unit_price;
  }
  return total;
}

/** §7.6.2 OperatingBurdenPct = AnnualRunCost / AnnualIncome × 100 */
export function operatingBurdenPct(
  runCost: number | null,
  annualIncome: number | null | undefined,
): number | null {
  if (runCost == null || annualIncome == null) return null;
  if (!(annualIncome > 0)) return null;
  return (runCost / annualIncome) * 100;
}

/**
 * §7.6.3 运行负担率评分（连续分段线性）
 *
 *   x ≤ 3   → 100
 *   3 < x ≤ 5   → 100 − 7.5(x−3)
 *   5 < x ≤ 10  → 85 − 7(x−5)
 *   10 < x ≤ 20 → 50 − 4(x−10)
 *   20 < x ≤ 25 → 10 − 2(x−20)
 *   x ≥ 25  → 0
 */
export function operatingBurdenScore(burdenPct: number | null): number | null {
  if (burdenPct == null || !Number.isFinite(burdenPct)) return null;
  const x = burdenPct;
  let s: number;
  if (x <= 3) s = 100;
  else if (x <= 5) s = 100 - 7.5 * (x - 3);
  else if (x <= 10) s = 85 - 7 * (x - 5);
  else if (x <= 20) s = 50 - 4 * (x - 10);
  else if (x <= 25) s = 10 - 2 * (x - 20);
  else s = 0;
  return clamp(s, 0, 100);
}

/** §7.6.4 UpfrontRatio = InstalledCostLocal / AnnualIncome */
export function upfrontRatio(
  installedCost: number | null,
  annualIncome: number | null | undefined,
): number | null {
  if (installedCost == null || annualIncome == null) return null;
  if (!(annualIncome > 0) || !(installedCost >= 0)) return null;
  return installedCost / annualIncome;
}

/**
 * §7.6.5 S_upfront = clamp(100 − 50 × UpfrontRatio / t, 0, 100)
 * ratio = 0 → 100；ratio = t → 50；ratio = 2t → 0
 */
export function upfrontScore(
  ratio: number | null,
  preference: UpfrontCostPreference | null | undefined,
): number | null {
  if (ratio == null) return null;
  const t = UPFRONT_TOLERANCE[(preference ?? "not_sure") as UpfrontCostPreference];
  if (!(t > 0)) return null;
  return clamp(100 - (UPFRONT_SCORE_SLOPE * ratio) / t, 0, 100);
}

export interface AffordabilityInput {
  energyLines: EnergyLine[];
  annualIncome: number | null | undefined;
  installedCost: number | null;
  upfrontPreference: UpfrontCostPreference | null | undefined;
}

export interface AffordabilityResult {
  score: number | null;
  detail: AffordabilityDetail;
}

/**
 * §7.6.6 最终可负担性
 *
 *   两项都在 → A = 0.65·S_run + 0.35·S_upfront
 *   缺 installed cost → S_upfront = null，A = S_run，complete = false
 *   缺 S_run → A = null（运行费是可负担性的主体，没有它这一维不成立）
 *
 * **绝对不能**因为 unknown 就把 S_upfront 设成 50。
 */
export function scoreAffordability(input: AffordabilityInput): AffordabilityResult {
  const runCost = annualRunCost(input.energyLines);
  const burden = operatingBurdenPct(runCost, input.annualIncome);
  const sRun = operatingBurdenScore(burden);

  const ratio = upfrontRatio(input.installedCost, input.annualIncome);
  const sUpfront = upfrontScore(ratio, input.upfrontPreference);

  let score: number | null;
  if (sRun != null && sUpfront != null) {
    score = AFFORDABILITY_MIX.run * sRun + AFFORDABILITY_MIX.upfront * sUpfront;
  } else if (sRun != null) {
    score = sRun;
  } else {
    score = null;
  }

  return {
    score,
    detail: {
      annual_run_cost: runCost,
      operating_burden_pct: burden,
      operating_burden_score: sRun,
      installed_cost: input.installedCost,
      upfront_ratio: ratio,
      upfront_score: sUpfront,
      complete: sRun != null && sUpfront != null,
    },
  };
}
