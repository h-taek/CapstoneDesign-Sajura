// M3.F9 — 사업자 검증 화면 (온보딩 진입 전 게이트, 07_api_spec.md §3).
// 사업자번호 + 사업자등록증 업로드 → POST /api/store/business/verify (multipart).
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { authErrorMessage, fetchMe, verifyBusiness } from "../api/endpoints/auth";
import { getStore } from "../api/endpoints/store";
import { Button } from "../components/ui/button";
import { FormField, Input } from "../components/ui/field";
import { type VerifyBusinessValues, formatBusinessNo, verifyBusinessSchema } from "../schemas/auth";
import { useAuthStore } from "../stores/auth-store";
import { landingPath } from "./guards";

export default function VerifyBusinessPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [cert, setCert] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 반려 상태면 사유 표시 (GET /api/store).
  const { data: store } = useQuery({
    queryKey: ["store"],
    queryFn: getStore,
    enabled: user?.business_status === "REJECTED",
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VerifyBusinessValues>({
    resolver: zodResolver(verifyBusinessSchema),
    defaultValues: { business_no: "" },
    mode: "onBlur",
  });

  const mutation = useMutation({
    mutationFn: async (values: VerifyBusinessValues) => {
      await verifyBusiness(values.business_no, cert);
      const me = await fetchMe();
      setUser(me);
      return me;
    },
    onSuccess: (me) => navigate(landingPath(me), { replace: true }),
    onError: async (error) => {
      setFormError(await authErrorMessage(error, "사업자 검증에 실패했습니다."));
    },
  });

  const onSubmit = (values: VerifyBusinessValues) => {
    setFormError(null);
    if (!cert) {
      setFormError("사업자등록증 파일을 첨부하세요.");
      return;
    }
    mutation.mutate(values);
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f3f4f6] p-6">
      <section className="w-full max-w-[560px] space-y-8 rounded-2xl bg-white p-10 shadow-sm">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[#101828]">매장 인증을 완료해주세요</h1>
          <p className="text-base text-[#364153]">
            사업자등록번호와 등록증을 제출하면 검증 후 다음 단계로 진행합니다.
          </p>
        </header>

        {user?.business_status === "REJECTED" && store?.business_reject_reason ? (
          <output className="block rounded-md bg-red-50 p-3 text-sm text-red-700">
            반려됨: {store.business_reject_reason} — 확인 후 다시 제출해주세요.
          </output>
        ) : null}

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField
            label="사업자등록번호"
            htmlFor="business_no"
            error={errors.business_no?.message}
            hint="123-45-67890"
          >
            <Input
              id="business_no"
              inputMode="numeric"
              placeholder="사업자등록번호를 입력해 주세요."
              className="h-[58px] rounded-xl border-[#d1d5dc] bg-[#f3f4f6] px-4 text-base"
              {...register("business_no", {
                onChange: (e) => setValue("business_no", formatBusinessNo(e.target.value)),
              })}
            />
          </FormField>

          <FormField label="사업자등록증" htmlFor="cert" hint="이미지(jpg/png) 또는 PDF, 최대 10MB">
            <div className="flex items-center gap-3">
              <div className="flex h-[58px] flex-1 items-center rounded-xl border border-[#d1d5dc] bg-[#f3f4f6] px-4 text-base text-[#99a1af]">
                {cert ? cert.name : "사업자등록증(파일을 첨부해주세요)"}
              </div>
              <Button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-[58px] shrink-0 rounded-xl bg-[#101828] px-6 text-base font-medium hover:bg-[#1f2937]"
              >
                파일 찾기
              </Button>
              <input
                id="cert"
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setCert(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>
          </FormField>

          {formError ? (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={mutation.isPending}
            className="h-[68px] w-full rounded-full bg-[#7a5eff] text-xl font-semibold hover:bg-[#6a4eef]"
          >
            {mutation.isPending ? "검증 중…" : "제출하기"}
          </Button>
        </form>
      </section>
    </main>
  );
}
