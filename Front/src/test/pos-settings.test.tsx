// M4.F1 unit — 설정 화면 상태별 렌더링.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("CSV 모드에서 토스 가맹점 ID로 연결하면 토스플레이스로 등록한다", async () => {
    vi.spyOn(posApi, "getPosStatus").mockResolvedValue({
      status: "CSV_MODE",
      last_synced_at: null,
      error_message: null,
    });
    const createSpy = vi
      .spyOn(posApi, "createPos")
      .mockResolvedValue({} as Awaited<ReturnType<typeof posApi.createPos>>);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "토스 연결" }));
    fireEvent.change(screen.getByLabelText("토스 가맹점 ID"), { target: { value: " 154663 " } });
    fireEvent.click(screen.getByRole("button", { name: "연결" }));
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ pos_type: "TOSSPLACE", store_code: "154663" });
    });
  });

  it("연결 직후 첫 동기화 전에는 받는 중으로 보이고 지금 동기화를 막는다", async () => {
    vi.spyOn(posApi, "getPosStatus").mockResolvedValue({
      status: "CONNECTED",
      last_synced_at: null,
      error_message: null,
    });
    renderPage();
    expect(await screen.findByText("판매 데이터를 받는 중이에요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /지금 동기화/ })).toBeDisabled();
  });

  it("지금 동기화하면 새로 받은 판매 수를 보여준다", async () => {
    vi.spyOn(posApi, "getPosStatus").mockResolvedValue({
      status: "CONNECTED",
      last_synced_at: "2026-11-01T16:00:00Z",
      error_message: null,
    });
    vi.spyOn(posApi, "syncPos").mockResolvedValue({
      synced_at: "2026-11-02T01:00:00Z",
      records_synced: 1234,
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /지금 동기화/ }));
    expect(await screen.findByText("판매 1,234건을 새로 받았어요")).toBeInTheDocument();
  });

  it("다시 연동은 저장된 가맹점 ID를 채워 열고 바꾼 ID로 수정한다", async () => {
    vi.spyOn(posApi, "getPosStatus").mockResolvedValue({
      status: "ERROR",
      last_synced_at: null,
      error_message: "토스플레이스 오류: 가맹점 없음",
    });
    vi.spyOn(posApi, "getPos").mockResolvedValue({
      pos_type: "TOSSPLACE",
      api_key: "",
      store_code: "111",
      connected_at: "2026-11-01T00:00:00Z",
    });
    const updateSpy = vi
      .spyOn(posApi, "updatePos")
      .mockResolvedValue({} as Awaited<ReturnType<typeof posApi.updatePos>>);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "다시 연동" }));
    const input = await screen.findByLabelText("토스 가맹점 ID");
    expect(input).toHaveValue("111");
    fireEvent.change(input, { target: { value: "222" } });
    fireEvent.click(screen.getByRole("button", { name: "연결" }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ pos_type: "TOSSPLACE", store_code: "222" });
    });
  });
});
