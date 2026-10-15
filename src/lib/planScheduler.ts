import { generateRecurrenceDates } from "@/lib/recurrence";
import type { NewPlanSession, PlanScheduleConfig, PlanSessionType, PlanType } from "@/types/plan";

type GeneratePlanSessionsInput = {
  entryId: string;
  title: string;
  planType: PlanType;
  startDate: string;
  endDate: string;
  schedule: PlanScheduleConfig;
};

function getSessionType(planType: PlanType): PlanSessionType {
  if (planType === "habit") return "habit";
  if (planType === "practice") return "practice";
  return "learn";
}

export function generatePlanSessions({
  entryId,
  title,
  planType,
  startDate,
  endDate,
  schedule,
}: GeneratePlanSessionsInput): NewPlanSession[] {
  const sessions: NewPlanSession[] = [];
  const sessionType = getSessionType(planType);
  const interval = Math.max(1, Math.floor(schedule.interval || 1));

  const addSession = (sessionDate: Date) => {
    sessions.push({
      entry_id: entryId,
      session_date: sessionDate.toISOString(),
      session_type: sessionType,
      title,
      status: "scheduled",
      score: null,
      notes: null,
      metadata: {},
    });
  };

  const dates = generateRecurrenceDates(startDate, endDate, {
    mode: schedule.mode,
    interval,
    weekdays: schedule.weekdays,
    dayOfMonth: schedule.dayOfMonth,
    date: schedule.date,
  });
  dates.forEach(addSession);

  return sessions;
}
