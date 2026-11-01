// 앱 정보 판 — 앱 버전, 이용약관, 개인정보처리방침.
import { FollowPanel } from "../shell/follow-panel";

export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.1.0";

export function AppInfoPanel({ onBack }: { onBack?: () => void }) {
  return (
    <FollowPanel
      title="앱 정보"
      aria-label="앱 정보"
      className="lg:col-span-3"
      {...(onBack ? { onClose: onBack } : {})}
    >
      <ul className="mt-4 divide-y divide-white/70">
        <li className="flex items-center justify-between py-3">
          <span className="text-[0.95rem] font-semibold text-ink">버전</span>
          <span className="tabular text-sm text-ink-2">{APP_VERSION}</span>
        </li>
        <li className="flex items-center justify-between py-3">
          <span className="text-[0.95rem] font-semibold text-ink">이용약관</span>
          <span className="text-sm text-ink-2">준비 중</span>
        </li>
        <li className="flex items-center justify-between py-3">
          <span className="text-[0.95rem] font-semibold text-ink">개인정보처리방침</span>
          <span className="text-sm text-ink-2">준비 중</span>
        </li>
      </ul>
    </FollowPanel>
  );
}
