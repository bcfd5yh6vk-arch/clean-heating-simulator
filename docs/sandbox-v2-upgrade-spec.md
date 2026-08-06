# Climate Adaptation Energy Advisor — Global Upgrade Spec

> **文档用途**：给负责改网站的同学（CS 背景）看的**产品 + 技术 + UI 全文说明**。  
> **产品负责人**：Guo Hang  
> **当前线上版本**：https://www.clean-heating-simulator.com（根目录 `index.html` + Vercel `api/`）  
> **本文档版本**：2026-08-06 · COP31 youth-led action edition

---

## 0. 一句话目标

把现有「华北村级煤改 X 五回合沙盘」升级为 **Climate Adaptation Energy Advisor（气候适应家庭能源选择助手）**——用户在全球地图上点击自家位置 → 系统识别位置（**中国/美国精确到省或州**；**其余国家只识别到国家**）→ 载入对应气候数据（中美用省/州首府气候代表；其余国家用 Köppen 标准 profile）→ 用户补充家庭数据 → **规则引擎算出不同取暖/制冷方案的适配分** → **AI 用 plain language 解释分数、填补跨国技术信息差** → 生成可分享的个人行动摘要与匿名影响力数据。

**核心原则**：
- **分数由算法给，不由 AI 编造**（AI 只解释、翻译、对照，不凭空写补贴金额或 COP）。
- **Global-first**：COP 项目不能局限于中国北方农村；中国北方是第一个实证试点和故事起点，不是产品边界。
- **保留 V1** 作为 China pilot / evidence mode，用来展示已完成研究、用户数据和青年主导行动的真实性。
- **默认静态、低门槛**：无需注册即可试用；研究数据仍匿名入库（Supabase）。
- **公开页面不写 COP31**：网站面对普通用户时只呈现为气候适应与家庭能源选择工具，避免让人感觉是专门为某个征集项目包装出来的。COP31 只作为内部申报背景和材料准备目标。
- **申报友好**：网站必须能支撑案例材料：中英双语简介、青年主导说明、数据影响力、可下载材料、视频/截图证据。

### 0.1 COP31 申报定位

本项目要申报《青年驱动绿色未来 COP31 气候行动案例报告》的 **轨道 B：青年主导行动**。这是**内部申报定位**，不要直接写在 G0 用户首页。网站升级不只是做新功能，还要让评审和普通用户在 30 秒内看懂：

| 评审维度 | 网站上必须证明什么 |
|----------|--------------------|
| 青年领导力 | 由青年独立发起、设计、部署、招募用户、分析数据；CS 同学是协作开发，不改变青年主导属性 |
| 创新性 | 不是普通宣传页，而是「可交互政策沙盘 + 户级数据 + 算法评分 + AI 解释」 |
| 气候适应度 | 帮助家庭应对取暖/制冷成本、极端冷热、能源价格和技术选择风险 |
| 社群影响力 | 覆盖中国农户、学生、公众，并扩展到全球个体家庭；提供匿名数据看板 |
| 故事感染力 | 从中国北方清洁取暖真实问题出发，讲到全球公正转型和家庭气候行动 |
| 附加分 | 国际视野（多地区）、跨领域融合（环境×AI×教育×金融算账）、弱势群体包容（农村、低收入、偏远地区） |

---

## 1. 背景：为什么要升级

### 1.1 V1 已经做了什么

| 能力 | 说明 |
|------|------|
| 五回合交互 | 建档 → 散煤/转型 → 合规压力 → 选路线（气/地源/空气源热泵）→ 增收或节能 → 补贴退坡 → 终局 |
| 户级指标 | 年取暖费、年盈余、能耗负担率、合规度、排放达标度、CO₂ 吨数 |
| 身份分流 | 学生 / 已煤改农户 / 未煤改农户 / 其他；问卷与 AI prompt 不同 |
| AI debrief | 终局后 POST `/api/chat`，DeepSeek 根据 session log 生成三段 Markdown 解读 |
| 数据 | Supabase `simulation_sessions` 匿名 UUID |

算法与常数见：`algori_spec.md`、`research/data/calibration_defaults.json`。  
MVP 产品说明见：`spec.md`。

### 1.2 V2 要解决的问题（论文 Future directions + 讨论结论）

1. **从「中国试点」到「全球可迁移」**：现有数据来自华北农村，但 COP31 项目必须回答全球家庭如何面对取暖/制冷转型。
2. **从「村统筹」到「个体决策」**：欧美等地农户往往自己选系统，不像中国常见「一村推一条路」。
3. **从「只取暖」到「取暖 + 制冷」**：气候区不同，有的地区制冷负荷同样重要。
4. **跨国技术信息差**：国外用户可能不知道某条在中国已验证的路线其实适配其气候与预算；反之亦然。
5. **从「是否清洁取暖好」到「哪条路 fit 这个家庭、这个地方」**：与答辩结论 *No single best route; fit depends on the household* 一致。
6. **从「研究 demo」到「青年气候行动案例」**：网站要能展示行动过程、数据影响力、跨地区扩展计划和可传播故事。

### 1.3 V2 不做什么（第一版明确排除）

- 不做真实工程 CAD / 管线设计、不做施工报价合同。
- 不接智能电表/气表实时数据（可留接口占位）。
- 不做完整多智能体博弈（政府/企业/农户同时操作）——可 Phase 3。
- 不让 LLM 单独输出「最终该买哪台设备型号」——只到**路径级别**（如 air-source heat pump vs gas boiler）。

---

## 2. 目标用户与使用场景

| 用户 | 场景 | 语言 |
|------|------|------|
| 全球个体家庭 / 农户 / 郊区房主 | V2「Climate Adaptation Energy Advisor」：点击地图定位，输入家庭数据，比较取暖/制冷路径 | **英文 UI 为主**，关键术语可双语 |
| 中国华北农户 / 学生 / 公众 | 「China Pilot」：继续体验现有五回合沙盘，作为实证试点与中文入口 | 中文为主 |
| COP31 评审 / 媒体 / 合作方 | 查看青年主导故事、影响力数据、演示视频、one-pager、案例摘要 | 中英双语 |
| 政策/研究访客 | 对比多方案分数、下载匿名数据摘要、了解算法与 AI 边界 | 英文 + 中文摘要 |

**典型用户故事（Global mode）**  
> Maria 在美国中西部有一栋 120 m² 的农舍，冬季用丙烷、夏季 window AC。她听说热泵在中国北方用得很多，但不知道是否适合本地 −20°C。她打开网站，选 United States → Midwest，输入收入与账单，得到 6 条路径的适配分排序，并看到 AI 解释「为何 air-source HP 分数中等、为何 geothermal 分数高但 upfront 高」。

---

## 3. 产品形态：Global-first 入口 + China pilot 证据

首页改成 **Global-first landing**。第一屏主 CTA 必须进入 Climate Adaptation Energy Advisor；China Pilot 作为「已有试点证据」入口放在第二 CTA 或导航里，不再与全球工具平级抢主叙事。

```
┌─────────────────────────────────────────────────────────┐
│  Climate Adaptation Energy Advisor                        │
│  气候适应家庭能源选择助手                                  │
│  Find a heating and cooling path that fits your home,      │
│  your local climate, and your budget.                     │
│                                                          │
│  [ Start from map ]   [ View China pilot ]                │
│                                                          │
│  Impact: 28 valid sessions · +1.50 understanding gain    │
│  China pilot → global household energy advisor            │
└──────────────────────────────────────────────────────────┘
```

| 页面/模式 | 路由建议 | 说明 |
|-----------|----------|------|
| Climate Adaptation Energy Advisor | `/` 或 `/global` | **主入口**：面向国际用户的全球取暖/制冷适配工具 |
| China Pilot Sandbox | `/china` | 现有 `index.html` 流程，作为中文试点和已验证案例 |
| Impact & Evidence | `/impact` | 匿名数据、前后测、推荐率、用户反馈、截图/视频 |
| Youth-led Story | `/about` | 青年主导、项目时间线、团队角色、项目愿景（公开页面不写 COP31） |
| Media Kit | `/media` | 中英 one-pager、logo、演示视频、案例材料下载 |

---

## 4. Global mode 用户流程（逐步）

```
Global Landing → Click home location on climate map → Household form
    → Home feasibility questionnaire → [Screen paths] → Results table + radar → AI explanation panel
    → Shareable action summary → [Optional] Mini-sandbox (3 turns)
    → Survey / thanks

Parallel evidence pages:
Impact dashboard → Youth-led story → Media kit / case materials
```

| 步骤 | 页面 ID | 目的 |
|------|---------|------|
| G0 | `global-landing` | 全球价值主张 + 气候适应家庭能源选择定位 + 免责声明（公开文案不写 COP31） |
| G1 | `global-climate-map` | 用户在可缩放全球地图上点击自家位置 → **中国/美国识别到省或州并载入该省/州首府气候**；**其余国家只识别到国家并用 Köppen 标准 profile** |
| G2 | `global-household` | 家庭与建筑、账单 |
| G3 | `global-home-feasibility` | 不超过 8 个住宅可行性问题，供后台自动筛选候选路径 |
| G4 | `global-results` | 适配分排序 + 雷达 + 硬约束剔除说明 |
| G5 | `global-ai` | AI 解读（RAG，引用分数卡） |
| G6 | `global-action-summary` | 生成可分享的个人行动摘要卡片（支持下载 PNG/PDF） |
| G7 | `global-mini-sandbox` | 可选，3 回合简化推演 top 路径 |
| G8 | `global-feedback` | 短问卷 + 是否愿意推荐 |

| 申报/传播页面 | 页面 ID | 目的 |
|----------------|---------|------|
| Impact Dashboard | `impact` | 展示匿名使用数据、理解提升、推荐率、地区覆盖、媒体/活动记录 |
| Youth-led Story | `about` | 讲清青年主导、项目缘起、时间线、团队角色、行动愿景 |
| Media Kit | `media` | 下载中英 one-pager、申报摘要、demo 视频、截图、数据报告 |
| China Pilot | `china` | 保留现有中国北方五回合沙盘，作为已验证的第一阶段案例 |

---

## 5. 界面说明与界面文案（Bilingual UI copy）

> 以下英文/中文文案可直接进前端；正式实现必须由 i18n 字典驱动。

### G0 · Landing

