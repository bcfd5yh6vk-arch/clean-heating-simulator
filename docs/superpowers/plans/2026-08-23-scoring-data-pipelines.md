# LOCAL_PUBLIC 数据流水线（排放因子 + 中国居民电价）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把六份 `AWAITING_DATA` 数据文件里可机器化的三份真正填上（fuel_emission_factors、electricity_emission_factors、residential_energy_prices 的中国部分），并先修掉一个会静默算错的地理撞码缺陷。

**Architecture:** 每份数据 = 可复现 Python 抓取/合并脚本 + （不可编程的部分）带逐条出处的 curated JSON 输入 + JS 侧 schema/一致性测试。打分引擎只在 `resolveScoringValue` 层消费数据；本计划对引擎的唯一改动是给地理匹配加国家约束（数据管道正确性，非打分公式，§0.2 锁定项一律不碰）。

**Tech Stack:** Python 3.12（urllib，无第三方依赖，与现有 fetch 脚本一致）、node --test、TypeScript（tsc + esbuild bundle）。

**Spec:** `E:\Projects\climate\sandbox-v2-upgrade-spec.md`（§0.5 不得编造、§7.4 LOCAL_PUBLIC 与地理回退、§7.11 缺数据走 null、§7.12 字段清单）；数据形状约定 `docs/src/scoring/dataPoint.ts`；时效政策 `docs/data/data-freshness-policy.json`。

**状态（2026-08-23 收尾）**：Task 1–9 全部完成（撞码修复 / 排放因子含 eGRID 州级 /
中国电价 31 省 / 中国气价 30 省 / 美国设备性能与存量基线 / 美国安装成本 / 基础设施），
六份数据文件全部 POPULATED，测试全绿。Task 10（中国设备性能）完成可行性勘察：
能效标识网有真实批量接口（见 CS-DECISIONS D7.4），全量抓取（约 3.2 万请求、数小时）
与 GB 21455 指标拆算列**批次 3**。代码项（i18n/路由/relevantLocalPublicData/G6）见 HANDOFF。

**状态（2026-08-24 批次 3 + 代码批次，授权升级「一切自裁、逐条记账」后执行）**：
- 批次 3 执行中：universe=中标院 2024-12 官方包（空调 12,031 + 壁挂炉 22,377），
  `scripts/crawl_energylabel.py` 全量抓取（枚举完成率 12,018/12,031，13 条 API 查无如实缺席；
  详情爬取后台进行中），Kc 拆算常数已由单冷机解出（623.5 负荷小时，D11）。
  聚合脚本 `fetch_tech_performance_cn.py` 就绪，落地后翻转 real-data-smoke 中国断言。
- 代码项全部完成：i18n 全量迁移（含 G3 题目/选项与 g1 地图文案）、G0 过时 Preview 移除、
  relevantLocalPublicData 真实化、G6 摘要卡（D12 隐私自裁 + PNG 导出）。
- 追加：美国取暖油/丙烷全国价（wfr，D 系列无新增——数据项）、D13 货币一致性守卫、
  D14 同分辅助变体合并显示、D15 配送燃料追问。全部有测试与浏览器实拍。

## Global Constraints

