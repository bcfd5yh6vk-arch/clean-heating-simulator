const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const g4 = require("../../global/g4-ai-state.js");
const prompts = require("../../../api/global-ai.js");

const rankedPaths = [
  {
    path_id: "path_a",
    path_name: "Ductless heat pump",
    rank: 1,
    fitness: 83.3,
    dimensions: { affordability: 78, climate_resilience: 91, environment: 88, practicality: 70 },
    estimates: { annual_run_cost: 1240, operating_burden_pct: 3.1 },
    warnings: ["Confirm local installer access."],
    tech_cards: [{ tech_id: "ashp_ductless", display_name: "Ductless heat pump", services: ["heating", "cooling"] }],
  },
  {
    path_id: "path_b",
    path_name: "Gas + split AC",
    rank: 2,
    fitness: 74.1,
    dimensions: { affordability: 76, climate_resilience: 77, environment: 58, practicality: 85 },
    estimates: { annual_run_cost: 1510, operating_burden_pct: 3.8 },
    warnings: ["Confirm gas availability."],
    tech_cards: [{ tech_id: "gas_boiler", display_name: "Gas boiler", services: ["heating"] }],
  },
  {
    path_id: "path_c",
    path_name: "District + AC",
    rank: 3,
    fitness: 71.8,
    dimensions: { affordability: 73, climate_resilience: 82, environment: 69, practicality: 58 },
    estimates: { annual_run_cost: 1390, operating_burden_pct: 3.5 },
    warnings: [],
    tech_cards: [{ tech_id: "district_heating", display_name: "District heating", services: ["heating"] }],
  },
];

const shared = {
  locale: "en",
  rankedPaths,
  selectedPathId: "path_b",
  excludedPaths: [{ path_name: "Ground-source heat pump", reason: "Needs large private land." }],
  regionSummary: { country: "United States", admin1: "Illinois" },
  climateSummary: { hdd18: 3400, cdd24: 420 },
  householdSummary: { annual_income: 56000, needs_heating: true, needs_cooling: true },
  homeFeasibilitySummary: { housing_status: "owner", outdoor_space: "small_yard_or_roof" },
  baselineSummary: { heating: ["Delivered fuel"], cooling: ["Room AC"] },
  relevantLocalPublicData: [{ field: "electricity_price_residential", geographic_level: "admin1" }],
};

test("g4 1. initial selected path is rank #1", () => {
  assert.equal(g4.getInitialSelectedPathId(rankedPaths), "path_a");
});

test("g4 2. selected path lookup falls back to rank #1", () => {
  assert.equal(g4.getSelectedPath(rankedPaths, "missing").path_id, "path_a");
});

test("g4 3. clicking #2 updates selectedPathId only", () => {
  assert.equal(g4.selectRankedPath(rankedPaths, "path_b"), "path_b");
  assert.deepEqual(rankedPaths.map((item) => item.path_id), ["path_a", "path_b", "path_c"]);
});

test("g4 4. selected path request targets current selected path", () => {
  const request = g4.buildSelectedPathExplanationRequest(shared);
  assert.equal(request.mode, "selected_path_explanation");
  assert.equal(request.context.selected_path.path_id, "path_b");
});

test("g4 5. selected path request includes nearby context only", () => {
  const request = g4.buildSelectedPathExplanationRequest(shared);
  assert.deepEqual(request.context.nearby_ranked_paths.map((item) => item.path_id), ["path_a", "path_b", "path_c"]);
});

test("g4 6. selected path request does not send all path tech docs", () => {
  const request = g4.buildSelectedPathExplanationRequest(shared);
  assert.deepEqual(request.context.relevant_tech_cards.map((item) => item.tech_id), ["gas_boiler"]);
});

test("g4 7. report request uses full ranked summaries", () => {
  const request = g4.buildHouseholdAnalysisReportRequest(shared);
  assert.equal(request.mode, "household_analysis_report");
  assert.deepEqual(request.context.ranked_paths.map((item) => item.path_id), ["path_a", "path_b", "path_c"]);
});

test("g4 8. report request scope is independent of selectedPath", () => {
  const a = g4.buildHouseholdAnalysisReportRequest({ ...shared, selectedPathId: "path_a" });
  const b = g4.buildHouseholdAnalysisReportRequest({ ...shared, selectedPathId: "path_c" });
  assert.deepEqual(a.context.ranked_paths, b.context.ranked_paths);
});

