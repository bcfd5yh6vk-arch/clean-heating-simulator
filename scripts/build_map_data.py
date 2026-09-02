#!/usr/bin/env python3
"""生成 G1 气候地图选点所需的全部静态数据产物。

产物（写到 docs/data/maps/）：

    admin0-boundaries.geojson     国界，用于识别 country_iso3
    admin1-cn-us.geojson          中美省/州界，用于识别 admin1_code（规格 §G1 明令只这两国）
    populated-places.geojson      城市点位，只做定位辅助，不参与气候取值
    koppen-1991-2020.png          Köppen 分类栅格，像素值 = 分类索引 0..30
    koppen-legend.json            索引 → Köppen 码 + 网格地理变换 + 自检探针
    country-label-overrides.json  国家显示名覆盖（产品负责人所有，默认空）
    SOURCES.md                    上述每一项的来源、版本、许可、处理步骤与 SHA256

为什么要有这个脚本：这些产物里有二进制和大 JSON，直接提交进仓库的话没人能验证它们
是怎么来的。规格 §0.5 要求 LOCAL_PUBLIC 数据可追溯，所以推导过程必须是可重跑的代码。

用法：

    uv run --no-project --with pyshp --with numpy --with pillow --with tifffile \
        --with imagecodecs python scripts/build_map_data.py

需要联网。下载会缓存在 .tools/mapdata-cache/（已在 .gitignore 里）。

注意：本脚本**不产生任何气候数值**。它只产生「点在哪个国家/省州/气候区」的识别用数据。
月均温、降水、排放因子等数值属于 docs/data/climate/ 与 docs/data/scoring/，
按规格 §0.5 由产品负责人提供，CS 不得自行填写。
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import pathlib
import struct
import sys
import urllib.request
import zipfile
import zlib
from typing import Any, Iterable

# ---------------------------------------------------------------------------
# 上游来源
# ---------------------------------------------------------------------------

NE_BASE = "https://naciscdn.org/naturalearth"

SOURCES: dict[str, dict[str, str]] = {
    "admin0": {
        "url": f"{NE_BASE}/50m/cultural/ne_50m_admin_0_countries.zip",
        "name": "Natural Earth 1:50m Admin 0 – Countries",
        "license": "Public domain (Natural Earth terms of use)",
        "home": "https://www.naturalearthdata.com/",
    },
    "admin1": {
        "url": f"{NE_BASE}/10m/cultural/ne_10m_admin_1_states_provinces.zip",
        "name": "Natural Earth 1:10m Admin 1 – States, Provinces",
        "license": "Public domain (Natural Earth terms of use)",
        "home": "https://www.naturalearthdata.com/",
    },
    "places": {
        "url": f"{NE_BASE}/50m/cultural/ne_50m_populated_places.zip",
        "name": "Natural Earth 1:50m Populated Places",
        "license": "Public domain (Natural Earth terms of use)",
        "home": "https://www.naturalearthdata.com/",
    },
    "koppen": {
        # figshare 上的整包有 130 MB，而我们只需要其中两个 member（0.1° 的
        # 1991–2020 GeoTIFF 与 legend.txt，合计约 190 KB）。下面用 HTTP Range
        # 读 zip 中央目录后只取这两个条目，不下载整包。
        "url": "https://ndownloader.figshare.com/files/61012822",
        "name": "Köppen-Geiger climate classification maps 1991–2020, 0.1° (Beck et al. 2023)",
        "license": "CC BY 4.0",
        "home": "https://www.gloh2o.org/koppen/",
        "citation": (
            "Beck, H. E., T. R. McVicar, N. Vergopolan, A. Berg, N. J. Lutsko, A. Dufour, "
            "Z. Zeng, X. Jiang, A. I. J. M. van Dijk, and D. G. Miralles. High-resolution "
            "(1 km) Köppen-Geiger maps for 1901-2099 based on constrained CMIP6 projections, "
            "Scientific Data 10, 724 (2023)."
        ),
    },
}

KOPPEN_TIF_MEMBER = "1991_2020/koppen_geiger_0p1.tif"
KOPPEN_LEGEND_MEMBER = "legend.txt"

# 坐标保留小数位。3 位 ≈ 赤道 110 m，远细于 Natural Earth 1:50m 自身
# 约 0.5–2 km 的定位误差，因此这一步不是「简化几何」，只是去掉无意义的精度。
COORD_DECIMALS = 3

# 城市点位只保留这个 scalerank 以内的（数字越小越重要），避免世界视图里糊成一片。
PLACES_MAX_SCALERANK = 5

# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------


def log(msg: str) -> None:
    print(msg, flush=True)


def sha256_of(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def http_get(url: str, headers: dict[str, str] | None = None, timeout: int = 300) -> tuple[bytes, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": "clean-heating-simulator/build_map_data", **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers


def download_cached(url: str, dest: pathlib.Path) -> pathlib.Path:
    if dest.exists() and dest.stat().st_size > 0:
        log(f"  cached  {dest.name}  ({dest.stat().st_size:,} bytes)")
        return dest
    log(f"  fetching {url}")
    body, _ = http_get(url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    log(f"  saved   {dest.name}  ({len(body):,} bytes)")
    return dest


def write_json(path: pathlib.Path, payload: Any, *, indent: int | None = None) -> None:
    """UTF-8 无 BOM 写出。Windows 上必须显式指定，否则下游 Python/JS 读到 BOM。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=indent, separators=(",", ":") if indent is None else None)
    path.write_text(text + "\n", encoding="utf-8")
    log(f"  wrote   {path.name}  ({path.stat().st_size:,} bytes)")


