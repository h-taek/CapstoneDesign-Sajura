// M3.F7 — auth_test FE 측 E2E.
// 시나리오: 로그인 진입 → OAuth 버튼 클릭 → (BE 모킹으로 인증 상태 부트스트랩) →
//   온보딩 4스텝 통과 → 메인 화면 도달.
// BE auth_be(M3.B1~B3)가 완성된 환경에서는 baseURL을 변경해 실 흐름을 검증한다.
//
// 본 spec은 BE가 미완성 상태에서도 FE 라우팅·폼·가드만 검증 가능하도록
// fetch을 라우트 인터셉트로 모킹한다.
import { expect, test } from "@playwright/test";

const FAKE_USER = {
  user_id: "u-1",
  email: "owner@example.com",
  name: "홍길동",
  auth_provider: "KAKAO",
  store_name: "길동 카페",
  business_no: "123-45-67890",
  business_status: "VERIFIED",
  onboarding_completed: false,
};

test.describe("auth + onboarding", () => {
  test.beforeEach(async ({ page }) => {
    // refresh / me / store 패치 / 메뉴 bulk / onboarding complete 전부 200 stub.
    let onboardingCompleted = false;

    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "fake.jwt.token",
          token_type: "bearer",
          expires_in: 3600,
        }),
      });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...FAKE_USER,
          onboarding_completed: onboardingCompleted,
        }),
      });
    });
    await page.route("**/api/store", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 200, body: JSON.stringify({}) });
        return;
      }
      await route.fallback();
    });
    await page.route("**/api/store/pos", async (route) =>
      route.fulfill({ status: 201, body: JSON.stringify({}) }),
    );
    await page.route("**/api/menus/bulk", async (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ created: 1, skipped: 0, skipped_names: [] }),
      }),
    );
    await page.route("**/api/store/onboarding/complete", async (route) => {
      onboardingCompleted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ onboarding_completed: true, store_id: "s-1" }),
      });
    });
    await page.route("**/api/auth/logout", async (route) =>
      route.fulfill({ status: 204, body: "" }),
    );
  });

  test("login page exposes both OAuth buttons", async ({ page }) => {
    // beforeEach가 /api/auth/refresh를 200으로 stub하므로 RequireGuest가 /login에서
    // 리다이렉트시킴 → 로그인 화면 자체 검증을 위해 refresh만 401로 덮어씀.
    await page.route("**/api/auth/refresh", async (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: "AUTH_REFRESH_TOKEN_INVALID" }) }),
    );
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /카카오로 계속하기/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Google로 계속하기/ })).toBeVisible();
  });

  test("authenticated user without onboarding completes 4-step flow", async ({ page }) => {
    await page.goto("/");

    // refresh + me 완료 후 가드가 /onboarding/1로 보냄.
    await expect(page).toHaveURL(/\/onboarding\/1$/);

    // Step 1 — 매장 정보.
    await page.locator("#store_name").fill("길동 카페");
    await page.locator("#business_type").selectOption("카페");
    await page.locator("#store_size").selectOption("SMALL");
    await page.locator("#operation_type").selectOption("HALL");
    await page.locator("#address").fill("서울시 강남구 1");
    await page.locator("#phone").fill("0212345678");
    await page.locator("#phone").blur();
    await page.getByTestId("store-next").click();

    // Step 2 — POS (CSV_ONLY 기본).
    await expect(page).toHaveURL(/\/onboarding\/2$/);
    await page.getByTestId("pos-next").click();

    // Step 3 — 메뉴 1개 등록.
    await expect(page).toHaveURL(/\/onboarding\/3$/);
    await page.locator("#menus\\.0\\.name").fill("아메리카노");
    await page.locator("#menus\\.0\\.category").fill("음료");
    await page.locator("#menus\\.0\\.price").fill("4500");
    await page.getByTestId("menus-next").click();

    // Step 4 — 확인 + 제출.
    await expect(page).toHaveURL(/\/onboarding\/4$/);
    await expect(page.getByText("길동 카페")).toBeVisible();
    await page.getByTestId("confirm-submit").click();

    // 메인 진입.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "사주라" })).toBeVisible();
    await expect(page.getByText("온보딩 완료")).toBeVisible();
  });
});
