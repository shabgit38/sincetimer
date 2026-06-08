import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { currencyOptions, getCurrencyCode, type CurrencyCode } from "@/lib/currency";
import {
  getAllEntries,
  getAreas,
  getCategories,
  getEntryById,
  getHistoryForEntry,
  insertEntry,
  insertHistory,
  updateEntry,
} from "@/lib/db";
import { computeTimeSummary, formatYearMonthDayDuration } from "@/lib/timeUtils";
import type { Entry, EntryOption, HistoryItem } from "@/types/entry";

type RepeatUnit = "days" | "weeks" | "months";
type GoalStatus = "not_started" | "in_progress" | "paused" | "completed";
type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

function formatOptionLabel(value: string) {
  return value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function normalizeCategory(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
}

function getRepeatIntervalDays(value: number, unit: RepeatUnit) {
  if (unit === "weeks") return value * 7;
  if (unit === "months") return value * 30;
  return value;
}

function getLatestLogDate(entry: Entry, history: HistoryItem[]) {
  return history.reduce((latest, record) => {
    const loggedDate = new Date(record.logged_date);
    return loggedDate > latest ? loggedDate : latest;
  }, new Date(entry.entry_date));
}

function getNextDueDateForLog(entry: Entry, loggedAt: Date) {
  if (!entry.repeat_interval_days) return entry.next_due_date;
  return addDays(loggedAt, entry.repeat_interval_days).toISOString();
}

export default function AddEntry() {
  const navigate = useNavigate();
  const params = useParams();
  const entryId = params.id ?? null;
  const isEditing = Boolean(entryId);

  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [areas, setAreas] = useState<EntryOption[]>([]);
  const [categories, setCategories] = useState<EntryOption[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nextDueDate, setNextDueDate] = useState<string>("");
  const [repeatIntervalDays, setRepeatIntervalDays] = useState("");
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>("days");
  const [reminderBeforeDays, setReminderBeforeDays] = useState("");
  const [goalStatus, setGoalStatus] = useState<GoalStatus>("not_started");
  const [goalProgress, setGoalProgress] = useState("");
  const [goalMilestones, setGoalMilestones] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [autoRenew, setAutoRenew] = useState(false);
  const [seller, setSeller] = useState("");
  const [invoiceImage, setInvoiceImage] = useState("");
  const [doctor, setDoctor] = useState("");
  const [hospital, setHospital] = useState("");
  const [tags, setTags] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [archived, setArchived] = useState(false);
  const [attachmentPhoto, setAttachmentPhoto] = useState("");
  const [attachmentPdf, setAttachmentPdf] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentNotes, setAttachmentNotes] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [notes, setNotes] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidePanelError, setSidePanelError] = useState<string | null>(null);
  const [logDates, setLogDates] = useState<Record<string, string>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [completedLogId, setCompletedLogId] = useState<string | null>(null);

  const normalizedCategory = normalizeCategory(category);
  const isGoal = normalizedCategory === "goal";
  const isRoutine = normalizedCategory === "routine";
  const isSubscription = normalizedCategory === "subscription";
  const isPurchase = normalizedCategory === "purchase";
  const isHealthRecord = normalizedCategory === "health record";
  const hasRepeatInterval = isRoutine || isHealthRecord;
  const hasCost = isPurchase || isSubscription;
  const titleLabel = isGoal
    ? "Goal Name"
    : isSubscription
      ? "Service Name"
      : isHealthRecord
        ? "Event Type"
        : isPurchase
          ? "Item Name"
          : "Title";
  const titlePlaceholder = isGoal
    ? "e.g. Learn Spanish"
    : isSubscription
      ? "e.g. ChatGPT Plus"
      : isHealthRecord
        ? "e.g. Blood test"
        : isPurchase
          ? "e.g. Washing machine"
          : "e.g. Replace air filter";
  const entryDateLabel = isGoal
    ? "Start Date"
    : isRoutine
      ? "Last Done Date"
      : isSubscription
        ? "Start Date"
        : isPurchase
          ? "Purchase Date"
          : isHealthRecord
            ? "Last Done"
            : "Entry Date";
  const nextDueLabel = isGoal
    ? "Target Date"
    : isSubscription
      ? "Renewal Date"
      : isPurchase
        ? "Warranty Ends"
        : "Next Due Date";

  useEffect(() => {
    const load = async () => {
      try {
        const [areaOptions, categoryOptions, entryRecords, entry] = await Promise.all([
          getAreas(),
          getCategories(),
          getAllEntries(),
          isEditing && entryId !== null ? getEntryById(entryId) : Promise.resolve(null),
        ]);

        setAreas(areaOptions);
        setCategories(categoryOptions);
        setEntries(entryRecords);

        if (entry) {
          setTitle(entry.title);
          setArea(entry.area);
          setCategory(entry.category);
          setEntryDate(entry.entry_date.slice(0, 10));
          setNextDueDate(entry.next_due_date ? entry.next_due_date.slice(0, 10) : "");
          setRepeatIntervalDays(entry.repeat_interval_days ? String(entry.repeat_interval_days) : "");
          setRepeatUnit(
            entry.metadata.repeat_unit === "weeks" || entry.metadata.repeat_unit === "months"
              ? entry.metadata.repeat_unit
              : "days"
          );
          setReminderBeforeDays(
            typeof entry.metadata.reminder_before_days === "number"
              ? String(entry.metadata.reminder_before_days)
              : ""
          );
          setGoalStatus(
            entry.metadata.goal_status === "in_progress" ||
              entry.metadata.goal_status === "paused" ||
              entry.metadata.goal_status === "completed"
              ? entry.metadata.goal_status
              : "not_started"
          );
          setGoalProgress(
            typeof entry.metadata.progress_percent === "number"
              ? String(entry.metadata.progress_percent)
              : ""
          );
          setGoalMilestones(typeof entry.metadata.milestones === "string" ? entry.metadata.milestones : "");
          setBillingCycle(
            entry.metadata.billing_cycle === "weekly" ||
              entry.metadata.billing_cycle === "quarterly" ||
              entry.metadata.billing_cycle === "yearly" ||
              entry.metadata.billing_cycle === "custom"
              ? entry.metadata.billing_cycle
              : "monthly"
          );
          setAutoRenew(entry.metadata.auto_renew === true);
          setSeller(typeof entry.metadata.seller === "string" ? entry.metadata.seller : "");
          setInvoiceImage(typeof entry.metadata.invoice_image === "string" ? entry.metadata.invoice_image : "");
          setDoctor(typeof entry.metadata.doctor === "string" ? entry.metadata.doctor : "");
          setHospital(typeof entry.metadata.hospital === "string" ? entry.metadata.hospital : "");
          setTags(Array.isArray(entry.metadata.tags) ? entry.metadata.tags.filter((tag) => typeof tag === "string").join(", ") : "");
          setFavorite(entry.metadata.favorite === true);
          setArchived(entry.metadata.archived === true);
          setAttachmentPhoto(typeof entry.metadata.attachment_photo === "string" ? entry.metadata.attachment_photo : "");
          setAttachmentPdf(typeof entry.metadata.attachment_pdf === "string" ? entry.metadata.attachment_pdf : "");
          setAttachmentUrl(typeof entry.metadata.attachment_url === "string" ? entry.metadata.attachment_url : "");
          setAttachmentNotes(typeof entry.metadata.attachment_notes === "string" ? entry.metadata.attachment_notes : "");
          setPrice(entry.price !== null ? String(entry.price) : "");
          setCurrency(getCurrencyCode(entry.metadata.currency));
          setNotes(entry.notes ?? "");
          setReminderEnabled(entry.reminder_enabled);
          setReminderTime(entry.reminder_time ?? "09:00");
          return;
        }

        setArea((current) => current || areaOptions[0]?.name || "");
        setCategory((current) => current || categoryOptions[0]?.name || "");
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load entry options.");
      }
    };
    void load();
  }, [entryId, isEditing]);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && entryDate.length > 0 && area.length > 0 && category.length > 0,
    [area, category, title, entryDate]
  );

  useEffect(() => {
    if (!hasRepeatInterval || !repeatIntervalDays.trim() || !entryDate) return;
    const parsed = Number(repeatIntervalDays);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    setNextDueDate(addDays(new Date(entryDate), getRepeatIntervalDays(parsed, repeatUnit)).toISOString().slice(0, 10));
  }, [entryDate, hasRepeatInterval, repeatIntervalDays, repeatUnit]);

  const relatedEntries = useMemo(() => {
    if (!area || !category) return [];
    return entries
      .filter((entry) => entry.area === area && entry.category === category)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [area, category, entries]);

  const scheduleNotification = async () => {
    if (!reminderEnabled || !nextDueDate) return;
    if (!("Notification" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const [hours, minutes] = reminderTime.split(":").map(Number);
    const trigger = new Date(`${nextDueDate}T00:00:00`);
    trigger.setHours(hours ?? 9, minutes ?? 0, 0, 0);
    const delay = trigger.getTime() - Date.now();
    if (delay <= 0) return;

    window.setTimeout(() => {
      new Notification("Since Timer", {
        body: `Time to log: ${title || "entry"}`,
      });
    }, delay);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Please fill in the title, area, category, and entry date.");
      return;
    }

    let priceValue: number | null = null;
    if (hasCost && price.trim()) {
      const parsed = Number(price);
      if (Number.isNaN(parsed)) {
        setError("Cost must be a number.");
        return;
      }
      priceValue = parsed;
    }

    let repeatValue: number | null = null;
    let intervalValue: number | null = null;
    if (hasRepeatInterval && repeatIntervalDays.trim()) {
      const parsed = Number(repeatIntervalDays);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError("Repeat every must be a positive whole number.");
        return;
      }
      repeatValue = parsed;
      intervalValue = getRepeatIntervalDays(parsed, repeatUnit);
    }

    let reminderBeforeValue: number | null = null;
    if (reminderBeforeDays.trim()) {
      const parsed = Number(reminderBeforeDays);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError("Reminder before must be zero or a positive whole number.");
        return;
      }
      reminderBeforeValue = parsed;
    }

    let progressValue: number | null = null;
    if (isGoal && goalProgress.trim()) {
      const parsed = Number(goalProgress);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setError("Progress must be a whole number between 0 and 100.");
        return;
      }
      progressValue = parsed;
    }

    const entryDateIso = new Date(entryDate).toISOString();
    const tagValues = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const nextDueDateIso = intervalValue
      ? addDays(new Date(entryDate), intervalValue).toISOString()
      : nextDueDate
        ? new Date(nextDueDate).toISOString()
        : null;

    setSaving(true);
    const payload = {
      title: title.trim(),
      area,
      category,
      entry_date: entryDateIso,
      next_due_date: nextDueDateIso,
      repeat_interval_days: hasRepeatInterval ? intervalValue : null,
      metadata: {
        repeat_every: hasRepeatInterval ? repeatValue : null,
        repeat_unit: hasRepeatInterval && repeatValue ? repeatUnit : null,
        reminder_before_days: isRoutine || isSubscription ? reminderBeforeValue : null,
        goal_status: isGoal ? goalStatus : null,
        progress_percent: isGoal ? progressValue : null,
        milestones: isGoal && goalMilestones.trim() ? goalMilestones.trim() : null,
        billing_cycle: isSubscription ? billingCycle : null,
        auto_renew: isSubscription ? autoRenew : null,
        seller: isPurchase && seller.trim() ? seller.trim() : null,
        invoice_image: isPurchase && invoiceImage.trim() ? invoiceImage.trim() : null,
        warranty_ends: isPurchase && nextDueDate ? nextDueDate : null,
        doctor: isHealthRecord && doctor.trim() ? doctor.trim() : null,
        hospital: isHealthRecord && hospital.trim() ? hospital.trim() : null,
        completed_count:
          isEditing && entryId
            ? entries.find((entry) => entry.id === entryId)?.metadata.completed_count ?? 0
            : 0,
        tags: tagValues,
        favorite,
        archived,
        attachment_photo: attachmentPhoto.trim() || null,
        attachment_pdf: attachmentPdf.trim() || null,
        attachment_url: attachmentUrl.trim() || null,
        attachment_notes: attachmentNotes.trim() || null,
        currency: hasCost ? currency : null,
      },
      price: hasCost ? priceValue : null,
      notes: notes.trim() ? notes.trim() : null,
      reminder_enabled: reminderEnabled,
      reminder_time: reminderEnabled ? reminderTime : null,
    };

    try {
      if (isEditing && entryId !== null) {
        await updateEntry(entryId, payload);
      } else {
        await insertEntry(payload);
      }
      setEntries(await getAllEntries());
      await scheduleNotification();
      navigate("/");
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to save entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSidePanelLogAgain = async (entry: Entry) => {
    const logDate = logDates[entry.id];
    if (!logDate) {
      setSidePanelError("Choose a log date first.");
      return;
    }

    setSidePanelError(null);
    setLoggingId(entry.id);
    try {
      const loggedAt = new Date(logDate);
      const history = await getHistoryForEntry(entry.id);
      const latestLogDate = getLatestLogDate(entry, history);
      const shouldPromoteLog = loggedAt >= latestLogDate;

      await insertHistory({
        entry_id: entry.id,
        logged_date: loggedAt.toISOString(),
        notes: "",
      });

      await updateEntry(entry.id, {
        ...(shouldPromoteLog
          ? {
              entry_date: loggedAt.toISOString(),
              next_due_date: getNextDueDateForLog(entry, loggedAt),
            }
          : {}),
        metadata: {
          ...entry.metadata,
          completed_count:
            (typeof entry.metadata.completed_count === "number" ? entry.metadata.completed_count : 0) + 1,
        },
      });

      setLogDates((current) => ({ ...current, [entry.id]: "" }));
      setEntries(await getAllEntries());
      setCompletedLogId(entry.id);
      window.setTimeout(() => setCompletedLogId(null), 1200);
      if (entry.id === entryId) {
        const updated = await getEntryById(entry.id);
        if (updated) {
          setEntryDate(updated.entry_date.slice(0, 10));
          setNextDueDate(updated.next_due_date ? updated.next_due_date.slice(0, 10) : "");
        }
      }
    } catch (logError) {
      console.error(logError);
      setSidePanelError("Unable to log this entry.");
    } finally {
      setLoggingId(null);
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{isEditing ? "Edit Entry" : "Add Entry"}</h2>
            <p className="text-sm text-stone-500">
              Capture what happened and the next action date.
            </p>
          </div>
          <Button variant="outline" type="button" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>

        <form className="mt-6 grid gap-6" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-stone-700" htmlFor="title">
              {titleLabel}
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700 focus:border-stone-400 focus:outline-none"
              placeholder={titlePlaceholder}
            />
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Area</span>
            <div className="flex flex-wrap gap-2">
              {areas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setArea(item.name)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    area === item.name
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 text-stone-600 hover:border-stone-400"
                  }`}
                >
                  {formatOptionLabel(item.name)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Category</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.name)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    category === item.name
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 text-stone-600 hover:border-stone-400"
                  }`}
                >
                  {formatOptionLabel(item.name)}
                </button>
              ))}
            </div>
          </div>

          <div className={`grid gap-4 ${isRoutine ? "md:grid-cols-5" : isGoal || isSubscription || isPurchase ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="entryDate">
                {entryDateLabel}
              </label>
              <input
                id="entryDate"
                type="date"
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
              />
            </div>
            {hasRepeatInterval ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="repeatIntervalDays">
                  {isRoutine ? "Repeat Every" : "Repeat Interval"}
                </label>
                <input
                  id="repeatIntervalDays"
                  type="number"
                  value={repeatIntervalDays}
                  onChange={(event) => setRepeatIntervalDays(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder={isRoutine ? "e.g. 2" : "e.g. 180"}
                  min="1"
                  step="1"
                />
              </div>
            ) : null}
            {isRoutine ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="repeatUnit">
                  Unit
                </label>
                <select
                  id="repeatUnit"
                  value={repeatUnit}
                  onChange={(event) => setRepeatUnit(event.target.value as RepeatUnit)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="nextDueDate">
                {nextDueLabel}
              </label>
              <input
                id="nextDueDate"
                type="date"
                value={nextDueDate}
                onChange={(event) => setNextDueDate(event.target.value)}
                disabled={hasRepeatInterval && Boolean(repeatIntervalDays.trim())}
                className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
              />
            </div>
            {isRoutine || isSubscription ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="reminderBeforeDays">
                  Reminder Before
                </label>
                <input
                  id="reminderBeforeDays"
                  type="number"
                  value={reminderBeforeDays}
                  onChange={(event) => setReminderBeforeDays(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="Days before due"
                  min="0"
                  step="1"
                />
              </div>
            ) : null}
          </div>

          {isGoal ? (
            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-[1fr_160px]">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="goalStatus">
                  Status
                </label>
                <select
                  id="goalStatus"
                  value={goalStatus}
                  onChange={(event) => setGoalStatus(event.target.value as GoalStatus)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="goalProgress">
                  Progress %
                </label>
                <input
                  id="goalProgress"
                  type="number"
                  value={goalProgress}
                  onChange={(event) => setGoalProgress(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="0"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="goalMilestones">
                  Milestones
                </label>
                <textarea
                  id="goalMilestones"
                  value={goalMilestones}
                  onChange={(event) => setGoalMilestones(event.target.value)}
                  className="min-h-[96px] rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
                  placeholder="One milestone per line..."
                />
              </div>
            </div>
          ) : null}

          {isSubscription ? (
            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-[1fr_160px]">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="billingCycle">
                  Billing Cycle
                </label>
                <select
                  id="billingCycle"
                  value={billingCycle}
                  onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                <div className="flex h-full items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-700">Auto Renew</p>
                    <p className="text-xs text-stone-500">Renews without manual action.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={autoRenew}
                      onChange={(event) => setAutoRenew(event.target.checked)}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-stone-200 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-stone-900 peer-checked:after:translate-x-5" />
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {hasCost ? (
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="price">
                  Cost
                </label>
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="currency">
                  Currency
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                >
                  {currencyOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {isPurchase ? (
            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="seller">
                  Seller
                </label>
                <input
                  id="seller"
                  value={seller}
                  onChange={(event) => setSeller(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="e.g. Croma"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="invoiceImage">
                  Invoice Image
                </label>
                <input
                  id="invoiceImage"
                  value={invoiceImage}
                  onChange={(event) => setInvoiceImage(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="Image URL or file reference"
                />
              </div>
            </div>
          ) : null}

          {isHealthRecord ? (
            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="doctor">
                  Doctor
                </label>
                <input
                  id="doctor"
                  value={doctor}
                  onChange={(event) => setDoctor(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="e.g. Dr. Rao"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="hospital">
                  Hospital
                </label>
                <input
                  id="hospital"
                  value={hospital}
                  onChange={(event) => setHospital(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="e.g. Apollo"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div>
              <p className="text-sm font-medium text-stone-700">Universal fields</p>
              <p className="text-xs text-stone-500">Tags and visibility controls apply to every entry.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_160px_160px]">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="tags">
                  Tags
                </label>
                <input
                  id="tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="home, urgent, annual"
                />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                <span className="text-sm font-medium text-stone-700">Favorite</span>
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(event) => setFavorite(event.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                <span className="text-sm font-medium text-stone-700">Archived</span>
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(event) => setArchived(event.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div>
              <p className="text-sm font-medium text-stone-700">Smart attachments</p>
              <p className="text-xs text-stone-500">Attach references for photos, PDFs, URLs, and attachment-specific notes.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="attachmentPhoto">
                  Photo
                </label>
                <input
                  id="attachmentPhoto"
                  value={attachmentPhoto}
                  onChange={(event) => setAttachmentPhoto(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="Photo URL or file reference"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="attachmentPdf">
                  PDF
                </label>
                <input
                  id="attachmentPdf"
                  value={attachmentPdf}
                  onChange={(event) => setAttachmentPdf(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="PDF URL or file reference"
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="attachmentUrl">
                  URL
                </label>
                <input
                  id="attachmentUrl"
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                  placeholder="https://..."
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="attachmentNotes">
                  Attachment Notes
                </label>
                <textarea
                  id="attachmentNotes"
                  value={attachmentNotes}
                  onChange={(event) => setAttachmentNotes(event.target.value)}
                  className="min-h-[84px] rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
                  placeholder="Details about attached references..."
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-stone-700" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-[120px] rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
              placeholder="Optional details..."
            />
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-700">Reminder</p>
                <p className="text-xs text-stone-500">Notification will fire while this tab is open.</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={reminderEnabled}
                  onChange={(event) => setReminderEnabled(event.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-stone-200 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-stone-900 peer-checked:after:translate-x-5" />
              </label>
            </div>
            {reminderEnabled ? (
              <div className="mt-4 grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="reminderTime">
                  Reminder Time
                </label>
                <input
                  id="reminderTime"
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
                />
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Save Entry"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
      <aside className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:self-start">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Same area/category</p>
          <h3 className="mt-2 text-lg font-semibold text-stone-900">Related entries</h3>
          <p className="mt-1 text-sm text-stone-500">Open another card to edit it, or log another occurrence.</p>
        </div>
        {sidePanelError ? <p className="mt-3 text-sm text-rose-600">{sidePanelError}</p> : null}
        <div className="mt-4 grid gap-3">
          {relatedEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-4 text-sm text-stone-500">
              No entries match this area and category yet.
            </div>
          ) : (
            relatedEntries.map((entry) => {
              const summary = computeTimeSummary(entry.entry_date, entry.next_due_date);
              const dueText = entry.next_due_date
                ? summary.isOverdue
                  ? `${Math.abs(summary.nextDueIn ?? 0)} days overdue`
                  : summary.nextDueIn === 0
                    ? "Due today"
                    : `Due in ${summary.nextDueIn} days`
                : "No due date";

              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border p-4 transition ${
                    completedLogId === entry.id ? "animate-log-complete" : ""
                  } ${
                    entry.id === entryId ? "border-stone-900 bg-stone-50" : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <button type="button" className="block w-full text-left" onClick={() => navigate(`/edit/${entry.id}`)}>
                    <p className="font-medium text-stone-900">{entry.title}</p>
                    <p className="mt-1 text-sm text-stone-500">{formatYearMonthDayDuration(entry.entry_date)}</p>
                    <p className={`mt-2 text-sm ${summary.isOverdue ? "text-rose-600" : "text-stone-600"}`}>
                      {dueText}
                    </p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="date"
                      value={logDates[entry.id] ?? ""}
                      onChange={(event) => setLogDates((current) => ({ ...current, [entry.id]: event.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700"
                      aria-label={`Log date for ${entry.title}`}
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleSidePanelLogAgain(entry)}
                      disabled={loggingId === entry.id}
                    >
                      {loggingId === entry.id ? "Logging..." : "Log"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </section>
  );
}
