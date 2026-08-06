const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  getHomeFeasibilityQuestions,
  validateHomeFeasibility,
  applyExclusiveSelection,
  buildBaselineProfile,
  mapCurrentHeatingToBaseline,
  mapCurrentCoolingToBaseline,
  screenTechnologies,
  generateCandidatePaths,
  scoreAndSort,
  getMvpScreeningCatalog,
} = require("../../dist/global");

const catalog = require("../../data/technologies/technology_catalog.json");
const technologies = getMvpScreeningCatalog(catalog);

const household = {
  household_size: 4,
  currency: "USD",
  annual_income: 56000,
  floor_area_m2: 120,
  insulation_level: "Average",
  needs_heating: true,
  heating_spend_annual: 1200,
  needs_cooling: true,
  cooling_spend_annual: 450,
};

const region = {
  region_id: "test_region",
  label_en: "Test Region",
  infrastructure: {
    gas_grid: undefined,
    gas_grid_confidence: "low",
    district_energy: false,
    district_energy_confidence: "high",
    delivered_fuel_market: true,
    delivered_fuel_market_confidence: "high",
    reliable_electricity: true,
    reliable_electricity_confidence: "high",
  },
};

const climate = {
  design_temp_c: -18,
  design_temp_confidence: "high",
  humidity_level: "humid",
  humidity_confidence: "high",
};

const feasibility = {
  housing_status: "owner",
  building_type: "detached",
  renovation_tolerance: "moderate",
  outdoor_space: "small_yard_or_roof",
  current_energy_services: ["electricity", "delivered_fuel"],
  current_heating_methods: ["delivered_fuel_heating"],
  current_cooling_methods: ["room_air_conditioning", "fans"],
  upfront_cost_preference: "higher_if_saves_later",
};

function runPipeline(custom = {}) {
  const h = { ...household, ...(custom.household || {}) };
  const f = { ...feasibility, ...(custom.feasibility || {}) };
  const r = { ...region, ...(custom.region || {}) };
  const c = { ...climate, ...(custom.climate || {}) };
  const baseline = buildBaselineProfile(h, f, r);
  const screening = screenTechnologies(r, c, h, f, custom.technologies || technologies);
  const paths = generateCandidatePaths(screening.passed, baseline, r, c, h, custom.technologies || technologies);
  const ranked = scoreAndSort(paths, baseline, h, r, c, f, custom.technologies || technologies);
  return { h, f, r, c, baseline, screening, paths, ranked };
}

test("1. G3 question model does not include future technology display names", () => {
  const text = JSON.stringify(getHomeFeasibilityQuestions(true, true));
  assert.equal(text.includes("Natural gas boiler"), false);
  assert.equal(text.includes("Air-source heat pump"), false);
  assert.equal(text.includes("Ground-source heat pump"), false);
});

test("2. G3 shows at most 8 questions when heating and cooling are needed", () => {
  assert.equal(getHomeFeasibilityQuestions(true, true).length, 8);
});

test("3. needs_heating=false hides current heating question", () => {
  assert.equal(getHomeFeasibilityQuestions(false, true).some((q) => q.id === "current_heating_methods"), false);
});

test("4. needs_heating=true shows current heating question", () => {
  assert.equal(getHomeFeasibilityQuestions(true, false).some((q) => q.id === "current_heating_methods"), true);
});

test("5. needs_cooling=false hides current cooling question", () => {
  assert.equal(getHomeFeasibilityQuestions(true, false).some((q) => q.id === "current_cooling_methods"), false);
});

test("6. needs_cooling=true shows current cooling question", () => {
  assert.equal(getHomeFeasibilityQuestions(false, true).some((q) => q.id === "current_cooling_methods"), true);
});

test("7. Current heating methods support normal multi-select", () => {
  const result = validateHomeFeasibility(
    { ...feasibility, current_heating_methods: ["electric_heating", "solid_fuel_heating"] },
    true,
    true,
  );
  assert.equal(result.valid, true);
});

test("8. Current cooling methods support normal multi-select", () => {
  const result = validateHomeFeasibility(
    { ...feasibility, current_cooling_methods: ["room_air_conditioning", "fans"] },
    true,
    true,
  );
  assert.equal(result.valid, true);
});

test("9. no_current_heating is mutually exclusive", () => {
  const result = validateHomeFeasibility(
    { ...feasibility, current_heating_methods: ["no_current_heating", "electric_heating"] },
    true,
    true,
  );
  assert.equal(result.valid, false);
});

test("10. Heating not_sure is mutually exclusive", () => {
  const result = validateHomeFeasibility(
    { ...feasibility, current_heating_methods: ["not_sure", "electric_heating"] },
    true,
    true,
  );
  assert.equal(result.valid, false);
});

