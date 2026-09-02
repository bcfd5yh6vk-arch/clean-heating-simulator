"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  // 几何
  pointInRing,
  pointInPolygon,
  toPolygonList,
  ringBBox,
  bboxContains,
  // 索引
  buildBoundaryIndex,
  findFeaturesAt,
  // Köppen
  lonLatToPixel,
  codeFromIndex,
  mainGroupOf,
  koppenCodeAt,
  runSelfCheck,
  // §G1 判定树
  resolveLocation,
  describeDataResolution,
  isUsableLocation,
  isAdmin1Country,
  toScoringGeo,
} = require("../../dist/global");

const { decodeGrayPng } = require("./fixtures/decode-gray-png");

const MAPS = path.join(__dirname, "..", "..", "data", "maps");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(MAPS, name), "utf8"));

/* ===========================================================================
 * 1. 射线法几何
 * ======================================================================== */

// 逆时针单位正方形，[-1,-1] 到 [1,1]
const SQUARE = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

// 中间挖一个 [-0.5,-0.5]..[0.5,0.5] 的洞
const HOLE = [
  [-0.5, -0.5],
  [-0.5, 0.5],
  [0.5, 0.5],
  [0.5, -0.5],
  [-0.5, -0.5],
];

test("pointInRing: 正方形内外判定", () => {
  assert.equal(pointInRing(0, 0, SQUARE), true);
  assert.equal(pointInRing(0.9, 0.9, SQUARE), true);
  assert.equal(pointInRing(2, 0, SQUARE), false);
  assert.equal(pointInRing(0, 2, SQUARE), false);
  assert.equal(pointInRing(-5, -5, SQUARE), false);
});

test("pointInRing: 点数不足的退化环一律不命中", () => {
  assert.equal(pointInRing(0, 0, []), false);
  assert.equal(pointInRing(0, 0, [[0, 0]]), false);
  assert.equal(
    pointInRing(0, 0, [
      [0, 0],
      [1, 1],
      [0, 0],
    ]),
    false,
  );
});

test("pointInPolygon: 洞里的点不算命中", () => {
  const withHole = [SQUARE, HOLE];
  assert.equal(pointInPolygon(0, 0, withHole), false, "洞的正中心");
  assert.equal(pointInPolygon(0.49, 0, withHole), false, "洞内靠边");
  assert.equal(pointInPolygon(0.75, 0, withHole), true, "洞外、外环内");
  assert.equal(pointInPolygon(1.5, 0, withHole), false, "外环外");
});

test("toPolygonList: Polygon / MultiPolygon 统一，其它几何返回空", () => {
  assert.equal(toPolygonList({ type: "Polygon", coordinates: [SQUARE] }).length, 1);
  assert.equal(toPolygonList({ type: "MultiPolygon", coordinates: [[SQUARE], [SQUARE]] }).length, 2);
  assert.deepEqual(toPolygonList({ type: "Point", coordinates: [0, 0] }), []);
  assert.deepEqual(toPolygonList(null), []);
  assert.deepEqual(toPolygonList(undefined), []);
});

test("ringBBox / bboxContains: 边界上算命中（粗筛不能漏）", () => {
  const bbox = ringBBox(SQUARE);
  assert.deepEqual(bbox, [-1, -1, 1, 1]);
  assert.equal(bboxContains(bbox, 0, 0), true);
  assert.equal(bboxContains(bbox, -1, -1), true, "角点");
  assert.equal(bboxContains(bbox, 1, 0), true, "右边界");
  assert.equal(bboxContains(bbox, 1.0001, 0), false);
  assert.equal(bboxContains(null, 0, 0), false);
});

/* ===========================================================================
 * 2. 边界索引
 * ======================================================================== */

function fc(features) {
  return { type: "FeatureCollection", features };
}

