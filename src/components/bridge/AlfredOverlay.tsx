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
    const initial = (showcase.from.trim()[0] || "•").toUpperCase();
    const status = speaking
      ? "Reading the message…"
      : panelOpen
        ? "Your reply — review, refine, send"
        : "Drafting your reply…";
    return (
      <div aria-hidden={!open} className={open ? "fixed inset-0 z-[100] overflow-hidden" : "hidden"}>
        {/* Deep-space backdrop with a soft periwinkle aurora */}
        <div className="absolute inset-0 bg-[#05060D]" />
        <div className="pointer-events-none absolute inset-x-0 -top-1/4 h-[70%] bg-[radial-gradient(55%_70%_at_50%_0%,rgba(142,154,224,0.20),transparent_70%)]" />
        <div className="pointer-events-none absolute -bottom-1/3 right-0 h-[60%] w-[60%] bg-[radial-gradient(50%_50%_at_70%_70%,rgba(92,102,166,0.14),transparent_70%)]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss Alfred"
          className="absolute right-5 top-5 z-20 grid h-9 w-9 place-items-center rounded-full border border-[#8e9ae0]/20 bg-white/[0.04] text-[#8e9ae0]/80 backdrop-blur transition-colors hover:bg-white/[0.1] hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col gap-5 p-5 sm:p-8 lg:flex-row">
          {/* LEFT — Alfred's reply (appears automatically) */}
          <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#8e9ae0]/20 bg-[#0a0c18]/70 shadow-[0_30px_90px_rgba(2,3,12,0.55)] backdrop-blur-2xl">
            <div className="flex items-center gap-4 border-b border-[#8e9ae0]/10 px-6 py-4">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center">
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(142,154,224,0.35),transparent_70%)] blur-md" />
                {open && <AlfredStar speaking={speaking} listening={listening} className="relative h-14 w-14" />}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-medium uppercase tracking-[0.34em] text-[#8e9ae0]/70">Alfred</p>
                <p className="truncate text-sm text-[#cdd3ea]/85">{status}</p>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-6">
              {chat}
            </div>
          </section>

          {/* RIGHT — the email being replied to */}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#8e9ae0]/15 bg-white/[0.025] backdrop-blur-2xl">
            <div className="border-b border-[#8e9ae0]/10 px-6 py-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.34em] text-[#8e9ae0]/55">Replying to</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8e9ae0]/45 to-[#5C66A6]/45 text-sm font-semibold text-white">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#eef1f8]">{showcase.from}</p>
                  <p className="truncate text-xs text-[#8e9ae0]/70">{showcase.subject}</p>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-6 py-5 text-[13px] leading-relaxed text-[#cdd3ea]/85">
              {showcase.body}
            </div>
          </section>
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
