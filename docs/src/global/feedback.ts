export type FeedbackLocale = "en" | "zh";

export type HelpedUnderstandScore = 1 | 2 | 3 | 4 | 5;

export type AiHelpfulnessScore = 1 | 2 | 3 | 4 | 5 | "not_used";

export interface GlobalFeedbackRegion {
  country_iso3?: string;
  admin1_name?: string | null;
}

export interface GlobalFeedback {
  session_id?: string;
  locale: FeedbackLocale;
  region?: GlobalFeedbackRegion;
  helped_understand_score?: HelpedUnderstandScore | null;
  ai_helpfulness?: AiHelpfulnessScore | null;
  improvement_text?: string;
  ai_used?: boolean;
  submitted_at?: string;
}

export interface GlobalFeedbackPayload {
  locale: FeedbackLocale;
  session_id?: string | null;
  region?: GlobalFeedbackRegion | null;
  helped_understand_score?: HelpedUnderstandScore | null;
  ai_helpfulness?: AiHelpfulnessScore | null;
  improvement_text?: string | null;
  ai_used?: boolean | null;
}

export interface GlobalFeedbackMetrics {
  responses: number;
  helped_understand_average: number | null;
  helped_understand_positive_rate: number | null;
  ai_helpfulness_average: number | null;
  ai_helpfulness_positive_rate: number | null;
  ai_usage_rate: number | null;
  early_feedback: boolean;
}

export const IMPROVEMENT_TEXT_MAX_LENGTH = 500;
export const GLOBAL_FEEDBACK_ALLOWED_KEYS = [
  "locale",
  "session_id",
  "region",
  "helped_understand_score",
  "ai_helpfulness",
  "improvement_text",
  "ai_used",
] as const;

const UNDERSTANDING_VALUES = new Set([1, 2, 3, 4, 5]);
const AI_HELPFULNESS_VALUES = new Set([1, 2, 3, 4, 5, "not_used"]);

export function normalizeFeedbackLocale(locale: unknown): FeedbackLocale {
  return String(locale || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function sanitizeImprovementText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, IMPROVEMENT_TEXT_MAX_LENGTH);
}

export function isEmptyFeedback(payload: {
  helped_understand_score?: number | null;
  ai_helpfulness?: AiHelpfulnessScore | null;
  improvement_text?: string | null;
}): boolean {
  const text = sanitizeImprovementText(payload.improvement_text);
  return payload.helped_understand_score == null && payload.ai_helpfulness == null && text.length === 0;
}

export function validateGlobalFeedbackPayload(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "Invalid feedback payload.";
  }
  const payload = raw as Record<string, unknown>;
  for (const key of Object.keys(payload)) {
    if (!GLOBAL_FEEDBACK_ALLOWED_KEYS.includes(key as (typeof GLOBAL_FEEDBACK_ALLOWED_KEYS)[number])) {
      return `Unexpected field: ${key}`;
    }
  }
  if (!payload.locale) return "Missing locale.";
  if (payload.helped_understand_score != null && !UNDERSTANDING_VALUES.has(payload.helped_understand_score as number)) {
    return "Invalid helped_understand_score.";
  }
  if (payload.ai_helpfulness != null && !AI_HELPFULNESS_VALUES.has(payload.ai_helpfulness as AiHelpfulnessScore)) {
    return "Invalid ai_helpfulness.";
  }
  if (payload.improvement_text != null && String(payload.improvement_text).length > IMPROVEMENT_TEXT_MAX_LENGTH) {
    return "improvement_text exceeds 500 characters.";
  }
  if (payload.session_id != null && typeof payload.session_id !== "string") {
    return "Invalid session_id.";
  }
  if (payload.region != null) {
    if (typeof payload.region !== "object" || Array.isArray(payload.region)) {
      return "Invalid region.";
    }
    const region = payload.region as Record<string, unknown>;
    for (const key of Object.keys(region)) {
      if (key !== "country_iso3" && key !== "admin1_name") {
        return `Unexpected region field: ${key}`;
      }
    }
  }
  const forbidden = ["name", "email", "phone", "address", "ip", "fingerprint"];
  for (const key of forbidden) {
    if (key in payload) return `PII field not allowed: ${key}`;
  }
  return null;
}

export function sanitizeGlobalFeedbackPayload(raw: GlobalFeedbackPayload): GlobalFeedback {
  const region = raw.region
    ? {
        country_iso3: raw.region.country_iso3 ? String(raw.region.country_iso3).slice(0, 8) : undefined,
        admin1_name:
          raw.region.admin1_name == null || raw.region.admin1_name === ""
            ? null
            : String(raw.region.admin1_name).slice(0, 120),
      }
    : undefined;

  return {
    session_id: raw.session_id ? String(raw.session_id).slice(0, 80) : undefined,
    locale: normalizeFeedbackLocale(raw.locale),
    region,
    helped_understand_score:
      raw.helped_understand_score == null ? null : (Number(raw.helped_understand_score) as HelpedUnderstandScore),
    ai_helpfulness: raw.ai_helpfulness == null ? null : (raw.ai_helpfulness as AiHelpfulnessScore),
    improvement_text: sanitizeImprovementText(raw.improvement_text),
    ai_used: Boolean(raw.ai_used),
    submitted_at: new Date().toISOString(),
  };
}

export function toGlobalFeedbackRow(feedback: GlobalFeedback) {
  return {
    session_id: feedback.session_id ?? null,
    locale: feedback.locale,
    country_iso3: feedback.region?.country_iso3 ?? null,
    admin1_name: feedback.region?.admin1_name ?? null,
    helped_understand_score: feedback.helped_understand_score ?? null,
    ai_helpfulness:
      feedback.ai_helpfulness == null ? null : String(feedback.ai_helpfulness),
    improvement_text: feedback.improvement_text || null,
    ai_used: Boolean(feedback.ai_used),
    submitted_at: feedback.submitted_at ?? new Date().toISOString(),
  };
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function positiveRate(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.filter((value) => value >= 4).length / values.length).toFixed(3));
}

/** Impact Dashboard metrics for Global Advisor Feedback only (never merge with China Pilot). */
export function computeGlobalFeedbackMetrics(
  rows: Array<{
    helped_understand_score?: number | null;
    ai_helpfulness?: string | number | null;
    ai_used?: boolean | null;
  }>,
  options: { earlyThreshold?: number } = {},
): GlobalFeedbackMetrics {
  const earlyThreshold = options.earlyThreshold ?? 30;
  const understanding = rows
    .map((row) => row.helped_understand_score)
    .filter((value): value is number => typeof value === "number" && UNDERSTANDING_VALUES.has(value));

  const aiNumeric = rows
    .map((row) => {
      if (row.ai_helpfulness == null || row.ai_helpfulness === "not_used") return null;
      const value = Number(row.ai_helpfulness);
      return UNDERSTANDING_VALUES.has(value) ? value : null;
    })
    .filter((value): value is number => value != null);

  const aiUsedKnown = rows.filter((row) => typeof row.ai_used === "boolean");
  const aiUsedTrue = aiUsedKnown.filter((row) => row.ai_used === true).length;

  return {
    responses: rows.length,
    helped_understand_average: average(understanding),
    helped_understand_positive_rate: positiveRate(understanding),
    ai_helpfulness_average: average(aiNumeric),
    ai_helpfulness_positive_rate: positiveRate(aiNumeric),
    ai_usage_rate: aiUsedKnown.length
      ? Number((aiUsedTrue / aiUsedKnown.length).toFixed(3))
      : null,
    early_feedback: rows.length > 0 && rows.length < earlyThreshold,
  };
}
