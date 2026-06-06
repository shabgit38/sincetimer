import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getAreas, getCategories, getEntryById, insertEntry, updateEntry } from "@/lib/db";
import type { EntryOption } from "@/types/entry";

function formatOptionLabel(value: string) {
  return value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
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
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nextDueDate, setNextDueDate] = useState<string>("");
  const [repeatIntervalDays, setRepeatIntervalDays] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPurchase = category === "purchase";

  useEffect(() => {
    const load = async () => {
      try {
        const [areaOptions, categoryOptions, entry] = await Promise.all([
          getAreas(),
          getCategories(),
          isEditing && entryId !== null ? getEntryById(entryId) : Promise.resolve(null),
        ]);

        setAreas(areaOptions);
        setCategories(categoryOptions);

        if (entry) {
          setTitle(entry.title);
          setArea(entry.area);
          setCategory(entry.category);
          setEntryDate(entry.entry_date.slice(0, 10));
          setNextDueDate(entry.next_due_date ? entry.next_due_date.slice(0, 10) : "");
          setRepeatIntervalDays(entry.repeat_interval_days ? String(entry.repeat_interval_days) : "");
          setPrice(entry.price !== null ? String(entry.price) : "");
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
    if (isPurchase && price.trim()) {
      const parsed = Number(price);
      if (Number.isNaN(parsed)) {
        setError("Price must be a number.");
        return;
      }
      priceValue = parsed;
    }

    let intervalValue: number | null = null;
    if (repeatIntervalDays.trim()) {
      const parsed = Number(repeatIntervalDays);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError("Interval days must be a positive whole number.");
        return;
      }
      intervalValue = parsed;
    }

    const entryDateIso = new Date(entryDate).toISOString();
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
      repeat_interval_days: intervalValue,
      price: isPurchase ? priceValue : null,
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
      await scheduleNotification();
      navigate("/");
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to save entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
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
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700 focus:border-stone-400 focus:outline-none"
              placeholder="e.g. Replace air filter"
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="entryDate">
                Entry Date
              </label>
              <input
                id="entryDate"
                type="date"
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="nextDueDate">
                Next Due Date
              </label>
              <input
                id="nextDueDate"
                type="date"
                value={nextDueDate}
                onChange={(event) => setNextDueDate(event.target.value)}
                disabled={Boolean(repeatIntervalDays.trim())}
                className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-stone-700" htmlFor="repeatIntervalDays">
              Due after days
            </label>
            <input
              id="repeatIntervalDays"
              type="number"
              value={repeatIntervalDays}
              onChange={(event) => setRepeatIntervalDays(event.target.value)}
              className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-700"
              placeholder="e.g. 7, 30, 90"
              min="1"
              step="1"
            />
            <p className="text-xs text-stone-500">
              If set, next due date is calculated from the entry date and this interval.
            </p>
          </div>

          {isPurchase ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="price">
                Price
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
          ) : null}

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
    </section>
  );
}
