"use client";

import { useEffect, useState } from "react";
import AlfredStar from "@/components/bridge/AlfredStar";
import AlfredChat from "@/components/bridge/AlfredChat";

/* Summon-anywhere Alfred — a COMPACT panel floating over the current page (the
   page stays visible and usable behind it; no full-screen takeover or blur).
   A small deep-space card holds the star + voice conversation. Dismissible by
   Esc, the close control, or saying "that's all". The full-screen star lives
   only on the Bridge welcome page.

   AlfredChat stays mounted across open/close (and across in-dashboard
   navigation, since this lives in the dashboard layout) so the conversation
   continues after Alfred navigates you somewhere. */
export default function AlfredOverlay({
  open,
  onClose,
  autoListenKey = 0,
  seed = "",
  seedKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  autoListenKey?: number;
  seed?: string;
  seedKey?: number;
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

  return (
    <div
      aria-hidden={!open}
      className={
        open
          ? "pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4 sm:bottom-6"
          : "hidden"
      }
    >
      {/* The card is the only interactive surface — the page behind stays usable. */}
      <div className="pointer-events-auto relative flex max-h-[85vh] w-[min(94vw,32rem)] flex-col items-center overflow-y-auto rounded-[24px] border border-[#8e9ae0]/25 bg-[#06070F]/95 px-5 py-5 text-center shadow-[0_18px_60px_rgba(2,3,12,0.6)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss Alfred"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-[#8e9ae0]/70 transition-colors hover:bg-white/[0.06] hover:text-[#cad1e8]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

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

        <AlfredChat
          active={open}
          autoListenKey={autoListenKey}
          seed={seed}
          seedKey={seedKey}
          onDismiss={onClose}
          onSpeakingChange={setSpeaking}
          onListeningChange={setListening}
          onPanelOpenChange={setPanelOpen}
        />

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