# ---------------------------------------------------------------------------
# 远端 zip 的部分解压（只取需要的 member）
# ---------------------------------------------------------------------------


def remote_zip_index(url: str) -> dict[str, dict[str, int]]:
    """读远端 zip 的中央目录，返回 {member_name: {offset, csize, method}}。

    需要服务端支持 Range。figshare/S3 支持；若不支持会抛错，此时应改为整包下载。
    """

    def rng(start: int, end: int | None) -> bytes:
        spec = f"bytes={start}-" if end is None else f"bytes={start}-{end}"
        body, _ = http_get(url, {"Range": spec})
        return body

    _, headers = http_get(url, {"Range": "bytes=0-0"})
    content_range = headers.get("Content-Range")
    if not content_range:
        raise RuntimeError(
            "上游不支持 HTTP Range，无法只取单个 member。"
            "请改为整包下载 koppen_geiger_tif.zip（130 MB）后本地解压。"
        )
    size = int(content_range.split("/")[1])

    tail_len = min(256 * 1024, size)
    tail = rng(size - tail_len, size - 1)
    tail_base = size - tail_len

    i = tail.rfind(b"PK\x05\x06")
    if i < 0:
        raise RuntimeError("zip 中央目录结束记录（EOCD）未找到")
    _, cd_size, cd_off = struct.unpack_from("<H I I", tail, i + 10)
    if 0xFFFFFFFF in (cd_size, cd_off):
        raise RuntimeError("该 zip 使用 ZIP64，本脚本未实现 ZIP64 中央目录解析")

    cd = tail[cd_off - tail_base : cd_off - tail_base + cd_size] if cd_off >= tail_base else rng(cd_off, cd_off + cd_size - 1)

    index: dict[str, dict[str, int]] = {}
    p = 0
    while p < len(cd) and cd[p : p + 4] == b"PK\x01\x02":
        (method,) = struct.unpack_from("<H", cd, p + 10)
        (csize,) = struct.unpack_from("<I", cd, p + 20)
        nlen, elen, clen = struct.unpack_from("<H H H", cd, p + 28)
        (lho,) = struct.unpack_from("<I", cd, p + 42)
        name = cd[p + 46 : p + 46 + nlen].decode("utf-8", "replace")
        index[name] = {"offset": lho, "csize": csize, "method": method}
        p += 46 + nlen + elen + clen
    if not index:
        raise RuntimeError("zip 中央目录为空或解析失败")
    return index


def remote_zip_member(url: str, entry: dict[str, int]) -> bytes:
    head, _ = http_get(url, {"Range": f"bytes={entry['offset']}-{entry['offset'] + 29}"})
    if head[:4] != b"PK\x03\x04":
        raise RuntimeError("局部文件头签名不匹配，zip 结构与中央目录不一致")
    nlen, elen = struct.unpack_from("<H H", head, 26)
    data_off = entry["offset"] + 30 + nlen + elen
    raw, _ = http_get(url, {"Range": f"bytes={data_off}-{data_off + entry['csize'] - 1}"})
    if len(raw) != entry["csize"]:
        raise RuntimeError(f"取到 {len(raw)} 字节，中央目录声明 {entry['csize']}")
    if entry["method"] == 0:
        return raw
    if entry["method"] == 8:
        return zlib.decompressobj(-zlib.MAX_WBITS).decompress(raw)
    raise RuntimeError(f"不支持的压缩方法 {entry['method']}")


# ---------------------------------------------------------------------------
# Shapefile → GeoJSON
# ---------------------------------------------------------------------------


def open_shapefile(zip_path: pathlib.Path):
    import shapefile  # pyshp

    z = zipfile.ZipFile(zip_path)
    base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
    return shapefile.Reader(
        shp=io.BytesIO(z.read(base + ".shp")),
        dbf=io.BytesIO(z.read(base + ".dbf")),
        shx=io.BytesIO(z.read(base + ".shx")),
        encoding="utf-8",
        encodingErrors="replace",
    )


def field_index(reader) -> dict[str, int]:
    """字段名大小写在不同 NE 图层里不一致（admin0 全大写、admin1 全小写），统一成小写键。"""
    return {f[0].lower(): i for i, f in enumerate(reader.fields[1:])}


def ring_to_coords(points: Iterable[tuple[float, float]]) -> list[list[float]]:
    """取整精度并去掉相邻重复点。返回 [[lon, lat], ...]。"""
    out: list[list[float]] = []
    for x, y in points:
        c = [round(float(x), COORD_DECIMALS), round(float(y), COORD_DECIMALS)]
        if not out or out[-1] != c:
            out.append(c)
    # 闭合环在去重后可能丢掉收尾点，补回来
    if len(out) >= 3 and out[0] != out[-1]:
        out.append(list(out[0]))
    return out


