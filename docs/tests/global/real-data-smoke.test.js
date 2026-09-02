const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildBaselineProfile,
  screenTechnologies,
  generateCandidatePaths,
  scorePaths,
} = require("../../dist/global");

const catalogRaw = require("../../data/technologies/technology_catalog.json");
const { climateWithMonthly } = require("./fixtures/scoring-data");

/* ---------------------------------------------------------------------------
 * 真实数据冒烟测试：用 docs/data/scoring/ 里的生产数据（不是合成夹具）跑完整管线。
 *
 * 它守两件事：
 *   1. 美国家庭必须能算出完整四维——价格/排放因子/设备性能三类数据的 subject 键
 *      和地理码只要有一处与引擎消费端漂移，这里立刻红。
 *   2. 中国家庭目前必须是 insufficient_data——设备性能只有美国口径
 *      （HSPF2/SEER2 不得冒充中国 APF，见 technology_performance.json 的 _not_covered）。
 *      这条断言把「中国 Global 流程还不可算」钉成显式事实：
 *      落地中国设备性能口径（HANDOFF 批次 2）时，必须有意识地翻转它，
 *      而不是让行为悄悄变化。
 * ------------------------------------------------------------------------- */

const DATA_DIR = path.join(__dirname, "../../data/scoring");

function loadReal(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name + ".json"), "utf8"));
}

const realBundle = {
  residential_energy_prices: loadReal("residential_energy_prices"),
  technology_performance: loadReal("technology_performance"),
  technology_installed_costs: loadReal("technology_installed_costs"),
  electricity_emission_factors: loadReal("electricity_emission_factors"),
  fuel_emission_factors: loadReal("fuel_emission_factors"),
  infrastructure_availability: loadReal("infrastructure_availability"),
};

const catalogMap = new Map(catalogRaw.map((t) => [t.tech_id, t]));
const region = { region_id: "smoke", label_en: "Smoke", infrastructure: {} };

function runEngine(household, feasibility, geo) {
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
  const screening = screenTechnologies(region, climateWithMonthly, household, feasibility, techProfiles);
  const paths = generateCandidatePaths(
    screening.passed, baseline, region, climateWithMonthly, household, techProfiles,
  );
  return scorePaths(paths, {
    household,
    feasibility,
    climate: climateWithMonthly,
    geo,
    data: realBundle,
    catalog: catalogMap,
  });
}

test("真实数据：伊利诺伊燃气供暖家庭能得到完整四维排名", () => {
  const { ranked } = runEngine(
    {
      household_size: 3, currency: "USD", annual_income: 62000, floor_area_m2: 130,
      needs_heating: true, heating_spend_annual: 1400,
      needs_cooling: true, cooling_spend_annual: 420,
    },
    {
      housing_status: "owner", building_type: "detached", renovation_tolerance: "moderate",
      outdoor_space: "small_yard_or_roof",
      current_energy_services: ["electricity", "piped_gas"],
      current_heating_methods: ["piped_gas_heating"],
      current_cooling_methods: ["room_air_conditioning"],
      upfront_cost_preference: "moderate_investment",
    },
    { country_iso3: "USA", admin1_code: "IL" },
  );
  assert.ok(ranked.length > 0, "真实数据下一条可排序路径都没有——数据键与引擎消费端漂移了");

  // 至少一条热泵路径四维齐全（装机成本仍是 AWAITING，允许 A 维退化但不允许为 null）
  const hp = ranked.find((p) => p.primary_tech_ids && String(p.primary_tech_ids[0]).startsWith("ashp"));
  assert.ok(hp, "排名里没有任何空气源热泵路径");
  for (const dim of ["affordability", "climate_resilience", "environment", "practicality"]) {
    assert.ok(
      typeof hp.dimensions[dim] === "number",
      `热泵路径的 ${dim} 是 ${hp.dimensions[dim]}——对应数据集没被读到`,
    );
  }
  assert.ok(hp.estimates.annual_run_cost > 0, "年运行费没算出来");
  assert.ok(hp.estimates.annual_emissions_kgco2e > 0, "年排放没算出来");
});

test("真实数据：中国电采暖家庭能得到完整四维排名（批次 3 备案库数据已落地）", () => {
  // 2026-08-24 有意识翻转：此前这里钉的是「中国必须 insufficient_data」。
  // 中国设备性能（能效标识备案库全量，CS-DECISIONS D11）落地后，
  // 河北电采暖家庭必须能算出完整四维——中国数据键与引擎消费端漂移时这里立刻红。
  const { ranked } = runEngine(
    {
      household_size: 3, currency: "CNY", annual_income: 80000, floor_area_m2: 100,
      needs_heating: true, heating_spend_annual: 3000,
      needs_cooling: false, cooling_spend_annual: null,
    },
    {
      housing_status: "owner", building_type: "detached", renovation_tolerance: "moderate",
      outdoor_space: "small_yard_or_roof",
      current_energy_services: ["electricity"],
      current_heating_methods: ["electric_heating"],
      current_cooling_methods: [],
      upfront_cost_preference: "moderate_investment",
    },
    { country_iso3: "CHN", admin1_code: "HE" },
  );
  assert.ok(ranked.length > 0, "中国家庭一条可排序路径都没有——中国数据键与引擎消费端漂移了");

  const hp = ranked.find((p) => p.primary_tech_ids && String(p.primary_tech_ids[0]).startsWith("ashp"));
  assert.ok(hp, "排名里没有空气源热泵路径（ashp_ductless 的中国条目没被读到）");
  for (const dim of ["affordability", "climate_resilience", "environment", "practicality"]) {
    assert.ok(
      typeof hp.dimensions[dim] === "number",
      `中国热泵路径的 ${dim} 是 ${hp.dimensions[dim]}——对应中国数据集没被读到`,
    );
  }
  assert.ok(hp.estimates.annual_run_cost > 0, "年运行费没算出来（河北电价或基线没读到）");
  assert.ok(hp.estimates.annual_emissions_kgco2e > 0, "年排放没算出来（河北电网因子没读到）");
  assert.equal(hp.estimates.currency, "CNY", "货币应为 CNY（河北电价条目的 currency）");
});

