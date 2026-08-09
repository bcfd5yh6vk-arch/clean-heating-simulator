/**
 * POST /api/global-feedback
 * Saves anonymous Global G7 feedback. Does not accept PII fields.
 * Prefer Supabase table `global_feedback` when configured.
 */

const ALLOWED_KEYS = new Set([
  "locale",
  "session_id",
  "region",
  "helped_understand_score",
  "ai_helpfulness",
  "improvement_text",
  "ai_used",
]);

const UNDERSTANDING_VALUES = new Set([1, 2, 3, 4, 5]);
const AI_HELPFULNESS_VALUES = new Set([1, 2, 3, 4, 5, "not_used"]);
const IMPROVEMENT_TEXT_MAX_LENGTH = 500;

function normalizeLocale(locale) {
  return String(locale || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
}

function sanitizeImprovementText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, IMPROVEMENT_TEXT_MAX_LENGTH);
}

function isEmptyFeedback(payload) {
  return (
    payload.helped_understand_score == null &&
    payload.ai_helpfulness == null &&
    sanitizeImprovementText(payload.improvement_text).length === 0
  );
}

function validateGlobalFeedbackPayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "Invalid feedback payload.";
  }
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) return `Unexpected field: ${key}`;
  }
  if (!raw.locale) return "Missing locale.";
  if (raw.helped_understand_score != null && !UNDERSTANDING_VALUES.has(Number(raw.helped_understand_score))) {
    return "Invalid helped_understand_score.";
  }
  if (raw.ai_helpfulness != null && !AI_HELPFULNESS_VALUES.has(raw.ai_helpfulness) && !AI_HELPFULNESS_VALUES.has(Number(raw.ai_helpfulness))) {
    return "Invalid ai_helpfulness.";
  }
  if (raw.improvement_text != null && String(raw.improvement_text).length > IMPROVEMENT_TEXT_MAX_LENGTH) {
    return "improvement_text exceeds 500 characters.";
  }
  if (raw.session_id != null && typeof raw.session_id !== "string") {
    return "Invalid session_id.";
  }
  if (raw.region != null) {
    if (typeof raw.region !== "object" || Array.isArray(raw.region)) return "Invalid region.";
    for (const key of Object.keys(raw.region)) {
      if (key !== "country_iso3" && key !== "admin1_name") {
        return `Unexpected region field: ${key}`;
      }
    }
  }
  return null;
}

function sanitizeGlobalFeedbackPayload(raw) {
  const score =
    raw.helped_understand_score == null ? null : Number(raw.helped_understand_score);
  let ai = raw.ai_helpfulness == null ? null : raw.ai_helpfulness;
  if (ai != null && ai !== "not_used") ai = Number(ai);

  return {
    session_id: raw.session_id ? String(raw.session_id).slice(0, 80) : null,
    locale: normalizeLocale(raw.locale),
    country_iso3: raw.region?.country_iso3 ? String(raw.region.country_iso3).slice(0, 8) : null,
    admin1_name:
      raw.region?.admin1_name == null || raw.region?.admin1_name === ""
        ? null
        : String(raw.region.admin1_name).slice(0, 120),
    helped_understand_score: score,
    ai_helpfulness: ai == null ? null : String(ai),
    improvement_text: sanitizeImprovementText(raw.improvement_text) || null,
    ai_used: Boolean(raw.ai_used),
    submitted_at: new Date().toISOString(),
  };
}

async function insertIntoSupabase(row) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return { ok: false, status: 503, error: "Feedback storage is not configured." };
  }

  const response = await fetch(`${url}/rest/v1/global_feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      ok: false,
      status: 502,
      error: "We couldn't save your feedback. You can try again or skip this step.",
      detail,
    };
  }

  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST is supported." });
  }

  const payload = req.body || {};
  const validationError = validateGlobalFeedbackPayload(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (isEmptyFeedback(payload)) {
    return res.status(200).json({
      skipped: true,
      message: "Empty feedback treated as skip.",
    });
  }

  const row = sanitizeGlobalFeedbackPayload(payload);

  try {
    const result = await insertIntoSupabase(row);
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        detail: result.detail,
      });
    }
    return res.status(200).json({
      ok: true,
      submitted_at: row.submitted_at,
    });
  } catch (error) {
    return res.status(502).json({
      error: "We couldn't save your feedback. You can try again or skip this step.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};

module.exports.validateGlobalFeedbackPayload = validateGlobalFeedbackPayload;
module.exports.sanitizeGlobalFeedbackPayload = sanitizeGlobalFeedbackPayload;
module.exports.isEmptyFeedback = isEmptyFeedback;
module.exports.sanitizeImprovementText = sanitizeImprovementText;
