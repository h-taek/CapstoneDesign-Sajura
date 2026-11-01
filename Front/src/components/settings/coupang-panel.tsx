// 쿠팡 담기 확장 설정 판 — 사주라 Chrome 확장 연결 여부 및 버전 확인.
import { useEffect, useState } from "react";
import { pingExtension } from "../../lib/extension";
import { FollowPanel } from "../shell/follow-panel";

export function CoupangPanel({ onBack }: { onBack?: () => void }) {
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    pingExtension().then((res) => {
      setChecked(true);
      if (res.ok) {
        setExtensionVersion(res.version);
      } else {
        setExtensionVersion(null);
      }
    });
  }, []);

  return (
    <FollowPanel
      title="쿠팡 담기 확장"
      aria-label="쿠팡 담기 확장"
      className="lg:col-span-3"
      {...(onBack ? { onClose: onBack } : {})}
    >
      <div className="mt-4">
        {checked && extensionVersion ? (
          <>
            <p className="text-lg font-bold text-ink">
              사주라 확장 <span className="font-semibold text-ok">연결됨</span>
            </p>
            <p className="mt-0.5 text-sm text-ink-2">
              버전 {extensionVersion} · 이 브라우저에서 [쿠팡 담기]를 쓸 수 있어요
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-ink">
              사주라 확장 <span className="font-semibold text-warn">설치 안 됨</span>
            </p>
            <p className="mt-0.5 text-sm text-ink-2">
              PC 크롬에 사주라 확장을 설치하면 추천발주에서 쿠팡 장바구니에 바로 담을 수 있어요
            </p>
          </>
        )}
      </div>
    </FollowPanel>
  );
}
