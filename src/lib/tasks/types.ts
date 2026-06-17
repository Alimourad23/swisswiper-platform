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
  /** User ids of everyone assigned (joined in by the data layer). */
  assignees: string[];
};

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
