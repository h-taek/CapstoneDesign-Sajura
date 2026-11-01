// 매출 CSV 올리기 판 — POS 연동 판 안에서 이어서 열림.
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, FileSpreadsheet, Info } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import {
  type CSVUploadColumns,
  type CSVUploadResponse,
  uploadSalesCsv,
} from "../../api/endpoints/sales";
import { FollowPanel } from "../shell/follow-panel";

const MAX_BYTES = 50 * 1024 * 1024;

export const DEFAULT_COLUMNS: CSVUploadColumns = {
  date_column: "기간",
  menu_column: "상품명",
  quantity_column: "판매건수",
  price_column: "실 판매 금액 (할인, 옵션 포함)",
  external_sale_id_column: "",
};

export async function extractApiMessage(
  err: unknown,
  fallback = "업로드에 실패했습니다.",
): Promise<string> {
  if (typeof err === "object" && err !== null && "response" in err) {
    const res = (err as { response?: Response }).response;
    if (res) {
      try {
        const body = (await res.clone().json()) as { message?: string; error?: string };
        return body.message ?? body.error ?? fallback;
      } catch {
        // ignore
      }
    }
  }
  return err instanceof Error ? err.message : fallback;
}

export function UploadPanel({ onBack }: { onBack?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<CSVUploadColumns>(DEFAULT_COLUMNS);
  const [autoCreateMenus, setAutoCreateMenus] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [missingColumn, setMissingColumn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation<CSVUploadResponse, unknown, void>({
    mutationFn: async () => {
      if (!file) throw new Error("파일을 선택하세요.");
      return uploadSalesCsv(file, columns, { auto_create_menus: autoCreateMenus });
    },
    onMutate: () => {
      setServerError(null);
      setMissingColumn(null);
    },
    onError: async (err) => {
      const msg = await extractApiMessage(err);
      setServerError(msg);
      if (msg.includes("컬럼을 찾지 못했어요") || msg.includes("컬럼")) {
        const match = msg.match(/'([^']+)'/);
        if (match?.[1]) {
          setMissingColumn(match[1]);
        }
      }
    },
  });

  function pickFile(next: File | null) {
    setFileError(null);
    setServerError(null);
    setMissingColumn(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.name.toLowerCase().endsWith(".csv")) {
      setFileError("CSV(.csv) 파일만 업로드할 수 있습니다.");
      return;
    }
    if (next.size === 0) {
      setFileError("빈 파일입니다.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFileError("파일이 너무 큽니다 (최대 50MB).");
      return;
    }
    setFile(next);
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  const result = mutation.data;
  const isUploading = mutation.isPending;

  return (
    <FollowPanel
      title="매출 올리기"
      aria-label="매출 올리기"
      className="lg:col-span-3"
      {...(onBack ? { onClose: onBack } : {})}
    >
      {/* 파일 드롭존 */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-4 flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-center transition-colors hover:bg-white/30 ${
          dragging ? "border-brand bg-white/30" : "border-white/80"
        }`}
        data-testid="dropzone"
      >
        <FileSpreadsheet className="size-6 text-brand" />
        {file ? (
          <>
            <p className="text-[0.95rem] font-semibold text-ink">{file.name}</p>
            <p className="text-sm text-ink-2">{(file.size / 1024).toFixed(1)}KB · 눌러서 바꾸기</p>
          </>
        ) : (
          <>
            <p className="text-[0.95rem] font-semibold text-ink">
              CSV 파일을 끌어다 놓거나 눌러서 고르기
            </p>
            <p className="text-sm text-ink-2">UTF-8 · 최대 50MB</p>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        data-testid="file-input"
      />

      {fileError && (
        <p role="alert" className="mt-2 text-center text-sm font-semibold text-danger">
          {fileError}
        </p>
      )}

      {/* 컬럼 이름 */}
      <details open={Boolean(missingColumn)} className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm font-bold text-ink">
          컬럼 이름
          {missingColumn ? (
            <span className="font-semibold text-danger">· '{missingColumn}' 없음</span>
          ) : (
            <span className="font-normal text-ink-2">· 사주라 양식</span>
          )}
          <ChevronDown className="ml-auto size-4 text-ink-2 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            날짜
            <input
              type="text"
              value={columns.date_column}
              onChange={(e) => setColumns({ ...columns, date_column: e.target.value })}
              className={`h-11 w-full rounded-full border bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none ${
                missingColumn === columns.date_column ? "border-danger" : "border-white/80"
              }`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            메뉴명
            <input
              type="text"
              value={columns.menu_column}
              onChange={(e) => setColumns({ ...columns, menu_column: e.target.value })}
              className={`h-11 w-full rounded-full border bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none ${
                missingColumn === columns.menu_column ? "border-danger" : "border-white/80"
              }`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            수량
            <input
              type="text"
              value={columns.quantity_column}
              onChange={(e) => setColumns({ ...columns, quantity_column: e.target.value })}
              className={`h-11 w-full rounded-full border bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none ${
                missingColumn === columns.quantity_column ? "border-danger" : "border-white/80"
              }`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            금액
            <input
              type="text"
              value={columns.price_column}
              onChange={(e) => setColumns({ ...columns, price_column: e.target.value })}
              className={`h-11 w-full rounded-full border bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none ${
                missingColumn === columns.price_column ? "border-danger" : "border-white/80"
              }`}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold text-ink-2">
            <span>
              영수증번호 (선택){" "}
              <span
                title="비워 두면 메뉴와 판매 시각으로 같은 판매를 걸러요. 영수증 단위로는 구분하지 못해요."
                className="inline-flex cursor-help align-middle text-ink-3"
              >
                <Info className="size-4" />
              </span>
            </span>
            <input
              type="text"
              value={columns.external_sale_id_column ?? ""}
              onChange={(e) => setColumns({ ...columns, external_sale_id_column: e.target.value })}
              className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>
        </div>
      </details>

      {/* 없는 메뉴 자동 등록 */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-ink">
          없는 메뉴 자동 등록{" "}
          <span
            title="CSV에만 있는 메뉴를 카테고리 '자동등록'으로 메뉴 관리에 더해요. 판매가는 금액÷수량, 재고 차감은 꺼진 채로 들어가요."
            className="inline-flex cursor-help align-middle text-ink-3"
          >
            <Info className="size-4" />
          </span>
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={autoCreateMenus}
          aria-label="없는 메뉴 자동 등록"
          data-testid="auto-create-menus"
          onClick={() => setAutoCreateMenus(!autoCreateMenus)}
          className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${
            autoCreateMenus ? "bg-brand" : "bg-ink-3/40"
          }`}
        >
          <span
            className={`block size-5 rounded-full bg-white shadow transition-transform ${
              autoCreateMenus ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* 올리기 버튼 */}
      <button
        type="button"
        disabled={!file || isUploading}
        onClick={() => mutation.mutate()}
        className="mt-5 inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-[0.95rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-ink-3/40"
      >
        {isUploading ? "올리는 중…" : "올리기"}
      </button>

      {isUploading && (
        <output className="mt-2 block text-center text-sm text-ink-2">
          큰 파일은 1~2분 걸려요
        </output>
      )}

      {serverError && (
        <p role="alert" className="mt-2 text-center text-sm font-semibold text-danger">
          {serverError}
        </p>
      )}

      {/* 결과 */}
      {result && (
        <section className="mt-6 border-t border-white/70 pt-5" data-testid="upload-result">
          <h3 className="text-sm font-bold text-ink">결과</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-ink-2">저장</dt>
              <dd className="tabular text-2xl font-bold text-ink">
                {result.imported}
                <span className="ml-0.5 text-sm font-semibold text-ink-2">건</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">제외</dt>
              <dd className="tabular text-2xl font-bold text-warn">
                {result.skipped}
                <span className="ml-0.5 text-sm font-semibold text-ink-2">건</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">자동 등록 메뉴</dt>
              <dd className="tabular text-2xl font-bold text-ink">
                {result.auto_created_menus}
                <span className="ml-0.5 text-sm font-semibold text-ink-2">개</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">이상치</dt>
              <dd className="tabular text-2xl font-bold text-ink">
                {result.anomaly_count}
                <span className="ml-0.5 text-sm font-semibold text-ink-2">건</span>
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-sm text-ink-2">
            재고 차감에 반영한 판매 {result.inventory_deduction.deducted_sales}건
          </p>

          {result.inventory_deduction.needs_check_items.length > 0 && (
            <p className="mt-2 text-sm" data-testid="needs-check">
              <span className="font-semibold text-warn">
                재고 확인 필요 ·{" "}
                {result.inventory_deduction.needs_check_items.map((i) => i.name).join(", ")}
              </span>{" "}
              <span className="text-ink-2">기록된 재고보다 많이 팔렸어요</span>
            </p>
          )}

          {result.skipped_reasons.length > 0 && (
            <details className="group mt-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-2">
                제외된 행 {result.skipped_reasons.length}건
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-ink-2">
                {result.skipped_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </FollowPanel>
  );
}
