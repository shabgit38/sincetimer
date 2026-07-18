import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { ChevronDown, Plus, Save as SaveIcon, Trash2, X } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { currencyOptions, getCurrencyCode, type CurrencyCode } from "@/lib/currency";
import {
  getAllEntries,
  getAreas,
  getCategories,
  getEntryById,
  insertEntry,
  logEntryAgain,
  updateEntry,
} from "@/lib/db";
import { generatePlanSessions } from "@/lib/planScheduler";
import { replacePlanSessions, replaceScheduledPlanSessions } from "@/lib/plans";
import { isPlanAreaCategory } from "@/lib/entryClassification";
import { getBillingCycle, getNextSubscriptionRenewalIso } from "@/lib/subscriptions";
import { computeTimeSummary, formatYearMonthDayDuration } from "@/lib/timeUtils";
import { createListItem, getListItems, type ListItem } from "@/lib/listItems";
import type { Entry, EntryOption } from "@/types/entry";
import type { PlanScheduleConfig, PlanScheduleMode, PlanStatus, PlanType } from "@/types/plan";

type RepeatUnit = "days" | "weeks" | "months";
type GoalStatus = "not_started" | "in_progress" | "paused" | "completed";
type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
type ReadingStatus = "to_read" | "reading" | "done";

const weekdayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function formatOptionLabel(value: string) {
  return value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function normalizeCategory(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
}

function getPlanTypeLabel(value: PlanType) {
  if (value === "habit") return "Habit";
  if (value === "practice") return "Practice";
  return "Learning";
}

function getRepeatIntervalDays(value: number, unit: RepeatUnit) {
  if (unit === "weeks") return value * 7;
  if (unit === "months") return value * 30;
  return value;
}

const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-stone-400 bg-white px-4 text-sm text-stone-700 focus:border-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-300 dark:focus:ring-white/10";
const requiredInputClass =
  "border-rose-400 bg-rose-50/60 focus:border-rose-500 focus:ring-rose-100 dark:border-rose-400/70 dark:bg-rose-950/20 dark:focus:border-rose-300 dark:focus:ring-rose-500/20";
const textareaClass =
  "w-full min-w-0 rounded-xl border border-stone-400 bg-white px-4 py-3 text-sm text-stone-700 focus:border-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-300 dark:focus:ring-white/10";
const sectionPanelClass =
  "grid gap-4 rounded-2xl border border-stone-300 bg-stone-50 p-4 dark:border-white/15 dark:bg-white/[0.04]";
const inlinePanelClass =
  "rounded-xl border border-stone-300 bg-white px-4 py-3 dark:border-white/15 dark:bg-white/[0.04]";
const inactivePillClass =
  "border-stone-300 text-stone-900 hover:border-stone-500 hover:bg-stone-50 dark:border-white/20 dark:text-stone-100 dark:hover:border-white/40 dark:hover:bg-white/[0.06]";
const missingRequiredPillClass =
  "border-rose-400 bg-rose-50/60 text-rose-800 dark:border-rose-400/70 dark:bg-rose-950/20 dark:text-rose-100";

function requiredLabel(label: string) {
  return (
    <>
      {label} <span className="text-rose-500 dark:text-rose-300">*</span>
    </>
  );
}

function requiredClass(isMissing: boolean) {
  return isMissing ? requiredInputClass : "";
}

function getPlanScheduleConfig(metadata: Record<string, unknown>): PlanScheduleConfig {
  const rawConfig = metadata.schedule_config;
  if (rawConfig && typeof rawConfig === "object") {
    const config = rawConfig as Partial<PlanScheduleConfig>;
    const mode: PlanScheduleMode =
      config.mode === "months" || config.mode === "weekdays" || config.mode === "custom" ? config.mode : "days";
    const interval = typeof config.interval === "number" && config.interval > 0 ? config.interval : 1;
    const weekdays = Array.isArray(config.weekdays)
      ? config.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [];
    return { mode, interval, weekdays };
  }

  if (typeof metadata.frequency_per_week === "number" && metadata.frequency_per_week > 0) {
    return { mode: "days", interval: Math.max(1, Math.floor(7 / metadata.frequency_per_week)), weekdays: [] };
  }

  return { mode: "days", interval: 1, weekdays: [] };
}

function getStoredPlanType(entry: Entry): PlanType {
  const category = normalizeCategory(entry.category);
  if (category === "habit" || category === "practice") return category;
  if (entry.metadata.plan_type === "habit" || entry.metadata.plan_type === "practice") {
    return entry.metadata.plan_type;
  }
  return "learning";
}

function getStoredPlanTopics(metadata: Record<string, unknown>) {
  return Array.isArray(metadata.topics)
    ? metadata.topics.filter((topic): topic is string => typeof topic === "string").map((topic) => topic.trim()).filter(Boolean)
    : [];
}

function hasPlanScheduleChanged(
  entry: Entry,
  planType: PlanType,
  startDate: string,
  endDate: string,
  schedule: PlanScheduleConfig,
  topics: string[]
) {
  return (
    entry.entry_date.slice(0, 10) !== startDate ||
    (typeof entry.metadata.end_date === "string" ? entry.metadata.end_date.slice(0, 10) : "") !== endDate ||
    getStoredPlanType(entry) !== planType ||
    JSON.stringify(getPlanScheduleConfig(entry.metadata)) !== JSON.stringify(schedule) ||
    JSON.stringify(getStoredPlanTopics(entry.metadata)) !== JSON.stringify(topics)
  );
}

export default function AddEntry() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const entryId = params.id ?? null;
  const isEditing = Boolean(entryId);
  const requestedArea = searchParams.get("area");
  const requestedCategory = searchParams.get("category");

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
  const [readingUrl, setReadingUrl] = useState("");
  const [readingTopic, setReadingTopic] = useState("");
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>("to_read");
  const [readingPriority, setReadingPriority] = useState("");
  const [readingCompletedDate, setReadingCompletedDate] = useState("");
  const [listItems, setListItems] = useState<ListItem[]>([createListItem()]);
  const [planType, setPlanType] = useState<PlanType>("learning");
  const [planEndDate, setPlanEndDate] = useState("");
  const [planScheduleMode, setPlanScheduleMode] = useState<PlanScheduleMode>("days");
  const [planScheduleInterval, setPlanScheduleInterval] = useState("1");
  const [planScheduleWeekdays, setPlanScheduleWeekdays] = useState<number[]>([]);
  const [planSessionDurationMinutes, setPlanSessionDurationMinutes] = useState("30");
  const [planStatus, setPlanStatus] = useState<PlanStatus>("active");
  const [planTopics, setPlanTopics] = useState("");
  const [seller, setSeller] = useState("");
  const [invoiceImage, setInvoiceImage] = useState("");
  const [doctor, setDoctor] = useState("");
  const [hospital, setHospital] = useState("");
  const [tags, setTags] = useState("");
  const [favorite, setFavorite] = useState(false);
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
  const [notesOpen, setNotesOpen] = useState(false);

  const normalizedCategory = normalizeCategory(category);
  const isGoal = normalizedCategory === "goal";
  const isRoutine = normalizedCategory === "routine";
  const isSubscription = normalizedCategory === "subscription";
  const isPurchase = normalizedCategory === "purchase";
  const isHealthRecord = normalizedCategory === "health record";
  const isPlan = isPlanAreaCategory(area, category);
  const returnPath = isPlan ? "/goals" : "/";
  const isReading = normalizedCategory === "reading";
  const isList = normalizedCategory === "list";
  const hasRepeatInterval = isRoutine || isHealthRecord;
  const hasCost = isPurchase || isSubscription;
  const titleLabel = isGoal
    ? "Goal Name"
    : isSubscription
      ? "Service Name"
      : isReading
        ? "Reading Title"
      : isList
        ? "List Name"
      : isHealthRecord
        ? "Event Type"
        : isPurchase
          ? "Item Name"
          : isPlan
            ? "Goal Name"
            : "Title";
  const titlePlaceholder = isGoal
    ? "e.g. Learn Spanish"
    : isSubscription
      ? "e.g. ChatGPT Plus"
      : isReading
        ? "e.g. We Live Like Royalty"
      : isList
        ? "e.g. Weekend errands"
      : isHealthRecord
        ? "e.g. Blood test"
        : isPurchase
          ? "e.g. Washing machine"
          : isPlan
            ? "e.g. Learn React"
            : "e.g. Replace air filter";
  const entryDateLabel = isGoal
    ? "Start Date"
    : isRoutine
      ? "Last Done Date"
      : isReading
        ? "Saved Date"
      : isSubscription
        ? "Start Date"
        : isPurchase
          ? "Purchase Date"
          : isHealthRecord
            ? "Last Done"
            : isPlan
              ? "Start Date"
              : "Entry Date";
  const nextDueLabel = isGoal
    ? "Target Date"
    : isSubscription
      ? "Renewal Date"
      : isPurchase
        ? "Warranty Ends"
        : "Next Due Date";
  const titleMissing = title.trim().length === 0;
  const areaMissing = area.length === 0;
  const categoryMissing = category.length === 0;
  const entryDateMissing = entryDate.length === 0;
  const planEndDateMissing = isPlan && planEndDate.length === 0;
  const calculatedSubscriptionRenewalDate =
    isSubscription && billingCycle !== "custom"
      ? getNextSubscriptionRenewalIso(entryDate, getBillingCycle(billingCycle))?.slice(0, 10) ?? ""
      : "";
  const renewalDateValue = isSubscription && billingCycle !== "custom" ? calculatedSubscriptionRenewalDate : nextDueDate;

  useEffect(() => {
    if (!isEditing && isReading) {
      const personalArea = areas.find((option) => normalizeCategory(option.name) === "personal")?.name;
      if (personalArea) setArea(personalArea);
      setReminderEnabled(false);
    }
  }, [areas, isEditing, isReading]);

  useEffect(() => {
    if (!isEditing && isPlan) {
      setReminderEnabled(true);
      setReminderTime("05:00");
    }
  }, [isEditing, isPlan]);

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
          setReadingUrl(typeof entry.metadata.reading_url === "string" ? entry.metadata.reading_url : "");
          setReadingTopic(typeof entry.metadata.reading_topic === "string" ? entry.metadata.reading_topic : "");
          setReadingStatus(
            entry.metadata.reading_status === "reading" || entry.metadata.reading_status === "done"
              ? entry.metadata.reading_status
              : "to_read"
          );
          setReadingPriority(
            typeof entry.metadata.reading_priority === "number"
              ? String(entry.metadata.reading_priority)
              : ""
          );
          setReadingCompletedDate(
            typeof entry.metadata.reading_completed_date === "string"
              ? entry.metadata.reading_completed_date.slice(0, 10)
              : ""
          );
          setListItems(getListItems(entry.metadata).length > 0 ? getListItems(entry.metadata) : [createListItem()]);
          setPlanType(getStoredPlanType(entry));
          setPlanEndDate(typeof entry.metadata.end_date === "string" ? entry.metadata.end_date.slice(0, 10) : "");
          const scheduleConfig = getPlanScheduleConfig(entry.metadata);
          setPlanScheduleMode(scheduleConfig.mode);
          setPlanScheduleInterval(String(scheduleConfig.interval));
          setPlanScheduleWeekdays(scheduleConfig.weekdays);
          setPlanSessionDurationMinutes(
            typeof entry.metadata.session_duration_minutes === "number"
              ? String(entry.metadata.session_duration_minutes)
              : "30"
          );
          setPlanStatus(
            entry.metadata.plan_status === "paused" || entry.metadata.plan_status === "completed"
              ? entry.metadata.plan_status
              : "active"
          );
          setPlanTopics(
            Array.isArray(entry.metadata.topics)
              ? entry.metadata.topics.filter((topic) => typeof topic === "string").join("\n")
              : ""
          );
          setSeller(typeof entry.metadata.seller === "string" ? entry.metadata.seller : "");
          setInvoiceImage(typeof entry.metadata.invoice_image === "string" ? entry.metadata.invoice_image : "");
          setDoctor(typeof entry.metadata.doctor === "string" ? entry.metadata.doctor : "");
          setHospital(typeof entry.metadata.hospital === "string" ? entry.metadata.hospital : "");
          setTags(Array.isArray(entry.metadata.tags) ? entry.metadata.tags.filter((tag) => typeof tag === "string").join(", ") : "");
          setFavorite(entry.metadata.favorite === true);
          setPrice(entry.price !== null ? String(entry.price) : "");
          setCurrency(getCurrencyCode(entry.metadata.currency));
          setNotes(entry.notes ?? "");
          setReminderEnabled(entry.reminder_enabled);
          setReminderTime(entry.reminder_time ?? "09:00");
          return;
        }

        const isRequestedPlan = requestedCategory && ["goal", "plan"].includes(normalizeCategory(requestedCategory));
        const categoryFromQuery = isRequestedPlan
          ? categoryOptions.find((option) => normalizeCategory(option.name) === "learning")?.name ?? "Learning"
          : requestedCategory
            ? categoryOptions.find((option) => normalizeCategory(option.name) === normalizeCategory(requestedCategory))?.name
            : "";
        const areaFromQuery = requestedArea
          ? areaOptions.find((option) => normalizeCategory(option.name) === normalizeCategory(requestedArea))?.name
          : "";
        setArea((current) => current || areaFromQuery || areaOptions[0]?.name || "");
        setCategory((current) => current || categoryFromQuery || categoryOptions[0]?.name || "");
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load entry options.");
      }
    };
    void load();
  }, [entryId, isEditing, requestedArea, requestedCategory]);

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 &&
      entryDate.length > 0 &&
      area.length > 0 &&
      category.length > 0 &&
      (!isPlan || planEndDate.length > 0),
    [area, category, entryDate, isPlan, planEndDate, title]
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Please fill in the title, area, category, and entry date.");
      return;
    }

    const warrantyDate = new Date(`${nextDueDate}T00:00:00.000Z`);
    if (
      isPurchase &&
      nextDueDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate) ||
        Number.isNaN(warrantyDate.getTime()) ||
        warrantyDate.toISOString().slice(0, 10) !== nextDueDate)
    ) {
      setError("Warranty Ends must use a valid YYYY-MM-DD date.");
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

    let readingPriorityValue: number | null = null;
    if (isReading && readingPriority.trim()) {
      const parsed = Number(readingPriority);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
        setError("Reading priority must be a whole number between 1 and 5.");
        return;
      }
      readingPriorityValue = parsed;
    }

    let planScheduleConfig: PlanScheduleConfig | null = null;
    let planDurationValue: number | null = null;
    const planTopicValues = planTopics
      .split(/\r?\n|,/)
      .map((topic) => topic.trim())
      .filter(Boolean);

    if (isPlan) {
      if (!planEndDate) {
        setError("Goal end date is required.");
        return;
      }
      if (new Date(planEndDate) < new Date(entryDate)) {
        setError("Goal end date must be on or after the start date.");
        return;
      }

      const parsedInterval = Number(planScheduleInterval);
      if (!Number.isInteger(parsedInterval) || parsedInterval <= 0) {
        setError("Schedule interval must be a positive whole number.");
        return;
      }
      if (planScheduleMode === "weekdays" && planScheduleWeekdays.length === 0) {
        setError("Choose at least one day of the week.");
        return;
      }
      planScheduleConfig = {
        mode: planScheduleMode,
        interval: parsedInterval,
        weekdays: planScheduleMode === "weekdays" ? [...planScheduleWeekdays].sort((a, b) => a - b) : [],
      };

      const parsedDuration = Number(planSessionDurationMinutes);
      if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
        setError("Session duration must be a positive whole number.");
        return;
      }
      planDurationValue = parsedDuration;
    }

    const tagValues = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const normalizedListItems = listItems
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text);
    const existingEntry = isEditing && entryId ? entries.find((entry) => entry.id === entryId) : null;
    const existingEntryIsSubscription = existingEntry ? normalizeCategory(existingEntry.category) === "subscription" : false;
    const shouldPreserveSubscriptionStartDate = Boolean(isSubscription && existingEntryIsSubscription && existingEntry);
    const entryDateIso = shouldPreserveSubscriptionStartDate
      ? existingEntry!.entry_date
      : new Date(entryDate).toISOString();
    const subscriptionStartDate = shouldPreserveSubscriptionStartDate
      ? existingEntry!.entry_date
      : entryDate;
    const nextDueDateIso = isReading
      ? null
      : isPlan
      ? existingEntry?.next_due_date ?? entryDateIso
      : isSubscription
        ? billingCycle === "custom"
          ? nextDueDate
            ? new Date(nextDueDate).toISOString()
            : null
          : getNextSubscriptionRenewalIso(subscriptionStartDate, getBillingCycle(billingCycle))
      : intervalValue
        ? addDays(new Date(entryDate), intervalValue).toISOString()
        : nextDueDate
          ? new Date(nextDueDate).toISOString()
          : null;
    const payloadArea = area;
    const payloadCategory = isPlan ? getPlanTypeLabel(planType) : category;

    setSaving(true);
    const payload = {
      title: title.trim(),
      area: payloadArea,
      category: payloadCategory,
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
        reading_url: isReading && readingUrl.trim() ? readingUrl.trim() : null,
        reading_topic: isReading && readingTopic.trim() ? readingTopic.trim() : null,
        reading_status: isReading ? readingStatus : null,
        reading_priority: isReading ? readingPriorityValue : null,
        reading_started_date:
          isReading && readingStatus === "reading"
            ? (existingEntry?.metadata.reading_started_date as string | undefined) ?? new Date().toISOString()
            : null,
        reading_completed_date:
          isReading && readingStatus === "done"
            ? readingCompletedDate
              ? new Date(`${readingCompletedDate}T00:00:00`).toISOString()
              : (existingEntry?.metadata.reading_completed_date as string | undefined) ?? new Date().toISOString()
            : null,
        list_items: isList ? normalizedListItems : null,
        plan_status: isPlan ? planStatus : null,
        start_date: isPlan ? entryDate : null,
        end_date: isPlan ? planEndDate : null,
        frequency_per_week: null,
        schedule_config: isPlan ? planScheduleConfig : null,
        session_duration_minutes: isPlan ? planDurationValue : null,
        topics: isPlan ? planTopicValues : null,
        seller: isPurchase && seller.trim() ? seller.trim() : null,
        invoice_image: isPurchase && invoiceImage.trim() ? invoiceImage.trim() : null,
        warranty_ends: isPurchase && nextDueDate ? nextDueDate : null,
        doctor: isHealthRecord && doctor.trim() ? doctor.trim() : null,
        hospital: isHealthRecord && hospital.trim() ? hospital.trim() : null,
        ...(!isReading
          ? {
              completed_count:
                isEditing && entryId
                  ? entries.find((entry) => entry.id === entryId)?.metadata.completed_count ?? 0
                  : 0,
            }
          : {}),
        tags: tagValues,
        favorite,
        currency: hasCost ? currency : null,
      },
      price: hasCost ? priceValue : null,
      notes: notes.trim() ? notes.trim() : null,
      reminder_enabled: reminderEnabled,
      reminder_time: reminderEnabled ? reminderTime : null,
    };

    try {
      let savedEntryId = entryId;
      if (isEditing && entryId !== null) {
        await updateEntry(entryId, payload);
      } else {
        savedEntryId = await insertEntry(payload);
      }

      if (isPlan && savedEntryId) {
        const shouldRegeneratePlanSessions =
          !isEditing ||
          !existingEntry ||
          hasPlanScheduleChanged(
            existingEntry,
            planType,
            entryDate,
            planEndDate,
            planScheduleConfig ?? { mode: "days", interval: 1, weekdays: [] },
            planTopicValues
          );
        const sessions = generatePlanSessions({
          entryId: savedEntryId,
          title: title.trim(),
          planType,
          startDate: entryDate,
          endDate: planEndDate,
          schedule: planScheduleConfig ?? { mode: "days", interval: 1, weekdays: [] },
          topics: planTopicValues,
        });
        if (isEditing && shouldRegeneratePlanSessions) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const futureSessions = sessions.filter((session) => new Date(session.session_date) >= today);
          await replaceScheduledPlanSessions(savedEntryId, futureSessions);
        } else if (!isEditing) {
          await replacePlanSessions(savedEntryId, sessions);
          await updateEntry(savedEntryId, {
            next_due_date: sessions[0]?.session_date ?? entryDateIso,
          });
        }
      }
      setEntries(await getAllEntries());
      navigate(returnPath);
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
      await logEntryAgain(entry, loggedAt);

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
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 rounded-2xl border border-stone-300 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-50">{isEditing ? "Edit Entry" : "Add Entry"}</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Capture what happened and the next action date.
            </p>
          </div>
          <Button variant="outline" type="button" onClick={() => navigate(returnPath)}>
            {isPlan ? "Back to Goals" : "Back to Dashboard"}
          </Button>
        </div>

        <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <span className="text-sm font-medium text-stone-900 dark:text-stone-100">{requiredLabel("Area")}</span>
            <div className="flex flex-wrap gap-2">
              {areas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setArea(item.name)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    area === item.name
                      ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                      : areaMissing
                        ? missingRequiredPillClass
                        : inactivePillClass
                  }`}
                >
                  {formatOptionLabel(item.name)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-stone-900 dark:text-stone-100">{requiredLabel("Category")}</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.name)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    category === item.name
                      ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                      : categoryMissing
                        ? missingRequiredPillClass
                        : inactivePillClass
                  }`}
                >
                  {formatOptionLabel(item.name)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-12">
            <div className={`grid gap-2 ${isReading ? "md:col-span-5" : "md:col-span-6"}`}>
              <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="title">
                {requiredLabel(titleLabel)}
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={`${inputClass} ${requiredClass(titleMissing)}`}
                placeholder={titlePlaceholder}
              />
            </div>
            {isReading ? (
              <div className="grid gap-2 md:col-span-4">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="readingUrl">
                  Link
                </label>
                <input
                  id="readingUrl"
                  type="url"
                  value={readingUrl}
                  onChange={(event) => setReadingUrl(event.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
              </div>
            ) : null}
            <div className="grid gap-2 md:col-span-3">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="entryDate">
                {requiredLabel(entryDateLabel)}
              </label>
              <input
                id="entryDate"
                type="date"
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className={`${inputClass} ${requiredClass(entryDateMissing)}`}
              />
            </div>
            {isPlan ? (
              <div className="grid gap-2 md:col-span-3">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="planEndDate">
                  {requiredLabel("End Date")}
                </label>
                <input
                  id="planEndDate"
                  type="date"
                  value={planEndDate}
                  onChange={(event) => setPlanEndDate(event.target.value)}
                  className={`${inputClass} ${requiredClass(planEndDateMissing)}`}
                />
              </div>
            ) : null}
            {hasRepeatInterval && !isRoutine ? (
              <div className="grid gap-2 md:col-span-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="repeatIntervalDays">
                  {isRoutine ? "Repeat Every" : "Repeat Interval"}
                </label>
                <input
                  id="repeatIntervalDays"
                  type="number"
                  value={repeatIntervalDays}
                  onChange={(event) => setRepeatIntervalDays(event.target.value)}
                  className={inputClass}
                  placeholder={isRoutine ? "e.g. 2" : "e.g. 180"}
                  min="1"
                  step="1"
                />
              </div>
            ) : null}
            {!isPlan && !isReading && !isRoutine && !isHealthRecord ? (
              <div className="grid gap-2 md:col-span-3">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="nextDueDate">
                  {nextDueLabel}
                </label>
                <input
                  id="nextDueDate"
                  type={isPurchase ? "text" : "date"}
                  value={renewalDateValue}
                  onChange={(event) => setNextDueDate(event.target.value)}
                  disabled={(hasRepeatInterval && Boolean(repeatIntervalDays.trim())) || (isSubscription && billingCycle !== "custom")}
                  className={inputClass}
                  placeholder={isPurchase ? "YYYY-MM-DD" : undefined}
                />
              </div>
            ) : null}
          </div>

          {isList ? (
            <div className="rounded-2xl border border-stone-300 bg-stone-50 p-4 dark:border-white/15 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-200">List items</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Add anything you want to track or check off.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setListItems((current) => [...current, createListItem()])}>
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              </div>
              <div className="mt-4 grid gap-2">
                {listItems.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(event) => setListItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, completed: event.target.checked } : currentItem))}
                      aria-label={`Mark item ${index + 1} complete`}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    <input
                      value={item.text}
                      onChange={(event) => setListItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, text: event.target.value } : currentItem))}
                      className={`${inputClass} min-w-0 flex-1`}
                      placeholder={`Item ${index + 1}`}
                    />
                    <Button type="button" variant="ghost" size="sm" className="w-9 !px-0 text-stone-500" onClick={() => setListItems((current) => current.length === 1 ? [createListItem()] : current.filter((currentItem) => currentItem.id !== item.id))} aria-label={`Remove item ${index + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isRoutine ? (
            <div className={`${sectionPanelClass} md:grid-cols-2 xl:grid-cols-4`}>
              <div className="grid min-w-0 gap-2"><label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="repeatIntervalDays">Repeat Every</label><input id="repeatIntervalDays" type="number" value={repeatIntervalDays} onChange={(event) => setRepeatIntervalDays(event.target.value)} className={inputClass} min="1" step="1" /></div>
              <div className="grid min-w-0 gap-2"><label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="repeatUnit">Unit</label><select id="repeatUnit" value={repeatUnit} onChange={(event) => setRepeatUnit(event.target.value as RepeatUnit)} className={inputClass}><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option></select></div>
              <div className="grid min-w-0 gap-2"><label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="reminderBeforeDays">Reminder Before</label><input id="reminderBeforeDays" type="number" value={reminderBeforeDays} onChange={(event) => setReminderBeforeDays(event.target.value)} className={inputClass} min="0" step="1" /></div>
              <div className="grid min-w-0 gap-2"><label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="nextDueDate">Next Due Date</label><input id="nextDueDate" type="date" value={nextDueDate} onChange={(event) => setNextDueDate(event.target.value)} disabled={Boolean(repeatIntervalDays.trim())} className={inputClass} /></div>
            </div>
          ) : null}

          {isPlan ? (
            <div className={`${sectionPanelClass} md:grid-cols-2 xl:grid-cols-3`}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="planType">
                  Goal Type
                </label>
                <select
                  id="planType"
                  value={planType}
                  onChange={(event) => setPlanType(event.target.value as PlanType)}
                  className={inputClass}
                >
                  <option value="learning">Learning</option>
                  <option value="habit">Habit</option>
                  <option value="practice">Practice</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="planScheduleMode">
                  Frequency
                </label>
                <select
                  id="planScheduleMode"
                  value={planScheduleMode}
                  onChange={(event) => setPlanScheduleMode(event.target.value as PlanScheduleMode)}
                  className={inputClass}
                >
                  <option value="days">Every N days</option>
                  <option value="months">Every N months</option>
                  <option value="weekdays">Specific days</option>
                  <option value="custom">Custom weeks</option>
                </select>
              </div>
              {planScheduleMode !== "weekdays" ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="planScheduleInterval">
                    Repeat Every
                  </label>
                  <input
                    id="planScheduleInterval"
                    type="number"
                    value={planScheduleInterval}
                    onChange={(event) => setPlanScheduleInterval(event.target.value)}
                    className={inputClass}
                    min="1"
                    step="1"
                  />
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {planScheduleMode === "months" ? "Months" : planScheduleMode === "custom" ? "Weeks" : "Days"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 xl:col-span-2">
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-200">Days of Week</span>
                  <div className="flex flex-wrap gap-2">
                    {weekdayOptions.map((day) => {
                      const selected = planScheduleWeekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() =>
                            setPlanScheduleWeekdays((current) =>
                              current.includes(day.value)
                                ? current.filter((value) => value !== day.value)
                                : [...current, day.value]
                            )
                          }
                          className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                            selected
                              ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                              : planScheduleWeekdays.length === 0
                                ? missingRequiredPillClass
                                : inactivePillClass
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="planSessionDurationMinutes">
                  Session Minutes
                </label>
                <input
                  id="planSessionDurationMinutes"
                  type="number"
                  value={planSessionDurationMinutes}
                  onChange={(event) => setPlanSessionDurationMinutes(event.target.value)}
                  className={inputClass}
                  min="1"
                  step="1"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="planStatus">
                  Status
                </label>
                <select
                  id="planStatus"
                  value={planStatus}
                  onChange={(event) => setPlanStatus(event.target.value as PlanStatus)}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="grid gap-2 md:col-span-3 xl:col-span-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="planTopics">
                  Topics
                </label>
                <textarea
                  id="planTopics"
                  value={planTopics}
                  onChange={(event) => setPlanTopics(event.target.value)}
                  className={`min-h-[96px] ${textareaClass}`}
                  placeholder="One topic per line..."
                />
              </div>
              <div className="grid gap-2 md:col-span-3 xl:col-span-3">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={`min-h-[96px] ${textareaClass}`}
                  placeholder="Optional details..."
                />
              </div>
            </div>
          ) : null}

          {isGoal ? (
            <div className={`${sectionPanelClass} md:grid-cols-2 xl:grid-cols-4`}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="goalStatus">
                  Status
                </label>
                <select
                  id="goalStatus"
                  value={goalStatus}
                  onChange={(event) => setGoalStatus(event.target.value as GoalStatus)}
                  className={inputClass}
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="goalProgress">
                  Progress %
                </label>
                <input
                  id="goalProgress"
                  type="number"
                  value={goalProgress}
                  onChange={(event) => setGoalProgress(event.target.value)}
                  className={inputClass}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
              <div className="grid gap-2 md:col-span-2 xl:col-span-1">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="goalMilestones">
                  Milestones
                </label>
                <textarea
                  id="goalMilestones"
                  value={goalMilestones}
                  onChange={(event) => setGoalMilestones(event.target.value)}
                  className={`min-h-[96px] ${textareaClass}`}
                  placeholder="One milestone per line..."
                />
              </div>
              <div className="grid gap-2 md:col-span-2 xl:col-span-1">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={`min-h-[96px] ${textareaClass}`}
                  placeholder="Optional details..."
                />
              </div>
            </div>
          ) : null}

          {isSubscription ? (
            <div className={`${sectionPanelClass} md:grid-cols-2 xl:grid-cols-3`}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="reminderBeforeDays">Reminder Before</label>
                <input id="reminderBeforeDays" type="number" value={reminderBeforeDays} onChange={(event) => setReminderBeforeDays(event.target.value)} className={inputClass} placeholder="Days" min="0" step="1" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="billingCycle">
                  Billing Cycle
                </label>
                <select
                  id="billingCycle"
                  value={billingCycle}
                  onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}
                  className={inputClass}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className={inlinePanelClass}>
                <div className="flex h-full items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-700 dark:text-stone-200">Auto Renew</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">Renews without manual action.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={autoRenew}
                      onChange={(event) => setAutoRenew(event.target.checked)}
                    />
                    <div className="peer h-6 w-11 rounded-full border border-stone-300 bg-stone-200 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:border-stone-900 peer-checked:bg-stone-900 peer-checked:after:translate-x-5 dark:border-white/20 dark:bg-stone-700 dark:after:bg-stone-100 dark:peer-checked:border-stone-100 dark:peer-checked:bg-stone-100 dark:peer-checked:after:bg-stone-950" />
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {isReading ? (
            <div className={`${sectionPanelClass} md:grid-cols-2 xl:grid-cols-4`}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="readingTopic">
                  Topic
                </label>
                <input
                  id="readingTopic"
                  value={readingTopic}
                  onChange={(event) => setReadingTopic(event.target.value)}
                  className={inputClass}
                  placeholder="Investing, AI, philosophy..."
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="readingStatus">
                  Status
                </label>
                <select
                  id="readingStatus"
                  value={readingStatus}
                  onChange={(event) => {
                    const nextStatus = event.target.value as ReadingStatus;
                    setReadingStatus(nextStatus);
                    if (nextStatus === "reading" || nextStatus === "done") setNotesOpen(true);
                    if (nextStatus === "done" && !readingCompletedDate) {
                      setReadingCompletedDate(new Date().toISOString().slice(0, 10));
                    }
                  }}
                  className={inputClass}
                >
                  <option value="to_read">To read</option>
                  <option value="reading">Reading</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="readingPriority">
                  Priority
                </label>
                <input
                  id="readingPriority"
                  type="number"
                  value={readingPriority}
                  onChange={(event) => setReadingPriority(event.target.value)}
                  className={inputClass}
                  placeholder="1-5"
                  min="1"
                  max="5"
                  step="1"
                />
              </div>
              {readingStatus === "done" ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="readingCompletedDate">
                    Completed Date
                  </label>
                  <input
                    id="readingCompletedDate"
                    type="date"
                    value={readingCompletedDate}
                    onChange={(event) => setReadingCompletedDate(event.target.value)}
                    className={inputClass}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {hasCost && !isPurchase ? (
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="price">
                  Cost
                </label>
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="currency">
                  Currency
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
                  className={inputClass}
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
            <div className={`${sectionPanelClass} md:grid-cols-2 xl:grid-cols-4`}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="price">Cost</label>
                <input id="price" type="number" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="currency">Currency</label>
                <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)} className={inputClass}>{currencyOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="seller">
                  Seller
                </label>
                <input
                  id="seller"
                  value={seller}
                  onChange={(event) => setSeller(event.target.value)}
                  className={inputClass}
                  placeholder="e.g. Croma"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="invoiceImage">
                  Invoice Image
                </label>
                <input
                  id="invoiceImage"
                  value={invoiceImage}
                  onChange={(event) => setInvoiceImage(event.target.value)}
                  className={inputClass}
                  placeholder="Image URL or file reference"
                />
              </div>
            </div>
          ) : null}

          {isHealthRecord ? (
            <div className={`${sectionPanelClass} md:grid-cols-2 xl:grid-cols-3`}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="nextDueDate">Next Due Date</label>
                <input id="nextDueDate" type="date" value={nextDueDate} onChange={(event) => setNextDueDate(event.target.value)} disabled={Boolean(repeatIntervalDays.trim())} className={inputClass} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="doctor">
                  Doctor
                </label>
                <input
                  id="doctor"
                  value={doctor}
                  onChange={(event) => setDoctor(event.target.value)}
                  className={inputClass}
                  placeholder="e.g. Dr. Rao"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="hospital">
                  Hospital
                </label>
                <input
                  id="hospital"
                  value={hospital}
                  onChange={(event) => setHospital(event.target.value)}
                  className={inputClass}
                  placeholder="e.g. Apollo"
                />
              </div>
            </div>
          ) : null}

          <div className={`order-[20] ${sectionPanelClass}`}>
            <div>
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">Universal fields</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Tags, visibility, and reminders apply to every entry.</p>
            </div>
            <div className={`grid gap-4 md:grid-cols-2 ${reminderEnabled ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
              <div className="grid min-w-0 gap-2 md:col-span-2 lg:col-span-1">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="tags">
                  Tags
                </label>
                <input
                  id="tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className={inputClass}
                  placeholder="home, urgent, annual"
                />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 dark:border-white/15 dark:bg-white/[0.04]">
                <span className="text-sm font-medium text-stone-700 dark:text-stone-200">Favorite</span>
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(event) => setFavorite(event.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 dark:border-white/15 dark:bg-white/[0.04]">
                <span className="text-sm font-medium text-stone-700 dark:text-stone-200">Reminder</span>
                <span className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={reminderEnabled}
                    onChange={(event) => setReminderEnabled(event.target.checked)}
                  />
                  <span className="peer h-6 w-11 rounded-full border border-stone-300 bg-stone-200 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:border-stone-900 peer-checked:bg-stone-900 peer-checked:after:translate-x-5 dark:border-white/20 dark:bg-stone-700 dark:after:bg-stone-100 dark:peer-checked:border-stone-100 dark:peer-checked:bg-stone-100 dark:peer-checked:after:bg-stone-950" />
                </span>
              </label>
              {reminderEnabled ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="reminderTime">
                    Reminder Time
                  </label>
                  <input
                    id="reminderTime"
                    type="time"
                    value={reminderTime}
                    onChange={(event) => setReminderTime(event.target.value)}
                    className={inputClass}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {!isPlan && !isGoal ? (
          <div className="order-[10] rounded-2xl border border-stone-300 bg-stone-50 dark:border-white/15 dark:bg-white/[0.04]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              onClick={() => setNotesOpen((current) => !current)}
              aria-expanded={notesOpen}
            >
              <div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-200">Notes</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Optional details.</p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-stone-500 transition dark:text-stone-400 ${
                  notesOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {notesOpen ? (
              <div className="border-t border-stone-200 p-4 dark:border-white/10">
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={`min-h-[120px] w-full ${textareaClass}`}
                  placeholder={isReading ? "Highlights, learnings, or optional details..." : "Optional details..."}
                />
              </div>
            ) : null}
          </div>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="order-[40] flex flex-wrap gap-3">
            <Button className="w-10 !px-0" type="submit" disabled={!canSubmit || saving} title={isEditing ? "Save entry changes" : "Save new entry"} aria-label={isEditing ? "Save entry changes" : "Save new entry"}>
              <SaveIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              className="w-10 !px-0"
              variant="outline"
              onClick={() => navigate("/")}
              disabled={saving}
              title="Cancel entry editing"
              aria-label="Cancel entry editing"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
      <aside className="rounded-2xl border border-stone-300 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/[0.04] xl:sticky xl:top-24 xl:self-start">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">Same area/category</p>
          <h3 className="mt-2 text-lg font-semibold text-stone-900 dark:text-stone-50">Related entries</h3>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Open another card to edit it, or log another occurrence.</p>
        </div>
        {sidePanelError ? <p className="mt-3 text-sm text-rose-600">{sidePanelError}</p> : null}
        <div className="mt-4 grid gap-3">
          {relatedEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500 dark:border-white/15 dark:text-stone-400">
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
                    entry.id === entryId
                      ? "border-stone-900 bg-stone-50 dark:border-white/40 dark:bg-white/[0.08]"
                      : "border-stone-300 bg-white hover:border-stone-500 dark:border-white/15 dark:bg-white/[0.04] dark:hover:border-white/35"
                  }`}
                >
                  <button type="button" className="block w-full text-left" onClick={() => navigate(`/edit/${entry.id}`)}>
                    <p className="font-medium text-stone-900 dark:text-stone-50">{entry.title}</p>
                    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{formatYearMonthDayDuration(entry.entry_date)}</p>
                    <p className={`mt-2 text-sm ${summary.isOverdue ? "text-rose-600 dark:text-rose-300" : "text-stone-600 dark:text-stone-300"}`}>
                      {dueText}
                    </p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="date"
                      value={logDates[entry.id] ?? ""}
                      onChange={(event) => setLogDates((current) => ({ ...current, [entry.id]: event.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-stone-400 bg-white px-3 text-sm text-stone-700 focus:border-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10"
                      aria-label={`Log date for ${entry.title}`}
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleSidePanelLogAgain(entry)}
                      disabled={loggingId === entry.id}
                    >
                      {loggingId === entry.id ? "Logging..." : "Log Again"}
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
