/* A tiny, tasteful notification chime via the Web Audio API — no sound file,
   no dependency. A soft two-note ascending ping (A5 → D6) at low volume.

   Browsers block audio until the user has interacted with the page. We create
   / resume the AudioContext inside the play attempt and swallow any error, so
   a blocked chime never throws and the toast can still appear silently. */

let ctx: AudioContext | null = null;

export function playChime() {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!ctx) ctx = new Ctx();
    // If still suspended (no gesture yet), try to resume; don't block on it.
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime;
    const notes = [
      { freq: 880, at: 0 }, // A5
      { freq: 1174.66, at: 0.11 }, // D6
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      const t0 = start + n.at;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.1, t0 + 0.02); // quiet peak
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    }
  } catch {
    // Autoplay blocked or Web Audio unsupported — stay silent.
  }
}