- §0.5：不得编造数值、不得选任意 fallback；每条数据必须带 `source_url` / `retrieved_at`（官方或可引用公开来源）。
- §7.4：地理回退 network/local → admin1 → country → NULL；禁止邻国替代、全球均值兜底。
- §7.11：缺数据 = null = `insufficient_data`，是正确行为，禁止为了出数字填估计值。
- §0.2 锁定项（四维模型、权重、打分公式、G1 定位逻辑）一律不改。
- 中国省 `admin1_code` 用 ISO 3166-2 后缀（HE=河北，不是 Natural Earth postal）；合法码表在 `docs/data/maps/SOURCES.md`。
- 排放因子单位一律 kgCO2e/kWh；价格单位一律 currency/kWh 且逐条带 `currency`。
- 数据文件由脚本生成，带 `_vintage`（与 policy 的 cadence 一致），填充后 `_status` 从 `AWAITING_DATA` 改为 `POPULATED`（data-freshness.test.js 强制）。
- 测试命令：`npm test`（= tsc + esbuild + node --test docs/tests/global/*.test.js），当前 193 条全绿，收尾必须全绿。
- 所有绕过 Guo 的自行裁定记入 `docs/CS-DECISIONS.md`（新建），HANDOFF §3.1 同步更新。
- Windows：Python 写文件一律 `encoding="utf-8"`；stdout 先 `reconfigure(encoding="utf-8")`（现有脚本已有此模式，照抄）。

## 先斩后奏决策清单（写代码前先记账，执行时逐条落入 docs/CS-DECISIONS.md）

| # | 决策 | 理由 | 如何撤销 |
|---|---|---|---|
| D1 | `Geography` 增加可选 `country_iso3`，admin1 匹配时若条目带国家则必须与查询国家一致 | 中国省码与美国州码撞码（NM/SD/SC/HI 四对），现有解析器按码匹配不看国家，加中国数据必然静默串位 | 改动向后兼容（无 country_iso3 的旧条目行为不变）；revert 单个 commit 即可 |
| D2 | 燃料燃烧因子用 IPCC 2006 Vol.2 Table 2.5（居民部门）缺省值，CO2e = CO2 + 28×CH4 + 265×N2O（AR5 GWP100，现行 UNFCCC 透明度框架口径） | 燃料含碳量是物理性质，IPCC 缺省值就是各国清单的标准引用源；GWP 集必须显式选定否则「CO2e」无定义 | 常数表在脚本里带逐项来源注释，换 GWP 集只改一处重跑 |
| D3 | 国家级电网因子用 Ember 年度数据的 OWID grapher CSV 镜像（CC-BY、无 key、含 ISO3）；口径是 CO2（Ember 不含 CH4/N2O），与 CN/US 官方口径差 <2%，逐条在 aggregation_method 里写明 | Ember 官方 API 要注册 key 且下载 URL 每版漂移；OWID 镜像是稳定可引用的公开再分发 | 换回 Ember 直连只改脚本一个函数 |
| D4 | 中国省级电网因子用生态环境部年度《电力二氧化碳排放因子》省级数值，经 curated JSON 录入（PDF 无法程序化解析），逐条带公告 URL 与原文引句 | 官方唯一口径；stub 的 preferred_sources 点名了它 | curated 文件逐条可查证，錯一条改一条 |
| D5 | 中国居民电价取「阶梯第一档、不满 1 千伏、一户一表」口径，来源限定 gov.cn / 电网官方域名；找不到官方文件的省宁缺毋滥 | 第一档是绝大多数家庭的边际电价，且是唯一在 31 省定义一致的口径；本项目算的是典型家庭年运行费 | 口径写进每条 aggregation_method 与文件 _note，换口径 = 换 curated 文件里的 value 列 |
| D6 | district_heating/cooling 与 biomass 的排放因子、其余燃料的价格：本轮仍留空 | 无公开可引用口径（district 因子是逐网络的，biomass 依原料），§7.11 null 分支就是为此设计的 | 不适用（未做任何事） |

---

### Task 1: 地理解析加国家约束（修撞码陷阱）

**Files:**
- Modify: `docs/src/scoring/dataPoint.ts:22-26`（Geography 接口）、`:104-124`（resolveScoringValue）
- Modify: `docs/data/scoring/residential_energy_prices.json`（一次性迁移：全部 admin1 条目补 `country_iso3: "USA"`）
- Modify: `scripts/fetch_energy_data.py:141-154`（point() 补 country_iso3 参数）
- Test: `docs/tests/global/scoring-geography.test.js`（新建）

**Interfaces:**
- Produces: `Geography = { level, code, country_iso3?: string }`；resolveScoringValue 语义：条目带 country_iso3 时仅当与 query.country_iso3 相同（大小写不敏感）才可命中；不带则维持旧行为。后续所有任务写入的 admin1 条目**必须**带 country_iso3。

- [ ] **Step 1: 写失败测试**

`docs/tests/global/scoring-geography.test.js`（import 方式抄 `scoring.test.js` 头部的现有写法）：

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// 引擎的引入方式与 scoring.test.js 完全一致（先看那个文件抄头三行）
// 需要拿到 resolveScoringValue；若 bundle 不导出它，则在 bundle 导出对象上找，
// 或按 scoring.test.js 的现有做法通过 scorePaths 间接断言。

const HI_DATASET = {
  field_key: "x",
  entries: {
    electricity: [
      { value: 0.30, geography: { level: "admin1", code: "HI", country_iso3: "USA" },
        source_type: "LOCAL_PUBLIC", source_name: "t", confidence: "high" },
      { value: 0.55, geography: { level: "admin1", code: "HI", country_iso3: "CHN" },
        source_type: "LOCAL_PUBLIC", source_name: "t", confidence: "high" },
    ],
  },
};

test("夏威夷查询拿不到海南的条目，反之亦然", () => {
  const us = resolveScoringValue(HI_DATASET, "electricity", { country_iso3: "USA", admin1_code: "HI" });
  const cn = resolveScoringValue(HI_DATASET, "electricity", { country_iso3: "CHN", admin1_code: "HI" });
  assert.equal(us.value, 0.30);
  assert.equal(cn.value, 0.55);
});

test("带国家的条目在查询缺国家时不命中（宁缺毋错）", () => {
  const hit = resolveScoringValue(HI_DATASET, "electricity", { admin1_code: "HI" });
  assert.equal(hit, null);
});

test("生产数据文件里所有 admin1 条目都带 country_iso3", () => {
  const dir = path.join(__dirname, "../../data/scoring");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const [subject, rows] of Object.entries(data.entries || {})) {
      for (const r of rows) {
        if (r.geography.level === "admin1") {
          assert.ok(/^[A-Z]{3}$/.test(r.geography.country_iso3 || ""),
            `${f} ${subject} admin1=${r.geography.code} 缺 country_iso3`);
        }
      }
    }
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run build; if ($?) { node --test docs/tests/global/scoring-geography.test.js }`
Expected: FAIL —— 撞码用例里两个查询拿到同一条（数组第一条），且价格文件 admin1 缺 country_iso3。

- [ ] **Step 3: 最小实现**

`dataPoint.ts`：

```ts
export interface Geography {
  level: GeographyLevel;
  /** admin1 用省/州代码，country 用 ISO3，network/local 用网络或城市标识 */
  code: string;
  /**
   * 该条目所属国家（ISO3）。admin1/local/network 级条目必须带：
   * 中国省份 ISO 3166-2 后缀与美国州码有四对重码（NM/SD/SC/HI），
   * 只按 code 匹配会把海南的数据发给夏威夷的用户，不报错、只算错。
   * country 级条目的 code 本身就是 ISO3，不需要重复。
   */
  country_iso3?: string;
}
```

resolveScoringValue 的命中条件改为：

```ts
const hit = candidates.find((entry) => {
  if (entry.geography.level !== level) return false;
  if (entry.geography.code.toUpperCase() !== code.toUpperCase()) return false;
  const entryCountry = entry.geography.country_iso3;
  if (entryCountry) {
    if (!query.country_iso3) return false;
    return entryCountry.toUpperCase() === query.country_iso3.toUpperCase();
  }
  return true; // 旧条目（无国家标注）维持原行为，生产文件由测试强制补齐
});
```

价格文件迁移（一次性，PowerShell 或 python -c 皆可，用 python 保 UTF-8）：

```python
import json, pathlib
p = pathlib.Path("docs/data/scoring/residential_energy_prices.json")
d = json.loads(p.read_text(encoding="utf-8"))
n = 0
for rows in d["entries"].values():
    for r in rows:
        if r["geography"]["level"] == "admin1" and "country_iso3" not in r["geography"]:
            r["geography"]["country_iso3"] = "USA"; n += 1
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("annotated", n)
```

`fetch_energy_data.py` 的 `point()` 加参数 `country_iso3: str | None = None`，admin1 时写入 geography；`fetch_eia_series` 调用处传 `"USA"`。

- [ ] **Step 4: 全量测试**

Run: `npm test`
Expected: 原 193 条 + 新 3 条全绿（scoring.test.js 的合成夹具不带 country_iso3，走旧行为分支，不受影响）。

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "地理解析加国家约束：中美 admin1 撞码（NM/SD/SC/HI）不再可能静默串位"
```

