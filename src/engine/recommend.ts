import type { AppState, Goal, PhaseId, RelationshipStatus } from '../types';
import { DAY, HOUR, dateKey, journeyDay, isoWeekKey, isSameDay } from '../lib/time';
import { PHASES, TRIGGER_BOUNDARY } from '../data/content';
import { avgUrge, effectiveness, episodes, mode, relapses, thoughtText, triggerHistory, triggerName, minutesOf, delta } from './stats';

export type ActionKind =
  | 'first_checkin'
  | 'relapse_followup'
  | 'pause'
  | 'weekly'
  | 'day22'
  | 'resolve_test'
  | 'practice'
  | 'close_day';

export interface NextAction {
  kind: ActionKind;
  phase: PhaseId;
  label: string; // "Fase 2 · Pausar"
  title: string;
  context: string;
  cta: string;
  minutes: number;
  reasons: string[]; // por que o motor escolheu isso (auditável)
}

export const JOURNEY_LEARNING_DAYS = 21;

/* ------------------------------------------------------------------ */
/* Prioridade das 6 etapas — jornada não linear                        */
/* ------------------------------------------------------------------ */

export interface PhaseScore {
  phase: PhaseId;
  score: number;
  reasons: string[];
}

const GOAL_BIAS: Record<Goal, Partial<Record<PhaseId, number>>> = {
  independence: { 4: 1.5, 1: 0.5 },
  control: { 2: 1.5, 1: 0.5 },
  clarity: { 3: 1.5, 1: 1 },
  reconnect: { 2: 1, 5: 1, 3: 0.5 },
};

const STATUS_BIAS: Partial<Record<RelationshipStatus, Partial<Record<PhaseId, number>>>> = {
  reconciled: { 5: 6, 3: 1.5, 6: 1.5 },
  ended: { 2: 1.5, 3: 1.5, 4: 3 },
  on_off: { 5: 1 },
};

function weekCount(st: AppState, now: Date, from: number, to: number, pick: (m: AppState['metrics'][number]) => number) {
  return st.metrics
    .filter((m) => {
      const age = (now.getTime() - new Date(m.date + 'T12:00:00').getTime()) / DAY;
      return age >= from && age < to;
    })
    .reduce((a, m) => a + pick(m), 0);
}

