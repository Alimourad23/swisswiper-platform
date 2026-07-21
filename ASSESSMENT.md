# SwissWiper Platform — Critical Assessment

_Read-only audit of the whole platform. Snapshot for the improvement pass._

## Executive summary

More is built than the registry admits: Emails, Calendar, Tasks, a deep Marketing
module, and a full Alfred assistant with confirmation-gated actions. Core flows are
coherent and Alfred's safety model is solid. But there are three "breaks on a fresh
database" gaps (missing SQL migrations the code hard-depends on), two structural
security gaps (no invite allow-list → any Google account can sign in; prompt-injection
exposure from unescaped email/calendar text into Alfred), and some registry/design-token
drift. None are hard to fix; the danger is they're silent until a clean environment or a
hostile email surfaces them.

## Completeness & bugs
- **[HIGH] `tasks.deleted_at` exists in no migration.** Trash/restore + reminders cron
  depend on it (`tasks/actions.ts`, `tasks/data.ts`, `TasksBoard.tsx`, `api/tasks/reminders`).
  On a fresh DB these error. `tasks-schema.sql` only has `completed_at`.
- **[HIGH] `linkedin_metrics`, `notable_engagers`, `marketing_inputs` have no migration.**
  Read/written in `lib/linkedin/data.ts`, `marketing/linkedin/page.tsx`, `NotableEngagers`,
  `LinkedInClient`. Reads degrade to seed/empty; saves fail.
- **[MED] Alfred inbox count vs listed threads can disagree** (`api/alfred/chat` slices 12
  while counts run over the full list).
- **[MED] Video-job status poll has no atomic guard** — concurrent polls can both process a
  finished job (wasted download/upload).
- **[LOW] Spend-cap race** (parallel calls can jointly exceed the cap; bounded by per-call est).
- **[LOW] Calendar-sync orphans** — deletes then recreates 4 events; mid-loop failure leaves
  partial `gcal_event_ids` + orphaned Google events, no rollback.
- **[LOW] Silent parse fallbacks** hide failures (monthly-generate returns [] with no log).
- Both cron endpoints ARE correctly protected (fail closed if `CRON_SECRET` unset) — not a hole.

## Security & RLS
RLS is good where tables exist (profiles, tasks, notifications, content_*, ai_*, marketing_*).
Gaps:
- **[HIGH] No invite/allow-list — auth is open.** `proxy`/`middleware` only check "signed in";
  `auth/callback` upserts any Google identity. **Any Google account can sign in and read
  everything.** Biggest hole.
- **[HIGH] Prompt-injection surface** — email subjects/senders + event titles concatenated
  unescaped into Alfred's system prompt. Mitigated by the confirmation gate (worst case:
  misleading text, not silent execution). Escape/JSON-wrap before injecting.
- **[MED] No rate limiting** on Alfred + media-gen routes (auth'd but unbounded → API spend).
- **[GOOD]** Secrets stay server-side; service-role client is `server-only`; tokens never
  reach the client.
- **Multi-tenant/partner: not ready.** No `org_id` anywhere; every marketing/content table is
  "any authenticated user reads/writes everything." Tenancy must be designed before onboarding
  any external/partner user.

## UX findings — Top 10
1. **Fix the "live vs soon" contradiction** in `modules.tsx` (Marketing `status:"soon"` but
   `founderNav` `live:true`). One source of truth.
2. Real connect/onboarding flow (sign in → scopes → reconnect), currently buried in UserMenu.
3. Surface AI spend + cap in the Studio (where generation happens), not just AiUsageCard.
4. Make Alfred's inbox summary honest about sampling ("of your recent inbox").
5. Trash/restore is a dead-end until the missing column exists.
6. Verify skeletons (not blanks) on cold load of Marketing/LinkedIn.
7. Mobile: check Alfred overlay/starfield + MonthGrid/pipeline at ~380px.
8. Consistent module headers/breadcrumbs across Marketing sub-pages.
9. Branded error toasts instead of raw "run the SQL" strings.
10. Calendar-sync transparency: show what 4 events were created + one-click remove.

Brand adherence is strong (tokens, Satoshi, no buy/discount language, no prohibited elements).

## Architecture & code quality
- **Module isolation breach:** `lib/marketing/calendar-sync.ts` imports `@/lib/google/tokens`
  (Marketing → Google). Promote Google token access into the shared foundation.
- **[MED] Dead design tokens:** `layout.tsx` + `dashboard/layout.tsx` use `bg-sw-white`,
  `text-sw-black`, `text-sw-periwinkle`, `bg-sw-gray` — not defined in the `@theme` block
  (Tailwind v4 no-ops). Alias in `@theme` or replace.
- Data-behind-a-function rule: well followed. Type safety: solid.
- Duplication: `!deleted_at && status!=='done'` re-implemented ~8 places → shared `isActive()`.

## Prioritized action list
1. Commit the missing migrations (`tasks.deleted_at`; `linkedin_metrics`, `notable_engagers`,
   `marketing_inputs` + RLS). Highest impact, smallest effort.
2. Ship the invite/allow-list (gate `auth/callback` + middleware). World-readable until then.
3. Escape user text before it enters Alfred's prompt.
4. Fix the module registry contradiction (live vs soon).
5. Compare-and-set on video-job status; all-or-nothing calendar-sync.
6. Remove dead `sw-*` Tailwind classes (or define them).
7. Rate-limit Alfred + media-gen routes.
8. Reconcile inbox count/list mismatch.
9. Move Google token access into the shared foundation.
10. Plan tenancy (`org_id` + RLS) before any external user; add shared `isActive(task)`.

**Fastest wins:** #1 (paste SQL), #4 (one enum flip), #6 (delete dead classes), #8 (slice fix).
