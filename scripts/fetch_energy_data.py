#!/usr/bin/env python3
"""抓取居民能源价格，填进 docs/data/scoring/residential_energy_prices.json。

来源（都是规格 §7.4 骨架里点名的首选源）：

    美国各州  EIA v2 API（年度、居民部门）—— 需要免费 API key
    欧盟各国  Eurostat nrg_pc_204 / nrg_pc_202（半年度、含税、典型家庭用量档）—— 无需 key

规格约束：不编造任何数值，不做邻国替代，不用全球均值填空缺。抓不到的地区就
没有条目，打分引擎按 §7.11 走 null 分支 —— 那是正确行为。

用法：

    # key 从 .env 的 EIA_API_KEY 读，或用环境变量传
    uv run --no-project python scripts/fetch_energy_data.py

    # 不带 EIA key 也能跑，只是没有美国数据
    uv run --no-project python scripts/fetch_energy_data.py --skip-eia
"""

from __future__ import annotations

import argparse
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

EIA_BASE = "https://api.eia.gov/v2"
EUROSTAT_BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"

# 美国各州 + DC。与 docs/data/maps/admin1-cn-us.geojson 的 admin1_code 同一套（ISO 3166-2 后缀）。
US_STATES = [
    "AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL",
    "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE",
    "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
    "VA", "VT", "WA", "WI", "WV", "WY",
]

# ---------------------------------------------------------------------------
# 单位换算
#
# 打分引擎要的是「货币 / kWh」：derived.ts 里 BaselineEnergy = Spend / LocalFuelPrice，
# 随后乘以无量纲的效率得到有用负荷，所以价格的能量单位必须是真实能量单位。
#
# EIA 的居民天然气价格单位是「美元 / 千立方英尺(MCF)」，要用热值折成 kWh。
# 这个换算系数是**外部常数**，不是抓来的数值，因此单列出来并写清来源与灵敏度。
# ---------------------------------------------------------------------------
BTU_PER_KWH = 3412.14                    # 定义值：1 kWh = 3.6 MJ = 3412.14 Btu
NG_BTU_PER_CUBIC_FOOT = 1037.0           # EIA：输送到终端用户的天然气平均热值
KWH_PER_MCF = NG_BTU_PER_CUBIC_FOOT * 1000.0 / BTU_PER_KWH   # ≈ 303.9

# 往回多取几年，用于逐州回退到最近有值的年份（各州发布进度不同步）
EIA_LOOKBACK_YEARS = 3

CONVERSIONS_NOTE = {
    "kwh_per_mcf": round(KWH_PER_MCF, 2),
    "derivation": "1 MCF = 1000 立方英尺 × 1037 Btu/立方英尺 ÷ 3412.14 Btu/kWh",
    "heat_content_source": "EIA：输送到终端用户的天然气平均热值，约 1,037 Btu/立方英尺",
    "heat_content_url": "https://www.eia.gov/totalenergy/data/monthly/pdf/sec13.pdf",
    "sensitivity": (
        "该热值年际在约 1,030–1,040 Btu/立方英尺 之间，即 ±0.5%。相比居民气价本身"
        "年际动辄 10% 以上的波动，这个换算误差可以忽略，但仍记录在此以便复核。"
    ),
}

# 取暖油/丙烷 $/加仑 → USD/kWh 的热值（HHV，与 AFUE 的高位热值基自洽——美国侧闭环）。
# 来源：EIA Monthly Energy Review, Appendix A（Thermal conversion factors）：
# 馏分燃料油 5.770 MMBtu/桶、丙烷 3.836 MMBtu/桶，÷42 加仑/桶。
HEATING_OIL_BTU_PER_GAL = 5_770_000 / 42.0   # ≈ 137,381
PROPANE_BTU_PER_GAL = 3_836_000 / 42.0       # ≈ 91,333
KWH_PER_GAL_OIL = HEATING_OIL_BTU_PER_GAL / BTU_PER_KWH    # ≈ 40.26
KWH_PER_GAL_PROPANE = PROPANE_BTU_PER_GAL / BTU_PER_KWH    # ≈ 26.77

# 量纲哨兵：折算后单位应落在「美元/kWh」的物理量程内，出带即换算或抓取错了
US_FUEL_SANITY = {"heating_oil": (0.04, 0.16), "lpg": (0.06, 0.20)}

