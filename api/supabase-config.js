export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "仅支持 GET 请求。" });
  }

  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return res.status(500).json({
      error: "服务端未配置 Supabase 连接信息，请联系管理员。",
    });
  }

  return res.status(200).json({ url, anonKey });
}
