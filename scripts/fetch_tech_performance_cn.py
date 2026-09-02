# -*- coding: utf-8 -*-
"""中国设备性能：能效标识备案库 → technology_performance.json 的 CHN 条目。

数据链路（全部官方、可复核）：
  1. universe = 中国标准化研究院《关于集中提供支撑"两新"工作的节能家电能效标识
     备案信息的公告》2024-12 版官方备案包（空调 GB 21455-2019 12,031 条、
     燃气采暖热水炉 GB 20665-2015 22,377 条，2020.04/2016.08–2024.12）。
  2. scripts/crawl_energylabel.py 对每个备案号从能效标识网备案库公开接口
     （www.energylabel.com.cn）拉取详情数值（APF/额定量/季节耗电量/供暖热效率）。
  3. 本脚本做指标语义映射 + 分布聚合（P25/P50/P75），合并进
     docs/data/scoring/technology_performance.json（只动 pipeline=cn_energylabel 的点）。

指标语义映射（CS-DECISIONS D11，是"拆算"不是发明数值）：
  空调（GB 21455-2019 全年能源消耗效率 APF 拆成制冷/制热两个季节效率）：
    - 备案数据自洽关系：APF×(制冷季节耗电量+制热季节耗电量) ≈ 额定制冷量×K_total，
      全部机型子类（含定频）的 K_total 中位都钉在 ~955 负荷小时——
      标准的「制冷:制热负荷比」是全类目普适常数。
    - 制冷季节负荷常数 Kc 由单冷机直接解出（其备案给出
      制冷季节能源消耗效率 SEER = CSTL/CSEC 与 CSEC、额定制冷量）：
      Kc = SEER×CSEC/额定制冷量，取核心中位数（IQR 0.5%）。
    - **固定份额拆算**：制冷份额 = Kc/K_ref（K_ref = 全体热泵 K_total 中位）；
      每台热泵 制冷效率 = 份额×APF×ΣE/CSEC、制热效率 = (1−份额)×APF×ΣE/HSEC。
      铭牌容量不进拆分——铭牌与实测的散差（定频可达 ±10%）不污染结果；
      带内机与逐台锚定法结果一致，带外合法机不被误杀。
    - 单冷机（SEER 直接值）只入制冷分布；单暖机（制热季节能源消耗效率直接值，
      备案字段为「名义制热量」）只入制热分布——整类机型静默漏掉会造成分布偏倚。
    - 哨兵：每台机 K_total 必须落在 [940, 970]，聚合中位数必须过物理量程，
      1 级中位 APF > 2 级中位 APF。
  壁挂炉（GB 20665-2015 两点热效率 → 季节效率）：
    - 备案给出 额定热负荷供暖热效率 η1 与 30%额定热负荷供暖热效率 η2（低位热值基，
      与 curated_cn_residential_gas.json 的 LHV 换算口径自洽）。
    - 季节效率 ηs = 0.85×η2 + 0.15×η1（部分负荷主导季节运行；权重借用
      EU Regulation 813/2013 的 ηson 结构并在 aggregation_method 里写明敏感性：
      与算术平均差约 ±1.5 个百分点）。

用法：
  python fetch_tech_performance_cn.py --crawl-dir <爬取输出目录>   # 从原始详情聚合并更新缓存
  python fetch_tech_performance_cn.py                              # 从提交的缓存聚合（免重爬）
"""
from __future__ import annotations

import argparse
import datetime as _dt
import gzip
import json
import pathlib
import re
import statistics
import sys
from typing import Any

sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

REPO = pathlib.Path(__file__).resolve().parent.parent
CACHE = REPO / "scripts" / "cache_cn_energylabel_extract.jsonl.gz"
TARGET = REPO / "docs" / "data" / "scoring" / "technology_performance.json"

PIPELINE_MARK = "cn_energylabel"
UNIVERSE_URL = "https://www.cnis.ac.cn/tzgg/202412/t20241231_59316.html"
API_NOTE = "www.energylabel.com.cn 备案库公开接口 productRegistrationList/productDetailById"

