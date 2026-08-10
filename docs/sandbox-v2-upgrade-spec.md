# Climate Adaptation Energy Advisor — Global Upgrade Spec

> **文档用途**：给负责改网站的同学（CS 背景）看的**产品 + 技术 + UI 全文说明**。  
> **产品负责人**：Guo Hang  
> **当前线上版本**：https://www.clean-heating-simulator.com（根目录 `index.html` + Vercel `api/`）  
> **本文档版本**：2026-08-10 · Implementation handoff hardening pass (Markdown-only)
> **重要边界**：本文是给 CS 技术协作者看的 development specification。本轮只加固 handoff 清晰度，不改变产品页面思路，不实现网站/API/数据库/数据文件。

---

## 0. 一句话目标

把现有「华北村级煤改 X 五回合沙盘」升级为 **Climate Adaptation Energy Advisor（气候适应家庭能源选择助手）**——用户在全球地图上点击自家位置 → 系统识别位置（**中国/美国精确到省或州**；**其余国家只识别到国家**）→ 载入对应气候数据（中美用省/州首府气候代表；其余国家用 Köppen 标准 profile）→ 用户补充家庭数据 → **规则引擎算出不同取暖/制冷方案的适配分** → **AI 用 plain language 解释分数、填补跨国技术信息差** → 用户可选择保存家庭能源摘要卡（G6，optional）→ 可选匿名反馈与 Impact 证据页。

**核心原则**：
- **分数由算法给，不由 AI 编造**（AI 只解释、翻译、对照，不凭空写补贴金额或 COP）。
- **Global-first**：COP 项目不能局限于中国北方农村；中国北方是第一个实证试点和故事起点，不是产品边界。
- **保留 V1** 作为 China pilot / evidence mode，用来展示已完成研究与早期内部测试证据。正式公开口径：**50+ internal-test participants · limited internal testing · not publicly released**。
- **默认静态、低门槛**：无需注册即可试用；研究数据仍匿名入库（Supabase）。
- **公开页面不写 COP31**：网站面对普通用户时只呈现为气候适应与家庭能源选择工具，避免让人感觉是专门为某个征集项目包装出来的。COP31 只作为内部申报背景和材料准备目标。
- **申报友好但不牺牲产品主线**：网站必须能支撑案例材料，但 MVP 优先级为 Global Advisor 主流程、Impact & Evidence、My Story。Media Kit / Project Resources 只是未来可选资源，不阻塞上线。

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


## 0.2 Implementation handoff contract

This document is the **implementation specification** for the CS collaborator.

Product decisions marked **MUST / MUST NOT / 必须 / 禁止** are **locked** unless Guo Hang explicitly approves a change.

CS may choose implementation details **only** where this document explicitly says:

- implementation choice
- recommended
- optional
- future

CS should **not** independently change:

- page flow (G0–G7)
- scoring weights
- G1 location logic
- G2 / G3 questions
- technology screening principles
- G4 four-dimension model
- AI role boundary
- G6 behavior
- G7 questions
- Story structure
- Impact metric definitions
- bilingual content meaning

If implementation constraints require changing one of these:

```text
STOP
→ document the issue
→ ask Guo Hang
→ do not silently redesign
```

中文：本规格中 **MUST / MUST NOT / 必须 / 禁止** 的内容视为锁定产品要求。遇到实现冲突时先停下来询问，不要静默改产品。

---

## 0.3 Source-of-truth hierarchy

整份 MD 很长。冲突时按下列优先级，**不要自行挑选“看起来更新的句子”**。

### Product / UX

1. §4 Global flow  
2. §5 UI + bilingual copy  
3. specific G-page section（G0–G7 / Story / Impact）  
4. wireframe / ASCII layout = visual guidance only  

### Scoring

1. §7.4–§7.12  
2. `RankedPath` contract（§7.10）  
3. Internal Appendix = catalog **audit / documentation only**  

如果 UI 示例数字和 §7 公式冲突：**§7 胜出**。

### Technology catalog

| Role | Path |
|------|------|
| Runtime source of truth | `docs/data/technologies/technology_catalog.json` |
| Schema | `docs/data/technologies/technology_catalog.schema.json` |
| Internal Appendix | audit only |

**禁止**从 Markdown table 在 runtime 重建 catalog。

### Local scoring data

| Role | Path |
|------|------|
| Runtime source of truth | `docs/data/scoring/*.json`（Guo 后续补齐） |
| Provenance | required for every LOCAL_PUBLIC field |
| Markdown numbers | illustrative only |

### Climate

| Region class | Runtime source |
|--------------|----------------|
| China / US | `docs/data/climate/cn_us_admin1_capitals.json` |
| Other countries | `docs/data/climate/climate_profiles.json` |

### AI

1. G5 two-mode product behavior（`selected_path_explanation` / `household_analysis_report`）  
2. §9 API / prompt contract  

如果旧 §9 单 prompt 示例与最新 G5 双 mode 冲突：**G5 two-mode behavior 胜出**；本 handoff pass 已把 §9 修正到一致。

### Story copy

§ Evidence & Story Pages（§5 内 Story 小节）

### Impact metrics

§ Impact（§5） + §8.4 analytics definitions

### Deployment

§10

### Delivery order

§11

---

## 0.4 CS handoff package manifest

Status values（基于 **2026-08-10 仓库扫描**，不是 MD 假设）：

| Status | Meaning |
|--------|---------|
| **EXISTS** | 仓库中已有（含 git tracked） |
| **MISSING** | 当前仓库没有；实现前需由指定 Owner 提供或创建 |
| **PLANNED** | 规格要求存在，但尚未落地 |
| **OPTIONAL** | 非 MVP blocker |
| **LEGACY** | 旧版/China Pilot 资产，Global 可参考但不要覆盖 |

| File / directory | Status now | Owner | Required for | Purpose | Runtime? | Notes |
|------------------|------------|-------|--------------|---------|----------|-------|
| `index.html` | EXISTS | shared | China Pilot | V1 完整 UI + 模拟 | yes (Pilot) | LEGACY for Global; keep at `/china` |
| `api/chat.js` | EXISTS | CS | China Pilot AI | V1 debrief | yes (Pilot) | Do not replace with Global explain |
| `api/supabase-config.js` | EXISTS | CS | Pilot / future Global | expose public Supabase config | yes | no secrets in client |
| `api/explain.js` | EXISTS | CS | Global G5 | Global AI endpoint shell | yes | already present; align with §9 two-mode |
| `api/global-ai.js` | EXISTS | CS | Global G5 | prompt builders | yes | server-side prompts |
| `api/global-feedback.js` | EXISTS | CS | Global G7 | feedback API | yes | writes `global_feedback` when configured |
| `algori_spec.md` | EXISTS | Guo | Pilot reference | V1 formulas | no | LEGACY reference |
| `research/data/calibration_defaults.json` | EXISTS | Guo | Pilot | V1 constants | yes (Pilot) | LEGACY |
| `spec.md` | EXISTS | Guo | context | older MVP scope | no | LEGACY; Global truth is this Upgrade Spec |
| `paper/main.tex` | EXISTS | Guo | narrative | paper | no | |
| `paper/defense-slides/indexxx.html` | EXISTS | Guo | visual ref | defense deck | no | |
| `docs/data/climate/cn_us_admin1_capitals.json` | **MISSING** | **Guo** | G1 China/US | admin1 capital climate | **yes** | Guo must supply before full G1 |
| `docs/data/climate/climate_profiles.json` | **MISSING** | **Guo** | G1 other countries | Köppen profiles | **yes** | Guo must supply |
| `docs/data/climate/` | **MISSING** | Guo | G1 | climate data dir | yes | create when providing JSONs |
| `docs/data/maps/admin0-boundaries.geojson` | **MISSING** | Guo/CS | G1 map | country polygons | yes | Guo provides or approves source; CS wires loader |
| `docs/data/maps/admin1-cn-us.geojson` | **MISSING** | Guo/CS | G1 map | CN/US admin1 | yes | same |
| `docs/data/maps/populated-places.geojson` | **MISSING** | OPTIONAL | G1 map labels | places | optional | OPTIONAL |
| `docs/global-climate-zones-koppen-source.svg` | EXISTS | Guo | G1 design ref | Köppen visual source | no | not runtime climate values |
| `docs/global-climate-zones-map-source.md` | EXISTS | Guo | G1 notes | map source notes | no | |
| `docs/data/technologies/technology_catalog.json` | EXISTS | Guo+CS | G3→G4 | runtime tech catalog | **yes** | SOT for technologies |
| `docs/data/technologies/technology_catalog.schema.json` | EXISTS | CS | validation | schema | yes (validate) | |
| `docs/data/scoring/residential_energy_prices.json` | **MISSING** | **Guo** | G4 Affordability | LOCAL_PUBLIC prices | **yes** | inventing forbidden |
| `docs/data/scoring/technology_performance.json` | **MISSING** | **Guo** | G4 Climate/Afford. | COP/SCOP/SEER etc. | **yes** | |
| `docs/data/scoring/technology_installed_costs.json` | **MISSING** | **Guo** | G4 Affordability | installed costs | **yes** | |
| `docs/data/scoring/electricity_emission_factors.json` | **MISSING** | **Guo** | G4 Environment | grid factors | **yes** | may be null → incomplete E |
| `docs/data/scoring/fuel_emission_factors.json` | **MISSING** | **Guo** | G4 Environment | fuel factors | **yes** | |
| `docs/data/scoring/infrastructure_availability.json` | **MISSING** | **Guo** | G3 screen / G4 | gas/district etc. | **yes** | |
| `docs/data/scoring/scoring_data_sources.json` | **MISSING** | **Guo** | provenance | source registry | yes | recommended |
| `docs/data/scoring/` | **MISSING** | Guo | G4 | scoring data dir | yes | |
| `docs/story/images/story-hero-rooftop-solar.jpg` | EXISTS | Guo | Story | hero photo | yes (Story) | |
| `docs/story/images/story-01-question-gas-meter.jpg` | EXISTS | Guo | Story | section 01 | yes | |
| `docs/story/images/story-02-china-pilot-ui.jpg` | EXISTS | Guo | Story | section 02 | yes | |
| `docs/data/supabase/global_feedback.sql` | EXISTS | CS | G7 | create `global_feedback` | apply once | SQL exists; table must be applied in Supabase by CS |
| `docs/global/app.js` | EXISTS | CS | Global prototype | current prototype logic | prototype | not full production UI |
| `docs/global/g4-ai-state.js` | EXISTS | CS | G4 AI helpers | request builders | prototype | |
| `docs/global/g7-feedback.js` | EXISTS | CS | G7 helpers | feedback payload | prototype | |
| `docs/global/index.html` | EXISTS (git) | CS | Global prototype shell | HTML shell | prototype | tracked in git; restore if missing locally |
| `docs/src/global/*` | EXISTS | CS | scoring / feedback TS | deterministic modules | build → dist | |
| `docs/src/technologies/*` | EXISTS | CS | catalog loader | load/filter catalog | yes | |
| `docs/tests/global/*` | EXISTS | CS | regression | Node tests | no | keep green |
| `i18n/en.json` / `i18n/zh.json` | **MISSING** | CS | production i18n | locale dictionaries | planned | prototype currently inlines copy; production SHOULD move to i18n |
| `prompts/*` | **MISSING** | CS | optional file split | prompt modules | optional | prompts currently live in `api/global-ai.js` |
| `vercel.json` | EXISTS | CS | deploy | rewrites | yes | |
| `package.json` / `tsconfig.json` | EXISTS | CS | build/test | tooling | yes | no Vite config in repo |
| `.cursor/skills/frontend-design/` | EXISTS | CS | design guidance | optional skill | no | OPTIONAL |

---

## 0.5 Responsibility matrix

### Guo Hang / product owner

负责：

- 最终产品规则  
- G1–G7 产品决策  
- scoring methodology approval  
- technology catalog content approval  
- LOCAL_PUBLIC data source selection / review  
- China Pilot evidence wording  
- Story / Impact wording  
- real project photos  
- disclaimers final approval  
- 典型家庭 fixtures  
- 对科学数据与来源最终负责  

### CS collaborator

负责：

- website architecture  
- frontend implementation  
- routing / state management  
- map interaction  
- data loaders  
- deterministic scoring implementation  
- UI rendering  
- API implementation  
- AI request routing  
- i18n implementation  
- Supabase integration  
- PNG export (G6)  
- responsive implementation  
- accessibility  
- tests  
- deployment  

### Very important

CS **不应自行**：

- invent technology performance  
- invent installed cost  
- invent emission factors  
- choose arbitrary fallback scientific numbers  
- change scoring weights  
- change hard-filter logic  
- change public impact numbers  

如果所需数据缺失：

```text
implement NULL / missing behavior (§7.10 / §7.11)
+
report missing dataset to Guo
```

**不要自己补“合理默认值”。**

---

## 0.6 Implementation blockers / data readiness

| Dependency | Needed by | Can UI work without it? | Scoring effect if missing | Who resolves |
|------------|-----------|-------------------------|---------------------------|--------------|
| Climate: CN/US admin1 capitals JSON | G1 / G4 Climate | Map UI can scaffold; real climate cards need data | Climate dimension incomplete / insufficient | **Guo** |
| Climate: Köppen profiles JSON | G1 other countries | same | same | **Guo** |
| Map boundaries GeoJSON | G1 | placeholders possible | no direct score | Guo provides source; CS loads |
| Technology catalog JSON | G3→G4 | no real ranking without it | **blocker for scoring** | EXISTS now (Guo maintains content) |
| Residential energy prices | G4 Affordability | UI can show unavailable | A incomplete or insufficient_data | **Guo** |
| Technology performance | G4 A/C | same | same | **Guo** |
| Installed costs | G4 Affordability | same | skip upfront subscore | **Guo** |
| Emission factors | G4 Environment | yes | E incomplete; normalize weights | **Guo** |
| Infrastructure availability | screening / Practicality | warnings | soft warning or hard exclude only if verified false | **Guo** |
| Extreme temperature proxy | Climate extremes | yes | extreme component omitted | **Guo** |
| `DEEPSEEK_API_KEY` | G5 | yes | AI unavailable; scores unchanged | CS env / Guo ops |
| Supabase `global_feedback` table | G7 persist | yes (Skip still works) | feedback save fails; flow continues | CS applies SQL |
| Site visit analytics | Impact visits | yes | metric unavailable | future / OPTIONAL |

### Climate coverage requirement

G1 需要覆盖全局两类：

1. China / US admin1 capital climate  
2. other-country Köppen profile  

### G4 scoring data readiness

不是所有国家都必须一开始拥有完整 LOCAL_PUBLIC 数据。  
但 **不得因为缺数据而 invent**。某地区缺失时 follow §7.10 / §7.11。

### Launch data gate（正式展示完整 Fitness 前）

至少要能计算：

- Affordability  
- Climate Resilience  
- Practicality  

Environment 可以缺失，并进行 available-weight normalization。

如果 A / C / P **任一完全不可算**：

```text
path.status = "insufficient_data"
```

不要显示假精确 Fitness。

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

## 3. 产品形态：Global-first 入口 + Story / Impact 支撑

首页改成 **Global-first landing**。第一屏主 CTA 必须进入 Climate Adaptation Energy Advisor；China Pilot 作为轻量入口放在导航中；My Story 负责叙事；Impact 负责证据。不要把 `/story` 做成 Impact Dashboard，也不要把 `/impact` 写成个人故事页面。

```
┌─────────────────────────────────────────────────────────┐
│  Climate Adaptation Energy Advisor           English/中文 │
│  China Pilot · Impact                                      │
│                                                           │
│  Find a heating and cooling path that fits your home,      │
│  your local climate, and your budget.                     │
│                                                          │
│  [ Start from the map — about 3 minutes ]                 │
│  See my story →                                           │
│                                                          │
│  China pilot → global household energy advisor            │
└──────────────────────────────────────────────────────────┘
```

| 页面/模式 | 路由建议 | 说明 |
|-----------|----------|------|
| Climate Adaptation Energy Advisor | `/` 或 `/global` | **主入口**：面向国际用户的全球取暖/制冷适配工具 |
| China Pilot Sandbox | `/china` | 现有 `index.html` 流程，作为中文试点和已验证案例 |
| My Story | `/story` | 项目缘起、发展过程、工具原理、早期影响、学生发起与下一步 |
| Impact & Evidence | `/impact` | China Pilot 证据、Global site visits、Global feedback、数据口径与方法说明 |
| About（deprecated） | `/about` | 不再作为正式页面；未来实际开发可 redirect `/about` → `/story`，本规格不实现 redirect |
| Media Kit / Project Resources | `/media` | Optional future route；不进 MVP 主导航，不阻塞 Global Advisor 上线 |

