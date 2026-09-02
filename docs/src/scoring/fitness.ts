import type { PathScoreStatus } from "../global/types";
import {
  CLIMATE_SOFT_CAP,
  DIMENSION_KEYS,
  DIMENSION_WEIGHTS,
  REQUIRED_DIMENSIONS,
  clamp,
  round1,
} from "./config";
import type { DimensionKey } from "./config";

/* ---------------------------------------------------------------------------
 * §7.10 Final Fitness and ranking
 * ------------------------------------------------------------------------- */

export type DimensionScores = Record<DimensionKey, number | null>;

export interface FitnessOutcome {
  fitness: number | null;
  status: PathScoreStatus;
  score_coverage: number;
  /** soft cap 是否生效，供 UI 提示 "Climate resilience is weak for this location." */
  soft_capped: boolean;
}

/** 可得维度的权重和。§7.10：右侧展示 "Data coverage: 80%" */
export function scoreCoverage(dims: DimensionScores): number {
  let sum = 0;
  for (const key of DIMENSION_KEYS) {
    if (dims[key] != null) sum += DIMENSION_WEIGHTS[key];
  }
  // 浮点累加会给出 0.7999999999999999 这类值，按权重精度收敛到 2 位
  return Math.round(sum * 100) / 100;
}

/**
 * §7.10 合成 Fitness。
 *
 *   四维齐全 → Fitness = 0.35A + 0.30C + 0.20E + 0.15P
 *   缺某维   → 对可得维度权重归一化，例如缺 Environment：
 *              (0.35A + 0.30C + 0.15P) / 0.80
 *   A / C / P 任一完全不可算 → status = "insufficient_data"，fitness = null
 *
 * **不能因缺失自动给 50。** 缺失既不是 0，也不是 50，更不代表“技术不好”。
 *
 * Climate soft cap：C < 50 且未被硬排除 → Fitness 封顶 65。
 * 规格没写 cap 在四舍五入之前还是之后；此处先 cap 再 round（差异 ≤ 0.05），
 * 已列入待裁定问题。注意 cap 生效后 Fitness 不再等于加权和，做快照断言时要留意。
 */
export function computeFitness(dims: DimensionScores): FitnessOutcome {
  const coverage = scoreCoverage(dims);

  const missingRequired = REQUIRED_DIMENSIONS.some((key) => dims[key] == null);
  if (missingRequired || coverage <= 0) {
    return { fitness: null, status: "insufficient_data", score_coverage: coverage, soft_capped: false };
  }

  let weighted = 0;
  for (const key of DIMENSION_KEYS) {
    const value = dims[key];
    if (value != null) weighted += DIMENSION_WEIGHTS[key] * value;
  }

  let fitness = weighted / coverage;

  const climate = dims.climate_resilience;
  let softCapped = false;
  if (climate != null && climate < CLIMATE_SOFT_CAP.triggerBelow && fitness > CLIMATE_SOFT_CAP.capAt) {
    fitness = CLIMATE_SOFT_CAP.capAt;
    softCapped = true;
  }

  return {
    fitness: round1(clamp(fitness, 0, 100)),
    status: coverage >= 1 ? "ranked" : "preliminary",
    score_coverage: coverage,
    soft_capped: softCapped,
  };
}

export interface RankableCandidate {
  path_id: string;
  fitness: number | null;
  score_coverage: number;
  dimensions: DimensionScores;
  status: PathScoreStatus;
}

/**
 * §7.10 确定性排序，五级 tie-break：
 *   1. fitness 降序
 *   2. score coverage 降序
 *   3. climate resilience 降序
 *   4. affordability 降序
 *   5. path_id 升序
 *
 * 相同输入必须得到完全相同的顺序 —— 这是 §11 Phase 1 的验收条件。
 * insufficient_data 的路径不进排序表（§7.10 的 UI 映射表），由调用方分流。
 */
export function rankPaths<T extends RankableCandidate>(candidates: T[]): T[] {
  const desc = (a: number | null, b: number | null): number => {
    const av = a == null ? -Infinity : a;
    const bv = b == null ? -Infinity : b;
    return bv - av;
  };

  return candidates.slice().sort((a, b) => {
    let d = desc(a.fitness, b.fitness);
    if (d !== 0) return d;
    d = desc(a.score_coverage, b.score_coverage);
    if (d !== 0) return d;
    d = desc(a.dimensions.climate_resilience, b.dimensions.climate_resilience);
    if (d !== 0) return d;
    d = desc(a.dimensions.affordability, b.dimensions.affordability);
    if (d !== 0) return d;
    return a.path_id.localeCompare(b.path_id);
  });
}
