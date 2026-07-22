# SwissWiper Platform — Full Session Handoff & Continuation Brief

_Paste this into a new conversation to resume with full context. Last updated: this session._

---

## 0. How to work with me on this project (read first)

- **Ali is a non-technical founder** — explain in plain English, give copy-paste steps one at a time, never assume git/npm/hosting knowledge, confirm before anything destructive, prefer the simplest solution.
- **Build workflow:** I (the assistant) write code directly to the repo at `C:\Users\alitm\Documents\swisswiper-platform`. Ali then runs **`build and push to main`** in a separate Claude Code terminal, which builds and deploys to **Vercel** (auto-deploy from GitHub `main`). SQL is run **manually by Ali in the Supabase SQL Editor**. I don't run the build; Ali does.
- **Bash sandbox can show stale file state** vs the real disk — the Read tool is authoritative. Local `tsc` errors from the sandbox are often phantom; Ali's `build and push` is the real check.
- **Reference docs already in the repo:** `CLAUDE.md` (project rules + progress log), `ASSESSMENT.md` (critical audit), `MARKETING-TODO.md` (parked marketing work), `PARTNER-PORTAL-ROADMAP.md` (the B2B2C partner portal + pricing engine plan).

## 1. What the platform is

An internal web app — "the heart of SwissWiper performance" — the team logs into to run the business. SwissWiper is a **luxury hard-water glass-care brand** (a precision wiper + care system that keeps shower screens/balustrades/facades flawless). Assistant persona in the app is **Alfred** (a calm, dry-witted British butler), with a premium ElevenLabs voice ("Julian").

**Tech stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4; Supabase (Postgres + RLS + Google auth); hosting on Vercel; integrations: Google (Gmail, Calendar), Anthropic (Alfred + content), ElevenLabs (voice), Google Gemini (Nano Banana images + Veo video), Resend (email), LinkedIn (weekly Excel export).

**Brand (non-negotiable, luxury):** White 60 / Black 30 / Periwinkle 10. Satoshi font (Fontshare). Luxury = subtraction, generous whitespace, restraint. Never "buy/order" → use "commission"; never discount language client-facing. Prohibited: chatbots, pop-ups, star ratings, countdown timers, stock images.

**Modular architecture rule (non-negotiable):** every module is a self-contained vertical slice (its route `src/app/dashboard/<module>/`, logic `src/lib/<module>/`, components `src/components/<module>/`). Modules NEVER import each other; shared things go through the common foundation. Registered in one place: `src/lib/modules.tsx`. Each module owns its tables + RLS.

## 2. Modules built (live)

- **Overview** (`/dashboard/overview`) — greeting hero + Alfred orb, KPI cards, email triage + today panels, honest empty states.
- **Emails** (Gmail, read-only) — `getInboxView()`: unread / this-week / need-attention counts, triaged list, "needs your reply" (awaiting-reply, best-effort), snippet + relative time + Open-in-Gmail. Strictly read-only.
- **Calendar** (Google Calendar, read-only) — `getCalendarData()`: today's agenda, meeting load, up-next countdown + Join, overlaps, hours booked, longest free block, pending invites (display-only), next 7 days. Viewer-timezone aware.
- **Tasks** — shared team to-do: list/board, drag between statuses, filters, @mentions, realtime, notification bell, due-date reminders cron (daily), founders-only task visibility, priorities, assignees. (Trash/restore exists in code but see Assessment bug re: `deleted_at`.)
- **Marketing** — the deepest module; see §3.
- **Alfred / Bridge** — voice assistant everywhere: push-to-talk + wake word + hotkey, ElevenLabs voice, whitelisted tool-use (navigate / create_task / set_status / draft & send email / calendar events) with **propose → review → confirm → execute** (nothing mutates without explicit confirmation). Reads a live read-only summary of tasks/calendar/inbox/LinkedIn each turn.
- **Auth** — real Google sign-in via Supabase; refresh token captured for Gmail/Calendar; `Reconnect Google` in the user menu. NOTE: no invite allow-list yet (parked — see §6).

