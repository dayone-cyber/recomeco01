import { getState, mutate } from './store';
import { uid } from './time';
import type { AppEvent } from '../types';

type Props = AppEvent['props'];
type Sink = (e: AppEvent) => void;
const sinks: Sink[] = [];

/** Permite plugar PostHog/Mixpanel/Supabase sem alterar os call sites. */
export function registerSink(s: Sink) {
  sinks.push(s);
}

export const EVENT_NAMES = [
  'onboarding_started', 'onboarding_question_completed', 'onboarding_completed', 'plan_generated',
  'home_viewed', 'mood_selected', 'checkin_started', 'checkin_completed', 'trigger_selected',
  'thought_selected', 'urge_recorded', 'intervention_shown', 'intervention_started',
  'intervention_completed', 'sos_opened', 'sos_reason_selected', 'boundary_created',
  'boundary_prompt_shown', 'boundary_protected', 'boundary_broken', 'insight_generated',
  'insight_viewed', 'journey_viewed', 'phase_started', 'phase_completed', 'progress_viewed',
  'trial_started', 'trial_day_2_active', 'trial_day_3_active', 'trial_day_7_active',
  'paywall_viewed', 'subscription_started', 'subscription_cancelled', 'subscription_renewed',
  // extras do produto
  'relapse_recorded', 'crisis_screen_shown', 'weekly_summary_viewed', 'day22_viewed',
  'reconciliation_declared', 'prediction_resolved',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export function track(name: EventName, props: Props = {}) {
  const st = getState();
  const e: AppEvent = {
    id: uid(),
    user_id: st.user?.id ?? null,
    name,
    timestamp: new Date().toISOString(),
    props: { ...props, experiment_group: st.user?.experiment_group ?? null },
  };
  mutate((d) => {
    d.events.push(e);
    if (d.events.length > 2000) d.events.splice(0, d.events.length - 2000);
  });
  sinks.forEach((s) => s(e));
}