**Layout**
- 顶栏：Logo + `China Pilot` / `Impact` / `About` / `Media Kit` + **Language selector（English / 中文）**
- Hero：公开品牌名 + 中文副名 + 副标题 + 主按钮
- 三列价值点 + 影响力数字条 + 底部 disclaimer
- 用户在首页选择语言后，后续 G1–G8 以及 `/impact`、`/about`、`/media` 的所有文字信息都使用对应语言。

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Language label | Language |
| Language option EN | English |
| Language option ZH | 中文 |
| Title | **Climate Adaptation Energy Advisor** |
| Chinese title | **气候适应家庭能源选择助手** |
| Eyebrow | **Household energy choices for a changing climate** |
| Subtitle | Click your home on the climate map, compare heating and cooling paths, and see what fits your local climate and budget. |
| Primary CTA | **Start from the map — about 3 minutes** |
| Secondary CTA | **View China Pilot Evidence** |
| Bullet 1 title | Household-first |
| Bullet 1 body | Enter income, home size, and energy bills. See what fits you. |
| Bullet 2 title | Scores you can trace |
| Bullet 2 body | Each path gets a fitness score from clear rules—not AI guesswork. |
| Bullet 3 title | Plain-language guide |
| Bullet 3 body | AI explains trade-offs and technologies you may not know in your country. |
| Impact strip | China pilot: 28 valid sessions · 21 completed surveys · +1.50 understanding gain |
| Disclaimer | *Decision support only. Not engineering design, installation quote, or legal advice. Local installers must confirm sizing and safety.* |
| Footer | Anonymous · No account required · ~3 min |

**中文 Copy（G0 必须提供）**

| 元素 | 中文文案 |
|------|----------|
| Language label | 语言 |
| Language option EN | English |
| Language option ZH | 中文 |
| Title | **气候适应家庭能源选择助手** |
| English title | **Climate Adaptation Energy Advisor** |
| Eyebrow | **面向气候变化的家庭能源选择** |
| Subtitle | 在气候地图上点击你家的大致位置，比较取暖和制冷方案，看看哪些更适合当地气候和家庭预算。 |
| Primary CTA | **从地图开始，约 3 分钟** |
| Secondary CTA | **查看中国试点证据** |
| Bullet 1 title | 以家庭为中心 |
| Bullet 1 body | 输入收入、住房面积和能源账单，查看适合你的方案。 |
| Bullet 2 title | 分数可追溯 |
| Bullet 2 body | 每条路径都由清晰规则打分，不是 AI 猜测。 |
| Bullet 3 title | 通俗解释 |
| Bullet 3 body | AI 会用易懂语言解释取舍，也补充你所在国家可能不熟悉的技术信息。 |
| Impact strip | 中国试点：28 个有效会话 · 21 份完成问卷 · 理解提升 +1.50 |
| Disclaimer | *本工具仅作决策参考，不是工程设计、安装报价或法律建议。设备选型、安全与合规需由当地安装人员确认。* |
| Footer | 匿名 · 无需账号 · 约 3 分钟 |

**Language behavior（必须实现）**

- 首页右上角提供语言选项：`English` / `中文`。
- 语言选择写入 `localStorage.locale`，并可同步到 URL query（如 `?lang=zh` / `?lang=en`）方便分享。
- 默认语言：若浏览器语言以 `zh` 开头则默认中文，否则默认英文；用户手动选择后以用户选择为准。
- 语言选择后，全流程所有 UI 文案、按钮、表单提示、验证错误、结果页说明、AI explanation 请求的 `locale` 都使用对应语言。
- 文案来源必须走 i18n 字典：`i18n/en.json` 与 `i18n/zh.json`。不要在组件里硬编码英文或中文。

**禁止出现在 G0 的公开文案**
- `COP31`
- `case collection`
- `application`
- `申报`
- `征集`
- 任何让用户觉得“这个网站是为了某个活动临时包装”的表述

---

### G1 · Climate map location picker

**产品规则（简化后，必须实现）**

| 点击国家 | 地图识别精度 | 气候数据怎么取 |
|----------|--------------|----------------|
| **中国 `CHN`** | 精确到 **省 / 直辖市 / 自治区**（Admin-1） | 用该省/市/区的 **首府（省会）** 月均温、月降水代表全省 |
| **美国 `USA`** | 精确到 **州**（Admin-1） | 用该州的 **首府（state capital）** 月均温、月降水代表全州 |
| **其余各国** | 只识别到 **国家**（Admin-0），不识别省/州 | 查询点击点的 Köppen 代码，用对应 **标准 profile**；全国任意选点共用同一套 profile 逻辑 |

> 不要再做「按省/州 polygon 对 WorldClim 做 zonal mean」这类复杂 GIS 聚合。中美只收 **首府点气候**；其余国家只走 **Köppen 标准 profile**。

**Layout**
- Step indicator: `1 of 4 · Your climate`
- 主体为可缩放全球地图：用户**不填写国家/地区**，而是在地图上点击自家大致位置。
- **前台地图不要染色**：用户看到的是普通地图（地形/行政区/城市），不要把整张地图铺成彩色气候区。
- 已下载资源 `docs/global-climate-zones-koppen-source.svg` 只作为资料参考、后台 Köppen 分类对照，不作为前台主地图视觉。
- 交互实现优先级：
  1. **推荐方案**：Mapbox GL JS / Leaflet + OpenStreetMap 普通底图；点击后按下方「两档识别」查气候。
  2. **可选方案**：Google Maps JavaScript API 普通底图 + 后台气候查询。
  3. **离线 fallback**：普通世界地图 + 经纬度近似（只用于 demo）。
- 地图缩放要求：
  - 世界级：显示国家边界和大城市，不显示气候区染色。
  - 进入 **中国 / 美国**：显示国界 + **省/州界**，便于用户点到正确省/州。
  - 进入 **其他国家**：只强调国界即可，**不必**加载该国省/州界做识别。
  - 城市点位：中国可显示地级市及以上；美国可显示主要城市；其余国家可只显示首都/主要城市作定位辅助（不用于气候代表，除非该国走标准 profile）。
- 用户点击后，右侧卡片显示：
  - `Country`（必有）
  - `Province / State`：**仅中国、美国显示**；其余国家隐藏或显示 `—`
  - `Capital used for climate`：**仅中国、美国显示**（如「河北 · 石家庄」「Illinois · Springfield」）
  - `Climate zone`（Köppen code + 短名）
  - `Data resolution`：`Province/state capital` / `Köppen standard profile` / `Köppen main-group fallback`
- 右侧卡片同时显示气候图：
  - **柱状图**：Monthly precipitation (mm)
  - **折线图**：Monthly mean temperature (°C)
- 确认后进入 G2。

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Heading | **Click your home area on the climate map** |
| Hint | In China and the US, we match your province or state and use the capital city’s climate. In other countries, we identify the country and use a standard climate-zone profile. |
| Map helper | Zoom in on China or the US to pick a province or state. Elsewhere, a country-level click is enough. |
| Climate card title | Local climate snapshot |
| Fields (CN/US) | Country · Province/State · Capital used for climate · Climate zone · Monthly precipitation · Monthly mean temperature |
| Fields (other) | Country · Climate zone · Monthly precipitation · Monthly mean temperature |
| Button | **Continue** |

**地图与地理识别要求**

| 需求 | 实现建议 |
|------|----------|
| 所有国家：识别国家 | Natural Earth Admin 0 或 geoBoundaries / GADM Admin 0 |
| **仅中国、美国**：识别省/州 | Natural Earth Admin 1 或 geoBoundaries / GADM Admin 1（**只加载 CHN + USA 的 Admin-1**） |
| 其余国家：不识别省/州 | 点击后 `admin1_name = null`；UI 不展示 Province/State |
| 气候区识别 | 后台用 Köppen-Geiger 1991–2020 GeoTIFF / raster 或点查 API；前台只显示结果 |
| 中美月气候 | 查该省/州 **首府经纬度** 的月均温、月降水（点查即可，不做省域 zonal mean） |
| 其余国家月气候 | 用点击点的 `koppen_code` 查 `climate_profiles.json` 标准 profile |

**已放入仓库的地图素材**

| 文件 | 用途 | 来源 |
|------|------|------|
| `docs/global-climate-zones-koppen-source.svg` | 气候区资料参考、标准 profile 分类对照；**不作为前台染色底图** | Wikimedia Commons, World Köppen Classification (with authors).svg |

> 正式交互地图不要只靠这张 SVG。前台用普通底图；识别与气候赋值在后台完成。

**数据覆盖策略（替代旧「首发 5 个 region」）**

| 层级 | 覆盖 | 气候数据文件 |
|------|------|--------------|
| 中国各省/直辖市/自治区 | 每个 Admin-1 一条 | `docs/data/climate/cn_us_admin1_capitals.json` |
| 美国各州（含 DC 可选） | 每个 Admin-1 一条 | 同上 |
| 全球其余国家 | 不按省建库 | `docs/data/climate/climate_profiles.json`（Köppen 标准 profile） |
| 可选能源/政策样例 | 仍可用少量 `regions/*.json` 做价格与基础设施 override | `docs/data/regions/`（非 G1 必选气候源） |

### G1 气候数据收集与判断流程（必须写进开发任务）

#### Step 1 · 中国、美国：收集各省/州「首府点」气候

目标：**只收首府城市的点气候**，用它代表该省/州。不要做全省/州栅格平均。

每个中美 Admin-1 记录至少包含：

| 字段 | 说明 |
|------|------|
| `country_iso3` | `CHN` 或 `USA` |
| `admin1_name` | 省/州名称（中英可各存一份） |
| `admin1_code` | 可选，Natural Earth / GADM 编码 |
| `capital_name` | 首府名称，如 `Shijiazhuang`、`Springfield` |
| `capital_lat` / `capital_lon` | 首府坐标 |
| `temperature_c_monthly` | 首府 1–12 月月均温 (°C) |
| `precipitation_mm_monthly` | 首府 1–12 月月降水 (mm) |
| `koppen_code` | 首府点（或该省代表）的 Köppen 细分类 |
| `data_resolution` | 固定为 `"admin1_capital"` |
| `data_source` | URL / 方法说明 |

推荐做法（简单版）：