test("g4 9. report request sends readable excluded summaries", () => {
  const request = g4.buildHouseholdAnalysisReportRequest(shared);
  assert.deepEqual(request.context.excluded_paths, [{ path_name: "Ground-source heat pump", reason: "Needs large private land." }]);
});

test("g4 10. report request limits technology cards to leading paths", () => {
  const request = g4.buildHouseholdAnalysisReportRequest(shared);
  assert.equal(request.context.relevant_tech_cards.length, 3);
});

test("g4 11. zh-CN normalizes to zh", () => {
  assert.equal(g4.normalizeLocale("zh-CN"), "zh");
});

test("g4 12. en-US normalizes to en", () => {
  assert.equal(g4.normalizeLocale("en-US"), "en");
});

test("prompt 13. selected mode validates selected path payload", () => {
  const request = g4.buildSelectedPathExplanationRequest(shared);
  assert.equal(prompts.validatePayload(request), null);
});

test("prompt 14. report mode validates ranked paths", () => {
  const request = g4.buildHouseholdAnalysisReportRequest(shared);
  assert.equal(prompts.validatePayload(request), null);
});

test("prompt 15. unsupported mode returns controlled error", () => {
  assert.match(prompts.validatePayload({ mode: "other", locale: "en", context: {} }), /Unsupported/);
});

test("prompt 16. selected path requires dimensions", () => {
  const request = g4.buildSelectedPathExplanationRequest(shared);
  delete request.context.selected_path.dimensions;
  assert.match(prompts.validatePayload(request), /dimensions/);
});

test("prompt 17. report requires non-empty ranked paths", () => {
  assert.match(prompts.validatePayload({ mode: "household_analysis_report", locale: "en", context: { ranked_paths: [] } }), /ranked_paths/);
});

test("prompt 18. selected mode uses selected-path prompt", () => {
  const request = g4.buildSelectedPathExplanationRequest(shared);
  const { prompt } = prompts.buildPromptForMode(request);
  assert.match(prompt, /explain ONE heating\/cooling path/);
  assert.match(prompt, /Ductless|Gas \+ split AC/);
});

test("prompt 19. report mode uses household report prompt", () => {
  const request = g4.buildHouseholdAnalysisReportRequest(shared);
  const { prompt } = prompts.buildPromptForMode(request);
  assert.match(prompt, /whole-household analysis/);
  assert.match(prompt, /RANKED RESULTS/);
});

test("prompt 20. zh selected prompt is Chinese-only instructed", () => {
  const request = g4.buildSelectedPathExplanationRequest({ ...shared, locale: "zh-CN" });
  const { prompt } = prompts.buildPromptForMode(request);
  assert.match(prompt, /Respond entirely in Simplified Chinese/);
  assert.match(prompt, /## 为什么是这个结果/);
});

test("prompt 21. en report prompt is English-only instructed", () => {
  const request = g4.buildHouseholdAnalysisReportRequest({ ...shared, locale: "en-US" });
  const { prompt } = prompts.buildPromptForMode(request);
  assert.match(prompt, /Respond entirely in English/);
  assert.match(prompt, /## What matters most for your home/);
});

test("prompt 22. prompt forbids recalculation and ranking changes", () => {
  const request = g4.buildHouseholdAnalysisReportRequest(shared);
  const { prompt } = prompts.buildPromptForMode(request);
  assert.match(prompt, /MUST NOT recalculate Fitness/);
  assert.match(prompt, /reorder paths/);
});

test("prompt 23. prompt forbids invented local data", () => {
  const request = g4.buildSelectedPathExplanationRequest(shared);
  const { prompt } = prompts.buildPromptForMode(request);
  assert.match(prompt, /invent prices/);
  assert.match(prompt, /invent subsidies/);
  assert.match(prompt, /invent COP/);
});

test("prompt 24. output sanitizer removes HTML tags", () => {
  assert.equal(prompts.stripUnsafeHtml("## Hi\n<script>x</script>\n<b>bold</b>"), "## Hi\nx\nbold");
});

test("panel 25. Global UI has both AI buttons and inline AI panel", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../global/index.html"), "utf8");
  assert.equal(html.includes("explainSelectedPath"), true);
  assert.equal(html.includes("getAnalysisReport"), true);
  assert.equal(html.includes('id="aiPanel"'), true);
  assert.equal(html.includes("AI Analysis Panel"), true);
  assert.equal(html.includes('id="aiDisclaimer"'), true);
});

test("panel 26. Global UI no longer has preview CTA", () => {
  const text = fs.readFileSync(path.join(__dirname, "../../global/index.html"), "utf8") + fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(/Try preview|mini sandbox|selected path preview/i.test(text), false);
});

test("panel 27. app sends explicit AI mode and stays inline", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(app.includes("MODES.selectedPath"), true);
  assert.equal(app.includes("MODES.householdReport"), true);
  assert.equal(app.includes("Keep users on G4"), true);
  assert.equal(/navigate\s*\(/.test(app.replace(/\/\/[^\n]*/g, "")), false);
  assert.equal(/location\.assign|location\.replace|href\s*=\s*["'`].*global\/ai/.test(app), false);
  assert.equal(app.includes('id="aiPanel"') || app.includes("renderAiPanel"), true);
});

test("panel 28. loading disables concurrent AI requests", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(app.includes('aiAnalysis.status === "loading"'), true);
  assert.equal(app.includes('aiAnalysis.status === "streaming"'), true);
  assert.equal(app.includes("explainButton.disabled"), true);
  assert.equal(app.includes("reportButton.disabled"), true);
});

test("panel 29. app does not mention full catalog in public UI", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(/Technology Catalog|View all technologies|技术目录/.test(app), false);
});

test("panel 30. success disclaimer is UI fixed copy", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.match(app, /successDisclaimer/);
  assert.match(app, /generated by AI and is for reference only/);
  assert.match(app, /此分析由 AI 生成，仅供参考/);
  assert.equal(app.includes("aiDisclaimer.textContent = t(\"successDisclaimer\")"), true);
});

