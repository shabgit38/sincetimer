import { useMemo, useState } from "react";
import { useEffect } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { computeTimeSummary } from "@/lib/timeUtils";
import { getAllEntries } from "@/lib/db";
import type { Entry } from "@/types/entry";

const categoryFilters: Array<{ label: string; value: "all" | Entry["category"] }> = [
  { label: "All", value: "all" },
  { label: "Purchase", value: "purchase" },
  { label: "Task", value: "task" },
  { label: "Event", value: "event" },
  { label: "Routine", value: "routine" },
];

type SortOption = "created" | "overdue" | "category";

export default function Dashboard() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<"all" | Entry["category"]>("all");
  const [sortOption, setSortOption] = useState<SortOption>("created");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getAllEntries();
      setEntries(data as Entry[]);
      setLoading(false);
    };
    void load();
  }, []);

  const filteredEntries = useMemo(() => {
    const base = categoryFilter === "all" ? entries : entries.filter((entry) => entry.category === categoryFilter);
    if (sortOption === "category") {
      return [...base].sort((a, b) => a.category.localeCompare(b.category));
    }
    if (sortOption === "overdue") {
      return [...base].sort((a, b) => {
        const aSummary = computeTimeSummary(a.entry_date, a.next_due_date);
        const bSummary = computeTimeSummary(b.entry_date, b.next_due_date);
        const aDue = aSummary.nextDueIn ?? Number.POSITIVE_INFINITY;
        const bDue = bSummary.nextDueIn ?? Number.POSITIVE_INFINITY;
        return aDue - bDue;
      });
    }
    return [...base].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [entries, categoryFilter, sortOption]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-stone-500">Keep tabs on everything you log over time.</p>
        </div>
        <Button asChild>
          <Link to="/add">Add Entry</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {categoryFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={categoryFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-500" htmlFor="sort-select">
            Sort
          </label>
          <select
            id="sort-select"
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as SortOption)}
            className="h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700"
          >
            <option value="created">Newest first</option>
            <option value="overdue">Most overdue</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
          Loading entries...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center">
          <h3 className="text-lg font-semibold text-stone-800">No entries yet</h3>
          <p className="mt-2 text-sm text-stone-500">
            Add your first item to start tracking time since.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/add">Add your first entry</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredEntries.map((entry) => {
            const timeSince = formatDistanceToNowStrict(parseISO(entry.entry_date), {
              addSuffix: true,
            });
            const summary = computeTimeSummary(entry.entry_date, entry.next_due_date);
            const hasDue = Boolean(entry.next_due_date);
            const dueText = hasDue
              ? summary.isOverdue
                ? `Overdue by ${Math.abs(summary.nextDueIn ?? 0)} days`
                : summary.nextDueIn === 0
                  ? "Due today"
                  : `Due in ${summary.nextDueIn} days`
              : "No due date";

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => navigate(`/entry/${entry.id}`)}
                className="text-left"
              >
                <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-900">{entry.title}</h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-400">
                        {entry.category}
                      </p>
                    </div>
                    {entry.category === "purchase" && entry.price !== null && (
                      <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm font-semibold text-stone-700">
                        ${entry.price.toFixed(2)}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-600">
                    <span className="rounded-full bg-stone-100 px-3 py-1">{timeSince}</span>
                    <span
                      className={`rounded-full px-3 py-1 ${
                        summary.isOverdue ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {dueText}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
