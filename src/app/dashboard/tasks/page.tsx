import ModuleHeader from "@/components/ModuleHeader";
import TasksBoard from "@/components/tasks/TasksBoard";
import { getModule } from "@/lib/modules";
import { getTasksData } from "@/lib/tasks/data";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; task?: string }>;
}) {
  const m = getModule("tasks")!;
  const { view, task } = await searchParams;
  const { tasks, profiles, userId } = await getTasksData();

  // The sidebar children map to these views:
  //   ?view=mine  → "My tasks" (list, scoped to me)
  //   ?view=board → "Team board" (board layout)
  const initialView = view === "board" ? "board" : "list";
  const initialScope = view === "mine" ? "mine" : "all";
  const activeCount = tasks.filter((t) => !t.deleted_at).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle="A shared to-do list for the team. Assign, track and get notified — live for everyone."
        right={<span className="text-xs text-hint">{activeCount} task{activeCount === 1 ? "" : "s"}</span>}
      />
      <TasksBoard
        initialTasks={tasks}
        profiles={profiles}
        userId={userId}
        initialView={initialView}
        initialScope={initialScope}
        initialOpenId={task ?? null}
      />
    </div>
  );
}
