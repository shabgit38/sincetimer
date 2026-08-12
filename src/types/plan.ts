import type { Entry } from "@/types/entry";

export type PlanType = "learning" | "habit" | "practice";
export type PlanStatus = "active" | "paused" | "completed";
export type PlanScheduleMode = "days" | "months" | "weekdays" | "custom";
export type PlanSessionType = "learn" | "practice" | "habit" | "reflection";
export type PlanSessionStatus = "scheduled" | "completed" | "missed" | "rescheduled" | "skipped";
export type PlanEffortLevel = "mvp" | "normal" | "deep";

export interface PlanScheduleConfig {
  mode: PlanScheduleMode;
  interval: number;
  weekdays: number[];
}

export interface PlanSession {
  id: string;
  entry_id: string;
  user_id: string;
  session_date: string;
  session_type: PlanSessionType;
  title: string;
  status: PlanSessionStatus;
  completed_at: string | null;
  score: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type NewPlanSession = Pick<
  PlanSession,
  "entry_id" | "session_date" | "session_type" | "title" | "status" | "score" | "notes" | "metadata"
>;

export interface PlanWithSessions {
  entry: Entry;
  sessions: PlanSession[];
}

export interface PlanMetrics {
  total: number;
  completed: number;
  missed: number;
  scheduled: number;
  completionRate: number;
  nextSession: PlanSession | null;
}
