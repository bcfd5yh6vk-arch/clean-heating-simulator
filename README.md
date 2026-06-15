# 保定煤改X村级转型模拟沙盘

一个面向保定煤改X区域的清洁取暖转型模拟沙盘，用农户家庭数据比较不同取暖路径的可负担性，并为村级清洁取暖决策提供参考。

## 上线地址

**https://clean-heating-simulator.vercel.app**

线上部署的是根目录 `index.html`，也就是一个纯 HTML/CSS/JavaScript 的单文件作品页。

## 项目结构

- `index.html`：单文件作品页，也是 Vercel 部署入口。
- `app.py`：Flask 应用主文件。
- `policysandbox.py`：政策沙盘与辅助逻辑。
- `spec.md`：MVP 规格与研究问题。
- `research/`：文献、政策、案例、参数和开放问题。
- `templates/indexChinese.html`：Flask 版本实际使用的页面模板。
- `static/`：Flask 版本的前端脚本和样式。

## 本地查看静态作品页

直接双击根目录的 `index.html`，或在浏览器中打开该文件。

## 本地运行 Flask 后端

```bash
python3 -m pip install -r requirements.txt
export ANTHROPIC_API_KEY="你的 Anthropic API Key"
python3 app.py
```

然后浏览器打开 [https://clean-heating-simulator.vercel.app](https://clean-heating-simulator.vercel.app)。

## 说明

当前仓库同时保留两个版本：

- 静态单文件作品页：用于 Vercel 展示和课程提交。
- Flask 版本：用于后续接入 Claude API 和扩展交互逻辑。