# ---- 哨兵量程（量纲：无量纲季节效率）----
K_TOTAL_GARBAGE = (800.0, 1200.0)   # 每台热泵 APF·ΣE/CC；出这个带=容量/耗电量级录入错误
K_REF_RANGE = (940.0, 970.0)        # 全体热泵 K_total 的中位数必须落在这里（普适锚定常数）
KC_IQR_MAX = 0.02                   # 单冷机 Kc 的 P25–P75 相对散布上限（核心一致性；
                                    # 全距会被窗式/移动式等不同负荷线的少数子类尾部撑大）
COOL_SHARE_RANGE = (0.60, 0.70)     # 制冷份额 Kc/K_ref 的合理带
HEAT_EFF_UNIT = (1.0, 8.0)          # 单台制热季节效率
COOL_EFF_UNIT = (2.0, 10.0)
HEAT_EFF_MEDIAN = (2.5, 4.5)        # 聚合中位数
COOL_EFF_MEDIAN = (4.0, 8.0)
BOILER_ETA_UNIT = (0.80, 1.12)      # 低位热值基，冷凝炉可 >1
BOILER_ETA_MEDIAN = (0.84, 1.05)
EXCLUDE_FRACTION_MAX = 0.05         # 解析/哨兵剔除占比上限（干跑实测垃圾尾 ~2.7%——
                                    # 容量/耗电量单位级录入错误；超 5% 才说明假设错了）

CC_RANGE_W = (500.0, 30000.0)


def log(msg: str) -> None:
    print(msg, flush=True)


def _num(s: str | None) -> float | None:
    """取字段里第一个数值；备案库偶见 '3500(900-4300)'、全角、带单位。"""
    if not s:
        return None
    s = s.replace("，", ",").replace("（", "(").strip()
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else None


def field(fields: dict[str, str], *prefixes: str) -> float | None:
    for name, val in fields.items():
        for p in prefixes:
            if name.startswith(p):
                return _num(val)
    return None


# ---------------- 原始详情 → 紧凑抽取 ----------------

