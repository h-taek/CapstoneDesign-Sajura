import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { fetchMe } from "../../api/endpoints/auth";
import { createMenusBulk } from "../../api/endpoints/menus";
import { createPos } from "../../api/endpoints/pos";
import { completeOnboarding, patchStore } from "../../api/endpoints/store";
import { goDashboard } from "../../components/sky";
import { OPERATION_TYPE_LABEL, POS_TYPE_LABEL, STORE_SIZE_LABEL } from "../../schemas/onboarding";
import { useAuthStore } from "../../stores/auth-store";
import { useOnboardingStore } from "../../stores/onboarding-store";

export default function ConfirmStep() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const store = useOnboardingStore((s) => s.store);
  const pos = useOnboardingStore((s) => s.pos);
  const menus = useOnboardingStore((s) => s.menus);
  const reset = useOnboardingStore((s) => s.reset);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!store || !pos) return;
      await patchStore({
        store_name: store.store_name,
        business_type: store.business_type,
        store_size: store.store_size,
        operation_type: store.operation_type,
        address: store.address,
        phone: store.phone,
      });
      if (pos.pos_type !== "CSV_ONLY") {
        await createPos({
          pos_type: pos.pos_type,
          api_key: pos.api_key ?? "",
          store_code: pos.store_code ?? "",
        });
      }
      await createMenusBulk(menus);
      await completeOnboarding();
      const me = await fetchMe();
      setUser(me);
      return me;
    },
    onSuccess: async (me) => {
      reset();
      if (me) {
        await goDashboard(me, navigate);
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "제출 중 오류가 났어요. 다시 시도해 주세요";
      setErrorMessage(msg);
    },
  });

  if (!store || !pos || menus.length === 0) {
    return <Navigate to="/onboarding/1" replace />;
  }

  return (
    <div>
      <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">
        입력한 내용을 확인해 주세요
      </h1>
      {errorMessage ? (
        <p className="mt-2 text-base font-semibold text-[#ffd6d6]" role="alert">
          {errorMessage}
        </p>
      ) : (
        <p className="mt-2 text-base text-white/75">
          완료하면 오늘 밤부터 사주라가 계산을 시작해요
        </p>
      )}

      <div className="mt-8 space-y-4 rounded-2xl border border-white/15 bg-[#0d0a26]/45 p-5 text-left text-[0.95rem] backdrop-blur-md">
        <section>
          <h2 className="font-bold">매장</h2>
          <dl className="mt-1.5 grid grid-cols-[5rem_1fr] gap-y-1">
            <dt className="text-white/75">매장명</dt>
            <dd>{store.store_name}</dd>
            <dt className="text-white/75">업종</dt>
            <dd>{store.business_type}</dd>
            <dt className="text-white/75">규모</dt>
            <dd>{STORE_SIZE_LABEL[store.store_size]}</dd>
            <dt className="text-white/75">운영</dt>
            <dd>{OPERATION_TYPE_LABEL[store.operation_type]}</dd>
            <dt className="text-white/75">주소</dt>
            <dd>{store.address}</dd>
            <dt className="text-white/75">전화</dt>
            <dd>{store.phone}</dd>
          </dl>
        </section>
        <section className="border-t border-white/15 pt-4">
          <h2 className="font-bold">POS</h2>
          <p className="mt-1">{POS_TYPE_LABEL[pos.pos_type]}</p>
        </section>
        <section className="border-t border-white/15 pt-4">
          <h2 className="font-bold">메뉴 {menus.length}개</h2>
          <ul className="mt-1.5 space-y-1">
            {menus.map((m) => (
              <li key={`${m.name}-${m.category}`}>
                {m.name} · {m.category} · {m.price.toLocaleString()}원
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="text-left">
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => navigate("/onboarding/3")}
            className="inline-flex h-[52px] w-28 shrink-0 items-center justify-center rounded-xl bg-white/15 px-5 text-lg font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              submitMutation.mutate();
            }}
            disabled={submitMutation.isPending}
            data-testid="confirm-submit"
            className="inline-flex h-[52px] flex-1 items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            {submitMutation.isPending ? "완료 처리 중…" : "온보딩 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
