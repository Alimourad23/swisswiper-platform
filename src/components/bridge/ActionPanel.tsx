"use client";

import type { ReactNode } from "react";

/* One consistent shell for ALL of Alfred's proposal/review panels — a wide,
   polished deep-space card with a title, the editable fields (children), a row
   of contextual action options, and a "Say:" hint echoing the voice commands.
   The buttons are the always-reliable fallback to the spoken choices. */

export type PanelOption = {
  label: string;
  onClick: () => void;
  kind?: "primary" | "send" | "ghost" | "danger";
};

function optionClass(kind: PanelOption["kind"]): string {
  switch (kind) {
    case "send":
      return "bg-[#5c66a6] text-white hover:opacity-90";
    case "danger":
      return "bg-[#b5544f] text-white hover:opacity-90";
    case "ghost":
      return "border border-[#8e9ae0]/30 text-[#cad1e8] hover:bg-white/[0.06]";
    default:
      return "bg-[#cad1e8] text-[#06070f] hover:opacity-90";
  }
}

export default function ActionPanel({
  title,
  say,
  options,
  busy,
  children,
}: {
  title: string;
  say?: string;
  options: PanelOption[];
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 w-full max-w-2xl rounded-[var(--radius-card)] border border-[#8e9ae0]/25 bg-white/[0.05] px-6 py-6 text-left shadow-[0_12px_50px_rgba(4,5,15,0.55)] backdrop-blur-sm sm:px-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#8e9ae0]/70">{title}</p>

      <div className="mt-5 flex flex-col gap-4">{children}</div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={o.onClick}
            disabled={busy && o.kind !== "ghost"}
            className={[
              "rounded-full px-5 py-2 text-sm font-medium transition-opacity disabled:opacity-40",
              optionClass(o.kind),
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>

      {say && (
        <p className="mt-3 text-right text-[11px] font-light tracking-wide text-[#8e9ae0]/55">
          Say: {say}
        </p>
      )}
    </div>
  );
}