---

## 4. Global mode 用户流程（逐步）

```
Global Landing (G0)
    ├─ Start from the map → G1 climate map → Household form
    │     → Home feasibility questionnaire → [Screen paths]
    │     → G4 Results + inline AI analysis
    │           ├─ [ Save my summary ] → optional G6 (PNG summary card)
    │           ├─ optional G7 feedback
    │           └─ finish / return / continue as product flow defines
    │
    ├─ See my story → /story  → Back to advisor (G0) 或 Start assessment (G1)
    └─ Nav Impact → /impact → Back to advisor (G0)
```

| 步骤 | 页面 ID | 目的 |
|------|---------|------|
| G0 | `global-landing` | 全球价值主张 + 气候适应家庭能源选择定位 + 免责声明（公开文案不写 COP31） |
| G1 | `global-climate-map` | 用户在可缩放全球地图上点击自家位置 → **中国/美国识别到省或州并载入该省/州首府气候**；**其余国家只识别到国家并用 Köppen 标准 profile** |
| G2 | `global-household` | 家庭与建筑、账单 |
| G3 | `global-home-feasibility` | 不超过 8 个住宅可行性问题，供后台自动筛选候选路径 |
| G4 | `global-results` | 适配分排序 + selected path detail + **inline AI Analysis Panel** |
| G5 | *(embedded module)* | AI 解释能力模块；**不作为独立跳转页面**，输出渲染在 G4 |
| G6 | `global-action-summary` | **Optional** utility：把 G4 `#1` 结果整理成可保存到本地的家庭能源摘要卡（PNG only；不依赖 AI） |
| G7 | `global-feedback` | **Optional** one-minute feedback（理解度 / AI 有用性 / 改进建议；可 Skip） |

| 申报/传播页面 | 页面 ID | 目的 |
|----------------|---------|------|
| My Story | `story` | 讲清项目缘起、从中国试点到全球工具的发展、工具差异、早期证据与下一步 |
| Impact & Evidence | `impact` | 展示 China Pilot 证据、Global site visits、Global feedback、数据定义与方法说明 |
| Media Kit / Project Resources | `media` | Optional future resources；不属于核心 MVP，不在主导航抢叙事 |
| China Pilot | `china` | 保留现有中国北方五回合沙盘，作为已验证的第一阶段案例 |

---

## 5. 界面说明与界面文案（Bilingual UI copy）

> 以下英文/中文文案可直接进前端；正式实现必须由 i18n 字典驱动。

### G0 · Landing

**Layout**
- 顶栏：Logo / Project name + `China Pilot` / `Impact` + **Language selector（English / 中文）**
- 主导航不要显示 `About` / `Media Kit`。`About` 已由轻量文字 CTA `See my story →` 指向 `/story`；Media Kit 不属于普通用户核心体验。
- Hero：公开品牌名 + 副标题 + 主按钮 + 轻量文字 CTA。
- `Start from the map` 是唯一视觉主按钮；`See my story →` 是更轻的 secondary text CTA，不要与主按钮同等抢眼。
- 用户在首页选择语言后，后续 G1–G7 以及 `/story`、`/impact` 的所有文字信息都使用对应语言。`/media` 若未来实现，也必须跟随同一 locale。

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Language label | Language |
| Language option EN | English |
| Language option ZH | 中文 |
| Nav | Logo / Project name · China Pilot · Impact · English / 中文 |
| Title | **Climate Adaptation Energy Advisor** |
| Subtitle | Find a heating and cooling path that fits your home, your local climate, and your budget. |
| Primary CTA | **Start from the map — about 3 minutes** |
| Secondary text CTA | **See my story →** |
| Secondary target | `/story` |
| Bullet 1 title | Household-first |
| Bullet 1 body | Enter income, home size, and energy bills. See what fits you. |
| Bullet 2 title | Scores you can trace |
| Bullet 2 body | Each path gets a fitness score from clear rules—not AI guesswork. |
| Bullet 3 title | Plain-language guide |
| Bullet 3 body | AI explains trade-offs and technologies you may not know in your country. |
| Disclaimer | *Decision support only. Not engineering design, installation quote, or legal advice. Local installers must confirm sizing and safety.* |
| Footer | Anonymous · No account required · ~3 min |

**中文 Copy（G0 必须提供）**

| 元素 | 中文文案 |
|------|----------|
| Language label | 语言 |
| Language option EN | English |
| Language option ZH | 中文 |
| Nav | Logo / Project name · China Pilot · Impact · English / 中文 |
| Title | **气候适应家庭能源选择助手** |
| Subtitle | 结合你家的情况、当地气候和预算，比较可能适合你的取暖与制冷路径。 |
| Primary CTA | **从地图开始 — 约 3 分钟** |
| Secondary text CTA | **查看我的故事 →** |
| Secondary target | `/story` |
| Bullet 1 title | 以家庭为中心 |
| Bullet 1 body | 输入收入、住房面积和能源账单，查看适合你的方案。 |
| Bullet 2 title | 分数可追溯 |
| Bullet 2 body | 每条路径都由清晰规则打分，不是 AI 猜测。 |
| Bullet 3 title | 通俗解释 |
| Bullet 3 body | AI 会用易懂语言解释取舍，也补充你所在国家可能不熟悉的技术信息。 |
| Disclaimer | *本工具仅作决策参考，不是工程设计、安装报价或法律建议。设备选型、安全与合规需由当地安装人员确认。* |
| Footer | 匿名 · 无需账号 · 约 3 分钟 |

**Language behavior（必须实现）**

- 首页右上角提供语言选项：`English` / `中文`。
- 语言选择写入 `localStorage.locale`，并可同步到 URL query（如 `?lang=zh` / `?lang=en`）方便分享。
- 默认语言：若浏览器语言以 `zh` 开头则默认中文，否则默认英文；用户手动选择后以用户选择为准。
- 语言选择后，全流程所有 UI 文案、按钮、表单提示、验证错误、结果页说明、`/story`、`/impact`、AI explanation 请求的 `locale` 都使用对应语言。
- 不要同屏双语显示。用户选择 English，则 `/story` 与 `/impact` 全部英文；用户选择中文，则全部中文。Markdown 中保留中英两套 copy，只是供 CS 接入 i18n。
- 文案来源必须走 i18n 字典：`i18n/en.json` 与 `i18n/zh.json`。不要在组件里硬编码英文或中文。

**禁止出现在 G0 的公开文案**
- `COP31`
- `case collection`
- `application`
- `申报`
- `征集`
- 任何让用户觉得“这个网站是为了某个活动临时包装”的表述

**支线入口（详见紧接本节的 Evidence & Story Pages）**
- 进 Story：点 `See my story →` / `查看我的故事 →`
- 进 Impact：点顶栏 `Impact`
- 回主线：Story / Impact 页顶 `← Back to the advisor` / `← 返回家庭能源助手` → G0；Story 页底 `Start your home assessment` / `开始家庭评估` → G1
- 不进支线、直接主线：点 `Start from the map — about 3 minutes` / `从地图开始 — 约 3 分钟` → G1

---

### Evidence & Story Pages

> **文档位置**：本规格把 Story / Impact 写在 G0 与 G1 之间，因为它们是从 Landing 分支出去的支撑页，不属于 G1–G7 评分主线。

这些页面不属于 G1–G7 household scoring flow。用户不需要经过 Story 或 Impact 才能完成家庭评估。

#### 从 G0 进入 / 回到主线（必须实现）

| 用户动作（G0） | 进入页面 | 回主线怎么走 |
|----------------|----------|--------------|
| 点击 Hero 轻量文字 CTA **`See my story →` / `查看我的故事 →`** | `/story` · My Story | 页顶 **`← Back to the advisor` / `← 返回家庭能源助手`** → 回到 G0 Landing；或页底唯一主 CTA **`Start your home assessment` / `开始家庭评估`** → 进入 G1 主线 |
| 点击顶栏 **`Impact`** | `/impact` · Impact & Evidence | 页顶返回入口（与 Story 同级实现）**`← Back to the advisor` / `← 返回家庭能源助手`** → 回到 G0 Landing；也可再点顶栏 Logo / Project name → G0 |
| 点击顶栏 **`China Pilot`** | `/china` · China Pilot（现有沙盘）https://www.clean-heating-simulator.com(目前中国区网址，后面你可以改，但是要保证中国和全球两个网站挂不挂VPN都能进入) | 由 China Pilot 自身导航返回 Global Landing（`/` 或 `/global`）；不属于 Story/Impact 叙事页 |
| 点击主按钮 **`Start from the map — about 3 minutes` / `从地图开始 — 约 3 分钟`** | **不进入** Story/Impact | 直接进入 **G1** 评分主线 |

补充规则：

- Story / Impact 是 **可选支线**。用户可以完全跳过，只点 G0 主按钮进入 G1。
- 从 `/story` 回到主线有两条合法路径：① 页顶 Back → **G0**；② 页底 `Start your home assessment` → **G1**。不要在 Story 页底再放 `View full impact` 或 `Project resources`。
- 从 `/impact` 回到主线：页顶 Back → **G0**。Impact 页不要抢走 G0 的主评估 CTA 叙事；若提供继续评估入口，文案权重必须轻于 Back，且目标仍是 G0 或 G1。
- Logo / Project name 在 Story / Impact 顶栏也应回到 G0。
- `/media` 不进 G0 主导航，因此 **没有** 从 G0 进入 `/media` 的 MVP 路径。

```text
G0 Landing
│
├── [Start from the map] ───────────────► G1 → G2 → G3 → G4 → …
│
├── [See my story →] ──► /story
│                         ├─ [← Back to the advisor] ──► G0
│                         └─ [Start your home assessment] ──► G1
│
├── Nav [Impact] ───────► /impact
│                         └─ [← Back to the advisor] ──► G0
│
└── Nav [China Pilot] ──► /china ──► (return to Global Landing)
```

MVP 公共页面优先级：

| 页面 | 路由 | MVP 优先级 | 作用 |
|------|------|------------|------|
| My Story | `/story` | Public MVP recommended / important | 负责叙事：项目为什么开始、如何发展、由谁推动、下一步要解决什么 |
| Impact & Evidence | `/impact` | Public MVP recommended / important | 负责证据：China Pilot 内测证据、Global site visits、Global feedback、数据口径 |
| Media Kit / Project Resources | `/media` | Optional future | 未来资源页；不进主导航，不进 Story final CTA，不阻塞 Global Advisor 上线 |

`/story` 不能做成 Impact Dashboard。`/impact` 不能写成个人故事页。`/media` 若保留，只标注为 optional future resources。

#### `/story` · My Story

`/story` 取代原 `/about` · Youth-led Story。`/about` 不再是正式页面；未来实际开发可 redirect `/about` → `/story`，本规格只写推荐，不实现 redirect。

My Story 不是简历页、申请表内容堆砌页、技术说明书或 Impact Dashboard。目标是让普通用户、评审、老师和合作伙伴在很短时间内理解：

1. 为什么这个项目会出现；
2. 最初看到的问题是什么；
3. 项目如何从中国试点发展到全球工具；
4. 这个工具为什么与普通 AI 推荐工具不同；
5. 目前有什么早期证据；
6. 这个项目由谁发起和推动；
7. 下一步希望解决什么。

Story 页面整体视觉：editorial / documentary。继续沿用暖米白背景和森林绿 accent，但建议更大的标题、更多留白、少量真实照片、时间线、impact numbers。大段 card 尽量减少，不要把每一段都包在白色圆角 card 中。

Story 页面只保留：

1. Hero
2. 01 · The Question
3. 02 · How It Grew
4. 03 · How the Tool Works
5. 04 · Early Impact
6. 05 · Built from a Student Question
7. 06 · What's Next
8. Final CTA

不要再额外增加大量项目介绍 section。

##### My Story Hero copy

| 元素 | English |
|------|---------|
| Eyebrow | MY STORY |
| Heading | From cleaner skies to a harder question at home. |
| Body | I started this project with a simple question: when cleaner-energy transitions change how families heat and cool their homes, who helps ordinary households understand what actually fits their climate, budget, and living conditions? |
| Supporting line | From a household-energy study in northern China to a global climate-adaptation decision tool. |
| Byline | A student-led climate and household energy project. |
| Back link | ← Back to the advisor |

| 元素 | 中文 |
|------|------|
| Eyebrow | 我的故事 |
| Heading | 从更蓝的天空，到一个更难回答的家庭问题。 |
| Body | 这个项目最初来自一个很简单的问题：当清洁能源转型改变家庭取暖和制冷方式时，谁来帮助普通家庭理解，究竟什么方案真正适合自己的气候、预算和居住条件？ |
| Supporting line | 从中国北方家庭能源研究，到面向全球家庭的气候适应决策工具。 |
| Byline | 一个由学生发起并主导的气候与家庭能源项目。 |
| Back link | ← 返回家庭能源助手 |

##### 01 · The Question

| 元素 | English |
|------|---------|
| Eyebrow | 01 · THE QUESTION |
| Heading | Cleaner air can be a success. The transition can still be difficult at home. |
| Body | Energy transitions are often measured through emissions, infrastructure and policy. But households experience them through everyday questions: How much will this cost? Will the home stay warm in winter or cool in summer? How difficult is installation? What happens when a family does not know which technologies are available? |
| Pull quote | A climate solution also has to make sense at the household level. |
| Small labels | Cost · Climate resilience · Household constraints · Access to information |

| 元素 | 中文 |
|------|------|
| Eyebrow | 01 · 问题从哪里开始 |
| Heading | 空气可以变得更清洁，但能源转型对家庭来说仍然可能很困难。 |
| Body | 能源转型往往通过排放、基础设施和政策来衡量，但家庭真正面对的是更日常的问题：要花多少钱？冬天能不能稳定取暖？夏天能不能有效降温？安装是否困难？如果一个家庭根本不了解有哪些技术选择，又该如何判断？ |
| Pull quote | 一个气候解决方案，也必须在家庭层面真正可行。 |
| Small labels | 家庭成本 · 气候适应 · 住宅条件 · 信息获取 |

##### 02 · How It Grew

| 元素 | English |
|------|---------|
| Eyebrow | 02 · HOW IT GREW |
| Heading | One question became a pilot, and the pilot became a broader tool. |

| Timeline | Label | English copy |
|----------|-------|--------------|
| 1 | RESEARCH | I began by studying how household heating transitions can create different experiences for policy, climate outcomes and household well-being. |
| 2 | CHINA PILOT | I then developed an interactive China pilot to explore how people understand household heating choices and their trade-offs. |
| 2 Evidence | 50+ internal-test participants | Limited internal testing with students from my school and a small number of farmers and village committee staff from communities in Hebei. The China pilot has not been publicly released. |
| 3 | GLOBAL ADVISOR | The next step was to expand the question beyond one region and beyond heating alone: What happens when climate, household income, cooling needs, installation constraints and different technologies all have to be considered together? |
| 4 | NOW | The result is the Climate Adaptation Energy Advisor: a tool where deterministic rules calculate the ranking and AI helps people understand what the results mean. |

| 元素 | 中文 |
|------|------|
| Eyebrow | 02 · 项目如何一步步发展 |
| Heading | 一个问题变成了一次试点，而试点又发展成了一个更广泛的工具。 |

| Timeline | Label | 中文文案 |
|----------|-------|----------|
| 1 | 研究 | 我最初关注的是：家庭取暖转型在政策效果、气候目标和家庭生活体验之间，可能产生怎样不同的结果。 |
| 2 | 中国试点 | 随后，我设计了一套互动式中国试点，用来探索人们如何理解家庭取暖选择，以及不同方案之间的取舍。 |
| 2 Evidence | 50+ 名内测参与者 | 有限内部测试包括我校学生，以及河北部分村落的少量农民和村委工作人员。中国试点目前尚未进行公开发布。 |
| 3 | 全球家庭能源助手 | 下一步，我把问题从一个地区扩展到全球，也从单纯取暖扩展到取暖和制冷：当气候、家庭收入、住宅条件、安装限制以及不同能源技术同时进入决策时，我们该如何比较？ |
| 4 | 现在 | 最终形成了 Climate Adaptation Energy Advisor：由确定性算法计算排序，由 AI 帮助用户理解这些结果意味着什么。 |

##### China Pilot public data wording

整份公开页面统一口径：

