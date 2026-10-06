import type { AppState } from '../types';
import { DAY, avg, fmtNum } from '../lib/time';
import { PHASES } from '../data/content';
import { delta, episodes, mode, thoughtText, triggerName } from './stats';
import { currentPhase } from './recommend';

export interface WeeklySummary {
  topTrigger: string | null;
  topThought: string | null;
  avgUrge: string | null;
  bestStrategy: string | null;
  change: string | null;
  nextFocus: string;
  episodeCount: number;
}

export function weeklySummary(st: AppState, now: Date): WeeklySummary {
  const since = new Date(now.getTime() - 7 * DAY);
  const eps = episodes(st, since);
  const trig = mode(eps.map((e) => e.trigger_id!));
  const th = mode(eps.map((e) => e.automatic_thought_id).filter(Boolean) as string[]);
  const u = avg(eps.map((e) => e.urge_before).filter((x): x is number => x != null));

  const ints = st.interventions.filter((i) => new Date(i.started_at) >= since && delta(i) != null);
  const helped = ints.filter((i) => (delta(i) ?? 0) >= 2);
  const bestStrategy = helped.length
    ? helped.length === ints.length || helped.length / ints.length >= 0.5
      ? 'Esperar antes de agir'
      : null
    : null;

  const kept = st.metrics.filter((m) => new Date(m.date + 'T12:00:00') >= since).reduce((a, m) => a + m.plans_protected, 0);
  const crossed = eps.filter((e) => e.action_taken === 'waited' && (e.urge_before ?? 0) >= 6).length;
  const change =
    kept > 0
      ? `Você manteve ${kept} ${kept === 1 ? 'compromisso' : 'compromissos'} seu${kept === 1 ? '' : 's'}.`
      : crossed > 0
        ? `Você atravessou ${crossed} ${crossed === 1 ? 'urgência' : 'urgências'} sem agir no pico.`
        : null;

  const phase = PHASES[currentPhase(st, now) - 1];
  return {
    topTrigger: trig ? triggerName(st, trig.value) : null,
    topThought: th ? thoughtText(st, th.value) : null,
    avgUrge: u != null ? fmtNum(u) : null,
    bestStrategy,
    change,
    nextFocus: phase.user,
    episodeCount: eps.length,
  };
}
