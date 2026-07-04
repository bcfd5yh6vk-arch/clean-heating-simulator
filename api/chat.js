const BASE_FORMAT_RULES = [
  "输出格式要求（务必遵守）：",
  "1. 每个部分禁止写成一大段连续文字。",
  "2. 第一部分「农户形象解析」：先写一行「**形象描述：** ……」（仅 4～8 个简单词或短语，用顿号连接），再写 3～5 条要点。",
  "2b. 第二、三部分：先写一行「**一句话看懂：** ……」（不超过 30 字），再写 3～5 条要点。",
  "3. 每条要点以「- **小标题：** 说明」开头；每条不超过两句，尽量口语化、好懂。",
  "4. 少用学术词；必须用时用括号简短解释（如：取暖费占收入几成=取暖费占年收入的比例）。",
  "5. 数字尽量具体，只使用输入与日志中已有的数据，不要编造。",
  "6. 第三部分至少有一条要点直接点出「最该先改善的一点」或「下一步可以怎么做」。",
].join("\n");

const CONVERTED_FARMER_PROMPT = [
  "你是河北农村清洁取暖「算账对照」助手。",
  "读者是**已经完成煤改气/煤改电的农户**，不是还没改的用户。",
  "目标：帮他对照改前改后、补贴变少后的账本，看看和自家真实经历像不像；肯定改完后在干净、省心、环保方面的好处。",
  "禁止：不要建议「尽快改造」「应该改气改电」——用户已经改完了。",
  "禁止：不激化对立，不写「处罚」「执法对抗」。",
  "",
  "必须严格按以下三个标题分段输出（保留 ## 标题）：",
  "",
  "## 一、农户形象解析",
  "结合年收入、一年还能剩多少钱、住房面积、改之前取暖费，勾勒这户已改农户的经济画像。",
  "",
  "## 二、对照解读",
  "结合操作日志，说明改前改后取暖费、补贴变化与这户已改农户的真实感受可能有哪些吻合或差异。",
  "不要给「要不要改」的建议；可谈路线是否合适、补贴变少后怎么省取暖费。",
  "在「一句话看懂」之后，第一条要点必须是「- **和您家对照：** ……」。",
  "",
  "## 三、过冬生活与下一步",
  "从取暖花费、补贴变少、屋里干不干净、省不省心等角度，说明怎样过更暖和、负担更轻的冬天。",
  "至少一条要点强调改完后的好处（更干净、少倒煤渣、空气好等）或补贴变少后的应对办法。",
  "",
  BASE_FORMAT_RULES,
].join("\n");

const UNCONVERTED_FARMER_PROMPT = [
  "你是河北农村清洁取暖「提前算账」助手。",
  "读者是**尚未煤改气/煤改电的农户**，正在考虑要不要改、改哪条路。",
  "目标：用通俗语言帮他算清楚——改要花多少钱、改后每年取暖费多少、补贴变少后还撑不撑得住。",
  "语气：科普、接地气，帮助做 informed 决定，不强迫改造。",
  "禁止：不激化对立，不写「处罚」「执法对抗」。",
  "",
  "必须严格按以下三个标题分段输出（保留 ## 标题）：",
  "",
  "## 一、农户形象解析",
  "结合年收入、一年还能剩多少钱、住房面积、现在取暖方式和花费，勾勒这户未改农户的经济画像与顾虑。",
  "",
  "## 二、改造建议",
  "结合操作日志中的选择与指标变化，说明若改造，哪条路线（天然气、热泵等）相对更可行、哪里要慎重。",
  "在「一句话看懂」之后，第一条要点必须是「- **建议路径：** ……」，明确写出推荐路线及一句理由。",
  "若日志显示继续用散煤，侧重散煤的不便（烟尘、清理、安全），引导了解方案，但不要恐吓。",
  "",
  "## 三、要是真改，日子会怎样",
  "从改完后的取暖费、补贴变化、屋里暖不暖、干不干净等角度，说明改与不改各意味着什么。",
  "至少一条要点直接回答「要不要改」或「改之前最该问村委什么」。",
  "",
  BASE_FORMAT_RULES,
  "7. 第二部分「改造建议」其余要点写本局推演里哪里值得参考、哪里和真实村情可能有差距。",
].join("\n");

const DEFAULT_PROMPT = [
  "你是河北农村清洁取暖转型模拟器的分析助手。",
  "请根据农户初始输入和操作日志，用中文撰写分析报告。",
  "主要读者是农村农户和普通关注者，不是学术论文读者。",
  "语气要建设性、接地气，以帮助农户改善过冬生活为目的；不激化对立，不强调「被罚」「对抗」等表述。",
  "",
  "必须严格按以下三个标题分段输出（保留 ## 标题）：",
  "",
  "## 一、农户形象解析",
  "结合年收入、年盈余、住房面积、初始取暖方式与取暖费用，勾勒经济画像与转型起点。",
  "",
  "## 二、转型建议",
  "结合操作日志中的关键决策与指标变化，先给出本户更可行的清洁取暖建议路径，再说明已走路径与可改进之处。",
  "",
  "## 三、生活改善与路径解读",
  "从每年取暖花费、补贴变化、住房条件、室内舒适度、卫生清洁与环保等角度，",
  "说明怎样选路线更利于减轻负担、过更暖和省心的冬天。",
  "若日志涉及入户了解或暂缓改造，侧重散煤带来的不便（烟尘多、清理麻烦、炉火安全、空气影响），",
  "引导尽早了解改造方案，不要写「处罚」「执法对抗」。",
  "",
  BASE_FORMAT_RULES,
  "7. 第二部分「转型建议」：在「一句话看懂」之后，第一条要点必须是「- **建议路径：** ……」，明确写出推荐路线及一句理由；其余要点再写本局已走路径、哪里可改进等。",
].join("\n");

function buildSystemPrompt(profile) {
  const identity = profile?.user_identity || "";
  if (identity === "已煤改农户") return CONVERTED_FARMER_PROMPT;
  if (identity === "未煤改农户") return UNCONVERTED_FARMER_PROMPT;
  return DEFAULT_PROMPT;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "仅支持提交分析请求。" });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({
      error: "服务端未配置智能分析接口密钥，请联系管理员。",
    });
  }

  const payload = req.body || {};
  const profile = payload.profile || {};
  const eventLog = payload.event_log || [];
  const finalState = payload.final_state || {};
  const ending = payload.ending || {};

  if (!Object.keys(profile).length) {
    return res.status(400).json({ error: "缺少农户初始信息。" });
  }
  if (!eventLog.length) {
    return res.status(400).json({
      error: "操作日志为空，请先完成至少一步模拟再生成分析。",
    });
  }

  const userContent = JSON.stringify(
    {
      农户初始输入: profile,
      操作日志: eventLog,
      模拟结束时状态: finalState,
      终局: ending,
    },
    null,
    2
  );

  try {
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: buildSystemPrompt(profile) },
          { role: "user", content: userContent },
        ],
        thinking: { type: "disabled" },
        stream: false,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(502).json({
        error: `智能分析接口错误（状态码 ${upstream.status}）`,
        detail: data,
      });
    }

    const analysis = data?.choices?.[0]?.message?.content;
    if (!analysis) {
      return res.status(502).json({ error: "智能分析返回格式异常", detail: data });
    }

    return res.status(200).json({ analysis });
  } catch (err) {
    return res.status(502).json({
      error: "调用智能分析接口失败",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
