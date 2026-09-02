import type { ClimateProfile } from "../global/types";
import { CDD_BASE_C, DAYS_IN_MONTH, HDD_BASE_C } from "./config";

/* ---------------------------------------------------------------------------
 * §7.5 Common derived variables
 *
 * 本模块所有函数在输入缺失时返回 null。§7.11：missing ≠ 0，missing ≠ 50。
 * ------------------------------------------------------------------------- */

export interface DegreeDays {
  hdd18: number | null;
  cdd24: number | null;
}

/** §7.5.1 / §7.5.2 —— 需要完整 12 个月的月平均气温，缺一个月就整体不可算 */
export function computeDegreeDays(climate: ClimateProfile | null | undefined): DegreeDays {
  const monthly = climate?.temperature_c_monthly;
  if (!Array.isArray(monthly) || monthly.length !== 12) {
    return { hdd18: null, cdd24: null };
  }
  if (monthly.some((t) => typeof t !== "number" || !Number.isFinite(t))) {
    return { hdd18: null, cdd24: null };
  }

  let hdd = 0;
  let cdd = 0;
  for (let m = 0; m < 12; m += 1) {
    const days = DAYS_IN_MONTH[m];
    hdd += Math.max(0, HDD_BASE_C - monthly[m]) * days;
    cdd += Math.max(0, monthly[m] - CDD_BASE_C) * days;
  }
  return { hdd18: Math.round(hdd), cdd24: Math.round(cdd) };
}

/**
 * §7.5.3 / §7.5.4 由账单反推有用冷/热负荷。
 *
 *   BaselineEnergy = Spend / LocalFuelPrice
 *   UsefulDemand   = BaselineEnergy * BaselineEfficiency
 *
 * 热泵基线用 BaselineElectricity * BaselineSeasonalCOP，形式相同。
 * 三个输入（支出、当地价格、当前技术公开效率）缺任意一个 → null。
 */
export function usefulDemandFromSpend(
  spendAnnual: number | null | undefined,
  localUnitPrice: number | null | undefined,
  baselineEfficiency: number | null | undefined,
): number | null {
  if (spendAnnual == null || localUnitPrice == null || baselineEfficiency == null) return null;
  if (!(localUnitPrice > 0) || !(baselineEfficiency > 0) || !(spendAnnual >= 0)) return null;
  const baselineEnergy = spendAnnual / localUnitPrice;
  return baselineEnergy * baselineEfficiency;
}

/**
 * §7.5.6 候选方案的年能耗。
 *   CandidateEnergy = UsefulDemand / CandidateSeasonalEfficiency
 * 热泵即 UsefulDemand / SCOP，形式一致。
 */
export function candidateEnergyUse(
  usefulDemand: number | null,
  candidateSeasonalEfficiency: number | null,
): number | null {
  if (usefulDemand == null || candidateSeasonalEfficiency == null) return null;
  if (!(candidateSeasonalEfficiency > 0)) return null;
  return usefulDemand / candidateSeasonalEfficiency;
}

export interface ServiceWeights {
  wH: number;
  wC: number;
  weighting_source: "single_service" | "load_based" | "degree_day_fallback" | "unavailable";
}

/**
 * §7.5.7 冷热重要度权重。
 *
 * 优先用 UsefulDemand（load_based）；缺失则退到 HDD/CDD（degree_day_fallback）。
 *
 * 已知模型边界（已上报产品负责人）：HDD 基准 18℃、CDD 基准 24℃，两者
 * 量纲可比但物理不可比，6℃ 的基准差会系统性放大 HDD、压缩 CDD，且未修正
 * 制冷 COP 通常高于制热、也未计潜热负荷。因此 degree_day_fallback 会偏向
 * 判定“取暖更重要”。此处严格按规格实现，但把 weighting_source 透出，
 * 便于 UI/审计区分两种口径。
 */
export function serviceWeights(
  needsHeating: boolean,
  needsCooling: boolean,
  usefulHeatingDemand: number | null,
  usefulCoolingDemand: number | null,
  degreeDays: DegreeDays,
): ServiceWeights {
  if (needsHeating && !needsCooling) return { wH: 1, wC: 0, weighting_source: "single_service" };
  if (!needsHeating && needsCooling) return { wH: 0, wC: 1, weighting_source: "single_service" };
  if (!needsHeating && !needsCooling) return { wH: 0, wC: 0, weighting_source: "unavailable" };

  if (usefulHeatingDemand != null && usefulCoolingDemand != null) {
    const total = usefulHeatingDemand + usefulCoolingDemand;
    if (total > 0) {
      const wH = usefulHeatingDemand / total;
      return { wH, wC: 1 - wH, weighting_source: "load_based" };
    }
  }

  const { hdd18, cdd24 } = degreeDays;
  if (hdd18 != null && cdd24 != null) {
    const total = hdd18 + cdd24;
    if (total > 0) {
      const wH = hdd18 / total;
      return { wH, wC: 1 - wH, weighting_source: "degree_day_fallback" };
    }
  }

  return { wH: 0, wC: 0, weighting_source: "unavailable" };
}
