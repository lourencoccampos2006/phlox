-- sprint80_internship_links.sql
-- Phlox — Links do estágio:
--   1) Avaliação por link: o supervisor preenche sem conta (usa share_token de
--      supervisor_evaluations, já existente em sprint71).
--   2) Portefólio só-leitura: link público para mostrar o estágio.
--
-- 2026-06-05. Idempotente.

-- Garante pgcrypto (gen_random_bytes). Em Supabase está no schema "extensions".
create extension if not exists pgcrypto with schema extensions;

-- Gerador de token robusto (não depende de pgcrypto estar no search_path)
create or replace function phlox_gen_token(p_len int default 16)
returns text language sql volatile as $$
  select string_agg(substr('0123456789abcdef', 1 + floor(random()*16)::int, 1), '')
  from generate_series(1, p_len * 2);
$$;

-- ─── Portefólio: token de partilha só-leitura no estágio ───────────────────
alter table internships add column if not exists portfolio_token text unique;
alter table internships add column if not exists portfolio_public boolean default false;

-- ─── RPC: criar pedido de avaliação (gera token) ──────────────────────────
create or replace function create_eval_request(
  p_internship_id uuid, p_kind text, p_evaluator_name text, p_evaluator_role text
) returns supervisor_evaluations
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_token text;
  r supervisor_evaluations;
begin
  select user_id into v_user from internships where id = p_internship_id;
  if v_user is null or v_user <> auth.uid() then raise exception 'not authorized'; end if;
  v_token := phlox_gen_token(16);

  insert into supervisor_evaluations (internship_id, user_id, kind, evaluator_name, evaluator_role, share_token)
  values (p_internship_id, v_user, coalesce(p_kind, 'formative'), p_evaluator_name, p_evaluator_role, v_token)
  returning * into r;
  return r;
end;
$$;
grant execute on function create_eval_request(uuid, text, text, text) to authenticated;

-- ─── RPC: ler avaliação por token (público, p/ o supervisor preencher) ─────
create or replace function get_eval_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'id', e.id,
    'kind', e.kind,
    'evaluator_name', e.evaluator_name,
    'evaluator_role', e.evaluator_role,
    'submitted', e.submitted_at is not null,
    'internship_name', i.name,
    'area', i.area,
    'student_period', to_char(i.start_date,'YYYY-MM-DD') || ' a ' || to_char(i.end_date,'YYYY-MM-DD')
  ) into r
  from supervisor_evaluations e join internships i on i.id = e.internship_id
  where e.share_token = p_token;
  return r;  -- null se não existir
end;
$$;
grant execute on function get_eval_by_token(text) to anon, authenticated;

-- ─── RPC: submeter avaliação por token (público) ──────────────────────────
create or replace function submit_eval_by_token(
  p_token text, p_knowledge int, p_skills int, p_attitude int,
  p_professionalism int, p_overall int,
  p_strengths text, p_improvements text, p_comments text,
  p_evaluator_name text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from supervisor_evaluations where share_token = p_token and submitted_at is null;
  if v_id is null then return false; end if;
  update supervisor_evaluations set
    knowledge_score = least(5, greatest(1, coalesce(p_knowledge, 3))),
    skills_score = least(5, greatest(1, coalesce(p_skills, 3))),
    attitude_score = least(5, greatest(1, coalesce(p_attitude, 3))),
    professionalism_score = least(5, greatest(1, coalesce(p_professionalism, 3))),
    overall_score = least(5, greatest(1, coalesce(p_overall, 3))),
    strengths = p_strengths, improvements = p_improvements, comments = p_comments,
    evaluator_name = coalesce(nullif(p_evaluator_name, ''), evaluator_name),
    submitted_at = now()
  where id = v_id;
  return true;
end;
$$;
grant execute on function submit_eval_by_token(text,int,int,int,int,int,text,text,text,text) to anon, authenticated;

-- ─── RPC: portefólio público por token (só-leitura) ────────────────────────
create or replace function get_portfolio_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'internship', jsonb_build_object('name', i.name, 'area', i.area, 'specialty', i.specialty,
      'institution', i.institution, 'ward', i.ward, 'supervisor', i.supervisor,
      'period', to_char(i.start_date,'YYYY-MM-DD') || ' a ' || to_char(i.end_date,'YYYY-MM-DD'),
      'hours_done', i.hours_done, 'hours_required', i.hours_required),
    'objectives', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'category', category, 'status', status, 'level', level)), '[]'::jsonb)
      from internship_objectives where internship_id = i.id),
    'procedures', (select coalesce(jsonb_agg(jsonb_build_object('name', procedure_name, 'level', level)), '[]'::jsonb)
      from internship_procedures where internship_id = i.id),
    'cases', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'diagnosis', final_diagnosis)), '[]'::jsonb)
      from case_presentations where internship_id = i.id),
    'evaluations', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'evaluator', evaluator_name, 'overall', overall_score)), '[]'::jsonb)
      from supervisor_evaluations where internship_id = i.id and submitted_at is not null),
    'patient_count', (select count(*) from internship_patients where internship_id = i.id)
  ) into r
  from internships i
  where i.portfolio_token = p_token and i.portfolio_public = true;
  return r;  -- null se não público
end;
$$;
grant execute on function get_portfolio_by_token(text) to anon, authenticated;

-- ─── RPC: ligar/desligar partilha do portefólio (gera token) ───────────────
create or replace function set_portfolio_share(p_internship_id uuid, p_public boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_token text;
begin
  select user_id, portfolio_token into v_user, v_token from internships where id = p_internship_id;
  if v_user is null or v_user <> auth.uid() then raise exception 'not authorized'; end if;
  if v_token is null then v_token := phlox_gen_token(12); end if;
  update internships set portfolio_public = p_public, portfolio_token = v_token where id = p_internship_id;
  return v_token;
end;
$$;
grant execute on function set_portfolio_share(uuid, boolean) to authenticated;
