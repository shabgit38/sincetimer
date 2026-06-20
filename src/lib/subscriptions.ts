import { addMonths, addWeeks, addYears, isBefore, isValid, parseISO, startOfDay } from "date-fns";

export type SubscriptionBillingCycle = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export function getBillingCycle(value: unknown): SubscriptionBillingCycle {
  if (value === "weekly" || value === "quarterly" || value === "yearly" || value === "custom") return value;
  return "monthly";
}

function addBillingCycle(date: Date, cycle: SubscriptionBillingCycle) {
  if (cycle === "weekly") return addWeeks(date, 1);
  if (cycle === "quarterly") return addMonths(date, 3);
  if (cycle === "yearly") return addYears(date, 1);
  return addMonths(date, 1);
}

export function getNextSubscriptionRenewalDate(
  startDate: string,
  cycle: SubscriptionBillingCycle,
  fromDate: Date = new Date()
) {
  if (cycle === "custom") return null;

  const parsedStart = parseISO(startDate);
  if (!isValid(parsedStart)) return null;

  let renewalDate = addBillingCycle(parsedStart, cycle);
  const today = startOfDay(fromDate);
  while (isBefore(startOfDay(renewalDate), today)) {
    renewalDate = addBillingCycle(renewalDate, cycle);
  }
  return renewalDate;
}

export function getNextSubscriptionRenewalIso(
  startDate: string,
  cycle: SubscriptionBillingCycle,
  fromDate: Date = new Date()
) {
  return getNextSubscriptionRenewalDate(startDate, cycle, fromDate)?.toISOString() ?? null;
}
