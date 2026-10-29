// 와우 할인 카드 비회원 가격 대기열 (04_fe.md §12.5)

import type { WowCard } from "../src/elements";
import { type FetchResult, INTERVAL_MS, NonWowQueue, emptyState } from "../src/nonwow";

const card = (item_id: string): WowCard => ({
  item_id,
  url: `https://www.coupang.com/vp/products/1?itemId=${item_id}&vendorItemId=9`,
  display_price: 9600,
  unit_price_text: "(100g당 1,200원)",
});

function setup(results: Record<string, FetchResult>) {
  const fetched: string[] = [];
  const sleeps: number[] = [];
  const q = new NonWowQueue(
    emptyState(),
    async (url) => {
      const id = new URL(url).searchParams.get("itemId") as string;
      fetched.push(id);
      return results[id] ?? { ok: true, price: 9900 };
    },
    async (ms) => {
      sleeps.push(ms);
    },
  );
  return { q, fetched, sleeps };
}

it("하나씩 1.5초 간격으로 받고 화면 가격·단위가격 표시와 함께 싣는다", async () => {
  const { q, fetched, sleeps } = setup({});
  q.add([card("1"), card("2")]);
  expect(await q.take(true)).toEqual([
    { item_id: "1", non_wow_price: 9900, display_price: 9600, unit_price_text: "(100g당 1,200원)" },
    { item_id: "2", non_wow_price: 9900, display_price: 9600, unit_price_text: "(100g당 1,200원)" },
  ]);
  expect(fetched).toEqual(["1", "2"]);
  expect(sleeps).toEqual([INTERVAL_MS]);
});

it("한 담기에서 같은 itemId는 한 번", async () => {
  const { q, fetched } = setup({});
  q.add([card("1")]);
  await q.take(true);
  q.add([card("1"), card("2")]);
  await q.take(true);
  expect(fetched).toEqual(["1", "2"]);
});

it("실패·차단이면 그 담기에서는 더 받지 않는다", async () => {
  const { q, fetched } = setup({ "2": { ok: false } });
  q.add([card("1"), card("2"), card("3")]);
  expect((await q.take(true)).map((p) => p.item_id)).toEqual(["1"]);
  q.add([card("4")]);
  await q.take(true);
  expect(fetched).toEqual(["1", "2"]);
  expect(q.state.stopped).toBe(true);
});

it("꺼낸 값은 비운다 — 다음 step 또는 finish에 한 번만 싣는다", async () => {
  const { q } = setup({});
  q.add([card("1")]);
  expect(await q.take(true)).toHaveLength(1);
  expect(await q.take(true)).toEqual([]);
});

it("비회원 가격이 없는 페이지는 건너뛰고 계속 받는다", async () => {
  const { q } = setup({ "1": { ok: true, price: null } });
  q.add([card("1"), card("2")]);
  expect((await q.take(true)).map((p) => p.item_id)).toEqual(["2"]);
});
