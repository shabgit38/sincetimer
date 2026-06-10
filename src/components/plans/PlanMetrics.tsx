import type { PlanMetrics as PlanMetricsType } from "@/types/plan";

type PlanMetricsProps = {
  metrics: PlanMetricsType;
};

export default function PlanMetrics({ metrics }: PlanMetricsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-xs text-stone-500 dark:text-stone-400">Progress</p>
        <p className="mt-1 text-lg font-semibold text-stone-950 dark:text-stone-50">{metrics.completionRate}%</p>
      </div>
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-xs text-stone-500 dark:text-stone-400">Completed</p>
        <p className="mt-1 text-lg font-semibold text-stone-950 dark:text-stone-50">
          {metrics.completed}/{metrics.total}
        </p>
      </div>
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-xs text-stone-500 dark:text-stone-400">Scheduled</p>
        <p className="mt-1 text-lg font-semibold text-stone-950 dark:text-stone-50">{metrics.scheduled}</p>
      </div>
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-xs text-stone-500 dark:text-stone-400">Missed</p>
        <p className="mt-1 text-lg font-semibold text-stone-950 dark:text-stone-50">{metrics.missed}</p>
      </div>
    </div>
  );
}
