import { addDays, format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { computeTimeSummary } from "@/lib/timeUtils";
import {
  deleteEntry,
  getEntryById,
  getHistoryForEntry,
  getHistoryMonths,
  insertHistory,
  updateEntry,
} from "@/lib/db";
import type { Entry, HistoryItem } from "@/types/entry";

function getNextDueDateForLog(entry: Entry, loggedAt: Date) {
  if (!entry.repeat_interval_days) return entry.next_due_date;
  return addDays(loggedAt, entry.repeat_interval_days).toISOString();
}

export default function EntryDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const entryId = params.id ?? null;

  const [entry, setEntry] = useState<Entry | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyMonths, setHistoryMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logDate, setLogDate] = useState("");
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!entryId) return;
      setLoading(true);
      setError(null);
      try {
        const [entryRecord, historyRecords, months] = await Promise.all([
          getEntryById(entryId),
          getHistoryForEntry(entryId),
          getHistoryMonths(),
        ]);
        setEntry(entryRecord);
        setHistory(historyRecords);
        setHistoryMonths(months);
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load entry.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [entryId]);

  const timeSummary = useMemo(() => {
    if (!entry) return null;
    return computeTimeSummary(entry.entry_date, entry.next_due_date);
  }, [entry]);

  const totalSpend = useMemo(() => {
    if (!entry || entry.category !== "purchase" || entry.price === null) return null;
    const count = 1 + history.length;
    return Number(entry.price) * count;
  }, [entry, history.length]);

  const handleLogAgain = async () => {
    if (!entry || !entryId) return;
    setLogError(null);
    if (!logDate) {
      setLogError("Choose a log date first.");
      return;
    }

    try {
      const loggedAt = new Date(logDate);
      const loggedAtIso = loggedAt.toISOString();
      const nextDueDate = getNextDueDateForLog(entry, loggedAt);

      await insertHistory({
        entry_id: entryId,
        logged_date: loggedAtIso,
        notes: "",
      });
      await updateEntry(entryId, {
        entry_date: loggedAtIso,
        next_due_date: nextDueDate,
      });
      const [updated, historyRecords] = await Promise.all([
        getEntryById(entryId),
        getHistoryForEntry(entryId),
      ]);
      setEntry(updated);
      setHistory(historyRecords);
      setLogDate("");
    } catch (saveError) {
      console.error(saveError);
      setLogError("Unable to save this log. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!entryId) return;
    const confirmed = window.confirm("Delete this entry? This cannot be undone.");
    if (!confirmed) return;
    await deleteEntry(entryId);
    navigate("/");
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-stone-500">Loading entry...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-rose-700 shadow-sm">
        <p className="text-sm">{error}</p>
      </section>
    );
  }

  if (!entry) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Entry not found</h2>
        <p className="mt-2 text-sm text-stone-500">This entry may have been deleted.</p>
        <Link className="mt-4 inline-flex h-10 items-center rounded-lg bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-700" to="/">
          Back to Dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{entry.title}</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            {entry.area} / {entry.category}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/edit/${entry.id}`)}>
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Last logged</p>
          <p className="mt-2 text-lg font-semibold">{format(parseISO(entry.entry_date), "PPP")}</p>
          <p className="mt-1 text-sm text-stone-500">
            {formatDistanceToNowStrict(parseISO(entry.entry_date), { addSuffix: true })}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Next due</p>
          <p className="mt-2 text-lg font-semibold">
            {entry.next_due_date ? format(parseISO(entry.next_due_date), "PPP") : "Not set"}
          </p>
          <p className={`mt-1 text-sm ${timeSummary?.isOverdue ? "text-rose-600" : "text-stone-500"}`}>
            {entry.next_due_date && timeSummary
              ? timeSummary.isOverdue
                ? `Overdue by ${Math.abs(timeSummary.nextDueIn ?? 0)} days`
                : timeSummary.nextDueIn === 0
                  ? "Due today"
                  : `Due in ${timeSummary.nextDueIn} days`
              : "No due date"}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Time summary</p>
          <p className="mt-2 text-lg font-semibold">{timeSummary?.daysPassed ?? 0} days</p>
          <p className="mt-1 text-sm text-stone-500">
            {timeSummary?.weeksPassed ?? 0} weeks / {timeSummary?.monthsPassed ?? 0} months
          </p>
        </div>
      </div>

      {entry.repeat_interval_days ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-sm">
          Repeats every <span className="font-semibold text-stone-900">{entry.repeat_interval_days}</span> days from the logged date.
        </div>
      ) : null}

      {entry.category === "purchase" && entry.price !== null ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-500">Total spend</p>
          <p className="mt-2 text-2xl font-semibold">${totalSpend?.toFixed(2)}</p>
          <p className="mt-1 text-sm text-amber-700">
            Based on {history.length + 1} logged purchase(s).
          </p>
        </div>
      ) : null}

      {entry.notes ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Notes</p>
          <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{entry.notes}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">History</h3>
            <p className="text-sm text-stone-500">Keeping {historyMonths} months of logs.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={logDate}
              onChange={(event) => setLogDate(event.target.value)}
              className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700"
              aria-label="Log date"
            />
            <Button onClick={handleLogAgain}>Log Again</Button>
          </div>
        </div>
        {logError ? <p className="mt-3 text-sm text-rose-600">{logError}</p> : null}

        <div className="mt-4 grid gap-3">
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">
              No history yet. Log again to add a record.
            </div>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-stone-700">
                    {format(parseISO(record.logged_date), "PPP")}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatDistanceToNowStrict(parseISO(record.logged_date), { addSuffix: true })}
                  </p>
                </div>
                {record.notes ? <p className="text-xs text-stone-500">{record.notes}</p> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
