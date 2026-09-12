// M3.F10 — 관리자 사업자 검증 심사 큐 (role=ADMIN, 07_api_spec.md §3).
// PENDING 목록 + 등록증 미리보기 + 승인/반려. 종합 관리도구는 [후속].
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  approveVerification,
  type CertObject,
  fetchCertObjectUrl,
  listVerifications,
  rejectVerification,
} from "../../api/endpoints/admin";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/field";

export default function AdminVerificationsPage() {
  const qc = useQueryClient();
  const [certs, setCerts] = useState<Record<string, CertObject>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // unmount 시 모든 ObjectURL 해제 — ref로 최신 certs를 추적해 stale closure 회피.
  const certsRef = useRef(certs);
  certsRef.current = certs;
  useEffect(() => {
    return () => {
      for (const c of Object.values(certsRef.current)) URL.revokeObjectURL(c.url);
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "verifications"],
    queryFn: listVerifications,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "verifications"] });

  const approve = useMutation({
    mutationFn: (storeId: string) => approveVerification(storeId),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: ({ storeId, reason }: { storeId: string; reason: string }) =>
      rejectVerification(storeId, reason),
    onSuccess: () => {
      setRejectId(null);
      setReason("");
      refresh();
    },
  });

  const showCert = async (storeId: string) => {
    const cert = await fetchCertObjectUrl(storeId);
    setCerts((c) => {
      // 같은 항목을 다시 열면 기존 URL은 해제하고 새 것으로 교체.
      const prev = c[storeId];
      if (prev) URL.revokeObjectURL(prev.url);
      return { ...c, [storeId]: cert };
    });
  };

  const items = data?.items ?? [];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">사업자 검증 심사</h1>
      {isLoading ? (
        <p className="text-sm text-slate-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="admin-empty">
          심사 대기 중인 항목이 없습니다.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => (
            <li
              key={it.store_id}
              className="rounded-lg border border-slate-200 p-4"
              data-testid="verification-row"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{it.user_email}</p>
                  <p className="text-sm text-slate-500">사업자번호: {it.business_no ?? "-"}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => showCert(it.store_id)}
                  >
                    등록증 보기
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => approve.mutate(it.store_id)}
                    disabled={approve.isPending}
                  >
                    승인
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setRejectId(it.store_id)}
                  >
                    반려
                  </Button>
                </div>
              </div>

              {(() => {
                const cert = certs[it.store_id];
                if (!cert) return null;
                return cert.mime === "application/pdf" ? (
                  <iframe
                    src={cert.url}
                    title="사업자등록증 PDF"
                    className="mt-3 h-96 w-full rounded border border-slate-200"
                  />
                ) : (
                  <img
                    src={cert.url}
                    alt="사업자등록증"
                    className="mt-3 max-h-64 rounded border border-slate-200"
                  />
                );
              })()}

              {rejectId === it.store_id ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    id={`reject-reason-${it.store_id}`}
                    placeholder="반려 사유"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => reason.trim() && reject.mutate({ storeId: it.store_id, reason })}
                    disabled={reject.isPending}
                  >
                    반려 확정
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
