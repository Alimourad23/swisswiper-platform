"use client";

import { useEffect, useRef } from "react";

/* Alfred, the raging star — a living deep-space presence drawn on <canvas> and
   driven by requestAnimationFrame (so it ALWAYS animates, smoothly, regardless
   of CSS keyframe quirks in production).

   Always alive: rays counter-rotate, the core breathes + flickers, the corona
   pulses outward, the glow swells gently. When `speaking` is true the whole
   star intensifies (rays extend + spin faster, core flares brighter/faster,
   corona quickens, glow swells) — the intensity `k` eases in/out over ~0.7s. */
export default function AlfredStar({ speaking }: { speaking: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(0);

  useEffect(() => {
    target.current = speaking ? 1 : 0;
  }, [speaking]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let size = 0;
    let dpr = 1;
    let R = 0;
    let k = 0; // current intensity, eased toward target
    let angA = 0;
    let angB = 0;

    let gradLong: CanvasGradient | null = null;
    let gradShort: CanvasGradient | null = null;
    const geom = { liIn: 0, liOut: 0, siIn: 0, siOut: 0 };

    function build() {
      if (!ctx) return;
      // Outer reach is kept ≤ ~0.8R so the speaking extension (×1.18) still
      // fits inside the square canvas without clipping the ray tips.
      geom.liIn = R * 0.3;
      geom.liOut = R * 0.8;
      geom.siIn = R * 0.38;
      geom.siOut = R * 0.6;

      gradLong = ctx.createLinearGradient(geom.liIn, 0, geom.liOut, 0);
      gradLong.addColorStop(0, "rgba(142,154,224,0)");
      gradLong.addColorStop(0.16, "rgba(150,162,230,0.9)");
      gradLong.addColorStop(0.5, "rgba(142,154,224,0.55)");
      gradLong.addColorStop(1, "rgba(142,154,224,0)");

      gradShort = ctx.createLinearGradient(geom.siIn, 0, geom.siOut, 0);
      gradShort.addColorStop(0, "rgba(202,209,232,0)");
      gradShort.addColorStop(0.22, "rgba(220,225,245,0.95)");
      gradShort.addColorStop(1, "rgba(202,209,232,0)");
    }

    function resize() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.min(canvas.clientWidth, canvas.clientHeight);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = size / 2;
      build();
    }

    function drawRays(
      count: number,
      baseAng: number,
      grad: CanvasGradient,
      inner: number,
      outer: number,
      width: number,
      t: number,
    ) {
      if (!ctx) return;
      ctx.lineWidth = width;
      ctx.strokeStyle = grad;
      for (let i = 0; i < count; i++) {
        const a = baseAng + (i / count) * Math.PI * 2;
        const shimmer = 0.62 + 0.38 * Math.sin(a * 3 + t * 0.004 + i);
        ctx.globalAlpha = Math.min(1, (0.5 + 0.5 * k) * shimmer);
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(inner, 0);
        ctx.lineTo(outer, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    let last = performance.now();
    function frame(t: number) {
      if (!ctx) return;
      const dt = Math.min(50, t - last);
      last = t;

      // Ease intensity toward target — time constant ~150ms ≈ 0.7s settle.
      k += (target.current - k) * (1 - Math.exp(-dt / 150));

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(R, R);
      ctx.globalCompositeOperation = "lighter"; // additive — luminous bloom

      // Organic core flicker (sum of sines).
      const flick =
        0.9 +
        0.06 * Math.sin(t * 0.02) +
        0.04 * Math.sin(t * 0.013 + 1.3) +
        k * (0.12 + 0.06 * Math.sin(t * 0.05));
      const coreScale = (1 + 0.025 * Math.sin(t * 0.006)) * (1 + 0.06 * k);

      // ── Outer glow — deep, rich, swells on speaking ──────────────────
      // Radius stays ≤ R (fully fades inside the canvas, no square edge);
      // the "swell" comes from intensity, not from growing past the bounds.
      const glowR = R * 0.96;
      const gi = 0.6 + 0.35 * k;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
      glow.addColorStop(0, `rgba(122,130,192,${0.6 * gi})`);
      glow.addColorStop(0.32, `rgba(92,102,166,${0.46 * gi})`);
      glow.addColorStop(0.6, `rgba(70,80,150,${0.2 * gi})`);
      glow.addColorStop(1, "rgba(92,102,166,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      // ── Corona rings pulsing outward ─────────────────────────────────
      const period = 4200 * (1 - 0.45 * k);
      const rings = 3;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < rings; i++) {
        const phase = (t / period + i / rings) % 1;
        const rr = R * (0.3 + phase * 0.64);
        const alpha = (1 - phase) * 0.5 * (0.7 + 0.5 * k);
        ctx.strokeStyle = `rgba(202,209,232,${alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Rays — counter-rotating, extend on speaking ──────────────────
      angA += dt * 0.00017 * (1 + 1.4 * k);
      angB -= dt * 0.00021 * (1 + 1.4 * k);
      const ext = 1 + 0.18 * k;
      if (gradLong && gradShort) {
        ctx.save();
        ctx.scale(ext, ext); // grows geometry + gradient together
        drawRays(48, angA, gradLong, geom.liIn, geom.liOut, 1.1, t);
        drawRays(76, angB, gradShort, geom.siIn, geom.siOut, 0.8, t);
        ctx.restore();
      }

      // ── Core: a wide bloom + a white-hot center ──────────────────────
      const coreR = R * 0.3 * coreScale;
      const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.6);
      bloom.addColorStop(0, `rgba(255,255,255,${0.95 * flick})`);
      bloom.addColorStop(0.4, `rgba(238,241,248,${0.65 * flick})`);
      bloom.addColorStop(1, "rgba(202,209,232,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(0, 0, coreR * 2.6, 0, Math.PI * 2);
      ctx.fill();

      const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      hot.addColorStop(0, `rgba(255,255,255,${Math.min(1, flick)})`);
      hot.addColorStop(0.65, `rgba(255,255,255,${0.92 * flick})`);
      hot.addColorStop(1, `rgba(238,241,248,${0.45 * flick})`);
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      raf = requestAnimationFrame(frame);
    }

    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="aspect-square h-[clamp(190px,40vh,360px)] w-auto"
    />
  );
}
