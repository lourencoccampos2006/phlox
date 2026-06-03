-- sprint71_internship.sql
-- Phlox — Ferramenta de estágio para estudantes de saúde.
--
-- Modelo completo:
--   ─ internships              (rotações/estágios — área, local, supervisor, datas, objectivos)
--   ─ internship_patients      (doentes seguidos durante o estágio — ANONIMIZADOS)
--   ─ patient_followups        (evolução diária do doente)
--   ─ internship_log_entries   (diário de turno: o que viu, fez, aprendeu)
--   ─ internship_objectives    (competências exigidas + estado)
--   ─ internship_procedures    (procedimentos realizados/observados)
--   ─ case_presentations       (casos estruturados para apresentação)
--   ─ internship_reports       (relatórios gerados)
--   ─ internship_reflections   (diário reflexivo / ePortfolio)
--   ─ supervisor_evaluations   (avaliações do supervisor)
--   ─ internship_hours         (horas registadas para acreditação)
--
-- TUDO scoped por user_id (estudante é o dono dos dados de estágio).
-- Os "doentes" são ANÓNIMOS — só iniciais, idade, sexo, motivo. Sem PII.
--
-- 2026-06-03. Idempotente.

-- ─── 1) internships ─────────────────────────────────────────────────────
create table if not exists internships (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,                         -- ex: "Internamento Medicina Interna"
  area          text not null check (area in (
                  'medicina','enfermagem','farmacia','fisioterapia','psicologia',
                  'nutricao','medicina_dentaria','veterinaria','tdt',
                  'analises_clinicas','radiologia','farmacologia','outro'
                )),
  -- Especialidade/serviço dentro da área
  specialty     text,                                  -- ex: "cardiologia", "pediatria"
  institution   text,                                  -- ex: "Hospital S. João"
  ward          text,                                  -- ex: "Internamento Med 2A"
  supervisor    text,                                  -- nome do supervisor
  supervisor_email text,
  start_date    date not null,
  end_date      date not null,
  hours_required int default 0,                        -- horas exigidas pelo currículo
  hours_done    int default 0,                         -- denormalizado, actualizado por trigger
  objectives_summary text,                             -- texto livre das exigências
  status        text not null default 'active' check (status in ('planned','active','completed','cancelled')),
  -- Estatísticas denormalizadas para o hub
  patients_count    int default 0,
  log_entries_count int default 0,
  procedures_count  int default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists internships_user_idx on internships(user_id, start_date desc);

drop trigger if exists internships_touch on internships;
create trigger internships_touch before update on internships
  for each row execute procedure set_updated_at();

alter table internships enable row level security;
do $$ begin
  create policy "internships_own" on internships for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── 2) internship_patients — doentes ANÓNIMOS seguidos ─────────────────
create table if not exists internship_patients (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Identificação ANÓNIMA (sem nome, sem SNS)
  initials      text,                                  -- ex: "M.S."
  age           int,
  sex           text check (sex in ('M','F','outro') or sex is null),
  -- Clínica
  admission_date date,
  discharge_date date,
  bed_label     text,                                  -- ex: "203-B"
  chief_complaint text,                                -- queixa principal
  diagnosis     text,                                  -- diagnóstico principal
  secondary_diagnoses text[],
  comorbidities text[],
  allergies     text[],
  current_meds  text,                                  -- texto livre
  background    text,                                  -- história clínica
  -- Acompanhamento
  status        text not null default 'active' check (status in ('active','discharged','transferred','deceased')),
  is_followed   boolean default true,                  -- ainda sigo?
  last_seen_at  timestamptz,
  -- Aprendizagem
  learning_points text,                                -- o que aprendi com este doente
  -- Marcadores para apresentação/relatório
  selected_for_presentation boolean default false,
  selected_for_report boolean default false,
  tags          text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ip_internship_idx on internship_patients(internship_id, status);
create index if not exists ip_user_idx on internship_patients(user_id);

drop trigger if exists ip_touch on internship_patients;
create trigger ip_touch before update on internship_patients
  for each row execute procedure set_updated_at();

alter table internship_patients enable row level security;
do $$ begin
  create policy "ip_own" on internship_patients for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── 3) patient_followups — evolução diária ─────────────────────────────
