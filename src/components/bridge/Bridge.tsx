"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AlfredStar from "@/components/bridge/AlfredStar";
import StarfieldCanvas from "@/components/bridge/StarfieldCanvas";
import AlfredChat from "@/components/bridge/AlfredChat";
import { composeBriefing, type BridgeData } from "@/lib/bridge/briefing";
import { speak, stopSpeaking, unlockAudio } from "@/lib/bridge/voice";

/* THE BRIDGE — the post-login welcome. A calm deep-space canvas that is just
   Alfred, a living star, who greets the user by name and speaks a live briefing
   aloud automatically (no buttons), then offers a quiet way into the dashboard.
   Everything fits one viewport — no scrolling. */

// Full briefing on the first Bridge visit of a session, or when it's been a
// while since the last (>3h, or a new calendar day); otherwise a short greeting.
const SESSION_KEY = "sw-bridge-session";
const LAST_KEY = "sw-bridge-briefed-at";
const FULL_AFTER_MS = 3 * 60 * 60 * 1000;

// Warm, varied butler follow-ups for the calm short state (after engaging /
// after any action). Some are just the greeting on its own.
function pickShort(firstName: string): string {
  const lines = [
    "How may I help you, sir?",
    "How may I be of assistance?",
    "At your service, sir.",
    `Anything else I can do for you, ${firstName}?`,
    `What else would you like to do, ${firstName}?`,
    "Ready whenever you are.",
    "",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

export default function Bridge({ data }: { data: BridgeData }) {
  const [now, setNow] = useState<number | null>(null);
  const [mode, setMode] = useState<"full" | "short" | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // Once the user engages (taps mic / a panel opens) or an action runs, the
  // full briefing collapses to a calm short greeting — and never re-reads.
  const [collapsed, setCollapsed] = useState(false);
  const [shortLine, setShortLine] = useState("");
  const prevPanelOpen = useRef(false);
  const engagedRef = useRef(false);
  const spokenRef = useRef(false);

  // The moment the user engages (taps mic / speaks / starts any action), the
  // full briefing collapses to a calm short greeting — and stays short for the
  // rest of the visit (Cancel and completion behave identically).
  const handleEngage = useCallback(() => {
    if (engagedRef.current) return;
    engagedRef.current = true;
    setCollapsed(true);
    setShortLine(pickShort(data.firstName));
  }, [data.firstName]);

  // Device-tz "now" + the full/short decision are only known after mount.
  useEffect(() => {
    const t = Date.now();
    setNow(t);

    let full = true;
    try {
      const sessionBriefed = window.sessionStorage.getItem(SESSION_KEY) === "1";
      const lastAt = Number(window.localStorage.getItem(LAST_KEY) || 0);
      const overThreeHours = !lastAt || t - lastAt > FULL_AFTER_MS;
      const newDay = !lastAt || new Date(lastAt).toDateString() !== new Date(t).toDateString();
      full = !sessionBriefed || overThreeHours || newDay;
      window.sessionStorage.setItem(SESSION_KEY, "1");
      window.localStorage.setItem(LAST_KEY, String(t));
    } catch {
      full = true; // storage unavailable — give the full briefing
    }
    setMode(full ? "full" : "short");
  }, []);

  const briefing = useMemo(
    () => (now == null || mode == null ? null : composeBriefing(data, now, mode)),
    [data, now, mode],
  );

  // After an action panel closes, freshen the warm short line for variety.
  useEffect(() => {
    if (prevPanelOpen.current && !panelOpen) setShortLine(pickShort(data.firstName));
    prevPanelOpen.current = panelOpen;
  }, [panelOpen, data.firstName]);

  // What's shown on screen: the full/short briefing until the user engages,
  // then a calm short greeting (the spoken briefing is unchanged — set once).
  const view =
    collapsed && briefing
      ? { greeting: briefing.greeting, synthesis: shortLine, lines: [] as string[] }
      : briefing;

  // Auto-speak the briefing in Alfred's voice. Audio is blocked before a user
  // gesture, so we speak as soon as we can and otherwise on the first
  // pointer/keydown anywhere on the page. No visible "speak" button.
  useEffect(() => {
    if (!briefing) return;
    if (typeof window === "undefined") return;

    function removeGestureListeners() {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    }

    function speakNow() {
      if (spokenRef.current || !briefing) return;
      speak(briefing.spoken, {
        onStart: () => {
          spokenRef.current = true;
          setSpeaking(true);
          removeGestureListeners();
        },
        onEnd: () => setSpeaking(false),
      });
    }

    function onGesture() {
      unlockAudio(); // first interaction unlocks ElevenLabs playback
      speakNow();
    }

    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);

    // Only attempt immediately if the page has already had user activation
    // (so we don't spend a TTS call on a guaranteed-blocked cold load). When
    // the API can't tell us, attempt anyway — the gesture path is the backstop.
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
      .userActivation;
    if (!ua || ua.hasBeenActive) speakNow();

    return () => {
      removeGestureListeners();
      stopSpeaking();
    };
  }, [briefing]);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#06070F] text-[#eef1f8]">
      {/* Drifting, twinkling periwinkle starfield (canvas, always animating) */}
      <StarfieldCanvas />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <AlfredStar
          speaking={speaking}
          listening={listening}
          className={
            panelOpen
              ? "aspect-square h-[clamp(110px,20vh,200px)] w-auto"
              : "aspect-square h-[clamp(190px,40vh,360px)] w-auto"
          }
        />

        {/* Greeting + briefing — hidden while a review panel is open, for focus. */}
        {!panelOpen && (
          <>
            <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.34em] text-[#8e9ae0]/70">
              Alfred
            </p>
            <div
              className={[
                "mt-2 flex max-w-xl flex-col items-center transition-opacity duration-700",
                view ? "opacity-100" : "opacity-0",
              ].join(" ")}
            >
              <h1 className="text-2xl font-light tracking-tight text-white sm:text-3xl">
                {view?.greeting ?? " "}
              </h1>

              {view?.synthesis && (
                <p className="mt-2.5 text-sm font-light leading-relaxed text-[#cad1e8]/85 sm:text-base">
                  {view.synthesis}
                </p>
              )}

              {view && view.lines.length > 0 && (
                <ul className="mt-4 flex flex-col items-center gap-1.5">
                  {view.lines.map((line, i) => (
                    <li
                      key={i}
                      className="text-xs font-light leading-relaxed tracking-wide text-[#aab2dd]/80 sm:text-sm"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Talk to Alfred — push-to-talk; voice only, the star is the feedback. */}
        <AlfredChat
          onSpeakingChange={setSpeaking}
          onListeningChange={setListening}
          onPanelOpenChange={setPanelOpen}
          onEngage={handleEngage}
        />

        {/* Quiet way into the dashboard — hidden while a review panel is open. */}
        {!panelOpen && (
          <Link
            href="/dashboard/overview"
            className="group mt-8 inline-flex items-center gap-2 rounded-full border border-[#8e9ae0]/25 px-6 py-2.5 text-sm font-light tracking-wide text-[#cad1e8] transition-colors duration-300 hover:border-[#8e9ae0]/55 hover:bg-white/[0.04] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8e9ae0]/40"
          >
            Enter dashboard
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        )}
      </div>
    </main>
  );
}
