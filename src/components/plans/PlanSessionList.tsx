import { format } from "date-fns";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlanEffortLevel, PlanSession, PlanSessionStatus } from "@/types/plan";

type PlanSessionListProps = {
  sessions: PlanSession[];
  updatingId: string | null;
  onSetStatus: (session: PlanSession, status: PlanSessionStatus, effortLevel?: PlanEffortLevel) => void;
};

function getStatusClasses(status: PlanSessionStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (status === "missed") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200";
  if (status === "rescheduled") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200";
  return "border-stone-200 bg-stone-50 text-stone-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-300";
}

export default function PlanSessionList({ sessions, updatingId, onSetStatus }: PlanSessionListProps) {
  return (
    <div className="grid gap-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"
        >
          <div>
            <p className="font-medium text-stone-950 dark:text-stone-50">{session.title}</p>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {format(new Date(session.session_date), "PPP")} / {session.session_type}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(session.status)}`}>
              {session.status}
            </span>
            <select
              className="h-8 cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-0 text-xs text-stone-700 outline-none transition hover:border-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:cursor-wait disabled:opacity-70 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-white/35 dark:focus:border-stone-300 dark:focus:ring-white/10"
              value=""
              disabled={updatingId === session.id}
              onChange={(event) => {
                if (event.target.value) onSetStatus(session, "completed", event.target.value as PlanEffortLevel);
              }}
              aria-label={`Complete ${session.title} with an effort level`}
            >
              <option value="" disabled>Done</option>
              <option value="mvp">MVP</option>
              <option value="normal">Normal</option>
              <option value="deep">Deep</option>
            </select>
            <span
              className="grid h-8 w-8 place-items-center text-stone-500 dark:text-stone-400"
              title="MVP: Watch 20 min · Normal: 40 min + notes · Deep: 60–90 min + problems"
              aria-label="Effort levels: MVP means watch 20 minutes; Normal means 40 minutes plus notes; Deep means 60 to 90 minutes plus problems."
            >
              <Info className="h-4 w-4" />
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={updatingId === session.id || session.status === "missed"}
              onClick={() => onSetStatus(session, "missed")}
            >
              Missed
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
