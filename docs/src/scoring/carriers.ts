/* ---------------------------------------------------------------------------
 * 技术 → 能源载体 / 排放因子键 的映射。
 *
 * 依据技术目录里的 g4_defaults.operating_cost_model 与 carbon_model
 * （客观结构字段，属 §7.4 允许的 TECH_OBJECTIVE_RULE），不是主观档位。
 *
 * 映射不出来的一律返回 null → 该路径对应维度走 §7.11 missing 分支。
 * 尤其是 hybrid_dispatch 与 local_quote：前者需要一个规格未定义的调度模型，
 * 后者按定义就没有公开价格，都不许拿别的数顶替。
 * ------------------------------------------------------------------------- */

export type Carrier =
  | "electricity"
  | "natural_gas"
  | "lpg"
  | "heating_oil"
  | "solid_fuel"
  | "biomass"
  | "district_heating"
  | "district_cooling";

export type OperatingCostModel =
  | "heat_pump_cop"
  | "grid_resistance"
  | "grid_cooling_efficiency"
  | "gas_fuel"
  | "delivered_liquid_fuel"
  | "solid_fuel"
  | "district_tariff"
  | "low_energy_support"
  | "passive_zero_direct_energy"
  | "hybrid_dispatch"
  | "local_quote";

export type CarbonModel =
  | "grid_electricity"
  | "gas_combustion"
  | "liquid_fuel_combustion"
  | "solid_fuel_combustion"
  | "biomass_context_dependent"
  | "district_energy_factor"
  | "passive_operational_zero"
  | "hybrid_weighted"
  | "local_factor_required";

export interface CarrierResolution {
  carrier: Carrier | null;
  /** 该技术是否本来就不直接耗能（被动措施），此时零能耗是物理定义而非缺数据 */
  passive: boolean;
  /** 无法解析的原因，用于生成 DataNote / ScoringWarning */
  unresolved_reason?: "needs_dispatch_model" | "no_public_price_model" | "unknown_model";
}

/**
 * 由运行费模型解析能源载体。
 * `techId` 与 `infrastructureRequired` 用于区分同一模型下的不同燃料
 * （delivered_liquid_fuel 可能是 LPG 也可能是燃油；district_tariff 分冷热）。
 */
export function resolveOperatingCarrier(
  model: OperatingCostModel | string | undefined,
  techId: string,
  services: string[],
): CarrierResolution {
  switch (model) {
    case "heat_pump_cop":
    case "grid_resistance":
    case "grid_cooling_efficiency":
    case "low_energy_support":
      return { carrier: "electricity", passive: false };

    case "gas_fuel":
      return { carrier: "natural_gas", passive: false };

    case "delivered_liquid_fuel":
      if (techId.includes("oil")) return { carrier: "heating_oil", passive: false };
      if (techId.includes("lpg") || techId.includes("propane")) return { carrier: "lpg", passive: false };
      return { carrier: null, passive: false, unresolved_reason: "unknown_model" };

    case "solid_fuel":
      if (techId.includes("biomass") || techId.includes("pellet") || techId.includes("wood")) {
        return { carrier: "biomass", passive: false };
      }
      return { carrier: "solid_fuel", passive: false };

    case "district_tariff": {
      const cooling = services.includes("cooling") && !services.includes("heating");
      return { carrier: cooling ? "district_cooling" : "district_heating", passive: false };
    }

    case "passive_zero_direct_energy":
      return { carrier: null, passive: true };

    case "hybrid_dispatch":
      return { carrier: null, passive: false, unresolved_reason: "needs_dispatch_model" };

    case "local_quote":
      return { carrier: null, passive: false, unresolved_reason: "no_public_price_model" };

    default:
      return { carrier: null, passive: false, unresolved_reason: "unknown_model" };
  }
}

export interface EmissionFactorKey {
  /** 查 electricity_emission_factors / fuel_emission_factors 时用的 subject */
  subject: string | null;
  /** 被动措施：运行阶段直接排放按定义为 0，这不是“缺数据” */
  operationalZero: boolean;
  unresolved_reason?: "needs_dispatch_model" | "needs_local_factor" | "context_dependent" | "unknown_model";
}

export function resolveEmissionKey(
  model: CarbonModel | string | undefined,
  carrier: Carrier | null,
): EmissionFactorKey {
  switch (model) {
    case "grid_electricity":
      return { subject: "grid", operationalZero: false };
    case "gas_combustion":
      return { subject: "natural_gas", operationalZero: false };
    case "liquid_fuel_combustion":
      return { subject: carrier ?? "heating_oil", operationalZero: false };
    case "solid_fuel_combustion":
      return { subject: "solid_fuel", operationalZero: false };
    case "district_energy_factor":
      return { subject: carrier ?? "district_heating", operationalZero: false };
    case "passive_operational_zero":
      return { subject: null, operationalZero: true };
    case "biomass_context_dependent":
      // 生物质的净碳强度取决于原料来源与再生周期，没有当地口径就不能给数
      return { subject: null, operationalZero: false, unresolved_reason: "context_dependent" };
    case "hybrid_weighted":
      return { subject: null, operationalZero: false, unresolved_reason: "needs_dispatch_model" };
    case "local_factor_required":
      return { subject: null, operationalZero: false, unresolved_reason: "needs_local_factor" };
    default:
      return { subject: null, operationalZero: false, unresolved_reason: "unknown_model" };
  }
}

/** 由 G3 当前取暖方式反推基线所用载体，用于 §7.5.3 的账单反推 */
export function baselineCarrierFromHeatingMethod(
  method: string,
  deliveredFuelKind?: "lpg" | "heating_oil" | "not_sure" | null,
): Carrier | null {
  switch (method) {
    case "heat_pump":
    case "electric_heating":
      return "electricity";
    case "piped_gas_heating":
      return "natural_gas";
    case "delivered_fuel_heating":
      // G3 追问（D15）给出明确燃料才用；缺席或 not_sure 维持不猜
      if (deliveredFuelKind === "lpg") return "lpg";
      if (deliveredFuelKind === "heating_oil") return "heating_oil";
      return null;
    case "solid_fuel_heating":
      return "solid_fuel";
    case "district_or_shared_heating":
      return "district_heating";
    default:
      return null;
  }
}

export function baselineCarrierFromCoolingMethod(method: string): Carrier | null {
  switch (method) {
    case "room_air_conditioning":
    case "central_air_conditioning":
    case "heat_pump_cooling":
    case "evaporative_or_water_cooling":
    case "fans":
      return "electricity";
    case "district_or_shared_cooling":
      return "district_cooling";
    default:
      return null;
  }
}
