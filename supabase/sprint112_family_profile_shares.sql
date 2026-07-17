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
