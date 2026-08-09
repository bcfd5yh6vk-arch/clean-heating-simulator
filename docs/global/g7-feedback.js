(function initG7Feedback(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.G7Feedback = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createG7Feedback() {
  const IMPROVEMENT_TEXT_MAX_LENGTH = 500;
  const SESSION_KEY = "global_anonymous_session_id";
  const AI_USED_KEY = "global_ai_used";

  function normalizeLocale(locale) {
    return String(locale || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function getOrCreateAnonymousSessionId() {
    try {
      const existing = localStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      const created =
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(SESSION_KEY, created);
      return created;
    } catch (_error) {
      return `anon_${Date.now()}`;
    }
  }

  function markAiUsed() {
    try {
      localStorage.setItem(AI_USED_KEY, "1");
    } catch (_error) {
      // ignore storage failures
    }
    return true;
  }

  function readAiUsed() {
    try {
      return localStorage.getItem(AI_USED_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function clearAiUsedForNewFlow() {
    try {
      localStorage.removeItem(AI_USED_KEY);
    } catch (_error) {
      // ignore
    }
  }

  function sanitizeImprovementText(value) {
    return String(value ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, IMPROVEMENT_TEXT_MAX_LENGTH);
  }

  function parseUnderstanding(value) {
    if (value == null || value === "") return null;
    const number = Number(value);
    return [1, 2, 3, 4, 5].includes(number) ? number : null;
  }

  function parseAiHelpfulness(value) {
    if (value == null || value === "") return null;
    if (value === "not_used") return "not_used";
    const number = Number(value);
    return [1, 2, 3, 4, 5].includes(number) ? number : null;
  }

  function isEmptyFeedback(answers) {
    return (
      answers.helped_understand_score == null &&
      answers.ai_helpfulness == null &&
      sanitizeImprovementText(answers.improvement_text).length === 0
    );
  }

  function buildFeedbackPayload(input) {
    return {
      locale: normalizeLocale(input.locale),
      session_id: input.session_id || getOrCreateAnonymousSessionId(),
      region: {
        country_iso3: input.country_iso3 || undefined,
        admin1_name: input.admin1_name == null ? null : input.admin1_name,
      },
      helped_understand_score: parseUnderstanding(input.helped_understand_score),
      ai_helpfulness: parseAiHelpfulness(input.ai_helpfulness),
      improvement_text: sanitizeImprovementText(input.improvement_text),
      ai_used: Boolean(input.ai_used ?? readAiUsed()),
    };
  }

  function suggestedAiHelpfulness(aiUsed) {
    return aiUsed ? null : "not_used";
  }

  return {
    IMPROVEMENT_TEXT_MAX_LENGTH,
    normalizeLocale,
    getOrCreateAnonymousSessionId,
    markAiUsed,
    readAiUsed,
    clearAiUsedForNewFlow,
    sanitizeImprovementText,
    parseUnderstanding,
    parseAiHelpfulness,
    isEmptyFeedback,
    buildFeedbackPayload,
    suggestedAiHelpfulness,
  };
});