### Task 2: 排放因子两个文件落地（scripts/fetch_emission_factors.py）

**Files:**
- Create: `scripts/fetch_emission_factors.py`
- Create: `scripts/curated_cn_grid_ef.json`（生态环境部省级因子，子代理搜集 + 人工核样）
- Modify: `docs/data/data-freshness-policy.json`（两个数据集的 `script` 字段改成真实脚本名）
- Generate: `docs/data/scoring/fuel_emission_factors.json`、`docs/data/scoring/electricity_emission_factors.json`
- Test: `docs/tests/global/scoring-data-files.test.js`（新建：六文件通用 schema/量纲校验）

**Interfaces:**
- Consumes: Task 1 的 country_iso3 约定。
- Produces: `entries.grid`（电力文件）= Ember 国家级 + MEE 中国省级（admin1, country_iso3=CHN）；`entries.{natural_gas,lpg,heating_oil,solid_fuel}`（燃料文件）= {USA, CHN} ∪ Eurostat 国家表 的 country 级条目。

- [ ] **Step 1: 派子代理搜集 MEE 省级因子**（与写代码并行）

任务书：找生态环境部最新一期《电力二氧化碳排放因子》公告（年度发布，含省级数值表），返回 JSON：`{"announcement_title","announcement_url","factor_year","unit","provinces":[{"name_zh","value"}...31条]}`。要求 gov.cn 域名原始公告；引不到官方就如实说，不许用第三方转载数值顶替（转载可用于交叉核对）。

