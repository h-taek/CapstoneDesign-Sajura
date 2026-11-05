// 사업자등록번호 + 사업자등록증 입력 — 회원가입 마지막 단계·사업자 검증 화면 공용 (04_fe.md §4.1·§4.2).
import { useRef } from "react";
import { formatBusinessNo } from "../../schemas/auth";

export function BusinessFields({
  businessNo,
  onBusinessNoChange,
  cert,
  onCertChange,
}: {
  businessNo: string;
  onBusinessNoChange: (value: string) => void;
  cert: File | null;
  onCertChange: (file: File | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        id="business_no"
        inputMode="numeric"
        aria-label="사업자등록번호"
        placeholder="사업자등록번호 (숫자 10자리)"
        value={businessNo}
        onChange={(e) => onBusinessNoChange(formatBusinessNo(e.target.value))}
        className="h-[52px] w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-[52px] min-w-0 flex-1 items-center rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base backdrop-blur-md">
          <span className={`truncate ${cert ? "text-white" : "text-white/70"}`}>
            {cert ? cert.name : "사업자등록증 파일"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-[52px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/15 bg-clip-padding px-4 text-base font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
        >
          파일 찾기
        </button>
        <input
          id="cert"
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => onCertChange(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>
      <p className="px-1 text-sm text-white/85">이미지(jpg·png) 또는 PDF, 최대 10MB</p>
    </>
  );
}
