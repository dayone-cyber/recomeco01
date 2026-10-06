import { useSyncExternalStore } from 'react';
import type { AppState, Settings } from '../types';

const KEY = 'recomeco.state.v1';

export const defaultSettings: Settings = {
  notifications_enabled: false,
  notify_checkin: true,
  notify_contextual: false,
  notify_weekly: true,
  quiet_hours: true,
  demo_speed: 1,
  trial_duration_days: 7,
};

export function emptyState(): AppState {
  return {
    version: 1,
    user: null,
    profile: null,
    checkIns: [],
    triggers: [],
    thoughts: [],
    interventions: [],
    boundaries: [],
    metrics: [],
    insights: [],
    journey: [],
    predictions: [],
    activities: [],
    reciprocity: [],
    events: [],
    settings: { ...defaultSettings },
    flags: {
      day22_seen: false,
      weekly_viewed: [],
      patterns_seen: [],
      onboarding_done: false,
      paywall_seen: false,
      safety_notice_shown: false,
    },
    onboarding: {},
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === 1) {
        const base = emptyState();
        return { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings }, flags: { ...base.flags, ...parsed.flags } };
      }
    }
  } catch {
    /* storage indisponível ou corrompido: começa limpo */
  }
  return emptyState();
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function getState(): AppState {
  return state;
}

export function setState(next: AppState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

/** Atualização imutável: o callback altera uma cópia profunda. */
export function mutate(fn: (draft: AppState) => void) {
  const draft = structuredClone(state);
  fn(draft);
  setState(draft);
}

export function resetAll() {
  setState(emptyState());
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
