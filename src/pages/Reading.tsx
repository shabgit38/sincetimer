import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Pencil, Save as SaveIcon, Star, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getAllEntries, insertEntry, updateEntry } from "@/lib/db";
import type { Entry, EntryPayload } from "@/types/entry";

type ReadingStatus = "to_read" | "reading" | "done";

type ReadingEditDraft = {
  title: string;
  url: string;
  topic: string;
  status: ReadingStatus;
  entryDate: string;
  completedDate: string;
  notes: string;
  priority: string;
  favorite: boolean;
  archived: boolean;
};

const inputClass =
  "h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10";
const textareaClass =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10";

function normalizeCategory(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
}

function getStringMetadata(entry: Entry, key: string) {
  return typeof entry.metadata[key] === "string" ? entry.metadata[key] as string : "";
}

function getNumberMetadata(entry: Entry, key: string) {
  return typeof entry.metadata[key] === "number" ? entry.metadata[key] as number : null;
}

function withoutCompletedCount(metadata: Record<string, unknown>) {
  const nextMetadata = { ...metadata };
  delete nextMetadata.completed_count;
  return nextMetadata;
}

function getReadingStatus(entry: Entry): ReadingStatus {
  const status = getStringMetadata(entry, "reading_status");
  if (status === "reading" || status === "done") return status;
  return "to_read";
}

function getDateInputValue(date: Date | string = new Date()) {
  const localDate = typeof date === "string" ? new Date(date) : new Date(date);
  if (Number.isNaN(localDate.getTime())) return "";
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return localDate.toISOString().slice(0, 10);
}

