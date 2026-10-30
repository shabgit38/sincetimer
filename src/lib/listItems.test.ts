import { describe, expect, it } from "vitest";

import { sortListItems, type ListItem } from "@/lib/listItems";

describe("sortListItems", () => {
  it("keeps unchecked items first and checked items last while preserving their order", () => {
    const items: ListItem[] = [
      { id: "checked-first", text: "Done first", completed: true },
      { id: "open-first", text: "Open first", completed: false },
      { id: "checked-second", text: "Done second", completed: true },
      { id: "open-second", text: "Open second", completed: false },
    ];

    expect(sortListItems(items).map((item) => item.id)).toEqual([
      "open-first",
      "open-second",
      "checked-first",
      "checked-second",
    ]);
  });
});