def ring_signed_area(ring: list[list[float]]) -> float:
    """平面近似的有向面积。只用来分辨外环/内环（洞），不用于任何物理量。"""
    s = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def shape_to_geometry(shape) -> dict[str, Any] | None:
    """pyshp 的 polygon shape → GeoJSON Polygon / MultiPolygon。

    shapefile 不区分「多个外环」和「外环+洞」，只能靠环的绕向判断：
    ESRI 规范里外环顺时针（有向面积为负），内环逆时针。按出现顺序把内环
    归到最近的前一个外环上 —— 这是 shapefile 规范保证的排列方式。
    """
    parts = list(shape.parts) + [len(shape.points)]
    rings = [ring_to_coords(shape.points[parts[i] : parts[i + 1]]) for i in range(len(parts) - 1)]
    rings = [r for r in rings if len(r) >= 4]
    if not rings:
        return None

    polygons: list[list[list[list[float]]]] = []
    for ring in rings:
        if ring_signed_area(ring) < 0 or not polygons:
            polygons.append([ring])          # 外环，开一个新多边形
        else:
            polygons[-1].append(ring)        # 内环（洞），挂到当前多边形上
    if len(polygons) == 1:
        return {"type": "Polygon", "coordinates": polygons[0]}
    return {"type": "MultiPolygon", "coordinates": polygons}


def geometry_bbox(geom: dict[str, Any]) -> list[float]:
    xs: list[float] = []
    ys: list[float] = []
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poly in polys:
        for x, y in poly[0]:      # 外环即可界定 bbox
            xs.append(x)
            ys.append(y)
    return [min(xs), min(ys), max(xs), max(ys)]


def count_coords(geom: dict[str, Any]) -> int:
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return sum(len(ring) for poly in polys for ring in poly)


# ---------------------------------------------------------------------------
# 各产物
# ---------------------------------------------------------------------------


def load_label_overrides(out_dir: pathlib.Path) -> dict[str, dict[str, str]]:
    """读产品对国家/地区称谓的覆盖表。文件不存在或格式不对时返回空表。

    这个文件由产品负责人维护，本脚本只读不写。之所以要在生成 geojson 时就应用，
    是因为直接手改 admin0-boundaries.geojson 撑不过下一次构建 —— 那个文件每次
    都会被整体重写，手改的称谓会静默回退成上游的写法。
    """
    path = out_dir / "country-label-overrides.json"
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{path.name} 不是合法 JSON：{error}") from error
    overrides = payload.get("overrides") or {}
    if not isinstance(overrides, dict):
        raise RuntimeError(f"{path.name} 的 overrides 必须是对象")
    return overrides


def build_admin0(zip_path: pathlib.Path, out: pathlib.Path, overrides: dict[str, dict[str, str]]) -> dict[str, Any]:
    r = open_shapefile(zip_path)
    idx = field_index(r)
    records, shapes = r.records(), r.shapes()
    assert len(records) == len(shapes), "shapefile 记录数与几何数不一致"

    features: list[dict[str, Any]] = []
    fallback_used: list[dict[str, str]] = []
    applied_overrides: list[dict[str, Any]] = []

    for rec, shp in zip(records, shapes):
        def get(name: str) -> str:
            v = rec[idx[name]]
            return "" if v is None else str(v).strip()

        # NE 的 ISO_A3 对法国、挪威等国写成 -99（因为它把本土与海外领地拆开算）。
        # 不修正的话这些国家永远识别不出来。优先级：ISO_A3 → ISO_A3_EH → ADM0_A3。
        iso3 = get("iso_a3")
        source_field = "ISO_A3"
        if iso3 in ("", "-99"):
            iso3, source_field = get("iso_a3_eh"), "ISO_A3_EH"
        if iso3 in ("", "-99"):
            iso3, source_field = get("adm0_a3"), "ADM0_A3"
        if iso3 in ("", "-99"):
            raise RuntimeError(f"无法为要素 {get('admin')!r} 确定 ISO3 码")
        if source_field != "ISO_A3":
            fallback_used.append({"admin": get("admin"), "iso3": iso3, "from": source_field})

        geom = shape_to_geometry(shp)
        if geom is None:
            continue

        props = {
            "iso3": iso3,
            "iso3_source": source_field,
            "name_en": get("name_en") or get("name"),
            "name_zh": get("name_zh"),
            "type": get("type"),
            "sov_a3": get("sov_a3"),
        }
        # 应用产品口径。上游标注一并留在 upstream_* 里，审计时能看出改了什么。
        override = overrides.get(iso3)
        if override:
            for key in ("name_en", "name_zh", "type"):
                if key in override and override[key]:
                    props["upstream_" + key] = props[key]
                    props[key] = override[key]
            applied_overrides.append({"iso3": iso3, **{k: v for k, v in override.items()}})

        features.append(
            {
                "type": "Feature",
                "properties": props,
                "bbox": geometry_bbox(geom),
                "geometry": geom,
            }
        )

    seen: dict[str, int] = {}
    for f in features:
        seen[f["properties"]["iso3"]] = seen.get(f["properties"]["iso3"], 0) + 1
    dupes = {k: v for k, v in seen.items() if v > 1}

    write_json(out, {"type": "FeatureCollection", "features": features})
    total = sum(count_coords(f["geometry"]) for f in features)
    log(f"          {len(features)} 个国家/地区要素，{total:,} 个坐标")
    if fallback_used:
        log(f"          ISO3 回退：{len(fallback_used)} 个 → " + ", ".join(f"{d['admin']}={d['iso3']}({d['from']})" for d in fallback_used))
    if dupes:
        log(f"          注意：ISO3 重复 {dupes}（同一国家被拆成多个要素，识别时任一命中即可）")
    if applied_overrides:
        log(f"          已应用产品称谓覆盖 {len(applied_overrides)} 条：" +
            ", ".join(f"{o['iso3']}→{o.get('name_zh') or o.get('name_en')}" for o in applied_overrides))
    else:
        log("          未应用任何称谓覆盖（country-label-overrides.json 为空）")
    return {
        "features": len(features),
        "coords": total,
        "iso3_fallback": fallback_used,
        "duplicate_iso3": dupes,
        "applied_overrides": applied_overrides,
    }


