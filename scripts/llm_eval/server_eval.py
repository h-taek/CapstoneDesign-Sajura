"""서버 상품 선택 코드(automation_service의 SELECT_SYSTEM·build_prompt·check_answer)와 BE 컨테이너의
LLM 설정(.env)으로 1회 선택해 check_rule.py 형식으로 남긴다. BE 컨테이너가 떠 있어야 한다.

사용: DATA_DIR=data_v2 RUN_DIR=run_srv_out [INJECT=1] [EFFORT=low] python3 server_eval.py
      RUN_DIR=run_srv_out EXPECT_SET=out_v2 python3 check_rule.py
결과의 selected는 서버 답 검사를 거친 값이다(검사에서 빠지면 null). LLM 원답은 llm에 남긴다.
"""
import json, os, subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(BASE, os.environ.get("RUN_DIR", "run"))
ROOT = os.path.dirname(os.path.dirname(BASE))

RUNNER = r'''
import asyncio, json, sys, time
from decimal import Decimal
from types import SimpleNamespace
from app.integrations import llm
from app.schemas.orders import CoupangSearchResult
from app.services import automation_service as a

p = json.load(sys.stdin)
keys = ("product_id", "vendor_item_id", "product_name", "display_price", "discount_label",
        "unit_price_text", "rocket_fresh", "rating", "review_count")
lines, by_key = [], {}
for it in p["order"]:
    line = a._Line(SimpleNamespace(name=it["name"], unit=it["unit"]), Decimal(str(it["quantity"])), None)
    rows = [CoupangSearchResult(**dict(zip(keys, r))) for r in p["candidates"][it["item_id"]]]
    lines.append((it["item_id"], line, rows))
    by_key[it["item_id"]] = (line, rows)

async def main():
    t = time.time()
    ans = await llm.get_llm_client().complete(
        system=a.SELECT_SYSTEM, user=a.build_prompt(lines, p["logged_in"]), schema=a._LLMAnswer
    )
    out = []
    for s in ans.selections:
        line, rows = by_key[s.item_id]
        chk = a.check_answer(s.selected, line, rows, p["logged_in"])
        out.append({
            "item_id": s.item_id,
            "selected": chk.model_dump(mode="json") if chk else None,
            "llm": s.selected.model_dump() if s.selected else None,
        })
    print(json.dumps({"seconds": round(time.time() - t, 1), "selections": out}, ensure_ascii=False))

asyncio.run(main())
'''


def main():
    env = {**os.environ, "RUN_DIR": RUN}
    subprocess.run(["python3", os.path.join(BASE, "build.py")], check=True, env=env)
    payload = open(os.path.join(RUN, "truth_input.json"), encoding="utf-8").read()
    p = subprocess.run(
        ["docker", "compose", "exec", "-T",
         *(["-e", f"LLM_REASONING_EFFORT={e}"] if (e := os.environ.get("EFFORT")) else []),
         "be", "python", "-c", RUNNER],
        input=payload, capture_output=True, text=True, cwd=ROOT, timeout=600,
    )
    os.makedirs(os.path.join(RUN, "out"), exist_ok=True)
    last = p.stdout.strip().splitlines()[-1] if p.stdout.strip() else ""
    seconds = json.loads(last)["seconds"] if last.startswith("{") else None
    raw = {"label": "server", "rep": 1, "seconds": seconds, "returncode": p.returncode,
           "stdout": last, "stderr": p.stderr[-4000:], "last": None}
    json.dump(raw, open(os.path.join(RUN, "out", "server__1.json"), "w", encoding="utf-8"),
              ensure_ascii=False)
    print(f"rc={p.returncode} {seconds}s" + ("" if p.returncode == 0 else "\n" + p.stderr[-2000:]))


if __name__ == "__main__":
    main()