- `50+ internal-test participants`
- `limited internal testing`
- `not publicly released`
- 参与者包括我校同学、河北部分村落的农民、河北部分村落的村委工作人员
- 不公开显示学生、农民、村委工作人员的具体人数拆分
- 不把旧版 valid-session / completed-survey counts 作为 Story / Impact 主 headline。若旧研究数字仍需保留，只能放在内部 research appendix 或 Methodology 的历史记录中，并清楚标注来源、范围和非公开性质。

公开解释文案：

| Language | Copy |
|----------|------|
| English | Limited internal testing only. The China pilot was tested with more than 50 participants, including students from my school and a small number of farmers and village committee staff from communities in Hebei. It has not been publicly released, so these figures should be interpreted as early, exploratory evidence rather than public-user statistics. |
| 中文 | 仅限小规模内部测试。中国试点目前已有 50 余名内测参与者，包括我校学生，以及河北部分村落的农民和村委工作人员。项目尚未进行公开发布，因此这些数据属于早期探索性证据，不代表公开用户统计。 |

##### 03 · How the Tool Works

| 元素 | English |
|------|---------|
| Eyebrow | 03 · HOW THE TOOL WORKS |
| Heading | The score comes from the data. The explanation comes from AI. |

| Step | Title | English copy |
|------|-------|--------------|
| 1 | YOUR HOME | The tool starts with what matters to the household: income, home size, energy bills, heating and cooling needs, and practical home conditions. |
| 2 | LOCAL PUBLIC DATA | It combines those answers with traceable public data for the user's location, such as climate, energy prices and emissions factors. |
| 3 | DETERMINISTIC SCORING | Eligible paths are compared through transparent formulas for affordability, climate resilience, environmental impact and practicality. |
| 4 | AI EXPLANATION | AI explains the existing scores in plain language. It does not calculate, change or reorder the results. |
| Bottom line |  | User answers + local public data → deterministic scoring → AI explanation |

| 元素 | 中文 |
|------|------|
| Eyebrow | 03 · 这个工具如何工作 |
| Heading | 分数来自数据，解释来自 AI。 |

| Step | Title | 中文文案 |
|------|-------|----------|
| 1 | 你的家庭 | 工具首先关注真正与家庭有关的信息：收入、住宅面积、能源账单、取暖与制冷需求，以及住宅实际条件。 |
| 2 | 当地公开数据 | 系统再结合用户所在地可追溯的公开数据，例如气候、能源价格和排放因子。 |
| 3 | 确定性算法评分 | 通过筛选的路径按照明确公式，从家庭可负担性、气候适应与可靠性、环境影响和实施适配性四个方面进行比较。 |
| 4 | AI 解释 | AI 用更容易理解的语言解释已经计算好的结果，但不会计算、修改或重新排序这些分数。 |
| Bottom line |  | 用户回答 + 当地公开数据 → 确定性评分 → AI 解释 |

##### 04 · Early Impact

| 元素 | English |
|------|---------|
| Eyebrow | 04 · EARLY IMPACT |
| Heading | What we are learning so far |

| Metric | English label |
|--------|---------------|
| `50+` | China pilot internal-test participants |
| `{global_site_visit_count}` | Global site visits |
| `{global_feedback_count}` | Global feedback responses |
| `{understanding_positive_rate}%` when enough G7 feedback exists | said the tool helped them better understand their options |
| fallback when sample is small | Early feedback collecting now |

Disclaimer: Early and exploratory evidence. The China pilot was conducted as limited internal testing with students and participants from several Hebei village communities and was not publicly released. Global site visits represent recorded website visits, not verified unique individuals.

| 元素 | 中文 |
|------|------|
| Eyebrow | 04 · 早期影响力 |
| Heading | 我们目前正在了解到什么 |

| Metric | 中文标签 |
|--------|----------|
| `50+` | 中国试点内测参与者 |
| `{global_site_visit_count}` | 全球网站访问次数 |
| `{global_feedback_count}` | 全球反馈提交数 |
| `{understanding_positive_rate}%` when enough G7 feedback exists | 的反馈者表示工具帮助他们更好地理解了可选方案 |
| fallback when sample is small | 正在收集早期反馈 |

Disclaimer: 以上均为早期探索性证据。中国试点仅进行了有限内部测试，参与者包括我校学生以及河北部分村落的参与者，尚未公开发布。全球网站访问次数表示记录到的网站访问，并不等同于经过身份验证的独立个人数量。

不要为了页面排版写假百分比。数据不足时显示 `Early feedback collecting now` / `正在收集早期反馈`。

##### 05 · The People Behind It

| 元素 | English |
|------|---------|
| Eyebrow | 05 · THE PEOPLE BEHIND IT |
| Heading | Built from a student question |
| Body | I initiated the research question and led the project from the early study and China pilot through the design of the global advisor. My work has included project design, research, participant recruitment, analysis, product direction and the development of the decision framework. Also Listen to the opinions of industry insiders and feedbacks from users; collaborated with others during the process to refine the website model |



| 元素 | 中文 |
|------|------|
| Eyebrow | 05 · 项目背后的人 |
| Heading | 从一个学生的问题开始 |
| Body | 我发起了最初的研究问题，并从早期研究、中国试点一路参与并主导到全球家庭能源助手的设计。我的工作包括项目设计、研究、参与者招募、数据分析、产品方向以及决策框架的构建。也向业内人士和实际使用者征求建议和反馈；与他人合作，一起完善网站模型 |



##### 06 · What's Next

| 元素 | English |
|------|---------|
| Eyebrow | 06 · WHAT'S NEXT |
| Heading | There is no single best technology for every household. |
| Body | The next goal is not to tell every family to choose the same solution. It is to make complex household energy choices easier to understand across different climates, incomes and homes. |

| Direction | English copy |
|-----------|--------------|
| MORE PLACES | Expand reliable local public data to more countries and regions. |
| MORE HOUSEHOLDS | Learn from a wider range of households, including people with tighter budgets or fewer local energy choices. |
| BETTER EVIDENCE | Use real user feedback to improve the questions, scoring transparency and explanations. |

| 元素 | 中文 |
|------|------|
| Eyebrow | 06 · 下一步 |
| Heading | 没有一种技术会是所有家庭的唯一最佳答案。 |
| Body | 下一步的目标不是告诉所有家庭选择同一种方案，而是让不同气候、不同收入和不同住宅条件下的复杂家庭能源选择变得更容易理解。 |

| Direction | 中文文案 |
|-----------|----------|
| 覆盖更多地区 | 为更多国家和地区补充可靠、可追溯的当地公开数据。 |
| 接触更多家庭 | 从更广泛的家庭中学习，尤其关注预算更紧张、当地能源选择更有限的家庭。 |
| 建立更好的证据 | 利用真实用户反馈继续改进问题设计、评分透明度和解释方式。 |

**不要混淆**：本节是 Story 页面 `06 · What's Next`。产品流程里的 `G6 · Action Summary` 是 **optional** 的结果保存工具（PNG summary card），不是 Story 叙事页，也不再要求 PDF。

##### My Story Final CTA

Story 页面最底部只保留一个 CTA，把用户拉回核心产品主线。删除 `View full impact →` 和 `Project resources →`，不要在 Story 最后出现 secondary links。

| 元素 | English |
|------|---------|
| Heading | What could fit your home? |
| Body | Explore heating and cooling paths using your own household information and local climate. |
| Primary CTA | Start your home assessment |
| Target | G1 / start assessment flow |

| 元素 | 中文 |
|------|------|
| Heading | 哪些方案可能适合你家？ |
| Body | 使用你自己的家庭信息和当地气候，比较不同的取暖和制冷路径。 |
| Primary CTA | 开始家庭评估 |
| Target | G1 / 家庭评估主流程 |

##### Story image guidance

`/story` **只用下面这三张已入库真实素材**，不要再加第四张，也不要用 stock photo 顶替。

**素材目录（给 CS）**

```text
docs/story/images/
  story-hero-rooftop-solar.jpg      # Hero
  story-01-question-gas-meter.jpg   # 01 The Question
  story-02-china-pilot-ui.jpg       # 02 How It Grew
```

| # | 文件路径 | 用在哪 | 图里是什么 | 实现提示 |
|---|----------|--------|------------|----------|
| 1 | `docs/story/images/story-hero-rooftop-solar.jpg` | **Hero**（标题旁 / 右侧主图） | 实地拍摄：浅色建筑屋顶铺满光伏板，蓝天 + 广场瓷砖前景 | 横向构图（约 1024×768）。作 Hero 主视觉；`alt` 英文：`Rooftop solar array on a building photographed for the project`；中文：`项目实地拍摄的屋顶光伏阵列` |
| 2 | `docs/story/images/story-01-question-gas-meter.jpg` | **01 · The Question**（问题叙述旁） | 实地拍摄：砖墙上的蓝色 NB-IoT 燃气表与管线（户级能源基础设施） | 竖向构图（约 768×1024）。与「家庭层面成本 / 能源条件」叙事并排；`alt` 英文：`Smart gas meter (NB-IoT) on a brick wall`；中文：`砖墙上的 NB-IoT 智能燃气表`。图中仪表读数与序列号只作场景，**不要**在文案里当成研究统计数字引用 |
| 3 | `docs/story/images/story-02-china-pilot-ui.jpg` | **02 · How It Grew**（China Pilot timeline 旁） | China Pilot 界面截图：华北农村「空气在变好 / 费用在上升」与「参与进来」入口 | 接近方形。说明这是**试点产品 UI 证据**，不是现场人像；`alt` 英文：`Screenshot of the China Pilot welcome screen`；中文：`中国试点欢迎页界面截图` |

**不要放图的位置**

- **03 How the Tool Works**：用步骤示意（文字 / 简单流程图），不加照片。
- **04 Early Impact**：用数字与 methodology note，不加照片。
- **05 Built from a Student Question**：本轮**不再单独配图**（原先建议的第 4 张研究过程照取消；三张配额已满）。
- **06 What's Next / Final CTA**：不加照片。

**实现约束（必须遵守）**

1. 前端引用上述仓库路径（或构建时拷贝到 `/story/images/...` 静态目录）；文件名勿改，方便对照本规格。
2. 三张图均为项目真实材料：1、2 为实地照片；3 为 China Pilot UI 截图。
3. 三张图均**无人脸 / 无可识别个人肖像**，可按当前权限用于公开 `/story`。
4. 响应式：桌面 Hero 与正文并排；窄屏图在文下，避免文字叠在照片上。
5. 不要压缩到看不清仪表或 UI 文字；也不要额外加滤镜贴纸。
6. 不要把仪表读数、UI 上的 `PM2.5` / `取暖费用` 示意数字，当作 Impact 页的正式统计指标。

##### Story page wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ ← Back to advisor                       English / 中文    │
├──────────────────────────────────────────────────────────┤
│ MY STORY                                                 │
│                                                          │
│ From cleaner skies                                       │
│ to a harder question at home.                            │
│                    [story-hero-rooftop-solar.jpg]        │
├──────────────────────────────────────────────────────────┤
│ 01 · THE QUESTION                                        │
│                                                          │
│ Story / problem      [story-01-question-gas-meter.jpg]   │
│                                                          │
│ Cost · Climate · Home · Information                      │
├──────────────────────────────────────────────────────────┤
│ 02 · HOW IT GREW                                         │
│                                                          │
│ Research → China Pilot → Global Advisor → Now            │
│                    [story-02-china-pilot-ui.jpg]         │
│ China Pilot: 50+ internal-test participants              │
│ Limited internal testing · Not publicly released         │
├──────────────────────────────────────────────────────────┤
│ 03 · HOW THE TOOL WORKS                                  │
│                                                          │
│ Home                                                     │
│   + Local public data                                    │
│   ↓                                                      │
│ Deterministic scoring                                    │
│   ↓                                                      │
│ AI explanation                                           │
├──────────────────────────────────────────────────────────┤
│ 04 · EARLY IMPACT                                        │
│                                                          │
│ 50+               {visits}          {feedback}           │
│ China test         Site visits       Feedback            │
│                                                          │
│ Early / exploratory data note                            │
├──────────────────────────────────────────────────────────┤
│ 05 · BUILT FROM A STUDENT QUESTION                       │
│                                                          │
│ Short personal project-leadership paragraph              │
│ (no dedicated photo in this MVP)                         │
├──────────────────────────────────────────────────────────┤
│ 06 · WHAT'S NEXT                                         │
│                                                          │
│ More places · More households · Better evidence          │
├──────────────────────────────────────────────────────────┤
│ What could fit your home?                                │
│                                                          │
│ [ Start your home assessment ]                           │
└──────────────────────────────────────────────────────────┘
```

#### `/impact` · Impact & Evidence

Impact 页面保持独立，负责真实项目证据 / 匿名统计，不负责个人叙事。建议结构：

| Section | 内容 |
|---------|------|
| IMPACT & EVIDENCE | 页面标题与早期证据说明 |
| 01 · China Pilot | `50+` Internal-test participants · Limited internal testing only · Not publicly released |
| 02 · Global Advisor | `{global_site_visit_count}` Global site visits · `{global_feedback_count}` Feedback responses · `{understanding_positive_rate}%` Helped understand options · `{ai_helpfulness_average}/5` AI helpfulness；数据不足时显示 Early data / collecting feedback |
| 03 · What these numbers mean | China Pilot 是内部有限测试，不是公开用户；Global site visits 是访问次数，不是 verified unique individuals；Global feedback 是自愿、匿名、optional |
| 04 · Methodology note | data definition · sample size · last updated · anonymous · exploratory |

China Pilot 参与者公开描述为 students from my school + farmers / village committee staff from several Hebei village communities。不要细分人数。

Global metrics 规则：

| Metric | Definition |
|--------|------------|
| `global_site_visit_count` | 记录到的 Global site visits，不是 Global users |
| `global_feedback_count` | G7 optional feedback submissions |
| `helped_understand_average` | 非 null `helped_understand_score` 的平均值 |
| `helped_understand_positive_rate` | `helped_understand_score >= 4` / 非 null understanding responses |
| `ai_helpfulness_average` | numeric 1–5 only；排除 `not_used` 与 null |
| `ai_helpfulness_positive_rate` | numeric `ai_helpfulness >= 4` / numeric AI helpfulness responses |
| `AI usage rate` | behavioral `ai_used = true` / relevant Global sessions or submitted feedback rows，开发时需明确 denominator |

自由文本不能自动公开。`improvement_text` 或 testimonial 必须 manual review 后，才可选择少量匿名 feedback 展示。

G7 与 Impact 的关系：G7 是 optional、anonymous、not required。Impact 必须写 `X% of feedback respondents...`，不要写 `X% of all users...`。例如：

| Language | Correct wording |
|----------|-----------------|
| English | 82% of feedback respondents said the tool helped them better understand their options. |
| 中文 | 82% 的反馈提交者表示，这个工具帮助他们更好地理解了可选方案。 |

#### Impact data provenance

Impact statistics must be traceable. 每个 public metric 最好能够回答：

- what is being counted?
- where does it come from?
- what period does it cover?
- when was it last updated?

禁止过度宣称：

| 不要说 | 应改为 |
|--------|--------|
| site visits = individual users | site visits = recorded website visits |
| internal-test participants = public users | China Pilot internal-test participants |
| optional feedback respondents = all website users | feedback respondents |

Impact data must follow the same traceability principle as G4 scoring. 不要为了让页面数字好看而人为设置初始值。

#### `/media` · Optional future resources

Media Kit / Project Resources 降级为未来可选资源，不应阻塞 MVP。

`/media` 不应：

- 出现在主导航；
- 出现在 Story Final CTA；
- 阻塞 Global Advisor 上线；
- 与 Impact / Story 平级抢叙事。

若文档或未来产品保留 `/media`，必须标注 `Optional / future` 与 `Not required for core MVP`。可选资源包括 one-pager、demo video、screenshots、logo/title card、case report draft 等，但这些不是当前核心交付。

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
→ G4 进行四维打分和排序
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
| Q8 | `upfront_cost_preference` | How do you feel about the initial one-time investment? | 你对前期一次性投入的接受程度如何？ | radio cards |

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
const rankedPaths = scoreAndSort(candidatePaths, baseline, household, region, climate, localPublicData)
```

- 后台默认载入全部技术目录，并按 G1/G2/G3 数据确定性筛选（§7.3）。
- 通过筛选的技术生成候选路径后，由 **§7.5–§7.10** 确定性四维打分。
- 明确不可能的技术进入下方 `Excluded` 区块（不进入 ranked rows）。
- `eligible_with_warning` 路径仍进入 G4 ranking。
- G4 可显示 `Your current setup`（baseline 摘要）。
- baseline 不自动作为推荐路径；只有算法生成「保留现有系统 + 改善措施」时才进入正式排名。

