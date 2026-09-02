const test = require("node:test");
const assert = require("node:assert/strict");

const {
  // §7.5
  computeDegreeDays,
  serviceWeights,
  // §7.6
  operatingBurdenScore,
  upfrontScore,
  upfrontRatio,
  scoreAffordability,
  // §7.7
  scoreTemperatureMargin,
  normalizeSeasonalScores,
  violatesSafetyGuardrail,
  // §7.8
  scoreEnvironment,
  // §7.9
  scorePracticality,
  // §7.10
  computeFitness,
  scoreCoverage,
  rankPaths,
  // provenance
  resolveScoringValue,
  // engine
  scorePaths,
  buildBaselineProfile,
  screenTechnologies,
  generateCandidatePaths,
} = require("../../dist/global");

const catalogRaw = require("../../data/technologies/technology_catalog.json");
const { fixtureBundle, emptyBundle, climateWithMonthly, GEO } = require("./fixtures/scoring-data");

/* ------------------------------------------------------------------ setup */

const household = {
  household_size: 3,
  currency: "USD",
  annual_income: 62000,
  floor_area_m2: 130,
  needs_heating: true,
  heating_spend_annual: 1400,
  needs_cooling: true,
  cooling_spend_annual: 420,
};

const feasibility = {
  housing_status: "owner",
  building_type: "detached",
  renovation_tolerance: "moderate",
  outdoor_space: "small_yard_or_roof",
  current_energy_services: ["electricity", "piped_gas"],
  current_heating_methods: ["piped_gas_heating"],
  current_cooling_methods: ["room_air_conditioning"],
  upfront_cost_preference: "moderate_investment",
};

const region = { region_id: "us-il", label_en: "Illinois", infrastructure: {} };

const catalogMap = new Map(catalogRaw.map((t) => [t.tech_id, t]));

/** 用真实目录跑完硬筛选 + 路径生成，再交给新引擎打分 */
function runEngine({ data = fixtureBundle, climate = climateWithMonthly } = {}) {
  const techProfiles = catalogRaw.map((t) => ({
    tech_id: t.tech_id,
    display_name_en: t.display_name_en,
    display_name_zh: t.display_name_zh,
    services: t.services,
    installation_level: t.screening.installation_level,
    outdoor_space_required: t.screening.outdoor_space_required,
    permanent_modification_required: t.screening.permanent_modification_required,
    data_confidence: "medium",
    role: t.role,
    catalog_status: t.catalog_status,
    ranking_mode: t.ranking_mode,
  }));
  const baseline = buildBaselineProfile(household, feasibility, region);
  const screening = screenTechnologies(region, climate, household, feasibility, techProfiles);
  const paths = generateCandidatePaths(
    screening.passed, baseline, region, climate, household, techProfiles,
  );
  return scorePaths(paths, {
    household,
    feasibility,
    climate,
    geo: GEO,
    data,
    catalog: catalogMap,
  });
}

/* --------------------------------------------------- §7.11 missing ≠ 50 */

test("scoring 1. 没有任何 LOCAL_PUBLIC 数据时，所有路径都是 insufficient_data", () => {
  const { ranked, unrankable } = runEngine({ data: emptyBundle });
  assert.equal(ranked.length, 0, "缺数据时不得给出任何排序结果");
  assert.ok(unrankable.length > 0, "候选路径应落入 Could not rank");
  for (const path of unrankable) {
    assert.equal(path.status, "insufficient_data");
    assert.equal(path.fitness, null);
    assert.equal(path.rank, null);
  }
});

test("scoring 2. 缺失维度返回 null —— 既不是 0 也不是 50", () => {
  const { unrankable } = runEngine({ data: emptyBundle });
  const dims = unrankable.flatMap((p) => Object.values(p.dimensions));
  assert.ok(dims.length > 0);
  for (const value of dims) {
    assert.notEqual(value, 50, "§7.4 明令禁止“未知给 50”");
  }
  // 可负担性在无价格时必须是 null
  assert.equal(unrankable[0].dimensions.affordability, null);
});

test("scoring 3. 缺 installed cost 时 S_upfront 为 null，A 退化为 S_run", () => {
  const withRunCostOnly = scoreAffordability({
    energyLines: [{ carrier: "electricity", annual_energy_use: 5000, local_unit_price: 0.16 }],
    annualIncome: 62000,
    installedCost: null,
    upfrontPreference: "moderate_investment",
  });
  assert.equal(withRunCostOnly.detail.upfront_score, null);
  assert.equal(withRunCostOnly.detail.complete, false);
  assert.equal(withRunCostOnly.score, withRunCostOnly.detail.operating_burden_score);
});

/* ------------------------------------------------------------- §7.6 公式 */

