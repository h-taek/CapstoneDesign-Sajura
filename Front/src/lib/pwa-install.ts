// 홈 화면 설치(PWA) 상태 — 04_fe.md §6.
// 안드로이드·PC 크롬: beforeinstallprompt를 잡아 두었다가 버튼으로 설치 창을 띄운다.
// 아이폰 사파리: 설치 API가 없어 "공유 → 홈 화면에 추가" 안내를 보여준다.
import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sajura:install-dismissed";

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

// main.tsx에서 import해 앱 시작 직후부터 이벤트를 받는다(늦게 등록하면 놓친다).
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

let dismissed = typeof window !== "undefined" ? readDismissed() : false;

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+는 Mac으로 보고하므로 터치 지원으로 구분한다.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

interface InstallState {
  /** 안드로이드·PC 크롬에서 설치 창을 바로 띄울 수 있다 */
  canPrompt: boolean;
  /** 아이폰·아이패드 — 수동 안내가 필요하다 */
  ios: boolean;
  /** 이미 홈 화면 앱으로 실행 중이거나 방금 설치했다 */
  installed: boolean;
  /** 사용자가 배너를 닫았다 */
  dismissed: boolean;
}

let snapshot: InstallState | null = null;
function getSnapshot(): InstallState {
  const next: InstallState = {
    canPrompt: deferred !== null,
    ios: isIOS(),
    installed: installed || isStandalone(),
    dismissed,
  };
  if (
    snapshot &&
    snapshot.canPrompt === next.canPrompt &&
    snapshot.ios === next.ios &&
    snapshot.installed === next.installed &&
    snapshot.dismissed === next.dismissed
  ) {
    return snapshot;
  }
  snapshot = next;
  return next;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 설치 창 띄우기 — 설치했으면 true */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  await event.prompt();
  const { outcome } = await event.userChoice;
  deferred = null;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome === "accepted";
}

export function dismissInstallBanner() {
  dismissed = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // 저장이 막힌 환경(사생활 보호 모드 등)에서는 이번 실행에서만 숨긴다.
  }
  emit();
}
