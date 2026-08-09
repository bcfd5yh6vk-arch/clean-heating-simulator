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

test("static 25. Global UI has both AI buttons", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../global/index.html"), "utf8");
  assert.equal(html.includes("explainSelectedPath"), true);
  assert.equal(html.includes("getAnalysisReport"), true);
});

test("static 26. Global UI no longer has preview CTA", () => {
  const text = fs.readFileSync(path.join(__dirname, "../../global/index.html"), "utf8") + fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(/Try preview|mini sandbox|selected path preview/i.test(text), false);
});

test("static 27. app sends explicit AI mode", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(app.includes("MODES.selectedPath"), true);
  assert.equal(app.includes("MODES.householdReport"), true);
});

test("static 28. app disables requests while loading", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(app.includes("aiInFlight"), true);
  assert.equal(app.includes("if (!request || aiInFlight) return"), true);
});

test("static 29. app does not mention full catalog in public UI", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(/Technology Catalog|View all technologies|技术目录/.test(app), false);
});

test("static 30. spec documents both AI tasks", () => {
  const spec = fs.readFileSync(path.join(__dirname, "../../sandbox-v2-upgrade-spec.md"), "utf8");
  assert.match(spec, /selected_path_explanation/);
  assert.match(spec, /household_analysis_report/);
  assert.match(spec, /Get the analysis report/);
});
