const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("path");

const feedback = require("../../dist/global/feedback.js");
const g7 = require("../../global/g7-feedback.js");


/** 文案已按规格 §5 迁入 i18n/en.json + zh.json（2026-08-24）；
 * 断言"某句 UI 文案存在且双语"时要连同字典一起看。 */
function readCopySources() {
  return (
    fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8") +
    fs.readFileSync(path.join(__dirname, "../../../i18n/en.json"), "utf8") +
    fs.readFileSync(path.join(__dirname, "../../../i18n/zh.json"), "utf8")
  );
}

test("g7 1. GlobalFeedback schema has no PII fields", () => {
  assert.equal(feedback.GLOBAL_FEEDBACK_ALLOWED_KEYS.includes("email"), false);
  assert.equal(feedback.GLOBAL_FEEDBACK_ALLOWED_KEYS.includes("name"), false);
  assert.equal(feedback.GLOBAL_FEEDBACK_ALLOWED_KEYS.includes("phone"), false);
  assert.deepEqual(
    [...feedback.GLOBAL_FEEDBACK_ALLOWED_KEYS].sort(),
    [
      "ai_helpfulness",
      "ai_used",
      "helped_understand_score",
      "improvement_text",
      "locale",
      "region",
      "session_id",
    ].sort(),
  );
});

test("g7 2. sanitize trims and caps improvement_text at 500", () => {
  const long = `  ${"a".repeat(600)}  `;
  const cleaned = feedback.sanitizeImprovementText(long);
  assert.equal(cleaned.length, 500);
  assert.equal(cleaned.startsWith("a"), true);
});

test("g7 3. sanitize strips HTML from improvement_text", () => {
  assert.equal(feedback.sanitizeImprovementText("<b>hi</b> there"), "hi there");
});

test("g7 4. empty feedback is treated as skippable", () => {
  assert.equal(feedback.isEmptyFeedback({}), true);
  assert.equal(feedback.isEmptyFeedback({ helped_understand_score: 4 }), false);
});

test("g7 5. validation rejects unexpected and PII fields", () => {
  assert.match(feedback.validateGlobalFeedbackPayload({ locale: "en", email: "a@b.c" }), /Unexpected|PII|email/);
  assert.match(feedback.validateGlobalFeedbackPayload({ locale: "en", name: "Ada" }), /Unexpected|PII|name/);
});

test("g7 6. validation accepts not_used and 1-5 scores", () => {
  assert.equal(
    feedback.validateGlobalFeedbackPayload({
      locale: "zh",
      helped_understand_score: 5,
      ai_helpfulness: "not_used",
      improvement_text: "more local prices",
    }),
    null,
  );
});

test("g7 7. metrics exclude null understanding and not_used AI scores", () => {
  const metrics = feedback.computeGlobalFeedbackMetrics([
    { helped_understand_score: 5, ai_helpfulness: "5", ai_used: true },
    { helped_understand_score: null, ai_helpfulness: "not_used", ai_used: false },
    { helped_understand_score: 4, ai_helpfulness: "3", ai_used: true },
    { helped_understand_score: 2, ai_helpfulness: null, ai_used: false },
  ]);
  assert.equal(metrics.responses, 4);
  assert.equal(metrics.helped_understand_average, 3.67);
  assert.equal(metrics.helped_understand_positive_rate, 0.667);
  assert.equal(metrics.ai_helpfulness_average, 4);
  assert.equal(metrics.ai_helpfulness_positive_rate, 0.5);
  assert.equal(metrics.ai_usage_rate, 0.5);
  assert.equal(metrics.early_feedback, true);
});

test("g7 8. positive-rate denominator excludes missing responses", () => {
  const metrics = feedback.computeGlobalFeedbackMetrics([
    { helped_understand_score: null },
    { helped_understand_score: 5 },
  ]);
  assert.equal(metrics.helped_understand_positive_rate, 1);
});

test("g7 9. browser helper builds payload without recommendation fields", () => {
  const payload = g7.buildFeedbackPayload({
    locale: "en-US",
    helped_understand_score: "4",
    ai_helpfulness: "not_used",
    improvement_text: "  clearer labels  ",
    ai_used: false,
  });
  assert.equal(payload.locale, "en");
  assert.equal(payload.helped_understand_score, 4);
  assert.equal(payload.ai_helpfulness, "not_used");
  assert.equal(payload.improvement_text, "clearer labels");
  assert.equal("recommendation" in payload, false);
  assert.equal("would_recommend" in payload, false);
});

