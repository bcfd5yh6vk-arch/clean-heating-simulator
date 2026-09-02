# 本轮改动说明与待办清单

面向：Guo Hang（产品负责人）与后续接手的人
时间：2026-08-12

---

## 一句话

Phase 0 的页面与路由做完了，Phase 1 的**四维打分引擎按规格 §7.5–§7.10 完整实现并接进了 G4**。
引擎现在跑的是真公式，但因为 `docs/data/scoring/*` 与 `docs/data/climate/*` 还没有数据，
它会如实返回 `insufficient_data` —— G4 页面显示「暂时无法排序」并列出缺哪几份数据，
**不再显示任何编造的分数**。

---

## 1. 最重要的一处改动：G4 不再撒谎

改动前，`docs/global/app.js` 的 `buildDemoRankedPaths()` 返回三条写死的路径：

```js
fitness: 83.3 / 74.1 / 71.8
annual_run_cost: 1240        // 写死
hdd18: 3400, cdd24: 420      // 写死，与用户位置无关
outdoor_space_score: practicality - 2   // 凭空减 2
```

而同一个页面上印着「所有分数均由你的回答、当地公开数据和确定性公式计算」。

现在这些函数已删除，G4 走 `docs/global/pipeline.js` → `docs/src/scoring/`。
`docs/src/global/screening.ts` 里那个用旧五维模型
（`{cost:35, carbon:20, comfort:20, climate:15, simple:10}`，规格 §7.10 写明「已废弃，不得再实现」）
并直接把 `capex_tier` / `comfort_tier` / `simplicity_tier` 换算成分数的 `scoreAndSort` 也已移除。

---

## 2. 新增了什么

### 打分引擎 `docs/src/scoring/`

| 文件 | 规格 | 内容 |
|---|---|---|
| `dataPoint.ts` | §7.4 | `ScoringDataPoint<T>` 与地理 fallback `network/local → admin1 → country → NULL`。**把 provenance 做成类型约束**：没有 geography / source 的裸数字构造不出来，也就进不了公式 |
| `config.ts` | §7.6.3 | 所有阈值集中在此（规格明确要求「勿散落 hard-code」） |
| `derived.ts` | §7.5 | HDD18 / CDD24、账单反推有用负荷、候选能耗、冷热权重 wH/wC |
| `affordability.ts` | §7.6 | 运行负担率分段线性 + upfront 评分 + `A = 0.65·S_run + 0.35·S_upfront` |
| `climate.ts` | §7.7 | 季节性能相对归一化、极端温度裕度、§7.7.5 安全护栏 |
| `environment.ts` | §7.8 | `E = clamp(50 + 50·Reduction, 0, 100)` |
| `practicality.ts` | §7.9 | 四项子分加权 |
| `fitness.ts` | §7.10 | 加权合成、缺维归一化、soft cap、五级 tie-break 排序 |
| `carriers.ts` | — | 技术 → 能源载体 / 排放因子键的映射 |

`RankedPath` 已换成规格 §7.10 的 canonical contract（`status` / `rank` / `dimension_details` /
`score_coverage` / `warnings` / `data_notes`，`fitness: number | null`）。

### 测试

`docs/tests/global/scoring.test.js`，22 个用例（规格 §11 Phase 1 要求 ≥10）。重点覆盖：

- **没有数据时全部落 `insufficient_data`**，且没有任何维度返回 50
- 有夹具数据时**同一输入跑两次结果逐字节相同**（§11 验收条件）
- 技术目录顺序不影响排序
- 各分段函数在断点上的取值（含 §7.7.4 在 margin = −5 处的不连续）

`docs/tests/global/fixtures/scoring-data.js` 是**合成夹具**，每条 `source_name` 都写死
`SYNTHETIC TEST FIXTURE — not real data`，误接到生产时会自证。

### 页面

- `docs/global/landing.html` —— G0，文案逐字取自规格 §5
- `docs/global/story.html` —— My Story，规格锁定的 6 个 section
- `docs/global/impact.html` —— Impact & Evidence，全球指标全部空状态
- `docs/global/i18n.js` + `i18n/en.json` / `i18n/zh.json` —— 138 个 key，中英一致

### 路由（`vercel.json`）

`/` 与 `/global` → G0；`/china` → China Pilot；`/story`、`/impact`；
`/advisor` → 现有问卷原型（**临时**，G1 上线后并入主流程）。

`vite.config.mjs` 直接读 `vercel.json`，本地与线上路由不会漂移。

