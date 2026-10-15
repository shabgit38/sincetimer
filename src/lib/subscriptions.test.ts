import { describe, expect, it } from "vitest";

import { getNextSubscriptionDueDate, getSubscriptionRenewalType } from "@/lib/subscriptions";

describe("getSubscriptionRenewalType", () => {
  it("defaults legacy and invalid values to fixed renewal", () => {
    expect(getSubscriptionRenewalType(undefined)).toBe("fixed");
    expect(getSubscriptionRenewalType("unknown")).toBe("fixed");
  });
});

describe("getNextSubscriptionDueDate", () => {
  it("keeps fixed renewals anchored to the vendor renewal date when paid early", () => {
    const nextDue = getNextSubscriptionDueDate(
      "2026-09-18T00:00:00.000Z",
      "monthly",
      "fixed",
      new Date("2026-10-06T00:00:00.000Z"),
      { afterFromDate: true }
    );

    expect(nextDue?.toISOString()).toBe("2026-10-18T00:00:00.000Z");
  });

  it("starts a refill interval from the actual refill date", () => {
    const nextDue = getNextSubscriptionDueDate(
      "2026-09-18T00:00:00.000Z",
      "monthly",
      "refill",
      new Date("2026-10-06T00:00:00.000Z")
    );

    expect(nextDue?.toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });

  it("leaves custom dates for the user to set", () => {
    expect(
      getNextSubscriptionDueDate(
        "2026-09-18T00:00:00.000Z",
        "custom",
        "refill",
        new Date("2026-10-06T00:00:00.000Z")
      )
    ).toBeNull();
  });
});
