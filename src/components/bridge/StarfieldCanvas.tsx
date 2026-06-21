"use client";

import { useEffect, useRef } from "react";

/* Full-viewport deep-space starfield — faint periwinkle stars that slowly
   drift and twinkle. Canvas + requestAnimationFrame so it always animates
   (no reliance on CSS keyframes firing). Sits behind everything. */
export default function StarfieldCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let paused = false;

    type Star = {
      x: number;
      y: number;
      r: number;
      a: number;
      ph: number;
      tw: number;
      vx: number;
      vy: number;
    };
    let stars: Star[] = [];

    function seed() {
      const count = Math.round(Math.min(160, Math.max(50, (w * h) / 8500)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        a: Math.random() * 0.5 + 0.18,
        ph: Math.random() * Math.PI * 2,
        tw: Math.random() * 0.0016 + 0.0004,
        vx: (Math.random() - 0.5) * 0.014,
        vy: (Math.random() - 0.5) * 0.012 - 0.006, // gentle upward drift
      }));
    }

    function resize() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    let last = performance.now();
    function frame(t: number) {
      if (!ctx) return;
      const dt = Math.min(60, t - last);
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#cad1e8";
      for (const s of stars) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.x < -2) s.x = w + 2;
        else if (s.x > w + 2) s.x = -2;
        if (s.y < -2) s.y = h + 2;
        else if (s.y > h + 2) s.y = -2;
        const tw = 0.5 + 0.5 * Math.sin(s.ph + t * s.tw);
        ctx.globalAlpha = s.a * tw;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!paused) raf = requestAnimationFrame(frame);
    }

    // Pause the rAF loop when the tab is hidden or the canvas is off-screen.
    let onScreen = true;
    let hidden = typeof document !== "undefined" && document.hidden;
    function setPaused(p: boolean) {
      if (p === paused) return;
      paused = p;
      if (p) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        last = performance.now();
        if (!raf) raf = requestAnimationFrame(frame);
      }
    }
    const evaluate = () => setPaused(hidden || !onScreen);
    const onVis = () => {
      hidden = document.hidden;
      evaluate();
    };
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
        evaluate();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
