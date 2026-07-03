import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAllEntries, insertEntry, updateEntry } from "@/lib/db";
import type { Entry, EntryPayload } from "@/types/entry";

type ReadingStatus = "to_read" | "reading" | "done";

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

function getReadingStatus(entry: Entry): ReadingStatus {
  const status = getStringMetadata(entry, "reading_status");
  if (status === "reading" || status === "done") return status;
  return "to_read";
}

function getUrlTitle(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || parsed.hostname;
  } catch {
    return url;
  }
}

function statusLabel(status: ReadingStatus) {
  if (status === "to_read") return "To read";
  if (status === "reading") return "Reading";
  return "Done";
}

function ReadingCard({
  entry,
  onStatusChange,
}: {
  entry: Entry;
  onStatusChange: (entry: Entry, status: ReadingStatus) => void;
}) {
  const url = getStringMetadata(entry, "reading_url");
  const topic = getStringMetadata(entry, "reading_topic") || "General";
  const status = getReadingStatus(entry);
  const priority = getNumberMetadata(entry, "reading_priority");

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">{topic}</p>
          <h3 className="mt-2 text-base font-semibold text-stone-950 dark:text-stone-50">{entry.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600 dark:bg-white/[0.06] dark:text-stone-300">
              {statusLabel(status)}
            </span>
            {priority ? (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600 dark:bg-white/[0.06] dark:text-stone-300">
                Priority {priority}
              </span>
            ) : null}
          </div>
        </div>
        {url ? (
          <a
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-stone-600 transition hover:border-stone-500 hover:text-stone-950 dark:border-white/15 dark:text-stone-300 dark:hover:border-white/35 dark:hover:text-stone-50"
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${entry.title}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>
      {entry.notes ? <p className="mt-3 whitespace-pre-line text-sm text-stone-600 dark:text-stone-300">{entry.notes}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {status !== "reading" ? (
          <Button size="sm" variant="outline" onClick={() => onStatusChange(entry, "reading")}>
            Mark Reading
          </Button>
        ) : null}
        {status !== "done" ? (
          <Button size="sm" onClick={() => onStatusChange(entry, "done")}>
            Mark Done
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export default function Reading() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("");

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

  const grouped = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    entries.forEach((entry) => {
      const key = getReadingStatus(entry) === "done" ? "Done" : getStringMetadata(entry, "reading_topic") || "General";
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    });
    return [...groups.entries()].sort(([a], [b]) => (a === "Done" ? 1 : b === "Done" ? -1 : a.localeCompare(b)));
  }, [entries]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Add a reading link first.");
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
        title: title.trim() || getUrlTitle(trimmedUrl),
        area: "personal",
        category: "reading",
        entry_date: nowIso,
        next_due_date: null,
        repeat_interval_days: null,
        metadata: {
          reading_url: trimmedUrl,
          reading_topic: topic.trim() || null,
          reading_status: "to_read",
          reading_priority: parsedPriority,
          completed_count: 0,
          tags: topic.trim() ? [topic.trim()] : [],
          favorite: false,
          archived: false,
        },
        price: null,
        notes: notes.trim() || null,
        reminder_enabled: false,
        reminder_time: null,
      };
      await insertEntry(payload);
      setTitle("");
      setUrl("");
      setTopic("");
      setNotes("");
      setPriority("");
      await loadReading();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to add this reading item.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (entry: Entry, status: ReadingStatus) => {
    setError(null);
    try {
      await updateEntry(entry.id, {
        ...(status === "done"
          ? {
              entry_date: new Date().toISOString(),
              next_due_date: null,
            }
          : {}),
        metadata: {
          ...entry.metadata,
          reading_status: status,
          completed_count: status === "done" ? 1 : entry.metadata.completed_count ?? 0,
        },
      });
      await loadReading();
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update reading status.");
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

      <form className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] lg:grid-cols-[minmax(0,1fr)_180px_100px_auto]" onSubmit={handleAdd}>
        <input className={inputClass} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." aria-label="Reading URL" />
        <input className={inputClass} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" aria-label="Topic" />
        <input className={inputClass} type="number" value={priority} onChange={(event) => setPriority(event.target.value)} placeholder="1-5" min="1" max="5" aria-label="Priority" />
        <Button type="submit" disabled={saving}>{saving ? "Adding..." : "Add Link"}</Button>
        <input className={`${inputClass} lg:col-span-2`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" aria-label="Title" />
        <textarea className={`${textareaClass} min-h-20 lg:col-span-2`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" aria-label="Notes" />
      </form>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-sm text-stone-500 dark:border-white/10 dark:bg-white/[0.04]">Loading reading list...</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-sm text-stone-500 dark:border-white/10 dark:bg-white/[0.04]">No reading links yet.</div>
      ) : (
        grouped.map(([group, groupEntries]) => (
          <section key={group} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-stone-950 dark:text-stone-50">{group}</h3>
              <span className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-600 dark:border-white/10 dark:text-stone-300">{groupEntries.length}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupEntries.map((entry) => (
                <ReadingCard key={entry.id} entry={entry} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </section>
        ))
      )}
    </section>
  );
}
