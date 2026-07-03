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
  insertArea,
  insertCategory,
  logEntryAgain,
  renameArea,
  renameCategory,
  updateEntry,
} from "@/lib/db";
import { getAllPlanSessions, updatePlanSessionStatus } from "@/lib/plans";
import type { Entry, EntryOption } from "@/types/entry";
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

function getBooleanMetadata(entry: Entry, key: string) {
  return entry.metadata[key] === true;
}

function getNumberMetadata(entry: Entry, key: string) {
  return typeof entry.metadata[key] === "number" ? entry.metadata[key] : 0;
}

function getStringMetadata(entry: Entry, key: string) {
  return typeof entry.metadata[key] === "string" ? entry.metadata[key] : "";
}

function getTags(entry: Entry) {
  return Array.isArray(entry.metadata.tags)
    ? entry.metadata.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
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
  return entry.category.toLocaleLowerCase() === "plan" || typeof entry.metadata.plan_type === "string";
}

function isReadingEntry(entry: Entry) {
  return entry.category.toLocaleLowerCase() === "reading";
}

function getReadingStatus(entry: Entry) {
  return typeof entry.metadata.reading_status === "string" ? entry.metadata.reading_status : "to_read";
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

type MemoryCardProps = {
  entry: Entry;
  planSessions?: PlanSession[];
  onOpen: () => void;
  onToggleFavorite: () => void;
  onMarkDone: () => void;
  doneDate: string;
  onDoneDateChange: (date: string) => void;
  onSetPlanSessionStatus: (session: PlanSession, status: PlanSessionStatus) => void;
  favoriteSaving: boolean;
  entryDoneSaving: boolean;
  planSessionSaving: boolean;
};

function MemoryCard({
  entry,
  planSessions = [],
  onOpen,
  onToggleFavorite,
  onMarkDone,
  doneDate,
  onDoneDateChange,
  onSetPlanSessionStatus,
  favoriteSaving,
  entryDoneSaving,
  planSessionSaving,
}: MemoryCardProps) {
  const isPurchase = entry.category.toLocaleLowerCase() === "purchase";
  const isPlan = isPlanEntry(entry);
  const planSession = isPlan ? getNextScheduledPlanSession(planSessions) : null;
  const planLastDoneDate = isPlan ? getLatestCompletedPlanSessionDate(planSessions) : null;
  const dueEntry = isPlan ? { ...entry, next_due_date: planSession?.session_date ?? null } : entry;
  const due = getDueCopy(dueEntry);
  const tags = getTags(entry);
  const isFavorite = getBooleanMetadata(entry, "favorite");
  const completedCount = getNumberMetadata(entry, "completed_count");
  const durationDate = isPlan && planLastDoneDate ? planLastDoneDate : entry.entry_date;
  const durationLabel = isPlan ? (planLastDoneDate ? "since last done" : "since start") : "since last logged";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer text-left"
    >
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.06]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-700 dark:text-stone-200">
              {formatOptionLabel(entry.area)} / {formatOptionLabel(entry.category)}
            </p>
            <h3 className="mt-2 line-clamp-2 text-base font-medium leading-snug text-stone-950 dark:text-stone-50">{entry.title}</h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              disabled={favoriteSaving}
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite();
              }}
              onKeyDown={(event) => event.stopPropagation()}
              className={`grid h-7 w-7 place-items-center rounded-lg border transition ${
                isFavorite
                  ? "border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
                  : "border-stone-200 bg-stone-50 text-stone-400 hover:border-stone-300 hover:text-stone-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-500 dark:hover:border-white/20 dark:hover:text-stone-200"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              aria-label={isFavorite ? `Remove ${entry.title} from favorites` : `Add ${entry.title} to favorites`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
            </button>
            {isPurchase && entry.price !== null ? (
              <div className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-300">
                {formatMoney(entry.price, entry.metadata.currency)}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">
            {formatShortDuration(durationDate)}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{durationLabel}</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className={`rounded-xl border px-2.5 py-1.5 text-xs ${getToneClasses(due.tone)}`}>
            <p className="font-medium leading-tight">{due.label}</p>
            <p className="mt-0.5 text-[11px] leading-tight opacity-70">{due.detail}</p>
          </div>
          <div className="flex min-w-0 shrink-0 flex-wrap justify-end gap-1.5">
            {completedCount > 0 ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">
                {completedCount} done
              </span>
            ) : null}
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
        {due.tone === "overdue" && !isPlan ? (
          <div className="mt-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
            <input
              type="date"
              value={doneDate}
              onChange={(event) => onDoneDateChange(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-700 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10"
              aria-label={`Done date for ${entry.title}`}
            />
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={entryDoneSaving || !doneDate}
              onClick={onMarkDone}
            >
              Done
            </Button>
          </div>
        ) : null}
        {isPlan && planSession ? (
          <div className="mt-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
            <Button
              size="sm"
              className="h-8 flex-1 px-2 text-xs"
              disabled={planSessionSaving}
              onClick={() => onSetPlanSessionStatus(planSession, "completed")}
            >
              Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 flex-1 px-2 text-xs"
              disabled={planSessionSaving}
              onClick={() => onSetPlanSessionStatus(planSession, "missed")}
            >
              Missed
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReadingDashboardCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const topic = getStringMetadata(entry, "reading_topic");
  const url = getStringMetadata(entry, "reading_url");

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onOpen}>
          <h4 className="line-clamp-2 text-sm font-semibold text-stone-950 dark:text-stone-50">{entry.title}</h4>
          {topic ? (
            <span className="mt-2 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 dark:bg-white/[0.06] dark:text-stone-300">
              {topic}
            </span>
          ) : null}
        </button>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-stone-300 text-stone-600 transition hover:border-stone-500 hover:text-stone-950 dark:border-white/15 dark:text-stone-300 dark:hover:border-white/35 dark:hover:text-stone-50"
            aria-label={`Open ${entry.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

type EntrySectionProps = {
  group: EntryGroup;
  collapsed: boolean;
  planSessionsByEntryId: Map<string, PlanSession[]>;
  onToggle: () => void;
  onOpen: (entry: Entry) => void;
  onToggleFavorite: (entry: Entry) => void;
  onMarkDone: (entry: Entry) => void;
  doneDates: Record<string, string>;
  onDoneDateChange: (entryId: string, date: string) => void;
  onSetPlanSessionStatus: (session: PlanSession, status: PlanSessionStatus) => void;
  favoriteSavingIds: Set<string>;
  entryDoneSavingIds: Set<string>;
  planSessionSavingIds: Set<string>;
};

function EntrySection({
  group,
  collapsed,
  planSessionsByEntryId,
  onToggle,
  onOpen,
  onToggleFavorite,
  onMarkDone,
  doneDates,
  onDoneDateChange,
  onSetPlanSessionStatus,
  favoriteSavingIds,
  entryDoneSavingIds,
  planSessionSavingIds,
}: EntrySectionProps) {
  if (group.entries.length === 0) return null;
  const isReadingSection = group.title === "Reading list";

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 border-b border-stone-200 bg-stone-50 px-5 py-4 text-left transition hover:bg-stone-100 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-stone-950 dark:text-stone-50">{group.title}</h3>
            <span className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-600 dark:border-white/10 dark:text-stone-300">
              {group.entries.length}
            </span>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">{group.description}</p>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-stone-500 transition dark:text-stone-400 ${collapsed ? "" : "rotate-180"}`} />
      </button>
      {collapsed ? null : (
        <div className={`grid gap-4 p-5 ${isReadingSection ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"}`}>
          {group.entries.map((entry) => {
            const planSessions = planSessionsByEntryId.get(entry.id) ?? [];
            const nextPlanSession = getNextScheduledPlanSession(planSessions);
            return isReadingSection ? (
              <ReadingDashboardCard
                key={entry.id}
                entry={entry}
                onOpen={() => onOpen(entry)}
              />
            ) : (
              <MemoryCard
                key={entry.id}
                entry={entry}
                planSessions={planSessions}
                onOpen={() => onOpen(entry)}
                onToggleFavorite={() => onToggleFavorite(entry)}
                onMarkDone={() => onMarkDone(entry)}
                doneDate={doneDates[entry.id] ?? getDateInputValue()}
                onDoneDateChange={(date) => onDoneDateChange(entry.id, date)}
                onSetPlanSessionStatus={onSetPlanSessionStatus}
                favoriteSaving={favoriteSavingIds.has(entry.id)}
                entryDoneSaving={entryDoneSavingIds.has(entry.id)}
                planSessionSaving={Boolean(nextPlanSession?.id && planSessionSavingIds.has(nextPlanSession.id))}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function Dashboard({ searchQuery = "" }: DashboardProps) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [planSessions, setPlanSessions] = useState<PlanSession[]>([]);
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
  const [planSessionSavingIds, setPlanSessionSavingIds] = useState<Set<string>>(() => new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(["Upcoming", "Unscheduled"])
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entryData, planSessionData, areaData, categoryData] = await Promise.all([
        getAllEntries(),
        getAllPlanSessions(),
        getAreas(),
        getCategories(),
      ]);
      setEntries(entryData);
      setPlanSessions(planSessionData);
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
    const [entryData, planSessionData, areaData, categoryData] = await Promise.all([
      getAllEntries(),
      getAllPlanSessions(),
      getAreas(),
      getCategories(),
    ]);
    setEntries(entryData);
    setPlanSessions(planSessionData);
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

  const handleMarkEntryDone = async (entry: Entry) => {
    if (entryDoneSavingIds.has(entry.id)) return;
    const doneDate = doneDates[entry.id] ?? getDateInputValue();
    if (!doneDate) return;

    setError(null);
    setEntryDoneSavingIds((current) => new Set(current).add(entry.id));
    try {
      const loggedAt = new Date(doneDate);
      await logEntryAgain(entry, loggedAt);
      setDoneDates((current) => {
        const next = { ...current };
        delete next[entry.id];
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
        entries: favorites,
      },
      {
        title: "Reading list",
        description: "Links and topics waiting for focused reading.",
        entries: readingList,
      },
      {
        title: "Overdue",
        description: "Items that have crossed their due date.",
        entries: overdue,
      },
      {
        title: "Today",
        description: "Ready to be handled now.",
        entries: today,
      },
      {
        title: "Due soon",
        description: "Coming up in the next 7 days.",
        entries: dueSoon,
      },
      {
        title: "Upcoming",
        description: "Scheduled for later.",
        entries: upcoming,
      },
      {
        title: "Recently completed",
        description: "Logged again in the last two weeks.",
        entries: recentlyCompleted,
      },
      {
        title: "Unscheduled",
        description: "Tracked memories without a next due date.",
        entries: unscheduled,
      },
    ];
  }, [filteredEntries, planSessionsByEntryId]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0">
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
                onToggle={() => toggleSection(group.title)}
                onOpen={(entry) => navigate(isPlanEntry(entry) ? "/plans" : `/entry/${entry.id}`)}
                onToggleFavorite={handleToggleFavorite}
                onMarkDone={handleMarkEntryDone}
                doneDates={doneDates}
                onDoneDateChange={handleDoneDateChange}
                onSetPlanSessionStatus={handleSetPlanSessionStatus}
                favoriteSavingIds={favoriteSavingIds}
                entryDoneSavingIds={entryDoneSavingIds}
                planSessionSavingIds={planSessionSavingIds}
              />
            ))}
          </div>
        )}
      </div>

      <aside className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] lg:sticky lg:top-24">
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
