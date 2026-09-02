"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/* ---------------------------------------------------------------------------
 * 数据时效性
 *
 * 抓一次不等于永远对。这组用例不「保证数据新鲜」——那做不到——而是把过期
 * 变成一件会挡住构建的事，而不是一个没人知道的静默错误：
 *
 *   - 每个生成的数据文件必须带 _vintage（何时抓的、覆盖什么时期、什么时候算过期）
 *   - stale_after 一旦过去，这里就变红，npm test 挡住
 *   - 有效期不是随手定的，写在 docs/data/data-freshness-policy.json 里并附理由
 *
 * 变红时的正确处理是重跑对应的 scripts/fetch_*.py，不是把日期往后改。
 * ------------------------------------------------------------------------- */

const DATA = path.join(__dirname, "..", "..", "data");
const policy = JSON.parse(fs.readFileSync(path.join(DATA, "data-freshness-policy.json"), "utf8"));

/** 已经落地的数据文件 → 它在政策表里的键 */
const POPULATED = [
  ["climate/cn_us_admin1_capitals.json", "cn_us_admin1_capitals"],
  ["climate/climate_profiles.json", "climate_profiles"],
  ["scoring/residential_energy_prices.json", "residential_energy_prices"],
];

/** 还是空骨架的：不检查时效性（没有数据谈不上过期），但要确认它没假装自己有数据 */
const SKELETONS = [
  ["scoring/electricity_emission_factors.json", "electricity_emission_factors"],
  ["scoring/fuel_emission_factors.json", "fuel_emission_factors"],
  ["scoring/technology_performance.json", "technology_performance"],
  ["scoring/technology_installed_costs.json", "technology_installed_costs"],
  ["scoring/infrastructure_availability.json", "infrastructure_availability"],
];

const readData = (rel) => JSON.parse(fs.readFileSync(path.join(DATA, rel), "utf8"));
const rowsOf = (d) => d.entries || d.profiles || {};
/** 价格类数据的 entries 是 {subject: [point,…]}，气候类是数组。统一摊平成记录列表。 */
const flatRows = (d) => {
  const r = rowsOf(d);
  return Array.isArray(r) ? r : Object.values(r).flat();
};
const isEmpty = (d) => {
  const r = rowsOf(d);
  return Array.isArray(r) ? r.length === 0 : Object.keys(r).length === 0;
};

test("时效性政策：每个数据集都有有效期和理由", () => {
  for (const [, key] of [...POPULATED, ...SKELETONS]) {
    const spec = policy.datasets[key];
    assert.ok(spec, `${key} 不在 data-freshness-policy.json 里`);
    assert.ok(Number.isInteger(spec.refresh_cadence_days) && spec.refresh_cadence_days > 0, `${key} 的有效期非法`);
    // 理由是给后来人看的：没有它，某天有人会把日期一改了事
    assert.ok((spec.rationale || "").length > 20, `${key} 缺少有效期理由`);
  }
});

test("已落地的数据都带 _vintage，且与政策一致", () => {
  for (const [rel, key] of POPULATED) {
    const data = readData(rel);
    const v = data._vintage;
    assert.ok(v, `${rel} 缺 _vintage`);
    assert.match(v.retrieved_at, /^\d{4}-\d{2}-\d{2}$/, `${rel} 的 retrieved_at 格式不对`);
    assert.ok(v.source_period, `${rel} 缺 source_period`);
    assert.equal(
      v.refresh_cadence_days,
      policy.datasets[key].refresh_cadence_days,
      `${rel} 的有效期与政策表不一致 —— 两处各写一份就一定会漂移`,
    );
    const expected = new Date(v.retrieved_at);
    expected.setUTCDate(expected.getUTCDate() + v.refresh_cadence_days);
    assert.equal(v.stale_after, expected.toISOString().slice(0, 10), `${rel} 的 stale_after 与 retrieved_at + 有效期对不上`);
  }
});

test("已落地的数据没有过期", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [rel] of POPULATED) {
    const v = readData(rel)._vintage;
    assert.ok(
      v.stale_after >= today,
      `${rel} 已于 ${v.stale_after} 过期（抓取于 ${v.retrieved_at}）。` +
        `正确处理是重跑抓取脚本，不是把日期往后改：${v.refresh_by}`,
    );
  }
});

test("每条记录都能追溯到来源", () => {
  for (const [rel] of POPULATED) {
    const rows = flatRows(readData(rel));
    assert.ok(rows.length > 0, `${rel} 标着已落地却没有数据`);
    for (const row of rows) {
      assert.ok(row.source_name, `${rel} 有记录缺 source_name`);
      assert.ok(row.retrieved_at, `${rel} 有记录缺 retrieved_at`);
      assert.ok(row.source_url || (row.source_urls || []).length, `${rel} 有记录缺 source_url`);
    }
  }
});

test("还没抓的数据集必须如实标着 AWAITING_DATA", () => {
  // 反过来的方向同样重要：空文件不能标成 POPULATED，否则打分引擎会以为
  // 自己拿到了数据，而 G4 会安静地少算一整个维度。
  for (const [rel] of SKELETONS) {
    const data = readData(rel);
    if (isEmpty(data)) {
      assert.equal(data._status, "AWAITING_DATA", `${rel} 是空的却没标 AWAITING_DATA`);
      assert.equal(data._vintage, undefined, `${rel} 还没有数据，不该有 _vintage`);
    } else {
      assert.notEqual(data._status, "AWAITING_DATA", `${rel} 有数据却仍标着 AWAITING_DATA`);
      assert.ok(data._vintage, `${rel} 已有数据，必须带 _vintage`);
    }
  }
});

