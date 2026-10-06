import type { AppState } from '../types';

/**
 * Configuração remota (feature flags). Em produção: PostHog/Supabase/Edge Function.
 * Aqui: valores padrão + JSON opcional em VITE_REMOTE_CONFIG_URL.
 *
 * experiment_group  A = pagamento imediato · B = teste gratuito antes da assinatura
 * trial_duration_days  nunca fixo no código; vem daqui.
 */
export interface RemoteConfig {
  experiment_group: 'A' | 'B' | 'auto';
  trial_duration_days: number;
}

export const defaultRemoteConfig: RemoteConfig = { experiment_group: 'auto', trial_duration_days: 7 };

/** Override por URL para QA: ?group=A|B&trial_days=N */
function urlOverride(): Partial<RemoteConfig> {
  if (typeof location === 'undefined') return {};
  const q = new URLSearchParams(location.search);
  const out: Partial<RemoteConfig> = {};
  const g = q.get('group');
  if (g === 'A' || g === 'B') out.experiment_group = g;
  const t = Number(q.get('trial_days'));
  if (t > 0) out.trial_duration_days = t;
  return out;
}

export async function fetchRemoteConfig(): Promise<RemoteConfig> {
  const base = await fetchBase();
  return { ...base, ...urlOverride() };
}

async function fetchBase(): Promise<RemoteConfig> {
  const url = import.meta.env.VITE_REMOTE_CONFIG_URL as string | undefined;
  if (!url) return defaultRemoteConfig;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return defaultRemoteConfig;
    return { ...defaultRemoteConfig, ...(await r.json()) };
  } catch {
    return defaultRemoteConfig;
  }
}

export function assignGroup(cfg: RemoteConfig): 'A' | 'B' {
  if (cfg.experiment_group === 'A' || cfg.experiment_group === 'B') return cfg.experiment_group;
  return Math.random() < 0.5 ? 'A' : 'B';
}

export function trialDays(st: AppState): number {
  return st.settings.trial_duration_days;
}