---

## 3. 需要你（Guo）做的事

### 3.1 数据

**更新（2026-08-18）：气候数据已由 CS 侧抓取完成，不再需要你提供。**
早先这一节写的是「9 份数据都要你提供」，依据是规格 §0.5 说 CS 不得自行编造数值。
但「不得编造」与「不得搜集」是两回事 —— 从可引用的公开来源抓取真实数据并带上出处，
正是 §7.4 对 LOCAL_PUBLIC 的要求。据此重新划分如下。

#### 已完成（由 `scripts/fetch_climate_data.py` 生成，可重跑）

| 文件 | 状态 |
|---|---|
| `cn_us_admin1_capitals.json` | ✅ 中国 31 省 + 美国 51 州（含 DC）全覆盖，共 82 条 |
| `climate_profiles.json` | ✅ 全部 30 个 Köppen 细分类 |

来源 **NASA POWER**（免费、无需 key、可引用），1991–2020 气候学。每条含月均温、月降水、
极端低/高温 proxy（逐日 P01/P99）、Köppen 码、首府名与坐标，以及 `source_url` / `retrieved_at`。

三件值得知道的事：

1. **首府点是空间连接出来的**，不是按名字匹配 —— 上游省份译名与行政区后缀经常对不上，
   按名字匹配会静默丢省份。北京和华盛顿特区在上游被标为 `Admin-0 capital`（它们就是国家首都），
   脚本对此做了回退。
2. **Köppen 代表点由数据选，不是我挑的**：取该气候区内人口最多的城市。原因是手挑会错 ——
   校验时发现**北京在 Beck et al. 2023 的 1991–2020 分类里是 BSk 而非常识中的 Dwa**
   （华北平原整体判为半干旱），石家庄同理。选点在写入前都用同一份栅格复核过。
3. **`design_temp_c` 故意留空**。它在 `screening.ts` 里只有 confidence 为 high 时才参与硬排除，
   而 ASHRAE design temperature 与 P01 proxy 定义不同，拿一个顶另一个会静默改变技术筛选结果。

#### 再更新（2026-08-23）：价格与排放因子已全部落地

用户授权「先斩后奏」，数据侧的自行裁定全部记录在 **`docs/CS-DECISIONS.md`**（D1–D6），
每条带理由与撤销方式，请逐条 review。§0.2 锁定项（打分公式）一条没动。

| 文件 | 状态 |
|---|---|
| `residential_energy_prices.json` | ✅ 231 条：美国 51 州（EIA 电+气）+ 欧洲 38 国（Eurostat）+ **中国电 31 省、气 30 省**（发改委/电网官方文件 curated 录入，见 `scripts/curated_cn_residential_electricity.json` / `curated_cn_residential_gas.json`，逐条带文号与原文引句；合肥政府站反爬取不到证，气价如实缺席，可人工补）。气价按省会一档价 ÷ 9.886 kWh/m³（低位热值，与 GB 20665 效率基准自洽，D10） |
| `electricity_emission_factors.json` | ✅ 294 条：213 国（Ember）+ **中国 30 省**（生态环境部 2023 年因子；西藏官方无数据，§7.4 回退国家级）+ **美国 51 州**（eGRID2023 CO2e） |
| `fuel_emission_factors.json` | ✅ IPCC 2006 居民部门缺省值 × 44 国（天然气/液化气/燃油/散煤） |
| `technology_performance.json` | ✅ **仅美国**：ENERGY STAR 认证列表 P25/P50/P75（热泵/地源/房间空调/锅炉/暖炉）+ 存量基线（电阻 1.0 物理定义；燃气 0.80/燃油 0.83/房间空调 CEER 10.9 来自联邦最低标准 10 CFR 430.32）。**美国由此成为第一个全链路可算的市场**（`real-data-smoke.test.js` 实证：伊利诺伊燃气供暖家庭得到完整四维排名）。HSPF2/SEER2 不得冒充欧盟 SCOP 或中国 APF——中国口径见下表 |
| `technology_installed_costs.json` | ✅ **仅美国**：EIA 官方设备成本研究 12 台设备（风管热泵 6,940、地源 19,000、燃气暖炉 4,150 美元等，2022$）。PDF 版式多变，采用人工转录 + 脚本对原文数字串逐行核验（D8）；**有意跳过无风管迷你分体**——EIA 表值是单区机型，当整宅成本会系统性抬高该路径 |
| `infrastructure_availability.json` | ✅ 中国集中供热 18 省（住建部 2024 年鉴，≥500 万㎡ 阈值见 D9）+ 管道气中国 31 省、美国 51 州 + 电网 44 国（世行）。只写 true 条目（引擎里 false 与缺失同效） |

