const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/* ---------------------------------------------------------------------------
 * docs/data/scoring/*.json 的通用体检
 *
 * data-freshness.test.js 管「过期」；本文件管「形状与量纲」：
 *   1. POPULATED ⟺ entries 非空 ⟺ 带 _vintage，且 cadence 与 policy 一致
 *   2. 每条 entry 的溯源字段齐全（§0.5 / §7.4：没有出处的数字不许存在）
 *   3. 量纲哨兵：物理上不可能的数值当场拦截。排放因子如果被写成 kg/TJ、
 *      g/kWh 或 lb/MWh，会差出 1–6 个数量级，靠肉眼看 JSON 是看不出来的。
 *   4. 中国省级条目的完整性与合法性（curated 输入存在时必须 31 省齐全）
 * ------------------------------------------------------------------------- */

const DATA_DIR = path.join(__dirname, "../../data/scoring");
const POLICY = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../data/data-freshness-policy.json"), "utf8"),
).datasets;

/** 这些文件已有抓取脚本，必须处于已填充状态；其余仍允许 AWAITING_DATA */
const MUST_BE_POPULATED = [
  "residential_energy_prices.json",
  "fuel_emission_factors.json",
  "electricity_emission_factors.json",
  "technology_performance.json",
  "technology_installed_costs.json",
  "infrastructure_availability.json",
];

const LEGAL_CN_CODES = (() => {
  const geo = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../data/maps/admin1-cn-us.geojson"), "utf8"),
  );
  return new Set(
    geo.features
      .filter((f) => f.properties.country_iso3 === "CHN")
      .map((f) => f.properties.admin1_code),
  );
})();

function datasets() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((n) => n.endsWith(".json"))
    .map((n) => [n, JSON.parse(fs.readFileSync(path.join(DATA_DIR, n), "utf8"))]);
}

function allRows(data) {
  const out = [];
  for (const [subject, rows] of Object.entries(data.entries || {})) {
    for (const r of rows) out.push([subject, r]);
  }
  return out;
}

test("有脚本的数据集必须已填充", () => {
  for (const name of MUST_BE_POPULATED) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
    assert.equal(data._status, "POPULATED", `${name} 仍是 ${data._status}`);
    assert.ok(allRows(data).length > 0, `${name} 标了 POPULATED 但 entries 为空`);
  }
});

test("_vintage 的刷新周期与 policy 一致（防止两边各说各话）", () => {
  for (const [name, data] of datasets()) {
    if (data._status !== "POPULATED") continue;
    const key = name.replace(/\.json$/, "");
    assert.ok(POLICY[key], `${name} 不在 data-freshness-policy.json 里`);
    assert.equal(
      data._vintage.refresh_cadence_days,
      POLICY[key].refresh_cadence_days,
      `${name} 的 cadence 与 policy 不一致`,
    );
  }
});

