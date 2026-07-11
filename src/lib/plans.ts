import { supabase } from "@/lib/supabase";
import { isPlanEntry } from "@/lib/entryClassification";
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

function getTodayStartIso() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

async function markOverdueScheduledSessionsMissed(entryId?: string): Promise<void> {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("plan_sessions")
    .update({ status: "missed", updated_at: nowIso })
    .eq("status", "scheduled")
    .lt("session_date", getTodayStartIso());

  if (entryId) query = query.eq("entry_id", entryId);

  const { data, error } = await query.select("entry_id");
  if (error) throw error;

  const affectedEntryIds = [...new Set((data ?? []).map((session) => session.entry_id))];
  await Promise.all(affectedEntryIds.map((affectedEntryId) => refreshPlanNextDueDate(affectedEntryId, nowIso)));
}

export async function getPlanSessions(entryId: string): Promise<PlanSession[]> {
  await markOverdueScheduledSessionsMissed(entryId);
  const { data, error } = await supabase
    .from("plan_sessions")
    .select(planSessionSelect)
    .eq("entry_id", entryId)
    .order("session_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlanSession[];
}

export async function getAllPlanSessions(): Promise<PlanSession[]> {
  await markOverdueScheduledSessionsMissed();
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
      .ilike("area", "plan")
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

  return ((entries ?? []) as Entry[])
    .filter(isPlanEntry)
    .map((entry) => ({
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

export async function replaceScheduledPlanSessions(entryId: string, sessions: NewPlanSession[]): Promise<void> {
  const userId = await requireUserId();
  const nowIso = new Date().toISOString();
  const { error: deleteError } = await supabase
    .from("plan_sessions")
    .delete()
    .eq("entry_id", entryId)
    .eq("status", "scheduled")
    .gte("session_date", getTodayStartIso());

  if (deleteError) throw deleteError;

  if (sessions.length > 0) {
    const { error: insertError } = await supabase.from("plan_sessions").insert(
      sessions.map((session) => ({
        ...session,
        user_id: userId,
        created_at: nowIso,
        updated_at: nowIso,
      }))
    );
    if (insertError) throw insertError;
  }

  await refreshPlanNextDueDate(entryId, nowIso);
}

async function refreshPlanNextDueDate(entryId: string, updatedAt: string): Promise<void> {
  const [{ data: sessions, error: sessionError }, { data: entryRecord, error: entryError }] = await Promise.all([
    supabase
      .from("plan_sessions")
      .select("session_date, status")
      .eq("entry_id", entryId)
      .order("session_date", { ascending: true }),
    supabase
      .from("entries")
      .select("metadata")
      .eq("id", entryId)
      .maybeSingle(),
  ]);

  if (sessionError) throw sessionError;
  if (entryError) throw entryError;

  const scheduledSessions = (sessions ?? []).filter((session) => session.status === "scheduled");
  const completedCount = (sessions ?? []).filter((session) => session.status === "completed").length;
  const metadata =
    entryRecord?.metadata && typeof entryRecord.metadata === "object"
      ? { ...(entryRecord.metadata as Record<string, unknown>), completed_count: completedCount }
      : { completed_count: completedCount };

  const now = new Date();
  const nextSession =
    scheduledSessions.find((session) => new Date(session.session_date) >= now) ??
    scheduledSessions[0] ??
    null;

  const { error: updateError } = await supabase
    .from("entries")
    .update({
      next_due_date: nextSession?.session_date ?? null,
      metadata,
      updated_at: updatedAt,
    })
    .eq("id", entryId);

  if (updateError) throw updateError;
}

export async function updatePlanSessionStatus(
  sessionId: string,
  status: PlanSessionStatus,
  notes?: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: sessionRecord, error: sessionError } = await supabase
    .from("plan_sessions")
    .select("entry_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;

  const updates = {
    status,
    completed_at: status === "completed" ? nowIso : null,
    notes: notes?.trim() || null,
    updated_at: nowIso,
  };
  const { error } = await supabase.from("plan_sessions").update(updates).eq("id", sessionId);
  if (error) throw error;

  const entryId = typeof sessionRecord?.entry_id === "string" ? sessionRecord.entry_id : null;
  if (!entryId) return;

  await refreshPlanNextDueDate(entryId, nowIso);
}

export async function updatePlanSession(
  sessionId: string,
  updates: Partial<Pick<PlanSession, "session_date" | "status" | "notes">>
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: sessionRecord, error: sessionError } = await supabase
    .from("plan_sessions")
    .select("entry_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;

  const { error } = await supabase
    .from("plan_sessions")
    .update({
      ...updates,
      ...(updates.status === "completed"
        ? { completed_at: nowIso }
        : updates.status
          ? { completed_at: null }
          : {}),
      updated_at: nowIso,
    })
    .eq("id", sessionId);

  if (error) throw error;

  const entryId = typeof sessionRecord?.entry_id === "string" ? sessionRecord.entry_id : null;
  if (entryId) await refreshPlanNextDueDate(entryId, nowIso);
}

export async function deletePlanSession(session: Pick<PlanSession, "id" | "entry_id">): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("plan_sessions").delete().eq("id", session.id);
  if (error) throw error;
  await refreshPlanNextDueDate(session.entry_id, nowIso);
}

export async function touchPlanNextDueDate(entryId: string): Promise<void> {
  await refreshPlanNextDueDate(entryId, new Date().toISOString());
}

export function getLatestCompletedPlanSession(sessions: PlanSession[]): PlanSession | null {
  return sessions
    .filter((session) => session.status === "completed")
    .sort((a, b) => {
      const aTime = new Date(a.completed_at ?? a.session_date).getTime();
      const bTime = new Date(b.completed_at ?? b.session_date).getTime();
      return bTime - aTime;
    })[0] ?? null;
}

export function getVisiblePlanSessions(sessions: PlanSession[], limit = 24): PlanSession[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
  );
  if (sorted.length <= limit) return sorted;

  const now = new Date();
  const anchorIndex = sorted.findIndex(
    (session) => session.status === "scheduled" && new Date(session.session_date) >= now
  );

  if (anchorIndex === -1) {
    return sorted.slice(-limit);
  }

  const historyCount = Math.min(7, anchorIndex);
  const start = Math.max(0, Math.min(anchorIndex - historyCount, sorted.length - limit));
  return sorted.slice(start, start + limit);
}

export function getPlanLastDoneLabel(sessions: PlanSession[]): string | null {
  const latest = getLatestCompletedPlanSession(sessions);
  return latest?.completed_at ?? latest?.session_date ?? null;
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