test("buildBoundaryIndex: 建索引并按 bbox 粗筛", () => {
  const index = buildBoundaryIndex(
    fc([
      { properties: { iso3: "AAA" }, geometry: { type: "Polygon", coordinates: [SQUARE] } },
      {
        properties: { iso3: "BBB" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10, 10],
              [12, 10],
              [12, 12],
              [10, 12],
              [10, 10],
            ],
          ],
        },
      },
    ]),
  );
  assert.equal(index.features.length, 2);
  assert.deepEqual(index.warnings, []);
  assert.deepEqual(
    findFeaturesAt(index, 0, 0).map((p) => p.iso3),
    ["AAA"],
  );
  assert.deepEqual(
    findFeaturesAt(index, 11, 11).map((p) => p.iso3),
    ["BBB"],
  );
  assert.deepEqual(findFeaturesAt(index, 50, 50), []);
});

test("buildBoundaryIndex: 非法输入不抛错，只给警告", () => {
  assert.equal(buildBoundaryIndex(null).features.length, 0);
  assert.ok(buildBoundaryIndex(null).warnings.length > 0);
  assert.ok(buildBoundaryIndex({ type: "FeatureCollection", features: [] }).warnings.length > 0);
});

test("findFeaturesAt: 重叠要素全部返回，不静默取第一个", () => {
  const index = buildBoundaryIndex(
    fc([
      { properties: { iso3: "AAA" }, geometry: { type: "Polygon", coordinates: [SQUARE] } },
      { properties: { iso3: "BBB" }, geometry: { type: "Polygon", coordinates: [SQUARE] } },
    ]),
  );
  assert.deepEqual(
    findFeaturesAt(index, 0, 0).map((p) => p.iso3),
    ["AAA", "BBB"],
  );
});

test("findFeaturesAt: 非有限坐标返回空而不是抛错", () => {
  const index = buildBoundaryIndex(
    fc([{ properties: { iso3: "AAA" }, geometry: { type: "Polygon", coordinates: [SQUARE] } }]),
  );
  assert.deepEqual(findFeaturesAt(index, NaN, 0), []);
  assert.deepEqual(findFeaturesAt(index, 0, Infinity), []);
});

/* ===========================================================================
 * 3. Köppen 网格换算
 * ======================================================================== */

const GRID = {
  width: 3600,
  height: 1800,
  lon_min: -180,
  lat_max: 90,
  cell_size_deg: 0.1,
  nodata_index: 0,
};

test("lonLatToPixel: 四角与中心", () => {
  assert.deepEqual(lonLatToPixel(-180, 90, GRID), { x: 0, y: 0 }, "左上角");
  assert.deepEqual(lonLatToPixel(0, 0, GRID), { x: 1800, y: 900 }, "本初子午线与赤道交点");
  assert.deepEqual(lonLatToPixel(179.95, -89.95, GRID), { x: 3599, y: 1799 }, "右下角内侧");
});

test("lonLatToPixel: 闭区间端点被夹回网格内，而不是溢出", () => {
  assert.deepEqual(lonLatToPixel(180, 0, GRID), { x: 0, y: 900 }, "180° 与 -180° 等价");
  assert.deepEqual(lonLatToPixel(0, -90, GRID), { x: 1800, y: 1799 }, "正南极夹到最后一行");
});

test("lonLatToPixel: 经度环绕，纬度不环绕", () => {
  assert.deepEqual(lonLatToPixel(181, 0, GRID), lonLatToPixel(-179, 0, GRID));
  assert.deepEqual(lonLatToPixel(-181, 0, GRID), lonLatToPixel(179, 0, GRID));
  assert.equal(lonLatToPixel(0, 91, GRID), null, "纬度 91 不存在");
  assert.equal(lonLatToPixel(0, -90.1, GRID), null);
  assert.equal(lonLatToPixel(NaN, 0, GRID), null);
});

const CLASSES = [
  { index: 14, code: "Cfa", description_en: "Temperate, no dry season, hot summer" },
  { index: 21, code: "Dwa", description_en: "Cold, dry winter, hot summer" },
];

