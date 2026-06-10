import { supabase } from "@/lib/supabase";
import type { Entry } from "@/types/entry";
import type { NewPlanSession, PlanSession, PlanSessionStatus, PlanWithSessions } from "@/types/plan";

const planSessionSelect = `
  id,
  entry_id,
  user_id,
  session_date,
  session_type,
  title,
  status,
  completed_at,
  score,
  notes,
  metadata,
  created_at,
  updated_at
`;

const planEntrySelect = `
  id,
  user_id,
  title,
  area,
  category,
  entry_date,
  next_due_date,
  repeat_interval_days,
  metadata,
  price,
  notes,
  reminder_enabled,
  reminder_time,
  created_at,
  updated_at
`;

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Please sign in before changing plans.");
  return data.user.id;
}

export async function getPlanSessions(entryId: string): Promise<PlanSession[]> {
  const { data, error } = await supabase
    .from("plan_sessions")
    .select(planSessionSelect)
    .eq("entry_id", entryId)
    .order("session_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlanSession[];
}

export async function getAllPlanSessions(): Promise<PlanSession[]> {
  const { data, error } = await supabase
    .from("plan_sessions")
    .select(planSessionSelect)
    .order("session_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlanSession[];
}

export async function getPlansWithSessions(): Promise<PlanWithSessions[]> {
  const [{ data: entries, error: entryError }, sessions] = await Promise.all([
    supabase
      .from("entries")
      .select(planEntrySelect)
      .ilike("category", "plan")
      .order("created_at", { ascending: false }),
    getAllPlanSessions(),
  ]);

  if (entryError) throw entryError;
  const sessionGroups = new Map<string, PlanSession[]>();
  sessions.forEach((session) => {
    const group = sessionGroups.get(session.entry_id) ?? [];
    group.push(session);
    sessionGroups.set(session.entry_id, group);
  });

  return ((entries ?? []) as Entry[]).map((entry) => ({
    entry,
    sessions: sessionGroups.get(entry.id) ?? [],
  }));
}

export async function replacePlanSessions(entryId: string, sessions: NewPlanSession[]): Promise<void> {
  const userId = await requireUserId();
  const { error: deleteError } = await supabase.from("plan_sessions").delete().eq("entry_id", entryId);
  if (deleteError) throw deleteError;
  if (sessions.length === 0) return;

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("plan_sessions").insert(
    sessions.map((session) => ({
      ...session,
      user_id: userId,
      created_at: now,
      updated_at: now,
    }))
  );
  if (insertError) throw insertError;
}

export async function updatePlanSessionStatus(
  sessionId: string,
  status: PlanSessionStatus,
  notes?: string
): Promise<void> {
  const { data: sessionRecord, error: sessionError } = await supabase
    .from("plan_sessions")
    .select("entry_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;

  const updates = {
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
    notes: notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("plan_sessions").update(updates).eq("id", sessionId);
  if (error) throw error;

  const entryId = typeof sessionRecord?.entry_id === "string" ? sessionRecord.entry_id : null;
  if (!entryId) return;

  const { data: scheduledSessions, error: nextError } = await supabase
    .from("plan_sessions")
    .select("session_date")
    .eq("entry_id", entryId)
    .eq("status", "scheduled")
    .order("session_date", { ascending: true });

  if (nextError) throw nextError;

  const now = new Date();
  const nextSession =
    (scheduledSessions ?? []).find((session) => new Date(session.session_date) >= now) ??
    (scheduledSessions ?? [])[0] ??
    null;

  const { error: entryError } = await supabase
    .from("entries")
    .update({
      next_due_date: nextSession?.session_date ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (entryError) throw entryError;
}

export function getPlanMetrics(sessions: PlanSession[]) {
  const now = new Date();
  const completed = sessions.filter((session) => session.status === "completed").length;
  const missed = sessions.filter((session) => session.status === "missed").length;
  const scheduled = sessions.filter((session) => session.status === "scheduled").length;
  const nextSession =
    sessions.find((session) => session.status === "scheduled" && new Date(session.session_date) >= now) ??
    sessions.find((session) => session.status === "scheduled") ??
    null;

  return {
    total: sessions.length,
    completed,
    missed,
    scheduled,
    completionRate: sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0,
    nextSession,
  };
}
