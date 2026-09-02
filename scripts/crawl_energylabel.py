# -*- coding: utf-8 -*-
"""能效标识网备案库全量抓取（空调 GB 21455-2019 + 壁挂炉 GB 20665-2015）。

universe = CNIS 2024-12 官方备案包（ac_targets.jsonl / boiler_targets.jsonl）。
策略：型号前缀切片枚举列表(拿 id) → 漏网备案号精确检索兜底 → 逐条详情。
断点续爬：details_*.jsonl 追加式，已有 reg 跳过；枚举结果缓存 enum_*.jsonl。

用法:
  python crawl_energylabel.py pilot   # 12 台试点(含单冷机解常数)
  python crawl_energylabel.py run     # 全量(数小时)
  python crawl_energylabel.py status  # 看进度
"""
import json, re, sys, time, random
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
import requests

BASE = Path(__file__).parent
CRAWL = BASE / "crawl"
CRAWL.mkdir(exist_ok=True)

EP_LIST = "https://www.energylabel.com.cn/admin-api/gateway/productRegistration/productRegistrationList"
EP_DETAIL = "https://www.energylabel.com.cn/admin-api/gateway/productRegistration/productDetailById"
HEADERS = {"Content-Type": "application/json;charset=utf-8", "tenant-id": "1"}

RATE_SLEEP = 0.42          # ~2.2 req/s 全局
SLICE_TARGET_MAX = 1500    # 单切片目标数上限（页深约束 2500 行，留余量）
MAX_PAGES = 50             # 每切片最多翻 50 页 = 2500 行
MIN_PREFIX = 3

CATS = {
    "ac":     {"ptype": "07", "targets": BASE / "cnis_packs" / "ac_targets.jsonl"},
    "boiler": {"ptype": "20", "targets": BASE / "cnis_packs" / "boiler_targets.jsonl"},
}

session = requests.Session()
session.headers.update(HEADERS)
session.trust_env = False   # 国内站点直连，无视代理环境变量

_last_req = [0.0]
def _throttle():
    dt = time.monotonic() - _last_req[0]
    wait = RATE_SLEEP + random.uniform(0, 0.12) - dt
    if wait > 0:
        time.sleep(wait)
    _last_req[0] = time.monotonic()

class CapExceeded(Exception):
    """400 您查询的数据量超过系统限制 → 需要细分切片"""

STATS = defaultdict(int)

def post(url, body, tag):
    for attempt in range(5):
        _throttle()
        STATS["req"] += 1
        try:
            r = session.post(url, json=body, timeout=30)
            if r.status_code != 200:
                raise requests.RequestException(f"http {r.status_code}")
            d = r.json()
        except (requests.RequestException, ValueError) as e:
            STATS["retry"] += 1
            log(f"RETRY {tag} attempt={attempt} err={e}")
            time.sleep(2 ** attempt * 2)
            continue
        code = d.get("code")
        if code == 200:
            return d["data"]
        if code == 400 and "超过系统限制" in (d.get("msg") or ""):
            raise CapExceeded(tag)
        if code == 401:
            raise SystemExit(f"FATAL 401 (tenant-id 失效?) {tag}: {d}")
        if code == 500:
            STATS["retry"] += 1
            log(f"RETRY {tag} attempt={attempt} code=500")
            time.sleep(2 ** attempt * 2)
            continue
        raise SystemExit(f"FATAL 未知响应 {tag}: {d}")
    raise RuntimeError(f"重试耗尽: {tag}")

LOGF = open(CRAWL / "crawl.log", "a", encoding="utf-8")
def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line)
    LOGF.write(line + "\n")
    LOGF.flush()

def list_page(ptype, is_old, page, model="", reg="", producer=""):
    body = {"mark": 854, "productType": ptype, "productModel": model,
            "registrationNumber": reg, "producerName": producer,
            "current": page, "pageSize": 50, "isOld": is_old}
    d = post(EP_LIST, body, f"list {ptype} old={is_old} m={model!r} p{page}")
    return (d or {}).get("list") or []

def detail(pid, ptype, is_old):
    body = {"productId": pid, "productTypeCode": ptype, "mark": 854, "isOld": is_old}
    return post(EP_DETAIL, body, f"detail {pid}")

def load_targets(cat):
    rows = []
    with open(CATS[cat]["targets"], encoding="utf-8") as fh:
        for line in fh:
            rows.append(json.loads(line))
    regs = {r["reg"] for r in rows}
    assert len(regs) == len(rows), f"{cat} 目标里有重复备案号"
    return rows, regs

