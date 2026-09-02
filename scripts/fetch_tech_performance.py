#!/usr/bin/env python3
"""生成 docs/data/scoring/technology_performance.json（美国 ENERGY STAR 认证机型聚合）。

来源是骨架 preferred_sources 点名的 ENERGY STAR 公开数据集（data.energystar.gov，
Socrata API，无需 key）。做法与禁区：

    1. 逐指标拉「效率值直方图」（SoQL group-by），本地算 P25/P50/P75 ——
       规格禁止手挑“典型机型”，这里根本不看单个机型。
    2. 单位一律换算成无量纲季节效率：HSPF2/SEER2/CEER ÷ 3.412（Btu/Wh → COP），
       AFUE ÷ 100。换算后过量纲断言，写错必然越界、整批失败。
    3. 覆盖范围只有美国市场（geography=country/USA）——HSPF2/SEER2 是美国测试
       标准下的值，不得冒充欧盟 SCOP 或中国 APF。欧盟 EPREL 需要 API key、
       中国无公开数据集，都记在 _not_covered，等口径裁定（HANDOFF 批次 2）。
    4. baseline:electricity 供暖基线 = 1.0 是物理定义（电阻加热），
       属 §7.4 的 TECH_OBJECTIVE_RULE —— 见 docs/CS-DECISIONS.md D7。

用法：

    # data.energystar.gov 在境外，需要代理时先设 HTTPS_PROXY
    uv run --no-project python scripts/fetch_tech_performance.py
"""

from __future__ import annotations

import datetime as _dt
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ES_BASE = "https://data.energystar.gov/resource"
BTU_PER_WH = 3.412  # 1 Wh = 3.412 Btu（定义值）；HSPF2/SEER2/CEER 的分子是 Btu、分母是 Wh

# 与 fetch_emission_factors.py 的 PRICE_COVERED_ISO3 同步（物理规则基线按国落条目用）
PRICE_COVERED_ISO3 = sorted({
    "USA", "CHN",
    "AUT", "BEL", "BGR", "CYP", "CZE", "DEU", "DNK", "EST", "GRC", "ESP", "FIN", "FRA",
    "HRV", "HUN", "IRL", "ITA", "LTU", "LUX", "LVA", "MLT", "NLD", "POL", "PRT", "ROU",
    "SWE", "SVN", "SVK", "ISL", "LIE", "NOR", "CHE", "GBR", "TUR", "MNE", "MKD", "SRB",
    "ALB", "BIH", "MDA", "UKR", "XKX", "GEO",
})

DATASETS = {
    "83eb-xbyy": "ENERGY STAR Certified Heat Pumps",
    "acvd-5wvz": "ENERGY STAR Certified Geothermal Heat Pumps",
    "5xn2-dv4h": "ENERGY STAR Certified Room Air Conditioners",
    "6rww-hpns": "ENERGY STAR Certified Boilers",
    "i97v-e8au": "ENERGY STAR Certified Furnaces",
}

US_FILTER = "markets like '%United States%'"

# fuel_type 的取值必须全部被显式分类或显式忽略——出现新值就报错，不许静默丢行。
# 实测取值（2026-08）：Natural Gas / Oil / Propane Gas / Natural Gas,Propane Gas
FUEL_CLASS = {
    "natural gas": "gas",
    "oil": "oil",
    "propane gas": "lpg",
    "natural gas,propane gas": "gas_lpg_dual",   # 双燃料机型：燃气与液化气两个池都计入
}