def build_extract(crawl_dir: pathlib.Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for cat, fname in (("ac", "details_ac.jsonl"), ("boiler", "details_boiler.jsonl")):
        p = crawl_dir / fname
        if not p.exists():
            raise SystemExit(f"缺 {p}——先跑 crawl_energylabel.py")
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                d = json.loads(line)
                f = d["fields"]
                rows.append({
                    "cat": cat,
                    "reg": d["registrationNumber"],
                    "model": d.get("model_api") or d["model_xlsx"],
                    "producer": d.get("producer"),
                    "grade": d.get("grade_api") or d.get("grade_xlsx"),
                    "std": d.get("standard"),
                    "apf": field(f, "全年能源消耗效率"),
                    "seer": field(f, "制冷季节能源消耗效率"),   # 单冷机直接给
                    "hspf": field(f, "制热季节能源消耗效率"),   # 单暖机直接给
                    "cc_w": field(f, "额定制冷量"),
                    "hc_w": field(f, "额定制热量", "名义制热量"),
                    "csec": field(f, "制冷季节耗电量"),
                    "hsec": field(f, "制热季节耗电量"),
                    "load_kw": field(f, "额定供暖热负荷"),
                    "eta1": field(f, "额定热负荷供暖热效率"),
                    "eta2": field(f, "30%额定热负荷供暖热效率"),
                })
    with gzip.open(CACHE, "wt", encoding="utf-8") as gz:
        for r in rows:
            gz.write(json.dumps(r, ensure_ascii=False) + "\n")
    log(f"  紧凑抽取 → {CACHE.name}（{len(rows)} 行，{CACHE.stat().st_size:,} B）")
    return rows


def load_extract() -> list[dict[str, Any]]:
    with gzip.open(CACHE, "rt", encoding="utf-8") as gz:
        return [json.loads(line) for line in gz]


# ---------------- 聚合 ----------------

def pctl(sorted_vals: list[float], q: float) -> float:
    """与 fetch_tech_performance.py 同法：最近邻分位。"""
    n = len(sorted_vals)
    idx = min(n - 1, max(0, round(q * (n - 1))))
    return sorted_vals[idx]


def aggregate_ac(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """三类机型（干跑实测的真实构成）：
    热泵（APF+双季耗电，~92%）→ Kc 拆算出两季效率；
    单冷机（直接给 制冷季节能源消耗效率，~1.3%）→ SEER 直接进制冷分布，并用于解 Kc；
    单暖机（直接给 制热季节能源消耗效率 + 名义制热量，~6%）→ HSPF 直接进制热分布。
    整类机型被静默漏掉会造成分布偏倚，所以分类兜底 dropped 有计数与占比哨兵。"""
    ac = [r for r in rows if r["cat"] == "ac"]
    singles, heat_singles, hps, dropped = [], [], [], []
    for r in ac:
        if r["apf"] and r["csec"] and r["hsec"]:
            cc = r["cc_w"]
            if cc is None or not (CC_RANGE_W[0] <= cc <= CC_RANGE_W[1]):
                dropped.append(("cc", r["reg"]))
                continue
            hps.append(r)
        elif r["seer"] and r["csec"] and r["cc_w"]:
            singles.append(r)
        elif r["hspf"] and r["hsec"]:
            heat_singles.append(r)
        else:
            dropped.append(("fields", r["reg"]))

    # 1) 单冷机解 Kc
    kcs = sorted(r["seer"] * r["csec"] / (r["cc_w"] / 1000.0) for r in singles)
    if len(kcs) < 30:
        raise SystemExit(f"单冷机只有 {len(kcs)} 台，Kc 解不稳——检查字段解析")
    kc = statistics.median(kcs)
    spread = (pctl(kcs, 0.75) - pctl(kcs, 0.25)) / kc
    log(f"  Kc = {kc:.1f} 负荷小时（单冷机 n={len(kcs)}，IQR 散布 {spread:.2%}）")
    if spread > KC_IQR_MAX:
        raise SystemExit(f"Kc IQR 散布 {spread:.2%} > {KC_IQR_MAX:.0%}——'常数'假设不成立，停")

    # 2) 每台热泵拆算 + 单冷/单暖机的直接值并入
    heat, cool, k_totals = [], [], []
    excluded = 0
    by_grade: dict[str, list[float]] = {}
    for r in singles:
        if COOL_EFF_UNIT[0] <= r["seer"] <= COOL_EFF_UNIT[1]:
            cool.append(r["seer"])   # 单冷机 SEER 本身就是制冷季节效率
        else:
            excluded += 1
    for r in heat_singles:
        if HEAT_EFF_UNIT[0] <= r["hspf"] <= HEAT_EFF_UNIT[1]:
            heat.append(r["hspf"])   # 单暖机 HSPF 本身就是制热季节效率
        else:
            excluded += 1
    n_direct_heat = len(heat)
    n_direct_cool = len(cool)
    # 固定份额拆算：全部子类（含定频）的 K_total 中位数都钉在 ~954.6，
    # 说明「制冷:制热负荷比」是全类目普适常数；逐台用铭牌容量锚定反而会把
    # 铭牌与实测的散差（定频可达 ±10%）漏进拆分。先过一遍垃圾带拿 K_ref：
    k_pre = sorted(
        r["apf"] * (r["csec"] + r["hsec"]) / (r["cc_w"] / 1000.0)
        for r in hps
        if K_TOTAL_GARBAGE[0] <= r["apf"] * (r["csec"] + r["hsec"]) / (r["cc_w"] / 1000.0) <= K_TOTAL_GARBAGE[1]
    )
    k_ref = statistics.median(k_pre)
    if not (K_REF_RANGE[0] <= k_ref <= K_REF_RANGE[1]):
        raise SystemExit(f"K_ref = {k_ref:.1f} 出 {K_REF_RANGE}——锚定常数漂了，停")
    cool_share = kc / k_ref
    if not (COOL_SHARE_RANGE[0] <= cool_share <= COOL_SHARE_RANGE[1]):
        raise SystemExit(f"制冷份额 {cool_share:.4f} 出 {COOL_SHARE_RANGE}——Kc 或 K_ref 有一个错了，停")
    log(f"  K_ref = {k_ref:.1f}，制冷份额 = {cool_share:.4f}（铭牌容量不进拆分）")
    for r in hps:
        total_load = r["apf"] * (r["csec"] + r["hsec"])
        k_total = total_load / (r["cc_w"] / 1000.0)
        if not (K_TOTAL_GARBAGE[0] <= k_total <= K_TOTAL_GARBAGE[1]):
            excluded += 1
            continue
        ce = cool_share * total_load / r["csec"]
        he = (1.0 - cool_share) * total_load / r["hsec"]
        if not (HEAT_EFF_UNIT[0] <= he <= HEAT_EFF_UNIT[1] and COOL_EFF_UNIT[0] <= ce <= COOL_EFF_UNIT[1]):
            excluded += 1
            continue
        heat.append(he)
        cool.append(ce)
        k_totals.append(k_total)
        by_grade.setdefault(str(r["grade"]), []).append(r["apf"])

    universe = len(hps) + len(singles) + len(heat_singles)
    frac = (excluded + len(dropped)) / max(1, universe)
    log(f"  热泵 {len(hps)} + 单冷 {len(singles)} + 单暖 {len(heat_singles)}；"
        f"制热分布 n={len(heat)}（其中直接值 {n_direct_heat}），制冷分布 n={len(cool)}（直接值 {n_direct_cool}）；"
        f"剔除 {excluded} + 分类失败 {len(dropped)}（合计 {frac:.2%}）")
    if frac > EXCLUDE_FRACTION_MAX:
        raise SystemExit(f"剔除率 {frac:.2%} 超上限——解析或映射假设错了，停")
    g1, g2 = by_grade.get("1", []), by_grade.get("2", [])
    if g1 and g2 and statistics.median(g1) <= statistics.median(g2):
        raise SystemExit("1 级中位 APF ≤ 2 级——等级/数值对不上，数据脏了，停")

    heat.sort(); cool.sort()
    hm, cm = statistics.median(heat), statistics.median(cool)
    if not (HEAT_EFF_MEDIAN[0] <= hm <= HEAT_EFF_MEDIAN[1]):
        raise SystemExit(f"制热中位 {hm:.2f} 出量程 {HEAT_EFF_MEDIAN}")
    if not (COOL_EFF_MEDIAN[0] <= cm <= COOL_EFF_MEDIAN[1]):
        raise SystemExit(f"制冷中位 {cm:.2f} 出量程 {COOL_EFF_MEDIAN}")

    kt_med = statistics.median(k_totals)
    return {
        "kc": kc, "kc_n": len(kcs), "kc_spread": spread,
        "k_ref": k_ref, "cool_share": cool_share,
        "k_total_median": kt_med,
        "n_heat": len(heat), "n_cool": len(cool),
        "n_hp": len(hps), "n_direct_heat": n_direct_heat, "n_direct_cool": n_direct_cool,
        "excluded": excluded, "dropped_parse": len(dropped),
        "heat": {"p25": pctl(heat, 0.25), "p50": pctl(heat, 0.50), "p75": pctl(heat, 0.75)},
        "cool": {"p25": pctl(cool, 0.25), "p50": pctl(cool, 0.50), "p75": pctl(cool, 0.75)},
    }


def aggregate_boiler(rows: list[dict[str, Any]]) -> dict[str, Any]:
    bl = [r for r in rows if r["cat"] == "boiler"]
    etas, dropped = [], 0
    by_grade: dict[str, list[float]] = {}
    for r in bl:
        e1, e2 = r["eta1"], r["eta2"]
        if e1 is None or e2 is None:
            dropped += 1
            continue
        eta_s = (0.85 * e2 + 0.15 * e1) / 100.0
        if not (BOILER_ETA_UNIT[0] <= eta_s <= BOILER_ETA_UNIT[1]):
            dropped += 1
            continue
        etas.append(eta_s)
        by_grade.setdefault(str(r["grade"]), []).append(eta_s)

    frac = dropped / max(1, len(bl))
    log(f"  壁挂炉 n={len(etas)}（剔除 {dropped}，{frac:.2%}）")
    if frac > EXCLUDE_FRACTION_MAX:
        raise SystemExit(f"壁挂炉剔除率 {frac:.2%} 超上限——停")
    g1, g2 = by_grade.get("1", []), by_grade.get("2", [])
    if g1 and g2 and statistics.median(g1) <= statistics.median(g2):
        raise SystemExit("壁挂炉 1 级中位 ηs ≤ 2 级——数据脏了，停")

    etas.sort()
    m = statistics.median(etas)
    if not (BOILER_ETA_MEDIAN[0] <= m <= BOILER_ETA_MEDIAN[1]):
        raise SystemExit(f"壁挂炉中位 ηs {m:.3f} 出量程 {BOILER_ETA_MEDIAN}")
    return {
        "n": len(etas), "dropped": dropped,
        "eta": {"p25": pctl(etas, 0.25), "p50": pctl(etas, 0.50), "p75": pctl(etas, 0.75)},
        "n_grade1": len(g1), "n_grade2": len(g2),
    }


# ---------------- 合并写盘 ----------------

def cn_point(value: float, low: float, high: float, n: int, note: str,
             retrieved: str, source_period: str) -> dict[str, Any]:
    return {
        "value": round(value, 4),
        "low": round(low, 4),
        "mid": round(value, 4),
        "high": round(high, 4),
        "geography": {"level": "country", "code": "CHN"},
        "source_type": "LOCAL_PUBLIC",
        "source_name": "中国能效标识备案库（中国标准化研究院官方备案包 + 能效标识网公开接口）",
        "source_url": UNIVERSE_URL,
        "retrieved_at": retrieved,
        "confidence": "high",
        "sample_count": n,
        "pipeline": PIPELINE_MARK,
        "source_period": source_period,
        "aggregation_method": note,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--crawl-dir", type=pathlib.Path, default=None,
                    help="crawl_energylabel.py 的输出目录（details_*.jsonl）；缺省用提交的缓存")
    args = ap.parse_args()

    retrieved = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")

    if args.crawl_dir:
        log("[1/3] 原始详情 → 紧凑抽取")
        rows = build_extract(args.crawl_dir)
    else:
        log(f"[1/3] 从缓存读取 {CACHE.name}")
        if not CACHE.exists():
            raise SystemExit("无缓存且未给 --crawl-dir")
        rows = load_extract()

    log("[2/3] 聚合")
    ac = aggregate_ac(rows)
    bl = aggregate_boiler(rows)

    ac_note_common = (
        "universe=中标院 2024-12 官方备案包（GB 21455-2019，2020.04–2024.12 全体 12,031 条备案，"
        "逐条取详情）。指标拆算（CS-DECISIONS D11，固定份额法）："
        f"制冷季节负荷常数 Kc={ac['kc']:.1f} 负荷小时由 {ac['kc_n']} 台单冷机备案的 "
        f"SEER×CSEC/CC 中位数解出（IQR 散布 {ac['kc_spread']:.2%}）；全体热泵 APF·ΣE/CC 的"
        f"中位 K_ref={ac['k_ref']:.1f}（所有机型子类含定频均钉在 ~955，锚定常数普适）；"
        f"制冷份额=Kc/K_ref={ac['cool_share']:.4f}，每台热泵 制冷效率=份额×APF×ΣE/CSEC、"
        "制热效率=(1−份额)×APF×ΣE/HSEC——铭牌容量不进拆分（其与实测的散差不污染结果）。"
        f"剔除 {ac['excluded']} 台（K_total 出 [800,1200] 垃圾带或效率出量程）"
        f"+ 分类失败 {ac['dropped_parse']} 台。"
        "独立交叉验证：热泵拆算的制冷 P50 与单冷机直接 SEER 的 P50 相差 ~1%。"
        f"机型构成：热泵 {ac['n_hp']} 台（拆算）、单暖机 {ac['n_direct_heat']} 台（制热季节能源消耗效率直接值，"
        f"只入制热分布）、单冷机 {ac['n_direct_cool']} 台（SEER 直接值，只入制冷分布）。"
        "按备案条目计数、未按销量加权；备案集=在售全体（含定频），非高效端子集。"
    )
    bl_note = (
        "universe=中标院 2024-12 官方备案包（GB 20665-2015，2016.08–2024.12 采暖热水炉 "
        "22,377 条=型号 L1*/LL1*/N1*/LN1*±LIPB 打字错误，热水器 JS* 系不入），逐条取详情。"
        "ηs=0.85×η(30%负荷)+0.15×η(额定)（部分负荷主导季节运行，权重借用 EU 813/2013 结构；"
        "与算术平均差 ≤1.5 个百分点，方向不定）。热效率为低位热值基（GB 20665），"
        "与 residential_energy_prices 的中国气价 LHV 换算口径自洽——不得与 HHV 基的 AFUE 直接比较。"
        f"1 级 n={bl['n_grade1']}、2 级 n={bl['n_grade2']}，等级中位数单调性哨兵通过。"
    )
    period_ac = "备案公告 2020-04 至 2024-12"
    period_bl = "备案公告 2016-08 至 2024-12"

    points = {
        "ashp_ductless|seasonal_heating_efficiency": cn_point(
            ac["heat"]["p50"], ac["heat"]["p25"], ac["heat"]["p75"], ac["n_heat"],
            "制热季节效率 = HSTL/HSEC（单暖机为直接值）。" + ac_note_common, retrieved, period_ac),
        "ashp_ductless|seasonal_cooling_efficiency": cn_point(
            ac["cool"]["p50"], ac["cool"]["p25"], ac["cool"]["p75"], ac["n_cool"],
            "制冷季节效率 = CSTL/CSEC（单冷机为直接值）。" + ac_note_common, retrieved, period_ac),
        "gas_boiler|seasonal_heating_efficiency": cn_point(
            bl["eta"]["p50"], bl["eta"]["p25"], bl["eta"]["p75"], bl["n"],
            bl_note, retrieved, period_bl),
    }

    log("[3/3] 合并写盘")
    doc = json.loads(TARGET.read_text(encoding="utf-8"))
    entries = doc["entries"]
    for subject, point in points.items():
        lst = [p for p in entries.get(subject, []) if p.get("pipeline") != PIPELINE_MARK]
        lst.append(point)
        entries[subject] = lst
        log(f"  {subject:52s} CHN value={point['value']} (n={point['sample_count']})")

    doc["_not_covered"] = (
        "中国已覆盖 ashp_ductless（分体/热泵房间空调，GB 21455-2019 备案全体）与 "
        "gas_boiler（燃气采暖热水炉，GB 20665-2015 备案全体）；中国的 ashp_ducted/gshp/"
        "window_ac 及存量基线（散煤/集中供热/燃气炉下限）仍缺——GB 20665 能效限定值可作"
        "燃气炉存量下限口径，待取到标准原文再入库。欧盟 EPREL 需要 API key，仍整体缺席"
        "（HSPF2/SEER2/APF 三种测试口径不得互相冒充，跨国比较无效）。"
        "minimum/maximum_operating_temp_c 无公开结构化来源（NEEP ccASHP 列批次 4）。"
        "central_ac/split_ac_cooling/portable_ac：无对应在售认证品类，留空。"
        "baseline:solid_fuel 与 baseline:district_*：存量效率无可引用公开口径，留空。"
    )
    TARGET.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"  wrote {TARGET.name}（entries={sum(len(v) for v in entries.values())}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