1. 整理中国各省会 + 美国各州首府名单与经纬度（可来自 Natural Earth / 公开首都表）。
2. 对每个首府点查月均温、月降水：优先 **Climate-Data.org / Meteostat / NASA POWER / WorldClim 点提取**（任选一种可复现方法）。
3. 输出为 `docs/data/climate/cn_us_admin1_capitals.json`。
4. **禁止**为 MVP 做 Admin-1 polygon × WorldClim zonal mean。

#### Step 2 · 其余国家：只用 Köppen 标准 profile

目标：全球其余国家点击后 **只认国家 + 气候区**，气候曲线来自标准 profile，不建该国省/州表。

1. 维护约 30 个 Köppen 细分类的 `docs/data/climate/climate_profiles.json`（见 Step 3）。
2. 用户在非中美国家点击时：识别 `country_iso3` → 查点击点 `koppen_code` → 取 profile。
3. 同一国家内不同点击点：若 Köppen 不同，可用不同 profile（仍是标准 profile，不是省数据）；若查不到细分类，回退到主类 `A/B/C/D/E`。

#### Step 3 · 点击地图后如何确定用户气候信息

```text
click(lat, lon)
  → spatial join Admin-0 → country_iso3

  if country_iso3 in {CHN, USA}:
      spatial join Admin-1 (CN/US only) → admin1_name
      lookup cn_us_admin1_capitals[country_iso3][admin1_name]
      use capital monthly temperature + precipitation
      data_resolution = "admin1_capital"
      show Province/State + Capital used for climate

  else:
      admin1_name = null
      query Köppen at (lat, lon) → koppen_code
      lookup climate_profiles[koppen_code]
          if found:
            data_resolution = "koppen_standard_profile"
          else:
            use climate_profiles[koppen_main_group]  // A/B/C/D/E
            data_resolution = "koppen_main_group_fallback"
      hide Province/State (or show —)

  → render climate chart:
      bar = monthly precipitation
      line = monthly mean temperature
```

页面展示时写清楚数据精度：

- 中国/美国：`Data source: Province/state capital climate (representative)`
- 其余国家：`Data source: Köppen standard profile`
- 缺细分类时：`Data source: Major climate-group fallback`

#### Step 4 · 标准 Köppen profile 清单

SVG / Köppen-Geiger 常见细分类约 30 个，开发时至少覆盖：

```text
Af, Am, Aw,
BWh, BWk, BSh, BSk,
Csa, Csb, Csc, Cwa, Cwb, Cwc, Cfa, Cfb, Cfc,
Dsa, Dsb, Dsc, Dsd, Dwa, Dwb, Dwc, Dwd, Dfa, Dfb, Dfc, Dfd,
ET, EF
```

每个代码在 `docs/data/climate/climate_profiles.json` 中提供：

- `temperature_c_monthly`
- `precipitation_mm_monthly`
- `representative_locations` + `source_urls`（审计用）

如何准备标准 profile（保持轻量）：

1. 每个 Köppen code 选 1–3 个代表城市。
2. 用 Climate-Data.org / Meteostat / NASA POWER / WorldClim 点查其月均温、月降水。
3. 代表点取平均（或直接采用最典型一个城市）写入 JSON。

示例：

| Köppen code | 气候说明 | 代表点示例 | 数据来源建议 |
|-------------|----------|------------|--------------|
| `Af` | Tropical rainforest | Singapore, Manaus | Climate-Data.org / Meteostat |
| `BWh` | Hot desert | Cairo, Riyadh | Climate-Data.org |
| `Cfa` | Humid subtropical | Shanghai, Atlanta | Meteostat |
| `Cfb` | Oceanic | London, Wellington | Meteostat |
| `Dwa` | Monsoon-influenced humid continental | Beijing, Seoul | Meteostat |
| `Dfb` | Warm-summer humid continental | Warsaw, Moscow | Meteostat |
| `ET` | Tundra | Nuuk | NASA POWER / WorldClim point |

**一句话总结**：中美点到省/州 → 用该省/州**首府气候**；其他国家点到国 → 用该点 **Köppen 标准 profile**。

#### 推荐数据网址 / 方法

| 用途 | 推荐来源 | URL / 方法 |
|------|----------|------------|
| 中美首府名单与坐标 | Natural Earth Populated Places / 公开省会表 | https://www.naturalearthdata.com/downloads/10m-cultural-vectors/ |
| 首府 / 代表点月气候 | Meteostat / Climate-Data.org / NASA POWER | 按点查询，写入 JSON |
| 可选：WorldClim 点提取 | WorldClim 2.1 | https://worldclim.org/data/worldclim21.html （仅点提取，不做 zonal mean） |
| Köppen 分类 | GloH2O Köppen-Geiger / Beck et al. | https://www.gloh2o.org/koppen |
| 国界 | Natural Earth Admin 0 / geoBoundaries | https://www.naturalearthdata.com/ |
| 中美省/州界 | Natural Earth Admin 1（过滤 CHN、USA） | 同上 |
| 其余国家省界 | **不加载、不识别** | — |

**`docs/data/climate/cn_us_admin1_capitals.json` schema（示例）**

```json
{
  "CHN": {
    "Hebei": {
      "admin1_name_zh": "河北",
      "capital_name": "Shijiazhuang",
      "capital_name_zh": "石家庄",
      "capital_lat": 38.04,
      "capital_lon": 114.51,
      "koppen_code": "Dwa",
      "data_resolution": "admin1_capital",
      "temperature_c_monthly": [-2, 1, 8, 16, 22, 26, 28, 26, 22, 15, 7, 0],
      "precipitation_mm_monthly": [3, 7, 11, 22, 38, 70, 140, 140, 55, 25, 12, 4],
      "data_source": "Meteostat / Climate-Data.org; capital point representative"
    }
  },
  "USA": {
    "Illinois": {
      "capital_name": "Springfield",
      "capital_lat": 39.78,
      "capital_lon": -89.65,
      "koppen_code": "Dfa",
      "data_resolution": "admin1_capital",
      "temperature_c_monthly": [-3, 0, 6, 12, 18, 23, 25, 24, 20, 13, 6, -1],
      "precipitation_mm_monthly": [45, 45, 70, 90, 110, 110, 95, 85, 80, 75, 70, 55],
      "data_source": "Meteostat; state capital point representative"
    }
  }
}
```

**`docs/data/climate/climate_profiles.json` schema（其余国家用）**

```json
{
  "Dwa": {
    "display_name_en": "Monsoon-influenced hot-summer humid continental climate",
    "display_name_zh": "季风影响的夏热湿润大陆性气候",
    "koppen_code": "Dwa",
    "fallback_level": "koppen_subtype",
    "source": "Representative city average for non-CN/US clicks",
    "representative_locations": ["Beijing", "Seoul", "Shenyang"],
    "source_urls": ["https://meteostat.net/"],
    "temperature_c_monthly": [-4, -1, 5, 12, 18, 23, 26, 25, 20, 13, 6, -1],
    "precipitation_mm_monthly": [8, 10, 20, 35, 55, 80, 160, 140, 55, 30, 18, 8],
    "notes": "Used when country is not China or the United States."
  }
}
```

---

### G2 · Household form

**Layout**
- Step: `2 of 4 · Your home`
- 两列表单 + 右侧「Help」折叠说明
- **金钱字段行**：左侧金额输入，右侧紧挨 **货币选择器**（同一行）

**金钱字段 UI（金额 + 货币）**

```
┌─────────────────────────────┬──────────────┐
│  Annual household income    │              │
│  [ 45000              ]     │ [ CNY ▾ ]    │
└─────────────────────────────┴──────────────┘
```

- 凡涉及金钱的输入（`annual_income`、`heating_spend_annual`、`cooling_spend_annual`）均采用「金额 + 右侧货币」布局。
- 全表单共用一个 `currency`（ISO 4217 代码）；任一金钱行改币种，其余金钱行同步更新。
- 货币列表：**世界上全部流通法定货币**，以 **ISO 4217 active codes** 为数据源（约 150+ 种），含常用与少用币种；选项展示为 `CODE — Name`（如 `CNY — Chinese Yuan`、`USD — US Dollar`），支持按代码/名称搜索过滤。
- 默认值：优先用 G1 推断国家的官方货币（来自 `region.currency` / country→currency 表）；若无法推断则默认 `USD`。用户可随时改。
- 实现建议：内置完整 ISO 4217 静态表（或 `currency-codes` / CLDR 包），不要只列「热门货币」。

**Fields（必填 / 选填）**

| field_key | UI label (EN) | Type | Required | 说明 |
|-----------|---------------|------|----------|------|
| `household_size` | People in home | number | yes | 默认 4 |
| `currency` | Currency（各金钱行右侧） | select: ISO 4217 全量 | yes | 整户共用；金额字段右侧选择；完整世界货币列表 |
| `annual_income` | Annual household income | number + currency | yes | 整户收入；用它判断收入水平与负担率；金额单位 = `currency` |
| `floor_area_m2` | Total floor area (m²) | number | yes | 整屋总建筑面积 |
| `building_age` | Building age | select: `<1970`, `1970–1990`, `1990–2010`, `2010+` | no | 影响保温假设 |
| `insulation_level` | Insulation | select: Poor / Average / Good | no | 默认 Average |
| `needs_heating` | Need winter heating? | yes/no | yes | 控制 G3 是否出现 **Heating options**；若选 yes，再显示 heating spend |
| `heating_spend_annual` | Last winter heating spend | number + currency | if heating=yes | 仅当 `needs_heating=yes`；单位 = 共用 `currency` |
| `needs_cooling` | Need summer cooling? | yes/no | yes | 控制 G3 是否出现 **Cooling options**；若选 yes，再显示 cooling spend |
| `cooling_spend_annual` | Last summer cooling spend | number + currency | if cooling=yes | 仅当 `needs_cooling=yes`；单位 = 共用 `currency` |

**条件显示逻辑**