- [ ] **Step 2: 写六文件通用校验测试（先写，此时对新文件失败）**

`scoring-data-files.test.js` 断言（对 `docs/data/scoring/*.json` 逐个跑）：
- `_status` 为 POPULATED ⟺ entries 非空 ⟺ 有 `_vintage`，且 `refresh_cadence_days` 与 policy 一致（与 data-freshness.test.js 互补，不重复其过期判断）；
- 每条 entry：source_type=LOCAL_PUBLIC、source_name 非空、`source_url` 是 http(s)、retrieved_at 是 ISO 日期、confidence ∈ {high,medium,low}；
- 量纲哨兵：`fuel_emission_factors` 的 natural_gas 值 ∈ [0.18, 0.23]（kgCO2e/kWh；若有人把 kg/TJ 或 g/kWh 写进来会差 3–6 个数量级，此断言当场拦截）；`electricity_emission_factors.grid` 全部 ∈ [0.005, 1.5]；
- `grid` 的 CHN admin1 条目恰好 31 个省码且 ⊆ 合法 ISO 码表（从 `docs/data/maps/admin1-cn-us.geojson` 读合法集）。

- [ ] **Step 3: 写 fetch_emission_factors.py**

结构照抄 fetch_energy_data.py（stdout reconfigure、http_json 重试、point()、_vintage 从 policy 算）。关键内容：

```python
# IPCC 2006 Vol.2 Ch.2 Table 2.5（Residential）缺省因子，kg/TJ（净热值）
# CO2e = CO2 + 28*CH4 + 265*N2O（AR5 GWP100，UNFCCC 现行清单口径）
# 逐项 URL 写在常数旁注释里（ipcc-nggip.iges.or.jp 的分卷 PDF）
IPCC_RESIDENTIAL = {
    #  fuel_key      CO2      CH4   N2O   ipcc_fuel_name
    "natural_gas": (56100.0,  5.0, 0.1, "Natural Gas"),
    "lpg":         (63100.0,  5.0, 0.1, "Liquefied Petroleum Gases"),
    "heating_oil": (74100.0, 10.0, 0.6, "Gas/Diesel Oil"),
    "solid_fuel":  (94600.0, 300.0, 1.5, "Other Bituminous Coal"),  # 居民炉具 CH4 缺省值就是这么高
}
GWP100_AR5 = {"CH4": 28.0, "N2O": 265.0}
TJ_PER_KWH = 3.6e-6
def co2e_per_kwh(co2, ch4, n2o):
    return (co2 + ch4 * GWP100_AR5["CH4"] + n2o * GWP100_AR5["N2O"]) * TJ_PER_KWH
```

