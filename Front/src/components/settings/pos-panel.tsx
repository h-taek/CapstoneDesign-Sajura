// POS 연동 설정 판 및 CSV 템플릿 다운로드. 토스 연결·지금 동기화 (01_basic_design.md §3.4.3).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Upload } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  type PosStatus,
  createPos,
  getPos,
  getPosStatus,
  syncPos,
  updatePos,
} from "../../api/endpoints/pos";
import tossLogo from "../../assets/pos/toss-logo-white.png";
import { formatMonthDayTime } from "../../lib/format";
import { FollowPanel } from "../shell/follow-panel";
import { extractApiMessage } from "./upload-panel";

const PRIMARY_BTN =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-[0.95rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-ink-3/40";
// 토스 연결 — 기본 버튼 모양에 Toss Blue(#0064FF)
const TOSS_BTN =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#0064FF] px-5 text-[0.95rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#0064FF]/90";
const SECONDARY_BTN =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/80 px-5 text-[0.95rem] font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60";

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

// 연결 직후 첫 동기화(arq)가 끝나기 전 — 마지막 동기화 시각이 아직 없다
function isReceiving(s: PosStatus | undefined): boolean {
  return s?.status === "CONNECTED" && !s.last_synced_at;
}

export function PosPanel({ onBack, onOpenUpload }: PosPanelProps) {
  const queryClient = useQueryClient();
  const { data: posStatus } = useQuery<PosStatus>({
    queryKey: ["pos", "status"],
    queryFn: getPosStatus,
    staleTime: 60_000,
    refetchInterval: (q) => (isReceiving(q.state.data) ? 5_000 : false),
  });
  // 열려 있으면 입력 중인 토스 가맹점 ID
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const status = posStatus?.status ?? "CSV_MODE";
  const lastSync = posStatus?.last_synced_at ? formatMonthDayTime(posStatus.last_synced_at) : "";
  const receiving = isReceiving(posStatus);

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: ["pos"] });

  const connect = useMutation({
    // 연동 정보가 없으면(CSV 모드) 새로 등록, 있으면 가맹점 ID를 바꾼다 — BE가 첫 동기화를 시작한다
    mutationFn: (id: string) =>
      status === "CSV_MODE"
        ? createPos({ pos_type: "TOSSPLACE", store_code: id })
        : updatePos({ pos_type: "TOSSPLACE", store_code: id }),
    onSuccess: () => {
      setMerchantId(null);
      setNotice(null);
      void refreshStatus();
    },
    onError: async (e) =>
      setNotice({ ok: false, text: await extractApiMessage(e, "토스에 연결하지 못했어요") }),
  });

  const sync = useMutation({
    mutationFn: syncPos,
    onMutate: () => setNotice(null),
    onSuccess: (r) =>
      setNotice({ ok: true, text: `판매 ${r.records_synced.toLocaleString()}건을 새로 받았어요` }),
    onError: async (e) =>
      setNotice({ ok: false, text: await extractApiMessage(e, "동기화하지 못했어요") }),
    onSettled: () => void refreshStatus(),
  });

  async function openConnectForm() {
    setNotice(null);
    if (status === "CSV_MODE") {
      setMerchantId("");
      return;
    }
    const pos = await getPos().catch(() => null);
    setMerchantId(pos?.store_code ?? "");
  }

  function submitConnect(e: FormEvent) {
    e.preventDefault();
    const id = merchantId?.trim();
    if (!id) {
      setNotice({ ok: false, text: "토스 가맹점 ID를 입력하세요" });
      return;
    }
    connect.mutate(id);
  }

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
            {receiving ? (
              <p className="mt-0.5 text-sm text-ink-2">판매 데이터를 받는 중이에요</p>
            ) : lastSync ? (
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
            {status === "CSV_MODE" ? (
              <button type="button" onClick={openConnectForm} className={TOSS_BTN}>
                <img src={tossLogo} alt="토스" className="h-[18px] w-auto" />
                연결
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-[0.95rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-ink-3/40"
            >
              <Upload className="size-4" />
              매출 올리기
            </button>
            <button type="button" onClick={downloadSalesCsvTemplate} className={SECONDARY_BTN}>
              <Download className="size-4" />
              CSV 양식 받기
            </button>
            {status === "DISCONNECTED" ? (
              <button type="button" onClick={openConnectForm} className={SECONDARY_BTN}>
                다시 연동
              </button>
            ) : null}
          </>
        ) : null}

        {status === "CONNECTED" || status === "ERROR" ? (
          <>
            <button
              type="button"
              onClick={() => sync.mutate()}
              disabled={sync.isPending || receiving}
              className={status === "ERROR" ? SECONDARY_BTN : PRIMARY_BTN}
            >
              <RefreshCw className="size-4" />
              {sync.isPending ? "받는 중…" : "지금 동기화"}
            </button>
            <button
              type="button"
              onClick={openConnectForm}
              className={status === "ERROR" ? PRIMARY_BTN : SECONDARY_BTN}
            >
              다시 연동
            </button>
          </>
        ) : null}
      </div>

      {notice ? (
        <p
          className={`mt-3 text-sm ${notice.ok ? "text-ink-2" : "text-danger"}`}
          role={notice.ok ? "status" : "alert"}
        >
          {notice.text}
        </p>
      ) : null}

      {merchantId !== null ? (
        <form className="mt-4 space-y-2" onSubmit={submitConnect}>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            토스 가맹점 ID
            <input
              type="text"
              autoComplete="off"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>
          <p className="text-sm text-ink-2">
            연결하면 지난 판매를 모두 받아 와요. 같은 날의 CSV 매출은 토스 매출로 바뀌어요
          </p>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={connect.isPending} className={PRIMARY_BTN}>
              {connect.isPending ? "연결 중…" : "연결"}
            </button>
            <button type="button" onClick={() => setMerchantId(null)} className={SECONDARY_BTN}>
              취소
            </button>
          </div>
        </form>
      ) : null}

      <section className="mt-6 border-t border-white/70 pt-5">
        <h3 className="text-sm font-bold text-ink">POS API 연동</h3>
        <p className="mt-1 text-sm text-ink-2">키움페이·OKPOS 연동은 준비 중이에요</p>
      </section>
    </FollowPanel>
  );
}
