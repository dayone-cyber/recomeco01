import type { AppState } from '../types';
import { DAY, avg, journeyDay } from '../lib/time';
import { avgUrge, delta, episodes, metricsSince } from './stats';

export interface ProgressData {
  hasEnoughData: boolean;
  checks: { before: number; now: number | null; pct: number | null };
  crossed: number; // urgências atravessadas sem agir no pico
  plansProtected: number;
  plansCancelled: number;
  weeklyUrge: { label: string; value: number | null }[];
  boundariesKept: number;
  boundariesBroken: number;
}

export function progress(st: AppState, now: Date): ProgressData {
  const p = st.profile!;
  const m7 = metricsSince(st, now, 7).filter((m) => m.whatsapp_checks != null);
  const nowChecks = m7.length >= 2 ? avg(m7.map((m) => m.whatsapp_checks!)) : null;
  const before = p.baseline_check_frequency;
  const pct = nowChecks != null && before > 0 ? Math.round(((nowChecks - before) / before) * 100) : null;

  // urgência atravessada: episódio com urgência ≥ 6 em que houve intervenção concluída e a pessoa não agiu
  const crossed = st.checkIns.filter((c) => (c.urge_before ?? 0) >= 6 && c.action_taken === 'waited').length;

  const start = new Date(st.user!.created_at);
  const day = journeyDay(st.user!.created_at, now);
  const nWeeks = Math.max(1, Math.min(4, Math.ceil(day / 7)));
  const weeks = Array.from({ length: nWeeks }, (_, i) => {
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() + i * 7 * DAY;
    const to = from + 7 * DAY;
    const cs = episodes(st).filter((c) => {
      const t = new Date(c.timestamp).getTime();
      return t >= from && t < to;
    });
    return { label: `Semana ${i + 1}`, value: cs.length >= 2 ? avgUrge(cs) : null };
  });

  return {
    hasEnoughData: st.checkIns.length >= 3,
    checks: { before, now: nowChecks, pct },
    crossed,
    plansProtected: st.metrics.reduce((a, m) => a + m.plans_protected, 0),
    plansCancelled: st.metrics.reduce((a, m) => a + m.plans_cancelled, 0),
    weeklyUrge: weeks,
    boundariesKept: st.boundaries.reduce((a, b) => a + b.respected_count, 0),
    boundariesBroken: st.boundaries.reduce((a, b) => a + b.broken_count, 0),
  };
}

export function reliefDrop(st: AppState): { n: number; avgDrop: number | null } {
  const ds = st.interventions.map(delta).filter((d): d is number => d != null);
  return { n: ds.length, avgDrop: avg(ds) };
}