test("codeFromIndex: 未知索引与 nodata 返回 null，不返回猜测值", () => {
  assert.equal(codeFromIndex(14, CLASSES), "Cfa");
  assert.equal(codeFromIndex(21, CLASSES), "Dwa");
  assert.equal(codeFromIndex(0, CLASSES), null);
  assert.equal(codeFromIndex(99, CLASSES), null);
  assert.equal(codeFromIndex(null, CLASSES), null);
  assert.equal(codeFromIndex(undefined, CLASSES), null);
});

test("mainGroupOf: 细分类 → A/B/C/D/E", () => {
  assert.equal(mainGroupOf("Dwa"), "D");
  assert.equal(mainGroupOf("Cfb"), "C");
  assert.equal(mainGroupOf("ET"), "E");
  assert.equal(mainGroupOf("BWh"), "B");
  assert.equal(mainGroupOf("Af"), "A");
  assert.equal(mainGroupOf("Zzz"), null, "非法主类不硬凑");
  assert.equal(mainGroupOf(""), null);
  assert.equal(mainGroupOf(null), null);
});

test("koppenCodeAt: nodata（海洋）返回 null", () => {
  const legend = { grid: GRID, classes: CLASSES };
  assert.equal(koppenCodeAt(0, 0, legend, () => 0), null, "nodata");
  assert.equal(koppenCodeAt(0, 0, legend, () => null), null, "读不到像素");
  assert.equal(koppenCodeAt(0, 0, legend, () => 14), "Cfa");
});

/* ===========================================================================
 * 4. 仓库里那个 Köppen PNG 本身对不对
 * ======================================================================== */

const legend = readJson("koppen-legend.json");
const png = decodeGrayPng(fs.readFileSync(path.join(MAPS, "koppen-1991-2020.png")));
const readPixel = (x, y) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return null;
  return png.data[y * png.width + x];
};

test("koppen PNG: 尺寸与 legend 声明一致", () => {
  assert.equal(png.width, legend.grid.width);
  assert.equal(png.height, legend.grid.height);
  assert.equal(legend.grid.crs, "EPSG:4326");
  assert.equal(legend.grid.cell_size_deg, 0.1);
  assert.equal(legend.classes.length, 30, "规格 §G1 Step 4 要求覆盖约 30 个 Köppen 细分类");
});

test("koppen PNG: 不含色彩配置块（否则浏览器会悄悄改写像素值）", () => {
  for (const forbidden of ["gAMA", "iCCP", "sRGB", "cHRM"]) {
    assert.ok(!png.chunks.includes(forbidden), `PNG 里出现了 ${forbidden} 块`);
  }
});

test("koppen PNG: legend 的自检探针全部通过", () => {
  const result = runSelfCheck(legend, readPixel);
  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
  assert.ok((legend.self_check || []).length >= 5, "探针太少，覆盖不到主要气候带");
});

test("koppen PNG: 像素值都在 legend 声明的索引范围内", () => {
  const seen = new Set(png.data);
  const known = new Set([legend.grid.nodata_index, ...legend.classes.map((c) => c.index)]);
  const unknown = [...seen].filter((v) => !known.has(v));
  assert.deepEqual(unknown, [], "栅格里出现了 legend 没定义的分类索引");
});

test("koppen PNG: 几个物理上没有争议的地点主类正确", () => {
  // 都取在大片同质区域内部，避开海岸线与山区，不依赖 0.1° 网格的细节
  const cases = [
    ["新加坡（热带）", 103.82, 1.35, "A"],
    ["开罗（干旱）", 31.24, 30.05, "B"],
    ["柏林（温带）", 13.405, 52.52, "C"],
    ["新西伯利亚（寒带）", 82.93, 55.03, "D"],
    ["格陵兰内陆（极地）", -40.0, 72.0, "E"],
  ];
  for (const [label, lon, lat, expectGroup] of cases) {
    const code = koppenCodeAt(lon, lat, legend, readPixel);
    assert.ok(code, `${label} 没查到 Köppen 码`);
    assert.equal(mainGroupOf(code), expectGroup, `${label} 主类应为 ${expectGroup}，实际 ${code}`);
  }
});

