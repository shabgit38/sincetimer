import { addDays, addMonths, differenceInCalendarDays } from "date-fns";

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

function normalizeDate(date: string) {
  const normalized = new Date(date);
  normalized.setHours(9, 0, 0, 0);
  return normalized;
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
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
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

  if (schedule.mode === "months") {
    for (let sessionDate = start; sessionDate <= end; sessionDate = addMonths(sessionDate, interval)) {
      addSession(sessionDate);
    }
    return sessions;
  }

  if (schedule.mode === "weekdays") {
    const weekdays = new Set(schedule.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
    if (weekdays.size === 0) return [];
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 1) {
      const sessionDate = addDays(start, dayOffset);
      if (weekdays.has(sessionDate.getDay())) addSession(sessionDate);
    }
    return sessions;
  }

  const intervalDays = schedule.mode === "custom" ? interval * 7 : interval;
  for (let dayOffset = 0; dayOffset < totalDays; dayOffset += intervalDays) {
    const sessionDate = addDays(start, dayOffset);
    if (sessionDate > end) break;
    addSession(sessionDate);
  }

  return sessions;
}
