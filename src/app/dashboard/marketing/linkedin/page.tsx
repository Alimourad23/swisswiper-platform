import LinkedInDashboard from "@/components/marketing/LinkedInDashboard";
import NotableEngagers, { type Engager } from "@/components/marketing/NotableEngagers";
import UploadDropzone from "@/components/marketing/UploadDropzone";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function getEngagers(): Promise<Engager[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notable_engagers")
      .select("id, name, note")
      .order("created_at", { ascending: false });
    return (data as Engager[] | null) ?? [];
  } catch {
    return [];
  }
}

async function getInquiries(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("marketing_inputs").select("inquiries").maybeSingle();
    return (data as { inquiries?: number } | null)?.inquiries ?? 0;
  } catch {
    return 0;
  }
}

export default async function LinkedInPage() {
  const { metrics, source, capturedAt } = await getLinkedInMetrics();
  const [engagers, inquiries] = await Promise.all([getEngagers(), getInquiries()]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      <LinkedInDashboard
        metrics={metrics}
        inquiries={inquiries}
        source={source}
        capturedAt={capturedAt}
        engagers={engagers}
      />
      {/* Manage — add notable engagers, refresh the export */}
      <div className="flex flex-col gap-4 border-t border-hairline pt-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-hint">Manage</p>
        <NotableEngagers initial={engagers} />
        <UploadDropzone />
      </div>
    </div>
  );
}
