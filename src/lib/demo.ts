import type { AppState, PhaseId } from '../types';
import { DAY, dateKey, uid } from './time';
import { mutate } from './store';
import { ensureThought, ensureTrigger, refresh } from './actions';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THOUGHTS = ['Está me esquecendo', 'Preciso mandar mensagem', 'Se eu não fizer nada vou perder a pessoa', 'Não se importa comigo'];

/** Gera 3 semanas de uso fictício para demonstrar insights, progresso, Dia 22 e SOS com memória. */
export function seedDemo(_name?: string) {
  void _name;
  const r = rng(42);
  const now = Date.now();
  mutate((d: AppState) => {
    d.checkIns = []; d.triggers = []; d.thoughts = []; d.interventions = []; d.boundaries = [];
    d.metrics = []; d.insights = []; d.predictions = []; d.activities = []; d.reciprocity = [];
    d.flags.day22_seen = false; d.flags.weekly_viewed = []; d.flags.patterns_seen = [];
    d.user!.created_at = new Date(now - 21 * DAY).toISOString();
    d.journey = ([1, 2, 3, 4, 5, 6] as PhaseId[]).map((phase) => ({ user_id: d.user!.id, phase, status: 'not_started', exercises_completed: 0, last_activity: null }));
    const uidv = d.user!.id;

    for (let day = 20; day >= 0; day--) {
      const progress = (20 - day) / 20; // 0 → 1
      const n = r() < 0.75 ? (r() < 0.4 ? 2 : 1) : 0;
      for (let k = 0; k < n; k++) {
        const hour = r() < 0.7 ? 20 + Math.floor(r() * 3) : 9 + Math.floor(r() * 10);
        const ts = new Date(now - day * DAY);
        ts.setHours(hour, Math.floor(r() * 60), 0, 0);
        if (ts.getTime() > now) continue;
        const tr = r() < 0.55 ? 'vanished' : r() < 0.6 ? 'sent_message' : r() < 0.5 ? 'saw_social' : 'no_reply';
        const iso = ts.toISOString();
        const tid = ensureTrigger(d, tr, iso);
        const thid = ensureThought(d, r() < 0.6 ? THOUGHTS[0] : THOUGHTS[Math.floor(r() * THOUGHTS.length)]);
        const urge = Math.max(3, Math.min(10, Math.round(8.6 - progress * 2.7 + (r() - 0.5) * 2)));
        const after = Math.max(1, urge - (r() < 0.7 ? 2 + Math.floor(r() * 3) : 0));
        const acted = progress < 0.4 && r() < 0.25;
        const iid = uid();
        const start = ts.getTime() + 60_000;
        d.interventions.push({
          id: iid, user_id: uidv, intervention_type: 'pause', trigger_id: tid, started_at: new Date(start).toISOString(),
          completed_at: new Date(start + (10 + Math.floor(r() * 5)) * 60_000).toISOString(), urge_before: urge, urge_after: after,
          helpfulness: urge - after >= 2 ? 'helped' : 'neutral', planned_minutes: 12,
        });
        d.checkIns.push({
          id: uid(), user_id: uidv, timestamp: iso, emotional_state: r() < 0.5 ? 'anxious' : r() < 0.5 ? 'impulse' : 'longing',
          trigger_id: tid, automatic_thought_id: thid, urge_before: urge, urge_after: after,
          action_taken: acted ? 'acted' : 'waited', intervention_id: iid, source: 'home',
        });
      }
      const date = dateKey(new Date(now - day * DAY));
      d.metrics.push({
        user_id: uidv, date, whatsapp_checks: Math.max(2, Math.round(17 - progress * 11 + (r() - 0.5) * 3)), contact_attempts: r() < 0.5 - progress * 0.3 ? 1 : 0,
        plans_cancelled: progress < 0.45 && r() < 0.4 ? 1 : 0, plans_protected: progress > 0.3 && r() < 0.35 ? 1 : 0,
      });
    }
    d.boundaries.push({ id: uid(), user_id: uidv, description: 'Não cancelar planos quando a pessoa chamar de última hora.', category: 'plans', active: true, respected_count: 4, broken_count: 2, created_at: new Date(now - 10 * DAY).toISOString() });
    d.predictions.push({ id: uid(), user_id: uidv, thought: THOUGHTS[2], prediction: 'Vou perder a pessoa', behavior: 'waited', created_at: new Date(now - 6 * DAY).toISOString(), outcome: 'not_happened', resolved_at: new Date(now - 5 * DAY).toISOString() });
    d.journey.forEach((j, i) => { j.exercises_completed = i < 3 ? 2 : i === 4 ? 1 : 0; j.status = j.exercises_completed >= 2 ? 'explored' : j.exercises_completed ? 'in_progress' : 'not_started'; j.last_activity = new Date(now - (6 - i) * DAY).toISOString(); });
    refresh(d, new Date(now));
  });
}
