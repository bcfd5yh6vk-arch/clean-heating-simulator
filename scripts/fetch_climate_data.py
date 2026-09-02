#!/usr/bin/env python3
"""抓取 G1 / G4 需要的气候数据，填进 docs/data/climate/ 的两个文件。

产出：

    docs/data/climate/cn_us_admin1_capitals.json   中国 31 省 + 美国 51 州（含 DC）的首府点气候
    docs/data/climate/climate_profiles.json        30 个 Köppen 细分类的标准 profile

数据来源：**NASA POWER**（https://power.larc.nasa.gov/）。选它的理由：
免费、无需 API key、覆盖全球、可引用、并且同一套接口能同时给出月气候学和
逐日极值，不必混用多个来源导致口径不一致。

规格约束（§0.5 / §7.4）：本脚本**不编造任何数值**。每一条记录都来自 NASA POWER
的实际响应，并带上 source_name / source_url / retrieved_at。凡是无法从数据得出的
字段（例如 ASHRAE design temperature）一律留空，让打分引擎走它的 null 分支 ——
规格明令禁止用「合理默认值」把空缺填上。

用法：

    uv run --no-project --with pyshp --with pillow python scripts/fetch_climate_data.py

    # 只跑三个试点场景（规格 §11 Phase 1 的验收范围），快很多
    uv run --no-project --with pyshp --with pillow python scripts/fetch_climate_data.py --pilot-only
"""

from __future__ import annotations

import argparse
import datetime as _dt
import io
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from typing import Any

POWER_BASE = "https://power.larc.nasa.gov/api/temporal"
POWER_HOME = "https://power.larc.nasa.gov/"
CLIMATOLOGY_START, CLIMATOLOGY_END = 1991, 2020
DAILY_START, DAILY_END = "19910101", "20201231"

# 与 docs/src/scoring/config.ts 的 DAYS_IN_MONTH 一致。POWER 的降水单位是
# mm/day，要乘天数才是月总量；两边天数不一致会让 HDD/CDD 和降水柱状图对不上。
DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

POWER_FILL = -999.0  # POWER 用它表示缺测

SOURCE_NAME = f"NASA POWER (MERRA-2 / SRB), {CLIMATOLOGY_START}–{CLIMATOLOGY_END} climatology"

# 规格 §11 Phase 1 只要求覆盖三个场景：河北 + Illinois + 德国某个 Cfb 点
PILOT_ADMIN1 = {("CHN", "HE"), ("USA", "IL")}
PILOT_KOPPEN = {"Dwa", "Dfa", "Cfb", "BSk"}

# ---------------------------------------------------------------------------
# Köppen 细分类的代表点：由数据选，不由我挑
#
# 规格 §G1 Step 4 要求「每类选 1–3 个代表城市」。最初的做法是手写一份知名城市
# 清单，但校验时被栅格否掉两个 —— 其中北京在 Beck et al. 2023 的 1991–2020 分类
# 里是 BSk 而不是常识中的 Dwa（华北平原整体判为半干旱）。这说明「我认为某城市属于
# 某气候区」本身就不可靠，而错一个点会让整类的标准曲线都错。
#
# 改成：**在同一份 Köppen 栅格上，取该类别里人口最多的城市**。这样
#   - 选点与栅格判定在构造上不可能矛盾；
#   - 规则可复现，换数据版本重跑会自动得到新的合适城市；
#   - 「该气候区里最大的城市」也比「我知道的某个城市」更能代表典型居住条件。
# 没有任何城市落在该类别时（EF 冰盖等），退回该类别全部栅格格点的中位位置。
# ---------------------------------------------------------------------------
MIN_REPRESENTATIVE_POP = 50_000

# Köppen → humidity_level 的映射。
#
# 这不是拍脑袋：Köppen 第二个字母编码的就是降水régime，B 类本身就是干旱/半干旱的
# 定义。screening.ts 用 humidity_level 决定蒸发冷却这类 requires_dry_climate 的技术
# 排不排除，所以这里的取值有实际后果 —— 因此 confidence 一律标 medium 而不是 high，
# 并且映射规则会写进产出文件里供复核。
HUMIDITY_BY_KOPPEN_RULE = {
    "B": "dry",       # BW 沙漠 / BS 草原：定义上就是蒸发量大于降水量
    "f": "humid",     # 全年湿润
    "m": "humid",     # 季风
    "w": "mixed",     # 冬干
    "s": "mixed",     # 夏干
}


