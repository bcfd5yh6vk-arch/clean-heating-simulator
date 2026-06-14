import json
import os
import random
import uuid
from typing import Any

from anthropic import Anthropic
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

SESSIONS: dict[str, dict[str, Any]] = {}


def get_client() -> Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Missing ANTHROPIC_API_KEY")
    return Anthropic(api_key=api_key)


def parse_int(payload: dict[str, Any], key: str, default: int) -> int:
    value = payload.get(key, default)
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def clamp_score(value: int) -> int:
    return max(0, min(100, value))


def compute_energy_burden(state: dict[str, int]) -> float:
    annual_income = max(1, state["annual_income"])
    return state["heating_annual_cost"] / annual_income * 100


def policy_strict_execution_probability(compliance: int) -> float:
    if compliance >= 60:
        return 0.1
    if compliance >= 30:
        return 0.3
    return min(0.9, 0.5 + (30 - compliance) * 0.01)


def get_stage_choices(stage: str) -> list[dict[str, str]]:
    choice_map = {
        "turn1": [
            {"id": "A", "label": "继续当前取暖方式"},
            {"id": "B", "label": "准备转型"},
        ],
        "turn2_risk": [
            {"id": "1", "label": "夜间继续违规取暖"},
            {"id": "2", "label": "申请整改"},
        ],
        "turn3": [
            {"id": "A", "label": "天然气"},
            {"id": "B", "label": "地源热泵"},
            {"id": "C", "label": "空气源热泵"},
        ],
        "turn4": [
            {"id": "A", "label": "农业直播/副业"},
            {"id": "B", "label": "强力节能（降温、分区取暖）"},
        ],
        "turn6": [
            {"id": "SETTLE", "label": "进入冲击事件结算"},
        ],
    }
    return choice_map.get(stage, [])


def pick_ai_delta(
    session: dict[str, Any],
    stage: str,
    choice: dict[str, str],
    bounds: dict[str, list[int]],
    must_json: bool = True,
) -> dict[str, int]:
    fallback = {
        key: random.randint(bound[0], bound[1]) if bound[0] <= bound[1] else bound[0]
        for key, bound in bounds.items()
    }

    try:
        client = get_client()
    except ValueError:
        return fallback

    prompt = {
        "task": "你是清洁取暖转型模拟器的数值裁定器。必须只返回JSON。",
        "session_state": session["state"],
        "annual_surplus": session["annual_surplus"],
        "stage": stage,
        "choice": choice,
        "constraints": bounds,
        "rule": "返回每个键的整数，且必须在约束范围内。",
    }
    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=400,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "只输出 JSON 对象，不要多余文本。"
                        f"\n输入: {json.dumps(prompt, ensure_ascii=False)}"
                    ),
                }
            ],
        )
        text = "".join(
            block.text for block in response.content if getattr(block, "type", "") == "text"
        ).strip()
        if not text:
            return fallback

        data = json.loads(text) if must_json else {}
        result: dict[str, int] = {}
        for key, bound in bounds.items():
            raw = data.get(key, fallback[key])
            try:
                value = int(raw)
            except (TypeError, ValueError):
                value = fallback[key]
            low, high = bound
            result[key] = max(low, min(high, value))
        return result
    except Exception:
        return fallback


def apply_delta(session: dict[str, Any], delta: dict[str, int]) -> None:
    state = session["state"]
    state["heating_annual_cost"] = max(0, state["heating_annual_cost"] + delta["heating_annual_cost"])
    state["annual_income"] = max(1000, state["annual_income"] + delta["annual_income"])
    state["compliance"] = clamp_score(state["compliance"] + delta["compliance"])
    state["emission_score"] = clamp_score(state["emission_score"] + delta["emission_score"])
    session["annual_surplus"] += delta["annual_surplus"]
    session["annual_surplus"] = max(-200000, session["annual_surplus"])


def build_narrative(stage: str, label: str, delta: dict[str, int], burden: float) -> str:
    return (
        f"你在 {stage} 选择了“{label}”。"
        f" 本回合取暖年花费变化 {delta['heating_annual_cost']} 元，年收入变化 {delta['annual_income']} 元，"
        f" 法律合规度变化 {delta['compliance']}，排放达标度变化 {delta['emission_score']}。"
        f" 当前能耗负担率约 {burden:.1f}%。"
    )