create table if not exists patient_followups (
  id            uuid primary key default gen_random_uuid(),
  internship_patient_id uuid not null references internship_patients(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  followup_date date not null default current_date,
  shift         text check (shift in ('manha','tarde','noite') or shift is null),
  -- SOAP estruturado (ou livre)
  subjective    text,                                  -- S
  objective     text,                                  -- O (vitais, exame, exames)
  assessment    text,                                  -- A (raciocínio)
  plan          text,                                  -- P (plano)
  -- Sinais vitais estruturados
  vitals        jsonb,                                 -- { ta, fc, fr, spo2, temp, gli }
  -- Discussão
  discussed_with_supervisor boolean default false,
  supervisor_feedback text,
  created_at    timestamptz not null default now()
);
create index if not exists pf_patient_idx on patient_followups(internship_patient_id, followup_date desc);

alter table patient_followups enable row level security;
do $$ begin
  create policy "pf_own" on patient_followups for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── 4) internship_log_entries — diário de turno ────────────────────────
create table if not exists internship_log_entries (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  entry_date    date not null default current_date,
  shift         text check (shift in ('manha','tarde','noite') or shift is null),
  hours         numeric(4,1),                          -- horas no turno
  -- Conteúdo
  what_was_done text,                                  -- actividades
  patients_seen int,
  highlights    text,                                  -- casos/momentos marcantes
  difficulties  text,                                  -- dificuldades
  questions     text,                                  -- dúvidas a esclarecer
  learning      text,                                  -- o que aprendi
  -- Estado emocional/cognitivo (para reflexão)
  mood          int check (mood between 1 and 5),      -- 1=mau, 5=óptimo
  fatigue       int check (fatigue between 1 and 5),
  -- IA pode enriquecer
  ai_summary    text,
  created_at    timestamptz not null default now()
);
create index if not exists log_internship_idx on internship_log_entries(internship_id, entry_date desc);

alter table internship_log_entries enable row level security;
do $$ begin
  create policy "log_own" on internship_log_entries for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── 5) internship_objectives — competências ────────────────────────────
create table if not exists internship_objectives (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text,                                  -- ex: "Anamnese", "Procedimentos"
  title         text not null,
  description   text,
  level         text default 'see' check (level in ('see','assist','do','master')),
  required      boolean default true,
  -- Progresso
  status        text not null default 'pending' check (status in ('pending','in_progress','completed','validated')),
  completed_at  timestamptz,
  validated_by  text,                                  -- nome do supervisor
  evidence      text,                                  -- como provo? (qual doente, qual procedimento)
  created_at    timestamptz not null default now()
);
create index if not exists obj_internship_idx on internship_objectives(internship_id, status);

alter table internship_objectives enable row level security;
do $$ begin
  create policy "obj_own" on internship_objectives for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── 6) internship_procedures — procedimentos efectuados ────────────────
create table if not exists internship_procedures (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  procedure_name text not null,
  procedure_category text,                            -- ex: "vascular", "respiratorio"
  -- Nível de participação
  level         text not null check (level in ('observed','assisted','performed_supervised','performed_alone')),
  performed_at  timestamptz not null default now(),
  -- Doente associado (opcional)
  patient_id    uuid references internship_patients(id) on delete set null,
  -- Reflexão
  difficulties  text,
  outcome       text,
  supervisor    text,
  supervisor_signed boolean default false,
  -- Anexos / fotos (URLs)
  attachments   text[],
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists proc_internship_idx on internship_procedures(internship_id, performed_at desc);
create index if not exists proc_user_proc_idx on internship_procedures(user_id, procedure_name);

alter table internship_procedures enable row level security;
do $$ begin
  create policy "proc_own" on internship_procedures for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── 7) case_presentations — casos estruturados ────────────────────────
