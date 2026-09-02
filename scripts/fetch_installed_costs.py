#!/usr/bin/env python3
"""生成 docs/data/scoring/technology_installed_costs.json（美国，EIA 官方设备成本研究）。

来源：EIA《Updated Buildings Sector Appliance and Equipment Costs and Efficiencies》
（2023-03 版）附录 A。该 PDF 的表格版式逐节不同（列数 7–16、成本区间拆成双行、
Typical 列的位置随各节的标准/ENERGY STAR 列数漂移），程序化按列位取数就是
静默取错列的完美陷阱——实测天真取法会把燃气暖炉的 Current Standard 列（3,690）
当成 Typical（真值 4,150）。

因此采用与生态环境部 PDF 相同的模式：**人工逐节转录 + 脚本机器核验**。
CURATED 表内嵌于本脚本，逐行带 verify 数字串；运行时下载官方 PDF，
在对应节页面上逐一比对这些数字串，任何一处对不上就整批失败。
改任何数值必须同时改 verify 串并重新对原文。

口径决策（docs/CS-DECISIONS.md D8）：
    - 只录「代表机型 ≈ 整宅/整间系统」的设备；无风管迷你分体表值是单区 12 kBtu/h
      机型，当整宅成本会系统性抬高该路径，宁缺毋滥地跳过。
    - 原文给区间的（油炉/房间空调/地源），value 取区间中点，low/high 保留原文界。
    - 分气候区的取 North（本产品以采暖为主线），另一区数值写进 aggregation_method。
    - 金额为 2022 美元，不做通胀调整；地理仅 USA。

用法：

    uv run --no-project --with pdfplumber python scripts/fetch_installed_costs.py
"""

from __future__ import annotations

import datetime as _dt
import io
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

EIA_PDF_URL = "https://www.eia.gov/analysis/studies/buildings/equipcosts/pdf/appendix-a.pdf"
EIA_REPORT = "EIA Updated Buildings Sector Appliance and Equipment Costs and Efficiencies（2023-03，附录 A）"

