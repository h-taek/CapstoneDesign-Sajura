// 일괄 삭제 — 재고 현황·메뉴 관리 공용. '삭제'를 누르면 카드를 골라 한 번에 지운다.
// BE에 일괄 API가 없어 항목별 DELETE를 모아 부르고, 실패한 항목 수를 돌려준다.
import { Check, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

export function useBulkSelection() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** 보이는 항목이 모두 골라져 있으면 그것만 풀고, 아니면 그것을 더한다. 검색을 바꿔 가며 골라 모은 것은 남긴다. */
  const toggleAll = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (ids.every((id) => prev.has(id))) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const start = useCallback(() => {
    setSelected(new Set());
    setActive(true);
  }, []);

  const exit = useCallback(() => {
    setSelected(new Set());
    setActive(false);
  }, []);

  return { active, selected, toggle, toggleAll, start, exit };
}

export interface BulkDeleteResult {
  deleted: number;
  failed: unknown[];
}

export async function deleteMany(
  ids: string[],
  remove: (id: string) => Promise<void>,
): Promise<BulkDeleteResult> {
  const results = await Promise.allSettled(ids.map((id) => remove(id)));
  const failed = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason);
  return { deleted: ids.length - failed.length, failed };
}

/** 보통 때 '추가' 옆에 두는 삭제 버튼. */
export function BulkDeleteButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center gap-1.5 rounded-full px-6 text-[0.95rem] font-semibold text-ink-2 glass-card transition-colors hover:bg-white/50 hover:text-danger disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink-2"
    >
      <Trash2 className="size-5" />
      삭제
    </button>
  );
}

/** 고르는 중에 '추가'·'삭제' 자리를 대신하는 줄. */
export function BulkDeleteToolbar({
  count,
  allSelected,
  onToggleAll,
  onCancel,
  onDelete,
  pending,
}: {
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleAll}
        className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-ink-2 glass-card hover:bg-white/50"
      >
        {allSelected ? "선택 해제" : "전체 선택"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-ink-2 glass-card hover:bg-white/50"
      >
        취소
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={count === 0 || pending}
        className="inline-flex h-11 items-center gap-1.5 rounded-full bg-danger px-6 text-[0.95rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Trash2 className="size-5" />
        {pending ? "삭제 중…" : "삭제"}
      </button>
    </div>
  );
}

/** 고르는 중인 카드의 오른쪽 위 체크 표시. 부모는 relative여야 한다. */
export function SelectMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute top-3 right-3 flex size-6 items-center justify-center rounded-full border-2 transition-colors ${
        checked ? "border-brand bg-brand text-white" : "border-ink-3/60 bg-white/60"
      }`}
    >
      {checked && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}
