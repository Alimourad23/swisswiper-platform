/* Alfred's voice. Primary path: ElevenLabs "Julian" via our server route
   (/api/alfred/speak) played through an <audio> element. Fallback: the browser
   speechSynthesis, so Alfred always talks even if the API key is missing or the
   call fails. The star's speaking state is tied to play → ended either way. */

type SpeakOpts = { onStart?: () => void; onEnd?: () => void };

let currentAudio: HTMLAudioElement | null = null;
// Generation counter so a stale fetch never plays over a newer request / a stop.
let gen = 0;

/* Stop whatever Alfred is currently saying (audio or browser speech) and
   invalidate any in-flight TTS fetch. */
export function stopSpeaking() {
  gen++;
  if (currentAudio) {
    try {
      currentAudio.onplay = null;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.src = "";
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/* Speak a line. Tries ElevenLabs first, falls back to the browser voice. */
export function speak(text: string, opts: SpeakOpts = {}): void {
  if (typeof window === "undefined") return;
  const line = (text ?? "").trim();
  if (!line) {
    opts.onEnd?.();
    return;
  }

  stopSpeaking();
  const myGen = ++gen;

  void (async () => {
    try {
      const res = await fetch("/api/alfred/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line }),
      });
      if (myGen !== gen) return; // superseded by a newer speak / stop
      if (!res.ok) throw new Error(`tts ${res.status}`);

      const blob = await res.blob();
      if (myGen !== gen) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      let started = false;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
      };
      audio.onplay = () => {
        started = true;
        opts.onStart?.();
      };
      audio.onended = () => {
        cleanup();
        opts.onEnd?.();
      };
      audio.onerror = () => {
        cleanup();
        if (!started && myGen === gen) browserSpeak(line, opts);
        else opts.onEnd?.();
      };

      await audio.play().catch(() => {
        // Autoplay blocked (no user gesture yet) or playback refused. Don't
        // force the browser voice here — it's blocked for the same reason; the
        // caller's gesture-retry will call speak() again once interaction frees
        // audio. Reset the star so it isn't stuck mid-flare.
        cleanup();
        if (myGen === gen) opts.onEnd?.();
      });
    } catch {
      // API error / key missing → graceful fallback so Alfred is never silent.
      if (myGen === gen) browserSpeak(line, opts);
    }
  })();
}

/* ── Browser speechSynthesis fallback ──────────────────────────────────── */

export function browserSpeak(text: string, { onStart, onEnd }: SpeakOpts = {}): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(synth);
  if (voice) u.voice = voice;
  u.lang = voice?.lang || "en-GB";
  u.rate = 0.97;
  u.pitch = 1;
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  try {
    synth.cancel();
    synth.speak(u);
  } catch {
    onEnd?.();
  }
}

/* Prefer an en-GB browser voice, then any English, then the default. */
export function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}
