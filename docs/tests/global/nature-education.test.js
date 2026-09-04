"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("path");

const { explainNatureClimate, koppenFamily, fillNatureCopy, MONTH_BAND_COLOR } = require("../../dist/global");

const SOURCE = fs.readFileSync(path.join(__dirname, "../../src/global/natureEducation.ts"), "utf8");
const ZH = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../i18n/zh.json"), "utf8"));
const EN = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../i18n/en.json"), "utf8"));

const SPECIES = /樱花|桃花|候鸟|大雁|枫叶|仙人掌|骆驼|penguin|cherry blossom|maple/i;

function hebeiLike() {
  // 华北常见：冷月在 0℃ 附近或以下，雨集中在 7–8 月
  return {
    koppen_code: "BSk",
    temperature_c_monthly: [-3.2, -0.5, 6.8, 14.6, 21.0, 25.4, 27.1, 25.8, 20.9, 13.7, 5.1, -1.4],
    precipitation_mm_monthly: [2, 5, 9, 21, 34, 71, 168, 140, 48, 21, 8, 3],
  };
}

function jakartaLike() {
  return {
    koppen_code: "Af",
    temperature_c_monthly: [26.8, 26.6, 27.1, 27.5, 27.7, 27.2, 26.7, 26.8, 27.5, 28.0, 27.8, 27.2],
    precipitation_mm_monthly: [342, 337, 233, 193, 140, 91, 79, 53, 65, 133, 196, 232],
  };
}

test("nature: 缺月均温则整课 insufficient_data，不编物候", () => {
  assert.equal(explainNatureClimate(null).status, "insufficient_data");
  assert.equal(explainNatureClimate({}).status, "insufficient_data");
  assert.equal(explainNatureClimate({ temperature_c_monthly: [1, 2, 3] }).status, "insufficient_data");
  assert.equal(explainNatureClimate({ temperature_c_monthly: new Array(12).fill(null) }).status, "insufficient_data");
  assert.equal(explainNatureClimate({ precipitation_mm_monthly: new Array(12).fill(10) }).months.length, 0);
});

test("nature: 华北干冷气候讲「等雨 + 冷月歇一阵」，不点名物种", () => {
  const lesson = explainNatureClimate(hebeiLike());
  assert.equal(lesson.status, "ok");
  assert.equal(lesson.family, "arid_steppe");
  assert.equal(lesson.phenology_key, "wait_for_rain");
  assert.equal(lesson.home.key, "need_both");
  assert.equal(lesson.facts.coldest_month, 0);
  assert.equal(lesson.why.length, 2);
  assert.equal(lesson.why[0].key, "coldest");
  assert.match(JSON.stringify(lesson), /wait_for_rain/);
  assert.equal(SPECIES.test(JSON.stringify(lesson)), false);
});

test("nature: 全年湿热 → evergreen，房子偏制冷", () => {
  const lesson = explainNatureClimate(jakartaLike());
  assert.equal(lesson.phenology_key, "evergreen");
  assert.equal(lesson.home.key, "need_cool");
  assert.equal(lesson.family, "tropical_rainforest");
  assert.equal(lesson.months.every((m) => m.band === "hot"), true);
});

test("nature: 同一输入两次结果逐字段相同", () => {
  const a = explainNatureClimate(hebeiLike());
  const b = explainNatureClimate(hebeiLike());
  assert.deepEqual(a, b);
});

test("nature: 全月低于 0℃ → ice_year", () => {
  const lesson = explainNatureClimate({
    koppen_code: "EF",
    temperature_c_monthly: [-20, -22, -18, -12, -5, -2, -1, -3, -8, -14, -18, -21],
  });
  assert.equal(lesson.phenology_key, "ice_year");
  assert.equal(lesson.home.key, "need_heat");
  assert.equal(lesson.why.length, 1);
});

test("nature: koppenFamily 覆盖主类字母", () => {
  assert.equal(koppenFamily("Dwa"), "continental_dry_winter");
  assert.equal(koppenFamily("Cfa"), "temperate_no_dry");
  assert.equal(koppenFamily("BWh"), "arid_desert");
  assert.equal(koppenFamily(null), "unknown");
});

test("nature: fillNatureCopy 用月份名替换占位", () => {
  const text = fillNatureCopy("最冷在{coldestMonth}，约 {temp}℃", { coldestMonth: 0, temp: "-3.2" }, ["1月"]);
  assert.equal(text, "最冷在1月，约 -3.2℃");
});

test("nature: 问卷页选点后有自然教育容器", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../global/index.html"), "utf8");
  const g1 = fs.readFileSync(path.join(__dirname, "../../global/g1.js"), "utf8");
  assert.match(html, /id="g1Nature"/);
  assert.match(g1, /explainNatureClimate/);
  assert.match(g1, /renderNature/);
});

test("nature: 源码和中英课文字典都不点名具体物种", () => {
  assert.equal(SPECIES.test(SOURCE), false);
  const natureKeys = Object.keys(ZH).filter((k) => k.startsWith("g1nature."));
  assert.ok(natureKeys.length >= 20, "自然教育文案太少");
  for (const key of natureKeys) {
    assert.equal(Object.prototype.hasOwnProperty.call(EN, key), true, "缺英文: " + key);
    assert.equal(SPECIES.test(String(ZH[key]) + String(EN[key])), false, key);
  }
  assert.ok(MONTH_BAND_COLOR.ice && MONTH_BAND_COLOR.hot);
});