test("11. no_current_cooling is mutually exclusive", () => {
  const result = validateHomeFeasibility(
    { ...feasibility, current_cooling_methods: ["no_current_cooling", "fans"] },
    true,
    true,
  );
  assert.equal(result.valid, false);
});

test("12. Cooling not_sure is mutually exclusive", () => {
  const result = validateHomeFeasibility(
    { ...feasibility, current_cooling_methods: ["not_sure", "fans"] },
    true,
    true,
  );
  assert.equal(result.valid, false);
});

test("13. current_energy_services none and not_sure are mutually exclusive", () => {
  const result = validateHomeFeasibility(
    { ...feasibility, current_energy_services: ["none", "electricity"] },
    true,
    true,
  );
  assert.equal(result.valid, false);
});

test("14. Exclusive helper preserves re-entered G3 selections deterministically", () => {
  assert.deepEqual(applyExclusiveSelection(["electricity"], "not_sure", ["none", "not_sure"]), ["not_sure"]);
  assert.deepEqual(applyExclusiveSelection(["not_sure"], "electricity", ["none", "not_sure"]), ["electricity"]);
});

test("15. G3 page source does not contain technology select-all buttons", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../global/index.html"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(`${html}\n${js}`.includes("Select all heating options"), false);
  assert.equal(`${html}\n${js}`.includes("Select all cooling options"), false);
});

test("16. Baseline records current heating and cooling categories", () => {
  const baseline = buildBaselineProfile(household, feasibility, region);
  assert.deepEqual(baseline.heating_categories, ["delivered_fuel_heating_unspecified"]);
  assert.deepEqual(baseline.cooling_categories, ["room_ac_unspecified", "fan_support"]);
});

test("17. Current methods do not overwrite future candidate set", () => {
  const { screening } = runPipeline({ feasibility: { current_heating_methods: ["delivered_fuel_heating"] } });
  assert.equal(screening.passed.some((tech) => tech.tech_id === "ashp_ductless"), true);
});

test("18. Heat pump can be screened when current heating is not heat pump", () => {
  const { screening } = runPipeline({ feasibility: { current_heating_methods: ["solid_fuel_heating"] } });
  assert.equal(screening.passed.some((tech) => tech.tech_id === "ashp_ductless"), true);
});

test("19. Missing current gas service alone does not hard-exclude gas path", () => {
  const { screening } = runPipeline({
    region: { infrastructure: { ...region.infrastructure, gas_grid: undefined, gas_grid_confidence: "low" } },
    feasibility: { current_energy_services: ["electricity"] },
  });
  assert.equal(screening.excluded.some((tech) => tech.tech_id === "gas_boiler" && tech.reason_code === "NO_GAS_GRID"), false);
});

test("20. Fans or passive cooling alone are not mechanical cooling", () => {
  const baseline = buildBaselineProfile(
    household,
    { ...feasibility, current_cooling_methods: ["fans", "natural_or_passive_cooling"] },
    region,
  );
  assert.equal(baseline.has_mechanical_cooling, false);
});

test("21. not_sure lowers baseline confidence", () => {
  const baseline = buildBaselineProfile(household, { ...feasibility, current_heating_methods: ["not_sure"] }, region);
  assert.equal(baseline.heating_data_confidence, "low");
});

test("22. no_current_heating marks no mechanical heating", () => {
  const baseline = buildBaselineProfile(household, { ...feasibility, current_heating_methods: ["no_current_heating"] }, region);
  assert.equal(baseline.has_mechanical_heating, false);
});

test("23. no_current_cooling marks no mechanical cooling", () => {
  const baseline = buildBaselineProfile(household, { ...feasibility, current_cooling_methods: ["no_current_cooling"] }, region);
  assert.equal(baseline.has_mechanical_cooling, false);
});

test("24. User not_sure does not hard-exclude technologies", () => {
  const { screening } = runPipeline({
    feasibility: { renovation_tolerance: "not_sure", outdoor_space: "not_sure", building_type: "not_sure" },
  });
  assert.equal(screening.passed.length > 0, true);
});

test("25. No permanent modification permission excludes permanent-work paths", () => {
  const { screening } = runPipeline({ feasibility: { housing_status: "renter_no_permission" } });
  assert.equal(screening.excluded.some((tech) => tech.reason_code === "PERMANENT_WORK_NOT_ALLOWED"), true);
});

test("26. Insufficient outdoor space excludes higher-space paths", () => {
  const { screening } = runPipeline({ feasibility: { outdoor_space: "none" } });
  assert.equal(screening.excluded.some((tech) => tech.reason_code === "INSUFFICIENT_OUTDOOR_SPACE"), true);
});