```text
if needs_heating == yes:
  show heating_spend_annual (required) + shared currency selector
else:
  hide heating_spend_annual
  treat heating demand as low / none for scoring

if needs_cooling == yes:
  show cooling_spend_annual (required) + shared currency selector
else:
  hide cooling_spend_annual

# G2 → G3 联动（必须实现）
if needs_heating == yes:
  show G3 Heating options group
else:
  hide G3 Heating options group entirely

if needs_cooling == yes:
  show G3 Cooling options group
else:
  hide G3 Cooling options group entirely
```

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Heading | **Tell us about this household** |
| Hint | Use whole-house numbers. Approximate bills are OK. Pick your currency next to each money field. |
| Income help | Count all earners in the home for one year—not per person unless we ask. Income is used to estimate affordability. |
| Currency help | Choose the currency for income and energy bills. All world currencies are listed (ISO 4217). Search by code or name. |
| Currency placeholder | Search currency… |
| Floor area help | Enter the total floor area of the home in square meters. |
| Button back | Back |
| Button next | **Continue** |

---

### G3 · Home feasibility（住宅可行性问卷）

**目的**

G3 不再展示未来候选技术列表，也不让用户判断技术是否合法或是否适合当地。它只收集普通住户容易回答、且能帮助后台确定性筛选的信息。

```text
G1 地区和气候数据
+ G2 家庭及住宅基础数据
+ G3 不超过 8 个简单问题
→ 后台载入全部技术和路径
→ 后台执行确定性可行性筛选
→ 通过筛选的路径进入 G4
→ G4 进行五维打分和排序
```

G3 禁止出现：未来候选技术列表、推荐技术卡片、技术全选按钮、逐项允许/禁止状态、要求用户自己判断法律规定的文案。

**Layout**
- Step: `3 of 4 · About your home`
- 英文标题：**A few practical questions about your home**
- 英文说明：Answer what you know. “Not sure” is always fine. We will use your answers, your current heating and cooling setup, local climate data, and regional information to screen possible paths.
- 中文标题：**几个关于住宅实际情况的问题**
- 中文说明：请根据你了解的情况回答；不确定时可以直接选择“不确定”。系统会结合住宅当前的取暖和制冷方式、当地气候及地区数据，自动筛选可能适用的路径。
- 推荐分组：`Your home` / `Current setup` / `Practical preferences`
- 基础问题始终显示：Q1、Q2、Q3、Q4、Q5、Q8。
- `needs_heating=true` 时显示 Q6；`needs_cooling=true` 时显示 Q7。
- 两者都不需要时，可跳过 G3 或显示确认信息。
- 所有显示问题均必答；用户可选择 `Not sure`。

**问题数量**

| G2 状态 | G3 问题数量 |
|---------|------------:|
| 只需要取暖 | 7 |
| 只需要制冷 | 7 |
| 同时需要取暖和制冷 | 8 |
| 两者都不需要 | 可跳过 G3，或显示确认信息 |

**问题清单**

| # | field | EN question | 中文问题 | Type |
|---|-------|-------------|----------|------|
| Q1 | `housing_status` | What best describes your housing situation? | 以下哪项最符合你的居住情况？ | radio cards |
| Q2 | `building_type` | What type of home is this? | 这是一套什么类型的住宅？ | radio cards |
| Q3 | `renovation_tolerance` | How much installation work would you consider? | 你可以接受多大程度的安装或改造？ | radio cards |
| Q4 | `outdoor_space` | What outdoor space is available around the home? | 住宅周围有多少可使用的室外空间？ | radio cards |
| Q5 | `current_energy_services` | Which energy services or bills does this home currently have? | 这套住宅目前有哪些能源供应或能源账单？ | checkbox cards |
| Q6 | `current_heating_methods` | How does this home currently stay warm? | 这套住宅目前主要使用哪些方式取暖？ | checkbox cards, only if `needs_heating` |
| Q7 | `current_cooling_methods` | How does this home currently stay cool? | 这套住宅目前主要使用哪些方式降温？ | checkbox cards, only if `needs_cooling` |
| Q8 | `upfront_cost_preference` | How would you approach upfront cost? | 你对前期投入的接受程度如何？ | radio cards |

**关键选项与规则**

- Q1 `housing_status`: `owner`, `renter_permission`, `renter_no_permission`, `renter_not_sure`, `other`。`renter_no_permission` 可排除必须永久施工的路径；`renter_not_sure` 不硬排除，只添加确认提示。
- Q2 `building_type`: `detached`, `semi_detached_or_row`, `apartment`, `mobile_or_temporary`, `other`, `not_sure`。`apartment` 不自动排除所有室外设备，必须结合 Q1、Q4 和地区数据判断。
- Q3 `renovation_tolerance`: `none`, `minor`, `moderate`, `major`, `not_sure`。等级为 `none < minor < moderate < major`；`not_sure` 保留全部路径，并给 moderate/major 添加确认提示。
- Q4 `outdoor_space`: `none`, `wall_or_balcony`, `small_yard_or_roof`, `large_private_land`, `not_sure`。明确空间不足时可以硬排除；`not_sure` 不硬排除。
- Q5 `current_energy_services`: `electricity`, `piped_gas`, `delivered_fuel`, `solid_fuel`, `district_energy`, `none`, `not_sure`。`none` / `not_sure` 与其他选项互斥；当前能源服务不能直接决定未来候选路径。
- Q6 `current_heating_methods`: `heat_pump`, `electric_heating`, `piped_gas_heating`, `delivered_fuel_heating`, `solid_fuel_heating`, `district_or_shared_heating`, `passive_or_solar_heating`, `no_current_heating`, `not_sure`。`no_current_heating` / `not_sure` 与其他选项互斥；只作为 baseline。
- Q7 `current_cooling_methods`: `room_air_conditioning`, `central_air_conditioning`, `heat_pump_cooling`, `evaporative_or_water_cooling`, `fans`, `natural_or_passive_cooling`, `district_or_shared_cooling`, `no_current_cooling`, `not_sure`。`fans` 与 `natural_or_passive_cooling` 不可视为完整机械制冷能力。
- Q8 `upfront_cost_preference`: `minimum_upfront`, `moderate_investment`, `higher_if_saves_later`, `not_sure`。不得作为 G3 硬排除，只影响 G4 affordability、初装成本 penalty、生命周期费用权重和融资/补贴提示。

**数据结构**

```ts
interface HomeFeasibilityProfile {
  housing_status: "owner" | "renter_permission" | "renter_no_permission" | "renter_not_sure" | "other";
  building_type: "detached" | "semi_detached_or_row" | "apartment" | "mobile_or_temporary" | "other" | "not_sure";
  renovation_tolerance: "none" | "minor" | "moderate" | "major" | "not_sure";
  outdoor_space: "none" | "wall_or_balcony" | "small_yard_or_roof" | "large_private_land" | "not_sure";
  current_energy_services: CurrentEnergyService[];
  current_heating_methods: CurrentHeatingMethod[];
  current_cooling_methods: CurrentCoolingMethod[];
  upfront_cost_preference: "minimum_upfront" | "moderate_investment" | "higher_if_saves_later" | "not_sure";
}
```

当不需要取暖时：`current_heating_methods = []`。当不需要制冷时：`current_cooling_methods = []`。

新 Global session 保存 `home_feasibility_json`；停止写入 `allowed_options_json`、`allowed_heating_options`、`allowed_cooling_options`。历史 session 可保留旧字段读取能力，但新流程不得依赖旧字段。

**验证与按钮**

```ts
validateHomeFeasibility(profile, needsHeating, needsCooling)
```

- Q1–Q5 和 Q8 必须有值。
- `current_energy_services` 至少选择一项。
- `needs_heating=true` 时 Q6 至少选择一项。
- `needs_cooling=true` 时 Q7 至少选择一项。
- `none`、`not_sure`、`no_current_heating`、`no_current_cooling` 等特殊选项保持互斥。
- 英文错误：Please answer each question. Choose “Not sure” whenever you do not know.
- 中文错误：请回答每个问题；不了解时可以选择“不确定”。
- 按钮：`Back` / `Find possible paths`；中文：`返回` / `筛选可行路径`。
- 提交后显示：`Checking possible paths for your home…`；中文：`正在筛选适合这套住宅的路径……`。

---

### G4 · Results（核心页）

**候选路径范围（与 G3 联动）**

G4 的候选路径来自后台完整技术目录筛选，而不是 G3 勾选列表。G3 当前取暖/制冷方式只用于 baseline，不得复制为未来候选路径白名单。

```text
const baseline = buildBaselineProfile(household, homeFeasibility, region)
const screeningResult = screenTechnologies(region, climate, household, homeFeasibility, allTechnologies)
const candidatePaths = generateCandidatePaths(screeningResult.passed, baseline, region, climate, household)
const rankedPaths = scoreAndSort(candidatePaths, baseline, household, region, climate)
```

- 后台默认载入全部技术目录，并按 G1/G2/G3 数据确定性筛选。
- 通过筛选的技术生成完整候选路径进入 G4。
- 明确不可能的技术进入 G4 `Excluded` 区块。
- 信息不足时不得直接排除，应保留并标记 `Needs local confirmation`、`Preliminary result` 或 `Data uncertain`。
- `eligible_with_warning` 路径仍进入 G4 ranking。
- G4 可显示 `Your current setup`，例如 `Current heating: Delivered-fuel heating`、`Current cooling: Room air conditioner + fans`。
- baseline 不自动作为推荐路径；只有算法生成“保留现有系统 + 改善措施”时才进入正式排名。

**Layout（桌面）**

```
┌──────────────────────────────────────────────────────────────────┐
│  Your path ranking                          [ Adjust inputs ]    │
├───────────────────────────────┬──────────────────────────────────┤
│  Ranked table (sortable)      │  Radar chart (top 3 paths)       │
│  #1 Air-source HP   82        │       Cost                       │
│  #2 Insulation+HP   78      │          \                       │
│  #3 Gas boiler      61      │   Simple —●— Carbon              │
│  ...                          │          /                       │
│  [ excluded: ... ]            │       Comfort                    │
├───────────────────────────────┴──────────────────────────────────┤
│  Dimension breakdown for selected row (5 bars)                     │
│  ⚠ Hard rules: excluded paths listed with reason                  │
└──────────────────────────────────────────────────────────────────┘
│  [ Get AI explanation ]   [ Try mini-sandbox with #1 ]             │
└──────────────────────────────────────────────────────────────────┘
```

**Table columns（EN headers）**