test("koppen PNG: 太平洋中部是 nodata", () => {
  assert.equal(koppenCodeAt(-140, 0, legend, readPixel), null);
});

/* ===========================================================================
 * 5. 真实边界数据上的 §G1 判定树
 * ======================================================================== */

const admin0 = buildBoundaryIndex(readJson("admin0-boundaries.geojson"));
const admin1 = buildBoundaryIndex(readJson("admin1-cn-us.geojson"));

const ctx = {
  admin0,
  admin1,
  koppenLegend: legend,
  readKoppenPixel: readPixel,
  labelOverrides: readJson("country-label-overrides.json"),
};

test("产品口径的国家/地区称谓没有退回上游写法", () => {
  // admin0-boundaries.geojson 每次构建都会被整体重写，手改撑不住。称谓的唯一
  // 权威来源是 country-label-overrides.json，由 build_map_data.py 在生成时应用。
  // 这条用例存在的意义：万一有人绕过覆盖表、或构建脚本丢了这一步，这里会变红，
  // 而不是等到某天有人在页面上看见「中华民国」。
  const overrides = readJson("country-label-overrides.json").overrides || {};
  const byIso = new Map(admin0.features.map((f) => [f.properties.iso3, f.properties]));

  assert.ok(Object.keys(overrides).length > 0, "覆盖表是空的，产品口径没有落到任何地方");

  for (const [iso3, want] of Object.entries(overrides)) {
    const props = byIso.get(iso3);
    assert.ok(props, `admin0 里没有 ${iso3} 这个要素`);
    for (const field of ["name_en", "name_zh", "type"]) {
      if (!want[field]) continue;
      assert.equal(
        props[field],
        want[field],
        `${iso3} 的 ${field} 实际是「${props[field]}」，` +
          `而 country-label-overrides.json 声明的是「${want[field]}」—— ` +
          "多半是 geojson 被重新生成时没有应用覆盖表",
      );
    }
  }

  // 覆盖只改称谓，不改几何切分。港澳台仍是独立 admin0 要素，仍走 Köppen 分支 ——
  // 这一点不能因为改了名字就被误以为也跟着变了。
  for (const iso3 of ["TWN", "HKG", "MAC"]) {
    assert.ok(byIso.has(iso3), `${iso3} 应当仍是独立的 admin0 要素`);
    assert.equal(isAdmin1Country(iso3), false, `${iso3} 不走中美 Admin-1 分支`);
  }
});

test("边界索引: 构建时没有跨反经线的可疑几何", () => {
  assert.deepEqual(admin0.warnings, []);
  assert.deepEqual(admin1.warnings, []);
  assert.ok(admin0.features.length > 200, "国家要素数量异常");
});

test("admin1 数据: 中国 31 个省级行政区、美国 50 州 + DC", () => {
  const props = admin1.features.map((f) => f.properties);
  const chn = props.filter((p) => p.country_iso3 === "CHN");
  const usa = props.filter((p) => p.country_iso3 === "USA");
  assert.equal(chn.length, 31);
  assert.equal(usa.length, 51);
});

test("admin1_code 必须是 ISO 3166-2 而不是 Natural Earth 的 postal（两者对中国省份互相撞码）", () => {
  const byCode = new Map(
    admin1.features.map((f) => [`${f.properties.country_iso3}/${f.properties.admin1_code}`, f.properties]),
  );
  // 本项目试点在河北。若误用 NE 的 postal，"HE" 会绑到河南，且不会有任何报错。
  assert.equal(byCode.get("CHN/HE").name_zh, "河北省");
  assert.equal(byCode.get("CHN/HA").name_zh, "河南省");
  assert.equal(byCode.get("CHN/HB").name_zh, "湖北省");
  assert.equal(byCode.get("CHN/HI").name_zh, "海南省");
  assert.equal(byCode.get("CHN/SN").name_zh, "陕西省");
  assert.ok(byCode.has("USA/IL"), "既有 fixture 与数据骨架用的就是 IL");
});

