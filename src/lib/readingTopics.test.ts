import { describe, expect, it } from "vitest";

import { mergeReadingTitlesIntoTopics } from "@/lib/readingTopics";

describe("mergeReadingTitlesIntoTopics", () => {
  it("imports reading titles in every status, keeps existing topics, and skips duplicates", () => {
    const entries = [
      { title: "Pending book", category: "reading", metadata: { reading_status: "to_read" } },
      { title: "  In-progress article  ", category: "reading", metadata: { reading_status: "reading" } },
      { title: "Completed essay", category: "reading", metadata: { reading_status: "done" } },
      { title: " pending BOOK ", category: "reading", metadata: { reading_status: "done" } },
      { title: "Not a reading item", category: "task", metadata: {} },
    ];

    expect(mergeReadingTitlesIntoTopics(["Existing topic", "Pending book"], entries)).toEqual({
      topics: ["Existing topic", "Pending book", "In-progress article", "Completed essay"],
      addedCount: 2,
    });
  });
});