> The values displayed here are calculated by the deterministic scoring rules in §7.6–§7.10. G4 does not ask AI to score a path.  
> 若页面数字与公式不一致：**以 §7.4–§7.12 为 scoring specification source of truth**。

**CS 同学：取暖/制冷「选项」与打分代码在哪？**

| 你要找的内容 | 文件路径 | 说明 |
|--------------|----------|------|
| 全部技术选项（运行时目录） | `docs/data/technologies/technology_catalog.json` | 客观筛选条件；`g4_defaults` subjective tier **不得**进 Fitness（§7.4） |
| 目录 schema / 类型 / 加载 | `docs/data/technologies/technology_catalog.schema.json` · `docs/src/technologies/*` | |
| **硬筛选 + 路径生成 + 四维打分** | `docs/src/global/screening.ts`（实现对齐 §7） | `screenTechnologies` / `generateCandidatePaths` / `scoreAndSort` |
| LOCAL_PUBLIC 评分数据（规划） | `docs/data/scoring/*.json` | 见 §7.12 / §8.1 |
| G3 当前方式（非白名单） | `docs/src/global/homeFeasibility.ts` + §G3 Q6/Q7 | baseline only |
| 人工审计表 | Internal Appendix | 禁止公开渲染完整目录 |

数据流：

```text
technology_catalog.json → getMvpScreeningCatalog()
  → screenTechnologies (§7.3)
  → generateCandidatePaths
  → scoreAndSort (§7.5–§7.10) → RankedPath[]
  → G4 UI 只读取 RankedPath（禁止在 UI 再算一遍分）
```

#### G4 selected-path state（必须实现）

```text
state.selectedPathId
initial: selectedPathId = rankedPaths[0]?.path_id ?? null   // 默认 #1
onRankedPathClick(pathId): selectedPathId = pathId         // 不重算 ranking
selected = rankedPaths.find(p => p.path_id === selectedPathId)
右侧永远渲染 selected；不要复制第二套 scoring 计算到 UI
```

#### Product states vs scoring states（MUST）

不要把 **excluded** 和 **insufficient_data** 混为一谈。

| State | Meaning | Where shown |
|-------|---------|-------------|
| `eligible` | 通过 hard screen；能得到正式/预备 Fitness | Ranked table |
| `eligible_with_warning` | 通过 hard screen，但有 local confirmation warning | Ranked table（带 warning） |
| `excluded` | 客观条件明确不可行（如永久施工被禁止、已验证无管网、安全工作区间 hard fail） | **Not feasible for your place** |
| `insufficient_data` | 技术未被证明不可行；只是当前数据不足，无法满足 §7.10 最低评分条件 | **Could not rank with available data**（secondary） |

```text
data missing ≠ technology infeasible
```

因此：`insufficient_data` **禁止**显示在 “Not feasible for your place” 下。

轻量 secondary block（不改变 G4 主布局）：

| Locale | Label |
|--------|-------|
| EN | Could not rank with available data |
| ZH | 当前数据不足，暂无法排名 |

若没有 `insufficient_data` paths，该区域不显示。


#### Desktop layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Paths ranked for your home                          [ Adjust inputs ]       │
├─────────────────────────────────┬──────────────────────────────────────────┤
│ Ranked paths                    │ Selected path                           │
│                                 │                                          │
│ #1 Ductless heat pump     83.3  │ Ductless heat pump              83.3    │
│ #2 Gas + split AC         74.1  │ Overall fitness                         │
│ #3 District + AC          71.8  │                                          │
│ #4 ...                          │ Affordability              78 / 100      │
│                                 │ Climate resilience         91 / 100      │
│ click any row →                 │ Environmental impact       88 / 100      │
│                                 │ Practicality               70 / 100      │
│                                 │                                          │
│                                 │ [ four horizontal score bars ]           │
│                                 │                                          │
│                                 │ Key estimates                            │
│                                 │ Upfront · Run cost · Burden · CO₂        │
│                                 │ Data coverage · Warnings                 │
├─────────────────────────────────┴──────────────────────────────────────────┤
│ Not feasible for your place                                               │
│ excluded paths + readable reasons                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ Could not rank with available data   (only if insufficient_data paths)    │
├────────────────────────────────────────────────────────────────────────────┤
│ [ Explain selected path ]          [ Get the analysis report ]             │
├────────────────────────────────────────────────────────────────────────────┤
│ AI Analysis Panel                                                          │
│ placeholder / loading / streamed result                                    │
│ AI disclaimer                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

主可视化优先 **4 条水平分项条**（Affordability / Climate resilience / Environmental impact / Practicality）。若保留 radar，必须是这四维，且表示 **当前 selected path**（或辅助对比），禁止旧五维 Cost/Carbon/Comfort/Climate/Simple。

#### Left · Ranked table

| Column | Meaning |
|--------|---------|
| Rank | ranking |
| Path | path display name |
| Fitness | overall 0–100（1 位小数）；`null` → insufficient_data |
| Upfront | local installed cost / unavailable |
| Run cost | annual estimated operating cost |
| Burden | estimated annual operating burden % |
| Carbon | annual emissions or reduction |
| Confidence / data coverage | optional compact status（如 80%） |

规则：
- Excluded **不进入** ranked rows；放在下方 **Not feasible for your place**。
- `insufficient_data` **不进入** ranked rows；也不进入 Not feasible；放在 **Could not rank with available data**。
- 主表每行不必重复写 Status=OK。
- 每行 clickable + keyboard selectable；selected 有明显边框/背景；不只靠颜色；`aria-selected` 正确；整行可点。
- 点击只切换 `selectedPathId`，不重算 ranking。

#### Right · Selected path score detail

右侧必须显示：

1. Selected path name  
2. **Overall Fitness** `{fitness}/100` — Detailed formula: see **§7.10**  
3. 四个维度（含权重与关键计算结果）：

| 维度 | Weight | 右侧最少展示 | 公式 |
|------|--------|--------------|------|
| Affordability | 35% | Annual run cost · Operating burden · Upfront cost · Upfront ratio · 65%/35% 子分说明 | §7.6 |
| Climate resilience | 30% | HDD18 · CDD24 · Seasonal H/C fit · Extreme margins · H/C weighting | §7.7 |
| Environmental impact | 20% | Estimated emissions · Reference emissions · Reduction % · MVP operational-only note | §7.8 |
| Practicality | 15% | Renovation fit · Outdoor-space fit · Infrastructure fit · Housing permission | §7.9 |

> Scores come from your answers, local public data, and deterministic formulas. AI does not calculate or change these scores.

**Affordability 面板示例行为**

- 完整时：显示 run cost / burden / upfront / upfront ratio，并注明 `65% operating-burden + 35% upfront-pressure`（§7.6.6）。
- 缺 installed cost：`Upfront cost = Data unavailable`；Affordability 用 `*` 标注 *Based on available operating-cost data only*；**不得伪造** upfront subscore（§7.11）。

**Climate resilience 面板**

- 只需要取暖：隐藏 cooling 子项；只需要制冷：隐藏 heating 子项（§7.5.7 / §7.7.8）。

**Environmental impact 面板**

- baseline 不可靠时：`Reference: Regional equivalent-service baseline`（须为 LOCAL_PUBLIC）；不要伪造家庭 baseline（§7.8.2）。
- UI 文案：*MVP environmental score reflects estimated operational emissions, not full lifecycle carbon.*

**Practicality 面板**

- G3 `Not sure`：对应子项显示 *Needs confirmation*，路径仍可排名（§7.9 / §7.11）。

另显示：**Key estimates**、**Data coverage**（§7.10）、**Warnings & local checks**（§7.11）。

#### G4 UI item → algorithm section（CS 对照表）

| G4 UI item | Algorithm reference |
|------------|---------------------|
| Overall Fitness | §7.10 |
| Affordability | §7.6 |
| Annual run cost | §7.5 + §7.6 |
| Operating burden | §7.6 |
| Upfront pressure | §7.6 |
| Climate resilience | §7.7 |
| HDD / CDD | §7.5 |
| Heating/cooling weighting | §7.5 + §7.7 |
| Environmental impact | §7.8 |
| Annual emissions | §7.8 |
| Emissions reduction | §7.8 |
| Practicality | §7.9 |
| Hard exclusions | §7.3 |
| Missing-data warning | §7.11 |
| Data provenance | §7.4 |
| Public data acquisition | §7.12 |

#### CTAs（selected-path aware · inline AI）

| CTA | Behavior |
|-----|----------|
| **Explain selected path** | Explain the current `selectedPath` **inline** in the G4 AI Analysis Panel. Does **not** navigate away from G4. Default selected = #1. |
| **Get the analysis report** | Analyze the whole household and complete ranked results **inline** in the same G4 AI Analysis Panel. Does **not** navigate away from G4. `selectedPath` is UI context only and does not change report scope. |
| **Save my summary** / **保存我的摘要** | Optional utility CTA. Opens **G6** and summarizes `rankedPaths[0]` (algorithm Best-fit). Does **not** change ranking, does **not** call AI, and does **not** treat the currently selected `#2/#3` path as Best-fit. |
| Adjust inputs | Return to G2/G3. If scoring inputs change / G4 is regenerated, previous AI output is invalidated and reset to idle; any later G6 visit must use the new `rankedPaths[0]`. |

#### Mobile

不要硬塞双栏。顺序：Ranked path cards → selected path detail → Excluded → CTAs。点击 ranked card 更新 detail，并可 smooth scroll 到 detail。四维继续显示数字 + bars。

#### Copy（EN / 中文）

| 元素 | English | 中文 |
|------|---------|------|
| Heading | **Paths ranked for your home** | **适合你家的路径排序** |
| Subheading | We screened the available paths using your home information and local public data. Select a path to see exactly how its score was calculated. | 系统结合你的住宅信息和当地公开数据筛选并计算这些路径。点击左侧任一路径，可查看具体评分依据。 |
| Right title | Selected path | 当前选择路径 |
| Overall | Overall fitness | 综合适配分 |
| Dim A | Affordability | 家庭可负担性 |
| Dim C | Climate resilience | 气候适应与可靠性 |
| Dim E | Environmental impact | 环境影响 |
| Dim P | Practicality | 实施适配性 |
| Estimates | Key estimates | 关键估算 |
| Coverage | Data coverage | 数据覆盖度 |
| Warnings | Warnings & local checks | 提醒与本地确认 |
| Helper | Scores come from your answers, local public data, and deterministic formulas. AI does not calculate or change these scores. | 所有分数均由你的回答、当地公开数据和确定性公式计算；AI 不参与计算或修改分数。 |
| Excluded | Not feasible for your place | 当前条件下不可行 |
| Insufficient data (secondary) | Could not rank with available data | 当前数据不足，暂无法排名 |
| CTA AI | **Explain selected path** | **解释当前路径** |
| CTA report | **Get the analysis report** | **获取整体分析报告** |
| CTA save summary | **Save my summary** | **保存我的摘要** |
| AI panel idle heading | AI analysis | AI 分析 |
| AI panel idle helper | Want a clearer explanation? Choose an option above… | 想进一步了解结果？可选择上方功能… |
| AI path heading | AI path explanation | AI 路径解释 |
| AI report heading | AI household analysis | AI 家庭整体分析 |
| AI success disclaimer | This analysis was generated by AI… (UI fixed copy) | 此分析由 AI 生成，仅供参考…（UI 固定文案，非模型输出） |
| Empty | No path passed hard checks. Try adjusting household details or mark unknown answers as Not sure. | 没有路径通过硬筛选。请调整家庭信息，或对不确定项选择「不确定」。 |

---

### G5 · AI analysis module (embedded in G4)

G5 represents the AI explanation capability, but its **user-facing output is rendered inline inside G4**.

No route transition is required.

```text
G4 CTA
  → invoke G5 AI module (POST /api/explain)
  → stream / render response into G4 AIAnalysisPanel
```

Do **not** navigate to `/global/ai` or a separate G5 page from the Global G4 CTAs.

Two modes:

```ts
type AIAnalysisMode = "selected_path_explanation" | "household_analysis_report";
```

Both modes share **one** AI Analysis Panel below the G4 CTAs. A new request replaces the previous panel content. Do not stack two long answers.

**Mode A · selected_path_explanation**

| 项 | 说明 |
|----|------|
| 触发按钮 | **Explain selected path** / **解释当前路径** |
| Target | 当前 `selectedPathId` 对应的 single `RankedPath` |
| 输入 | selected path score card + household context + nearby paths + relevant tech cards |
| 输出 | 简短解释：为什么这条路径对这个 household 得到当前分数 |
| Heading EN / ZH | AI path explanation / AI 路径解释 |
| Subheading EN / ZH | Why this path received its score for your home. / 为什么这条路径会得到当前的适配分。 |
| Loading EN / ZH | Explaining this path using your score card… / 正在根据你的评分结果解释这条路径…… |

If the user later selects a different path while a previous path explanation is still shown, keep the old content but label its target path and show a light mismatch hint. Do **not** auto-request a new explanation.

**Mode B · household_analysis_report**

| 项 | 说明 |
|----|------|
| 触发按钮 | **Get the analysis report** / **获取整体分析报告** |
| Target | whole household + full ranked path summaries |
| 输入 | G1–G3 context + ranked summaries (最多 12) + exclusions + relevant local public data + top-path tech cards |
| 输出 | 家庭整体分析、top-3 对比、下一步确认事项 |
| Heading EN / ZH | AI household analysis / AI 家庭整体分析 |
| Subheading EN / ZH | A concise analysis of your household, leading paths, and the trade-offs that matter most. / 综合分析你家的情况、主要候选路径，以及最值得关注的取舍。 |
| Loading EN / ZH | Analyzing your household and ranked paths… / 正在分析你的家庭情况和候选路径…… |

Household report scope does **not** change when the user clicks another ranked row.

**Idle / disclaimer (UI fixed copy, not LLM output)**

- Idle: show placeholder; do not auto-call AI.
- Success: always show full AI disclaimer under the answer.
- Error: show unavailable copy; ranking and scores remain unchanged.

**Shared rules**

- API endpoint: `POST /api/explain` with `{ mode, locale, context }`.
- Frontend sends structured context only; server chooses prompt builder.
- AI failure must not hide/reset G4 scores or ranking.
- AI must not recalculate Fitness, change ranking, invent prices/subsidies/COP/emissions/laws, recommend brands/models, or treat unknown as unavailable.
- Markdown renderer may support headings, bold and bullets; no HTML, tables, code blocks or raw JSON needed.
- Mobile-specific AI panel redesign is out of scope for this task.

---

### G6 · Action Summary（optional home-energy summary）

> **Internal ID**：`G6 · Action Summary` / route id `global-action-summary`  
> **User-facing page name**：My home energy summary / 我的家庭能源摘要  
> **本规格只定义产品与数据结构，不实现代码。**

#### Product purpose（对用户有用优先）

G6 是一个 **OPTIONAL** 的结果保存工具。

它帮助用户把 **G4 已经计算好的核心结果**整理成一张简洁的个人家庭能源摘要图片，方便：

- 自己留存；
- 与家人讨论；
- 与当地安装人员沟通；
- 与社区或其他相关人员分享。

公开产品定位（给 CS / 文案）：

| Locale | Positioning |
|--------|-------------|
| EN | Turn the G4 result into a concise home-energy summary card that the user can save locally. |
| ZH | 把 G4 的核心结果整理成一张可以保存到本地的家庭能源摘要卡。 |

内部可理解它也有项目传播价值，但公开文案与 G6 规格必须首先以「对用户有用」为目的。

**不要公开突出**：Action evidence / COP31 / case evidence。

G6 **不是**必须步骤。用户在 G4 已经获得排名、selected-path detail、以及可选的 inline AI 解释后，就算完成主评估。G6 只是 Save/export utility。

#### Optional placement in Global flow

```text
G4 Results + inline AI analysis
│
├── [ Save my summary ] → optional G6
│
├── optional G7 feedback
│
└── finish / return / continue as product flow defines
```

合法完成路径包括：

- G4 → optional G6 → optional G7
- G4 → optional G7
- G4 → finish

**不要**要求用户必须先保存图片才能进入 G7。  
G6 and G7 are both optional utilities after the user has already received the main result.

#### Page headings

| Element | English | 中文 |
|---------|---------|------|
| Page name | My home energy summary | 我的家庭能源摘要 |
| Heading | Save your home energy summary | 保存你的家庭能源摘要 |
| Subheading | A short record of the path that ranked highest for your home, the key numbers behind it, and what to confirm next. | 保存一份简短摘要，查看你家当前排名最高的路径、关键数据，以及下一步需要确认的事项。 |
| Save CTA | Save summary card | 保存摘要卡 |

