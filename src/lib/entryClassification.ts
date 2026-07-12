import type { Entry } from "@/types/entry";

const PLAN_CATEGORIES = new Set(["learning", "habit", "practice"]);

export function normalizeEntryClassification(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
}

export function isPlanAreaCategory(area: string, category: string) {
  const normalizedCategory = normalizeEntryClassification(category);
  return PLAN_CATEGORIES.has(normalizedCategory) || normalizeEntryClassification(area) === "plan";
}

export function isPlanEntry(entry: Entry) {
  if (entry.metadata.schedule_config && typeof entry.metadata.schedule_config === "object") return true;

  return normalizeEntryClassification(entry.area) === "plan";
}