| Column | 说明 |
|--------|------|
| Rank | 1…N；通过后台筛选并完成五维打分的候选路径 |
| Path | 技术路径显示名 |
| Fitness | 0–100 综合分（一位小数） |
| Upfront | 初装成本区间 |
| Run cost | 年运行费估算 |
| Burden | 能耗负担率 % |
| Carbon | 相对减排或 kg CO₂e/yr |
| Status | OK / Excluded |

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Heading | **Paths ranked for your home** |
| Subheading | We screened the full technology catalog using your home profile and local data. |
| Current setup title | Your current setup |
| Excluded section title | Not feasible for your place |
| Excluded reason examples | No gas grid in region · Permanent work not allowed · Insufficient outdoor space |
| Empty state | No path passed hard checks. Try adjusting household details or mark unknown answers as Not sure. |
| CTA AI | **Explain these results** |
| CTA sandbox | **Try a 3-step preview of #1** |

---

### G5 · AI explanation

**Layout**
- 左侧：只读「Score card」JSON 摘要（用户可见的简化版）
- 右侧：流式 Markdown 回答
- 底部：Suggested questions chips

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Heading | **Plain-language guide** |
| Subheading | AI explains your scores using the same numbers on the left. It does not change your ranking. |
| Loading | Reading your home profile and path scores… |
| Error | AI explanation is unavailable. Your numeric scores are still valid. |
| Chips | Why is #1 ahead of #2? · Would this work in my climate? · What is air-source heat pump? · What should I ask a local installer? |

**AI 输出结构（必须强制，类似现有 `/api/chat` 三段式）**

```markdown
## Summary
One sentence: best-fit path and why.

## Compare your top paths
- **Path A vs B:** …
- **Cost:** …
- **Climate fit:** …

## What you may not know
Cross-region technology notes (only from retrieved tech cards).

## Next steps
- Ask a local installer about …
- Check subsidy program … (only if in region JSON)
```

---

### G6 · Action summary（可分享）

**目的**：COP31 项目需要可传播、可截图、可作为「行动证据」的输出。用户完成评分和 AI 解释后，生成一张个人行动摘要卡片。

**Layout**
- 左侧：摘要卡片预览（适合手机截图）
- 右侧：按钮 `Download PNG` / `Download PDF` / `Copy summary text`
- 底部：匿名免责声明

**Card fields**

| 字段 | 英文文案 |
|------|----------|
| Title | **My home energy path summary** |
| Region | Region: `{region_label}` |
| Top path | Best-fit path: `{path_name}` |
| Fitness | Fitness score: `{score}/100` |
| Why | Why it fits: `{one_sentence_reason}` |
| Climate action | Potential benefit: lower burden / lower emissions / better comfort |
| Footer | Generated by Climate Adaptation Energy Advisor |

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Heading | **Save your action summary** |
| Hint | This summary helps you discuss options with family, community groups, or local installers. |
| CTA PNG | **Download share card** |
| CTA Text | **Copy plain text summary** |

---

### G7 · Mini-sandbox（可选）

简化 V1：**3 turns**，不做合规执法概率。

| Turn | 内容 |
|------|------|
| 1 | 确认/切换路径（默认 top-1） |
| 2 | 选一项：提高收入 / 降低用能 / 加强保温 |
| 3 | 价格或补贴冲击 → 终局 |

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Title | **Quick preview: one path** |
| Hint | This is a simplified simulation—not a contract or quote. |

---

### G8 · Feedback

| 元素 | 英文文案 |
|------|----------|
| Q1 | Did this help you compare paths? (1–5) |
| Q2 | Would you recommend this tool? (Yes / Maybe / No) |
| Q3 | What was missing? (optional text) |
| Submit | **Submit & finish** |

---

### Evidence pages · Impact / About / Media Kit

这些页面不属于个人评分流程，但对内部申报与外部传播非常关键，必须和 Climate Adaptation Energy Advisor 同期上线。

#### `/impact` Impact Dashboard

| 模块 | 必放内容 |
|------|----------|
| Headline metrics | Valid sessions, completed surveys, understanding gain, recommendation rate, AI helpful rate |
| Region coverage | 已覆盖 China pilot + Global MVP regions |
| User groups | Farmers / students / public users / global household users |
| Anonymous testimonials | 2–4 条匿名短反馈 |
| Download | `Download data snapshot PDF` |
| Caution | Small-sample, exploratory, anonymous data |

#### `/about` Youth-led Story

| 模块 | 必放内容 |
|------|----------|
| Why I started | 从中国北方「蓝天变好、过冬账变难」出发 |
| Youth leadership | Guo Hang 发起、设计、部署、招募、分析；CS 同学作为技术协作 |
| Timeline | Research → China pilot → global household advisor |
| Climate justice | 关注低收入、农村、偏远地区家庭的能源负担 |
| Global vision | 从 China pilot 扩展到多国取暖/制冷决策支持 |

#### `/media` Media Kit

| 下载项 | 格式 |
|--------|------|
| One-page project brief | Chinese PDF + English PDF |
| 2-minute demo video | MP4 / hosted link |
| Screenshots | PNG |
| Logo / project title card | PNG |
| Case report draft | DOCX / PDF |

---

## 6. 视觉与 UI 规范

### 6.1 风格

- **延续 V1 气质**：暖米白底、森林绿 accent（与 `paper/defense-slides/indexxx.html` 主题一致：`#f6f4ef` paper, `#2f6b4f` accent）。
- **面向低数字素养用户**：大按钮、少术语、每页一个主 CTA、表单有 inline help。
- **Global mode 可以略偏「工具页」**：表格 + 雷达图清晰可读，不追求花哨动画。
- 参考 skill：`.cursor/skills/frontend-design/SKILL.md`（若需美化 landing）。

### 6.2 组件清单

| 组件 | 用途 |
|------|------|
| `StepHeader` | 1 of 4 + 标题 |
| `RegionSelect` | 国/区域级联 |
| `ClimateCard` | 地区只读摘要 |
| `HouseholdForm` | G2 表单 |
| `HomeFeasibilityQuestionnaire` | G3 住宅可行性问卷 |
| `PathResultsTable` | 可排序表格 |
| `PathRadarChart` | 前五路径雷达（Chart.js 或 ECharts） |
| `ScoreBreakdownBars` | 五维分项 |
| `ExcludedPathsList` | 硬约束剔除 |
| `AIExplanationPanel` | 流式 Markdown 渲染 |
| `ActionSummaryCard` | 生成可下载/可分享的个人行动摘要 |
| `DisclaimerBanner` | 全局免责 |
| `ImpactMetricWall` | COP31 影响力数字墙 |
| `MediaDownloadGrid` | one-pager、视频、截图下载 |

### 6.3 响应式

- Mobile：表格改为卡片列表；雷达改竖排。
- 最低支持宽度 360px。

### 6.4 无障碍

- 表单 label 关联；checkbox group 有清晰 legend 与全选状态；颜色不作为唯一信息通道（分数同时显示数字）。

---

## 7. 算法设计（核心：可复现、可审计）

### 7.1 架构总览

```
inputs: region_profile, climate_profile, household_profile, home_feasibility_profile, all_technologies
        ↓
baseline = buildBaselineProfile(household, home_feasibility, region)
        ↓
screenTechnologies(region, climate, household, home_feasibility, all_technologies)
        ↓
generateCandidatePaths(screening.passed, baseline, region, climate, household)
        ↓
for each path: dimension_scores[path][d] ∈ [0,100]
        ↓
fitness = Σ (default_w_d · score_d) / Σ default_w_d
        ↓
output: ranked_paths[], excluded[], breakdown{}, estimates{}
        ↓
AI: read-only explanation (no score mutation)
```

**实现语言建议**：TypeScript 纯函数模块 `src/scoring/`（前后端共用）；V1 仍可在 `index.html` 内联，V2 新路由单独打包或新 HTML。

### 7.2 内部技术目录（runtime source of truth）

运行时唯一技术目录：

```text
docs/data/technologies/technology_catalog.json
docs/data/technologies/technology_catalog.schema.json
```

- 该目录包含取暖、制冷、取暖+制冷、辅助措施与 baseline-only 技术。
- 所有技术对象必须包含 `"visibility": "internal"`。
- Markdown 内部附录中的表格仅供开发和审计，不是第二份运行时数据源。
- G3 不展示目录；G0/G1/G2/G3/About/Impact/Media 不展示完整目录；不新增 `/technologies` 路由或导航入口。
- G4 只显示通过筛选的候选路径、必要 warning 和有价值的排除原因。
- G5 AI 只接收 top paths 与相关技术卡，不接收无关完整目录。

目录状态：

| status | 用途 |
|--------|------|
| `active` | 默认进入后台筛选 |
| `conditional` | 满足地区/基础设施/安装条件时进入 |
| `baseline_only` | 只用于现状基线、费用和排放，不进入未来推荐 |
| `phase2` | 保留在内部目录和文档中，当前不进入 G4 |

### 7.3 硬约束（Hard filter）——任一不满足则 `Excluded`

伪代码：

```text
function screenTechnologies(region, climate, household, feasibility, technologies):
  candidates = technologies matching required services from household.needs_heating / needs_cooling
  // 不得根据 current_heating_methods 或 current_cooling_methods 建立候选集
  apply high-confidence region infrastructure hard constraints
  apply explicit user installation constraints
  use current energy services only for confidence/warnings unless region data proves impossible
  use current heating/cooling methods only to build baseline
  use climate as G4 climate score unless high-confidence unsafe case has no backup/fallback
  never hard-exclude for upfront cost
  return { passed, excluded, warnings }
```

**MVP 规则宜少而清晰**；每条 exclude 必须有人类可读 `reason_en` 与 `reason_zh` 字符串。`not_sure` 不硬排除，只降低 confidence 并添加 warning。

### 7.3.1 技术目录元数据与路径生成

