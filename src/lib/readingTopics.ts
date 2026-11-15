import type { Entry } from "@/types/entry";

type ReadingEntryTitle = Pick<Entry, "category" | "title" | "metadata">;

function normalizeCategory(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
}

function normalizeTopic(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function mergeReadingTitlesIntoTopics(
  currentTopics: string[],
  entries: ReadingEntryTitle[]
): { topics: string[]; addedCount: number } {
  const topics = [...currentTopics];
  const seen = new Set(currentTopics.map(normalizeTopic).filter(Boolean));
  let addedCount = 0;

  for (const entry of entries) {
    if (normalizeCategory(entry.category) !== "reading") continue;

    const title = entry.title.trim();
    const normalizedTitle = normalizeTopic(title);
    if (!normalizedTitle || seen.has(normalizedTitle)) continue;

    topics.push(title);
    seen.add(normalizedTitle);
    addedCount += 1;
  }

  return { topics, addedCount };
}
