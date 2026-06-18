"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AlfredStar from "@/components/bridge/AlfredStar";
import { composeBriefing, type BridgeData } from "@/lib/bridge/briefing";

/* THE BRIDGE — the post-login welcome. A calm deep-space canvas that is just
   Alfred, a living star, who greets the user by name and speaks a live briefing
   aloud automatically (no buttons), then offers a quiet way into the dashboard. */

export default function Bridge({ data }: { data: BridgeData }) {
  const [now, setNow] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const spokenRef = useRef(false);

  // Device-tz "now" is only known after mount — compute the briefing then.
  useEffect(() => setNow(Date.now()), []);

  const briefing = useMemo(
    () => (now == null ? null : composeBriefing(data, now)),
    [data, now],
  );

  // Auto-speak. Browsers block audio before a user gesture, so we (1) attempt
  // immediately, (2) retry when voices finish loading, and (3) fall back to the
  // first pointer/keydown anywhere on the page. No visible "speak" button.
  useEffect(() => {
    if (!briefing) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    function removeGestureListeners() {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    }

    function speakNow() {
      if (spokenRef.current || !briefing) return;
      const u = new SpeechSynthesisUtterance(briefing.spoken);
      const voice = pickVoice(synth);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || "en-GB";
      u.rate = 0.96;
      u.pitch = 1;
      u.onstart = () => {
        spokenRef.current = true;
        setSpeaking(true);
        removeGestureListeners();
      };
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      try {
        synth.cancel();
        synth.speak(u);
      } catch {
        /* stay silent — the visuals carry on regardless */
      }
    }

    function onGesture() {
      speakNow();
    }
    function onVoices() {
      if (!spokenRef.current) speakNow();
    }

    synth.addEventListener?.("voiceschanged", onVoices);
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);

    // Try straight away (works once the entry gesture has primed speech).
    speakNow();

    return () => {
      synth.removeEventListener?.("voiceschanged", onVoices);
      removeGestureListeners();
      synth.cancel();
    };
  }, [briefing]);

  const stars = useStarfield();

  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-[#06070F] text-[#eef1f8]">
      {/* Drifting, twinkling periwinkle starfield */}
      <div className="sw-starfield">
        {stars.map((s, i) => (
          <span
            key={i}
            className="sw-star-dot"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
        <AlfredStar speaking={speaking} />

        <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.32em] text-[#8e9ae0]/70">
          Alfred
        </p>

        {/* Greeting + briefing — typeset light, with lots of space. Fades in
            once the device-tz briefing is ready. */}
        <div
          className={[
            "mt-5 flex max-w-xl flex-col items-center transition-opacity duration-700",
            briefing ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <h1 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
            {briefing?.greeting ?? " "}
          </h1>

          {briefing && (
            <p className="mt-4 text-base font-light leading-relaxed text-[#cad1e8]/85">
              {briefing.synthesis}
            </p>
          )}

          {briefing && briefing.lines.length > 0 && (
            <ul className="mt-8 flex flex-col items-center gap-3">
              {briefing.lines.map((line, i) => (
                <li
                  key={i}
                  className="text-sm font-light leading-relaxed tracking-wide text-[#aab2dd]/80"
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quiet way into the dashboard. */}
        <Link
          href="/dashboard/overview"
          className="group mt-14 inline-flex items-center gap-2 rounded-full border border-[#8e9ae0]/25 px-6 py-2.5 text-sm font-light tracking-wide text-[#cad1e8] transition-colors duration-300 hover:border-[#8e9ae0]/55 hover:bg-white/[0.04] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8e9ae0]/40"
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
      </div>
    </main>
  );
}

/* Prefer an en-GB browser voice, then any English, then whatever's default. */
function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}

/* A deterministic starfield (seeded) so server and client render identically —
   no hydration mismatch, no Math.random at render time. */
type Star = { x: number; y: number; size: number; delay: number; dur: number };

function useStarfield(): Star[] {
  return useMemo(() => {
    const rand = lcg(0x53571ce); // fixed seed
    return Array.from({ length: 70 }, () => {
      const size = 1 + Math.round(rand() * 2);
      return {
        x: rand() * 100,
        y: rand() * 100,
        size,
        delay: rand() * 6,
        dur: 4 + rand() * 6,
      };
    });
  }, []);
}

/* Tiny seeded PRNG (mulberry32). */
function lcg(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
