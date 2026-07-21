import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { monthLabel, type MonthSuggestion } from "@/lib/marketing/monthly";
import { recommendedCount, CADENCE } from "@/lib/marketing/cadence";
import { getPerformanceBrief } from "@/lib/marketing/performance-brief";

/* Ask Alfred to draft a month's content plan from the marketing plan + recent
   posts. Returns a list of suggested posts (channel/title/idea/day/goal). Used by
   the manual "plan next month" action and the month-end cron. */

type PlanContext = {
  goals?: string;
  audience?: string;
  positioning?: string;
  pillars?: string;
  cadence?: string;
};

type RecentPost = { title: string; channel: string; scheduled_for: string | null; status: string };

const CHANNELS = Object.keys(CADENCE);
const GOALS = ["awareness", "followers", "inquiries", "community"];

export async function buildMonthSuggestions(input: {
  monthKey: string;
  plan: PlanContext;
  recentPosts: RecentPost[];
  /** Posts already planned for the target month (avoid duplicating / fill the gap). */
  thisMonthPosts?: RecentPost[];
  /** How many to propose (default ~7). */
  count?: number;
  /** Per-channel gap to fill (recommended − already planned). Drives the mix. */
  need?: Record<string, number>;
}): Promise<MonthSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  // The feedback loop: what actually performed recently (best-effort).
  const performance = await getPerformanceBrief().catch(() => "");

  const label = monthLabel(input.monthKey);
  const needEntries = Object.entries(input.need ?? {}).filter(([, n]) => n > 0);
  const needTotal = needEntries.reduce((a, [, n]) => a + n, 0);
  const target = Math.min(12, Math.max(3, input.count ?? (needTotal > 0 ? needTotal : 7)));
  const needLine = needEntries.length
    ? `Fill these gaps to reach the recommended cadence: ${needEntries.map(([c, n]) => `${c} ${n} more`).join(", ")}. Weight your mix accordingly.`
    : "";
  const planLines = [
    input.plan.goals && `Goals: ${input.plan.goals}`,
    input.plan.audience && `Audience: ${input.plan.audience}`,
    input.plan.positioning && `Positioning: ${input.plan.positioning}`,
    input.plan.pillars && `Content pillars: ${input.plan.pillars}`,
    input.plan.cadence && `Cadence: ${input.plan.cadence}`,
  ]
    .filter(Boolean)
    .join("\n");
  const recent = input.recentPosts
    .slice(0, 25)
    .map((p) => `- [${p.channel}] ${p.title}`)
    .join("\n");
  const already = (input.thisMonthPosts ?? [])
    .map((p) => `- [${p.channel}] ${p.title}`)
    .join("\n");
  const targets = CHANNELS.map((c) => `${c}: ~${recommendedCount(c)}/month`).join(", ");

  const system =
    "You are Alfred, SwissWiper's marketing director. SwissWiper is a luxury hard-water glass-care brand " +
    "(a precision wiper + care system that keeps shower screens, balustrades and facades flawless). " +
    "Voice: refined, calm, confident; understated luxury; never discounting or hype. " +
    `Draft a content plan for ${label}: propose ${target} posts across channels (${CHANNELS.join(", ")}), ` +
    `weighted toward each channel's recommended monthly volume (${targets}) and the plan's cadence. ` +
    (needLine ? `${needLine} ` : "") +
    "Build on recent threads — e.g. if a co-founder was just introduced, follow up with 'get to know them' content; " +
    "continue product-education and proof themes. Cover a balance of content pillars; vary formats " +
    "(story, education, behind-the-scenes, proof, founder voice). " +
    "CRITICAL: do NOT duplicate or closely repeat any post in 'Recent posts' or 'Already planned this month' — keep the calendar fresh and consistent. " +
    (performance
      ? "LEARN FROM PERFORMANCE: the user message includes real recent performance data. Weight your suggestions toward the themes and formats that measurably performed best, while keeping enough variety to keep testing. "
      : "") +
    `Tie each post to a secondary goal from: ${GOALS.join(", ")}.\n\n` +
    "Each post: a short working title (a hook, not a sentence), a one-line idea, the channel, a day of the month (1–28), and the goal.\n\n" +
    "Respond ONLY with a JSON array, no prose, no markdown:\n" +
    '[{"channel": string, "title": string, "idea": string, "day": number, "goal": string}]';

  const user =
    `Month: ${label}.\n\n` +
    `Marketing plan:\n${planLines || "(not filled in yet — use sensible defaults for a luxury glass-care brand)"}\n\n` +
    `Recent posts (build on these, never repeat):\n${recent || "(none yet)"}\n\n` +
    `Already planned this month (avoid these, fill the gaps):\n${already || "(none yet)"}` +
    (performance ? `\n\nWhat has actually performed recently:\n${performance}` : "");

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const raw = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end <= start) return [];
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown[];
    return parsed
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.title === "string" && typeof x.channel === "string")
      .map((x) => ({
        channel: CHANNELS.includes(String(x.channel).toLowerCase()) ? String(x.channel).toLowerCase() : "linkedin",
        title: String(x.title).slice(0, 140),
        idea: typeof x.idea === "string" ? x.idea.slice(0, 280) : "",
        day: Math.min(28, Math.max(1, Math.round(Number(x.day) || 1))),
        goal: GOALS.includes(String(x.goal).toLowerCase()) ? String(x.goal).toLowerCase() : undefined,
      }))
      .slice(0, 12);
  } catch {
    return [];
  }
}
