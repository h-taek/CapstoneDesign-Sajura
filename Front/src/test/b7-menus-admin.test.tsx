// B7 묶음(메뉴·관리자) 기능 및 계산 검증 시험.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as adminApi from "../api/endpoints/admin";
import type * as menusApi from "../api/endpoints/menus";
import { formatSubmittedAt, sortVerifications } from "../components/admin/admin-logic";
import { groupAndFilterMenus } from "../components/menus/menu-logic";
import AdminVerificationsPage from "../routes/admin/verifications";

describe("B7 로직 검증: groupAndFilterMenus", () => {
  const dummyMenus: menusApi.MenuListItem[] = [
    {
      menu_id: "m-3",
      name: "불새우 루꼴라 피자",
      category: "피자",
      price: 19000,
      is_active: true,
      use_inventory_deduction: true,
      has_recipe: true,
      is_deleted: false,
    },
    {
      menu_id: "m-1",
      name: "마르게리타",
      category: "피자",
      price: 15900,
      is_active: true,
      use_inventory_deduction: false,
      has_recipe: true,
      is_deleted: false,
    },
    {
      menu_id: "m-4",
      name: "트러플 감자튀김",
      category: null,
      price: 9000,
      is_active: true,
      use_inventory_deduction: false,
      has_recipe: false,
      is_deleted: false,
    },
    {
      menu_id: "m-2",
      name: "루꼴라 샐러드",
      category: "사이드",
      price: 12000,
      is_active: true,
      use_inventory_deduction: true,
      has_recipe: true,
      is_deleted: false,
    },
    {
      menu_id: "m-5",
      name: "머스크멜론 하몽",
      category: "사이드",
      price: 18000,
      is_active: true,
      use_inventory_deduction: false,
      has_recipe: false,
      is_deleted: false,
    },
  ];

  it("카테고리를 가나다순으로 정렬하고 카테고리 없는 메뉴는 맨 뒤로 보낸다", () => {
    const res = groupAndFilterMenus(dummyMenus, "", "all");
    expect(res.groups.map((g) => g.category)).toEqual(["사이드", "피자", "카테고리 없음"]);
    // 각 묶음 안 메뉴명 가나다순 정렬 확인
    expect(res.groups[0]?.items.map((i) => i.name)).toEqual(["루꼴라 샐러드", "머스크멜론 하몽"]);
    expect(res.groups[1]?.items.map((i) => i.name)).toEqual(["마르게리타", "불새우 루꼴라 피자"]);
    expect(res.groups[2]?.items.map((i) => i.name)).toEqual(["트러플 감자튀김"]);
    expect(res.totalAllCount).toBe(5);
    expect(res.noRecipeCount).toBe(2);
  });

  it("공백·대소문자를 무시하고 메뉴명을 검색하며, 해당 없는 카테고리는 제외한다", () => {
    const res = groupAndFilterMenus(dummyMenus, " 루꼴라 ", "all");
    expect(res.groups.map((g) => g.category)).toEqual(["사이드", "피자"]);
    expect(res.totalFilteredCount).toBe(2);
    expect(res.groups[0]?.items[0]?.name).toBe("루꼴라 샐러드");
    expect(res.groups[1]?.items[0]?.name).toBe("불새우 루꼴라 피자");
  });

  it("레시피 없음 필터를 적용하면 has_recipe=false인 메뉴만 남는다", () => {
    const res = groupAndFilterMenus(dummyMenus, "", "no-recipe");
    expect(res.totalFilteredCount).toBe(2);
    expect(res.groups.map((g) => g.category)).toEqual(["사이드", "카테고리 없음"]);
    expect(res.groups[0]?.items[0]?.name).toBe("머스크멜론 하몽");
    expect(res.groups[1]?.items[0]?.name).toBe("트러플 감자튀김");
  });
});

describe("B7 로직 검증: admin-logic", () => {
  const list: adminApi.VerificationItem[] = [
    {
      store_id: "s-2",
      user_email: "b@test.com",
      business_no: "222",
      business_status: "PENDING",
      cert_url: null,
      submitted_at: "2026-10-18T09:41:00Z",
    },
    {
      store_id: "s-1",
      user_email: "a@test.com",
      business_no: "111",
      business_status: "PENDING",
      cert_url: null,
      submitted_at: "2026-10-17T14:02:00Z",
    },
  ];

  it("신청 일시 오래된 순으로 정렬한다", () => {
    const sorted = sortVerifications(list);
    expect(sorted[0]?.store_id).toBe("s-1");
    expect(sorted[1]?.store_id).toBe("s-2");
  });

  it("날짜를 포맷한다", () => {
    const formatted = formatSubmittedAt("2026-10-17T14:02:00Z");
    expect(formatted).toMatch(/10월 17일/);
  });
});

describe("B7 화면 검증: AdminVerificationsPage", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  beforeEach(() => {
    vi.spyOn(adminApi, "listVerifications").mockResolvedValue({
      items: [
        {
          store_id: "store-100",
          user_email: "pizza@test.com",
          business_no: "123-45-67890",
          business_status: "PENDING",
          cert_url: "/api/admin/verifications/store-100/cert",
          submitted_at: "2026-10-17T14:02:00Z",
        },
      ],
      total: 1,
      page: 1,
      size: 100,
      total_pages: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("등록증 보기 버튼 클릭 시 fetchCertObjectUrl을 호출하고 미리보기를 표시한다", async () => {
    const certSpy = vi.spyOn(adminApi, "fetchCertObjectUrl").mockResolvedValue({
      url: "blob:http://localhost/cert-blob",
      mime: "image/png",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminVerificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("pizza@test.com")).toBeInTheDocument();
    const certBtn = screen.getByRole("button", { name: "등록증 보기" });
    fireEvent.click(certBtn);

    await waitFor(() => expect(certSpy).toHaveBeenCalledWith("store-100"));
    expect(await screen.findByAltText("사업자등록증 미리보기")).toBeInTheDocument();
  });

  it("반려 버튼 클릭 시 반려 사유 입력칸이 열리고 반려 확정을 수행한다", async () => {
    const rejectSpy = vi.spyOn(adminApi, "rejectVerification").mockResolvedValue();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminVerificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("pizza@test.com")).toBeInTheDocument();
    const rejectBtn = screen.getByRole("button", { name: "반려" });
    fireEvent.click(rejectBtn);

    const input = await screen.findByPlaceholderText("반려 사유");
    fireEvent.change(input, { target: { value: "서류 식별 불가" } });

    const confirmBtn = screen.getByRole("button", { name: "반려 확정" });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(rejectSpy).toHaveBeenCalledWith("store-100", "서류 식별 불가"));
  });
});