# ---------- 枚举（型号前缀切片） ----------

def build_slices(models, prefix=""):
    """把目标型号集合切成 API 能翻完的前缀切片（贪心 trie 展开）。"""
    if len(models) <= SLICE_TARGET_MAX and len(prefix) >= MIN_PREFIX:
        return [prefix]
    groups = defaultdict(list)
    exact_here = 0
    for m in models:
        if len(m) <= len(prefix):
            exact_here += 1  # 型号 == 前缀，翻切片时自然带出
            continue
        groups[m[len(prefix)]].append(m)
    out = []
    for ch, sub in groups.items():
        out.extend(build_slices(sub, prefix + ch))
    return out

def enumerate_cat(cat, is_old=0):
    """翻切片列表页，收 reg→(id, row)。缓存到 enum_{cat}.jsonl。"""
    enum_path = CRAWL / f"enum_{cat}.jsonl"
    done_slices_path = CRAWL / f"slices_done_{cat}.json"
    found = {}
    if enum_path.exists():
        with open(enum_path, encoding="utf-8") as fh:
            for line in fh:
                r = json.loads(line)
                found[r["registrationNumber"]] = r
    done_slices = set()
    if done_slices_path.exists():
        done_slices = set(json.load(open(done_slices_path, encoding="utf-8")))

    targets, target_regs = load_targets(cat)
    slices = build_slices([t["model"] for t in targets])
    log(f"[{cat}] targets={len(targets)} slices={len(slices)} already_enum={len(found)}")

    ef = open(enum_path, "a", encoding="utf-8")
    ptype = CATS[cat]["ptype"]
    pending = list(slices)
    while pending:
        sl = pending.pop()
        if sl in done_slices:
            continue
        try:
            page = 1
            while page <= MAX_PAGES:
                rows = list_page(ptype, is_old, page, model=sl)
                new = 0
                for row in rows:
                    reg = (row.get("registrationNumber") or "").strip()
                    if reg and reg in target_regs and reg not in found:
                        found[reg] = row
                        ef.write(json.dumps(row, ensure_ascii=False) + "\n")
                        new += 1
                if page % 10 == 0 or len(rows) < 50:
                    log(f"[{cat}] slice={sl!r} p{page} rows={len(rows)} new={new} total_found={len(found)}")
                if len(rows) < 50:
                    break
                page += 1
            else:
                # 翻满 50 页还没到底 → 切片太大，细分
                raise CapExceeded(sl)
            done_slices.add(sl)
            ef.flush()
            json.dump(sorted(done_slices), open(done_slices_path, "w", encoding="utf-8"))
        except CapExceeded:
            subs = build_slices(
                [t["model"] for t in targets if t["model"].startswith(sl) and len(t["model"]) > len(sl)],
                sl)
            subs = [s for s in subs if s != sl]
            if not subs:
                subs = [sl + c for c in {t["model"][len(sl)] for t in targets
                                         if t["model"].startswith(sl) and len(t["model"]) > len(sl)}]
            log(f"[{cat}] slice={sl!r} 超限 → 细分为 {len(subs)} 个子切片")
            pending.extend(subs)
    ef.close()
    missing = target_regs - set(found)
    log(f"[{cat}] 枚举完成: found={len(found)}/{len(targets)} missing={len(missing)}")
    return targets, found, missing

