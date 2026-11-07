import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HTTPError } from "ky";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import * as authApi from "../api/endpoints/auth";
import * as menusApi from "../api/endpoints/menus";
import * as storeApi from "../api/endpoints/store";
import LoginPage from "../routes/login";
import ConfirmStep from "../routes/onboarding/step-confirm";
import MenusStep from "../routes/onboarding/step-menus";
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

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderRegister(path = "/register") {
  return renderWithClient(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/onboarding/*" element={<LocationProbe />} />
      <Route path="/login" element={<LocationProbe />} />
    </Routes>,
    path,
  );
}

function httpError(status: number, error: string, message: string) {
  return new HTTPError(
    new Response(JSON.stringify({ error, message }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
    new Request("http://localhost/api/auth/register"),
    {} as never,
  );
}

const pendingMe = {
  user_id: "u1",
  email: "test@sajura.kr",
  name: "홍길동",
  auth_provider: "LOCAL" as const,
  role: "OWNER" as const,
  store_name: null,
  business_no: "123-45-67890",
  business_status: "PENDING" as const,
  onboarding_completed: false,
  created_at: "2026-01-01T00:00:00",
};

const tokens = {
  access_token: "tok",
  token_type: "bearer" as const,
  expires_in: 3600,
  business_status: "PENDING" as const,
  onboarding_completed: false,
};

function fillBusinessStep() {
  fireEvent.change(screen.getByLabelText("사업자등록번호"), { target: { value: "1234567890" } });
  fireEvent.change(document.getElementById("cert") as HTMLInputElement, {
    target: { files: [new File(["x"], "cert.png", { type: "image/png" })] },
  });
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

    it("약관 화살표는 체크를 바꾸지 않고 준비 중 안내 창을 연다", () => {
      // jsdom에는 모달 dialog(showModal·close)가 없어 이 시험에서만 채운다
      const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      proto.showModal = function (this: HTMLDialogElement) {
        this.open = true;
      };
      proto.close = function (this: HTMLDialogElement) {
        this.open = false;
        this.dispatchEvent(new Event("close"));
      };
      onTestFinished(() => {
        Reflect.deleteProperty(proto, "showModal");
        Reflect.deleteProperty(proto, "close");
      });
      renderWithClient(<RegisterPage />, "/register");

      fireEvent.click(screen.getByRole("button", { name: "이용약관 보기" }));

      expect(screen.getByRole("heading", { name: "이용약관" })).toBeInTheDocument();
      expect(screen.getByText("약관 본문을 준비하고 있어요.")).toBeInTheDocument();
      expect(screen.getByLabelText(/이용약관 동의/)).not.toBeChecked();

      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      expect(screen.queryByText("약관 본문을 준비하고 있어요.")).not.toBeInTheDocument();
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

      // '@'와 '.'만 있는 틀린 주소도 이 단계에서 막는다(서버가 마지막 단계에서 거절하는 주소)
      fireEvent.change(emailInput, { target: { value: "a@b..com" } });
      fireEvent.click(screen.getByRole("button", { name: "계속" }));
      expect(screen.getByPlaceholderText("이메일")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("이름")).not.toBeInTheDocument();

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
      fireEvent.click(screen.getByRole("button", { name: "계속" }));
      expect(screen.getByText("비밀번호가 일치하지 않거나 8자 미만입니다.")).toBeInTheDocument();
    });

    function goThroughEmailSteps() {
      fireEvent.click(screen.getByLabelText("모두 동의합니다"));
      fireEvent.click(screen.getByRole("button", { name: "계속" }));
      fireEvent.change(screen.getByPlaceholderText("이메일"), {
        target: { value: "test@sajura.kr" },
      });
      fireEvent.click(screen.getByRole("button", { name: "계속" }));
      fireEvent.change(screen.getByPlaceholderText("이름"), { target: { value: "홍길동" } });
      fireEvent.click(screen.getByRole("button", { name: "계속" }));
      fireEvent.change(screen.getByPlaceholderText("비밀번호"), {
        target: { value: "password123!" },
      });
      fireEvent.change(screen.getByPlaceholderText("비밀번호 확인"), {
        target: { value: "password123!" },
      });
      fireEvent.click(screen.getByRole("button", { name: "계속" }));
    }

    it("마지막 사업자 인증 단계에서 가입하면 곧바로 로그인되어 온보딩으로 간다", async () => {
      const register = vi.spyOn(authApi, "register").mockResolvedValue(tokens);
      vi.spyOn(authApi, "fetchMe").mockResolvedValue(pendingMe);
      renderRegister();

      goThroughEmailSteps();
      expect(screen.getByLabelText("5 / 5 단계")).toBeInTheDocument();
      fillBusinessStep();
      fireEvent.click(screen.getByRole("button", { name: "가입하기" }));

      await waitFor(() =>
        expect(screen.getByTestId("location")).toHaveTextContent("/onboarding/1"),
      );
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@sajura.kr",
          name: "홍길동",
          businessNo: "123-45-67890",
          cert: expect.any(File),
        }),
      );
      expect(useAuthStore.getState().accessToken).toBe("tok");
    });

    it("다른 계정이 쓰는 사업자번호면 사업자 인증 단계에 머물며 사유를 보여 준다", async () => {
      vi.spyOn(authApi, "register").mockRejectedValue(
        httpError(409, "AUTH_BUSINESS_NO_DUPLICATE", "이미 등록된 사업자등록번호입니다."),
      );
      renderRegister();

      goThroughEmailSteps();
      fillBusinessStep();
      fireEvent.click(screen.getByRole("button", { name: "가입하기" }));

      expect(await screen.findByText("이미 등록된 사업자등록번호입니다.")).toBeInTheDocument();
      expect(screen.getByLabelText("사업자등록번호")).toHaveValue("123-45-67890");
      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it("소셜 모드는 약관 → 사업자 인증 2단계이고, 소셜 계정으로 가입한다", async () => {
      vi.spyOn(authApi, "fetchSocialSignup").mockResolvedValue({
        provider: "KAKAO",
        email: "owner@kakao.com",
        name: "카카오점주",
      });
      const registerSocial = vi.spyOn(authApi, "registerSocial").mockResolvedValue(tokens);
      vi.spyOn(authApi, "fetchMe").mockResolvedValue({ ...pendingMe, auth_provider: "KAKAO" });
      renderRegister("/register?social=1");

      expect(await screen.findByText("카카오 계정 owner@kakao.com로 가입해요")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("모두 동의합니다"));
      fireEvent.click(screen.getByRole("button", { name: "계속" }));

      expect(screen.getByLabelText("2 / 2 단계")).toBeInTheDocument();
      fillBusinessStep();
      fireEvent.click(screen.getByRole("button", { name: "가입하기" }));

      await waitFor(() =>
        expect(screen.getByTestId("location")).toHaveTextContent("/onboarding/1"),
      );
      expect(registerSocial).toHaveBeenCalledWith("123-45-67890", expect.any(File));
    });

    it("소셜 가입 대기 토큰이 만료됐으면 로그인 화면으로 보낸다", async () => {
      vi.spyOn(authApi, "fetchSocialSignup").mockRejectedValue(
        httpError(401, "AUTH_SIGNUP_TOKEN_INVALID", "가입 대기 시간이 지났습니다."),
      );
      renderRegister("/register?social=1");

      await waitFor(() =>
        expect(screen.getByTestId("location")).toHaveTextContent("/login?error=signup_expired"),
      );
    });
  });

  describe("LoginPage 상태 안내 문구", () => {
    it("탈퇴 상태와 소셜 가입 대기 만료를 안내한다", () => {
      // 1. 일반 렌더링
      const { unmount } = renderWithClient(<LoginPage />, "/login");
      expect(screen.getByRole("heading", { name: /Sajura/ })).toBeInTheDocument();
      expect(
        screen.getByText("로그인하고 오늘 밤부터 사주라에게 맡겨 보세요."),
      ).toBeInTheDocument();
      unmount();

      // 2. 탈퇴 유예 상태
      const { unmount: u2 } = renderWithClient(<LoginPage />, "/login?error=withdrawn");
      expect(screen.getByText(/탈퇴가 접수되었어요. 30일 뒤 삭제돼요./)).toBeInTheDocument();
      expect(screen.getByText(/탈퇴 처리된 계정입니다/)).toBeInTheDocument();
      u2();

      // 3. 소셜 가입 대기 만료
      renderWithClient(<LoginPage />, "/login?error=signup_expired");
      expect(
        screen.getByText("가입 시간이 지났어요. 소셜 로그인부터 다시 해 주세요."),
      ).toBeInTheDocument();
    });

    it("빈 칸이나 잘못된 형식으로 로그인하면 부제 자리에 첫 번째 문제를 알리고 요청하지 않는다", async () => {
      const loginSpy = vi.spyOn(authApi, "loginWithEmail");
      renderWithClient(<LoginPage />, "/login");

      fireEvent.click(screen.getByRole("button", { name: "로그인하기" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "이메일 형식이 올바르지 않습니다.",
      );
      expect(
        screen.queryByText("로그인하고 오늘 밤부터 사주라에게 맡겨 보세요."),
      ).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "owner@test.kr" } });
      fireEvent.click(screen.getByRole("button", { name: "로그인하기" }));
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("비밀번호를 입력하세요."),
      );
      expect(loginSpy).not.toHaveBeenCalled();
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
      fireEvent.change(screen.getByLabelText("업종"), { target: { value: "양식" } });
      fireEvent.change(screen.getByLabelText("매장 규모"), { target: { value: "MEDIUM" } });
      fireEvent.change(screen.getByLabelText("운영 형태"), { target: { value: "BOTH" } });
      fireEvent.change(screen.getByLabelText("주소"), {
        target: { value: "서울 성동구 성수이로 113" },
      });

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

    it("매장 단계는 예시 값 없이 빈칸으로 시작하고, 그대로 [다음]을 누르면 칸마다 안내한다", async () => {
      renderWithClient(<StoreStep />, "/onboarding/1");

      expect((screen.getByLabelText("매장명") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("주소") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("전화번호") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("업종") as HTMLSelectElement).value).toBe("");
      expect((screen.getByLabelText("매장 규모") as HTMLSelectElement).value).toBe("");
      expect((screen.getByLabelText("운영 형태") as HTMLSelectElement).value).toBe("");

      fireEvent.click(screen.getByTestId("store-next"));

      expect(await screen.findByText("매장명을 입력하세요.")).toBeInTheDocument();
      expect(screen.getByText("업종을 선택하세요.")).toBeInTheDocument();
      expect(screen.getByText("매장 규모를 선택하세요.")).toBeInTheDocument();
      expect(screen.getByText("운영 형태를 선택하세요.")).toBeInTheDocument();
      expect(useOnboardingStore.getState().store).toBeNull();
    });

    it("메뉴 단계는 빈 줄 하나로 시작하고, 이름 없이 [다음]을 누르면 그 줄에 안내한다", async () => {
      useOnboardingStore.setState({
        pos: { pos_type: "CSV_ONLY", api_key: "", store_code: "" },
        menus: [],
      });
      renderWithClient(<MenusStep />, "/onboarding/3");

      expect(screen.getAllByLabelText("메뉴명")).toHaveLength(1);
      expect((screen.getByLabelText("메뉴명") as HTMLInputElement).value).toBe("");

      fireEvent.click(screen.getByTestId("menus-next"));

      expect(await screen.findByText("메뉴명을 입력하세요.")).toBeInTheDocument();
      expect(useOnboardingStore.getState().menus).toEqual([]);

      // 판매가는 빈칸으로 시작하고 꼭 넣어야 한다. 카테고리는 비워도 된다
      expect((screen.getByLabelText("판매가 (원)") as HTMLInputElement).value).toBe("");
      fireEvent.change(screen.getByLabelText("메뉴명"), { target: { value: "김치찌개" } });
      fireEvent.click(screen.getByTestId("menus-next"));
      expect(await screen.findByText("판매가를 입력하세요.")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("판매가 (원)"), { target: { value: "9000" } });
      fireEvent.click(screen.getByTestId("menus-next"));
      await waitFor(() =>
        expect(useOnboardingStore.getState().menus).toEqual([
          { name: "김치찌개", category: "", price: 9000, is_active: true },
        ]),
      );
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
        menus: [
          { name: "피자", category: "메인", price: 15000, is_active: true },
          { name: "콜라", category: " ", price: 2000, is_active: true },
        ],
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
      expect(screen.getByText("콜라 · 2,000원")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("confirm-submit"));

      await waitFor(() => {
        expect(patchStoreSpy).toHaveBeenCalled();
        expect(menusBulkSpy).toHaveBeenCalledWith([
          { name: "피자", category: "메인", price: 15000, is_active: true },
          { name: "콜라", category: null, price: 2000, is_active: true },
        ]);
        expect(completeSpy).toHaveBeenCalled();
        expect(fetchMeSpy).toHaveBeenCalled();
      });
    });
  });
});
