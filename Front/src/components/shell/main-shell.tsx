// 메인 셸(MainShell) — 열린 레이아웃(웹 중앙 고정 알약 메뉴 + 우측 유틸리티 / 앱 상단 축소 바 + 하단 5탭) (04_fe.md §4.0, mockup.js).
// 하늘 배경은 A1이 루트에 깔므로 셸은 배경 없이 투명하게 그 위에 놓인다.
import {
  Boxes,
  ChefHat,
  ChevronLeft,
  ClipboardList,
  Home,
  type LucideIcon,
  Menu,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth-store";
import {
  NotificationBellButton,
  NotificationPopover,
  useConnectedNotifications,
} from "./notification-popover";

export type NavKey = "home" | "forecast" | "sales" | "inventory" | "orders" | "menus" | "settings";

export interface NavItem {
  key: NavKey;
  to: string;
  label: string;
  icon: LucideIcon;
}

/** 웹 중앙 알약 내비게이션 6개 항목 (04_fe.md §4.0, mockup.js WEB_NAV). */
export const WEB_NAV: readonly NavItem[] = [
  { key: "home", to: "/", label: "홈", icon: Home },
  { key: "forecast", to: "/forecast", label: "매출 예측", icon: TrendingUp },
  { key: "sales", to: "/sales", label: "판매 데이터", icon: Wallet },
  { key: "inventory", to: "/inventory", label: "재고 관리", icon: Boxes },
  { key: "orders", to: "/orders", label: "추천발주", icon: ClipboardList },
  { key: "menus", to: "/menus", label: "메뉴 관리", icon: ChefHat },
];

/** 앱 하단 탭 바 5개 항목 (04_fe.md §4.0, mockup.js APP_TABS). */
export const APP_TABS: readonly NavItem[] = [
  { key: "home", to: "/", label: "홈", icon: Home },
  { key: "forecast", to: "/forecast", label: "매출 예측", icon: TrendingUp },
  { key: "inventory", to: "/inventory", label: "재고", icon: Boxes },
  { key: "orders", to: "/orders", label: "발주", icon: ClipboardList },
  { key: "settings", to: "/settings", label: "더보기", icon: Menu },
];

const APP_TITLE: Record<Exclude<NavKey, "home">, string> = {
  forecast: "매출 예측",
  sales: "판매 데이터",
  inventory: "재고",
  orders: "발주",
  menus: "메뉴 관리",
  settings: "더보기",
};

export interface MainShellProps {
  active: NavKey;
  title?: string;
  back?: string;
  children: ReactNode;
  className?: string;
}

export function MainShell({ active, title, back, children, className }: MainShellProps) {
  const user = useAuthStore((s) => s.user);
  const storeName = user?.store_name ?? "내 매장";
  const userName = user?.name ?? "사장";
  const userInitial = (user?.name ?? "사").slice(0, 1);

  const resolvedBack = back ?? (active === "menus" || active === "sales" ? "/settings" : undefined);
  const appActive: NavKey = active === "menus" || active === "sales" ? "settings" : active;
  const appTitle = title ?? (active === "home" ? storeName : APP_TITLE[active]);
  const appSub = active === "home" && !title ? `${userName}님, 안녕하세요` : null;

  const [notifOpen, setNotifOpen] = useState(false);
  const { items, isPosAlert, unreadCount, markRead, markAllRead, isMarkingAll } =
    useConnectedNotifications();

  const keepRef = useRef<HTMLDivElement | null>(null);
  const [isShrunk, setIsShrunk] = useState(false);
  const [shrinkWidth, setShrinkWidth] = useState<number | null>(null);

  useEffect(() => {
    const syncShrink = () => {
      if (typeof window === "undefined") return;
      const shouldShrink = window.scrollY > 24;
      if (shouldShrink && keepRef.current) {
        const w = keepRef.current.offsetWidth;
        if (w > 0) setShrinkWidth(w + 16);
      }
      setIsShrunk(shouldShrink);
    };

    syncShrink();
    window.addEventListener("scroll", syncShrink, { passive: true });
    window.addEventListener("resize", syncShrink);
    return () => {
      window.removeEventListener("scroll", syncShrink);
      window.removeEventListener("resize", syncShrink);
    };
  }, []);

  const toggleNotif = () => setNotifOpen((prev) => !prev);

  return (
    <div className="min-h-screen">
      {/* 웹 중앙 알약 메뉴 — 스크롤해도 화면 상단 가운데에 고정 */}
      <nav
        aria-label="주 메뉴"
        className="en en-top glass-bar fixed top-4 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-full p-1.5 lg:flex"
      >
        {WEB_NAV.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          if (isActive) {
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-current="page"
                className="flex h-10 items-center gap-2 rounded-full bg-white/90 pr-4 pl-3 text-sm font-semibold whitespace-nowrap text-ink shadow-sm"
              >
                <Icon className="size-5" strokeWidth={2.4} />
                <span>{item.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.key}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              className="flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-white/40 hover:text-ink"
            >
              <Icon className="size-5" />
            </Link>
          );
        })}
      </nav>

      {/* 웹 상단 바 — 브랜드 로고·알림·설정·계정 (스크롤 시 페이지와 함께 올라감) */}
      <header className="en en-top absolute inset-x-0 top-4 z-30 hidden h-14 items-center justify-between px-16 lg:flex xl:px-24">
        <Link
          to="/"
          aria-label="사주라 홈"
          className="text-[1.75rem] leading-none font-extrabold tracking-tight text-brand"
        >
          Sajura
        </Link>

        <div className="flex items-center gap-2">
          <NotificationBellButton
            variant="web"
            open={notifOpen}
            unreadCount={unreadCount}
            onToggle={toggleNotif}
          />
          <Link
            to="/settings"
            aria-label="설정"
            className="glass-bar flex size-12 items-center justify-center rounded-full text-ink-2 hover:text-ink"
          >
            <Settings className="size-5" />
          </Link>
          <Link
            to="/settings/account"
            aria-label="계정"
            className="glass-bar flex h-12 items-center gap-2 rounded-full px-1.5 xl:pr-4"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-white/80 text-sm font-bold text-ink">
              {userInitial}
            </span>
            <span className="hidden text-left leading-tight xl:block">
              <span className="block max-w-[9rem] truncate text-sm font-bold text-ink">
                {storeName}
              </span>
              <span className="block text-xs text-ink-3">{userName}님</span>
            </span>
          </Link>
        </div>
      </header>

      {/* 앱 상단 바 — 아래로 스크롤하면 오른쪽(알림+프로필)만 남고 줄어듦 */}
      <header
        data-shrink
        style={shrinkWidth ? ({ "--shrink-w": `${shrinkWidth}px` } as CSSProperties) : undefined}
        className={cn(
          "en en-top glass-bar pt-safe fixed inset-x-3 top-3 z-30 flex h-14 items-center gap-2 rounded-full pr-2 pl-2 lg:hidden",
          isShrunk && "is-shrunk",
        )}
      >
        {resolvedBack ? (
          <Link
            to={resolvedBack}
            aria-label="뒤로"
            className="shrink-hide flex size-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-white/40"
          >
            <ChevronLeft className="size-6" />
          </Link>
        ) : null}

        <div className={cn("shrink-hide min-w-0 flex-1", !resolvedBack && "pl-3")}>
          {appSub ? <p className="truncate text-xs text-ink-3">{appSub}</p> : null}
          <h1 className="truncate text-[1.05rem] leading-tight font-bold text-ink">{appTitle}</h1>
        </div>

        <div ref={keepRef} data-shrink-keep className="ml-auto flex shrink-0 items-center gap-1">
          <NotificationBellButton
            variant="app"
            open={notifOpen}
            unreadCount={unreadCount}
            onToggle={toggleNotif}
          />
          <Link
            to="/settings/account"
            aria-label="계정"
            className="flex size-9 items-center justify-center rounded-full bg-white/80 text-sm font-bold text-ink"
          >
            {userInitial}
          </Link>
        </div>
      </header>

      {/* 알림 팝오버 (웹·앱 공유) */}
      <NotificationPopover
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={items}
        isPosAlert={isPosAlert}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        isMarkingAll={isMarkingAll}
      />

      {/* 본문 영역 */}
      <main
        style={{ "--d": "0.15s" } as CSSProperties}
        className={cn(
          "en relative z-20 mx-3 mt-[5.25rem] mb-[5.75rem] lg:mx-16 lg:mt-24 lg:mb-8 xl:mx-24",
          className,
        )}
      >
        {children}
      </main>

      {/* 앱 하단 5탭 바 */}
      <nav
        aria-label="하단 메뉴"
        style={{ "--d": "0.25s" } as CSSProperties}
        className="en glass-bar pb-safe fixed inset-x-3 bottom-3 z-30 rounded-full p-1.5 lg:hidden"
      >
        <ul className="grid grid-cols-5 gap-1">
          {APP_TABS.map((tab) => {
            const isActive = tab.key === appActive;
            const Icon = tab.icon;
            return (
              <li key={tab.key}>
                <Link
                  to={tab.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[0.75rem] font-semibold",
                    isActive ? "bg-white/90 text-ink shadow-md" : "text-ink-2",
                  )}
                >
                  <Icon className="size-[1.4rem]" strokeWidth={isActive ? 2.4 : 2} />
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
