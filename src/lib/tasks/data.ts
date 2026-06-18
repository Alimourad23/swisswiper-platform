import { createClient } from "@/lib/supabase/server";
import type { Profile, Task, TaskRole } from "@/lib/tasks/types";

export type TasksData = {
  tasks: Task[];
  profiles: Profile[];
  userId: string | null;
  /** The signed-in user's role — gates the "Founders" visibility option. */
  userRole: TaskRole;
};

/* The ONE function the UI calls to load tasks. Swapping the source later must
   not change the UI. Returns the tasks visible to the signed-in user (RLS
   does the filtering), each with its assignee user-ids joined in, plus all
   team profiles (for the assignee picker + @mentions). */
export async function getTasksData(): Promise<TasksData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tasks: [], profiles: [], userId: null, userRole: "member" };

  const [{ data: taskRows }, { data: profileRows }, { data: myProfile }] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, email, full_name, avatar_url"),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const userRole: TaskRole =
    (myProfile as { role?: string } | null)?.role === "founder" ? "founder" : "member";

  const baseTasks = (taskRows ?? []) as Omit<Task, "assignees">[];

  // Join assignees in a single query, then group by task.
  const ids = baseTasks.map((t) => t.id);
  const byTask = new Map<string, string[]>();
  if (ids.length) {
    const { data: assignRows } = await supabase
      .from("task_assignees")
      .select("task_id, user_id")
      .in("task_id", ids);
    for (const row of (assignRows ?? []) as { task_id: string; user_id: string }[]) {
      const list = byTask.get(row.task_id) ?? [];
      list.push(row.user_id);
      byTask.set(row.task_id, list);
    }
  }

  const tasks: Task[] = baseTasks.map((t) => ({
    ...t,
    assignees: byTask.get(t.id) ?? [],
  }));

  return { tasks, profiles: (profileRows ?? []) as Profile[], userId: user.id, userRole };
}