export function phaseScores(st: AppState, now: Date): PhaseScore[] {
  const p = st.profile;
  const scores: PhaseScore[] = PHASES.map((ph) => ({ phase: ph.id, score: 0, reasons: [] }));
  const add = (phase: PhaseId, n: number, why: string) => {
    const s = scores[phase - 1];
    s.score += n;
    if (n !== 0) s.reasons.push(why);
  };
  if (!p) return scores;

  // linha do tempo dos 21 dias: semana 1 entender+pausar, 2 testar+retomar, 3 limites+sustentar
  const day = Math.max(1, journeyDay(st.user!.created_at, now));
  const week = Math.max(1, Math.min(3, Math.ceil(day / 7)));
  const weekPhases: Record<number, PhaseId[]> = { 1: [1, 2], 2: [3, 4], 3: [5, 6] };
  weekPhases[week].forEach((ph) => add(ph, 2, `Semana ${week} da base pessoal`));
  if (day > JOURNEY_LEARNING_DAYS) add(6, 1, 'Fase de sustentação');

  Object.entries(GOAL_BIAS[p.primary_goal]).forEach(([ph, n]) => add(Number(ph) as PhaseId, n!, 'Objetivo declarado'));
  Object.entries(STATUS_BIAS[p.relationship_status] ?? {}).forEach(([ph, n]) => add(Number(ph) as PhaseId, n!, 'Situação atual'));

  // Dados
  const eps = episodes(st);
  const eps7 = episodes(st, new Date(now.getTime() - 7 * DAY));
  if (eps.length < 3) add(1, 4, 'Poucos registros — mapear o ciclo');
  const u7 = avgUrge(eps7);
  if (u7 != null && u7 >= 7) add(2, 3, 'Urgência recente alta');
  const pauseEff = effectiveness(st, 'pause');
  if (pauseEff.n < 3 && eps.length >= 2) add(2, 2, 'Pausa ainda pouco treinada');

  const thoughtTop = mode(eps.map((e) => e.automatic_thought_id).filter(Boolean) as string[]);
  const resolved = st.predictions.filter((x) => x.outcome).length;
  if (thoughtTop && thoughtTop.count >= 3 && resolved < 3) add(3, 3, 'Pensamento recorrente ainda não testado');

  const cancelNow = weekCount(st, now, 0, 7, (m) => m.plans_cancelled);
  const cancelPrev = weekCount(st, now, 7, 14, (m) => m.plans_cancelled);
  if (cancelNow >= 2 && cancelNow >= cancelPrev) add(4, 3, 'Planos cancelados aumentando');
  if (st.activities.filter((a) => a.done_at).length < 2) add(4, 0.5, 'Poucas atividades próprias');

  const brokenNow = st.boundaries.reduce((a, b) => a + b.broken_count, 0);
  const keptNow = st.boundaries.reduce((a, b) => a + b.respected_count, 0);
  if (!st.boundaries.some((b) => b.active)) add(5, p.boundary_difficulty >= 2 ? 3 : 1.5, 'Ainda sem limites definidos');
  if (brokenNow > keptNow && brokenNow >= 2) add(5, 3, 'Limites sendo quebrados');

  // melhora geral + poucas recaídas → sustentar
  const w0 = avgUrge(episodes(st, new Date(now.getTime() - 14 * DAY)).filter((e) => now.getTime() - new Date(e.timestamp).getTime() > 7 * DAY));
  const improving = u7 != null && w0 != null && u7 < w0 - 0.5;
  const rel14 = relapses(st, new Date(now.getTime() - 14 * DAY)).length;
  if (improving && rel14 <= 1) add(6, 3, 'Métricas melhorando com poucas recaídas');
  if (day > JOURNEY_LEARNING_DAYS && !p.relapse_plan) add(6, 1.5, 'Plano de prevenção ainda não criado');

  // Recaída recente: etapa 2 volta temporariamente (Limites → Pausar ↺ → Limites)
  const recent = relapses(st, new Date(now.getTime() - 2 * DAY));
  if (recent.length) add(2, 4, 'Recaída recente — retomar a pausa');

  // rodízio: evita repetir a prática da fase já feita hoje
  st.journey.forEach((j) => {
    if (j.last_activity && isSameDay(new Date(j.last_activity), now)) add(j.phase, -3.5, 'Já praticada hoje');
  });
  return scores;
}

export function rankedPhases(st: AppState, now: Date): PhaseScore[] {
  return phaseScores(st, now).sort((a, b) => b.score - a.score || a.phase - b.phase);
}

/** Fase "base" da jornada (sem o ajuste de rodízio diário). */
export function currentPhase(st: AppState, now: Date): PhaseId {
  const scores = phaseScores(st, now).map((s) => {
    const rot = st.journey.find((j) => j.phase === s.phase);
    const rotated = rot?.last_activity && isSameDay(new Date(rot.last_activity), now) ? 3.5 : 0;
    return { ...s, score: s.score + rotated };
  });
  return scores.sort((a, b) => b.score - a.score || a.phase - b.phase)[0].phase;
}

export function temporaryDetour(st: AppState, now: Date): PhaseId | null {
  const cur = currentPhase(st, now);
  if (cur !== 2 && relapses(st, new Date(now.getTime() - 2 * DAY)).length) return 2;
  return null;
}

/* ------------------------------------------------------------------ */
/* Próxima melhor ação                                                 */
/* ------------------------------------------------------------------ */

export function hasWeeklySummary(st: AppState, now: Date): boolean {
  if (!st.user) return false;
  const key = isoWeekKey(now);
  if (st.flags.weekly_viewed.includes(key)) return false;
  const since = new Date(now.getTime() - 7 * DAY);
  const n = st.checkIns.filter((c) => new Date(c.timestamp) >= since).length;
  return n >= 3 && journeyDay(st.user.created_at, now) >= 7;
}

export function day22Pending(st: AppState, now: Date): boolean {
  return !!st.user && !st.flags.day22_seen && journeyDay(st.user.created_at, now) > JOURNEY_LEARNING_DAYS;
}

