/* Alfred's voice. Primary: ElevenLabs "Julian" via /api/alfred/speak, played
   through ONE persistent <audio> element. Browsers block audio until a user
   gesture has unlocked playback — and the TTS fetch is slow enough that the
   gesture's activation can expire before we call play(). So we unlock the SAME
   element during the summon gesture (unlockAudio), then reuse it for every reply
   — that's what keeps Alfred speaking in Julian's voice in the overlay, not the
   robotic browser fallback. Fallback to speechSynthesis only on a genuine API
   error, so he's never silent. */

type SpeakOpts = { onStart?: () => void; onEnd?: () => void };

let audioEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let silentUrl: string | null = null;
let unlocked = false;
let gen = 0; // invalidates a stale fetch when a newer speak / stop happens

function getAudioEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
  }
  return audioEl;
}

/* A real (not zero-length) 0.1s silent WAV — playing it during a gesture is what
   actually unlocks the element for later playback. */
function getSilentUrl(): string {
  if (silentUrl) return silentUrl;
  const rate = 8000;
  const n = Math.round(rate * 0.1);
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); // 8-bit
  str(36, "data");
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); // 8-bit silence
  silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silentUrl;
}

/* Call this from a user gesture (summon button / hotkey / mic tap) so later
   ElevenLabs playback isn't blocked. Cheap + idempotent after the first unlock. */
export function unlockAudio(): void {
  if (unlocked || typeof window === "undefined") return;
  const a = getAudioEl();
  if (!a) return;
  try {
    a.muted = true;
    a.src = getSilentUrl();
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        try {
          a.pause();
          a.currentTime = 0;
        } catch {
          /* ignore */
        }
        a.muted = false;
        unlocked = true;
      }).catch(() => {
        a.muted = false;
      });
    } else {
      unlocked = true;
    }
  } catch {
    /* ignore */
  }
}

export function stopSpeaking(): void {
  gen++;
  if (audioEl) {
    audioEl.onplay = null;
    audioEl.onended = null;
    audioEl.onerror = null;
    try {
      audioEl.pause();
    } catch {
      /* ignore */
    }
  }
  if (currentUrl) {
    try {
      URL.revokeObjectURL(currentUrl);
    } catch {
      /* ignore */
    }
    currentUrl = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

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
      if (myGen !== gen) return;
      if (!res.ok) throw new Error(`tts ${res.status}`);

      const blob = await res.blob();
      if (myGen !== gen) return;

      const a = getAudioEl();
      if (!a) {
        browserSpeak(line, opts);
        return;
      }

      const url = URL.createObjectURL(blob);
      currentUrl = url;
      let started = false;
      a.muted = false;
      a.onplay = () => {
        started = true;
        opts.onStart?.();
      };
      a.onended = () => {
        if (currentUrl === url) {
          URL.revokeObjectURL(url);
          currentUrl = null;
        }
        opts.onEnd?.();
      };
      a.onerror = () => {
        if (currentUrl === url) {
          URL.revokeObjectURL(url);
          currentUrl = null;
        }
        if (!started && myGen === gen) browserSpeak(line, opts);
        else opts.onEnd?.();
      };
      a.src = url;
      try {
        await a.play();
      } catch {
        // Playback still blocked (gesture never unlocked it). Reset the star;
        // the caller's gesture-retry plays Julian on the next interaction.
        if (currentUrl === url) {
          URL.revokeObjectURL(url);
          currentUrl = null;
        }
        if (myGen === gen) opts.onEnd?.();
      }
    } catch {
      // API error / missing key → browser voice so Alfred is never silent.
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

export function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}