# (subject, dataset_id, value_col, extra_where, divisor, confidence, note)
QUERIES: list[tuple[str, str, str, str | None, float, str, str]] = [
    ("ashp_ductless|seasonal_heating_efficiency", "83eb-xbyy", "hspf2_btu_wh",
     "product_type = 'HP - Mini or Multi Split'", BTU_PER_WH, "high",
     "HSPF2（美国 AHRI 210/240-2023 测试口径）÷ 3.412"),
    ("ashp_ductless|seasonal_cooling_efficiency", "83eb-xbyy", "seer2_btu_wh",
     "product_type = 'HP - Mini or Multi Split'", BTU_PER_WH, "high",
     "SEER2 ÷ 3.412"),
    ("ashp_ducted|seasonal_heating_efficiency", "83eb-xbyy", "hspf2_btu_wh",
     "product_type in ('HP - Split System', 'HP - Single Package')", BTU_PER_WH, "high",
     "HSPF2 ÷ 3.412；含分体与整体式风管热泵"),
    ("ashp_ducted|seasonal_cooling_efficiency", "83eb-xbyy", "seer2_btu_wh",
     "product_type in ('HP - Split System', 'HP - Single Package')", BTU_PER_WH, "high",
     "SEER2 ÷ 3.412"),
    ("gshp|seasonal_heating_efficiency", "acvd-5wvz", "cop_rating", None, 1.0, "medium",
     "地源热泵额定 COP（ISO 13256 部分负荷工况）；地温稳定，作季节值近似"),
    ("gshp|seasonal_cooling_efficiency", "acvd-5wvz", "eer_rating", None, BTU_PER_WH, "medium",
     "EER ÷ 3.412；EER 是稳态工况，作季节值近似偏保守"),
    ("window_ac|seasonal_cooling_efficiency", "5xn2-dv4h", "combined_energy_efficiency_ratio_ceer",
     None, BTU_PER_WH, "high", "CEER ÷ 3.412（含待机能耗的综合口径）"),
]

# AFUE 类（锅炉/暖炉按燃料分流）：subject → (dataset, fuel_class)
AFUE_POOLS: dict[str, list[tuple[str, str]]] = {
    "gas_boiler|seasonal_heating_efficiency": [("6rww-hpns", "gas")],
    "gas_furnace|seasonal_heating_efficiency": [("i97v-e8au", "gas")],
    "oil_heating|seasonal_heating_efficiency": [("6rww-hpns", "oil"), ("i97v-e8au", "oil")],
    "lpg_propane_heating|seasonal_heating_efficiency": [("6rww-hpns", "lpg"), ("i97v-e8au", "lpg")],
}

# 换算后的物理合理区间（P50 必须落进来；换算写错会差 3.4 倍或 100 倍，必然越界）
SANITY = {
    "ashp_ductless|seasonal_heating_efficiency": (2.2, 4.5),
    "ashp_ductless|seasonal_cooling_efficiency": (3.5, 8.0),
    "ashp_ducted|seasonal_heating_efficiency": (2.0, 4.0),
    "ashp_ducted|seasonal_cooling_efficiency": (3.0, 7.0),
    "gshp|seasonal_heating_efficiency": (2.8, 5.5),
    "gshp|seasonal_cooling_efficiency": (3.5, 9.0),
    "window_ac|seasonal_cooling_efficiency": (2.5, 5.0),
    "gas_boiler|seasonal_heating_efficiency": (0.85, 1.0),
    "gas_furnace|seasonal_heating_efficiency": (0.85, 1.0),
    "oil_heating|seasonal_heating_efficiency": (0.80, 1.0),
    "lpg_propane_heating|seasonal_heating_efficiency": (0.85, 1.0),
}


def log(msg: str) -> None:
    print(msg, flush=True)


def http_json(url: str, attempts: int = 4) -> Any:
    last: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "clean-heating-simulator/fetch_tech_performance"}
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            if i < attempts - 1:
                time.sleep(2 ** i)
    raise RuntimeError("请求失败（重试 %d 次）：%s\n  %s" % (attempts, url, last))


def histogram(dataset: str, col: str, extra_where: str | None) -> dict[float, int]:
    """拉某列的取值直方图（value → count），只统计美国市场且值非空的行。"""
    where = US_FILTER + " AND " + col + " IS NOT NULL"
    if extra_where:
        where += " AND " + extra_where
    params = {"$select": "%s, count(1) as n" % col, "$group": col, "$where": where, "$limit": "10000"}
    url = ES_BASE + "/" + dataset + ".json?" + urllib.parse.urlencode(params)
    rows = http_json(url)
    hist: dict[float, int] = {}
    bad = 0
    for row in rows:
        raw = row.get(col)
        try:
            v = float(raw)
        except (TypeError, ValueError):
            bad += 1
            continue
        hist[v] = hist.get(v, 0) + int(row["n"])
    total = sum(hist.values())
    if total == 0:
        raise RuntimeError("%s/%s 直方图为空（where=%s）" % (dataset, col, where))
    if bad and bad / (bad + len(hist)) > 0.05:
        raise RuntimeError("%s/%s 有 %d 个无法解析的取值，超过 5%%" % (dataset, col, bad))
    return hist


