import { useMemo, useState } from "react";
import { useEffect } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { computeTimeSummary } from "@/lib/timeUtils";
import { getAllEntries } from "@/lib/db";
import type { Entry, EntryArea, EntryType } from "@/types/entry";

const areaFilters: Array<{ label: string; value: "all" | EntryArea }> = [
  { label: "All", value: "all" },
  { label: "Home", value: "home" },
  { label: "Work", value: "work" },
  { label: "Personal", value: "personal" },
  { label: "Health", value: "health" },
];

const typeFilters: Array<{ label: string; value: "all" | EntryType }> = [
  { label: "All types", value: "all" },
  { label: "Goals", value: "goal" },
  { label: "Routines", value: "routine" },
  { label: "Tasks", value: "task" },
  { label: "Purchases", value: "purchase" },
];

type SortOption = "created" | "overdue" | "area";

export default function Dashboard() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState<"all" | EntryArea>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>("all");
  const [sortOption, setSortOption] = useState<SortOption>("created");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAllEntries();
        setEntries(data);
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load entries.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredEntries = useMemo(() => {
    const byArea = areaFilter === "all" ? entries : entries.filter((entry) => entry.area === areaFilter);
    const base = typeFilter === "all" ? byArea : byArea.filter((entry) => entry.type === typeFilter);
    if (sortOption === "area") {
      return [...base].sort((a, b) => a.area.localeCompare(b.area));
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
  }, [entries, areaFilter, typeFilter, sortOption]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-stone-500">Track goals, routines, tasks, and purchases by area.</p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-lg bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-700" to="/add">
          Add Entry
        </Link>
      </div>

      <div className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {areaFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={areaFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setAreaFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {typeFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={typeFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(filter.value)}
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
              <option value="area">Area</option>
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
          Loading entries...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center">
          <h3 className="text-lg font-semibold text-stone-800">No entries yet</h3>
          <p className="mt-2 text-sm text-stone-500">
            Add your first item to start tracking time since.
          </p>
          <Link className="mt-4 inline-flex h-10 items-center rounded-lg bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-700" to="/add">
            Add your first entry
          </Link>
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
                        {entry.area} / {entry.type}
                      </p>
                    </div>
                    {entry.type === "purchase" && entry.price !== null && (
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