function focusContext(st: AppState, now: Date): string {
  const eps = episodes(st, new Date(now.getTime() - 7 * DAY));
  const top = mode(eps.map((e) => e.trigger_id!));
  if (top && top.count >= 2) {
    const name = triggerName(st, top.value)!.toLowerCase();
    return `Nos últimos dias, "${name}" foi o gatilho que mais apareceu nos seus registros.`;
  }
  return 'Ainda estamos aprendendo o seu padrão. Cada registro deixa o acompanhamento mais preciso.';
}

const PRACTICE: Record<PhaseId, { title: string; cta: string; minutes: number }> = {
  1: { title: 'Mapear um episódio do seu ciclo.', cta: 'Fazer a prática de hoje', minutes: 3 },
  2: { title: '10 minutos entre o impulso e a ação.', cta: 'Fazer a prática de hoje', minutes: 3 },
  3: { title: 'Transformar um medo em hipótese.', cta: 'Fazer a prática de hoje', minutes: 3 },
  4: { title: 'Um passo seu, só seu, hoje.', cta: 'Fazer a prática de hoje', minutes: 2 },
  5: { title: 'Decidir um limite antes de precisar dele.', cta: 'Fazer a prática de hoje', minutes: 2 },
  6: { title: 'Reconhecer seus sinais precoces.', cta: 'Fazer a prática de hoje', minutes: 3 },
};

