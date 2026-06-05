-- sprint79_internship_coach.sql
-- Phlox — Coach do Estágio (adaptativo). A IA interpreta TUDO do estágio
-- (doentes, diário, objetivos, área) e gera ferramentas/insights à medida do
-- estudante NAQUELE estágio específico, para maximizar a performance — não só
-- registar. Inclui: análise de casuística, lacunas, debrief, preparação de turno,
-- ferramentas geradas dinamicamente.
--
-- 2026-06-05. Idempotente.

-- ─── Insights/análises geradas pela IA (casuística, lacunas) ───────────────
create table if not exists internship_insights (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,        -- 'caseload' | 'gaps' | 'debrief' | 'prep' | 'focus'
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists ii_internship_idx on internship_insights(internship_id, kind, created_at desc);

alter table internship_insights enable row level security;
do $$ begin
  create policy "ii_own" on internship_insights for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── Ferramentas geradas dinamicamente para ESTE estágio ───────────────────
-- A IA propõe (e o estudante ativa) ferramentas à medida das suas necessidades
-- reais naquele estágio: ex. "Checklist de admissão em Cardiologia",
-- "Calculadora de Killip", "Drills de ECG dos meus doentes".
create table if not exists internship_tools (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  rationale     text,                 -- porque é útil para ESTE estudante/estágio
  kind          text not null,        -- 'checklist' | 'drill' | 'reference' | 'calculator' | 'protocol'
  content       jsonb not null default '{}'::jsonb,  -- estrutura específica do kind
  pinned        boolean default false,
  created_at    timestamptz not null default now()
);
create index if not exists it_internship_idx on internship_tools(internship_id, created_at desc);

alter table internship_tools enable row level security;
do $$ begin
  create policy "it_own" on internship_tools for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── RPC: snapshot do estágio para a IA interpretar ────────────────────────
-- Devolve um resumo compacto e ANÓNIMO de tudo (sem PII) para alimentar a IA.
create or replace function internship_snapshot(p_internship_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v jsonb;
begin
  select user_id into v_user from internships where id = p_internship_id;
  if v_user is null or v_user <> auth.uid() then raise exception 'not authorized'; end if;

  select jsonb_build_object(
    'internship', (select jsonb_build_object(
        'name', name, 'area', area, 'specialty', specialty, 'ward', ward,
        'objectives_summary', objectives_summary,
        'start_date', start_date, 'end_date', end_date,
        'days_total', greatest(1, (end_date - start_date)),
        'days_elapsed', greatest(0, (least(current_date, end_date) - start_date))
      ) from internships where id = p_internship_id),
    'diagnoses', (select coalesce(jsonb_agg(d), '[]'::jsonb) from (
        select diagnosis as d from internship_patients
        where internship_id = p_internship_id and diagnosis is not null
      ) q),
    'comorbidities', (select coalesce(jsonb_agg(c), '[]'::jsonb) from (
        select distinct unnest(comorbidities) as c from internship_patients
        where internship_id = p_internship_id and comorbidities is not null
      ) q),
    'patient_count', (select count(*) from internship_patients where internship_id = p_internship_id),
    'procedures', (select coalesce(jsonb_agg(distinct name), '[]'::jsonb)
        from internship_procedures where internship_id = p_internship_id),
    'objectives', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'done', status = 'completed')), '[]'::jsonb)
        from internship_objectives where internship_id = p_internship_id),
    'log_topics', (select coalesce(jsonb_agg(left(content, 140)), '[]'::jsonb) from (
        select content from internship_log_entries
        where internship_id = p_internship_id order by created_at desc limit 15
      ) q)
  ) into v;
  return v;
end;
$$;

grant execute on function internship_snapshot(uuid) to authenticated;
