import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import type { PlanSession } from "@/types/plan";

type PlanCalendarProps = {
  sessions: PlanSession[];
  updatingId: string | null;
  onMarkDone: (session: PlanSession) => void;
  onMarkMissed: (session: PlanSession) => void;
};

function getDotClass(status: PlanSession["status"]) {
  if (status === "completed") return "bg-emerald-500";
  if (status === "missed") return "bg-rose-500";
  if (status === "rescheduled") return "bg-amber-500";
  return "bg-stone-400";
}

export default function PlanCalendar({ sessions, updatingId, onMarkDone, onMarkMissed }: PlanCalendarProps) {
  const visibleSessions = sessions.slice(0, 24);

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {visibleSessions.map((session) => (
        <div
          key={session.id}
          className="rounded-xl border border-stone-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]"
        >
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${getDotClass(session.status)}`} />
            <p className="text-sm font-medium text-stone-950 dark:text-stone-50">
              {format(new Date(session.session_date), "MMM d")}
            </p>
            <span className="ml-auto rounded-full border border-stone-200 px-2 py-0.5 text-[11px] font-medium capitalize text-stone-500 dark:border-white/10 dark:text-stone-400">
              {session.status}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm text-stone-500 dark:text-stone-400">{session.title}</p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              disabled={updatingId === session.id || session.status === "completed"}
              onClick={() => onMarkDone(session)}
            >
              Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 px-2 text-xs"
              disabled={updatingId === session.id || session.status === "missed"}
              onClick={() => onMarkMissed(session)}
            >
              Missed
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
