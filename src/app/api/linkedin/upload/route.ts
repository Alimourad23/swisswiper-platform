import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFiles, type InputFile } from "@/lib/linkedin/parse";

/* Receives the weekly LinkedIn export file(s), parses them (read-only — we only
   read the uploaded files), and stores the result in Supabase. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No files received." }, { status: 400 });

  let inputs: InputFile[];
  try {
    inputs = await Promise.all(
      files.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) })),
    );
  } catch {
    return NextResponse.json({ error: "Could not read the files." }, { status: 400 });
  }

  let metrics;
  try {
    metrics = parseFiles(inputs);
  } catch {
    return NextResponse.json(
      { error: "Could not parse — make sure these are the LinkedIn Content/Followers/Visitors exports." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("linkedin_metrics")
    .insert({ user_id: user.id, data: metrics });
  if (error) {
    return NextResponse.json(
      { error: "Saved parse, but storing failed: " + error.message },
      { status: 500 },
    );
  }

  const impressions = metrics.daily.content.reduce((n, d) => n + d.impOrg + d.impSpon, 0);
  return NextResponse.json({
    ok: true,
    followers: metrics.followersAllTime,
    impressions,
  });
}
