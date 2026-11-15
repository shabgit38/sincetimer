import type { Entry } from "@/types/entry";

type ReadingEntryForImport = Pick<Entry, "category" | "title" | "notes" | "metadata">;

function normalizeCategory(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
}

function normalizeTopic(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function getTopicTitle(topic: string) {
  return topic.split(/\r?\n/, 1)[0].trim();
}

export function getBookTopicReadingEntries(entries: ReadingEntryForImport[]): ReadingEntryForImport[] {
  return entries.filter((entry) => {
    const readingTopic = entry.metadata.reading_topic;
    return (
      normalizeCategory(entry.category) === "reading" &&
      typeof readingTopic === "string" &&
      /\bbooks?\b/i.test(readingTopic)
    );
  });
}

export function mergeBookReadingItemsIntoTopics(
  currentTopics: string[],
  entries: ReadingEntryForImport[]
): { topics: string[]; addedCount: number; updatedCount: number } {
  const topics = [...currentTopics];
  let addedCount = 0;
  let updatedCount = 0;

  for (const entry of getBookTopicReadingEntries(entries)) {
    const title = entry.title.trim();
    if (!title) continue;

    const notes = (entry.notes ?? "").replace(/\s+/g, " ").trim();
    const existingIndex = topics.findIndex(
      (topic) => normalizeTopic(getTopicTitle(topic)) === normalizeTopic(title)
    );

    if (existingIndex === -1) {
      topics.push(notes ? `${title}\n${notes}` : title);
      addedCount += 1;
      continue;
    }

    if (notes && !topics[existingIndex].includes("\n")) {
      topics[existingIndex] = `${getTopicTitle(topics[existingIndex])}\n${notes}`;
      updatedCount += 1;
    }
  }

  return { topics, addedCount, updatedCount };
}
