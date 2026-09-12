// M4.F2 + M4.F3 — CSV 업로드 + 결과 화면.
//
// - 드래그앤드롭 또는 파일 선택으로 CSV 1개 입력.
// - 컬럼명 매핑(date/menu/quantity/price/external_sale_id)을 점주가 조정.
// - multipart 전송 → /api/sales/upload.
// - 결과: imported / skipped / skipped_reasons / anomaly_count 표 표시.
import { useMutation } from "@tanstack/react-query";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  type CSVUploadColumns,
  type CSVUploadResponse,
  uploadSalesCsv,
} from "../../api/endpoints/sales";
import { DashboardShell } from "../../components/dashboard/shell";
import { Button } from "../../components/ui/button";
import { FormField, Input } from "../../components/ui/field";

const MAX_BYTES = 50 * 1024 * 1024;

// settings/pos.tsx CSV 템플릿(실제 POS 매출 리포트 형식)의 기본 매핑.
// "상품코드"는 상품당 고정값이라 영수증번호 대체로 쓰면 같은 상품의 다른 거래가
// 중복으로 오인되어 스킵될 수 있어 external_sale_id 기본값은 비워둔다(점주가 선택 입력).
const DEFAULT_COLUMNS: CSVUploadColumns = {
  date_column: "기간",
  menu_column: "상품명",
  quantity_column: "판매건수",
  price_column: "실 판매 금액 (할인, 옵션 포함)",
  external_sale_id_column: "",
};

interface ApiErrorBody {
  error?: string;
  message?: string;
}

async function extractApiMessage(err: unknown): Promise<string> {
  // ky HTTPError 호환 — response.json() 시도.
  if (typeof err === "object" && err !== null && "response" in err) {
    const res = (err as { response?: Response }).response;
    if (res) {
      try {
        const body = (await res.clone().json()) as ApiErrorBody;
        return body.message ?? body.error ?? "업로드에 실패했습니다.";
      } catch {
        // ignore
      }
    }
  }
  return err instanceof Error ? err.message : "업로드에 실패했습니다.";
}

