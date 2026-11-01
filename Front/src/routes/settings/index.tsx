// 설정 허브(SettingsHubPage) — 04_fe.md §4.9, mockup v2 12_settings.html.
// 웹: 왼쪽 2열 목록 + 오른쪽 3열 판(FollowPanel). 기본은 POS 연동.
// 앱: 목록만 보이다가 항목을 누르면 해당 판이 전체 화면(FollowPanel).
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ChefHat,
  ChevronRight,
  HelpCircle,
  Info,
  LogOut,
  Receipt,
  ShoppingCart,
  Store,
  Upload,
  Wallet,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { getPosStatus } from "../../api/endpoints/pos";
import { InstallMenuButton } from "../../components/pwa/install-banner";
import { AccountPanel } from "../../components/settings/account-panel";
import { APP_VERSION, AppInfoPanel } from "../../components/settings/app-info-panel";
import { CoupangPanel } from "../../components/settings/coupang-panel";
import { NotificationsPanel } from "../../components/settings/notifications-panel";
import { PosPanel } from "../../components/settings/pos-panel";
import { StorePanel } from "../../components/settings/store-panel";
import { UploadPanel } from "../../components/settings/upload-panel";
import { MainShell } from "../../components/shell/main-shell";
import { useAuthStore } from "../../stores/auth-store";

export type SettingsPanelKey =
  | "account"
  | "notifications"
  | "store"
  | "pos"
  | "pos/upload"
  | "coupang"
  | "app-info";

