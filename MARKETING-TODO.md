# Marketing module — parked to-dos

_Paused to work on another area. Resume from here._

## Priority order
1. **Publishing (biggest gap).** Auto-post to channels at the scheduled time via a social aggregator (Ayrshare / Buffer / Publer-style API), rather than native per-platform APIs. Turns the calendar into a real publishing engine. Requires Ali to pick/sign up for an aggregator.
2. **Analytics for the other channels.** Only LinkedIn is live (weekly Excel upload). Add Instagram, TikTok, YouTube, Website — ideally via the same aggregator, which usually returns analytics too.
3. **Analytics feedback loop.** Alfred learns from what actually performed (themes/formats/goals) and weights next month's suggestions toward it. Depends on #2 having cross-channel data.
4. **Collaboration / approvals.** Review-and-approve step before publish (who drafted, who approved) + cleaner status flow — useful once Max & Aleksandra are active.
5. **Polish.** Campaign/theme grouping (tag a series, e.g. "Etienne intro"), repurpose one post into other channels, an engagement/comments view, UTM link tracking for inquiries, automate the LinkedIn pull (instead of weekly Excel).

## Setup / confirm (not code)
- Enable **Gemini billing** so Nano Banana images + Veo video actually generate.
- Confirm the last build shipped: run SQL `ai-usage.sql` + `video-jobs.sql`, set Ali's profile `role = 'founder'`, then `build and push to main`.

## Already done (for reference)
Plan page · gap-aware monthly planner (Alfred + manual, mid-month + multi-month) · Content Studio (co-writing, Nano Banana images incl. image-to-image, Veo video) · media upload · pipeline + calendar + Google Calendar sync · monthly planning reminder cron · LinkedIn analytics · weekly executive summary · AI spend cap + usage counter (founder-gated video).