同步修了一个会静默算错的缺陷：中国省码与美国州码有四对重码（NM/SD/SC/HI），
地理解析已加国家约束（`dataPoint.ts` 的 `country_iso3`，见 CS-DECISIONS D1），
真实数据的双向回归在 `scoring-data-files.test.js`。

#### 仍然缺的（现在的阻塞项只剩这些）

| 文件 | 没有它的后果 | 计划 |
|---|---|---|
| ~~中国设备性能~~ | — | **2026-08-24 批次 3 已落地（CS-DECISIONS D11）**：能效标识备案库全量抓取（空调 12,018/12,031 + 壁挂炉 22,377/22,377，~35k 请求 5 小时），固定份额法拆算 APF（Kc=623.5 由单冷机解出、制冷份额 0.6531、独立交叉验证差 1.3%）。中国条目：分体热泵 制热 P50=3.74（n=11,495）/制冷 P50=5.87、壁挂炉 ηs P50=0.856（n=21,856，LHV 基与气价换算自洽）。**中国采暖户全链路可算**（冒烟断言已翻转：河北电采暖家庭四维齐全）。已知边界：需制冷的家庭还缺「中国存量空调制冷基线」（美国的联邦最低 CEER 口径是美国特有；中国的 GB 12021.3 限定值卡标准原文且为额定工况 EER 非季节口径）——制冷账单反推如实断掉，已钉成显式冒烟断言，见 D11.8。紧凑抽取缓存已入库可离线复算 |
| 欧盟设备性能 | 欧盟 Global 流程 insufficient_data | EPREL 需申请 API key（用户侧动作）；热泵运行温度区间（NEEP ccASHP）列批次 4 |
| 中国安装成本 | 中国路径 A 维退化为只看运行费（§7.11 允许，已如实缺席） | 无可引用官方口径，维持缺席；若 Guo 认可可探讨行业协会/招标口径 |
| 其余燃料价格（散煤/集中供热；lpg/燃油的欧中部分） | 对应路径 Affordability 不可算 | **美国取暖油/丙烷已入**（2026-08-24：EIA wfr 最近采暖季全国均价，州级冬季燃料调查已停发故为 country 级，HHV 换算与 AFUE 自洽）；集中供热是按面积计价（元/㎡·季），与 per-kWh 模型结构不符，需规格层面处理 |
| 存量基线：散煤/集中供热效率，及欧盟/中国的存量基线 | 对应现状家庭的账单反推走 §7.11 | 无可引用公开口径，待定；中国燃气炉可用 GB 20665 能效限定值作存量下限（等标准原文可得，openstd 在线阅读已要求登录） |
| ~~代码项（数据无关）~~ | — | **2026-08-24 全部完成**：问卷页文案全量迁 i18n（app.js 内联 MESSAGES + G3 题目/选项 + g1.js TEXT → i18n/\*.json，330+ 键，中英 headless 实测无缺键）；G0 落地页删除过时 Preview 段（主按钮此前已指向 /advisor）；`relevantLocalPublicData` 改为用引擎同款地理解析报告实际命中值与层级（缺失字段不出现）；**G6 PNG 摘要卡已建成**（隐私矛盾按 CS-DECISIONS **D12** 自裁：运行费精确、负担率只显示档位）——headless 全流程 E2E 双语通过（`scripts/e2e-global-g6-driver.js`） |

另外三条给 Guo 的观察（来自数据搜集过程，可能影响产品判断）：

1. **多省有针对清洁取暖的专项电价**（如新疆煤改电采暖季 0.22 元/度、各省谷段电取暖优惠），
   比目录第一档低 40–60%。引擎目前只有统一居民价机制，这会**系统性高估**热泵/电取暖的运行费——
   对一个推荐清洁取暖的产品来说是保守方向的偏差，但值得你知道。
2. **气价同样有采暖专项条款，而且更普遍**：北方 8 个省会里 6 个有采暖专项气价、补贴或扩档
   （北京壁挂炉采暖补贴后实际约 1.9 元/m³、天津独立采暖一档 2.76、石家庄采暖期全按一档、
   西安/兰州/乌鲁木齐壁挂炉户单设大额度年阶梯……逐城细节在
   `scripts/curated_cn_residential_gas.json` 的 heating_season_note）。引擎用生活用气一档价，
   会**高估**北方燃气壁挂炉采暖的运行费。若产品要认真比较「煤改电 vs 煤改气」，
   专项采暖价格机制值得进规格。