test("admin1_code 在国内唯一", () => {
  for (const country of ["CHN", "USA"]) {
    const codes = admin1.features
      .filter((f) => f.properties.country_iso3 === country)
      .map((f) => f.properties.admin1_code);
    assert.equal(new Set(codes).size, codes.length, `${country} 的 admin1_code 有重复`);
  }
});

test("§G1: 中国点击 → 识别到省", () => {
  // 石家庄，河北省会，也是本项目试点区域
  const geo = resolveLocation(38.04, 114.51, ctx);
  assert.equal(geo.country_iso3, "CHN");
  assert.equal(geo.admin1_code, "HE");
  assert.equal(geo.admin1_name_zh, "河北省");
  assert.equal(geo.ambiguous_country, false);
  assert.ok(geo.koppen_code, "中美也要查出 Köppen 码，供气候卡显示区名");
});

test("§G1: 美国点击 → 识别到州", () => {
  // Springfield, Illinois —— 数据骨架里的示例州首府
  const geo = resolveLocation(39.78, -89.65, ctx);
  assert.equal(geo.country_iso3, "USA");
  assert.equal(geo.admin1_code, "IL");
  assert.equal(geo.admin1_name_en, "Illinois");
});

test("§G1: 其余国家只识别到国家，admin1 恒为 null", () => {
  const berlin = resolveLocation(52.52, 13.405, ctx);
  assert.equal(berlin.country_iso3, "DEU");
  assert.equal(berlin.admin1_code, null, "规格 §G1 明令其余国家不识别省/州");
  assert.equal(berlin.admin1_name_en, null);
  assert.equal(berlin.admin1_name_zh, null);
  assert.equal(mainGroupOf(berlin.koppen_code), "C");

  const tokyo = resolveLocation(35.68, 139.77, ctx);
  assert.equal(tokyo.country_iso3, "JPN");
  assert.equal(tokyo.admin1_code, null);
});

test("§G1: 法国与挪威能识别出来（Natural Earth 的 ISO_A3 对它们是 -99）", () => {
  assert.equal(resolveLocation(48.857, 2.352, ctx).country_iso3, "FRA", "巴黎");
  assert.equal(resolveLocation(59.913, 10.752, ctx).country_iso3, "NOR", "奥斯陆");
});

test("§G1: 海上点击识别不出国家，isUsableLocation 为假", () => {
  const sea = resolveLocation(0, -140, ctx);
  assert.equal(sea.country_iso3, null);
  assert.equal(sea.koppen_code, null);
  assert.equal(isUsableLocation(sea), false);
  assert.equal(isUsableLocation(null), false);
});

test("§G1: 经度环绕后仍能识别到同一个国家", () => {
  const a = resolveLocation(38.04, 114.51, ctx);
  const b = resolveLocation(38.04, 114.51 + 360, ctx);
  assert.equal(b.country_iso3, a.country_iso3);
  assert.equal(b.admin1_code, a.admin1_code);
  assert.equal(b.lon, a.lon, "经度应被归一到 [-180, 180)");
});

test("§G1: admin1 未加载时（惰性加载尚未完成）不会误报省州", () => {
  const geo = resolveLocation(38.04, 114.51, { ...ctx, admin1: null });
  assert.equal(geo.country_iso3, "CHN");
  assert.equal(geo.admin1_code, null);
});

test("isAdmin1Country: 只有中美两国", () => {
  assert.equal(isAdmin1Country("CHN"), true);
  assert.equal(isAdmin1Country("USA"), true);
  assert.equal(isAdmin1Country("DEU"), false);
  assert.equal(isAdmin1Country(null), false);
  assert.equal(isAdmin1Country("TWN"), false);
  assert.equal(isAdmin1Country("HKG"), false, "上游把港澳做成独立 admin0，走不进 admin1 分支");
});

