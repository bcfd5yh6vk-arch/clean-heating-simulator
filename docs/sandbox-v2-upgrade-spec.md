# Climate Adaptation Energy Advisor — Global Upgrade Spec

> **文档用途**：给负责改网站的同学（CS 背景）看的**产品 + 技术 + UI 全文说明**。  
> **产品负责人**：Guo Hang  
> **当前线上版本**：https://www.clean-heating-simulator.com（根目录 `index.html` + Vercel `api/`）  
> **本文档版本**：2026-08-05 · COP31 youth-led action edition

---

## 0. 一句话目标

把现有「华北村级煤改 X 五回合沙盘」升级为 **Climate Adaptation Energy Advisor（气候适应家庭能源选择助手）**——用户在全球地图上点击自家位置 → 系统识别国家/省级地区/气候区 → 读取当地或气候区的月均温、月降水 → 用户补充家庭数据 → **规则引擎算出不同取暖/制冷方案的适配分** → **AI 用 plain language 解释分数、填补跨国技术信息差** → 生成可分享的个人行动摘要与匿名影响力数据。

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
Global Landing → Click home location on climate map → Household form → Optional cooling need
    → [Run scoring] → Results table + radar → AI explanation panel
    → Shareable action summary → [Optional] Mini-sandbox (3 turns)
    → Survey / thanks

