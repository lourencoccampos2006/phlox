-- sprint134_adl_reviews.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO TU MESMO NO SUPABASE (SQL EDITOR).
-- Não apliquei — não toco no Supabase sem pedires (ver memória do projeto).
--
-- Módulo 15 (2026-08-20) — capacidade funcional contínua.
--
-- Porquê tabela PRÓPRIA e não uma coluna em care_records:
--   O care_records é por (data + turno) e pressupõe um registo de turno feito
--   todos os dias. Num CENTRO DE DIA isso não corresponde à realidade — pode
--   nem haver profissional a tempo inteiro, e o foco do dia não é documentar.
--   Uma tabela à parte deixa cada instituição usar o ritmo que aguenta
--   (diário num lar, semanal ou quinzenal num centro de dia) sem forçar um
--   registo de turno que não existe. O motor de leitura adapta-se sozinho à
--   cadência (janela por tempo, não por número de registos).
--
-- Escala 0-3 por tarefa (3 = mais autónomo). Guardamos o NÚMERO; as palavras
-- em linguagem simples vivem em lib/adl.ts, para poderem mudar sem migração.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists adl_reviews (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id) on delete set null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,
  date         date not null default current_date,
  -- 3 = sozinho · 2 = com vigilância · 1 = com alguma ajuda · 0 = fizemos nós
  higiene      smallint check (higiene between 0 and 3),
  alimentacao  smallint check (alimentacao between 0 and 3),
  mobilidade   smallint check (mobilidade between 0 and 3),
  notes        text,
  recorded_by_id uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- Uma revisão por pessoa por dia (voltar a gravar no mesmo dia corrige).
do $$ begin
  alter table adl_reviews add constraint adl_reviews_unique unique (patient_id, date);
exception when duplicate_object then null; end $$;

create index if not exists adl_reviews_patient_idx on adl_reviews (patient_id, date desc);
create index if not exists adl_reviews_org_idx on adl_reviews (org_id, date desc);

alter table adl_reviews enable row level security;

do $$ begin
  create policy "adl_reviews_own" on adl_reviews for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "adl_reviews_org_access" on adl_reviews for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

-- Só-leitura (viewer) não escreve — mesmo padrão das outras tabelas.
do $$ begin
  execute $p$create policy "adl_reviews_ins_noviewer" on adl_reviews as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "adl_reviews_upd_noviewer" on adl_reviews as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "adl_reviews_del_noviewer" on adl_reviews as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

notify pgrst, 'reload schema';
