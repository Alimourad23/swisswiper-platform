"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AlfredOverlay, { type Showcase } from "@/components/bridge/AlfredOverlay";
import type { EmailDraftState } from "@/components/bridge/EmailReview";
import { unlockAudio } from "@/lib/bridge/voice";

/* Makes Alfred reachable from every dashboard page. Lives in the dashboard
   layout, so it (and the overlay's conversation) persists across in-dashboard
   navigation. Three ways to summon him:
   • a small, understated star button in the corner (always works),
   • a global hotkey: Ctrl/⌘ + .
   • a "Hey Alfred" wake word — a background recognizer behind a toggle that's
     OFF by default (always-on mic has battery/privacy cost). */

const WAKE_KEY = "sw-alfred-wake";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function AlfredSummon() {
  const [open, setOpen] = useState(false);
  const [wake, setWake] = useState(false);
  const [wakeSupported, setWakeSupported] = useState(true);
  const [autoListenKey, setAutoListenKey] = useState(0);
  const [seed, setSeed] = useState("");
  const [seedKey, setSeedKey] = useState(0);
  const [showcase, setShowcase] = useState<Showcase | null>(null);
  const [presetEmail, setPresetEmail] = useState<EmailDraftState | null>(null);
  const [presetKey, setPresetKey] = useState(0);

  useEffect(() => {
    try {
      setWake(window.localStorage.getItem(WAKE_KEY) === "1");
    } catch {
      /* ignore */
    }
    if (!recognitionCtor()) setWakeSupported(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setShowcase(null); // next plain summon returns to the compact card
    setPresetEmail(null);
  }, []);

  // The Overview hero orb (and anything else) summons Alfred via this event,
  // so the floating control can be hidden there without losing the overlay.
  useEffect(() => {
    function onSummon(e: Event) {
      unlockAudio();
      setOpen(true);
      // A seeded summon (e.g. "Draft a reply to …" from the Emails page) submits
      // straight to Alfred; a plain summon just opens and listens. A `showcase`
      // turns it into the full-screen reply composer.
      const detail = (e as CustomEvent).detail as
        | { seed?: string; showcase?: Showcase; presetEmail?: EmailDraftState }
        | undefined;
      if (detail?.presetEmail) {
        // Reopen an existing saved draft for review/send.
        setShowcase(detail.showcase ?? null);
        setPresetEmail(detail.presetEmail);
        setPresetKey((k) => k + 1);
      } else if (detail?.seed && detail.seed.trim()) {
        setSeed(detail.seed.trim());
        setShowcase(detail.showcase ?? null);
        setPresetEmail(null);
        setSeedKey((k) => k + 1);
      } else {
        setShowcase(null);
        setPresetEmail(null);
        setAutoListenKey((k) => k + 1);
      }
    }
    window.addEventListener("sw-alfred-summon", onSummon);
    return () => window.removeEventListener("sw-alfred-summon", onSummon);
  }, []);

  // Hide the floating control on the Overview — its hero orb is the entry point.
  const pathname = usePathname();
  const hideControl = pathname === "/dashboard/overview";

  function toggleWake() {
    unlockAudio(); // user gesture — unlock ElevenLabs playback for later
    setWake((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(WAKE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Hotkey — Ctrl/⌘ + . toggles the overlay (works even inside inputs).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        unlockAudio(); // key press is a gesture — unlock playback
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "Hey Alfred" wake word — only while the toggle is on AND the overlay is
  // closed (so it doesn't fight Alfred's own mic). Restarts itself when the
  // browser ends the session.
  useEffect(() => {
    if (!wake || open) return;
    const Ctor = recognitionCtor();
    if (!Ctor) return;

    let stopped = false;
    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (/\balfred\b/i.test(txt)) {
        setOpen(true);
        setAutoListenKey((k) => k + 1);
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setWake(false);
        try {
          window.localStorage.setItem(WAKE_KEY, "0");
        } catch {
          /* ignore */
        }
      }
    };
    rec.onend = () => {
      if (!stopped && wake && !open) {
        try {
          rec.start();
        } catch {
          /* will retry on next toggle */
        }
      }
    };

    try {
      rec.start();
    } catch {
      /* ignore */
    }
    return () => {
      stopped = true;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [wake, open]);

  return (
    <>
      {!hideControl && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2 print:hidden">
        {wakeSupported && (
          <button
            type="button"
            onClick={toggleWake}
            aria-pressed={wake}
            title={
              wake
                ? "“Hey Alfred” is on — listening for your voice. Tap to turn off."
                : "Enable the “Hey Alfred” wake word"
            }
            className={[
              "relative grid h-8 w-8 place-items-center rounded-full ring-1 transition-colors",
              wake
                ? "bg-peri-soft text-peri-deep ring-peri-deep/30"
                : "bg-surface text-hint ring-hairline hover:text-muted",
            ].join(" ")}
          >
            {wake && (
              <span className="absolute inset-0 animate-ping rounded-full bg-peri-deep/15" />
            )}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            unlockAudio(); // click is a gesture — unlock ElevenLabs playback
            setOpen(true);
          }}
          aria-label="Summon Alfred"
          title="Summon Alfred  ·  Ctrl/⌘ + ."
          className="group relative grid h-12 w-12 place-items-center rounded-full bg-surface text-peri-deep shadow-[var(--shadow-card)] ring-1 ring-hairline transition-all hover:scale-105 hover:shadow-[var(--shadow-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-peri-deep/40"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.4a3 3 0 0 0 1.8 1.8L21 12l-5.3 1.9a3 3 0 0 0-1.8 1.8L12 21l-1.9-5.3a3 3 0 0 0-1.8-1.8L3 12l5.3-1.8a3 3 0 0 0 1.8-1.8z" />
          </svg>
        </button>
        </div>
      )}

      <AlfredOverlay
        open={open}
        onClose={close}
        autoListenKey={autoListenKey}
        seed={seed}
        seedKey={seedKey}
        showcase={showcase}
        presetEmail={presetEmail}
        presetKey={presetKey}
      />
    </>
  );
}
