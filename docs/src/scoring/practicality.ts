import type {
  HousingStatus,
  OutdoorSpace,
  PracticalityDetail,
  RenovationTolerance,
} from "../global/types";
import {
  FIT_MARGIN_SCORES,
  INFRASTRUCTURE_SCORES,
  LEVEL_CODES,
  PERMISSION_SCORES,
  PRACTICALITY_MIX,
  clamp,
} from "./config";

/* ---------------------------------------------------------------------------
 * §7.9 Practicality — 15%
 * 只用 G3 答案、客观技术要求、当地基础设施数据。
 * ------------------------------------------------------------------------- */

function levelCode(value: string | null | undefined): number | null {
  if (value == null) return null;
  return Object.prototype.hasOwnProperty.call(LEVEL_CODES, value) ? LEVEL_CODES[value] : null;
}

/**
 * §7.9.1 / §7.9.2 裕度评分
 *   margin ≥ 2 → 100；= 1 → 85；= 0 → 70；用户答 not_sure → 60
 * margin < 0 的情况应已在 §7.3 硬筛选中被排除；若仍出现，按最保守的 0 处理。
 */
export function marginFitScore(userLevel: number | null, techLevel: number | null): number | null {
  if (userLevel == null) return FIT_MARGIN_SCORES.not_sure; // 用户选了 not_sure
  if (techLevel == null) return null;
  const margin = userLevel - techLevel;
  if (margin >= 2) return FIT_MARGIN_SCORES.two_or_more;
  if (margin === 1) return FIT_MARGIN_SCORES.one;
  if (margin === 0) return FIT_MARGIN_SCORES.zero;
  return 0;
}

/** §7.9.3 基础设施适配 */
export type InfrastructureEvidence =
  | "household_confirmed"
  | "local_public_available"
  | "unknown";

export function infrastructureScore(evidence: InfrastructureEvidence): number {
  switch (evidence) {
    case "household_confirmed":
      return INFRASTRUCTURE_SCORES.household_confirmed;
    case "local_public_available":
      return INFRASTRUCTURE_SCORES.local_public;
    default:
      return INFRASTRUCTURE_SCORES.unknown;
  }
}

/**
 * §7.9.4 永久性改造许可
 * 需要改造 + renter_no_permission 的组合应已在 §7.3 排除，此处不再打分。
 */
export function permissionScore(
  permanentModificationRequired: boolean,
  housingStatus: HousingStatus | null | undefined,
): number {
  if (!permanentModificationRequired) return PERMISSION_SCORES.not_required;
  if (housingStatus === "owner") return PERMISSION_SCORES.owner;
  if (housingStatus === "renter_permission") return PERMISSION_SCORES.renter_permission;
  return PERMISSION_SCORES.unknown;
}

export interface PracticalityInput {
  renovationTolerance: RenovationTolerance | null | undefined;
  techInstallationLevel: string | null | undefined;
  outdoorSpace: OutdoorSpace | null | undefined;
  techOutdoorSpaceRequired: string | null | undefined;
  infrastructureEvidence: InfrastructureEvidence;
  permanentModificationRequired: boolean;
  housingStatus: HousingStatus | null | undefined;
}

export interface PracticalityResult {
  score: number | null;
  detail: PracticalityDetail;
}

/** §7.9.5 P = 0.35·Sr + 0.25·Ss + 0.25·Si + 0.15·Sp */
export function scorePracticality(input: PracticalityInput): PracticalityResult {
  const userReno = input.renovationTolerance === "not_sure" ? null : levelCode(input.renovationTolerance);
  const techReno = levelCode(input.techInstallationLevel);
  const sReno = marginFitScore(userReno, techReno);

  const userSpace = input.outdoorSpace === "not_sure" ? null : levelCode(input.outdoorSpace);
  const techSpace = levelCode(input.techOutdoorSpaceRequired);
  const sSpace = marginFitScore(userSpace, techSpace);

  const sInfra = infrastructureScore(input.infrastructureEvidence);
  const sPerm = permissionScore(input.permanentModificationRequired, input.housingStatus);

  // 四项子分中任意一项不可算，整维不可算（不用 0 或 50 顶替）
  if (sReno == null || sSpace == null) {
    return {
      score: null,
      detail: {
        renovation_score: sReno,
        outdoor_space_score: sSpace,
        infrastructure_score: sInfra,
        permission_score: sPerm,
        complete: false,
      },
    };
  }

  const score = clamp(
    PRACTICALITY_MIX.renovation * sReno +
      PRACTICALITY_MIX.space * sSpace +
      PRACTICALITY_MIX.infrastructure * sInfra +
      PRACTICALITY_MIX.permission * sPerm,
    0,
    100,
  );

  return {
    score,
    detail: {
      renovation_score: sReno,
      outdoor_space_score: sSpace,
      infrastructure_score: sInfra,
      permission_score: sPerm,
      // “complete” 指四项都由可靠证据得出；unknown 兜底的 60 不算完整
      complete: input.infrastructureEvidence !== "unknown",
    },
  };
}
