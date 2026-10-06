import type {
  ActionTaken, AppState, Boundary, BoundaryCategory, CheckIn, Goal, InterventionType, Mood, PhaseId,
  ReciprocitySignal, ReconcileFocus, RelationshipStatus, SubscriptionStatus,
} from '../types';
import { DAY, dateKey, uid } from './time';
import { getState, mutate, resetAll, setState } from './store';
import { track } from './analytics';
import { assignGroup, defaultRemoteConfig, type RemoteConfig } from './remoteConfig';
import { profileFromAnswers } from '../engine/formulation';
import { mergeInsights } from '../engine/insights';
import { currentPhase } from '../engine/recommend';
import { TRIGGER_CATALOG } from '../data/content';
import { detectRisk } from '../engine/safety';

/* ---------- conta e onboarding ---------- */

export function createAccount(name: string, email: string, cfg: RemoteConfig = defaultRemoteConfig) {
  const st = getState();
  const now = new Date().toISOString();
  const userId = uid();
  const a = st.onboarding;
  mutate((d) => {
    d.user = {
      id: userId,
      name: name.trim(),
      email: email.trim(),
      created_at: now,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      age_range: a.age_range ?? '',
      subscription_status: 'none',
      trial_started_at: null,
      trial_ends_at: null,
      experiment_group: assignGroup(cfg),
      consent_at: now,
    };
    d.settings.trial_duration_days = cfg.trial_duration_days;
    d.profile = profileFromAnswers(userId, a);
    d.flags.onboarding_done = true;
    d.journey = ([1, 2, 3, 4, 5, 6] as PhaseId[]).map((phase) => ({
      user_id: userId, phase, status: 'not_started', exercises_completed: 0, last_activity: null,
    }));
  });
  track('plan_generated', { goal: a.primary_goal ?? null });
  track('onboarding_completed');
}

export function saveOnboarding(patch: Partial<AppState['onboarding']>) {
  mutate((d) => {
    d.onboarding = { ...d.onboarding, ...patch };
  });
}

/* ---------- gatilhos / pensamentos ---------- */

export function ensureTrigger(d: AppState, id: string, now: string): string {
  const def = TRIGGER_CATALOG.find((t) => t.id === id);
  let t = d.triggers.find((x) => x.id === id);
  if (!t) {
    t = { id, user_id: d.user!.id, name: def?.name ?? id, kind: def?.kind ?? 'other', occurrence_count: 0, last_occurrence: null };
    d.triggers.push(t);
  }
  t.occurrence_count++;
  t.last_occurrence = now;
  return t.id;
}

export function ensureThought(d: AppState, content: string): string {
  let t = d.thoughts.find((x) => x.content.toLowerCase() === content.toLowerCase());
  if (!t) {
    t = { id: uid(), user_id: d.user!.id, content, occurrence_count: 0 };
    d.thoughts.push(t);
  }
  t.occurrence_count++;
  return t.id;
}

export function ensureCustomTrigger(d: AppState, name: string, now: string): string {
  const slug = 'custom:' + name.toLowerCase().replace(/\s+/g, '_').slice(0, 40);
  let t = d.triggers.find((x) => x.id === slug);
  if (!t) {
    t = { id: slug, user_id: d.user!.id, name, kind: 'other', occurrence_count: 0, last_occurrence: null };
    d.triggers.push(t);
  }
  t.occurrence_count++;
  t.last_occurrence = now;
  return t.id;
}

/* ---------- check-in ---------- */

export interface CheckInInput {
  mood: Mood;
  triggerId?: string | null;
  customTrigger?: string | null;
  thought?: string | null;
  urge?: number | null;
  source?: CheckIn['source'];
  timestamp?: string;
}

/** Registra o check-in, atualiza gatilhos/pensamentos e recalcula insights + fase. Retorna o id. */
export function recordCheckIn(input: CheckInInput): string {
  const id = uid();
  const ts = input.timestamp ?? new Date().toISOString();
  let created = 0;
  mutate((d) => {
    const tid = input.customTrigger ? ensureCustomTrigger(d, input.customTrigger, ts) : input.triggerId ? ensureTrigger(d, input.triggerId, ts) : null;
    const thid = input.thought ? ensureThought(d, input.thought) : null;
    d.checkIns.push({
      id, user_id: d.user!.id, timestamp: ts, emotional_state: input.mood,
      trigger_id: tid, automatic_thought_id: thid,
      urge_before: input.urge ?? null, urge_after: null, action_taken: 'none', intervention_id: null,
      source: input.source ?? 'home',
    });
    created = refresh(d, new Date(ts)).length;
  });
  if (created) track('insight_generated', { count: created });
  return id;
}

export function updateCheckIn(id: string, patch: Partial<CheckIn>) {
  mutate((d) => {
    const c = d.checkIns.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    refresh(d, new Date());
  });
}

