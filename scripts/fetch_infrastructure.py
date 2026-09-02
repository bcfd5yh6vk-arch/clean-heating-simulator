#!/usr/bin/env python3
"""生成 docs/data/scoring/infrastructure_availability.json（布尔：某类基础设施在该地区是否存在）。

引擎语义（docs/src/scoring/index.ts infrastructureEvidence）：条目为 true 时，
该技术的基础设施证据等级从 unknown 升为 local_public_available；false 与缺失同效。
因此**只写 true 条目**——true 的判据必须是官方统计里的存在性证据，规则如下：

    district_heating_network（中国省级）：住建部《城市建设统计年鉴》城市集中供热面积
        ≥ 500 万㎡（近零的川/黔/滇/藏来自高原县市零星热网，不代表省会可得性——
        阈值决策见 docs/CS-DECISIONS.md D9）
    piped_gas（中国省级）：同年鉴城市天然气供气总量 > 0（31 省全部成立）
    piped_gas（美国州级）  ：EIA 天然气居民用户数（VN3）> 0
    electricity（国家级）  ：世界银行 EG.ELC.ACCS.ZS（通电人口比例）≥ 99%

不覆盖（缺就是缺，走 §7.11）：delivered_fuel / solid_fuel_supply / district_cooling_network
（无官方存在性口径）；美国的集中供热（个别城市蒸汽网，州级判定无意义）。

用法：

    uv run --no-project python scripts/fetch_infrastructure.py
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DH_THRESHOLD_WAN_M2 = 500.0   # 万㎡；D9

# 与 fetch_emission_factors.py 保持同步
CN_NAME_TO_CODE = {
    "北京": "BJ", "天津": "TJ", "河北": "HE", "山西": "SX", "内蒙古": "NM",
    "辽宁": "LN", "吉林": "JL", "黑龙江": "HL", "上海": "SH", "江苏": "JS",
    "浙江": "ZJ", "安徽": "AH", "福建": "FJ", "江西": "JX", "山东": "SD",
    "河南": "HA", "湖北": "HB", "湖南": "HN", "广东": "GD", "广西": "GX",
    "海南": "HI", "重庆": "CQ", "四川": "SC", "贵州": "GZ", "云南": "YN",
    "西藏": "XZ", "陕西": "SN", "甘肃": "GS", "青海": "QH", "宁夏": "NX",
    "新疆": "XJ",
}

US_STATES = [
    "AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL",
    "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE",
    "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
    "VA", "VT", "WA", "WI", "WV", "WY",
]

# 与 fetch_emission_factors.py 的 PRICE_COVERED_ISO3 同步
PRICE_COVERED_ISO3 = sorted({
    "USA", "CHN",
    "AUT", "BEL", "BGR", "CYP", "CZE", "DEU", "DNK", "EST", "GRC", "ESP", "FIN", "FRA",
    "HRV", "HUN", "IRL", "ITA", "LTU", "LUX", "LVA", "MLT", "NLD", "POL", "PRT", "ROU",
    "SWE", "SVN", "SVK", "ISL", "LIE", "NOR", "CHE", "GBR", "TUR", "MNE", "MKD", "SRB",
    "ALB", "BIH", "MDA", "UKR", "XKX", "GEO",
})

WB_URL = ("https://api.worldbank.org/v2/country/%s/indicator/EG.ELC.ACCS.ZS"
          "?format=json&mrnev=1&per_page=200") % ";".join(PRICE_COVERED_ISO3)
EIA_BASE = "https://api.eia.gov/v2"


def log(msg: str) -> None:
    print(msg, flush=True)


def http_json(url: str, attempts: int = 4) -> Any:
    last: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "clean-heating-simulator/fetch_infrastructure"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            if i < attempts - 1:
                time.sleep(2 ** i)
    raise RuntimeError("请求失败（重试 %d 次）：%s\n  %s" % (attempts, url.split("api_key=")[0], last))


def read_env_key(repo: pathlib.Path, name: str) -> str | None:
    if os.environ.get(name):
        return os.environ[name].strip()
    env = repo / ".env"
    if not env.exists():
        return None
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        if line.strip().startswith(name + "="):
            return line.strip().split("=", 1)[1].strip()
    return None


def point_true(level: str, code: str, source_name: str, source_url: str, retrieved: str,
               confidence: str, aggregation: str, country_iso3: str | None = None,
               period: str | None = None) -> dict[str, Any]:
    geography: dict[str, Any] = {"level": level, "code": code}
    if country_iso3 and level != "country":
        geography["country_iso3"] = country_iso3
    pt: dict[str, Any] = {
        "value": True,
        "geography": geography,
        "source_type": "LOCAL_PUBLIC",
        "source_name": source_name,
        "source_url": source_url,
        "retrieved_at": retrieved,
        "confidence": confidence,
        "aggregation_method": aggregation,
    }
    if period:
        pt["period"] = period
    return pt


def cn_entries(repo: pathlib.Path, retrieved: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    curated = json.loads((repo / "scripts/curated_cn_infrastructure.json").read_text(encoding="utf-8"))
    year = str(curated["data_year"])
    src_name = "%s（%s 年数据）" % (curated["source_title"], year)
    src_url = curated["source_url"]

    dh_points: list[dict[str, Any]] = []
    gas_points: list[dict[str, Any]] = []
    dh_true: list[str] = []
    for name, code in CN_NAME_TO_CODE.items():
        dh_raw = curated["district_heating"]["values"].get(name)
        gas_raw = curated["piped_gas"]["values"].get(name)
        if dh_raw is None or gas_raw is None:
            raise RuntimeError("curated 缺省份 %s" % name)
        dh, gas = float(dh_raw), float(gas_raw)
        if dh >= DH_THRESHOLD_WAN_M2:
            dh_true.append(code)
            dh_points.append(point_true(
                "admin1", code, src_name, src_url, retrieved, "high",
                "城市集中供热面积 %.0f 万㎡ ≥ %.0f 万㎡ 阈值（阈值决策见 CS-DECISIONS D9；"
                "口径为设市城市城区，不含县城）" % (dh, DH_THRESHOLD_WAN_M2),
                country_iso3="CHN", period=year,
            ))
        if gas > 0:
            gas_points.append(point_true(
                "admin1", code, src_name, src_url, retrieved, "high",
                "城市天然气供气总量 %.0f 万m³ > 0，城市管网存在（农村通气率另议，此处仅为存在性）" % gas,
                country_iso3="CHN", period=year,
            ))
    if not (12 <= len(dh_true) <= 22):
        raise RuntimeError("集中供热省数 %d 异常（预期北方 15–20 省），检查 curated 或阈值" % len(dh_true))
    if len(gas_points) != 31:
        raise RuntimeError("管道燃气省数 %d ≠ 31" % len(gas_points))
    log("  中国：集中供热 %d 省（%s），管道燃气 31/31" % (len(dh_true), " ".join(sorted(dh_true))))
    return dh_points, gas_points, year


def us_gas_entries(repo: pathlib.Path, retrieved: str) -> tuple[list[dict[str, Any]], str]:
    key = read_env_key(repo, "EIA_API_KEY")
    if not key:
        raise SystemExit("找不到 EIA_API_KEY（.env 或环境变量）。")
    parts = [("api_key", key), ("frequency", "annual"), ("data[0]", "value"),
             ("facets[process][]", "VN3"),
             ("sort[0][column]", "period"), ("sort[0][direction]", "desc"), ("length", "5000")]
    url = EIA_BASE + "/natural-gas/cons/num/data/?" + urllib.parse.urlencode(parts)
    rows = (http_json(url).get("response") or {}).get("data") or []
    best: dict[str, tuple[str, float]] = {}
    for row in rows:
        area = str(row.get("duoarea") or "")
        if not area.startswith("S") or row.get("value") is None:
            continue
        st = area[1:]
        if st not in US_STATES:
            continue
        period = str(row["period"])
        if st not in best or period > best[st][0]:
            best[st] = (period, float(row["value"]))
    missing = sorted(set(US_STATES) - set(best))
    if missing:
        raise RuntimeError("EIA 居民燃气用户数缺州：%s" % ", ".join(missing))
    points = []
    for st in sorted(best):
        period, consumers = best[st]
        if consumers <= 0:
            log("  %s 居民燃气用户数为 0，不写 true 条目" % st)
            continue
        points.append(point_true(
            "admin1", st,
            "EIA Natural Gas Number of Residential Consumers (VN3), %s" % period,
            url.split("api_key=")[0] + "api_key=<REDACTED>&" + url.split("&", 1)[1],
            retrieved, "high",
            "州内居民燃气用户 %.0f 户 > 0，配气网存在（存在性口径，非入户率）" % consumers,
            country_iso3="USA", period=period,
        ))
    log("  美国：管道燃气 %d/51 州" % len(points))
    return points, best[US_STATES[0]][0]


def electricity_entries(retrieved: str) -> tuple[list[dict[str, Any]], str]:
    payload = http_json(WB_URL)
    if not isinstance(payload, list) or len(payload) < 2 or payload[1] is None:
        raise RuntimeError("世界银行 API 返回形状异常")
    points = []
    years = set()
    for row in payload[1]:
        iso3 = row.get("countryiso3code")
        value = row.get("value")
        if iso3 not in PRICE_COVERED_ISO3 or value is None:
            continue
        if float(value) < 99.0:
            log("  %s 通电率 %.1f%% < 99%%，不写 true 条目" % (iso3, float(value)))
            continue
        years.add(str(row.get("date")))
        points.append(point_true(
            "country", iso3,
            "World Bank EG.ELC.ACCS.ZS (Access to electricity, %% of population), %s" % row.get("date"),
            "https://api.worldbank.org/v2/country/%s/indicator/EG.ELC.ACCS.ZS" % iso3,
            retrieved, "high",
            "通电人口比例 %.1f%% ≥ 99%%" % float(value),
            period=str(row.get("date")),
        ))
    if len(points) < 35:
        raise RuntimeError("电网可得性只有 %d 国，API 解析可能出错" % len(points))
    log("  电力：%d 国（世行 %s）" % (len(points), "/".join(sorted(years))))
    return points, "/".join(sorted(years))


def main() -> int:
    repo = pathlib.Path(__file__).resolve().parent.parent
    retrieved = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")
    policy = json.loads((repo / "docs/data/data-freshness-policy.json").read_text(encoding="utf-8"))["datasets"]

    log("[1/3] 中国（住建部年鉴 curated）")
    dh_cn, gas_cn, cn_year = cn_entries(repo, retrieved)
    log("[2/3] 美国（EIA 居民燃气用户数）")
    gas_us, us_year = us_gas_entries(repo, retrieved)
    log("[3/3] 电力（世界银行通电率）")
    elec, wb_years = electricity_entries(retrieved)

    entries = {
        "district_heating_network": dh_cn,
        "piped_gas": gas_cn + gas_us,
        "electricity": elec,
    }

    spec = policy["infrastructure_availability"]
    stale = (_dt.date.fromisoformat(retrieved) + _dt.timedelta(days=spec["refresh_cadence_days"])).isoformat()
    payload = {
        "_status": "POPULATED",
        "_owner": "由 scripts/fetch_infrastructure.py 生成，不要手工编辑",
        "_vintage": {
            "retrieved_at": retrieved,
            "source_period": "%s (住建部)/%s (EIA)/%s (世行)" % (cn_year, us_year, wb_years),
            "refresh_cadence_days": spec["refresh_cadence_days"],
            "stale_after": stale,
            "rationale": spec["rationale"],
            "refresh_by": "重跑 " + spec["script"],
        },
        "field_key": "infrastructure_availability",
        "unit": "boolean（true = 官方统计证明该类基础设施在该地区存在）",
        "provenance_note": (
            "只写 true 条目：引擎里 false 与缺失同效（都落 unknown 证据级），"
            "而「不存在」在统计上无法与「没统计到」区分。true 的判据是存在性，不是入户率。"
        ),
        "_not_covered": (
            "delivered_fuel / solid_fuel_supply / district_cooling_network：无官方存在性口径。"
            "美国集中供热：个别城市蒸汽网，州级判定无意义。"
            "中国集中供热阈值 500 万㎡ 的理由与被排除的近零省（川/黔/滇/藏）见 CS-DECISIONS D9。"
        ),
        "entries": entries,
    }
    out = repo / "docs" / "data" / "scoring" / "infrastructure_availability.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(len(v) for v in entries.values())
    log("\n  wrote %s  %s bytes（共 %d 条）" % (out.name, format(out.stat().st_size, ","), total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