## 3. Marketing module — full inventory (this is the deep one)

- **Marketing plan** (`/marketing/plan`) — north-star doc (goals, audience, positioning, pillars, cadence, budget), singleton table.
- **Pipeline** (`/marketing/pipeline`) — the working list: quick-add, filters, backlog/scheduled/ready-to-post, per-post summary (read-only preview + first media thumbnail + "Open in Studio"). Drafting happens only in the Studio.
- **Calendar** (`/marketing/calendar`) — month grid, colour-coded by channel, drag to reschedule, click → Studio. (Pipeline & Calendar are now separate sidebar pages; order: Plan · Pipeline · Calendar · LinkedIn.)
- **Monthly planner** (on Pipeline, two tabs):
  - **Plan with Alfred** — gap-aware engine: knows recommended monthly volume per channel, subtracts what's planned, proposes only enough to fill the gap on **open best-practice days**, from **today forward** (mid-month aware), across a **6-month horizon**, de-duped against recent/existing posts. Per-suggestion checkbox + editable date + goal tag; "Add selected"; "Suggest more"; per-channel counter (e.g. LinkedIn 4/12).
  - **Plan myself** — type titles + channel → auto-schedules across the month on best-practice cadence → review dates → add to pipeline.
- **Content Studio** (full-screen) — co-writing with Alfred (chat that rewrites the post body live, channel-aware, honest feedback; Alfred also writes image/video prompts with a "Use as image prompt →" button). Auto-drafts copy from an Alfred seed idea. Media panel with **Upload** vs **Create** direction choice.
  - **Nano Banana images** — text-to-image AND image-to-image (edit an existing image); controls: model (Pro / Nano Banana 2), aspect ratio, quality (1K/2K/4K), count (1–4); character/token guide; friendly error surfacing.
  - **Veo video** — founder-gated; async job + polling; controls: model (Veo 3.1 / Fast), aspect, resolution (720p/1080p/4K), length (4/6/8s); lands the clip in the gallery.
