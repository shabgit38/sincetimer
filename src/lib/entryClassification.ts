import type { Entry } from "@/types/entry";

const PLAN_CATEGORIES = new Set(["learning", "habit", "practice"]);

export function normalizeEntryClassification(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
}

export function isPlanAreaCategory(area: string, category: string) {
  const normalizedCategory = normalizeEntryClassification(category);
  return (
    normalizedCategory === "plan" ||
    (normalizeEntryClassification(area) === "plan" && PLAN_CATEGORIES.has(normalizedCategory))
  );
}

export function isPlanEntry(entry: Entry) {
  if (isPlanAreaCategory(entry.area, entry.category)) return true;

  // Compatibility for plan records created before category stored the plan type.
  return (
    normalizeEntryClassification(entry.category) === "plan" &&
    typeof entry.metadata.plan_type === "string"
  );
}