def humidity_from_koppen(code: str | None) -> tuple[str | None, str | None]:
    """返回 (humidity_level, confidence)。判不出来就返回 (None, None)，不猜。"""
    if not code:
        return None, None
    if code.startswith("B"):
        return "dry", "medium"
    if code.startswith("E"):
        # 极地：绝对含湿量很低，但制冷技术在这里本来就不适用，与其硬套一个
        # 会影响筛选的标签，不如留空让引擎走 null 分支。
        return None, None
    if len(code) >= 2 and code[1] in HUMIDITY_BY_KOPPEN_RULE:
        return HUMIDITY_BY_KOPPEN_RULE[code[1]], "medium"
    return None, None


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------


def load_freshness_policy(repo: pathlib.Path) -> dict[str, Any]:
    path = repo / "docs" / "data" / "data-freshness-policy.json"
    return json.loads(path.read_text(encoding="utf-8"))["datasets"]


def build_vintage(policy: dict[str, Any], dataset: str, retrieved: str, source_period: str) -> dict[str, Any]:
    """生成 _vintage 块。

    抓一次不等于永远对。这个块让「这份数据多旧了」成为文件里的一等事实：
    测试会在 stale_after 之后变红，前端也据此在页面上标出数据年份。
    有效期不是我拍的，写在 docs/data/data-freshness-policy.json 里，附了理由。
    """
    spec = policy[dataset]
    days = int(spec["refresh_cadence_days"])
    stale = _dt.date.fromisoformat(retrieved) + _dt.timedelta(days=days)
    return {
        "retrieved_at": retrieved,
        "source_period": source_period,
        "refresh_cadence_days": days,
        "stale_after": stale.isoformat(),
        "rationale": spec["rationale"],
        "refresh_by": f"重跑 {spec['script']}",
    }


# Windows 上 stdout 默认按本机代码页（GBK），打印 Ürümqi 这类名字会直接抛
# UnicodeEncodeError 把整批抓取打断。脚本的输出编码不该取决于谁在什么终端里调它。
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def log(msg: str) -> None:
    print(msg, flush=True)


def http_json(url: str, attempts: int = 4) -> dict[str, Any]:
    """带退避重试。POWER 偶尔 503，一次失败就整批放弃太浪费。"""
    last: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "clean-heating-simulator/fetch_climate_data"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            if i < attempts - 1:
                time.sleep(2 ** i)
    raise RuntimeError(f"请求失败（重试 {attempts} 次）：{url}\n  {last}")


def power_climatology(lon: float, lat: float) -> tuple[list[float], list[float], str]:
    """月平均气温（℃）与月降水总量（mm）。返回 (temps, precip, url)。"""
    query = urllib.parse.urlencode({
        "parameters": "T2M,PRECTOTCORR",
        "community": "RE",
        "longitude": f"{lon:.4f}",
        "latitude": f"{lat:.4f}",
        "start": CLIMATOLOGY_START,
        "end": CLIMATOLOGY_END,
        "format": "JSON",
    })
    url = f"{POWER_BASE}/climatology/point?{query}"
    payload = http_json(url)
    params = payload["properties"]["parameter"]

    temps: list[float] = []
    precip: list[float] = []
    for i, key in enumerate(MONTH_KEYS):
        t = params["T2M"][key]
        p = params["PRECTOTCORR"][key]
        if t <= POWER_FILL or p <= POWER_FILL:
            raise RuntimeError(f"POWER 在 ({lon}, {lat}) 的 {key} 返回缺测值")
        temps.append(round(float(t), 1))
        # mm/day → 月总量
        precip.append(round(float(p) * DAYS_IN_MONTH[i], 1))
    return temps, precip, url


