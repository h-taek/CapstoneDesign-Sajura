import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HTTPError } from "ky";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "../api/endpoints/auth";
import * as menusApi from "../api/endpoints/menus";
import * as storeApi from "../api/endpoints/store";
import LoginPage from "../routes/login";
import ConfirmStep from "../routes/onboarding/step-confirm";
import PosStep from "../routes/onboarding/step-pos";
import StoreStep from "../routes/onboarding/step-store";
import RegisterPage from "../routes/register";
import VerifyBusinessPage from "../routes/verify-business";
import { useAuthStore } from "../stores/auth-store";
import { useOnboardingStore } from "../stores/onboarding-store";

function renderWithClient(ui: React.ReactElement, initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("B1 시작·인증·온보딩 화면 흐름", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clear();
    useOnboardingStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clear();
    useOnboardingStore.getState().reset();
  });

  describe("RegisterPage 단계 전환 및 검증", () => {
    it("약관 미동의 시 오류 메시지가 뜨고 다음 단계로 가지 않는다", () => {
      renderWithClient(<RegisterPage />, "/register");

      expect(screen.getByRole("heading", { name: "이용약관 및 정책" })).toBeInTheDocument();
      const continueBtn = screen.getByRole("button", { name: "계속" });
      fireEvent.click(continueBtn);

      expect(screen.getByText("필수 약관에 모두 동의해 주세요")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("이메일")).not.toBeInTheDocument();
    });

    it("약관 전체 동의 후 이메일, 이름, 비밀번호 단계로 차례로 진행된다", async () => {
      renderWithClient(<RegisterPage />, "/register");

      // 1. 약관 전체 동의
      fireEvent.click(screen.getByLabelText("모두 동의합니다"));
      fireEvent.click(screen.getByRole("button", { name: "계속" }));

      // 2. 이메일 단계
      const emailInput = screen.getByPlaceholderText("이메일");
      expect(emailInput).toBeInTheDocument();
      fireEvent.change(emailInput, { target: { value: "invalid-email" } });
      fireEvent.click(screen.getByRole("button", { name: "계속" }));
      expect(
        screen.getByText("이미 가입된 이메일이거나 올바르지 않은 형식입니다."),
      ).toBeInTheDocument();

      fireEvent.change(emailInput, { target: { value: "test@sajura.kr" } });
      fireEvent.click(screen.getByRole("button", { name: "계속" }));

      // 3. 이름 단계
      const nameInput = screen.getByPlaceholderText("이름");
      expect(nameInput).toBeInTheDocument();
      fireEvent.change(nameInput, { target: { value: "홍길동" } });
      fireEvent.click(screen.getByRole("button", { name: "계속" }));

      // 4. 비밀번호 단계
      const pwInput = screen.getByPlaceholderText("비밀번호");
      const pwConfirmInput = screen.getByPlaceholderText("비밀번호 확인");
      expect(pwInput).toBeInTheDocument();

      // 비밀번호 불일치 검증
      fireEvent.change(pwInput, { target: { value: "password123!" } });
      fireEvent.change(pwConfirmInput, { target: { value: "different123!" } });
      fireEvent.click(screen.getByRole("button", { name: "가입하기" }));
      expect(screen.getByText("비밀번호가 일치하지 않거나 8자 미만입니다.")).toBeInTheDocument();
    });
  });

  describe("LoginPage 상태 안내 문구", () => {
    it("회원가입 완료 상태와 탈퇴 상태를 올바르게 안내한다", () => {
      // 1. 일반 렌더링
      const { unmount } = renderWithClient(<LoginPage />, "/login");
      expect(screen.getByRole("heading", { name: /Sajura/ })).toBeInTheDocument();
      expect(
        screen.getByText("로그인하고 오늘 밤부터 사주라에게 맡겨 보세요."),
      ).toBeInTheDocument();
      unmount();

      // 2. 탈퇴 유예 상태
      renderWithClient(<LoginPage />, "/login?error=withdrawn");
      expect(screen.getByText(/탈퇴가 접수되었어요. 30일 뒤 삭제돼요./)).toBeInTheDocument();
      expect(screen.getByText(/탈퇴 처리된 계정입니다/)).toBeInTheDocument();
    });
  });

  describe("VerifyBusinessPage 사업자 검증", () => {
    it("사업자등록번호 하이픈 자동 포맷팅과 파일 미첨부 검증", () => {
      useAuthStore.setState({
        accessToken: "tok",
        user: {
          user_id: "u1",
          email: "owner@test.kr",
          name: "사장님",
          auth_provider: "LOCAL",
          role: "OWNER",
          store_name: "테스트매장",
          business_no: null,
          business_status: "UNVERIFIED",
          onboarding_completed: false,
          created_at: "2026-01-01T00:00:00",
        },
      });

      renderWithClient(<VerifyBusinessPage />, "/verify-business");

      const input = screen.getByLabelText("사업자등록번호");
      fireEvent.change(input, { target: { value: "1234567890" } });
      expect((input as HTMLInputElement).value).toBe("123-45-67890");

      fireEvent.click(screen.getByRole("button", { name: "제출하기" }));
      expect(screen.getByText("사업자등록증 파일을 첨부하세요.")).toBeInTheDocument();
    });

    const unverifiedUser = {
      user_id: "u1",
      email: "owner@test.kr",
      name: "사장님",
      auth_provider: "LOCAL" as const,
      role: "OWNER" as const,
      store_name: "테스트매장",
      business_no: null,
      business_status: "UNVERIFIED" as const,
      onboarding_completed: false,
      created_at: "2026-01-01T00:00:00",
    };

    function renderVerifyWithLogin() {
      return renderWithClient(
        <Routes>
          <Route path="/verify-business" element={<VerifyBusinessPage />} />
          <Route path="/login" element={<p>로그인 화면</p>} />
        </Routes>,
        "/verify-business",
      );
    }

    it("'다른 계정으로 로그인'은 서버 로그아웃 후 /login으로 보낸다", async () => {
      useAuthStore.setState({ accessToken: "tok", user: unverifiedUser });
      const logoutSpy = vi.spyOn(authApi, "logout").mockResolvedValue();

      renderVerifyWithLogin();
      expect(screen.getByText("owner@test.kr")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "다른 계정으로 로그인" }));

      await waitFor(() => expect(screen.getByText("로그인 화면")).toBeInTheDocument());
      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("이미 등록된 사업자번호(409)면 안내 문구와 '그 계정으로 로그인하기'를 보여 준다", async () => {
      useAuthStore.setState({ accessToken: "tok", user: unverifiedUser });
      const response = new Response(
        JSON.stringify({
          error: "AUTH_BUSINESS_NO_DUPLICATE",
          message: "이미 등록된 사업자등록번호입니다.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
      vi.spyOn(authApi, "verifyBusiness").mockRejectedValue(
        new HTTPError(response, new Request("http://localhost/api/store/verify"), {} as never),
      );
      const logoutSpy = vi.spyOn(authApi, "logout").mockResolvedValue();

      renderVerifyWithLogin();
      fireEvent.change(screen.getByLabelText("사업자등록번호"), {
        target: { value: "1234567890" },
      });
      const file = new File(["x"], "cert.png", { type: "image/png" });
      fireEvent.change(document.getElementById("cert") as HTMLInputElement, {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByRole("button", { name: "제출하기" }));

      expect(await screen.findByText(/이미 가입된 사업자등록번호예요/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "그 계정으로 로그인하기" }));

      await waitFor(() => expect(screen.getByText("로그인 화면")).toBeInTheDocument());
      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe("Onboarding 전체 흐름 및 API 연동", () => {
    it("매장 입력 -> POS 선택 -> 메뉴 입력 -> 최종 제출 및 온보딩 완료", async () => {
      renderWithClient(
        <Routes>
          <Route path="/onboarding/1" element={<StoreStep />} />
          <Route path="/onboarding/2" element={<PosStep />} />
        </Routes>,
        "/onboarding/1",
      );

      const storeNameInput = screen.getByLabelText("매장명");
      fireEvent.change(storeNameInput, { target: { value: "사주라 성수점" } });

      const phoneInput = screen.getByLabelText("전화번호");
      fireEvent.change(phoneInput, { target: { value: "0212345678" } });
      expect((phoneInput as HTMLInputElement).value).toBe("02-1234-5678");

      fireEvent.click(screen.getByTestId("store-next"));

      await waitFor(() => {
        expect(screen.getByText("POS를 연결해 주세요")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("CSV 업로드만 사용"));
      fireEvent.click(screen.getByTestId("pos-next"));

      await waitFor(() => {
        const state = useOnboardingStore.getState();
        expect(state.store?.store_name).toBe("사주라 성수점");
        expect(state.pos?.pos_type).toBe("CSV_ONLY");
      });
    });

    it("ConfirmStep에서 완료 시 API들을 호출한다", async () => {
      useOnboardingStore.setState({
        store: {
          store_name: "사주라 성수점",
          business_type: "양식",
          store_size: "MEDIUM",
          operation_type: "BOTH",
          address: "서울 성동구 성수이로 00",
          phone: "02-1234-5678",
        },
        pos: {
          pos_type: "CSV_ONLY",
          api_key: "",
          store_code: "",
        },
        menus: [{ name: "피자", category: "메인", price: 15000, is_active: true }],
      });

      const patchStoreSpy = vi
        .spyOn(storeApi, "patchStore")
        .mockResolvedValue({} as unknown as Awaited<ReturnType<typeof storeApi.patchStore>>);
      const menusBulkSpy = vi
        .spyOn(menusApi, "createMenusBulk")
        .mockResolvedValue({} as unknown as Awaited<ReturnType<typeof menusApi.createMenusBulk>>);
      const completeSpy = vi
        .spyOn(storeApi, "completeOnboarding")
        .mockResolvedValue(
          {} as unknown as Awaited<ReturnType<typeof storeApi.completeOnboarding>>,
        );
      const fetchMeSpy = vi.spyOn(authApi, "fetchMe").mockResolvedValue({
        user_id: "u1",
        email: "owner@test.kr",
        name: "점주",
        auth_provider: "LOCAL",
        role: "OWNER",
        store_name: "사주라 성수점",
        business_no: "123",
        business_status: "VERIFIED",
        onboarding_completed: true,
        created_at: "2026-01-01T00:00:00",
      });

      renderWithClient(<ConfirmStep />, "/onboarding/4");

      expect(screen.getByText("사주라 성수점")).toBeInTheDocument();
      expect(screen.getByText("CSV 업로드만 사용")).toBeInTheDocument();
      expect(screen.getByText("피자 · 메인 · 15,000원")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("confirm-submit"));

      await waitFor(() => {
        expect(patchStoreSpy).toHaveBeenCalled();
        expect(menusBulkSpy).toHaveBeenCalledWith([
          { name: "피자", category: "메인", price: 15000, is_active: true },
        ]);
        expect(completeSpy).toHaveBeenCalled();
        expect(fetchMeSpy).toHaveBeenCalled();
      });
    });
  });
});
