"use client";

import { useEffect, useState } from "react";

const GREETING = "Good morning, Ali. Your command center is ready.";

export default function AlfredOrb() {
  const [speaking, setSpeaking] = useState(false);

  // Stop any speech if the user navigates away.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleTap() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    // Tapping again while speaking stops it.
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(GREETING);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synth.cancel();
    setSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleTap}
        aria-label="Alfred — tap to speak"
        aria-pressed={speaking}
        className="relative grid h-32 w-32 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-peri-deep/40"
      >
        {/* Pulsing concentric rings */}
        <span className="sw-ring absolute h-24 w-24 rounded-full border border-peri-deep/30" />
        <span
          className="sw-ring absolute h-24 w-24 rounded-full border border-peri-deep/25"
          style={{ animationDelay: "1s" }}
        />
        <span
          className="sw-ring absolute h-24 w-24 rounded-full border border-peri-deep/20"
          style={{ animationDelay: "2s" }}
        />

        {/* Soft radial periwinkle core */}
        <span
          className="sw-breathe relative grid h-20 w-20 place-items-center rounded-full ring-1 ring-hairline"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, #ffffff 0%, #eef1f8 38%, #cad1e8 78%, #b6c0de 100%)",
          }}
        >
          {speaking ? (
            // Animated waveform while speaking
            <span className="flex items-end gap-[3px]" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="sw-wave-bar h-5 w-[3px] rounded-full bg-peri-deep"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </span>
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-peri-deep/70" aria-hidden="true" />
          )}
        </span>
      </button>

      <span className="text-xs text-hint">
        {speaking ? "Alfred · speaking…" : "Alfred · tap to speak"}
      </span>
    </div>
  );
}
