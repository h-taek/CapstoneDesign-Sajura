// 와우 할인 카드의 비회원 가격 받기 (04_fe.md §12.5).
// 요소 목록을 돌려준 뒤 뒤에서 카드 링크를 1.5초 간격으로 하나씩 받는다. 한 담기에서 같은 itemId는
// 한 번만 받고, 받기에 실패하거나 차단 페이지가 오면 그 담기에서는 더 받지 않는다.

import type { WowCard } from "./elements";
import type { NonWowPrice } from "./messages";

export const INTERVAL_MS = 1500;
export const TAKE_WAIT_MS = 60_000; // 남은 받기를 기다리는 최대 시간

/** 링크 하나 받기 결과 — 차단·실패면 ok false. */
export type FetchResult = { ok: true; price: number | null } | { ok: false };

export interface QueueState {
  seen: string[];
  queue: WowCard[];
  prices: NonWowPrice[];
  stopped: boolean;
}

export const emptyState = (): QueueState => ({ seen: [], queue: [], prices: [], stopped: false });

export class NonWowQueue {
  private running: Promise<void> | null = null;

  constructor(
    public state: QueueState,
    private readonly fetchOne: (url: string) => Promise<FetchResult>,
    private readonly sleep: (ms: number) => Promise<void>,
    private readonly save: (state: QueueState) => void = () => {},
  ) {}

  /** 새로 본 와우 카드를 넣고 받기를 시작한다. */
  add(cards: WowCard[]): void {
    if (this.state.stopped) return;
    for (const c of cards) {
      if (this.state.seen.includes(c.item_id)) continue;
      this.state.seen.push(c.item_id);
      this.state.queue.push(c);
    }
    this.save(this.state);
    if (!this.running && this.state.queue.length) {
      this.running = this.pump().finally(() => {
        this.running = null;
      });
    }
  }

  /** 받은 가격을 꺼낸다. wait면 남은 받기가 끝날 때까지(최대 TAKE_WAIT_MS) 기다린다. */
  async take(wait: boolean): Promise<NonWowPrice[]> {
    if (wait && this.running) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const limit = new Promise<void>((r) => {
        timer = setTimeout(r, TAKE_WAIT_MS);
      });
      await Promise.race([this.running, limit]);
      clearTimeout(timer);
    }
    const prices = this.state.prices;
    this.state.prices = [];
    this.save(this.state);
    return prices;
  }

  private async pump(): Promise<void> {
    let first = true;
    while (this.state.queue.length && !this.state.stopped) {
      if (!first) await this.sleep(INTERVAL_MS);
      first = false;
      const card = this.state.queue.shift() as WowCard;
      let got: FetchResult;
      try {
        got = await this.fetchOne(card.url);
      } catch {
        got = { ok: false };
      }
      if (!got.ok) {
        this.state.stopped = true;
        this.state.queue = [];
      } else if (got.price !== null) {
        this.state.prices.push({
          item_id: card.item_id,
          non_wow_price: got.price,
          display_price: card.display_price,
          unit_price_text: card.unit_price_text,
        });
      }
      this.save(this.state);
    }
  }
}

/** 받은 상품 페이지가 차단 페이지인가. */
export function isBlockedPage(html: string): boolean {
  return html.includes("사용권한이 없습니다");
}
