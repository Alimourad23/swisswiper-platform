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
- **Code pushed to GitHub** at `https://github.com/Alimourad23/swisswiper-platform` (branch `main`). Vercel deploy intentionally NOT done yet (pending Ali's local sign-in test).
- **Auth — real Google sign-in via Supabase wired locally (awaiting Ali's test; NOT deployed).** Packages: `@supabase/supabase-js`, `@supabase/ssr`. Keys in `.env.local` (git-ignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Clients: `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server, async cookies per Next 16). Route protection uses **`src/proxy.ts`** (Next 16 renamed middleware→proxy) calling `updateSession` in `src/lib/supabase/middleware.ts` — refreshes session + redirects signed-out users away from `/dashboard`. OAuth flow: `GoogleSignInButton` → `signInWithOAuth({provider:'google', redirectTo:/auth/callback})` → `src/app/auth/callback/route.ts` exchanges code → `/dashboard`. TopBar is now an async server component reading the user; `UserMenu` shows real Google name + photo (with initials fallback) and a working **Sign out** button. Overview greeting + Alfred's spoken line use the real first name. Visual design unchanged. NOTE: invite-only team allow-list is still a TODO (any Google account can currently sign in). Supabase Auth must allow-list `http://localhost:3000/**` redirect for local testing.
- **Git author fix (deploy blocker resolved).** Vercel blocked the deploy because commits were authored with a personal Gmail not verified on the GitHub/Vercel account. Set this project's git identity to `Ali Mourad <ali@swisswiper.com>`, re-authored both existing commits with `git filter-branch`, and force-pushed `main`. All commits are now attributed to `ali@swisswiper.com`. Going forward, commits in this repo use that identity automatically.
- **Phase 1 — live Emails module (Gmail read-only) built locally (awaiting Ali's test; NOT deployed).** OAuth now requests `gmail.readonly` + `calendar.readonly` with `access_type=offline` + `prompt=consent` (see `GoogleAuthButton`, replaces old `GoogleSignInButton`). Google **refresh token** captured at `/auth/callback` and stored in Supabase table `public.google_tokens` (RLS: user owns their row) — never exposed to the browser. `src/lib/google/tokens.ts` `getGoogleAccessToken()` reads the refresh token + exchanges it with Google for a fresh access token (needs server-only `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env.local`), with in-memory caching. `src/lib/google/gmail.ts` does READ-ONLY Gmail GETs: `getInboxSummary` (unread / received-this-week / need-attention) and `getTriagedThreads` (sender/subject/date + Priority vs Safe-to-delete tag from Gmail categories + IMPORTANT + no-reply sender signals; "safe to delete" is suggestion-only, nothing is ever modified). `/dashboard/emails` shows counts + triaged list (or a working "Connect Gmail access" state if not yet granted). Overview shows real unread/this-week/attention counts + Unread KPI when connected, else the connect state. REQUIRES (manual, one-time): (1) run the `google_tokens` table SQL in Supabase; (2) paste Google client ID/secret into `.env.local`; (3) sign out & back in to grant the new scopes.
- **Phase 1 counting fix.** Replaced inaccurate Gmail `resultSizeEstimate` (it returned a bogus 201 for both "this week" and "need attention") with real paginated counts (`countMessages`). "Received this week" = actual messages matching `in:inbox newer_than:7d`. "Need attention" = `in:inbox is:unread category:primary` minus no-reply/notification/newsletter senders (small, single-digit). Triage tags now use the same rule: Priority = unread + Primary + real person; Safe = promotions/social/automated; else untagged. Also fixed `gget` to tolerate Gmail's empty response body on zero-result `fields=` queries (was throwing "Unexpected end of JSON input"). Verified against the real inbox: unread=5, week=12, needAttention=0.
- **Emails module polished to match Calendar (local only).** Times now formatted on the CLIENT in the viewer's device timezone with relative labels ("2h ago", "Yesterday") via `EmailsBoard` (client); server `getInboxView` returns raw threads + counts only. Each thread carries Gmail `snippet` (one-line preview), `threadId`, `gmailUrl` (`mail.google.com/.../#inbox/<threadId>` — "Open in Gmail"), and `awaitingReply` (unread + Primary + real person + addressed to me via To header vs Gmail profile email — best-effort). UI: one-line "Inbox load" summary (unread · need attention · safe to delete · received this week), a "Needs your reply" highlight list at top (the awaitingReply set, labelled best-effort), and the triaged list with snippet + relative time + Open-in-Gmail + badge (Awaiting reply / Priority / Safe to delete). Strictly read-only. Key files: `src/lib/google/gmail.ts`, `src/components/email/EmailsBoard.tsx`. Verified: unread=5, needAttention=1, awaitingReply=1, safeToDelete=5, week=12.
- **Phase 1 consistency fix.** "Need attention" and the "Priority" tag previously used two different mechanisms (a `category:primary` search query vs. label logic) and could disagree (a Priority-tagged email counted 0). Unified into a single `classify()` function in `gmail.ts`: an email is "priority"/"needs attention" iff unread + Primary (CATEGORY_PERSONAL or no non-primary category) + real person (not promotions/social/automated sender). New `getInboxView(token)` fetches ONE window of recent inbox messages (18), classifies each once, builds the triaged list, and sets `needAttention = count of priority items in that same set` — so count and tags can never disagree (no window mismatch). Both `/dashboard/emails` and Overview use `getInboxView`. Verified: needAttention=1, priorityInList=1, match=true.
- **Phase 2 — live Calendar module (Google Calendar read-only) built locally (awaiting Ali's test; NOT deployed).** Reuses the existing token/refresh setup (`calendar.readonly` already granted). `src/lib/google/calendar.ts` `getCalendarView(token)`: READ-ONLY events.list on `primary` calendar (`singleEvents=true`, `orderBy=startTime`), detects the calendar's own timezone (`/calendars/primary` → `timeZone`), groups events by local date for today + next 6 days (7-day window), excludes cancelled/declined. Returns `{timeZone, meetingsToday, meetingsWeek, todayEvents, days}`. Overview: "Today" panel shows today's real agenda (start time + title) or "Nothing scheduled today"; "Meetings today" KPI shows real count (Soon tag removed when connected). `/dashboard/calendar`: summary (meetings today / this week) + Next-7-days grouped by day. Verified against real calendar: tz=Africa/Cairo, meetingsToday=3, meetingsWeek=24.
- **Phase 2 — Calendar built out to a full polished view (local only).** Timezone now follows the VIEWER's device: server (`getCalendarData`) returns raw events + tz-independent facts only; all "today"/"this week"/time formatting happens client-side using native `Date` (device tz), with a "Times shown in {tz}" label. Meeting vs reminder: `isMeeting` = has another attendee OR a video link; solo events are reminders (shown with a "Reminder" tag, excluded from meeting counts). Each meeting shows a one-line purpose (description, else attendees/location). Features in `CalendarBoard` (client): "Up next" with live countdown + Join button (Meet/Zoom/Teams via hangoutLink/conferenceData/url scan), red "Overlaps" badge on clashing meetings (overlap computed server-side on instants), today's load (meetings · hours booked · longest free block in 8:00–20:00), pending-invites nudge (display-only, never accepts/declines), Tomorrow glance, and Next-7-days grouped. Overview uses client islands `OverviewToday` + `MeetingsTodayKpi`. Key files: `src/lib/google/calendar.ts` (server fetch), `src/lib/calendar-view.ts` (pure client helpers), `src/components/calendar/*`. Strictly read-only. Verified: tz=Africa/Cairo, meetingsToday=0, remindersToday=3, meetingsThisWeek=1, conflicts=0, pendingInvites=0 (today's events are solo reminders, not meetings).
