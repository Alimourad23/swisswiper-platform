"use client";

import { useEffect, useState } from "react";
import AlfredStar from "@/components/bridge/AlfredStar";
import AlfredChat from "@/components/bridge/AlfredChat";

/* Summon-anywhere Alfred. Two modes:
   • COMPACT — a small card floating over the current page (the page stays
     usable behind it). The default for a plain summon.
   • COMPOSER — a full-screen takeover used when drafting a reply from the
     Emails page: the original email is showcased on one side while Alfred reads
     it aloud, drafts the reply, reads that aloud, and shows the editable draft.

   Dismissible by Esc, the close control, or saying "that's all". */

export type Showcase = { from: string; subject: string; body: string };

export default function AlfredOverlay({
  open,
  onClose,
  autoListenKey = 0,
  seed = "",
  seedKey = 0,
  showcase = null,
}: {
  open: boolean;
  onClose: () => void;
  autoListenKey?: number;
  seed?: string;
  seedKey?: number;
  showcase?: Showcase | null;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // What Alfred reads aloud before drafting (the original email), kept to a
  // sensible length for the voice.
  const readAloud = showcase
    ? `Here is the email from ${showcase.from}. The subject is: ${showcase.subject}. ${showcase.body.slice(0, 1400)}`
    : "";

  const chat = (
    <AlfredChat
      active={open}
      autoListenKey={autoListenKey}
      seed={seed}
      seedKey={seedKey}
      readAloud={readAloud}
      onDismiss={onClose}
      onSpeakingChange={setSpeaking}
      onListeningChange={setListening}
      onPanelOpenChange={setPanelOpen}
    />
  );

  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Dismiss Alfred"
      className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full text-[#8e9ae0]/70 transition-colors hover:bg-white/[0.06] hover:text-[#cad1e8]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );

  /* ── COMPOSER: full-screen reply takeover ───────────────────────────────── */
  if (showcase) {
    return (
      <div aria-hidden={!open} className={open ? "fixed inset-0 z-[100] flex" : "hidden"}>
        <div className="absolute inset-0 bg-[#06070F]/95 backdrop-blur-xl" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:flex-row">
          {/* The email being replied to */}
          <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-[#8e9ae0]/20 bg-white/[0.03] p-5 text-left">
            <p className="text-[10px] font-medium uppercase tracking-[0.34em] text-[#8e9ae0]/60">Replying to</p>
            <p className="mt-2 truncate text-sm font-medium text-[#eef1f8]">{showcase.from}</p>
            <p className="truncate text-sm text-[#8e9ae0]/80">{showcase.subject}</p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm leading-relaxed text-[#cdd3ea]/90">
              {showcase.body}
            </div>
          </div>

          {/* Alfred — reads, drafts, reads, and shows the editable draft */}
          <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto rounded-[24px] border border-[#8e9ae0]/25 bg-[#06070F]/80 p-5 text-center">
            {closeBtn}
            {open && (
              <AlfredStar
                speaking={speaking}
                listening={listening}
                className={
                  panelOpen
                    ? "aspect-square h-[clamp(60px,9vh,96px)] w-auto"
                    : "aspect-square h-[clamp(96px,14vh,150px)] w-auto"
                }
              />
            )}
            {chat}
          </div>
        </div>
      </div>
    );
  }

  /* ── COMPACT: floating summon card ──────────────────────────────────────── */
  return (
    <div
      aria-hidden={!open}
      className={
        open
          ? "pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4 sm:bottom-6"
          : "hidden"
      }
    >
      <div className="pointer-events-auto relative flex max-h-[85vh] w-[min(94vw,32rem)] flex-col items-center overflow-y-auto rounded-[24px] border border-[#8e9ae0]/25 bg-[#06070F]/95 px-5 py-5 text-center shadow-[0_18px_60px_rgba(2,3,12,0.6)] backdrop-blur-xl">
        {closeBtn}

        {open && (
          <AlfredStar
            speaking={speaking}
            listening={listening}
            className={
              panelOpen
                ? "aspect-square h-[clamp(72px,12vh,120px)] w-auto"
                : "aspect-square h-[clamp(110px,18vh,180px)] w-auto"
            }
          />
        )}
        {!panelOpen && (
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.34em] text-[#8e9ae0]/70">
            Alfred
          </p>
        )}

        {chat}

        {!panelOpen && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-[11px] font-light tracking-wide text-[#8e9ae0]/55 transition-colors hover:text-[#cad1e8]"
          >
            Esc · “that&rsquo;s all” to dismiss
          </button>
        )}
      </div>
    </div>
  );
}
