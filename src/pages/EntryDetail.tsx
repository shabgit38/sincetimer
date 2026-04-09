import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
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

export default function EntryDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const entryId = params.id ? Number(params.id) : null;

  const [entry, setEntry] = useState<Entry | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyMonths, setHistoryMonths] = useState(6);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!entryId || Number.isNaN(entryId)) return;
      setLoading(true);
      const [entryRecord, historyRecords, months] = await Promise.all([
        getEntryById(entryId),
        getHistoryForEntry(entryId),
        getHistoryMonths(),
      ]);
      setEntry((entryRecord as Entry | undefined) ?? null);
      setHistory(historyRecords as HistoryItem[]);
      setHistoryMonths(months);
      setLoading(false);
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
    return entry.price * count;
  }, [entry, history.length]);

  const handleLogAgain = async () => {
    if (!entry || !entryId) return;
    await insertHistory({
      entry_id: entryId,
      logged_date: entry.entry_date,
      notes: "",
    });
    await updateEntry(entryId, { entry_date: new Date().toISOString() });
    const updated = await getEntryById(entryId);
    const historyRecords = await getHistoryForEntry(entryId);
    setEntry((updated as Entry | undefined) ?? null);
    setHistory(historyRecords as HistoryItem[]);
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
      <section className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-stone-500">Loading entry...</p>
      </section>
    );
  }

  if (!entry) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Entry not found</h2>
        <p className="mt-2 text-sm text-stone-500">This entry may have been deleted.</p>
        <Button className="mt-4" asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{entry.title}</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{entry.category}</p>
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
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Last logged</p>
          <p className="mt-2 text-lg font-semibold">
            {format(parseISO(entry.entry_date), "PPP")}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {formatDistanceToNowStrict(parseISO(entry.entry_date), { addSuffix: true })}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Next due</p>
          <p className="mt-2 text-lg font-semibold">
            {entry.next_due_date ? format(parseISO(entry.next_due_date), "PPP") : "Not set"}
          </p>
          <p
            className={`mt-1 text-sm ${
              timeSummary?.isOverdue ? "text-rose-600" : "text-stone-500"
            }`}
          >
            {entry.next_due_date && timeSummary
              ? timeSummary.isOverdue
                ? `Overdue by ${Math.abs(timeSummary.nextDueIn ?? 0)} days`
                : timeSummary.nextDueIn === 0
                  ? "Due today"
                  : `Due in ${timeSummary.nextDueIn} days`
              : "No due date"}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Time summary</p>
          <p className="mt-2 text-lg font-semibold">{timeSummary?.daysPassed ?? 0} days</p>
          <p className="mt-1 text-sm text-stone-500">
            {timeSummary?.weeksPassed ?? 0} weeks · {timeSummary?.monthsPassed ?? 0} months
          </p>
        </div>
      </div>

      {entry.category === "purchase" && entry.price !== null ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-500">Total spend</p>
          <p className="mt-2 text-2xl font-semibold">${totalSpend?.toFixed(2)}</p>
          <p className="mt-1 text-sm text-amber-700">
            Based on {history.length + 1} logged purchase(s).
          </p>
        </div>
      ) : null}

      {entry.notes ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Notes</p>
          <p className="mt-2 text-sm text-stone-600 whitespace-pre-line">{entry.notes}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">History</h3>
            <p className="text-sm text-stone-500">Keeping {historyMonths} months of logs.</p>
          </div>
          <Button onClick={handleLogAgain}>Log Again</Button>
        </div>

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
