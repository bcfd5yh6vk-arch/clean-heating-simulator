# 论文草稿（Abstract + Methods）

> 保定煤改X村级清洁取暖转型模拟沙盘 · CTB 研究论文  
> Abstract 第 5 句仅用 *we expect…*，不含结果数字。  
> 缺项以 `[TODO: …]` 标注。Results / Discussion 尚未写入。

---

## 中文（学术、一段）

华北农村在煤改气/煤改电推进中显著减污，但补贴退坡后不少农户仍面临「改得起、用不起」的取暖负担，而公共讨论常简化为「清洁取暖好不好」，忽视村级路径选择与户级收入、房屋与取暖费差异的匹配。既有研究多停留在区域统计或宏观政策评估，缺少基于真实户级数据、可交互比较不同煤改X路线（天然气/热泵等）并纳入合规与补贴冲击的村级决策工具。本研究构建了一个华北村级清洁取暖转型模拟沙盘：用户输入整户年收入、住房面积与年取暖费用，在五个回合中体验技术路线、补贴退坡与合规压力，并获智能分析反馈。研究采用试玩前后简短问卷与行为日志的 pre/post 设计，于 2026 年 6 月 28 日至 7 月 5 日通过课程同学与公开链接招募，共纳入 **21** 名全部完成样本（7 名学生、7 名其他关注者、4 名已煤改农户、3 名未煤改农户）；农村参与者主要来自**河北省**（张家口、石家庄、保定清苑、元氏、威县等地）及**北京市**延庆区（珠窝村）。因变量包括煤改气/取暖花费认知、路径偏好、策略调整意向、模型真实感，以及模拟中的能耗负担率、合规度与排放达标度等指标。我们预期，户级交互模拟能提升对「环保—成本—合规」权衡的理解，并有助于识别华北农村（以河北省为主）多数家庭更可行的煤改X路径。

---

## English（≤120 words, one paragraph)

Northern China's coal-to-X transition cuts pollution, yet many rural households still struggle with winter heating costs as subsidies taper—while debate often asks only whether clean heating is good. Prior work rarely offers household-data tools for village pathway choice. We built a village-level clean-heating simulation sandbox: users enter income, housing area, and heating costs, then compare coal-to-X routes across five rounds with AI debrief. In a pre/post study, 21 participants completed simulation and post-survey (June 28–July 5, 2026)—classmates and rural users from Hebei Province and Beijing, via course outreach and a public URL. We measure heating-cost understanding, pathway preferences, realism, and logged choices alongside energy burden, compliance, and emission indicators. We expect the sandbox to sharpen trade-off awareness and clarify which pathway best fits most North China households.

---

## Methods · 研究方法

### 中文

#### 2.1 研究作品（Artifact）

本研究部署并上线了一款面向保定煤改X语境的**村级清洁取暖转型模拟沙盘**（https://www.clean-heating-simulator.com；静态单页 `index.html`，托管于 Vercel）。参与者无需注册账号：在首屏选择身份（学生、已煤改农户、未煤改农户或其他关心者）并填写基本背景后，进入华北农户家庭建档界面，输入**整户**年收入、年盈余、住房面积、常住人口与煤改前年取暖费用；固定设定为农民家庭、华北地区、初始取暖方式为散煤。

模拟共五个回合：（1）现状抉择（继续散煤或准备转型）；（2）合规压力（若继续散煤则触发基于住房面积与连续违规次数的概率性入户了解）；（3）技术路线（天然气、地源热泵或空气源热泵，改造成本与运行费按 100㎡ 基准线性缩放）；（4）增收或节能（提高收入、节约取暖或保暖修缮三选一）；（5）补贴退坡（由初始散煤费用换算等价气量并按固定退坡幅度增加年取暖费，随后终局判定）。界面实时显示六项指标——年取暖费、年收入、年盈余、法律合规度（0–100）、排放达标度（0–100）与能耗负担率（%）——以及回合叙事日志；终局分为成功转型、资金紧张或被处罚三类。

