-- ═══════════════════════════════════════════════════════════════
-- Migrações combinadas — colar isto de uma vez no SQL Editor do Supabase
-- (sprint111 a sprint114 — todas idempotentes, seguro correr mais que 1x)
-- ═══════════════════════════════════════════════════════════════

-- ─── supabase/sprint111_zarit_burden.sql ───
-- sprint111_zarit_burden.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- MELHORIAS 2026-07-17 (item A4) — escala Zarit-12 de sobrecarga do cuidador.
-- A lógica de pontuação (lib/caregiverScales.ts) já existia mas ficou órfã
-- (sem UI nem tabela) desde a Ronda 13b, quando /familia360 foi cortado para
-- um redirect. Cada avaliação é ligada a UM familiar (a escala pergunta pelo
-- "seu familiar" no singular) — um cuidador pode ter sobrecarga diferente
-- consoante a pessoa de quem cuida, por isso profile_id não é nullable aqui
-- (ao contrário do skin_lesion_tracks, que suporta "próprio").
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists caregiver_burden_checks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references family_profiles(id) on delete cascade,
  answers      jsonb not null,             -- array de 12 inteiros 0-4
  total_score  integer not null check (total_score between 0 and 48),
  band         text not null check (band in ('sem_sobrecarga','sobrecarga_leve','sobrecarga_moderada','sobrecarga_grave')),
  created_at   timestamptz not null default now()
);
create index if not exists caregiver_burden_checks_idx on caregiver_burden_checks (profile_id, created_at desc);

alter table caregiver_burden_checks enable row level security;
do $$ begin create policy "cbc_own" on caregiver_burden_checks for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ─── supabase/sprint112_family_profile_shares.sql ───
-- sprint112_family_profile_shares.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- MELHORIAS 2026-07-17 (item B9) — convite de VISUALIZAÇÃO para perfis de
-- família. Uma migração de dono-único → colaboradores completa mexeria em RLS
-- de family_profiles + family_profile_meds (que tem o seu próprio user_id
-- redundante) e é demasiado arriscada para fazer de uma vez. Esta é a versão
-- faseada e reversível: um código que dá a OUTRA conta Phlox acesso de LEITURA
-- a um perfil de família específico, sem tocar em RLS nenhuma das tabelas
-- existentes — a app/api/family-share/view/route.ts usa service-role e faz a
-- própria verificação de autorização (linha a linha, auditável num sítio só),
-- em vez de abrir a RLS de family_profiles/family_profile_meds/vitals/
-- symptom_logs a um segundo dono.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists family_profile_shares (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references family_profiles(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  viewer_user_id uuid references auth.users(id) on delete cascade,
  code          text not null unique,
  created_at    timestamptz not null default now(),
  redeemed_at   timestamptz,
  revoked_at    timestamptz
);
create index if not exists family_profile_shares_profile_idx on family_profile_shares (profile_id);
create index if not exists family_profile_shares_viewer_idx on family_profile_shares (viewer_user_id);

alter table family_profile_shares enable row level security;
-- O dono vê/gere os convites que criou. O viewer só vê a SUA PRÓPRIA linha (para
-- saber que tem acesso) — nunca lista os convites de outras pessoas.
do $$ begin create policy "fps_owner" on family_profile_shares for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "fps_viewer_read" on family_profile_shares for select using (viewer_user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ─── supabase/sprint113_ai_usage_log.sql ───
-- sprint113_ai_usage_log.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- MELHORIAS 2026-07-17 (item D17) — orçamento de custo de IA por utilizador.
-- Só service-role escreve/lê (lib/aiUsage.ts) — sem policy pública de
-- propósito, RLS ativa por defeito nega tudo a quem não seja service-role.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ai_usage_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  feature    text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_log_user_month_idx on ai_usage_log (user_id, created_at desc);

alter table ai_usage_log enable row level security;

-- ─── supabase/sprint114_recall_watch.sql ───
-- sprint114_recall_watch.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- MELHORIAS 2026-07-17 (item B11) — Vigia de Recalls (recolhas de lote e
-- alertas de segurança do INFARMED). Investigado a fundo antes de construir:
-- ao contrário da Lista de Notificação Prévia (um único ficheiro Excel
-- trimestral), o INFARMED publica recalls como uma listagem HTML paginada em
-- infarmed.pt/web/infarmed/alertas-de-qualidade (+ alertas-de-seguranca), sem
-- ficheiro em bulk. Confirmado com download real + regex testada contra HTML
-- real (8 notícias extraídas corretamente) que É possível ingerir de forma
-- fiável — mas só título+data+link (não os campos de lote/validade dentro de
-- cada notícia, que NÃO têm estrutura consistente entre notícias — algumas
-- são tabela, outras só texto). Por isso: dizemos "este alerta MENCIONA um
-- medicamento teu" e ligamos à notícia oficial, nunca inventamos o nº de lote.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists infarmed_recall_notices (
  id            uuid primary key default gen_random_uuid(),
  url           text not null unique,
  title         text not null,
  notice_date   text,                    -- tal como publicado (DD/MM/AAAA) — não forçamos parsing
  source_page   text not null check (source_page in ('qualidade','seguranca')),
  first_seen_at timestamptz not null default now()
);
create index if not exists infarmed_recall_notices_idx on infarmed_recall_notices (first_seen_at desc);

alter table infarmed_recall_notices enable row level security;
-- Leitura pública (dados de referência oficiais, sem informação pessoal de ninguém).
-- Só o service-role (cron) escreve — sem policy de insert/update/delete.
do $$ begin create policy "recall_notices_public_read" on infarmed_recall_notices for select using (true); exception when duplicate_object then null; end $$;

