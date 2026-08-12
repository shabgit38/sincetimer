import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Info, Pencil, Save as SaveIcon, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getVisiblePlanSessions } from "@/lib/plans";
import type { PlanEffortLevel, PlanSession, PlanSessionStatus } from "@/types/plan";

type PlanCalendarProps = {
  sessions: PlanSession[];
  updatingId: string | null;
  onMarkDone: (session: PlanSession, effortLevel: PlanEffortLevel) => void;
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
            className="rounded-lg border border-stone-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${getDotClass(session.status)}`} />
              <p className="shrink-0 text-sm font-medium text-stone-950 dark:text-stone-50">
                {format(new Date(session.session_date), "MMM d")}
              </p>
              <span className="shrink-0 rounded-full border border-stone-200 px-2 py-0.5 text-[11px] font-medium capitalize text-stone-500 dark:border-white/10 dark:text-stone-400">
                {session.status}
              </span>
            </div>
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
                    className="h-7 w-7 !px-0"
                    disabled={updatingId === session.id || !editDate}
                    title="Save plan session changes"
                    aria-label="Save plan session changes"
                    onClick={() => {
                      onUpdateSession(session, {
                        session_date: new Date(editDate).toISOString(),
                        status: editStatus,
                        notes: editNotes.trim() || null,
                      });
                      setEditingId(null);
                    }}
                  >
                    <SaveIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 !px-0"
                    disabled={updatingId === session.id}
                    onClick={() => setEditingId(null)}
                    title="Cancel plan session editing"
                    aria-label="Cancel plan session editing"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    className="h-8 cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-0 text-xs text-stone-700 outline-none transition hover:border-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:cursor-wait disabled:opacity-70 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-white/35 dark:focus:border-stone-300 dark:focus:ring-white/10"
                    value=""
                    disabled={updatingId === session.id}
                    onChange={(event) => {
                      if (event.target.value) onMarkDone(session, event.target.value as PlanEffortLevel);
                    }}
                    aria-label={`Complete ${session.title} with an effort level`}
                  >
                    <option value="" disabled>Complete as...</option>
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
                    className="h-8 px-2 text-xs"
                    disabled={updatingId === session.id || session.status === "missed"}
                    onClick={() => onMarkMissed(session)}
                  >
                    Missed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-9 border-sky-300/70 bg-transparent px-0 text-sky-700 hover:border-sky-400 hover:bg-sky-50 dark:border-sky-300/65 dark:bg-transparent dark:text-sky-200 dark:hover:border-sky-200 dark:hover:bg-sky-400/10"
                    disabled={updatingId === session.id}
                    onClick={() => startEditing(session)}
                    aria-label={`Edit ${session.title}`}
                    title="Edit"
                  >
                    <Pencil className="h-[18px] w-[18px] stroke-[2.4]" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-9 border-rose-300/70 bg-transparent px-0 text-rose-700 hover:border-rose-400 hover:bg-rose-50 dark:border-rose-300/65 dark:bg-transparent dark:text-rose-200 dark:hover:border-rose-200 dark:hover:bg-rose-400/10"
                    disabled={updatingId === session.id}
                    onClick={() => onDeleteSession(session)}
                    aria-label={`Delete ${session.title}`}
                    title="Delete"
                  >
                    <Trash2 className="h-[18px] w-[18px] stroke-[2.4]" />
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