#### Which path does G6 summarize?

```text
summaryPath = rankedPaths[0]   // deterministic Best-fit path
```

必须明确：

- G6 永远使用 G4 scoring engine 排名第一的 path。
- **不要**因为 `selectedPathId` 是 `#2/#3` 就把该 path 写成 Best-fit。
- **不要**因为用户点过 Explain selected path 就修改 G6。
- `selectedPath` ≠ `bestFitPath`。
- MVP 只保存算法当前 `#1`。未来若支持 Save selected alternative，不得把 alternative 叫 Best-fit；本版不做。

#### Data source（no AI）

```text
scoreAndSort()
  → RankedPath[]
  → G4 display
  → G6 formatter
  → PNG summary card
```

G6 可读取：

- region label
- `rankedPaths[0].path_name`
- `rankedPaths[0].fitness`
- `rankedPaths[0].dimensions`
- `rankedPaths[0].estimates`
- `rankedPaths[0].warnings`
- `rankedPaths[0].score_coverage`

禁止：

- G4 → ask AI to summarize → G6
- 在 G6 重新计算 Fitness / 四维分数 / estimates / coverage

原因：用户可能未使用 AI；分享卡应代表正式算法结果；AI 失败不应影响保存；避免第二套不可追溯解释。

若用户 Adjust inputs 后 G4 重新评分，再次进入 G6 必须使用新的 `rankedPaths[0]`，不得复用旧 card state。

**G6 不入库**：只是 client-side presentation/export；本版不为生成/下载摘要卡新增数据库记录。

#### Card field order（final）

1. Title  
2. Region  
3. Best-fit path  
4. Overall Fitness  
5. Four dimension scores  
6. Key estimates  
7. Main strengths  
8. What to confirm next  
9. Data coverage / preliminary state  
10. Disclaimer  
11. Generated by product name  

#### Title / Region / Best-fit / Fitness

| Field | English | 中文 |
|-------|---------|------|
| Title | MY HOME ENERGY SUMMARY | 我的家庭能源摘要 |
| Region | Region: `{region_label}` | 地区：`{region_label}` |
| Best-fit | Best-fit path: `{path_name}` | 当前排名最高的路径：`{path_name}` |
| Fitness | Overall fitness: `{fitness}/100` | 综合适配分：`{fitness}/100` |

Region precision on the card：

- China / US：`admin1, country`（例：`Hebei, China` / `Illinois, United States`）
- Other countries：country only
- Never show exact coordinates / address

#### Four dimension scores

只展示 G4 已计算结果；G6 不展示复杂公式。

| English | 中文 | Value |
|---------|------|-------|
| Affordability | 家庭可负担性 | `{affordability}/100` |
| Climate resilience | 气候适应与可靠性 | `{climate_resilience}/100` |
| Environmental impact | 环境影响 | `{environment}/100` |
| Practicality | 实施适配性 | `{practicality}/100` |

#### Key estimates

只展示已经存在且可靠的 estimate。推荐字段：

| English | 中文 |
|---------|------|
| KEY ESTIMATES | 关键估算 |
| Estimated annual run cost · `{annual_run_cost}` / year | 预计年度运行费用 · `{annual_run_cost}` / 年 |
| Estimated upfront cost · `{upfront_cost}` | 预计初装成本 · `{upfront_cost}` |
| Operating burden · `{operating_burden_pct}%` of annual income | 运行费用负担率 · 占家庭年收入 `{operating_burden_pct}%` |
| Operational emissions · `{annual_emissions}` / year | 运行阶段排放 · `{annual_emissions}` / 年 |

Missing-data（对齐 §7.11）：

- `missing ≠ 0` / `≠ 50` / ≠ developer guess
- 不存在则不编数字
- EN examples：`Upfront cost: Local data unavailable` · `Operational emissions: Data unavailable`
- ZH examples：`初装成本：暂无可靠的当地数据` · `运行阶段排放：暂无可靠数据`
- 可隐藏完全无意义空行，但不得显示假值

#### Main strengths（deterministic； replaces Why it fits）

**删除**旧字段：

- ~~Why it fits / `one_sentence_reason`~~
- ~~Potential benefit~~

对 `summaryPath` 计算 weighted contribution：

```text
affordability_contribution  = 0.35 * affordability
climate_contribution        = 0.30 * climate_resilience
environment_contribution    = 0.20 * environment
practicality_contribution   = 0.15 * practicality
```

规则：

1. 按 contribution 从高到低排序；
2. 取最高 **2** 个 **available**（非 null）dimensions；
3. 只有一个 available 时只显示一个；
4. null dimension 不参与；
5. **不要让 AI 决定 strengths**。

显示：

| Locale | Label | Example |
|--------|-------|---------|
| EN | Main strengths | Climate resilience · Affordability |
| ZH | 主要优势 | 气候适应与可靠性 · 家庭可负担性 |

#### What to confirm next

| Locale | Heading |
|--------|---------|
| EN | WHAT TO CONFIRM NEXT |
| ZH | 下一步需要确认 |

来源：`summaryPath.warnings` + G4 local checks（已有结果）。最多 **1–3** 条最重要项。不要让 AI 新生成。

若无 warning：

- EN：No major unresolved checks were identified from the available data. Local installation confirmation is still recommended.
- ZH：根据当前数据，没有发现明显未解决的条件，但仍建议由当地专业人员确认实际安装情况。

#### Data coverage

显示：`Data coverage: {score_coverage}%` / `数据覆盖度：{score_coverage}%`

若 coverage < 100%（或 `< 1.0`）：

- EN：Preliminary result — Some local data were unavailable when this summary was calculated.
- ZH：初步结果 — 计算本摘要时，部分当地数据尚不可获得。

若 = 100%：只显示 coverage，不加 warning。

#### Disclaimer（UI fixed copy； not AI）

| Locale | Copy |
|--------|------|
| EN | Decision-support summary only. Based on your answers and available local public data. Confirm actual costs, installation, equipment sizing, safety, and local requirements with qualified local professionals. |
| ZH | 本摘要仅用于辅助决策。结果基于你的回答和当前可获得的当地公开数据。实际费用、安装条件、设备容量、安全及当地要求请向合格的当地专业人员确认。 |
| Footer EN | Generated by Climate Adaptation Energy Advisor |
| Footer ZH | 由 Climate Adaptation Energy Advisor 生成 |

不要写 “AI-generated”（G6 不依赖 AI）。

#### Privacy / share-card data rules

分享卡可能被用户保存并转发，因此 **禁止**显示：

- `annual_income` 原始值
- `heating_spend_annual` / `cooling_spend_annual` 原始值
- exact latitude / longitude
- exact home address
- session_id / anonymous UUID
- ownership/rental raw answer
- detailed G2/G3 answers
- email / phone / IP / hidden analytics IDs

**允许**：region label、path name、Fitness、四维分数、derived estimates、operating burden %、Main strengths、warnings/checks、data coverage。

#### Save / download（PNG only）

本版最小目标：

用户点击 **Save summary card / 保存摘要卡**  
→ 将摘要 Card 导出为 **PNG image**  
→ 浏览器下载 / 保存到用户本地终端。

技术实现建议（供 CS 选型，本规格不绑定库）：

```text
HTML summary card → render/export PNG → browser download
```

可选库示例：`html-to-image`、`html2canvas` 或其他稳定方案。PNG 内容必须与用户看到的 Card 一致。

**本版不要求**：

- Download PDF / PDF export / print-to-PDF as required feature
- Copy summary text as required feature

#### Desktop layout（spec only； no mobile redesign in this update）

```
┌──────────────────────────────────────────────────────────────┐
│ Save your home energy summary                               │
│ A short record of your highest-ranked path and next checks. │
├────────────────────────────────────┬─────────────────────────┤
│                                    │                         │
│ MY HOME ENERGY SUMMARY             │ [ Save summary card ]   │
│                                    │                         │
│ Illinois, United States            │                         │
│                                    │                         │
│ Best-fit path                      │                         │
│ Ductless heat pump                 │                         │
│                                    │                         │
│ Overall fitness       83.3 / 100   │                         │
│                                    │                         │
│ Affordability             78       │                         │
│ Climate resilience        91       │                         │
│ Environmental impact      88       │                         │
│ Practicality              70       │                         │
│                                    │                         │
│ KEY ESTIMATES                      │                         │
│ Annual run cost       $1,240 / yr  │                         │
│ Upfront cost          ~$6,500      │                         │
│ Operating burden      3.1%         │                         │
│ Emissions             1.4 t/yr     │                         │
│                                    │                         │
│ MAIN STRENGTHS                     │                         │
│ Climate resilience · Affordability │                         │
│                                    │                         │
│ WHAT TO CONFIRM NEXT               │                         │
│ • Get local installed quote        │                         │
│ • Confirm outdoor-unit location    │                         │
│                                    │                         │
│ Data coverage: 80%                 │                         │
│ Preliminary result                 │                         │
│                                    │                         │
│ Decision-support summary only...   │                         │
│ Climate Adaptation Energy Advisor  │                         │
└────────────────────────────────────┴─────────────────────────┘
```

#### Bilingual copy table

| Element | English | 中文 |
|---------|---------|------|
| Heading | Save your home energy summary | 保存你的家庭能源摘要 |
| Hint | A short record of the path that ranked highest for your home, the key numbers behind it, and what to confirm next. | 保存一份简短摘要，查看你家当前排名最高的路径、关键数据，以及下一步需要确认的事项。 |
| Card title | My home energy summary | 我的家庭能源摘要 |
| Region | Region | 地区 |
| Best-fit | Best-fit path | 当前排名最高的路径 |
| Fitness | Overall fitness | 综合适配分 |
| Dim A | Affordability | 家庭可负担性 |
| Dim C | Climate resilience | 气候适应与可靠性 |
| Dim E | Environmental impact | 环境影响 |
| Dim P | Practicality | 实施适配性 |
| Key estimates | Key estimates | 关键估算 |
| Strengths | Main strengths | 主要优势 |
| Checks | What to confirm next | 下一步需要确认 |
| Coverage | Data coverage | 数据覆盖度 |
| Preliminary | Preliminary result | 初步结果 |
| Save CTA | Save summary card | 保存摘要卡 |

#### G6 Definition of Done（for CS implementation later）

- G6 is optional.
- G4 provides `Save my summary` / `保存我的摘要`.
- G6 always summarizes ranked path `#1`.
- G6 does not use `selectedPath` as Best-fit.
- G6 does not call AI.
- G6 uses G4 `RankedPath` as source of truth and does not recalculate scores.
- Card includes Overall Fitness, four dimension scores, available key estimates, deterministic Main strengths, 1–3 existing warnings/local checks, and Data coverage.
- Missing values are not fabricated.
- Sensitive raw household inputs and exact coordinates are not shown.
- User can save/download the card as an **image (PNG)**.
- No PDF export is required.
- G6 does not block G7 or flow completion.
- English / Chinese copy follow global locale.
- Generating/saving the card does not create a new database row in this MVP.

---

### G7 · Feedback（optional one-minute feedback）

定位：极轻量、**可跳过**的匿名反馈模块。不阻挡用户已获得的 G4 结果、inline AI 分析；也不要求用户先进入 optional G6。

**Copy**

| 元素 | English | 中文 |
|------|---------|------|
| Heading | Help us improve | 帮助我们改进 |
| Badge | Optional | 可选 |
| Subheading | Your anonymous feedback helps us understand whether this tool is actually useful. This step is optional. | 你的匿名反馈可以帮助我们了解这个工具是否真的有用。本步骤完全自愿。 |
| Privacy | Feedback is anonymous and optional. | 反馈匿名且完全自愿。 |
| Submit | Submit feedback | 提交反馈 |
| Skip | Skip | 跳过 |

**Questions（仅 3 题，全部 optional）**

| field_key | Type | English | 中文 |
|-----------|------|---------|------|
| `helped_understand_score` | 1–5 rating | Did this tool help you understand which heating and cooling paths fit your home? | 这个工具是否帮助你更清楚地理解哪些取暖和制冷方案适合你家？ |
| `ai_helpfulness` | 1–5 or `not_used` | How useful was the AI explanation or household analysis? | AI 的路径解释或家庭整体分析对你有多大帮助？ |
| `improvement_text` | textarea ≤500 | What would you improve? (no contact info) | 你觉得哪里还可以改进？（请勿填写联系方式） |

连接我的Supabase来储存这个feedback表格里面用户提交的数据，其他部分收集到的数据全部不入库。
（给冯冯看：这个feedback是为了满足要求做的表面工程，对我的活动/研究几乎没有影响，无须担心毒数据）

Labels：

- Understanding 1–5：Not at all → Very much / 完全没有 → 非常有帮助
- AI 1–5：Not useful → Very useful / 没有帮助 → 非常有帮助；另有 **I did not use the AI analysis** / **我没有使用 AI 分析**

**Deleted from Global G7**

- ~~Would you recommend this tool? (Yes / Maybe / No)~~
- Do **not** ask `recommendation` / `would_recommend` in Global MVP.
- China Pilot survey may keep its own recommendation / survey fields unchanged.

**Skip / empty Submit**

- Skip：零回答也可离开；不报错、不弹 modal。
- 三题全空点 Submit：当作 Skip，或轻提示 “You can answer any question or choose Skip.”（非红色 error）。
- Submit 失败仍允许 Skip / Finish。

**`ai_used` behavioral flag**

- `ai_used = true` when the user intentionally triggers at least one G4 AI request (`selected_path_explanation` or `household_analysis_report`), even if the request fails.
- Distinct from self-reported `ai_helpfulness`.

**Schema `GlobalFeedback`**

```ts
interface GlobalFeedback {
  session_id?: string; // anonymous only
  locale: "en" | "zh";
  region?: { country_iso3?: string; admin1_name?: string | null };
  helped_understand_score?: 1 | 2 | 3 | 4 | 5 | null;
  ai_helpfulness?: 1 | 2 | 3 | 4 | 5 | "not_used" | null;
  improvement_text?: string; // trimmed, max 500, no HTML
  ai_used?: boolean;
  submitted_at?: string;
}
```

No name / email / phone / address / IP / fingerprint. Do not store raw income, bills, or full G1–G4 JSON in the feedback table.

**Persistence**

- Table: `global_feedback`（SQL file **EXISTS**: `docs/data/supabase/global_feedback.sql`；CS 需在 Supabase 中 apply；未 apply 前 G7 仍可 Skip，保存可能失败但不阻塞流程）
- API: `POST /api/global-feedback`
- Free-text testimonials on `/impact` require **manual review / moderation** first — never auto-publish.

**Behavioral vs self-reported**

| Behavioral | Self-reported |
|------------|---------------|
| completed G4, AI used, feedback opened/submitted | helped_understand_score, ai_helpfulness, improvement_text |

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
| `PathScoreBars` | 当前 selected path 的四维水平分条（主视图） |
| `PathRadarChart` | 可选辅助；仅四维，表示 selected path（禁止旧五维） |
| `ScoreBreakdownBars` | Affordability / Climate resilience / Environmental impact / Practicality 明细 |
| `ExcludedPathsList` | 硬约束剔除 |
| `AIExplanationPanel` | G4 inline AI Analysis Panel |
| `GlobalFeedbackForm` | G7 optional 3-question feedback + Skip |
| `ActionSummaryPage` | Optional G6 page shell |
| `SummaryCard` | G6 share-card preview（读 `rankedPaths[0]`） |
| `SummaryDimensionList` | 四维分数展示 |
| `SummaryEstimateList` | Key estimates；missing → unavailable copy |
| `SummaryStrengths` | Deterministic Main strengths |
| `SummaryNextChecks` | 1–3 warnings / local checks |
| `SummaryDataCoverage` | coverage % + preliminary state |
| `SaveSummaryCardButton` | Export visible card as PNG to user device |
| `DisclaimerBanner` | 全局免责 |
| `StoryHero` | `/story` editorial hero + photo |
| `StoryTimeline` | Research → China Pilot → Global Advisor → Now |
| `StoryHowItWorks` | Home + local public data → deterministic scoring → AI explanation |
| `StoryImpactPreview` | Story 中的 early impact placeholders |
| `StoryNextSteps` | More places / More households / Better evidence |
| `ImpactMetricWall` | `/impact` 指标墙：China Pilot + Global Advisor |
| `ChinaPilotEvidenceCard` | 50+ internal-test participants · limited internal testing · not publicly released |
| `GlobalTrafficMetrics` | Global site visits；不要显示 Global users |
| `GlobalFeedbackMetrics` | G7 optional feedback 指标；denominator = feedback respondents |
| `EvidenceMethodologyNote` | data definition / sample size / last updated / anonymous / exploratory |
| `MediaDownloadGrid` | optional future；one-pager、视频、截图下载，不属于 MVP blocker |