3. 阶梯第二/三档的存在意味着高用电/用气家庭的运行费被低估（电 +0.05/+0.30 元/度、
   气 +20%/+50% 量级），与前两条方向相反。全部写在每条数据的 aggregation_method 里。

### 3.2 规格里必须你裁定的矛盾

1. **货币口径不闭环**（§7.6.2 vs §8）：`OperatingBurdenPct = AnnualRunCost / AnnualIncome`，
   但成本是当地本币、收入由用户从 150+ 种货币任选，而 `fx_rate` 被标为 display-only。
   一个填 EUR 收入、住美国的用户会被算成「USD 成本 ÷ EUR 收入」，**不报错也不警告**。
   **【2026-08-24 已按 D13 自裁堵住出血点】**：币种不一致时金额量按 §7.11 视为缺失 +
   逐路径双语警告，不再输出跨币种数值。**汇率换算机制是否引入仍归你定**——
   守卫只保证不算错，没有让这类用户算得出来。
2. **G6 摘要卡的隐私规则自相矛盾**（§1935 vs §1990）：禁止显示原始年收入，
   却要求同时显示年运行费和运行负担率 —— `income = cost / (burden/100)`，可精确反推。
   **【2026-08-24 已按 D12 自裁落地 G6】**：卡上运行费精确、负担率只显示档位
   （<3%/3–6%/6–10%/>10%），只能反推出约 2 倍宽的收入区间。档位划分若要改，见 D12。
3. **`scoreTemperatureMargin` 在 margin = −5 处不连续**（§7.7.4）：`[−5,0)` 给 30，`< −5` 给 0。
   极端温度 proxy 是 P01/P99 统计量，年际波动远大于这个跳变宽度；再叠加 §7.7.5 的硬排除，
   一条路径会因小数点第三位在「第一名」和「不可行」之间跳。其余分段函数都是连续的，
   **很可能是笔误**。当前严格按规格实现，未擅自平滑。
4. **效率被重复计权约 0.56**：季节效率同时驱动 Affordability（运行费）和 Climate（季节性能），
   0.35 + 0.30×0.70 ≈ 0.56 的权重落在同一个物理量上，而四维对外是「四个独立视角」。
5. **HDD18 与 CDD24 基准不同却相除**（§7.5.7）：6℃ 的基准差系统性放大 HDD、压缩 CDD，
   会让所有既取暖又制冷的家庭都被判为「取暖更重要」。
6. **soft cap 在四舍五入之前还是之后？** 当前先 cap 再 round（差异 ≤ 0.05）。
   注意 cap 生效后 Fitness 不再等于加权和。
7. **§7.12 标题写「39 项字段」，表里只有 30 行。**
8. **规格 §2073-2074 有一句面向具体个人的私人旁白**（「给冯冯看：这个 feedback 是为了满足要求做的表面工程…」），
   而 `/impact` 正要拿这批反馈当公开证据。建议从交接版本里删掉。

### 3.3 G3 问卷的一个真实粒度缺口

G3 的「当前取暖方式」里 `delivered_fuel_heating` 不区分**液化气**和**燃油**，
两者单价差很多，导致无法从账单反推供热需求 —— 这类家庭的 Affordability 与 Climate 会直接不可算。
建议在 G3 加一个二选一追问，或在 G2 让用户直接填当前燃料。

---

### 3.4 辅助措施目前不影响任何分数（需要你定规则）

同一主技术搭配不同辅助措施会生成多条路径，但它们现在**得分完全相同**：

```
#1  88.8  无风管空气-空气热泵
#2  88.8  无风管空气-空气热泵 + cool_roof
#5  87.0  空气-水热泵
#6  87.0  空气-水热泵 + erv_hrv
```

原因：保温、外遮阳、冷屋顶这类 `bundle_only` 措施在技术目录里的
`operating_cost_model` 是 `passive_zero_direct_energy` —— 它们自身不耗能，
但规格没有定义**它们如何降低住宅的有用冷热负荷**。没有这个规则，
它们对 A / C / E 三维都没有影响，于是排序里成对出现、分数一模一样。

需要你给一个口径：例如「保温改造把 UsefulHeatingDemand 降低 X%」，
且 X 必须来自可引用的公开研究，不能拍脑袋。在此之前建议 G4 把
仅辅助措施不同的路径合并显示。

