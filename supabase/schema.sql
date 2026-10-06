-- Recomeço — schema PostgreSQL (Supabase). Dados sensíveis: RLS obrigatório em todas as tabelas.
-- O app atual é local-first (localStorage); este schema é o alvo da sincronização (adapter a implementar).

create extension if not exists "pgcrypto";

create table users (
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

create table user_profile (
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

create table triggers (
  id text, user_id uuid references users on delete cascade, name text not null, kind text not null,
  occurrence_count int not null default 0, last_occurrence timestamptz, primary key (user_id, id)
);
create table automatic_thoughts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  content text not null, occurrence_count int not null default 0
);
create table interventions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  intervention_type text not null, trigger_id text, started_at timestamptz not null, completed_at timestamptz,
  urge_before smallint check (urge_before between 0 and 10), urge_after smallint check (urge_after between 0 and 10),
  helpfulness text, planned_minutes int
);
create table check_ins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  timestamp timestamptz not null default now(), emotional_state text not null, trigger_id text,
  automatic_thought_id uuid references automatic_thoughts, urge_before smallint, urge_after smallint,
  action_taken text not null default 'none', intervention_id uuid references interventions, source text
);
create table boundaries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  description text not null, category text not null, active boolean not null default true,
  respected_count int not null default 0, broken_count int not null default 0, created_at timestamptz default now()
);
create table behavioral_metrics (
  user_id uuid references users on delete cascade, date date not null,
  whatsapp_checks int, contact_attempts int, plans_cancelled int not null default 0, plans_protected int not null default 0,
  primary key (user_id, date)
);
create table insights (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  key text not null, type text not null, title text not null, description text not null,
  confidence text not null check (confidence in ('low','medium','high')), generated_at timestamptz default now(), viewed_at timestamptz,
  unique (user_id, key)
);
create table journey_progress (
  user_id uuid references users on delete cascade, phase smallint check (phase between 1 and 6),
  status text not null default 'not_started', exercises_completed int not null default 0, last_activity timestamptz,
  primary key (user_id, phase)
);
create table predictions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  thought text, prediction text, behavior text, created_at timestamptz default now(), outcome text, resolved_at timestamptz
);
create table activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  category text, description text, planned_for text, created_at timestamptz default now(), done_at timestamptz
);
create table reciprocity_signals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users on delete cascade,
  timestamp timestamptz default now(), initiated_by text, kept_agreement text, respected_limits text, available text, effort text,
  expected text, happened text
);
-- analytics de produto: sem texto livre do usuário nas props
create table events (
  id uuid primary key default gen_random_uuid(), user_id uuid references users on delete cascade,
  name text not null, timestamp timestamptz not null default now(), props jsonb not null default '{}'
);
create index on check_ins (user_id, timestamp desc);
create index on events (user_id, name, timestamp desc);

-- RLS: cada pessoa só enxerga e altera as próprias linhas.
do $$
declare t text;
begin
  foreach t in array array['users','user_profile','triggers','automatic_thoughts','interventions','check_ins','boundaries',
    'behavioral_metrics','insights','journey_progress','predictions','activities','reciprocity_signals','events']
  loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy "own rows" on %I for all using (%s = auth.uid()) with check (%s = auth.uid())$p$,
      t, case when t = 'users' then 'id' else 'user_id' end, case when t = 'users' then 'id' else 'user_id' end);
  end loop;
end $$;
-- Exclusão de conta: delete from auth.users (cascade apaga tudo — LGPD, direito de eliminação).