/** Recalcula insights e a fase atual. Chamado dentro de qualquer mutação que gere dados. */
export function refresh(d: AppState, now: Date) {
  if (!d.user || !d.profile) return [];
  const { insights, created } = mergeInsights(d, now);
  d.insights = insights;
  d.profile.current_phase = currentPhase(d, now);
  return created;
}

/* ---------- intervenções ---------- */

export function startIntervention(type: InterventionType, triggerId: string | null, urgeBefore: number | null, plannedMinutes: number): string {
  const id = uid();
  mutate((d) => {
    d.interventions.push({
      id, user_id: d.user!.id, intervention_type: type, trigger_id: triggerId,
      started_at: new Date().toISOString(), completed_at: null,
      urge_before: urgeBefore, urge_after: null, helpfulness: null, planned_minutes: plannedMinutes,
    });
  });
  track('intervention_started', { type, planned_minutes: plannedMinutes });
  return id;
}

export function completeIntervention(id: string, checkInId: string | null, urgeAfter: number, action: ActionTaken, completedAt?: string) {
  mutate((d) => {
    const i = d.interventions.find((x) => x.id === id);
    if (!i) return;
    i.completed_at = completedAt ?? new Date().toISOString();
    i.urge_after = urgeAfter;
    const dl = (i.urge_before ?? urgeAfter) - urgeAfter;
    i.helpfulness = dl >= 2 ? 'helped' : dl >= 0 ? 'neutral' : 'not_helped';
    if (checkInId) {
      const c = d.checkIns.find((x) => x.id === checkInId);
      if (c) {
        c.urge_after = urgeAfter;
        c.action_taken = action;
        c.intervention_id = id;
      }
    }
    touchJourney(d, i.intervention_type === 'pause' ? 2 : 1);
    refresh(d, new Date());
  });
  track('intervention_completed', { urge_after: urgeAfter, action });
  if (action === 'acted') track('relapse_recorded');
}

export function touchJourney(d: AppState, phase: PhaseId) {
  const j = d.journey.find((x) => x.phase === phase);
  if (!j) return;
  j.exercises_completed++;
  j.last_activity = new Date().toISOString();
  const wasExplored = j.status === 'explored';
  j.status = j.exercises_completed >= 2 ? 'explored' : 'in_progress';
  if (j.exercises_completed === 1) track('phase_started', { phase });
  if (!wasExplored && j.status === 'explored') track('phase_completed', { phase });
}

export function markAction(checkInId: string, action: ActionTaken) {
  updateCheckIn(checkInId, { action_taken: action });
  if (action === 'acted') track('relapse_recorded');
}

/* ---------- limites ---------- */

export function addBoundary(description: string, category: BoundaryCategory) {
  if (detectRisk(description)) return false;
  mutate((d) => {
    d.boundaries.push({
      id: uid(), user_id: d.user!.id, description, category, active: true,
      respected_count: 0, broken_count: 0, created_at: new Date().toISOString(),
    });
    touchJourney(d, 5);
  });
  track('boundary_created', { category });
  return true;
}

export function toggleBoundary(id: string) {
  mutate((d) => {
    const b = d.boundaries.find((x) => x.id === id);
    if (b) b.active = !b.active;
  });
}

export function resolveBoundary(id: string, kept: boolean) {
  mutate((d) => {
    const b: Boundary | undefined = d.boundaries.find((x) => x.id === id);
    if (!b) return;
    if (kept) b.respected_count++;
    else b.broken_count++;
    refresh(d, new Date());
  });
  track(kept ? 'boundary_protected' : 'boundary_broken');
}

/* ---------- métricas diárias ---------- */

export function logDay(patch: { whatsapp_checks?: number; contact_attempts?: number; plans_cancelled?: number; plans_protected?: number }) {
  const key = dateKey(new Date());
  mutate((d) => {
    let m = d.metrics.find((x) => x.date === key);
    if (!m) {
      m = { user_id: d.user!.id, date: key, whatsapp_checks: null, contact_attempts: null, plans_cancelled: 0, plans_protected: 0 };
      d.metrics.push(m);
    }
    if (patch.whatsapp_checks != null) m.whatsapp_checks = patch.whatsapp_checks;
    if (patch.contact_attempts != null) m.contact_attempts = patch.contact_attempts;
    if (patch.plans_cancelled) m.plans_cancelled += patch.plans_cancelled;
    if (patch.plans_protected) m.plans_protected += patch.plans_protected;
    refresh(d, new Date());
  });
}

/* ---------- práticas das etapas ---------- */

export function addPrediction(thought: string, prediction: string, behavior: 'waited' | 'acted') {
  mutate((d) => {
    d.predictions.push({ id: uid(), user_id: d.user!.id, thought, prediction, behavior, created_at: new Date().toISOString(), outcome: null, resolved_at: null });
    touchJourney(d, 3);
    refresh(d, new Date());
  });
}

export function resolvePrediction(id: string, outcome: 'as_predicted' | 'partly' | 'not_happened') {
  mutate((d) => {
    const p = d.predictions.find((x) => x.id === id);
    if (p) {
      p.outcome = outcome;
      p.resolved_at = new Date().toISOString();
    }
    refresh(d, new Date());
  });
  track('prediction_resolved', { outcome });
}

