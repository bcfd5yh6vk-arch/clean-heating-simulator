#!/usr/bin/env python3
"""Export simulation_sessions from Supabase to annotated CSV backup."""

from __future__ import annotations

import csv
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://zottuuavggzsjqvblydl.supabase.co"
)
SUPABASE_ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvdHR1dWF2Z2d6c2pxdmJseWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTA1MjksImV4cCI6MjA5NjM4NjUyOX0.zv7Ne_JIZWcOQaftIET8blOCEi0xOGda67jDdSXwp5M",
)

FARMER_IDENTITIES = {"已煤改农户", "未煤改农户"}
STUDENT_OTHER = {"学生", "其他"}


def normalize_identity_detail(detail: Any) -> str:
    return str(detail or "").strip()


def is_test_item(row: dict[str, Any]) -> bool:
    """Test records: identity_detail is Lawted 村 (case-insensitive) or 测试."""
    detail = normalize_identity_detail(row.get("identity_detail"))
    if detail == "测试":
        return True
    return detail.lower() == "lawted 村"


def test_item_reason(row: dict[str, Any]) -> str:
    detail = normalize_identity_detail(row.get("identity_detail"))
    return (
        f"测试项：identity_detail 为「{detail}」（定义为 Lawted 村 或 测试），非真实研究样本"
    )


def fetch_all_rows() -> list[dict[str, Any]]:
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/simulation_sessions?select=*&order=created_at.asc"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Supabase fetch failed ({exc.code}): {body}") from exc


def is_valid_pool(row: dict[str, Any]) -> bool:
    """≥30s, simulation ended, and not a test item (A/B pool only)."""
    if is_test_item(row):
        return False
    duration = row.get("session_duration_seconds")
    return duration is not None and duration >= 30 and row.get("ended_at") is not None


def is_fully_complete(row: dict[str, Any]) -> bool:
    if row.get("ended_at") is None or row.get("post_survey_at") is None:
        return False
    identity = row.get("user_identity") or ""
    if identity in FARMER_IDENTITIES:
        return True
    if identity in STUDENT_OTHER:
        return (
            row.get("sq_q1_understanding_before") is not None
            and row.get("sq_q2_understanding_after") is not None
        )
    return True


def cleaning_reasons(row: dict[str, Any], *, include_test_item: bool = True) -> list[str]:
    reasons: list[str] = []
    if include_test_item and is_test_item(row):
        reasons.append(test_item_reason(row))

    duration = row.get("session_duration_seconds")
    detail = normalize_identity_detail(row.get("identity_detail"))

    if duration is None or duration < 30:
        reasons.append(
            f"会话时长不足30秒（{duration if duration is not None else '未知'}s），难以视为有效体验"
        )

    if row.get("ended_at") is None:
        reasons.append("模拟未结束（无 ended_at），行为与结局数据不完整")

    if not reasons:
        duration_ok = duration is not None and duration >= 30
        if not duration_ok or row.get("ended_at") is None:
            reasons.append("不在≥30s且已结束的有效样本池内，需人工复核")

    return reasons


def annotate_row(row: dict[str, Any]) -> tuple[str, str]:
    """Return (analysis_tag, remark). Test items are always C, never A or B."""
    if is_test_item(row):
        reasons = [test_item_reason(row)]
        reasons.extend(cleaning_reasons(row, include_test_item=False))
        return (
            "C_需清洗",
            "建议清洗或排除出主分析：" + "；".join(dict.fromkeys(reasons)),
        )

    if is_fully_complete(row):
        identity = row.get("user_identity") or ""
        if identity in FARMER_IDENTITIES:
            extra = "农户流程：已结束模拟并提交 post-survey（不要求 Q1/Q2）。"
        else:
            extra = "学生/其他：已结束模拟、提交 post-survey，且 Q1/Q2 前后测齐全。"
        return (
            "A_全部完成",
            f"纳入分析样本（全部完成）。{extra}",
        )

    if is_valid_pool(row):
        identity = row.get("user_identity") or ""
        parts = ["纳入有效样本池（≥30s 且模拟已结束），但未达「全部完成」标准。"]
        if row.get("post_survey_at") is None:
            parts.append("缺少 post-survey 提交（post_survey_at 为空）。")
        elif identity in STUDENT_OTHER:
            missing = []
            if row.get("sq_q1_understanding_before") is None:
                missing.append("Q1")
            if row.get("sq_q2_understanding_after") is None:
                missing.append("Q2")
            if missing:
                parts.append(f"已提交 post-survey，但缺少 {'/'.join(missing)}。")
        parts.append("可用于 dropout/流程分析，主分析建议排除或单独报告。")
        return ("B_有效未完成", " ".join(parts))

    reasons = cleaning_reasons(row)
    return (
        "C_需清洗",
        "建议清洗或排除出主分析：" + "；".join(reasons),
    )


def serialize_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def load_rows_from_json(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        if isinstance(payload.get("rows"), list):
            return payload["rows"]
        for key in ("result", "data"):
            inner = payload.get(key)
            if isinstance(inner, list) and inner:
                first = inner[0]
                if isinstance(first, dict) and isinstance(first.get("rows"), list):
                    return first["rows"]
    raise SystemExit(f"Unrecognized JSON export shape in {path}")


def main() -> None:
    input_json = os.environ.get("EXPORT_INPUT_JSON")
    if input_json:
        rows = load_rows_from_json(Path(input_json))
    else:
        rows = fetch_all_rows()
    if not rows:
        raise SystemExit("No rows returned from simulation_sessions.")

    tag_counts: dict[str, int] = {"A_全部完成": 0, "B_有效未完成": 0, "C_需清洗": 0}
    valid_pool_count = 0

    annotated: list[dict[str, Any]] = []
    for row in rows:
        tag, remark = annotate_row(row)
        tag_counts[tag] += 1
        if tag in ("A_全部完成", "B_有效未完成"):
            valid_pool_count += 1
        annotated.append(
            {
                **row,
                "analysis_tag": tag,
                "备注": remark,
            }
        )

    stamp = datetime.now(timezone.utc).astimezone().strftime("%Y%m%d_%H%M%S")
    out_dir = Path(__file__).resolve().parent
    out_path = out_dir / f"simulation_sessions_backup_{stamp}.csv"
    latest_path = out_dir / "simulation_sessions_backup_latest.csv"

    base_fields = list(rows[0].keys())
    fieldnames = base_fields + ["analysis_tag", "备注"]

    for path in (out_path, latest_path):
        with path.open("w", newline="", encoding="utf-8-sig") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for row in annotated:
                writer.writerow({k: serialize_value(row.get(k)) for k in fieldnames})

    print(f"Exported {len(rows)} rows -> {out_path}")
    print(f"Also wrote {latest_path}")
    print(f"Valid pool (A+B, excludes test items): {valid_pool_count}")
    print("Tag counts:", tag_counts)


if __name__ == "__main__":
    main()