Parallel evidence pages:
Impact dashboard → Youth-led story → Media kit / case materials
```

| 步骤 | 页面 ID | 目的 |
|------|---------|------|
| G0 | `global-landing` | 全球价值主张 + 气候适应家庭能源选择定位 + 免责声明（公开文案不写 COP31） |
| G1 | `global-climate-map` | 用户在可缩放全球气候地图上点击自家位置 → 识别国家/省级地区/气候区 → 载入气候参数 |
| G2 | `global-household` | 家庭与建筑、现有系统、账单 |
| G3 | `global-priorities` | 用户权重：省钱 / 低碳 / 舒适 / 少折腾 |
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

## 5. 界面说明与界面文案（English UI copy）

> 以下文案可直接进前端；中文注释供产品负责人核对。

### G0 · Landing

**Layout**
- 顶栏：Logo + `China Pilot` / `Impact` / `About` / `Media Kit`
- Hero：公开品牌名 + 中文副名 + 副标题 + 主按钮
- 三列价值点 + 影响力数字条 + 底部 disclaimer

**Copy**

| 元素 | 英文文案 |
|------|----------|
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

**禁止出现在 G0 的公开文案**
- `COP31`
- `case collection`
- `application`
- `申报`
- `征集`
- 任何让用户觉得“这个网站是为了某个活动临时包装”的表述

---

### G1 · Climate map location picker

**Layout**
- Step indicator: `1 of 4 · Your climate`
- 主体为可缩放全球地图：用户**不填写国家/地区**，而是在地图上点击自家大致位置。
- 地图底图使用已下载资源：`docs/global-climate-zones-koppen-source.svg`。该图来自 Wikimedia Commons / Köppen-Geiger global climate classification，可作为设计参考和静态 fallback。
- 交互实现优先级：
  1. **推荐方案**：Mapbox GL JS / Leaflet + OpenStreetMap 底图 + Köppen-Geiger 气候区 raster/vector overlay。
  2. **可选方案**：Google Maps JavaScript API + 自定义气候区 overlay。注意 Google Maps 商用/配额/Key 管理。
  3. **离线 fallback**：静态 SVG 地图 + 简单点击经纬度近似（只用于 demo，不作为正式版）。
- 地图缩放要求：
  - 世界级：显示 12 类气候大区颜色。
  - 国家级：显示国界、省/州界。
  - 省/州级：显示主要城市点位；中国至少显示**地级市及以上**城市，其他国家显示同等规模城市或人口阈值城市。
- 用户点击后，右侧卡片必须显示：
  - `Country`
  - `Province / State / Admin-1`
  - `Nearest city`（可选）
  - `Climate zone`
  - `Data resolution`：Exact admin-1 data / National fallback / Climate-zone fallback
- 右侧卡片同时显示气候图：
  - **柱状图**：Monthly precipitation (mm)
  - **折线图**：Monthly mean temperature (°C)
- 点击确认后进入 G2。

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Heading | **Click your home area on the climate map** |
| Hint | We use your location to identify the climate zone and load monthly temperature and rainfall data. You only need to click an approximate location. |
| Map helper | Zoom in for provinces, states, and major cities. |
| Climate card title | Local climate snapshot |
| Fields | Country · Province/State · Climate zone · Monthly precipitation · Monthly mean temperature |
| Button | **Continue** |

**地图与地理识别要求**

| 需求 | 实现建议 |
|------|----------|
| 点击识别国家 | Natural Earth Admin 0 或 geoBoundaries / GADM Admin 0 |
| 点击识别省/州 | Natural Earth Admin 1（轻量）或 geoBoundaries / GADM Admin 1（更精细） |
| 城市显示 | Natural Earth Populated Places；中国可单独补地级市点表 |
| 气候区识别 | Köppen-Geiger 1991–2020 GeoTIFF / raster tile；MVP 可先把气候区 polygon 简化成 12 类 |
| 月均温/月降水 | 优先 WorldClim 2.1 月尺度 tavg + prec，按 admin-1 聚合 |
| 缺省 fallback | 若没有省/州数据，用该气候区的标准月均温/月降水 profile |

**已放入仓库的地图素材**

| 文件 | 用途 | 来源 |
|------|------|------|
| `docs/global-climate-zones-koppen-source.svg` | 设计参考、静态 fallback、legend 参考 | Wikimedia Commons, World Köppen Classification (with authors).svg |

> 注意：正式交互地图不要只靠这张 SVG。SVG 用于设计参考和无 API fallback；正式版应使用地图底图 + 气候区数据 layer。

**首发地区（MVP 至少 5 个）**

| region_id | Country | Region label | 备注 |
|-----------|---------|--------------|------|
| `cn_north_china` | China | North China Plain | 对接现有 V1 参数 |
| `us_midwest` | United States | Midwest | 个体决策、丙烷/电暖常见 |
| `de_rural` | Germany | Rural / village | 热泵渗透高 |
| `uk_rural` | United Kingdom | Rural off-gas | 气网外区域 |
| `fr_rural` | France | Rural | 扩展用 |

数据文件建议：`data/regions/{region_id}.json`（见 §8）。

**12 类产品用气候类型（前端颜色 legend）**

Köppen-Geiger 细分类很多，产品 UI 不需要全部展示。正式交互层把细分类合并成以下 12 类，颜色可沿用 Köppen 色系但简化 legend：

| climate_12_id | Display name | Köppen examples | 对能源选择的意义 |
|---------------|--------------|-----------------|------------------|
| `tropical_rainforest` | Tropical rainforest | Af | 制冷/除湿重要，取暖很弱 |
| `tropical_monsoon_savanna` | Tropical monsoon / savanna | Am, Aw, As | 制冷强，雨季湿热 |
| `hot_desert` | Hot desert | BWh | 昼夜温差大，制冷与保温都重要 |
| `cold_desert_steppe` | Cold desert / steppe | BWk, BSk | 冬冷夏热，热泵需看低温表现 |
| `mediterranean` | Mediterranean | Csa, Csb, Csc | 夏季干热，冬季温和湿润 |
| `humid_subtropical` | Humid subtropical | Cfa, Cwa | 夏季制冷强，冬季中等取暖 |
| `oceanic` | Oceanic / marine | Cfb, Cfc | 温和湿润，热泵适配度通常高 |
| `subtropical_highland` | Subtropical highland | Cwb, Cwc | 海拔影响明显，需要本地化 |
| `humid_continental` | Humid continental | Dfa, Dfb, Dwa, Dwb | 冬季取暖强，低温热泵/备份重要 |
| `subarctic` | Subarctic | Dfc, Dfd, Dwc, Dwd | 极寒，需强保温和备份热源 |
| `tundra_alpine` | Tundra / alpine | ET | 取暖极强，施工与维护困难 |
| `ice_cap` | Ice cap | EF | 不作为普通家庭目标市场，仅显示 |

**12 类 fallback 气候 profile 数据**

如果无法拿到用户点击省/州的精确月均温和月降水，系统使用该 `climate_12_id` 的标准 profile。数据应放在 `data/climate_profiles_12.json`。

数据来源建议：WorldClim 2.1 monthly `tavg` 与 `prec`；每类选择 3–5 个代表点取平均，或用 GloH2O/Köppen-Geiger 栅格按类型抽样求均值。MVP 可先手工录入下列代表城市/区域的月尺度数据，后续再自动化。

| climate_12_id | Representative fallback source area | 数据获取建议 |
|---------------|-------------------------------------|--------------|
| `tropical_rainforest` | Singapore / Manaus | WorldClim city point 或 admin-1 average |
| `tropical_monsoon_savanna` | Bangkok / Lagos / Darwin | WorldClim point average |
| `hot_desert` | Cairo / Riyadh / Phoenix | WorldClim point average |
| `cold_desert_steppe` | Ulaanbaatar / Denver dry plains / Central Asia steppe | WorldClim point average |
| `mediterranean` | Athens / Los Angeles / Perth | WorldClim point average |
| `humid_subtropical` | Shanghai / Atlanta / Buenos Aires | WorldClim point average |
| `oceanic` | London / Seattle / Wellington | WorldClim point average |
| `subtropical_highland` | Kunming / Mexico City / Addis Ababa | WorldClim point average |
| `humid_continental` | Beijing / Chicago / Warsaw | WorldClim point average |
| `subarctic` | Fairbanks / Yakutsk / northern Scandinavia | WorldClim point average |
| `tundra_alpine` | Reykjavik outskirts / Tibetan Plateau / alpine settlement | WorldClim point average |
| `ice_cap` | Greenland interior / Antarctica edge | 显示用，不作为普通推荐对象 |

**`data/climate_profiles_12.json` schema**

```json
{
  "humid_continental": {
    "display_name_en": "Humid continental",
    "display_name_zh": "湿润大陆性气候",
    "source": "WorldClim 2.1 representative points; MVP fallback",
    "temperature_c_monthly": [-4, -1, 5, 12, 18, 23, 26, 25, 20, 13, 6, -1],
    "precipitation_mm_monthly": [8, 10, 20, 35, 55, 80, 160, 140, 55, 30, 18, 8],
    "notes": "Fallback only; replace with admin-1 data when available."
  }
}
```

---

### G2 · Household form

**Layout**
- Step: `2 of 4 · Your home`
- 两列表单 + 右侧「Help」折叠说明

**Fields（必填 / 选填）**

| field_key | UI label (EN) | Type | Required | 说明 |
|-----------|---------------|------|----------|------|
| `household_size` | People in home | number | yes | 默认 4 |
| `annual_income` | Annual household income (local currency) | number | yes | 整户收入 |
| `annual_surplus` | Money left after basic expenses | number | no | 可估算 |
| `floor_area_m2` | Heated floor area (m²) | number | yes | |
| `building_age` | Building age | select: `<1970`, `1970–1990`, `1990–2010`, `2010+` | no | 影响保温假设 |
| `insulation_level` | Insulation | select: Poor / Average / Good | no | 默认 Average |
| `current_heating` | Current heating | select | yes | 见下表 |
| `heating_spend_annual` | Last winter heating spend | number | yes | 本地货币 |
| `needs_cooling` | Need summer cooling? | yes/no | yes | |
| `cooling_spend_annual` | Last summer cooling spend | number | if cooling=yes | |

**current_heating 选项（EN）**

- Scattered coal / solid fuel  
- Natural gas boiler  
- LPG / propane  
- Electric resistance  
- Heat pump (existing)  
- District heating  
- Wood / biomass  
- Other  

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Heading | **Tell us about this household** |
| Hint | Use whole-house numbers. Approximate bills are OK. |
| Income help | Count all earners in the home for one year—not per person unless we ask. |
| Button back | Back |
| Button next | **Continue** |

---

### G3 · Priorities（权重）

**Layout**
- Step: `3 of 4 · What matters most?`
- 4 个 slider，0–100，总和不必为 100（内部归一化）
- 预设按钮：`Save money` / `Cut carbon` / `Stay comfortable` / `Low hassle`

**Copy**

| Slider | Label (EN) |
|--------|------------|
| w_cost | **Low running cost** — keep bills affordable |
| w_carbon | **Lower emissions** — climate impact |
| w_comfort | **Comfort** — stable warmth / cooling |
| w_simple | **Simple & reliable** — easy to run and maintain |

| 元素 | 英文文案 |
|------|----------|
| Heading | **What matters most to you?** |
| Hint | Move the sliders. We use these to weight your personal fitness score. |
| Button | **See my paths** |

---

### G4 · Results（核心页）

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
| Rank | 1…N |
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
| Subheading | Higher fitness = better match *for you*, not “best in the world.” |
| Excluded section title | Not feasible for your place |
| Excluded reason examples | No gas grid in region · Below minimum temperature for air-source without backup · Upfront above surplus threshold |
| Empty state | No path passed hard checks. Try adjusting income or insulation. |
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
| Footer | Generated by Clean Heating & Cooling Pathfinder · Youth-led climate action |

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

这些页面不属于个人评分流程，但对 COP31 申报非常关键，必须和 Global Pathfinder 同期上线。

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
| `PrioritySliders` | G3 权重 |
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

- 表单 label 关联；slider 有 aria-valuetext；颜色不作为唯一信息通道（分数同时显示数字）。

---

## 7. 算法设计（核心：可复现、可审计）

### 7.1 架构总览

```
inputs: region_profile, household_profile, user_weights
        ↓
