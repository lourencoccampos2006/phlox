-- sprint48_premium_student.sql
-- Phlox — Funcionalidades premium do plano ESTUDANTE.

-- ── SRS — Spaced Repetition cards ────────────────────────────────────────────
-- Algoritmo SuperMemo-2 (Wozniak 1985, base do Anki).
-- Cada card tem ease, interval, next_due. Reviews ficam em separado.
create table if not exists study_cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  deck         text,                                  -- "Farmacologia · Anticoagulantes"
  source       text,                                  -- "biblioteca:<doc_id>" / "manual" / "mnemonic"
  front        text not null,
  back         text not null,
  hint         text,
  -- SM-2 state
  ease         numeric not null default 2.5,          -- ease factor
  interval_d   int not null default 0,                -- dias até próxima revisão
  repetitions  int not null default 0,
  due_at       timestamptz not null default now(),
  last_review_at timestamptz,
  -- Flags
  suspended    boolean not null default false,
  tags         text[],
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists study_cards_user_due_idx on study_cards(user_id, due_at) where suspended = false;
create index if not exists study_cards_deck_idx on study_cards(user_id, deck);
alter table study_cards enable row level security;
do $$ begin
  create policy "study_cards_own" on study_cards for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create table if not exists study_card_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  card_id      uuid references study_cards(id) on delete cascade,
  reviewed_at  timestamptz not null default now(),
  rating       int not null check (rating between 0 and 5),
  prev_interval int,
  new_interval int
);
create index if not exists study_card_reviews_user_idx on study_card_reviews(user_id, reviewed_at desc);
alter table study_card_reviews enable row level security;
do $$ begin
  create policy "study_card_reviews_own" on study_card_reviews for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── Plano de estudo ──────────────────────────────────────────────────────────
create table if not exists study_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  exam_date    date,                                  -- data do exame
  subject      text,
  topics       jsonb,                                 -- ["Anticoagulantes", "Estatinas", ...]
  days_per_week int,
  minutes_per_session int,
  ai_breakdown jsonb,                                 -- plano detalhado gerado pela AI
  progress     jsonb,                                 -- { topic: pct }
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table study_plans enable row level security;
do $$ begin
  create policy "study_plans_own" on study_plans for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── Sessões de estudo (Pomodoro tracking) ────────────────────────────────────
create table if not exists study_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  plan_id      uuid references study_plans(id) on delete set null,
  topic        text,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  minutes      int,
  cards_reviewed int default 0,
  cards_correct int default 0,
  notes        text
);

-- CORREÇÃO: Garante a criação segura das colunas caso a tabela study_sessions já exista
do $$ begin
  alter table study_sessions add column if not exists plan_id uuid references study_plans(id) on delete set null;
  alter table study_sessions add column if not exists topic text;
  alter table study_sessions add column if not exists started_at timestamptz not null default now();
  alter table study_sessions add column if not exists ended_at timestamptz;
  alter table study_sessions add column if not exists minutes int;
  alter table study_sessions add column if not exists cards_reviewed int default 0;
  alter table study_sessions add column if not exists cards_correct int default 0;
  alter table study_sessions add column if not exists notes text;
exception when undefined_table then null; end $$;

-- O índice já será criado com sucesso agora
create index if not exists study_sessions_user_idx on study_sessions(user_id, started_at desc);
alter table study_sessions enable row level security;
do $$ begin
  create policy "study_sessions_own" on study_sessions for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;