def build_admin1_cn_us(zip_path: pathlib.Path, out: pathlib.Path) -> dict[str, Any]:
    r = open_shapefile(zip_path)
    idx = field_index(r)
    records, shapes = r.records(), r.shapes()

    features: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    for rec, shp in zip(records, shapes):
        def get(name: str) -> str:
            v = rec[idx[name]]
            return "" if v is None else str(v).strip()

        country = get("adm0_a3")
        if country not in ("CHN", "USA"):
            continue  # 规格 §G1：只加载中美两国的 Admin-1

        # admin1_code 取 ISO 3166-2 的后缀（"US-IL" → "IL"，"CN-HE" → "HE"）。
        #
        # **不要**改用 Natural Earth 的 `postal` 字段。它对中国省份与 ISO 3166-2 互相撞码：
        #     postal HE = 河南，而 ISO CN-HE = 河北
        #     postal HB = 河北，而 ISO CN-HB = 湖北
        #     postal HA = 海南，而 ISO CN-HA = 河南
        # 本项目的试点就在河北。用 postal 的话，产品负责人按 "HE" 填河北的气候数据，
        # 运行时会静默取到河南 —— 不报错、不警告，只是每个分数都错。
        # 美国那 51 个要素两种编码完全一致，所以既有的 "IL" 约定不受影响。
        #
        # 上游在 CHN 下还混了非省级行政区的要素（如西沙群岛），没有 iso_3166_2 码，
        # 也不存在「省会气候」这种东西。丢掉是对的，但必须记下来并上报 ——
        # 静默少一块地理范围，将来只会以「为什么这里识别不出省」的形式重新出现。
        iso_3166_2 = get("iso_3166_2")
        code = iso_3166_2.split("-")[-1] if "-" in iso_3166_2 else ""
        # Natural Earth 给没有真实 ISO 码的要素自造占位码，形如 `CN-X01~`，以 `~` 标记。
        # 这类要素不是省级行政区，也不存在「省会气候」，必须挡在外面 ——
        # 否则会凭空多出一个 admin1_code 让产品负责人无从填起。
        if not code or "~" in code:
            skipped.append(
                {
                    "country": country,
                    "name": get("name_en") or get("name"),
                    "type_en": get("type_en"),
                    "iso_3166_2": iso_3166_2 or "(空)",
                }
            )
            continue
        expected_prefix = "CN" if country == "CHN" else "US"
        assert iso_3166_2.startswith(expected_prefix + "-"), (
            f"{country} 的要素 {get('name')!r} 的 iso_3166_2={iso_3166_2!r} 前缀不是 {expected_prefix}-"
        )

        geom = shape_to_geometry(shp)
        if geom is None:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "country_iso3": country,
                    "admin1_code": code,
                    "iso_3166_2": iso_3166_2,
                    "ne_postal": get("postal"),  # 仅供追溯；与 admin1_code 不同，见上方注释
                    "name_en": get("name_en") or get("name"),
                    "name_zh": get("name_zh"),
                    "type_en": get("type_en"),
                },
                "bbox": geometry_bbox(geom),
                "geometry": geom,
            }
        )

    # admin1_code 必须在国内唯一，否则 resolveClimate 会查错行
    per_country: dict[str, list[str]] = {"CHN": [], "USA": []}
    for f in features:
        per_country[f["properties"]["country_iso3"]].append(f["properties"]["admin1_code"])
    for country, codes in per_country.items():
        dup = {c for c in codes if codes.count(c) > 1}
        if dup:
            raise RuntimeError(f"{country} 的 admin1_code 有重复：{sorted(dup)}")

    # admin1_code 是接产品负责人气候数据的 join key。绑错省不会报错，只会让每个分数
    # 都基于错的气候 —— 所以在这里钉死几条已知绑定，上游换版本时立刻炸给我们看。
    by_code = {(f["properties"]["country_iso3"], f["properties"]["admin1_code"]): f["properties"] for f in features}
    for country, code, expect_zh in (
        ("CHN", "HE", "河北省"),      # 项目试点所在地；NE 的 postal 里 HE 是河南
        ("CHN", "HA", "河南省"),
        ("CHN", "HB", "湖北省"),
        ("CHN", "HI", "海南省"),
        ("CHN", "SN", "陕西省"),
        ("USA", "IL", None),          # 既有 fixture / 骨架示例用的就是它
    ):
        props = by_code.get((country, code))
        assert props is not None, f"{country} 缺少 admin1_code={code!r}"
        if expect_zh is not None:
            assert props["name_zh"] == expect_zh, (
                f"{country}/{code} 绑到了 {props['name_zh']!r}，预期 {expect_zh!r} —— "
                f"上游编码含义变了，不要放行"
            )

    # 记下 NE postal 与 ISO 3166-2 不一致的那几个，写进 SOURCES.md 供人工复核
    collisions = [
        {
            "admin1_code": f["properties"]["admin1_code"],
            "ne_postal": f["properties"]["ne_postal"],
            "name_en": f["properties"]["name_en"],
            "name_zh": f["properties"]["name_zh"],
        }
        for f in features
        if f["properties"]["ne_postal"] and f["properties"]["ne_postal"] != f["properties"]["admin1_code"]
    ]

    write_json(out, {"type": "FeatureCollection", "features": features})
    total = sum(count_coords(f["geometry"]) for f in features)
    log(f"          CHN {len(per_country['CHN'])} 个 · USA {len(per_country['USA'])} 个，{total:,} 个坐标")
    if skipped:
        log(
            "          跳过（无有效 ISO 3166-2 码，非省级行政区）："
            + ", ".join(f"{s['country']}/{s['name']}[{s['iso_3166_2']}]" for s in skipped)
        )
    if collisions:
        log(f"          NE postal 与 ISO 3166-2 不一致：{len(collisions)} 个（已采用 ISO，见 SOURCES.md）")
    return {
        "features": len(features),
        "coords": total,
        "chn": sorted(per_country["CHN"]),
        "usa": sorted(per_country["USA"]),
        "skipped": skipped,
        "postal_collisions": collisions,
    }


