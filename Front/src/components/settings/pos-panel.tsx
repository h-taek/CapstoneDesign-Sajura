// POS 연동 설정 판 및 CSV 템플릿 다운로드.
import { useQuery } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { type PosStatus, getPosStatus } from "../../api/endpoints/pos";
import { formatMonthDayTime } from "../../lib/format";
import { FollowPanel } from "../shell/follow-panel";

const TEMPLATE_HEADER =
  '기간,상품명,상품코드,카테고리,판매건수,상품가격,옵션가격,할인,"실 판매 금액 (할인, 옵션 포함)",부가세액';
const TEMPLATE_SAMPLES = [
  "2026-01-15,아메리카노,ITEM-001,음료,3,4500,0,0,13500,1350",
  "2026-01-15,카페라떼,ITEM-002,음료,1,5000,500,0,5500,550",
];

export function downloadSalesCsvTemplate() {
  const csv = `\uFEFF${TEMPLATE_HEADER}\n${TEMPLATE_SAMPLES.join("\n")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sales_template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface PosPanelProps {
  onBack?: () => void;
  onOpenUpload: () => void;
}

export function PosPanel({ onBack, onOpenUpload }: PosPanelProps) {
  const { data: posStatus } = useQuery<PosStatus>({
    queryKey: ["pos", "status"],
    queryFn: getPosStatus,
    staleTime: 60_000,
  });

  const status = posStatus?.status ?? "CSV_MODE";
  const lastSync = posStatus?.last_synced_at ? formatMonthDayTime(posStatus.last_synced_at) : "";

  return (
    <FollowPanel
      title="POS 연동"
      aria-label="POS 연동"
      className="lg:col-span-3"
      {...(onBack ? { onClose: onBack } : {})}
    >
      <div className="mt-4">
        {status === "CSV_MODE" && (
          <>
            <p className="text-lg font-bold text-ink">CSV 모드</p>
            {lastSync ? (
              <p className="mt-0.5 text-sm text-ink-2">마지막 업로드 {lastSync}</p>
            ) : null}
          </>
        )}
        {status === "CONNECTED" && (
          <>
            <p className="text-lg font-bold text-ink">
              토스플레이스 <span className="font-semibold text-ok">연결됨</span>
            </p>
            {lastSync ? (
              <p className="mt-0.5 text-sm text-ink-2">마지막 동기화 {lastSync}</p>
            ) : null}
          </>
        )}
        {status === "ERROR" && (
          <>
            <p className="text-lg font-bold text-ink">
              토스플레이스 <span className="font-semibold text-danger">연동 끊김</span>
            </p>
            <p className="mt-0.5 text-sm text-ink-2">
              {posStatus?.error_message ||
                (lastSync
                  ? `${lastSync}부터 새 매출이 들어오지 않아요`
                  : "새 매출이 들어오지 않아요")}
            </p>
          </>
        )}
        {status === "DISCONNECTED" && (
          <>
            <p className="text-lg font-bold text-ink">미연동</p>
            <p className="mt-0.5 text-sm text-ink-2">POS가 연결되지 않았어요</p>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status === "CSV_MODE" || status === "DISCONNECTED" ? (
          <>
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-[0.95rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-ink-3/40"
            >
              <Upload className="size-4" />
              매출 올리기
            </button>
            <button
              type="button"
              onClick={downloadSalesCsvTemplate}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/80 px-5 text-[0.95rem] font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-white/30"
            >
              <Download className="size-4" />
              CSV 양식 받기
            </button>
          </>
        ) : null}

        {status === "ERROR" ? (
          <button
            type="button"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-[0.95rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-ink-3/40"
          >
            다시 연동
          </button>
        ) : null}

        {status === "CONNECTED" ? (
          <button
            type="button"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/80 px-5 text-[0.95rem] font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-white/30"
          >
            다시 연동
          </button>
        ) : null}
      </div>

      <section className="mt-6 border-t border-white/70 pt-5">
        <h3 className="text-sm font-bold text-ink">POS API 연동</h3>
        <p className="mt-1 text-sm text-ink-2">토스플레이스·키움페이·OKPOS 연동은 준비 중이에요</p>
      </section>
    </FollowPanel>
  );
}
