import { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { ChevronDown, Pencil } from "lucide-react";
import { Link } from "react-router-dom";

import PlanCalendar from "@/components/plans/PlanCalendar";
import {
  deletePlanSession,
  getPlanMetrics,
  getPlansWithSessions,
  updatePlanSession,
  updatePlanSessionStatus,
} from "@/lib/plans";
import { computeTimeSummary } from "@/lib/timeUtils";
import type { Entry } from "@/types/entry";
import type { PlanMetrics, PlanSession, PlanSessionStatus, PlanWithSessions } from "@/types/plan";

function getPlanTypeLabel(value: unknown) {
  if (value === "habit") return "Habit";
  if (value === "practice") return "Practice";
  return "Learning";
}

function formatOptionLabel(value: string) {
  return value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function getPlanCategoryLabel(entry: PlanWithSessions["entry"]) {
  return entry.category.trim().toLocaleLowerCase() === "plan"
    ? getPlanTypeLabel(entry.metadata.plan_type)
    : formatOptionLabel(entry.category);
}

function formatPlanDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = parseISO(value);
  return isValid(date) ? format(date, "MMM d, yyyy") : null;
}

function getPlanDateRange(entry: Entry) {
  const start = formatPlanDate(entry.metadata.start_date) ?? formatPlanDate(entry.entry_date);
  const end = formatPlanDate(entry.metadata.end_date);
  if (!start) return null;
  return end ? `${start} – ${end}` : `${start} – No end date`;
}

function getPlanDueCopy(entry: Entry, nextSession: PlanSession | null) {
  const dueDate = nextSession?.session_date ?? null;
  const summary = computeTimeSummary(entry.entry_date, dueDate);
  if (!dueDate) return { tone: "neutral", label: "No upcoming session", detail: "No schedule" };
  if (summary.isOverdue) return { tone: "overdue", label: `${Math.abs(summary.nextDueIn ?? 0)} days overdue`, detail: "Needs attention" };
  if (summary.nextDueIn === 0) return { tone: "today", label: "Due today", detail: "Ready to log" };
  if ((summary.nextDueIn ?? 0) <= 7) return { tone: "soon", label: `Due in ${summary.nextDueIn} days`, detail: "Coming up" };
  return { tone: "normal", label: `Due in ${summary.nextDueIn} days`, detail: "On track" };
}

function getToneClasses(tone: string) {
  if (tone === "overdue") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200";
  if (tone === "today") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200";
  if (tone === "soon") return "border-amber-100 bg-amber-50/70 text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-200";
  return "border-stone-200 bg-stone-50 text-stone-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-300";
}

function HeaderMetrics({ metrics }: { metrics: PlanMetrics }) {
  const items = [
    { label: "Progress", value: `${metrics.completionRate}%` },
    { label: "Done", value: `${metrics.completed}/${metrics.total}` },
    { label: "Scheduled", value: metrics.scheduled },
    { label: "Missed", value: metrics.missed },
  ];

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-emerald-300 bg-emerald-50/60 px-3 py-1.5 text-right dark:border-emerald-500/40 dark:bg-emerald-950/20"
        >
          <p className="text-[11px] text-emerald-700 dark:text-emerald-200">{item.label}</p>
          <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function Plans() {
  const [plans, setPlans] = useState<PlanWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(() => new Set());

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await getPlansWithSessions());
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load goals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const planSummaries = useMemo(
    () =>
      plans.map((plan) => ({
        ...plan,
        metrics: getPlanMetrics(plan.sessions),
      })),
    [plans]
  );

  const handleSetStatus = async (session: PlanSession, status: PlanSessionStatus) => {
    setUpdatingId(session.id);
    try {
      await updatePlanSessionStatus(session.id, status);
      await loadPlans();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update this session.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateSession = async (
    session: PlanSession,
    updates: Partial<Pick<PlanSession, "session_date" | "status" | "notes">>
  ) => {
    setUpdatingId(session.id);
    try {
      await updatePlanSession(session.id, updates);
      await loadPlans();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update this session.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteSession = async (session: PlanSession) => {
    const confirmed = window.confirm("Delete this goal session? This cannot be undone.");
    if (!confirmed) return;
    setUpdatingId(session.id);
    try {
      await deletePlanSession(session);
      await loadPlans();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to delete this session.");
    } finally {
      setUpdatingId(null);
    }
  };

  const togglePlan = (entryId: string) => {
    setExpandedPlanIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-400">
        Loading goals...
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-50">Goals</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">Track repeated learning, habits, and practice sessions.</p>
        </div>
        <Link
          to="/add?category=goal"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-stone-100 px-4 text-sm font-medium text-stone-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
        >
          Add Goal
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {planSummaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-lg font-semibold text-stone-950 dark:text-stone-50">No goals yet</h3>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">Create a Goal to generate scheduled sessions.</p>
        </div>
      ) : (
        <div className="grid gap-5">
          {planSummaries.map(({ entry, sessions, metrics }) => {
            const expanded = expandedPlanIds.has(entry.id);
            const due = getPlanDueCopy(entry, metrics.nextSession);
            const dateRange = getPlanDateRange(entry);

            return (
              <article key={entry.id} className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => togglePlan(entry.id)}
                    aria-expanded={expanded}
                  >
                    <ChevronDown
                      className={`mt-1 h-4 w-4 shrink-0 text-stone-500 transition dark:text-stone-400 ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-700 dark:text-stone-200">
                        {entry.area} / {getPlanCategoryLabel(entry)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate text-xl font-semibold text-stone-950 dark:text-stone-50">{entry.title}</h3>
                        {dateRange ? (
                          <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-300">
                            {dateRange}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                  <div className={`rounded-xl border px-2.5 py-1.5 text-xs ${getToneClasses(due.tone)}`}>
                    <p className="font-medium leading-tight">{due.label}</p>
                    <p className="mt-0.5 text-[11px] leading-tight opacity-70">{due.detail}</p>
                  </div>
                  <HeaderMetrics metrics={metrics} />
                  <Link
                    to={`/edit/${entry.id}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sky-300/70 bg-transparent text-sm font-medium text-sky-700 transition hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-sky-300/65 dark:bg-transparent dark:text-sky-200 dark:hover:border-sky-200 dark:hover:bg-sky-400/10"
                    aria-label={`Edit ${entry.title}`}
                    title="Edit"
                  >
                    <Pencil className="h-[18px] w-[18px] stroke-[2.4]" />
                  </Link>
                </div>
                {expanded ? (
                  <div className="border-t border-stone-200 p-5 dark:border-white/10">
                    <PlanCalendar
                      sessions={sessions}
                      updatingId={updatingId}
                      onMarkDone={(session) => void handleSetStatus(session, "completed")}
                      onMarkMissed={(session) => void handleSetStatus(session, "missed")}
                      onUpdateSession={(session, updates) => void handleUpdateSession(session, updates)}
                      onDeleteSession={(session) => void handleDeleteSession(session)}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