test("真实数据：收入货币与当地价格货币不一致时，金额类估算如实缺席（D13 守卫）", () => {
  const { ranked, unrankable } = runEngine(
    {
      household_size: 3, currency: "EUR", annual_income: 55000, floor_area_m2: 130,
      needs_heating: true, heating_spend_annual: 1300,
      needs_cooling: false, cooling_spend_annual: null,
    },
    {
      housing_status: "owner", building_type: "detached", renovation_tolerance: "moderate",
      outdoor_space: "small_yard_or_roof",
      current_energy_services: ["electricity", "piped_gas"],
      current_heating_methods: ["piped_gas_heating"],
      current_cooling_methods: [],
      upfront_cost_preference: "moderate_investment",
    },
    { country_iso3: "USA", admin1_code: "IL" },
  );
  const all = [...ranked, ...unrankable];
  assert.ok(all.length > 0, "一条路径都没有");
  for (const p of all) {
    // 跨币种时绝不能出现任何金额数值——宁可缺失也不能是 EUR÷USD 的垃圾比值
    assert.equal(p.estimates.annual_run_cost ?? null, null, `${p.path_id} 出现了跨币种运行费`);
    assert.equal(p.estimates.operating_burden_pct ?? null, null, `${p.path_id} 出现了跨币种负担率`);
    assert.ok(
      (p.warnings || []).some((w) => w.code === "currency_mismatch"),
      `${p.path_id} 缺 currency_mismatch 警告`,
    );
  }
});

test("真实数据：燃油取暖家庭在回答 D15 追问后可算，不答则金额维如实缺席", () => {
  const base = {
    household_size: 2, currency: "USD", annual_income: 58000, floor_area_m2: 150,
    needs_heating: true, heating_spend_annual: 2600,
    needs_cooling: false, cooling_spend_annual: null,
  };
  const feas = (kind) => ({
    housing_status: "owner", building_type: "detached", renovation_tolerance: "moderate",
    outdoor_space: "small_yard_or_roof",
    current_energy_services: ["electricity", "delivered_fuel"],
    current_heating_methods: ["delivered_fuel_heating"],
    current_cooling_methods: [],
    upfront_cost_preference: "moderate_investment",
    ...(kind ? { delivered_fuel_kind: kind } : {}),
  });
  const geo = { country_iso3: "USA", admin1_code: "ME" };

  // 追问 = heating_oil：账单反推走全国级取暖油价（country 回退），至少一条路径四维齐
  const answered = runEngine(base, feas("heating_oil"), geo);
  const full = answered.ranked.find((p) =>
    ["affordability", "climate_resilience", "environment", "practicality"]
      .every((d) => typeof p.dimensions[d] === "number"));
  assert.ok(full, "回答了追问的燃油家庭仍没有四维齐全的路径——heating_oil 价格/基线没被读到");
  assert.ok(full.estimates.annual_run_cost > 0, "运行费没算出来");

  // 不答（或 not_sure）：维持原「不猜」行为——金额类估算缺席而不是猜一种燃料
  const unanswered = runEngine(base, feas(null), geo);
  const anyMoney = [...unanswered.ranked, ...unanswered.unrankable]
    .some((p) => p.estimates.annual_run_cost != null);
  assert.equal(anyMoney, false, "没回答追问却算出了运行费——引擎在猜燃料种类");
});

test("真实数据：需制冷的中国家庭目前如实 insufficient——缺中国存量空调制冷基线", () => {
  // baseline:electricity|seasonal_cooling_efficiency 只有 USA（联邦最低 CEER 是
  // 美国特有的存量下限口径，不是物理常数；制热=1.0 才是物理常数、44 国通用）。
  // 中国无可引用的存量空调制冷基线（GB 12021.3 旧限定值卡在标准原文获取），
  // 制冷账单反推如实断掉 → 需制冷的家庭 A/E 维不可算。落地中国制冷基线口径时
  // 必须有意识地翻转本断言（CS-DECISIONS D11.8 / HANDOFF）。
  const { ranked, unrankable } = runEngine(
    {
      household_size: 3, currency: "CNY", annual_income: 90000, floor_area_m2: 100,
      needs_heating: true, heating_spend_annual: 3200,
      needs_cooling: true, cooling_spend_annual: 600,
    },
    {
      housing_status: "owner", building_type: "detached", renovation_tolerance: "moderate",
      outdoor_space: "small_yard_or_roof",
      current_energy_services: ["electricity"],
      current_heating_methods: ["electric_heating"],
      current_cooling_methods: ["room_air_conditioning"],
      upfront_cost_preference: "moderate_investment",
    },
    { country_iso3: "CHN", admin1_code: "HE" },
  );
  assert.equal(
    ranked.length, 0,
    "需制冷的中国家庭出现了可排序路径——说明中国制冷基线已落地，请翻转本断言并核对口径",
  );
  assert.ok(unrankable.length > 0, "筛选环节出了别的问题");
});