```ts
interface TechnologyCatalogEntry {
  tech_id: string;
  display_name_en: string;
  display_name_zh: string;
  visibility: "internal";
  role: "primary" | "supporting" | "baseline";
  services: ("heating" | "cooling" | "heating_and_cooling")[];
  catalog_status: "active" | "conditional" | "baseline_only" | "phase2";
  ranking_mode: "standalone" | "bundle_only" | "baseline_only" | "phase2";
  screening: {
    installation_level: "none" | "minor" | "moderate" | "major";
    outdoor_space_required: "none" | "wall_or_balcony" | "small_yard_or_roof" | "large_private_land";
    permanent_modification_required: boolean;
    onsite_combustion: boolean;
    infrastructure_required: InfrastructureRequirement[];
    climate_rules: ClimateRule[];
  };
  baseline_mapping: {
    heating_categories: string[];
    cooling_categories: string[];
  };
  g4_defaults: {
    capex_tier: 1 | 2 | 3 | 4 | 5;
    operating_cost_model: OperatingCostModel;
    comfort_tier: 1 | 2 | 3 | 4 | 5;
    simplicity_tier: 1 | 2 | 3 | 4 | 5;
    carbon_model: CarbonModel;
    maintenance_tier: "very_low" | "low" | "medium" | "high";
  };
  path_rules: {
    can_form_standalone_path: boolean;
    can_form_bundle: boolean;
    recommended_supporting_ids?: string[];
    incompatible_tech_ids?: string[];
    max_paths_per_primary?: number;
  };
  explanation: { summary_en: string; summary_zh: string };
  evidence: { source_names: string[]; last_reviewed: string; data_confidence: "high" | "medium" | "low" };
}
```

新增纯函数：

```ts
buildBaselineProfile(household, homeFeasibility, region): BaselineProfile
screenTechnologies(region, climate, household, homeFeasibility, technologies): ScreeningResult
generateCandidatePaths(screening.passed, baseline, region, climate, household): CandidatePath[]
scoreAndSort(candidatePaths, baseline, household, region, climate): RankedPath[]
```

`BaselineProfile` 规则：
- `not_sure` → baseline confidence = `low`。
- `no_current_heating` → `has_mechanical_heating = false`。
- `no_current_cooling` → `has_mechanical_cooling = false`。
- 仅使用 `fans` 或 `natural_or_passive_cooling` → `has_mechanical_cooling = false`。
- 当前系统可用于 replacement cost 和 current setup 摘要，但不能作为未来技术白名单。

`generateCandidatePaths` 规则：
- 主要系统形成基础路径；辅助措施不能默认替代完整取暖/机械制冷系统。
- 辅助措施可与主要系统组成组合路径；当前系统可形成“保留并改善”路径。
- MVP 每个主要系统最多生成一个基础路径和一个高相关组合路径，最终 G4 路径控制在 3–12 条。
- 路径生成不得使用 AI，必须 deterministic。

### 7.4 五维分项打分（0–100）

| 维度 key | UI 名 (EN) | 计算要点 |
|----------|------------|----------|
| `cost` | Affordability | 年运行费 + 初装摊销（如 10 年）→ **energy burden %**；映射到 0–100（burden 越低分越高） |
| `carbon` | Emissions | 按 region 电网/气网排放因子 + 路径能耗估算 kg CO₂e/yr；相对 baseline（现状系统）Improvement % |
| `comfort` | Comfort | 路径 `comfort_tier`（文献/专家表）+ 极端气候惩罚 |
| `climate` | Climate fit | HDD/CDD 与路径适用区间匹配度 |
| `simple` | Simplicity | 维护复杂度、设备成熟度、本地 adoption 代理分 |

**burden 映射示例（与 V1 一致 spirit）**

```text
burden_pct = annual_energy_cost / annual_income * 100
score_cost = clamp(100 - k * max(0, burden_pct - burden_target), 0, 100)
// burden_target 默认 5%（可 per-region 调整）
// k 默认 8
```

**碳排放估算**：复用 V1 思路（`algori_spec.md` emission 节）——按路径能耗 × 排放因子；无精确负荷时用 **degree-day 缩放 + 用户账单校准**：

```text
estimated_heating_energy = heating_spend / fuel_price  // 或 kWh/m³
// 用 household.heating_spend 反推 baseline，再模拟切换路径后的 spend
```

### 7.5 综合适配分（Fitness）

```text
default_w = normalize({ cost: 35, carbon: 20, comfort: 20, climate: 15, simple: 10 })
fitness = Σ_d default_w[d] * score[d]
```

- 输出保留 **1 位小数**。
- **同一输入必须 deterministic**（无 random）。
- 单元测试：固定 fixture 输入 → 快照对比 `fitness` 与各维分。
- MVP 不再让用户手动调权重；默认权重应写死在 scoring module，并在结果页用简短文案说明。
- `upfront_cost_preference` 只影响 G4 affordability、初装成本 penalty、生命周期费用权重与补贴/融资提示。
- 停止使用 `upfrontCost > annualIncome * 0.5` 作为硬约束；高初装路径只能降低 affordability 或显示成本压力。

### 7.6 与 V1 五回合引擎的关系

| 项目 | V1 | V2 Global |
|------|-----|-----------|
| 决策单元 | 村/户沙盘叙事 | 路径评分 + 可选 mini-sandbox |
| 路线数 | 3（气/地源/空气源） | 8+ |
| 补贴退坡 | 固定回合 | region JSON 规则 |
| 合规执法 | 有 | Global mini-sandbox 可省略 |
| AI | 终局 debrief | 分数解释 + 技术科普（RAG） |

**建议**：把 V1 经济/排放公式抽成 `lib/simulationEngine.ts`，Global mini-sandbox 调用同一套，避免两套公式分叉。

---

## 8. 数据模型与文件结构

### 8.1 建议新增目录

Global V2 相关源码、数据、测试与原型页面统一放在 `docs/` 下，与 China Pilot（根目录 `index.html`）隔离：

```
docs/
  sandbox-v2-upgrade-spec.md
  global/                          # Global mode 原型 UI（/global 路由入口）
    index.html
    app.js
  data/
    climate/
      cn_us_admin1_capitals.json      # China provinces + US states: capital-city climate
      climate_profiles.json           # Köppen standard profiles for all other countries
    regions/                          # optional energy/policy overrides (not required for G1 climate)
      cn_example.json
      us_example.json
      ...
    maps/
      global-climate-zones-koppen-source.svg
      admin0-boundaries.geojson       # all countries
      admin1-cn-us.geojson            # ONLY China + US province/state boundaries
      populated-places.geojson        # optional city labels
    technologies/
      technology_catalog.json          # one runtime source of truth; internal only
      technology_catalog.schema.json
  src/
    global/
      homeFeasibility.ts
      screening.ts
      types.ts
      index.ts
    technologies/
      types.ts
      loadTechnologyCatalog.ts
  tests/
    global/
      global-flow.test.js
      technology-catalog.test.js
  dist/                              # TypeScript 编译输出（gitignore）
```

### 8.2 `region` JSON schema（示例）

`region` 在 V2 中不再由用户手动选择。G1 地图点击后按两档规则赋值气候：

- **中国 / 美国**：得到 `country_iso3` + `admin1_name`，气候取自该省/州 **首府**（`cn_us_admin1_capitals.json`）。
- **其余国家**：只得到 `country_iso3`（`admin1_name` 为空），气候取自点击点 Köppen **标准 profile**（`climate_profiles.json`）。

可选的 `docs/data/regions/*.json` 仍可用于电价、基础设施、政策备注等 override，但**不是** G1 气候数据的主来源。

```json
{
  "region_id": "us_il_springfield_capital",
  "country": "United States",
  "country_iso3": "USA",
  "label_en": "Illinois (Springfield capital climate)",
  "admin1_name": "Illinois",
  "currency": "USD",
  "climate": {
    "design_temp_c": -18,
    "temperature_c_monthly": [-3, 0, 6, 12, 18, 23, 25, 24, 20, 13, 6, -1],
    "precipitation_mm_monthly": [45, 45, 70, 90, 110, 110, 95, 85, 80, 75, 70, 55],
    "data_resolution": "admin1_capital",
    "capital_name": "Springfield",
    "koppen_code": "Dfa"
  },
  "energy": {
    "electricity_usd_per_kwh": { "low": 0.12, "mid": 0.15, "high": 0.18 },
    "gas_usd_per_therm": { "low": 1.0, "mid": 1.3, "high": 1.6 },
    "propane_usd_per_gallon": { "mid": 2.5 },
    "grid_kgco2_per_kwh": { "mid": 0.45 }
  },
  "infrastructure": {
    "gas_grid_rural": false,
    "district_heat": false
  },
  "policies": {
    "notes_en": "IRA tax credits may apply to heat pumps; verify locally.",
    "links": []
  },
  "defaults": {
    "burden_target_pct": 5
  }
}
```

非中美国家点击后的气候对象示例（无 Admin-1）：

```json
{
  "country_iso3": "DEU",
  "admin1_name": null,
  "climate": {
    "koppen_code": "Cfb",
    "temperature_c_monthly": [3, 4, 7, 10, 14, 17, 19, 19, 15, 11, 7, 4],
    "precipitation_mm_monthly": [50, 40, 45, 45, 55, 65, 70, 65, 55, 50, 50, 55],
    "data_resolution": "koppen_standard_profile"
  }
}
```

### 8.3 `TechnologyCatalogEntry` schema

`docs/data/technologies/technology_catalog.json` 是运行时单一技术目录。`docs/data/technologies/technology_catalog.schema.json` 用于校验关键结构。旧版单一 ASHP 示例已废弃，不再作为运行时数据源。

字段原则：
- 主目录描述技术本身：服务类型、安装要求、基础设施要求、气候规则、G4 fallback tier、路径组合规则。
- Region override 描述当地价格、市场、基础设施、政策和排放因子。
- Household / G3 profile 描述具体家庭条件。
- 三者不得混在同一个对象中。

G4 数据优先级：

```text
1. region technology override exact numeric data
2. China/US admin-1 capital climate + optional country/admin1 energy overrides
3. Köppen standard climate profile (non-CN/US, or missing capital row)
4. technology catalog default tiers
5. Needs local quote / data uncertain
```

没有当地数字时可用 `capex_tier` 等 tier 做相对分，但不得显示虚构金额或效率。

Region override 示例：

```json
{
  "technology_overrides": {
    "district_heating": {
      "availability": "unavailable",
      "availability_confidence": "high"
    },
    "ashp_ductless": {
      "availability": "available",
      "availability_confidence": "medium",
      "capex_local": {
        "low": 4000,
        "mid": 6500,
        "high": 9000,
        "currency": "USD",
        "basis": "per_home"
      }
    }
  }
}
```

### 8.4 Supabase 扩展（可选 Phase 2）

新表 `pathfinder_sessions`：

