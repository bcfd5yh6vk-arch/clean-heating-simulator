# 保定农户清洁取暖转型模拟器

这是一个面向课堂展示和论文前期研究的交互式 MVP：用户扮演保定农村家庭，在补贴退坡、气价压力、合规执法和技术选择之间做 5 回合取暖决策，观察家庭现金流、取暖负担率、合规度和排放达标度如何变化。

## 课程 Week 3 交付

- `index.html`：GitHub Pages 入口，自动跳转到作品页。
- `claude-chatbot-starter/index.html`：单文件作品页，可直接打开演示。
- `claude-chatbot-starter/spec.md`：MVP 规格。
- `claude-chatbot-starter/research/summary.md`：研究摘要和论文草稿。
- `claude-chatbot-starter/research/sources.md`：文献表 / synthesis matrix。
- `claude-chatbot-starter/research/questions.md`：开放问题与下一步核实计划。
- `claude-chatbot-starter/research/data/`：统计、引语、案例和参数材料。

## 本地查看

直接打开根目录 `index.html`，或打开：

`claude-chatbot-starter/index.html`

## Flask 版本

项目中也保留了一个 Flask 版本，后续如果要接入 Claude API，可以运行：

```bash
cd claude-chatbot-starter
python3 -m pip install -r requirements.txt
export ANTHROPIC_API_KEY="你的 Anthropic API Key"
python3 app.py
```

然后浏览器打开 [http://127.0.0.1:5000](http://127.0.0.1:5000)。

## MVP 范围

本周只定义并整理最小产品，不继续扩大功能。当前 MVP 的核心是“一名农户跑完一局取暖转型决策，并留下反馈”；地图、多角色博弈、真实账单接入和长期设备寿命模型都放到后续版本。