hard_filter(path, region, household) → feasible set
        ↓
for each path: dimension_scores[path][d] ∈ [0,100]
        ↓
weighted_fitness = Σ (w_d · score_d) / Σ w_d
        ↓
output: ranked_paths[], excluded[], breakdown{}, estimates{}
        ↓
AI: read-only explanation (no score mutation)
```

**实现语言建议**：TypeScript 纯函数模块 `src/scoring/`（前后端共用）；V1 仍可在 `index.html` 内联，V2 新路由单独打包或新 HTML。

### 7.2 候选路径目录（technology_id）

MVP 至少包含 **8 条**（取暖/制冷组合可拆成子路径）：

| tech_id | display_name (EN) | 备注 |
|---------|-------------------|------|
| `gas_boiler` | Natural gas boiler | |
| `lpg_boiler` | LPG / propane boiler | |
| `ashp` | Air-source heat pump | |
| `gshp` | Ground-source heat pump | |
| `resist_electric` | Electric resistance | |
| `district_heat` | District heating | 依赖 region |
| `biomass` | Biomass / pellet | |
| `insulation_plus_ashp` | Insulation retrofit + air-source HP | 组合路径 |
| `coal_legacy` | Continue solid fuel (baseline) | 仅作对照，部分 region 硬剔除 |

制冷（若 `needs_cooling`）附加或合并：

| tech_id | display_name (EN) |
|---------|-------------------|
| `room_ac` | Room / split AC |
| `ashp_cool` | Heat pump (heating + cooling) | 与 ashp 合并计分时可复用 |

数据文件：`data/technologies/{tech_id}.json`。

### 7.3 硬约束（Hard filter）——任一不满足则 `Excluded`

伪代码：

```text
function hardFilter(path, region, household):
  if path.requires_gas_grid and not region.has_gas_grid: exclude "No gas grid"
  if path is district_heat and not region.district_heat_available: exclude
  if path is ashp and region.design_temp_c < path.min_ambient_c without backup: exclude or flag backup
  if upfront_cost(path) > household.annual_income * 0.5: exclude "Upfront too high vs income"  // 可调
  if path is coal_legacy and region.coal_banned: exclude
  return pass