def build_places(zip_path: pathlib.Path, out: pathlib.Path) -> dict[str, Any]:
    r = open_shapefile(zip_path)
    idx = field_index(r)
    features: list[dict[str, Any]] = []
    for rec, shp in zip(r.records(), r.shapes()):
        def get(name: str) -> Any:
            return rec[idx[name]] if name in idx else None

        rank = get("scalerank")
        try:
            rank_i = int(rank)
        except (TypeError, ValueError):
            continue
        if rank_i > PLACES_MAX_SCALERANK:
            continue
        if not shp.points:
            continue
        x, y = shp.points[0]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "name_en": str(get("name_en") or get("name") or "").strip(),
                    "name_zh": str(get("name_zh") or "").strip(),
                    "iso3": str(get("adm0_a3") or "").strip(),
                    "adm1_name": str(get("adm1name") or "").strip(),
                    "scalerank": rank_i,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(x), COORD_DECIMALS), round(float(y), COORD_DECIMALS)],
                },
            }
        )
    write_json(out, {"type": "FeatureCollection", "features": features})
    log(f"          {len(features)} 个城市点（scalerank ≤ {PLACES_MAX_SCALERANK}）")
    return {"features": len(features)}


def parse_koppen_legend(text: str) -> list[dict[str, str]]:
    """legend.txt 每行形如 `    14: Cfa  Temperate, no dry season, hot summer  [200 255 80]`。"""
    entries: list[dict[str, str]] = []
    for line in text.splitlines():
        s = line.strip()
        if not s or ":" not in s:
            continue
        head, _, rest = s.partition(":")
        if not head.strip().isdigit():
            continue
        rest = rest.strip()
        if "[" in rest:
            rest = rest[: rest.index("[")].strip()
        parts = rest.split(None, 1)
        if len(parts) != 2:
            continue
        entries.append({"index": head.strip(), "code": parts[0].strip(), "description_en": parts[1].strip()})
    if len(entries) != 30:
        raise RuntimeError(f"legend.txt 解析出 {len(entries)} 条，预期 30 条 Köppen 细分类")
    return entries


