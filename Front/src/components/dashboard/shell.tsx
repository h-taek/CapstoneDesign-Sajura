// 대시보드 공용 셸 — 리디자인 v2.
// 웹(lg 이상): 수발주 B2B 서비스처럼 흰 상단 가로 내비 + 회색 캔버스 + 1280px 본문.
// 앱(lg 미만): 50~60대가 가장 많이 쓰는 카카오톡·네이버·밴드의 문법을 따른다 —
//   상단에는 지금 화면 이름만 크게, 아래에는 글자 달린 큰 하단 탭 5개.
import {
  Boxes,
  ChefHat,
  ChevronLeft,
  ClipboardList,
  Home,
  LogOut,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  TrendingUp,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { logout } from "../../api/endpoints/auth";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth-store";

export type NavKey = "home" | "forecast" | "inventory" | "orders" | "recipes" | "settings";

const WEB_NAV: Array<{ key: NavKey; to: string; label: string; icon: typeof Home }> = [
  { key: "home", to: "/", label: "홈", icon: Home },
  { key: "forecast", to: "/forecast", label: "매출예측", icon: TrendingUp },
  { key: "inventory", to: "/inventory", label: "재고관리", icon: Boxes },
  { key: "orders", to: "/orders", label: "발주추천", icon: ClipboardList },
  { key: "recipes", to: "/recipes", label: "레시피 관리", icon: ChefHat },
];

// 앱 하단 탭 — 5개, 아이콘 + 글자. 레시피·설정·매출 올리기는 "더보기"에 모은다.
const APP_TABS: Array<{ key: NavKey; to: string; label: string; icon: typeof Home }> = [
  { key: "home", to: "/", label: "홈", icon: Home },
  { key: "forecast", to: "/forecast", label: "매출 예측", icon: TrendingUp },
  { key: "inventory", to: "/inventory", label: "재고", icon: Boxes },
  { key: "orders", to: "/orders", label: "발주", icon: ClipboardList },
  { key: "settings", to: "/settings", label: "더보기", icon: MenuIcon },
];

const APP_TITLE: Record<NavKey, string> = {
  home: "홈",
  forecast: "매출 예측",
  inventory: "재고",
  orders: "발주",
  recipes: "레시피 관리",
  settings: "더보기",
};

export async function signOut(clear: () => void) {
  try {
    await logout();
  } finally {
    clear();
    window.location.assign("/login");
  }
}

export function DashboardShell({
  active,
  children,
  title,
  backTo,
}: {
  active: NavKey;
  children: ReactNode;
  /** 앱 상단바 제목. 생략하면 탭 이름. */
  title?: string;
  /** 앱 상단바 뒤로가기 경로 — 하위 화면(설정 상세 등)에서 쓴다. */
  backTo?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const storeName = user?.store_name ?? "내 매장";
  // recipes는 앱에서 "더보기" 아래 화면이다.
  const appTabKey: NavKey = active === "recipes" ? "settings" : active;

  return (
    <div className="min-h-dvh bg-canvas">
      <WebHeader
        active={active}
        storeName={storeName}
        userName={user?.name}
        onLogout={() => signOut(clear)}
      />
      <AppTopBar
        title={title ?? (active === "home" ? storeName : APP_TITLE[active])}
        subtitle={active === "home" && !title ? `${user?.name ?? "사장"}님, 안녕하세요` : undefined}
        backTo={backTo ?? (active === "recipes" ? "/settings" : undefined)}
      />

      <main className="mx-auto w-full max-w-[1280px] px-4 pt-4 pb-32 sm:px-6 lg:px-8 lg:pt-8 lg:pb-16">
        {children}
      </main>

      <AppTabBar active={appTabKey} />
    </div>
  );
}

function WebHeader({
  active,
  storeName,
  userName,
  onLogout,
}: {
  active: NavKey;
  storeName: string;
  userName: string | undefined;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 hidden border-b border-line bg-white/95 backdrop-blur lg:block">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-8 px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="사주라 홈">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-sm font-black text-white">
            S
          </span>
          <span className="text-xl font-extrabold tracking-tight text-ink">사주라</span>
        </Link>

        <nav aria-label="주 메뉴" className="flex h-full items-stretch gap-1">
          {WEB_NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center px-3.5 text-[0.95rem] font-semibold transition-colors",
                  isActive ? "text-brand" : "text-ink-2 hover:text-ink",
                )}
              >
                {item.label}
                {isActive ? (
                  <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-brand" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/sales/upload"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            <Upload className="size-4" /> 매출 올리기
          </Link>
          <Link
            to="/settings"
            aria-label="설정"
            className={cn(
              "flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-subtle",
              active === "settings" && "bg-brand-soft text-brand",
            )}
          >
            <SettingsIcon className="size-5" />
          </Link>
          <div className="ml-2 flex items-center gap-3 border-l border-line pl-4">
            <button
              type="button"
              onClick={() => navigate("/settings/account")}
              className="flex items-center gap-2.5 text-left"
              aria-label="계정"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                {(userName ?? "U").slice(0, 1)}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-ink">{storeName}</span>
                <span className="block text-xs text-ink-3">{userName ?? "사장"}님</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-subtle hover:text-ink"
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut className="size-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function AppTopBar({
  title,
  subtitle,
  backTo,
}: {
  title: string;
  subtitle: string | undefined;
  backTo: string | undefined;
}) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line-soft bg-white/95 backdrop-blur lg:hidden">
      <div className="flex min-h-16 items-center gap-1 px-2 py-2">
        {backTo ? (
          <Link
            to={backTo}
            aria-label="뒤로 가기"
            className="flex size-12 items-center justify-center rounded-full text-ink active:bg-subtle"
          >
            <ChevronLeft className="size-7" />
          </Link>
        ) : (
          <span className="w-3" />
        )}
        <div className="min-w-0 flex-1">
          {subtitle ? <p className="text-sm text-ink-3">{subtitle}</p> : null}
          <p className="truncate text-[1.35rem] font-bold tracking-tight text-ink">{title}</p>
        </div>
      </div>
    </header>
  );
}

function AppTabBar({ active }: { active: NavKey }) {
  return (
    <nav
      aria-label="하단 메뉴"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {APP_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                to={tab.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.8rem] font-semibold",
                  isActive ? "text-brand" : "text-ink-3",
                )}
              >
                <Icon className="size-[1.6rem]" strokeWidth={isActive ? 2.4 : 2} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