export function nextBestAction(st: AppState, now: Date): NextAction {
  const reasons: string[] = [];
  const phase = currentPhase(st, now);
  const ph = PHASES[phase - 1];
  const eps = episodes(st);
  const lastCheckIn = st.checkIns.at(-1);

  // 0. nenhum registro ainda
  if (st.checkIns.length === 0) {
    return {
      kind: 'first_checkin',
      phase: 1,
      label: 'Fase 1 · Entender',
      title: 'Vamos registrar o primeiro episódio do seu ciclo.',
      context: 'Em 30 segundos o acompanhamento começa a conhecer o seu padrão.',
      cta: 'Mapear meu ciclo',
      minutes: 1,
      reasons: ['Sem check-ins: a primeira ação gera dados'],
    };
  }

  // 1. recaída recente sem acompanhamento
  const rel = relapses(st, new Date(now.getTime() - 24 * HOUR));
  const followed = st.journey.find((j) => j.phase === 2)?.last_activity;
  if (rel.length && (!followed || new Date(followed) <= new Date(rel.at(-1)!.timestamp))) {
    reasons.push('Recaída nas últimas 24h');
    return {
      kind: 'relapse_followup',
      phase: 2,
      label: 'Fase 2 · Pausar ↺',
      title: 'O que aconteceu é informação, não retrocesso.',
      context: 'Vamos olhar o contexto do episódio e recuperar o espaço antes de agir. Seu progresso continua.',
      cta: 'Ver o que aconteceu',
      minutes: 3,
      reasons,
    };
  }

  // 2. urgência alta recente sem intervenção
  if (lastCheckIn && lastCheckIn.emotional_state !== 'calm' && (lastCheckIn.urge_before ?? 0) >= 8 && !lastCheckIn.intervention_id && now.getTime() - new Date(lastCheckIn.timestamp).getTime() < 3 * HOUR) {
    reasons.push('Urgência ≥ 8 há menos de 3h sem intervenção');
    return {
      kind: 'pause',
      phase: 2,
      label: 'Fase 2 · Pausar',
      title: 'Não responda no pico.',
      context: 'Sua última urgência ficou alta. Primeiro deixamos a onda baixar.',
      cta: 'Começar minha pausa',
      minutes: 10,
      reasons,
    };
  }

  // 3. Dia 22
  if (day22Pending(st, now)) {
    return {
      kind: 'day22',
      phase,
      label: 'Seus 21 dias',
      title: 'Os 21 dias acabaram. O acompanhamento não.',
      context: 'Veja o que o Recomeço aprendeu sobre o seu padrão.',
      cta: 'Ver o que aprendemos',
      minutes: 2,
      reasons: ['Dia 22 alcançado'],
    };
  }

  // 4. resumo semanal
  if (hasWeeklySummary(st, now)) {
    return {
      kind: 'weekly',
      phase,
      label: 'Resumo da semana',
      title: 'Seu resumo semanal está pronto.',
      context: 'O que mais te ativou, o que ajudou e qual deve ser o próximo foco.',
      cta: 'Ver minha semana',
      minutes: 2,
      reasons: ['Nova semana com dados suficientes'],
    };
  }

  // 5. teste de previsão aguardando resultado
  const pending = st.predictions.find((x) => !x.outcome && now.getTime() - new Date(x.created_at).getTime() > 3 * HOUR);
  if (pending) {
    return {
      kind: 'resolve_test',
      phase: 3,
      label: 'Fase 3 · Testar',
      title: 'Compare sua previsão com o que realmente aconteceu.',
      context: `Você previu: "${pending.prediction}"`,
      cta: 'Registrar o resultado',
      minutes: 1,
      reasons: ['Previsão sem resultado registrado'],
    };
  }

  // 6. fechamento do dia (noite, sem métricas de hoje)
  const todayKey = dateKey(now);
  if (now.getHours() >= 19 && !st.metrics.some((m) => m.date === todayKey) && eps.length >= 1) {
    return {
      kind: 'close_day',
      phase: 1,
      label: 'Fechamento do dia',
      title: 'Como foi o dia, em números rápidos?',
      context: 'Checagens, planos mantidos e planos cancelados. É isso que mostra a sua mudança.',
      cta: 'Fechar o dia',
      minutes: 1,
      reasons: ['Noite sem registro de métricas'],
    };
  }

  // 7. prática da fase prioritária
  let title = PRACTICE[phase].title;
  let cta = PRACTICE[phase].cta;
  let minutes = PRACTICE[phase].minutes;
  const ranked = rankedPhases(st, now)[0];
  reasons.push(...ranked.reasons);

  if (phase === 2) {
    const best = bestPauseMinutes(st);
    title = `${best ?? 10} minutos entre o impulso e a ação.`;
  }
  if (phase === 5) {
    const open = openBoundaryForReview(st);
    if (open) {
      title = 'Revisar um limite que apareceu nos seus registros.';
      cta = 'Revisar meu limite';
    }
  }
  if (phase === 3) {
    const th = mode(eps.map((e) => e.automatic_thought_id).filter(Boolean) as string[]);
    if (th) title = `Testar: "${thoughtText(st, th.value)}"`;
  }
  const detour = temporaryDetour(st, now);
  return {
    kind: 'practice',
    phase,
    label: `Fase ${phase} · ${ph.name}${detour ? ' ↺' : ''}`,
    title,
    context: focusContext(st, now),
    cta,
    minutes,
    reasons,
  };
}

export function bestPauseMinutes(st: AppState): number | null {
  const ms = st.interventions
    .filter((i) => i.intervention_type === 'pause' && i.completed_at && (delta(i) ?? 0) >= 2)
    .map(minutesOf)
    .filter((m): m is number => m != null && m >= 3);
  return ms.length >= 2 ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null;
}

function openBoundaryForReview(st: AppState) {
  return st.boundaries.find((b) => b.active && b.broken_count > b.respected_count) ?? null;
}

/* ------------------------------------------------------------------ */
/* Decisão pós check-in                                                */
/* ------------------------------------------------------------------ */

export type CheckInDecision = 'record' | 'practice' | 'intervene' | 'sos';

export function decideAfterCheckIn(st: AppState, triggerId: string | null, urge: number): { decision: CheckInDecision; reason: string } {
  const hist = triggerId ? triggerHistory(st, triggerId) : null;
  const relapseHigh = !!hist && hist.count >= 2 && hist.actedCount / hist.count >= 0.4;
  if (urge >= 9 && relapseHigh) return { decision: 'sos', reason: 'Urgência muito alta num gatilho que já levou a recaídas' };
  if (urge >= 8) return { decision: 'intervene', reason: 'Urgência ≥ 8: priorizar pausa' };
  if (relapseHigh && urge >= 5) return { decision: 'intervene', reason: 'Gatilho com histórico de recaída: limite + pausa' };
  if (urge >= 5) return { decision: 'practice', reason: 'Urgência moderada: sugerir uma prática curta' };
  return { decision: 'record', reason: 'Urgência baixa: apenas registrar' };
}