def build_koppen(cache: pathlib.Path, out_dir: pathlib.Path) -> dict[str, Any]:
    import numpy as np
    import tifffile
    from PIL import Image

    src = SOURCES["koppen"]
    tif_path = cache / "koppen_1991_2020_0p1.tif"
    legend_path = cache / "koppen_legend.txt"

    if not (tif_path.exists() and legend_path.exists()):
        log("  reading remote zip central directory (range requests, no full download)")
        index = remote_zip_index(src["url"])
        for member, dest in ((KOPPEN_TIF_MEMBER, tif_path), (KOPPEN_LEGEND_MEMBER, legend_path)):
            if member not in index:
                raise RuntimeError(f"上游 zip 里没有 {member}；可用条目示例：{list(index)[:5]}")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(remote_zip_member(src["url"], index[member]))
            log(f"  extracted {member} → {dest.name} ({dest.stat().st_size:,} bytes)")
    else:
        log(f"  cached  {tif_path.name} / {legend_path.name}")

    legend_text = legend_path.read_text(encoding="utf-8", errors="replace")
    classes = parse_koppen_legend(legend_text)

    with tifffile.TiffFile(tif_path) as tf:
        page = tf.pages[0]
        scale = page.tags["ModelPixelScaleTag"].value
        tiepoint = page.tags["ModelTiepointTag"].value
        grid = page.asarray()

    # 断言几何前提。这些数字决定了浏览器里经纬度→像素的换算；
    # 上游哪天换了范围或分辨率而这里没同步，必须炸掉而不是静默算错。
    assert grid.ndim == 2, f"预期单波段栅格，实际 shape={grid.shape}"
    assert grid.dtype == np.uint8, f"预期 uint8，实际 {grid.dtype}"
    height, width = grid.shape
    assert (width, height) == (3600, 1800), f"预期 3600x1800，实际 {width}x{height}"
    assert abs(scale[0] - 0.1) < 1e-9 and abs(scale[1] - 0.1) < 1e-9, f"预期 0.1° 步长，实际 {scale}"
    assert abs(tiepoint[3] + 180.0) < 1e-9 and abs(tiepoint[4] - 90.0) < 1e-9, (
        f"预期左上角 (-180, 90)，实际 ({tiepoint[3]}, {tiepoint[4]})"
    )
    vmax = int(grid.max())
    assert vmax <= len(classes), f"栅格最大值 {vmax} 超出 legend 的 {len(classes)} 个分类"

    png_path = out_dir / "koppen-1991-2020.png"
    # 8 位灰度、无 gAMA / iCCP / sRGB 辅助块。浏览器对无色彩配置的 PNG 不做
    # 色彩管理转换，getImageData 拿到的 R 通道就是原始分类索引。
    # 一旦写进色彩配置，像素值会被悄悄改掉，而且不会报错 —— 这正是要防的失效模式。
    img = Image.fromarray(grid, mode="L")
    img.save(png_path, format="PNG", optimize=True, compress_level=9)

    with png_path.open("rb") as f:
        assert f.read(8) == b"\x89PNG\r\n\x1a\n", "写出的不是合法 PNG"
    blob = png_path.read_bytes()
    for chunk in (b"gAMA", b"iCCP", b"sRGB", b"cHRM"):
        if chunk in blob:
            raise RuntimeError(f"PNG 里出现了色彩配置块 {chunk!r}，浏览器可能改写像素值")

    # 回读验证：写出的 PNG 必须逐像素等于原栅格。
    back = np.array(Image.open(png_path))
    assert back.shape == grid.shape and back.dtype == grid.dtype, "PNG 回读的形状/类型不一致"
    assert np.array_equal(back, grid), "PNG 回读与原栅格不一致"

    # 自检探针：浏览器侧加载后逐条核对。若色彩管理或缩放动了像素，这里会立刻炸，
    # 而不是悄悄给用户一个错的气候区。取点都在大片同质区域内部，避免边界抖动。
    probes_lonlat = [
        ("Sahara", 25.0, 25.0),
        ("Amazon", -60.0, -3.0),
        ("Siberia", 100.0, 65.0),
        ("Greenland interior", -40.0, 72.0),
        ("Australian interior", 132.0, -25.0),
        ("North China Plain", 116.0, 37.0),
        ("US Midwest", -93.0, 42.0),
        ("Western Europe", 4.0, 50.0),
    ]
    probes = []
    for label, lon, lat in probes_lonlat:
        px = int((lon + 180.0) / 0.1)
        py = int((90.0 - lat) / 0.1)
        value = int(grid[py, px])
        probes.append({"label": label, "lon": lon, "lat": lat, "x": px, "y": py, "expected_index": value})

    legend_out = {
        "_note": (
            "像素值即分类索引；0 = 无数据（海洋等）。经纬度→像素为线性映射，见 grid。"
            "self_check 由浏览器在加载后逐条核对，用于捕捉色彩管理改写像素值这类静默错误。"
        ),
        "source": {
            "name": src["name"],
            "home": src["home"],
            "license": src["license"],
            "citation": src["citation"],
            "member": KOPPEN_TIF_MEMBER,
        },
        "grid": {
            "width": width,
            "height": height,
            "lon_min": -180.0,
            "lat_max": 90.0,
            "cell_size_deg": 0.1,
            "crs": "EPSG:4326",
            "nodata_index": 0,
        },
        "resolution_note_en": (
            "0.1 degree (~11 km at the equator). Koppen zones are broad regions, but this grid "
            "will misclassify points near coastlines and in mountainous terrain. It identifies "
            "which standard climate-zone profile applies; it is not a point measurement."
        ),
        "resolution_note_zh": (
            "0.1 度（赤道约 11 km）。Köppen 分区本身是大范围的，但这个网格在海岸线和山区会错分类。"
            "它只用于判断该用哪个标准气候区 profile，不是对该点的实测。"
        ),
        "classes": [
            {"index": int(c["index"]), "code": c["code"], "description_en": c["description_en"]}
            for c in classes
        ],
        "self_check": probes,
    }
    write_json(out_dir / "koppen-legend.json", legend_out, indent=2)

    log(f"          栅格 {width}x{height}，PNG {png_path.stat().st_size:,} bytes，回读逐像素一致")
    return {
        "png_bytes": png_path.stat().st_size,
        "width": width,
        "height": height,
        "classes": len(classes),
        "nonzero_pct": round(float((grid > 0).mean()) * 100, 2),
    }


def build_label_overrides(out: pathlib.Path) -> None:
    """国家显示名覆盖表。默认空 —— 默认行为就是照搬 Natural Earth。

    存在的理由：Natural Earth 对台湾、香港、澳门等要素的切分方式与中文标签是它自己的
    编辑立场，不是 CS 能替产品定的。把它做成一个数据文件，产品负责人改一个 JSON 就能
    调整，不必改代码、不必重跑本脚本。
    """
    if out.exists():
        log(f"  keep    {out.name}（已存在，不覆盖产品负责人的编辑）")
        return
    write_json(
        out,
        {
            "_status": "EMPTY_BY_DEFAULT",
            "_owner": "Guo Hang（产品负责人）",
            "_note": (
                "国家/地区显示名覆盖。键为 admin0-boundaries.geojson 里的 iso3，"
                "值为 {name_en, name_zh}。留空表示照用 Natural Earth 的标注。"
                "这里是产品对边界与称谓的立场所在，属产品决策，不由 CS 决定，"
                "也不会被 scripts/build_map_data.py 覆盖。详见 docs/HANDOFF.md。"
            ),
            "overrides": {},
        },
        indent=2,
    )


