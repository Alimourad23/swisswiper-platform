"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speak } from "@/lib/bridge/voice";

/* Push-to-talk conversation with Alfred. Tap the mic → the browser transcribes
   speech → send it to /api/alfred/chat → speak the reply (the star intensifies
   while he speaks). A minimal transcript shows the exchange. Errors are shown
   quietly; nothing throws. The "Hey Alfred" wake word comes later. */

type ChatMessage = { role: "user" | "assistant"; content: string };

/* Minimal shape of the browser SpeechRecognition we use. */
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

export default function AlfredChat({
  onSpeakingChange,
  onActiveChange,
}: {
  onSpeakingChange: (speaking: boolean) => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeZone = useRef("UTC");

  useEffect(() => {
    try {
      timeZone.current = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      /* keep UTC */
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) setSupported(false);
  }, []);

  useEffect(() => {
    onActiveChange?.(messages.length > 0);
  }, [messages.length, onActiveChange]);

  // Keep the transcript scrolled to the latest line.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = useCallback(
    async (text: string) => {
      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setHeard("");
      setError(null);
      setPending(true);
      try {
        const res = await fetch("/api/alfred/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, timeZone: timeZone.current }),
        });
        const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
        if (!res.ok || !data.reply) {
          throw new Error(data.error || "Alfred is unavailable right now.");
        }
        setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
        speak(data.reply, {
          onStart: () => onSpeakingChange(true),
          onEnd: () => onSpeakingChange(false),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setPending(false);
      }
    },
    [messages, onSpeakingChange],
  );

  const startListening = useCallback(() => {
    setError(null);
    // Stop Alfred mid-sentence if he's talking, so the user can interject.
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    onSpeakingChange(false);

    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }

    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = "";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setHeard((finalRef.current + " " + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("I can't hear you — microphone access is blocked.");
      } else if (e.error === "no-speech") {
        setError("I didn't catch anything. Tap and try again.");
      } else if (e.error !== "aborted") {
        setError("I had trouble listening. Do try again.");
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalRef.current.trim();
      if (text) void send(text);
      else setHeard("");
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("I couldn't start listening. Do try again.");
    }
  }, [onSpeakingChange, send]);

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (pending) return;
    startListening();
  }

  const lastFew = messages.slice(-6);

  return (
    <div className="mt-7 flex w-full max-w-lg flex-col items-center">
      {/* Transcript */}
      {(messages.length > 0 || pending) && (
        <div
          ref={scrollRef}
          className="mb-4 flex max-h-[24vh] w-full flex-col gap-2 overflow-y-auto px-1 text-left"
        >
          {lastFew.map((m, i) => (
            <p
              key={i}
              className={[
                "text-sm font-light leading-relaxed",
                m.role === "user" ? "text-[#aab2dd]/70" : "text-[#eef1f8]/90",
              ].join(" ")}
            >
              <span className="mr-1.5 text-[11px] uppercase tracking-wider text-[#8e9ae0]/60">
                {m.role === "user" ? "You" : "Alfred"}
              </span>
              {m.content}
            </p>
          ))}
          {pending && (
            <p className="text-sm font-light text-[#8e9ae0]/60">
              <span className="mr-1.5 text-[11px] uppercase tracking-wider text-[#8e9ae0]/60">
                Alfred
              </span>
              <span className="sw-thinking-dots">thinking</span>
            </p>
          )}
        </div>
      )}

      {/* Live transcription while listening */}
      {listening && (
        <p className="mb-3 min-h-5 text-sm font-light italic text-[#cad1e8]/80">
          {heard || "Listening…"}
        </p>
      )}

      {/* Mic control */}
      <button
        type="button"
        onClick={toggleMic}
        disabled={!supported || pending}
        aria-label={listening ? "Stop listening" : "Talk to Alfred"}
        aria-pressed={listening}
        className={[
          "group relative grid h-14 w-14 place-items-center rounded-full border transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8e9ae0]/40 disabled:opacity-40",
          listening
            ? "border-[#cad1e8]/70 bg-[#cad1e8]/15 text-white"
            : "border-[#8e9ae0]/30 bg-white/[0.03] text-[#cad1e8] hover:border-[#8e9ae0]/60 hover:bg-white/[0.06]",
        ].join(" ")}
      >
        {listening && (
          <span className="absolute inset-0 animate-ping rounded-full border border-[#cad1e8]/40" />
        )}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>

      <p className="mt-3 h-4 text-xs font-light tracking-wide text-[#8e9ae0]/60">
        {!supported
          ? "Voice input isn't supported in this browser."
          : error
            ? ""
            : listening
              ? "Tap to stop"
              : pending
                ? "Alfred is thinking…"
                : "Tap to talk to Alfred"}
      </p>
      {error && <p className="mt-1 text-xs font-light text-[#e6a3a3]/90">{error}</p>}
    </div>
  );
}