def power_extremes(lon: float, lat: float) -> tuple[float, float, int, str]:
    """极端温度 proxy：逐日最低的 P01、逐日最高的 P99（§7.7.3）。

    注意这**不是** ASHRAE design temperature，两者定义不同，不要混用
    （见 docs/src/global/types.ts 里 design_temp_c 的注释）。
    """
    query = urllib.parse.urlencode({
        "parameters": "T2M_MIN,T2M_MAX",
        "community": "RE",
        "longitude": f"{lon:.4f}",
        "latitude": f"{lat:.4f}",
        "start": DAILY_START,
        "end": DAILY_END,
        "format": "JSON",
    })
    url = f"{POWER_BASE}/daily/point?{query}"
    payload = http_json(url)
    params = payload["properties"]["parameter"]

    mins = sorted(v for v in params["T2M_MIN"].values() if v > POWER_FILL)
    maxs = sorted(v for v in params["T2M_MAX"].values() if v > POWER_FILL)
    if len(mins) < 3650 or len(maxs) < 3650:
        raise RuntimeError(f"({lon}, {lat}) 的有效日数只有 {len(mins)}/{len(maxs)}，不足 10 年，拒绝据此计算百分位")

    p01 = mins[int(len(mins) * 0.01)]
    p99 = maxs[int(len(maxs) * 0.99)]
    return round(float(p01), 1), round(float(p99), 1), len(mins), url


# ---------------------------------------------------------------------------
# 几何：把首府点落到省/州上
# ---------------------------------------------------------------------------


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat):
            if lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
        j = i
    return inside


def point_in_feature(lon: float, lat: float, geometry: dict[str, Any]) -> bool:
    polys = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for poly in polys:
        if not poly or not point_in_ring(lon, lat, poly[0]):
            continue
        if any(point_in_ring(lon, lat, hole) for hole in poly[1:]):
            continue
        return True
    return False


def load_admin1_capitals(repo: pathlib.Path) -> list[dict[str, Any]]:
    """把 Natural Earth 的 Admin-1 首府点空间连接到 admin1 多边形上。

    用空间连接而不是按名字匹配：上游的 ADM1NAME 与 admin1 图层的 name 拼写经常
    对不上（省份译名、行政区类型后缀），按名字匹配会静默丢省份。点在哪个多边形里
    是确定的事实。
    """
    import shapefile  # pyshp

    admin1 = json.loads((repo / "docs/data/maps/admin1-cn-us.geojson").read_text(encoding="utf-8"))
    zpath = repo / ".tools/mapdata-cache/ne_10m_populated_places.zip"
    if not zpath.exists():
        raise RuntimeError(
            f"缺少 {zpath}。先下载：\n"
            "  curl -sSL -o .tools/mapdata-cache/ne_10m_populated_places.zip "
            "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places.zip"
        )

    z = zipfile.ZipFile(zpath)
    base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
    reader = shapefile.Reader(
        shp=io.BytesIO(z.read(base + ".shp")), dbf=io.BytesIO(z.read(base + ".dbf")),
        shx=io.BytesIO(z.read(base + ".shx")), encoding="utf-8", encodingErrors="replace",
    )
    fields = {f[0].lower(): i for i, f in enumerate(reader.fields[1:])}

    # 直辖市与联邦特区（北京、华盛顿特区）的政府所在地就是国家首都本身，
    # 上游把它们标成 Admin-0 capital 而不是 Admin-1 capital。只认后者会漏掉这些地区，
    # 所以按优先级两轮匹配：先 Admin-1 capital，找不到再退到 Admin-0 capital。
    CAPITAL_CLASSES = ("Admin-1 capital", "Admin-0 capital")

    capitals = []
    for rec, shp in zip(reader.records(), reader.shapes()):
        cls = str(rec[fields["featurecla"]] or "")
        country = str(rec[fields["adm0_a3"]] or "")
        if country not in ("CHN", "USA") or not shp.points:
            continue
        rank = next((i for i, c in enumerate(CAPITAL_CLASSES) if c in cls), None)
        if rank is None:
            continue
        capitals.append({
            "name_en": str(rec[fields["name_en"]] or rec[fields["name"]] or "").strip(),
            "name_zh": str(rec[fields.get("name_zh", fields["name"])] or "").strip(),
            "lon": float(shp.points[0][0]),
            "lat": float(shp.points[0][1]),
            "country": country,
            "rank": rank,
            "featurecla": cls,
        })

    out: list[dict[str, Any]] = []
    missing: list[str] = []
    for feature in admin1["features"]:
        props = feature["properties"]
        hits = [
            c for c in capitals
            if c["country"] == props["country_iso3"] and point_in_feature(c["lon"], c["lat"], feature["geometry"])
        ]
        if not hits:
            missing.append(f"{props['country_iso3']}/{props['admin1_code']} {props['name_en']}")
            continue
        # 优先 Admin-1 capital；同级有多个（上游偶有重复标注）时取第一个并记下来
        hits.sort(key=lambda c: c["rank"])
        cap = hits[0]
        hits = [c for c in hits if c["rank"] == cap["rank"]]
        out.append({
            "country_iso3": props["country_iso3"],
            "admin1_code": props["admin1_code"],
            "admin1_name_en": props["name_en"],
            "admin1_name_zh": props["name_zh"],
            "capital_name": cap["name_en"],
            "capital_name_zh": cap["name_zh"] or cap["name_en"],
            "capital_lon": round(cap["lon"], 4),
            "capital_lat": round(cap["lat"], 4),
            "capital_source": cap["featurecla"],
            "ambiguous_capitals": [c["name_en"] for c in hits[1:]] or None,
        })

    if missing:
        raise RuntimeError(
            "以下省/州没有匹配到首府点，不能静默跳过（会导致这些地区永远无气候数据）：\n  "
            + "\n  ".join(missing)
        )
    return out