def rescue_by_reg(cat, missing, found, is_old=0):
    """漏网目标逐条按备案号精确检索。"""
    enum_path = CRAWL / f"enum_{cat}.jsonl"
    ptype = CATS[cat]["ptype"]
    not_found = []
    with open(enum_path, "a", encoding="utf-8") as ef:
        for i, reg in enumerate(sorted(missing)):
            rows = list_page(ptype, is_old, 1, reg=reg)
            hit = next((r for r in rows if (r.get("registrationNumber") or "").strip() == reg), None)
            if hit:
                found[reg] = hit
                ef.write(json.dumps(hit, ensure_ascii=False) + "\n")
            else:
                not_found.append(reg)
            if (i + 1) % 100 == 0:
                log(f"[{cat}] 兜底 {i+1}/{len(missing)} not_found={len(not_found)}")
    log(f"[{cat}] 兜底完成: 仍未命中 {len(not_found)}")
    json.dump(not_found, open(CRAWL / f"notfound_{cat}.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    return not_found

# ---------- 详情 ----------

def fetch_details(cat, targets, found, is_old=0):
    det_path = CRAWL / f"details_{cat}.jsonl"
    have = set()
    if det_path.exists():
        with open(det_path, encoding="utf-8") as fh:
            for line in fh:
                have.add(json.loads(line)["registrationNumber"])
    todo = [t for t in targets if t["reg"] in found and t["reg"] not in have]
    log(f"[{cat}] 详情: have={len(have)} todo={len(todo)}")
    ptype = CATS[cat]["ptype"]
    t0 = time.monotonic()
    with open(det_path, "a", encoding="utf-8") as df:
        for i, t in enumerate(todo):
            row = found[t["reg"]]
            d = detail(row["id"], ptype, is_old) or {}
            rec = {
                "registrationNumber": t["reg"],
                "productId": row["id"],
                "model_xlsx": t["model"],
                "model_api": d.get("productModel"),
                "producer": d.get("producerName") or t["producer"],
                "grade_xlsx": t["grade"],
                "grade_api": d.get("nxLever"),
                "standard": d.get("standard"),
                "announcementTime": d.get("announcementTime"),
                "fields": {p["name"]: p["value"] for p in (d.get("list") or [])},
            }
            df.write(json.dumps(rec, ensure_ascii=False) + "\n")
            if (i + 1) % 200 == 0:
                rate = (i + 1) / (time.monotonic() - t0)
                eta_h = (len(todo) - i - 1) / rate / 3600 if rate else -1
                log(f"[{cat}] 详情 {i+1}/{len(todo)} ({rate:.2f}/s, 剩 {eta_h:.2f}h)")
                update_progress(cat, len(have) + i + 1, len(have) + len(todo))
    update_progress(cat, "done", len(have) + len(todo))
    log(f"[{cat}] 详情完成")

def update_progress(cat, done, total):
    p = CRAWL / "progress.json"
    cur = {}
    if p.exists():
        try:
            cur = json.load(open(p, encoding="utf-8"))
        except ValueError:
            cur = {}
    cur[cat] = {"done": done, "total": total, "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
                "req": STATS["req"], "retry": STATS["retry"]}
    json.dump(cur, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---------- 入口 ----------

def run_cat(cat):
    targets, found, missing = enumerate_cat(cat)
    if missing:
        rescue_by_reg(cat, missing, found)
    fetch_details(cat, targets, found)

def pilot():
    """12 台试点：4 变频热泵 + 2 定速/单冷(KF) + 2 KFRd + 2 普通壁挂炉 + 2 冷凝炉。"""
    picks = []
    ac, _ = load_targets("ac")
    def take(pred, n, pool):
        got = [t for t in pool if pred(t)][:n]
        return got
    picks += [("ac", t) for t in take(lambda t: t["model"].startswith("KF-"), 2, ac)]
    picks += [("ac", t) for t in take(lambda t: t["model"].startswith("KFRd-"), 2, ac)]
    picks += [("ac", t) for t in take(lambda t: t["model"].startswith("KFR-") and t["reg"].startswith("2022"), 2, ac)]
    picks += [("ac", t) for t in take(lambda t: t["model"].startswith("KFR-") and t["reg"].startswith("2024"), 2, ac)]
    bl, _ = load_targets("boiler")
    picks += [("boiler", t) for t in take(lambda t: t["model"].startswith("L1PB") and t["grade"] == "2", 2, bl)]
    picks += [("boiler", t) for t in take(lambda t: t["model"].startswith("LL1") and t["grade"] == "1", 2, bl)]

    out = []
    for cat, t in picks:
        ptype = CATS[cat]["ptype"]
        rows = list_page(ptype, 0, 1, reg=t["reg"])
        hit = next((r for r in rows if (r.get("registrationNumber") or "").strip() == t["reg"]), None)
        if not hit:
            log(f"PILOT MISS {t['reg']} {t['model']}")
            continue
        d = detail(hit["id"], ptype, 0)
        fields = {p["name"]: p["value"] for p in (d.get("list") or [])}
        out.append({"cat": cat, "reg": t["reg"], "model": t["model"], "grade": t["grade"],
                    "fields": fields})
        log(f"PILOT {cat} {t['model']}: {fields}")
    json.dump(out, open(CRAWL / "pilot.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log(f"pilot 完成: {len(out)}/12")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "pilot":
        pilot()
    elif cmd == "run":
        log("==== 全量抓取启动 ====")
        run_cat("ac")
        run_cat("boiler")
        log("==== 全量抓取完成 ====")
    elif cmd == "run-boiler":
        run_cat("boiler")
    elif cmd == "status":
        p = CRAWL / "progress.json"
        print(p.read_text(encoding="utf-8") if p.exists() else "no progress yet")
