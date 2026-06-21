"use client";

import { unlockAudio } from "@/lib/bridge/voice";

/* The Overview hero's Alfred presence — tapping it summons the Alfred
   conversation panel (the same overlay the floating control opens elsewhere).
   It dispatches a window event the persistent AlfredSummon listens for. */
export default function AlfredOrb({ firstName = "Ali" }: { firstName?: string }) {
  function summon() {
    unlockAudio(); // this tap is a gesture — unlock ElevenLabs playback
    window.dispatchEvent(new Event("sw-alfred-summon"));
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={summon}
        aria-label="Summon Alfred"
        title={`Talk to Alfred${firstName ? `, ${firstName}` : ""}`}
        className="group relative grid h-32 w-32 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-peri-deep/40"
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
          className="sw-breathe relative grid h-20 w-20 place-items-center rounded-full ring-1 ring-hairline transition-transform duration-300 group-hover:scale-105"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, #ffffff 0%, #eef1f8 38%, #cad1e8 78%, #b6c0de 100%)",
          }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-peri-deep/70" aria-hidden="true" />
        </span>
      </button>

      <span className="text-xs text-hint">Alfred · tap to talk</span>
    </div>
  );
}
