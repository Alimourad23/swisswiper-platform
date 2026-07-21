import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishDueInstagramPosts } from "@/lib/marketing/publish";

/* Daily Instagram publish cron (hit by Vercel Cron late morning).

   Publishes content_posts that are: channel instagram + status scheduled +
   auto_publish ON + due (scheduled for today, or up to 2 days ago). Everything
   else — claiming, media, outcome tracking — lives in
   `src/lib/marketing/publish.ts`. Protected by CRON_SECRET, same as the other
   crons. Uses the service-role client because a cron has no signed-in session. */

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 500 });
  }

  try {
    const summary = await publishDueInstagramPosts(admin);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish run failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
