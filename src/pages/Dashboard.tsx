import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { computeTimeSummary } from "@/lib/timeUtils";
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
          className="h-8 w-32 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-700"
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
        className="rounded-l-none border-l-0 px-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={() => setEditing(true)}
      >
        Edit
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
        className="h-8 w-36 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-700"
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
    const byArea = areaFilter === "all" ? entries : entries.filter((entry) => entry.area === areaFilter);
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
        {optionError ? <p className="text-sm text-rose-600">{optionError}</p> : null}
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
                        {entry.area} / {entry.category}
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
