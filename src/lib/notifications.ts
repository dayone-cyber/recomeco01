/** Textos discretos: nada de gatilho, pessoa ou relação na tela bloqueada. */
const COPY = {
  checkin: 'Seu check-in está disponível.',
  insight: 'Temos uma observação nova sobre esta semana.',
  pause: 'Talvez seja um bom momento para fazer uma pausa.',
  weekly: 'Seu resumo semanal está pronto.',
  contextual: 'Quer fazer um check-in rápido?',
} as const;
export type NotificationKind = keyof typeof COPY;
export const notificationCopy = (k: NotificationKind) => COPY[k];