终局后，参与者可请求**智能分析**：浏览器向服务端 `/api/chat` 提交本局初始输入、逐步操作日志与终局状态；服务端以 **DeepSeek Chat Completions API**（`deepseek-v4-flash`）生成中文报告，系统提示词按身份分三套**人工撰写的结构化模板**（已改农户对照解读 / 未改农户改造建议 / 其他用户通用分析），要求模型仅引用日志中已有数字、分三段输出。API 未配置或调用失败时界面显示错误信息，**不提供预设脚本文本替代**。模拟引擎本身为确定性算法，经济、合规与排放常数来自文献与公开统计（见 `algori_spec.md`、`research/data/calibration_defaults.json`），部分阈值为简化估计并在界面说明中标注。

每次会话以 UUID 匿名写入 Supabase 表 `simulation_sessions`，记录初始户级输入、各回合选择 ID/标签、逐步 `event_log`、终局类型与摘要、终局六项指标、智能分析全文（若成功生成）及 post-survey 字段。

#### 2.2 研究设计（Design）

本研究采用**单次交互暴露 + 前后测问卷 + 行为日志**的混合设计，核心干预为完成一局完整模拟（含可选智能分析与 post-survey）。

**自变量（IV）**：（a）干预暴露——是否完成上线模拟器的一局体验（含所走路径：技术路线、合规分支、增收/节能选择等，由参与者自行决策，非实验者分配）；（b）参与者身份——学生、已煤改农户、未煤改农户或其他（组间因素）；（c）农户子样本中，已改/未改身份进一步区分问卷题项。

**因变量（DV）**分三层：（1）**认知与态度（问卷）**——非农户/学生：pre 测 Q1（5 点 Likert，煤改气/取暖花费了解程度）与 post 测 Q2（同维度了解程度）、Q4（若重来是否改变策略）、S1（模拟器相对文章的帮助程度）、推荐意愿与智能分析有用性；已煤改农户：取暖费变化真实感（F4）、最像/最不像环节（F6–F7）、补贴应对方式等；未煤改农户：改气顾虑（N2）、改气态度变化（N3）、优先路径（N4）。（2）**行为与路径（日志）**——五回合选项、终局类型、各阶段指标轨迹。（3）**模拟结局指标**——终局能耗负担率、年取暖费、年盈余、合规度、排放达标度与 CO₂ 吨数。

**Pre/post 结构**：学生与其他非农户在点击「开始模拟」前完成 **pre-survey 单题**（Q1）；模拟与智能分析结束后填写 **post-survey**（约 2 分钟，身份定制题 + 共用结尾题）。**已煤改/未煤改农户流程跳过 pre-survey**，仅保留 post-survey（含开放反馈与可选访谈意向；手机号仅在自愿接受访谈时选填）。

**比较指标**：同一参与者 pre/post 认知差值（Q2−Q1，限非农户）；不同技术路线与终局类型下的负担率/合规/排放分布；同一村庄（`village_name` 字段）内多户输入的路径汇总对比 **[TODO: 村级汇总分析是否已实施]**。

#### 2.3 知情同意（Consent）

参与流程以三层首屏呈现：**欢迎页**（身份与背景）、**背景说明页**、**知情同意页**（`consentOverlay`）。同意页明确四项：数据**匿名**（不收集姓名；默认不收集手机号）、参与**自愿**（不点同意可关闭页面）、**随时可退出**、数据**仅用于改进模拟器与学术研究**（不作广告或商业用途）。用户点击「同意，进入模拟器」后方解锁主界面。本工具为**政策/生计决策模拟与公共教育**，不涉及临床诊断、治疗或心理干预；同意文案未使用医疗术语。

#### 2.4 招募、编码与统计分析（Recruitment, coding & analysis）

**招募**：目标样本 **20 人以上**（`templates/indexChinese.html`），包括课程同学与 **[TODO: 是否已通过村干部协助招募]** 的农村参与者；同时通过公开 URL 自然访问收集会话。**[TODO: 实际招募起止日期、最终 N、目标村庄名]**。模拟器参数另以保定、张家口、石家庄等地前期访谈与文献校准 **[TODO: 访谈样本量与是否单独写入 Methods]**。

**开放题编码**：post-survey 中的开放文本（如学生 S3 反思、其他用户 O4–O5、非农户 Q_end2 改进建议、Q3「其他」补充、智能分析负面反馈等）计划采用 **[TODO: 编码方案，如双人 thematic coding / codebook 条目]** 归纳主题，用于解释定量结果与模型迭代，**尚未在仓库中固定 codebook**。