# ---------------------------------------------------------------------------
# Köppen 栅格点查（与前端用的是同一份产物）
# ---------------------------------------------------------------------------


class KoppenGrid:
    def __init__(self, repo: pathlib.Path):
        from PIL import Image

        maps = repo / "docs/data/maps"
        self.legend = json.loads((maps / "koppen-legend.json").read_text(encoding="utf-8"))
        self.grid = self.legend["grid"]
        self.by_index = {c["index"]: c["code"] for c in self.legend["classes"]}
        self.image = Image.open(maps / "koppen-1991-2020.png").convert("L")
        assert self.image.size == (self.grid["width"], self.grid["height"]), "PNG 尺寸与 legend 声明不一致"
        # 一次性取成 bytes：比逐点 getpixel 快，也避开 PixelAccess 的类型歧义
        self.data = self.image.tobytes()

    def code_at(self, lon: float, lat: float) -> str | None:
        g = self.grid
        x = int(((lon - g["lon_min"]) % 360) / g["cell_size_deg"])
        y = int((g["lat_max"] - lat) / g["cell_size_deg"])
        x = min(max(x, 0), g["width"] - 1)
        y = min(max(y, 0), g["height"] - 1)
        return self.by_index.get(self.data[y * g["width"] + x])


# ---------------------------------------------------------------------------


def fetch_point(lon: float, lat: float, label: str) -> dict[str, Any]:
    temps, precip, clim_url = power_climatology(lon, lat)
    p01, p99, days, daily_url = power_extremes(lon, lat)
    log(
        f"    {label:<28} 1月 {temps[0]:>6.1f}℃  7月 {temps[6]:>6.1f}℃  "
        f"年降水 {sum(precip):>7.1f}mm  P01 {p01:>6.1f}  P99 {p99:>5.1f}  ({days} 天)"
    )
    return {
        "temperature_c_monthly": temps,
        "precipitation_mm_monthly": precip,
        "extreme_low_temp_proxy_c": p01,
        "extreme_high_temp_proxy_c": p99,
        "extreme_proxy_confidence": "high",
        "_urls": {"climatology": clim_url, "daily": daily_url},
    }


