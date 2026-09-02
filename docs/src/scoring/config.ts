import type { UpfrontCostPreference } from "../global/types";

/* ---------------------------------------------------------------------------
 * 打分配置。§7.6.3 明确要求阈值集中存放，不要散落 hard-code。
 * 这些值全部来自规格 §7.6–§7.10，改动前需产品负责人批准（§0.2 锁定项）。
 * ------------------------------------------------------------------------- */

/** §7.10 四维权重。旧五维 {cost,carbon,comfort,climate,simple} 已废弃，不得再实现。 */
export const DIMENSION_WEIGHTS = {
  affordability: 0.35,
  climate_resilience: 0.30,
  environment: 0.20,
  practicality: 0.15,
} as const;

export type DimensionKey = keyof typeof DIMENSION_WEIGHTS;

export const DIMENSION_KEYS: DimensionKey[] = [
  "affordability",
  "climate_resilience",
  "environment",
  "practicality",
];

/** §7.10：正式 preliminary ranking 至少需要这三维可算，否则 insufficient_data */
export const REQUIRED_DIMENSIONS: DimensionKey[] = [
  "affordability",
  "climate_resilience",
  "practicality",
];

/** §7.5.1 / §7.5.2 度日基准温度 */
export const HDD_BASE_C = 18;
export const CDD_BASE_C = 24;

/** 每月天数，用于度日累加（非闰年；度日的年际差远大于 1 天的影响） */
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** §7.6.3 运行负担率分段线性。x = OperatingBurdenPct */
export const OPERATING_BURDEN_BREAKPOINTS = [
  { upTo: 3, score: 100, slope: 0 },
  { upTo: 5, score: 100, slope: 7.5, from: 3 },
  { upTo: 10, score: 85, slope: 7, from: 5 },
  { upTo: 20, score: 50, slope: 4, from: 10 },
  { upTo: 25, score: 10, slope: 2, from: 20 },
] as const;

/** §7.6.4 upfront tolerance t，由 G3 upfront_cost_preference 决定 */
export const UPFRONT_TOLERANCE: Record<UpfrontCostPreference, number> = {
  minimum_upfront: 0.10,
  moderate_investment: 0.25,
  higher_if_saves_later: 0.50,
  not_sure: 0.25,
};

/** §7.6.5 S_upfront = clamp(100 - K * ratio / t, 0, 100)；ratio=t → 50 */
export const UPFRONT_SCORE_SLOPE = 50;

/** §7.6.6 A = 0.65*S_run + 0.35*S_upfront */
export const AFFORDABILITY_MIX = { run: 0.65, upfront: 0.35 } as const;

/** §7.7.6 C_H = 0.70*S_season + 0.30*S_extreme */
export const CLIMATE_MIX = { seasonal: 0.70, extreme: 0.30 } as const;

/** §7.7.4 scoreTemperatureMargin 分段
 *
 * 注意：规格在 margin = -5 处不连续（[-5,0) 给 30，< -5 给 0）。
 * 其余所有分段函数都是连续的，这一处很可能是笔误，已在交接问题清单中提出。
 * 在产品负责人裁定前，此处**严格按规格实现**，不擅自平滑。
 */
export const TEMP_MARGIN_BREAKPOINTS = {
  full: 10,          // margin >= 10 → 100
  highFrom: 5,       // [5,10)  → 85 + 3*(m-5)
  midFrom: 0,        // [0,5)   → 60 + 5*m
  lowFrom: -5,       // [-5,0)  → 30 + 6*(m+5)
} as const;

/** §7.8.3 E = clamp(50 + 50 * Reduction, 0, 100) */
export const ENVIRONMENT_NEUTRAL_SCORE = 50;
export const ENVIRONMENT_REDUCTION_SLOPE = 50;

/** §7.9.5 P = 0.35*Sr + 0.25*Ss + 0.25*Si + 0.15*Sp */
export const PRACTICALITY_MIX = {
  renovation: 0.35,
  space: 0.25,
  infrastructure: 0.25,
  permission: 0.15,
} as const;

/** §7.9.1 / §7.9.2 margin → score */
export const FIT_MARGIN_SCORES = { two_or_more: 100, one: 85, zero: 70, not_sure: 60 } as const;

/** §7.9.3 基础设施可用性 → score */
export const INFRASTRUCTURE_SCORES = { household_confirmed: 100, local_public: 75, unknown: 60 } as const;

/** §7.9.4 永久性改造许可 → score */
export const PERMISSION_SCORES = {
  not_required: 100,
  owner: 100,
  renter_permission: 90,
  unknown: 60,
} as const;

/** §7.10 Climate safety soft cap：C < 50 且未硬排除 → Fitness 封顶 65 */
export const CLIMATE_SOFT_CAP = { triggerBelow: 50, capAt: 65 } as const;

/** §7.9 编码：none=0, minor/wall_or_balcony=1, moderate/small_yard_or_roof=2, major/large_private_land=3 */
export const LEVEL_CODES: Record<string, number> = {
  none: 0,
  minor: 1,
  wall_or_balcony: 1,
  moderate: 2,
  small_yard_or_roof: 2,
  major: 3,
  large_private_land: 3,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Fitness 保留 1 位小数（§7.10） */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