```

**MVP 规则宜少而清晰**；每条 exclude 必须有人类可读 `reason_en` 字符串。

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
w = normalize(user_weights)  // w_cost, w_carbon, w_comfort, w_climate, w_simple
fitness = Σ_d w[d] * score[d]
```

- 输出保留 **1 位小数**。
- **同一输入必须 deterministic**（无 random）。
- 单元测试：固定 fixture 输入 → 快照对比 `fitness` 与各维分。

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

```
data/
  maps/
    global-climate-zones-koppen-source.svg
    climate-zones-12.mbtiles        # optional, generated for web map
    admin1-boundaries.geojson       # simplified province/state boundaries
    populated-places.geojson        # major cities
  climate/
    climate_profiles_12.json        # fallback monthly temp/precip by 12 climate types
    admin1_climate_summaries.json   # province/state monthly temp/precip when available
  regions/
    cn_north_china.json
    us_midwest.json
    ...
  technologies/
    ashp.json
    gas_boiler.json
    ...
  i18n/
    en.json
    zh.json
src/
  scoring/
    hardFilter.ts
    dimensions.ts
    aggregate.ts
    types.ts
  ai/
    buildScoreCard.ts
    prompts/
      globalExplain.en.md
pages/  (或 routes/)
  global/
    landing.html
    ...
api/
  score.js          # POST 纯打分（可选，也可全前端）
  explain.js        # POST AI 解释（RAG）
  chat.js           # 保留 V1
```