test("每条 entry 溯源字段齐全", () => {
  for (const [name, data] of datasets()) {
    for (const [subject, r] of allRows(data)) {
      const tag = `${name} ${subject} ${r.geography && r.geography.code}`;
      // 唯一的例外：technology_performance 里 baseline:* 的物理规则条目
      // （电阻转换效率 = 1.0 是物理定义，§7.4 的 TECH_OBJECTIVE_RULE 类别），
      // 它们没有可指的 URL，但 source_name 必须写清规则依据。
      const isRule =
        name === "technology_performance.json" &&
        subject.startsWith("baseline:") &&
        r.source_type === "TECH_OBJECTIVE_RULE";
      if (!isRule) {
        assert.equal(r.source_type, "LOCAL_PUBLIC", `${tag} source_type`);
        assert.match(String(r.source_url || ""), /^https?:\/\//, `${tag} source_url`);
      }
      assert.ok(typeof r.source_name === "string" && r.source_name.length > 0, `${tag} source_name`);
      assert.match(String(r.retrieved_at || ""), /^\d{4}-\d{2}-\d{2}$/, `${tag} retrieved_at`);
      assert.ok(["high", "medium", "low"].includes(r.confidence), `${tag} confidence`);
      assert.ok(["network", "local", "admin1", "country"].includes(r.geography.level), `${tag} level`);
    }
  }
});

test("量纲哨兵：设备性能（无量纲季节效率）", () => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "technology_performance.json"), "utf8"));
  const RANGES = {
    // ENERGY STAR 认证机型的 P50 必然落在这些区间；写错换算（如忘了 ÷3.412）会越界
    "ashp_ductless|seasonal_heating_efficiency": [2.2, 4.5],
    "ashp_ducted|seasonal_heating_efficiency": [2.0, 4.0],
    "gshp|seasonal_heating_efficiency": [2.8, 5.5],
    "gas_boiler|seasonal_heating_efficiency": [0.85, 1.0],
    "gas_furnace|seasonal_heating_efficiency": [0.85, 1.0],
    "window_ac|seasonal_cooling_efficiency": [2.5, 5.0],
    "ashp_ductless|seasonal_cooling_efficiency": [3.5, 8.0],
  };
  for (const [subject, [lo, hi]] of Object.entries(RANGES)) {
    const rows = (data.entries || {})[subject] || [];
    assert.ok(rows.length > 0, `technology_performance 缺 ${subject}`);
    for (const r of rows) {
      assert.ok(r.value >= lo && r.value <= hi, `${subject} = ${r.value}，超出 [${lo}, ${hi}]`);
      assert.ok(r.low <= r.value && r.value <= r.high, `${subject} 的 P25/P50/P75 顺序不对`);
    }
  }
  // 电阻基线是物理定义，必须恰好 1.0
  const base = (data.entries || {})["baseline:electricity|seasonal_heating_efficiency"] || [];
  assert.ok(base.length > 0, "缺 baseline:electricity 供暖基线");
  for (const r of base) assert.equal(r.value, 1.0);
});

test("量纲哨兵：燃料燃烧因子（kgCO2e/kWh）", () => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "fuel_emission_factors.json"), "utf8"));
  // IPCC 2006 缺省值换算后的物理合理区间。写错单位会差 1–6 个数量级，必然越界。
  const RANGES = {
    natural_gas: [0.18, 0.23],
    lpg: [0.2, 0.25],
    heating_oil: [0.24, 0.29],
    solid_fuel: [0.3, 0.45],
  };
  for (const [subject, [lo, hi]] of Object.entries(RANGES)) {
    const rows = (data.entries || {})[subject] || [];
    assert.ok(rows.length > 0, `fuel_emission_factors 缺 ${subject}`);
    for (const r of rows) {
      assert.ok(
        r.value >= lo && r.value <= hi,
        `${subject}@${r.geography.code} = ${r.value}，超出 [${lo}, ${hi}]`,
      );
    }
  }
});

test("量纲哨兵：电网因子（kgCO2e/kWh）", () => {
  const data = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "electricity_emission_factors.json"), "utf8"),
  );
  const rows = (data.entries || {}).grid || [];
  assert.ok(rows.length >= 30, `grid 条目只有 ${rows.length} 条，国家级覆盖不该这么少`);
  for (const r of rows) {
    // 下界 0：近 100% 水电的小电网（如中非）在 Ember 口径下就是 0.0，是真实数据
    assert.ok(
      r.value >= 0 && r.value <= 1.5,
      `grid@${r.geography.code} = ${r.value}，不在 [0, 1.5] kgCO2e/kWh 内`,
    );
  }
  // 解析错误的聚合防线：近零值只允许极少数，且中美两个锚点国家必须在正常区间
  // （近零上限 12：Ember 里近 100% 水电的小国 + eGRID 里的佛蒙特这类近零州都是真实值）
  const nearZero = rows.filter((r) => r.value < 0.005);
  assert.ok(nearZero.length <= 12, `有 ${nearZero.length} 条近零电网因子，像是解析错误`);
  for (const anchor of ["USA", "CHN"]) {
    const hit = rows.find((r) => r.geography.level === "country" && r.geography.code === anchor);
    assert.ok(hit, `grid 缺 ${anchor} 国家级条目`);
    assert.ok(hit.value >= 0.1 && hit.value <= 1.2, `${anchor} = ${hit.value}，锚点越界`);
  }
  // 美国州级（eGRID）存在时：51 州齐全、无重复，煤电/水电两个锚点州在各自区间
  const us = rows.filter((r) => r.geography.level === "admin1" && r.geography.country_iso3 === "USA");
  if (us.length > 0) {
    assert.equal(us.length, 51, `美国州级电网因子 ${us.length}/51`);
    assert.equal(new Set(us.map((r) => r.geography.code)).size, 51, "州码重复");
    const wv = us.find((r) => r.geography.code === "WV");
    const wa = us.find((r) => r.geography.code === "WA");
    assert.ok(wv.value >= 0.6 && wv.value <= 1.2, `WV = ${wv.value}，锚点越界`);
    assert.ok(wa.value >= 0.005 && wa.value <= 0.2, `WA = ${wa.value}，锚点越界`);
  }
});

