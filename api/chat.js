const SYSTEM_PROMPT = [
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
  "从每年取暖花费、补贴变化、住房条件、室内舒适度、卫生清洁与环保等角度，说明怎样选路线更利于减轻负担、过更暖和省心的冬天。",
  "若日志涉及入户了解或暂缓改造，侧重散煤带来的不便（烟尘多、清理麻烦、炉火安全、空气影响），引导尽早了解改造方案，不要写「处罚」「执法对抗」。",
  "",
  "输出格式要求（务必遵守）：",
  "1. 每个部分禁止写成一大段连续文字。",
  "2. 第一部分「农户形象解析」：先写一行「**形象描述：** ……」（仅 4～8 个简单词或短语，用顿号连接，如：收入紧、怕多花、散煤户、想暖和又怕贵），再写 3～5 条要点。",
  "2b. 第二、三部分：先写一行「**一句话看懂：** ……」（不超过 30 字），再写 3～5 条要点。",
  "3. 每条要点以「- **小标题：** 说明」开头；每条不超过两句，尽量口语化、好懂。",
  "4. 少用学术词；必须用时用括号简短解释（如：能耗负担率=取暖费占收入的比例）。",
  "5. 数字尽量具体，只使用输入与日志中已有的数据，不要编造。",
  "6. 第三部分至少有一条要点直接点出「最该先改善的一点」（如更暖和、更省钱、更干净）或「下一步可以怎么做」。",
  "7. 第二部分「转型建议」：在「一句话看懂」之后，第一条要点必须是「- **建议路径：** ……」，明确写出推荐路线（如天然气、空气源热泵、地源热泵、先做保温改造、暂缓观望等）及一句理由；其余要点再写本局已走路径、哪里可改进等。",
].join("\n");

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