create table if not exists case_presentations (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  patient_id    uuid references internship_patients(id) on delete set null,
  title         text not null,
  -- Estrutura completa do caso
  presentation_date date,
  history       text,                                  -- história clínica
  exam_findings text,                                  -- exame físico
  investigations text,                                 -- exames realizados
  differential  text,                                  -- diagnóstico diferencial
  final_diagnosis text,
  management    text,                                  -- conduta
  outcome       text,                                  -- evolução / outcome
  discussion    text,                                  -- discussão / pontos-chave
  references_text text,                                -- referências bibliográficas
  -- IA gerou alguma parte?
  ai_assisted   boolean default false,
  -- Partilha (peer review)
  shareable_link text unique,
  is_public     boolean default false,
  feedback_received text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists case_internship_idx on case_presentations(internship_id, created_at desc);

drop trigger if exists case_touch on case_presentations;
create trigger case_touch before update on case_presentations
  for each row execute procedure set_updated_at();

alter table case_presentations enable row level security;
do $$ begin
  create policy "case_own" on case_presentations for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "case_public_read" on case_presentations for select
    using (is_public = true);
exception when duplicate_object then null; end $$;

-- ─── 8) internship_reports — relatórios gerados ─────────────────────────
create table if not exists internship_reports (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in (
                  'final','intermediate','weekly','case','reflective','custom'
                )),
  title         text not null,
  body          text,                                  -- markdown
  ai_assisted   boolean default false,
  exported_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists report_internship_idx on internship_reports(internship_id, created_at desc);

alter table internship_reports enable row level security;
do $$ begin
  create policy "report_own" on internship_reports for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── 9) internship_reflections — diário reflexivo ──────────────────────
create table if not exists internship_reflections (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Modelo de Gibbs (ou Driscoll)
  framework     text default 'gibbs' check (framework in ('gibbs','driscoll','free')),
  -- Gibbs: Description, Feelings, Evaluation, Analysis, Conclusion, Action Plan
  description   text,
  feelings      text,
  evaluation    text,
  analysis      text,
  conclusion    text,
  action_plan   text,
  -- ou texto livre
  free_text     text,
  is_private    boolean default true,
  created_at    timestamptz not null default now()
);
create index if not exists refl_internship_idx on internship_reflections(internship_id, created_at desc);

alter table internship_reflections enable row level security;
do $$ begin
  create policy "refl_own" on internship_reflections for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── 10) supervisor_evaluations — avaliações do supervisor ─────────────
create table if not exists supervisor_evaluations (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('formative','summative','mini_cex','dops','cbd')),
  evaluator_name text,
  evaluator_role text,
  evaluation_date date default current_date,
  -- Escalas 1-5
  knowledge_score int check (knowledge_score between 1 and 5),
  skills_score    int check (skills_score between 1 and 5),
  attitude_score  int check (attitude_score between 1 and 5),
  professionalism_score int check (professionalism_score between 1 and 5),
  overall_score   int check (overall_score between 1 and 5),
  -- Comentários
  strengths     text,
  improvements  text,
  comments      text,
  -- Token URL para o supervisor preencher remotamente
  share_token   text unique,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists eval_internship_idx on supervisor_evaluations(internship_id, created_at desc);

alter table supervisor_evaluations enable row level security;
do $$ begin
  create policy "eval_own" on supervisor_evaluations for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "eval_supervisor_token" on supervisor_evaluations for update
    using (share_token is not null) with check (share_token is not null);
exception when duplicate_object then null; end $$;