test("g7 10. suggested AI answer is not_used when AI unused", () => {
  assert.equal(g7.suggestedAiHelpfulness(false), "not_used");
  assert.equal(g7.suggestedAiHelpfulness(true), null);
});

test("g7 11. Global UI renders exactly three feedback questions and skip", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../global/index.html"), "utf8");
  const app = readCopySources();
  assert.equal(html.includes("helped_understand_score") || app.includes("helped_understand_score"), true);
  assert.equal(html.includes("ai_helpfulness") || app.includes("ai_helpfulness"), true);
  assert.equal(html.includes("improvementText"), true);
  assert.equal(html.includes("skipFeedback"), true);
  assert.equal(/Would you recommend this tool|recommendation_rate|Yes \/ Maybe \/ No/.test(html + app), false);
  assert.equal((app.match(/feedbackUnderstandingQuestion|feedbackAiQuestion|feedbackImprovementQuestion/g) || []).length >= 3, true);
});

test("g7 12. Global G7 copy is bilingual and optional", () => {
  const app = readCopySources();
  assert.match(app, /Help us improve/);
  assert.match(app, /帮助我们改进/);
  assert.match(app, /This step is optional/);
  assert.match(app, /本步骤完全自愿/);
  assert.match(app, /I did not use the AI analysis/);
  assert.match(app, /我没有使用 AI 分析/);
});

test("g7 13. AI used flag is set when AI is intentionally triggered", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.match(app, /markAiUsed/);
  assert.match(app, /intentional AI trigger counts as used/);
});

test("g7 14. submit error still allows skip", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.match(app, /feedbackError/);
  assert.match(app, /skipFeedbackButton\.disabled = false/);
  assert.match(app, /finishWithoutFeedback/);
});

test("g7 15. API rejects unexpected fields and uses global_feedback table", () => {
  const api = require("../../../api/global-feedback.js");
  assert.match(
    fs.readFileSync(path.join(__dirname, "../../../api/global-feedback.js"), "utf8"),
    /global_feedback/,
  );
  assert.match(api.validateGlobalFeedbackPayload({ locale: "en", email: "x" }), /Unexpected/);
  assert.equal(api.validateGlobalFeedbackPayload({ locale: "en", ai_helpfulness: "not_used" }), null);
  assert.equal(api.isEmptyFeedback({}), true);
});

test("g7 16. SQL migration creates global_feedback without PII columns", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../../data/supabase/global_feedback.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.global_feedback/);
  assert.equal(/\bemail\b|\bphone\b|\bfull_name\b/.test(sql), false);
  assert.match(sql, /manual review/);
});

test("g7 17. China Pilot survey remains unchanged", () => {
  const index = fs.readFileSync(path.join(__dirname, "../../../index.html"), "utf8");
  assert.match(index, /simulation_sessions/);
  assert.match(index, /q_end_ai_feedback|postGameSurveyForm|survey/);
  assert.equal(index.includes("helped_understand_score"), false);
  assert.equal(index.includes("global_feedback"), false);
});

test("g7 18. Spec documents optional G7 and separate Impact metrics", () => {
  const spec = fs.readFileSync(path.join(__dirname, "../../sandbox-v2-upgrade-spec.md"), "utf8");
  assert.match(spec, /One-minute feedback|1 分钟反馈|optional one-minute feedback/i);
  assert.match(spec, /helped_understand_score/);
  assert.match(spec, /ai_helpfulness/);
  // 规格把这一节改名成 "Global Advisor metrics"（§11 验收项与 /impact 的 02 分区），
  // 要求本身没变：/impact 必须把 China Pilot 证据与 Global Advisor 指标分开展示。
  assert.match(spec, /Global Advisor (Feedback|metrics)/);
  assert.match(spec, /China Pilot Evidence/);
  assert.match(spec, /Deleted from Global G7/);
  assert.match(spec, /Do \*\*not\*\* ask `recommendation`/);
  assert.equal(/\|\s*`recommendation`\s*\|/.test(spec), false);
});

test("g7 19. anonymous improvement text is not auto-published", () => {
  const spec = fs.readFileSync(path.join(__dirname, "../../sandbox-v2-upgrade-spec.md"), "utf8");
  assert.match(spec, /manual review|moderation/i);
  // 规格现在的措辞是 "never auto-publish" 与「不能自动公开」，比原来那句
  // "not automatically published" 更强。要求没松，只是换了说法。
  assert.match(spec, /not automatically published|never auto-publish|不(自动|能自动)公开/i);
});
