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
  /** Google Calendar event IDs created for this post (plan/draft/announce). */
  gcal_event_ids?: string[] | null;
  /** Alfred's one-line brief (auto-draft seed); set when the post came from a suggestion. */
  seed_idea?: string | null;
  /** Secondary goal: awareness | followers | inquiries | community. */
  goal?: string | null;
  /** Where the post came from: manual | alfred. */
  source?: string | null;
  /** Instagram auto-publish: per-post opt-in; the daily cron publishes due posts. */
  auto_publish?: boolean;
  /** null | publishing | published | failed */
  publish_status?: string | null;
  published_at?: string | null;
  /** Instagram media id of the live post. */
  external_post_id?: string | null;
  /** Public link to the live post. */
  external_permalink?: string | null;
  /** Friendly error when publish_status = 'failed'. */
  publish_error?: string | null;
};

export const CONTENT_STATUSES: { key: ContentStatus; label: string }[] = [
  { key: "idea", label: "Idea" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];