export default function SettingsHubPage() {
  const params = useParams();
  const navigate = useNavigate();
  const splat = (params["*"] ?? "").replace(/^\/+|\/+$/g, "") as SettingsPanelKey | "";

  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clear);
  const userName = user?.name ?? "사장";
  const userInitial = userName.slice(0, 1);
  const userEmail = user?.email ?? "owner@sajura.kr";

  const { data: posStatus } = useQuery({
    queryKey: ["pos", "status"],
    queryFn: getPosStatus,
    staleTime: 60_000,
  });
  const isCsvMode = !posStatus || posStatus.status === "CSV_MODE";

  // 현재 활성 판 결정 (URL splat 기반, 없으면 웹은 "pos", 앱 폭에서는 null)
  // URL이 /settings 면 웹에서는 "pos", 모바일에서는 null(판 안 보임)
  // URL이 /settings/account 면 둘 다 "account"
  const activePanel: SettingsPanelKey | null = splat !== "" ? splat : null;

  const selectPanel = (key: SettingsPanelKey) => {
    navigate(`/settings/${key}`);
  };

  const closePanel = () => {
    navigate("/settings");
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <MainShell active="settings">
      <header className="mb-5 hidden lg:block">
        <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">설정</h1>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        {/* 왼쪽 2열: 설정 목록 */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          {/* 계정 카드 — 내 계정 입구 */}
          <button
            type="button"
            data-row="account"
            onClick={() => selectPanel("account")}
            className={`flex w-full items-center gap-4 rounded-2xl p-5 text-left transition-colors hover:bg-white/50 glass-card ${
              activePanel === "account"
                ? "outline-2 outline-offset-[-2px] outline-brand rounded-2xl"
                : ""
            }`}
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">
              {userInitial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-bold text-ink">{userName}님</span>
              <span className="block truncate text-[0.95rem] text-ink-2">
                {userEmail} · 이메일 로그인
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-4" />
          </button>

          {/* 알림 */}
          <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl glass-card">
            <li>
              <button
                type="button"
                data-row="notify"
                onClick={() => selectPanel("notifications")}
                className={`flex w-full items-center gap-3.5 px-5 py-2.5 text-left transition-colors hover:bg-white/40 ${
                  activePanel === "notifications"
                    ? "outline-2 outline-offset-[-2px] outline-brand rounded-2xl"
                    : ""
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Bell className="size-[1.125rem]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.05rem] font-semibold text-ink">알림</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-4" />
              </button>
            </li>
          </ul>

          {/* 매장 */}
          <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl glass-card">
            <li>
              <button
                type="button"
                data-row="store"
                onClick={() => selectPanel("store")}
                className={`flex w-full items-center gap-3.5 px-5 py-2.5 text-left transition-colors hover:bg-white/40 ${
                  activePanel === "store"
                    ? "outline-2 outline-offset-[-2px] outline-brand rounded-2xl"
                    : ""
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Store className="size-[1.125rem]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.05rem] font-semibold text-ink">매장 정보</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-4" />
              </button>
            </li>

            {/* POS 연동 */}
            <li
              data-row="pos"
              className={`relative flex items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-white/40 ${
                activePanel === "pos" || activePanel === "pos/upload" || (!activePanel && true)
                  ? "lg:outline-2 lg:outline-offset-[-2px] lg:outline-brand lg:rounded-2xl"
                  : ""
              }`}
            >
              <button
                type="button"
                onClick={() => selectPanel("pos")}
                aria-label="POS 연동"
                className="absolute inset-0"
              />
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Receipt className="size-[1.125rem]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.05rem] font-semibold text-ink">POS 연동</span>
                {/* 좁은 폭은 알약을 상태 글 아래 줄로 */}
                {isCsvMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectPanel("pos/upload");
                    }}
                    className="relative mt-3 inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-[0.95rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-ink-3/40 sm:hidden"
                  >
                    <Upload className="size-4" />
                    매출 올리기
                  </button>
                )}
              </span>

              {isCsvMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectPanel("pos/upload");
                  }}
                  className="relative hidden h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-[0.95rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-ink-3/40 sm:inline-flex lg:hidden"
                >
                  <Upload className="size-4" />
                  매출 올리기
                </button>
              )}

              <ChevronRight className="size-5 shrink-0 text-ink-4" />
            </li>

            {/* 쿠팡 담기 확장 */}
            <li>
              <button
                type="button"
                data-row="coupang"
                onClick={() => selectPanel("coupang")}
                className={`flex w-full items-center gap-3.5 px-5 py-2.5 text-left transition-colors hover:bg-white/40 ${
                  activePanel === "coupang"
                    ? "outline-2 outline-offset-[-2px] outline-brand rounded-2xl"
                    : ""
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <ShoppingCart className="size-[1.125rem]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.05rem] font-semibold text-ink">
                    쿠팡 담기 확장
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-4" />
              </button>
            </li>

            {/* 메뉴 관리·판매 데이터 — 앱 폭에서만 */}
            <li className="lg:hidden">
              <Link
                to="/menus"
                className="flex items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-white/40"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <ChefHat className="size-[1.125rem]" />
                </span>
                <span className="min-w-0 flex-1 text-[1.05rem] font-semibold text-ink">
                  메뉴 관리
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-4" />
              </Link>
            </li>
            <li className="lg:hidden">
              <Link
                to="/sales"
                className="flex items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-white/40"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Wallet className="size-[1.125rem]" />
                </span>
                <span className="min-w-0 flex-1 text-[1.05rem] font-semibold text-ink">
                  판매 데이터
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-4" />
              </Link>
            </li>
          </ul>

          {/* 앱 */}
          <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl glass-card">
            <InstallMenuButton />

            <li>
              <button
                type="button"
                data-row="appinfo"
                onClick={() => selectPanel("app-info")}
                className={`flex w-full items-center gap-3.5 px-5 py-2.5 text-left transition-colors hover:bg-white/40 ${
                  activePanel === "app-info"
                    ? "outline-2 outline-offset-[-2px] outline-brand rounded-2xl"
                    : ""
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Info className="size-[1.125rem]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.05rem] font-semibold text-ink">앱 정보</span>
                </span>
                <span className="tabular shrink-0 text-sm text-ink-2">{APP_VERSION}</span>
                <ChevronRight className="size-5 shrink-0 text-ink-4" />
              </button>
            </li>

            <li>
              <Link
                to="/intro"
                className="flex items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-white/40"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <HelpCircle className="size-[1.125rem]" />
                </span>
                <span className="min-w-0 flex-1 text-[1.05rem] font-semibold text-ink">
                  이용 안내
                </span>
                <span className="size-5 shrink-0 text-ink-4">
                  <svg
                    className="size-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                  </svg>
                </span>
              </Link>
            </li>
          </ul>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-ink-2 transition-colors hover:bg-white/50 glass-card"
          >
            <LogOut className="size-5" /> 로그아웃
          </button>
        </div>

        {/* 오른쪽 3열: 고른 판 (웹은 늘 열려 있고 기본은 pos, 앱은 activePanel이 있을 때만 전체 화면) */}
        {/* activePanel이 null이면 웹에서는 POS 판을 렌더링하고, 앱 폭(<lg)에서는 숨김 */}
        {activePanel === "account" && <AccountPanel onBack={closePanel} />}
        {activePanel === "notifications" && <NotificationsPanel onBack={closePanel} />}
        {activePanel === "store" && <StorePanel onBack={closePanel} />}
        {activePanel === "pos/upload" && <UploadPanel onBack={() => selectPanel("pos")} />}
        {activePanel === "coupang" && <CoupangPanel onBack={closePanel} />}
        {activePanel === "app-info" && <AppInfoPanel onBack={closePanel} />}
        {(activePanel === "pos" || activePanel === null) && (
          <div className={activePanel === null ? "hidden lg:contents" : "contents"}>
            <PosPanel onBack={closePanel} onOpenUpload={() => selectPanel("pos/upload")} />
          </div>
        )}
      </div>
    </MainShell>
  );
}