### 6.3 响应式

- Mobile：表格改为卡片列表；雷达改竖排。
- 最低支持宽度 360px。

### 6.4 无障碍

- 表单 label 关联；checkbox group 有清晰 legend 与全选状态；颜色不作为唯一信息通道（分数同时显示数字）。

---

## 7. 算法设计（核心：可复现、可审计）

### 7.1 Architecture overview

```
inputs: region/climate (G1), household (G2), home_feasibility (G3),
        all_technologies (catalog), local_public scoring data
        ↓
baseline = buildBaselineProfile(...)
        ↓
screenTechnologies(...)          // §7.3 hard screening
        ↓
generateCandidatePaths(...)
        ↓
common derived vars (§7.5): HDD/CDD, useful demand, energy use, wH/wC, ...
        ↓
for each path:
  A = Affordability (§7.6)           // 0–100 or null
  C = ClimateResilience (§7.7)
  E = EnvironmentalImpact (§7.8)
  P = Practicality (§7.9)
  Fitness = weighted combine (§7.10) // 0–100, 1 decimal; or insufficient_data
        ↓
output: ranked_paths[], excluded[], RankedPath.dimension_details, warnings
        ↓
AI (G5 module, inline in G4): read-only explanation — never mutates scores
```

- AI **不参与**任何计算。
- 相同输入必须得到完全相同结果（deterministic）。
- UI 只展示 scoring engine 产出的 `RankedPath`，禁止在前端重算。

### 7.2 Internal technology catalog

运行时唯一技术目录：

```text
docs/data/technologies/technology_catalog.json
docs/data/technologies/technology_catalog.schema.json
```

- 含取暖 / 制冷 / 取暖+制冷 / 辅助措施 / baseline-only。
- 全部 `"visibility": "internal"`；G3/G4 不展示完整目录；无 `/technologies` 路由。
- G5 AI 只接收 selected / top paths 与相关技术卡。

| catalog_status | 用途 |
|----------------|------|
| `active` | 默认进入后台筛选 |
| `conditional` | 条件满足时进入 |
| `baseline_only` | 只用于现状基线 |
| `phase2` | 文档保留，当前不进 G4 |

**可进入筛选 / 公式的客观字段（TECH_OBJECTIVE_RULE）**

- `services`, `installation_level`, `outdoor_space_required`, `permanent_modification_required`
- `infrastructure_required`（piped gas / district network / electricity 等）
- published operating temperature limits（若来自公开产品类数据）
- `path_rules`

**Deprecated for G4 numeric scoring（legacy / descriptive only）**

若 schema / JSON 仍暂存以下字段，**不得**在 §7.6–§7.10 任何公式引用：

`capex_tier` · `comfort_tier` · `simplicity_tier` · `maintenance_tier` · `noise_tier` · `control_tier` · `air_quality_tier` · expert climate-fit tier · installer maturity score

> Deprecated for G4 numeric scoring. May remain as descriptive/legacy metadata only.  
> 本次规格更新不修改 JSON / TypeScript runtime。

路径生成：每主系统最多 1 基础 + 1 高相关组合；G4 路径约 3–12 条；deterministic；不得用 AI。

### 7.3 Hard screening before G4

```text
function screenTechnologies(...):
  candidates = techs matching needs_heating / needs_cooling services
  // 不得用 current_heating/cooling_methods 建候选白名单
  apply USER installation / outdoor-space / permanent-mod rules
  hard-exclude infrastructure ONLY if:
    (1) user explicitly confirms unavailable, OR
    (2) reliable local/network service-area source says unavailable
  // country-level prevalence alone is NOT enough
  climate safety hard-exclude only per §7.7.5
  never hard-exclude for upfront cost alone
  return { passed, excluded, warnings }
```

每条 exclude 必须有 `reason_en` / `reason_zh`。`not_sure` 默认不硬排除（见 §7.11）。

### 7.4 G4 scoring data provenance

任何会进入 G4 数值计算、最终影响 Fitness 的变量，只允许：

| source_type | 含义 |
|-------------|------|
| `USER` | G1–G3 用户输入 |
| `LOCAL_PUBLIC` | 用户所在地公开、统一、可引用数据 |
| `DERIVED` | 由 USER / LOCAL_PUBLIC 经确定性公式算出 |
| `TECH_OBJECTIVE_RULE` | 技术客观结构条件；用于筛选/兼容/明确公式，不是主观分 |

**允许例子**

- USER：`annual_income`, `heating_spend_annual`, `cooling_spend_annual`, `floor_area_m2`, `building_age`, `insulation_level`, `housing_status`, `building_type`, `renovation_tolerance`, `outdoor_space`, `current_energy_services`, `current_heating_methods`, `current_cooling_methods`, `upfront_cost_preference`
- LOCAL_PUBLIC：月均温、极端温度 proxy、居民电价/气价/LPG/燃油/区域供热冷价、当地装机成本、SCOP/SEER/HSPF2/AFUE 等公开性能、电网/燃料排放因子、气网/区域能源可用性
- DERIVED：HDD、CDD、有用冷热负荷、候选年能耗、年运行费、operating burden、upfront ratio、排放与减排、renovation/outdoor-space margin、wH/wC
- TECH_OBJECTIVE_RULE：`services`, `installation_level`, `outdoor_space_required`, `permanent_modification_required`, `requires_piped_gas`, `requires_district_network`, published min/max operating temp

**禁止**

developer guessed score · AI-estimated data · global average for missing local · subjective tier → score · neighboring-country substitute · “未知给 50”

地理 fallback（普通 LOCAL_PUBLIC）：`network/local → admin1 → country → NULL`。气候仍遵循现有 G1 规则（中美首府 / 他国 Köppen），**本次不改 G1**。

统一载体建议：`ScoringDataPoint<T>`（value/low/mid/high、geography、source_url、retrieved_at、confidence、可选 sample_count / aggregation_method）。产品类性能用 P25/P50/P75 聚合，禁止手挑「典型机型」；Markdown 示例数字一律 **illustrative only**，不得写入 runtime。

### 7.5 Common derived variables

#### 7.5.1 Heating Degree Days

使用 G1 monthly mean temperature \(T_m\)：

```text
HDD18 = Σ_m max(0, 18 - T_m) * days_m     // degree-days
```

#### 7.5.2 Cooling Degree Days

```text
CDD24 = Σ_m max(0, T_m - 24) * days_m
```

#### 7.5.3 Baseline useful heating demand

若需要取暖，且 heating spend、可映射能源、当地燃料价、当前技术公开效率均存在：

```text
BaselineEnergy_H = HeatingSpendAnnual / LocalFuelPrice
UsefulHeatingDemand = BaselineEnergy_H * BaselineHeatingEfficiency
```

热泵 baseline：

```text
UsefulHeatingDemand = BaselineElectricity * BaselineSeasonalCOP
```

单位必须先标准化。

#### 7.5.4 Baseline useful cooling demand

若 cooling spend、可识别机械制冷、电价、公开制冷效率存在：

```text
BaselineElectricity_C = CoolingSpendAnnual / ElectricityPrice
UsefulCoolingDemand = BaselineElectricity_C * BaselineCoolingCOP
```

#### 7.5.5 Fallback demand

若无法从账单反推：允许 `floor_area` + HDD/CDD + building_age + insulation + **可引用的 PUBLIC regional building-energy coefficient**。  
若不存在可引用系数：**不要**用 developer guessed coefficient；对应需求标 `incomplete`。

#### 7.5.6 Candidate energy use

```text
CandidateHeatingEnergy = UsefulHeatingDemand / CandidateSeasonalHeatingEfficiency
# heat pump:
CandidateHeatingElectricity = UsefulHeatingDemand / CandidateSCOP
CandidateCoolingElectricity = UsefulCoolingDemand / CandidateSeasonalCoolingCOP
```

多能源路径分别计算每种能源。

#### 7.5.7 Heating / cooling importance weight

同时需要 heating + cooling：

优先 UsefulDemand：

```text
wH = UsefulHeatingDemand / (UsefulHeatingDemand + UsefulCoolingDemand)
wC = 1 - wH
weighting_source = "load_based"
```

若 UsefulDemand 缺失但 HDD/CDD 存在：

```text
wH = HDD18 / (HDD18 + CDD24)
wC = CDD24 / (HDD18 + CDD24)
weighting_source = "degree_day_fallback"
```

只取暖：`wH=1, wC=0`。只制冷：`wH=0, wC=1`。

### 7.6 Affordability score — 35%

#### 7.6.1 Annual run cost

```text
AnnualEnergyCost_i = AnnualEnergyUse_i * LocalResidentialEnergyPrice_i
AnnualRunCost = Σ_i AnnualEnergyCost_i
```

价格必须为 §7.4 允许的 LOCAL_PUBLIC。

#### 7.6.2 Operating burden

```text
OperatingBurdenPct = AnnualRunCost / AnnualIncome * 100
```

#### 7.6.3 Operating-burden score

令 `x = OperatingBurdenPct`。连续分段线性（阈值集中存于 scoring configuration，勿散落 hard-code）：

```text
if x <= 3:              S_run = 100
if 3 < x <= 5:          S_run = 100 - 7.5 * (x - 3)
if 5 < x <= 10:         S_run = 85 - 7 * (x - 5)
if 10 < x <= 20:        S_run = 50 - 4 * (x - 10)
if 20 < x <= 25:        S_run = 10 - 2 * (x - 20)
if x >= 25:             S_run = 0
S_run = clamp(S_run, 0, 100)
```

#### 7.6.4 Upfront ratio

有可靠当地 installed cost：

```text
UpfrontRatio = InstalledCostLocal / AnnualIncome
```

G3 `upfront_cost_preference` → tolerance `t`：

| preference | t |
|------------|---|
| `minimum_upfront` | 0.10 |
| `moderate_investment` | 0.25 |
| `higher_if_saves_later` | 0.50 |
| `not_sure` | 0.25 |

#### 7.6.5 Upfront score

```text
S_upfront = clamp(100 - 50 * UpfrontRatio / t, 0, 100)
```

含义：`UpfrontRatio=0 → 100`；`=t → 50`；`=2t → 0`。

#### 7.6.6 Final affordability

```text
if S_run and S_upfront both exist:
  A = 0.65 * S_run + 0.35 * S_upfront
else if installed cost missing:
  S_upfront = null
  A = S_run
  affordability_data_complete = false
  # UI: Upfront-cost data unavailable for this location.
  # Affordability is based on available operating-cost data only.
```

**绝对不能**因 unknown 而设 `S_upfront = 50`。

### 7.7 Climate Resilience score — 30%

只用 G1/climate LOCAL_PUBLIC、公开技术性能/运行区间、§7.5 派生量。禁止 subjective climate tier。

#### 7.7.1 Seasonal heating performance

对需要取暖的路径，用公开 seasonal metric（SCOP / 经文档换算的 HSPF2 / seasonal efficiency）：

```text
AnnualHeatingInput = UsefulHeatingDemand / SCOP   # or equivalent
```

在**同一 household、同一 eligible heating candidate 集合**内相对归一化（禁止人为「COP=3→80」）：

```text
bestHeatingInput = min(AnnualHeatingInput_j)
worstHeatingInput = max(AnnualHeatingInput_j)
if best == worst: S_season_H = 100
else:
  S_season_H = 100 * (worstHeatingInput - AnnualHeatingInput)
                   / (worstHeatingInput - bestHeatingInput)
S_season_H = clamp(S_season_H, 0, 100)
```

最低年输入 = 100；最高 = 0。

#### 7.7.2 Seasonal cooling performance

同理：

```text
AnnualCoolingInput = UsefulCoolingDemand / SeasonalCoolingEfficiency
# relative normalize among eligible cooling paths → S_season_C
```

#### 7.7.3 Extreme temperature margins

```text
HeatingMargin = LocalExtremeLowProxy - TechnologyMinPublishedOperatingTemp
# e.g. local −15°C, tech min −25°C → margin +10°C
CoolingMargin = TechnologyMaxPublishedOperatingTemp - LocalExtremeHighProxy
```

Extreme proxies 为气候 proxy（如长期日最低 P01 / 日最高 P99），**不是** ASHRAE design temperatures。

#### 7.7.4 Extreme margin score

`scoreTemperatureMargin(margin)`：

```text
margin >= 10:           100
5 <= margin < 10:       85 + 3*(margin - 5)
0 <= margin < 5:        60 + 5*margin
-5 <= margin < 0:       30 + 6*(margin + 5)
margin < -5:            0
→ clamp 0–100
```

#### 7.7.5 Safety guardrail（non-compensatory）

若 `extreme score = 0` **且** operating-range data confidence = high **且** 无有效 backup/fallback → **Excluded before final ranking**（§7.3），reason: *Published operating range does not cover the local extreme-temperature proxy.* 低成本不能把它救回 Fitness。

#### 7.7.6–7.7.8 Combine

```text
if seasonal + extreme both exist: C_H = 0.70*S_season_H + 0.30*S_extreme_H
else if extreme missing:          C_H = S_season_H; climate_data_complete=false
# same for C_C
only heating: C = C_H
only cooling: C = C_C
both:         C = wH*C_H + wC*C_C   // wH/wC from §7.5.7
```

### 7.8 Environmental Impact score — 20%

MVP **只算 operational emissions**，不宣称完整生命周期。

#### 7.8.1 Candidate annual emissions

```text
Emissions_i = AnnualEnergyUse_i * LocalEmissionFactor_i
PathEmissions = Σ Emissions_i   // kg CO2e/year
```

#### 7.8.2 Reference emissions

- baseline ≥ medium confidence：`ReferenceEmissions = BaselineAnnualEmissions`
- `no_current_heating/cooling`、`not_sure`、或无法可靠反推：**不得**把 reference 当 0；优先 LOCAL_PUBLIC *regional equivalent-service baseline*
- 无可靠 reference：`environment_score = null`；`environment_data_complete = false`；不能编造

#### 7.8.3–7.8.4 Reduction and score

```text
Reduction = (ReferenceEmissions - PathEmissions) / ReferenceEmissions
E = clamp(50 + 50 * Reduction, 0, 100)
```

| Reduction | E |
|-----------|---|
| 0% | 50 |
| −20% (worse) | 40 |
| +20% | 60 |
| +50% | 75 |
| +100% | 100 |

UI：*MVP environmental score reflects estimated operational emissions, not full lifecycle carbon.*

### 7.9 Practicality score — 15%

只用 G3 答案、客观技术要求、当地基础设施数据。

编码：`none=0, minor/wall_or_balcony=1, moderate/small_yard_or_roof=2, major/large_private_land=3`。

#### 7.9.1 Renovation fit

`Rt > Ru` 且用户非 `not_sure` → 应已在 §7.3 排除。通过筛选：

```text
margin = Ru - Rt
margin>=2 → 100; ==1 → 85; ==0 → 70; user not_sure → 60
→ S_renovation
```

#### 7.9.2 Outdoor-space fit

同理 `Su - St` → `S_space`（≥2:100, 1:85, 0:70, not_sure:60）。

#### 7.9.3 Infrastructure fit

| 情况 | S_infrastructure |
|------|------------------|
| G3 明确已使用该 infrastructure | 100 |
| 家庭未明确使用，但可靠 LOCAL_PUBLIC 证明当地可用 | 75 |
| 家庭与当地皆 unknown | 60 |
| 可靠 local/network 证明 unavailable | §7.3 Excluded |

不要根据国家普及率硬排除。

#### 7.9.4 Housing permission fit

| 情况 | score |
|------|-------|
| 不需 permanent modification | 100 |
| 需要 + owner | 100 |
| 需要 + renter_permission | 90 |
| 需要 + renter_not_sure / other unknown | 60 |
| 需要 + renter_no_permission | §7.3 Excluded |

#### 7.9.5 Final practicality

```text
P = 0.35*S_renovation + 0.25*S_space + 0.25*S_infrastructure + 0.15*S_permission
```

### 7.10 Final Fitness and ranking

四维均存在：

```text
Fitness = 0.35*A + 0.30*C + 0.20*E + 0.15*P
→ round to 1 decimal
```

旧五维 `{cost:35, carbon:20, comfort:20, climate:15, simple:10}` **已废弃，不得再实现**。

