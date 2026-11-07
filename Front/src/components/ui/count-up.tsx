// 숫자가 0부터 올라가며 나타난다 — 화면 전환 움직임(index.css '화면 전환'). 동작 줄이기 설정이면 바로 최종 값.
import { useEffect, useRef, useState } from "react";

const DURATION = 900;

export function prefersMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches === true
  );
}

// 소수 자리는 최종 값만큼만 보인다 — 0.5kg가 올라가는 중에 0.4837kg처럼 보이지 않게
function decimalsOf(v: number): number {
  const s = String(v);
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : Math.min(3, s.length - dot - 1);
}

interface CountUpProps {
  value: number;
  format: (v: number) => string;
}

export function CountUp({ value, format }: CountUpProps) {
  const [shown, setShown] = useState(() => (prefersMotion() ? 0 : value));
  const shownRef = useRef(shown);

  useEffect(() => {
    if (!prefersMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const from = shownRef.current;
    const dp = decimalsOf(value);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - (1 - t) ** 3;
      const v = t === 1 ? value : Number((from + (value - from) * eased).toFixed(dp));
      shownRef.current = v;
      setShown(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(shown)}</>;
}
