/* Single source of truth for the Tasks module's shapes. Shared by the data
   layer, the server actions and the UI. No other module imports this. */

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high";
export type TaskVisibility = "team" | "personal";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  visibility: TaskVisibility;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  /** Soft-delete marker. Non-null = in Trash, excluded from normal views. */
  deleted_at: string | null;
  /** User ids of everyone assigned (joined in by the data layer). */
  assignees: string[];
};

/* Starter SwissWiper categories. These are just suggested values for the
   tasks.tags column — users can also type their own. */
export const TASK_CATEGORIES = [
  "Marketing",
  "Sales",
  "Ops",
  "Product",
  "Finance",
  "Personal",
  "Admin",
] as const;

export const STATUS_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};