#### Missing dimension / available-weight normalization

不能因缺失自动给 50。某维因公开数据缺失无法计算时，对**可得维度权重归一化**。例：缺 Environment：

```text
FitnessAvailable = (0.35*A + 0.30*C + 0.15*P) / 0.80
score_data_complete = false
# UI: Preliminary score — some local data is unavailable.
```

**正式 preliminary ranking 至少需要** Affordability、Climate Resilience、Practicality 三者可算。任一完全不可算 → `status = insufficient_data`，不给出看起来很精确的最终 Fitness。

#### Coverage（非 Fitness 组成部分）

```text
ScoreCoverage = sum(weights of available dimensions)   // e.g. 0.80 / 80%
```

右侧显示 `Data coverage: 80%`。

#### Ranking（deterministic）

1. fitness descending  
2. score coverage descending  
3. climate resilience descending  
4. affordability descending  
5. path_id ascending  

#### Climate safety soft cap

若 `ClimateResilience < 50` 且未 hard-exclude：

```text
Fitness = min(Fitness, 65)
# UI: Climate resilience is weak for this location.
```

#### Canonical `RankedPath` contract（UI / G6 / AI 共用）

此类型是 G4 展示、G6 摘要卡、G5 AI context 的 **shared contract**。  
CS 实现 scoring engine 时必须以本接口为准（可在内部多字段，但对外输出必须兼容）。

```ts
type PathScoreStatus =
  | "ranked"              // full or preliminary Fitness shown in ranked table
  | "preliminary"         // Fitness shown but score_coverage < 1
  | "insufficient_data";  // cannot meet §7.10 minimum; NOT excluded

interface ScoringWarning {
  code: string;
  message_en: string;
  message_zh: string;
  source: "user_answer" | "region_data" | "climate_data" | "scoring_data";
}

interface DataNote {
  field_key: string;
  note_en: string;
  note_zh: string;
}

interface RankedPath {
  path_id: string;

  display_name_en: string;
  display_name_zh: string;

  /** null when status === "insufficient_data" */
  rank: number | null;

  status: PathScoreStatus;

  /** null when status === "insufficient_data" */
  fitness: number | null;

  dimensions: {
    affordability: number | null;
    climate_resilience: number | null;
    environment: number | null;
    practicality: number | null;
  };

  dimension_details: {
    affordability: {
      annual_run_cost?: number | null;
      operating_burden_pct?: number | null;
      operating_burden_score?: number | null;
      installed_cost?: number | null;
      upfront_ratio?: number | null;
      upfront_score?: number | null;
      complete: boolean;
    };
    climate_resilience: {
      hdd18?: number | null;
      cdd24?: number | null;
      heating_weight?: number | null;
      cooling_weight?: number | null;
      seasonal_heating_score?: number | null;
      seasonal_cooling_score?: number | null;
      extreme_heating_score?: number | null;
      extreme_cooling_score?: number | null;
      complete: boolean;
    };
    environment: {
      path_emissions_kgco2e?: number | null;
      reference_emissions_kgco2e?: number | null;
      reduction_pct?: number | null;
      reference_type?: "household_baseline" | "regional_equivalent_service";
      complete: boolean;
    };
    practicality: {
      renovation_score?: number | null;
      outdoor_space_score?: number | null;
      infrastructure_score?: number | null;
      permission_score?: number | null;
      complete: boolean;
    };
  };

  /** ALWAYS 0–1 internally. UI may show percent. */
  score_coverage: number;

  estimates: {
    currency?: string;
    upfront_cost?: number | null;
    annual_run_cost?: number | null;
    operating_burden_pct?: number | null;
    annual_emissions_kgco2e?: number | null;
  };

  warnings: ScoringWarning[];
  data_notes?: DataNote[];
}
```

映射到 UI：

| `status` | Ranked table | Not feasible | Could not rank |
|----------|--------------|--------------|----------------|
| `ranked` / `preliminary` | yes | no | no |
| `insufficient_data` | no | no | yes |
| hard-excluded (separate list) | no | yes | no |

Hard-excluded paths 继续使用现有 `ExcludedTechnology` / excluded list contract，**不要**塞进 `RankedPath.status = insufficient_data`。

### 7.11 Missing-data behavior

| Missing input | Behavior |
|---------------|----------|
| installed cost | skip upfront subscore; affordability = operating cost only |
| local energy price | corresponding operating-cost calculation unavailable |
| seasonal efficiency | path score incomplete; do not invent |
| extreme temperature proxy | climate uses seasonal component only |
| operating temperature limit | extreme component omitted |
| emission factor | environment score incomplete |
| baseline emission reference | environment score incomplete |
| local infrastructure status | candidate remains with warning |
| G3 Not sure | no hard exclusion unless another reliable source proves impossible |

统一原则：

```text
missing ≠ 0
missing ≠ 50
missing ≠ “bad technology”
```

### 7.12 Data acquisition checklist

Detailed sources and collection requirements for every LOCAL_PUBLIC variable are documented in this section. **G4 UI 不要塞 source URL**；可通过 “Data & methods” / tooltip 展示 source name、period、resolution（本次只写规格，不实现）。

#### Field checklist（39）

| field_key | source_type | scoring_dimension | priority | preferred_source hierarchy | missing-data behavior |
|-----------|-------------|-------------------|----------|----------------------------|------------------------|
| `annual_income` | USER | affordability | required | G2 | block until answered |
| `heating_spend_annual` | USER | affordability / baseline | if heating | G2 | validation if needed |
| `cooling_spend_annual` | USER | affordability / baseline | if cooling | G2 | validation if needed |
| `floor_area_m2` | USER | demand DERIVED | required | G2 | block |
| `building_age` | USER | demand fallback | optional | G2 | omit if unused |
| `insulation_level` | USER | demand fallback | optional | G2 | wider uncertainty |
| `housing_status` | USER | practicality / §7.3 | required | G3 | validation |
| `building_type` | USER | practicality / §7.3 | required | G3 | validation |
| `renovation_tolerance` | USER | practicality / §7.3 | required | G3 | validation |
| `outdoor_space` | USER | practicality / §7.3 | required | G3 | validation |
| `current_energy_services` | USER | baseline / infra | required | G3 | validation |
| `current_heating_methods` | USER | baseline only | if heating | G3 | baseline warning |
| `current_cooling_methods` | USER | baseline only | if cooling | G3 | baseline warning |
| `upfront_cost_preference` | USER | affordability t | required | G3 | never hard-exclude |
| `temperature_c_monthly` | LOCAL_PUBLIC / G1 | climate / DERIVED | required | G1 capital / Köppen | follow G1 |
| `extreme_low_temp_proxy` | LOCAL_PUBLIC / DERIVED | climate | high | NASA POWER P01 | seasonal-only climate |
| `extreme_high_temp_proxy` | LOCAL_PUBLIC / DERIVED | climate | high | NASA POWER P99 | seasonal-only climate |
| `hdd18` / `cdd24` | DERIVED | climate / weights | high | §7.5 | skip related terms |
| `electricity_price_residential` | LOCAL_PUBLIC | affordability | high | EIA state / Eurostat nrg_pc_204 / CN DRC·grid / IEA → NULL | electric run-cost incomplete |
| `natural_gas_price_residential` | LOCAL_PUBLIC | affordability | if gas | EIA / Eurostat nrg_pc_202 / national / IEA → NULL | incomplete |
| `lpg_propane_price` | LOCAL_PUBLIC | affordability | if LPG | EIA / national / IEA → NULL | incomplete |
| `heating_oil_price` | LOCAL_PUBLIC | affordability | if oil | EIA / national / IEA → NULL | incomplete |
| `district_heating_tariff` / `district_cooling_tariff` | LOCAL_PUBLIC | affordability | if DH/DC | utility / regulator → NULL | incomplete |
| `installed_cost_local` | LOCAL_PUBLIC | affordability | high | gov/utility/public study；US ResStock if documented match → NULL | S_upfront=null |
| `seasonal_heating_efficiency` / `seasonal_cooling_efficiency` | LOCAL_PUBLIC | A/C/E | high | ENERGY STAR/AHRI/EPREL P25–P50–P75 → NULL | do not invent |
| `minimum_operating_temp` / `maximum_operating_temp` | LOCAL_PUBLIC / TECH | climate | medium | public product-class docs → NULL | omit extreme term |
| `grid_emission_factor` | LOCAL_PUBLIC | environment | high | eGRID / CN MEE·NBS CO₂ factor / national → NULL | E incomplete |
| fuel / district emission factors | LOCAL_PUBLIC | environment | if used | EPA GHG Hub / national → NULL | E incomplete |
| `gas_grid_available` / `district_*_available` | LOCAL_PUBLIC + USER | §7.3 / P | high | service-area + G3 | warning；no country-prevalence exclude |
| `fx_rate` | LOCAL_PUBLIC | display | medium | dated official FX → NULL | keep native currency |

**禁止**：邻国替代、全球均值、用省级输配电价冒充中国居民零售电价、用 retailer/Amazon 价当 installed cost、混淆中国「电二氧化碳排放因子」与「碳足迹因子」。

规划文件（本次不创建实体）：`docs/data/scoring/residential_energy_prices.json`, `technology_performance.json`, `technology_installed_costs.json`, `electricity_emission_factors.json`, `fuel_emission_factors.json`, `infrastructure_availability.json`, `scoring_data_sources.json`。气候继续 `docs/data/climate/`；技术目录继续 `docs/data/technologies/`。

### 7.13 Relationship with V1

| 项目 | V1 China Pilot | V2 Global |
|------|----------------|-----------|
| 决策单元 | 村/户五回合沙盘 | 四维路径评分 + 行动摘要 |
| 路线数 | 3 | 8+ screened paths |
| 评分 | 沙盘回合指标 | §7.6–§7.10 Fitness |
| AI | 终局 debrief | 只解释，不改分 |
| Mini-sandbox | 有 | **不做** |

Global 以本节四维打分为准；China Pilot 保持独立。

---

## 8. 数据模型与文件结构

### 8.1 建议新增目录

> **Status note for CS（2026-08-10 scan）**：`docs/data/technologies/*` 与 `docs/data/supabase/global_feedback.sql` **EXISTS**。`docs/data/climate/`、`docs/data/maps/`、`docs/data/scoring/` 当前 **MISSING**——由 Guo 提供数据后创建；CS 先实现 loaders + missing behavior，不要 invent 数值。详见 §0.4 / §0.6。

### 8.1 建议新增目录

Global V2 相关源码、数据、测试与原型页面统一放在 `docs/` 下，与 China Pilot（根目录 `index.html`）隔离：

