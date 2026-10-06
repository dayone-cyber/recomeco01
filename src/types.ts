export type Goal = 'independence' | 'control' | 'clarity' | 'reconnect';
export type Mood = 'calm' | 'anxious' | 'longing' | 'impulse';
export type PhaseId = 1 | 2 | 3 | 4 | 5 | 6;
export type RelationshipStatus =
  | 'broken_contact'
  | 'broken_no_contact'
  | 'together'
  | 'on_off'
  | 'undefined'
  | 'reconciled'
  | 'ended';
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'cancelled' | 'expired';
export type Confidence = 'low' | 'medium' | 'high';
export type ReconcileFocus = 'rebuild' | 'observe' | 'insecure' | 'autonomy';

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  timezone: string;
  age_range: string;
  subscription_status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  experiment_group: 'A' | 'B';
  consent_at: string;
}

export interface UserProfile {
  user_id: string;
  primary_goal: Goal;
  relationship_status: RelationshipStatus;
  routine_impact: number; // 0..3
  baseline_check_frequency: number; // verificações/dia estimadas no onboarding
  baseline_thought_load: number; // 0..3
  distancing_history: number; // 0..3
  relief_score: number; // 0..10
  boundary_difficulty: number; // 0..3
  main_behaviors: string[];
  current_phase: PhaseId;
  reconcile_focus: ReconcileFocus | null;
  early_signs: string[];
  relapse_plan: string;
  goal_history: { goal: Goal; at: string }[];
}

export interface Trigger {
  id: string;
  user_id: string;
  name: string;
  kind: TriggerKind;
  occurrence_count: number;
  last_occurrence: string | null;
}
export type TriggerKind =
  | 'silence'
  | 'contact_received'
  | 'social'
  | 'longing'
  | 'argument'
  | 'seeking'
  | 'returning'
  | 'other';

export interface AutomaticThought {
  id: string;
  user_id: string;
  content: string;
  occurrence_count: number;
}

export type ActionTaken = 'none' | 'waited' | 'acted';

export interface CheckIn {
  id: string;
  user_id: string;
  timestamp: string;
  emotional_state: Mood;
  trigger_id: string | null;
  automatic_thought_id: string | null;
  urge_before: number | null;
  urge_after: number | null;
  action_taken: ActionTaken;
  intervention_id: string | null;
  source: 'home' | 'sos' | 'practice';
}

export type InterventionType = 'pause' | 'test' | 'retake' | 'boundary' | 'sustain' | 'map';

export interface Intervention {
  id: string;
  user_id: string;
  intervention_type: InterventionType;
  trigger_id: string | null;
  started_at: string;
  completed_at: string | null;
  urge_before: number | null;
  urge_after: number | null;
  helpfulness: 'helped' | 'neutral' | 'not_helped' | null;
  planned_minutes: number;
}

export type BoundaryCategory = 'plans' | 'messaging' | 'respect' | 'meeting' | 'social' | 'other';

export interface Boundary {
  id: string;
  user_id: string;
  description: string;
  category: BoundaryCategory;
  active: boolean;
  respected_count: number;
  broken_count: number;
  created_at: string;
}

export interface BehavioralMetric {
  user_id: string;
  date: string; // YYYY-MM-DD (local)
  whatsapp_checks: number | null;
  contact_attempts: number | null;
  plans_cancelled: number;
  plans_protected: number;
}

export interface Insight {
  id: string;
  user_id: string;
  key: string;
  type: 'trigger' | 'time' | 'trend' | 'effectiveness' | 'thought' | 'plans' | 'boundary' | 'weekday';
  title: string;
  description: string;
  confidence: Confidence;
  generated_at: string;
  viewed_at: string | null;
}

export interface JourneyProgress {
  user_id: string;
  phase: PhaseId;
  status: 'not_started' | 'in_progress' | 'explored';
  exercises_completed: number;
  last_activity: string | null;
}

export interface Prediction {
  id: string;
  user_id: string;
  thought: string;
  prediction: string;
  behavior: 'waited' | 'acted';
  created_at: string;
  outcome: 'as_predicted' | 'partly' | 'not_happened' | null;
  resolved_at: string | null;
}

export interface Activity {
  id: string;
  user_id: string;
  category: string;
  description: string;
  planned_for: 'today' | 'tomorrow';
  created_at: string;
  done_at: string | null;
}

export interface ReciprocitySignal {
  id: string;
  user_id: string;
  timestamp: string;
  initiated_by: 'me' | 'them' | 'both';
  kept_agreement: 'yes' | 'no' | 'na';
  respected_limits: 'yes' | 'no' | 'na';
  available: 'yes' | 'no' | 'na';
  effort: 'me' | 'balanced' | 'them';
  expected: string;
  happened: string;
}

export interface AppEvent {
  id: string;
  user_id: string | null;
  name: string;
  timestamp: string;
  props: Record<string, string | number | boolean | null>;
}

export interface Settings {
  notifications_enabled: boolean;
  notify_checkin: boolean;
  notify_contextual: boolean;
  notify_weekly: boolean;
  quiet_hours: boolean;
  // tempo acelerado só para demonstração (1 = real)
  demo_speed: number;
  trial_duration_days: number;
}

export interface OnboardingAnswers {
  primary_goal?: Goal;
  age_range?: string;
  relationship_status?: RelationshipStatus;
  distancing_history?: string;
  thought_load?: string;
  check_frequency?: string;
  relief_score?: number;
  boundary_difficulty?: string;
  routine_impact?: string;
  main_behaviors?: string[];
}

export interface Flags {
  day22_seen: boolean;
  weekly_viewed: string[];
  patterns_seen: string[];
  onboarding_done: boolean;
  paywall_seen: boolean;
  safety_notice_shown: boolean;
}

export interface AppState {
  version: 1;
  user: User | null;
  profile: UserProfile | null;
  checkIns: CheckIn[];
  triggers: Trigger[];
  thoughts: AutomaticThought[];
  interventions: Intervention[];
  boundaries: Boundary[];
  metrics: BehavioralMetric[];
  insights: Insight[];
  journey: JourneyProgress[];
  predictions: Prediction[];
  activities: Activity[];
  reciprocity: ReciprocitySignal[];
  events: AppEvent[];
  settings: Settings;
  flags: Flags;
  onboarding: OnboardingAnswers;
}
