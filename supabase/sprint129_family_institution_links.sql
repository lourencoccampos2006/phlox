-- sprint129_family_institution_links.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Porquê: /portal-familia (removida 2026-08-09) guardava a ligação
-- familiar↔residente institucional só em localStorage do dispositivo (código +
-- últimos 4 dígitos do telefone) — perdia-se ao trocar de telemóvel ou limpar
-- o browser, e não fazia sentido ser um "portal" à parte de /familia (que já
-- é a página da conta pessoal do familiar). Esta tabela persiste a mesma
-- ligação do lado do servidor, presa à conta autenticada do familiar — passa
-- a ser "adicionar um perfil em /familia e ligá-lo à instituição", não uma
-- segunda sessão separada.
--
-- Guarda também `code`/`verify_digits` (não só o patient_id) de propósito:
-- app/api/family-portal/route.ts (a leitura do diário/mensagens/medicação de
-- casa) já está feita e bem testada à volta de "código + últimos 4 dígitos"
-- — reutiliza-se tal e qual a partir daqui, sem reescrever essa rota. Guardar
-- o código aqui não é mais sensível do que já era em localStorage; fica só
-- do lado do servidor e protegido por RLS ao próprio utilizador, em vez de
-- em texto simples no dispositivo.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists family_institution_links (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  family_profile_id uuid not null references family_profiles(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  patient_name     text,
  code             text not null,
  verify_digits    text not null,
  created_at       timestamptz not null default now(),
  unique (family_profile_id)
);

create index if not exists family_institution_links_user_idx on family_institution_links(user_id);

alter table family_institution_links enable row level security;

drop policy if exists family_institution_links_own on family_institution_links;
create policy family_institution_links_own on family_institution_links
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
