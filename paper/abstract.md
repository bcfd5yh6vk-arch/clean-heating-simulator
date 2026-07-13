# 论文草稿（Abstract + Introduction + Literature Review + Methodology）

> 华北村级清洁取暖转型模拟沙盘 · CTB 研究论文  
> Abstract 已按 RQ / 方法 / 关键结果 / 结论更新。  
> Methodology 已按最新 Supabase 数据与 post-survey 结构更新。Results / Discussion 尚未写入。

---

## Abstract · 摘要

### 中文

华北农村煤改气/煤改电减少了散煤污染，但补贴退坡后，不同家庭是否用得起、用得稳，仍取决于收入、住房面积、保温条件与取暖需求。本研究提出的问题是：户级交互模拟能否帮助用户理解清洁取暖在环保、成本和合规之间的权衡，并为村级煤改X路径选择提供证据。我们构建并上线了一个五回合清洁取暖转型沙盘，用户输入整户收入、住房面积和年取暖费，比较天然气、地源热泵、空气源热泵等路线，并查看能耗负担率、合规度和排放达标度。2026 年 6 月 28 日至 7 月 5 日，21 名参与者完成了模拟和 post-survey，其中 14 名非农户用户具备可配对的 pre/post 认知数据，11 人试玩后理解分数提高；17 人认为智能分析帮助较大；农户样本显示，不同家庭会走向不同技术路线或终局。结果表明，该沙盘能把抽象政策转化为可体验的家庭账本和路径比较，并支持将户级数据汇总为华北农村村级清洁取暖决策参考。

---

### English · Abstract

Rural North China's coal-to-X transition has reduced coal pollution, but many households still struggle with winter heating costs as subsidies taper. This study asked whether a household-level interactive simulation could help users understand trade-offs among clean air, affordability, and compliance, while producing evidence for village pathway choice. We built and deployed a five-turn clean-heating sandbox in which users entered household income, housing area, and heating costs, compared gas and heat-pump routes, and viewed energy burden, compliance, and emission indicators. From June 28 to July 5, 2026, 21 participants completed the simulation and post-survey; 14 non-farmer users also had paired pre/post understanding scores. Understanding improved for 11 of those 14 users, 17 participants rated the AI debrief as helpful, and farmer logs showed that route choices and outcomes differed by household conditions. The sandbox made policy trade-offs concrete and suggests that village clean-heating decisions should compare household-level affordability rather than assume one universal route.

---

## Introduction · 引言

### 中文

冬季取暖是华北农村最基本的生活需求之一。自 2016 年前后国家推进北方地区冬季清洁取暖以来，数以千万计农户由散煤转向天然气、电力或热泵等「煤改X」路线，区域空气质量显著改善，冬季散煤使用大幅下降。然而，这一环境收益并不自动转化为所有家庭的可持续用能：改造阶段的一次性设备投入与运行阶段的持续取暖支出，往往由农户自行承担；随着设备补贴与运行补贴按 cohort 阶梯退坡，不少家庭面临「改得起、用不起」——取暖费占整户收入比例上升，出现少开暖气、室温偏低，乃至返煤或双火源等现象。公共讨论与部分政策叙事仍常停留在「清洁取暖好不好」的二元判断，较少追问：在收入、住房面积、保温条件与取暖习惯各不相同的户级账本下，**哪一条煤改X路径对多数家庭更可负担、更可合规、更可长期维持**。

这一问题的政策重要性在于，华北许多村庄的取暖技术路线并非完全由单户自由决定，而是在村级或乡镇层面统一推进、统一施工。若所选路径与多数农户的现金流和能耗负担不匹配，即使环境指标达标，转型也可能在运行阶段失稳。既有研究已从多角度记录了这一张力：环境与健康研究证实清洁取暖可降低 PM₂.₅ 暴露与碳排放；能源经济与能源贫困文献指出，气费占可支配收入超过约 5% 即可显著改变用能行为，补贴退坡可使取暖支出明显上升、不可承受户比例扩大；政策与实地报道则揭示县级补贴执行差异、气价顺价、设备更换周期与返煤风险。Agent-based 与宏观政策模拟表明，户级行为可以汇总为村庄或区域结果，但现有工具多停留在区域统计、学术模型或「是否应当清洁取暖」的宏观评估，**缺少面向普通农户与关心者的、可输入真实或估算户级数据、可交互比较天然气/热泵/保温等路线并纳入补贴退坡与合规压力的村级决策沙盘**。

