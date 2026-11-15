import { describe, expect, it } from "vitest";

import {
  getBookTopicReadingEntries,
  mergeBookReadingItemsIntoTopics,
} from "@/lib/readingTopics";

describe("getBookTopicReadingEntries", () => {
  it("matches the whole word book or books in reading topics regardless of status", () => {
    const entries = [
      { title: "Pending", notes: "", category: "reading", metadata: { reading_topic: "Book notes", reading_status: "to_read" } },
      { title: "In progress", notes: "", category: "reading", metadata: { reading_topic: "Audio-book", reading_status: "reading" } },
      { title: "Completed", notes: "", category: "reading", metadata: { reading_topic: "BOOK reviews", reading_status: "done" } },
      { title: "Notebook", notes: "", category: "reading", metadata: { reading_topic: "Notebooking" } },
      { title: "Books", notes: "", category: "reading", metadata: { reading_topic: "Books to read", reading_status: "done" } },
      { title: "Bookstore", notes: "", category: "reading", metadata: { reading_topic: "Bookstore" } },
      { title: "Wrong category", notes: "", category: "task", metadata: { reading_topic: "Book notes" } },
    ];

    expect(getBookTopicReadingEntries(entries).map((entry) => entry.title)).toEqual([
      "Pending",
      "In progress",
      "Completed",
      "Books",
    ]);
  });
});

describe("mergeBookReadingItemsIntoTopics", () => {
  it("adds titles with notes while keeping existing topics and enriching an existing title", () => {
    const entries = [
      {
        title: "A new book",
        notes: "First note.\nSecond note.",
        category: "reading",
        metadata: { reading_topic: "Book club" },
      },
      {
        title: "Existing book",
        notes: "Remember the key ideas.",
        category: "reading",
        metadata: { reading_topic: "Book recommendations" },
      },
    ];

    expect(mergeBookReadingItemsIntoTopics(["Existing topic", "Existing book"], entries)).toEqual({
      topics: ["Existing topic", "Existing book\nRemember the key ideas.", "A new book\nFirst note. Second note."],
      addedCount: 1,
      updatedCount: 1,
    });
  });
});