燃料文件的国家集合 = `{"USA","CHN"} | set(ISO2_TO_ISO3.values())`（把 fetch_energy_data.py 的 ISO2_TO_ISO3 复制过来并注明同步来源）。每条 aggregation_method 写明「IPCC 缺省值为燃料物理性质，逐国重复仅为满足 §7.4 的按国解析，不是各国实测值」，confidence=medium（solid_fuel 因煤种差异 =low）。

电力部分：下载 `https://ourworldindata.org/grapher/carbon-intensity-electricity.csv?v=1&csvType=full&useColumnShortNames=true`（列：Entity,Code,Year,co2_intensity；gCO2/kWh），取每个 ISO3 的最新年份，值 ÷1000，跳过无 ISO3 的聚合行与 OWID_ 开头的区域行；单位断言：世界均值那行若存在应在 [200,600] gCO2/kWh，越界即 raise。合并 `scripts/curated_cn_grid_ef.json`（校验 31 省全、值 ∈ [0.05,1.2]、URL 是 gov.cn），CN 条目 level=admin1、country_iso3=CHN、currency 不填。两个输出文件各自带 `_vintage`、`_note`（口径差异：Ember=CO2、MEE=CO2，eGRID 待补 → 均在 aggregation_method 标注气体覆盖）。

- [ ] **Step 4: 跑脚本 + 全量测试**

Run: `uv run --no-project python scripts/fetch_emission_factors.py`，然后 `npm test`
Expected: 两文件 POPULATED；新校验测试全绿；data-freshness.test.js 认可 _vintage。

- [ ] **Step 5: Commit**

```
git commit -m "排放因子落地：IPCC 2006 燃料缺省值 + Ember 国家电网 + 生态环境部中国省级电网"
```

### Task 3: 中国省级居民电价（curated + 合并进 fetch_energy_data.py）

**Files:**
- Create: `scripts/curated_cn_residential_electricity.json`
- Modify: `scripts/fetch_energy_data.py`（新增 `[3/3] 中国` 步骤 + `--skip-cn`；`_not_covered` 文案改为「中国气价待补（定价在地级市）」）
- Regenerate: `docs/data/scoring/residential_energy_prices.json`（全量重跑）
- Test: 扩 `scoring-data-files.test.js`：electricity 里 CHN admin1 条目 = curated 文件里的省集合、currency 全 CNY、值 ∈ [0.35, 0.75]；实文件撞码回归：{CHN,HI} 命中 CNY、{USA,HI} 命中 USD。

**Interfaces:**
- Consumes: Task 1 的 resolveScoringValue 语义、Task 2 的测试文件。
- Produces: curated 行 schema：`{admin1_code, province_zh, value_cny_per_kwh, tariff_scope:"第一档|不满1千伏|一户一表", doc_title, doc_no, issuer, source_url, effective_note, quote, verified:"official_url"}`。

- [ ] **Step 1: 派 4 个并行子代理**，每个负责 7–8 个省，任务书统一：找该省现行有效的居民目录销售电价官方文件（省发改委/物价局公告，或国网省公司/南网官网公示页），提取第一档不满 1 千伏一户一表电价（元/千瓦时），返回上述 schema 的 JSON 行；**只接受 gov.cn / sgcc.com.cn / 95598.cn / csg.cn 域名**；有丰枯/城乡差异的省，取省会适用的标准档并在 quote 里带原文；找不到官方源就标 `"verified":"not_found"` 并说明，禁止用聚合站数值顶替。

- [ ] **Step 2: 人工核样**：河北（已知 0.52，冀价管〔2012〕48号 / 冀发改函〔2022〕351号）+ 随机抽 2 省，亲自打开 URL 对数。对不上的省整行剔除。

- [ ] **Step 3: 合并逻辑**（fetch_energy_data.py）：读 curated → 校验（码合法、无重复、范围、URL 域名白名单、quote 非空）→ 生成 point(level=admin1, code, country_iso3="CHN", currency="CNY", confidence="high", aggregation_method=tariff_scope+"；中国居民目录电价，长期有效直至新文件替代")。`_coverage["CN"]["electricity"]` 与缺失省清单写进文件头。

