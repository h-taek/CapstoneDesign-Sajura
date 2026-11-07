// 홈 화면 설치 안내 — 앱(모바일) 홈 상단 배너 + 설정/더보기 메뉴 항목.
// 안드로이드·PC 크롬은 설치 창(canPrompt), 비지원 브라우저는 OS별(iOS vs Android/기타) 안내 시트.
import { MoreVertical, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dismissInstallBanner, promptInstall, useInstallState } from "../../lib/pwa-install";
import { Button } from "../ui/button";

/** 설치를 시작한다 — canPrompt면 설치 창, 지원하지 않거나 실패하면 안내 창 */
export function useStartInstall() {
  const state = useInstallState();
  const [guideOpen, setGuideOpen] = useState(false);
  const start = async () => {
    if (state.canPrompt) {
      const ok = await promptInstall();
      if (!ok && !state.installed) {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };
  return { state, start, guideOpen, closeGuide: () => setGuideOpen(false) };
}

export function InstallBanner() {
  const { state, start, guideOpen, closeGuide } = useStartInstall();
  if (state.installed || state.dismissed) return null;

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
          <button type="button" onClick={start} className="text-sm font-semibold text-brand">
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
      {guideOpen && <InstallGuideSheet ios={state.ios} onClose={closeGuide} />}
    </>
  );
}

/** 더보기·설정 화면용 — 이미 설치했으면 숨긴다 */
export function InstallMenuButton({ onOpenGuide }: { onOpenGuide?: () => void }) {
  const { state, start, guideOpen, closeGuide } = useStartInstall();
  if (state.installed) return null;

  const handleClick = () => {
    if (onOpenGuide) {
      if (state.canPrompt) {
        promptInstall().then((ok) => {
          if (!ok && !state.installed) onOpenGuide();
        });
      } else {
        onOpenGuide();
      }
      return;
    }
    start();
  };

  return (
    <>
      <li>
        <button
          type="button"
          onClick={handleClick}
          className="flex w-full items-center gap-3.5 px-5 py-2.5 text-left transition-colors hover:bg-white/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Smartphone className="size-[1.125rem]" />
          </span>
          <span className="min-w-0 flex-1 text-[1.05rem] font-semibold text-ink">
            홈 화면에 설치
          </span>
          <span className="size-5 shrink-0 text-ink-4">
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </button>
      </li>
      {!onOpenGuide && guideOpen && <InstallGuideSheet ios={state.ios} onClose={closeGuide} />}
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

  // 모달로 띄워야 포커스가 창 안에 갇히고 Esc로 닫히며 뒤 화면을 누를 수 없다
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const close = () => ref.current?.close();

  // 앱 폭은 화면 아래에 붙는 판, 넓은 화면은 가운데
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="install-guide-title"
      className="mx-auto mt-auto mb-0 w-full max-w-md border-0 bg-transparent px-6 pt-6 pb-6 rounded-t-3xl glass-strong backdrop:bg-ink/40 sm:mb-auto sm:rounded-3xl"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 id="install-guide-title" className="text-xl font-bold text-ink">
          홈 화면에 추가하는 방법
        </h2>
        <button
          type="button"
          onClick={close}
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
      <Button
        type="button"
        size="xl"
        className="mt-6 w-full rounded-2xl text-lg font-semibold"
        onClick={close}
      >
        확인했어요
      </Button>
    </dialog>
  );
}
