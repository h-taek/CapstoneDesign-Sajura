// 전역 쿼리 클라이언트 — 저장이 성공하면 다른 화면 조회도 낡은 것으로 표시한다.
import { MutationObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { queryClient } from "../lib/query-client";

describe("queryClient", () => {
  afterEach(() => {
    queryClient.clear();
  });

  it("저장이 성공하면 관계없는 키의 조회까지 낡은 것으로 표시한다", async () => {
    queryClient.setQueryData(["inventory-list-home"], []);
    queryClient.setQueryData(["sales-summary"], { total_sales_count: 1 });
    expect(queryClient.getQueryState(["inventory-list-home"])?.isInvalidated).toBe(false);

    await new MutationObserver(queryClient, { mutationFn: async () => "ok" }).mutate();

    expect(queryClient.getQueryState(["inventory-list-home"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["sales-summary"])?.isInvalidated).toBe(true);
  });

  it("저장이 실패하면 조회를 건드리지 않는다", async () => {
    queryClient.setQueryData(["sales-summary"], { total_sales_count: 1 });

    await new MutationObserver(queryClient, {
      mutationFn: async () => {
        throw new Error("fail");
      },
    })
      .mutate()
      .catch(() => {});

    expect(queryClient.getQueryState(["sales-summary"])?.isInvalidated).toBe(false);
  });
});