-- ─── 11) internship_hours — registo de horas (acreditação) ─────────────
create table if not exists internship_hours (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references internships(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  hours_date    date not null default current_date,
  hours         numeric(4,1) not null,
  activity      text,                                  -- ex: "clinic", "rounds", "OR"
  validated     boolean default false,
  created_at    timestamptz not null default now()
);
create index if not exists hours_internship_idx on internship_hours(internship_id, hours_date);

alter table internship_hours enable row level security;
do $$ begin
  create policy "hours_own" on internship_hours for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── Triggers de denormalização (estatísticas no internship) ───────────
create or replace function refresh_internship_stats(p_internship_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update internships set
    patients_count = coalesce((select count(*) from internship_patients where internship_id = p_internship_id), 0),
    log_entries_count = coalesce((select count(*) from internship_log_entries where internship_id = p_internship_id), 0),
    procedures_count = coalesce((select count(*) from internship_procedures where internship_id = p_internship_id), 0),
    hours_done = coalesce((select sum(hours)::int from internship_hours where internship_id = p_internship_id), 0)
  where id = p_internship_id;
end;
$$;

create or replace function refresh_stats_trigger() returns trigger
language plpgsql as $$
begin
  perform refresh_internship_stats(coalesce(new.internship_id, old.internship_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists ip_refresh on internship_patients;
create trigger ip_refresh after insert or update or delete on internship_patients
  for each row execute procedure refresh_stats_trigger();
drop trigger if exists log_refresh on internship_log_entries;
create trigger log_refresh after insert or update or delete on internship_log_entries
  for each row execute procedure refresh_stats_trigger();
drop trigger if exists proc_refresh on internship_procedures;
create trigger proc_refresh after insert or update or delete on internship_procedures
  for each row execute procedure refresh_stats_trigger();
drop trigger if exists hours_refresh on internship_hours;
create trigger hours_refresh after insert or update or delete on internship_hours
  for each row execute procedure refresh_stats_trigger();

-- ─── Função: cria objectivos default para nova rotação ─────────────────
create or replace function seed_default_objectives(p_internship_id uuid, p_area text, p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0;
begin
  if p_area = 'medicina' then
    insert into internship_objectives (internship_id, user_id, category, title, description, level, required) values
      (p_internship_id, p_user, 'Anamnese', 'Colheita de história clínica completa', 'Identificação, queixa principal, HDA, AP, AF, hábitos, revisão por sistemas', 'do', true),
      (p_internship_id, p_user, 'Exame físico', 'Exame físico geral por sistemas', 'Cardiovascular, pulmonar, abdominal, neurológico básico', 'do', true),
      (p_internship_id, p_user, 'Raciocínio clínico', 'Construir diagnóstico diferencial', 'Hipóteses ordenadas por probabilidade', 'do', true),
      (p_internship_id, p_user, 'Procedimentos', 'Punção venosa periférica', '', 'do', true),
      (p_internship_id, p_user, 'Procedimentos', 'Algaliação vesical', '', 'assist', true),
      (p_internship_id, p_user, 'Procedimentos', 'Sondagem nasogástrica', '', 'assist', false),
      (p_internship_id, p_user, 'Comunicação', 'Apresentar doente em discussão', 'SBAR / formato hospitalar', 'do', true),
      (p_internship_id, p_user, 'Prescrição', 'Sugerir plano terapêutico para casos comuns', '', 'do', true),
      (p_internship_id, p_user, 'Documentação', 'Escrita de nota clínica SOAP', '', 'do', true);
    v_count := 9;
  elsif p_area = 'enfermagem' then
    insert into internship_objectives (internship_id, user_id, category, title, level, required) values
      (p_internship_id, p_user, 'Sinais vitais', 'Avaliação de sinais vitais completa', 'do', true),
      (p_internship_id, p_user, 'Administração', 'Administração IV', 'do', true),
      (p_internship_id, p_user, 'Administração', 'Administração IM', 'do', true),
      (p_internship_id, p_user, 'Administração', 'Administração SC', 'do', true),
      (p_internship_id, p_user, 'Pensos', 'Penso simples', 'do', true),
      (p_internship_id, p_user, 'Pensos', 'Avaliação UPP (escala Braden)', 'do', true),
      (p_internship_id, p_user, 'Acessos', 'Cateterismo venoso periférico', 'do', true),
      (p_internship_id, p_user, 'Educação', 'Educação ao doente sobre medicação', 'do', true),
      (p_internship_id, p_user, 'Plano de cuidados', 'Elaborar plano de cuidados (NANDA-NIC-NOC)', 'do', true),
      (p_internship_id, p_user, 'Comunicação', 'Passagem de turno (SBAR)', 'do', true);
    v_count := 10;
  elsif p_area = 'farmacia' then
    insert into internship_objectives (internship_id, user_id, category, title, level, required) values
      (p_internship_id, p_user, 'Validação', 'Validação de prescrição médica', 'do', true),
      (p_internship_id, p_user, 'Validação', 'Verificar interações medicamentosas', 'do', true),
      (p_internship_id, p_user, 'Aconselhamento', 'Aconselhamento ao utente em automedicação', 'do', true),
      (p_internship_id, p_user, 'Reconciliação', 'Reconciliação medicamentosa de admissão', 'do', true),
      (p_internship_id, p_user, 'Intervenção', 'Intervenção PCNE documentada', 'do', true),
      (p_internship_id, p_user, 'Preparação', 'Preparação manipulados não-estéreis', 'assist', false),
      (p_internship_id, p_user, 'Preparação', 'Preparação manipulados estéreis (FFP)', 'observed', false),
      (p_internship_id, p_user, 'Stock', 'Gestão de stock e validades', 'do', true),
      (p_internship_id, p_user, 'Counseling', 'Educação para uso correcto de inalador / insulina', 'do', true);
    v_count := 9;
  elsif p_area = 'fisioterapia' then
    insert into internship_objectives (internship_id, user_id, category, title, level, required) values
      (p_internship_id, p_user, 'Avaliação', 'Anamnese e exame postural', 'do', true),
      (p_internship_id, p_user, 'Avaliação', 'Goniometria activa e passiva', 'do', true),
      (p_internship_id, p_user, 'Avaliação', 'Avaliação força muscular (MRC)', 'do', true),
      (p_internship_id, p_user, 'Plano', 'Construção de plano de tratamento individualizado', 'do', true),
      (p_internship_id, p_user, 'Técnicas', 'Mobilizações articulares', 'do', true),
      (p_internship_id, p_user, 'Técnicas', 'Cinesiterapia respiratória', 'do', true),
      (p_internship_id, p_user, 'Educação', 'Ensino de exercícios ao doente', 'do', true);
    v_count := 7;
  elsif p_area = 'psicologia' then
    insert into internship_objectives (internship_id, user_id, category, title, level, required) values
      (p_internship_id, p_user, 'Avaliação', 'Entrevista clínica inicial', 'do', true),
      (p_internship_id, p_user, 'Avaliação', 'Aplicação de escalas (BDI, HAM-A, MMSE)', 'do', true),
      (p_internship_id, p_user, 'Intervenção', 'Sessão psicoterapêutica observada', 'observed', true),
      (p_internship_id, p_user, 'Intervenção', 'Plano de intervenção', 'do', true),
      (p_internship_id, p_user, 'Documentação', 'Notas de sessão estruturadas', 'do', true);
    v_count := 5;
  elsif p_area = 'nutricao' then
    insert into internship_objectives (internship_id, user_id, category, title, level, required) values
      (p_internship_id, p_user, 'Avaliação', 'Avaliação nutricional completa (MUST/MNA)', 'do', true),
      (p_internship_id, p_user, 'Avaliação', 'Antropometria (PCT, CMB)', 'do', true),
      (p_internship_id, p_user, 'Plano', 'Plano alimentar individualizado', 'do', true),
      (p_internship_id, p_user, 'Suporte', 'Cálculo de necessidades para NPT/NE', 'assist', true),
      (p_internship_id, p_user, 'Educação', 'Educação alimentar ao doente/família', 'do', true);
    v_count := 5;
  end if;
  return v_count;
end;
$$;

grant execute on function seed_default_objectives(uuid, text, uuid) to authenticated;
grant execute on function refresh_internship_stats(uuid) to authenticated;

notify pgrst, 'reload schema';
