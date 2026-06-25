import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/notifications";
import { buildMonthSuggestions } from "@/lib/marketing/monthly-generate";
import { assignOpenDates, recommendedCount, CADENCE } from "@/lib/marketing/cadence";
import { MIN_PLANNED_PER_MONTH, monthKey, monthLabel, type MonthSuggestion } from "@/lib/marketing/monthly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Month-end cron (hit by Vercel Cron, e.g. the 25th). If next month is looking
   thin (fewer than MIN_PLANNED_PER_MONTH scheduled posts) and Alfred hasn't
   already drafted a plan for it, generate a suggested plan, store it, and email
   the marketing inbox + founders with a link to review & add it.
   Protected by CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  const now = new Date();
  const key = monthKey(now, 1); // next month 'YYYY-MM'
  const monthStart = `${key}-01`;
  const nextStart = `${monthKey(now, 2)}-01`;

  // Already drafted (or applied/dismissed) a plan for next month? Don't re-fire.
  const { data: existing } = await admin
    .from("marketing_month_plans")
    .select("id")
    .eq("month", key)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, skipped: "plan already exists" });

  // Count posts already scheduled for next month.
  const { count } = await admin
    .from("content_posts")
    .select("id", { count: "exact", head: true })
    .gte("scheduled_for", monthStart)
    .lt("scheduled_for", nextStart);
  if ((count ?? 0) >= MIN_PLANNED_PER_MONTH) {
    return NextResponse.json({ ok: true, skipped: "month already planned", planned: count });
  }

  // Context: the marketing plan + recent posts + what's already planned next month.
  const [{ data: planRow }, { data: postRows }, { data: monthRows }] = await Promise.all([
    admin.from("marketing_plan").select("*").limit(1).maybeSingle(),
    admin
      .from("content_posts")
      .select("title, channel, scheduled_for, status")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("content_posts")
      .select("title, channel, scheduled_for, status")
      .gte("scheduled_for", monthStart)
      .lt("scheduled_for", nextStart),
  ]);

  const monthPosts = (monthRows as { title: string; channel: string; scheduled_for: string | null; status: string }[]) ?? [];
  const planned: Record<string, number> = {};
  const takenByChannel: Record<string, string[]> = {};
  for (const p of monthPosts) {
    planned[p.channel] = (planned[p.channel] ?? 0) + 1;
    if (p.scheduled_for) (takenByChannel[p.channel] ??= []).push(p.scheduled_for);
  }
  const need: Record<string, number> = {};
  for (const ch of Object.keys(CADENCE)) {
    const g = recommendedCount(ch) - (planned[ch] ?? 0);
    if (g > 0) need[ch] = g;
  }

  const raw = await buildMonthSuggestions({
    monthKey: key,
    plan: (planRow as Record<string, string> | null) ?? {},
    recentPosts: (postRows as { title: string; channel: string; scheduled_for: string | null; status: string }[]) ?? [],
    thisMonthPosts: monthPosts,
    need,
  });
  if (raw.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no suggestions generated" });
  }
  // Next month → no today-floor needed; just place on open cadence days.
  const dates = assignOpenDates(key, raw, { takenByChannel });
  const suggestions: MonthSuggestion[] = raw.map((s, i) => ({ ...s, date: dates[i] }));

  await admin.from("marketing_month_plans").insert({ month: key, status: "suggested", suggestions });

  // Email the marketing inbox + any founders.
  const label = monthLabel(key);
  const lines = (suggestions as MonthSuggestion[]).map(
    (s) => `${cap(s.channel)} — ${s.title}${s.idea ? `: ${s.idea}` : ""}`,
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://swisswiper-platform.vercel.app";
  const html = emailTemplate({
    heading: `${label} is looking light`,
    body: `Only ${count ?? 0} post${(count ?? 0) === 1 ? "" : "s"} are planned for ${label}. I've drafted ${
      suggestions.length
    } ideas to fill it out — review and add them to the pipeline in a click.`,
    lines,
    link: `${appUrl}/dashboard/marketing/pipeline`,
    linkLabel: "Review the plan",
  });

  const recipients = new Set<string>(["marketing@swisswiper.com"]);
  const { data: founders } = await admin.from("profiles").select("email").eq("role", "founder");
  for (const f of (founders ?? []) as { email?: string }[]) if (f.email) recipients.add(f.email);

  let emailsSent = 0;
  for (const to of recipients) {
    await sendEmail(to, `Plan for ${label}`, html);
    emailsSent++;
  }

  return NextResponse.json({ ok: true, month: key, suggestions: suggestions.length, emailsSent });
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
