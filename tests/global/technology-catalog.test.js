const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  getCatalogCounts,
  getMvpScreeningCatalog,
  getBaselineOnlyCatalog,
} = require("../../dist/global");

const catalog = require("../../data/technologies/technology_catalog.json");
const schema = require("../../data/technologies/technology_catalog.schema.json");

const PUBLIC_FILES = [
  "../../global/index.html",
  "../../global/app.js",
  "../../vercel.json",
];

function publicText() {
  return PUBLIC_FILES.map((file) => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n");
}

function minimalSchemaValidate(entries) {
  const required = schema.items.required;
  return entries.every((entry) => {
    if (!required.every((key) => Object.prototype.hasOwnProperty.call(entry, key))) return false;
    if (entry.visibility !== "internal") return false;
    if (!Array.isArray(entry.services) || entry.services.length === 0) return false;
    if (!entry.evidence?.last_reviewed) return false;
    return true;
  });
}

test("catalog 1. all tech_id values are unique", () => {
  assert.equal(new Set(catalog.map((entry) => entry.tech_id)).size, catalog.length);
});

test("catalog 2. active/conditional primary technologies have complete G4 defaults", () => {
  const rows = catalog.filter((entry) => ["active", "conditional"].includes(entry.catalog_status) && entry.role === "primary");
  assert.equal(rows.every((entry) => entry.g4_defaults.capex_tier && entry.g4_defaults.operating_cost_model && entry.g4_defaults.carbon_model), true);
});

test("catalog 3. all supporting technologies use bundle_only", () => {
  assert.equal(catalog.filter((entry) => entry.role === "supporting").every((entry) => entry.ranking_mode === "bundle_only"), true);
});

test("catalog 4. baseline technologies use baseline_only", () => {
  assert.equal(catalog.filter((entry) => entry.role === "baseline").every((entry) => entry.ranking_mode === "baseline_only" && entry.catalog_status === "baseline_only"), true);
});

test("catalog 5. phase2 technologies do not enter MVP screening catalog", () => {
  const mvpIds = new Set(getMvpScreeningCatalog(catalog).map((entry) => entry.tech_id));
  assert.equal(catalog.filter((entry) => entry.catalog_status === "phase2").every((entry) => !mvpIds.has(entry.tech_id)), true);
});

test("catalog 6. every technology is internal visibility", () => {
  assert.equal(catalog.every((entry) => entry.visibility === "internal"), true);
});

test("catalog 7. every technology has bilingual names", () => {
  assert.equal(catalog.every((entry) => entry.display_name_en && entry.display_name_zh), true);
});

test("catalog 8. every technology has at least one service", () => {
  assert.equal(catalog.every((entry) => Array.isArray(entry.services) && entry.services.length > 0), true);
});

test("catalog 9. every technology source has last_reviewed", () => {
  assert.equal(catalog.every((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.evidence.last_reviewed)), true);
});

test("catalog 10. JSON conforms to local schema requirements", () => {
  assert.equal(minimalSchemaValidate(catalog), true);
});

test("screening 11. no gas network excludes gas paths", () => {
  const gas = getMvpScreeningCatalog(catalog).filter((entry) => entry.infrastructure_constraints?.requires_gas_grid);
  assert.ok(gas.some((entry) => entry.tech_id === "gas_boiler"));
});

test("screening 12. unknown region network keeps gas as warning-capable candidate", () => {
  const gas = getMvpScreeningCatalog(catalog).find((entry) => entry.tech_id === "gas_boiler");
  assert.ok(gas);
  assert.equal(gas.infrastructure_constraints.requires_gas_grid, true);
});

test("screening 13. district heating has district network requirement", () => {
  const tech = getMvpScreeningCatalog(catalog).find((entry) => entry.tech_id === "district_heating");
  assert.equal(tech.infrastructure_constraints.requires_district_network, true);
});

test("screening 14. district cooling has district network requirement", () => {
  const tech = getMvpScreeningCatalog(catalog).find((entry) => entry.tech_id === "district_cooling");
  assert.equal(tech.infrastructure_constraints.requires_district_network, true);
});

test("screening 15. outdoor-space constrained technologies are represented", () => {
  assert.equal(getMvpScreeningCatalog(catalog).some((entry) => entry.outdoor_space_required === "large_private_land"), true);
});

test("screening 16. not_sure is handled by HomeFeasibility tests, not by catalog hardcoding", () => {
  assert.equal(JSON.stringify(catalog).includes("not_sure"), false);
});

test("screening 17. phase2 technologies do not enter G4 candidate pool", () => {
  const ids = getMvpScreeningCatalog(catalog).map((entry) => entry.tech_id);
  assert.equal(ids.includes("water_source_hp"), false);
  assert.equal(ids.includes("radiant_cooling"), false);
});

test("screening 18. baseline-only technologies stay in baseline catalog", () => {
  assert.deepEqual(getBaselineOnlyCatalog(catalog).map((entry) => entry.tech_id), ["coal_legacy"]);
});

test("screening 19. heat pumps are active candidates independent of current setup", () => {
  assert.ok(getMvpScreeningCatalog(catalog).some((entry) => entry.tech_id === "ashp_ductless"));
});

test("screening 20. cooling AC is active candidate independent of current setup", () => {
  assert.ok(getMvpScreeningCatalog(catalog).some((entry) => entry.tech_id === "split_ac_cooling"));
});

test("paths 21. supporting measures cannot form standalone paths", () => {
  assert.equal(catalog.filter((entry) => entry.role === "supporting").every((entry) => entry.path_rules.can_form_standalone_path === false), true);
});

test("paths 22. fans are bundle-only", () => {
  const fans = catalog.find((entry) => entry.tech_id === "fans");
  assert.equal(fans.ranking_mode, "bundle_only");
});

test("paths 23. insulation is bundle-only", () => {
  const insulation = catalog.find((entry) => entry.tech_id === "insulation_air_sealing");
  assert.equal(insulation.ranking_mode, "bundle_only");
});

test("paths 24. every primary has max_paths_per_primary <= 2", () => {
  assert.equal(catalog.filter((entry) => entry.role === "primary").every((entry) => (entry.path_rules.max_paths_per_primary ?? 0) <= 2), true);
});

test("paths 25. preferred candidate path maximum remains 12 in implementation test suite", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../src/global/screening.ts"), "utf8");
  assert.equal(source.includes("slice(0, 12)"), true);
});

