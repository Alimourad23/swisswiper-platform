import type { CSSProperties } from "react";

/* Brand logos for the channels — used in page headings and the sidebar so each
   channel is instantly recognisable. */

export function LinkedInLogo({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style} aria-hidden="true">
      <rect width="24" height="24" rx="4.5" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M8.34 9.9H5.98V18h2.36V9.9Zm.16-2.53a1.37 1.37 0 1 0-2.74 0 1.37 1.37 0 0 0 2.74 0ZM18.02 18h-2.36v-3.96c0-.99-.36-1.67-1.24-1.67-.68 0-1.08.46-1.26.9-.06.16-.08.38-.08.6V18h-2.36s.03-7.28 0-8.1h2.36v1.15c.31-.48.87-1.17 2.13-1.17 1.56 0 2.73 1.02 2.73 3.21V18Z"
      />
    </svg>
  );
}

export function InstagramLogo({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.35" stopColor="#FA7E1E" />
          <stop offset="0.62" stopColor="#D62976" />
          <stop offset="0.85" stopColor="#962FBF" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
      <rect x="5" y="5" width="14" height="14" rx="4.5" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16.4" cy="7.6" r="1.05" fill="#fff" />
    </svg>
  );
}