## 3.5 G1 地图已落地（2026-08-14 追加）

规格 Phase 0 的「在地图上点选位置」做完了。用户点一下地图，中美识别到省 / 州，
其余国家识别到国家 + Köppen 气候区，结果直接进入打分管线。G2 里原来那个国家下拉 + 省州文本框已删除，
改成只回显地图选定的位置。

**打分链路一行没改** —— `docs/global/pipeline.js` 的 `resolveClimate(sources, geo)` 早就在按
`{country_iso3, admin1_code, koppen_code}` 查气候，G1 只是把这个 `geo` 的来源从表单换成了地图点击。

### 3.5.1 `admin1_code` 用 ISO 3166-2，填数据前务必看这条

填 `docs/data/climate/cn_us_admin1_capitals.json` 时，`admin1_code` **必须**用 ISO 3166-2 的后缀。
不要用别处常见的省份缩写 —— Natural Earth 的 `postal` 字段与 ISO 3166-2 对中国省份**互相撞码**：

| 本产品用的码（ISO 3166-2） | 是哪个省 | 而 NE `postal` 里同样的字母是 |
|---|---|---|
| `HE` | **河北省**（本项目试点所在地） | 河南 |
| `HA` | 河南省 | 海南 |
| `HB` | 湖北省 | 河北 |
| `HI` | 海南省 | — |
| `SN` | 陕西省 | — |

填错不会报错，只会让那个省的每一个分数都基于另一个省的气候。全部 31 个中国省级行政区与
51 个美国州（含 DC）的合法取值见 `docs/data/maps/admin1-cn-us.geojson` 的 `admin1_code` 字段，
或 `docs/data/maps/SOURCES.md` 的对照表。`scripts/build_map_data.py` 里对 `HE→河北` 等绑定写了硬断言，
`docs/tests/global/g1-location.test.js` 里也有对应用例，上游改编码会直接构建失败或测试变红。

美国那 51 个要素两种编码完全一致，所以骨架示例里的 `"IL"` 不受影响。

### 3.5.2 两个气候骨架文件的 schema 增补了字段

规格 §G1 的气候卡要显示「首府名」和**月降水柱状图**，但原来的骨架里没有这两类字段。
已按并集补齐，**不影响任何锁定项，只是让你一次填对**：

- `cn_us_admin1_capitals.json` 新增 `admin1_name_en/zh`、`capital_name`/`capital_name_zh`、
  `capital_lat`/`capital_lon`、`koppen_code`、`climate.precipitation_mm_monthly`。
- `climate_profiles.json` 新增 `display_name_en/zh`、`climate.precipitation_mm_monthly`、
  `source_urls`、`selection_rule`（代表点怎么选的，不写就没法复现）。

降水只用于 G1 的图，不参与 §7 的任何打分公式。

另：规格 §G1 里给的 schema 示例是嵌套对象（`{"CHN": {"Hebei": {...}}}`），实现用的是数组
（`entries: [{country_iso3, admin1_code, ...}]`）。因为 `resolveClimate` 本来就按数组查，
而且数组能给每一行单独挂 provenance。规格把那段标为「示例」，属实现选择。

### 3.5.3 需要你裁定：边界归属与称谓

**这条我没有替你决定，也不该由 CS 决定。** 地图边界用的是 Natural Earth（公有领域），
它对争议地区的切分和标注是它自己的编辑立场。具体到本产品：

1. **台湾、香港、澳门在上游是三个独立的 admin0 要素**（`TWN` / `HKG` / `MAC`）。
   直接后果：在这三处点击得到的 `country_iso3` 分别是 TWN / HKG / MAC，
   **不会进入中美 Admin-1 分支**，会落到 Köppen 标准 profile。
2. **Natural Earth 给台湾的中文标注是「中华民国」**，会直接显示在气候卡上。
3. 上游把「西沙群岛」列为 `CHN` 的一个 Admin-1 要素但只给了自造占位码 `CN-X01~`，已跳过；
   在其范围内点击只识别到国家。

改动方式已经做成数据而不是代码，你不需要动任何 JS：

- **只改显示名** → 编辑 `docs/data/maps/country-label-overrides.json`（默认空，脚本不会覆盖它）。
- **改切分方式** → 换边界源后重跑 `scripts/build_map_data.py`。

### 3.5.4 顺手修掉的两处硬编码