test("scoring 4. 运行负担率分段函数在各断点上与规格一致且连续", () => {
  assert.equal(operatingBurdenScore(0), 100);
  assert.equal(operatingBurdenScore(3), 100);
  assert.equal(operatingBurdenScore(5), 85);
  assert.equal(operatingBurdenScore(10), 50);
  assert.equal(operatingBurdenScore(20), 10);
  assert.equal(operatingBurdenScore(25), 0);
  assert.equal(operatingBurdenScore(40), 0);
  // 段内线性
  assert.equal(operatingBurdenScore(4), 92.5);
  assert.equal(operatingBurdenScore(15), 30);
  assert.equal(operatingBurdenScore(null), null);
});

test("scoring 5. S_upfront：ratio=0→100，ratio=t→50，ratio=2t→0", () => {
  const t = 0.25; // moderate_investment
  assert.equal(upfrontScore(0, "moderate_investment"), 100);
  assert.equal(upfrontScore(t, "moderate_investment"), 50);
  assert.equal(upfrontScore(2 * t, "moderate_investment"), 0);
  assert.equal(upfrontScore(4 * t, "moderate_investment"), 0, "必须 clamp 到 0");
  assert.equal(upfrontRatio(12400, 62000), 0.2);
  assert.equal(upfrontScore(null, "moderate_investment"), null);
});

/* ------------------------------------------------------------- §7.7 气候 */

test("scoring 6. scoreTemperatureMargin 各断点，含 -5 处的不连续", () => {
  assert.equal(scoreTemperatureMargin(12), 100);
  assert.equal(scoreTemperatureMargin(10), 100);
  assert.equal(scoreTemperatureMargin(5), 85);
  assert.equal(scoreTemperatureMargin(0), 60);
  assert.equal(scoreTemperatureMargin(-5), 30);
  // 规格在此处不连续：-5 给 30，略低于 -5 直接给 0
  assert.equal(scoreTemperatureMargin(-5.01), 0);
  assert.equal(scoreTemperatureMargin(null), null);
});

test("scoring 7. 季节性能是候选集内的相对归一化", () => {
  assert.deepEqual(normalizeSeasonalScores([100, 200, 300]), [100, 50, 0]);
  assert.deepEqual(normalizeSeasonalScores([50, 50, 50]), [100, 100, 100]);
  assert.deepEqual(normalizeSeasonalScores([null, 100, 200]), [null, 100, 0]);
  assert.deepEqual(normalizeSeasonalScores([null, null]), [null, null]);
});

test("scoring 8. §7.7.5 安全护栏只在高置信度且无备用时触发", () => {
  const base = { extremeScore: 0, operatingRangeConfidence: "high", backupSupported: false, fallbackPossible: false };
  assert.equal(violatesSafetyGuardrail(base), true);
  assert.equal(violatesSafetyGuardrail({ ...base, backupSupported: true }), false);
  assert.equal(violatesSafetyGuardrail({ ...base, operatingRangeConfidence: "low" }), false);
  assert.equal(violatesSafetyGuardrail({ ...base, extremeScore: 10 }), false);
});

test("scoring 9. HDD18 / CDD24 由月均温推出，缺月份则整体不可算", () => {
  const dd = computeDegreeDays(climateWithMonthly);
  assert.ok(dd.hdd18 > 0 && dd.cdd24 > 0);
  assert.deepEqual(computeDegreeDays({ temperature_c_monthly: [1, 2, 3] }), { hdd18: null, cdd24: null });
  assert.deepEqual(computeDegreeDays(null), { hdd18: null, cdd24: null });
  // 全年恒 18℃ → 两者都为 0
  assert.deepEqual(computeDegreeDays({ temperature_c_monthly: new Array(12).fill(18) }), { hdd18: 0, cdd24: 0 });
});

test("scoring 10. 冷热权重优先用负荷，退化时才用度日", () => {
  const dd = computeDegreeDays(climateWithMonthly);
  assert.equal(serviceWeights(true, false, null, null, dd).weighting_source, "single_service");
  assert.equal(serviceWeights(true, true, 300, 100, dd).weighting_source, "load_based");
  assert.equal(serviceWeights(true, true, 300, 100, dd).wH, 0.75);
  assert.equal(serviceWeights(true, true, null, null, dd).weighting_source, "degree_day_fallback");
});

/* ------------------------------------------------------- §7.8 / §7.9 */

