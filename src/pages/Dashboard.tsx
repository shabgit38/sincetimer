import { useCallback, useEffect, useMemo, useState } from "react";
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
  renameArea,
  renameCategory,
} from "@/lib/db";
import type { Entry, EntryOption } from "@/types/entry";

type SortOption = "created" | "overdue" | "area";
type ManagedKind = "area" | "category";

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
        className="rounded-r-none"
      >
        {formatOptionLabel(option.name)}
      </Button>
      <Button
        variant={active ? "default" : "outline"}
        size="sm"
        className="w-8 rounded-l-none border-l-0 px-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
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
  onStart: () => void;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
};

function AddOptionControl({ active, onStart, onCancel, onSave }: AddOptionControlProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  if (!active) {
    return (
      <Button variant="outline" size="sm" onClick={onStart}>
        + Add
      </Button>
    );
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

function getTags(entry: Entry) {
  return Array.isArray(entry.metadata.tags)
    ? entry.metadata.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
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
  onOpen: () => void;
};

function MemoryCard({ entry, onOpen }: MemoryCardProps) {
  const due = getDueCopy(entry);
  const isPurchase = entry.category.toLocaleLowerCase() === "purchase";
  const tags = getTags(entry);
  const isFavorite = getBooleanMetadata(entry, "favorite");
  const completedCount = getNumberMetadata(entry, "completed_count");

  return (
    <button type="button" onClick={onOpen} className="group text-left">
      <div className="min-h-56 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.06]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-400 dark:text-stone-500">
              {formatOptionLabel(entry.area)} / {formatOptionLabel(entry.category)}
            </p>
            <h3 className="mt-3 text-base font-medium text-stone-950 dark:text-stone-50">{entry.title}</h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isFavorite ? (
              <div className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                Favorite
              </div>
            ) : null}
            {isPurchase && entry.price !== null ? (
              <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-300">
                {formatMoney(entry.price, entry.metadata.currency)}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">
            {formatYearMonthDayDuration(entry.entry_date).replace(/ ago$/, "")}
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">since last logged</p>
        </div>

        <div className="mt-7 flex items-end justify-between gap-4">
          <div className={`rounded-2xl border px-3 py-2 text-sm ${getToneClasses(due.tone)}`}>
            <p className="font-medium">{due.label}</p>
            <p className="mt-0.5 text-xs opacity-70">{due.detail}</p>
          </div>
          <span className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-500 transition group-hover:border-stone-300 group-hover:text-stone-950 dark:border-white/10 dark:text-stone-400 dark:group-hover:border-white/20 dark:group-hover:text-stone-50">
            Open
          </span>
        </div>
        {(tags.length > 0 || completedCount > 0) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {completedCount > 0 ? (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">
                {completedCount} completed
              </span>
            ) : null}
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

type EntrySectionProps = {
  group: EntryGroup;
  onOpen: (entry: Entry) => void;
};

function EntrySection({ group, onOpen }: EntrySectionProps) {
  if (group.entries.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-stone-950 dark:text-stone-50">{group.title}</h3>
        <p className="text-sm text-stone-500 dark:text-stone-400">{group.description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {group.entries.map((entry) => (
          <MemoryCard key={entry.id} entry={entry} onOpen={() => onOpen(entry)} />
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [areas, setAreas] = useState<EntryOption[]>([]);
  const [categories, setCategories] = useState<EntryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("created");
  const [error, setError] = useState<string | null>(null);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [adding, setAdding] = useState<ManagedKind | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entryData, areaData, categoryData] = await Promise.all([
        getAllEntries(),
        getAreas(),
        getCategories(),
      ]);
      setEntries(entryData);
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
    const [entryData, areaData, categoryData] = await Promise.all([
      getAllEntries(),
      getAreas(),
      getCategories(),
    ]);
    setEntries(entryData);
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

  const filteredEntries = useMemo(() => {
    const visibleEntries = entries.filter((entry) => !getBooleanMetadata(entry, "archived"));
    const byArea = areaFilter === "all" ? visibleEntries : visibleEntries.filter((entry) => entry.area === areaFilter);
    const base = categoryFilter === "all" ? byArea : byArea.filter((entry) => entry.category === categoryFilter);
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
  }, [entries, areaFilter, categoryFilter, sortOption]);

  const entryGroups = useMemo<EntryGroup[]>(() => {
    const favorites: Entry[] = [];
    const overdue: Entry[] = [];
    const today: Entry[] = [];
    const dueSoon: Entry[] = [];
    const upcoming: Entry[] = [];
    const unscheduled: Entry[] = [];
    const recentlyCompleted: Entry[] = [];

    filteredEntries.forEach((entry) => {
      const summary = computeTimeSummary(entry.entry_date, entry.next_due_date);
      if (getBooleanMetadata(entry, "favorite")) {
        favorites.push(entry);
        return;
      }
      if (entry.next_due_date && summary.isOverdue) {
        overdue.push(entry);
      } else if (entry.next_due_date && summary.nextDueIn === 0) {
        today.push(entry);
      } else if (entry.next_due_date && (summary.nextDueIn ?? 0) <= 7) {
        dueSoon.push(entry);
      } else if (entry.next_due_date) {
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
  }, [filteredEntries]);

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">What needs attention?</h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">A calm memory layer for recurring life maintenance.</p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white" to="/add">
          Add Entry
        </Link>
      </div>

      <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={areaFilter === "all" ? "default" : "outline"}
            size="sm"
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
            onStart={() => setAdding("area")}
            onCancel={() => setAdding(null)}
            onSave={(name) => handleAddOption("area", name)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
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
              onStart={() => setAdding("category")}
              onCancel={() => setAdding(null)}
              onSave={(name) => handleAddOption("category", name)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-stone-500 dark:text-stone-400" htmlFor="sort-select">
              Sort
            </label>
            <select
              id="sort-select"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value as SortOption)}
              className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition hover:border-stone-300 dark:border-white/10 dark:bg-stone-950 dark:text-stone-200 dark:hover:border-white/20"
            >
              <option value="created">Newest first</option>
              <option value="overdue">Most overdue</option>
              <option value="area">Area</option>
            </select>
          </div>
        </div>
        {optionError ? <p className="text-sm text-rose-600">{optionError}</p> : null}
      </div>

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
          <h3 className="text-lg font-semibold text-stone-950 dark:text-stone-50">No entries yet</h3>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Add the first memory you want Since Timer to keep for you.
          </p>
          <Link className="mt-4 inline-flex h-10 items-center rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white" to="/add">
            Add your first entry
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {entryGroups.map((group) => (
            <EntrySection
              key={group.title}
              group={group}
              onOpen={(entry) => navigate(`/entry/${entry.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
