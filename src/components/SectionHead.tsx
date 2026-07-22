/* A numbered section header — the same "01 · Title — note" divider used on the
   marketing zones, so every module reads as clearly-separated sections. */
export default function SectionHead({ n, title, note, right }: { n: string; title: string; note?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline px-1 pb-1.5">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-[10px] font-bold tracking-[0.14em] text-peri-deep">{n}</span>
        <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
        {note ? <span className="truncate text-[11px] text-muted">— {note}</span> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
