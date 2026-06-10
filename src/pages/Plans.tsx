import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";

import PlanCalendar from "@/components/plans/PlanCalendar";
import PlanMetrics from "@/components/plans/PlanMetrics";
import { getPlanMetrics, getPlansWithSessions, updatePlanSessionStatus } from "@/lib/plans";
import type { PlanSession, PlanSessionStatus, PlanWithSessions } from "@/types/plan";

function getPlanTypeLabel(value: unknown) {
  if (value === "habit") return "Habit";
  if (value === "practice") return "Practice";
  return "Learning";
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
      setError("Unable to load plans.");
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
        Loading plans...
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-50">Plans</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">Track repeated learning, habits, and practice sessions.</p>
        </div>
        <Link
          to="/add?category=plan"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-stone-100 px-4 text-sm font-medium text-stone-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
        >
          Add Plan
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {planSummaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-lg font-semibold text-stone-950 dark:text-stone-50">No plans yet</h3>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">Create a Plan entry to generate scheduled sessions.</p>
        </div>
      ) : (
        <div className="grid gap-5">
          {planSummaries.map(({ entry, sessions, metrics }) => {
            const expanded = expandedPlanIds.has(entry.id);

            return (
              <article key={entry.id} className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    onClick={() => togglePlan(entry.id)}
                    aria-expanded={expanded}
                  >
                    <ChevronDown
                      className={`mt-1 h-4 w-4 shrink-0 text-stone-500 transition dark:text-stone-400 ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
                        {entry.area} / {getPlanTypeLabel(entry.metadata.plan_type)}
                      </p>
                      <h3 className="mt-2 truncate text-xl font-semibold text-stone-950 dark:text-stone-50">{entry.title}</h3>
                      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                        Next: {metrics.nextSession ? new Date(metrics.nextSession.session_date).toLocaleDateString() : "No upcoming session"}
                      </p>
                    </div>
                  </button>
                  <Link
                    to={`/edit/${entry.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-200 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                  >
                    Edit
                  </Link>
                </div>
                {expanded ? (
                  <div className="border-t border-stone-200 p-5 dark:border-white/10">
                    <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-3 dark:border-emerald-500/40 dark:bg-emerald-950/15">
                      <PlanMetrics metrics={metrics} />
                    </div>
                    <div className="mt-5">
                      <PlanCalendar
                        sessions={sessions}
                        updatingId={updatingId}
                        onMarkDone={(session) => void handleSetStatus(session, "completed")}
                        onMarkMissed={(session) => void handleSetStatus(session, "missed")}
                      />
                    </div>
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
