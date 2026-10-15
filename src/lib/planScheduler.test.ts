import { describe, expect, it } from "vitest";

import { generatePlanSessions } from "@/lib/planScheduler";

describe("generatePlanSessions", () => {
  it("generates scheduled sessions without assigning backlog topics", () => {
    const sessions = generatePlanSessions({
      entryId: "plan-1",
      title: "Economics",
      planType: "learning",
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      schedule: { mode: "days", interval: 2, weekdays: [] },
    });

    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => session.title === "Economics")).toBe(true);
    expect(sessions.every((session) => Object.keys(session.metadata).length === 0)).toBe(true);
  });
});
