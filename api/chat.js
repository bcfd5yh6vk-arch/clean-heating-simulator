const SYSTEM_PROMPT = [
  "你是保定农村清洁取暖转型模拟器的分析助手。",
  "请根据农户初始输入和操作日志，用中文撰写分析报告。",
  "必须严格按以下三个标题分段输出（保留标题）：",
  "",
  "## 一、农户形象解析",
  "结合年收入、年盈余、住房面积、初始取暖方式与取暖费用，",
  "判断该户收入高低、财务缓冲强弱、住房规模，勾勒其经济画像与转型起点。",
  "",
  "## 二、转型建议",
  "结合操作日志中的关键决策与指标变化，",
  "指出该户已走的路径、可改进之处，以及若重来或继续推进时更可行的清洁取暖选择。",
  "",
  "## 三、政策与民生矛盾解析",
  "从「改得起 vs 用得起」、补贴退坡、执法合规、排放目标与家庭现金流等角度，",
  "解释该模拟结果背后政策目标与农户现实之间的张力。",
  "",
  "要求：语言简洁具体，每段 120-200 字，不要编造日志中未出现的数据。",
].join("\n");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({
      error: "服务端未配置 DEEPSEEK_API_KEY，请在 Vercel 环境变量中添加。",
    });
  }

  const payload = req.body || {};
  const profile = payload.profile || {};
  const eventLog = payload.event_log || [];
  const finalState = payload.final_state || {};
  const ending = payload.ending || {};

  if (!Object.keys(profile).length) {
    return res.status(400).json({ error: "缺少农户初始信息 profile" });
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        thinking: { type: "disabled" },
        stream: false,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(502).json({
        error: `DeepSeek API 错误 (${upstream.status})`,
        detail: data,
      });
    }

    const analysis = data?.choices?.[0]?.message?.content;
    if (!analysis) {
      return res.status(502).json({ error: "DeepSeek 返回格式异常", detail: data });
    }

    return res.status(200).json({ analysis });
  } catch (err) {
    return res.status(502).json({
      error: "调用 DeepSeek 失败",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
