-- sprint68_patients_org.sql
-- Phlox — Adiciona org_id e temporary à tabela patients.
--
-- Permite:
--   ─ Ligar doentes a organizações (multi-org)
--   ─ Marcar fichas como "visita única" (temporary=true) que podem ser
--     limpas em batch mais tarde sem perder o histórico de eventos
--   ─ Que o BI conversacional possa filtrar patients por org_id
--
-- 2026-06-03. Idempotente.

do $$ begin
  -- Garante que a tabela patients existe (caso este sprint corra antes do setup)
  perform 1 from information_schema.tables where table_schema = 'public' and table_name = 'patients';
  if not found then
    raise notice 'Tabela patients não existe — saltar.';
    return;
  end if;

  -- org_id (nullable, para que doentes antigos continuem a existir)
  alter table patients add column if not exists org_id uuid references organizations(id) on delete set null;

  -- temporary (visita única / walk-in)
  alter table patients add column if not exists temporary boolean default false;

  -- Índices úteis
  begin
    create index if not exists patients_org_idx on patients(org_id) where org_id is not null;
  exception when others then null; end;

  begin
    create index if not exists patients_temp_idx on patients(temporary, created_at) where temporary = true;
  exception when others then null; end;
end $$;

-- ─── RLS: permitir que membros da org vejam os doentes da org ────────────
-- (Mantém policies existentes por user_id; adiciona as de org.)
do $$ begin
  create policy "patients_org_read"
    on patients for select
    using (
      org_id is not null and org_id = any(user_org_ids(auth.uid()))
    );
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  create policy "patients_org_write"
    on patients for all
    using (
      org_id is not null and org_id = any(user_org_ids(auth.uid()))
    )
    with check (
      org_id is not null and org_id = any(user_org_ids(auth.uid()))
    );
exception when duplicate_object then null; when others then null; end $$;

-- ─── View útil: doentes activos por org (sem temporários inactivos) ──────
create or replace view org_active_patients as
  select *
  from patients
  where org_id is not null
    and (temporary is null or temporary = false or updated_at > (now() - interval '90 days'));

notify pgrst, 'reload schema';
