"use client";

/* Alfred, the raging star — a living deep-space presence.

   Pure CSS/SVG, GPU-friendly. Two states driven by `speaking`:
   IDLE = a steady burn; SPEAKING = rays extend + spin faster, the core flares
   and flickers faster, the corona pulses faster and the glow swells. All the
   intensity changes ride a ~0.7s transition (see globals.css .is-speaking). */

const LONG_RAYS = 28;
const SHORT_RAYS = 44;

function rayLines(
  count: number,
  inner: number,
  outer: number,
  color: string,
  opacity: number,
  width: number,
) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return (
      <line
        key={i}
        x1={cos * inner}
        y1={sin * inner}
        x2={cos * outer}
        y2={sin * outer}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  });
}

export default function AlfredStar({ speaking }: { speaking: boolean }) {
  return (
    <div className={`sw-star ${speaking ? "is-speaking" : ""}`} aria-hidden="true">
      {/* Soft glow layers */}
      <div className="sw-star-glow sw-glow-a" />
      <div className="sw-star-glow sw-glow-b" />

      {/* Corona rings pulsing outward */}
      <span className="sw-corona" />
      <span className="sw-corona" style={{ animationDelay: "1.3s" }} />
      <span className="sw-corona" style={{ animationDelay: "2.6s" }} />

      {/* Long rays — slow rotation */}
      <div className="sw-rays sw-rays-long">
        <svg viewBox="-100 -100 200 200">{rayLines(LONG_RAYS, 56, 96, "#8e9ae0", 0.7, 0.7)}</svg>
      </div>
      {/* Short rays — counter-rotation */}
      <div className="sw-rays sw-rays-short">
        <svg viewBox="-100 -100 200 200">{rayLines(SHORT_RAYS, 48, 74, "#cad1e8", 0.45, 0.5)}</svg>
      </div>

      {/* White-hot core + halo */}
      <div className="sw-core-glow" />
      <div className="sw-core" />
    </div>
  );
}
