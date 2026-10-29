"""확장 대역 — 저장한 쿠팡 검색 결과로 화면을 흉내 내고 에이전트 서버와 한 품목 대화를 돌린다.

agent 컨테이너 안에서 실제 LLM 설정(.env)으로 /agent/step을 부른다. 첫 지시는 BE의
`automation_service.item_instruction`이 만든 고정 지시문(text)과 발주 데이터(order)를 한 파일에
`---` 줄로 나눠 넣는다(위가 지시문, 아래가 발주 데이터).

사용: docker compose cp scripts/llm_eval/agent_trial.py agent:/tmp/
      docker compose cp scripts/llm_eval/data/양파.json agent:/tmp/onion.json
      docker compose exec agent python /tmp/agent_trial.py /tmp/instruction.txt /tmp/onion.json
결과: research/backend/17_llm_product_selection.md §13
"""

import json
import sys
import time
import uuid

import httpx

instruction, order = (
    part.strip() for part in open(sys.argv[1], encoding="utf-8").read().split("\n---\n", 1)
)
data = json.load(open(sys.argv[2], encoding="utf-8"))
rows = data["rows"]

state = {"page": "home", "typed": "", "product": None, "qty": 1}
refs: dict[str, tuple] = {}


def el(ref, role, text, depth, **ids):
    return {"ref": ref, "role": role, "text": text, "depth": depth, **ids}


def page_elements():
    refs.clear()
    out = []

    def add(role, text, depth, target=None, **ids):
        ref = str(len(out) + 1)
        out.append(el(ref, role, text, depth, **ids))
        if target:
            refs[ref] = target

    add("link", "쿠팡", 0, ("home",))
    add("textbox", state["typed"] or "찾고 싶은 상품을 검색해보세요!", 0, ("box",))
    add("button", "검색", 0, ("search",))
    add("link", "로그인", 0)
    add("link", "장바구니", 0)
    url = "https://www.coupang.com/"
    if state["page"] == "search":
        url = f"https://www.coupang.com/np/search?q={state['typed']}"
        for i, (pid, vid, name, price, disc, unit, fresh) in enumerate(rows):
            item_id = str(80000000000 + i)
            add("link", name, 2, ("card", i), product_id=pid, item_id=item_id, vendor_item_id=vid)
            add("text", f"{price:,}원", 3)
            if disc:
                add("text", disc, 3)
            if unit:
                add("text", f"({unit})", 3)
            if fresh:
                add("img", "logo_fresh_medium.png", 3)
    elif state["page"] == "product":
        i = state["product"]
        pid, vid, name, price, disc, unit, fresh = rows[i]
        item_id = str(80000000000 + i)
        url = f"https://www.coupang.com/vp/products/{pid}?itemId={item_id}"
        add("heading", name, 2, product_id=pid, item_id=item_id, vendor_item_id=vid,
            non_wow_price=price)
        add("text", f"{price:,}원", 3)
        if unit:
            add("text", f"({unit})", 3)
        add("button", "수량빼기", 1, ("minus",))
        add("textbox", str(state["qty"]), 1)
        add("button", "수량더하기", 1, ("plus",))
        add("button", "장바구니 담기", 1, ("add",))
        add("button", "바로구매", 1)
    return {"kind": "elements", "url": url, "elements": out}


def act(tool, args):
    """동작 실행 → (실행 결과, 담긴 상품 또는 None)."""
    if tool == "read_elements":
        return page_elements(), None
    if tool == "scroll":
        return {"kind": "action", "ok": True, "page_changed": False}, None
    if tool == "open_url":
        for i, row in enumerate(rows):
            if f"itemId={80000000000 + i}" in args["url"]:
                state.update(page="product", product=i, qty=1)
                return {"kind": "action", "ok": True, "page_changed": True}, None
        return {"kind": "action", "ok": False, "page_changed": False, "message": "없는 주소"}, None
    target = refs.get(args.get("ref"))
    if target is None:
        return {"kind": "action", "ok": False, "page_changed": False, "message": "요소 없음"}, None
    if tool == "type_text":
        if target[0] != "box":
            return {"kind": "action", "ok": False, "page_changed": False, "message": "입력칸 아님"}, None
        state["typed"] = args["text"]
        return {"kind": "action", "ok": True, "page_changed": False}, None
    kind = target[0]
    if kind == "search":
        state.update(page="search")
    elif kind == "home":
        state.update(page="home")
    elif kind == "card":
        state.update(page="product", product=target[1], qty=1)
    elif kind == "plus":
        state["qty"] += 1
        return {"kind": "action", "ok": True, "page_changed": False}, None
    elif kind == "minus":
        state["qty"] = max(1, state["qty"] - 1)
        return {"kind": "action", "ok": True, "page_changed": False}, None
    elif kind == "add":
        return None, (rows[state["product"]][2], state["qty"])
    return {"kind": "action", "ok": True, "page_changed": True}, None


conv = str(uuid.uuid4())
body = {"conversation_id": conv, "kind": "item", "store_id": "trial-store", "order_id": "trial",
        "instruction": instruction, "order": order, "result": None}
with httpx.Client(base_url="http://localhost:8000", timeout=130) as client:
    for n in range(1, 41):
        t = time.monotonic()
        r = client.post("/agent/step", json=body)
        took = time.monotonic() - t
        answer = r.json()
        print(f"{n:2d} {took:5.1f}초 {r.status_code} {json.dumps(answer, ensure_ascii=False)}")
        if r.status_code != 200 or "done" in answer:
            break
        result, added = act(answer["action"]["tool"], answer["action"]["args"])
        if added:
            print(f"담기 완료: {added[0]} × {added[1]}개 (cart_added — BE가 대화를 끝낸다)")
            break
        if result["kind"] == "elements":
            print(f"   요소 {len(result['elements'])}개, {len(json.dumps(result, ensure_ascii=False)):,}자")
        body = {**body, "instruction": None, "order": None, "result": result}