def percentiles(hist: dict[float, int]) -> tuple[float, float, float, int]:
    """加权 P25/P50/P75（percentile_disc 语义：取第一个累计计数达到分位的取值）。"""
    total = sum(hist.values())
    out: list[float] = []
    for q in (0.25, 0.50, 0.75):
        target = q * total
        cum = 0
        for v in sorted(hist):
            cum += hist[v]
            if cum >= target:
                out.append(v)
                break
    return out[0], out[1], out[2], total


def fuel_where(dataset: str, want: str) -> str:
    """把 fuel_type 的实际取值按 FUEL_CLASS 分类，返回命中 want 的 IN 子句。"""
    params = {"$select": "fuel_type, count(1) as n", "$group": "fuel_type", "$limit": "100"}
    url = ES_BASE + "/" + dataset + ".json?" + urllib.parse.urlencode(params)
    values = [str(r.get("fuel_type") or "") for r in http_json(url)]
    hit: list[str] = []
    for v in values:
        cls = FUEL_CLASS.get(v.strip().lower())
        if cls is None:
            raise RuntimeError("%s 出现未分类的 fuel_type=%r —— 更新 FUEL_CLASS，不许静默丢行" % (dataset, v))
        if cls == want or cls == "gas_lpg_dual" and want in ("gas", "lpg"):
            hit.append(v)
    if not hit:
        return "1=0"  # 该数据集没有这种燃料的行；调用方允许空池
    return "fuel_type in (%s)" % ", ".join("'%s'" % v.replace("'", "''") for v in hit)


def es_point(value: float, low: float, high: float, n: int, dataset: str,
             retrieved: str, confidence: str, note: str) -> dict[str, Any]:
    return {
        "value": round(value, 4),
        "low": round(low, 4),
        "mid": round(value, 4),
        "high": round(high, 4),
        "geography": {"level": "country", "code": "USA"},
        "source_type": "LOCAL_PUBLIC",
        "source_name": "%s（data.energystar.gov/%s）" % (DATASETS[dataset], dataset),
        "source_url": "https://data.energystar.gov/d/" + dataset,
        "retrieved_at": retrieved,
        "confidence": confidence,
        "sample_count": n,
        "aggregation_method": (
            "%s；对全部在售认证条目取 P25/P50/P75（value=P50），按认证列表行计数、未去重贴牌。"
            "注意集合是 ENERGY STAR 认证机型（市场高效端），P25 ≈ 认证门槛，不是全市场存量均值。" % note
        ),
    }