本研究针对上述空白，设计、部署并评估了一款**华北村级清洁取暖转型模拟沙盘**（https://www.clean-heating-simulator.com）。参与者代入一户农家，输入整户年收入、盈余、住房面积与煤改前年取暖费，在五个回合中做出是否转型、技术路线、增收或节能、应对补贴退坡等选择，并实时查看年取暖费、能耗负担率、法律合规度与排放达标度；终局后可请求基于操作日志的智能分析（真实大语言模型 API，非预设脚本文本）。模拟引擎本身为确定性算法，参数来自文献与公开统计校准。研究问题为：**户级交互模拟能否帮助不同身份用户（学生、已改/未改农户、政策与媒体关注者）更具体地理解清洁取暖在环保、成本与合规之间的权衡，并为村级路径比较提供可汇总的行为与态度证据？** 我们假设：（H1）农户用户能借助模拟识别与自身条件更匹配的煤改X路径；（H2）学生与其他非农户用户的取暖花费认知在试玩后有所提升。2026 年 6 月 28 日至 7 月 5 日，我们通过课程同学与公开链接招募 21 名全部完成样本（含河北省多地及北京市延庆农村用户），采用 pre/post 问卷与 Supabase 行为日志评估上述问题。

本文结构如下：引言阐述问题背景与研究意义；文献综述整理清洁取暖的环境收益、经济负担、技术路线与政策模拟研究；方法描述已上线作品、研究设计、知情同意与招募分析计划；结果与讨论将报告问卷、日志与模拟结局的发现及其对村级清洁取暖决策的启示（待写入）。

### English · Introduction

Winter heating is a basic livelihood need in rural North China. Since the national push for clean winter heating in the mid-2010s, tens of millions of farm households have shifted from scattered coal to coal-to-X routes such as natural gas, electricity, or heat pumps. Regional air quality has improved and winter coal use has fallen sharply. Environmental gains, however, do not automatically translate into sustainable energy use for every family. Upfront retrofit costs and recurring winter bills are largely borne by households; as equipment and operating subsidies phase down by cohort, many face a familiar tension: households can afford the switch but not everyday use. Heating bills rise as a share of annual income, indoor temperatures drop, and some households return to coal or maintain dual fuel sources. Public debate often still asks only whether clean heating is "good," rather than which coal-to-X pathway fits diverse household budgets, housing conditions, and compliance constraints.

The policy stakes are concrete. In much of North China, village- or township-level campaigns coordinate technology choice and installation. If the chosen route does not match most households' cash flow and energy burden, transitions that look successful on paper may prove unstable in operation. Prior work documents this tension from multiple angles. Environmental and health studies show that clean heating reduces PM₂.₅ exposure and carbon emissions (Yuan et al., 2025). Energy-economics and energy-poverty research finds that gas spending above roughly 5% of disposable income materially changes behavior, and that subsidy withdrawal raises winter costs and the share of households under affordability stress (Zhao et al., 2024). Field evidence reports county-level subsidy variation, tariff pass-through, equipment replacement cycles, and coal rebound (He et al., 2021; Zhai & Li, 2023). Agent-based and regional policy models link household actions to village- or city-scale outcomes (Wang & Gao, 2023), yet few public-facing tools let users enter household income, floor area, and heating costs, compare gas, heat-pump, and insulation routes interactively, and experience subsidy phase-out and compliance pressure in one session.