- **AI spend cap + usage counter** — every image/video logs estimated cost; generation blocked if it would exceed the monthly cap; founder-editable cap; card on the Marketing main tab.
- **Google Calendar sync** — scheduling a post creates 4 "free/transparent" guide events (plan, draft, draft-ready, publish-day) on the user's calendar; reschedule moves them; delete cleans up.
- **Monthly planning reminder** — cron (25th) checks if next month is thin; if so, Alfred drafts a plan and emails marketing@ + founders with a link.
- **LinkedIn analytics** (`/marketing/linkedin`) — from weekly Excel export: followers, impressions, engagement, visitors, decision-maker share, content-type performance, awareness→inquiry funnel, 7/30/365-day windows, weekly executive summary on the main tab.
- **Executive summary** — the Marketing main tab opens with a week-at-a-glance (content activity + performance + what's coming).

## 4. Setup / pending items (IMPORTANT — verify these are done)

Several builds shipped needing manual SQL / env / billing. **On a fresh check, confirm each ran:**

- **SQL migrations to run in Supabase** (some may already be done):
  - `content-posts.sql`, `marketing-plan.sql`, `content-calendar-sync.sql`, `content-media.sql`
  - `marketing-monthly-plan.sql`, `marketing-planner-upgrade.sql` (seed_idea/goal/source cols)
  - `ai-usage.sql`, `video-jobs.sql`
  - **MISSING from repo (Assessment found):** `tasks.deleted_at` column; and `linkedin_metrics`, `notable_engagers`, `marketing_inputs` tables were never committed to `supabase/`. These break on a fresh DB. **Create + run these.**
- **Env vars (Vercel + `.env.local`):** `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, Google client id/secret, Supabase URL/anon key. `NEXT_PUBLIC_APP_URL` for email links.
- **Gemini billing** must be enabled for images/video to actually generate (Veo is paid). Until then generation returns a clear billing message.
- **Founder role:** `update profiles set role='founder' where email='ali@swisswiper.com';` (needed to see Veo video + edit the AI cap).
- **Google account for AI:** the Gemini API key was created under `marketing@swisswiper.com`.
- **Email identity:** `marketing@swisswiper.com` created as a real Workspace user with mail-delegation to ali@/max@/aleksandra@ (shared social/ops inbox).

## 5. Critical assessment (from `ASSESSMENT.md`) — top items

- **[HIGH] Missing migrations** — `tasks.deleted_at`, `linkedin_metrics`, `notable_engagers`, `marketing_inputs`. Break on fresh DB / on save. **Fix first (fast win).**
- **[HIGH] No invite allow-list** — any Google account can sign in and read everything. **PARKED by Ali** (tied to the partner-portal/tenancy direction — see §6). Interim option if wanted: restrict sign-in to `@swisswiper.com`.
- **[HIGH] Prompt-injection surface** — email subjects/event titles injected unescaped into Alfred's prompt; mitigated by the confirmation gate. Escape/JSON-wrap before injecting.
- **[MED] Alfred inbox count vs list mismatch; video-job poll has no atomic guard; no rate limiting on AI routes.**
- **[LOW] Spend-cap race; calendar-sync orphan on partial failure; silent parse fallbacks.**
- **UX:** module registry "live vs soon" contradiction in `modules.tsx`; dead `sw-*` Tailwind classes (undefined in `@theme`); onboarding flow; surface AI spend in the Studio; mobile checks; branded error toasts. (Top-10 list in ASSESSMENT.md.)
- **Architecture:** `lib/marketing/calendar-sync.ts` imports `@/lib/google/tokens` (Marketing→Google cross-module breach) — promote Google tokens to the shared foundation. Duplicated `isActive(task)` filter (~8 places).

## 6. Parked work / big directions

- **B2B2C Partner Portal (Orders)** — `PARTNER-PORTAL-ROADMAP.md`. Invite-only partners (interior designers, redistributors) log in, submit **made-to-measure** requests (shower type, measurements, finish), track order → production → delivery. Internal side = demand pipeline (what to produce, where to deliver). Needs **multi-tenancy** (organizations + RLS) — a bigger architectural leap; security review before any partner logs in. Partner auth = magic-link. This is why the auth allow-list (#2) is parked — the tenancy direction must be settled first. Includes a **requirements checklist for Etienne** (product taxonomy, cost drivers, lead times, production stages, delivery) in §9 of that doc.
- **Pricing engine (the keystone — build FIRST for the portal)** — `PARTNER-PORTAL-ROADMAP.md` §12. Engine-as-a-service: one brain (in the platform, editable/versioned config) consumed by an internal **quote calculator**, the partner portal (net price = list − discount), and the **public website** via a list-price API (a configurator that turns the brochure site into a lead funnel). v1 parametric model: `price = base + glassArea × glassRate + finish + Σ hardware`, floored + rounded, discount layer on top. A first `src/lib/pricing/engine.ts` sketch exists (pure, unused, safe to rewrite). Waiting on Etienne's real cost drivers.
- **Marketing to-dos** — `MARKETING-TODO.md`. Biggest: **publishing** (auto-post via an aggregator like Ayrshare), then analytics for IG/TikTok/YouTube/Website, then the **analytics feedback loop** (Alfred learns from performance), approvals/collaboration, campaign grouping/repurposing, and the LinkedIn auto-pull.

## 7. Today's workflow (this session) + status

Ali's 5-item plan for the day:
1. **Finish the marketing module + completion check** — pending (assessment surfaced the gaps: missing LinkedIn/marketing SQL, calendar-sync orphan handling, spend/video race, registry contradiction).
2. **Add phases/timelines to the Tasks module** — pending. Requirement: phases that group tasks with a timeline + owner + review/sign-off (e.g. "Product conception — 1 month, Etienne", with a final check/review). Etienne is currently in a product-conception phase.
3. **Build the admin panel (roles & rights)** — pending. Manage members, assign roles/rights, gate features. (Ties into the parked allow-list/tenancy direction — decide the roles model.)
4. **Critical assessment of all functionalities + UX enhancement** — assessment DONE (`ASSESSMENT.md`); the UX enhancement pass is pending.
5. **Revisit the to-dos** — pending.

Progress this session: ran the full critical audit → `ASSESSMENT.md`. Parked #2 (allow-list). Nothing else built yet today.

## 8. Recommended next steps (my suggestion)

1. **Fast wins / finish marketing:** create + run the missing migrations (`tasks.deleted_at`; `linkedin_metrics`, `notable_engagers`, `marketing_inputs` + RLS); fix the `modules.tsx` live/soon contradiction; remove dead `sw-*` classes; harden calendar-sync (all-or-nothing) + video-job poll (compare-and-set). All small, all high-value.
2. **Task phases** — a `phases` concept (name, owner, start/end, status, review) that groups tasks; a phase board + a review/sign-off step. Clean, self-contained build.
3. **Admin panel** — decide the roles model first (founder / member / …; later partner). Member list + role assignment + feature gating. Consider the interim `@swisswiper.com` sign-in restriction here without committing to full tenancy.
4. **UX pass** — the ASSESSMENT top-10.
5. Then the parked directions: **pricing engine** (once Etienne's numbers arrive) → partner portal; and marketing **publishing**.

## 9. Open decisions waiting on Ali / Etienne

- Roles/rights model for the admin panel (and whether to add the interim domain sign-in restriction now).
- Task-phases: exact fields + whether a phase needs an approver/sign-off.
- Etienne's vendor/production requirements (product taxonomy, cost drivers, lead times, stages, delivery) — feeds the pricing engine + partner portal.
- Partner portal: MAP / whether website price is mandated resale or just cost reference; performance metrics that drive the discount tier.
- Marketing publishing: which social aggregator (Ayrshare recommended).

## 10. Doc index (all in the repo root)
- `CLAUDE.md` — project rules + detailed progress log (the running build history).
- `ASSESSMENT.md` — the critical audit (this session).
- `MARKETING-TODO.md` — parked marketing to-dos.
- `PARTNER-PORTAL-ROADMAP.md` — B2B2C partner portal + pricing-engine-as-a-service blueprint.
- `HANDOFF.md` — this file.

---

## 11. Session update — 21 July 2026: Instagram integration (Phase 1 + 1.5)

**Decisions made (Ali-confirmed):**
- **Direct Meta API** (free), not Ayrshare. Instagram API with Instagram Login (host `graph.instagram.com`), single-business app, Standard Access — no App Review needed.
- **Engagement automation end-state: "graduation path"** — Alfred drafts every comment/DM reply in founder voice (Ali/CEO; Etienne/CPO for product questions), a human approves everything substantive; replies get categories with per-category automation switches that can be flipped later based on real data. Full-auto founder impersonation was challenged (brand's no-chatbot rule + EU AI Act transparency + no volume yet) and rejected in favour of this.
- Engagement inbox (Phase 3) must be **channel-agnostic** (`channel` field: instagram_dm/instagram_comment/later whatsapp) so WhatsApp plugs into the same inbox later.

**Meta/cloud setup (all done, all cloud-side):**
- Meta app **SwissWiper Platform** (Ali's personal FB is the invisible admin key; business portfolio "SwissWiper Platform" exists, unverified is fine). Instagram app **SwissWiper Platform-IG**, app ID `2491811331339632`. The @swisswiper IG account (Business, public) is attached as Instagram Tester with a generated long-lived token.
- Vercel env vars set: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_ACCESS_TOKEN`. **Token expires ~60 days** — on auth errors: Meta dashboard → API setup with Instagram login → Generate token → update the Vercel var. (Proper OAuth "Reconnect Instagram" is future work.)
- Supabase migration `supabase/instagram-publishing.sql` RUN (publish columns on content_posts).

**Code shipped (see CLAUDE.md progress log for detail):**
- `src/lib/instagram/client.ts` (shared foundation, env-token, 2-step publish, permalink).
- `src/lib/marketing/publish.ts` + `/api/marketing/publish` (CRON_SECRET-protected, atomic claim, opt-in only, [today−2d, today] window; image→feed post, video→Reel best-effort).
- Studio: per-post "Auto-publish to Instagram" switch (off by default) + published-link / failed-error states.
- Alfred voice: `create_post` tool + PostReview panel — "Alfred, plan an Instagram post about X for Friday" → review → confirm → pipeline (seed_idea auto-drafts the caption in the Studio).

**End-of-session status (21 July, evening): ALL PHASES BUILT + DEPLOYED (except the last push).**
Shipped and live: publishing engine (feed post / carousel / Story / Reel, format-aware, Publish-now button with confirm, per-post publish times), Alfred voice `create_post`, live analytics page (`/marketing/instagram`: followers, per-post likes/comments/reach/saves, views/profile-visits/accounts-engaged 28d, demographics-at-100-followers, daily snapshots), feedback loop (performance brief injected into the monthly planner), publish-run summary emails to marketing@, Reconnect Instagram OAuth routes + self-refreshing DB token (needs the Meta redirect step below). Built and committed, awaiting Ali's LAST PUSH: the **engagement inbox** (`/marketing/engagement` — comments + DMs live-fetched, Alfred drafts in founder voices ali/etienne with category labels, human approves every send; DM read/send best-effort on this connection type).

**Remaining (all logged in MARKETING-TODO.md):**
1. Ali: `build and push to main` (ships the engagement inbox) — may have happened right after this handoff was written.
2. External errands (~30 min): register OAuth redirect `https://swisswiper-platform.vercel.app/api/instagram/callback` in Meta dashboard (activates Reconnect/auto-refresh); CRON_SECRET reset + cron-job.org daily 11:30 job (activates scheduled auto-publish; Publish-now works without it); Gemini billing (Nano Banana/Veo).
3. Tests: first Publish-now to @swisswiper; comment → Alfred draft → send loop; voice create_post.
4. v2 builds: webhooks + auto-acknowledgment + per-category automation switches; Stories/carousels polish; TikTok/YouTube; LinkedIn auto-pull; team approvals.
5. Non-marketing backlog unchanged: task phases, admin panel, UX top-10, pricing engine → partner portal.

---

## (Superseded during the session — kept for context)

**Remaining to fully complete Phase 1 (in order):**
1. Vercel is on **Hobby** (2-cron limit), so the publish trigger is external: **cron-job.org** account → daily 11:30 Europe/Berlin → GET `https://swisswiper-platform.vercel.app/api/marketing/publish` with header `Authorization: Bearer <CRON_SECRET from Vercel>`. ← was in progress at session end (CRON_SECRET only exists in Vercel; reveal via Edit, or set a fresh value + redeploy).
2. End-to-end test post (caption + image + today's date + arm the switch → run the job).
3. Check **Gemini billing** so Nano Banana/Veo actually generate media.

**Next phases (agreed direction):** Phase 2 = IG analytics dashboard (note: may need the "Facebook login" API variant for insights — verify; the marketing channel card still says "Soon" until this). Phase 3 = comments+DM approval inbox (webhooks step 3 in the Meta dashboard happens here; app must be published state for webhooks), founder voice profiles, auto-acknowledgment + routing only. Later: WhatsApp as second channel; Ayrshare only if TikTok/YouTube publishing is wanted cheaply.

**Agenda agreed for the NEXT session (22 July):**
1. Complete the marketing module — external errands (Meta redirect URI, cron-job.org scheduler + CRON_SECRET reset, Gemini billing), the three live tests (Publish-now, comment→Alfred→reply loop, voice create_post), and any v2 items Ali picks.
2. Full review of ALL pending to-dos (marketing + platform backlog: task phases, admin panel, UX, pricing engine/partner portal).
3. **Drastic visual improvement pass** — Ali wants the platform's look elevated significantly. Ground it in the brand rules (CLAUDE.md: white/black/periwinkle 60-30-10, Satoshi, luxury = subtraction) + the ASSESSMENT.md UX top-10 (incl. dead `sw-*` classes, module registry contradiction). Ask Ali for concrete references/dislikes before redesigning.

**Design brief for the visual overhaul (from Ali's AI mockups, 21 July evening — "BrandFlow" reference images):**
- KEEP the mockup's information architecture: overview-first (AI insights strip → KPI cards with sparklines → performance-over-time chart → channel table → top content → plan progress ring → upcoming activities), then channel deep-dives.
- REJECT its visual language (gradients, badge clutter, SaaS density) — translate into brand: white/black/periwinkle 60-30-10, Satoshi, hairlines, generous whitespace, single accent color in charts.
- ADD what the mockup misses analytically: engagement/conversation metrics (reply rate, response time — from the new inbox), content-format breakdown panel (Reel/carousel/image/Story), saves+shares on IG KPIs, publishing-ops health (scheduled/published/failed, cadence adherence), funnel ending at INQUIRIES not fake revenue, decision-maker share (keep), 7/30/365 toggle (keep).
- Honesty rule: no fabricated numbers; panels appear as data earns them (24 followers today — charts must degrade gracefully). Omit (don't fake): traffic sources, campaign spend/ROI, email channel, cross-channel totals — backlog items.
- Data ready to feed charts: ig_daily_snapshots (growth), LinkedIn daily series, per-post insights, format perf, plan-gap engine, pipeline upcoming, Alfred insight generation.
- **AMENDMENT (later that evening):** Ali wants the mockup's visuals essentially AS-IS ("perfect UI"). Agreed position: build ~the mockup faithfully (layout, density, sparklines, colored multi-series charts, channel colors, insight strip) with 4 adjustments — primary = peri-deep #5C66A6 (≈ the mockup's indigo anyway), Satoshi not Inter, color in data / calm chrome (drop gradient-tinted card backgrounds), honest numbers at real scale. Internal-tool argument accepted: customer-facing brand prohibitions don't govern the internal dashboard. Process: HTML mockup of the marketing overview first for side-by-side approval, THEN restyle live pages. Read the dataviz skill before writing chart code.
- **APPROVED (21 July, late evening): `design/marketing-ui-direction.html` v2 is the visual constitution** (also a persisted desktop artifact "swisswiper-marketing-ui-direction"). Ali blessed the direction; build the real app to this spec.

**Implementation order for the visual overhaul (22 July):**
1. **Foundation tokens + shared viz components** — extend `globals.css` with the v2 tokens (accent chip pairs a-blue/a-pink/a-teal/a-amber/a-peri + bgs, series colors s-linkedin #0A66C2 / s-instagram #C2367B — this exact pair passed the dataviz validator all-pairs on white; ordinal funnel ramp #9aa6d0→#333c6e). New shared components (foundation, reusable by all modules): Chip, Kpi-with-sparkline, Panel(+ViewAll), Ring, Sparkline/LineChart SVG helpers (port from the mockup's inline JS to React), FlowStrip. Read the dataviz skill before chart code.
2. **Marketing overview page rebuilt to v2 wired to REAL data**: insights strip (from performance-brief + deterministic facts), KPI row w/ sparklines (LinkedIn daily series + ig_daily_snapshots), funnel (LinkedIn compute + inquiries), 2-series time chart (LinkedIn daily + IG snapshots), channel table, top content (LinkedIn top posts + IG media), format performance, Conversations stats (engagement-data), publishing health (content_posts counts), plan progress (cadence gap), upcoming activity (pipeline), "Alfred's next move" card (links planner), flow strip. Honest empty/building states everywhere; no fabricated series.
3. **Channel pages** (Instagram, LinkedIn) + Engagement restyled to the same system.
4. **Roll the frame** across Overview/Tasks/Emails/Calendar (phased; Overview first).
Also queued tomorrow: marketing externals (Meta redirect URI, scheduler, Gemini billing) + the three live tests + full to-do review.