def write_sources_md(out: pathlib.Path, cache: pathlib.Path, stats: dict[str, Any]) -> None:
    a0, a1, kp = stats["admin0"], stats["admin1"], stats["koppen"]

    def digest(name: str) -> str:
        p = cache / name
        return sha256_of(p) if p.exists() else "(not cached)"

    lines = [
        "# G1 地图数据来源",
        "",
        "本目录下的文件全部由 `scripts/build_map_data.py` 从下列上游生成，不要手工编辑。",
        "重跑：",
        "",
        "```",
        "uv run --no-project --with pyshp --with numpy --with pillow --with tifffile \\",
        "    --with imagecodecs python scripts/build_map_data.py",
        "```",
        "",
        "例外：`country-label-overrides.json` 由产品负责人维护，脚本不会覆盖它。",
        "",
        "## 上游",
        "",
        "| 产物 | 上游 | 许可 | 输入 SHA256 |",
        "|---|---|---|---|",
    ]
    for key, cached in (
        ("admin0", "ne_50m_admin_0_countries.zip"),
        ("admin1", "ne_10m_admin_1_states_provinces.zip"),
        ("places", "ne_50m_populated_places.zip"),
    ):
        s = SOURCES[key]
        lines.append(f"| `{key}` | [{s['name']}]({s['url']}) | {s['license']} | `{digest(cached)}` |")
    s = SOURCES["koppen"]
    lines += [
        f"| `koppen` | [{s['name']}]({s['home']}) · member `{KOPPEN_TIF_MEMBER}` | {s['license']} | `{digest('koppen_1991_2020_0p1.tif')}` |",
        "",
        "Köppen 数据引用要求：",
        "",
        f"> {s['citation']}",
        "",
        "## 处理步骤",
        "",
        f"1. **坐标精度**：所有坐标保留 {COORD_DECIMALS} 位小数（赤道约 110 m），并去掉相邻重复点。",
        "   这不是几何简化 —— Natural Earth 1:50m 自身的定位误差约 0.5–2 km，远大于这个量级。",
        "   未做任何 Douglas–Peucker 之类的拓扑简化，因为点在国界附近的归属会直接影响能源价格取值。",
        "2. **ISO3 修正**：Natural Earth 的 `ISO_A3` 对部分国家写作 `-99`。",
        f"   按 `ISO_A3` → `ISO_A3_EH` → `ADM0_A3` 依次回退，本次共修正 {len(a0['iso3_fallback'])} 个要素：",
    ]
    for d in a0["iso3_fallback"]:
        lines.append(f"   - {d['admin']} → `{d['iso3']}`（取自 `{d['from']}`）")
    lines += [
        "3. **Admin-1 只取中美**：规格 §G1 明令其余国家不识别省/州。",
        f"   本次得到 CHN {len(a1['chn'])} 个、USA {len(a1['usa'])} 个。",
        "",
        "   **`admin1_code` 取 ISO 3166-2 的后缀，不是 Natural Earth 的 `postal` 字段。**",
        "   这两套编码对中国省份互相撞码，用错会静默绑到另一个省：",
        "",
        "   | ISO 3166-2 后缀（本产物采用） | 是哪个省 | 而 NE `postal` 里同样的字母是 |",
        "   |---|---|---|",
        "   | `HE` | 河北省（本项目试点所在地） | 河南 |",
        "   | `HA` | 河南省 | 海南 |",
        "   | `HB` | 湖北省 | 河北 |",
        "",
        "   全部不一致的条目：",
        "",
        "   | `admin1_code`（ISO） | NE `postal` | 名称 |",
        "   |---|---|---|",
    ]
    for c in a1["postal_collisions"]:
        lines.append(f"   | `{c['admin1_code']}` | `{c['ne_postal']}` | {c['name_en']} / {c['name_zh']} |")
    lines += [
        "",
        "   美国 51 个要素两种编码完全一致，因此 `docs/data/climate/*` 骨架与",
        "   `docs/tests/global/fixtures/` 里既有的 `\"IL\"` 约定不受影响。",
        "   `build_map_data.py` 里对 `HE→河北`、`HA→河南` 等绑定写了硬断言，上游改编码会直接构建失败。",
    ]
    if a1["skipped"]:
        lines.append("")
        lines.append("   上游在这两国下还混了没有有效 ISO 3166-2 码的非省级要素，已跳过（在其范围内点击只识别到国家）：")
        for s in a1["skipped"]:
            lines.append(
                f"   - {s['country']} / {s['name']}（上游 `iso_3166_2` = `{s['iso_3166_2']}`，"
                f"{s['type_en'] or '类型未标注'}）"
            )
    lines += [
        f"4. **城市点位**：只保留 `scalerank ≤ {PLACES_MAX_SCALERANK}` 的点，仅作定位辅助，不参与任何气候取值。",
        f"5. **Köppen 栅格**：取上游 zip 中的 `{KOPPEN_TIF_MEMBER}`（作者自己发布的 0.1° 产品，",
        "   不是我们自行重采样 1 km 版本得到的）。转成 8 位灰度 PNG，像素值即分类索引，",
        "   并显式校验输出里不含 `gAMA` / `iCCP` / `sRGB` / `cHRM` 块 —— 带色彩配置的 PNG 会被浏览器",
        "   做色彩管理转换，像素值被悄悄改掉且不报错。写出后逐像素回读比对。",
        "",
        "## 已知精度边界",
        "",
        f"- Köppen 网格 0.1°（赤道约 11 km），有效陆地占 {kp['nonzero_pct']}%。",
        "  海岸线和山区会错分类。它回答的是「该用哪个标准气候区 profile」，不是该点的实测气候。",
        "- Natural Earth 1:50m 国界为小比例尺产品，紧贴国界的点可能归错国家。",
        "- 中美省/州界用 1:10m，精度高于国界层。",
        "",
        "## 边界与称谓",
        "",
        "Natural Earth 对争议地区的切分与标注是它自己的编辑立场。具体到本产品：",
        "",
    ]
    for note in stats["boundary_notes"]:
        lines.append(f"- {note}")
    lines += [
        "",
        "这些属产品决策，不由 CS 决定。改动方式是编辑 `country-label-overrides.json`（显示名）",
        "或更换上游边界源（切分方式），两者都不需要改识别代码。详见 `docs/HANDOFF.md`。",
        "",
    ]
    out.write_text("\n".join(lines), encoding="utf-8")
    log(f"  wrote   {out.name}  ({out.stat().st_size:,} bytes)")


