export const DAY = 86_400_000;
export const HOUR = 3_600_000;

export const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysAgo(now: Date, n: number): Date {
  return new Date(now.getTime() - n * DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

/** Dias inteiros (calendário local) desde `since` até `now`. Dia 1 = dia do cadastro. */
export function journeyDay(since: string, now: Date): number {
  const a = new Date(since);
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((end - start) / DAY) + 1;
}

export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fmtNum = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');

export function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`) as string;
