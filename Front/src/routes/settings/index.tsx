// 설정 허브(앱에서는 "더보기") — 디자인 핸드오프 §6.11 SET1~5 + 하단 탭에 없는 메뉴.
// 카카오톡 "더보기"처럼 큰 글자 목록 한 줄 = 화면 하나.
import {
  Bell,
  ChefHat,
  ChevronRight,
  CreditCard,
  Info,
  LogOut,
  Store,
  Upload,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { DashboardShell, signOut } from "../../components/dashboard/shell";
import { InstallMenuButton } from "../../components/pwa/install-banner";
import { Card } from "../../components/ui/card";
import { useAuthStore } from "../../stores/auth-store";

type Item = { to: string; label: string; description: string; icon: LucideIcon };

// 앱 하단 탭에 없는 업무 화면 — 웹은 상단 메뉴에 있으니 앱에서만 보인다.
const WORK_ITEMS: Item[] = [
  {
    to: "/sales/upload",
    label: "매출 올리기",
    description: "POS에서 받은 매출 CSV 파일 올리기",
    icon: Upload,
  },
  {
    to: "/recipes",
    label: "레시피 관리",
    description: "메뉴 하나에 들어가는 재료와 양",
    icon: ChefHat,
  },
];

const SETTING_ITEMS: Item[] = [
  {
    to: "/settings/pos",
    label: "POS 연동 관리",
    description: "POS 연동 상태 확인, CSV 템플릿 다운로드·업로드",
    icon: Store,
  },
  {
    to: "/settings/pricing",
    label: "단가 관리",
    description: "메뉴별 판매 단가 조회 및 수정",
    icon: CreditCard,
  },
  {
    to: "/settings/notifications",
    label: "알림 설정",
    description: "재고 부족·발주 알림 수신 설정",
    icon: Bell,
  },
  {
    to: "/settings/account",
    label: "계정 정보",
    description: "이름, 매장 정보, 비밀번호 변경",
    icon: User,
  },
  {
    to: "/settings/app-info",
    label: "앱 정보",
    description: "버전, 이용약관, 개인정보처리방침",
    icon: Info,
  },
];

function MenuList({ items }: { items: Item[] }) {
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line-soft">
        {items.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.to}>
              <Link
                to={s.to}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-subtle active:bg-subtle"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.05rem] font-bold text-ink">{s.label}</span>
                  <span className="block text-sm text-ink-3">{s.description}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-4" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function SettingsHubPage() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  return (
    <DashboardShell active="settings">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="hidden text-[1.75rem] font-bold tracking-tight text-ink lg:block">설정</h1>

        <Card className="flex items-center gap-4 p-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">
            {(user?.name ?? "U").slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-ink">{user?.store_name ?? "내 매장"}</p>
            <p className="truncate text-[0.95rem] text-ink-3">
              {user?.name ?? "사장"}님 · {user?.email}
            </p>
          </div>
        </Card>

        <section className="space-y-2 lg:hidden">
          <h2 className="px-1 text-sm font-semibold text-ink-3">자주 쓰는 메뉴</h2>
          <MenuList items={WORK_ITEMS} />
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-ink-3">설정</h2>
          <MenuList items={SETTING_ITEMS} />
        </section>

        <InstallMenuButton />

        <button
          type="button"
          onClick={() => signOut(clear)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white text-base font-semibold text-ink-2 hover:bg-subtle"
        >
          <LogOut className="size-5" /> 로그아웃
        </button>
      </div>
    </DashboardShell>
  );
}
