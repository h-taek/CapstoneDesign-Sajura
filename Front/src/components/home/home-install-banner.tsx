// 홈 화면 설치 안내 배너 및 아이폰 가이드 시트 — 06_home.html.
import { PlusSquare, Share, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { dismissInstallBanner, promptInstall, useInstallState } from "../../lib/pwa-install";

export function HomeInstallBanner() {
  const state = useInstallState();
  const [guideOpen, setGuideOpen] = useState(false);

  if (state.installed || state.dismissed || (!state.canPrompt && !state.ios)) {
    return null;
  }

  const handleAction = async () => {
    if (state.canPrompt) {
      await promptInstall();
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <div
        id="install-banner"
        className="relative mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 pr-12 glass-card lg:hidden"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-lg font-black text-white">
          사
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.95rem] leading-snug font-bold text-ink">홈 화면에 사주라 추가</p>
          <button type="button" onClick={handleAction} className="text-sm font-semibold text-brand">
            {state.canPrompt ? "홈 화면에 설치" : "설치 방법 보기"}
          </button>
        </div>
        <button
          type="button"
          onClick={dismissInstallBanner}
          aria-label="설치 안내 닫기"
          className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-white/60"
        >
          <X className="size-5" />
        </button>
      </div>

      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
          {/* biome-ignore lint/a11y/useSemanticElements: mockup dialog structure */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
            className="w-full max-w-md rounded-t-3xl px-6 pt-6 pb-6 sm:rounded-3xl glass-strong"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="install-guide-title" className="text-xl font-bold text-ink">
                홈 화면에 추가하는 방법
              </h2>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="닫기"
                className="flex size-10 items-center justify-center rounded-full text-ink-3 hover:bg-subtle"
              >
                <X className="size-6" />
              </button>
            </div>
            <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-[0.95rem] text-warn">
              아이폰은 <strong>사파리(Safari)</strong>에서 열어야 추가할 수 있어요.
            </p>
            <ol className="space-y-4">
              <li className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <Share className="size-6" />
                </span>
                <p className="text-base leading-snug text-ink">
                  <strong className="mr-1 text-brand">1.</strong>화면 아래(아이패드는 위)의 공유
                  버튼을 누르세요.
                </p>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <PlusSquare className="size-6" />
                </span>
                <p className="text-base leading-snug text-ink">
                  <strong className="mr-1 text-brand">2.</strong>목록을 내려 &apos;홈 화면에
                  추가&apos;를 누르세요.
                </p>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <Smartphone className="size-6" />
                </span>
                <p className="text-base leading-snug text-ink">
                  <strong className="mr-1 text-brand">3.</strong>오른쪽 위 &apos;추가&apos;를 누르면
                  홈 화면에 사주라가 생겨요.
                </p>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="mt-6 inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-lg font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong"
            >
              확인했어요
            </button>
          </div>
        </div>
      )}
    </>
  );
}
