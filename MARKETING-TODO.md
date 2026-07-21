# Marketing module — to-dos

_Running log. Updated 21 July 2026 (Instagram integration session)._

## Deferred setup (quick, do when ready — publishing won't auto-fire until #1)
1. **Auto-publish scheduler.** Vercel Hobby allows only 2 crons, so `/api/marketing/publish` is triggered externally: reset `CRON_SECRET` in Vercel (it's Sensitive/unreadable — set a fresh 30+ char value, leave Sensitive off, Save, then Redeploy), then cron-job.org free account → daily 11:30 Europe/Berlin → GET `https://swisswiper-platform.vercel.app/api/marketing/publish` with header `Authorization: Bearer <CRON_SECRET>`. Test run should return `{"ok":true,...}`.
2. **First live auto-publish test.** Instagram post in the Studio: caption + image + today's date + arm "Auto-publish", then Execute-now on cron-job.org → post shows "Published ↗".
3. **Gemini billing** — enable so Nano Banana images + Veo video actually generate.
4. **Instagram token renewal (recurring ~60 days).** On auth errors: Meta dashboard → Generate token → update `INSTAGRAM_ACCESS_TOKEN` in Vercel → redeploy. Build a proper "Reconnect Instagram" OAuth flow eventually.

## Priority order (build work)
1. **Instagram Phase 3 — engagement inbox.** Comments + DMs land in the platform; Alfred drafts in founder voice profiles (Ali/CEO, Etienne/CPO for product); route → review → approve → send; per-category automation switches (graduation path — approval-first, flip low-risk categories later); auto-acknowledgment + routing only at launch. Channel-agnostic conversations (`instagram_dm` / `instagram_comment` / later `whatsapp`). Needs Meta webhooks (dashboard step 3; app must be in published state) → webhook endpoint + verify token.
2. **Instagram insights upgrade.** Current analytics are live-API (followers, per-post likes/comments, daily snapshots from page views). Reach/impressions/demographics may need the "API setup with Facebook login" variant — verify, then add.
3. **Analytics feedback loop.** Alfred learns from what performed (themes/formats/goals) and weights next month's suggestions. Now feasible with LinkedIn + Instagram data.
4. **Auto-publish upgrades.** Stories, carousels, per-post publish times; publish-result notifications (email founders on success/failure).
5. **Other channels.** TikTok / YouTube / Website analytics + publishing (Ayrshare only if wanted cheaply for publishing).
6. **Collaboration / approvals** on content (who drafted, who approved) — useful once Max & Aleksandra are active.
7. **Polish.** Campaign/theme grouping, repurposing across channels, UTM tracking, LinkedIn auto-pull (replace weekly Excel).

## Done (this session)
Direct Meta API integration (app `SwissWiper Platform`, IG login variant, no App Review) · Instagram auto-publishing engine + Studio arm-switch + daily publish route · Alfred voice `create_post` (review panel → pipeline → Studio auto-draft) · Instagram analytics live-API page (`/marketing/instagram`) + daily snapshots + overview card live · env vars in Vercel · publishing SQL run.

## Done (earlier, for reference)
Plan page · gap-aware monthly planner · Content Studio (co-writing, Nano Banana incl. image-to-image, Veo) · media upload · pipeline + calendar + Google Calendar sync · monthly planning reminder cron · LinkedIn analytics · weekly executive summary · AI spend cap.