test("电网因子：curated 中国输入存在时，省级条目与 curated 省集合一致且码合法", () => {
  // 注意：官方省级表历年只有 30 个省——西藏无数据（2021/2022/2023 三期皆然）。
  // 西藏的查询由 §7.4 地理回退落到国家级条目，这是规格设计的行为，
  // 禁止用全国均值冒充西藏的省级因子。
  const curatedPath = path.join(__dirname, "../../../scripts/curated_cn_grid_ef.json");
  const data = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "electricity_emission_factors.json"), "utf8"),
  );
  const cn = ((data.entries || {}).grid || []).filter(
    (r) => r.geography.level === "admin1" && r.geography.country_iso3 === "CHN",
  );
  if (!fs.existsSync(curatedPath)) {
    assert.equal(cn.length, 0, "没有 curated 输入却冒出了中国省级电网因子");
    return;
  }
  const curated = JSON.parse(fs.readFileSync(curatedPath, "utf8"));
  const codes = cn.map((r) => r.geography.code).sort();
  assert.ok(codes.length >= 30, `中国省级电网因子只有 ${codes.length} 条，官方表至少 30 省`);
  assert.equal(new Set(codes).size, codes.length, "存在重复省码");
  assert.equal(codes.length, curated.provinces.length, "数据文件与 curated 省数不一致");
  for (const c of codes) assert.ok(LEGAL_CN_CODES.has(c), `非法省码 ${c}`);
});

test("量纲哨兵：安装成本（USD，代表系统总价）", () => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "technology_installed_costs.json"), "utf8"));
  const RANGES = {
    ashp_ducted: [4000, 25000],
    gshp: [10000, 50000],
    gas_furnace: [2000, 12000],
    gas_boiler: [3000, 15000],
    window_ac: [200, 2500],
    wood_stove: [1500, 12000],
  };
  for (const [subject, [lo, hi]] of Object.entries(RANGES)) {
    const rows = (data.entries || {})[subject] || [];
    assert.ok(rows.length > 0, `technology_installed_costs 缺 ${subject}`);
    for (const r of rows) {
      assert.ok(r.value >= lo && r.value <= hi, `${subject} = ${r.value}，超出 [${lo}, ${hi}]`);
      assert.equal(r.currency, "USD", `${subject} 缺货币标注`);
    }
  }
  // 单区机型的坑：无风管迷你分体的 EIA 表值是 12 kBtu/h 单区机，绝不能出现在这里
  assert.equal((data.entries || {}).ashp_ductless, undefined,
    "ashp_ductless 出现了安装成本——EIA 表值是单区机型，当整宅成本会系统性抬高该路径（D8）");
});