# Eurostat 的口径选择（都是「典型家庭」档，含全部税费 —— 家庭实际付的就是含税价）
EUROSTAT_SPECS = {
    "electricity": {
        "dataset": "nrg_pc_204",
        "params": {"nrg_cons": "KWH2500-4999", "unit": "KWH", "tax": "I_TAX", "currency": "EUR"},
        "band_note": "band DC：年用电 2500-4999 kWh，欧盟统计上的典型家庭档",
    },
    "natural_gas": {
        "dataset": "nrg_pc_202",
        "params": {"nrg_cons": "GJ20-199", "unit": "KWH", "tax": "I_TAX", "currency": "EUR"},
        "band_note": "band D2：年用气 20-199 GJ，欧盟统计上的典型家庭档",
    },
}

# 欧洲经济区 + 候选国的 2 位码 → ISO3。EL / UK 是 Eurostat 自己的写法。
# 不在表里的（EU27_2020、EA 之类聚合项）一律丢弃 —— 规格禁止用区域均值替代具体国家。
ISO2_TO_ISO3 = {
    "AT": "AUT", "BE": "BEL", "BG": "BGR", "CY": "CYP", "CZ": "CZE", "DE": "DEU", "DK": "DNK",
    "EE": "EST", "EL": "GRC", "ES": "ESP", "FI": "FIN", "FR": "FRA", "HR": "HRV", "HU": "HUN",
    "IE": "IRL", "IT": "ITA", "LT": "LTU", "LU": "LUX", "LV": "LVA", "MT": "MLT", "NL": "NLD",
    "PL": "POL", "PT": "PRT", "RO": "ROU", "SE": "SWE", "SI": "SVN", "SK": "SVK",
    "IS": "ISL", "LI": "LIE", "NO": "NOR", "CH": "CHE", "UK": "GBR", "TR": "TUR",
    "ME": "MNE", "MK": "MKD", "RS": "SRB", "AL": "ALB", "BA": "BIH", "MD": "MDA", "UA": "UKR",
    "XK": "XKX", "GE": "GEO",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def redact(url: str) -> str:
    """把 API key 从 URL 里抹掉再落盘 —— 数据文件是要提交进仓库的。"""
    return url.split("api_key=")[0] + "api_key=<REDACTED>&" + url.split("&", 1)[1] if "api_key=" in url else url


def http_json(url: str, attempts: int = 4) -> dict[str, Any]:
    last: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "clean-heating-simulator/fetch_energy_data"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            if i < attempts - 1:
                time.sleep(2 ** i)
    raise RuntimeError("请求失败（重试 %d 次）：%s\n  %s" % (attempts, redact(url), last))


def read_env_key(repo: pathlib.Path, name: str) -> str | None:
    if os.environ.get(name):
        return os.environ[name].strip()
    env = repo / ".env"
    if not env.exists():
        return None
    # utf-8-sig：Windows 上用 PowerShell 5.1 的 -Encoding utf8 写出来的 .env 带 BOM，
    # 按 utf-8 读会把 BOM 塞进第一个键名里，然后「key 找不到」而看不出原因。
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    return None


def point(value: float, level: str, code: str, currency: str, source_name: str,
          source_url: str, retrieved: str, confidence: str, aggregation: str,
          country_iso3: str | None = None) -> dict[str, Any]:
    """构造一条 ScoringDataPoint（形状见 docs/src/scoring/dataPoint.ts）。

    admin1 级条目必须传 country_iso3：中国省码与美国州码有四对重码
    （NM/SD/SC/HI），解析器靠这个字段区分国家，缺了会静默串位。
    """
    if level != "country" and not country_iso3:
        raise ValueError("非 country 级条目必须带 country_iso3（%s %s）" % (level, code))
    geography: dict[str, Any] = {"level": level, "code": code}
    if country_iso3 and level != "country":
        geography["country_iso3"] = country_iso3
    return {
        "value": round(float(value), 6),
        "geography": geography,
        "source_type": "LOCAL_PUBLIC",
        "source_name": source_name,
        "source_url": source_url,
        "retrieved_at": retrieved,
        "confidence": confidence,
        "currency": currency,
        "aggregation_method": aggregation,
    }


# ---------------------------------------------------------------------------
# EIA：美国各州
# ---------------------------------------------------------------------------


def eia_url(path: str, key: str, extra: dict[str, str]) -> str:
    parts = [("api_key", key), ("frequency", "annual"),
             ("sort[0][column]", "period"), ("sort[0][direction]", "desc")]
    parts.extend(extra.items())
    return EIA_BASE + "/" + path + "?" + urllib.parse.urlencode(parts)


# 每类数据只发两个请求：一个探最新年份，一个把该年份所有地区一次取回。
#
# 最初写成逐州请求（51 州 × 2 类 = 102 次），实测跑了十分钟还没完 —— EIA 单次
# 响应在 0.8 到 11 秒之间跳。这不只是慢：**刷新要十几分钟且中途可能断，
# 就等于没人会定期刷新**，而定期刷新正是数据时效性唯一真正的保障。
# 批量取之后整个脚本 30 秒内跑完。
EIA_SERIES = {
    "electricity": {
        "path": "electricity/retail-sales/data/",
        "facets": {"data[0]": "price", "facets[sectorid][]": "RES"},
        "value_key": "price",
        "unit_key": "price-units",
        "area_key": "stateid",
        "area_of_state": lambda st: st,
        "expect_unit": "cents per kilowatt-hour",
        "source": "EIA Electricity Retail Sales, residential, annual ",
        "aggregation": "EIA 官方年度加权平均，不是月度值的简单平均",
    },
    "natural_gas": {
        "path": "natural-gas/pri/sum/data/",
        "facets": {"data[0]": "value", "facets[process][]": "PRS"},
        "value_key": "value",
        "unit_key": "units",
        "area_key": "duoarea",
        "area_of_state": lambda st: "S" + st,
        "expect_unit": "$/mcf",
        "source": "EIA Natural Gas delivered to residential consumers, annual ",
        "aggregation": None,   # 运行时填，含换算系数
    },
}


def fetch_eia_series(key: str, retrieved: str, kind: str) -> tuple[list[dict[str, Any]], set[str]]:
    spec = EIA_SERIES[kind]

    # 1) 探最新年份。不写死年份：EIA 每年发布时点不同，写死会在换年时静默停在旧数据上。
    probe = eia_url(spec["path"], key, dict(spec["facets"], **{"length": "1"}))
    probe_rows = (http_json(probe).get("response") or {}).get("data") or []
    if not probe_rows:
        raise RuntimeError("%s：EIA 没有返回任何数据" % kind)
    latest = int(probe_rows[0]["period"])

    # 2) 一次取回最近 EIA_LOOKBACK_YEARS 年的所有地区。
    #
    # 为什么要往回多取几年：EIA 各州的发布进度不同步。实测 2025 年的居民气价里
    # 有 7 个州（CT/MD/ME/NC/OK/RI/SC）行存在但值是 null，只取最新一年会让这些州
    # 直接没有 Affordability 分 —— 而它们其实有 2024 的官方值。逐州回退到最近
    # 有值的年份，并把该年份写进每一条记录，比整州缺失诚实也有用得多。
    start = latest - EIA_LOOKBACK_YEARS + 1
    url = eia_url(spec["path"], key, dict(spec["facets"], **{
        "start": str(start), "end": str(latest), "length": "5000",
    }))
    rows = (http_json(url).get("response") or {}).get("data") or []

    # EIA 的返回里混着分区聚合（ENC / MTN / PACC…）与全国值 NUS。规格禁止用区域均值
    # 替代具体州，所以只按州码精确取；取不到的州就是没有，不代填。
    best: dict[str, dict[str, Any]] = {}
    for row in rows:
        area = str(row.get(spec["area_key"]) or "")
        if row.get(spec["value_key"]) is None:
            continue
        prev = best.get(area)
        if prev is None or int(row["period"]) > int(prev["period"]):
            best[area] = row

    points: list[dict[str, Any]] = []
    missing: list[str] = []
    stale_states: list[str] = []
    periods: set[str] = set()

    for state in US_STATES:
        row = best.get(spec["area_of_state"](state))
        if row is None:
            missing.append(state)
            continue

        units = str(row.get(spec["unit_key"], ""))
        # 单位一旦变了，换算前提就不成立。宁可整批失败，也不要静默算错。
        if spec["expect_unit"] not in units.lower():
            raise RuntimeError("%s/%s 的单位是 %r，预期含 %r" % (kind, state, units, spec["expect_unit"]))

        period = str(row["period"])
        periods.add(period)
        if int(period) < latest:
            stale_states.append("%s(%s)" % (state, period))

        raw = float(row[spec["value_key"]])
        if kind == "electricity":
            value = raw / 100.0                    # cents/kWh → USD/kWh
            agg = spec["aggregation"]
        else:
            value = raw / KWH_PER_MCF              # $/MCF → USD/kWh
            agg = "EIA 官方年度值；按 %.1f kWh/MCF 折算，见 _conversions" % KWH_PER_MCF

        pt = point(value, "admin1", state, "USD", spec["source"] + period,
                   redact(url), retrieved, "high", agg, country_iso3="USA")
        # 年份逐条记，因为各州并不同步；不写清楚的话，混着两个年份的数组看不出差别
        pt["period"] = period
        points.append(pt)

    if missing:
        log("    %s 完全无数据的州（不代填）：%s" % (kind, ", ".join(missing)))
    if stale_states:
        log("    %s 回退到较早年份的州：%s" % (kind, ", ".join(stale_states)))
    return points, periods


# ---------------------------------------------------------------------------
# EIA：美国取暖油与丙烷（全国级）
#
# 州级冬季燃料调查（SHOPP）已停发——wfr 路由现只提供全国(NUS)与 PADD 大区层级，
# 且仅采暖季（10 月–次年 3 月）有值。因此写 country 级条目：各州查询经 §7.4
# 地理回退取到全国价，geographic_level 如实为 country，不做 PADD→州的拆分发明。
# ---------------------------------------------------------------------------

US_HEATING_FUELS = {
    "heating_oil": {"product": "EPD2F", "kwh_per_gal": KWH_PER_GAL_OIL,
                    "label": "No.2 取暖油", "btu": HEATING_OIL_BTU_PER_GAL},
    "lpg": {"product": "EPLLPA", "kwh_per_gal": KWH_PER_GAL_PROPANE,
            "label": "丙烷", "btu": PROPANE_BTU_PER_GAL},
}


def fetch_us_heating_fuels(key: str, retrieved: str) -> tuple[list[tuple[str, dict[str, Any]]], set[str]]:
    """最近一个采暖季的全国居民均价，$/加仑 → USD/kWh（HHV）。返回 (subject, point) 对。"""
    start = (_dt.date.fromisoformat(retrieved) - _dt.timedelta(days=400)).strftime("%Y-%m")
    pts: list[tuple[str, dict[str, Any]]] = []
    months_seen: set[str] = set()
    for subject, spec in US_HEATING_FUELS.items():
        parts = [("api_key", key), ("frequency", "monthly"), ("data[0]", "value"),
                 ("facets[product][]", spec["product"]), ("facets[process][]", "PRS"),
                 ("facets[duoarea][]", "NUS"), ("start", start), ("length", "60"),
                 ("sort[0][column]", "period"), ("sort[0][direction]", "desc")]
        url = EIA_BASE + "/petroleum/pri/wfr/data/?" + urllib.parse.urlencode(parts)
        rows = http_json(url)["response"]["data"]
        vals = []
        for r in rows:
            if r.get("units") != "$/GAL":
                raise RuntimeError("%s 单位变成了 %s，换算会静默算错" % (subject, r.get("units")))
            vals.append((r["period"], float(r["value"])))
        # 只取最近一个采暖季（数据本身只在 10–3 月发布，取最近 6 个有值月份）
        vals.sort(reverse=True)
        season = vals[:6]
        if len(season) < 4:
            raise RuntimeError("%s 最近采暖季只有 %d 个月有值，均价不可靠，如实不写" % (subject, len(season)))
        usd_per_gal = sum(v for _, v in season) / len(season)
        usd_per_kwh = usd_per_gal / spec["kwh_per_gal"]
        lo, hi = US_FUEL_SANITY[subject]
        if not (lo <= usd_per_kwh <= hi):
            raise RuntimeError("%s = %.4f USD/kWh 出量程 [%s, %s]——热值或单位错了"
                               % (subject, usd_per_kwh, lo, hi))
        months = sorted(p for p, _ in season)
        months_seen |= set(months)
        pts.append((subject, point(
            usd_per_kwh, "country", "USA", "USD",
            "EIA Weekly/Monthly Heating Oil and Propane Prices (wfr)，residential，全国均价",
            redact(url), retrieved, "medium",
            "%s：最近采暖季 %s–%s 共 %d 个月的全国居民价算术平均 %.3f $/gal ÷ %.2f kWh/gal"
            "（EIA MER 附录 A 热值 %.0f Btu/gal，HHV 基，与 AFUE 自洽）。"
            "州级冬季燃料调查已停发，仅全国/PADD 层级可用 → country 级条目，"
            "各州经地理回退取全国价；取暖油集中在东北各州，全国均价对其余州代表性有限。"
            % (spec["label"], months[0], months[-1], len(season), usd_per_gal,
               spec["kwh_per_gal"], spec["btu"]),
        )))
        log("  %s: %.4f USD/kWh（%s–%s，%.3f $/gal）"
            % (subject, usd_per_kwh, months[0], months[-1], usd_per_gal))
    return pts, months_seen


# ---------------------------------------------------------------------------
# Eurostat：欧盟各国
# ---------------------------------------------------------------------------


def fetch_eurostat(subject: str, retrieved: str) -> tuple[list[dict[str, Any]], set[str]]:
    spec = EUROSTAT_SPECS[subject]
    params = {"format": "JSON", "lang": "EN", "lastTimePeriod": "1"}
    params.update(spec["params"])
    url = EUROSTAT_BASE + "/" + spec["dataset"] + "?" + urllib.parse.urlencode(params)
    payload = http_json(url)

    dim = payload["dimension"]
    unit_labels = list(dim["unit"]["category"]["label"].values())
    if not any("ilowatt" in u for u in unit_labels):
        raise RuntimeError("%s 的单位变成了 %s，不是每千瓦时" % (spec["dataset"], unit_labels))

    geo_index = dim["geo"]["category"]["index"]
    geo_label = dim["geo"]["category"]["label"]
    period = list(dim["time"]["category"]["index"])[0]
    values = payload["value"]

    points: list[dict[str, Any]] = []
    skipped: list[str] = []
    for code, i in geo_index.items():
        v = values.get(str(i), values.get(i))
        if v is None:
            continue
        iso3 = ISO2_TO_ISO3.get(code)
        if not iso3:
            skipped.append(code)
            continue
        source = "Eurostat %s (%s), %s, %s" % (spec["dataset"], geo_label[code], period, spec["band_note"])
        points.append(point(float(v), "country", iso3, "EUR", source, url, retrieved, "high",
                            "Eurostat 官方半年度值，含全部税费"))
    if skipped:
        log("    跳过非单一国家的聚合项：%s" % ", ".join(sorted(skipped)))
    return points, {period}


# ---------------------------------------------------------------------------
# 中国：省级居民电价（curated 录入 + 校验合并）
#
# 没有可编程接口——数值在各省发改委/物价局公告或电网公司公示页里（HTML/PDF）。
# 做法：官方文件 URL 与数值由人工/子代理搜集进 scripts/curated_cn_residential_electricity.json
# （逐行带文号、原文引句、核对状态），本函数只做校验与合并，绝不生成数值。
# 口径：阶梯第一档、不满 1 千伏、一户一表（决策依据见 docs/CS-DECISIONS.md D5）。
# ---------------------------------------------------------------------------

CN_PRICE_SOURCE_DOMAINS = ("gov.cn", "sgcc.com.cn", "95598.cn", "csg.cn", "impc.com.cn")
CN_PRICE_RANGE = (0.35, 0.75)   # 元/kWh；全国第一档实际区间约 0.42–0.62，越界=录错

# ---------------------------------------------------------------------------
# 中国居民气价的体积→能量换算（元/m³ → 元/kWh）
#
# 采用《中国能源统计年鉴》天然气折标煤系数口径的平均低位发热量 35.588 MJ/m³
# （12.143 tce/万m³ × 29.3076 GJ/tce），即 9.886 kWh/m³。
#
# 为什么用低位热值（LHV）：中国燃气器具能效标准（GB 20665 壁挂炉热效率等）
# 全部以低位热值为基，「LHV 价格 × LHV 效率」在国内自洽；美国侧 EIA 气价
# 热值与 AFUE 同为高位基（HHV），同样自洽。两国各自闭环，引擎不做跨国比价。
# 灵敏度：各气源实际热值 ±8% 左右，与居民气价本身的城际差异同量级，逐条标注。
# ---------------------------------------------------------------------------
MJ_PER_M3_CN_LHV = 35.588
KWH_PER_M3_CN = MJ_PER_M3_CN_LHV / 3.6          # ≈ 9.886
CN_GAS_RANGE_M3 = (1.5, 5.5)                     # 元/m³；省会一档实际区间约 2.2–3.7


def load_cn_electricity(repo: pathlib.Path, retrieved: str) -> list[dict[str, Any]]:
    curated_path = repo / "scripts" / "curated_cn_residential_electricity.json"
    if not curated_path.exists():
        log("    未找到 %s，跳过中国（见 _not_covered）" % curated_path.name)
        return []
    rows = json.loads(curated_path.read_text(encoding="utf-8"))

    geo = json.loads((repo / "docs/data/maps/admin1-cn-us.geojson").read_text(encoding="utf-8"))
    legal = {f["properties"]["admin1_code"] for f in geo["features"]
             if f["properties"]["country_iso3"] == "CHN"}

    points: list[dict[str, Any]] = []
    seen: set[str] = set()
    skipped: list[str] = []
    for row in rows:
        code = row["admin1_code"]
        if row.get("verified") != "official_url":
            skipped.append("%s(%s)" % (row.get("province_zh", "?"), row.get("verified")))
            continue
        if code not in legal:
            raise RuntimeError("curated 里出现非法省码 %r（合法集见 admin1-cn-us.geojson）" % code)
        if code in seen:
            raise RuntimeError("curated 里省份重复：%s" % code)
        seen.add(code)
        value = float(row["value_cny_per_kwh"])
        if not (CN_PRICE_RANGE[0] <= value <= CN_PRICE_RANGE[1]):
            raise RuntimeError("%s = %s 元/kWh，超出 %s——curated 录入有误"
                               % (row["province_zh"], value, list(CN_PRICE_RANGE)))
        url = str(row["source_url"])
        host = urllib.parse.urlparse(url).hostname or ""
        if not any(host == d or host.endswith("." + d) for d in CN_PRICE_SOURCE_DOMAINS):
            raise RuntimeError("%s 的出处域名 %r 不在官方白名单 %s 内"
                               % (row["province_zh"], host, list(CN_PRICE_SOURCE_DOMAINS)))
        if not str(row.get("quote", "")).strip():
            raise RuntimeError("%s 缺原文引句（quote）" % row["province_zh"])

        pt = point(value, "admin1", code, "CNY",
                   "%s《%s》（%s）" % (row["issuer"], row["doc_title"], row.get("doc_no") or "无文号"),
                   url, retrieved, "high",
                   "%s；中国居民目录电价（阶梯第一档），长期有效直至新文件替代" % row["tariff_scope"],
                   country_iso3="CHN")
        pt["effective_note"] = row.get("effective_note", "")
        points.append(pt)

    if skipped:
        log("    未采信的省（无官方出处，不代填）：%s" % ", ".join(skipped))
    points.sort(key=lambda p: p["geography"]["code"])
    return points


def load_cn_gas(repo: pathlib.Path, retrieved: str) -> list[dict[str, Any]]:
    """中国居民管道气：省会城市阶梯第一档价作省级代表值（curated，口径见 CS-DECISIONS D10）。"""
    curated_path = repo / "scripts" / "curated_cn_residential_gas.json"
    if not curated_path.exists():
        log("    未找到 %s，跳过中国气价（见 _not_covered）" % curated_path.name)
        return []
    rows = json.loads(curated_path.read_text(encoding="utf-8"))

    geo = json.loads((repo / "docs/data/maps/admin1-cn-us.geojson").read_text(encoding="utf-8"))
    legal = {f["properties"]["admin1_code"] for f in geo["features"]
             if f["properties"]["country_iso3"] == "CHN"}

    points: list[dict[str, Any]] = []
    seen: set[str] = set()
    skipped: list[str] = []
    for row in rows:
        code = row["admin1_code"]
        if row.get("verified") != "official_url":
            skipped.append("%s(%s)" % (row.get("city_zh", "?"), row.get("verified")))
            continue
        if code not in legal:
            raise RuntimeError("气价 curated 里出现非法省码 %r" % code)
        if code in seen:
            raise RuntimeError("气价 curated 里省份重复：%s" % code)
        seen.add(code)
        per_m3 = float(row["value_cny_per_m3"])
        if not (CN_GAS_RANGE_M3[0] <= per_m3 <= CN_GAS_RANGE_M3[1]):
            raise RuntimeError("%s = %s 元/m³，超出 %s——curated 录入有误"
                               % (row["city_zh"], per_m3, list(CN_GAS_RANGE_M3)))
        url = str(row["source_url"])
        host = urllib.parse.urlparse(url).hostname or ""
        if not any(host == d or host.endswith("." + d) for d in CN_PRICE_SOURCE_DOMAINS):
            raise RuntimeError("%s 的出处域名 %r 不在官方白名单内" % (row["city_zh"], host))
        if not str(row.get("quote", "")).strip():
            raise RuntimeError("%s 缺原文引句（quote）" % row["city_zh"])

        heating_note = str(row.get("heating_season_note", "")).strip()
        agg = ("%s；%s市居民管道气阶梯第一档 %.4g 元/m³ ÷ %.4g kWh/m³（低位热值，见 _conversions.cn_natural_gas）"
               "；省会价作省级代表值" % (row["tariff_scope"], row["city_zh"], per_m3, KWH_PER_M3_CN))
        if heating_note:
            agg += "。该市另有采暖专项气价/扩档条款（引擎无专项价格机制，未采用）：" + heating_note[:160]

        pt = point(per_m3 / KWH_PER_M3_CN, "admin1", code, "CNY",
                   "%s《%s》（%s）" % (row["issuer"], row["doc_title"], row.get("doc_no") or "无文号"),
                   url, retrieved, "medium", agg, country_iso3="CHN")
        pt["effective_note"] = row.get("effective_note", "")
        points.append(pt)

    if skipped:
        log("    未采信的城市（无官方出处，不代填）：%s" % ", ".join(skipped))
    points.sort(key=lambda p: p["geography"]["code"])
    return points


# ---------------------------------------------------------------------------


def main() -> int:
    repo = pathlib.Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--skip-eia", action="store_true", help="不抓美国（没有 EIA key 时用）")
    ap.add_argument("--out", type=pathlib.Path, default=repo / "docs" / "data" / "scoring")
    args = ap.parse_args()

    retrieved = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")
    policy = json.loads((repo / "docs/data/data-freshness-policy.json").read_text(encoding="utf-8"))["datasets"]

    entries: dict[str, list[dict[str, Any]]] = {}
    periods: set[str] = set()
    coverage: dict[str, Any] = {}

    if args.skip_eia:
        log("[1/4][2/4] EIA：已跳过")
    else:
        key = read_env_key(repo, "EIA_API_KEY")
        if not key:
            raise SystemExit(
                "找不到 EIA_API_KEY。放进仓库根目录的 .env（已被 gitignore），或用环境变量传。\n"
                "免费申请：https://www.eia.gov/opendata/register.php\n"
                "或者加 --skip-eia 只抓欧盟部分。"
            )
        log("[1/4] EIA：美国各州居民能源价格（每类 2 个请求，批量取）")
        for kind in ("electricity", "natural_gas"):
            pts, yrs = fetch_eia_series(key, retrieved, kind)
            entries.setdefault(kind, []).extend(pts)
            periods |= yrs
            coverage.setdefault("US", {})[kind] = len(pts)
            log("  %s: %d/%d 州（年份 %s）" % (kind, len(pts), len(US_STATES), sorted(yrs)))

        log("[2/4] EIA：美国取暖油与丙烷（全国级，最近采暖季均价）")
        fuel_pairs, fuel_months = fetch_us_heating_fuels(key, retrieved)
        for subject, pt in fuel_pairs:
            entries.setdefault(subject, []).append(pt)
            coverage.setdefault("US", {})[subject] = 1
        periods |= fuel_months

    log("[3/4] Eurostat：欧盟各国居民能源价格")
    for subject in ("electricity", "natural_gas"):
        pts, per = fetch_eurostat(subject, retrieved)
        entries.setdefault(subject, []).extend(pts)
        periods |= per
        coverage.setdefault("EU", {})[subject] = len(pts)
        log("  %s: %d 个国家（%s）" % (subject, len(pts), sorted(per)[0]))

    log("[4/4] 中国：省级居民电价/气价（curated 合并）")
    cn_pts = load_cn_electricity(repo, retrieved)
    if cn_pts:
        entries.setdefault("electricity", []).extend(cn_pts)
        coverage.setdefault("CN", {})["electricity"] = len(cn_pts)
        log("  electricity: %d 个省级行政区（目录电价，长期有效）" % len(cn_pts))
    cn_gas = load_cn_gas(repo, retrieved)
    if cn_gas:
        entries.setdefault("natural_gas", []).extend(cn_gas)
        coverage.setdefault("CN", {})["natural_gas"] = len(cn_gas)
        log("  natural_gas: %d 个省级行政区（省会一档价代表）" % len(cn_gas))

    total = sum(len(v) for v in entries.values())
    if total == 0:
        raise SystemExit("一条数据都没抓到，不写文件（写个空的会把 _status 变成假的已填充）")

    spec = policy["residential_energy_prices"]
    stale = (_dt.date.fromisoformat(retrieved) + _dt.timedelta(days=spec["refresh_cadence_days"])).isoformat()

    payload = {
        "_status": "POPULATED",
        "_owner": "由 scripts/fetch_energy_data.py 生成，不要手工编辑",
        "_vintage": {
            "retrieved_at": retrieved,
            "source_period": "/".join(sorted(periods)),
            "refresh_cadence_days": spec["refresh_cadence_days"],
            "stale_after": stale,
            "rationale": spec["rationale"],
            "refresh_by": "重跑 " + spec["script"],
        },
        "field_key": "residential_energy_prices",
        "unit": "currency per kWh（每条记录的 currency 字段标明是哪种货币）",
        "_currency_warning": (
            "同一个 subject 数组里同时存在 USD（EIA）与 EUR（Eurostat）的记录。"
            "地理回退按国家/州挑记录，所以取到的货币与用户所在地一致；"
            "但 §7.6.2 的 OperatingBurdenPct 用的是用户自填收入的货币，两者仍可能不同 —— "
            "那个不闭环是规格层面的问题，见 docs/HANDOFF.md §3.2 第 1 条，尚待产品负责人裁定。"
        ),
        "_conversions": {
            "us_natural_gas": CONVERSIONS_NOTE,
            "us_heating_oil_and_propane": {
                "kwh_per_gal_heating_oil": round(KWH_PER_GAL_OIL, 2),
                "kwh_per_gal_propane": round(KWH_PER_GAL_PROPANE, 2),
                "derivation": "EIA MER 附录 A：馏分燃料油 5.770、丙烷 3.836 MMBtu/桶 ÷ 42 加仑 ÷ 3412.14 Btu/kWh",
                "heating_value_basis": "高位热值（HHV），与 AFUE 同基，美国侧自洽闭环",
                "geographic_note": "州级冬季燃料调查（SHOPP）已停发，仅全国级条目，各州经 §7.4 回退取用",
            },
            "cn_natural_gas": {
                "kwh_per_m3": round(KWH_PER_M3_CN, 4),
                "derivation": "《中国能源统计年鉴》天然气折标系数口径平均低位发热量 %.3f MJ/m³ ÷ 3.6" % MJ_PER_M3_CN_LHV,
                "heating_value_basis": (
                    "低位热值（LHV）。中国燃气器具能效标准（GB 20665 等）以低位热值为基，"
                    "「LHV 价 × LHV 效率」国内自洽；美国侧 EIA 热值与 AFUE 同为高位基，各自闭环。"
                ),
                "sensitivity": "各气源实际热值约 ±8%，与居民气价的城际差异同量级。",
            },
        },
        "_coverage": coverage,
        "_not_covered": (
            "中国居民电价/气价中 curated 文件未收录或无官方出处的省：如实缺席"
            "（气价定价权在地级市，条目为省会城市第一档价的省级代表值）。"
            "其余国家与其余燃料（lpg / heating_oil / solid_fuel / biomass / district_*）：无覆盖。"
            "没有条目时打分引擎按 §7.11 走 null 分支，不做邻国替代、不用全球均值。"
        ),
        "entries": entries,
    }

    args.out.mkdir(parents=True, exist_ok=True)
    path = args.out / "residential_energy_prices.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log("\n  wrote %s  %s bytes（共 %d 条）" % (path.name, format(path.stat().st_size, ","), total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
