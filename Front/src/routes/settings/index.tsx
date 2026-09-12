// 설정 허브 — 디자인 핸드오프 §6.11 SET1~5: POS 연동 관리 / 단가 관리 / 알림 설정 / 계정 정보 / 앱 정보.
import { Bell, CreditCard, Info, Store, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { DashboardShell } from "../../components/dashboard/shell";

const SECTIONS: Array<{ to: string; label: string; description: string; icon: LucideIcon }> = [
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

export default function SettingsHubPage() {
  return (
    <DashboardShell active="settings">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#101828]">설정</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="flex items-start gap-4 rounded-xl border border-[#d1d5dc] bg-white p-5 transition-colors hover:border-[#7a5eff]"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#7a5eff]/10 text-[#7a5eff]">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block text-base font-semibold text-[#101828]">{s.label}</span>
                  <span className="block text-sm text-[#99a1af]">{s.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