### 8.2 `region` JSON schema（示例）

`region` 在 V2 中不再由用户手动选择，而是由 G1 地图点击结果自动生成或匹配。点击地图后，系统先得到 `country_iso3`、`admin1_name`、`climate_12_id`，再查找最接近的 `region_id`。

```json
{
  "region_id": "us_midwest",
  "country": "United States",
  "country_iso3": "USA",
  "label_en": "Midwest",
  "admin1_names": ["Illinois", "Indiana", "Iowa", "Michigan", "Minnesota", "Ohio", "Wisconsin"],
  "climate_12_ids": ["humid_continental", "cold_desert_steppe"],
  "currency": "USD",
  "climate": {
    "hdd18": 4200,
    "cdd18": 900,
    "design_temp_c": -23,
    "typical_winter_low_c": -15,
    "temperature_c_monthly": [-6, -3, 3, 10, 16, 22, 25, 24, 19, 12, 5, -2],
    "precipitation_mm_monthly": [45, 40, 65, 85, 95, 100, 95, 90, 80, 70, 60, 50],
    "data_resolution": "admin1_or_region_average",
    "fallback_allowed": true
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

### 8.3 `technology` JSON schema（示例）

```json
{
  "tech_id": "ashp",
  "display_name_en": "Air-source heat pump",
  "display_name_zh": "空气源热泵",
  "requires": {
    "gas_grid": false,
    "min_ambient_c": -15,
    "backup_heating_recommended_below_c": -10
  },
  "economics": {
    "capex_per_m2": { "mid": 70 },
    "cop_heating_at_design": 2.2,
    "maintenance_annual_pct_capex": 0.02
  },
  "scores_meta": {
    "comfort_tier": 4,
    "simplicity_tier": 3
  },
  "explain_en": "Moves heat from outdoor air; efficient in mild cold; may need backup in extreme cold.",
  "sources": ["IEA heat pump handbook", "..."],
  "china_parallel_en": "Widely used in North China clean-heating programs; may suit cold-dry winters with proper sizing."
}
```

### 8.4 Supabase 扩展（可选 Phase 2）

新表 `pathfinder_sessions`：

| column | type | 说明 |
|--------|------|------|
| id | uuid | |
| region_id | text | |
| household_json | jsonb | 脱敏 |
| weights_json | jsonb | |
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
| AI **必须**标注不确定性 | “approximate”, “check locally” |
| 失败降级 | 仅展示表格分数，不阻塞主流程 |

### 9.2 接入点

| # | 时机 | API | 模型 |
|---|------|-----|------|
| A | G5 用户点 Explain | `POST /api/explain` | DeepSeek（与 V1 相同 Key） |
| B | V1 终局 debrief | `POST /api/chat` | 保持现有 |
| C | （未来）聊天追问 | `POST /api/explain/followup` | 带 thread id |

### 9.3 `/api/explain` 请求体

```json
{
  "locale": "en",
  "region_id": "us_midwest",
  "household": { "...": "..." },
  "weights": { "w_cost": 40, "w_carbon": 30, "w_comfort": 20, "w_simple": 10 },
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

System prompt 要点（英文）：

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

### 9.5 与 V1 prompt 的关系

- V1：`api/chat.js` 三套中文 farmer/student prompt → **保留**。
- V2：新建 `api/explain.js` + `prompts/globalExplain.en.md` → **不要混在一个 handler 里**。

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
| i18n | `en.json` / `zh.json` | Global 先 EN |

### 10.3 路由部署（Vercel）

```json
{
  "rewrites": [
    { "source": "/global", "destination": "/global/index.html" },
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
- [ ] 新建 `/global` 入口与 G0–G2 静态页（无打分）
- [ ] 新建 `/impact`、`/about`、`/media` 三个 COP31 申报支撑页的静态版
- [ ] `data/regions` + `data/technologies` 各 3 条样例 JSON，必须含 China + 2 个海外地区
- [ ] 首页写明 “Youth-led climate action · China pilot to global tool”

**验收**：评审打开首页 30 秒内能看懂这是全球青年气候行动项目；能选 region、填表、数据写入 console；China pilot 仍可进入。

### Phase 1 · 2–3 周 — 全球打分 MVP + 影响力证据

- [ ] 实现 `hardFilter` + 五维分 + `fitness` 排序
- [ ] G3 权重 + G4 结果表 + 雷达图
- [ ] G6 `ActionSummaryCard` 下载 PNG/复制文字
- [ ] `/impact` 接入静态或 Supabase 汇总数据：valid sessions、completed surveys、understanding gain、recommendation rate
- [ ] 单元测试 ≥10 cases
- [ ] **至少 5 个 region × 8 tech**：China North China + US Midwest + Germany rural + UK off-gas + France rural

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

1. **功能**：Global 全流程 G0→G8 无 dead end；China pilot 仍可独立进入并完成一局。
2. **正确性**：scoring 模块有单测；hard exclude 理由可见。
3. **AI 安全**：prompt injection 测试：用户填 `"ignore rules"` 不改变 fitness。
4. **性能**：打分 < 200ms（前端）；AI 首 token < 5s（依赖 API）。
5. **隐私**：无 PII 强制；Supabase 仅存匿名 session。
6. **COP31 传播**：`/impact`、`/about`、`/media` 可公开访问；有中英项目简介、影响力数字、行动摘要卡、demo 视频入口。
7. **文档**：README 增加 Global mode、China pilot、COP31 media kit 与环境变量说明。

---

## 13. 给开发同学的快速 FAQ

**Q: 分数和 AI 谁说了算？**  
A: **分数 = TypeScript 算法**；AI 只解释。

**Q: 必须先重写整个 index.html 吗？**  
A: 不必。可新建 `global/index.html` + 共享 `lib/scoring.js`。

**Q: 中国用户还会用旧版吗？**  
A: 会，但它是 **China Pilot**。主入口必须是 Global Pathfinder，因为 COP31 项目不能只局限于中国北方农村。

**Q: 价格数据从哪来？**  
A: MVP 用 `research/data/calibration_defaults.json` + 手工 `regions/*.json`；UI 标明 “approximate range”。

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

## 15. 产品负责人待办（非开发）

- [ ] 确认 Phase 1 首发 5 个 region 的具体参数来源（China + US + Germany + UK + France）
- [ ] 准备中英双语项目简介：100 字、500 字、2000 字三个版本
- [ ] 准备 COP31 申报所需 supporting materials：demo 视频、截图、数据报告、活动照片
- [ ] 明确弱势群体包容叙事：农村、低收入、偏远地区、能源负担高家庭如何受益
- [ ] 确认 Global UI 是否要中英切换（建议首页/impact/about/media 中英双语，工具流程先 EN）
- [ ] 准备 5 组「典型家庭」fixture 供测试与 demo
- [ ] 免责声明给导师/课程过目

---

*文档结束。有问题直接在 GitHub issue 或飞书/微信里 @Guo Hang，并附上 region_id / tech_id 讨论具体规则。*