test("基础设施可得性：只有 true 条目，且集中供热省集合合理", () => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "infrastructure_availability.json"), "utf8"));
  for (const [subject, r] of allRows(data)) {
    assert.equal(r.value, true, `${subject}@${r.geography.code} 出现了非 true 值——false 与缺失同效，只许写 true`);
  }
  const dh = ((data.entries || {}).district_heating_network || []).filter(
    (r) => r.geography.country_iso3 === "CHN",
  );
  assert.ok(dh.length >= 15 && dh.length <= 20, `中国集中供热省数 ${dh.length}，预期北方 15–20 省`);
  const dhCodes = new Set(dh.map((r) => r.geography.code));
  assert.ok(dhCodes.has("HE"), "河北（试点省）必须有集中供热网");
  assert.ok(!dhCodes.has("GD"), "广东出现了集中供热网——年鉴里它是零，检查合并逻辑");
  const usGas = ((data.entries || {}).piped_gas || []).filter((r) => r.geography.country_iso3 === "USA");
  assert.equal(usGas.length, 51, `美国管道燃气州数 ${usGas.length}/51`);
});

test("真实数据撞码回归：海南与夏威夷、四川与南卡各取各的电价", () => {
  const { resolveScoringValue } = require("../../dist/global");
  const prices = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "residential_energy_prices.json"), "utf8"),
  );
  const cases = [
    // [国家, admin1, 预期货币]
    ["CHN", "HI", "CNY"],
    ["USA", "HI", "USD"],
    ["CHN", "SC", "CNY"],
    ["USA", "SC", "USD"],
    ["CHN", "NM", "CNY"],
    ["USA", "NM", "USD"],
    ["CHN", "SD", "CNY"],
    ["USA", "SD", "USD"],
  ];
  for (const [country, admin1, currency] of cases) {
    const hit = resolveScoringValue(prices, "electricity", {
      country_iso3: country,
      admin1_code: admin1,
    });
    assert.ok(hit, `${country}/${admin1} 没查到电价`);
    assert.equal(hit.geography.level, "admin1", `${country}/${admin1} 掉到了 ${hit.geography.level} 级`);
    assert.equal(hit.currency, currency, `${country}/${admin1} 拿到了 ${hit.currency} 的条目——撞码串位`);
  }
});

test("居民电价：curated 中国输入存在时，条目与 curated 省集合一致、全为 CNY、值在合理区间", () => {
  const curatedPath = path.join(__dirname, "../../../scripts/curated_cn_residential_electricity.json");
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "residential_energy_prices.json"), "utf8"));
  const cn = ((data.entries || {}).electricity || []).filter(
    (r) => r.geography.level === "admin1" && r.geography.country_iso3 === "CHN",
  );
  if (!fs.existsSync(curatedPath)) {
    assert.equal(cn.length, 0, "没有 curated 输入却冒出了中国省级电价");
    return;
  }
  const curated = JSON.parse(fs.readFileSync(curatedPath, "utf8"));
  const expected = curated
    .filter((row) => row.verified === "official_url")
    .map((row) => row.admin1_code)
    .sort();
  assert.deepEqual(cn.map((r) => r.geography.code).sort(), expected, "数据文件与 curated 省集合不一致");
  for (const r of cn) {
    assert.equal(r.currency, "CNY", `CN 电价 ${r.geography.code} 货币不是 CNY`);
    assert.ok(r.value >= 0.35 && r.value <= 0.75, `CN 电价 ${r.geography.code} = ${r.value}，超出 [0.35, 0.75] 元/kWh`);
    assert.ok(LEGAL_CN_CODES.has(r.geography.code), `非法省码 ${r.geography.code}`);
  }
});

test("居民气价：curated 中国输入存在时，条目与 curated 一致且换算后在合理区间", () => {
  const curatedPath = path.join(__dirname, "../../../scripts/curated_cn_residential_gas.json");
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "residential_energy_prices.json"), "utf8"));
  const cn = ((data.entries || {}).natural_gas || []).filter(
    (r) => r.geography.level === "admin1" && r.geography.country_iso3 === "CHN",
  );
  if (!fs.existsSync(curatedPath)) {
    assert.equal(cn.length, 0, "没有 curated 输入却冒出了中国省级气价");
    return;
  }
  const curated = JSON.parse(fs.readFileSync(curatedPath, "utf8"));
  const expected = curated
    .filter((row) => row.verified === "official_url")
    .map((row) => row.admin1_code)
    .sort();
  assert.deepEqual(cn.map((r) => r.geography.code).sort(), expected, "气价与 curated 省集合不一致");
  for (const r of cn) {
    assert.equal(r.currency, "CNY", `CN 气价 ${r.geography.code} 货币不是 CNY`);
    // 元/m³ ÷ 9.886 kWh/m³：省会一档 2.2–3.7 元/m³ → 约 0.22–0.37 元/kWh
    assert.ok(r.value >= 0.15 && r.value <= 0.6, `CN 气价 ${r.geography.code} = ${r.value}，超出 [0.15, 0.6] 元/kWh`);
  }
});

