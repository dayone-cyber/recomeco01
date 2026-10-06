import type { AppState } from '../types';
import { cloudEnabled, supabase } from './supabase';
import { getState, setState, subscribe, emptyState } from './store';
import { useSyncExternalStore } from 'react';

type Row = Record<string, unknown>;
interface TableSpec {
  table: string;
  conflict: string;
  rows: (s: AppState) => Row[];
}

const pick = <T extends object>(o: T, keys: string[]): Row => Object.fromEntries(keys.map((k) => [k, (o as Row)[k] ?? null]));

// Ordem respeita as chaves estrangeiras do schema.sql.
export const SPECS: TableSpec[] = [
  { table: 'users', conflict: 'id', rows: (s) => (s.user ? [pick(s.user, ['id', 'name', 'email', 'created_at', 'timezone', 'age_range', 'subscription_status', 'trial_started_at', 'trial_ends_at', 'experiment_group', 'consent_at'])] : []) },
  {
    table: 'user_profile', conflict: 'user_id',
    rows: (s) => (s.profile ? [{ ...pick(s.profile, ['user_id', 'primary_goal', 'relationship_status', 'routine_impact', 'baseline_check_frequency', 'baseline_thought_load', 'distancing_history', 'relief_score', 'boundary_difficulty', 'current_phase', 'reconcile_focus', 'early_signs', 'relapse_plan', 'main_behaviors', 'goal_history']), client_state: { flags: s.flags, settings: s.settings } }] : []),
  },
  { table: 'triggers', conflict: 'user_id,id', rows: (s) => s.triggers.map((x) => pick(x, ['id', 'user_id', 'name', 'kind', 'occurrence_count', 'last_occurrence'])) },
  { table: 'automatic_thoughts', conflict: 'id', rows: (s) => s.thoughts.map((x) => pick(x, ['id', 'user_id', 'content', 'occurrence_count'])) },
  { table: 'interventions', conflict: 'id', rows: (s) => s.interventions.map((x) => pick(x, ['id', 'user_id', 'intervention_type', 'trigger_id', 'started_at', 'completed_at', 'urge_before', 'urge_after', 'helpfulness', 'planned_minutes'])) },
  { table: 'check_ins', conflict: 'id', rows: (s) => s.checkIns.map((x) => pick(x, ['id', 'user_id', 'timestamp', 'emotional_state', 'trigger_id', 'automatic_thought_id', 'urge_before', 'urge_after', 'action_taken', 'intervention_id', 'source'])) },
  { table: 'boundaries', conflict: 'id', rows: (s) => s.boundaries.map((x) => pick(x, ['id', 'user_id', 'description', 'category', 'active', 'respected_count', 'broken_count', 'created_at'])) },
  { table: 'behavioral_metrics', conflict: 'user_id,date', rows: (s) => s.metrics.map((x) => pick(x, ['user_id', 'date', 'whatsapp_checks', 'contact_attempts', 'plans_cancelled', 'plans_protected'])) },
  { table: 'insights', conflict: 'id', rows: (s) => s.insights.map((x) => pick(x, ['id', 'user_id', 'key', 'type', 'title', 'description', 'confidence', 'generated_at', 'viewed_at'])) },
  { table: 'journey_progress', conflict: 'user_id,phase', rows: (s) => s.journey.map((x) => pick(x, ['user_id', 'phase', 'status', 'exercises_completed', 'last_activity'])) },
  { table: 'predictions', conflict: 'id', rows: (s) => s.predictions.map((x) => pick(x, ['id', 'user_id', 'thought', 'prediction', 'behavior', 'created_at', 'outcome', 'resolved_at'])) },
  { table: 'activities', conflict: 'id', rows: (s) => s.activities.map((x) => pick(x, ['id', 'user_id', 'category', 'description', 'planned_for', 'created_at', 'done_at'])) },
  { table: 'reciprocity_signals', conflict: 'id', rows: (s) => s.reciprocity.map((x) => pick(x, ['id', 'user_id', 'timestamp', 'initiated_by', 'kept_agreement', 'respected_limits', 'available', 'effort', 'expected', 'happened'])) },
  { table: 'events', conflict: 'id', rows: (s) => s.events.map((x) => pick(x, ['id', 'user_id', 'name', 'timestamp', 'props'])) },
];

