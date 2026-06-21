# 保定煤改X村级转型模拟沙盘

一个面向保定煤改X区域的清洁取暖转型模拟沙盘，用农户家庭数据比较不同取暖路径的可负担性，并为村级清洁取暖决策提供参考。

## 上线地址

**https://clean-heating-simulator.vercel.app**

线上部署的是根目录 `index.html`（静态页）+ `api/chat.js`（Vercel Serverless，供 AI 分析调用）。**API Key 只存在 Vercel 环境变量中，不会出现在前端代码或 GitHub 仓库里。**

### 在 Vercel 配置 DeepSeek API Key（必做，否则 AI 不可用）

1. 打开 [vercel.com](https://vercel.com) 并登录。
2. 进入项目 **clean-heating-simulator**（或你的项目名）。
3. 顶部点 **Settings** → 左侧点 **Environment Variables**。
4. 填写：
   - **Key（名称）**：`DEEPSEEK_API_KEY`
   - **Value（值）**：粘贴你的 DeepSeek API Key（在 [platform.deepseek.com](https://platform.deepseek.com) 获取）
   - **Environments（环境）**：勾选 **Production**、**Preview**、**Development**（三个都勾上最省事）
5. 点 **Save** 保存。
6. 回到 **Deployments** 标签 → 最新一次部署右侧 **⋯** → **Redeploy** → 勾选 **Use existing Build Cache** → **Redeploy**。

完成后，线上 `https://你的域名/api/chat` 会用服务器端的 Key 调用 DeepSeek，浏览器里看不到 Key。

## 项目结构

- `index.html`：单文件作品页，也是 Vercel 部署入口。
- `app.py`：Flask 应用主文件。
- `policysandbox.py`：政策沙盘与辅助逻辑。
- `spec.md`：MVP 规格与研究问题。
- `research/`：文献、政策、案例、参数和开放问题。
- `midterm/`：中期答辩材料（PPT、演讲稿、draft、生成脚本）。
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

然后浏览器打开 [http://127.0.0.1:5000](http://127.0.0.1:5000)（本地 Flask 服务，不是 Vercel 线上地址）。

## 模拟参数口径（收入）

`research/data/calibration_defaults.json` 里有两个容易混淆的数字：

- **23006 元**：保定农村**人均可支配收入**（2024，人均口径）。
- **60000 元**：模拟器用的**整户年总收入**默认值（约 100㎡ 基准户），不是人均。

整户收入约为「人均 × 户内常住人数」的粗算结果（文件中按约 3 人 × 23006 ≈ 69000 取 **60000 作为偏保守的整户基准**）。用户在 `index.html` 里应输入自家**整户**年收入，不要直接填 23006。

更完整的参数说明见 `spec.md` 与 `research/data/stats_baseline.md`。

## 说明

当前仓库同时保留两个版本：

- 静态单文件作品页：用于 Vercel 展示和课程提交。
- Flask 版本：用于后续接入 Claude API 和扩展交互逻辑。