test("scoring 11. 参照排放缺失时环境分为 null，绝不把 reference 当 0", () => {
  const result = scoreEnvironment({
    lines: [{ carrier: "electricity", annual_energy_use: 4000, local_emission_factor: 0.37 }],
    reference: { value: null, type: null },
  });
  assert.equal(result.score, null);
  assert.equal(result.detail.complete, false);
  assert.ok(result.detail.path_emissions_kgco2e > 0, "路径排放本身仍应算出");

  // E = clamp(50 + 50 × Reduction, 0, 100)：路径排放 = 1000 × 0.4 = 400
  const neutral = scoreEnvironment({
    lines: [{ carrier: "electricity", annual_energy_use: 1000, local_emission_factor: 0.4 }],
    reference: { value: 400, type: "household_baseline" },
  });
  assert.equal(neutral.score, 50, "减排 0% → 50 分");

  const halved = scoreEnvironment({
    lines: [{ carrier: "electricity", annual_energy_use: 1000, local_emission_factor: 0.4 }],
    reference: { value: 800, type: "household_baseline" },
  });
  assert.equal(halved.score, 75, "减排 50% → 75 分");

  const worse = scoreEnvironment({
    lines: [{ carrier: "electricity", annual_energy_use: 1000, local_emission_factor: 0.4 }],
    reference: { value: 200, type: "household_baseline" },
  });
  assert.equal(worse.score, 0, "排放翻倍（−100%）→ clamp 到 0");
});

test("scoring 12. Practicality 四项子分与加权", () => {
  const result = scorePracticality({
    renovationTolerance: "major",
    techInstallationLevel: "minor",
    outdoorSpace: "large_private_land",
    techOutdoorSpaceRequired: "wall_or_balcony",
    infrastructureEvidence: "household_confirmed",
    permanentModificationRequired: true,
    housingStatus: "owner",
  });
  // margin 都 = 2 → 100/100，基础设施 100，许可 100
  assert.equal(result.score, 100);
  assert.equal(result.detail.complete, true);

  const unknownInfra = scorePracticality({
    renovationTolerance: "not_sure",
    techInstallationLevel: "moderate",
    outdoorSpace: "not_sure",
    techOutdoorSpaceRequired: "none",
    infrastructureEvidence: "unknown",
    permanentModificationRequired: false,
    housingStatus: "renter_not_sure",
  });
  assert.equal(unknownInfra.detail.renovation_score, 60, "not_sure → 60");
  assert.equal(unknownInfra.detail.complete, false);
});

/* --------------------------------------------------------- §7.10 合成 */

test("scoring 13. 缺 Environment 时按可得权重归一化，status 变 preliminary", () => {
  const outcome = computeFitness({
    affordability: 80,
    climate_resilience: 70,
    environment: null,
    practicality: 60,
  });
  assert.equal(outcome.score_coverage, 0.8);
  assert.equal(outcome.status, "preliminary");
  const expected = (0.35 * 80 + 0.3 * 70 + 0.15 * 60) / 0.8;
  assert.equal(outcome.fitness, Math.round(expected * 10) / 10);
});

test("scoring 14. A/C/P 任一不可算 → insufficient_data", () => {
  for (const key of ["affordability", "climate_resilience", "practicality"]) {
    const dims = { affordability: 70, climate_resilience: 70, environment: 70, practicality: 70 };
    dims[key] = null;
    const outcome = computeFitness(dims);
    assert.equal(outcome.status, "insufficient_data", `${key} 缺失时必须 insufficient_data`);
    assert.equal(outcome.fitness, null);
  }
  // 只缺 Environment 不算 insufficient
  assert.notEqual(
    computeFitness({ affordability: 70, climate_resilience: 70, environment: null, practicality: 70 }).status,
    "insufficient_data",
  );
});

test("scoring 15. Climate < 50 触发 soft cap，Fitness 封顶 65", () => {
  const outcome = computeFitness({
    affordability: 100, climate_resilience: 49, environment: 100, practicality: 100,
  });
  assert.equal(outcome.fitness, 65);
  assert.equal(outcome.soft_capped, true);

  const notCapped = computeFitness({
    affordability: 100, climate_resilience: 50, environment: 100, practicality: 100,
  });
  assert.equal(notCapped.soft_capped, false);
});

test("scoring 16. 排序 tie-break：fitness → coverage → climate → affordability → path_id", () => {
  const mk = (path_id, fitness, cov, climate, afford) => ({
    path_id, fitness, score_coverage: cov, status: "ranked",
    dimensions: { affordability: afford, climate_resilience: climate, environment: null, practicality: null },
  });
  const ordered = rankPaths([
    mk("b", 70, 1, 60, 60),
    mk("a", 70, 1, 60, 60),   // 与 b 全同 → 靠 path_id
    mk("c", 70, 0.8, 90, 90), // coverage 低 → 排后
    mk("d", 80, 0.8, 10, 10), // fitness 高 → 最前
    mk("e", 70, 1, 70, 10),   // climate 更高 → 在 a/b 之前
  ]).map((r) => r.path_id);
  assert.deepEqual(ordered, ["d", "e", "a", "b", "c"]);
});