test("美国取暖油/丙烷：country 级条目、USD、量纲哨兵", () => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "residential_energy_prices.json"), "utf8"));
  // 州级冬季燃料调查（SHOPP）已停发 → 只承诺全国级条目；如实的 country 层级，
  // 各州经 §7.4 地理回退取用（见 _conversions.us_heating_oil_and_propane）。
  for (const [subject, [lo, hi]] of [["heating_oil", [0.04, 0.16]], ["lpg", [0.06, 0.20]]]) {
    const rows = ((data.entries || {})[subject] || []).filter(
      (r) => r.geography.level === "country" && r.geography.code === "USA",
    );
    assert.equal(rows.length, 1, `${subject} 应恰有一条 USA country 级条目`);
    const r = rows[0];
    assert.equal(r.currency, "USD");
    assert.ok(r.value >= lo && r.value <= hi, `${subject} = ${r.value} USD/kWh 超出 [${lo}, ${hi}]`);
    assert.match(r.aggregation_method, /HHV|附录 A/, `${subject} 缺热值口径说明`);
  }
});

test("设备性能：中国备案库管线条目（D11）——量纲、样本量、口径说明", () => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "technology_performance.json"), "utf8"));
  const expect = [
    ["ashp_ductless|seasonal_heating_efficiency", 2.5, 4.5, 8000],
    ["ashp_ductless|seasonal_cooling_efficiency", 4.0, 8.0, 8000],
    ["gas_boiler|seasonal_heating_efficiency", 0.84, 1.05, 15000],
  ];
  for (const [subject, lo, hi, minN] of expect) {
    const cn = ((data.entries || {})[subject] || []).filter(
      (r) => r.pipeline === "cn_energylabel" && r.geography.code === "CHN",
    );
    assert.equal(cn.length, 1, `${subject} 应恰有一条中国管线条目`);
    const r = cn[0];
    assert.ok(r.value >= lo && r.value <= hi, `${subject} P50=${r.value} 超出 [${lo}, ${hi}]`);
    assert.ok(r.low <= r.value && r.value <= r.high, `${subject} 分位数次序错乱`);
    assert.ok(r.sample_count >= minN, `${subject} 样本量 ${r.sample_count} < ${minN}——universe 没抓全`);
    assert.match(r.aggregation_method, /2024-12 官方备案包|中标院/, `${subject} 缺 universe 说明`);
    assert.ok(r.source_url && r.source_url.startsWith("https://www.cnis.ac.cn/"), `${subject} source_url 应指向中标院公告`);
  }
  // 拆算口径的痕迹必须在（Kc 常数与逐台 APF 自洽哨兵）
  const heat = data.entries["ashp_ductless|seasonal_heating_efficiency"]
    .find((r) => r.pipeline === "cn_energylabel");
  assert.match(heat.aggregation_method, /Kc=\d+/, "缺 Kc 常数记录");
  // 紧凑抽取缓存必须入库（离线复算与审计用）
  assert.ok(
    fs.existsSync(path.join(__dirname, "../../../scripts/cache_cn_energylabel_extract.jsonl.gz")),
    "缺 scripts/cache_cn_energylabel_extract.jsonl.gz——聚合不可复算",
  );
});

test("设备性能：美国脚本重跑不得抹掉中国管线条目（fetch_tech_performance.py 保留逻辑）", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../../scripts/fetch_tech_performance.py"), "utf8");
  assert.match(src, /cn_energylabel/, "美国脚本缺中国条目保留逻辑");
});
