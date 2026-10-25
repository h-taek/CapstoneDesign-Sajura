// 홈 화면 설치 안내 — 앱(모바일) 홈 상단 배너 + 더보기 메뉴 항목.
// 안드로이드는 버튼 한 번으로 설치 창, 아이폰은 그림 순서대로 따라 하는 안내 창.
import { MoreVertical, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { dismissInstallBanner, promptInstall, useInstallState } from "../../lib/pwa-install";
import { Button } from "../ui/button";

/** 설치를 시작한다 — 안드로이드는 설치 창, 아이폰·그 외는 안내 창. */
export function useStartInstall() {
  const state = useInstallState();
  const [guideOpen, setGuideOpen] = useState(false);
  const start = async () => {
    if (state.canPrompt) {
      await promptInstall();
      return;
    }
    setGuideOpen(true);
  };
  return { state, start, guideOpen, closeGuide: () => setGuideOpen(false) };
}

export function InstallBanner() {
  const { state, start, guideOpen, closeGuide } = useStartInstall();
  if (state.installed || state.dismissed || (!state.canPrompt && !state.ios)) return null;

  return (
    <>
      <div className="relative flex items-center gap-4 rounded-2xl border border-brand-tint bg-brand-soft p-4 pr-12 lg:hidden">
        <img src="/icon-192.png" alt="" className="size-14 shrink-0 rounded-2xl shadow-card" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base leading-snug font-bold text-ink">
            사주라를 휴대폰 홈 화면에 추가하세요
          </p>
          <p className="text-sm text-ink-2">앱처럼 아이콘을 눌러 바로 열 수 있어요.</p>
          <Button size="md" onClick={start}>
            <Smartphone className="size-5" />
            {state.canPrompt ? "홈 화면에 설치" : "설치 방법 보기"}
          </Button>
        </div>
        <button
          type="button"
          onClick={dismissInstallBanner}
          aria-label="설치 안내 닫기"
          className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full text-ink-3 hover:bg-white"
        >
          <X className="size-5" />
        </button>
      </div>
      {guideOpen && <InstallGuideSheet ios={state.ios} onClose={closeGuide} />}
    </>
  );
}

/** 더보기·설정 화면용 — 이미 설치했으면 숨긴다. */
export function InstallMenuButton() {
  const { state, start, guideOpen, closeGuide } = useStartInstall();
  if (state.installed) return null;
  return (
    <>
      <button
        type="button"
        onClick={start}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-white hover:bg-brand-strong"
      >
        <Smartphone className="size-5" /> 홈 화면에 앱으로 설치하기
      </button>
      {guideOpen && <InstallGuideSheet ios={state.ios} onClose={closeGuide} />}
    </>
  );
}

export function InstallGuideSheet({ ios, onClose }: { ios: boolean; onClose: () => void }) {
  const steps = ios
    ? [
        { icon: Share, text: "화면 아래(아이패드는 위)의 공유 버튼을 누르세요." },
        { icon: PlusSquare, text: "목록을 내려 '홈 화면에 추가'를 누르세요." },
        { icon: Smartphone, text: "오른쪽 위 '추가'를 누르면 홈 화면에 사주라가 생겨요." },
      ]
    : [
        { icon: MoreVertical, text: "브라우저 오른쪽 위 점 세 개(⋮) 메뉴를 누르세요." },
        { icon: PlusSquare, text: "'홈 화면에 추가' 또는 '앱 설치'를 누르세요." },
        { icon: Smartphone, text: "'설치'를 누르면 홈 화면에 사주라가 생겨요." },
      ];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
      {/* biome-ignore lint/a11y/useSemanticElements: <dialog>의 UA 기본 배치가 하단 시트와 맞지 않아 div로 둔다 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
        className="w-full max-w-md rounded-t-3xl bg-white px-6 pt-6 shadow-pop sm:rounded-3xl"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="install-guide-title" className="text-xl font-bold text-ink">
            홈 화면에 추가하는 방법
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-full text-ink-3 hover:bg-subtle"
          >
            <X className="size-6" />
          </button>
        </div>
        {ios ? (
          <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-[0.95rem] text-warn">
            아이폰은 <strong>사파리(Safari)</strong>에서 열어야 추가할 수 있어요.
          </p>
        ) : null}
        <ol className="space-y-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.text} className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <Icon className="size-6" />
                </span>
                <p className="text-base leading-snug text-ink">
                  <strong className="mr-1 text-brand">{i + 1}.</strong>
                  {s.text}
                </p>
              </li>
            );
          })}
        </ol>
        <Button size="xl" className="mt-6 w-full" onClick={onClose}>
          확인했어요
        </Button>
      </div>
    </div>,
    document.body,
  );
}
