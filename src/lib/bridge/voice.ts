/* Shared browser-speech helpers for the Bridge. Alfred prefers an en-GB voice
   (a butler should sound the part), then any English, then the default. */

export function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}

/* Speak a line aloud. Returns the utterance so callers can wire extra handlers.
   onStart/onEnd let the caller drive the star's speaking state. Safe to call
   even if speech is blocked — it just won't make a sound. */
export function speak(
  text: string,
  { onStart, onEnd }: { onStart?: () => void; onEnd?: () => void } = {},
): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
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
  return u;
}