def build_admin1_file(repo: pathlib.Path, koppen: KoppenGrid, pilot_only: bool, retrieved: str,
                      policy: dict[str, Any]) -> dict[str, Any]:
    rows = load_admin1_capitals(repo)
    if pilot_only:
        rows = [r for r in rows if (r["country_iso3"], r["admin1_code"]) in PILOT_ADMIN1]
    log(f"  中美 Admin-1 首府共 {len(rows)} 个，开始抓取")

    entries = []
    for i, row in enumerate(rows, 1):
        lon, lat = row["capital_lon"], row["capital_lat"]
        label = f"[{i}/{len(rows)}] {row['country_iso3']}/{row['admin1_code']} {row['capital_name']}"
        climate = fetch_point(lon, lat, label)
        urls = climate.pop("_urls")
        code = koppen.code_at(lon, lat)
        humidity, humidity_conf = humidity_from_koppen(code)
        if humidity:
            climate["humidity_level"] = humidity
            climate["humidity_confidence"] = humidity_conf

        entry = {
            "country_iso3": row["country_iso3"],
            "admin1_code": row["admin1_code"],
            "admin1_name_en": row["admin1_name_en"],
            "admin1_name_zh": row["admin1_name_zh"],
            "capital_name": row["capital_name"],
            "capital_name_zh": row["capital_name_zh"],
            "capital_lat": lat,
            "capital_lon": lon,
            "koppen_code": code,
            "data_resolution": "admin1_capital",
            "climate": climate,
            "source_name": SOURCE_NAME,
            "source_url": urls["climatology"],
            "source_url_daily": urls["daily"],
            "retrieved_at": retrieved,
        }
        if row["ambiguous_capitals"]:
            entry["_note"] = f"上游在该省内还标了其他首府点：{', '.join(row['ambiguous_capitals'])}；已取第一个"
        entries.append(entry)

    return {
        "_status": "POPULATED",
        "_owner": "Guo Hang（产品负责人）· 数据由 scripts/fetch_climate_data.py 生成",
        "_vintage": build_vintage(policy, "cn_us_admin1_capitals", retrieved, f"{CLIMATOLOGY_START}-{CLIMATOLOGY_END}"),
        "_note": (
            "中国各省 / 美国各州首府点的气候，规格 §G1 Step 1：只收首府点气候代表该省/州，"
            "不做全省栅格平均。本文件由脚本生成，不要手工编辑 —— 重跑脚本会覆盖。"
        ),
        "_source": {
            "name": SOURCE_NAME,
            "home": POWER_HOME,
            "period": f"{CLIMATOLOGY_START}-{CLIMATOLOGY_END}",
            "method": (
                "月均温与月降水取 POWER climatology 接口（降水由 mm/day × 当月天数换算）；"
                "极端温度 proxy 取 POWER daily 接口 1991-2020 逐日 T2M_MIN 的 P01 与 T2M_MAX 的 P99。"
            ),
            "capital_matching": (
                "首府点取 Natural Earth 10m populated places 中 FEATURECLA 含 Admin-1 capital 的要素，"
                "用点在多边形内的空间连接落到 admin1-cn-us.geojson 的省/州上，不按名字匹配。"
            ),
        },
        "_admin1_code_warning": (
            "admin1_code 用 ISO 3166-2 后缀（河北 = HE，河南 = HA，湖北 = HB，海南 = HI，陕西 = SN）。"
            "不要换成 Natural Earth 的 postal 字段，两套码对中国省份互相撞码。"
        ),
        "_not_provided": {
            "design_temp_c": (
                "未提供。它在 screening.ts 里只有 confidence 为 high 时才参与硬筛选，"
                "而 ASHRAE design temperature 与本文件的 P01 proxy 定义不同，不能互相顶替。"
                "缺它时引擎按 null 分支处理，属正确行为。"
            )
        },
        "_humidity_rule": (
            "humidity_level 由 koppen_code 推出：B 类为 dry；第二个字母 f/m 为 humid；w/s 为 mixed；"
            "E 类留空。confidence 一律 medium —— 它是分类推导而非实测。"
        ),
        "entries": entries,
    }


