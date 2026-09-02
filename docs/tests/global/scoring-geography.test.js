const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { resolveScoringValue } = require("../../dist/global");

/* ---------------------------------------------------------------------------
 * 地理解析的国家约束
 *
 * 中国省份的 admin1_code（ISO 3166-2 后缀）与美国州码有四对重码：
 *   NM 内蒙古/新墨西哥 · SD 山东/南达科他 · SC 四川/南卡罗来纳 · HI 海南/夏威夷
 *
 * resolveScoringValue 若只按 code 匹配，数组顺序决定谁赢——两个地区里
 * 必有一个永远拿到对方的数据，不报错、只算错。因此：
 *   1. 条目带 country_iso3 时，必须与查询的 country_iso3 一致才可命中；
 *   2. 生产数据文件里所有 admin1 条目必须带 country_iso3（本文件强制）。
 * ------------------------------------------------------------------------- */

function pt(value, code, country) {
  return {
    value,
    geography: { level: "admin1", code, country_iso3: country },
    source_type: "LOCAL_PUBLIC",
    source_name: "SYNTHETIC TEST FIXTURE — not real data",
    confidence: "high",
  };
}

const HI_DATASET = {
  field_key: "synthetic",
  entries: {
    electricity: [pt(0.3, "HI", "USA"), pt(0.55, "HI", "CHN")],
  },
};

test("撞码省州各取各的：夏威夷拿不到海南的条目，反之亦然", () => {
  const us = resolveScoringValue(HI_DATASET, "electricity", {
    country_iso3: "USA",
    admin1_code: "HI",
  });
  const cn = resolveScoringValue(HI_DATASET, "electricity", {
    country_iso3: "CHN",
    admin1_code: "HI",
  });
  assert.equal(us && us.value, 0.3);
  assert.equal(cn && cn.value, 0.55);
});

test("带国家的条目在查询缺国家时不命中（宁缺毋错，走 §7.11 null 分支）", () => {
  const hit = resolveScoringValue(HI_DATASET, "electricity", { admin1_code: "HI" });
  assert.equal(hit, null);
});

test("国家比对大小写不敏感，且与 country 级回退互不干扰", () => {
  const ds = {
    field_key: "synthetic",
    entries: {
      electricity: [pt(0.55, "HI", "CHN"), {
        value: 0.11,
        geography: { level: "country", code: "USA" },
        source_type: "LOCAL_PUBLIC",
        source_name: "SYNTHETIC TEST FIXTURE — not real data",
        confidence: "high",
      }],
    },
  };
  const cn = resolveScoringValue(ds, "electricity", { country_iso3: "chn", admin1_code: "hi" });
  assert.equal(cn && cn.value, 0.55);
  // 夏威夷查询：admin1 无可命中条目（唯一的 HI 属 CHN），应回退到 USA country 级
  const us = resolveScoringValue(ds, "electricity", { country_iso3: "USA", admin1_code: "HI" });
  assert.equal(us && us.value, 0.11);
});

test("生产数据文件里所有 admin1/local/network 条目都带 country_iso3", () => {
  const dir = path.join(__dirname, "../../data/scoring");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const [subject, rows] of Object.entries(data.entries || {})) {
      for (const r of rows) {
        if (r.geography.level !== "country") {
          assert.ok(
            /^[A-Z]{3}$/.test(r.geography.country_iso3 || ""),
            `${f} ${subject} ${r.geography.level}=${r.geography.code} 缺 country_iso3`,
          );
        }
      }
    }
  }
});
