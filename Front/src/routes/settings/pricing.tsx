// 단가 관리 — 기존 메뉴 CRUD(PATCH /api/menus/{id})를 재사용해 판매 단가만 빠르게 수정.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMenus, updateMenu } from "../../api/endpoints/menus";
import { DashboardShell } from "../../components/dashboard/shell";
import { Button } from "../../components/ui/button";

const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });

export default function PricingSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["menus-all"],
    queryFn: () => listMenus(100),
  });
  const menus = data?.items.filter((m) => !m.is_deleted) ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState("");

  const mutation = useMutation({
    mutationFn: ({ menuId, price }: { menuId: string; price: number }) =>
      updateMenu(menuId, { price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus-all"] });
      setEditingId(null);
    },
  });

  return (
    <DashboardShell active="settings" title="단가 관리" backTo="/settings">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="hidden text-[1.75rem] font-bold tracking-tight text-ink lg:block">단가 관리</h1>
          <p className="text-sm text-ink-3">메뉴별 판매 단가를 조회하고 수정합니다.</p>
        </header>

        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-subtle text-ink-3">
              <tr>
                <th className="px-4 py-3 font-medium">메뉴</th>
                <th className="px-4 py-3 font-medium">카테고리</th>
                <th className="px-4 py-3 font-medium">단가</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-3">
                    불러오는 중…
                  </td>
                </tr>
              ) : menus.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-3">
                    등록된 메뉴가 없습니다.
                  </td>
                </tr>
              ) : (
                menus.map((m) => (
                  <tr key={m.menu_id} className="border-t border-line-soft">
                    <td className="px-4 py-3 font-medium text-ink-2">{m.name}</td>
                    <td className="px-4 py-3 text-ink-3">{m.category ?? "—"}</td>
                    <td className="px-4 py-3">
                      {editingId === m.menu_id ? (
                        <input
                          type="number"
                          min={0}
                          value={draftPrice}
                          onChange={(e) => setDraftPrice(e.target.value)}
                          className="h-9 w-28 rounded-lg border border-line px-2 text-sm"
                        />
                      ) : (
                        <span className="text-ink-2">{won.format(m.price)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === m.menu_id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-sm text-ink-3 hover:text-ink-2"
                          >
                            취소
                          </button>
                          <Button
                            onClick={() => {
                              const price = Number(draftPrice);
                              if (!Number.isNaN(price) && price >= 0) {
                                mutation.mutate({ menuId: m.menu_id, price });
                              }
                            }}
                            disabled={mutation.isPending}
                            className="h-8 rounded-full bg-brand px-4 text-sm font-semibold hover:bg-brand-strong"
                          >
                            저장
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(m.menu_id);
                            setDraftPrice(String(m.price));
                          }}
                          className="text-sm font-medium text-brand hover:underline"
                        >
                          수정
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
