import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { authErrorMessage, fetchMe, verifyBusiness } from "../api/endpoints/auth";
import { getStore } from "../api/endpoints/store";
import { VERIFY_SKY, useSky } from "../components/sky";
import { formatBusinessNo } from "../schemas/auth";
import { useAuthStore } from "../stores/auth-store";
import { landingPath } from "./guards";

export default function VerifyBusinessPage() {
  const navigate = useNavigate();
  useSky(VERIFY_SKY);

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [businessNo, setBusinessNo] = useState(
    user?.business_no ? formatBusinessNo(user.business_no) : "",
  );
  const [cert, setCert] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isRejected = user?.business_status === "REJECTED";

  // 반려 상태면 사유 표시 (GET /api/store)
  const { data: store } = useQuery({
    queryKey: ["store"],
    queryFn: getStore,
    enabled: isRejected,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await verifyBusiness(businessNo, cert);
      const me = await fetchMe();
      setUser(me);
      return me;
    },
    onSuccess: (me) => {
      navigate(landingPath(me), { replace: true });
    },
    onError: async (error) => {
      setFormError(await authErrorMessage(error, "사업자 검증에 실패했습니다."));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!cert) {
      setFormError("사업자등록증 파일을 첨부하세요.");
      return;
    }
    mutation.mutate();
  };

  const rejectReason =
    store?.business_reject_reason ||
    "등록증 이미지가 흐려 번호를 확인할 수 없어요. 다시 올려 주세요";

  return (
    <>
      <p className="fixed top-6 left-6 z-10 text-[1.75rem] leading-none font-extrabold tracking-tight text-[#b3a4ff] sm:top-8 sm:left-10">
        Sajura
      </p>

      <main className="min-h-dvh px-5 pt-[13vh] pb-10 text-center text-white">
        <section className="mx-auto w-full max-w-[400px]">
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">매장 인증을 해 주세요</h1>

          {isRejected ? (
            <p className="mt-2 text-base font-semibold text-[#ffd6d6]" role="alert">
              반려됐어요. {rejectReason}
            </p>
          ) : formError ? (
            <p className="mt-2 text-base font-semibold text-[#ffd6d6]" role="alert">
              {formError}
            </p>
          ) : (
            <p className="mt-2 text-base text-white/75">
              사업자등록번호와 등록증을 올리면
              <br />
              확인 후 다음 단계로 넘어가요
            </p>
          )}

          <form className="mt-8 space-y-3 text-left" onSubmit={handleSubmit} noValidate>
            <input
              id="business_no"
              inputMode="numeric"
              aria-label="사업자등록번호"
              placeholder="사업자등록번호 (숫자 10자리)"
              value={businessNo}
              onChange={(e) => setBusinessNo(formatBusinessNo(e.target.value))}
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
                onChange={(e) => setCert(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>
            <p className="px-1 text-sm text-white/85">이미지(jpg·png) 또는 PDF, 최대 10MB</p>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
            >
              {mutation.isPending ? "검증 중…" : "제출하기"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