This study addresses that gap by designing, deploying, and evaluating a **village-level clean-heating transition simulation sandbox** (https://www.clean-heating-simulator.com). Participants role-play a farm household, enter whole-household income, surplus, floor area, and pre-transition heating cost, then make choices across five turns—whether to transition, which technology to adopt, how to boost income or save energy, and how to cope with subsidy withdrawal—while viewing live indicators for heating cost, energy burden rate, legal compliance, and emission score. After the terminal state, they may request an AI debrief generated from session logs via a live language-model API (not a curated mock script). The simulation engine is deterministic and calibrated from literature and public statistics.

Our research question is: *Can household-level interactive simulation help users with different identities—students, converted and unconverted farmers, and other stakeholders—understand trade-offs among environmental goals, heating affordability, and compliance, and supply aggregatable evidence for village pathway comparison?* We hypothesize that (H1) farmer users can identify coal-to-X paths better matched to their own household conditions, and (H2) students and other non-farmers show improved understanding of heating-cost dynamics after one session. From June 28 to July 5, 2026, we recruited 21 fully completed cases (including rural users from Hebei Province and Beijing municipalities) through course outreach and a public URL, using pre/post surveys and behavioral logs stored in Supabase.

The remainder of the paper is organized as follows. The Literature Review summarizes evidence on environmental benefits, affordability pressure, technology choice, and policy simulation. The Methodology section describes the deployed artifact, design, consent, and analysis plan. Results and Discussion sections will report survey, log, and simulated-outcome findings and their implications for village clean-heating decisions (to be written).

---

## Literature Review · 文献综述

### 中文

#### 2.1 清洁取暖的环境收益

既有研究首先证明了煤改气、煤改电等清洁取暖政策的环境意义。北方地区冬季清洁取暖规划提出，以替代农村散煤为核心路径，减少冬季燃煤污染并提高农村清洁取暖率。围绕华北农村的实证研究也表明，清洁取暖能够降低散煤燃烧带来的 PM₂.₅、PAHs 与碳排放压力；Yuan 等关于河北农村清洁取暖碳减排方法的研究，进一步说明了将煤炭替代转化为可量化排放指标的必要性。也就是说，清洁取暖不是单纯的生活方式改变，而是大气治理、碳减排和农村能源转型共同作用的政策工具。

#### 2.2 可负担性、能源贫困与返煤风险

第二类文献指出，环境收益背后存在明显的户级经济压力。Zhai 和 Li 对北方农村清洁取暖改造的综述强调，高运行成本、基础设施不稳和农户返煤风险是政策持续推进的主要问题。Liu 等关于清洁取暖成本的研究表明，气、电等清洁路径在没有补贴时可能显著高于散煤成本；Zhao 等关于农村清洁取暖经济可持续性的研究进一步指出，补贴退坡会提高家庭取暖支出，并扩大能源负担不可承受人群。He 等关于 2+26 城市清洁取暖转型的研究也记录了复烧散煤和补贴依赖问题。这些研究共同说明，清洁取暖能否持续，不仅取决于是否安装设备，也取决于农户是否能长期承担运行费用。

#### 2.3 技术路线与村级决策问题

第三类研究关注不同煤改X路径的技术差异。天然气、电采暖、空气源热泵、地源热泵和保温改造在一次性投入、运行费、舒适度、基础设施依赖和后期维护方面差异较大。Qin 和 Qiu 关于煤改气争议后的未来取暖路径讨论提醒，煤改气并不一定是所有地区的长期最优解；Zhai 和 Li 也强调，北方农村清洁取暖改造应结合地方资源、农户收入、建筑条件和运行成本进行因地制宜选择。由于许多农村地区的取暖路线往往在村级或乡镇层面集中推进，单一技术路线如果不能适配多数家庭，可能导致「政策完成」和「农户承受」之间的脱节。

#### 2.4 政策模拟、AI 方法与本研究空白

第四类文献为本研究提供方法启发。Wang 和 Gao 对公共政策仿真中的 agent-based modeling 研究进行了综述，说明个体行为可以通过模拟连接到群体或区域结果。Ma、Wang 和 Wang 关于 AGI+MAS 的研究则提示，人工智能和多智能体模拟可以被用于公共政策推演和复杂决策辅助。现有研究已经能证明清洁取暖的环境收益、识别能源负担风险，并讨论技术路线差异；但较少有面向普通农户和公众的交互工具，让用户输入自己的家庭收入、住房面积和取暖费，在同一界面里比较天然气、热泵、保温、补贴退坡和合规压力。本研究的贡献正是在这一空白上，将区域层面的政策问题转化为户级、回合制、可记录数据的村级决策沙盘。

### English · Literature Review

#### 2.1 Environmental benefits of clean heating

Prior research first establishes the environmental importance of coal-to-X heating. National clean-heating policy framed rural scattered-coal replacement as a key route for reducing winter air pollution and raising clean-heating coverage in northern China. Empirical studies on rural clean heating also show that replacing coal can reduce PM₂.₅, PAH, and carbon-emission pressure. Yuan et al.'s work on carbon-emission reduction methods for rural clean heating in Hebei further shows why household heating choices need to be translated into measurable emission indicators. Clean heating is therefore not only a household technology change; it is also part of air-pollution control, carbon reduction, and rural energy transition.

#### 2.2 Affordability, energy poverty, and coal rebound

A second body of work shows that environmental benefits are accompanied by household-level cost pressure. Zhai and Li's review of clean-heating renovation in northern rural China identifies high operating costs, weak infrastructure, and coal rebound as key barriers. Liu and Mauzerall's research on clean-heating costs suggests that gas and electric routes can be much more expensive than coal without subsidies. Zhao et al. further show that subsidy withdrawal increases winter heating expenses and expands the share of households under affordability stress. He et al.'s study of the 2+26 region also documents coal rebound and subsidy dependence. Together, these studies show that a transition is not sustainable simply because equipment has been installed; households must also be able to afford daily winter use.

#### 2.3 Technology routes and village-level choice

A third set of studies focuses on differences among coal-to-X routes. Natural gas, electric heating, air-source heat pumps, ground-source heat pumps, and insulation retrofits differ in upfront cost, operating cost, comfort, infrastructure dependence, and maintenance. Qin and Qiu's discussion of future heating pathways after the coal-to-gas controversy suggests that coal-to-gas is not always the best long-term route. Zhai and Li similarly argue that clean-heating renovation should match local resources, household income, building conditions, and operating costs. Because many rural heating transitions are organized at village or township scale, a single route that does not fit most households can create a gap between policy completion and household affordability.

#### 2.4 Policy simulation, AI methods, and this study's gap

A fourth body of literature informs this study's method. Wang and Gao's review of agent-based modeling in public policy simulation shows how individual behavior can be linked to group or regional outcomes. Ma, Wang, and Wang's work on AGI+MAS suggests that AI and multi-agent simulation can support public-policy reasoning and complex decision-making. Existing studies can demonstrate environmental benefits, identify affordability risks, and compare technology routes, but few public-facing tools let farmers and other users enter household income, housing area, and heating costs, then compare gas, heat-pump, insulation, subsidy phase-out, and compliance pressure in one interface. This study fills that gap by turning a regional policy problem into a household-level, turn-based, data-recording village decision sandbox.

---

## Methodology · 研究方法

### 中文

#### 3.1 研究作品（Artifact）

本研究部署并上线了一款面向华北农村煤改X语境的**村级清洁取暖转型模拟沙盘**（https://www.clean-heating-simulator.com；静态单页 `index.html`，托管于 Vercel）。参与者无需注册账号：在首屏选择身份（学生、已煤改农户、未煤改农户或其他关心者）并填写基本背景后，进入华北农户家庭建档界面，输入**整户**年收入、年盈余、住房面积、常住人口与煤改前年取暖费用；固定设定为农民家庭、华北地区、初始取暖方式为散煤。

模拟共五个回合：（1）现状抉择（继续散煤或准备转型）；（2）合规压力（若继续散煤则触发基于住房面积与连续违规次数的概率性入户了解）；（3）技术路线（天然气、地源热泵或空气源热泵，改造成本与运行费按 100㎡ 基准线性缩放）；（4）增收或节能（提高收入、节约取暖或保暖修缮三选一）；（5）补贴退坡（由初始散煤费用换算等价气量并按固定退坡幅度增加年取暖费，随后终局判定）。界面实时显示六项指标——年取暖费、年收入、年盈余、法律合规度（0–100）、排放达标度（0–100）与能耗负担率（%）——以及回合叙事日志；终局分为成功转型、资金紧张或被处罚三类。

终局后，参与者可请求**智能分析**：浏览器向服务端 `/api/chat` 提交本局初始输入、逐步操作日志与终局状态；服务端以 **DeepSeek Chat Completions API**（`deepseek-v4-flash`）生成中文报告，系统提示词按身份分三套**人工撰写的结构化模板**（已改农户对照解读 / 未改农户改造建议 / 其他用户通用分析），要求模型仅引用日志中已有数字、分三段输出。API 未配置或调用失败时界面显示错误信息，**不提供预设脚本文本替代**。模拟引擎本身为确定性算法，经济、合规与排放常数来自文献与公开统计（见 `algori_spec.md`、`research/data/calibration_defaults.json`），部分阈值为简化估计并在界面说明中标注。

每次会话以 UUID 匿名写入 Supabase 表 `simulation_sessions`，记录初始户级输入、各回合选择 ID/标签、逐步 `event_log`、终局类型与摘要、终局六项指标、智能分析全文（若成功生成）及 post-survey 字段。

#### 3.2 研究设计（Design）

本研究采用**单次交互暴露 + 前后测问卷 + 行为日志**的混合设计，核心干预为完成一局完整模拟（含可选智能分析与 post-survey）。

**自变量（IV）**：（a）干预暴露——是否完成上线模拟器的一局体验（含所走路径：技术路线、合规分支、增收/节能选择等，由参与者自行决策，非实验者分配）；（b）参与者身份——学生、已煤改农户、未煤改农户或其他（组间因素）；（c）农户子样本中，已改/未改身份进一步区分问卷题项。

**因变量（DV）**分三层：（1）**认知与态度（问卷）**——学生与其他非农户用户：pre 测 Q1（5 点 Likert，煤改气/取暖花费了解程度）与 post 测 Q2（同维度了解程度）、Q4（若重来是否改变策略）、学生专属 S1（模拟器相对文章/讲解的帮助程度）、其他关注者 O2（理解同一方案在不同家庭中差异的帮助程度）、推荐意愿与智能分析有用性；已煤改农户：当前取暖方式、改后年取暖费区间、是否减少取暖支出、模型取暖费变化真实感（F4）、最像/最不像环节（F6–F7）、补贴变少后的应对方式等；未煤改农户：当前取暖方式、改造顾虑（N2）、模拟后的改造态度（N3）、自家优先路径（N4）。（2）**行为与路径（日志）**——五回合选项、是否到达技术路线回合、天然气/地源热泵/空气源热泵选择、终局类型、各阶段指标轨迹。（3）**模拟结局指标**——终局能耗负担率、年取暖费、年盈余、合规度、排放达标度与 CO₂ 吨数。

**Pre/post 结构**：学生与其他非农户在点击「开始模拟」前完成 **pre-survey 单题**（Q1）；模拟与智能分析结束后填写 **post-survey**（约 2 分钟，身份定制题 + 共用结尾题）。**已煤改/未煤改农户流程跳过 pre-survey**，仅保留 post-survey。最新 post-survey 以单选、多选和 Likert 题为主；开放文本不作为强制核心量表，仅在选择「其他」时补充说明，或在农户自愿同意后续联系时填写手机号。手机号仅用于联系意向记录，不进入统计分析。

**比较指标**：同一参与者 pre/post 认知差值（Q2−Q1，限非农户）；post-survey 中推荐意愿、智能分析帮助程度、学生帮助程度、农户真实感/改造态度等比例；不同技术路线与终局类型下的负担率、合规度、排放分布；以及 A+B 有效样本池中完成模拟但未提交 post-survey 的路线选择与终局分布，用于分析行为路径和流失，而不混入问卷主分析。

#### 3.3 知情同意（Consent）

参与流程以三层首屏呈现：**欢迎页**（身份与背景）、**背景说明页**、**知情同意页**（`consentOverlay`）。同意页明确四项：数据**匿名**（不收集姓名；默认不收集手机号）、参与**自愿**（不点同意可关闭页面）、**随时可退出**、数据**仅用于改进模拟器与学术研究**（不作广告或商业用途）。用户点击「同意，进入模拟器」后方解锁主界面。本工具为**政策/生计决策模拟与公共教育**，不涉及临床诊断、治疗或心理干预；同意文案未使用医疗术语。

#### 3.4 招募、编码与统计分析（Recruitment, coding & analysis）

**招募与样本构成**：实际 Supabase 原始记录共 **53** 条，时间为 **2026 年 6 月 28 日至 7 月 5 日**。参与者包括学生、华北地区农民（已煤改农户与未煤改农户）以及其他关注农村清洁取暖议题的人士，主要通过课程同学、公开链接和线上转发自然招募；本研究仅分析网页会话、问卷与行为日志数据。53 条记录中，身份分布为学生 19 条、已煤改农户 15 条、未煤改农户 8 条、其他人士 11 条。

**数据清洗与分组**：研究使用 `export_simulation_sessions.py` 对 Supabase 导出的 `simulation_sessions` 进行标注。清洗规则为：（a）`identity_detail` 为「测试」或 `Lawted 村` 的记录标记为测试项并排除；（b）会话时长不足 30 秒或没有 `ended_at` 的记录视为未形成有效体验，进入 C 类清洗组；（c）会话时长 ≥30 秒且已结束模拟、但缺少 post-survey 或非农户 Q1/Q2 不完整的记录进入 B 类「有效未完成」；（d）已结束模拟并提交 post-survey 的农户记录，或已结束模拟、提交 post-survey 且 Q1/Q2 齐全的学生/其他用户记录，进入 A 类「全部完成」。最终得到 **A 类 21 条**（主分析样本：学生 7、其他 7、已煤改农户 4、未煤改农户 3）、**B 类 7 条**（均为农户，完成模拟但未提交 post-survey，用于路线/终局/流失分析）、**C 类 25 条**（23 条短时或未结束记录、2 条测试记录，排除出正式分析）。

**统计与分析口径**：A 类 21 条作为问卷主分析样本；B 类 7 条仅作为「完成模拟但未提交 post-survey」的路线与流失补充，不用于满意度、认知变化或 AI 帮助度比例。非农户 A 类样本中有 14 条可配对 Q1/Q2，报告 pre/post 理解分数的平均变化、提高人数比例，并使用 Wilcoxon signed-rank test 作为小样本、有序量表的敏感性检验。Post-survey 分类题以频数与百分比报告：包括智能分析帮助程度、推荐意愿、学生对模拟器帮助程度、已煤改农户真实感、未煤改农户态度变化与优先路径。行为日志按 A+B 有效样本池报告：技术路线选择在到达回合 3 的样本中合并同义标签后统计（天然气、空气源热泵、地源热泵），终局类型在全部有效模拟中统计（成功转型 / 被处罚 / 资金紧张），并按身份和路线报告能耗负担率、合规度、排放达标度的中位数或均值。由于样本量小且自选进入，分类变量不做强因果推断；如需比较身份组或路线组，仅使用 Fisher exact test 或描述性差异作为探索性结果。开放文本不做正式主题编码，仅在选择「其他」的补充说明中摘录少量匿名例子；电话号码字段只用于联系意向，不导入分析表。

---

### English · Methodology

#### 3.1 Artifact

We deployed a **village-level clean-heating transition simulation sandbox** for rural North China coal-to-X contexts (https://www.clean-heating-simulator.com; single-page `index.html` on Vercel). Participants need no account. After selecting an identity on the welcome screen (student, converted farmer, unconverted farmer, or other stakeholder) and entering basic background, they create a North China farm household profile: **whole-household** annual income, annual surplus, floor area, resident population, and pre-transition winter heating cost. Role (farm household), region (North China), and initial heating mode (scattered coal) are fixed.

The simulation runs five turns: (1) status quo choice (continue coal or prepare transition); (2) compliance pressure (probabilistic home visit if coal continues, scaled by floor area and consecutive non-compliance); (3) technology route (natural gas, ground-source heat pump, or air-source heat pump; retrofit and operating costs linearly scaled from a 100 m² baseline); (4) income boost or energy saving (one of three options); (5) subsidy phase-out (equivalent gas volume derived from initial coal spending, then a fixed per-m³ cost increase, followed by terminal adjudication). The interface displays six live indicators—annual heating cost, income, surplus, legal compliance (0–100), emission score (0–100), and energy burden rate (%—plus a turn-by-turn narrative log. Terminal outcomes are successful transition, financial strain, or enforcement-related seizure.

After the terminal state, participants may request **AI debrief**: the browser POSTs initial inputs, stepwise logs, and final state to `/api/chat`; the server calls the **DeepSeek Chat Completions API** (`deepseek-v4-flash`) with one of three **human-authored structured system prompts** (converted-farmer comparison / unconverted-farmer retrofit advice / default analysis). The model must use only logged numbers and return three Markdown sections. If the API key is missing or the call fails, the UI shows an error—**no curated mock script is served as fallback**. The simulation engine itself is deterministic; economic, compliance, and emission constants are literature-calibrated (`algori_spec.md`, `research/data/calibration_defaults.json`), with some thresholds simplified as noted in-app.

Each session is stored anonymously (UUID) in Supabase `simulation_sessions`, including baseline inputs, turn-choice IDs/labels, `event_log`, terminal type/summary, final metrics, AI analysis text (if generated), and post-survey fields.

#### 3.2 Design

We used a **single-session exposure design** combining pre/post questionnaires and behavioral logging. The intervention was completing one full sandbox run (optional AI debrief and post-survey).

**Independent variables (IVs):** (a) exposure to the live sandbox and self-selected pathway (technology, compliance branch, income/energy choices—not experimenter-assigned); (b) participant identity (student, converted farmer, unconverted farmer, other) as a between-subjects factor.

**Dependent variables (DVs):** (1) **Survey cognition/attitudes**—for students and other non-farmers: pre Q1 and post Q2 (5-point Likert understanding of coal-to-gas and heating costs), Q4 (strategy change if replayed), S1 (student-rated simulator helpfulness), O2 (other-audience understanding of household variation), recommendation intent, and AI helpfulness; for converted farmers: current heating method, post-transition cost band, cost-saving behavior, cost realism (F4), best/worst-matching stages (F6–F7), and subsidy coping; for unconverted farmers: current heating method, concerns (N2), attitude shift (N3), and preferred route (N4). (2) **Behavioral logs**—five-turn choices, whether the user reached technology-route selection, gas/ground-source heat-pump/air-source heat-pump selection, and terminal type. (3) **Simulated outcomes**—terminal energy burden, heating cost, surplus, compliance, emission score, and CO₂ tons.

**Pre/post structure:** Non-farmers completed a **one-item pre-survey** (Q1) before simulation and a **~2-minute post-survey** after AI debrief. **Converted and unconverted farmers skipped the pre-survey** and only completed the post-survey. The latest post-survey mainly uses radio buttons, checkboxes, and Likert items. Open text is not a required core measure; it appears only when a participant selects an “other” option or, for farmers, voluntarily agrees to leave a phone number for possible follow-up. Phone numbers are not included in statistical analysis.

**Comparison targets:** within-person pre/post deltas (Q2−Q1, non-farmers only); post-survey rates for recommendation intent, AI helpfulness, student helpfulness, farmer realism, and farmer attitude shift; distributions of burden/compliance/emission by route and terminal type; and behavior logs from completed simulations that lacked post-survey, reported separately as route/dropout evidence rather than as survey evidence.

#### 3.3 Consent

Participation began with three first-screen layers: **welcome** (identity/background), **context briefing**, and **informed consent** (`consentOverlay`). The consent screen stated that data are **anonymous** (no name; phone not collected by default), participation is **voluntary**, users may **exit anytime**, and data are used **only to improve the simulator and for academic research** (not advertising). The main app unlocked only after clicking “Agree.” The tool is a **policy/livelihood decision simulation for public education**, not a clinical, diagnostic, or therapeutic intervention.

#### 3.4 Recruitment, coding & analysis

**Recruitment and sample:** Supabase contained **53 raw session records** collected from **June 28 to July 5, 2026**. Participants included students, rural North China farmers (converted and unconverted), and other public users interested in rural clean heating, recruited through course outreach, a public URL, and online sharing. The raw identity distribution was 19 students, 15 converted farmers, 8 unconverted farmers, and 11 other users. The study analyzes only web sessions, survey responses, and behavioral logs.

**Data cleaning and grouping:** Supabase records were exported and annotated with `export_simulation_sessions.py`. Test entries were defined as records whose `identity_detail` was “测试” or “Lawted 村” and were excluded. Records with session duration under 30 seconds or no `ended_at` were also excluded from formal analysis. Records lasting at least 30 seconds and reaching an ending, but missing post-survey or missing Q1/Q2 for non-farmers, were labeled **B_有效未完成**. Records that ended and submitted post-survey were labeled **A_全部完成**; for student/other users, A status also required both Q1 and Q2. This produced **21 A records** for the main survey analysis (7 students, 7 other users, 4 converted farmers, 3 unconverted farmers), **7 B records** for route/dropout analysis only (all farmers), and **25 C records** excluded from formal analysis (23 short or unfinished sessions and 2 test entries).

**Statistical analysis:** A records are the main questionnaire sample; B records are used only to describe route choice, terminal outcome, and post-survey dropout. For the 14 non-farmer A records with paired Q1/Q2, we report the mean pre/post change, the proportion that improved, and a Wilcoxon signed-rank test as a small-sample ordinal sensitivity check. Post-survey categorical items are reported as counts and percentages, including recommendation intent, AI helpfulness, student-rated helpfulness, converted-farmer realism, unconverted-farmer attitude shift, and preferred path. Behavioral route analysis uses the A+B valid pool: technology choices are counted among sessions that reached turn 3, with legacy labels normalized into natural gas, ground-source heat pump, and air-source heat pump. Terminal outcomes are reported for all valid completed simulations. Simulated metrics (energy burden, compliance, emission score, and heating cost) are summarized by identity, route, and terminal type using medians or means. Because the sample is small and self-selected, group comparisons are exploratory; Fisher exact tests may be used for simple categorical contrasts, but the paper does not claim causal effects. Optional “other” text is used only as anonymized illustrative context, not as a formal coded qualitative dataset; phone numbers are excluded from analysis.

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
| 3 Artifact | 华北村级 5 回合清洁取暖转型模拟沙盘 + 智能分析 |
| 4 Methodology | Supabase 53 条原始记录；A=21 主分析、B=7 路线/流失补充、C=25 排除 |
| 5 Results / Conclusion | 14 个可配对非农户样本中 11 个理解提升；17/21 认为 AI 分析帮助较大；结论强调户级可负担性比较 |

---

## 数据与 Methodology 完成状态

- 招募与清洗：已写入 53 条原始记录、A/B/C 分类、2026-06-28—07-05 时间范围。
- 主分析：A 类 21 条全部完成样本；B 类 7 条仅用于路线/流失分析；C 类 25 条排除。
- 问卷：已按最新 post-survey 结构更新，不再设置强制开放题编码。
- 统计：已写入 pre/post 描述、Wilcoxon signed-rank 敏感性检验、频数/百分比、Fisher exact 探索性比较。
- 联系字段：农户手机号仅作为自愿后续联系字段，不进入分析。

---

## 依据来源（仓库内）

- `spec.md` — 研究问题、假设、MVP 描述
- `research/summary.md` — 背景、争论、研究空白
- `midterm/midterm-pre.txt` / `midterm/midterm-draft.md` — 方法与设计
- `index.html` — 前后测问卷、行为日志、模拟指标、知情同意、Supabase 同步
- `api/chat.js` — DeepSeek API 与系统提示词
- `algori_spec.md` — 模拟算法与常数口径
- `templates/indexChinese.html` — 目标样本与反馈设计说明
- `paper/defense-slides/indexxx.html` — 答辩叙事、研究问题与文献缺口