def pick_representatives(repo: pathlib.Path, koppen: KoppenGrid) -> dict[str, dict[str, Any]]:
    """为每个 Köppen 细分类挑一个代表点。见文件上方那段说明为什么不手挑。

    规则一（优先）：该类别里人口最多的城市（Natural Earth 10m populated places）。
    规则二（兜底）：该类别全部栅格格点的中位经纬度，再吸附到最近的同类格点上。
    """
    import shapefile  # pyshp

    zpath = repo / ".tools/mapdata-cache/ne_10m_populated_places.zip"
    z = zipfile.ZipFile(zpath)
    base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
    reader = shapefile.Reader(
        shp=io.BytesIO(z.read(base + ".shp")), dbf=io.BytesIO(z.read(base + ".dbf")),
        shx=io.BytesIO(z.read(base + ".shx")), encoding="utf-8", encodingErrors="replace",
    )
    fields = {f[0].lower(): i for i, f in enumerate(reader.fields[1:])}

    best: dict[str, dict[str, Any]] = {}
    for rec, shp in zip(reader.records(), reader.shapes()):
        if not shp.points:
            continue
        try:
            pop = int(rec[fields["pop_max"]] or 0)
        except (TypeError, ValueError):
            pop = 0
        if pop < MIN_REPRESENTATIVE_POP:
            continue
        lon, lat = float(shp.points[0][0]), float(shp.points[0][1])
        code = koppen.code_at(lon, lat)
        if not code:
            continue
        if code not in best or pop > best[code]["pop"]:
            best[code] = {
                "name": str(rec[fields["name_en"]] or rec[fields["name"]] or "").strip(),
                "lon": round(lon, 3),
                "lat": round(lat, 3),
                "pop": pop,
                "rule": "largest_city_in_zone",
            }

    # 没有城市的类别（冰盖、极端苔原）用栅格几何中位点兜底
    missing = [c["code"] for c in koppen.legend["classes"] if c["code"] not in best]
    if missing:
        wanted = {c["index"]: c["code"] for c in koppen.legend["classes"] if c["code"] in missing}
        cells: dict[str, list[tuple[float, float]]] = {code: [] for code in missing}
        g = koppen.grid
        for y in range(0, g["height"], 2):          # 隔行采样，够用且快得多
            row = y * g["width"]
            for x in range(0, g["width"], 2):
                code = wanted.get(koppen.data[row + x])
                if code:
                    cells[code].append((
                        g["lon_min"] + (x + 0.5) * g["cell_size_deg"],
                        g["lat_max"] - (y + 0.5) * g["cell_size_deg"],
                    ))
        for code, pts in cells.items():
            if not pts:
                continue
            lons = sorted(p[0] for p in pts)
            lats = sorted(p[1] for p in pts)
            mid = (lons[len(lons) // 2], lats[len(lats) // 2])
            # 中位经纬度未必落在该类别上（分布可能不连通），吸附到最近的同类格点
            lon, lat = min(pts, key=lambda p: (p[0] - mid[0]) ** 2 + (p[1] - mid[1]) ** 2)
            best[code] = {
                "name": f"{code} zone median point",
                "lon": round(lon, 3),
                "lat": round(lat, 3),
                "pop": 0,
                "rule": "zone_median_grid_cell",
            }
    return best


def build_koppen_file(repo: pathlib.Path, koppen: KoppenGrid, pilot_only: bool, retrieved: str,
                      policy: dict[str, Any]) -> dict[str, Any]:
    reps = pick_representatives(repo, koppen)
    items = sorted(reps.items())
    if pilot_only:
        items = [(k, v) for k, v in items if k in PILOT_KOPPEN]
    log(f"  Köppen 代表点共 {len(items)} 个（栅格自选），开始抓取")

    by_code = {c["code"]: c for c in koppen.legend["classes"]}
    profiles = []
    mismatches = []
    for i, (code, rep) in enumerate(items, 1):
        city, lon, lat = rep["name"], rep["lon"], rep["lat"]
        actual = koppen.code_at(lon, lat)
        if actual != code:
            mismatches.append(f"{code}: 代表点 {city} ({lon}, {lat}) 在栅格里是 {actual}")
            continue
        climate = fetch_point(lon, lat, f"[{i}/{len(items)}] {code} {city}")
        urls = climate.pop("_urls")
        humidity, humidity_conf = humidity_from_koppen(code)
        if humidity:
            climate["humidity_level"] = humidity
            climate["humidity_confidence"] = humidity_conf

        profiles.append({
            "koppen_code": code,
            "display_name_en": by_code.get(code, {}).get("description_en", ""),
            "fallback_level": "koppen_subtype",
            "representative_locations": [
                {"name": city, "lon": lon, "lat": lat, "population": rep["pop"] or None, "rule": rep["rule"]}
            ],
            "selection_rule": (
                "largest_city_in_zone：在 docs/data/maps/koppen-1991-2020.png 上取该气候区内"
                f"人口最多（≥{MIN_REPRESENTATIVE_POP:,}）的城市（Natural Earth 10m populated places）。"
                "zone_median_grid_cell：该区内没有城市时（冰盖等），取全部格点的中位位置并吸附到最近同类格点。"
                "单点取值，不做多点平均。选点在写入前逐条用同一份栅格复核，不符则整批报错退出。"
            ),
            "climate": climate,
            "source_name": SOURCE_NAME,
            "source_urls": [urls["climatology"], urls["daily"]],
            "retrieved_at": retrieved,
        })

    if mismatches:
        raise RuntimeError(
            "以下 Köppen 代表点与栅格判定不符，必须换点后重跑（宁可缺，不可错）：\n  "
            + "\n  ".join(mismatches)
        )

    return {
        "_status": "POPULATED",
        "_owner": "Guo Hang（产品负责人）· 数据由 scripts/fetch_climate_data.py 生成",
        "_vintage": build_vintage(policy, "climate_profiles", retrieved, f"{CLIMATOLOGY_START}-{CLIMATOLOGY_END}"),
        "_note": (
            "中美之外的国家用 Köppen 标准 profile（规格 §G1 Step 2/4）。"
            "本文件由脚本生成，不要手工编辑 —— 重跑脚本会覆盖。"
        ),
        "_source": {"name": SOURCE_NAME, "home": POWER_HOME, "period": f"{CLIMATOLOGY_START}-{CLIMATOLOGY_END}"},
        "_main_group_fallback": (
            "本文件只提供 30 个细分类，没有 A/B/C/D/E 主类条目。"
            "细分类查不到时 pipeline.js 会尝试主类回退，届时会落空并如实显示为无数据 —— "
            "这是刻意的：主类跨度太大（比如 D 从 Dfa 到 Dfd），用一条曲线代表它会误导。"
        ),
        "_humidity_rule": (
            "humidity_level 由 koppen_code 推出：B 类为 dry；第二个字母 f/m 为 humid；w/s 为 mixed；"
            "E 类留空。confidence 一律 medium。"
        ),
        "profiles": profiles,
    }


def main() -> int:
    repo = pathlib.Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pilot-only", action="store_true", help="只抓规格 §11 Phase 1 的三个试点场景")
    ap.add_argument("--out", type=pathlib.Path, default=repo / "docs" / "data" / "climate")
    args = ap.parse_args()

    retrieved = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")
    policy = load_freshness_policy(repo)
    koppen = KoppenGrid(repo)
    log(f"Köppen 栅格已载入（{koppen.grid['width']}x{koppen.grid['height']}，{len(koppen.by_index)} 个分类）")

    log("\n[1/2] 中美省/州首府气候")
    admin1_payload = build_admin1_file(repo, koppen, args.pilot_only, retrieved, policy)

    log("\n[2/2] Köppen 标准 profile")
    koppen_payload = build_koppen_file(repo, koppen, args.pilot_only, retrieved, policy)

    args.out.mkdir(parents=True, exist_ok=True)
    for name, payload in (
        ("cn_us_admin1_capitals.json", admin1_payload),
        ("climate_profiles.json", koppen_payload),
    ):
        path = args.out / name
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        count = len(payload.get("entries") or payload.get("profiles") or [])
        log(f"\n  wrote {path.name}  {path.stat().st_size:,} bytes  ({count} 条)")

    if args.pilot_only:
        log("\n注意：这是 --pilot-only 的结果，只覆盖试点场景，不要当成完整数据提交。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
