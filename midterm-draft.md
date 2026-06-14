## Title
Baoding Coal-to-X Village Transition Simulation Sandbox  
Guo Hang  
Research Advisor: Lawted Wu

## Research Question & Hypothesis
Research Question: How can my clean heating transition simulation sandbox use household data from one village in Baoding coal-to-X areas to recommend the most suitable clean heating transition pathway for the whole village?

Hypothesis: I hypothesize that using household-level data in the simulation sandbox will make village-level clean heating pathway recommendations more accurate, because it can better match the income, housing conditions, heating costs, and affordability constraints of most local households.

## Background
My project is about rural clean heating in Baoding, Hebei.

Since 2016, Baoding has been an important coal-control area in the Beijing-Tianjin-Hebei region. Many rural families changed from coal to cleaner heating, especially coal-to-gas.

This policy has clear environmental value. It can reduce scattered coal burning and improve air quality. But for many rural families, the harder question is not only "Is clean heating good?" The harder question is "Can people afford to use it every winter?"

This matters to farmers because heating is a basic need. It matters to village governments because one village often follows one main heating pathway. It also matters to the public because a policy can look successful at the city level, but still create pressure at the household level.

If the chosen pathway is too expensive, families may heat less, feel cold, or even return to coal. So my project focuses on affordability, household differences, and village-level decision making.

## Literature Review
Zhao et al. (2024) found that clean heating costs in rural Northern China are highly sensitive to subsidies. Their study shows that subsidy removal can raise heating spending and increase the share of households that cannot afford heating. This helps my project define affordability as a key variable. But it does not give a simple village-facing tool for local decision makers.

Yu and Xin (2021) studied clean heating and heating poverty. Their work gives useful burden levels, such as pressure when heating costs take a high share of income. This helps my simulator use energy burden as a warning sign. But the study is still not a hands-on tool for one specific Baoding village.

Li, Song, and Zhu (2021) found that gas costs can strongly affect household choices. They also discuss the risk that families may go back to coal when clean heating becomes too expensive. This supports my focus on behavior and compliance. But the paper does not combine income, housing, cost, and local pathway choice in one interactive sandbox.

He et al. (2021) reported that some clean-heating households in Baoding returned to coal. This shows that transition is not finished after equipment is installed. The missing part is a way to test which pathway may stay affordable for most families in one village.

Zhang et al. (2024) studied the uneven distribution of health benefits and economic costs in the clean heating campaign. Their finding is important because Baoding-type cities may carry high costs while getting fewer benefits. This supports my concern about fairness. But the study is regional, not household-level.

Liu and Mauzerall (2020) compared costs of clean heating technologies in China. Their work helps show why different technologies matter. Gas, electricity, heat pumps, and insulation may not fit every village in the same way. My project adds a local, household-data-based decision layer.

My new angle is this: I am not only asking whether clean heating is good. I am asking which coal-to-X pathway fits one village best, based on the real conditions of its households.

## Research Design / Method
My artifact is a clean heating transition simulation sandbox.

In the current MVP, a user enters household information, such as income, housing area, current heating method, and winter heating cost. Then the user goes through five rounds of decisions. The page shows changes in heating cost, annual surplus, legal compliance, emission score, and energy burden.

For the next version, I want to move from one household to one village. I will collect or simulate data from many households in one Baoding coal-to-X village. The data will include income, house size, heating cost, heating method, gas or electricity price, subsidy level, and whether the household feels the cost is affordable.

The main users will be Baoding coal-to-X rural households, local stakeholders, and people who care about the coal-to-X issue. If possible, I also want feedback from village-level decision makers.

I will collect feedback in three ways. First, I will ask users to run the sandbox and choose a pathway. Second, I will ask short questions before and after use about affordability and data-based decision making. Third, I will ask users what feels unrealistic or missing.

For analysis, I will compare pathway outcomes across households. I will look at energy burden, affordability risk, and how many households can stay under a safe burden level. I will also summarize user feedback to improve the model.

## Research Plan & Challenges
By June 20, I will use this draft for the midterm presentation. I will explain the research question, the hypothesis, the current MVP, and the evidence I have collected.

In late June, I will improve the simulator logic. I will make the household inputs more realistic. I will also make the pathway recommendation clearer, especially for gas, electricity, heat pumps, and insulation.

In early July, I plan to design a simple village data table. Each row will represent one household. The sandbox will use this table to compare possible village-level pathways.

After that, I will run a small user test. I will ask users to try the sandbox, answer short questions, and give comments. I will not claim strong results until the user study is complete.

The main challenge is data quality. Real household heating data can be private and hard to collect. I may need to start with anonymous survey data or carefully calibrated sample data.

Another challenge is model accuracy. A simple sandbox cannot fully represent gas supply, local subsidies, house insulation, and family behavior. I will be clear about what is estimated and what still needs verification.

A third challenge is communication. The tool must be easy enough for non-experts, but still serious enough for policy discussion.

## Expected Results — user study not yet run
I expect users to see that there is no single best pathway for every village.

I expect the sandbox to make affordability more visible. Users may notice that the same policy can create different pressure for families with different income, house size, and heating cost.

I also expect users to become more supportive of household-data-based village decisions. Instead of choosing a pathway only by policy slogan, they may want to compare data first.

I do not have user study results yet. I will not report any user numbers, percentages, or final conclusions until I run the study.

## References
Dialogue Earth. (2023). Rural clean heating progress. Dialogue Earth.

He, G., Lin, J., Sifuentes, F., Liu, X., Abhyankar, N., & Phadke, A. (2021). De-Coalizing Rural China. Frontiers in Energy Research. https://www.frontiersin.org/journals/energy-research/articles/10.3389/fenrg.2021.707492/full

Li, J., Song, S., & Zhu, X. (2021). Subsidies, Clean Heating Choices, and Policy Design in Rural China. Sustainability. https://www.mdpi.com/2071-1050/13/1/169

Liu, J., & Mauzerall, D. L. (2020). Costs of clean heating in China. Energy Economics.

Meng, W., et al. (2023). Significant but Inequitable Cost-Effective Benefits of Clean Heating in Northern China. Environmental Science & Technology.

National Development and Reform Commission et al. (2017). Clean heating plan for Northern China in winter (2017-2021). https://www.ndrc.gov.cn/xxgk/zcfb/tz/201712/t20171220_962623.html

Xie, Y., et al. (2022). Who suffers from energy poverty after clean heating transitions? Energy Economics.

Yu, S., & Xin, L. (2021). Clean heating and heating poverty. Journal of Cleaner Production.

Zhang, et al. (2024). Uneven distribution of health benefits and economic costs in clean heating. Science Bulletin.

Zhao, et al. (2024). Exploring economically sustainable solutions for clean heating in rural Northern China. Fundamental Research. https://pmc.ncbi.nlm.nih.gov/articles/PMC12869784/

## Acknowledgements
I would like to thank Research Advisor Lawted Wu for his criticism and guidance.

His feedback helped me turn this project from a simple web game into a clearer research tool.