/* ---------------------------------------------------------------------------
 * 能源价格专有检查
 * ------------------------------------------------------------------------- */

const prices = JSON.parse(fs.readFileSync(path.join(DATA, "scoring/residential_energy_prices.json"), "utf8"));

test("能源价格：每条都标明货币", () => {
  // 同一个数组里混着 USD（EIA）与 EUR（Eurostat）。不标货币的话三种币值长得
  // 一模一样，而 §7.6.2 会把它直接除进运行负担率里——不报错，只是每个分数都错。
  for (const [subject, points] of Object.entries(prices.entries)) {
    for (const p of points) {
      assert.match(p.currency || "", /^[A-Z]{3}$/, `${subject}/${p.geography.code} 的 currency 非法`);
    }
  }
});

test("能源价格：数值落在合理量级，单位是每 kWh", () => {
  // 抓错单位（比如把 $/MCF 当成 $/kWh）不会报错，只会让运行费差 300 倍。
  // 这条用例挡的就是那种错。
  for (const [subject, points] of Object.entries(prices.entries)) {
    for (const p of points) {
      assert.ok(
        p.value > 0.001 && p.value < 2,
        `${subject}/${p.geography.code} = ${p.value}，不像是「每 kWh 的钱」`,
      );
    }
  }
  const usElec = prices.entries.electricity.filter((p) => p.currency === "USD");
  assert.equal(usElec.length, 51, "美国 50 州 + DC 的电价应当齐全");
});

test("能源价格：地理层级与代码和地图数据对得上", () => {
  for (const [subject, points] of Object.entries(prices.entries)) {
    for (const p of points) {
      assert.ok(["admin1", "country"].includes(p.geography.level), `${subject} 出现了未知的地理层级`);
      // admin1 用州码（2 位），country 用 ISO3（3 位）
      const want = p.geography.level === "admin1" ? 2 : 3;
      assert.equal(p.geography.code.length, want, `${subject}/${p.geography.code} 的码长与层级不符`);
    }
  }
});

test("能源价格：没有用区域均值或邻国替代填空缺", () => {
  // 规格 §7.4 明令禁止。EIA 的返回里混着 ENC/MTN/PACC 这类分区聚合和全国值 NUS，
  // Eurostat 里有 EU27_2020/EA，它们都不能作为某个州或某个国家的数据。
  const forbidden = new Set(["ENC", "ESC", "MAT", "MTN", "NEW", "PACC", "PACN", "SAT", "WNC", "WSC", "NUS", "US", "EU27_2020", "EA"]);
  for (const [subject, points] of Object.entries(prices.entries)) {
    for (const p of points) {
      assert.ok(!forbidden.has(p.geography.code), `${subject} 里混进了聚合项 ${p.geography.code}`);
    }
  }
});

test("能源价格：各州年份不同步时逐条记了年份", () => {
  // EIA 各州发布进度不同：实测 2025 年有 7 个州的居民气价还是 null，回退到了 2024。
  // 混着两个年份而不逐条标注的话，没人看得出哪条是旧的。
  const usGas = prices.entries.natural_gas.filter((p) => p.currency === "USD");
  assert.equal(usGas.length, 51);
  for (const p of usGas) {
    assert.match(p.period || "", /^\d{4}$/, `${p.geography.code} 缺 period`);
  }
  assert.ok(new Set(usGas.map((p) => p.period)).size >= 1);
});

test("能源价格：中国数据只能来自官方出处的 curated 管道，不许硬凑", () => {
  // 2026-08-23 前提变更：中国省级居民电价已有 curated 管道
  // （scripts/curated_cn_residential_electricity.json，逐省官方文件 + 文号 + 原文引句，
  //  由 fetch_energy_data.py 校验合并，决策记录见 docs/CS-DECISIONS.md D5）。
  // 护栏精神不变：宁可缺，不可代填 —— 每一条中国数据必须能指回官方域名的出处。
  const fs2 = require("node:fs");
  const path2 = require("node:path");
  const curatedPath = path2.join(__dirname, "../../../scripts/curated_cn_residential_electricity.json");
  const cn = Object.values(prices.entries).flat().filter(
    (p) => p.currency === "CNY" || (p.geography.level === "admin1" && p.geography.country_iso3 === "CHN"),
  );
  if (!fs2.existsSync(curatedPath)) {
    assert.equal(cn.length, 0, "出现了中国的价格数据，但 curated 来源文件不存在 —— 请确认它是怎么来的");
    return;
  }
  const OFFICIAL = ["gov.cn", "sgcc.com.cn", "95598.cn", "csg.cn", "impc.com.cn"];
  assert.ok(cn.length > 0, "curated 文件存在却没有任何中国条目 —— 合并步骤没跑？");
  for (const p of cn) {
    const host = new URL(p.source_url).hostname;
    assert.ok(
      OFFICIAL.some((d) => host === d || host.endsWith("." + d)),
      `中国条目 ${p.geography.code} 的出处域名 ${host} 不在官方白名单内`,
    );
    assert.equal(p.currency, "CNY", `中国条目 ${p.geography.code} 货币不是 CNY`);
    assert.equal(p.geography.country_iso3, "CHN", `中国条目 ${p.geography.code} 缺国家标注`);
  }
});
