import type { AppState, PhaseId } from '../types';
import { episodes, mode, thoughtText, triggerName } from './stats';
import { MIN_EPISODES } from './insights';

export interface DiscoveredPattern {
  id: string;
  title: string;
  body: string;
  chain: string[];
  focus: string;
  focusPhase: PhaseId;
  cta: string;
  confidence: 'medium' | 'high';
}

/** "Descobrimos um padrão": só aparece com repetição suficiente (≥3 episódios com gatilho + pensamento). */
export function discoverPattern(st: AppState): DiscoveredPattern | null {
  const eps = episodes(st);
  const trig = mode(eps.map((e) => e.trigger_id!));
  if (!trig || trig.count < MIN_EPISODES) return null;
  const withT = eps.filter((e) => e.trigger_id === trig.value && e.automatic_thought_id);
  const th = mode(withT.map((e) => e.automatic_thought_id!));
  if (!th || th.count < MIN_EPISODES) return null;

  const name = triggerName(st, trig.value)!;
  const thought = thoughtText(st, th.value)!;
  const sameTrig = eps.filter((e) => e.trigger_id === trig.value);
  const acted = sameTrig.filter((e) => e.action_taken === 'acted').length;
  const confidence = sameTrig.length >= 6 ? 'high' : 'medium';
  const weakLink = acted / sameTrig.length >= 0.4;

  return {
    id: `${trig.value}:${th.value}`,
    title: `Seu pico costuma começar em “${name.toLowerCase()}”.`,
    body:
      confidence === 'high'
        ? `Ele vem junto com o pensamento “${thought}” e, em seguida, a vontade de agir. Isso se repetiu ${th.count} vezes.`
        : `Estamos começando a perceber que ele costuma vir com o pensamento “${thought}”. Isso se repetiu ${th.count} vezes — vamos continuar observando.`,
    chain: [name, `“${thought}”`, weakLink ? 'Checar / procurar' : 'Vontade de agir', 'Alívio', 'Esperança'],
    focus: weakLink ? 'Mexer no elo urgência → ação.' : 'Mexer no elo pensamento → ação.',
    focusPhase: weakLink ? 2 : 3,
    cta: 'Treinar esse passo',
    confidence,
  };
}