- [ ] **Step 4: 全量重跑 + 测试**

Run: `uv run --no-project python scripts/fetch_energy_data.py`（EIA key 在 .env）；`npm test`
Expected: 价格文件三来源共存（USD/EUR/CNY），全部测试绿。

- [ ] **Step 5: Commit**

```
git commit -m "中国省级居民电价落地：阶梯第一档官方口径，逐省带发改委/电网出处"
```

### Task 4: 记账与交接文档

**Files:**
- Create: `docs/CS-DECISIONS.md`（D1–D6 逐条：决策/理由/影响面/如何撤销/日期）
- Modify: `docs/HANDOFF.md` §3.1（缺口表更新：三项已落地，剩 technology_performance / installed_costs / infrastructure / 中国气价 / 其余燃料价）
- Memory: 更新 `climate-project-state.md`（数据落地状态）

- [ ] **Step 1:** 写 CS-DECISIONS.md（含「本文件存在的原因：用户 2026-08-23 授权先斩后奏，所有绕过产品负责人的裁定集中在此，Guo 逐条 review 后可关闭」）。
- [ ] **Step 2:** HANDOFF §3.1 重写缺口表；§2 增补本轮新增内容。
- [ ] **Step 3:** `npm test` 最终全绿确认 + commit + push。

```
git commit -m "CS 决策台账 + HANDOFF 数据清单更新"
git push
```

### 批次 2（2026-08-23 续批执行；Task 5 美国设备性能已提前完成）

- **Task 6 · 中国居民气价**：31 省会城市第一档居民管道天然气价（元/m³），curated 模式同电价
  （4 个子代理 + 域名白名单 gov.cn，宁缺毋滥）。元/m³ → 元/kWh 的热值换算系数是外部常数，
  与 KWH_PER_MCF 同等对待：写进 `_conversions` 并给灵敏度。北方城市的采暖季专项气价/气量记 notes。
- **Task 7 · eGRID 美国州级电网因子**：EPA eGRID summary tables xlsx，州级 CO2e output rate
  （lb/MWh × 0.45359237 / 1000 → kg/kWh），并入 electricity_emission_factors（admin1 + country_iso3=USA）。
- **Task 8 · 美国安装成本**：EIA《Updated Buildings Sector Appliance and Equipment Costs and
  Efficiencies》的居民设备 Total Installed Cost；解析不动就如实缺席，不硬凑。中国无可引用口径，留 null。
- **Task 9 · infrastructure_availability**：美国 ACS B25040（Census API，各州取暖燃料）→ piped_gas；
  中国住建部《城市建设统计年鉴》→ 燃气普及率 + 集中供热面积（北方省 district_heating_network=true）。
  只发 true 条目——引擎里 false 与缺失同效（都落 unknown），不发无信息量的 false。
- **Task 10 · 中国设备性能可行性**：探中国能效标识备案库（energylabel.gov.cn）能否程序化拉
  房间空调 APF 分布；能 → 与 ENERGY STAR 同法聚合（非口径发明）；不能 → GB 21455 门槛值方案
  仍等 Guo（D7.4 不变）。

## Self-Review

- 覆盖检查：§7.12 六文件中三个本轮落地、三个明确移批次 2 ✓；撞码缺陷在写入任何 CN admin1 数据之前修复（Task 1 先行）✓。
- 无占位符：所有代码步骤给了真实代码/真实断言区间 ✓（curated 数值由执行期搜集，属数据而非代码占位）。
- 类型一致：country_iso3 命名在 dataPoint.ts / 迁移脚本 / 两个 fetch 脚本 / 测试里一致 ✓；subject 键（grid / natural_gas / electricity）与 index.ts 的 emissionFactorFor、priceFor 消费端一致 ✓。
- 风险：MEE 公告如搜不到官方 URL → 中国省级电网因子整体缺席（国家级 Ember CHN 仍在，engine 按 country 回退），不放宽来源标准。