test("toScoringGeo: 只透出 pipeline 需要的三个字段，null 不透出", () => {
  const geo = resolveLocation(38.04, 114.51, ctx);
  const payload = toScoringGeo(geo);
  assert.equal(payload.country_iso3, "CHN");
  assert.equal(payload.admin1_code, "HE");
  assert.ok(typeof payload.koppen_code === "string");
  assert.deepEqual(Object.keys(toScoringGeo(resolveLocation(0, -140, ctx))), []);
});

/* ===========================================================================
 * 6. 诚实性：没有气候数据时不许声称有
 * ======================================================================== */

test("describeDataResolution: 气候数据缺失 → unresolved，绝不声称用了省会气候", () => {
  const geo = resolveLocation(38.04, 114.51, ctx);
  assert.equal(geo.admin1_code, "HE", "地图确实识别出了河北");
  // 但 docs/data/climate/* 目前是空骨架，resolveClimate 会返回 null
  assert.equal(describeDataResolution(geo, null), "unresolved");
  assert.equal(describeDataResolution(geo, undefined), "unresolved");
  assert.equal(describeDataResolution(geo, {}), "unresolved", "没有 source_kind 的对象同样不算数");
});

test("describeDataResolution: 只有真的取到 admin1 行才报 admin1_capital", () => {
  const geo = resolveLocation(38.04, 114.51, ctx);
  assert.equal(
    describeDataResolution(geo, { source_kind: "admin1_capital", temperature_c_monthly: new Array(12).fill(0) }),
    "admin1_capital",
  );
});

test("describeDataResolution: 细分类命中 vs 主类回退", () => {
  const geo = { koppen_code: "Dwa" };
  assert.equal(
    describeDataResolution(geo, { source_kind: "koppen_profile", koppen_code: "Dwa" }),
    "koppen_standard_profile",
  );
  assert.equal(
    describeDataResolution(geo, { source_kind: "koppen_profile", koppen_code: "D" }),
    "koppen_main_group_fallback",
    "命中的 profile 码与点击点细分类不同 → 是按主类回退匹配到的",
  );
});

/* ===========================================================================
 * 7. 气候数据本身（由 scripts/fetch_climate_data.py 从 NASA POWER 抓取）
 * ======================================================================== */

const CLIMATE_DIR = path.join(__dirname, "..", "..", "data", "climate");
const cnUsClimate = JSON.parse(fs.readFileSync(path.join(CLIMATE_DIR, "cn_us_admin1_capitals.json"), "utf8"));
const koppenClimate = JSON.parse(fs.readFileSync(path.join(CLIMATE_DIR, "climate_profiles.json"), "utf8"));

test("气候数据: 覆盖全部中美 Admin-1 与全部 30 个 Köppen 细分类", () => {
  const chn = cnUsClimate.entries.filter((e) => e.country_iso3 === "CHN");
  const usa = cnUsClimate.entries.filter((e) => e.country_iso3 === "USA");
  assert.equal(chn.length, 31, "中国 31 个省级行政区");
  assert.equal(usa.length, 51, "美国 50 州 + DC");
  assert.equal(koppenClimate.profiles.length, legend.classes.length);
});

test("气候数据: 每条都有 12 个月的值和可追溯的出处", () => {
  const rows = [...cnUsClimate.entries, ...koppenClimate.profiles];
  for (const row of rows) {
    const who = row.admin1_code ? `${row.country_iso3}/${row.admin1_code}` : row.koppen_code;
    const c = row.climate;
    assert.equal(c.temperature_c_monthly.length, 12, `${who} 月均温`);
    assert.equal(c.precipitation_mm_monthly.length, 12, `${who} 月降水`);
    assert.ok(c.temperature_c_monthly.every((v) => Number.isFinite(v)), `${who} 月均温有非数值`);
    assert.ok(c.precipitation_mm_monthly.every((v) => Number.isFinite(v) && v >= 0), `${who} 月降水有负值`);
    // §7.4：LOCAL_PUBLIC 的每个字段都必须能追溯到来源
    assert.ok(row.source_name, `${who} 缺 source_name`);
    assert.ok(row.retrieved_at, `${who} 缺 retrieved_at`);
  }
});

