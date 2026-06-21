"use client";

import { useEffect, useState } from "react";
import AlfredStar from "@/components/bridge/AlfredStar";
import AlfredChat from "@/components/bridge/AlfredChat";
import StarfieldCanvas from "@/components/bridge/StarfieldCanvas";

/* The summon-anywhere Alfred — the same star + voice conversation as the Bridge,
   shown as a focused overlay over the current dashboard page. Dismissible by
   Esc, tapping the backdrop, the close control, or saying "that's all".

   AlfredChat stays mounted across open/close (and across in-dashboard
   navigations, since this lives in the dashboard layout) so the conversation
   continues after Alfred navigates you somewhere. The heavy canvases only mount
   while open. */
export default function AlfredOverlay({
  open,
  onClose,
  autoListenKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  autoListenKey?: number;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div aria-hidden={!open} className={open ? "fixed inset-0 z-[100]" : "hidden"}>
      {/* Dimmed deep-space backdrop — tap to dismiss. */}
      <button
        type="button"
        aria-label="Dismiss Alfred"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#06070F]/92 backdrop-blur-md"
      />
      {open && <StarfieldCanvas />}

      <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="pointer-events-auto flex flex-col items-center">
          {open && (
            <AlfredStar
              speaking={speaking}
              listening={listening}
              className="aspect-square h-[clamp(150px,28vh,280px)] w-auto"
            />
          )}
          <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.34em] text-[#8e9ae0]/70">
            Alfred
          </p>

          <AlfredChat
            active={open}
            autoListenKey={autoListenKey}
            onDismiss={onClose}
            onSpeakingChange={setSpeaking}
            onListeningChange={setListening}
          />

          <button
            type="button"
            onClick={onClose}
            className="mt-6 text-xs font-light tracking-wide text-[#8e9ae0]/60 transition-colors hover:text-[#cad1e8]"
          >
            Dismiss · Esc · “that&rsquo;s all”
          </button>
        </div>
      </div>
    </div>
  );
}