test("scoring 17. scoreCoverage 是可得维度的权重和", () => {
  assert.equal(scoreCoverage({ affordability: 1, climate_resilience: 1, environment: 1, practicality: 1 }), 1);
  assert.equal(scoreCoverage({ affordability: 1, climate_resilience: 1, environment: null, practicality: 1 }), 0.8);
  assert.equal(scoreCoverage({ affordability: null, climate_resilience: null, environment: null, practicality: null }), 0);
});

/* ------------------------------------------------------- §7.4 provenance */

test("scoring 18. 地理 fallback：admin1 优先于 country，都没有则 null", () => {
  const ds = fixtureBundle.residential_energy_prices;
  assert.equal(resolveScoringValue(ds, "electricity", GEO).geography.level, "admin1");
  assert.equal(
    resolveScoringValue(ds, "electricity", { country_iso3: "USA" }).geography.level,
    "country",
  );
  assert.equal(resolveScoringValue(ds, "electricity", { country_iso3: "DEU" }), null);
  assert.equal(resolveScoringValue(ds, "unobtainium", GEO), null);
  assert.equal(resolveScoringValue(null, "electricity", GEO), null);
});

/* ------------------------------------------------------------ 端到端 */

test("scoring 19. 有数据时能产出排序结果，且每条都符合 canonical 契约", () => {
  const { ranked } = runEngine();
  assert.ok(ranked.length > 0, "有夹具数据时应能排出路径");
  ranked.forEach((path, i) => {
    assert.equal(path.rank, i + 1, "rank 必须是 1 起的连续序号");
    assert.ok(typeof path.display_name_en === "string" && path.display_name_en.length > 0);
    assert.ok(typeof path.display_name_zh === "string" && path.display_name_zh.length > 0);
    assert.ok(["ranked", "preliminary"].includes(path.status));
    assert.ok(path.fitness >= 0 && path.fitness <= 100);
    assert.ok(path.score_coverage > 0 && path.score_coverage <= 1);
    // 四维契约，不得再出现旧五维字段
    assert.deepEqual(
      Object.keys(path.dimensions).sort(),
      ["affordability", "climate_resilience", "environment", "practicality"],
    );
    for (const legacy of ["cost", "carbon", "comfort", "climate", "simple"]) {
      assert.equal(legacy in path.dimensions, false, `废弃维度 ${legacy} 不得出现`);
    }
    assert.ok(path.dimension_details.affordability);
    assert.ok(Array.isArray(path.warnings));
  });
});

test("scoring 20. 确定性：同一输入跑两次结果逐字节相同", () => {
  const a = JSON.stringify(runEngine());
  const b = JSON.stringify(runEngine());
  assert.equal(a, b, "§11 Phase 1 验收：同一 JSON 输入 fitness 列表必须可复现");
});

test("scoring 21. 技术目录顺序不影响最终排序", () => {
  const normal = runEngine().ranked.map((p) => p.path_id);
  const shuffledCatalog = new Map([...catalogMap.entries()].reverse());
  const baseline = buildBaselineProfile(household, feasibility, region);
  const techProfiles = [...shuffledCatalog.values()].map((t) => ({
    tech_id: t.tech_id,
    display_name_en: t.display_name_en,
    display_name_zh: t.display_name_zh,
    services: t.services,
    installation_level: t.screening.installation_level,
    outdoor_space_required: t.screening.outdoor_space_required,
    permanent_modification_required: t.screening.permanent_modification_required,
    data_confidence: "medium",
    role: t.role,
    catalog_status: t.catalog_status,
    ranking_mode: t.ranking_mode,
  }));
  const screening = screenTechnologies(region, climateWithMonthly, household, feasibility, techProfiles);
  const paths = generateCandidatePaths(
    screening.passed, baseline, region, climateWithMonthly, household, techProfiles,
  );
  const reversed = scorePaths(paths, {
    household, feasibility, climate: climateWithMonthly, geo: GEO,
    data: fixtureBundle, catalog: shuffledCatalog,
  }).ranked.map((p) => p.path_id);
  assert.deepEqual(reversed, normal);
});

test("scoring 22. 缺月均温时气候维不可算，整条路径落入 insufficient_data", () => {
  const noMonthly = { ...climateWithMonthly, temperature_c_monthly: undefined };
  const { ranked, unrankable } = runEngine({ climate: noMonthly });
  // 没有 HDD/CDD，冷热权重退化为 unavailable → climate 无法合成
  assert.equal(ranked.length + unrankable.length > 0, true);
  for (const path of unrankable) {
    assert.equal(path.fitness, null);
  }
});
