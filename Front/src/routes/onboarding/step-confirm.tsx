// M3.F6 — 온보딩 4스텝: 확인·완료.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { fetchMe } from "../../api/endpoints/auth";
import { createMenusBulk } from "../../api/endpoints/menus";
import { completeOnboarding, patchStore, registerPos } from "../../api/endpoints/store";
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

  if (!store || !pos || menus.length === 0) {
    return <Navigate to="/onboarding/1" replace />;
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      await patchStore({
        store_name: store.store_name,
        business_type: store.business_type,
        store_size: store.store_size,
        operation_type: store.operation_type,
        address: store.address,
        phone: store.phone,
      });
      if (pos.pos_type !== "CSV_ONLY") {
        // posStepSchema가 CSV_ONLY 외에는 api_key·store_code 입력을 보장한다
        await registerPos({
          pos_type: pos.pos_type,
          api_key: pos.api_key ?? "",
          store_code: pos.store_code ?? "",
        });
      }
      await createMenusBulk(menus);
      await completeOnboarding();
      const me = await fetchMe();
      setUser(me);
    },
    onSuccess: () => {
      reset();
      navigate("/", { replace: true });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "온보딩 제출 중 오류가 발생했습니다.";
      setErrorMessage(msg);
    },
  });

  return (
    <div className="space-y-4">
      <section>
        <h2 className="font-medium">매장</h2>
        <dl className="mt-1 grid grid-cols-2 text-sm text-ink-2">
          <dt>매장명</dt><dd>{store.store_name}</dd>
          <dt>업종</dt><dd>{store.business_type}</dd>
          <dt>규모</dt><dd>{STORE_SIZE_LABEL[store.store_size]}</dd>
          <dt>운영</dt><dd>{OPERATION_TYPE_LABEL[store.operation_type]}</dd>
          <dt>주소</dt><dd>{store.address}</dd>
          <dt>전화</dt><dd>{store.phone}</dd>
        </dl>
      </section>
      <section>
        <h2 className="font-medium">POS</h2>
        <p className="text-sm text-ink-2">{POS_TYPE_LABEL[pos.pos_type]}</p>
      </section>
      <section>
        <h2 className="font-medium">메뉴 ({menus.length}개)</h2>
        <ul className="text-sm text-ink-2">
          {menus.map((m) => (
            <li key={`${m.name}-${m.category}`}>
              {m.name} · {m.category} · {m.price.toLocaleString()}원
            </li>
          ))}
        </ul>
      </section>
      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate("/onboarding/3")}>
          이전
        </Button>
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
          data-testid="confirm-submit"
        >
          {submitMutation.isPending ? "제출 중…" : "온보딩 완료"}
        </Button>
      </div>
    </div>
  );
}
