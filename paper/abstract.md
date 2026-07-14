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

本文结构如下：引言阐述问题背景与研究意义；文献综述整理清洁取暖的环境收益、经济负担、技术路线与政策模拟研究；方法描述已上线作品、研究设计、知情同意与招募分析计划；结果部分报告问卷、日志与模拟结局数据；讨论部分说明这些结果如何回应研究问题、H1/H2 以及研究不足；结论部分总结贡献、意义、限制与未来方向。

### English · Introduction

Winter heating is a basic livelihood need in rural North China. Since the national push for clean winter heating in the mid-2010s, tens of millions of farm households have shifted from scattered coal to coal-to-X routes such as natural gas, electricity, or heat pumps. Regional air quality has improved and winter coal use has fallen sharply. Environmental gains, however, do not automatically translate into sustainable energy use for every family. Upfront retrofit costs and recurring winter bills are largely borne by households; as equipment and operating subsidies phase down by cohort, many face a familiar tension: households can afford the switch but not everyday use. Heating bills rise as a share of annual income, indoor temperatures drop, and some households return to coal or maintain dual fuel sources. Public debate often still asks only whether clean heating is "good," rather than which coal-to-X pathway fits diverse household budgets, housing conditions, and compliance constraints.

The policy stakes are concrete. In much of North China, village- or township-level campaigns coordinate technology choice and installation. If the chosen route does not match most households' cash flow and energy burden, transitions that look successful on paper may prove unstable in operation. Prior work documents this tension from multiple angles. Environmental and health studies show that clean heating reduces PM₂.₅ exposure and carbon emissions (Yuan et al., 2025). Energy-economics and energy-poverty research finds that gas spending above roughly 5% of disposable income materially changes behavior, and that subsidy withdrawal raises winter costs and the share of households under affordability stress (Zhao et al., 2024). Field evidence reports county-level subsidy variation, tariff pass-through, equipment replacement cycles, and coal rebound (He et al., 2021; Zhai & Li, 2023). Agent-based and regional policy models link household actions to village- or city-scale outcomes (Wang & Gao, 2023), yet few public-facing tools let users enter household income, floor area, and heating costs, compare gas, heat-pump, and insulation routes interactively, and experience subsidy phase-out and compliance pressure in one session.