/* ---------- status observável ---------- */
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'ok' | 'error';
let status: SyncStatus = cloudEnabled ? 'idle' : 'off';
let lastError = '';
const sl = new Set<() => void>();
const setStatus = (s: SyncStatus, err = '') => { status = s; lastError = err; sl.forEach((f) => f()); };
export const useSyncStatus = () => useSyncExternalStore((cb) => (sl.add(cb), () => sl.delete(cb)), () => status);
export const syncError = () => lastError;

/* ---------- push ---------- */
let timer: ReturnType<typeof setTimeout> | undefined;
let inflight = false;
let dirty = false;

async function hasSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function pushNow() {
  if (!supabase) return;
  if (inflight) { dirty = true; return; }
  const uid = await hasSession();
  const st = getState();
  if (!uid || !st.user || st.user.id !== uid) return; // só sincroniza o dono da sessão
  inflight = true;
  setStatus('syncing');
  try {
    for (const spec of SPECS) {
      const rows = spec.rows(st);
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from(spec.table).upsert(rows.slice(i, i + 500), { onConflict: spec.conflict });
        if (error) throw new Error(`${spec.table}: ${error.message}`);
      }
    }
    setStatus('ok');
  } catch (e) {
    setStatus('error', e instanceof Error ? e.message : String(e));
  } finally {
    inflight = false;
    if (dirty) { dirty = false; schedule(); }
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void pushNow(), 2000);
}

/** Cancela envios pendentes (usado ao sair da conta). */
export function resetFlush() {
  clearTimeout(timer);
  dirty = false;
}

export function initSync() {
  if (!cloudEnabled) return;
  subscribe(() => { if (getState().user) schedule(); });
}

/* ---------- pull ---------- */
const sel = async (table: string, uid: string, col = 'user_id') => {
  const { data, error } = await supabase!.from(table).select('*').eq(col, uid);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
};

/** Baixa tudo do usuário autenticado. Retorna null se ele ainda não tem conta/linha de usuário. */
export async function pullState(uid: string): Promise<AppState | null> {
  const [users, profiles] = await Promise.all([sel('users', uid, 'id'), sel('user_profile', uid)]);
  if (!users[0] || !profiles[0]) return null;
  const [triggers, thoughts, interventions, checkIns, boundaries, metrics, insights, journey, predictions, activities, reciprocity, events] = await Promise.all(
    ['triggers', 'automatic_thoughts', 'interventions', 'check_ins', 'boundaries', 'behavioral_metrics', 'insights', 'journey_progress', 'predictions', 'activities', 'reciprocity_signals', 'events'].map((t) => sel(t, uid)),
  );
  const base = emptyState();
  const { client_state, ...profile } = profiles[0] as Row & { client_state?: { flags?: object; settings?: object } };
  const num = (r: Row, ks: string[]) => { ks.forEach((k) => { if (r[k] != null) r[k] = Number(r[k]); }); return r; };
  const next = {
    ...base,
    user: users[0] as unknown as AppState['user'],
    profile: { ...profile, early_signs: profile.early_signs ?? [], main_behaviors: profile.main_behaviors ?? [], goal_history: profile.goal_history ?? [], relapse_plan: profile.relapse_plan ?? '' } as unknown as AppState['profile'],
    triggers, thoughts, interventions: interventions.map((r) => num(r, ['urge_before', 'urge_after'])), checkIns: checkIns.map((r) => num(r, ['urge_before', 'urge_after'])),
    boundaries, metrics, insights, journey, predictions, activities, reciprocity, events,
    flags: { ...base.flags, ...(client_state?.flags ?? {}), onboarding_done: true },
    settings: { ...base.settings, ...(client_state?.settings ?? {}) },
  } as unknown as AppState;
  next.checkIns.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  next.interventions.sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  return next;
}

export async function restoreFromCloud(): Promise<boolean> {
  const uid = await hasSession();
  if (!uid) return false;
  setStatus('syncing');
  try {
    const remote = await pullState(uid);
    if (remote) setState(remote);
    setStatus('ok');
    return !!remote;
  } catch (e) {
    setStatus('error', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Apaga as linhas do usuário na nuvem (a conta de login em si exige função de servidor). */
export async function deleteRemoteData() {
  if (!supabase) return;
  const uid = await hasSession();
  if (!uid) return;
  for (const spec of [...SPECS].reverse()) {
    await supabase.from(spec.table).delete().eq(spec.table === 'users' ? 'id' : 'user_id', uid);
  }
  await supabase.auth.signOut();
}
