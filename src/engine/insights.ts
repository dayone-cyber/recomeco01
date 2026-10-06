import type { AppState, Confidence, Insight } from '../types';
import { DAY, fmtNum, uid } from '../lib/time';
import { WEEKDAYS } from '../data/content';
import { avgUrge, delta, episodes, mode, thoughtText, triggerName } from './stats';

export const MIN_EPISODES = 3;
export const LEARNING_MSG = 'Ainda estamos aprendendo esse padrão.';

export function confidenceFor(n: number, share: number): Confidence {
  if (n >= 7 && share >= 0.4) return 'high';
  if (n >= 4 && share >= 0.4) return 'medium';
  return 'low';
}

type Candidate = Omit<Insight, 'id' | 'user_id' | 'generated_at' | 'viewed_at'>;

/** Linguagem condicionada à confiança: nunca afirma correlação fraca como certeza. */
function hedge(conf: Confidence, soft: string, firm: string): string {
  return conf === 'high' ? firm : soft;
}

export function candidateInsights(st: AppState, now: Date): Candidate[] {
  const out: Candidate[] = [];
  const eps = episodes(st);
  const recent = eps.slice(-7);

  // 1. Gatilho dominante
  const trig = mode(recent.map((e) => e.trigger_id!));
  if (trig && trig.count >= MIN_EPISODES) {
    const name = triggerName(st, trig.value) ?? 'um gatilho';
    const share = trig.count / recent.length;
    const conf = confidenceFor(recent.length, share);
    out.push({
      key: `trigger:${trig.value}`,
      type: 'trigger',
      title: 'Gatilho mais frequente',
      confidence: conf,
      description: hedge(
        conf,
        `Estamos começando a perceber uma possível relação entre "${name.toLowerCase()}" e o aumento da sua urgência (${trig.count} de ${recent.length} episódios recentes).`,
        `"${name}" foi o gatilho mais frequente das suas últimas ${recent.length} crises (${trig.count} vezes).`,
      ),
    });

    // 2. Pensamento associado ao gatilho
    const th = mode(
      eps.filter((e) => e.trigger_id === trig.value && e.automatic_thought_id).map((e) => e.automatic_thought_id!),
    );
    if (th && th.count >= MIN_EPISODES) {
      const text = thoughtText(st, th.value);
      const c2 = th.count >= 5 ? 'high' : 'medium';
      out.push({
        key: `thought:${trig.value}:${th.value}`,
        type: 'thought',
        title: 'Pensamento que acompanha o gatilho',
        confidence: c2,
        description: `Quando "${name.toLowerCase()}" aparece, o pensamento "${text}" veio em ${th.count} dos ${eps.filter((e) => e.trigger_id === trig.value).length} episódios.`,
      });
    }
  }

  // 3. Horário de maior vulnerabilidade
  if (eps.length >= 4) {
    const buckets: Record<string, number> = { '6h–12h': 0, '12h–18h': 0, '18h–20h': 0, '20h–23h': 0, '23h–6h': 0 };
    eps.forEach((e) => {
      const h = new Date(e.timestamp).getHours();
      const k = h >= 6 && h < 12 ? '6h–12h' : h >= 12 && h < 18 ? '12h–18h' : h >= 18 && h < 20 ? '18h–20h' : h >= 20 && h < 23 ? '20h–23h' : '23h–6h';
      buckets[k]++;
    });
    const [k, n] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    const share = n / eps.length;
    if (share >= 0.5) {
      const conf = confidenceFor(eps.length, share);
      out.push({
        key: `time:${k}`,
        type: 'time',
        title: 'Horário de maior vulnerabilidade',
        confidence: conf,
        description: hedge(
          conf,
          `Parece que sua vontade de agir tende a aumentar entre ${k.replace('–', ' e ')} (${n} de ${eps.length} episódios).`,
          `Sua vontade de agir aumenta entre ${k.replace('–', ' e ')}: ${n} de ${eps.length} episódios aconteceram nessa faixa.`,
        ),
      });
    }
  }

  // 4. Dia da semana
  if (eps.length >= 6) {
    const days = mode(eps.map((e) => new Date(e.timestamp).getDay()));
    if (days && days.count / eps.length >= 0.4 && days.count >= 3) {
      out.push({
        key: `weekday:${days.value}`,
        type: 'weekday',
        title: 'Dia mais sensível',
        confidence: days.count >= 5 ? 'high' : 'medium',
        description: `${days.count} dos seus ${eps.length} episódios aconteceram em ${WEEKDAYS[days.value] === 'sábado' || WEEKDAYS[days.value] === 'domingo' ? 'um ' : 'uma '}${WEEKDAYS[days.value]}.`,
      });
    }
  }

  // 5. Tendência de urgência (últimos 7 dias × 7 anteriores)
  const w1 = avgUrge(eps.filter((e) => now.getTime() - new Date(e.timestamp).getTime() <= 7 * DAY));
  const prevEps = eps.filter((e) => {
    const age = now.getTime() - new Date(e.timestamp).getTime();
    return age > 7 * DAY && age <= 14 * DAY;
  });
  const w0 = avgUrge(prevEps);
  const nNow = eps.filter((e) => now.getTime() - new Date(e.timestamp).getTime() <= 7 * DAY).length;
  if (w1 != null && w0 != null && nNow >= 3 && prevEps.length >= 3 && Math.abs(w0 - w1) >= 0.5) {
    out.push({
      key: 'trend:urge',
      type: 'trend',
      title: w1 < w0 ? 'Sua urgência está baixando' : 'Sua urgência subiu',
      confidence: nNow >= 5 && prevEps.length >= 5 ? 'high' : 'medium',
      description:
        w1 < w0
          ? `Há 7 dias, sua urgência média nos episódios era ${fmtNum(w0)}. Agora está em ${fmtNum(w1)}.`
          : `Sua urgência média nos episódios passou de ${fmtNum(w0)} para ${fmtNum(w1)} nos últimos 7 dias. Vale olhar o que mudou.`,
    });
  }

  // 6. Efetividade da pausa
  const measured = st.interventions.filter((i) => i.intervention_type === 'pause' && i.completed_at && delta(i) != null);
  if (measured.length >= MIN_EPISODES) {
    const helped = measured.filter((i) => (delta(i) ?? 0) >= 2).length;
    const pct = Math.round((helped / measured.length) * 100);
    const conf: Confidence = measured.length >= 6 ? 'high' : 'medium';
    if (pct >= 50) {
      out.push({
        key: 'effectiveness:pause',
        type: 'effectiveness',
        title: 'O que tem funcionado',
        confidence: conf,
        description: `Esperar antes de agir reduziu sua urgência em ${pct}% das ${measured.length} vezes em que você tentou.`,
      });
    } else {
      out.push({
        key: 'effectiveness:pause:low',
        type: 'effectiveness',
        title: 'A pausa ainda não está bastando',
        confidence: 'low',
        description: `Em ${measured.length} tentativas, a pausa reduziu a urgência em ${pct}% das vezes. Podemos testar uma pausa mais longa ou combinar com um limite.`,
      });
    }
  }

  // 7. Planos cancelados
  const last7 = st.metrics.filter((m) => now.getTime() - new Date(m.date + 'T12:00:00').getTime() <= 7 * DAY);
  const cancelled = last7.reduce((a, m) => a + m.plans_cancelled, 0);
  if (cancelled >= 3) {
    out.push({
      key: 'plans:cancelled',
      type: 'plans',
      title: 'Planos cancelados',
      confidence: cancelled >= 5 ? 'high' : 'medium',
      description: `Você cancelou ${cancelled} planos nos últimos 7 dias. Retomar compromissos próprios ganha prioridade no seu acompanhamento.`,
    });
  }

  // 8. Limites
  const broken = st.boundaries.reduce((a, b) => a + b.broken_count, 0);
  const kept = st.boundaries.reduce((a, b) => a + b.respected_count, 0);
  if (broken + kept >= 3) {
    out.push({
      key: 'boundary:ratio',
      type: 'boundary',
      title: 'Seus limites',
      confidence: broken + kept >= 6 ? 'high' : 'medium',
      description: `Você manteve seus limites em ${kept} de ${broken + kept} situações em que eles apareceram.`,
    });
  }

  return out;
}

/** Mescla candidatos ao histórico: novos viram insight_generated; confiança maior atualiza o texto. */
export function mergeInsights(st: AppState, now: Date): { insights: Insight[]; created: Insight[] } {
  const cands = candidateInsights(st, now);
  const next = [...st.insights];
  const created: Insight[] = [];
  const rank = { low: 0, medium: 1, high: 2 };
  for (const c of cands) {
    const i = next.findIndex((x) => x.key === c.key);
    if (i === -1) {
      const ins: Insight = { ...c, id: uid(), user_id: st.user?.id ?? '', generated_at: now.toISOString(), viewed_at: null };
      next.push(ins);
      created.push(ins);
    } else {
      const old = next[i];
      const changed = old.description !== c.description || rank[c.confidence] > rank[old.confidence];
      if (changed) next[i] = { ...old, description: c.description, confidence: c.confidence, viewed_at: rank[c.confidence] > rank[old.confidence] ? null : old.viewed_at };
    }
  }
  return { insights: next, created };
}