| column | type | 说明 |
|--------|------|------|
| id | uuid | |
| region_id | text | |
| household_json | jsonb | 脱敏 |
| home_feasibility_json | jsonb | G3 住宅可行性问卷 |
| scores_json | jsonb | 完整打分输出 |
| ai_explanation | text | |
| created_at | timestamptz | |

---

## 9. AI 接入规范

### 9.1 原则

| 规则 | 说明 |
|------|------|
| AI **不得**修改 fitness 数字 | 后端/前端算完后只读 |
| AI **不得**编造价格 | 只能引用 score card + region/tech JSON |
| AI **不得**接收完整技术目录 | 只注入 top paths、excluded 相关项与必要技术卡 |
| AI **必须**标注不确定性 | “approximate”, “check locally” |
| 失败降级 | 仅展示表格分数，不阻塞主流程 |

### 9.2 接入点

| # | 时机 | API | 模型 |
|---|------|-----|------|
| A | G5 用户点 Explain | `POST /api/explain` | DeepSeek（与 V1 相同 Key） |
| B | V1 终局 debrief | `POST /api/chat` | 保持现有 |
| C | （未来）聊天追问 | `POST /api/explain/followup` | 带 thread id |

### 9.3 `/api/explain` 请求体

`locale` 必须来自首页语言选择，取值为 `en` 或 `zh`。

```json
{
  "locale": "en",
  "region_id": "us_il_springfield_capital",
  "country_iso3": "USA",
  "admin1_name": "Illinois",
  "climate_data_resolution": "admin1_capital",
  "household": { "...": "..." },
  "home_feasibility": {
    "housing_status": "owner",
    "building_type": "detached",
    "renovation_tolerance": "moderate",
    "outdoor_space": "small_yard_or_roof",
    "current_energy_services": ["electricity", "delivered_fuel"],
    "current_heating_methods": ["delivered_fuel_heating"],
    "current_cooling_methods": ["room_air_conditioning", "fans"],
    "upfront_cost_preference": "higher_if_saves_later"
  },
  "score_card": {
    "ranked": [
      {
        "tech_id": "ashp",
        "fitness": 82.4,
        "dimensions": { "cost": 78, "carbon": 88, "comfort": 85, "climate": 70, "simple": 75 },
        "estimates": { "upfront_mid": 8400, "annual_run_mid": 1200, "burden_pct": 4.2 }
      }
    ],
    "excluded": [{ "tech_id": "gas_boiler", "reason_en": "No gas grid in region profile." }]
  },
  "retrieved_tech_ids": ["ashp", "gshp", "insulation_plus_ashp"]
}
```

### 9.4 RAG 检索（MVP 可简化为 JSON 注入）

**Phase 1**：把 top-5 + excluded 的 tech JSON 全文塞进 system prompt（<8k tokens）。  
**Phase 2**：向量库（Supabase pgvector / 本地 JSON index）按 `tech_id` + 关键词检索。

System prompt 要点（按 `locale` 选择英文或中文版本）：

```text
You are a plain-language home energy guide.
You ONLY explain the score_card and retrieved technology facts.
If data is missing, say you don't know—do not invent subsidies or prices.
Audience: homeowners, not academics.
Format: use the required Markdown headings.
```

User message：

```text
Explain why path #1 ranked highest for this household.
Compare #1 and #2 on cost and climate.
Note any technology used in China that may be relevant for this region.
```

`locale=zh` 时使用等价中文 prompt，输出标题与正文都用中文；`locale=en` 时使用英文 prompt。不得出现“界面是中文但 AI 解释仍为英文”的混用。

### 9.5 与 V1 prompt 的关系

- V1：`api/chat.js` 三套中文 farmer/student prompt → **保留**。
- V2：新建 `api/explain.js` + `prompts/globalExplain.en.md` + `prompts/globalExplain.zh.md` → **不要混在 V1 handler 里**。

---

## 10. 技术栈与部署建议

### 10.1 现状

- 生产：Vercel 静态 `index.html` + Serverless `api/chat.js`、`api/supabase-config.js`
- DB：Supabase
- LLM：DeepSeek via `DEEPSEEK_API_KEY`

### 10.2 V2 推荐（给 CS 同学）

| 层级 | 建议 | 理由 |
|------|------|------|
| 前端 | Vite + TypeScript **或** 继续单 HTML 但 scoring 抽 TS 编译成 bundle | 算法需单测 |
| 样式 | 延续现有 CSS 变量；或 Tailwind | 与 V1 视觉统一 |
| 图表 | Chart.js | 轻量 |
| 打分 | **优先前端完成**（零额外延迟） | MVP 简单 |
| AI | Vercel serverless | 与现网一致 |
| 测试 | Vitest 对 `scoring/*` 快照测试 | 可答辩复现 |
| i18n | `en.json` / `zh.json` | 首页可切换 English / 中文；G1–G8 与 AI explanation 跟随同一 `locale` |

### 10.3 路由部署（Vercel）

```json
{
  "rewrites": [
    { "source": "/global", "destination": "/docs/global/index.html" },
    { "source": "/china", "destination": "/index.html" },
    { "source": "/impact", "destination": "/impact/index.html" },
    { "source": "/about", "destination": "/about/index.html" },
    { "source": "/media", "destination": "/media/index.html" },
    { "source": "/", "destination": "/global/index.html" }
  ]
}
```

---

## 11. 分阶段交付（请 CS 同学按 Phase 排期）

### Phase 0 · 1 周 — COP31 Global-first 脚手架

- [ ] 把 `/` 改为 Global-first landing；现有 V1 移到 `/china`
- [ ] 新建 `/global` 入口与 G0–G3 静态页（无打分）
- [ ] 新建 `/impact`、`/about`、`/media` 三个 COP31 申报支撑页的静态版
- [ ] `docs/data/climate/cn_us_admin1_capitals.json` 样例（至少各 2 个中美省/州首府气候）+ `docs/data/climate/climate_profiles.json` 若干 Köppen profile；`docs/data/technologies/technology_catalog.json` 作为完整内部技术目录
- [ ] 首页写明 “Youth-led climate action · China pilot to global tool”
- [ ] 首页加入 `English / 中文` 语言选择；选择后 G1–G8、Impact/About/Media、AI explanation 全部跟随同一语言

**验收**：评审打开首页 30 秒内能看懂这是全球青年气候行动项目；能切换 English / 中文；切换后后续页面文字跟随语言；能在地图上点选位置（中美到省/州，其他到国家）、填表、数据写入 console；China pilot 仍可进入。

### Phase 1 · 2–3 周 — 全球打分 MVP + 影响力证据

- [ ] 实现 `hardFilter` + 五维分 + `fitness` 排序
- [ ] G3 `HomeFeasibilityQuestionnaire` + 后台技术筛选 + G4 结果表 + 雷达图
- [ ] G6 `ActionSummaryCard` 下载 PNG/复制文字
- [ ] `/impact` 接入静态或 Supabase 汇总数据：valid sessions、completed surveys、understanding gain、recommendation rate
- [ ] 单元测试 ≥10 cases
- [ ] **G1 气候两档落地**：中国/美国全省/州首府气候表 + 全球 Köppen 标准 profile；地图点击中美精确到省/州，其余国家只到国家
- [ ] 用至少 3 个场景跑通筛选（如：河北首府气候、Illinois 首府气候、德国某点 Cfb profile）× 技术目录

**验收**：同一 JSON 输入，fitness 列表可复现；exclude 有 reason；能生成一张可用于 COP31 材料和社媒传播的行动摘要卡。

### Phase 2 · 1–2 周 — AI 解释 + 国际传播

- [ ] `POST /api/explain` + RAG（JSON 注入）
- [ ] G5 流式展示 + 错误降级
- [ ] AI 输出必须包含 “Cross-region technology note”，解释不同国家之间的信息差
- [ ] `/media` 放入中英 one-pager、2 分钟 demo 视频入口、截图包
- [ ] Supabase `pathfinder_sessions`（可选）

**验收**：AI 文案引用 score card 中数字；改分数后 AI 跟着变；媒体页可直接作为 COP31 申报附件入口。

### Phase 3 · 2 周 — Mini-sandbox + COP polish

- [ ] G7 三回合预览（复用 simulation engine）
- [ ] G8 问卷
- [ ] `/about` 补充青年主导时间线、活动照片、匿名用户反馈
- [ ] Mobile 适配 + 免责声明法务审阅

### Phase 4 · 未来

- 政府/企业多角色；村庄 aggregate dashboard；更多国家；制冷负荷详细模型；国际合作数据源。

---

## 12. 验收标准（Definition of Done）

1. **功能**：Global 全流程 G0→G8 无 dead end；首页可选择 English / 中文，选择后全流程 UI 与 AI explanation 跟随同一语言；G1 在中国/美国精确到省/州并用首府气候，其余国家只到国家并用 Köppen 标准 profile；China pilot 仍可独立进入并完成一局。
2. **正确性**：scoring 模块有单测；hard exclude 理由可见。
3. **AI 安全**：prompt injection 测试：用户填 `"ignore rules"` 不改变 fitness。
4. **性能**：打分 < 200ms（前端）；AI 首 token < 5s（依赖 API）。
5. **隐私**：无 PII 强制；Supabase 仅存匿名 session。
6. **COP31 传播**：`/impact`、`/about`、`/media` 可公开访问；有中英项目简介、影响力数字、行动摘要卡、demo 视频入口。
7. **文档**：README 增加 Global mode、China pilot、COP31 media kit、语言切换与环境变量说明。

---

## 13. 给开发同学的快速 FAQ

**Q: 分数和 AI 谁说了算？**  
A: **分数 = TypeScript 算法**；AI 只解释。

**Q: 必须先重写整个 index.html 吗？**  
A: 不必。可新建 `docs/global/index.html` + 共享 `lib/scoring.js`。

**Q: 中国用户还会用旧版吗？**  
A: 会，但它是 **China Pilot**。主入口必须是 Climate Adaptation Energy Advisor，因为内部申报项目不能只局限于中国北方农村。

**Q: 价格数据从哪来？**  
A: MVP 用 `research/data/calibration_defaults.json` + 手工 `regions/*.json`；UI 标明 “approximate range”。

**Q: G1 气候数据要做到多细？**  
A: **中国、美国**：地图识别到省/州，气候用该省/州**首府点数据**代表。**其余国家**：只识别到国家，气候用点击点的 **Köppen 标准 profile**。不要做全省/州 WorldClim zonal mean。

