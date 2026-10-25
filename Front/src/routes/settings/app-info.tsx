// 앱 정보 — 디자인 핸드오프 §6.11 SET5: 버전, 이용약관, 개인정보처리방침.
// 약관·방침 문서는 아직 법무 검토본이 없어 실제 텍스트 대신 준비 중으로 표시한다.
import { DashboardShell } from "../../components/dashboard/shell";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.1.0";

export default function AppInfoSettingsPage() {
  return (
    <DashboardShell active="settings" title="앱 정보" backTo="/settings">
      <div className="max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="hidden text-[1.75rem] font-bold tracking-tight text-ink lg:block">앱 정보</h1>
        </header>

        <div className="divide-y divide-line-soft rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-ink-2">버전</span>
            <span className="text-sm text-ink-3">{APP_VERSION}</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-ink-2">이용약관</p>
            <p className="mt-1 text-sm text-ink-3">준비 중입니다.</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-ink-2">개인정보처리방침</p>
            <p className="mt-1 text-sm text-ink-3">준비 중입니다.</p>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