# ---------------------------------------------------------------------------


def main() -> int:
    repo = pathlib.Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache", type=pathlib.Path, default=repo / ".tools" / "mapdata-cache")
    ap.add_argument("--out", type=pathlib.Path, default=repo / "docs" / "data" / "maps")
    args = ap.parse_args()

    cache: pathlib.Path = args.cache
    out: pathlib.Path = args.out
    cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)

    stats: dict[str, Any] = {}

    log("[1/5] Natural Earth Admin 0")
    z0 = download_cached(SOURCES["admin0"]["url"], cache / "ne_50m_admin_0_countries.zip")
    # 先读产品口径的称谓覆盖，生成 geojson 时就应用进去。
    # 手改 geojson 是撑不住的 —— 它每次构建都会被整体重写。
    overrides = load_label_overrides(out)
    stats["admin0"] = build_admin0(z0, out / "admin0-boundaries.geojson", overrides)

    log("[2/5] Natural Earth Admin 1 (CHN + USA only)")
    z1 = download_cached(SOURCES["admin1"]["url"], cache / "ne_10m_admin_1_states_provinces.zip")
    stats["admin1"] = build_admin1_cn_us(z1, out / "admin1-cn-us.geojson")

    log("[3/5] Natural Earth Populated Places")
    z2 = download_cached(SOURCES["places"]["url"], cache / "ne_50m_populated_places.zip")
    stats["places"] = build_places(z2, out / "populated-places.geojson")

    log("[4/5] Köppen-Geiger 1991–2020 @ 0.1°")
    stats["koppen"] = build_koppen(cache, out)

    log("[5/5] 元数据")
    build_label_overrides(out / "country-label-overrides.json")

    # 把「边界怎么切的」这件事变成脚本产出的事实，而不是某个人的记忆
    a0_features = json.loads((out / "admin0-boundaries.geojson").read_text(encoding="utf-8"))["features"]
    by_iso = {f["properties"]["iso3"]: f["properties"] for f in a0_features}
    notes: list[str] = []
    for iso in ("TWN", "HKG", "MAC"):
        if iso in by_iso:
            p = by_iso[iso]
            upstream_zh = p.get("upstream_name_zh")
            label = f"显示为 {p['name_zh']!r}"
            if upstream_zh:
                label += f"（已覆盖上游的 {upstream_zh!r}）"
            notes.append(
                f"`{iso}` 在上游是**独立的 admin0 要素**（sov_a3 `{p['sov_a3']}`），本产物中{label}。"
                f"注意这只改了称谓，没有改几何切分：在该地点击仍得到 `country_iso3 = {iso}`，"
                f"**不会**进入中美 Admin-1 分支，会落到 Köppen 标准 profile。"
            )
    if stats["admin0"]["duplicate_iso3"]:
        notes.append(f"以下 ISO3 对应多个要素：{stats['admin0']['duplicate_iso3']}（识别时任一命中即可）。")
    for s in stats["admin1"]["skipped"]:
        notes.append(
            f"上游把 {s['name']!r} 列为 `{s['country']}` 的 Admin-1 要素，但只给了自造占位码 "
            f"`{s['iso_3166_2']}`（非真实 ISO 3166-2），已跳过；在其范围内点击只会识别到国家。"
        )
    stats["boundary_notes"] = notes

    write_sources_md(out / "SOURCES.md", cache, stats)

    log("\n完成。产物：")
    for p in sorted(out.iterdir()):
        log(f"  {p.stat().st_size:>10,}  {p.name}")
    log("\n边界与称谓（需产品负责人裁定，已写入 SOURCES.md）：")
    for n in notes:
        log(f"  - {n}")
    log(f"\n中国 Admin-1（{len(stats['admin1']['chn'])}）：{' '.join(stats['admin1']['chn'])}")
    log(f"美国 Admin-1（{len(stats['admin1']['usa'])}）：{' '.join(stats['admin1']['usa'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
