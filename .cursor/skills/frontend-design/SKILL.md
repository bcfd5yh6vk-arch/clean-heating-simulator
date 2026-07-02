---
name: frontend-design
description: >-
  Distinctive, production-grade frontend UI for the clean-heating simulator.
  Use when improving homepage/landing visuals, hero sections, welcome overlays,
  promo graphics, typography, layout, motion, or redesigning index.html /
  xiaohongshu/promo-images.html. Follows Anthropic frontend-design process
  adapted for rural/low-literacy audiences and single-file HTML constraints.
---

# Frontend Design（本项目版）

基于 Anthropic Claude Code `frontend-design` 技能，适配 **农村清洁取暖模拟器**（`index.html` 单文件、农户低识字率、手机优先）。

## 何时使用

- 用户提到：主页美化、图形展示、视觉升级、landing、hero、宣传图、排版、动效
- 编辑 `index.html`、`xiaohongshu/promo-images.html` 的 **视觉层**（非模拟算法、问卷逻辑、Supabase）

## 本项目设计约束（优先于通用审美）

1. **受众**：河北农村农户、学生、关心政策的公众；不少用户识字有限 → 字少、层级清、按钮大。
2. **语气**：建设性、帮农户算账选路；不激化政策对立（见既有文案风格）。
3. **技术**：单文件内联 CSS；沿用 `:root` 令牌（`--primary` #2d6a4f、`--bg` 等），不引入构建链除非用户明确要求。
4. **程序不变**：除非用户要求，不改 JS 模拟逻辑、问卷字段名、API、数据库写入。
5. **可访问性底线**：对比度足够、焦点可见、`prefers-reduced-motion`、移动端 ≥18px 正文（农户场景可更大）。

## 流程（与 Claude Code 插件一致）

### 第一遍：设计计划（先写再码）

用简短 Markdown 输出计划，包含：

| 块 | 内容 |
|----|------|
| **目的** | 这一屏要让人做什么（点下一步 / 填表 / 理解背景） |
| **受众** | 本改动主要服务谁 |
| **色板** | 4–6 个命名 hex；优先延伸现有绿系，避免泛用紫渐变 + Inter |
| **字体** | 展示/正文分工；中文以系统栈 + PingFang/YaHei 为主，慎用难认艺术字 |
| **布局** | 一句话 + 简易 ASCII 线框 |
| **签名元素** | 一个让人记住的视觉点（如数据卡片、图标流、插画区） |

**自检**：若方案像「任意 SaaS 落地页」而非「北方农村取暖模拟」，修订后再写代码。

### 第二遍：实现与再批评

- 只改视觉相关 HTML/CSS；类名与现有 BEM 式命名风格一致（`hero-`、`welcome-`、`visual-flow-`）。
- 动效克制：一页 1 个主入场动效即可，避免「AI 味」满屏动画。
- 改完对照：手机 375px 宽度、欢迎三屏、农户简化说明是否仍清晰。

## 避免（AI slop）

- 泛用紫色渐变、玻璃拟态堆砌、无意义 01/02/03 装饰
- 大段学术词、与农户无关的英文标签
- 为好看牺牲表单可点区域（按钮高度 <44px）

## 本项目可参考的现有模块

- 欢迎流：`#welcomeOverlay` → `#contextOverlay` → `#consentOverlay`
- 主页：`header.hero`、`.visual-flow`、`.setup-quick-tip` / `.farmer-quick-tip`
- 农户说明：`.guidance-content.farmer-guide` 的 `.guide-key` / `.guide-sub`
- 宣传：`xiaohongshu/promo-images.html`

## 与 Cursor Canvas 的分工

- **改线上真实页面** → 直接改 `index.html`（本 skill）
- **快速试配色/版式、给同学看方案** → 可用 Canvas 做原型，定稿后再迁入 `index.html`

## 触发方式

在 Cursor 对话中说例如：

-「用 frontend-design skill 优化欢迎页第二屏的数据展示」
-「按 frontend-design 重做 hero 区图形，程序逻辑别动」
