# Clean Heating Sandbox V2 — 保姆级升级需求文档

> **文档用途**：给负责改网站的同学（CS 背景）看的**产品 + 技术 + UI 全文说明**。  
> **产品负责人**：Guo Hang  
> **当前线上版本**：https://www.clean-heating-simulator.com（根目录 `index.html` + Vercel `api/`）  
> **本文档版本**：2026-08-04 · Draft for implementation kickoff

---

## 0. 一句话目标

把现有「华北村级煤改 X 五回合沙盘」升级为 **V2：全球家庭取暖/制冷路径适配工具**——用户选地区 + 填家庭数据 → **规则引擎算出各方案适配分** → **AI 用 plain language 解释分数、填补跨国技术信息差** → 可选进入「短版沙盘」体验某一两条路径的后果。

**核心原则**：
- **分数由算法给，不由 AI 编造**（AI 只解释、翻译、对照，不凭空写补贴金额或 COP）。
- **保留 V1** 作为中国/村级场景的可选模式，不要一次性删光现有功能。
- **默认静态、低门槛**：无需注册即可试用；研究数据仍匿名入库（Supabase）。

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

1. **从「村统筹」到「个体决策」**：欧美等地农户往往自己选系统，不像中国常见「一村推一条路」。
2. **从「只取暖」到「取暖 + 制冷」**：气候区不同，有的地区制冷负荷同样重要。
3. **跨国技术信息差**：国外用户可能不知道某条在中国已验证的路线其实适配其气候与预算；反之亦然。
4. **从「是否清洁取暖好」到「哪条路 fit 这个家庭、这个地方」**：与答辩结论 *No single best route; fit depends on the household* 一致。

### 1.3 V2 不做什么（第一版明确排除）

- 不做真实工程 CAD / 管线设计、不做施工报价合同。
- 不接智能电表/气表实时数据（可留接口占位）。
- 不做完整多智能体博弈（政府/企业/农户同时操作）——可 Phase 3。
- 不让 LLM 单独输出「最终该买哪台设备型号」——只到**路径级别**（如 air-source heat pump vs gas boiler）。

---

## 2. 目标用户与使用场景

| 用户 | 场景 | 语言 |
|------|------|------|
| 中国华北农户 / 学生 / 公众 | 继续用 V1 或 V2 里的「China · Village mode」 | 中文为主 |
| 欧美/其他地区个体农户、郊区房主 | V2「Global · Household mode」 | **英文 UI 为主**，关键术语可双语 |
| 政策/研究访客 | 对比多方案分数、导出摘要 | 英文 |

**典型用户故事（Global mode）**  
> Maria 在美国中西部有一栋 120 m² 的农舍，冬季用丙烷、夏季 window AC。她听说热泵在中国北方用得很多，但不知道是否适合本地 −20°C。她打开网站，选 United States → Midwest，输入收入与账单，得到 6 条路径的适配分排序，并看到 AI 解释「为何 air-source HP 分数中等、为何 geothermal 分数高但 upfront 高」。

---

## 3. 产品形态：双模式入口

首页增加**模式选择**（不要隐藏 V1）：

```
┌─────────────────────────────────────────────────────────┐
│  Clean Heating & Cooling Pathfinder                     │
│  Find a path that fits your home and your place.        │
├──────────────────────────┬──────────────────────────────┤
│  🇨🇳 China · Village      │  🌍 Global · Household       │
│  5-turn sandbox (current) │  Score all paths · AI guide  │
│  [ Enter China mode ]     │  [ Enter Global mode ]       │
└──────────────────────────┴──────────────────────────────┘
```

| 模式 | 路由建议 | 说明 |
|------|----------|------|
| China · Village | `/` 或 `/china` | 现有 `index.html` 流程，最小改动 |
| Global · Household | `/global` 或 `/pathfinder` | **V2 新流程**（本文档重点） |

---

## 4. Global mode 用户流程（逐步）

```
Landing → Region & climate → Household form → Optional cooling need
    → [Run scoring] → Results table + radar → AI explanation panel
    → [Optional] Mini-sandbox (3 turns) for top-1 path → Survey / thanks
```

| 步骤 | 页面 ID | 目的 |
|------|---------|------|
| G0 | `global-landing` | 价值主张 + 免责声明 |
| G1 | `global-region` | 国家/区域/邮编（可选）→ 载入地区参数 |
| G2 | `global-household` | 家庭与建筑、现有系统、账单 |
| G3 | `global-priorities` | 用户权重：省钱 / 低碳 / 舒适 / 少折腾 |
| G4 | `global-results` | 适配分排序 + 雷达 + 硬约束剔除说明 |
| G5 | `global-ai` | AI 解读（RAG，引用分数卡） |
| G6 | `global-mini-sandbox` | 可选，3 回合简化推演 top 路径 |
| G7 | `global-feedback` | 短问卷 + 是否愿意推荐 |

---

## 5. 界面说明与界面文案（English UI copy）

> 以下文案可直接进前端；中文注释供产品负责人核对。

### G0 · Landing

**Layout**
- 顶栏：Logo + `China mode` link
- Hero：标题 + 副标题 + 主按钮
- 三列价值点 + 底部 disclaimer

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Title | **Heating & Cooling Pathfinder** |
| Subtitle | Compare paths for *your* home and *your* climate—not one global “best” technology. |
| Primary CTA | **Start — it takes about 3 minutes** |
| Bullet 1 title | Household-first |
| Bullet 1 body | Enter income, home size, and energy bills. See what fits you. |
| Bullet 2 title | Scores you can trace |
| Bullet 2 body | Each path gets a fitness score from clear rules—not AI guesswork. |
| Bullet 3 title | Plain-language guide |
| Bullet 3 body | AI explains trade-offs and technologies you may not know in your country. |
| Disclaimer | *Decision support only. Not engineering design, installation quote, or legal advice. Local installers must confirm sizing and safety.* |
| Footer | Anonymous · No account required · ~3 min |

