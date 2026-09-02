import type { EnvironmentDetail } from "../global/types";
import { ENVIRONMENT_NEUTRAL_SCORE, ENVIRONMENT_REDUCTION_SLOPE, clamp } from "./config";

/* ---------------------------------------------------------------------------
 * §7.8 Environmental Impact — 20%
 *
 * MVP 只算 operational emissions，不宣称完整生命周期。
 * UI 必须写明：reflects estimated operational emissions, not full lifecycle carbon.
 * ------------------------------------------------------------------------- */

export interface EmissionLine {
  carrier: string;
  annual_energy_use: number | null;
  /** 当地排放因子，kgCO2e / 能源单位。必须是 LOCAL_PUBLIC。 */
  local_emission_factor: number | null;
}

/** §7.8.1 PathEmissions = Σ (AnnualEnergyUse_i × LocalEmissionFactor_i)，kgCO2e/年 */
export function pathEmissions(lines: EmissionLine[]): number | null {
  if (lines.length === 0) return null;
  let total = 0;
  for (const line of lines) {
    if (line.annual_energy_use == null || line.local_emission_factor == null) return null;
    if (!(line.annual_energy_use >= 0) || !(line.local_emission_factor >= 0)) return null;
    total += line.annual_energy_use * line.local_emission_factor;
  }
  return total;
}

export interface EnvironmentInput {
  lines: EmissionLine[];
  /** §7.8.2 参照排放。两种来源二选一，都拿不到就必须是 null。 */
  reference: {
    value: number | null;
    type: "household_baseline" | "regional_equivalent_service" | null;
  };
}

export interface EnvironmentResult {
  score: number | null;
  detail: EnvironmentDetail;
}

/**
 * §7.8.2–§7.8.4
 *
 *   Reduction = (ReferenceEmissions − PathEmissions) / ReferenceEmissions
 *   E = clamp(50 + 50 × Reduction, 0, 100)
 *
 * 关键约束：`no_current_heating` / `not_sure` / 无法可靠反推时，
 * **不得把 reference 当成 0**（那会让任何方案都显示为“恶化”）。
 * 拿不到可靠 reference → environment_score = null，complete = false。
 */
export function scoreEnvironment(input: EnvironmentInput): EnvironmentResult {
  const path = pathEmissions(input.lines);
  const ref = input.reference.value;

  if (path == null || ref == null || !(ref > 0)) {
    return {
      score: null,
      detail: {
        path_emissions_kgco2e: path,
        reference_emissions_kgco2e: ref,
        reduction_pct: null,
        reference_type: input.reference.type ?? undefined,
        complete: false,
      },
    };
  }

  const reduction = (ref - path) / ref;
  const score = clamp(
    ENVIRONMENT_NEUTRAL_SCORE + ENVIRONMENT_REDUCTION_SLOPE * reduction,
    0,
    100,
  );

  return {
    score,
    detail: {
      path_emissions_kgco2e: path,
      reference_emissions_kgco2e: ref,
      reduction_pct: reduction * 100,
      reference_type: input.reference.type ?? undefined,
      complete: true,
    },
  };
}