def main() -> int:
    repo = pathlib.Path(__file__).resolve().parent.parent
    retrieved = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")
    policy = json.loads((repo / "docs/data/data-freshness-policy.json").read_text(encoding="utf-8"))["datasets"]

    entries: dict[str, list[dict[str, Any]]] = {}

    log("[1/3] ENERGY STAR：热泵/地源/房间空调（直方图聚合）")
    for subject, dataset, col, extra, divisor, conf, note in QUERIES:
        p25, p50, p75, n = percentiles(histogram(dataset, col, extra))
        v, lo, hi = p50 / divisor, p25 / divisor, p75 / divisor
        s_lo, s_hi = SANITY[subject]
        if not (s_lo <= v <= s_hi):
            raise RuntimeError("%s P50=%.3f 超出 [%s, %s]——换算或数据错了" % (subject, v, s_lo, s_hi))
        entries[subject] = [es_point(v, lo, hi, n, dataset, retrieved, conf, note)]
        log("  %-46s P50=%.3f (P25=%.3f P75=%.3f, n=%d)" % (subject, v, lo, hi, n))

    log("[2/3] ENERGY STAR：锅炉/暖炉 AFUE（按燃料分流）")
    for subject, pools in AFUE_POOLS.items():
        merged: dict[float, int] = {}
        for dataset, fuel in pools:
            where = fuel_where(dataset, fuel)
            if where == "1=0":
                continue
            for v, n in histogram(dataset, "efficiency_afue", where).items():
                merged[v] = merged.get(v, 0) + n
        if not merged:
            log("  %-46s 无数据（如实缺席）" % subject)
            continue
        p25, p50, p75, n = percentiles(merged)
        v, lo, hi = p50 / 100.0, p25 / 100.0, p75 / 100.0
        s_lo, s_hi = SANITY[subject]
        if not (s_lo <= v <= s_hi):
            raise RuntimeError("%s P50=%.3f 超出 [%s, %s]" % (subject, v, s_lo, s_hi))
        ds0 = pools[0][0]
        entries[subject] = [es_point(v, lo, hi, n, ds0, retrieved, "high",
                                     "AFUE ÷ 100（燃料池：%s）" % "+".join(d for d, _ in pools))]
        log("  %-46s P50=%.3f (n=%d)" % (subject, v, n))

    log("[3/3] 存量设备基线（§7.5.3 账单反推用）")
    rule_note = (
        "电阻加热的能量转换效率按物理定义为 1.0（焦耳加热，点位转换，不含围护/分配损失）。"
        "注意：G3 的 heat_pump 与 electric_heating 现状都映射到此基线（引擎按载体建键），"
        "对热泵现状家庭会低估有用需求——见 docs/CS-DECISIONS.md D7 与 HANDOFF §3.3。"
    )
    entries["baseline:electricity|seasonal_heating_efficiency"] = [
        {
            "value": 1.0,
            "geography": {"level": "country", "code": iso3},
            "source_type": "TECH_OBJECTIVE_RULE",
            "source_name": "物理定义：电阻加热转换效率 = 1.0（§7.4 TECH_OBJECTIVE_RULE）",
            "retrieved_at": retrieved,
            "confidence": "high",
            "aggregation_method": rule_note,
        }
        for iso3 in PRICE_COVERED_ISO3
    ]
    log("  baseline:electricity|seasonal_heating_efficiency = 1.0 × %d 国" % len(PRICE_COVERED_ISO3))

    # 美国存量燃烧设备与房间空调的基线：联邦最低能效标准（10 CFR 430.32），
    # 即「存量下限」口径。数值为 eCFR 现行文本逐字转录（2026-08-23 核对），
    # 引句写死在 aggregation_method 里，改数必须先对原文。
    # 方向性偏差：2015 年前装的设备可能低于此下限 → 有用需求被低估 →
    # 所有候选方案的能耗与运行费同方向被低估，见 CS-DECISIONS D7。
    ECFR_URL = "https://www.ecfr.gov/current/title-10/section-430.32"
    US_STOCK_FLOOR = [
        ("baseline:natural_gas|seasonal_heating_efficiency", 80.0 / 100.0,
         "10 CFR 430.32(e)(1)：“Non-weatherized gas furnaces (not including mobile home furnaces) 80.0” AFUE。"
         "美国燃气采暖存量以暖炉为主，故取暖炉类；燃气热水锅炉下限为 82，已知偏差 ±2%。"),
        ("baseline:heating_oil|seasonal_heating_efficiency", 83.0 / 100.0,
         "10 CFR 430.32(e)(1)：“Non-weatherized oil-fired furnaces (not including mobile home furnaces) 83.0” AFUE。"
         "燃油热水锅炉下限为 84。"),
        ("baseline:electricity|seasonal_cooling_efficiency", 10.9 / BTU_PER_WH,
         "10 CFR 430.32(b)(1) Table 6（2014-06-01 至 2026-05-26 的存量标准）："
         "“Without reverse cycle, with louvered sides and with a certified cooling capacity of "
         "8,000 to 13,999 Btu/h 10.9” CEER ÷ 3.412。取最常见容量档；存量基线用旧标准下限是有意选择。"),
    ]
    for subject, value, note in US_STOCK_FLOOR:
        if not (0.5 <= value <= 4.0):
            raise RuntimeError("%s = %.3f 越界——转录或换算错了" % (subject, value))
        entries[subject] = [{
            "value": round(value, 4),
            "geography": {"level": "country", "code": "USA"},
            "source_type": "LOCAL_PUBLIC",
            "source_name": "美国联邦最低能效标准（10 CFR 430.32，存量下限口径）",
            "source_url": ECFR_URL,
            "retrieved_at": retrieved,
            "confidence": "medium",
            "aggregation_method": note,
        }]
        log("  %-46s = %.4f（联邦最低标准，仅 USA）" % (subject, value))

    # 保留中国管线（scripts/fetch_tech_performance_cn.py）写入的点——
    # 本脚本整文件重生成，不保留的话重跑一次美国数据就会把中国条目抹掉。
    out = repo / "docs" / "data" / "scoring" / "technology_performance.json"
    preserved_cn = 0
    prev_not_covered = None
    if out.exists():
        try:
            prev = json.loads(out.read_text(encoding="utf-8"))
        except ValueError:
            prev = {}
        for subject, pts in (prev.get("entries") or {}).items():
            for p in pts:
                if isinstance(p, dict) and p.get("pipeline") == "cn_energylabel":
                    entries.setdefault(subject, []).append(p)
                    preserved_cn += 1
        if preserved_cn:
            prev_not_covered = prev.get("_not_covered")
            log("  保留中国管线条目 %d 个（pipeline=cn_energylabel）" % preserved_cn)

    spec = policy["technology_performance"]
    stale = (_dt.date.fromisoformat(retrieved) + _dt.timedelta(days=spec["refresh_cadence_days"])).isoformat()
    payload = {
        "_status": "POPULATED",
        "_owner": "由 scripts/fetch_tech_performance.py 生成，不要手工编辑",
        "_vintage": {
            "retrieved_at": retrieved,
            "source_period": "ENERGY STAR 认证列表实时快照 " + retrieved,
            "refresh_cadence_days": spec["refresh_cadence_days"],
            "stale_after": stale,
            "rationale": spec["rationale"],
            "refresh_by": "重跑 " + spec["script"],
        },
        "field_key": "technology_performance",
        "unit": "无量纲季节效率（热泵为 SCOP 量纲、燃烧类 <1）；运行温度为 °C",
        "provenance_note": (
            "禁止手挑“典型机型”；禁止用厂商宣传峰值 COP。本文件全部为分布聚合（P25/P50/P75）。"
        ),
        # 有中国管线条目时沿用其 _not_covered（由 fetch_tech_performance_cn.py 维护）；
        # 否则说明中国数据从未落过，用仅美国的原始说明。
        "_not_covered": prev_not_covered if prev_not_covered else (
            "地理覆盖仅美国（HSPF2/SEER2 是美国测试标准，不得冒充欧盟 SCOP 或中国 APF）。"
            "欧盟 EPREL 需要 API key；中国备案库管线见 scripts/fetch_tech_performance_cn.py"
            "（本文件当前无其条目，重跑该脚本恢复）。"
            "minimum/maximum_operating_temp_c 无公开结构化来源（ENERGY STAR 只有 cold_climate 标志），"
            "留空后极端温度裕度按 §7.11 处理；NEEP ccASHP 数据库列入批次 4。"
            "central_ac/split_ac_cooling/portable_ac：ENERGY STAR 无对应在售认证品类，留空。"
            "baseline:solid_fuel 与 baseline:district_*：存量效率无可引用公开口径，留空"
            "（对应现状家庭的账单反推走 §7.11）。基线的美国联邦最低标准仅覆盖 USA，"
            "欧盟/中国的存量基线口径待定。"
        ),
        "entries": entries,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(len(v) for v in entries.values())
    log("\n  wrote %s  %s bytes（共 %d 条，%d 个 subject）" % (out.name, format(out.stat().st_size, ","), total, len(entries)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