def build_policy_diagnosis(session: dict[str, Any], ending_type: str) -> str:
    history = session["history"]
    state = session["state"]
    burden = compute_energy_burden(state)
    short_history = "；".join([f"T{h['turn']}:{h['choice_label']}" for h in history[-6:]])
    fallback = (
        f"过程复盘：{short_history}。"
        f" 最终指标为取暖年花费 {state['heating_annual_cost']} 元、年收入 {state['annual_income']} 元、"
        f" 法律合规度 {state['compliance']}、排放达标度 {state['emission_score']}，"
        f" 能耗负担率 {burden:.1f}%。"
    )
    try:
        client = get_client()
        response = client.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=320,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "请生成100-160字的政策诊断总结，包含原因、关键决策、改进建议。"
                        f" 终局类型: {ending_type}。"
                        f" 数据: {fallback}"
                    ),
                }
            ],
        )
        text = "".join(
            block.text for block in response.content if getattr(block, "type", "") == "text"
        ).strip()
        return text or fallback
    except Exception:
        return fallback


def evaluate_ending(
    session: dict[str, Any], allow_success: bool = True, allow_seized: bool = True
) -> dict[str, Any]:
    state = session["state"]
    thresholds = session["thresholds"]
    burden = compute_energy_burden(state)

    if burden >= thresholds["bankrupt_energy_burden_threshold"] and session["annual_surplus"] <= 0:
        return {
            "is_final": True,
            "type": "bankrupt",
            "summary": "能耗负担率过高且可支配资金不足，家庭进入经济破产状态。",
        }

    strict_triggered = False
    if allow_seized and state["compliance"] < thresholds["seized_compliance_threshold"]:
        probability = policy_strict_execution_probability(state["compliance"])
        strict_triggered = random.random() < probability
        if strict_triggered:
            return {
                "is_final": True,
                "type": "seized",
                "summary": "法律合规度过低且触发严格执法，被判定违规并处罚。",
                "strict_execution_triggered": True,
            }

    if allow_success:
        if (
            state["emission_score"] >= thresholds["success_emission_threshold"]
            and state["compliance"] == thresholds["success_compliance_exact"]
            and burden <= thresholds["success_energy_burden_max"]
        ):
            return {
                "is_final": True,
                "type": "success",
                "summary": "排放、合规、能耗负担率三项同时达标，成功实现绿色转型。",
            }

    return {"is_final": False, "type": "none", "strict_execution_triggered": strict_triggered}


@app.get("/")
def index() -> str:
    return render_template("indexChinese.html")


@app.post("/api/start")
def start_game():
    payload = request.get_json(silent=True) or {}

    annual_income = parse_int(payload, "annual_income", 60000)
    annual_surplus = parse_int(payload, "annual_surplus", 8000)
    winter_cost = parse_int(payload, "winter_cost", 12000)
    housing_area = parse_int(payload, "housing_area", 100)

    session_id = str(uuid.uuid4())
    session = {
        "session_id": session_id,
        "player_role": "farmer",
        "region": "保定",
        "heating_method": payload.get("heating_method", "散煤炉"),
        "housing_area": max(20, housing_area),
        "annual_surplus": annual_surplus,
        "state": {
            "heating_annual_cost": max(0, winter_cost),
            "annual_income": max(1000, annual_income),
            "compliance": 0,
            "emission_score": 0,
        },
        "thresholds": {
            "bankrupt_energy_burden_threshold": parse_int(
                payload, "bankrupt_energy_burden_threshold", 10
            ),
            "seized_compliance_threshold": parse_int(payload, "seized_compliance_threshold", 30),
            "success_emission_threshold": parse_int(payload, "success_emission_threshold", 80),
            "success_compliance_exact": parse_int(payload, "success_compliance_exact", 100),
            "success_energy_burden_max": parse_int(payload, "success_energy_burden_max", 10),
            "max_turns": parse_int(payload, "max_turns", 8),
        },
        "turn": 1,
        "stage": "turn1",
        "history": [],
        "last_compliance_drop_abs": 6,
        "turn2_non_rectify_streak": 0,
    }
    SESSIONS[session_id] = session

    burden = compute_energy_burden(session["state"])
    narrative = (
        f"你是保定农户，当前取暖方式为 {session['heating_method']}。"
        f" 初始取暖年花费 {session['state']['heating_annual_cost']} 元，年收入 {session['state']['annual_income']} 元，"
        f" 法律合规度与排放达标度初始为 0。当前能耗负担率约 {burden:.1f}%。"
    )
    return jsonify(
        {
            "session_id": session_id,
            "turn": session["turn"],
            "state": session["state"],
            "narrative": narrative,
            "choices": get_stage_choices("turn1"),
            "event": {"triggered": False},
            "ending": {"is_final": False, "type": "none"},
        }
    )


