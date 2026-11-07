// 안내 창 — 제목·한 줄 안내·[닫기]. 아직 없는 기능(약관 본문, 비밀번호 재설정)을 누르면 띄운다.
// showModal이 포커스 가두기·Esc 닫기를 맡는다.
import { useEffect, useId, useRef } from "react";
import { Button } from "./button";

export function NoticeDialog({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-3xl border-0 p-6 text-left glass-strong backdrop:bg-ink/40"
    >
      <h2 id={titleId} className="text-lg font-bold text-ink">
        {title}
      </h2>
      <p className="mt-2 text-[0.95rem] text-ink-2">{message}</p>
      <Button size="lg" className="mt-6 w-full" onClick={() => ref.current?.close()}>
        닫기
      </Button>
    </dialog>
  );
}