# 人工转录表（2026-08-23 对照 PDF 原文）。verify 里的每个数字串都必须
# 出现在该节数据页的归一化文本里——它们取自 Total Installed Cost 行的
# 连续数字片段，能唯一锚定「取的是哪一行哪几列」。
CURATED: dict[str, dict[str, Any]] = {
    "gas_furnace": {
        "title": "Residential Gas-Fired Furnaces (North)",
        "value": 4150.0, "low": None, "high": None, "year": "2022",
        "verify": ["2,880 2,880 3,690 4,130 4,150 4,320"],
        "note": "80 kBtu/h 非风冷式；列序 IB/IB/现行标准(3,690)/ES V4.1(4,130)/Typical(4,150)/High。"
                "Rest of Country 区 Typical = 4,130",
        "range": (2000, 12000),
    },
    "oil_heating": {
        "title": "Residential Oil-Fired Furnaces",
        "value": 5150.0, "low": 3480.0, "high": 6820.0, "year": "2022",
        "verify": ["3,250 3,250 3,250 3,480", "6,520 6,520 6,520 6,820"],
        "note": "105 kBtu/h；原文给典型值区间 3,480–6,820（上下两行），value 取区间中点，low/high 为原文界",
        "range": (3000, 15000),
    },
    "gas_boiler": {
        "title": "Residential Gas-Fired Boilers",
        "value": 5940.0, "low": None, "high": None, "year": "2022",
        "verify": ["7,760 5,940 8,700 5,940 6,700 6,710"],
        "note": "100 kBtu/h 热水锅炉；列序 IB(7,760)/IB(5,940)/现行标准(8,700)/Typical(5,940)/ES V3.0(6,700)/High(6,710)",
        "range": (3000, 15000),
    },
    "electric_resistance": {
        "title": "Residential Electric Resistance Furnaces",
        "value": 1480.0, "low": None, "high": None, "year": "2022",
        "verify": ["1,290 1,290 1,480 1,480"],
        "note": "68 kBtu/h 风管式电阻暖炉为代表机型；踢脚线电暖器成本更低但无整宅口径",
        "range": (1000, 8000),
    },
    "central_ac": {
        "title": "Residential Central Air Conditioners – North (Not Hot-Dry or Hot-Humid)",
        "value": 5320.0, "low": None, "high": None, "year": "2022",
        "verify": ["4,000 4,300 5,250 5,320 5,520 5,980"],
        "note": "3 吨分体 coil-only；列序 IB/IB/现行标准(5,250)/Typical(5,320)/ES V5.0(5,520)/High(5,980)。"
                "South 区 Typical = 5,390。2023 新标准组无 Typical 列",
        "range": (3000, 15000),
    },
    "window_ac": {
        "title": "Residential Room Air Conditioners",
        "value": 565.0, "low": 490.0, "high": 640.0, "year": "2022",
        "verify": ["640 490 490 490 490 600", "830 630 630 640 640 750"],
        "note": "10 kBtu/h 常见档（Product Class 3）；原文给典型值区间 490–640（上下两行），value 取中点",
        "range": (200, 2500),
    },
    "portable_ac": {
        "title": "Residential Portable Air Conditioners",
        "value": 700.0, "low": None, "high": None, "year": "2022",
        "verify": ["700 700 700 810 760 810"],
        "note": "6.6 kBtu/h；安装成本≈零售价（原文注明安装与维护成本可忽略）",
        "range": (200, 2500),
    },
    "evaporative_direct": {
        "title": "Residential Swamp Coolers",
        "value": 1360.0, "low": None, "high": None, "year": "2022",
        "verify": ["1,360 1,360 1,360 1,540"],
        "note": "窗式直接蒸发冷风机，3,800 CFM",
        "range": (500, 8000),
    },
    "ashp_ducted": {
        "title": "Residential Air-Source Heat Pumps",
        "value": 6940.0, "low": None, "high": None, "year": "2023",
        "verify": ["5,790 6,880 6,730 6,880 6,810 8,620 6,810 6,940 6,940 8,620"],
        "note": "36 kBtu/h（3 吨）风管分体 blower-coil；取 2023 新标准组 Typical（2022 组 Typical = 6,880）",
        "range": (4000, 25000),
    },
    "gshp": {
        "title": "Residential Ground-Source Heat Pumps",
        "value": 19000.0, "low": 14880.0, "high": 23120.0, "year": "2022",
        "verify": ["14,060 14,880 14,230 14,880 14,880 15,940", "22,290 23,120 22,470 23,120 23,120 24,170"],
        "note": "3 吨闭环含地埋环路；原文给典型值区间 14,880–23,120（上下两行），value 取中点",
        "range": (10000, 50000),
    },
    "wood_stove": {
        "title": "Residential Cordwood Stoves",
        "value": 7090.0, "low": None, "high": None, "year": "2022",
        "verify": ["8,290 7,090 7,090 7,710", "8,950 8,460 8,460 9,240"],
        "note": "50 kBtu/h 非催化型（市场主流），含壁炉台与不锈钢烟囱内衬；催化型 Typical = 8,460",
        "range": (1500, 12000),
    },
    "biomass_pellet": {
        "title": "Residential Wood Pellet Stoves",
        "value": 4520.0, "low": None, "high": None, "year": "2022",
        "verify": ["5,550 4,520 4,520 5,400"],
        "note": "颗粒炉，含安装",
        "range": (1500, 12000),
    },
}

SKIPPED_NOTE = (
    "ashp_ductless：EIA 表值是单区 12 kBtu/h 代表机型（其脚注按 24 kBtu 分体机估算），"
    "不能当整宅系统成本，宁缺毋滥（CS-DECISIONS D8）。"
    "ashp_air_to_water / electric_boiler / district_* / 太阳能与被动措施：附录 A 无对应居民品类。"
    "中国与欧盟：无可引用官方安装成本口径，整体缺席（§7.11 null 分支）。"
)


def log(msg: str) -> None:
    print(msg, flush=True)


def http_bytes(url: str, attempts: int = 4) -> bytes:
    last: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "clean-heating-simulator/fetch_installed_costs"})
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last = e
            if i < attempts - 1:
                time.sleep(2 ** i)
    raise RuntimeError("请求失败（重试 %d 次）：%s\n  %s" % (attempts, url, last))


