const {
  stripUnsafeHtml,
  validatePayload,
  buildPromptForMode,
} = require("./global-ai.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST is supported." });
  }

  const payload = req.body || {};
  const validationError = validatePayload(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({
      error: "AI analysis is unavailable because the server API key is not configured.",
    });
  }

  let prompt;
  let maxTokens;
  try {
    ({ prompt, maxTokens } = buildPromptForMode(payload));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }

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
          {
            role: "system",
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        thinking: { type: "disabled" },
        stream: false,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(502).json({
        error: `AI analysis service error (${upstream.status}).`,
        detail: data,
      });
    }

    const analysis = stripUnsafeHtml(data?.choices?.[0]?.message?.content);
    if (!analysis) {
      return res.status(502).json({ error: "AI analysis returned an empty response.", detail: data });
    }

    return res.status(200).json({
      mode: payload.mode,
      locale: payload.locale,
      analysis,
    });
  } catch (error) {
    return res.status(502).json({
      error: "AI analysis request failed.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
