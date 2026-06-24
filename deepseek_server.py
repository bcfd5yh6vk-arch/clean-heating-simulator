"""本地静态页 + DeepSeek 对话代理（避免浏览器 CORS）。"""

import json
import os
import ssl
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import certifi
from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


def load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env()

app = Flask(__name__)


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    user_message = (payload.get("message") or "").strip()
    if not user_message:
        return jsonify({"error": "message 不能为空"}), 400

    context = payload.get("context")
    messages = [
        {
            "role": "system",
            "content": (
                "你是保定农村清洁取暖转型模拟器的 AI 政策顾问。"
                "用简洁、易懂的中文回答用户关于煤改气、煤改电、热泵、补贴退坡、"
                "能耗负担率、法律合规和排放达标等问题。"
                "若用户提供了当前模拟数据，请结合这些数据给出具体建议。"
            ),
        },
        {"role": "user", "content": user_message},
    ]
    if context:
        messages[1]["content"] = f"【当前模拟数据】\n{context}\n\n【用户问题】\n{user_message}"

    try:
        reply = call_deepseek(messages)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"reply": reply})


def call_deepseek(messages: list[dict[str, str]]) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY，请在 .env 中设置。")

    body = json.dumps(
        {
            "model": "deepseek-v4-flash",
            "messages": messages,
            "thinking": {"type": "disabled"},
            "stream": False,
        },
        ensure_ascii=False,
    ).encode("utf-8")

    req = Request(
        DEEPSEEK_API_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    ssl_context = ssl.create_default_context(cafile=certifi.where())

    try:
        with urlopen(req, timeout=90, context=ssl_context) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DeepSeek API 错误 ({exc.code}): {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"网络请求失败: {exc.reason}") from exc

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"DeepSeek 返回格式异常: {data}") from exc


@app.post("/api/analyze")
def analyze():
    payload = request.get_json(silent=True) or {}
    profile = payload.get("profile") or {}
    event_log = payload.get("event_log") or []
    final_state = payload.get("final_state") or {}
    ending = payload.get("ending") or {}

    if not profile:
        return jsonify({"error": "缺少农户初始信息 profile"}), 400
    if not event_log:
        return jsonify({"error": "操作日志为空，请先完成至少一步模拟再生成分析。"}), 400

    user_content = json.dumps(
        {
            "农户初始输入": profile,
            "操作日志": event_log,
            "模拟结束时状态": final_state,
            "终局": ending,
        },
        ensure_ascii=False,
        indent=2,
    )

    messages = [
        {
            "role": "system",
            "content": (
                "你是保定农村清洁取暖转型模拟器的分析助手。"
                "请根据农户初始输入和操作日志，用中文撰写分析报告。"
                "主要读者是农村农户和普通关注者，不是学术论文读者。"
                "必须严格按以下三个标题分段输出（保留 ## 标题）：\n\n"
                "## 一、农户形象解析\n"
                "结合年收入、年盈余、住房面积、初始取暖方式与取暖费用，勾勒经济画像与转型起点。\n\n"
                "## 二、转型建议\n"
                "结合操作日志中的关键决策与指标变化，指出已走路径、可改进之处与更可行的清洁取暖选择。\n\n"
                "## 三、政策与民生矛盾解读\n"
                "从「改得起 vs 用得起」、补贴退坡、执法合规、排放目标与家庭现金流等角度，"
                "解释政策目标与农户现实之间的张力。\n\n"
                "输出格式要求（务必遵守）：\n"
                "1. 每个部分禁止写成一大段连续文字。\n"
                "2. 每部分结构：先写一行「**一句话看懂：** ……」（不超过 30 字），再写 3～5 条要点。\n"
                "3. 每条要点以「- **小标题：** 说明」开头；每条不超过两句，尽量口语化、好懂。\n"
                "4. 少用学术词；必须用时用括号简短解释（如：能耗负担率=取暖费占收入的比例）。\n"
                "5. 数字尽量具体，只使用输入与日志中已有的数据，不要编造。\n"
                "6. 第三部分至少有一条要点直接点出「最卡在哪」或「最想跟政策说的一句话」。"
            ),
        },
        {"role": "user", "content": user_content},
    ]

    try:
        reply = call_deepseek(messages)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"analysis": reply})


if __name__ == "__main__":
    print("本地服务: http://127.0.0.1:8765")
    print("在浏览器打开上述地址，使用「AI分析」生成报告。")
    app.run(debug=True, host="127.0.0.1", port=8765)