export default function SalesUploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<CSVUploadColumns>(DEFAULT_COLUMNS);
  const [autoCreateMenus, setAutoCreateMenus] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation<CSVUploadResponse, unknown, void>({
    mutationFn: async () => {
      if (!file) throw new Error("파일을 선택하세요.");
      return uploadSalesCsv(file, columns, { auto_create_menus: autoCreateMenus });
    },
    onError: async (err) => {
      setServerError(await extractApiMessage(err));
    },
    onMutate: () => {
      setServerError(null);
    },
  });

  function pickFile(next: File | null) {
    setFileError(null);
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
      setFileError("파일이 너무 큽니다 (최대 50 MB).");
      return;
    }
    setFile(next);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <DashboardShell active="home">
      <header className="mx-auto max-w-3xl pb-6">
        <h1 className="text-xl font-semibold text-slate-900">매출 CSV 업로드</h1>
        <p className="text-sm text-slate-500">
          POS 매출 데이터를 CSV로 변환해 업로드하면 매장 메뉴와 자동 매칭됩니다.
        </p>
      </header>

      <section className="mx-auto max-w-3xl space-y-4">
        {/* 1) 파일 선택 / 드래그앤드롭 */}
        <article className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">1. 파일 선택</h2>
          <div
            role="button"
            tabIndex={0}
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
            className={`mt-3 flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-sm transition ${
              dragging
                ? "border-slate-500 bg-slate-50"
                : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
            data-testid="dropzone"
          >
            {file ? (
              <>
                <p className="font-medium text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB · 다시 누르면 변경
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-600">파일을 끌어다 놓거나 눌러서 선택</p>
                <p className="text-xs text-slate-400">최대 50 MB · UTF-8 CSV</p>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            data-testid="file-input"
          />
          {fileError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {fileError}
            </p>
          )}
        </article>

        {/* 2) 컬럼명 매핑 */}
        <article className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">2. 컬럼명 매핑</h2>
          <p className="mt-1 text-xs text-slate-500">
            업로드할 CSV의 컬럼 헤더와 사주라가 기대하는 항목을 연결합니다. 사주라 기본 템플릿을
            그대로 쓰면 변경할 필요 없습니다.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="날짜 컬럼" htmlFor="date_column">
              <Input
                id="date_column"
                value={columns.date_column}
                onChange={(e) => setColumns({ ...columns, date_column: e.target.value })}
              />
            </FormField>
            <FormField label="메뉴명 컬럼" htmlFor="menu_column">
              <Input
                id="menu_column"
                value={columns.menu_column}
                onChange={(e) => setColumns({ ...columns, menu_column: e.target.value })}
              />
            </FormField>
            <FormField label="수량 컬럼" htmlFor="quantity_column">
              <Input
                id="quantity_column"
                value={columns.quantity_column}
                onChange={(e) => setColumns({ ...columns, quantity_column: e.target.value })}
              />
            </FormField>
            <FormField label="금액 컬럼" htmlFor="price_column">
              <Input
                id="price_column"
                value={columns.price_column}
                onChange={(e) => setColumns({ ...columns, price_column: e.target.value })}
              />
            </FormField>
            <FormField
              label="영수증번호 컬럼 (선택)"
              htmlFor="external_sale_id_column"
              hint="비워두면 상품+판매일시 기준으로 중복을 방지합니다(영수증 단위 구분은 되지 않음)."
            >
              <Input
                id="external_sale_id_column"
                value={columns.external_sale_id_column ?? ""}
                onChange={(e) =>
                  setColumns({ ...columns, external_sale_id_column: e.target.value })
                }
              />
            </FormField>
          </div>
        </article>

        {/* 3) 업로드 실행 */}
        <article className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">3. 업로드</h2>

          <label className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm">
            <input
              type="checkbox"
              checked={autoCreateMenus}
              onChange={(e) => setAutoCreateMenus(e.target.checked)}
              className="mt-0.5 h-4 w-4"
              data-testid="auto-create-menus"
            />
            <span>
              <span className="font-medium text-slate-900">매장 메뉴에 없는 항목 자동 등록</span>
              <span className="block text-xs text-slate-600">
                체크하면 CSV에 있는 새 메뉴를 카테고리 <strong>"자동등록"</strong>으로 즉시 매장
                메뉴에 추가합니다. 단가는 CSV의 금액÷수량으로 자동 산정됩니다. 나중에 메뉴 화면에서
                수정할 수 있습니다.
              </span>
            </span>
          </label>

          <div className="mt-3 flex items-center gap-2">
            <Button onClick={() => mutation.mutate()} disabled={!file || mutation.isPending}>
              {mutation.isPending ? "업로드 중…" : "업로드 시작"}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/settings/pos")}>
              설정으로 돌아가기
            </Button>
          </div>
          {mutation.isPending && (
            <p className="mt-3 text-xs text-slate-500" role="status">
              파일을 처리하고 있습니다. 큰 파일은 1~2분 걸릴 수 있습니다.
            </p>
          )}
          {serverError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {serverError}
            </p>
          )}
        </article>

        {/* M4.F3 — 결과 */}
        {mutation.isSuccess && mutation.data && <UploadResult result={mutation.data} />}
      </section>
    </DashboardShell>
  );
}

function UploadResult({ result }: { result: CSVUploadResponse }) {
  const showAuto = result.auto_created_menus > 0;
  const ref = useRef<HTMLElement>(null);

  // 결과 카드가 폼 아래에 있어 스크롤 없이는 안 보일 수 있어, 뜨자마자 시야에 들어오게 한다.
  useEffect(() => {
    // jsdom(테스트 환경)은 scrollIntoView 미구현이라 존재할 때만 호출.
    ref.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <article
      ref={ref}
      className="rounded-xl border-2 border-emerald-200 bg-white p-6 shadow-sm"
      data-testid="upload-result"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-emerald-700">업로드 완료</h2>
        <Link to="/" className="text-sm font-medium text-[#7a5eff] hover:underline">
          메인 화면으로
        </Link>
      </div>
      <div
        className={`mt-3 grid gap-3 text-center text-sm ${
          showAuto ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
        <Metric label="저장" value={result.imported} tone="text-green-700" />
        <Metric label="제외" value={result.skipped} tone="text-amber-700" />
        {showAuto && (
          <Metric
            label="자동 등록된 메뉴"
            value={result.auto_created_menus}
            tone="text-blue-700"
            hint="* 카테고리 '자동등록'으로 추가됨"
          />
        )}
        <Metric
          label="이상치 감지"
          value={result.anomaly_count}
          tone="text-slate-700"
          hint="* Phase 12에서 실제 탐지 로직 적용 예정"
        />
      </div>
      {result.skipped_reasons.length > 0 && (
        <details className="mt-4 rounded-md bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            제외된 행 {result.skipped_reasons.length}건 보기
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
            {result.skipped_reasons.slice(0, 50).map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
            {result.skipped_reasons.length > 50 && (
              <li className="text-slate-400">… 그 외 {result.skipped_reasons.length - 50}건</li>
            )}
          </ul>
        </details>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}