都属于「页面/数据在撒谎」这一类，与本轮 G1 直接相关：

1. `docs/global/app.js` 的 `buildSharedAiInput()` 原来把 **United States / Illinois / Dfa /
   HDD 3400 / 年收入 56000** 写死送给 AI，无论用户实际在哪、填了什么。这和已被删掉的
   `buildDemoRankedPaths()` 是同一类问题，只是藏在提示词里更难被发现。现在全部取自 G1 与 G2 的真实输入，
   取不到就送 `null`；`relevantLocalPublicData` 也不再声称缺失的数据集「available」。
2. `collectFeedbackAnswers()` 原来把 `country_iso3: "USA"`、`admin1_name: "Illinois"` 写死，
   也就是**入库的每一条 G7 反馈都标着同一个地点**。反馈是要当研究证据用的，现在改为用户真实点选的位置，没有就送 null。

### 3.5.5 数据来源与已知精度边界

`docs/data/maps/` 下的文件全部由 `scripts/build_map_data.py` 生成，不要手工编辑。
来源、许可、SHA256、处理步骤都在 `docs/data/maps/SOURCES.md`。要点：

- 国界 Natural Earth 1:50m（公有领域）；中美省/州界 1:10m。紧贴国界的点可能归错国家。
- Köppen 用 GloH2O / Beck et al. 2023 的 **0.1° 产品**（作者自己发布的分辨率，不是我们重采样的），
  赤道约 11 km，**海岸线和山区会错分类**。它回答的是「该用哪个标准气候区 profile」，不是该点的实测气候。
- 栅格以 8 位灰度 PNG 分发，像素值即分类索引。构建时校验了输出不含色彩配置块
  （带 `gAMA`/`iCCP` 的 PNG 会被浏览器做色彩管理转换、像素值被悄悄改掉且不报错），
  页面加载后还会跑 legend 里的自检探针，不通过就整块禁用气候区功能而不是给一个错答案。

---

## 4. 已知未完成

- **G1 地图已完成**（见上方 §3.5）。仍缺的是气候数值本身 —— 见 §3.1，那是你要提供的数据。
- **G6 PNG 摘要卡没做**（Phase 2）。
- **`docs/global/app.js` 的文案仍是内联的**，没走 `i18n/*.json`。规格 §5 要求走字典。
  landing / story / impact 三页已经走了，问卷页（含本轮新增的 G1 文案）还没迁。
- **`buildSharedAiInput()` 的 `relevantLocalPublicData` 仍是半写死的**。目前只做到「缺数据时不谎称有」，
  真正该做的是从打分结果里列出实际用到的 LOCAL_PUBLIC 字段。等数据到位后再补。
- **`/advisor` 是临时路由**。G1 已经在这个页面的最前面，但 G0 落地页的主按钮还没改成直接进 G1。

### 那两条一直红的测试已经修好（2026-08-14）

`g7 18` / `g7 19` 是在 grep 规格文档的措辞。查下来**不是规格丢了要求，是测试的正则过时了**：

- `g7 18` 找 `Global Advisor Feedback`，规格已改名为 **`Global Advisor metrics`**；
  「/impact 要把 China Pilot 证据与 Global Advisor 指标分开展示」这条要求本身还在（§11 验收项）。
- `g7 19` 找 `not automatically published`，规格现在写的是 **`never auto-publish`** 与
  **「不能自动公开」**（§920 / §2119 / §3155），比原措辞更强。自由文本必须人工审核后才可展示这条**没有松动**。

只放宽了两个正则去匹配当前措辞，没有改动任何断言的实质。现在 **193 条测试全绿**。

## 5. 与本轮无关但必须处理的（详见此前的审计）

1. `scripts/scrape_sat_rw_knowledge.py:610-611` 有第三方网站的**明文账号密码**，且该文件公网可取
   （实测 HTTP 206）。**先去对方站点改密码**，删文件不够，git 历史里还在。
2. 仓库没有 `.vercelignore`，`research/`、`scripts/` 等目录整个对外公开，
   其中包含 9.7 MB 抓取的 SAT 题库和一份**含真实手机号**的问卷 CSV。
3. `simulation_sessions` 的 anon SELECT 策略仍开着，配合公开的 anon key，全表可被任何人读走。
4. 手机号在 CSV 里有**两份**（扁平列 + `post_survey` jsonb），清理时两处都要处理。
5. 论文主样本 n=21 里混进了一条 `scripts/e2e-other-journalist.mjs` 跑出来的自动化测试记录。
