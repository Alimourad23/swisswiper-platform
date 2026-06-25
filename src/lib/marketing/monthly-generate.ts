import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { monthLabel, type MonthSuggestion } from "@/lib/marketing/monthly";

/* Ask Alfred to draft a month's content plan from the marketing plan + recent
   posts. Returns a list of suggested posts (channel/title/idea/day). Used by both
   the manual "plan next month" action and the month-end cron. */

type PlanContext = {
  goals?: string;
  audience?: string;
  positioning?: string;
  pillars?: string;
  cadence?: string;
};

type RecentPost = { title: string; channel: string; scheduled_for: string | null; status: string };

const CHANNELS = ["linkedin", "instagram", "tiktok", "youtube", "website"];

export async function buildMonthSuggestions(input: {
  monthKey: string;
  plan: PlanContext;
  recentPosts: RecentPost[];
}): Promise<MonthSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const label = monthLabel(input.monthKey);
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
    .slice(0, 20)
    .map((p) => `- [${p.channel}] ${p.title}${p.status ? ` (${p.status})` : ""}`)
    .join("\n");

  const system =
    "You are Alfred, SwissWiper's marketing director. SwissWiper is a luxury hard-water glass-care brand " +
    "(a precision wiper + care system that keeps shower screens, balustrades and facades flawless). " +
    "Voice: refined, calm, confident; understated luxury; never discounting or hype. " +
    `Draft a content plan for ${label}. Propose 6–8 posts spread across the month and across channels ` +
    `(${CHANNELS.join(", ")}), weighted toward the channels and cadence in the plan. ` +
    "Build on recent threads — e.g. if a co-founder was just introduced, follow up with 'get to know them' content; " +
    "continue product-education and proof themes. Vary formats (story, education, behind-the-scenes, proof, founder voice). " +
    "Each post: a short working title (a hook, not a sentence), a one-line idea, the channel, and a day of the month (1–28).\n\n" +
    "Respond ONLY with a JSON array, no prose, no markdown:\n" +
    '[{"channel": string, "title": string, "idea": string, "day": number}]';

  const user =
    `Month: ${label}.\n\n` +
    `Marketing plan:\n${planLines || "(not filled in yet — use sensible defaults for a luxury glass-care brand)"}\n\n` +
    `Recent / existing posts (build on these, don't repeat):\n${recent || "(none yet)"}`;

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
      }))
      .slice(0, 10);
  } catch {
    return [];
  }
}
