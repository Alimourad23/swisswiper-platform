/* The content schedule: planned posts moving through idea → draft → scheduled →
   published. Types + constants only (importable by client components). The
   server actions live alongside in `schedule-actions.ts`. */

export type ContentStatus = "idea" | "draft" | "scheduled" | "published";

/* Approval sign-off, separate from the pipeline status:
   none (draft, not submitted) → pending (submitted) → approved, or → changes
   (a founder asked for edits). Publishing requires 'approved'. */
export type ApprovalStatus = "none" | "pending" | "approved" | "changes";

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  none: "Draft",
  pending: "Awaiting approval",
  approved: "Approved",
  changes: "Changes requested",
};

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
  /** Instagram only: publish automatically on the scheduled date via the daily cron. */
  auto_publish?: boolean | null;
  /** Approval sign-off — publishing is blocked until this is 'approved'. */
  approval_status?: ApprovalStatus | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  /** Note a founder leaves when asking for changes. */
  review_note?: string | null;
};

export const CONTENT_STATUSES: { key: ContentStatus; label: string }[] = [
  { key: "idea", label: "Idea" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];
