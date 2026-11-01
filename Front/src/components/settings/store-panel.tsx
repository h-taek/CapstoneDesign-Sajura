// 매장 정보 설정 판 — 온보딩 기본 정보 수정 및 사업자 인증 상태 확인.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { type Store, getStore, patchStore } from "../../api/endpoints/store";
import { OPERATION_TYPE_LABEL, STORE_SIZE_LABEL, formatPhone } from "../../schemas/onboarding";
import { useAuthStore } from "../../stores/auth-store";
import { FollowPanel } from "../shell/follow-panel";

const BUSINESS_TYPES = ["카페", "한식", "양식", "분식", "주점", "기타"];

const storeFormSchema = z.object({
  store_name: z.string().min(1, "매장명을 입력하세요.").max(50),
  business_type: z.string().min(1, "업종을 선택하세요."),
  store_size: z.enum(["SMALL", "MEDIUM", "LARGE"]),
  operation_type: z.enum(["HALL", "DELIVERY", "BOTH"]),
  address: z.string().min(1, "주소를 입력하세요.").max(200),
  phone: z.string().min(1, "연락처를 입력하세요."),
});
type StoreFormValues = z.infer<typeof storeFormSchema>;

export function StorePanel({ onBack }: { onBack?: () => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const { data: store } = useQuery<Store>({
    queryKey: ["store"],
    queryFn: getStore,
  });

  const [saved, setSaved] = useState(false);

  const form = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    values: {
      store_name: store?.store_name ?? user?.store_name ?? "",
      business_type: store?.business_type ?? "양식",
      store_size: store?.store_size ?? "MEDIUM",
      operation_type: store?.operation_type ?? "BOTH",
      address: store?.address ?? "",
      phone: store?.phone ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: StoreFormValues) => patchStore(values),
    onSuccess: (updated) => {
      queryClient.setQueryData(["store"], updated);
      if (user && updated.store_name) {
        setUser({ ...user, store_name: updated.store_name });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const onSubmit = (values: StoreFormValues) => {
    mutation.mutate(values);
  };

  const businessStatus = store?.business_status ?? user?.business_status ?? "VERIFIED";
  const businessNo = store?.business_no ?? user?.business_no ?? "123-45-67890";

  return (
    <FollowPanel
      title="매장 정보"
      aria-label="매장 정보"
      className="lg:col-span-3"
      {...(onBack ? { onClose: onBack } : {})}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold text-ink-2">
            매장명
            <input
              type="text"
              {...form.register("store_name")}
              className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            업종
            <span className="relative block">
              <select
                {...form.register("business_type")}
                className="h-11 w-full appearance-none rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] pr-10 pl-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
              >
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-2" />
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            연락처
            <input
              type="text"
              {...form.register("phone")}
              onChange={(e) => {
                form.setValue("phone", formatPhone(e.target.value));
              }}
              className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>

          <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold text-ink-2">
            주소
            <input
              type="text"
              {...form.register("address")}
              className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            매장 규모
            <span className="relative block">
              <select
                {...form.register("store_size")}
                className="h-11 w-full appearance-none rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] pr-10 pl-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
              >
                {Object.entries(STORE_SIZE_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-2" />
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            운영 형태
            <span className="relative block">
              <select
                {...form.register("operation_type")}
                className="h-11 w-full appearance-none rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] pr-10 pl-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
              >
                {Object.entries(OPERATION_TYPE_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-2" />
            </span>
          </label>
        </div>

        {form.formState.errors.store_name && (
          <p className="mt-2 text-sm text-danger">{form.formState.errors.store_name.message}</p>
        )}
        {form.formState.errors.address && (
          <p className="mt-1 text-sm text-danger">{form.formState.errors.address.message}</p>
        )}

        <div className="mt-3 flex items-center justify-end gap-3">
          {saved && <output className="text-sm font-semibold text-ok">저장했어요</output>}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/80 px-5 text-[0.95rem] font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-white/30 disabled:opacity-50"
          >
            {mutation.isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>

      {/* 사업자 인증 상태 */}
      <section className="mt-6 border-t border-white/70 pt-5">
        <h3 className="text-sm font-bold text-ink">사업자 인증</h3>
        <p className="mt-1 text-[0.95rem]">
          <span className="tabular text-ink">{businessNo}</span>{" "}
          {businessStatus === "VERIFIED" && <span className="font-semibold text-ok">인증됨</span>}
          {businessStatus === "PENDING" && <span className="font-semibold text-warn">심사 중</span>}
          {businessStatus === "REJECTED" && (
            <span className="font-semibold text-danger">
              반려 ({store?.business_reject_reason || "사유 미기재"})
            </span>
          )}
          {businessStatus === "UNVERIFIED" && (
            <span className="font-semibold text-ink-3">미인증</span>
          )}
        </p>
      </section>
    </FollowPanel>
  );
}