def verify_against_pdf(raw: bytes) -> None:
    """在官方 PDF 里逐行核验转录：节标题页必须含全部 verify 数字串。"""
    try:
        import pdfplumber  # noqa: PLC0415
    except ImportError:
        raise RuntimeError("需要 pdfplumber：uv run --no-project --with pdfplumber python %s" % __file__)

    # 同一节标题会出现在多页（数据页 + 说明/出货量页）：只要**任一**同名页
    # 含该行的全部核验数字串即通过；扫完全卷仍没有任何页通过的才算失败。
    wanted = {spec["title"]: tech for tech, spec in CURATED.items()}
    found: set[str] = set()
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for pg in pdf.pages:
            t = pg.extract_text() or ""
            lines = t.split("\n")
            title = lines[1].strip() if len(lines) > 1 else ""
            tech = wanted.get(title)
            if tech is None or tech in found or "Total Installed Cost" not in t:
                continue
            norm = " ".join(t.split())
            if all(snippet in norm for snippet in CURATED[tech]["verify"]):
                found.add(tech)
    missing = set(CURATED) - found
    if missing:
        raise RuntimeError(
            "这些设备在 PDF 里找不到与转录一致的成本行（改版或转录有误，禁止带病写入）：%s" % sorted(missing)
        )


def main() -> int:
    repo = pathlib.Path(__file__).resolve().parent.parent
    retrieved = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")
    policy = json.loads((repo / "docs/data/data-freshness-policy.json").read_text(encoding="utf-8"))["datasets"]

    log("下载官方 PDF 并核验转录：%s" % EIA_PDF_URL)
    verify_against_pdf(http_bytes(EIA_PDF_URL))
    log("  全部 %d 个设备的核验串比对通过" % len(CURATED))

    entries: dict[str, list[dict[str, Any]]] = {}
    for tech_id, spec in CURATED.items():
        value = float(spec["value"])
        lo, hi = spec["range"]
        if not (lo <= value <= hi):
            raise RuntimeError("%s = %s USD，超出 [%s, %s]" % (tech_id, value, lo, hi))
        if spec["low"] is not None and not (spec["low"] <= value <= spec["high"]):
            raise RuntimeError("%s 的 value 不在 low/high 区间内" % tech_id)
        pt: dict[str, Any] = {
            "value": value,
            "geography": {"level": "country", "code": "USA"},
            "source_type": "LOCAL_PUBLIC",
            "source_name": EIA_REPORT,
            "source_url": EIA_PDF_URL,
            "retrieved_at": retrieved,
            "confidence": "medium",
            "currency": "USD",
            "period": spec["year"],
            "aggregation_method": (
                "「%s」节 Total Installed Cost (2022$) 的 %s 年 Typical；2022 美元，未做通胀调整，"
                "全美代表值（未含州际差异与补贴）。%s。人工转录，脚本以原文数字串逐行核验"
                % (spec["title"], spec["year"], spec["note"])
            ),
        }
        if spec["low"] is not None:
            pt["low"] = spec["low"]
            pt["mid"] = value
            pt["high"] = spec["high"]
        entries[tech_id] = [pt]
        log("  %-20s %8.0f USD%s" % (
            tech_id, value,
            "（区间 %.0f–%.0f 取中点）" % (spec["low"], spec["high"]) if spec["low"] is not None else "",
        ))

    spec_p = policy["technology_installed_costs"]
    stale = (_dt.date.fromisoformat(retrieved) + _dt.timedelta(days=spec_p["refresh_cadence_days"])).isoformat()
    payload = {
        "_status": "POPULATED",
        "_owner": "由 scripts/fetch_installed_costs.py 生成，不要手工编辑（转录表在脚本内，改数须过 PDF 核验）",
        "_vintage": {
            "retrieved_at": retrieved,
            "source_period": "2022$/2023（EIA 2023-03 报告）",
            "refresh_cadence_days": spec_p["refresh_cadence_days"],
            "stale_after": stale,
            "rationale": spec_p["rationale"],
            "refresh_by": "重跑 " + spec_p["script"],
        },
        "field_key": "technology_installed_costs",
        "unit": "currency（整套代表系统的安装总价；currency 字段标明币种）",
        "provenance_note": "禁止用厂商报价单或论坛均价顶替；金额为 2022 美元，是全美代表值，未含州际差异与补贴。",
        "_not_covered": SKIPPED_NOTE,
        "entries": entries,
    }
    out = repo / "docs" / "data" / "scoring" / "technology_installed_costs.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log("\n  wrote %s  %s bytes（共 %d 条）" % (out.name, format(out.stat().st_size, ","), len(entries)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
