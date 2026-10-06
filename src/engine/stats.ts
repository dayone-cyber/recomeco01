import type { AppState, CheckIn, Intervention } from '../types';
import { DAY, avg, dateKey } from '../lib/time';
import { TRIGGER_CATALOG } from '../data/content';

/** Episódio = check-in ativado (não-calmo) com gatilho conhecido. */
export function episodes(st: AppState, since?: Date): CheckIn[] {
  return st.checkIns.filter(
    (c) => c.emotional_state !== 'calm' && c.trigger_id && (!since || new Date(c.timestamp) >= since),
  );
}

export const triggerName = (st: AppState, id: string | null): string | null =>
  id ? (st.triggers.find((t) => t.id === id)?.name ?? TRIGGER_CATALOG.find((t) => t.id === id)?.name ?? null) : null;

export const thoughtText = (st: AppState, id: string | null): string | null =>
  id ? (st.thoughts.find((t) => t.id === id)?.content ?? null) : null;

export function mode<T>(xs: T[]): { value: T; count: number } | null {
  if (!xs.length) return null;
  const m = new Map<T, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  let best: [T, number] | null = null;
  m.forEach((n, k) => {
    if (!best || n > best[1]) best = [k, n];
  });
  return { value: best![0], count: best![1] };
}

export const minutesOf = (i: Intervention): number | null =>
  i.completed_at ? Math.max(1, Math.round((new Date(i.completed_at).getTime() - new Date(i.started_at).getTime()) / 60000)) : null;

export const delta = (i: { urge_before: number | null; urge_after: number | null }): number | null =>
  i.urge_before != null && i.urge_after != null ? i.urge_before - i.urge_after : null;

export interface TriggerHistory {
  triggerId: string;
  count: number;
  avgUrge: number | null;
  topThought: string | null;
  lastIntervention: Intervention | null;
  helpedCount: number;
  measuredCount: number;
  actedCount: number;
  bestMinutes: number | null;
}

export function triggerHistory(st: AppState, triggerId: string, excludeCheckInId?: string): TriggerHistory {
  const eps = st.checkIns.filter((c) => c.trigger_id === triggerId && c.id !== excludeCheckInId && c.emotional_state !== 'calm');
  const thoughtIds = eps.map((e) => e.automatic_thought_id).filter(Boolean) as string[];
  const topT = mode(thoughtIds);
  const ints = eps
    .map((e) => st.interventions.find((i) => i.id === e.intervention_id))
    .filter((i): i is Intervention => !!i && i.completed_at != null && delta(i) != null)
    .sort((a, b) => (a.completed_at! < b.completed_at! ? -1 : 1));
  const helped = ints.filter((i) => (delta(i) ?? 0) >= 2);
  const mins = helped.map(minutesOf).filter((m): m is number => m != null);
  return {
    triggerId,
    count: eps.length,
    avgUrge: avg(eps.map((e) => e.urge_before).filter((u): u is number => u != null)),
    topThought: topT ? thoughtText(st, topT.value) : null,
    lastIntervention: ints.at(-1) ?? null,
    helpedCount: helped.length,
    measuredCount: ints.length,
    actedCount: eps.filter((e) => e.action_taken === 'acted').length,
    bestMinutes: mins.length ? Math.round(avg(mins)!) : null,
  };
}

/** Pontuação de efetividade por tipo de intervenção (0..1), só com dados medidos. */
export function effectiveness(st: AppState, type: Intervention['intervention_type'], triggerId?: string): { score: number | null; n: number } {
  const xs = st.interventions.filter(
    (i) => i.intervention_type === type && i.completed_at && delta(i) != null && (!triggerId || i.trigger_id === triggerId),
  );
  if (!xs.length) return { score: null, n: 0 };
  return { score: xs.filter((i) => (delta(i) ?? 0) >= 2).length / xs.length, n: xs.length };
}

export function metricsSince(st: AppState, now: Date, days: number) {
  const from = dateKey(new Date(now.getTime() - (days - 1) * DAY));
  return st.metrics.filter((m) => m.date >= from);
}

export function relapses(st: AppState, since?: Date): CheckIn[] {
  return st.checkIns.filter((c) => c.action_taken === 'acted' && (!since || new Date(c.timestamp) >= since));
}

export function avgUrge(cs: CheckIn[]): number | null {
  return avg(cs.map((c) => c.urge_before).filter((u): u is number => u != null));
}