**Q: 现有 DeepSeek Key 能复用吗？**  
A: 能，新增 `/api/explain` 即可。

**Q: 论文/答辩要截图什么？**  
A: G4 排序表 + 雷达 + AI 解释里 “cross-region technology” 一段；COP31 申报还要截图 `/impact` 数字墙、`/about` 青年主导故事、G6 行动摘要卡。

---

## 14. 参考仓库内文件

| 文件 | 用途 |
|------|------|
| `index.html` | V1 完整 UI + 模拟逻辑 |
| `api/chat.js` | V1 AI debrief 接口与 prompt 结构 |
| `algori_spec.md` | 经济/排放/合规公式 |
| `research/data/calibration_defaults.json` | 华北默认参数 |
| `spec.md` | MVP 范围 |
| `paper/main.tex` § Future directions | 产品愿景原文 |
| `paper/defense-slides/indexxx.html` | 答辩叙事与视觉参考 |

---

## Internal Appendix · Household technology catalog

> Internal development and scoring reference only.  
> Do not render this catalog as a public website section.  
> G3 collects household information without showing future technology options.

如果本文档未来被构建成公开网页，必须排除此内部附录，或在构建流程中隐藏本节。运行时唯一数据源是 `docs/data/technologies/technology_catalog.json`；下表只用于开发审计。

| tech_id | EN display name | 中文名称 | 角色/服务 | 状态 | 安装 | 空间 | 必要基础设施 | 气候/环境规则 | 排名方式 | Capex | Comfort | Simple | 运行费模型 | 碳模型 |
|---|---|---|---|---|---:|---|---|---|---|---:|---:|---:|---|---|
| `ashp_ductless` | Ductless air-to-air heat pump | 无风管空气—空气热泵 | P/HC | active | 1 | W | electricity | cold performance check | standalone | 3 | 4 | 3 | heat pump COP | grid electricity |
| `ashp_ducted` | Ducted air-source heat pump | 风管式空气源热泵 | P/HC | active | 2 | W | electricity | cold performance check | standalone | 4 | 5 | 3 | heat pump COP | grid electricity |
| `ashp_air_to_water` | Air-to-water heat pump | 空气—水热泵 | P/H | active | 2 | W | electricity | cold performance check | standalone | 4 | 4 | 3 | heat pump COP | grid electricity |
| `gshp` | Ground-source heat pump | 地源热泵 | P/HC | conditional | 3 | L | electricity, ground access | general | standalone | 5 | 5 | 2 | heat pump COP | grid electricity |
| `water_source_hp` | Water-source heat pump | 水源热泵 | P/HC | phase2 | 3 | Y | electricity, usable water or shared loop | general | phase2 | 5 | 5 | 2 | heat pump COP | grid electricity |
| `hybrid_hp_boiler` | Hybrid heat pump and boiler | 热泵与锅炉混合系统 | P/HC | conditional | 2 | W | electricity plus gas or delivered fuel | cold performance check | standalone | 4 | 5 | 2 | hybrid dispatch | hybrid weighted |
| `gas_boiler` | Natural gas boiler | 天然气锅炉 | P/H | conditional | 2 | 0 | piped gas | air-quality and policy check | standalone | 3 | 4 | 4 | gas fuel | gas combustion |
| `gas_furnace` | Natural gas furnace | 天然气暖风炉 | P/H | conditional | 2 | 0 | piped gas | air-quality and policy check | standalone | 3 | 4 | 4 | gas fuel | gas combustion |
| `lpg_propane_heating` | LPG or propane heating | 液化气或丙烷取暖 | P/H | active | 2 | Y | delivered fuel | air-quality and policy check | standalone | 3 | 4 | 3 | delivered liquid fuel | liquid-fuel combustion |
| `oil_heating` | Heating-oil system | 燃油取暖系统 | P/H | conditional | 2 | Y | delivered fuel | air-quality and policy check | standalone | 3 | 4 | 3 | delivered liquid fuel | liquid-fuel combustion |
| `electric_boiler` | Electric boiler | 电锅炉 | P/H | conditional | 2 | 0 | electricity | general | standalone | 3 | 4 | 4 | grid resistance | grid electricity |
| `electric_resistance` | Fixed electric resistance heating | 固定式电阻取暖 | P/H | active | 1 | 0 | electricity | general | standalone | 1 | 3 | 5 | grid resistance | grid electricity |
| `biomass_pellet` | Biomass or pellet heating | 生物质或颗粒燃料取暖 | P/H | conditional | 2 | Y | solid-fuel supply | air-quality and policy check | standalone | 3 | 3 | 2 | solid fuel | biomass context-dependent |
| `wood_stove` | Wood stove | 木柴炉 | P/H | conditional | 2 | Y | solid-fuel supply | air-quality and policy check | standalone | 2 | 2 | 2 | solid fuel | biomass context-dependent |
| `district_heating` | District heating | 区域集中供热 | P/H | conditional | 1 | 0 | district-heating network | general | standalone | 2 | 5 | 5 | district tariff | district-energy factor |
| `coal_legacy` | Existing coal or solid-fuel heating | 现有煤炭或固体燃料取暖 | B/H | baseline_only | 2 | Y | solid-fuel supply | air-quality and policy check | baseline_only | 1 | 2 | 2 | solid fuel | solid-fuel combustion |
| `window_ac` | Window air conditioner | 窗式空调 | P/C | active | 1 | 0 | electricity | humidity control helpful | standalone | 1 | 3 | 4 | grid cooling efficiency | grid electricity |
| `portable_ac` | Portable air conditioner | 移动空调 | P/C | active | 0 | 0 | electricity | humidity control helpful | standalone | 1 | 2 | 5 | grid cooling efficiency | grid electricity |
| `split_ac_cooling` | Split or ductless air conditioner | 分体式或无风管空调 | P/C | active | 1 | W | electricity | humidity control helpful | standalone | 2 | 4 | 4 | grid cooling efficiency | grid electricity |
| `central_ac` | Central air conditioning | 中央空调 | P/C | active | 2 | W | electricity | humidity control helpful | standalone | 4 | 5 | 3 | grid cooling efficiency | grid electricity |
| `evaporative_direct` | Direct evaporative cooler | 直接蒸发式冷却器 | P/C | conditional | 1 | Y | electricity, water supply | dry climate required | standalone | 2 | 3 | 3 | low-energy support | grid electricity |
| `evaporative_indirect` | Indirect or two-stage evaporative cooler | 间接或两级蒸发冷却 | P/C | phase2 | 2 | Y | electricity, water supply | dry climate preferred | phase2 | 3 | 4 | 2 | local quote | grid electricity |
| `district_cooling` | District cooling | 区域集中供冷 | P/C | conditional | 1 | 0 | district-cooling network | general | standalone | 2 | 5 | 5 | district tariff | district-energy factor |
| `radiant_cooling` | Radiant ceiling or wall cooling | 辐射式冷顶或冷墙 | P/C | phase2 | 3 | 0 | electricity or chilled-water source | dew-point control required | phase2 | 4 | 5 | 2 | local quote | local factor required |
| `absorption_cooling` | Absorption cooling | 吸收式制冷 | P/C | phase2 | 3 | Y | usable heat source, water supply | general | phase2 | 5 | 4 | 1 | local quote | local factor required |
| `insulation_air_sealing` | Insulation and air sealing | 保温与气密改造 | S/HC | active | 2 | 0 | none | general | bundle_only | 3 | 4 | 4 | passive zero direct energy | passive operational zero |
| `external_shading` | External shading or shutters | 外遮阳或外卷帘 | S/C | active | 1 | W | none | general | bundle_only | 2 | 3 | 4 | passive zero direct energy | passive operational zero |
| `cool_roof` | Cool or reflective roof | 冷屋顶或高反射屋顶 | S/C | active | 2 | Y | none | solar-resource check | bundle_only | 2 | 3 | 3 | passive zero direct energy | passive operational zero |
| `fans` | Ceiling or portable fans | 吊扇或移动风扇 | S/C | active | 0 | 0 | electricity | general | bundle_only | 1 | 3 | 5 | low-energy support | grid electricity |
| `whole_house_fan` | Whole-house fan | 全屋排风扇 | S/C | conditional | 1 | Y | electricity | diurnal-temperature check | bundle_only | 2 | 3 | 3 | low-energy support | grid electricity |
| `night_ventilation` | Night ventilation | 夜间通风排热 | S/C | active | 0 | 0 | none | diurnal-temperature check | bundle_only | 1 | 2 | 4 | passive zero direct energy | passive operational zero |
| `dehumidifier` | Standalone dehumidifier | 独立除湿机 | S/C | active | 0 | 0 | electricity | humidity control helpful | bundle_only | 1 | 3 | 4 | low-energy support | grid electricity |
| `erv_hrv` | Energy or heat recovery ventilation | 能量或热回收新风 | S/HC | conditional | 2 | 0 | electricity | general | bundle_only | 3 | 3 | 3 | low-energy support | grid electricity |
| `passive_solar` | Passive solar heating | 被动太阳能取暖 | S/H | conditional | 2 | 0 | none | solar-resource check | bundle_only | 2 | 2 | 4 | passive zero direct energy | passive operational zero |
| `solar_thermal_heating` | Solar thermal heating support | 太阳能热利用辅助取暖 | S/H | conditional | 2 | Y | none | solar-resource check | bundle_only | 4 | 2 | 2 | passive zero direct energy | passive operational zero |

---

## 15. 产品负责人待办（非开发）

- [ ] 补齐中国各省/州首府 + 美国各州首府气候点数据；确认 Köppen 标准 profile 覆盖清单与代表城市
- [ ] 准备中英双语项目简介：100 字、500 字、2000 字三个版本
- [ ] 准备 COP31 申报所需 supporting materials：demo 视频、截图、数据报告、活动照片
- [ ] 明确弱势群体包容叙事：农村、低收入、偏远地区、能源负担高家庭如何受益
- [ ] 确认中英文术语表：技术路径名、免责声明、AI explanation 固定标题、错误提示
- [ ] 准备 5 组「典型家庭」fixture 供测试与 demo
- [ ] 免责声明给导师/课程过目

---

*文档结束。有问题直接在 GitHub issue 或飞书/微信里 @Guo Hang，并附上 region_id / tech_id 讨论具体规则。*
