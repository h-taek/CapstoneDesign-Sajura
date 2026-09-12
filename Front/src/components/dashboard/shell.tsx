// 대시보드 공용 셸 — Figma "홈 화면"(node 7:337) 사이드 내비게이션 + 상단바.
import {
  Boxes,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Home,
  LogOut,
  Settings as SettingsIcon,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { logout } from "../../api/endpoints/auth";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth-store";

type NavKey = "home" | "forecast" | "inventory" | "orders" | "recipes" | "settings";

const LINKED_ITEMS: Array<{ key: NavKey; to: string; label: string; icon: typeof Home }> = [
  { key: "home", to: "/", label: "홈", icon: Home },
  { key: "forecast", to: "/forecast", label: "매출예측", icon: TrendingUp },
  { key: "inventory", to: "/inventory", label: "재고관리", icon: Boxes },
  { key: "orders", to: "/orders", label: "발주추천", icon: ClipboardList },
  { key: "recipes", to: "/recipes", label: "레시피 관리", icon: ChefHat },
];

export function DashboardShell({ active, children }: { active: NavKey; children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clear();
      window.location.assign("/login");
    }
  };

  return (
    <div className="grid min-h-dvh grid-cols-[266px_1fr] bg-[#f3f4f6]">
      <aside className="flex flex-col justify-between bg-white p-4">
        <div className="space-y-1">
          <p className="px-2 pb-4 text-2xl font-semibold text-[#7a5eff]">Sajura</p>
          {LINKED_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
                  isActive ? "bg-[#7a5eff]/10 text-[#7a5eff]" : "text-[#364153] hover:bg-[#f3f4f6]",
                )}
              >
                <Icon className="size-5" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="size-4 text-[#c1c6cf]" />
              </Link>
            );
          })}
        </div>

        <div className="space-y-1 border-t border-[#eef1f4] pt-4">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
              active === "settings"
                ? "bg-[#7a5eff]/10 text-[#7a5eff]"
                : "text-[#364153] hover:bg-[#f3f4f6]",
            )}
          >
            <SettingsIcon className="size-5" />
            <span className="flex-1">설정</span>
            <ChevronRight className="size-4 text-[#c1c6cf]" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-base font-medium text-[#364153] hover:bg-[#f3f4f6]"
          >
            <LogOut className="size-5" />
            <span className="flex-1">로그아웃</span>
            <ChevronRight className="size-4 text-[#c1c6cf]" />
          </button>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-[#eef1f4] bg-white px-8 py-4">
          <div>
            <p className="text-lg font-semibold text-[#101828]">{user?.store_name ?? "매장"}</p>
            <p className="text-sm text-[#99a1af]">hello, {user?.name ?? "user"}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="size-10 rounded-full bg-[#f3f4f6] text-sm font-medium text-[#364153]"
            aria-label="계정"
          >
            {(user?.name ?? "U").slice(0, 1)}
          </button>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
