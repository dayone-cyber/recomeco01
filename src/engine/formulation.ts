import type { Goal, OnboardingAnswers, UserProfile } from '../types';

export interface Formulation {
  headline: string;
  lines: string[];
  chain: string[];
  closing: string;
  goalNote: string | null;
}

/** Formulação de padrão (não é diagnóstico). Texto muda conforme as respostas e o objetivo. */
export function buildFormulation(p: Pick<UserProfile, 'primary_goal' | 'relief_score' | 'baseline_check_frequency' | 'boundary_difficulty' | 'main_behaviors' | 'distancing_history' | 'baseline_thought_load'>): Formulation {
  const lines: string[] = ['Não parece ser simplesmente falta de força de vontade.'];
  const checks = p.baseline_check_frequency >= 10;
  const seeks = p.main_behaviors.includes('search');
  const waits = p.main_behaviors.includes('wait') || p.main_behaviors.includes('check');

  lines.push(
    `Quando a pessoa se afasta ou fica em silêncio, sua ansiedade sobe${p.baseline_thought_load >= 2 ? ' e ela ocupa boa parte do seu dia' : ''}. O pensamento de que pode perdê-la cria uma urgência para fazer alguma coisa${checks ? ' — como verificar WhatsApp e redes várias vezes' : seeks ? ' — como procurar primeiro' : waits ? ' — como esperar e checar sinais' : ''}.`,
  );
  lines.push(
    p.relief_score >= 7
      ? 'Quando ela reaparece, o alívio é enorme. E justamente esse alívio pode reforçar o ciclo.'
      : 'Quando ela reaparece, você sente algum alívio. E esse alívio pode reforçar o ciclo, mesmo quando a relação continua instável.',
  );
  if (p.boundary_difficulty >= 2) lines.push('Com medo de perder, os limites tendem a ficar mais flexíveis do que você gostaria.');
  if (p.distancing_history >= 2) lines.push('As tentativas de afastamento mostram que você quer mudar — o ciclo é que costuma voltar mais forte.');

  const chain = ['SILÊNCIO', '“ESTÁ ME ESQUECENDO”', 'ANSIEDADE', 'CHECAR / PROCURAR', 'CONTATO', 'ALÍVIO', 'ESPERANÇA', 'RECOMEÇO DO CICLO'];
  return {
    headline: 'Existe um padrão se repetindo.',
    lines,
    chain,
    closing: 'O Recomeço vai acompanhar esse ciclo com você — principalmente nos momentos em que ele tenta começar novamente.',
    goalNote: GOAL_NOTE[p.primary_goal],
  };
}

const GOAL_NOTE: Record<Goal, string | null> = {
  independence: 'Seu foco: reconstruir uma vida que não dependa da resposta da outra pessoa.',
  control: 'Seu foco: ganhar espaço entre o impulso e a ação.',
  clarity: 'Seu foco: ver a relação com mais clareza antes de decidir.',
  reconnect:
    'Se existe possibilidade real de reconexão, agir no pico da ansiedade tende a tornar mais difícil descobrir isso com clareza. O Recomeço não controla a decisão da outra pessoa — ajuda você a agir com autonomia, limites e a observar se existe reciprocidade real.',
};

export function profileFromAnswers(userId: string, a: OnboardingAnswers): UserProfile {
  return {
    user_id: userId,
    primary_goal: a.primary_goal ?? 'control',
    relationship_status: a.relationship_status ?? 'undefined',
    routine_impact: Number(a.routine_impact ?? 1),
    baseline_check_frequency: Number(a.check_frequency ?? 4),
    baseline_thought_load: Number(a.thought_load ?? 1),
    distancing_history: Number(a.distancing_history ?? 0),
    relief_score: a.relief_score ?? 5,
    boundary_difficulty: Number(a.boundary_difficulty ?? 1),
    main_behaviors: a.main_behaviors ?? [],
    current_phase: 1,
    reconcile_focus: null,
    early_signs: [],
    relapse_plan: '',
    goal_history: [{ goal: a.primary_goal ?? 'control', at: new Date().toISOString() }],
  };
}
