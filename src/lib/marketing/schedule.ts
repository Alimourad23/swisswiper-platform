/* The content schedule: planned posts moving through idea → draft → scheduled →
   published. Types + constants only (importable by client components). The
   server actions live alongside in `schedule-actions.ts`. */

export type ContentStatus = "idea" | "draft" | "scheduled" | "published";

export type ContentPost = {
  id: string;
  created_by: string;
  title: string;
  channel: string;
  status: ContentStatus;
  scheduled_for: string | null;
  format: string;
  body: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export const CONTENT_STATUSES: { key: ContentStatus; label: string }[] = [
  { key: "idea", label: "Idea" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];
