import { generateRecurrenceDates } from "@/lib/recurrence";
import type { NewPlanSession, PlanScheduleConfig, PlanSessionType, PlanType } from "@/types/plan";

type GeneratePlanSessionsInput = {
  entryId: string;
  title: string;
  planType: PlanType;
  startDate: string;
  endDate: string;
  schedule: PlanScheduleConfig;
  topics?: string[];
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
  topics = [],
}: GeneratePlanSessionsInput): NewPlanSession[] {
  const sessions: NewPlanSession[] = [];
  const topicList = topics.map((topic) => topic.trim()).filter(Boolean);
  const sessionType = getSessionType(planType);
  const interval = Math.max(1, Math.floor(schedule.interval || 1));

  const addSession = (sessionDate: Date) => {
    const topic = topicList.length > 0 ? topicList[sessions.length % topicList.length] : null;
    sessions.push({
      entry_id: entryId,
      session_date: sessionDate.toISOString(),
      session_type: sessionType,
      title: topic ? `${title}: ${topic}` : title,
      status: "scheduled",
      score: null,
      notes: null,
      metadata: topic ? { topic } : {},
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
