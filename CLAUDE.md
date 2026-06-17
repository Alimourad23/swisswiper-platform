# CLAUDE.md — SwissWiper Performance Platform

This file tells Claude Code how to build and maintain this project. Read it at the start of every session.

> Tech note: this project uses **Next.js 16** (App Router) — see `AGENTS.md` for the framework's own breaking-change warnings.

## Who you're working with

Ali is a non-technical founder who cannot read code. Explain what you're doing in plain English; give exact terminal commands to copy-paste, one step at a time; never assume knowledge of git, npm, servers, or hosting; confirm before anything destructive; when something breaks, explain the cause simply and propose the fix; prefer the simplest solution that works, no extra dependencies unless needed.

## What we're building

An internal web app — the heart of SwissWiper performance — that the team logs into to see five areas in one place: Emails (Gmail activity), Calendar (agenda, meeting load), Marketing (LinkedIn/Instagram/TikTok), Sales (pipeline, conversion), Orders (order-to-delivery status). A later phase adds JARVIS: a voice layer that speaks a daily briefing and performs a whitelist of safe actions with confirmation.

## Tech stack (keep to this)

Next.js (App Router) + TypeScript; Tailwind CSS; Supabase (Google sign-in) added in the auth phase; hosting on Vercel (auto-deploy from GitHub repo swisswiper-platform); integrations: Google APIs (Gmail, Calendar), Apollo (sales), social platforms later. Do not add other frameworks or large libraries without explaining why and getting Ali's OK.

## Brand guidelines (non-negotiable — luxury brand)

Colour ratio: White 60% / Black 30% / Periwinkle 10% (accents and CTAs only).

- `--sw-white` #FFFFFF (dominant background)
- `--sw-black` #000000 (text, primary surfaces)
- `--sw-periwinkle` #CAD1E8 (accents, active states, CTAs only)
- `--sw-gray` #EEEEEE (subtle backgrounds, dividers)

Typography: Satoshi (Light/Regular/Medium/Bold) via Fontshare https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap — no substitute fonts.

Design principles: luxury = subtraction; generous white space; restraint over decoration; no clutter.

Prohibited: chatbots, pop-ups, star ratings, discount language, countdown timers, stock images. Clean, calm, precise — luxury configurator, not SaaS dashboard.

Language: never "buy/order" → use "commission"; never qualify or discount price.

## Build phases (current order)

- **Phase 0 — App shell:** branded layout, sign-in screen (visual placeholder), five module pages as clean placeholders, deployed live to Vercel.
- **Auth** — Real Google sign-in via Supabase + invite-only team allow-list.
- **Phase 1 — Emails module** (Gmail, live). The MVP test.
- **Phase 2 — Calendar module** (Google Calendar, live).
- **Phase 3 — Marketing module** (manual-entry cards first; live later).
- **Phase 4 — Sales module** (Apollo + pipeline; live at sales launch).
- **Phase 5 — Orders module** (schema now; connected at launch).
- **Phase 6 — JARVIS** voice & actions.

Build one phase at a time. Don't scaffold future phases beyond clean placeholders.

## Safety rules

Never commit secrets — keys and Supabase/Google credentials go in `.env.local`, which must be in `.gitignore`; never paste secrets into code or chat. Enforce permissions at the database layer (Supabase row-level security) once auth exists. Keep the main branch deployable; test locally before deploying.

## Working agreement

Start each session by reading this file. Keep a short running progress note at the bottom. Default to small, reviewable changes Ali can see in the browser immediately.

## Local development

- `npm run dev` — start the local site at http://localhost:3000 (this is what Ali opens to look).
- `npm run build` — check the whole site compiles (run before deploying).
- `npm run lint` — check code style. (Next.js 16 removed `next lint`; this calls ESLint directly.)

### Project map (Phase 0)

- `src/app/page.tsx` — sign-in / landing page (placeholder Google button → `/dashboard`).
- `src/app/dashboard/layout.tsx` — dashboard shell (sidebar + top bar + mobile nav).
- `src/app/dashboard/page.tsx` — redirects to `/dashboard/emails`.
- `src/app/dashboard/<module>/page.tsx` — the five module pages.
- `src/lib/modules.tsx` — single source of truth for the five modules (name, slug, subtitle, icon).
- `src/components/` — Sidebar, TopBar, MobileNav, ModulePlaceholder.
- `src/app/globals.css` — brand design tokens (colours + Satoshi font).

### Progress log

- **Phase 0 — app shell built locally (awaiting Ali's visual review).** Next.js 16 (App Router) + TypeScript + Tailwind v4 scaffolded. Brand design system in place: Satoshi from Fontshare; brand colours as CSS variables / Tailwind tokens (`sw-white` / `sw-black` / `sw-periwinkle` / `sw-gray`); light mode only. Sign-in/landing page at `/` (placeholder Google button → `/dashboard`). Dashboard shell at `/dashboard` (left sidebar with 5 modules, active item in periwinkle; top bar with wordmark + placeholder avatar). Five module placeholder pages (Emails, Calendar, Marketing, Sales, Orders) — no fake data. Responsive: sidebar collapses to a horizontal nav on mobile. `npm run build` passes; all routes return 200 locally. Next: after Ali confirms the look, push to GitHub + deploy to Vercel.
- **Phase 0 — re-skinned to "light luxury, elevated" (awaiting Ali's visual review).** New design tokens in `globals.css` (page `#F5F6F9`, surfaces white, ink/muted/hint text, periwinkle system incl. deep `#5C66A6` + soft `#EEF1F8`, hairline border, card shadow, radii). Sidebar now has a "Founder view" section (Overview, Emails·Live, Calendar·Live) and a shaded/dashed "Coming soon" section (Marketing, Sales, Orders, Finance — not clickable). `/dashboard` is now the **Overview** page: greeting hero card + **Alfred** orb (pulsing rings + radial core; tap uses browser `speechSynthesis` to say the greeting and shows a waveform while speaking — placeholder voice, real briefing comes after Emails is live), 4 KPI cards (honest `—` + Soon, no fake numbers), live Email triage + Today panels with "Connect Gmail/Calendar" ready states, and a "Modules connecting soon" row. Module pages restyled to match (live = ModuleHeader + ConnectState; coming-soon = SoonState). The assistant is named **Alfred** everywhere (not JARVIS). New components: `AlfredOrb`, `Pill` (LivePill/SoonPill/ServiceBadge), `ModuleHeader`, `ConnectState`, `SoonState`. All empty states are honest — no fabricated data.