test("27. Missing region infrastructure keeps technology with warning", () => {
  const { screening } = runPipeline({
    region: { infrastructure: { ...region.infrastructure, gas_grid: undefined, gas_grid_confidence: "low" } },
  });
  assert.equal(screening.passed.some((tech) => tech.tech_id === "gas_boiler"), true);
  assert.equal(screening.warnings.some((item) => item.tech_id === "gas_boiler"), true);
});

test("28. Climate boundary creates warning before exclusion when backup exists", () => {
  const { screening } = runPipeline({ climate: { design_temp_c: -25, design_temp_confidence: "high" } });
  assert.equal(screening.passed.some((tech) => tech.tech_id === "ashp_ductless"), true);
  assert.equal(screening.warnings.some((item) => item.tech_id === "ashp_ductless" && item.code === "BACKUP_HEATING_MAY_BE_REQUIRED"), true);
});

test("29. High upfront cost is not a G3 hard exclusion", () => {
  const { screening } = runPipeline({ feasibility: { upfront_cost_preference: "minimum_upfront", renovation_tolerance: "major", outdoor_space: "large_private_land" } });
  assert.equal(screening.excluded.some((tech) => tech.reason_code && tech.reason_code.includes("UPFRONT")), false);
});

test("30. Every excluded technology has readable English and Chinese reasons", () => {
  const { screening } = runPipeline({ region: { infrastructure: { ...region.infrastructure, gas_grid: false, gas_grid_confidence: "high" } } });
  assert.equal(screening.excluded.every((item) => item.reason_en && item.reason_zh), true);
});

test("31. Same input returns identical screening output", () => {
  const a = runPipeline().screening;
  const b = runPipeline().screening;
  assert.deepEqual(a, b);
});

test("32. Technology catalog order does not affect final ranked path ids", () => {
  const normal = runPipeline().ranked.map((path) => path.path_id);
  const reversed = runPipeline({ technologies: [...technologies].reverse() }).ranked.map((path) => path.path_id);
  assert.deepEqual(reversed, normal);
});

test("33. G4 candidate paths come from full technology catalog screening", () => {
  const { paths } = runPipeline();
  assert.equal(paths.length > 0, true);
  assert.equal(paths.some((path) => path.primary_tech_ids.includes("ashp_ductless")), true);
});

test("34. G4 can display current setup summary from baseline", () => {
  const { baseline } = runPipeline();
  assert.deepEqual(baseline.heating_categories, ["delivered_fuel_heating_unspecified"]);
  assert.equal(baseline.cooling_categories.includes("room_ac_unspecified"), true);
});

test("35. Baseline does not automatically become a recommended path", () => {
  const { ranked } = runPipeline();
  assert.equal(ranked.some((path) => path.path_id === "baseline"), false);
});

test("36. eligible_with_warning paths enter G4 ranking", () => {
  const { screening, ranked } = runPipeline({
    feasibility: { outdoor_space: "not_sure", renovation_tolerance: "not_sure" },
  });
  const warned = screening.passed.find((tech) => tech.screening_status === "eligible_with_warning");
  assert.ok(warned);
  assert.equal(ranked.some((path) => path.primary_tech_ids.includes(warned.tech_id)), true);
});

test("37. G4 excluded block has readable reasons", () => {
  const { screening } = runPipeline({ region: { infrastructure: { ...region.infrastructure, district_energy: false, district_energy_confidence: "high" } } });
  assert.equal(screening.excluded.every((item) => item.reason_en.length > 0 && item.reason_zh.length > 0), true);
});

test("38. Five-dimension scoring still runs", () => {
  const { ranked } = runPipeline();
  assert.ok(ranked[0].dimensions.cost >= 0);
  assert.ok(ranked[0].dimensions.carbon >= 0);
  assert.ok(ranked[0].dimensions.comfort >= 0);
  assert.ok(ranked[0].dimensions.climate >= 0);
  assert.ok(ranked[0].dimensions.simple >= 0);
});

test("39. AI is not referenced by screening or scoring source", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../src/global/screening.ts"), "utf8");
  assert.equal(/\b(LLM|DeepSeek|prompt|model inference)\b/i.test(source), false);
});

test("40. China Pilot entry point is not replaced by /global", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"));
  const root = vercel.rewrites.find((rewrite) => rewrite.source === "/");
  assert.equal(root.destination, "/index.html");
});

test("41. Current setup mapping keeps broad answers broad", () => {
  assert.deepEqual(mapCurrentHeatingToBaseline(["heat_pump", "piped_gas_heating"]), [
    "heat_pump_unspecified",
    "gas_heating_unspecified",
  ]);
  assert.deepEqual(mapCurrentCoolingToBaseline(["room_air_conditioning", "fans"]), [
    "room_ac_unspecified",
    "fan_support",
  ]);
});