export function addActivity(category: string, description: string, planned_for: 'today' | 'tomorrow') {
  mutate((d) => {
    d.activities.push({ id: uid(), user_id: d.user!.id, category, description, planned_for, created_at: new Date().toISOString(), done_at: null });
    touchJourney(d, 4);
    refresh(d, new Date());
  });
}

export function completeActivity(id: string) {
  mutate((d) => {
    const a = d.activities.find((x) => x.id === id);
    if (a) a.done_at = new Date().toISOString();
    refresh(d, new Date());
  });
}

export function saveRelapsePlan(signs: string[], plan: string) {
  mutate((d) => {
    d.profile!.early_signs = signs;
    d.profile!.relapse_plan = plan;
    touchJourney(d, 6);
    refresh(d, new Date());
  });
}

export function mapEpisodePractice() {
  mutate((d) => {
    touchJourney(d, 1);
    refresh(d, new Date());
  });
}

export function addReciprocity(s: Omit<ReciprocitySignal, 'id' | 'user_id' | 'timestamp'>) {
  mutate((d) => {
    d.reciprocity.push({ ...s, id: uid(), user_id: d.user!.id, timestamp: new Date().toISOString() });
  });
}

/* ---------- insights / flags ---------- */

export function markInsightViewed(id: string) {
  const i = getState().insights.find((x) => x.id === id);
  if (!i || i.viewed_at) return;
  mutate((d) => {
    const x = d.insights.find((y) => y.id === id);
    if (x) x.viewed_at = new Date().toISOString();
  });
  track('insight_viewed', { type: i.type, confidence: i.confidence });
}

export function setFlag<K extends keyof AppState['flags']>(k: K, v: AppState['flags'][K]) {
  mutate((d) => {
    d.flags[k] = v;
  });
}

export function pushFlag(k: 'weekly_viewed' | 'patterns_seen', v: string) {
  mutate((d) => {
    if (!d.flags[k].includes(v)) d.flags[k].push(v);
  });
}

/* ---------- perfil: objetivo, situação, reconciliação ---------- */

export function changeGoal(goal: Goal) {
  mutate((d) => {
    d.profile!.primary_goal = goal;
    d.profile!.goal_history.push({ goal, at: new Date().toISOString() });
    refresh(d, new Date());
  });
}

export function setRelationshipStatus(s: RelationshipStatus) {
  mutate((d) => {
    d.profile!.relationship_status = s;
    refresh(d, new Date());
  });
}

const RECONCILE_GOAL: Record<ReconcileFocus, Goal> = {
  rebuild: 'control',
  observe: 'clarity',
  insecure: 'clarity',
  autonomy: 'independence',
};

/** Reconciliação: preserva todo o histórico, altera objetivo e prioridade (limites, reciprocidade, prevenção). */
export function declareReconciliation(focus: ReconcileFocus) {
  mutate((d) => {
    d.profile!.relationship_status = 'reconciled';
    d.profile!.reconcile_focus = focus;
    d.profile!.primary_goal = RECONCILE_GOAL[focus];
    d.profile!.goal_history.push({ goal: RECONCILE_GOAL[focus], at: new Date().toISOString() });
    refresh(d, new Date());
  });
  track('reconciliation_declared', { focus });
}

export function declareEnded() {
  mutate((d) => {
    d.profile!.relationship_status = 'ended';
    d.profile!.reconcile_focus = null;
    d.profile!.primary_goal = 'independence';
    d.profile!.goal_history.push({ goal: 'independence', at: new Date().toISOString() });
    refresh(d, new Date());
  });
}

/* ---------- assinatura / trial ---------- */

export function startTrial() {
  const st = getState();
  const days = st.settings.trial_duration_days;
  const now = new Date();
  mutate((d) => {
    d.user!.subscription_status = 'trialing';
    d.user!.trial_started_at = now.toISOString();
    d.user!.trial_ends_at = new Date(now.getTime() + days * DAY).toISOString();
  });
  track('trial_started', { trial_duration_days: days });
}

export function subscribe() {
  mutate((d) => {
    d.user!.subscription_status = 'active';
  });
  track('subscription_started');
}

export function cancelSubscription() {
  mutate((d) => {
    d.user!.subscription_status = 'cancelled';
  });
  track('subscription_cancelled');
}

export function effectiveSubscription(st: AppState, now: Date): SubscriptionStatus {
  const u = st.user;
  if (!u) return 'none';
  if (u.subscription_status === 'trialing' && u.trial_ends_at && new Date(u.trial_ends_at) < now) return 'expired';
  return u.subscription_status;
}

/* ---------- dados ---------- */

export function exportData(): string {
  const st = getState();
  const { events: _events, ...rest } = st;
  void _events;
  return JSON.stringify({ exported_at: new Date().toISOString(), ...rest }, null, 2);
}

export function deleteAllData() {
  resetAll();
}

export function restoreState(s: AppState) {
  setState(s);
}
