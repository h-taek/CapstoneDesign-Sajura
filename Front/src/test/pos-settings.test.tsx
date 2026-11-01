// M4.F1 unit — 설정 화면 상태별 렌더링.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as posApi from "../api/endpoints/pos";
import SettingsHubPage from "../routes/settings/index";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/settings/pos"]}>
        <Routes>
          <Route path="/settings/*" element={<SettingsHubPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PosSettingsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CSV_MODE 응답 시 'CSV 모드' 배지를 표시한다", async () => {
    vi.spyOn(posApi, "getPosStatus").mockResolvedValue({
      status: "CSV_MODE",
      last_synced_at: null,
      error_message: null,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("CSV 모드")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /CSV 양식 받기/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /매출 올리기/ })[0]).toBeInTheDocument();
  });

  it("ERROR 응답 시 오류 메시지를 보여준다", async () => {
    vi.spyOn(posApi, "getPosStatus").mockResolvedValue({
      status: "ERROR",
      last_synced_at: null,
      error_message: "API 키가 만료되었습니다.",
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("연동 끊김")).toBeInTheDocument();
    });
    expect(screen.getByText("API 키가 만료되었습니다.")).toBeInTheDocument();
  });

  it("양식 받기 버튼 클릭 시 sales_template.csv를 다운로드한다", async () => {
    vi.spyOn(posApi, "getPosStatus").mockResolvedValue({
      status: "CSV_MODE",
      last_synced_at: null,
      error_message: null,
    });
    // jsdom은 URL.createObjectURL이 없어 stub으로 주입.
    const createURL = vi.fn(() => "blob:mock");
    const revokeURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeURL, configurable: true });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderPage();
    const btn = await screen.findByRole("button", { name: /CSV 양식 받기/ });
    btn.click();

    expect(createURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeURL).toHaveBeenCalled();
  });
});