```
docs/
  sandbox-v2-upgrade-spec.md
  story/
    images/                        # /story My Story 固定三张素材（已入库）
      story-hero-rooftop-solar.jpg
      story-01-question-gas-meter.jpg
      story-02-china-pilot-ui.jpg
  global/                          # Global mode 原型 UI（/global 路由入口）
    index.html
    app.js
  data/
    climate/
      cn_us_admin1_capitals.json      # China provinces + US states: capital-city climate
      climate_profiles.json           # Köppen standard profiles for all other countries
    scoring/                          # LOCAL_PUBLIC inputs for G4 Fitness (planned; not created in this doc-only pass)
      residential_energy_prices.json
      technology_performance.json
      technology_installed_costs.json
      electricity_emission_factors.json
      fuel_emission_factors.json
      infrastructure_availability.json
      scoring_data_sources.json
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

可选的 `docs/data/regions/*.json` 与 `docs/data/scoring/*` 可用于电价、基础设施、政策备注等 LOCAL_PUBLIC override，但**不是** G1 气候数据的主来源。下方 `energy` 数字仅为 **illustrative schema**，不得当作 runtime 默认值写入仓库。

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

`docs/data/technologies/technology_catalog.json` 是运行时单一技术目录。`docs/data/technologies/technology_catalog.schema.json` 用于校验字段结构。旧版单一 ASHP 示例已废弃，不再作为运行时数据源。

字段原则：
- 主目录描述技术本身：服务类型、安装要求、基础设施要求、气候规则、路径组合规则，以及 **TECH_OBJECTIVE_RULE**。
- `g4_defaults.capex_tier` / `comfort_tier` / `simplicity_tier` / `maintenance_tier`：**deprecated for G4 scoring / descriptive metadata only**；不得写入 Fitness。
- 真实价格、效率分位、排放因子来自 `docs/data/scoring/*`（LOCAL_PUBLIC），须带 provenance（见 §7.4 / §7.12）。
- Household / G3 profile 描述具体家庭条件（USER）。
- 四者不得混在同一个对象中。

G4 数据优先级（对齐 provenance，**不再使用 catalog subjective tiers**）：

```text
1. USER answers from G1–G3
2. LOCAL_PUBLIC ScoringDataPoint for the user's geography (network → admin1 → country → NULL)
3. DERIVED quantities from explicit formulas
4. TECH_OBJECTIVE_RULE for screening / practicality match only
5. If required LOCAL_PUBLIC value is null → mark dimension incomplete; never invent / global-average / AI-estimate
```

Region override / scoring file 示例中的数字必须来自真实公开来源并带 provenance；**Markdown 中的示例数字一律视为 illustrative only，不得写入 runtime。**

Region override 示例（illustrative structure only；`null` 表示尚未采集，禁止用虚构 mid 值冒充）：

```json
{
  "technology_overrides": {
    "district_heating": {
      "availability": "unavailable",
      "availability_confidence": "high",
      "availability_source_url": "https://example.utility/service-area"
    },
    "ashp_ductless": {
      "availability": "available",
      "availability_confidence": "medium",
      "installed_cost_local": {
        "value": null,
        "low": null,
        "mid": null,
        "high": null,
        "unit": "USD",
        "country_iso3": "USA",
        "admin1_name": "Illinois",
        "geographic_level": "admin1",
        "reference_period": "TBD",
        "source_name": "TBD public study",
        "source_url": "TBD",
        "retrieved_at": "TBD",
        "confidence": "low"
      }
    }
  }
}
```

### 8.4 Analytics / Supabase / API implementation guidance（future only）

本节只写未来实现建议，不代表本轮要创建数据库表、Supabase migration、API 或生产代码。

#### Global site visit definition

公开 Impact 页使用指标名：

| English | 中文 |
|---------|------|
| Global site visits | 全球网站访问次数 |

不要叫 `Global users`、`Global individual users` 或 `verified individual users`。如果未来做 anonymous visitor ID，最多称 `Anonymous browser visitors` / `匿名浏览器访客`。

一个 `site visit` 定义为：用户开启一个新的浏览器访问 session，进入 `/` 或 `/global`，记录一次 visit。

在同一个浏览器 session 中：

```text
G0 → G1 → G2 → G3 → G4
```

只算 `1 site visit`。页面刷新不应该持续重复增加。在一个新的浏览器 session 再次打开 `/` 或 `/global`，再记录一个新的 visit。这比每 render 一次页面都 +1 更能反映真实网站访问。

#### Recommended future data flow

未来建议使用 Supabase + server-side API：

```text
Browser
  → POST /api/visit
  → server
  → Supabase
```

不要让浏览器直接使用 Supabase service-role key。禁止：

```text
browser → service-role Supabase key
```

#### Suggested table: `site_visit_events`

| column | type | 说明 |
|--------|------|------|
| id | uuid | primary key |
| visitor_id | text nullable | optional anonymous browser visitor id |
| visit_session_id | text | one browser session visit id |
| route | text | `/` or `/global` |
| locale | text | `en` / `zh` |
| country_iso3 | text nullable | optional if known after G1 |
| visited_at | timestamptz | server timestamp |

#### Optional table: `anonymous_visitors`

| column | type | 说明 |
|--------|------|------|
| visitor_id | text | random anonymous id generated in browser |
| first_seen_at | timestamptz | |
| last_seen_at | timestamptz | |
| visit_count | integer | approximate repeat visits for this browser |

#### Session duplicate prevention

未来前端可使用 `sessionStorage` 防重复。概念逻辑：

```text
On entering / or /global:
  if current browser session has not recorded a visit:
      call POST /api/visit
      after successful/accepted request:
          sessionStorage.site_visit_recorded = true
  else:
      do not add another visit
```

这只是 implementation guidance，本轮不要写代码。

#### Anonymous visitor ID

未来可以使用 `localStorage` 保存随机 `anonymous_visitor_id`，用途仅限：

- 粗略判断同一 browser 是否曾经访问过；
- 分析 repeat visits；
- 统计 approximate anonymous browser visitors。

不得用于：

- 身份识别；
- tracking across unrelated websites；
- 收集姓名、邮箱；
- 浏览器 fingerprinting。

公开 Impact 页目前主要展示 `Global site visits`，不是 unique users。

#### No artificial initial count

不要在 Markdown 或未来实现中设计：

```text
display_count = real_count + 100
```

如果这 100 没有真实来源，不能作为 Impact Evidence。若有经过确认的历史真实访问，可以建立 `verified_historical_visit_baseline`，并在 Methodology 写清来源、时间范围和计算方法。否则真实访问统计从实际数据库记录开始。

核心原则：Impact data must follow the same traceability principle as G4 scoring.

#### Optional future table: `pathfinder_sessions`

`pathfinder_sessions` 可作为未来产品分析表，不是核心 MVP 必需项。若实现，必须脱敏，且不公开原始 household JSON。

| column | type | 说明 |
|--------|------|------|
| id | uuid | |
| region_id | text | |
| household_json | jsonb | 脱敏 |
| home_feasibility_json | jsonb | G3 住宅可行性问卷 |
| scores_json | jsonb | 完整打分输出 |
| ai_explanation | text | |
| created_at | timestamptz | |

#### `global_feedback`（Global G7）

G7 是 optional、anonymous、not required。Impact 统计必须基于 feedback respondents，而不是 all users。

| column | type | 说明 |
|--------|------|------|
| id | uuid | |
| session_id | text | 匿名 session id（可关联已有 Global session，勿复制 household） |
| locale | text | `en` / `zh` |
| country_iso3 | text | optional |
| admin1_name | text | optional |
| helped_understand_score | smallint | 1–5 or null |
| ai_helpfulness | text | `1`–`5` / `not_used` / null |
| improvement_text | text | ≤500；Impact 展示前需人工审核 |
| ai_used | boolean | behavioral |
| submitted_at | timestamptz | |

与 China Pilot `simulation_sessions` 问卷字段隔离。自由文本 `improvement_text` 不能自动公开，必须 manual review 后才可选择少量匿名展示。

Impact 可未来计算：

| Metric | Definition |
|--------|------------|
| `global_feedback_count` | `global_feedback` rows submitted |
| `helped_understand_average` | avg numeric `helped_understand_score`，only non-null |
| `helped_understand_positive_rate` | `helped_understand_score >= 4` / non-null understanding responses |
| `ai_helpfulness_average` | avg numeric `ai_helpfulness`，exclude `not_used` and null |
| `ai_helpfulness_positive_rate` | numeric `ai_helpfulness >= 4` / numeric AI helpfulness responses |
| `AI usage rate` | behavioral `ai_used`，denominator must be explicitly defined |

公开文案必须写 `feedback respondents` / `反馈提交者`。不要写 `users`，除非 denominator 真的是所有用户。

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
| A | G4 CTA → inline AI panel | `POST /api/explain` | DeepSeek（与 V1 相同 Key） |
| B | V1 终局 debrief | `POST /api/chat` | 保持现有 |
| C | （未来）聊天追问 | `POST /api/explain/followup` | 带 thread id |

### 9.3 `/api/explain` 请求体（MUST align with G5 two modes）

`locale` 必须来自全局语言状态（`en` / `zh`）。  
Frontend 只发送 `mode` + `locale` + structured `context`。  
**禁止**从浏览器传可随意修改的完整 system prompt。

```ts
type AIAnalysisMode =
  | "selected_path_explanation"
  | "household_analysis_report";
```

Server routing：

```text
switch (body.mode) {
  case "selected_path_explanation":
    prompt = buildSelectedPathExplanationPrompt(body)
  case "household_analysis_report":
    prompt = buildHouseholdAnalysisReportPrompt(body)
  default:
    return 400
}
```

**Selected-path request shape（illustrative）：**

```json
{
  "mode": "selected_path_explanation",
  "locale": "en",
  "context": {
    "region_summary": { "country": "United States", "admin1": "Illinois" },
    "climate_summary": { "hdd18": 3400, "cdd24": 420 },
    "household_summary": { "needs_heating": true, "needs_cooling": true },
    "home_feasibility_summary": { "housing_status": "owner" },
    "baseline_summary": { "heating": ["delivered_fuel"], "cooling": ["room_ac"] },
    "selected_path": { "/* RankedPath contract */": "..." },
    "nearby_ranked_paths": [],
    "relevant_tech_cards": []
  }
}
```

**Household-report request shape（illustrative）：**

```json
{
  "mode": "household_analysis_report",
  "locale": "zh",
  "context": {
    "region_summary": {},
    "climate_summary": {},
    "household_summary": {},
    "home_feasibility_summary": {},
    "baseline_summary": {},
    "ranked_paths": [ { "/* compact RankedPath summaries, max 12 */": "..." } ],
    "excluded_paths": [ { "path_name": "...", "reason": "..." } ],
    "relevant_local_public_data": [],
    "relevant_tech_cards": []
  }
}
```

Validation MUST：

- `selected_path_explanation` → require `selected_path.path_id` + `dimensions`
- `household_analysis_report` → require non-empty `ranked_paths`
- reject unexpected / PII fields
- do not accept full `technology_catalog.json`

若仓库已有 `api/explain.js` + `api/global-ai.js`：实现时以其为起点，但产品行为以 **G5 two-mode section** 为准。

### 9.4 RAG / context injection（MVP）

**Phase 1**：只注入 selected / top paths + 必要 tech cards + exclusions readable reasons（token-bounded）。  
**Phase 2（optional/future）**：向量检索。

Prompt builder 必须：

- 强制单语输出（follow `locale`）
- 禁止重新算分 / 改排名 / 编造价格补贴 COP 排放法规
- 使用 G5 规定的 Markdown 标题结构（selected vs household 两套不同）

旧的单一 “plain-language guide / three generic sections” 示例 **已废弃**；勿再实现为唯一 prompt。

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
| i18n | `en.json` / `zh.json` | 首页可切换 English / 中文；G1–G7 与 AI explanation 跟随同一 `locale` |

### 10.3 路由部署（Vercel）

推荐 route：

| Route | Meaning |
|-------|---------|
| `/` | Global landing |
| `/global` | Global landing / advisor |
| `/story` | My Story |
| `/impact` | Impact & Evidence |
| `/china` | China Pilot |
| `/about` | deprecated；future implementation may redirect to `/story` |
| `/media` | optional future route；not required for core MVP |

示例 rewrites（只作为未来实现建议，本轮不修改 route）：

```json
{
  "rewrites": [
    { "source": "/global", "destination": "/docs/global/index.html" },
    { "source": "/china", "destination": "/index.html" },
    { "source": "/story", "destination": "/story/index.html" },
    { "source": "/impact", "destination": "/impact/index.html" },
    { "source": "/media", "destination": "/media/index.html" },
    { "source": "/", "destination": "/global/index.html" }
  ]
}
```

`/about` 不再是正式页面。未来实际开发时可以 redirect `/about` → `/story`，但本轮 Markdown 不实现 redirect。

---

## 11. 分阶段交付（请 CS 同学按 Phase 排期）

### Phase 0 · 1 周 — Global-first 脚手架

- [ ] 把 `/` 改为 Global-first landing；现有 V1 移到 `/china`
- [ ] 新建 `/global` 入口与 G0–G3 静态页（无打分）
- [ ] `docs/data/climate/cn_us_admin1_capitals.json` 样例（至少各 2 个中美省/州首府气候）+ `docs/data/climate/climate_profiles.json` 若干 Köppen profile；`docs/data/technologies/technology_catalog.json` 作为完整内部技术目录
- [ ] 首页 G0 使用新 IA：主导航只放 `China Pilot` / `Impact` / `English / 中文`；Hero 主按钮为 `Start from the map — about 3 minutes`；轻量文字 CTA 为 `See my story →`
- [ ] 首页加入 `English / 中文` 语言选择；选择后 G1–G7、`/story`、`/impact`、AI explanation 全部跟随同一语言

**验收**：用户打开首页 30 秒内能看懂这是 Climate Adaptation Energy Advisor；能切换 English / 中文；切换后后续页面文字跟随语言；能在地图上点选位置（中美到省/州，其他到国家）、填表、数据写入 console；China pilot 仍可进入。

### Phase 1 · 2–3 周 — Priority 1: G1–G4 scoring core

- [ ] 实现 `hardFilter` + **四维分**（Affordability / Climate Resilience / Environment / Practicality）+ `fitness` 排序
- [ ] G3 `HomeFeasibilityQuestionnaire` + 后台技术筛选 + G4 ranked table + **selected-path** 四维明细（§7.6–§7.10）
- [ ] 单元测试 ≥10 cases
- [ ] **G1 气候两档落地**：中国/美国全省/州首府气候表 + 全球 Köppen 标准 profile；地图点击中美精确到省/州，其余国家只到国家
- [ ] 用至少 3 个场景跑通筛选（如：河北首府气候、Illinois 首府气候、德国某点 Cfb profile）× 技术目录
- [ ] 规划并接入 `docs/data/scoring/*` LOCAL_PUBLIC 数据（可先少数国家）；遵守 §7.4 provenance 与 missing-data 规则；**不得**再用 catalog subjective tier 打分

**验收**：同一 JSON 输入，fitness 列表可复现；exclude 有 reason；G4 显示 selected-path 四维明细；AI 不参与计算或排序。

### Phase 2 · 1–2 周 — Priority 2: AI + optional G6 + G7 feedback

- [ ] `POST /api/explain` + RAG（JSON 注入）
- [ ] G4 inline AI Analysis Panel + 错误降级（G5 = embedded module）
- [ ] AI 输出必须包含 “Cross-region technology note”，解释不同国家之间的信息差
- [ ] G4 CTA `Save my summary` → optional G6；G6 只读 `rankedPaths[0]`，不调用 AI，不重新打分
- [ ] G6 PNG-only save/download；**不要** PDF / Copy text as required
- [ ] G6 card：Fitness + 四维 + estimates + deterministic Main strengths + warnings + coverage + decision-support disclaimer
- [ ] G7 optional one-minute feedback（understanding / AI helpfulness / improvement；可 Skip；无 recommendation）
- [ ] 未来实现 `/api/visit` + `site_visit_events` 时遵守 §8.4：sessionStorage 防重复、server-side API、Supabase service-role secret 不进浏览器
- [ ] Supabase `pathfinder_sessions`（可选）

**验收**：AI 文案引用 score card 中数字；改分数后 AI 跟着变；G6 可跳过且 PNG 与预览一致；G7 可跳过；G6/G7 failure 均不阻塞用户完成流程。

### Phase 3 · 1 周 — Priority 3: `/impact`

- [ ] `/impact` 分开展示 China Pilot Evidence 与 Global Advisor metrics
- [ ] China Pilot headline 统一为 `50+ internal-test participants`
- [ ] 明确 limited internal testing / not publicly released
- [ ] Global public metric 使用 `Global site visits`，不要使用 `Global users`
- [ ] Global feedback metrics 按 §8.4 排除 null / `not_used`，自由文本经人工审核后才可公开
- [ ] Methodology note 显示 data definition / sample size / last updated / anonymous / exploratory

### Phase 4 · 1 周 — Priority 4: `/story`

- [ ] `/story` 使用本规格 6 个 section：The Question / How It Grew / How the Tool Works / Early Impact / Built from a Student Question / What's Next
- [ ] Story 05 只保留学生发起与主导说明，不出现 technical collaborators 句子或 Youth-led principle quote
- [ ] Story Final CTA 只有 `Start your home assessment`，不出现 `View full impact` 或 `Project resources`
- [ ] Story 固定使用 `docs/story/images/` 下三张图：`story-hero-rooftop-solar.jpg`（Hero）、`story-01-question-gas-meter.jpg`（01）、`story-02-china-pilot-ui.jpg`（02）；05 不配图；不用 stock photo
- [ ] Mobile 适配 + 免责声明法务审阅

### Optional future

- `/media` Media Kit / Project Resources：one-pager、2 分钟 demo 视频入口、截图包、logo/title card、case report draft。
- 政府/企业多角色；村庄 aggregate dashboard；更多国家；制冷负荷详细模型；国际合作数据源。

---

## 12. 验收标准（Definition of Done）

1. **G6 Summary**：optional；G4 has `Save my summary`；always uses `rankedPaths[0]`；no AI；no score recalculation；PNG save only（no PDF required）；missing values not fabricated；no sensitive raw inputs / coordinates；does not block G7 or completion.
2. **G7 Feedback**：all questions optional；Skip works with zero answers；submit failure does not block completion；Impact averages exclude null / `not_used`；free text not auto-published.
3. **功能**：Global 全流程 G0→G7 无 dead end（G6/G7 均可跳过）；首页可选择 English / 中文，选择后全流程 UI、`/story`、`/impact` 与 AI explanation 跟随同一语言；G1 在中国/美国精确到省/州并用首府气候，其余国家只到国家并用 Köppen 标准 profile；China pilot 仍可独立进入并完成一局。
4. **正确性**：scoring 模块有单测；hard exclude 理由可见。
5. **AI 安全**：prompt injection 测试：用户填 `"ignore rules"` 不改变 fitness。
6. **性能**：打分 < 200ms（前端）；AI 首 token < 5s（依赖 API）。
7. **隐私**：无 PII 强制；Supabase 仅存匿名 session / optional feedback / future site visit events；service-role secret 不得暴露到客户端；G6 share card 不展示原始收入/账单/坐标/session id。
8. **Story / Impact**：G0 有 `See my story →` 指向 `/story`；`/about` 不再是正式页面；`/media` 是 optional future；Story 有完整 6 section；Story 05 已删除 technical collaborators 句子与 Youth-led principle；Story final CTA 只有 `Start your home assessment`；Impact 使用 `50+ internal-test participants` 和 `Global site visits` 口径，并包含 Methodology note。
9. **文档**：README 增加 Global mode、China pilot、Story、Impact、语言切换与环境变量说明；Media Kit 只作为 optional future resources。

---

## 13. 给开发同学的快速 FAQ

**Q: 分数和 AI 谁说了算？**  
A: **分数 = TypeScript 算法**；AI 只解释。

**Q: 必须先重写整个 index.html 吗？**  
A: 不必。可新建 `docs/global/index.html` + 共享 `lib/scoring.js`。

**Q: 中国用户还会用旧版吗？**  
A: 会，但它是 **China Pilot**。主入口必须是 Climate Adaptation Energy Advisor，因为内部申报项目不能只局限于中国北方农村。

**Q: 价格数据从哪来？**  
A: 必须是用户所在地的 **LOCAL_PUBLIC** 可追溯公开数据（EIA / Eurostat / 省级发改委或电网公司居民电价 / IEA country fallback → NULL）。禁止邻国替代、全球均值、AI 估计、catalog `capex_tier`。详见 §7.4。

**Q: G4 还用五维 Comfort / Simplicity 吗？**  
A: **不用。** 正式四维：Affordability 35% · Climate Resilience 30% · Environmental Impact 20% · Practicality 15%（§7.6–§7.10）。点击左侧路径，右侧显示该路径明细；默认选中 #1。Comfort 不进 Fitness。


**Q: G1 气候数据要做到多细？**  
A: **中国、美国**：地图识别到省/州，气候用该省/州**首府点数据**代表。**其余国家**：只识别到国家，气候用点击点的 **Köppen 标准 profile**。不要做全省/州 WorldClim zonal mean。

**Q: 现有 DeepSeek Key 能复用吗？**  
A: 能，新增 `/api/explain` 即可。

**Q: G6 用哪条 path？要不要 PDF / AI？**  
A: 永远用 `rankedPaths[0]`（Best-fit）。不因 selectedPath 改变。不调用 AI，不重算分。本版只要 PNG 保存到用户终端，不要 PDF。

**Q: 论文/答辩要截图什么？**  
A: G4 排序表 + 雷达 + AI 解释里 “cross-region technology” 一段；申报材料还可截图 `/impact` 证据页、`/story` My Story、以及 optional G6 家庭能源摘要卡（PNG）。`/about` 已 deprecated，`/media` 只是 optional future resources。

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

**给 CS**：本表是 `docs/data/technologies/technology_catalog.json` 的审计对照；G4 如何引用这些文件见上文 **§G4 · Results →「CS 同学：取暖/制冷选项都在哪」** 与 **§7.4**。

表中 **Capex / Comfort / Simple** 列对应 JSON 里的 `capex_tier` / `comfort_tier` / `simplicity_tier`，现已标记为 **deprecated for G4 scoring / descriptive metadata only**，不得进入 Fitness。筛选仍以安装等级、空间、基础设施等客观列为准。

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