This study addresses that gap by designing, deploying, and evaluating a **village-level clean-heating transition simulation sandbox** (https://www.clean-heating-simulator.com). Participants role-play a farm household, enter whole-household income, surplus, floor area, and pre-transition heating cost, then make choices across five turns—whether to transition, which technology to adopt, how to boost income or save energy, and how to cope with subsidy withdrawal—while viewing live indicators for heating cost, energy burden rate, legal compliance, and emission score. After the terminal state, they may request an AI debrief generated from session logs via a live language-model API (not a curated mock script). The simulation engine is deterministic and calibrated from literature and public statistics.

Our research question is: *Can household-level interactive simulation help users with different identities—students, converted and unconverted farmers, and other stakeholders—understand trade-offs among environmental goals, heating affordability, and compliance, and supply aggregatable evidence for village pathway comparison?* We hypothesize that (H1) farmer users can identify coal-to-X paths better matched to their own household conditions, and (H2) students and other non-farmers show improved understanding of heating-cost dynamics after one session. From June 28 to July 5, 2026, we recruited 21 fully completed cases (including rural users from Hebei Province and Beijing municipalities) through course outreach and a public URL, using pre/post surveys and behavioral logs stored in Supabase.

The remainder of the paper is organized as follows. The Literature Review summarizes evidence on environmental benefits, affordability pressure, technology choice, and policy simulation. The Methodology section describes the deployed artifact, design, consent, and analysis plan. The Results section reports survey, log, and simulated-outcome data; the Discussion section explains how these results answer the research question and H1/H2, and identifies limitations; the Conclusion summarizes contributions, implications, limitations, and future directions.

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

## Results · 结果

### 中文

本节报告数据、表格与定性结果，不解释结果成因。问卷主分析使用 A 类全部完成样本（n=21）；路线、终局与流失相关结果使用 A+B 有效模拟样本池（n=28）。

#### 4.1 样本清洗与身份分布

| 数据组 | 定义 | n | 用途 |
|---|---|---:|---|
| 原始 Supabase 记录 | 2026-06-28 至 2026-07-05 全部 `simulation_sessions` | 53 | 清洗前总体 |
| A_全部完成 | 已结束模拟并提交 post-survey；学生/其他还需 Q1/Q2 齐全 | 21 | 问卷主分析 |
| B_有效未完成 | ≥30 秒且已结束模拟，但缺 post-survey 或非农户 Q1/Q2 不完整 | 7 | 路线、终局、流失补充 |
| C_需清洗 | 短时/未结束记录或测试项 | 25 | 排除正式分析 |

| 身份 | 原始记录 | A_全部完成 | B_有效未完成 | C_需清洗 |
|---|---:|---:|---:|---:|
| 学生 | 19 | 7 | 0 | 12 |
| 其他关注者 | 11 | 7 | 0 | 4 |
| 已煤改农户 | 15 | 4 | 5 | 6 |
| 未煤改农户 | 8 | 3 | 2 | 3 |
| 合计 | 53 | 21 | 7 | 25 |

定性结果：清洗后的数据同时保留了非农户 pre/post 样本（用于 H2）和农户有效模拟样本（用于 H1 路线与终局观察），但两类证据的样本池不同，后续表格分别报告。

#### 4.2 H2 相关结果：非农户 pre/post 理解分数

学生与其他关注者的 Q1/Q2 使用 1–5 点 Likert 分数；A 类非农户样本中共有 14 条可配对记录。

| 组别 | n | pre 均值 | post 均值 | 平均变化 | 提高 | 不变 | 下降 | pre 中位数 | post 中位数 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 非农户合计 | 14 | 2.07 | 3.57 | +1.50 | 11 | 3 | 0 | 2 | 4 |
| 学生 | 7 | 1.71 | 3.86 | +2.14 | 6 | 1 | 0 | 1 | 4 |
| 其他关注者 | 7 | 2.43 | 3.29 | +0.86 | 5 | 2 | 0 | 2 | 4 |

Wilcoxon signed-rank 口径下，去除 3 个零差值后，11 个非零差值均为正，正秩和 W+ = 66，负秩和 W- = 0。

定性结果：与 H2 相对应，学生与其他非农户用户的理解分数在试玩后整体上移；14 个可配对样本中没有下降记录，学生组的平均变化幅度高于其他关注者组。该交互式模拟器有效提升了学生和其他社会人士对该问题的了解程度，符合 H2。

#### 4.3 Post-survey 频数结果

| 指标 | 样本 | 结果 |
|---|---:|---|
| 推荐意愿 | 21 | 非常愿意 8；比较愿意 8；很愿意 1；一般 2；不太愿意/较不愿意 2 |
| AI 分析有用性 | 21 | 帮助较大 17；帮助较小 2；完全没帮助 2 |
| 学生认为模拟器相对文章/讲解的帮助 | 7 | 非常有帮助 2；比较有帮助 5 |
| 其他关注者认为“同一方案在不同家庭中差异”的帮助 | 7 | 非常有帮助 2；比较有帮助 4；几乎没帮助 1 |

| “最大影响因素”选项 | n |
|---|---:|
| 取暖费用突然上涨（如补贴退坡） | 8 |
| 不同技术路线的一次性投入差异 | 5 |
| 入户了解 / 执法合规压力 | 5 |
| 改气/改电要先掏一大笔钱 | 2 |
| 年盈余变负、家庭现金流紧张 | 1 |

| 学生认为最难承受的负担（多选，n=7） | 提及次数 |
|---|---:|
| 补贴减少后的气价/电价 | 6 |
| 每年取暖运行费 | 5 |
| 改造设备一次性费用 | 4 |
| 不敢开暖气、室温不够 | 3 |
| 房屋保温差导致用能高 | 3 |

定性结果：post-survey 显示，多数完成用户愿意推荐模拟器并认为 AI 分析有帮助；学生与其他关注者的反馈集中在补贴退坡、运行费、一次性投入和家庭差异这些与 H2 所说“取暖花费认知”相关的项目上。该模拟器的科普效果更好，AI 分析是 helpful 的。

#### 4.4 H1 相关结果：农户样本、路线与终局

A+B 有效样本池中共有 14 条农户记录，其中 9 条到达第 3 回合技术路线选择，5 条未到达技术路线选择并进入执法/处罚类终局。

| 农户有效样本池 | n |
|---|---:|
| 已煤改农户 | 9 |
| 未煤改农户 | 5 |
| 合计 | 14 |

| 第 3 回合技术路线（农户 A+B，n=9） | n |
|---|---:|
| 天然气 | 4 |
| 地源热泵 | 3 |
| 空气源热泵 | 2 |

| 农户终局类型（农户 A+B，n=14） | n |
|---|---:|
| 成功转型 | 5 |
| 被处罚 / 执法命中 | 5 |
| 资金紧张 | 4 |

| 农户 post-survey 指标（A 类农户，n=7） | 结果 |
|---|---|
| 已煤改农户是否减少取暖支出（n=4） | 有 3；没有 1 |
| 已煤改农户模型取暖费真实感（n=4） | 大体接近但细节有差别 2；偏差较大 1；差不多 1 |
| 未煤改农户改造顾虑（多选，n=3） | 改造要掏太多钱 3；以后每年取暖费太高 3；设备坏了没人修 1；希望按自家节奏自愿决定 1 |
| 未煤改农户模拟后态度（n=3） | 更愿意尽快改造 2；更犹豫、担心每年花费太高 1 |
| 未煤改农户优先路径（n=3） | 先观望 1；先观望并听建议做保暖 1；wait 1 |

定性结果：与 H1 相对应，农户有效样本中出现了天然气、地源热泵和空气源热泵三类路线选择，也出现了成功转型、被处罚和资金紧张三类终局；农户 post-survey 同时记录了取暖费真实感、改造顾虑和模拟后的路径态度。该模拟器起到了收集真实农户数据、为农户提供不同路径下不同模拟结果的效果。

#### 4.5 路线、终局与模拟指标

下表使用 A+B 有效模拟样本池。技术路线表仅统计到达第 3 回合的 20 条记录；终局表统计全部 28 条有效模拟。

| 技术路线（A+B，到达第 3 回合） | n | 终局分布 | 终局能耗负担率中位数 | 终局取暖费中位数 | 合规度中位数 | 排放达标度中位数 | CO₂ 中位数 |
|---|---:|---|---:|---:|---:|---:|---:|
| 天然气 | 11 | 成功转型 11 | 2.4% | 2388 元 | 100 | 94 | 1.2 吨 |
| 空气源热泵 | 6 | 成功转型 4；资金紧张 2 | 3.5% | 2461 元 | 100 | 83 | 2.6 吨 |
| 地源热泵 | 3 | 成功转型 1；资金紧张 2 | 4.9% | 2867 元 | 100 | 92 | 3.1 吨 |

| 终局类型（A+B，n=28） | n | 路线分布 | 终局能耗负担率中位数 | 终局取暖费中位数 | 排放达标度中位数 | CO₂ 中位数 |
|---|---:|---|---:|---:|---:|---:|
| 成功转型 | 16 | 天然气 11；空气源热泵 4；地源热泵 1 | 2.5% | 2420 元 | 93 | 1.5 吨 |
| 被处罚 / 执法命中 | 8 | 未到达第 3 回合 8 | 4.8% | 2300 元 | 63 | 4.7 吨 |
| 资金紧张 | 4 | 空气源热泵 2；地源热泵 2 | 8.3% | 2952 元 | 85.5 | 3.3 吨 |

定性结果：A+B 有效模拟池把不同路线与终局下的能耗负担率、取暖费、合规度、排放达标度和 CO₂ 指标并列呈现，形成了研究问题所需的户级路线比较数据。根据这部分数据也可以看出，煤改X 确实可以减少二氧化碳排放、提升空气质量；不同煤改路径的终局数据与结果分布不同，可见该模拟器成功展现了不同家庭、不同路径选择所导致最终结果的差异。

### English · Results

This section reports data, tables, and qualitative results only. The main questionnaire analysis uses fully complete A records (n=21). Route, terminal-outcome, and dropout-related results use the A+B valid simulation pool (n=28).

#### 4.1 Sample cleaning and identity distribution

| Data group | Definition | n | Use |
|---|---|---:|---|
| Raw Supabase records | All `simulation_sessions` from June 28 to July 5, 2026 | 53 | Pre-cleaning dataset |
| A_fully complete | Ended simulation and submitted post-survey; student/other records also required Q1/Q2 | 21 | Main questionnaire analysis |
| B_valid incomplete | At least 30 seconds and ended simulation, but missing post-survey or non-farmer Q1/Q2 | 7 | Route, terminal-outcome, and dropout supplement |
| C_cleaning/excluded | Short/unfinished records or test entries | 25 | Excluded from formal analysis |

| Identity | Raw records | A_fully complete | B_valid incomplete | C_excluded |
|---|---:|---:|---:|---:|
| Student | 19 | 7 | 0 | 12 |
| Other stakeholder | 11 | 7 | 0 | 4 |
| Converted farmer | 15 | 4 | 5 | 6 |
| Unconverted farmer | 8 | 3 | 2 | 3 |
| Total | 53 | 21 | 7 | 25 |

Qualitative result: after cleaning, the dataset contains a non-farmer paired pre/post sample for H2 and a valid farmer simulation pool for H1, but these two forms of evidence come from different analytic pools and are therefore reported separately below.

#### 4.2 H2-related result: non-farmer pre/post understanding

Q1/Q2 used a 1–5 Likert scale. The A-record non-farmer sample contained 14 paired observations.

| Group | n | Pre mean | Post mean | Mean change | Improved | Same | Decreased | Pre median | Post median |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Non-farmers total | 14 | 2.07 | 3.57 | +1.50 | 11 | 3 | 0 | 2 | 4 |
| Students | 7 | 1.71 | 3.86 | +2.14 | 6 | 1 | 0 | 1 | 4 |
| Other stakeholders | 7 | 2.43 | 3.29 | +0.86 | 5 | 2 | 0 | 2 | 4 |

Under the Wilcoxon signed-rank setup, after removing three zero differences, all 11 nonzero paired differences were positive; W+ = 66 and W- = 0.

Qualitative result: in relation to H2, student and other non-farmer understanding scores moved upward after the sandbox session; none of the 14 paired records decreased, and the mean change was larger among students than among other stakeholders. The interactive simulator effectively improved students' and other stakeholders' understanding of the issue, consistent with H2.

#### 4.3 Post-survey frequency results

| Measure | Sample | Result |
|---|---:|---|
| Recommendation intent | 21 | Very willing 8; fairly willing 8; willing 1; neutral 2; less/not willing 2 |
| AI debrief helpfulness | 21 | Helpful 17; slightly helpful 2; not helpful 2 |
| Student-rated simulator helpfulness versus articles/explanations | 7 | Very helpful 2; fairly helpful 5 |
| Other stakeholders: help understanding household variation under the same policy | 7 | Very helpful 2; fairly helpful 4; almost not helpful 1 |

| “Biggest impact” option | n |
|---|---:|
| Sudden heating-cost increase, such as subsidy phase-out | 8 |
| Upfront-cost differences across technology routes | 5 |
| Home visits / enforcement and compliance pressure | 5 |
| Coal-to-gas/electricity requires a large upfront payment | 2 |
| Annual surplus turns negative / household cash-flow strain | 1 |

| Student-reported hardest burden (multiple choice, n=7) | Mentions |
|---|---:|
| Gas/electricity price after subsidy reduction | 6 |
| Annual operating heating cost | 5 |
| One-time equipment retrofit cost | 4 |
| Not daring to turn on heat / insufficient indoor temperature | 3 |
| Poor insulation raising energy use | 3 |

Qualitative result: post-survey responses show that most completed users would recommend the simulator and rated the AI debrief as helpful; student and other-stakeholder responses clustered around subsidy phase-out, operating cost, upfront cost, and household variation, which are the cost-understanding items named in H2. The simulator delivered stronger science-communication effects, and the AI debrief was helpful.

#### 4.4 H1-related result: farmer routes and outcomes

The A+B valid pool included 14 farmer records. Nine reached turn-3 technology-route selection; five did not reach turn 3 and ended in enforcement/seizure outcomes.

| Farmer valid pool | n |
|---|---:|
| Converted farmers | 9 |
| Unconverted farmers | 5 |
| Total | 14 |

| Turn-3 route choice among farmers (A+B, n=9) | n |
|---|---:|
| Natural gas | 4 |
| Ground-source heat pump | 3 |
| Air-source heat pump | 2 |

| Farmer terminal outcome (A+B, n=14) | n |
|---|---:|
| Successful transition | 5 |
| Enforcement/seizure | 5 |
| Financial strain | 4 |

| Farmer post-survey measure (A-record farmers, n=7) | Result |
|---|---|
| Converted farmers: reduced heating spending (n=4) | Yes 3; no 1 |
| Converted farmers: cost realism (n=4) | Mostly close with detail differences 2; large deviation 1; about the same 1 |
| Unconverted farmers: retrofit concerns (multiple choice, n=3) | Upfront cost 3; annual heating cost 3; equipment repair 1; voluntary household pace 1 |
| Unconverted farmers: attitude after simulation (n=3) | More willing to retrofit soon 2; more hesitant due annual cost 1 |
| Unconverted farmers: preferred path (n=3) | Wait and see 1; wait and improve insulation after advice 1; “wait” 1 |

Qualitative result: in relation to H1, the valid farmer pool recorded three route choices (natural gas, ground-source heat pump, and air-source heat pump) and three terminal outcomes (successful transition, enforcement/seizure, and financial strain); farmer post-surveys also recorded cost realism, retrofit concerns, and post-simulation route attitudes. The simulator collected real farmer data and let farmers compare simulated outcomes across different coal-to-X pathways.

#### 4.5 Routes, terminal outcomes, and simulated metrics

The route table uses the 20 A+B records that reached turn 3. The terminal-outcome table uses all 28 valid completed simulations.

| Technology route (A+B, reached turn 3) | n | Terminal outcomes | Median final burden | Median final heating cost | Median compliance | Median emission score | Median CO₂ |
|---|---:|---|---:|---:|---:|---:|---:|
| Natural gas | 11 | Successful transition 11 | 2.4% | 2388 yuan | 100 | 94 | 1.2 tons |
| Air-source heat pump | 6 | Successful transition 4; financial strain 2 | 3.5% | 2461 yuan | 100 | 83 | 2.6 tons |
| Ground-source heat pump | 3 | Successful transition 1; financial strain 2 | 4.9% | 2867 yuan | 100 | 92 | 3.1 tons |

| Terminal outcome (A+B, n=28) | n | Route distribution | Median final burden | Median final heating cost | Median emission score | Median CO₂ |
|---|---:|---|---:|---:|---:|---:|
| Successful transition | 16 | Natural gas 11; air-source heat pump 4; ground-source heat pump 1 | 2.5% | 2420 yuan | 93 | 1.5 tons |
| Enforcement/seizure | 8 | Did not reach turn 3: 8 | 4.8% | 2300 yuan | 63 | 4.7 tons |
| Financial strain | 4 | Air-source heat pump 2; ground-source heat pump 2 | 8.3% | 2952 yuan | 85.5 | 3.3 tons |

Qualitative result: the A+B valid simulation pool places burden rate, heating cost, compliance, emission score, and CO₂ side by side across routes and terminal outcomes, giving the household-level pathway-comparison data required by the research question. These data also show that coal-to-X routes can reduce CO₂ emissions and improve air-quality indicators; terminal metrics and outcome distributions differ across routes, indicating that the simulator successfully displayed how different households and pathway choices lead to different final outcomes.

---

## Discussion · 讨论

### 中文

#### 5.1 这些结果说明了什么

Results 显示，本研究的核心价值不在于证明某一条煤改X路径绝对最好，而在于把“清洁取暖好不好”这个抽象问题拆成了户级账本、技术路线、合规压力和终局结果。A+B 有效样本池中，不同用户走向了天然气、空气源热泵、地源热泵或未到达技术路线的执法终局；同一套模拟规则下，终局也分化为成功转型、资金紧张和被处罚。这说明该模拟器能够把 Introduction 中提出的村级路径选择问题转化为可记录、可比较的户级数据，而不是只给出一个统一答案。

结果也说明，模拟器的交互形式有实际科普效果。非农户样本的 pre/post 理解分数整体提高，学生组和其他社会人士组都出现正向变化；post-survey 中，多数参与者愿意推荐模拟器，且 17/21 认为 AI 分析帮助较大。也就是说，用户不是只完成了一次游戏流程，而是在完成流程后更能说出影响取暖决策的具体变量，如补贴退坡、运行费用、一次性改造投入和家庭差异。

#### 5.2 与研究问题和假设的对应

Introduction 中提出的研究问题是：户级交互模拟能否帮助不同身份用户理解环保、成本与合规之间的权衡，并为村级路径比较提供可汇总证据。Results 对这个问题给出了总体肯定的回答。对非农户而言，pre/post 数据和问卷反馈显示，模拟器提升了他们对煤改X成本结构和家庭差异的理解；对农户而言，模拟器记录了真实农户输入、路线选择、终局类型和 post-survey 反馈，为后续做村级汇总比较提供了原始材料。

H1 认为农户用户能借助模拟识别与自身条件更匹配的煤改X路径。当前结果支持 H1 的“形成性证据”：农户有效样本中确实出现了不同技术路线选择，且不同路线对应的终局和指标不同；农户 post-survey 也留下了对取暖费真实感、改造顾虑和优先路径的反馈。不过，H1 不能被解释为已经证明某条路径真实适合某个农户家庭，因为本研究没有长期跟踪真实改造后的费用与使用行为。

H2 认为学生与其他非农户用户的取暖花费认知在试玩后有所提升。当前结果更直接支持 H2：14 个可配对非农户样本中，11 个理解分数提高、3 个不变、0 个下降，pre 均值从 2.07 提高到 3.57。结合学生对模拟器帮助程度的评价和其他关注者对家庭差异理解的评价，可以说交互式模拟器比单纯文字说明更容易让用户看到“为什么同一政策到不同家庭会有不同结果”。

#### 5.3 对村级清洁取暖决策的含义

这些结果回应了 Introduction 中的核心矛盾：清洁取暖可以减少煤炭燃烧和 CO₂ 排放，但转型是否稳定，还取决于户级可负担性。Results 中，成功转型终局的 CO₂ 中位数较低、排放达标度较高；但资金紧张终局也可能发生在已经完成技术替代之后。这说明村级决策如果只看“是否完成煤改X”是不够的，还需要比较不同家庭在不同路径下的能耗负担率、年取暖费和年盈余变化。

模拟器的意义因此不是替代政府或农户做决策，而是提供一个低成本的试算场景。村庄可以先收集多户输入和模拟路线，再观察哪类家庭更容易在某一路径下进入资金紧张，哪类家庭能在补贴退坡后维持较低负担。这样的户级汇总数据可以帮助村级路径选择从单一路线推进，转向更重视家庭差异的方案比较。

#### 5.4 不足与边界

第一，样本量仍然较小，且来自课程同学、公开链接和线上转发，不能代表华北农村总体。A 类主分析样本只有 21 条，农户 A+B 有效样本为 14 条，因此结果适合说明模拟器的可行性和形成性效果，不适合做强因果推断或地区代表性结论。

第二，pre/post 认知提升只在学生与其他非农户中测量，农户流程没有设置同样的 pre-survey。因此，H2 的证据比 H1 更直接；H1 目前主要依赖行为日志、路线选择、终局结果和 post-survey 反馈。未来如果要更严格检验 H1，需要增加农户样本量，并在模拟前后记录农户对不同路径的偏好变化。

第三，模拟器使用的是确定性算法、文献常数和简化阈值，不能完全替代真实家庭账本、设备效率、房屋保温、地方气价和补贴政策。AI 分析也只是基于会话日志生成的解释文本，而不是独立预测模型。因此，本文结果应被理解为交互式政策教育和数据收集工具的初步评估，而不是对真实煤改X项目收益的最终测算。

### English · Discussion

#### 5.1 What the results mean

The results show that the main value of this study is not to prove that one coal-to-X route is universally best, but to break the broad question of whether clean heating is “good” into household budgets, technology routes, compliance pressure, and terminal outcomes. In the A+B valid pool, users moved toward natural gas, air-source heat pumps, ground-source heat pumps, or enforcement outcomes before reaching route selection. Under the same simulation rules, terminal outcomes also diverged into successful transition, financial strain, and enforcement/seizure. This means the sandbox turns the village pathway-choice problem raised in the Introduction into recordable and comparable household-level data, rather than a single universal answer.

The results also show that the interactive format has a practical educational effect. Non-farmer pre/post understanding scores increased overall, with positive movement among both students and other stakeholders. In the post-survey, most participants were willing to recommend the simulator, and 17/21 rated the AI debrief as helpful. Users did not only finish a game flow; after the session, they could identify concrete variables behind clean-heating decisions, such as subsidy phase-out, operating cost, upfront retrofit cost, and household variation.

#### 5.2 Fit with the research question and hypotheses

The Introduction asked whether household-level interactive simulation can help different users understand trade-offs among environmental goals, affordability, and compliance, while producing aggregatable evidence for village pathway comparison. The results give an overall affirmative answer. For non-farmers, pre/post data and survey feedback show improved understanding of coal-to-X cost structure and household variation. For farmers, the simulator recorded real farmer inputs, route choices, terminal outcomes, and post-survey feedback, creating raw material for later village-level aggregation.

H1 predicted that farmer users could use the simulation to identify coal-to-X paths better matched to their own household conditions. The current results support H1 as formative evidence: farmer records include multiple route choices, and different routes were associated with different terminal outcomes and metrics; farmer post-surveys also recorded cost realism, retrofit concerns, and preferred paths. However, H1 should not be read as proving that a specific route is truly optimal for a real household, because this study did not track actual post-retrofit spending or heating behavior over time.

H2 predicted that students and other non-farmer users would improve their understanding of heating-cost dynamics after one session. The current results support H2 more directly: among 14 paired non-farmer records, 11 increased, 3 stayed the same, and none decreased; the mean score rose from 2.07 to 3.57. Together with student-rated helpfulness and other stakeholders' ratings of household-variation understanding, this suggests that interactive simulation made it easier for users to see why the same policy can produce different household outcomes.

#### 5.3 Implications for village clean-heating decisions

These results speak to the central tension in the Introduction: clean heating can reduce coal burning and CO₂ emissions, but transition stability depends on household-level affordability. In the results, successful-transition outcomes had lower median CO₂ and higher emission scores, while financial-strain outcomes could still occur after technical conversion. Village decisions therefore cannot stop at whether coal-to-X equipment is installed; they also need to compare energy burden, annual heating cost, and surplus changes across household types and routes.

The simulator should therefore be understood as a low-cost trial environment, not as a replacement for government or household decision-making. A village could first collect household inputs and simulated route choices, then observe which households are more likely to face financial strain under each route and which can maintain lower burden after subsidy phase-out. Such aggregated household-level data can help village pathway choice move from one-size-fits-all implementation toward comparison across household differences.

#### 5.4 Limitations and boundaries

First, the sample is small and self-selected through course outreach, a public link, and online sharing, so it cannot represent rural North China as a whole. The main A-record survey sample has only 21 cases, and the farmer A+B valid pool has 14 cases. The findings are therefore best read as evidence of feasibility and formative effect, not as strong causal or regionally representative conclusions.

Second, pre/post understanding was measured only for students and other non-farmers; farmer users did not complete the same pre-survey. As a result, H2 has more direct evidence than H1. H1 currently relies on behavioral logs, route choices, terminal outcomes, and post-survey feedback. A stronger future test of H1 would require a larger farmer sample and pre/post measurement of farmers' route preferences.

Third, the simulator uses a deterministic algorithm, literature constants, and simplified thresholds. It cannot fully replace real household accounts, equipment efficiency, building insulation, local gas/electricity prices, or county subsidy rules. The AI debrief is also an explanation generated from session logs, not an independent prediction model. The results should therefore be understood as an initial evaluation of an interactive policy-education and data-collection tool, not as a final estimate of real coal-to-X project benefits.

---

## Conclusion · 结论

### 中文

#### 6.1 总结结论

本研究的结论是：华北农村清洁取暖转型不应被理解为“清洁取暖是否值得做”的单一判断，而应被理解为“哪一条煤改X路径在具体家庭条件下更可负担、更可维持、更能兼顾合规与减排”的比较问题。通过五回合交互式模拟器，本研究把收入、住房面积、初始取暖费、技术路线、补贴退坡、合规压力和终局指标放到同一个可操作场景中。结果显示，非农户用户的理解分数在试玩后提高，农户样本也产生了不同路线选择和不同终局。这说明该模拟器不仅是展示政策的网页工具，也可以作为收集户级数据、呈现路径差异和辅助村级比较的研究工具。

这一结论并不是简单重复 Results 中的数字，而是将它们合并为一个更具体的判断：交互式模拟能够把宏观政策争论转化为家庭层面的成本、排放和合规权衡。它不能直接替代真实政策评估，但能够让参与者在低风险环境中提前看到不同选择的后果，从而把讨论从“煤改气/煤改电好不好”推进到“对这一户、这一村，哪种组合更合适”。

#### 6.2 研究意义

理论上，本研究补充了清洁取暖研究中较少被呈现的“户级可交互证据”。已有文献已经说明清洁取暖有环境收益，也指出补贴退坡、运行费用和返煤风险会影响政策持续性；本研究进一步展示了如何把这些变量整合进一个普通用户也能操作的村级决策沙盘。它把政策模拟从专家模型和区域统计，向公众可体验、可记录、可汇总的形式推进了一步。

实践上，模拟器可以为村级或乡镇层面的清洁取暖路径选择提供前期试算。村庄不必只依赖单一技术路线或平均户数据，而可以收集多户家庭输入，比较不同路线下的能耗负担率、年取暖费、排放达标度和资金紧张风险。对农户而言，模拟器可以帮助他们在正式改造前理解补贴退坡、一次性投入和运行费用的长期影响；对学生和公众而言，它能把抽象能源政策转化为具体家庭账本，提高公共理解。

#### 6.3 研究限制

本研究的限制主要有三点。第一，样本量较小且自选进入，A 类问卷主分析只有 21 条，农户 A+B 有效样本为 14 条，因此不能代表整个华北农村，也不能作为强因果检验。第二，农户样本没有设置与非农户相同的 pre-survey，因此 H1 的证据主要来自行为日志、路线选择和 post-survey 反馈，而 H2 的 pre/post 证据更直接。第三，模拟器参数来自文献常数和简化规则，未能完全覆盖不同地区的气价、电价、补贴政策、房屋保温、设备效率和家庭劳动力差异。

此外，AI 分析虽然被多数用户评价为 helpful，但它仍是基于会话日志生成的解释文本，不是独立的政策预测模型。它的作用更接近帮助用户理解自己的模拟路径，而不是替代专家评估或真实工程测算。

#### 6.4 未来方向

未来研究可以从五个方向推进。第一，扩大样本，特别是增加不同县域、不同收入水平、不同住房条件的农户样本，并将线上模拟与线下访谈结合。第二，为农户用户加入 pre/post 结构，测量他们在模拟前后对天然气、空气源热泵、地源热泵、保温改造等路径的偏好变化，从而更严格检验 H1。第三，改进模型参数，将地方气价、电价、补贴规则、建筑保温等级和设备维护成本做成可切换参数，提高模拟器对具体村庄的适配度。第四，把多户模拟结果汇总为村级 dashboard，让村干部、农户和研究者能同时看到不同路线下的负担分布、减排结果和资金紧张风险。第五，利用该网站 demo 推广到不同的环境问题，并增加政府和企业视角，模拟不同群体之间的博弈与关系，从而发挥更大的宣传教育和政策模拟作用。

更长期来看，本研究可以发展为一个参与式政策模拟工具：农户输入自己的家庭条件，村庄汇总不同家庭的模拟结果，政策制定者据此比较不同煤改X组合的可负担性和环境收益。这样，清洁取暖决策就不只是从上到下完成一项改造任务，而是以户级数据为基础，寻找更公平、更稳定、更能持续减排的村级转型路径。在此基础上，同一交互式沙盘框架还可以扩展到其他环境议题，让政府、企业与居民等不同群体在同一场景中比较利益冲突与合作空间。

### English · Conclusion

#### 6.1 Summary of conclusions

This study concludes that rural North China's clean-heating transition should not be framed as a single question of whether clean heating is worthwhile. It should be treated as a comparative question: which coal-to-X pathway is affordable, maintainable, compliant, and emission-reducing under specific household conditions? Through a five-turn interactive simulator, this study placed income, floor area, initial heating cost, technology route, subsidy phase-out, compliance pressure, and terminal metrics into one usable scenario. The results show improved understanding among non-farmer users after the session, and farmer records produced different route choices and terminal outcomes. The simulator is therefore not only a policy-display website; it can also serve as a research tool for collecting household-level data, showing pathway differences, and supporting village comparison.

This conclusion is not a simple repetition of the numerical results. It synthesizes them into a more specific claim: interactive simulation can translate macro-level policy debate into household-level trade-offs among cost, emissions, and compliance. It cannot replace real policy evaluation, but it lets users preview the consequences of different choices in a low-risk setting, moving the question from “Is coal-to-X good?” to “Which combination fits this household and this village?”

#### 6.2 Implications

Theoretically, this study adds a form of household-level interactive evidence that is still uncommon in clean-heating research. Existing studies have shown environmental benefits and identified risks from subsidy withdrawal, operating cost, and coal rebound. This project shows how those variables can be integrated into a village decision sandbox that ordinary users can operate, and whose outputs can be recorded and aggregated. It moves policy simulation one step from expert models and regional statistics toward public-facing, experiential, and data-generating tools.

Practically, the simulator can support early-stage trial calculation for village- or township-level pathway choice. Villages do not need to rely only on one technology route or average household data; they can collect household inputs and compare energy burden, annual heating cost, emission score, and financial-strain risk across routes. For farmers, the simulator can make subsidy phase-out, upfront retrofit cost, and long-term operating cost visible before formal retrofit decisions. For students and the wider public, it turns abstract energy policy into a concrete household budget and improves public understanding.

#### 6.3 Limitations

This study has three main limitations. First, the sample is small and self-selected. The A-record main survey sample has 21 cases, and the farmer A+B valid pool has 14 cases, so the findings cannot represent all rural North China and should not be treated as strong causal evidence. Second, farmer users did not complete the same pre-survey as non-farmer users. As a result, H1 relies mainly on behavioral logs, route choices, and post-survey feedback, while H2 has more direct pre/post evidence. Third, the simulator uses literature constants and simplified rules, so it cannot fully capture local gas prices, electricity prices, subsidy rules, building insulation, equipment efficiency, or household labor differences.

In addition, although most users rated the AI debrief as helpful, it remains an explanatory text generated from session logs, not an independent policy prediction model. Its role is closer to helping users interpret their own simulated pathway than to replacing expert assessment or real engineering calculation.

#### 6.4 Future directions

Future research can move in five directions. First, it should expand the sample, especially farmer participants from different counties, income levels, housing conditions, and heating histories, and combine online simulation with offline interviews. Second, it should add a pre/post structure for farmer users, measuring whether their preferences among natural gas, air-source heat pumps, ground-source heat pumps, and insulation change after simulation; this would provide a stronger test of H1. Third, the model should improve parameter flexibility by allowing local gas prices, electricity prices, subsidy rules, insulation levels, and maintenance costs to be adjusted for specific villages. Fourth, multi-household results could be aggregated into a village dashboard showing burden distribution, emission outcomes, and financial-strain risk under different routes. Fifth, the same website demo can be extended to other environmental problems, with government and enterprise viewpoints added, so that interactions, conflicts, and relations among different groups can be simulated and the tool can serve a larger role in public education and policy simulation.

In the longer term, this project can develop into a participatory policy-simulation tool. Farmers would enter their household conditions, villages would aggregate simulated results, and policymakers could compare affordability and environmental outcomes across coal-to-X combinations. Clean-heating decisions would then become less about completing a top-down retrofit task and more about using household-level evidence to find fairer, more stable, and more durable village transition pathways. On that basis, the same interactive sandbox framework can also be adapted to other environmental issues, allowing government, firms, and residents to explore trade-offs and cooperation within one shared simulation setting.
