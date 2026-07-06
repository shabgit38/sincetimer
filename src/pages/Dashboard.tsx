import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Plus, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { computeTimeSummary, formatYearMonthDayDuration } from "@/lib/timeUtils";
import {
  getAllEntries,
  getAreas,
  getCategories,
  getHistoryForEntries,
  insertArea,
  insertCategory,
  logEntryAgain,
  renameArea,
  renameCategory,
  updateEntry,
} from "@/lib/db";
import { getAllPlanSessions, updatePlanSessionStatus } from "@/lib/plans";
import type { Entry, EntryOption, HistoryItem } from "@/types/entry";
import type { PlanSession, PlanSessionStatus } from "@/types/plan";

type SortOption = "created" | "overdue" | "area";
type ManagedKind = "area" | "category";

type DashboardProps = {
  searchQuery?: string;
};

function formatOptionLabel(value: string) {
  return value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

type EditableOptionButtonProps = {
  active: boolean;
  option: EntryOption;
  onSelect: () => void;
  onRename: (nextName: string) => Promise<void>;
};

function EditableOptionButton({ active, option, onSelect, onRename }: EditableOptionButtonProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(option.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(option.name);
  }, [option.name]);

  const saveRename = async () => {
    const nextName = name.trim();
    if (!nextName || nextName === option.name) {
      setName(option.name);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(nextName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          void saveRename();
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-8 w-32 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-700 outline-none"
          autoFocus
        />
        <Button size="sm" type="submit" disabled={saving}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          disabled={saving}
          onClick={() => {
            setName(option.name);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="group flex items-center">
      <Button
        variant={active ? "default" : "outline"}
        size="sm"
        onClick={onSelect}
        className={`rounded-r-none ${
          active ? "text-white dark:text-stone-950" : "text-stone-900 dark:text-stone-100"
        }`}
      >
        {formatOptionLabel(option.name)}
      </Button>
      <Button
        variant={active ? "default" : "outline"}
        size="sm"
        className={`w-8 rounded-l-none border-l-0 px-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ${
          active ? "text-white dark:text-stone-950" : "text-stone-900 dark:text-stone-100"
        }`}
        onClick={() => setEditing(true)}
        aria-label={`Rename ${option.name}`}
        title={`Rename ${option.name}`}
      >
        <PencilIcon />
      </Button>
    </div>
  );
}

type AddOptionControlProps = {
  active: boolean;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
};

function AddOptionControl({ active, onCancel, onSave }: AddOptionControlProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  if (!active) {
    return null;
  }

  const save = async () => {
    const nextName = name.trim();
    if (!nextName) return;
    setSaving(true);
    try {
      await onSave(nextName);
      setName("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="h-8 w-36 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-700 outline-none"
        autoFocus
      />
      <Button size="sm" type="submit" disabled={saving || !name.trim()}>
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        type="button"
        disabled={saving}
        onClick={() => {
          setName("");
          onCancel();
        }}
      >
        Cancel
      </Button>
    </form>
  );
}

type EntryGroup = {
  title: string;
  description: string;
  entries: Entry[];
};

type SectionTone = "favorite" | "reading" | "overdue" | "today" | "soon" | "recent" | "neutral";

const sectionToneClasses: Record<
  SectionTone,
  {
    shell: string;
    header: string;
    count: string;
    chevron: string;
  }
> = {
  favorite: {
    shell: "dark:border-amber-400/35 dark:bg-[#2a2212]/80",
    header: "dark:border-amber-400/25 dark:bg-amber-400/10 dark:hover:bg-amber-400/15",
    count: "dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100",
    chevron: "dark:text-amber-200",
  },
  reading: {
    shell: "dark:border-sky-400/35 dark:bg-[#102433]/82",
    header: "dark:border-sky-400/25 dark:bg-sky-400/10 dark:hover:bg-sky-400/15",
    count: "dark:border-sky-300/30 dark:bg-sky-300/10 dark:text-sky-100",
    chevron: "dark:text-sky-200",
  },
  overdue: {
    shell: "dark:border-rose-400/30 dark:bg-rose-950/20",
    header: "dark:border-rose-400/20 dark:bg-rose-400/8 dark:hover:bg-rose-400/12",
    count: "dark:border-rose-300/25 dark:bg-rose-300/10 dark:text-rose-100",
    chevron: "dark:text-rose-200",
  },
  today: {
    shell: "dark:border-emerald-400/30 dark:bg-emerald-950/15",
    header: "dark:border-emerald-400/20 dark:bg-emerald-400/8 dark:hover:bg-emerald-400/12",
    count: "dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100",
    chevron: "dark:text-emerald-200",
  },
  soon: {
    shell: "dark:border-orange-400/28 dark:bg-orange-950/15",
    header: "dark:border-orange-400/20 dark:bg-orange-400/8 dark:hover:bg-orange-400/12",
    count: "dark:border-orange-300/25 dark:bg-orange-300/10 dark:text-orange-100",
    chevron: "dark:text-orange-200",
  },
  recent: {
    shell: "dark:border-violet-400/25 dark:bg-violet-950/12",
    header: "dark:border-violet-400/18 dark:bg-violet-400/8 dark:hover:bg-violet-400/12",
    count: "dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-violet-100",
    chevron: "dark:text-violet-200",
  },
  neutral: {
    shell: "dark:border-white/10 dark:bg-white/[0.04]",
    header: "dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
    count: "dark:border-white/10 dark:text-stone-300",
    chevron: "dark:text-stone-400",
  },
};

function getSectionTone(title: string): SectionTone {
  if (title === "Favorites") return "favorite";
  if (title === "Reading list") return "reading";
  if (title === "Overdue") return "overdue";
  if (title === "Today") return "today";
  if (title === "Due soon") return "soon";
  if (title === "Recently completed") return "recent";
  return "neutral";
}

function getBooleanMetadata(entry: Entry, key: string) {
  return entry.metadata[key] === true;
}

function getNumberMetadata(entry: Entry, key: string) {
  return typeof entry.metadata[key] === "number" ? entry.metadata[key] : 0;
}

function getStringMetadata(entry: Entry, key: string) {
  return typeof entry.metadata[key] === "string" ? entry.metadata[key] : "";
}

function flattenSearchValue(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenSearchValue(item));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenSearchValue(item));
  }
  return [];
}

function getEntrySearchText(entry: Entry) {
  return [
    entry.title,
    entry.area,
    entry.category,
    entry.entry_date,
    entry.next_due_date,
    entry.repeat_interval_days,
    entry.price,
    entry.notes,
    entry.reminder_enabled,
    entry.reminder_time,
    entry.created_at,
    entry.updated_at,
    ...flattenSearchValue(entry.metadata),
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLocaleLowerCase();
}

function formatShortDuration(entryDate: string) {
  return formatYearMonthDayDuration(entryDate)
    .replace(/ ago$/, "")
    .replace(/\byears?\b/g, "yr")
    .replace(/\bmonths?\b/g, "mnth")
    .replace(/\bdays?\b/g, "dys");
}

function getDateInputValue(date: Date = new Date()) {
  const localDate = new Date(date);
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return localDate.toISOString().slice(0, 10);
}

function isPlanEntry(entry: Entry) {
  return typeof entry.metadata.plan_type === "string";
}

function getPlanTypeLabel(value: unknown) {
  if (value === "habit") return "Habit";
  if (value === "practice") return "Practice";
  return "Learning";
}

function getEntryAreaCategoryLabel(entry: Entry) {
  if (isPlanEntry(entry)) {
    return `Plan / ${getPlanTypeLabel(entry.metadata.plan_type)}`;
  }
  return `${formatOptionLabel(entry.area)} / ${formatOptionLabel(entry.category)}`;
}

function isReadingEntry(entry: Entry) {
  return entry.category.toLocaleLowerCase() === "reading";
}

function isSubscriptionEntry(entry: Entry) {
  return entry.category.trim().toLocaleLowerCase().replace(/[_-]+/g, " ") === "subscription";
}

function getLatestLogDatesByEntryId(history: HistoryItem[]) {
  return history.reduce<Record<string, string>>((latestByEntryId, record) => {
    const current = latestByEntryId[record.entry_id];
    if (!current || new Date(record.logged_date) > new Date(current)) {
      latestByEntryId[record.entry_id] = record.logged_date;
    }
    return latestByEntryId;
  }, {});
}

function getReadingStatus(entry: Entry) {
  return typeof entry.metadata.reading_status === "string" ? entry.metadata.reading_status : "to_read";
}

function getReadingStatusRank(entry: Entry) {
  const status = getReadingStatus(entry);
  if (status === "reading") return 0;
  if (status === "to_read") return 1;
  return 2;
}

function compareEntryAreaCategoryTitle(a: Entry, b: Entry) {
  return (
    a.area.localeCompare(b.area) ||
    a.category.localeCompare(b.category) ||
    a.title.localeCompare(b.title)
  );
}

function compareReadingEntries(a: Entry, b: Entry) {
  return (
    getReadingStatusRank(a) - getReadingStatusRank(b) ||
    getStringMetadata(a, "reading_topic").localeCompare(getStringMetadata(b, "reading_topic")) ||
    compareEntryAreaCategoryTitle(a, b)
  );
}

function sortDashboardGroup(title: string, entries: Entry[]) {
  return [...entries].sort(title === "Reading list" ? compareReadingEntries : compareEntryAreaCategoryTitle);
}

function getNextScheduledPlanSession(sessions: PlanSession[]) {
  const now = new Date();
  const sorted = sessions
    .filter((session) => session.status === "scheduled")
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());

  return sorted.find((session) => new Date(session.session_date) >= now) ?? sorted[0] ?? null;
}

function getLatestCompletedPlanSessionDate(sessions: PlanSession[]) {
  return sessions
    .filter((session) => session.status === "completed")
    .map((session) => session.completed_at ?? session.session_date)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function isPlanSessionActionable(session: PlanSession) {
  const summary = computeTimeSummary(new Date().toISOString(), session.session_date);
  return summary.isOverdue || summary.nextDueIn === 0;
}

function getDueCopy(entry: Entry) {
  const summary = computeTimeSummary(entry.entry_date, entry.next_due_date);
  if (!entry.next_due_date) {
    return {
      tone: "neutral",
      label: "No due date",
      detail: "Tracked as memory",
      summary,
    };
  }
  if (summary.isOverdue) {
    return {
      tone: "overdue",
      label: `${Math.abs(summary.nextDueIn ?? 0)} days overdue`,
      detail: "Needs attention",
      summary,
    };
  }
  if (summary.nextDueIn === 0) {
    return {
      tone: "today",
      label: "Due today",
      detail: "Ready to log",
      summary,
    };
  }
  if ((summary.nextDueIn ?? 0) <= 7) {
    return {
      tone: "soon",
      label: `Due in ${summary.nextDueIn} days`,
      detail: "Coming up",
      summary,
    };
  }
  return {
    tone: "normal",
    label: `Due in ${summary.nextDueIn} days`,
    detail: "On track",
    summary,
  };
}

function getToneClasses(tone: string) {
  if (tone === "overdue") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200";
  if (tone === "today") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200";
  if (tone === "soon") return "border-amber-100 bg-amber-50/70 text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-200";
  return "border-stone-200 bg-stone-50 text-stone-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-300";
}

function CompactDashboardListItem({
  entry,
  planSessions = [],
  latestSubscriptionLogDate,
  onOpen,
  onToggleFavorite,
  onMarkDone,
  doneDate,
  donePrice,
  onDoneDateChange,
  onDonePriceChange,
  onSetPlanSessionStatus,
  favoriteSaving,
  entryDoneSaving,
  planSessionSaving,
  actionExpanded,
  onToggleAction,
  accent = "neutral",
}: {
  entry: Entry;
  planSessions?: PlanSession[];
  latestSubscriptionLogDate?: string;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onMarkDone: () => void;
  doneDate: string;
  donePrice: string;
  onDoneDateChange: (date: string) => void;
  onDonePriceChange: (price: string) => void;
  onSetPlanSessionStatus: (session: PlanSession, status: PlanSessionStatus) => void;
  favoriteSaving: boolean;
  entryDoneSaving: boolean;
  planSessionSaving: boolean;
  actionExpanded: boolean;
  onToggleAction: () => void;
  accent?: "amber" | "neutral";
}) {
  const isPurchase = entry.category.toLocaleLowerCase() === "purchase";
  const isSubscription = isSubscriptionEntry(entry);
  const isPlan = isPlanEntry(entry);
  const isFavorite = getBooleanMetadata(entry, "favorite");
  const planSession = isPlan ? getNextScheduledPlanSession(planSessions) : null;
  const planLastDoneDate = isPlan ? getLatestCompletedPlanSessionDate(planSessions) : null;
  const dueEntry = isPlan ? { ...entry, next_due_date: planSession?.session_date ?? null } : entry;
  const due = getDueCopy(dueEntry);
  const canActOnPlanSession = Boolean(planSession && isPlanSessionActionable(planSession));
  const completedCount = getNumberMetadata(entry, "completed_count");
  const durationDate = isSubscription
    ? latestSubscriptionLogDate ?? entry.entry_date
    : isPlan && planLastDoneDate
      ? planLastDoneDate
      : entry.entry_date;
  const durationLabel = isSubscription
    ? "since latest payment"
    : isPlan
      ? planLastDoneDate
        ? "since last done"
        : "since start"
      : "since last logged";
  const borderClass = accent === "amber" ? "border-amber-200/70 dark:border-amber-300/15" : "border-stone-200 dark:border-white/10";

  return (
    <li className={`border-b py-3 last:border-b-0 sm:py-2 ${borderClass}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60 ${
            isFavorite
              ? "border-amber-300 bg-amber-50 text-amber-600 shadow-[0_0_0_1px_rgb(245_158_11_/_0.18)] hover:border-amber-400 hover:bg-amber-100 dark:border-amber-300/75 dark:bg-amber-200/18 dark:text-amber-300 dark:shadow-[0_0_0_1px_rgb(251_191_36_/_0.25)] dark:hover:border-amber-100 dark:hover:bg-amber-200/24 dark:hover:text-amber-200"
              : "border-stone-200 bg-stone-50 text-stone-400 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-500 dark:hover:border-amber-300/60 dark:hover:bg-amber-300/10 dark:hover:text-amber-200"
          }`}
          disabled={favoriteSaving}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={isFavorite ? `Remove ${entry.title} from favorites` : `Add ${entry.title} to favorites`}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
        </button>

        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h4 className="min-w-0 max-w-full break-words text-base font-medium leading-snug text-stone-950 sm:truncate dark:text-stone-50">
              {entry.title}
            </h4>
            <span className="text-lg font-semibold tracking-tight text-stone-950 dark:text-stone-50">
              {formatShortDuration(durationDate)}
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">{durationLabel}</span>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:shrink-0 sm:justify-end">
          {entry.next_due_date || isPlan ? (
            <span className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium ${getToneClasses(due.tone)}`}>
              {due.label}
            </span>
          ) : null}
          {completedCount > 0 && !isPurchase ? (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">
              {completedCount} done
            </span>
          ) : null}
          {isPurchase && entry.price !== null ? (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600 dark:bg-white/[0.06] dark:text-stone-300">
              {formatMoney(entry.price, entry.metadata.currency)}
            </span>
          ) : null}
          {isPlan && planSession && canActOnPlanSession ? (
            <>
              <Button
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={planSessionSaving}
                onClick={() => onSetPlanSessionStatus(planSession, "completed")}
              >
                Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={planSessionSaving}
                onClick={() => onSetPlanSessionStatus(planSession, "missed")}
              >
                Missed
              </Button>
            </>
          ) : due.tone === "overdue" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={entryDoneSaving}
              onClick={onToggleAction}
            >
              Done
            </Button>
          ) : null}
          <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-400">
            {getEntryAreaCategoryLabel(entry)}
          </span>
        </div>
      </div>
      {actionExpanded && due.tone === "overdue" && !isPlan ? (
        <div className="mt-2 flex justify-end gap-2">
          <input
            type="date"
            value={doneDate}
            onChange={(event) => onDoneDateChange(event.target.value)}
            className="h-8 rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-700 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10"
            aria-label={`Done date for ${entry.title}`}
          />
          {isSubscription ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={donePrice}
              onChange={(event) => onDonePriceChange(event.target.value)}
              className="h-8 w-24 rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-700 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10"
              aria-label={`Price for ${entry.title}`}
              placeholder="Price"
            />
          ) : null}
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            disabled={entryDoneSaving || !doneDate || (isSubscription && !donePrice)}
            onClick={onMarkDone}
          >
            Save Done
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function CompactDashboardList({
  entries,
  planSessionsByEntryId,
  latestSubscriptionLogDates,
  onOpen,
  onToggleFavorite,
  onMarkDone,
  doneDates,
  donePrices,
  onDoneDateChange,
  onDonePriceChange,
  onSetPlanSessionStatus,
  favoriteSavingIds,
  entryDoneSavingIds,
  planSessionSavingIds,
  expandedDoneIds,
  onToggleDoneAction,
  accent = "neutral",
}: {
  entries: Entry[];
  planSessionsByEntryId: Map<string, PlanSession[]>;
  latestSubscriptionLogDates: Record<string, string>;
  onOpen: (entry: Entry) => void;
  onToggleFavorite: (entry: Entry) => void;
  onMarkDone: (entry: Entry) => void;
  doneDates: Record<string, string>;
  donePrices: Record<string, string>;
  onDoneDateChange: (entryId: string, date: string) => void;
  onDonePriceChange: (entryId: string, price: string) => void;
  onSetPlanSessionStatus: (session: PlanSession, status: PlanSessionStatus) => void;
  favoriteSavingIds: Set<string>;
  entryDoneSavingIds: Set<string>;
  planSessionSavingIds: Set<string>;
  expandedDoneIds: Set<string>;
  onToggleDoneAction: (entryId: string) => void;
  accent?: "amber" | "neutral";
}) {
  const shellClass =
    accent === "amber"
      ? "border-[#87d1ff] bg-amber-50/80 dark:border-amber-300/25 dark:bg-amber-200/10"
      : "border-[#87d1ff] bg-white/70 dark:border-white/10 dark:bg-white/[0.04]";

  return (
    <div className="p-4">
      <ul className={`rounded-xl border px-4 py-1 shadow-sm ${shellClass}`}>
        {entries.map((entry) => (
          <CompactDashboardListItem
            key={entry.id}
            entry={entry}
            planSessions={planSessionsByEntryId.get(entry.id) ?? []}
            latestSubscriptionLogDate={latestSubscriptionLogDates[entry.id]}
            onOpen={() => onOpen(entry)}
            onToggleFavorite={() => onToggleFavorite(entry)}
            onMarkDone={() => onMarkDone(entry)}
            doneDate={doneDates[entry.id] ?? getDateInputValue()}
            donePrice={donePrices[entry.id] ?? (entry.price !== null ? String(entry.price) : "")}
            onDoneDateChange={(date) => onDoneDateChange(entry.id, date)}
            onDonePriceChange={(price) => onDonePriceChange(entry.id, price)}
            onSetPlanSessionStatus={onSetPlanSessionStatus}
            favoriteSaving={favoriteSavingIds.has(entry.id)}
            entryDoneSaving={entryDoneSavingIds.has(entry.id)}
            planSessionSaving={Boolean(
              getNextScheduledPlanSession(planSessionsByEntryId.get(entry.id) ?? [])?.id &&
                planSessionSavingIds.has(getNextScheduledPlanSession(planSessionsByEntryId.get(entry.id) ?? [])!.id)
            )}
            actionExpanded={expandedDoneIds.has(entry.id)}
            onToggleAction={() => onToggleDoneAction(entry.id)}
            accent={accent}
          />
        ))}
      </ul>
    </div>
  );
}

function ReadingDashboardListItem({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const topic = getStringMetadata(entry, "reading_topic");
  const url = getStringMetadata(entry, "reading_url");

  return (
    <li className="border-b border-stone-200 py-2 last:border-b-0 dark:border-sky-300/15">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onOpen}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="line-clamp-1 text-sm font-semibold text-stone-950 dark:text-stone-50">{entry.title}</h4>
            {topic ? (
              <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-sky-300/10 dark:text-sky-100">
                {topic}
              </span>
            ) : null}
          </div>
        </button>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-stone-300 text-stone-600 transition hover:border-stone-500 hover:text-stone-950 dark:border-sky-300/30 dark:text-sky-100 dark:hover:border-sky-200/60 dark:hover:text-white"
            aria-label={`Open ${entry.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

function ReadingDashboardColumns({ entries, onOpen }: { entries: Entry[]; onOpen: (entry: Entry) => void }) {
  const sortReading = (items: Entry[]) =>
    [...items].sort((a, b) => {
      const topicCompare = (getStringMetadata(a, "reading_topic") || "General").localeCompare(
        getStringMetadata(b, "reading_topic") || "General"
      );
      return topicCompare || a.title.localeCompare(b.title);
    });
  const notes = sortReading(entries.filter((entry) => !getStringMetadata(entry, "reading_url")));
  const links = sortReading(entries.filter((entry) => getStringMetadata(entry, "reading_url")));

  const renderColumn = (items: Entry[], empty: string) => (
    <section className="rounded-xl border border-[#87d1ff] bg-white/70 px-4 py-2 shadow-sm dark:border-sky-300/20 dark:bg-sky-950/20">
      {items.length === 0 ? (
        <p className="py-2 text-sm text-stone-500 dark:text-stone-400">{empty}</p>
      ) : (
        <ul>
          {items.map((entry) => (
            <ReadingDashboardListItem key={entry.id} entry={entry} onOpen={() => onOpen(entry)} />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      {renderColumn(notes, "No standalone research notes.")}
      {renderColumn(links, "No linked reading items.")}
    </div>
  );
}

type EntrySectionProps = {
  group: EntryGroup;
  collapsed: boolean;
  planSessionsByEntryId: Map<string, PlanSession[]>;
  latestSubscriptionLogDates: Record<string, string>;
  onToggle: () => void;
  onOpen: (entry: Entry) => void;
  onToggleFavorite: (entry: Entry) => void;
  onMarkDone: (entry: Entry) => void;
  doneDates: Record<string, string>;
  donePrices: Record<string, string>;
  onDoneDateChange: (entryId: string, date: string) => void;
  onDonePriceChange: (entryId: string, price: string) => void;
  onSetPlanSessionStatus: (session: PlanSession, status: PlanSessionStatus) => void;
  favoriteSavingIds: Set<string>;
  entryDoneSavingIds: Set<string>;
  planSessionSavingIds: Set<string>;
  expandedDoneIds: Set<string>;
  onToggleDoneAction: (entryId: string) => void;
};

function EntrySection({
  group,
  collapsed,
  planSessionsByEntryId,
  latestSubscriptionLogDates,
  onToggle,
  onOpen,
  onToggleFavorite,
  onMarkDone,
  doneDates,
  donePrices,
  onDoneDateChange,
  onDonePriceChange,
  onSetPlanSessionStatus,
  favoriteSavingIds,
  entryDoneSavingIds,
  planSessionSavingIds,
  expandedDoneIds,
  onToggleDoneAction,
}: EntrySectionProps) {
  if (group.entries.length === 0) return null;
  const isFavoriteSection = group.title === "Favorites";
  const isReadingSection = group.title === "Reading list";
  const tone = sectionToneClasses[getSectionTone(group.title)];

  return (
    <section className={`overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm ${tone.shell}`}>
      <button
        type="button"
        className={`flex w-full items-center justify-between gap-4 border-b border-stone-200 bg-stone-50 px-4 py-3 text-left transition hover:bg-stone-100 ${tone.header}`}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold tracking-tight text-stone-950 dark:text-stone-50">{group.title}</h3>
          <span className={`rounded-full border border-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-600 ${tone.count}`}>
            {group.entries.length}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-stone-500 transition ${tone.chevron} ${collapsed ? "" : "rotate-180"}`} />
      </button>
      {collapsed ? null : isFavoriteSection ? (
        <CompactDashboardList
          entries={group.entries}
          planSessionsByEntryId={planSessionsByEntryId}
          latestSubscriptionLogDates={latestSubscriptionLogDates}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
          onMarkDone={onMarkDone}
          doneDates={doneDates}
          donePrices={donePrices}
          onDoneDateChange={onDoneDateChange}
          onDonePriceChange={onDonePriceChange}
          onSetPlanSessionStatus={onSetPlanSessionStatus}
          favoriteSavingIds={favoriteSavingIds}
          entryDoneSavingIds={entryDoneSavingIds}
          planSessionSavingIds={planSessionSavingIds}
          expandedDoneIds={expandedDoneIds}
          onToggleDoneAction={onToggleDoneAction}
          accent="amber"
        />
      ) : isReadingSection ? (
        <ReadingDashboardColumns entries={group.entries} onOpen={onOpen} />
      ) : (
        <CompactDashboardList
          entries={group.entries}
          planSessionsByEntryId={planSessionsByEntryId}
          latestSubscriptionLogDates={latestSubscriptionLogDates}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
          onMarkDone={onMarkDone}
          doneDates={doneDates}
          donePrices={donePrices}
          onDoneDateChange={onDoneDateChange}
          onDonePriceChange={onDonePriceChange}
          onSetPlanSessionStatus={onSetPlanSessionStatus}
          favoriteSavingIds={favoriteSavingIds}
          entryDoneSavingIds={entryDoneSavingIds}
          planSessionSavingIds={planSessionSavingIds}
          expandedDoneIds={expandedDoneIds}
          onToggleDoneAction={onToggleDoneAction}
        />
      )}
    </section>
  );
}

export default function Dashboard({ searchQuery = "" }: DashboardProps) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [planSessions, setPlanSessions] = useState<PlanSession[]>([]);
  const [latestSubscriptionLogDates, setLatestSubscriptionLogDates] = useState<Record<string, string>>({});
  const [areas, setAreas] = useState<EntryOption[]>([]);
  const [categories, setCategories] = useState<EntryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("created");
  const [error, setError] = useState<string | null>(null);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [adding, setAdding] = useState<ManagedKind | null>(null);
  const [favoriteSavingIds, setFavoriteSavingIds] = useState<Set<string>>(() => new Set());
  const [entryDoneSavingIds, setEntryDoneSavingIds] = useState<Set<string>>(() => new Set());
  const [doneDates, setDoneDates] = useState<Record<string, string>>({});
  const [donePrices, setDonePrices] = useState<Record<string, string>>({});
  const [planSessionSavingIds, setPlanSessionSavingIds] = useState<Set<string>>(() => new Set());
  const [expandedDoneIds, setExpandedDoneIds] = useState<Set<string>>(() => new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(["Upcoming", "Unscheduled"])
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entryData = await getAllEntries();
      const subscriptionIds = entryData.filter(isSubscriptionEntry).map((entry) => entry.id);
      const [planSessionData, areaData, categoryData, subscriptionHistory] = await Promise.all([
        getAllPlanSessions(),
        getAreas(),
        getCategories(),
        getHistoryForEntries(subscriptionIds),
      ]);
      setEntries(entryData);
      setPlanSessions(planSessionData);
      setLatestSubscriptionLogDates(getLatestLogDatesByEntryId(subscriptionHistory));
      setAreas(areaData);
      setCategories(categoryData);
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const refreshData = async () => {
    const entryData = await getAllEntries();
    const subscriptionIds = entryData.filter(isSubscriptionEntry).map((entry) => entry.id);
    const [planSessionData, areaData, categoryData, subscriptionHistory] = await Promise.all([
      getAllPlanSessions(),
      getAreas(),
      getCategories(),
      getHistoryForEntries(subscriptionIds),
    ]);
    setEntries(entryData);
    setPlanSessions(planSessionData);
    setLatestSubscriptionLogDates(getLatestLogDatesByEntryId(subscriptionHistory));
    setAreas(areaData);
    setCategories(categoryData);
  };

  const handleAddOption = async (kind: ManagedKind, name: string) => {
    setOptionError(null);
    try {
      if (kind === "area") {
        await insertArea(name);
      } else {
        await insertCategory(name);
      }
      setAdding(null);
      await refreshData();
    } catch (saveError) {
      console.error(saveError);
      setOptionError(saveError instanceof Error ? saveError.message : "Unable to add this item.");
    }
  };

  const handleRenameOption = async (kind: ManagedKind, option: EntryOption, nextName: string) => {
    setOptionError(null);
    try {
      if (kind === "area") {
        await renameArea(option, nextName);
        if (areaFilter === option.name) setAreaFilter(nextName.trim());
      } else {
        await renameCategory(option, nextName);
        if (categoryFilter === option.name) setCategoryFilter(nextName.trim());
      }
      await refreshData();
    } catch (saveError) {
      console.error(saveError);
      setOptionError(saveError instanceof Error ? saveError.message : "Unable to rename this item.");
      throw saveError;
    }
  };

  const handleToggleFavorite = async (entry: Entry) => {
    if (favoriteSavingIds.has(entry.id)) return;

    setError(null);
    setFavoriteSavingIds((current) => new Set(current).add(entry.id));
    const nextFavorite = !getBooleanMetadata(entry, "favorite");
    const nextMetadata = { ...entry.metadata, favorite: nextFavorite };

    try {
      await updateEntry(entry.id, { metadata: nextMetadata });
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? { ...item, metadata: nextMetadata, updated_at: new Date().toISOString() }
            : item
        )
      );
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update favorite.");
    } finally {
      setFavoriteSavingIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const handleSetPlanSessionStatus = async (session: PlanSession, status: PlanSessionStatus) => {
    if (planSessionSavingIds.has(session.id)) return;
    if ((status === "completed" || status === "missed") && !isPlanSessionActionable(session)) return;

    setError(null);
    setPlanSessionSavingIds((current) => new Set(current).add(session.id));
    try {
      await updatePlanSessionStatus(session.id, status);
      await refreshData();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update this plan session.");
    } finally {
      setPlanSessionSavingIds((current) => {
        const next = new Set(current);
        next.delete(session.id);
        return next;
      });
    }
  };

  const handleDoneDateChange = (entryId: string, date: string) => {
    setDoneDates((current) => ({ ...current, [entryId]: date }));
  };

  const handleDonePriceChange = (entryId: string, price: string) => {
    setDonePrices((current) => ({ ...current, [entryId]: price }));
  };

  const toggleDoneAction = (entryId: string) => {
    setExpandedDoneIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const handleMarkEntryDone = async (entry: Entry) => {
    if (entryDoneSavingIds.has(entry.id)) return;
    const doneDate = doneDates[entry.id] ?? getDateInputValue();
    if (!doneDate) return;
    const isSubscription = entry.category.toLocaleLowerCase() === "subscription";
    const rawPrice = donePrices[entry.id] ?? (entry.price !== null ? String(entry.price) : "");
    const parsedPrice = rawPrice.trim() ? Number(rawPrice) : null;
    if (isSubscription && (parsedPrice === null || !Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setError("Enter a valid subscription price.");
      return;
    }

    setError(null);
    setEntryDoneSavingIds((current) => new Set(current).add(entry.id));
    try {
      await logEntryAgain(
        entry,
        new Date(doneDate),
        isSubscription
          ? {
              price: parsedPrice,
              currency: typeof entry.metadata.currency === "string" ? entry.metadata.currency : null,
            }
          : {}
      );
      setDoneDates((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      setDonePrices((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      setExpandedDoneIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
      await refreshData();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to mark this entry done.");
    } finally {
      setEntryDoneSavingIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const toggleSection = (title: string) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const planSessionsByEntryId = useMemo(() => {
    const grouped = new Map<string, PlanSession[]>();
    planSessions.forEach((session) => {
      const group = grouped.get(session.entry_id) ?? [];
      group.push(session);
      grouped.set(session.entry_id, group);
    });
    return grouped;
  }, [planSessions]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
    const visibleEntries = entries.filter((entry) => !getBooleanMetadata(entry, "archived"));
    const byArea = areaFilter === "all" ? visibleEntries : visibleEntries.filter((entry) => entry.area === areaFilter);
    const byCategory = categoryFilter === "all" ? byArea : byArea.filter((entry) => entry.category === categoryFilter);
    const base = normalizedSearch
      ? byCategory.filter((entry) => getEntrySearchText(entry).includes(normalizedSearch))
      : byCategory;
    if (sortOption === "area") {
      return [...base].sort((a, b) => a.area.localeCompare(b.area));
    }
    if (sortOption === "overdue") {
      return [...base].sort((a, b) => {
        const aPlanSession = getNextScheduledPlanSession(planSessionsByEntryId.get(a.id) ?? []);
        const bPlanSession = getNextScheduledPlanSession(planSessionsByEntryId.get(b.id) ?? []);
        const aDueDate = isPlanEntry(a) ? aPlanSession?.session_date ?? null : a.next_due_date;
        const bDueDate = isPlanEntry(b) ? bPlanSession?.session_date ?? null : b.next_due_date;
        const aSummary = computeTimeSummary(a.entry_date, aDueDate);
        const bSummary = computeTimeSummary(b.entry_date, bDueDate);
        const aDue = aSummary.nextDueIn ?? Number.POSITIVE_INFINITY;
        const bDue = bSummary.nextDueIn ?? Number.POSITIVE_INFINITY;
        return aDue - bDue;
      });
    }
    return [...base].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [entries, areaFilter, categoryFilter, sortOption, searchQuery, planSessionsByEntryId]);

  const entryGroups = useMemo<EntryGroup[]>(() => {
    const favorites: Entry[] = [];
    const overdue: Entry[] = [];
    const today: Entry[] = [];
    const dueSoon: Entry[] = [];
    const upcoming: Entry[] = [];
    const readingList: Entry[] = [];
    const unscheduled: Entry[] = [];
    const recentlyCompleted: Entry[] = [];

    filteredEntries.forEach((entry) => {
      const planSession = getNextScheduledPlanSession(planSessionsByEntryId.get(entry.id) ?? []);
      const dueDate = isPlanEntry(entry) ? planSession?.session_date ?? null : entry.next_due_date;
      const summary = computeTimeSummary(entry.entry_date, dueDate);
      if (isReadingEntry(entry) && getReadingStatus(entry) !== "done") {
        readingList.push(entry);
        return;
      }
      if (getBooleanMetadata(entry, "favorite")) {
        favorites.push(entry);
        return;
      }
      if (dueDate && summary.isOverdue) {
        overdue.push(entry);
      } else if (dueDate && summary.nextDueIn === 0) {
        today.push(entry);
      } else if (dueDate && (summary.nextDueIn ?? 0) <= 7) {
        dueSoon.push(entry);
      } else if (dueDate) {
        upcoming.push(entry);
      } else if (getNumberMetadata(entry, "completed_count") > 0 && summary.daysPassed <= 14) {
        recentlyCompleted.push(entry);
      } else {
        unscheduled.push(entry);
      }
    });

    return [
      {
        title: "Favorites",
        description: "Pinned memories you want close at hand.",
        entries: sortDashboardGroup("Favorites", favorites),
      },
      {
        title: "Reading list",
        description: "Links and topics waiting for focused reading.",
        entries: sortDashboardGroup("Reading list", readingList),
      },
      {
        title: "Overdue",
        description: "Items that have crossed their due date.",
        entries: sortDashboardGroup("Overdue", overdue),
      },
      {
        title: "Today",
        description: "Ready to be handled now.",
        entries: sortDashboardGroup("Today", today),
      },
      {
        title: "Due soon",
        description: "Coming up in the next 7 days.",
        entries: sortDashboardGroup("Due soon", dueSoon),
      },
      {
        title: "Upcoming",
        description: "Scheduled for later.",
        entries: sortDashboardGroup("Upcoming", upcoming),
      },
      {
        title: "Recently completed",
        description: "Logged again in the last two weeks.",
        entries: sortDashboardGroup("Recently completed", recentlyCompleted),
      },
      {
        title: "Unscheduled",
        description: "Tracked memories without a next due date.",
        entries: sortDashboardGroup("Unscheduled", unscheduled),
      },
    ];
  }, [filteredEntries, planSessionsByEntryId]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="order-1 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] lg:hidden">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">Area</span>
            <select
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition hover:border-stone-300 dark:border-white/10 dark:bg-stone-950 dark:text-stone-100 dark:hover:border-white/20"
            >
              <option value="all">All areas</option>
              {areas.map((option) => (
                <option key={option.id} value={option.name}>
                  {formatOptionLabel(option.name)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition hover:border-stone-300 dark:border-white/10 dark:bg-stone-950 dark:text-stone-100 dark:hover:border-white/20"
            >
              <option value="all">All categories</option>
              {categories.map((option) => (
                <option key={option.id} value={option.name}>
                  {formatOptionLabel(option.name)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">Sort</span>
            <select
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value as SortOption)}
              className="mt-1 h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition hover:border-stone-300 dark:border-white/10 dark:bg-stone-950 dark:text-stone-100 dark:hover:border-white/20"
            >
              <option value="created">Newest first</option>
              <option value="overdue">Most overdue</option>
              <option value="area">Area</option>
            </select>
          </label>
        </div>
      </div>

      <div className="order-2 min-w-0 lg:order-1">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center text-sm text-stone-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-400">
            Loading entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center dark:border-white/10 dark:bg-white/[0.04]">
            <h3 className="text-lg font-semibold text-stone-950 dark:text-stone-50">
              {searchQuery.trim() ? "No entries match your search" : "No entries yet"}
            </h3>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {searchQuery.trim()
                ? "Try a different title, area, category, note, tag, attachment, or form field value."
                : "Add the first memory you want GUIDR to keep for you."}
            </p>
            {searchQuery.trim() ? null : (
              <Link className="mt-4 inline-flex h-10 items-center rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white" to="/add">
                Add your first entry
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {entryGroups.map((group) => (
              <EntrySection
                key={group.title}
                group={group}
                collapsed={collapsedSections.has(group.title)}
                planSessionsByEntryId={planSessionsByEntryId}
                latestSubscriptionLogDates={latestSubscriptionLogDates}
                onToggle={() => toggleSection(group.title)}
                onOpen={(entry) =>
                  navigate(isPlanEntry(entry) ? "/plans" : isReadingEntry(entry) ? `/reading?focus=${entry.id}` : `/entry/${entry.id}`)
                }
                onToggleFavorite={handleToggleFavorite}
                onMarkDone={handleMarkEntryDone}
                doneDates={doneDates}
                donePrices={donePrices}
                onDoneDateChange={handleDoneDateChange}
                onDonePriceChange={handleDonePriceChange}
                onSetPlanSessionStatus={handleSetPlanSessionStatus}
                favoriteSavingIds={favoriteSavingIds}
                entryDoneSavingIds={entryDoneSavingIds}
                planSessionSavingIds={planSessionSavingIds}
                expandedDoneIds={expandedDoneIds}
                onToggleDoneAction={toggleDoneAction}
              />
            ))}
          </div>
        )}
      </div>

      <aside className="hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] lg:sticky lg:top-24 lg:order-2 lg:block">
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-700 dark:text-stone-200">Areas</p>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:text-stone-50"
                onClick={() => setAdding("area")}
                aria-label="Add a new Area type"
                title="Add a new Area type"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant={areaFilter === "all" ? "default" : "outline"}
                size="sm"
                className={`${
                  areaFilter === "all" ? "text-white dark:text-stone-950" : "text-stone-900 dark:text-stone-100"
                }`}
                onClick={() => setAreaFilter("all")}
              >
                All
              </Button>
              {areas.map((option) => (
                <EditableOptionButton
                  key={option.id}
                  active={areaFilter === option.name}
                  option={option}
                  onSelect={() => setAreaFilter(option.name)}
                  onRename={(nextName) => handleRenameOption("area", option, nextName)}
                />
              ))}
              <AddOptionControl
                active={adding === "area"}
                onCancel={() => setAdding(null)}
                onSave={(name) => handleAddOption("area", name)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-700 dark:text-stone-200">Categories</p>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:text-stone-50"
                onClick={() => setAdding("category")}
                aria-label="Add a new Category type"
                title="Add a new Category type"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant={categoryFilter === "all" ? "default" : "outline"}
                size="sm"
                className={`${
                  categoryFilter === "all" ? "text-white dark:text-stone-950" : "text-stone-900 dark:text-stone-100"
                }`}
                onClick={() => setCategoryFilter("all")}
              >
                All categories
              </Button>
              {categories.map((option) => (
                <EditableOptionButton
                  key={option.id}
                  active={categoryFilter === option.name}
                  option={option}
                  onSelect={() => setCategoryFilter(option.name)}
                  onRename={(nextName) => handleRenameOption("category", option, nextName)}
                />
              ))}
              <AddOptionControl
                active={adding === "category"}
                onCancel={() => setAdding(null)}
                onSave={(name) => handleAddOption("category", name)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500" htmlFor="sort-select">
              Sort
            </label>
            <select
              id="sort-select"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value as SortOption)}
              className="mt-3 h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition hover:border-stone-300 dark:border-white/10 dark:bg-stone-950 dark:text-stone-200 dark:hover:border-white/20"
            >
              <option value="created">Newest first</option>
              <option value="overdue">Most overdue</option>
              <option value="area">Area</option>
            </select>
          </div>

          {optionError ? <p className="text-sm text-rose-600">{optionError}</p> : null}
        </div>
      </aside>
    </section>
  );
}
