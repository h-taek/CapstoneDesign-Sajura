"""run/out의 원문 출력을 채점한다. 정답 포장 수량은 서버 산식(표시 가격 ÷ 단위가격 × 기준 수량)으로 계산한다."""
import glob, json, os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(BASE, os.environ.get("RUN_DIR", "run"), "truth_input.json"), encoding="utf-8"))
UNIT_BASE = {"g": ("g", 1), "kg": ("g", 1000), "ml": ("ml", 1), "l": ("ml", 1000), "구": ("개", 1), "개": ("개", 1)}


def capacity(row, item_unit):
    """표시 가격 ÷ 단위가격 × 기준 수량을 재료 단위로. 계산 불가면 None."""
    price, text = row[3], row[5]
    if not price or not text:
        return None
    m = re.match(r"([\d.]+)\s*([a-zA-Z가-힣]+)당 ([\d,]+)원", text)
    if not m:
        return None
    qty, u, per = float(m.group(1)), m.group(2).lower(), int(m.group(3).replace(",", ""))
    if u not in UNIT_BASE or UNIT_BASE[u][0] != item_unit:
        return None
    return price / per * qty * UNIT_BASE[u][1]


def per_unit(row, item_unit):
    c = capacity(row, item_unit)
    return row[3] / c if c else None


def find_selections(obj):
    if isinstance(obj, dict):
        if "selections" in obj and isinstance(obj["selections"], list):
            return obj
        for v in obj.values():
            r = find_selections(v)
            if r:
                return r
    if isinstance(obj, list):
        for v in obj:
            r = find_selections(v)
            if r:
                return r
    if isinstance(obj, str) and "selections" in obj:
        for cand in re.findall(r"\{.*\}", obj, re.S):
            try:
                return find_selections(json.loads(cand))
            except Exception:
                pass
    return None


def parse(raw):
    for src in (raw.get("last"), raw.get("stdout")):
        if not src:
            continue
        try:
            r = find_selections(json.loads(src))
        except Exception:
            r = find_selections(src)
        if r:
            return r
    return None


def grade(path):
    raw = json.load(open(path, encoding="utf-8"))
    ans = parse(raw)
    res = {"tag": f"{raw['label']}#{raw['rep']}", "sec": raw["seconds"], "items": {}, "parsed": ans is not None}
    if not ans:
        res["error"] = (raw["stderr"] or raw["stdout"])[-300:]
        return res
    by = {s["item_id"]: s.get("selected") for s in ans["selections"]}
    for it in T["order"]:
        iid, unit = it["item_id"], it["unit"]
        rows = T["candidates"][iid]
        sel = by.get(iid, "MISSING")
        if sel in (None, "MISSING"):
            res["items"][iid] = {"name": it["name"], "selected": sel}
            continue
        row = next((r for r in rows if r[1] == sel.get("vendor_item_id")), None)
        if not row:
            res["items"][iid] = {"name": it["name"], "error": "후보 밖 상품", "sel": sel}
            continue
        cap = capacity(row, unit)
        pq = sel.get("pack_quantity")
        eligible = [r for r in rows if not (r[6] and not T["logged_in"]) and per_unit(r, unit)]
        ranked = sorted(eligible, key=lambda r: per_unit(r, unit))
        rank = next((i + 1 for i, r in enumerate(ranked) if r[1] == row[1]), None)
        res["items"][iid] = {
            "name": it["name"], "product": row[2][:60], "fresh_violation": bool(row[6] and not T["logged_in"]),
            "pack_llm": pq, "pack_truth": round(cap) if cap else None,
            "pack_ok": (cap is not None and pq is not None and abs(pq - cap) / cap <= 0.02),
            "unit_price": round(per_unit(row, unit), 2) if cap else None, "rank_cheapest": rank, "reason": sel.get("reason", "")[:80],
        }
    return res


if __name__ == "__main__":
    pattern = sys.argv[1] if len(sys.argv) > 1 else "*"
    for p in sorted(glob.glob(os.path.join(BASE, os.environ.get("RUN_DIR", "run"), "out", pattern + ".json"))):
        r = grade(p)
        print(f"\n=== {r['tag']}  {r['sec']}s  parsed={r['parsed']}")
        if not r["parsed"]:
            print("   ", r.get("error"))
            continue
        for iid, x in r["items"].items():
            if "product" in x:
                print(f"  {iid} {x['name']}: rank {x['rank_cheapest']} | pack {x['pack_llm']} vs {x['pack_truth']} {'OK' if x['pack_ok'] else 'NG'}"
                      f"{' | 로켓프레시 위반' if x['fresh_violation'] else ''} | {x['product']}")
            else:
                print(f"  {iid} {x['name']}: {x}")