@app.post("/api/step")
def step_game():
    payload = request.get_json(silent=True) or {}
    session_id = (payload.get("session_id") or "").strip()
    choice_id = (payload.get("choice_id") or "").strip()
    choice_label = (payload.get("choice_label") or "").strip()

    session = SESSIONS.get(session_id)
    if not session:
        return jsonify({"error": "invalid session_id"}), 400

    stage = session["stage"]
    allowed_choices = get_stage_choices(stage)
    if not any(item["id"] == choice_id for item in allowed_choices):
        return jsonify({"error": "invalid choice for current stage"}), 400

    state = session["state"]
    area_factor = session["housing_area"] / 100
    event = {"triggered": False}

    delta = {
        "heating_annual_cost": 0,
        "annual_income": 0,
        "compliance": 0,
        "emission_score": 0,
        "annual_surplus": 0,
    }

    next_stage = stage
    round_name = stage

    if stage == "turn1":
        if choice_id == "A":
            bounds = {
                "heating_annual_cost": [0, 0],
                "annual_income": [0, 0],
                "compliance": [-8, -4],
                "emission_score": [-10, -6],
                "annual_surplus": [-300, 300],
            }
            delta = pick_ai_delta(session, stage, {"id": choice_id, "label": choice_label}, bounds)
            session["last_compliance_drop_abs"] = abs(delta["compliance"])
            next_stage = "turn2_risk"
        else:
            bounds = {
                "heating_annual_cost": [0, 0],
                "annual_income": [0, 0],
                "compliance": [5, 12],
                "emission_score": [0, 2],
                "annual_surplus": [-1200, -500],
            }
            delta = pick_ai_delta(session, stage, {"id": choice_id, "label": choice_label}, bounds)
            next_stage = "turn3"

    elif stage == "turn2_risk":
        if choice_id == "1":
            drop_base = max(4, session["last_compliance_drop_abs"] * 2)
            bounds = {
                "heating_annual_cost": [0, 0],
                "annual_income": [0, 0],
                "compliance": [-drop_base - 4, -drop_base],
                "emission_score": [-16, -8],
                "annual_surplus": [-300, 300],
            }
            delta = pick_ai_delta(session, stage, {"id": choice_id, "label": choice_label}, bounds)
            session["last_compliance_drop_abs"] = abs(delta["compliance"])
            session["turn2_non_rectify_streak"] += 1
            next_stage = "turn2_risk"
        else:
            bounds = {
                "heating_annual_cost": [0, 0],
                "annual_income": [0, 0],
                "compliance": [12, 22],
                "emission_score": [0, 2],
                "annual_surplus": [-1200, -500],
            }
            delta = pick_ai_delta(session, stage, {"id": choice_id, "label": choice_label}, bounds)
            session["turn2_non_rectify_streak"] = 0
            next_stage = "turn3"

    elif stage == "turn3":
        tech_cost_map = {"A": 3000, "B": 10000, "C": 7000}
        invest_cost = int(tech_cost_map[choice_id] * area_factor)
        if state["annual_income"] <= invest_cost:
            return jsonify({"error": f"年收入不足以覆盖一次性投入 {invest_cost} 元"}), 400

        if choice_id == "A":
            target_heating = int(8000 * area_factor)
            bounds = {
                "annual_income": [0, 0],
                "compliance": [18, 30],
                "emission_score": [18, 30],
                "annual_surplus": [-invest_cost - 1000, -invest_cost],
            }
        elif choice_id == "B":
            target_heating = int(2000 * area_factor)
            bounds = {
                "annual_income": [0, 0],
                "compliance": [20, 32],
                "emission_score": [22, 34],
                "annual_surplus": [-invest_cost - 1200, -invest_cost],
            }
        else:
            target_heating = int(random.randint(3500, 5000) * area_factor)
            bounds = {
                "annual_income": [0, 0],
                "compliance": [18, 30],
                "emission_score": [20, 32],
                "annual_surplus": [-invest_cost - 1000, -invest_cost],
            }

        picked = pick_ai_delta(session, stage, {"id": choice_id, "label": choice_label}, bounds)
        delta = {
            "heating_annual_cost": target_heating - state["heating_annual_cost"],
            "annual_income": picked["annual_income"],
            "compliance": picked["compliance"],
            "emission_score": picked["emission_score"],
            "annual_surplus": picked["annual_surplus"],
        }
        next_stage = "turn4"

    elif stage == "turn4":
        if choice_id == "A":
            bounds = {
                "heating_annual_cost": [0, 0],
                "annual_income": [4000, 12000],
                "compliance": [0, 3],
                "emission_score": [0, 4],
                "annual_surplus": [2000, 8000],
            }
            delta = pick_ai_delta(session, stage, {"id": choice_id, "label": choice_label}, bounds)
        else:
            reduction_cap = max(1000, int(state["heating_annual_cost"] * 0.4))
            bounds = {
                "heating_annual_cost": [-reduction_cap, -1000],
                "annual_income": [0, 0],
                "compliance": [0, 2],
                "emission_score": [6, 15],
                "annual_surplus": [1000, 4000],
            }
            delta = pick_ai_delta(session, stage, {"id": choice_id, "label": choice_label}, bounds)
            if random.random() < 0.35:
                event = {
                    "triggered": True,
                    "title": "舒适度争议",
                    "description": "强力节能导致室内舒适度下降，引发家庭短期适应成本。",
                }
                delta["annual_surplus"] -= 500
        next_stage = "turn6"

    elif stage == "turn6":
        chosen_event = {
            "title": "补贴减少",
            "description": "地方补贴收紧，家庭现金流承压。",
            "bounds": {
                "heating_annual_cost": [500, 2000],
                "annual_income": [0, 0],
                "compliance": [0, 0],
                "emission_score": [0, 2],
                "annual_surplus": [-3000, -1200],
            },
        }
        event = {
            "triggered": True,
            "title": chosen_event["title"],
            "description": chosen_event["description"],
        }
        delta = pick_ai_delta(
            session,
            stage,
            {"id": choice_id, "label": choice_label},
            chosen_event["bounds"],
        )
        next_stage = "ended"

    apply_delta(session, delta)
    burden = compute_energy_burden(session["state"])
    narrative = build_narrative(round_name, choice_label, delta, burden)

    session["history"].append(
        {
            "turn": session["turn"],
            "stage": stage,
            "choice_id": choice_id,
            "choice_label": choice_label,
            "delta": delta,
            "event": event,
            "energy_burden": burden,
        }
    )
    session["turn"] += 1
    session["stage"] = next_stage

    ending = evaluate_ending(
        session,
        allow_success=(next_stage == "ended"),
        allow_seized=(next_stage != "ended"),
    )

    if (
        not ending["is_final"]
        and stage == "turn2_risk"
        and choice_id == "1"
        and session["turn2_non_rectify_streak"] >= 2
        and session["state"]["compliance"] < session["thresholds"]["seized_compliance_threshold"]
    ):
        ending = {
            "is_final": True,
            "type": "seized",
            "summary": "你在合规风险回合持续拒绝整改，且法律合规度过低，最终被处罚。",
            "strict_execution_triggered": True,
        }
    if session["turn"] > session["thresholds"]["max_turns"] and not ending["is_final"]:
        ending = {
            "is_final": True,
            "type": "none",
            "summary": "达到回合上限，系统结束本次模拟。",
        }

    if next_stage == "ended" and not ending["is_final"]:
        ending = {
            "is_final": True,
            "type": "bankrupt",
            "summary": "回合5发生补贴减少后，家庭未达到成功转型条件，判定为经济破产。",
        }

    if ending["is_final"]:
        session["stage"] = "ended"
        ending["policy_diagnosis"] = build_policy_diagnosis(session, ending["type"])
        next_choices: list[dict[str, str]] = []
    else:
        next_choices = get_stage_choices(session["stage"])

    response_delta = {
        "heating_annual_cost": delta["heating_annual_cost"],
        "annual_income": delta["annual_income"],
        "compliance": delta["compliance"],
        "emission_score": delta["emission_score"],
    }
    response_payload = {
        "session_id": session_id,
        "turn": session["turn"] - 1,
        "state": session["state"],
        "delta": response_delta,
        "narrative": narrative,
        "event": event,
        "choices": next_choices,
        "ending": ending,
        "meta": {
            "annual_surplus": session["annual_surplus"],
            "energy_burden_percent": round(burden, 2),
        },
    }
    return jsonify(response_payload)


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
