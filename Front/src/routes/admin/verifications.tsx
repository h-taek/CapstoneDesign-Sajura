// M3.F10 — 관리자 사업자 검증 심사 큐 (role=ADMIN, 13_admin-verifications.html, 04_fe.md §4.10).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CertObject,
  approveVerification,
  fetchCertObjectUrl,
  listVerifications,
  rejectVerification,
} from "../../api/endpoints/admin";
import { formatSubmittedAt, sortVerifications } from "../../components/admin/admin-logic";
import { useSky } from "../../components/sky";

export default function AdminVerificationsPage() {
  useSky("now");
  const qc = useQueryClient();
  const [certs, setCerts] = useState<Record<string, CertObject>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const certsRef = useRef(certs);
  certsRef.current = certs;
  useEffect(() => {
    return () => {
      if (typeof URL.revokeObjectURL === "function") {
        for (const c of Object.values(certsRef.current)) URL.revokeObjectURL(c.url);
      }
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
    mutationFn: ({ storeId, reasonText }: { storeId: string; reasonText: string }) =>
      rejectVerification(storeId, reasonText),
    onSuccess: () => {
      setRejectId(null);
      setReason("");
      refresh();
    },
  });

  const showCert = async (storeId: string) => {
    const cert = await fetchCertObjectUrl(storeId);
    setCerts((c) => {
      const prev = c[storeId];
      if (prev && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(prev.url);
      return { ...c, [storeId]: cert };
    });
  };

  const rawItems = data?.items ?? [];
  const items = useMemo(() => sortVerifications(rawItems), [rawItems]);

  return (
    <main className="glass mx-3 my-6 max-w-3xl rounded-[1.75rem] p-5 sm:mx-auto sm:p-6">
      <h1 className="mb-4 text-2xl font-semibold text-ink">사업자 검증 심사</h1>

      {isLoading ? (
        <p className="text-sm text-ink-2">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p data-testid="admin-empty" className="text-sm text-ink-2">
          심사 대기 중인 신청이 없어요
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const cert = certs[it.store_id];
            const isRejectOpen = rejectId === it.store_id;

            return (
              <li
                key={it.store_id}
                data-testid="verification-row"
                className="rounded-2xl p-4 glass-card"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{it.user_email}</p>
                    <p className="text-sm text-ink-2">
                      <span className="tabular">{it.business_no ?? "-"}</span> · 신청{" "}
                      <span className="tabular">{formatSubmittedAt(it.submitted_at)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => showCert(it.store_id)}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-white/80 px-4 text-sm font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-white/30"
                    >
                      등록증 보기
                    </button>
                    <button
                      type="button"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(it.store_id)}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectId((prev) => (prev === it.store_id ? null : it.store_id));
                        setReason("");
                      }}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-white/80 px-4 text-sm font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-white/30"
                    >
                      반려
                    </button>
                  </div>
                </div>

                {cert && (
                  <div className="mt-3">
                    {cert.mime === "application/pdf" ? (
                      <iframe
                        src={cert.url}
                        title="사업자등록증 PDF"
                        className="h-96 w-full rounded-2xl border border-white/80"
                      />
                    ) : (
                      <img
                        src={cert.url}
                        alt="사업자등록증 미리보기"
                        className="max-h-64 w-full rounded-2xl border border-white/80 object-contain"
                      />
                    )}
                  </div>
                )}

                {isRejectOpen && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      id={`reject-reason-${it.store_id}`}
                      placeholder="반려 사유"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="h-11 w-full min-w-0 rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={!reason.trim() || reject.isPending}
                      onClick={() =>
                        reason.trim() &&
                        reject.mutate({ storeId: it.store_id, reasonText: reason.trim() })
                      }
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-danger px-5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                      반려 확정
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