test("气候数据: 极端温度 proxy 必须把月均值包住", () => {
  // P01 日最低不可能高于最冷月的月均温，P99 日最高不可能低于最热月的月均温。
  // 一旦反过来，说明百分位算错了或取错了参数 —— 这种错不会崩，只会让
  // §7.7 的极端温度裕度整片失真。
  for (const row of [...cnUsClimate.entries, ...koppenClimate.profiles]) {
    const who = row.admin1_code ? `${row.country_iso3}/${row.admin1_code}` : row.koppen_code;
    const c = row.climate;
    assert.ok(
      c.extreme_low_temp_proxy_c <= Math.min(...c.temperature_c_monthly),
      `${who}: P01 ${c.extreme_low_temp_proxy_c} 高于最冷月均温`,
    );
    assert.ok(
      c.extreme_high_temp_proxy_c >= Math.max(...c.temperature_c_monthly),
      `${who}: P99 ${c.extreme_high_temp_proxy_c} 低于最热月均温`,
    );
  }
});

test("气候数据: 不提供 design_temp_c —— 它与 P01 proxy 不是一回事", () => {
  // screening.ts 只在 design_temp_confidence === "high" 时用它做硬排除。
  // 拿 P01 冒充 ASHRAE design temperature 会静默改变技术筛选结果。
  for (const row of [...cnUsClimate.entries, ...koppenClimate.profiles]) {
    assert.equal(row.climate.design_temp_c, undefined);
  }
});

test("气候数据: admin1_code 与省份对得上（河北是本项目试点）", () => {
  const hebei = cnUsClimate.entries.find((e) => e.country_iso3 === "CHN" && e.admin1_code === "HE");
  assert.ok(hebei);
  assert.equal(hebei.admin1_name_zh, "河北省");
  assert.equal(hebei.capital_name, "Shijiazhuang");
  const illinois = cnUsClimate.entries.find((e) => e.country_iso3 === "USA" && e.admin1_code === "IL");
  assert.equal(illinois.capital_name, "Springfield");
});

test("气候数据: 出现的 Köppen 码都在 legend 里定义过", () => {
  const known = new Set(legend.classes.map((c) => c.code));
  for (const row of cnUsClimate.entries) {
    if (row.koppen_code) assert.ok(known.has(row.koppen_code), `${row.admin1_code} 的 ${row.koppen_code} 不在 legend 里`);
  }
  for (const row of koppenClimate.profiles) {
    assert.ok(known.has(row.koppen_code), `${row.koppen_code} 不在 legend 里`);
  }
});

test("气候数据: 首府点落在它自己的省/州范围内", () => {
  // 空间连接一旦错位（比如上游换了坐标），首府会跑到邻省，而气温曲线看着依然正常。
  // 这条用例把它变成红灯。
  for (const row of cnUsClimate.entries) {
    const hits = findFeaturesAt(admin1, row.capital_lon, row.capital_lat);
    const codes = hits.map((h) => `${h.country_iso3}/${h.admin1_code}`);
    assert.ok(
      codes.includes(`${row.country_iso3}/${row.admin1_code}`),
      `${row.capital_name} (${row.capital_lon}, ${row.capital_lat}) 不在 ${row.country_iso3}/${row.admin1_code} 内，实际落在 ${codes.join(",") || "无"}`,
    );
  }
});

test("Köppen 代表点确实落在它声称的气候区里", () => {
  for (const row of koppenClimate.profiles) {
    const loc = row.representative_locations[0];
    const actual = koppenCodeAt(loc.lon, loc.lat, legend, readPixel);
    assert.equal(actual, row.koppen_code, `${row.koppen_code} 的代表点 ${loc.name} 在栅格里是 ${actual}`);
  }
});