**统计分析**：定量数据自 Supabase 导出后，对 Likert 题计算 **[TODO: pre/post 配对检验，如 Wilcoxon signed-rank 或配对 t 检验，需说明正态性检验]**；分类变量（路径选择、终局类型、态度变化）采用 **[TODO: 描述性频数 / Fisher 精确检验 / χ² 等]**；模拟指标（负担率、合规度、排放分）按技术路线与身份分组报告 **[TODO: 具体分组与检验]**。开放题编码结果以主题频次辅助讨论，**不进入 [TODO: 是否计划] 正式 inferential 模型**。

---

### English

#### 2.1 Artifact

We deployed a **village-level clean-heating transition simulation sandbox** for Baoding coal-to-X contexts (https://www.clean-heating-simulator.com; single-page `index.html` on Vercel). Participants need no account. After selecting an identity on the welcome screen (student, converted farmer, unconverted farmer, or other stakeholder) and entering basic background, they create a North China farm household profile: **whole-household** annual income, annual surplus, floor area, resident population, and pre-transition winter heating cost. Role (farm household), region (North China), and initial heating mode (scattered coal) are fixed.

The simulation runs five turns: (1) status quo choice (continue coal or prepare transition); (2) compliance pressure (probabilistic home visit if coal continues, scaled by floor area and consecutive non-compliance); (3) technology route (natural gas, ground-source heat pump, or air-source heat pump; retrofit and operating costs linearly scaled from a 100 m² baseline); (4) income boost or energy saving (one of three options); (5) subsidy phase-out (equivalent gas volume derived from initial coal spending, then a fixed per-m³ cost increase, followed by terminal adjudication). The interface displays six live indicators—annual heating cost, income, surplus, legal compliance (0–100), emission score (0–100), and energy burden rate (%—plus a turn-by-turn narrative log. Terminal outcomes are successful transition, financial strain, or enforcement-related seizure.

After the terminal state, participants may request **AI debrief**: the browser POSTs initial inputs, stepwise logs, and final state to `/api/chat`; the server calls the **DeepSeek Chat Completions API** (`deepseek-v4-flash`) with one of three **human-authored structured system prompts** (converted-farmer comparison / unconverted-farmer retrofit advice / default analysis). The model must use only logged numbers and return three Markdown sections. If the API key is missing or the call fails, the UI shows an error—**no curated mock script is served as fallback**. The simulation engine itself is deterministic; economic, compliance, and emission constants are literature-calibrated (`algori_spec.md`, `research/data/calibration_defaults.json`), with some thresholds simplified as noted in-app.

Each session is stored anonymously (UUID) in Supabase `simulation_sessions`, including baseline inputs, turn-choice IDs/labels, `event_log`, terminal type/summary, final metrics, AI analysis text (if generated), and post-survey fields.

#### 2.2 Design

We used a **single-session exposure design** combining pre/post questionnaires and behavioral logging. The intervention was completing one full sandbox run (optional AI debrief and post-survey).

**Independent variables (IVs):** (a) exposure to the live sandbox and self-selected pathway (technology, compliance branch, income/energy choices—not experimenter-assigned); (b) participant identity (student, converted farmer, unconverted farmer, other) as a between-subjects factor.

**Dependent variables (DVs):** (1) **Survey cognition/attitudes**—for students and other non-farmers: pre Q1 and post Q2 (5-point Likert on understanding of coal-to-gas and heating costs), Q4 (strategy change if replayed), S1 (simulator helpfulness vs. text), recommendation intent, and AI helpfulness; for converted farmers: cost realism (F4), best/worst-matching stages (F6–F7), subsidy coping; for unconverted farmers: concerns (N2), attitude shift (N3), preferred route (N4). (2) **Behavioral logs**—five-turn choices and terminal type. (3) **Simulated outcomes**—terminal energy burden, heating cost, surplus, compliance, emission score, and CO₂ tons.

**Pre/post structure:** Non-farmers completed a **one-item pre-survey** (Q1) before simulation and a **~2-minute post-survey** after AI debrief. **Converted and unconverted farmers skipped the pre-survey** and only completed the post-survey (optional interview willingness; phone number collected only if interview is accepted).

**Comparison targets:** within-person pre/post deltas (Q2−Q1, non-farmers only); distributions of burden/compliance/emission by route and terminal type; cross-household comparison within the same village (`village_name`) **[TODO: whether village-level aggregation is implemented]**.

#### 2.3 Consent

Participation began with three first-screen layers: **welcome** (identity/background), **context briefing**, and **informed consent** (`consentOverlay`). The consent screen stated that data are **anonymous** (no name; phone not collected by default), participation is **voluntary**, users may **exit anytime**, and data are used **only to improve the simulator and for academic research** (not advertising). The main app unlocked only after clicking “Agree.” The tool is a **policy/livelihood decision simulation for public education**, not a clinical, diagnostic, or therapeutic intervention.

#### 2.4 Recruitment, coding & analysis

**Recruitment:** We targeted **20+ participants** (`templates/indexChinese.html`), including classmates and rural users **[TODO: confirm village-cadre-assisted recruitment]**, plus organic traffic via the public URL. **[TODO: recruitment period, final N, target village name.]** Simulator constants were additionally calibrated from prior field conversations in Baoding, Zhangjiakou, and Shijiazhuang and from literature **[TODO: interview N and whether reported separately]**.

**Open-ended coding:** Post-survey free text (e.g., student S3 reflection, other-audience O4–O5, non-farmer Q_end2 suggestions, Q3 “other,” negative AI feedback) will be analyzed via **[TODO: coding scheme, e.g., dual-coder thematic analysis / codebook]**; **no codebook is fixed in the repository yet**.

**Statistical analysis:** Exported Supabase records will be analyzed with **[TODO: paired pre/post test, e.g., Wilcoxon signed-rank or paired t-test with normality check]** for Likert items; categorical outcomes (route, terminal type, attitude shift) via **[TODO: descriptive frequencies / Fisher’s exact / χ²]**; simulated metrics compared across routes and identities **[TODO: specific grouping and tests]**. Thematic coding will supplement quantitative findings **[TODO: whether themes enter formal inferential models]**.

---

### 材料边界说明（Simulation vs. AI）

| 组件 | 性质 | 说明 |
|------|------|------|
| 五回合模拟引擎 | 确定性算法 + 文献常数 | 非 LLM 预测；结局由规则与概率模型计算 |
| 智能分析 | 真实 DeepSeek API | 系统提示词为人工 curated；输出随会话日志变化；失败无 mock 回退 |
| 问卷与日志 | 实证采集 | 存入 Supabase，供 pre/post 与路径分析 |

---

## 五步对照（Abstract）

| 步 | 内容要点 |
|---|---|
| 1 Hook | 减污 vs 用不起；误解＝只问「清洁取暖好不好」 |
| 2 Gap | 宏观/政策层研究多，缺户级可交互村级选路工具 |
| 3 Artifact | 保定村级 5 回合清洁取暖转型模拟沙盘 + 智能分析 |
| 4 Method | pre/post 问卷 + 行为日志；N=21（2026-06-28—07-05）；认知/偏好/真实感 + 负担率/合规/排放 |
| 5 Expected | *We expect…*（无数字） |

---

## 待补 `[TODO]`（Abstract + Methods 共用）

~~1. **最终样本量与招募时段**~~（Abstract 已写入：N=21，2026-06-28—07-05，河北省/北京市）
~~2. **具体村庄/招募渠道**~~（Abstract 已写入：课程同学 + 公开链接；农村样本以河北省为主、含北京市延庆）
3. **Pre/post 配对检验**与分类变量检验的具体选择
4. **开放题 codebook** 与编码流程（单人/双人、一致性检验）
5. **村级多户汇总分析**是否已实施
6. **前期实地访谈**是否单独写入 Methods、样本量多少

---

## 依据来源（仓库内）

- `spec.md` — 研究问题、假设、MVP 描述
- `research/summary.md` — 背景、争论、研究空白
- `midterm/midterm-pre.txt` / `midterm/midterm-draft.md` — 方法与设计
- `index.html` — 前后测问卷、行为日志、模拟指标、知情同意、Supabase 同步
- `api/chat.js` — DeepSeek API 与系统提示词
- `algori_spec.md` — 模拟算法与常数口径
- `templates/indexChinese.html` — 目标样本与反馈设计说明
- `supabase/migration_*.sql` — 研究数据表结构
