// M4.F2 + M4.F3 unit — 업로드 폼 & 결과 표시.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as salesApi from "../api/endpoints/sales";
import SalesUploadPage from "../routes/sales/upload";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/sales/upload"]}>
        <SalesUploadPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function csvFile(name = "sales.csv", content = "날짜,메뉴명,수량,금액,영수증번호\n2026-01-15,a,1,100,r1\n") {
  return new File([content], name, { type: "text/csv" });
}

describe("SalesUploadPage", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("CSV 파일을 선택하면 파일명을 표시한다", async () => {
    renderPage();
    const input = screen.getByTestId<HTMLInputElement>("file-input");
    fireEvent.change(input, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText("sales.csv")).toBeInTheDocument());
  });

  it("CSV가 아닌 파일은 거부한다", async () => {
    renderPage();
    const input = screen.getByTestId<HTMLInputElement>("file-input");
    const bad = new File(["xx"], "data.xlsx", { type: "application/vnd.ms-excel" });
    fireEvent.change(input, { target: { files: [bad] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("CSV");
    });
  });

  it("업로드 성공 시 imported/skipped/anomaly 결과를 표시한다", async () => {
    vi.spyOn(salesApi, "uploadSalesCsv").mockResolvedValue({
      imported: 12,
      skipped: 3,
      skipped_reasons: ["3행: 메뉴명 없음", "7행: 매장 메뉴와 매핑 실패"],
      anomaly_count: 0,
      auto_created_menus: 0,
      inventory_deduction: {
        deducted_sales: 10,
        needs_check_items: [{ item_id: "bean", name: "원두" }],
      },
    });
    renderPage();
    fireEvent.change(screen.getByTestId<HTMLInputElement>("file-input"), {
      target: { files: [csvFile()] },
    });
    await waitFor(() => expect(screen.getByText("sales.csv")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "업로드 시작" }));

    const result = await screen.findByTestId("upload-result");
    expect(result).toHaveTextContent("12");
    expect(result).toHaveTextContent("3");
    expect(screen.getByText(/제외된 행 2건 보기/)).toBeInTheDocument();
    expect(result).toHaveTextContent("재고 차감에 반영된 판매 10건");
    expect(screen.getByTestId("needs-check")).toHaveTextContent("원두");
  });

  it("파일 미선택 시 업로드 버튼은 비활성화된다", async () => {
    renderPage();
    expect(screen.getByRole("button", { name: "업로드 시작" })).toBeDisabled();
  });

  it("자동 등록 체크 시 auto_create_menus=true가 전달되고 결과에 표시된다", async () => {
    const spy = vi.spyOn(salesApi, "uploadSalesCsv").mockResolvedValue({
      imported: 5,
      skipped: 0,
      skipped_reasons: [],
      anomaly_count: 0,
      auto_created_menus: 3,
      inventory_deduction: { deducted_sales: 0, needs_check_items: [] },
    });
    renderPage();
    fireEvent.change(screen.getByTestId<HTMLInputElement>("file-input"), {
      target: { files: [csvFile()] },
    });
    await waitFor(() => expect(screen.getByText("sales.csv")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("auto-create-menus"));
    fireEvent.click(screen.getByRole("button", { name: "업로드 시작" }));

    await screen.findByTestId("upload-result");
    expect(spy).toHaveBeenCalledWith(
      expect.any(File),
      expect.any(Object),
      { auto_create_menus: true },
    );
    expect(screen.getByText("자동 등록된 메뉴")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
