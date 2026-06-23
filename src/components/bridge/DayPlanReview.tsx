"use client";

/* Editable "plan my day" review — the tasks Alfred proposes for today, each
   with a time estimate, plus a capacity total. Rendered inside an ActionPanel
   (which supplies the card shell + Set the day / Revise / Cancel options). */

export type DayPlanItem = { taskId: string; title: string; estimateMin: number };
export type DayPlanDraft = { items: DayPlanItem[]; date: string };

const TARGET_MIN = 6 * 60;

function fmtH(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

export default function DayPlanReview({
  draft,
  onChange,
}: {
  draft: DayPlanDraft;
  onChange: (patch: Partial<DayPlanDraft>) => void;
}) {
  const total = draft.items.reduce((n, i) => n + i.estimateMin, 0);
  const over = total > TARGET_MIN;

  function setItems(items: DayPlanItem[]) {
    onChange({ items });
  }
  function bump(i: number, delta: number) {
    setItems(
      draft.items.map((it, idx) =>
        idx === i ? { ...it, estimateMin: Math.max(5, it.estimateMin + delta) } : it,
      ),
    );
  }
  function remove(i: number) {
    setItems(draft.items.filter((_, idx) => idx !== i));
  }

  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#cdd3ea]/85">
          {draft.items.length} task{draft.items.length === 1 ? "" : "s"} today
        </span>
        <span className={over ? "font-medium text-red-400" : "text-[#8e9ae0]/80"}>{fmtH(total)} planned</span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${over ? "bg-red-500" : "bg-[#8e9ae0]"}`}
          style={{ width: `${Math.min(total / TARGET_MIN, 1) * 100}%` }}
        />
      </div>
      {over && (
        <p className="text-xs font-medium text-red-400">
          That's more than a ~6h day — trim one, or shrink an estimate.
        </p>
      )}

      {draft.items.length === 0 ? (
        <p className="py-2 text-center text-sm text-[#8e9ae0]/70">No tasks — say what to add, or cancel.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {draft.items.map((it, i) => (
            <li key={it.taskId} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-[#eef1f8]">{it.title}</span>
              <div className="flex shrink-0 items-center gap-1 text-xs text-[#8e9ae0]/80">
                <button type="button" onClick={() => bump(i, -15)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/[0.06]" aria-label="Less">−</button>
                <span className="w-9 text-center tabular-nums">{fmtH(it.estimateMin)}</span>
                <button type="button" onClick={() => bump(i, 15)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/[0.06]" aria-label="More">+</button>
              </div>
              <button type="button" onClick={() => remove(i)} className="shrink-0 text-xs text-[#8e9ae0]/60 hover:text-red-400" aria-label="Remove">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