/** Linha de memória: prova de que o app lembra do que já aconteceu. */
export function memoryLines(st: AppState, triggerId: string | null, excludeCheckInId?: string): string[] {
  if (!triggerId) return [];
  const h = triggerHistory(st, triggerId, excludeCheckInId);
  const name = (triggerName(st, triggerId) ?? 'esse gatilho').toLowerCase();
  if (h.count === 0) return [`Essa é a primeira vez que registramos "${name}". Vamos aprender o seu padrão juntos.`];
  const lines = [h.count === 1 ? `Esse gatilho já apareceu 1 vez antes.` : `Esse gatilho já apareceu ${h.count} vezes antes.`];
  const li = h.lastIntervention;
  if (li) {
    const m = minutesOf(li);
    lines.push(
      (delta(li) ?? 0) >= 1
        ? `Da última vez sua urgência caiu de ${li.urge_before} para ${li.urge_after}${m ? ` depois de ${m} minutos de espaço` : ''}.`
        : `Da última vez a urgência ficou em ${li.urge_before} → ${li.urge_after}${m ? ` após ${m} minutos` : ''}. Vamos tentar um caminho diferente.`,
    );
  }
  if (h.topThought && h.count >= 2) lines.push(`O pensamento que mais veio junto: "${h.topThought}".`);
  return lines;
}

/* ------------------------------------------------------------------ */
/* SOS                                                                 */
/* ------------------------------------------------------------------ */

export interface SosPlan {
  headline: string;
  body: string;
  facts: string[];
  cta: string;
  minutes: number;
  boundary: AppState['boundaries'][number] | null;
  hasHistory: boolean;
}

export function relevantBoundary(st: AppState, triggerId: string) {
  const kind = st.triggers.find((t) => t.id === triggerId)?.kind;
  if (!kind) return null;
  const cats = TRIGGER_BOUNDARY[kind];
  return st.boundaries.find((b) => b.active && cats.includes(b.category)) ?? null;
}

export function sosPlan(st: AppState, triggerId: string): SosPlan {
  const h = triggerHistory(st, triggerId);
  const boundary = relevantBoundary(st, triggerId);
  const mins = h.bestMinutes ?? bestPauseMinutes(st) ?? 10;
  const facts: string[] = [];
  if (h.count > 0) {
    facts.push(`Esse gatilho já apareceu ${h.count} ${h.count === 1 ? 'vez' : 'vezes'}.`);
    if (h.avgUrge != null) facts.push(`Urgência média nele: ${h.avgUrge.toFixed(1).replace('.', ',')}.`);
    if (h.topThought) facts.push(`Pensamento mais comum: "${h.topThought}".`);
    if (h.measuredCount > 0) facts.push(`Das últimas ${h.measuredCount} vezes, sua urgência diminuiu em ${h.helpedCount} depois de criar espaço.`);
    if (h.actedCount > 0) facts.push(`Em ${h.actedCount} delas você acabou agindo no impulso.`);
  }
  const headline = triggerId === 'sent_message' ? 'A pessoa reapareceu.' : triggerId === 'almost_back' ? 'Você está perto de decidir no impulso.' : 'Você não precisa decidir agora.';
  return {
    headline,
    body:
      h.helpedCount > 0
        ? `Você não precisa decidir agora. Em ${h.helpedCount} das últimas ${h.measuredCount} ${h.measuredCount === 1 ? 'vez' : 'vezes'} em que isso aconteceu, sua urgência diminuiu quando você esperou antes de agir.`
        : 'Você não precisa decidir agora. A urgência parece uma ordem, mas funciona como uma onda: ela sobe e desce. Vamos criar espaço primeiro.',
    facts,
    cta: triggerId === 'sent_message' ? 'Criar espaço antes de responder' : 'Criar espaço antes de agir',
    minutes: mins,
    boundary,
    hasHistory: h.count > 0,
  };
}