test("panel 31. idle placeholder does not auto-request AI", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.match(app, /Want a clearer explanation/);
  assert.match(app, /想进一步了解结果/);
  assert.equal(app.includes("createIdleAiAnalysisState"), true);
  const submitBody = app.split("function submitG3")[1].split("function rerender")[0];
  assert.equal(submitBody.includes("resetAiAnalysisState"), true);
  assert.equal(submitBody.includes("requestAi("), false);
});

test("panel 32. stale selected-path explanation keeps target label", () => {
  const idle = g4.createIdleAiAnalysisState();
  const success = {
    ...idle,
    mode: g4.MODES.selectedPath,
    status: "success",
    targetPathId: "path_a",
    targetPathName: "Ductless heat pump",
    content: "old explanation",
  };
  assert.equal(g4.shouldShowPathMismatchHint(success, "path_b"), true);
  assert.equal(g4.shouldShowPathMismatchHint(success, "path_a"), false);
  assert.equal(g4.shouldShowPathMismatchHint({ ...success, mode: g4.MODES.householdReport }, "path_b"), false);
});

test("panel 33. scoring input change resets AI analysis to idle", () => {
  const previous = {
    mode: g4.MODES.householdReport,
    status: "success",
    content: "old report",
    error: "",
    targetPathId: null,
    targetPathName: "",
    scoringInputHash: "old",
  };
  const reset = g4.resetAIAnalysis(previous);
  assert.equal(reset.status, "idle");
  assert.equal(reset.mode, null);
  assert.equal(reset.content, "");
  assert.equal(reset.scoringInputHash, "old");
});

test("panel 34. usesInlinePanelOnly remains true", () => {
  assert.equal(g4.usesInlinePanelOnly(), true);
});

test("panel 35. shared panel headings differ by mode", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.match(app, /AI path explanation/);
  assert.match(app, /AI household analysis/);
  assert.match(app, /AI 路径解释/);
  assert.match(app, /AI 家庭整体分析/);
});

test("static 36. spec embeds G5 inside G4 and removes navigate implication", () => {
  const spec = fs.readFileSync(path.join(__dirname, "../../sandbox-v2-upgrade-spec.md"), "utf8");
  assert.match(spec, /AI analysis module \(embedded in G4\)/);
  assert.match(spec, /No route transition is required/);
  assert.match(spec, /AI Analysis Panel/);
  assert.match(spec, /Does \*\*not\*\* navigate away from G4/);
  assert.equal(/navigate to G5|进入独立 G5|route = global-ai/.test(spec), false);
});

test("static 37. China Pilot root remains untouched by Global AI panel", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../vercel.json"), "utf8"));
  const root = vercel.rewrites.find((rewrite) => rewrite.source === "/");
  assert.equal(root.destination, "/index.html");
  const index = fs.readFileSync(path.join(__dirname, "../../../index.html"), "utf8");
  assert.equal(index.includes("AI Analysis Panel"), false);
});
