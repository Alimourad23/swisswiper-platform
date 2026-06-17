import ModuleHeader from "@/components/ModuleHeader";
import { AutoTag, ServiceBadge } from "@/components/Pill";
import LinkedInClient from "@/components/marketing/LinkedInClient";
import UploadDropzone from "@/components/marketing/UploadDropzone";
import NotableEngagers, { type Engager } from "@/components/marketing/NotableEngagers";
import { icons } from "@/lib/modules";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={icons.marketing}
        title="LinkedIn"
        subtitle="SwissWiper Page analytics, from your weekly export — read-only."
        right={
          <div className="flex items-center gap-2">
            <AutoTag />
            <ServiceBadge label="LinkedIn" />
          </div>
        }
      />

      <LinkedInClient metrics={metrics} inquiries={inquiries} capturedAt={capturedAt} source={source} />

      <NotableEngagers initial={engagers} />
      <UploadDropzone />
    </div>
  );
}
