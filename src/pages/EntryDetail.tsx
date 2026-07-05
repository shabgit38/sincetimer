import { addDays, differenceInCalendarDays, format, isAfter, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { getBillingCycle, getNextSubscriptionRenewalIso } from "@/lib/subscriptions";
import { computeTimeSummary, formatYearMonthDayDuration, formatYearMonthDaySpan } from "@/lib/timeUtils";
import {
  deleteEntry,
  deleteHistory,
  getEntryById,
  getHistoryForEntry,
  getHistoryMonths,
  logEntryAgain,
  updateEntry,
  updateHistory,
} from "@/lib/db";
import type { Entry, HistoryItem } from "@/types/entry";

function getNextDueDateForLog(entry: Entry, loggedAt: Date) {
  if (normalizeCategory(entry.category) === "subscription") {
    return getNextSubscriptionRenewalIso(
      entry.entry_date,
      getBillingCycle(entry.metadata.billing_cycle),
      loggedAt,
      { afterFromDate: true }
    ) ?? entry.next_due_date;
  }
  if (!entry.repeat_interval_days) return null;
  return addDays(loggedAt, entry.repeat_interval_days).toISOString();
}

function normalizeCategory(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
}

function formatRepeatUnit(value: unknown) {
  return value === "weeks" || value === "months" ? value : "days";
}

function getNumberMetadata(metadata: Record<string, unknown>, key: string) {
  return typeof metadata[key] === "number" ? metadata[key] : null;
}

function getStringMetadata(metadata: Record<string, unknown>, key: string) {
  return typeof metadata[key] === "string" ? metadata[key] : "";
}

function getBooleanMetadata(metadata: Record<string, unknown>, key: string) {
  return metadata[key] === true;
}

function getTags(metadata: Record<string, unknown>) {
  return Array.isArray(metadata.tags)
    ? metadata.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
}

function formatGoalStatus(value: string) {
  if (value === "in_progress") return "In progress";
  if (value === "paused") return "Paused";
  if (value === "completed") return "Completed";
  return "Not started";
}

function formatBillingCycle(value: string) {
  if (value === "weekly") return "Weekly";
  if (value === "quarterly") return "Quarterly";
  if (value === "yearly") return "Yearly";
  if (value === "custom") return "Custom";
  return "Monthly";
}

function formatWarrantyRemaining(warrantyDateIso: string | null) {
  if (!warrantyDateIso) return "Not set";
  const warrantyDate = parseISO(warrantyDateIso);
  const days = differenceInCalendarDays(warrantyDate, new Date());
  if (days < 0) {
    return `Expired ${formatYearMonthDayDuration(warrantyDate).replace(/ ago$/, "")} ago`;
  }
  if (days === 0) return "Ends today";
  return `${formatYearMonthDaySpan(new Date(), warrantyDate)} remaining`;
}

function formatRoutineCadence(entry: Entry) {
  const repeatEvery = getNumberMetadata(entry.metadata, "repeat_every") ?? entry.repeat_interval_days;
  if (!repeatEvery) return "Not set";
  return `${repeatEvery} ${formatRepeatUnit(entry.metadata.repeat_unit)}`;
}

function getLatestEventDate(entry: Entry, history: HistoryItem[]) {
  return history.reduce((latest, record) => {
    const loggedDate = parseISO(record.logged_date);
    return isAfter(loggedDate, latest) ? loggedDate : latest;
  }, parseISO(entry.entry_date));
}

function getDateKey(date: Date | string) {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return parsed.toISOString().slice(0, 10);
}

function getSubscriptionCompletedCount(entry: Entry, history: HistoryItem[]) {
  const loggedDays = new Set<string>([getDateKey(entry.entry_date)]);
  history.forEach((record) => loggedDays.add(getDateKey(record.logged_date)));
  return loggedDays.size;
}

function getCompletedCount(entryDate: Date | string, history: HistoryItem[]) {
  const loggedDays = new Set<string>([getDateKey(entryDate)]);
  history.forEach((record) => loggedDays.add(getDateKey(record.logged_date)));
  return loggedDays.size;
}

function getRoutineSummary(entry: Entry, history: HistoryItem[]) {
  const lastDone = getLatestEventDate(entry, history);
  const nextDue = entry.repeat_interval_days ? addDays(lastDone, entry.repeat_interval_days) : null;
  const now = new Date();
  const nextDueIn = nextDue ? differenceInCalendarDays(nextDue, now) : null;
  const isOverdue = nextDueIn !== null && nextDueIn < 0;

  return {
    lastDone,
    nextDue,
    daysPassed: differenceInCalendarDays(now, lastDone),
    nextDueIn,
    isOverdue,
    overdueDays: isOverdue ? Math.abs(nextDueIn) : 0,
  };
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
  const [logPrice, setLogPrice] = useState("");
  const [logError, setLogError] = useState<string | null>(null);
  const [logCompleted, setLogCompleted] = useState(false);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editHistoryDate, setEditHistoryDate] = useState("");
  const [editHistoryNotes, setEditHistoryNotes] = useState("");
  const [editHistoryPrice, setEditHistoryPrice] = useState("");
  const [historySavingId, setHistorySavingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (entry && normalizeCategory(entry.category) === "subscription" && entry.price !== null && !logPrice) {
      setLogPrice(String(entry.price));
    }
  }, [entry, logPrice]);

  const timeSummary = useMemo(() => {
    if (!entry) return null;
    return computeTimeSummary(entry.entry_date, entry.next_due_date);
  }, [entry]);

  const routineSummary = useMemo(() => {
    if (!entry || normalizeCategory(entry.category) !== "routine") return null;
    return getRoutineSummary(entry, history);
  }, [entry, history]);

  const totalSpend = useMemo(() => {
    if (!entry || normalizeCategory(entry.category) !== "purchase" || entry.price === null) return null;
    const count = 1 + history.length;
    return Number(entry.price) * count;
  }, [entry, history.length]);

  const historyEvents = useMemo(() => {
    if (!entry) return [];
    const currentTime = new Date(entry.entry_date).getTime();
    const hasCurrentHistoryRecord = history.some(
      (record) => new Date(record.logged_date).getTime() === currentTime
    );
    const loggedEvents = history.map((record) => {
      const isCurrent = new Date(record.logged_date).getTime() === currentTime;
      return {
        id: record.id,
        historyId: record.id,
        loggedDate: record.logged_date,
        label: record.notes || entry.title,
        notes: record.notes,
        price: record.price,
        currency: record.currency,
        isCurrent,
      };
    });

    const events = hasCurrentHistoryRecord
      ? loggedEvents
      : [
          {
            id: `current-${entry.id}`,
            historyId: null,
            loggedDate: entry.entry_date,
            label: entry.title,
            notes: "",
            price: entry.price,
            currency: typeof entry.metadata.currency === "string" ? entry.metadata.currency : null,
            isCurrent: true,
          },
          ...loggedEvents,
        ];

    return events.sort((a, b) => new Date(b.loggedDate).getTime() - new Date(a.loggedDate).getTime());
  }, [entry, history]);

  const handleLogAgain = async () => {
    if (!entry || !entryId) return;
    setLogError(null);
    if (!logDate) {
      setLogError("Choose a log date first.");
      return;
    }
    const isSubscriptionEntry = normalizeCategory(entry.category) === "subscription";
    const parsedLogPrice = logPrice.trim() ? Number(logPrice) : entry.price;
    if (isSubscriptionEntry && (parsedLogPrice === null || !Number.isFinite(parsedLogPrice) || parsedLogPrice < 0)) {
      setLogError("Enter a valid subscription price.");
      return;
    }

    try {
      const loggedAt = new Date(logDate);
      await logEntryAgain(
        entry,
        loggedAt,
        isSubscriptionEntry
          ? {
              price: parsedLogPrice,
              currency: typeof entry.metadata.currency === "string" ? entry.metadata.currency : null,
            }
          : {}
      );
      const [updated, historyRecords] = await Promise.all([
        getEntryById(entryId),
        getHistoryForEntry(entryId),
      ]);
      setEntry(updated);
      setHistory(historyRecords);
      setLogDate("");
      if (updated && updated.price !== null && normalizeCategory(updated.category) === "subscription") {
        setLogPrice(String(updated.price));
      }
      setLogCompleted(true);
      window.setTimeout(() => setLogCompleted(false), 1200);
    } catch (saveError) {
      console.error(saveError);
      setLogError("Unable to save this log. Please try again.");
    }
  };

  const reloadEntryAndHistory = async () => {
    if (!entryId) return;
    const [updated, historyRecords] = await Promise.all([
      getEntryById(entryId),
      getHistoryForEntry(entryId),
    ]);
    setEntry(updated);
    setHistory(historyRecords);
  };

  const syncEntryFromHistory = async (historyRecords: HistoryItem[]) => {
    if (!entry || !entryId || historyRecords.length === 0) return;
    const latest = historyRecords.reduce((current, record) => {
      const loggedAt = parseISO(record.logged_date);
      return isAfter(loggedAt, current) ? loggedAt : current;
    }, parseISO(historyRecords[0].logged_date));

    const isSubscriptionEntry = normalizeCategory(entry.category) === "subscription";
    const nextEntryDate = isSubscriptionEntry ? entry.entry_date : latest.toISOString();
    const latestRecord = historyRecords
      .filter((record) => typeof record.price === "number")
      .sort((a, b) => new Date(b.logged_date).getTime() - new Date(a.logged_date).getTime())[0];

    await updateEntry(entryId, {
      ...(isSubscriptionEntry
        ? {
            price: latestRecord?.price ?? entry.price,
          }
        : {
            entry_date: nextEntryDate,
          }),
      next_due_date: getNextDueDateForLog(entry, latest),
      metadata: {
        ...entry.metadata,
        completed_count: isSubscriptionEntry
          ? getSubscriptionCompletedCount(entry, historyRecords)
          : getCompletedCount(nextEntryDate, historyRecords),
      },
    });
  };

  const startEditingHistory = (record: { historyId: string | null; loggedDate: string; notes: string; price: number | null }) => {
    if (!record.historyId) return;
    setEditingHistoryId(record.historyId);
    setEditHistoryDate(parseISO(record.loggedDate).toISOString().slice(0, 10));
    setEditHistoryNotes(record.notes);
    setEditHistoryPrice(record.price !== null ? String(record.price) : "");
  };

  const handleSaveHistory = async (historyId: string) => {
    if (!editHistoryDate) {
      setLogError("Choose a history date first.");
      return;
    }
    setHistorySavingId(historyId);
    setLogError(null);
    try {
      const isSubscriptionEntry = entry ? normalizeCategory(entry.category) === "subscription" : false;
      const parsedEditPrice = editHistoryPrice.trim() ? Number(editHistoryPrice) : null;
      if (isSubscriptionEntry && (parsedEditPrice === null || !Number.isFinite(parsedEditPrice) || parsedEditPrice < 0)) {
        setLogError("Enter a valid subscription price.");
        setHistorySavingId(null);
        return;
      }
      await updateHistory(historyId, {
        logged_date: new Date(editHistoryDate).toISOString(),
        notes: editHistoryNotes.trim(),
        ...(isSubscriptionEntry
          ? {
              price: parsedEditPrice,
              currency: typeof entry?.metadata.currency === "string" ? entry.metadata.currency : null,
            }
          : {}),
      });
      const historyRecords = entryId ? await getHistoryForEntry(entryId) : [];
      await syncEntryFromHistory(historyRecords);
      await reloadEntryAndHistory();
      setEditingHistoryId(null);
    } catch (saveError) {
      console.error(saveError);
      setLogError("Unable to update this history record.");
    } finally {
      setHistorySavingId(null);
    }
  };

  const handleDeleteHistory = async (historyId: string) => {
    const confirmed = window.confirm("Delete this history record? This cannot be undone.");
    if (!confirmed) return;
    setHistorySavingId(historyId);
    setLogError(null);
    try {
      await deleteHistory(historyId);
      const historyRecords = entryId ? await getHistoryForEntry(entryId) : [];
      if (historyRecords.length > 0) {
        await syncEntryFromHistory(historyRecords);
      } else if (entry && entryId) {
        await updateEntry(entryId, {
          metadata: {
            ...entry.metadata,
            completed_count: 1,
          },
        });
      }
      await reloadEntryAndHistory();
    } catch (saveError) {
      console.error(saveError);
      setLogError("Unable to delete this history record.");
    } finally {
      setHistorySavingId(null);
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

  const normalizedCategory = normalizeCategory(entry.category);
  const isGoal = normalizedCategory === "goal";
  const isRoutine = normalizedCategory === "routine";
  const isSubscription = normalizedCategory === "subscription";
  const isPurchase = normalizedCategory === "purchase";
  const isHealthRecord = normalizedCategory === "health record";
  const goalProgress = isGoal ? getNumberMetadata(entry.metadata, "progress_percent") : null;
  const goalStatus = isGoal ? getStringMetadata(entry.metadata, "goal_status") : "";
  const goalMilestones = isGoal
    ? getStringMetadata(entry.metadata, "milestones")
        .split(/\r?\n/)
        .map((milestone) => milestone.trim())
        .filter(Boolean)
    : [];
  const billingCycle = isSubscription ? getStringMetadata(entry.metadata, "billing_cycle") : "";
  const autoRenew = isSubscription ? getBooleanMetadata(entry.metadata, "auto_renew") : false;
  const reminderBefore = getNumberMetadata(entry.metadata, "reminder_before_days");
  const seller = isPurchase ? getStringMetadata(entry.metadata, "seller") : "";
  const invoiceImage = isPurchase ? getStringMetadata(entry.metadata, "invoice_image") : "";
  const warrantyEnds = isPurchase ? entry.next_due_date ?? (getStringMetadata(entry.metadata, "warranty_ends") || null) : null;
  const doctor = isHealthRecord ? getStringMetadata(entry.metadata, "doctor") : "";
  const hospital = isHealthRecord ? getStringMetadata(entry.metadata, "hospital") : "";
  const tags = getTags(entry.metadata);
  const isFavorite = getBooleanMetadata(entry.metadata, "favorite");
  const isArchived = getBooleanMetadata(entry.metadata, "archived");
  const completedCount = getNumberMetadata(entry.metadata, "completed_count") ?? 0;
  const attachmentPhoto = getStringMetadata(entry.metadata, "attachment_photo");
  const attachmentPdf = getStringMetadata(entry.metadata, "attachment_pdf");
  const attachmentUrl = getStringMetadata(entry.metadata, "attachment_url");
  const attachmentNotes = getStringMetadata(entry.metadata, "attachment_notes");
  const hasAttachments = Boolean(attachmentPhoto || attachmentPdf || attachmentUrl || attachmentNotes);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{entry.title}</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-700 dark:text-stone-200">
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

      <div className={`grid gap-4 rounded-2xl ${logCompleted ? "animate-log-complete" : ""} md:grid-cols-3`}>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            {isGoal || isSubscription ? "Start date" : isPurchase ? "Purchase date" : isRoutine || isHealthRecord ? "Last done" : "Last logged"}
          </p>
          <p className="mt-2 text-lg font-semibold dark:text-stone-50">
            {isRoutine && routineSummary ? format(routineSummary.lastDone, "PPP") : format(parseISO(entry.entry_date), "PPP")}
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {isRoutine && routineSummary
              ? formatYearMonthDayDuration(routineSummary.lastDone)
              : formatYearMonthDayDuration(entry.entry_date)}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            {isSubscription ? "Renewal date" : isPurchase ? "Warranty ends" : isGoal ? "Target date" : "Next due"}
          </p>
          <p className="mt-2 text-lg font-semibold dark:text-stone-50">
            {isGoal || isSubscription || isPurchase
              ? entry.next_due_date
                ? format(parseISO(entry.next_due_date), "PPP")
                : "Not set"
              : isRoutine && routineSummary
              ? routineSummary.nextDue
                ? format(routineSummary.nextDue, "PPP")
                : "Not set"
              : entry.next_due_date ? format(parseISO(entry.next_due_date), "PPP") : "Not set"}
          </p>
          <p className={`mt-1 text-sm ${timeSummary?.isOverdue ? "text-rose-600 dark:text-rose-300" : "text-stone-500 dark:text-stone-400"}`}>
            {isGoal
              ? entry.next_due_date && timeSummary
                ? timeSummary.isOverdue
                  ? `Target passed by ${Math.abs(timeSummary.nextDueIn ?? 0)} days`
                  : timeSummary.nextDueIn === 0
                  ? "Target is today"
                  : `${timeSummary.nextDueIn} days to target`
                : "No target date"
              : isSubscription
                ? entry.next_due_date && timeSummary
                  ? timeSummary.isOverdue
                    ? `Renewal passed by ${Math.abs(timeSummary.nextDueIn ?? 0)} days`
                    : timeSummary.nextDueIn === 0
                    ? "Renews today"
                    : `Renews in ${timeSummary.nextDueIn} days`
                  : "No renewal date"
              : isPurchase
                ? warrantyEnds
                  ? formatWarrantyRemaining(warrantyEnds)
                  : "No warranty date"
              : isRoutine && routineSummary
              ? routineSummary.nextDue
                ? routineSummary.isOverdue
                  ? `Overdue by ${routineSummary.overdueDays} days`
                  : routineSummary.nextDueIn === 0
                    ? "Due today"
                    : `Due in ${routineSummary.nextDueIn} days`
                : "No due date"
              : entry.next_due_date && timeSummary
                ? timeSummary.isOverdue
                  ? `Overdue by ${Math.abs(timeSummary.nextDueIn ?? 0)} days`
                  : timeSummary.nextDueIn === 0
                  ? "Due today"
                  : `Due in ${timeSummary.nextDueIn} days`
                : "No due date"}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            {isGoal || isSubscription ? "Time since start" : isPurchase ? "Days owned" : isRoutine || isHealthRecord ? "Time since" : "Time summary"}
          </p>
          <p className="mt-2 text-lg font-semibold dark:text-stone-50">
            {isRoutine && routineSummary
              ? formatYearMonthDayDuration(routineSummary.lastDone).replace(/ ago$/, "")
              : formatYearMonthDayDuration(entry.entry_date).replace(/ ago$/, "")}
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {isGoal || isSubscription ? "since start" : isPurchase ? "since purchase" : isHealthRecord || isRoutine ? "since last done" : "since last logged"}
          </p>
        </div>
      </div>

      {entry.repeat_interval_days && !isRoutine ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-sm">
          Repeats every <span className="font-semibold text-stone-900">{entry.repeat_interval_days}</span> days from the logged date.
        </div>
      ) : null}

      {isRoutine ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Routine settings</p>
          <div className="mt-4 grid gap-4 text-sm text-stone-600 md:grid-cols-3">
            <div>
              <p className="text-stone-400">Repeat every</p>
              <p className="mt-1 font-semibold text-stone-900">{formatRoutineCadence(entry)}</p>
            </div>
            <div>
              <p className="text-stone-400">Reminder before</p>
              <p className="mt-1 font-semibold text-stone-900">
                {typeof entry.metadata.reminder_before_days === "number"
                  ? `${entry.metadata.reminder_before_days} days`
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-stone-400">Overdue days</p>
              <p className={`mt-1 font-semibold ${routineSummary?.isOverdue ? "text-rose-600" : "text-stone-900"}`}>
                {routineSummary?.overdueDays ?? 0}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isGoal ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Goal details</p>
          <div className="mt-4 grid gap-4 text-sm text-stone-600 md:grid-cols-3">
            <div>
              <p className="text-stone-400">Status</p>
              <p className="mt-1 font-semibold text-stone-900">{formatGoalStatus(goalStatus)}</p>
            </div>
            <div>
              <p className="text-stone-400">Progress</p>
              <p className="mt-1 font-semibold text-stone-900">{goalProgress ?? 0}%</p>
            </div>
            <div>
              <p className="text-stone-400">Target date</p>
              <p className="mt-1 font-semibold text-stone-900">
                {entry.next_due_date ? format(parseISO(entry.next_due_date), "PPP") : "Not set"}
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-stone-900 transition-all"
              style={{ width: `${Math.min(Math.max(goalProgress ?? 0, 0), 100)}%` }}
            />
          </div>
          {goalMilestones.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-stone-700">Milestones</p>
              <ul className="mt-3 grid gap-2">
                {goalMilestones.map((milestone, index) => (
                  <li
                    key={`${milestone}-${index}`}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600"
                  >
                    {milestone}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {isSubscription ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Subscription details</p>
          <div className="mt-4 grid gap-4 text-sm text-stone-600 md:grid-cols-4">
            <div>
              <p className="text-stone-400">Billing cycle</p>
              <p className="mt-1 font-semibold text-stone-900">{formatBillingCycle(billingCycle)}</p>
            </div>
            <div>
              <p className="text-stone-400">Cost</p>
              <p className="mt-1 font-semibold text-stone-900">
                {entry.price !== null ? formatMoney(entry.price, entry.metadata.currency) : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-stone-400">Auto renew</p>
              <p className="mt-1 font-semibold text-stone-900">{autoRenew ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-stone-400">Reminder before renewal (days)</p>
              <p className="mt-1 font-semibold text-stone-900">
                {reminderBefore !== null ? `${reminderBefore} days` : "Not set"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isPurchase ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Purchase details</p>
          <div className="mt-4 grid gap-4 text-sm text-stone-600 md:grid-cols-3">
            <div>
              <p className="text-stone-400">Cost</p>
              <p className="mt-1 font-semibold text-stone-900">
                {entry.price !== null ? formatMoney(entry.price, entry.metadata.currency) : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-stone-400">Seller</p>
              <p className="mt-1 font-semibold text-stone-900">{seller || "Not set"}</p>
            </div>
            <div>
              <p className="text-stone-400">Warranty remaining</p>
              <p className="mt-1 font-semibold text-stone-900">{formatWarrantyRemaining(warrantyEnds)}</p>
            </div>
          </div>
          {invoiceImage ? (
            <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
              <p className="text-stone-400">Invoice image</p>
              <a className="mt-1 inline-flex font-medium text-stone-900 underline" href={invoiceImage} target="_blank" rel="noreferrer">
                Open invoice reference
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {isHealthRecord ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Health record details</p>
          <div className="mt-4 grid gap-4 text-sm text-stone-600 md:grid-cols-3">
            <div>
              <p className="text-stone-400">Doctor</p>
              <p className="mt-1 font-semibold text-stone-900">{doctor || "Not set"}</p>
            </div>
            <div>
              <p className="text-stone-400">Hospital</p>
              <p className="mt-1 font-semibold text-stone-900">{hospital || "Not set"}</p>
            </div>
            <div>
              <p className="text-stone-400">Repeat interval</p>
              <p className="mt-1 font-semibold text-stone-900">
                {entry.repeat_interval_days ? `${entry.repeat_interval_days} days` : "Not set"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isPurchase && entry.price !== null ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-500">Total spend</p>
          <p className="mt-2 text-2xl font-semibold">
            {totalSpend !== null ? formatMoney(totalSpend, entry.metadata.currency) : null}
          </p>
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

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Universal fields</p>
        <div className="mt-4 grid gap-4 text-sm text-stone-600 md:grid-cols-3">
          <div>
            <p className="text-stone-400">Completed count</p>
            <p className="mt-1 font-semibold text-stone-900">{completedCount}</p>
          </div>
          <div>
            <p className="text-stone-400">Favorite</p>
            <p className="mt-1 font-semibold text-stone-900">{isFavorite ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-stone-400">Archived</p>
            <p className="mt-1 font-semibold text-stone-900">{isArchived ? "Yes" : "No"}</p>
          </div>
        </div>
        {tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {hasAttachments ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Smart attachments</p>
          <div className="mt-4 grid gap-3 text-sm">
            {attachmentPhoto ? (
              <a className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-900 underline" href={attachmentPhoto} target="_blank" rel="noreferrer">
                Open photo reference
              </a>
            ) : null}
            {attachmentPdf ? (
              <a className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-900 underline" href={attachmentPdf} target="_blank" rel="noreferrer">
                Open PDF reference
              </a>
            ) : null}
            {attachmentUrl ? (
              <a className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-900 underline" href={attachmentUrl} target="_blank" rel="noreferrer">
                Open URL
              </a>
            ) : null}
            {attachmentNotes ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-400">Attachment notes</p>
                <p className="mt-1 whitespace-pre-line text-stone-600">{attachmentNotes}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">History</h3>
            <p className="text-sm text-stone-500">
              {historyEvents.length} event{historyEvents.length === 1 ? "" : "s"} kept for {historyMonths} months.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={logDate}
              onChange={(event) => setLogDate(event.target.value)}
              className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700"
              aria-label="Log date"
            />
            {isSubscription ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={logPrice}
                onChange={(event) => setLogPrice(event.target.value)}
                className="h-10 w-28 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700"
                aria-label="Subscription price"
                placeholder="Price"
              />
            ) : null}
            <Button onClick={handleLogAgain}>Log Again</Button>
          </div>
        </div>
        {logError ? <p className="mt-3 text-sm text-rose-600">{logError}</p> : null}

        <div className="mt-4 grid gap-3">
          {historyEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">
              No history yet. Log again to add a record.
            </div>
          ) : (
            historyEvents.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
              >
                {editingHistoryId === record.historyId && record.historyId ? (
                  <div className={`grid flex-1 gap-2 md:items-center ${isSubscription ? "md:grid-cols-[12rem_8rem_minmax(0,1fr)_auto]" : "md:grid-cols-[12rem_minmax(0,1fr)_auto]"}`}>
                    <input
                      type="date"
                      value={editHistoryDate}
                      onChange={(event) => setEditHistoryDate(event.target.value)}
                      className="h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700"
                    />
                    {isSubscription ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editHistoryPrice}
                        onChange={(event) => setEditHistoryPrice(event.target.value)}
                        className="h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700"
                        placeholder="Price"
                      />
                    ) : null}
                    <input
                      value={editHistoryNotes}
                      onChange={(event) => setEditHistoryNotes(event.target.value)}
                      className="h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700"
                      placeholder="Notes"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={historySavingId === record.historyId}
                        onClick={() => void handleSaveHistory(record.historyId!)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={historySavingId === record.historyId}
                        onClick={() => setEditingHistoryId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium text-stone-700">
                        {formatYearMonthDayDuration(record.loggedDate)}
                        {record.isCurrent ? <span className="ml-2 text-xs font-normal text-emerald-700">Current</span> : null}
                      </p>
                      <p className="text-xs text-stone-500">
                        {record.label}
                      </p>
                      {isSubscription ? (
                        <p className="mt-1 text-xs font-medium text-stone-700">
                          {record.price !== null ? formatMoney(record.price, record.currency ?? entry.metadata.currency) : "Price not recorded"}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-stone-500">{format(parseISO(record.loggedDate), "PPP p")}</p>
                      {record.historyId ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={historySavingId === record.historyId}
                            onClick={() => startEditingHistory(record)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={historySavingId === record.historyId}
                            onClick={() => void handleDeleteHistory(record.historyId!)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
