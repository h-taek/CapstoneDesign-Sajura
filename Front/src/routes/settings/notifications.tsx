// 알림 설정 — schema.md에 notifications/push_subscriptions 테이블은 설계돼 있지만
// 아직 BE 모델·API가 없어(알림 발송 자체가 미구현) 정직하게 준비 중으로 표시.
import { DashboardShell } from "../../components/dashboard/shell";

export default function NotificationSettingsPage() {
  return (
    <DashboardShell active="settings">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#101828]">알림 설정</h1>
          <p className="text-sm text-[#99a1af]">재고 부족·발주 알림 수신 여부를 설정합니다.</p>
        </header>
        <div className="rounded-xl border border-dashed border-[#d1d5dc] bg-white p-6 text-sm text-[#99a1af]">
          인앱·이메일·웹푸시 알림 기능은 아직 준비 중입니다.
        </div>
      </div>
    </DashboardShell>
  );
}
