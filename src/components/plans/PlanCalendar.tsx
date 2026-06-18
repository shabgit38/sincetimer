import { format } from "date-fns";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getVisiblePlanSessions } from "@/lib/plans";
import type { PlanSession, PlanSessionStatus } from "@/types/plan";

type PlanCalendarProps = {
  sessions: PlanSession[];
  updatingId: string | null;
  onMarkDone: (session: PlanSession) => void;
  onMarkMissed: (session: PlanSession) => void;
  onUpdateSession: (
    session: PlanSession,
    updates: Partial<Pick<PlanSession, "session_date" | "status" | "notes">>
  ) => void;
  onDeleteSession: (session: PlanSession) => void;
};

function getDotClass(status: PlanSession["status"]) {
  if (status === "completed") return "bg-emerald-500";
  if (status === "missed") return "bg-rose-500";
  if (status === "rescheduled") return "bg-amber-500";
  return "bg-stone-400";
}

function toDateInputValue(dateIso: string) {
  return new Date(dateIso).toISOString().slice(0, 10);
}

export default function PlanCalendar({
  sessions,
  updatingId,
  onMarkDone,
  onMarkMissed,
  onUpdateSession,
  onDeleteSession,
}: PlanCalendarProps) {
  const visibleSessions = getVisiblePlanSessions(sessions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<PlanSessionStatus>("scheduled");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (!editingId) return;
    const session = sessions.find((item) => item.id === editingId);
    if (!session) setEditingId(null);
  }, [editingId, sessions]);

  const startEditing = (session: PlanSession) => {
    setEditingId(session.id);
    setEditDate(toDateInputValue(session.session_date));
    setEditStatus(session.status);
    setEditNotes(session.notes ?? "");
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {visibleSessions.map((session) => {
        const isEditing = editingId === session.id;

        return (
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
            {isEditing ? (
              <div className="mt-3 grid gap-2">
                <input
                  type="date"
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
                  className="h-8 rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-700 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100"
                />
                <select
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as PlanSessionStatus)}
                  className="h-8 rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-700 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="skipped">Skipped</option>
                </select>
                <textarea
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  rows={2}
                  className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100"
                  placeholder="Notes"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 flex-1 px-2 text-xs"
                    disabled={updatingId === session.id || !editDate}
                    onClick={() => {
                      onUpdateSession(session, {
                        session_date: new Date(editDate).toISOString(),
                        status: editStatus,
                        notes: editNotes.trim() || null,
                      });
                      setEditingId(null);
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 px-2 text-xs"
                    disabled={updatingId === session.id}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                <div className="flex gap-2">
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
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 px-2 text-xs"
                    disabled={updatingId === session.id}
                    onClick={() => startEditing(session)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 flex-1 px-2 text-xs"
                    disabled={updatingId === session.id}
                    onClick={() => onDeleteSession(session)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