test("paths 26. catalog loader sorts MVP screening catalog deterministically", () => {
  const normal = getMvpScreeningCatalog(catalog).map((entry) => entry.tech_id);
  const reversed = getMvpScreeningCatalog([...catalog].reverse()).map((entry) => entry.tech_id);
  assert.deepEqual(reversed, normal);
});

test("paths 27. catalog order changes do not change eligible ID set", () => {
  assert.deepEqual(
    new Set(getMvpScreeningCatalog([...catalog].reverse()).map((entry) => entry.tech_id)),
    new Set(getMvpScreeningCatalog(catalog).map((entry) => entry.tech_id)),
  );
});

test("paths 28. no duplicate catalog-driven screening profiles", () => {
  const ids = getMvpScreeningCatalog(catalog).map((entry) => entry.tech_id);
  assert.equal(new Set(ids).size, ids.length);
});

test("visibility 29. G3 page does not include full technology catalog JSON", () => {
  const text = publicText();
  assert.equal(text.includes('"catalog_status"'), false);
  assert.equal(text.includes('"ranking_mode"'), false);
});

test("visibility 30. website has no Technology Catalog route", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"));
  assert.equal(vercel.rewrites.some((rewrite) => /technolog/i.test(rewrite.source)), false);
});

test("visibility 31. public navigation has no technology catalog link", () => {
  assert.equal(/View all technologies|Technology Catalog|技术目录/.test(publicText()), false);
});

test("visibility 32. production code does not console.log the full catalog", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../global/app.js"), "utf8");
  assert.equal(/console\.(log|table|debug)\([^)]*catalog/i.test(app), false);
});

test("visibility 33. G4 public prototype only shows summary, not raw catalog fields", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../global/index.html"), "utf8");
  assert.equal(/capex_tier|carbon_model|catalog_status|ranking_mode/.test(html), false);
});

test("visibility 34. phase2 technology ids do not appear in public prototype files", () => {
  const text = publicText();
  assert.equal(/water_source_hp|evaporative_indirect|radiant_cooling|absorption_cooling/.test(text), false);
});

test("visibility 35. China Pilot remains root route", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"));
  const root = vercel.rewrites.find((rewrite) => rewrite.source === "/");
  assert.equal(root.destination, "/index.html");
});

test("catalog counts. complete internal catalog has requested status counts", () => {
  assert.deepEqual(getCatalogCounts(catalog), {
    total: 35,
    active: 15,
    conditional: 15,
    baseline_only: 1,
    phase2: 4,
  });
});
