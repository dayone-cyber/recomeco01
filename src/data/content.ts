import type { BoundaryCategory, Goal, Mood, PhaseId, RelationshipStatus, TriggerKind } from '../types';

export interface Choice<T = string> {
  value: T;
  label: string;
  sub?: string;
}

export const GOALS: Choice<Goal>[] = [
  { value: 'independence', label: 'Minha vida sem depender dessa pessoa' },
  { value: 'control', label: 'Meu controle emocional' },
  { value: 'clarity', label: 'Clareza para decidir' },
  { value: 'reconnect', label: 'Meu ex / uma possibilidade de reconexão' },
];

export const GOAL_SHORT: Record<Goal, string> = {
  independence: 'Autonomia',
  control: 'Controle emocional',
  clarity: 'Clareza para decidir',
  reconnect: 'Possibilidade de reconexão',
};

export const AGE_RANGES = ['18–24', '25–34', '35–44', '45–54', '55+'];

export const SITUATIONS: Choice<RelationshipStatus>[] = [
  { value: 'broken_contact', label: 'Terminamos, mas ainda temos contato' },
  { value: 'broken_no_contact', label: 'Terminamos e quase não temos contato' },
  { value: 'together', label: 'Ainda estamos juntos' },
  { value: 'on_off', label: 'Estamos indo e voltando' },
  { value: 'undefined', label: 'Nunca ficou totalmente definido' },
];

export const STATUS_LABEL: Record<RelationshipStatus, string> = {
  broken_contact: 'Terminamos, ainda temos contato',
  broken_no_contact: 'Terminamos, quase sem contato',
  together: 'Ainda estamos juntos',
  on_off: 'Indo e voltando',
  undefined: 'Nunca ficou definido',
  reconciled: 'Voltamos',
  ended: 'Término definitivo',
};

// valor numérico 0..3 usado pelo motor
export const DISTANCING: Choice[] = [
  { value: '0', label: 'Nunca' },
  { value: '1', label: 'Uma vez' },
  { value: '2', label: 'Algumas vezes' },
  { value: '3', label: 'Muitas vezes, mas sempre volto' },
];
export const THOUGHT_LOAD: Choice[] = [
  { value: '0', label: 'De vez em quando' },
  { value: '1', label: 'Várias vezes ao dia' },
  { value: '2', label: 'Algumas horas do dia' },
  { value: '3', label: 'Quase o dia inteiro' },
];
// estimativa de verificações por dia
export const CHECKING: Choice[] = [
  { value: '1', label: 'Quase nunca' },
  { value: '4', label: 'Algumas vezes' },
  { value: '10', label: 'Muitas vezes' },
  { value: '17', label: 'Mais de 10 vezes' },
];
export const BOUNDARY_DIFF: Choice[] = [
  { value: '0', label: 'Nunca' },
  { value: '1', label: 'Às vezes' },
  { value: '2', label: 'Frequentemente' },
  { value: '3', label: 'Quase sempre' },
];
export const ROUTINE_IMPACT: Choice[] = [
  { value: '0', label: 'Pouco' },
  { value: '1', label: 'Moderadamente' },
  { value: '2', label: 'Bastante' },
  { value: '3', label: 'Muito' },
];
export const BEHAVIORS: Choice[] = [
  { value: 'wait', label: 'Espero a pessoa me procurar' },
  { value: 'search', label: 'Procuro primeiro' },
  { value: 'check', label: 'Verifico redes/WhatsApp' },
  { value: 'retreat_return', label: 'Tento me afastar, mas volto' },
  { value: 'accept', label: 'Aceito coisas que não queria' },
  { value: 'change_plans', label: 'Mudo meus planos quando a pessoa chama' },
];

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'calm', emoji: '😌', label: 'Calma' },
  { value: 'anxious', emoji: '😣', label: 'Ansiedade' },
  { value: 'longing', emoji: '🥺', label: 'Saudade' },
  { value: 'impulse', emoji: '😵‍💫', label: 'Impulso' },
];
export const MOOD_LABEL: Record<Mood, string> = {
  calm: 'Calma',
  anxious: 'Ansiedade',
  longing: 'Saudade',
  impulse: 'Impulso',
};

export interface TriggerDef {
  id: string;
  name: string;
  kind: TriggerKind;
}
// "O que aconteceu?" — gatilhos do check-in e do SOS
export const TRIGGER_CATALOG: TriggerDef[] = [
  { id: 'vanished', name: 'Sumiu', kind: 'silence' },
  { id: 'no_reply', name: 'Não respondeu', kind: 'silence' },
  { id: 'sent_message', name: 'Mandou mensagem', kind: 'contact_received' },
  { id: 'saw_social', name: 'Vi algo nas redes', kind: 'social' },
  { id: 'longing', name: 'Senti saudade', kind: 'longing' },
  { id: 'argument', name: 'Tivemos uma discussão', kind: 'argument' },
  { id: 'urge_seek', name: 'Quero procurar a pessoa', kind: 'seeking' },
  { id: 'almost_back', name: 'Estou quase voltando', kind: 'returning' },
];
export const CHECKIN_TRIGGERS = ['vanished', 'no_reply', 'sent_message', 'saw_social', 'longing', 'argument'];

