import type { ClimateResilienceDetail } from "../global/types";
import { CLIMATE_MIX, TEMP_MARGIN_BREAKPOINTS, clamp } from "./config";
import type { DegreeDays, ServiceWeights } from "./derived";

/* ---------------------------------------------------------------------------
 * §7.7 Climate Resilience — 30%
 *
 * 只用 G1/climate LOCAL_PUBLIC、公开技术性能与运行区间、§7.5 派生量。
 * 禁止 subjective climate tier。
 * ------------------------------------------------------------------------- */

/**
 * §7.7.4 scoreTemperatureMargin
 *
 *   margin ≥ 10        → 100
 *   5 ≤ margin < 10    → 85 + 3(margin − 5)
 *   0 ≤ margin < 5     → 60 + 5·margin
 *   −5 ≤ margin < 0    → 30 + 6(margin + 5)
 *   margin < −5        → 0
 *
 * 注意 margin = −5 处从 30 直接掉到 0，是规格里唯一不连续的分段函数。
 * 极端温度 proxy 本身是 P01/P99 统计量，年际波动远大于这个跳变的宽度，
 * 因此 0.01℃ 的抖动即可让分数在 30 与 0 之间翻转；叠加 §7.7.5 的
 * non-compensatory 硬排除后，还会让一条路径在“第一名”和“不可行”之间跳。
 * 已作为待裁定问题上报产品负责人；在裁定前严格按规格实现，不擅自平滑。
 */
export function scoreTemperatureMargin(margin: number | null): number | null {
  if (margin == null || !Number.isFinite(margin)) return null;
  const { full, highFrom, midFrom, lowFrom } = TEMP_MARGIN_BREAKPOINTS;
  let s: number;
  if (margin >= full) s = 100;
  else if (margin >= highFrom) s = 85 + 3 * (margin - highFrom);
  else if (margin >= midFrom) s = 60 + 5 * margin;
  else if (margin >= lowFrom) s = 30 + 6 * (margin - lowFrom);
  else s = 0;
  return clamp(s, 0, 100);
}

/** §7.7.3 裕度：本地极端低温 − 技术公开最低运行温度 */
export function heatingMargin(
  localExtremeLowC: number | null | undefined,
  techMinOperatingC: number | null | undefined,
): number | null {
  if (localExtremeLowC == null || techMinOperatingC == null) return null;
  return localExtremeLowC - techMinOperatingC;
}

/** §7.7.3 裕度：技术公开最高运行温度 − 本地极端高温 */
export function coolingMargin(
  techMaxOperatingC: number | null | undefined,
  localExtremeHighC: number | null | undefined,
): number | null {
  if (localExtremeHighC == null || techMaxOperatingC == null) return null;
  return techMaxOperatingC - localExtremeHighC;
}

/**
 * §7.7.1 / §7.7.2 季节性能的相对归一化。
 *
 * 在**同一 household、同一 eligible 候选集合**内做：年输入能量最低者 = 100，
 * 最高者 = 0。规格禁止“COP=3 → 80 分”这类绝对映射。
 *
 * 三个已知副作用（已上报产品负责人，规格未承认）：
 *  1. 无论所有候选是否都很差，总有一条拿 100 —— 分数不表达绝对充分性；
 *  2. 增删任一候选会改变其余所有候选的 climate 分与最终排名；
 *  3. 分数跨地区不可比，而 §9 要求 AI 输出跨地区技术说明。
 *
 * @param annualInputs 每条候选路径的年输入能量；不可算的给 null
 * @returns 与入参等长的分数数组，null 位保持 null
 */
export function normalizeSeasonalScores(annualInputs: (number | null)[]): (number | null)[] {
  const usable = annualInputs.filter((v): v is number => v != null && Number.isFinite(v));
  if (usable.length === 0) return annualInputs.map(() => null);

  const best = Math.min(...usable);
  const worst = Math.max(...usable);

  return annualInputs.map((input) => {
    if (input == null || !Number.isFinite(input)) return null;
    if (worst === best) return 100;
    return clamp((100 * (worst - input)) / (worst - best), 0, 100);
  });
}

export interface ClimateCombineInput {
  needsHeating: boolean;
  needsCooling: boolean;
  seasonalHeatingScore: number | null;
  seasonalCoolingScore: number | null;
  extremeHeatingScore: number | null;
  extremeCoolingScore: number | null;
  weights: ServiceWeights;
  degreeDays: DegreeDays;
}

export interface ClimateResult {
  score: number | null;
  detail: ClimateResilienceDetail;
}

/** §7.7.6 单侧合成：seasonal 与 extreme 都在 → 0.70/0.30；缺 extreme → 只用 seasonal */
function combineSide(seasonal: number | null, extreme: number | null): {
  score: number | null;
  complete: boolean;
} {
  if (seasonal == null) return { score: null, complete: false };
  if (extreme == null) return { score: seasonal, complete: false };
  return {
    score: CLIMATE_MIX.seasonal * seasonal + CLIMATE_MIX.extreme * extreme,
    complete: true,
  };
}

/** §7.7.6–§7.7.8 合成 C。both → C = wH·C_H + wC·C_C */
export function combineClimate(input: ClimateCombineInput): ClimateResult {
  const heating = combineSide(input.seasonalHeatingScore, input.extremeHeatingScore);
  const cooling = combineSide(input.seasonalCoolingScore, input.extremeCoolingScore);

  let score: number | null = null;
  let complete = false;

  if (input.needsHeating && input.needsCooling) {
    if (heating.score != null && cooling.score != null) {
      score = input.weights.wH * heating.score + input.weights.wC * cooling.score;
      complete = heating.complete && cooling.complete && input.weights.weighting_source !== "unavailable";
    }
  } else if (input.needsHeating) {
    score = heating.score;
    complete = heating.complete;
  } else if (input.needsCooling) {
    score = cooling.score;
    complete = cooling.complete;
  }

  return {
    score,
    detail: {
      hdd18: input.degreeDays.hdd18,
      cdd24: input.degreeDays.cdd24,
      heating_weight: input.needsHeating ? input.weights.wH : null,
      cooling_weight: input.needsCooling ? input.weights.wC : null,
      seasonal_heating_score: input.seasonalHeatingScore,
      seasonal_cooling_score: input.seasonalCoolingScore,
      extreme_heating_score: input.extremeHeatingScore,
      extreme_cooling_score: input.extremeCoolingScore,
      complete,
    },
  };
}

/**
 * §7.7.5 Safety guardrail（non-compensatory）
 *
 * 极端分为 0，且运行区间数据置信度为 high，且无有效 backup/fallback
 * → 在最终排序**之前**排除（走 §7.3 的 excluded 列表，不是给低分）。
 * 低成本不能把它救回 Fitness。
 */
export function violatesSafetyGuardrail(params: {
  extremeScore: number | null;
  operatingRangeConfidence: "high" | "medium" | "low" | undefined;
  backupSupported: boolean;
  fallbackPossible: boolean;
}): boolean {
  return (
    params.extremeScore === 0 &&
    params.operatingRangeConfidence === "high" &&
    !params.backupSupported &&
    !params.fallbackPossible
  );
}
