-- sprint91_org_sharing_audit.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- PARTILHA POR ORGANIZAÇÃO + AUDITORIA (quem fez o quê)
--
-- Objetivo: no plano Institucional, a equipa toda trabalha sobre os MESMOS
-- utentes e registos (partilhados pela organização), e o dono/admin consegue ver
-- QUEM fez cada registo e quando. Tudo retrocompatível: contas individuais (sem
-- org) continuam a funcionar exatamente como antes (org_id fica null).
--
-- Estratégia de leitura/escrita (feita na app, lib/orgScope.ts):
--   • escrita: grava SEMPRE user_id (compat) + org_id (se houver org ativa) +
--     recorded_by_id (quem fez).
--   • leitura: se houver org ativa → filtra por org_id; senão → por user_id.
--
-- 2026-06-26.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabelas partilháveis do cuidado diário (centro de dia / lar).
-- Para cada uma: org_id (de quem é a organização dona do registo) e
-- recorded_by_id (que utilizador fez o registo — base da auditoria).
do $$
declare t text;
begin
  foreach t in array array[
    'patients','care_records','mar_records','activities','activity_participations',
    'incidents','assessments','family_messages','family_thread_messages',
    'visit_requests','resident_contacts','vitals','wounds','patient_meds'
  ]
  loop
    begin
      -- org_id (nullable: registos antigos / contas individuais continuam válidos)
      execute format(
        'alter table if exists public.%I add column if not exists org_id uuid references public.organizations(id) on delete set null', t);
      -- recorded_by_id (quem criou/assinou o registo) — auditoria por pessoa
      execute format(
        'alter table if exists public.%I add column if not exists recorded_by_id uuid references auth.users(id)', t);
      -- índice por organização para leituras rápidas da equipa
      execute format(
        'create index if not exists %I on public.%I (org_id)', t || '_org_idx', t);
    exception when others then
      raise notice 'sprint91: tabela % ignorada (%).', t, sqlerrm;  -- não para a migração
    end;
  end loop;
end $$;

-- ─── RLS: membros da org veem/editam os registos da sua organização ──────────
-- Mantemos as policies "_own" existentes (user_id = auth.uid()) e ADICIONAMOS
-- uma policy por org. Numa policy de SELECT/ALL, o Postgres faz OR entre policies
-- permissivas — logo um registo é acessível se for MEU (user_id) OU da MINHA org.
do $$
declare t text;
begin
  foreach t in array array[
    'patients','care_records','mar_records','activities','activity_participations',
    'incidents','assessments','family_messages','family_thread_messages',
    'visit_requests','resident_contacts','vitals','wounds','patient_meds'
  ]
  loop
    begin
      execute format($f$
        create policy "%1$s_org_access" on public.%1$I for all
          using (
            org_id is not null
            and org_id in (select org_id from org_members where user_id = auth.uid() and active = true)
          )
          with check (
            org_id is not null
            and org_id in (select org_id from org_members where user_id = auth.uid() and active = true)
          )
      $f$, t);
    exception
      when others then null;   -- policy já existe / tabela ou coluna em falta nesta BD → ignora
    end;
  end loop;
end $$;

-- ─── Vista de auditoria (conveniência) ──────────────────────────────────────
-- Junta os principais registos de cuidado numa linha do tempo "quem/o quê/quando"
-- por organização. O painel do dono lê SOBRETUDO das tabelas diretamente
-- (app/api/org/audit), esta vista é só conveniência. Colunas de tempo REAIS:
--   mar_records → recorded_at   |   care_records → created_at   |   incidents → created_at
-- Envolvida em bloco tolerante: se uma coluna não existir nesta BD, não rebenta a
-- migração (as alterações importantes acima já foram aplicadas).
do $$
begin
  execute $v$
    create or replace view org_audit_feed as
      select 'medicação'::text as kind, m.org_id, m.recorded_by_id, m.patient_id,
             m.status::text as detail, m.recorded_at as at
        from mar_records m where m.org_id is not null
      union all
      select 'registo do dia'::text as kind, c.org_id, c.recorded_by_id, c.patient_id,
             c.shift::text as detail, c.created_at as at
        from care_records c where c.org_id is not null
      union all
      select 'ocorrência'::text as kind, i.org_id, i.recorded_by_id, i.patient_id,
             i.type::text as detail, i.created_at as at
        from incidents i where i.org_id is not null
  $v$;
exception when others then
  raise notice 'org_audit_feed não criada (%). A migração principal está OK; o painel do dono lê das tabelas diretamente.', sqlerrm;
end $$;
