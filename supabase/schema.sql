-- Recomeço — schema PostgreSQL (Supabase). Dados sensíveis: RLS obrigatório em todas as tabelas.
-- O app atual é local-first (localStorage); este schema é o alvo da sincronização (adapter a implementar).

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  timezone text,
  age_range text,
  subscription_status text not null default 'none' check (subscription_status in ('none','trialing','active','cancelled','expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  experiment_group text check (experiment_group in ('A','B')),
  consent_at timestamptz not null default now()
);

create table if not exists user_profile (
  user_id uuid primary key references users on delete cascade,
  primary_goal text not null check (primary_goal in ('independence','control','clarity','reconnect')),
  relationship_status text not null,
  routine_impact smallint, baseline_check_frequency numeric, distancing_history smallint,
  relief_score smallint check (relief_score between 0 and 10), boundary_difficulty smallint,
  current_phase smallint check (current_phase between 1 and 6),
  reconcile_focus text, early_signs text[] default '{}', relapse_plan text,
  baseline_thought_load smallint, main_behaviors text[] default '{}', goal_history jsonb default '[]',
  client_state jsonb default '{}'  -- flags e preferências do app (Dia 22 visto, etc.)
);

create table if not exists triggers (
  id text, user_id uuid references users on delete cascade, name text not null, kind text not null,
  occurrence_count int not null default 0, last_occurrence timestamptz, primary key (user_id, id)
);
create table if not exists automatic_thoughts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  content text not null, occurrence_count int not null default 0
);
create table if not exists interventions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  intervention_type text not null, trigger_id text, started_at timestamptz not null, completed_at timestamptz,
  urge_before smallint check (urge_before between 0 and 10), urge_after smallint check (urge_after between 0 and 10),
  helpfulness text, planned_minutes int
);
create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  timestamp timestamptz not null default now(), emotional_state text not null, trigger_id text,
  automatic_thought_id uuid references automatic_thoughts, urge_before smallint, urge_after smallint,
  action_taken text not null default 'none', intervention_id uuid references interventions, source text
);
create table if not exists boundaries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  description text not null, category text not null, active boolean not null default true,
  respected_count int not null default 0, broken_count int not null default 0, created_at timestamptz default now()
);
create table if not exists behavioral_metrics (
  user_id uuid references users on delete cascade, date date not null,
  whatsapp_checks int, contact_attempts int, plans_cancelled int not null default 0, plans_protected int not null default 0,
  primary key (user_id, date)
);
create table if not exists insights (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  key text not null, type text not null, title text not null, description text not null,
  confidence text not null check (confidence in ('low','medium','high')), generated_at timestamptz default now(), viewed_at timestamptz,
  unique (user_id, key)
);
create table if not exists journey_progress (
  user_id uuid references users on delete cascade, phase smallint check (phase between 1 and 6),
  status text not null default 'not_started', exercises_completed int not null default 0, last_activity timestamptz,
  primary key (user_id, phase)
);
create table if not exists predictions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  thought text, prediction text, behavior text, created_at timestamptz default now(), outcome text, resolved_at timestamptz
);
create table if not exists activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  category text, description text, planned_for text, created_at timestamptz default now(), done_at timestamptz
);
create table if not exists reciprocity_signals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  timestamp timestamptz default now(), initiated_by text, kept_agreement text, respected_limits text, available text, effort text,
  expected text, happened text
);
-- analytics de produto: sem texto livre do usuário nas props
create table if not exists events (
  id uuid primary key default gen_random_uuid(), user_id uuid references users on delete cascade,
  name text not null, timestamp timestamptz not null default now(), props jsonb not null default '{}'
);
create index if not exists check_ins_user_ts on check_ins (user_id, timestamp desc);
create index if not exists events_user_name_ts on events (user_id, name, timestamp desc);

-- RLS: cada pessoa só enxerga e altera as próprias linhas.
-- (comandos explícitos, sem blocos DO, para funcionar no SQL Editor do Supabase)
alter table users enable row level security;
drop policy if exists "own rows" on users;
create policy "own rows" on users for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
alter table user_profile enable row level security;
drop policy if exists "own rows" on user_profile;
create policy "own rows" on user_profile for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table triggers enable row level security;
drop policy if exists "own rows" on triggers;
create policy "own rows" on triggers for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table automatic_thoughts enable row level security;
drop policy if exists "own rows" on automatic_thoughts;
create policy "own rows" on automatic_thoughts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table interventions enable row level security;
drop policy if exists "own rows" on interventions;
create policy "own rows" on interventions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table check_ins enable row level security;
drop policy if exists "own rows" on check_ins;
create policy "own rows" on check_ins for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table boundaries enable row level security;
drop policy if exists "own rows" on boundaries;
create policy "own rows" on boundaries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table behavioral_metrics enable row level security;
drop policy if exists "own rows" on behavioral_metrics;
create policy "own rows" on behavioral_metrics for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table insights enable row level security;
drop policy if exists "own rows" on insights;
create policy "own rows" on insights for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table journey_progress enable row level security;
drop policy if exists "own rows" on journey_progress;
create policy "own rows" on journey_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table predictions enable row level security;
drop policy if exists "own rows" on predictions;
create policy "own rows" on predictions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table activities enable row level security;
drop policy if exists "own rows" on activities;
create policy "own rows" on activities for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table reciprocity_signals enable row level security;
drop policy if exists "own rows" on reciprocity_signals;
create policy "own rows" on reciprocity_signals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table events enable row level security;
drop policy if exists "own rows" on events;
create policy "own rows" on events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Exclusão de conta: delete from auth.users (cascade apaga tudo — LGPD, direito de eliminação).