---

### G1 · Region & climate

**Layout**
- Step indicator: `1 of 4 · Your place`
- Country `<select>` → Region `<select>`（级联）
- 可选：Postal code / ZIP（用于未来精确气候带，V2.0 可只做 select）
- 右侧卡片：**Climate snapshot**（HDD/CDD、典型冬季低温、能源价格区间——来自 region JSON，只读）

**Copy**

| 元素 | 英文文案 |
|------|----------|
| Heading | **Where is this home?** |
| Hint | Prices and climate defaults come from public ranges for your region. You can adjust bills on the next step. |
| Label country | Country |
| Label region | Region or state |
| Label postal | Postal code (optional) |
| Climate card title | Climate snapshot |
| Fields | Heating degree days · Cooling degree days · Typical coldest week · Grid CO₂ intensity (range) |
| Button | **Continue** |

**首发地区（MVP 至少 3 个，建议 5 个）**

| region_id | Country | Region label | 备注 |
|-----------|---------|--------------|------|
| `cn_north_china` | China | North China Plain | 对接现有 V1 参数 |
| `us_midwest` | United States | Midwest | 个体决策、丙烷/电暖常见 |
| `de_rural` | Germany | Rural / village | 热泵渗透高 |
| `uk_rural` | United Kingdom | Rural off-gas | 气网外区域 |
| `fr_rural` | France | Rural | 扩展用 |

数据文件建议：`data/regions/{region_id}.json`（见 §8）。

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

### G6 · Mini-sandbox（可选）

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

### G7 · Feedback

| 元素 | 英文文案 |
|------|----------|
| Q1 | Did this help you compare paths? (1–5) |
| Q2 | Would you recommend this tool? (Yes / Maybe / No) |
| Q3 | What was missing? (optional text) |
| Submit | **Submit & finish** |

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
| `DisclaimerBanner` | 全局免责 |

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

```json
{
  "region_id": "us_midwest",
  "country": "United States",
  "label_en": "Midwest",
  "currency": "USD",
  "climate": {
    "hdd18": 4200,
    "cdd18": 900,
    "design_temp_c": -23,
    "typical_winter_low_c": -15
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
    { "source": "/", "destination": "/index.html" }
  ]
}
```

---

## 11. 分阶段交付（请 CS 同学按 Phase 排期）

### Phase 0 · 1 周 — 脚手架

- [ ] 新建 `/global` 入口与 G0–G2 静态页（无打分）
- [ ] `data/regions` + `data/technologies` 各 2 条样例 JSON
- [ ] 双模式首页入口

**验收**：能选 region、填表、数据写入 console。

### Phase 1 · 2–3 周 — 打分 MVP

- [ ] 实现 `hardFilter` + 五维分 + `fitness` 排序
- [ ] G3 权重 + G4 结果表 + 雷达图
- [ ] 单元测试 ≥10 cases
- [ ] 3 个 region × 8 tech

**验收**：同一 JSON 输入，fitness 列表可复现；exclude 有 reason。

### Phase 2 · 1–2 周 — AI 解释

- [ ] `POST /api/explain` + RAG（JSON 注入）
- [ ] G5 流式展示 + 错误降级
- [ ] Supabase `pathfinder_sessions`（可选）

**验收**：AI 文案引用 score card 中数字；改分数后 AI 跟着变。

### Phase 3 · 2 周 — Mini-sandbox +  polish

- [ ] G6 三回合预览（复用 simulation engine）
- [ ] G7 问卷
- [ ] Mobile 适配 + 免责声明法务审阅

### Phase 4 · 未来

- 政府/企业多角色；村庄 aggregate dashboard；更多国家；制冷负荷详细模型。

---

## 12. 验收标准（Definition of Done）

1. **功能**：Global 全流程 G0→G5 无 dead end；China V1 仍可独立进入并完成一局。
2. **正确性**：scoring 模块有单测；hard exclude 理由可见。
3. **AI 安全**：prompt injection 测试：用户填 `"ignore rules"` 不改变 fitness。
4. **性能**：打分 < 200ms（前端）；AI 首 token < 5s（依赖 API）。
5. **隐私**：无 PII 强制；Supabase 仅存匿名 session。
6. **文档**：README 增加 Global mode 与环境变量说明。

---

## 13. 给开发同学的快速 FAQ

**Q: 分数和 AI 谁说了算？**  
A: **分数 = TypeScript 算法**；AI 只解释。

**Q: 必须先重写整个 index.html 吗？**  
A: 不必。可新建 `global/index.html` + 共享 `lib/scoring.js`。

**Q: 中国用户还会用旧版吗？**  
A: 会。首页保留 China mode。

**Q: 价格数据从哪来？**  
A: MVP 用 `research/data/calibration_defaults.json` + 手工 `regions/*.json`；UI 标明 “approximate range”。

**Q: 现有 DeepSeek Key 能复用吗？**  
A: 能，新增 `/api/explain` 即可。

**Q: 论文/答辩要截图什么？**  
A: G4 排序表 + 雷达 + AI 解释里 “cross-region technology” 一段。

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

- [ ] 确认 Phase 1 首发 3 个海外 region 的具体参数来源（文献链接）
- [ ] 确认 Global UI 是否要中英切换（建议 V2.0 先纯 EN）
- [ ] 准备 5 组「典型家庭」fixture 供测试与 demo
- [ ] 免责声明给导师/课程过目

---

*文档结束。有问题直接在 GitHub issue 或飞书/微信里 @Guo Hang，并附上 region_id / tech_id 讨论具体规则。*
