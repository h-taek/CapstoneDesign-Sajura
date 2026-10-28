"""서버 상품 선택 코드(automation_service의 SELECT_SYSTEM·build_prompt·check_answer)와 BE 컨테이너의
LLM 설정(.env)으로 1회 선택해 check_rule.py 형식으로 남긴다. BE 컨테이너가 떠 있어야 한다.

사용: DATA_DIR=data_v2 RUN_DIR=run_srv_out [INJECT=1] [EFFORT=low] python3 server_eval.py
      RUN_DIR=run_srv_out EXPECT_SET=out_v2 python3 check_rule.py
결과의 selected는 서버 답 검사를 거친 값이다(검사에서 빠지면 null). LLM 원답은 llm에 남긴다.

보안 분류기만: GUARD_URL=http://host.docker.internal:11434/v1 DATA_DIR=data_v2 INJECT=1 python3 server_eval.py
      분류기 판정·사유·소요 시간을 출력한다. 모델은 .env의 LLM_GUARD_MODEL.
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

async def guard():
    t = time.time()
    try:
        v = (await llm.get_guard_client().complete(
            system=a.GUARD_SYSTEM, user=f"{a.SELECT_SYSTEM}\n\n{a.build_prompt(lines, p['logged_in'])}",
            schema=a._GuardVerdict,
        )).model_dump()
    except llm.LLMError as exc:
        v = {"decision": "FAILED", "reason": str(exc)[:300]}
    print(json.dumps({"seconds": round(time.time() - t, 1), **v}, ensure_ascii=False))

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

asyncio.run(guard() if p.get("guard") else main())
'''


def main():
    env = {**os.environ, "RUN_DIR": RUN}
    subprocess.run(["python3", os.path.join(BASE, "build.py")], check=True, env=env)
    payload = json.load(open(os.path.join(RUN, "truth_input.json"), encoding="utf-8"))
    guard_url = os.environ.get("GUARD_URL")
    payload["guard"] = bool(guard_url)
    guard_env = ["-e", "LLM_GUARD_ENABLED=true", "-e", f"LLM_GUARD_BASE_URL={guard_url}"]
    p = subprocess.run(
        ["docker", "compose", "exec", "-T",
         *(["-e", f"LLM_REASONING_EFFORT={e}"] if (e := os.environ.get("EFFORT")) else []),
         *(guard_env if guard_url else []),
         "be", "python", "-c", RUNNER],
        input=json.dumps(payload, ensure_ascii=False), capture_output=True, text=True, cwd=ROOT, timeout=600,
    )
    if guard_url:
        print(p.stdout.strip() or p.stderr[-2000:])
        return
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