export const THOUGHT_SUGGESTIONS = [
  'Está me esquecendo',
  'Está com outra pessoa',
  'Eu fiz alguma coisa errada',
  'Preciso mandar mensagem',
  'Se eu não fizer nada vou perder a pessoa',
  'Não se importa comigo',
];

export const SOS_OPTIONS: { id: string; label: string; sub: string; trigger: string }[] = [
  { id: 'msg', label: 'Mandou mensagem', sub: 'Quero responder no impulso.', trigger: 'sent_message' },
  { id: 'seek', label: 'Quero procurar a pessoa', sub: 'Estou quase mandando alguma coisa.', trigger: 'urge_seek' },
  { id: 'saw', label: 'Vi alguma coisa', sub: 'Rede social, foto ou status.', trigger: 'saw_social' },
  { id: 'back', label: 'Estou quase voltando', sub: 'Mesmo sabendo o que costuma me machucar.', trigger: 'almost_back' },
];

export interface PhaseDef {
  id: PhaseId;
  name: string;
  internal: string;
  user: string;
  blurb: string;
}
export const PHASES: PhaseDef[] = [
  { id: 1, name: 'Entender', internal: 'Mapear', user: 'Entender meu ciclo', blurb: 'Reconhecer gatilhos, pensamentos, impulsos e o que acontece depois.' },
  { id: 2, name: 'Pausar', internal: 'Interromper', user: 'Criar espaço antes de agir', blurb: 'Nem todo impulso precisa virar comportamento.' },
  { id: 3, name: 'Testar', internal: 'Testar previsões', user: 'Testar meus medos', blurb: 'Transformar pensamentos automáticos em hipóteses e comparar com a realidade.' },
  { id: 4, name: 'Retomar', internal: 'Reconstruir', user: 'Retomar minha vida', blurb: 'Reconstruir fontes próprias de recompensa, rotina e identidade.' },
  { id: 5, name: 'Limites', internal: 'Limites', user: 'Proteger meus limites', blurb: 'Decidir regras pessoais antes da ativação emocional.' },
  { id: 6, name: 'Sustentar', internal: 'Prevenção de recaída', user: 'Sustentar o que mudou', blurb: 'Reconhecer sinais precoces e retomar estratégias quando precisar.' },
];

export const BOUNDARY_TEMPLATES: { text: string; category: BoundaryCategory }[] = [
  { text: 'Não cancelar planos quando a pessoa chamar de última hora.', category: 'plans' },
  { text: 'Não mandar várias mensagens sem resposta.', category: 'messaging' },
  { text: 'Não aceitar insultos.', category: 'respect' },
  { text: 'Não encontrar essa pessoa quando eu estiver emocionalmente muito ativada.', category: 'meeting' },
  { text: 'Não verificar redes sociais durante a madrugada.', category: 'social' },
];

// gatilho → categoria de limite que costuma ser relevante
export const TRIGGER_BOUNDARY: Record<TriggerKind, BoundaryCategory[]> = {
  silence: ['messaging'],
  contact_received: ['plans', 'meeting'],
  social: ['social'],
  longing: ['messaging', 'meeting'],
  argument: ['respect'],
  seeking: ['messaging'],
  returning: ['meeting', 'respect', 'plans'],
  other: [],
};

export const ACTIVITY_CATEGORIES = [
  { id: 'friends', label: 'Ver amigos ou família' },
  { id: 'move', label: 'Me mexer (exercício, caminhada)' },
  { id: 'work', label: 'Avançar em algo do trabalho/estudo' },
  { id: 'hobby', label: 'Retomar um interesse abandonado' },
  { id: 'home', label: 'Cuidar da casa e da rotina' },
  { id: 'plan', label: 'Dar um passo num plano meu' },
];

export const EARLY_SIGNS = [
  'Abrir o WhatsApp sem motivo',
  'Olhar o perfil da pessoa',
  'Dormir mal',
  'Cancelar um compromisso meu',
  'Reler conversas antigas',
  'Ensaiar mensagens na cabeça',
  'Isolar-me de amigos',
];

export interface CrisisResource {
  name: string;
  phone: string;
  desc: string;
}
// Brasil (LGPD/pt-BR). Recursos adequados à localização — ajustar por país no futuro.
export const CRISIS_RESOURCES_BR: CrisisResource[] = [
  { name: 'CVV — Centro de Valorização da Vida', phone: '188', desc: 'Apoio emocional 24h, gratuito.' },
  { name: 'SAMU', phone: '192', desc: 'Emergência médica.' },
  { name: 'Polícia Militar', phone: '190', desc: 'Risco imediato, ameaça ou violência.' },
  { name: 'Ligue 180', phone: '180', desc: 'Central de atendimento à mulher em situação de violência.' },
  { name: 'Disque 100', phone: '100', desc: 'Denúncia de violações de direitos humanos.' },
];

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