function getIsoFromDateInput(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function getDaysSince(dateValue: string) {
  const logged = new Date(dateValue);
  if (Number.isNaN(logged.getTime())) return null;
  const today = new Date();
  const start = new Date(logged.getFullYear(), logged.getMonth(), logged.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function getReadingStartedDate(entry: Entry) {
  return getStringMetadata(entry, "reading_started_date");
}

function getCompletedDate(entry: Entry) {
  return getStringMetadata(entry, "reading_completed_date");
}

function getReadingDraft(entry: Entry): ReadingEditDraft {
  const priority = getNumberMetadata(entry, "reading_priority");
  return {
    title: entry.title,
    url: getStringMetadata(entry, "reading_url"),
    topic: getStringMetadata(entry, "reading_topic"),
    status: getReadingStatus(entry),
    entryDate: getDateInputValue(entry.entry_date),
    completedDate: getCompletedDate(entry) ? getDateInputValue(getCompletedDate(entry)) : "",
    notes: entry.notes ?? "",
    priority: priority ? String(priority) : "",
    favorite: entry.metadata.favorite === true,
    archived: entry.metadata.archived === true,
  };
}

function getReadingStatusRank(status: ReadingStatus) {
  if (status === "reading") return 0;
  if (status === "to_read") return 1;
  return 2;
}

function statusChipClass(status: ReadingStatus) {
  if (status === "done") {
    return "border border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-300/70 dark:bg-emerald-300 dark:text-emerald-950";
  }
  if (status === "reading") {
    return "border border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-300/70 dark:bg-sky-300 dark:text-sky-950";
  }
  return "border border-stone-300 bg-stone-100 text-stone-800 dark:border-white/20 dark:bg-white/[0.12] dark:text-stone-100";
}

function ReadingListItem({
  entry,
  onStatusChange,
  onToggleFavorite,
  onStartEdit,
  statusSaving,
  focused,
  itemRef,
}: {
  entry: Entry;
  onStatusChange: (entry: Entry, status: ReadingStatus) => void;
  onToggleFavorite: (entry: Entry) => void;
  onStartEdit: (entry: Entry) => void;
  statusSaving: boolean;
  focused: boolean;
  itemRef: (node: HTMLDivElement | null) => void;
}) {
  const url = getStringMetadata(entry, "reading_url");
  const topic = getStringMetadata(entry, "reading_topic") || "General";
  const status = getReadingStatus(entry);
  const priority = getNumberMetadata(entry, "reading_priority");
  const readingStartedDate = getReadingStartedDate(entry);
  const elapsedDays = status === "reading" && readingStartedDate
    ? getDaysSince(readingStartedDate)
    : status === "to_read"
      ? getDaysSince(entry.entry_date)
      : null;
  const completedDate = getCompletedDate(entry);
  const isFavorite = entry.metadata.favorite === true;

  return (
    <div
      ref={itemRef}
      className={`rounded-xl border-b border-stone-200 px-2 py-3 last:border-b-0 dark:border-white/10 ${
        focused ? "bg-sky-50 ring-2 ring-sky-300/70 dark:bg-sky-400/10 dark:ring-sky-300/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">{topic}</p>
          <h3 className="mt-1 break-words text-sm font-semibold text-stone-950 dark:text-stone-50">{entry.title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${isFavorite ? "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-300/50 dark:bg-amber-300/10 dark:text-amber-200" : "border-stone-300 text-stone-500 hover:border-amber-300 hover:text-amber-600 dark:border-white/15 dark:text-stone-400 dark:hover:border-amber-300/50 dark:hover:text-amber-200"}`}
            onClick={() => onToggleFavorite(entry)}
            aria-label={isFavorite ? `Remove ${entry.title} from favorites` : `Add ${entry.title} to favorites`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        {url ? (
          <a
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-stone-600 transition hover:border-stone-500 hover:text-stone-950 dark:border-white/15 dark:text-stone-300 dark:hover:border-white/35 dark:hover:text-stone-50"
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${entry.title}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-9 border-sky-300/70 bg-transparent px-0 text-sky-700 hover:border-sky-400 hover:bg-sky-50 dark:border-sky-300/65 dark:bg-transparent dark:text-sky-200 dark:hover:border-sky-200 dark:hover:bg-sky-400/10"
            onClick={() => onStartEdit(entry)}
            aria-label={`Edit ${entry.title}`}
            title="Edit"
          >
            <Pencil className="h-[18px] w-[18px] stroke-[2.4]" />
          </Button>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusChipClass(status)}`}>
            {status === "reading" ? "Reading" : status === "done" ? "Done" : "To read"}
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center justify-start gap-1.5 text-[11px] sm:w-auto sm:justify-end">
          <select
              className={`${inputClass} h-8 cursor-pointer py-0 disabled:cursor-wait disabled:opacity-70`}
              value=""
              onChange={(event) => {
                if (event.target.value) onStatusChange(entry, event.target.value as ReadingStatus);
              }}
              disabled={statusSaving}
              aria-label={`Reading status for ${entry.title}`}
            >
              <option value="" disabled>Update status</option>
              <option value="to_read">To read</option>
              <option value="reading">Reading</option>
              <option value="done">Done</option>
            </select>
          {priority ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600 dark:bg-white/[0.06] dark:text-stone-300">
              Priority {priority}
            </span>
          ) : null}
          {status !== "done" ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600 dark:bg-white/[0.06] dark:text-stone-300">
              {elapsedDays === null
                ? "Date unknown"
                : `${elapsedDays} days since ${status === "reading" ? "reading" : "created"}`}
            </span>
          ) : null}
          {completedDate ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600 dark:bg-white/[0.06] dark:text-stone-300">
              Completed {getDateInputValue(completedDate)}
            </span>
          ) : null}
        </div>
      </div>
      {entry.notes ? <p className="mt-2 whitespace-pre-line text-sm text-stone-600 dark:text-stone-300">{entry.notes}</p> : null}
    </div>
  );
}

function ReadingEditForm({
  draft,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  draft: ReadingEditDraft;
  saving: boolean;
  onChange: (draft: ReadingEditDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">
          Title
          <input className={inputClass} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">
          Link
          <input className={inputClass} value={draft.url} onChange={(event) => onChange({ ...draft, url: event.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">
          Topic
          <input className={inputClass} value={draft.topic} onChange={(event) => onChange({ ...draft, topic: event.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">
          Reading status
          <select className={inputClass} value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as ReadingStatus })}>
            <option value="to_read">To read</option>
            <option value="reading">Reading</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">
          Saved date
          <input
            className={inputClass}
            type="date"
            value={draft.entryDate}
            onChange={(event) => onChange({ ...draft, entryDate: event.target.value })}
          />
        </label>
        {draft.status === "done" ? (
          <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">
            Completed date
            <input
              className={inputClass}
              type="date"
              value={draft.completedDate}
              onChange={(event) => onChange({ ...draft, completedDate: event.target.value })}
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">
          Priority
          <input
            className={inputClass}
            type="number"
            min="1"
            max="5"
            value={draft.priority}
            onChange={(event) => onChange({ ...draft, priority: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300 md:col-span-2">
          Notes / highlights / learnings
          <textarea
            className={`${textareaClass} min-h-20`}
            value={draft.notes}
            onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300">
          <input type="checkbox" checked={draft.favorite} onChange={(event) => onChange({ ...draft, favorite: event.target.checked })} /> Favorite
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300">
          <input type="checkbox" checked={draft.archived} onChange={(event) => onChange({ ...draft, archived: event.target.checked })} /> Archived
        </label>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" className="w-8 !px-0" variant="outline" onClick={onCancel} disabled={saving} title="Cancel reading changes" aria-label="Cancel reading changes">
          <X className="h-4 w-4" />
        </Button>
        <Button size="sm" className="w-8 !px-0" onClick={onSave} disabled={saving} title="Save reading changes" aria-label="Save reading changes">
          <SaveIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Reading() {
  const [searchParams] = useSearchParams();
  const focusedId = searchParams.get("focus");
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ReadingEditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState<ReadingStatus>("to_read");
  const [entryDate, setEntryDate] = useState(() => getDateInputValue());
  const [completedDate, setCompletedDate] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [archived, setArchived] = useState(false);

  const loadReading = async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries((await getAllEntries()).filter((entry) => normalizeCategory(entry.category) === "reading"));
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load reading list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReading();
  }, []);

  useEffect(() => {
    if (loading || !focusedId) return;
    itemRefs.current.get(focusedId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [entries, focusedId, loading]);

  const columns = useMemo(() => {
    const sortReading = (items: Entry[]) =>
      [...items].sort((a, b) => {
        const statusCompare = getReadingStatusRank(getReadingStatus(a)) - getReadingStatusRank(getReadingStatus(b));
        if (statusCompare !== 0) return statusCompare;
        const priorityA = getNumberMetadata(a, "reading_priority") || Number.POSITIVE_INFINITY;
        const priorityB = getNumberMetadata(b, "reading_priority") || Number.POSITIVE_INFINITY;
        return priorityA - priorityB;
      });

    return {
      notes: sortReading(entries.filter((entry) => getReadingStatus(entry) !== "done" && !getStringMetadata(entry, "reading_url"))),
      links: sortReading(entries.filter((entry) => getReadingStatus(entry) !== "done" && getStringMetadata(entry, "reading_url"))),
      done: sortReading(entries.filter((entry) => getReadingStatus(entry) === "done")),
    };
  }, [entries]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmedUrl = url.trim();
    const trimmedTitle = title.trim();
    const trimmedTopic = topic.trim();
    const trimmedNotes = notes.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!entryDate) {
      setError("Saved date is required.");
      return;
    }

    const parsedPriority = priority.trim() ? Number(priority) : null;
    if (parsedPriority !== null && (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 5)) {
      setError("Priority must be a whole number between 1 and 5.");
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: EntryPayload = {
        title: trimmedTitle,
        area: "personal",
        category: "reading",
        entry_date: getIsoFromDateInput(entryDate) ?? nowIso,
        next_due_date: null,
        repeat_interval_days: null,
        metadata: {
          reading_url: trimmedUrl || null,
          reading_topic: trimmedTopic || null,
          reading_status: status,
          reading_priority: parsedPriority,
          reading_started_date: status === "reading" ? nowIso : null,
          reading_completed_date: status === "done" ? getIsoFromDateInput(completedDate) ?? nowIso : null,
          tags: trimmedTopic ? [trimmedTopic] : [],
          favorite,
          archived,
        },
        price: null,
        notes: trimmedNotes || null,
        reminder_enabled: false,
        reminder_time: null,
      };
      await insertEntry(payload);
      setTitle("");
      setUrl("");
      setTopic("");
      setNotes("");
      setPriority("");
      setStatus("to_read");
      setEntryDate(getDateInputValue());
      setCompletedDate("");
      setFavorite(false);
      setArchived(false);
      await loadReading();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to add this reading item.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (entry: Entry, nextStatus: ReadingStatus) => {
    if (savingEntryId === entry.id || nextStatus === getReadingStatus(entry)) return;
    setError(null);
    setSavingEntryId(entry.id);
    const now = new Date().toISOString();
    try {
      await updateEntry(entry.id, {
        metadata: {
          ...withoutCompletedCount(entry.metadata),
          reading_status: nextStatus,
          reading_started_date:
            nextStatus === "reading" ? getStringMetadata(entry, "reading_started_date") || now : null,
          reading_completed_date:
            nextStatus === "done" ? getStringMetadata(entry, "reading_completed_date") || now : null,
        },
      });
      await loadReading();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update this reading status.");
    } finally {
      setSavingEntryId(null);
    }
  };

  const handleToggleFavorite = async (entry: Entry) => {
    if (savingEntryId === entry.id) return;
    setSavingEntryId(entry.id);
    setError(null);
    const nextMetadata = { ...entry.metadata, favorite: entry.metadata.favorite !== true };
    try {
      await updateEntry(entry.id, { metadata: nextMetadata });
      setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, metadata: nextMetadata } : item));
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update favorite.");
    } finally {
      setSavingEntryId(null);
    }
  };

  const startEditing = (entry: Entry) => {
    setEditingId(entry.id);
    setEditDraft(getReadingDraft(entry));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleSaveEdit = async (entry: Entry) => {
    if (!editDraft) return;
    setError(null);

    const trimmedTitle = editDraft.title.trim();
    const trimmedUrl = editDraft.url.trim();
    const trimmedTopic = editDraft.topic.trim();
    const trimmedNotes = editDraft.notes.trim();
    const parsedPriority = editDraft.priority.trim() ? Number(editDraft.priority) : null;

    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (parsedPriority !== null && (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 5)) {
      setError("Priority must be a whole number between 1 and 5.");
      return;
    }
    if (!editDraft.entryDate) {
      setError("Entry date is required.");
      return;
    }

    setSavingEntryId(entry.id);
    try {
      const statusChanged = editDraft.status !== getReadingStatus(entry);
      const completedDate = editDraft.status === "done" ? getIsoFromDateInput(editDraft.completedDate) ?? new Date().toISOString() : null;
      const startedDate = editDraft.status === "reading"
        ? statusChanged
          ? new Date().toISOString()
          : getReadingStartedDate(entry) || new Date().toISOString()
        : null;
      await updateEntry(entry.id, {
        title: trimmedTitle,
        entry_date: getIsoFromDateInput(editDraft.entryDate) ?? entry.entry_date,
        next_due_date: null,
        repeat_interval_days: null,
        metadata: {
          ...entry.metadata,
          reading_url: trimmedUrl || null,
          reading_topic: trimmedTopic || null,
          reading_status: editDraft.status,
          reading_priority: parsedPriority,
          reading_completed_date: completedDate,
          reading_started_date: startedDate,
          tags: trimmedTopic ? [trimmedTopic] : [],
          favorite: editDraft.favorite,
          archived: editDraft.archived,
        },
        notes: trimmedNotes || null,
      });
      cancelEditing();
      await loadReading();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update this reading item.");
    } finally {
      setSavingEntryId(null);
    }
  };

  const setItemRef = (entryId: string) => (node: HTMLDivElement | null) => {
    if (node) {
      itemRefs.current.set(entryId, node);
    } else {
      itemRefs.current.delete(entryId);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-50">Reading</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">Track links, topics, and notes for focused reading.</p>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
      {loading ? (
        <div className="rounded-2xl border border-dashed border-[#ff8080] bg-white p-8 text-sm text-stone-500 dark:border-[#ff8080] dark:bg-white/[0.04] xl:col-span-2">Loading reading list...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#ff8080] bg-white p-8 text-sm text-stone-500 dark:border-[#ff8080] dark:bg-white/[0.04] xl:col-span-2">No reading links yet.</div>
      ) : (
        <>
          <section className="rounded-2xl border border-[#ff8080] bg-white p-4 shadow-sm dark:border-[#ff8080] dark:bg-white/[0.04]">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-base font-semibold text-stone-950 dark:text-stone-50">Topics without links</h3>
              <span className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-600 dark:border-white/10 dark:text-stone-300">{columns.notes.length}</span>
            </div>
            {columns.notes.length === 0 ? (
              <p className="py-4 text-sm text-stone-500 dark:text-stone-400">No standalone research notes.</p>
            ) : (
              <ul className="space-y-3">
                {columns.notes.map((entry) => (
                  <li key={entry.id} className="space-y-3">
                    <ReadingListItem
                      entry={entry}
                      onStatusChange={handleStatusChange}
                      onToggleFavorite={handleToggleFavorite}
                      onStartEdit={startEditing}
                      statusSaving={savingEntryId === entry.id}
                      focused={focusedId === entry.id}
                      itemRef={setItemRef(entry.id)}
                    />
                    {editingId === entry.id && editDraft ? (
                      <ReadingEditForm
                        draft={editDraft}
                        saving={savingEntryId === entry.id}
                        onChange={setEditDraft}
                        onCancel={cancelEditing}
                        onSave={() => void handleSaveEdit(entry)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[#ff8080] bg-white p-4 shadow-sm dark:border-[#ff8080] dark:bg-white/[0.04]">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-base font-semibold text-stone-950 dark:text-stone-50">Topics with links</h3>
              <span className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-600 dark:border-white/10 dark:text-stone-300">{columns.links.length}</span>
            </div>
            {columns.links.length === 0 ? (
              <p className="py-4 text-sm text-stone-500 dark:text-stone-400">No linked reading items.</p>
            ) : (
              <ul className="space-y-3">
                {columns.links.map((entry) => (
                  <li key={entry.id} className="space-y-3">
                    <ReadingListItem
                      entry={entry}
                      onStatusChange={handleStatusChange}
                      onToggleFavorite={handleToggleFavorite}
                      onStartEdit={startEditing}
                      statusSaving={savingEntryId === entry.id}
                      focused={focusedId === entry.id}
                      itemRef={setItemRef(entry.id)}
                    />
                    {editingId === entry.id && editDraft ? (
                      <ReadingEditForm
                        draft={editDraft}
                        saving={savingEntryId === entry.id}
                        onChange={setEditDraft}
                        onCancel={cancelEditing}
                        onSave={() => void handleSaveEdit(entry)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-emerald-300 bg-white p-4 shadow-sm dark:border-emerald-300/35 dark:bg-emerald-950/10 xl:col-span-2">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-base font-semibold text-stone-950 dark:text-stone-50">Done</h3>
              <span className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-600 dark:border-white/10 dark:text-stone-300">{columns.done.length}</span>
            </div>
            {columns.done.length === 0 ? (
              <p className="py-4 text-sm text-stone-500 dark:text-stone-400">No completed reading items.</p>
            ) : (
              <ul className="space-y-3">
                {columns.done.map((entry) => (
                  <li key={entry.id} className="space-y-3">
                    <ReadingListItem entry={entry} onStatusChange={handleStatusChange} onToggleFavorite={handleToggleFavorite} onStartEdit={startEditing} statusSaving={savingEntryId === entry.id} focused={focusedId === entry.id} itemRef={setItemRef(entry.id)} />
                    {editingId === entry.id && editDraft ? <ReadingEditForm draft={editDraft} saving={savingEntryId === entry.id} onChange={setEditDraft} onCancel={cancelEditing} onSave={() => void handleSaveEdit(entry)} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
        <form className="grid gap-3 rounded-2xl border border-[#ff8080] bg-white p-4 shadow-sm dark:border-[#ff8080] dark:bg-white/[0.04]" onSubmit={handleAdd}>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600 dark:bg-white/[0.08] dark:text-stone-300">Area: Personal</span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600 dark:bg-white/[0.08] dark:text-stone-300">Category: Reading</span>
          </div>
          <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">Title *<input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title or research question" required /></label>
          <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">Link<input className={inputClass} type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label>
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
            <label className="grid min-w-0 gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">Topic<input className={`${inputClass} h-9 min-w-0 w-full`} value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">Priority<input className={`${inputClass} h-9 min-w-0 w-full px-2 text-center`} type="number" value={priority} onChange={(event) => setPriority(event.target.value)} placeholder="1–5" min="1" max="5" step="1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">Status<select className={`${inputClass} h-9`} value={status} onChange={(event) => setStatus(event.target.value as ReadingStatus)}><option value="to_read">To read</option><option value="reading">Reading</option><option value="done">Done</option></select></label>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">Saved date<input className={`${inputClass} h-9 min-w-0 w-full px-1.5 text-xs`} type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required /></label>
          </div>
          {status === "done" ? <label className="grid min-w-0 gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">Completed date<input className={`${inputClass} h-9 min-w-0 w-full px-1.5 text-xs`} type="date" value={completedDate} onChange={(event) => setCompletedDate(event.target.value)} /></label> : null}
          <label className="grid gap-1 text-xs font-medium text-stone-600 dark:text-stone-300">Notes / highlights / learnings<textarea className={`${textareaClass} min-h-32`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Why this matters, highlights, or what to research next" /></label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300"><input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} /> Favorite</label>
            <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} /> Archived</label>
          </div>
          <Button className="w-10 !px-0" type="submit" disabled={saving} title="Save new reading entry" aria-label="Save new reading entry"><SaveIcon className="h-4 w-4" /></Button>
        </form>
      </div>
    </section>
  );
}
