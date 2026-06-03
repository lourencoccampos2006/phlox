-- sprint70_study_platform.sql
-- Phlox — Plataforma de estudos: schema para notas, planos, resumos cached,
-- progresso, ECG/lab labels.
--
-- 2026-06-03. Idempotente.

-- ─── Função auxiliar para os triggers de timestamp ────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── study_notes — notas com knowledge graph ─────────────────────────────
create table if not exists study_notes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  body           text,
  domain         text,                                  -- ex: 'farmacologia'
  tags           text[],
  -- Knowledge graph: array de IDs de outras notas linkadas
  linked_ids     uuid[],
  -- Para sugestões automáticas
  embeddings     jsonb,                                 -- placeholder p/ vector
  pinned         boolean default false,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists notes_user_idx on study_notes(user_id, updated_at desc);
create index if not exists notes_user_tags_idx on study_notes using gin(tags);

drop trigger if exists notes_touch on study_notes;
create trigger notes_touch before update on study_notes
  for each row execute procedure set_updated_at();

alter table study_notes enable row level security;
do $$ begin
  create policy "study_notes_own" on study_notes for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── study_plans — planos de estudo gerados por IA ───────────────────────
create table if not exists study_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  goal           text,                                  -- ex: "passar PNA 2027"
  weeks          int default 12,
  hours_per_week int default 15,
  domains        text[],
  status         text not null default 'active' check (status in ('active','paused','completed','abandoned')),
  -- Estrutura: array de {week, day, topic, type, minutes, completed}
  schedule       jsonb,
  current_week   int default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- CORREÇÃO: Garante que a coluna existe caso a tabela já tenha sido criada sem ela no passado
alter table study_plans add column if not exists status text not null default 'active' check (status in ('active','paused','completed','abandoned'));

create index if not exists plans_user_idx on study_plans(user_id, status, created_at desc);

drop trigger if exists plans_touch on study_plans;
create trigger plans_touch before update on study_plans
  for each row execute procedure set_updated_at();

alter table study_plans enable row level security;
do $$ begin
  create policy "study_plans_own" on study_plans for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── study_progress — registo de actividades de estudo ───────────────────
create table if not exists study_progress (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  tool           text not null,                         -- 'quiz','flashcards','decisao','tutor','ecg','lab','resumos','notas','simulador'
  domain         text,
  topic          text,
  -- Resultados
  score          numeric,                               -- 0-100
  duration_sec   int,
  questions_total int,
  questions_correct int,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists progress_user_tool_idx on study_progress(user_id, tool, created_at desc);
create index if not exists progress_user_domain_idx on study_progress(user_id, domain, created_at desc);

alter table study_progress enable row level security;
do $$ begin
  create policy "study_progress_own" on study_progress for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── ecg_library — biblioteca de ECGs (público) ──────────────────────────
create table if not exists ecg_library (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  image_url      text,                                  -- placeholder se houver
  rhythm         text,                                  -- 'sinus','afib','aflutter','vt','vf','svt', etc
  rate_bpm       int,
  axis           text,                                  -- 'normal','left','right','extreme'
  pr_ms          int,
  qrs_ms         int,
  qtc_ms         int,
  findings       text[],                                -- ex: ['supra-st-anterior','onda Q V1-V3']
  diagnosis      text,                                  -- diagnóstico clínico
  context        text,                                  -- ex: "homem 58a, dor torácica há 90min"
  difficulty     text default 'medium' check (difficulty in ('easy','medium','hard')),
  category       text,                                  -- 'sca','arritmias','condução','outros'
  created_at     timestamptz not null default now()
);
create index if not exists ecg_library_category_idx on ecg_library(category, difficulty);

alter table ecg_library enable row level security;
do $$ begin
  create policy "ecg_public_read" on ecg_library for select using (true);
exception when duplicate_object then null; end $$;

-- ─── lab_value_library — valores de referência laboratoriais ────────────
create table if not exists lab_value_library (
  id             uuid primary key default gen_random_uuid(),
  parameter      text not null,
  unit           text,
  ref_low        numeric,
  ref_high       numeric,
  sex            text check (sex in ('M','F','any') or sex is null),
  age_group      text,                                  -- 'adult','pediatric','newborn'
  category       text,                                  -- 'hemograma','bioquímica','iónica','tireóide', etc
  clinical_note  text,                                  -- relevância clínica
  abnormal_low_meaning  text,
  abnormal_high_meaning text,
  created_at     timestamptz not null default now()
);
create index if not exists lab_lib_category_idx on lab_value_library(category, parameter);

alter table lab_value_library enable row level security;
do $$ begin
  create policy "lab_lib_public_read" on lab_value_library for select using (true);
exception when duplicate_object then null; end $$;

-- ─── procedure_guides — procedimentos passo-a-passo ──────────────────────
create table if not exists procedure_guides (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       text,                                  -- 'vascular','respiratorio','genitourinario', etc
  description    text,
  indications    text[],
  contraindications text[],
  materials      text[],
  -- Passos como array de { order, title, body, image_url?, video_url? }
  steps          jsonb,
  warnings       text[],
  references_text text,                                 -- guidelines, links
  difficulty     text default 'medium' check (difficulty in ('easy','medium','hard')),
  duration_min   int,
  created_at     timestamptz not null default now()
);

alter table procedure_guides enable row level security;
do $$ begin
  create policy "procedures_public_read" on procedure_guides for select using (true);
exception when duplicate_object then null; end $$;

-- ─── medical_library — biblioteca de protocolos/guidelines (textos) ─────
create table if not exists medical_library (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  source         text,                                  -- 'DGS','ESC','NICE','UpToDate', etc
  year           int,
  domain         text,                                  -- 'cardiologia','pneumologia', etc
  summary        text,                                  -- resumo de 2-3 frases
  body           text,                                  -- texto completo
  tags           text[],
  url            text,
  created_at     timestamptz not null default now()
);
create index if not exists med_lib_domain_idx on medical_library(domain);
create index if not exists med_lib_tags_idx on medical_library using gin(tags);

alter table medical_library enable row level security;
do $$ begin
  create policy "med_library_public_read" on medical_library for select using (true);
exception when duplicate_object then null; end $$;

-- ─── Seeds mínimos para arranque ─────────────────────────────────────────
-- CORREÇÃO: IDs estáticos injetados para evitar duplicação em execuções repetidas do script

insert into ecg_library (id, title, description, rhythm, rate_bpm, axis, pr_ms, qrs_ms, qtc_ms, findings, diagnosis, context, difficulty, category) values
  ('00000000-0000-0000-0000-000000000001', 'ECG 1 — Ritmo sinusal normal', 'Ritmo sinusal a 75 bpm, sem alterações.', 'sinus', 75, 'normal', 160, 95, 410, ARRAY['ritmo sinusal','sem alterações'], 'Normal', 'Doente assintomático, exame de rotina.', 'easy', 'normal'),
  ('00000000-0000-0000-0000-000000000002', 'ECG 2 — Fibrilhação auricular', 'FA com resposta ventricular rápida.', 'afib', 135, 'normal', null, 90, 420, ARRAY['ausência ondas P','RR irregular'], 'Fibrilhação auricular com RVR', 'Mulher 72 anos, palpitações há 4 horas.', 'medium', 'arritmias'),
  ('00000000-0000-0000-0000-000000000003', 'ECG 3 — STEMI anterior', 'Supra-ST V2-V6 com onda T positiva. Tombstone.', 'sinus', 92, 'normal', 165, 100, 425, ARRAY['supra-ST V2-V6','onda Q V1-V3'], 'STEMI anterior agudo', 'Homem 58a, dor torácica retroesternal há 90min com sudorese.', 'medium', 'sca'),
  ('00000000-0000-0000-0000-000000000004', 'ECG 4 — Bloqueio AV completo', 'Dissociação AV, escape ventricular.', 'sinus', 35, 'left', null, 140, 480, ARRAY['dissociação AV','escape ventricular largo'], 'BAV 3º grau', 'Mulher 78a com síncope.', 'medium', 'condução'),
  ('00000000-0000-0000-0000-000000000005', 'ECG 5 — Hipercaliémia grave', 'Ondas T apiculadas, alargamento do QRS.', 'sinus', 88, 'normal', 220, 145, 410, ARRAY['T apiculadas precordiais','PR alargado','QRS 0.14s'], 'Hipercaliémia grave (K+ ≥ 6.5)', 'Doente DRC 4 com fraqueza e parestesias.', 'hard', 'eletrólitos'),
  ('00000000-0000-0000-0000-000000000006', 'ECG 6 — TEP submaciço', 'S1Q3T3 clássico, taquicárdia sinusal.', 'sinus', 118, 'right', 160, 95, 420, ARRAY['S1Q3T3','BCRD incompleto','T negativas V1-V3'], 'TEP submaciço', 'Mulher 52a pós-cirurgia abdominal, dispneia súbita.', 'hard', 'outros'),
  ('00000000-0000-0000-0000-000000000007', 'ECG 7 — Pericardite aguda', 'Supra-ST côncavo difuso, depressão do PR.', 'sinus', 95, 'normal', 160, 90, 415, ARRAY['supra-ST difuso côncavo','depressão PR'], 'Pericardite aguda', 'Jovem 28a com dor pleurítica posicional.', 'medium', 'outros'),
  ('00000000-0000-0000-0000-000000000008', 'ECG 8 — Hipertrofia VE', 'Critérios Sokolow-Lyon positivos, padrão "strain".', 'sinus', 76, 'left', 165, 110, 435, ARRAY['Sokolow-Lyon > 35mm','padrão strain V5-V6'], 'Hipertrofia ventricular esquerda', 'Doente hipertenso de longa data.', 'medium', 'outros')
on conflict (id) do nothing;

insert into lab_value_library (id, parameter, unit, ref_low, ref_high, sex, age_group, category, clinical_note, abnormal_low_meaning, abnormal_high_meaning) values
  ('10000000-0000-0000-0000-000000000001', 'Hemoglobina', 'g/dL', 13.5, 17.5, 'M', 'adult', 'hemograma', 'Anemia se < 13 H / < 12 M. Policitémia se > 17 H / > 16 M.', 'Anemia — investigar causa (ferropénica, megaloblástica, hemolítica, doença crónica).', 'Policitémia — primária (vera) ou secundária (hipoxia, EPO ectópica).'),
  ('10000000-0000-0000-0000-000000000002', 'Hemoglobina', 'g/dL', 12.0, 16.0, 'F', 'adult', 'hemograma', 'Anemia se < 12 em mulher. Considerar período menstrual.', 'Anemia.', 'Policitémia.'),
  ('10000000-0000-0000-0000-000000000003', 'Leucócitos', '×10⁹/L', 4.0, 11.0, 'any', 'adult', 'hemograma', 'Sempre interpretar com fórmula leucocitária.', 'Leucopenia — quimioterapia, infeção viral, sépsis, medicamentos.', 'Leucocitose — infeção bacteriana, stress, corticoterapia, neoplasia.'),
  ('10000000-0000-0000-0000-000000000004', 'Plaquetas', '×10⁹/L', 150, 450, 'any', 'adult', 'hemograma', 'Trombocitopenia clínica < 100. Risco de hemorragia espontânea < 20.', 'Trombocitopenia — PTI, sépsis, esplenomegalia, medicamentos.', 'Trombocitose — reactiva (inflamação) ou primária (síndromes mieloproliferativos).'),
  ('10000000-0000-0000-0000-000000000005', 'Creatinina', 'mg/dL', 0.7, 1.3, 'M', 'adult', 'bioquímica', 'TFG estimada (CKD-EPI) é mais fiel que valor isolado.', 'Sarcopenia, gravidez, dieta vegetariana.', 'Lesão renal aguda ou crónica — calcular TFG.'),
  ('10000000-0000-0000-0000-000000000006', 'Creatinina', 'mg/dL', 0.6, 1.1, 'F', 'adult', 'bioquímica', 'Mulheres têm menos massa muscular.', 'Sarcopenia.', 'Lesão renal.'),
  ('10000000-0000-0000-0000-000000000007', 'Ureia', 'mg/dL', 15, 45, 'any', 'adult', 'bioquímica', 'Sobe na desidratação e dieta hiperproteica; menos específica que creatinina.', 'Hepatopatia grave, dieta hipoproteica.', 'Desidratação, IRA pré-renal, hemorragia digestiva.'),
  ('10000000-0000-0000-0000-000000000008', 'Sódio', 'mmol/L', 135, 145, 'any', 'adult', 'iónica', 'Hiponatremia < 135 (sintomática < 125). Hipernatremia > 145.', 'Hiponatremia — SIADH, ICC, cirrose, tiazidas.', 'Hipernatremia — desidratação, diabetes insípida.'),
  ('10000000-0000-0000-0000-000000000009', 'Potássio', 'mmol/L', 3.5, 5.0, 'any', 'adult', 'iónica', 'Hipercaliémia > 6.5 é emergência. K < 2.5 também.', 'Hipocaliémia — diuréticos, vómitos, diarreia, hiperaldosteronismo.', 'Hipercaliémia — IRA, IECA/ARA, espironolactona, hemólise da amostra.'),
  ('10000000-0000-0000-0000-000000000010', 'Cloro', 'mmol/L', 98, 107, 'any', 'adult', 'iónica', 'Útil para anion gap.', 'Alcalose metabólica, perda gastrintestinal.', 'Acidose metabólica hiperclorémica.'),
  ('10000000-0000-0000-0000-000000000011', 'Glicémia jejum', 'mg/dL', 70, 99, 'any', 'adult', 'bioquímica', 'Pré-diabetes 100-125. DM ≥ 126 em jejum repetido.', 'Hipoglicémia — sintomática < 70.', 'Hiperglicémia — DM, stress, corticoterapia.'),
  ('10000000-0000-0000-0000-000000000012', 'HbA1c', '%', 4.0, 5.6, 'any', 'adult', 'bioquímica', 'Pré-DM 5.7-6.4. DM ≥ 6.5. Reflecte glicémia média 3 meses.', '—', 'Mau controlo glicémico crónico.'),
  ('10000000-0000-0000-0000-000000000013', 'AST', 'U/L', 0, 40, 'any', 'adult', 'hepática', 'Sobe em lesão hepática, muscular e cardíaca.', '—', 'Hepatite, hepatopatia alcoólica (AST > ALT), rabdomiólise.'),
  ('10000000-0000-0000-0000-000000000014', 'ALT', 'U/L', 0, 40, 'any', 'adult', 'hepática', 'Mais específica para fígado.', '—', 'Hepatite viral, medicamentosa, MASLD.'),
  ('10000000-0000-0000-0000-000000000015', 'Fosfatase alcalina', 'U/L', 40, 130, 'any', 'adult', 'hepática', 'Sobe em colestase e patologia óssea.', '—', 'Colestase, doença óssea (Paget, metástases), gravidez.'),
  ('10000000-0000-0000-0000-000000000016', 'GGT', 'U/L', 0, 60, 'any', 'adult', 'hepática', 'Sensível para álcool e colestase.', '—', 'Hepatopatia alcoólica, colestase, fármacos indutores.'),
  ('10000000-0000-0000-0000-000000000017', 'Bilirrubina total', 'mg/dL', 0.2, 1.2, 'any', 'adult', 'hepática', 'Indirecta (não conjugada) vs directa.', '—', 'Hemólise (indirecta), colestase (directa).'),
  ('10000000-0000-0000-0000-000000000018', 'Troponina T HS', 'ng/L', 0, 14, 'any', 'adult', 'cardíaca', 'Pico 24-48h após enfarte. Cinética importa mais que valor isolado.', '—', 'Necrose miocárdica — EAM, miocardite, TEP, sépsis.'),
  ('10000000-0000-0000-0000-000000000019', 'BNP', 'pg/mL', 0, 100, 'any', 'adult', 'cardíaca', 'Útil para excluir IC se < 100.', '—', 'Insuficiência cardíaca, sobrecarga de volume.'),
  ('10000000-0000-0000-0000-000000000020', 'NT-proBNP', 'pg/mL', 0, 125, 'any', 'adult', 'cardíaca', 'Cutoffs ajustados à idade (300/450/900/1800).', '—', 'IC, doença renal.'),
  ('10000000-0000-0000-0000-000000000021', 'TSH', 'mU/L', 0.4, 4.0, 'any', 'adult', 'tireóide', 'Primeiro a alterar-se em disfunção tireóidea.', 'Hipertiroidismo, terapia supressiva.', 'Hipotiroidismo primário.'),
  ('10000000-0000-0000-0000-000000000022', 'T4 livre', 'ng/dL', 0.8, 1.8, 'any', 'adult', 'tireóide', 'Avalia se TSH alterado.', 'Hipotiroidismo.', 'Hipertiroidismo.'),
  ('10000000-0000-0000-0000-000000000023', 'PCR', 'mg/L', 0, 5, 'any', 'adult', 'inflamação', 'Aguda. Pico 48h.', '—', 'Infeção, doença inflamatória.'),
  ('10000000-0000-0000-0000-000000000024', 'VS', 'mm/h', 0, 20, 'any', 'adult', 'inflamação', 'Inespecífica, lenta.', '—', 'Inflamação crónica, arterite temporal (>50).'),
  ('10000000-0000-0000-0000-000000000025', 'Lipase', 'U/L', 0, 60, 'any', 'adult', 'pancreática', 'Mais específica que amilase. > 3× normal sugere pancreatite.', '—', 'Pancreatite aguda.'),
  ('10000000-0000-0000-0000-000000000026', 'INR', '', 0.8, 1.2, 'any', 'adult', 'coagulação', 'Em varfarina: alvo 2-3 (válvula 2.5-3.5).', '—', 'Anticoagulação excessiva, hepatopatia, défice K.'),
  ('10000000-0000-0000-0000-000000000027', 'aPTT', 's', 25, 35, 'any', 'adult', 'coagulação', 'Avalia via intrínseca.', '—', 'Heparina, hemofilias, AC lúpico.'),
  ('10000000-0000-0000-0000-000000000028', 'D-dímeros', 'µg/mL FEU', 0, 0.5, 'any', 'adult', 'coagulação', 'Sensível mas pouco específico para TEP.', '—', 'TEP, TVP, CID, gravidez.')
on conflict (id) do nothing;

insert into procedure_guides (id, title, category, description, indications, contraindications, materials, steps, warnings, difficulty, duration_min) values
  ('20000000-0000-0000-0000-000000000001',
   'Cateterismo venoso periférico',
   'vascular',
   'Punção venosa para colocação de catéter periférico.',
   ARRAY['Administração de fluidoterapia','Administração de medicação IV','Colheita sanguínea','Transfusão'],
   ARRAY['Infecção local','Fístula AV no membro','Linfedema/mastectomia ipsilateral'],
   ARRAY['Cateter (calibre adequado: 22G azul, 20G rosa, 18G verde)','Compressa','Álcool 70% ou clorexidina','Garrote','Penso','Soro fisiológico'],
   '[
     {"order":1,"title":"Identificação do doente","body":"Verifica nome, data nascimento e procedimento. Explica o procedimento."},
     {"order":2,"title":"Higiene das mãos + EPI","body":"Lava mãos. Coloca luvas não estéreis."},
     {"order":3,"title":"Selecção do local","body":"Procura veia visível/palpável no antebraço, dorso da mão ou prega do cotovelo. Evita articulações se possível."},
     {"order":4,"title":"Garrote","body":"Coloca 5-10cm acima do local. Não apertar excessivamente."},
     {"order":5,"title":"Desinfecção","body":"Limpa com álcool em movimento circular do centro para fora. Deixa secar 30s."},
     {"order":6,"title":"Punção","body":"Estabiliza veia. Punciona com bisel para cima, ângulo 15-30°. Avança catéter sobre agulha quando há refluxo."},
     {"order":7,"title":"Solta garrote + retira agulha","body":"Solta garrote. Pressiona ligeiramente sobre veia e retira agulha. Conecta extensor ou tampa."},
     {"order":8,"title":"Confirmação + fixação","body":"Permeabiliza com 2-5 mL soro. Fixa com penso transparente. Regista data, hora e calibre."}
   ]'::jsonb,
   ARRAY['Vigia sinais de extravasão (edema, eritema, dor)','Substitui cada 72-96h salvo regime contínuo','Em caso de extravasão de medicamento vesicante: parar perfusão, aspirar, não retirar catéter ainda'],
   'easy', 10),

  ('20000000-0000-0000-0000-000000000002',
   'Sondagem nasogástrica',
   'gastrointestinal',
   'Colocação de sonda pelo nariz até estômago.',
   ARRAY['Descompressão gástrica','Alimentação entérica','Lavagem gástrica (não em ingestões cáusticas)','Administração de fármacos'],
   ARRAY['Cirurgia gástrica/esofágica recente','Varizes esofágicas activas','Fracturas faciais/base do crânio','Estenose esofágica grave'],
   ARRAY['Sonda Levin tamanho adequado (12-18 Fr adulto)','Lubrificante hidrossolúvel','Seringa 50 mL','Estetoscópio','Fita adesiva','Copo com água'],
   '[
     {"order":1,"title":"Posicionamento","body":"Posição de Fowler (45-60°). Cabeça em ligeira flexão (queixo ao peito) durante introdução."},
     {"order":2,"title":"Medir comprimento","body":"Da ponta do nariz ao lóbulo da orelha + ao apêndice xifoide. Marca."},
     {"order":3,"title":"Lubrificação","body":"Lubrifica os primeiros 10 cm da sonda."},
     {"order":4,"title":"Introdução","body":"Introduz pela narina (fossa nasal mais permeável). Quando atinge orofaringe pede ao doente para engolir (ou beber água)."},
     {"order":5,"title":"Verificação","body":"NUNCA verifica auscultação isoladamente — falsa segurança. Aspira conteúdo gástrico (pH < 5.5) ou pede Rx tórax-abdómen."},
     {"order":6,"title":"Fixação","body":"Adesivo no nariz em forma de borboleta. Sem tensão."},
     {"order":7,"title":"Registos","body":"Tamanho, comprimento exterior, hora, tolerância, verificação."}
   ]'::jsonb,
   ARRAY['Suspende imediatamente se tosse, dispneia, cianose ou voz alterada — pode estar na via aérea','Não força contra resistência','Verifica posição antes de cada utilização'],
   'medium', 15),

  ('20000000-0000-0000-0000-000000000003',
   'Algaliação vesical (cateterismo)',
   'genitourinário',
   'Introdução de algália na bexiga pela uretra.',
   ARRAY['Retenção urinária aguda','Monitorização de débito urinário em doente crítico','Pré-operatório','Hematúria com coágulos'],
   ARRAY['Trauma uretral suspeito (sangue no meato, hematoma perineal)','Próstata pós-cirurgia recente','Estenose uretral conhecida sem dilatação'],
   ARRAY['Algália adequada (Foley 14-16 Fr)','Saco colector','Seringa 10 mL com água destilada','Lubrificante anestésico','Compressas estéreis','Solução desinfectante','Campo estéril'],
   '[
     {"order":1,"title":"Higiene rigorosa","body":"Lavagem do meato uretral. Técnica estéril obrigatória."},
     {"order":2,"title":"Lubrificação","body":"Introduz lubrificante anestésico (≥ 10 mL no homem) e espera 2-3 min."},
     {"order":3,"title":"Introdução","body":"Mulher: separar grandes lábios, introduzir 5-7 cm. Homem: pénis em 90° e introduzir até bifurcação."},
     {"order":4,"title":"Confirmação","body":"Aguarda saída de urina. Avança mais 2-3 cm antes de insuflar o balão."},
     {"order":5,"title":"Insuflar balão","body":"10 mL água destilada (NÃO ar)."},
     {"order":6,"title":"Tracção suave","body":"Traciona suavemente até resistência. Conecta saco. Fixa na coxa/abdómen."}
   ]'::jsonb,
   ARRAY['Se dor intensa ao insuflar — balão pode estar na uretra. Esvazia e reposiciona','Mantém saco abaixo do nível da bexiga (evita refluxo)','Remoção precoce reduz risco de ITU'],
   'medium', 15),

  ('20000000-0000-0000-0000-000000000004',
   'Aspiração de secreções (traqueostomia/orofaríngea)',
   'respiratorio',
   'Remoção de secreções da via aérea.',
   ARRAY['Secreções audíveis','Dessaturação','Doente incapaz de tossir efectivamente','Mucosidade visível'],
   ARRAY['Coagulopatia grave (relativa)','Broncospasmo agudo','Hipertensão intracraniana descontrolada'],
   ARRAY['Sonda de aspiração (10-14 Fr)','Sistema de aspiração regulado a 80-120 mmHg adulto','Soro fisiológico','Luvas estéreis','Máscara'],
   '[
     {"order":1,"title":"Pré-oxigenação","body":"FiO2 100% durante 30s antes de aspirar (se intubado)."},
     {"order":2,"title":"Técnica estéril","body":"Luva estéril na mão dominante."},
     {"order":3,"title":"Introdução sem sucção","body":"Introduz a sonda sem aspirar até atingir resistência leve ou tosse."},
     {"order":4,"title":"Aspiração","body":"Aspira em movimento rotacional ao retirar — máximo 10-15 segundos."},
     {"order":5,"title":"Reavaliação","body":"Ausculta, observa SpO2. Repete se necessário, com pausas de 30s para reoxigenar."}
   ]'::jsonb,
   ARRAY['Não excede 15s por passagem','Vigia bradicardia, hipóxia, broncospasmo','Aspirar SOS, não por rotina'],
   'easy', 5)
on conflict (id) do nothing;

insert into medical_library (id, title, source, year, domain, summary, body, tags) values
  ('30000000-0000-0000-0000-000000000001', 'IC com FE reduzida — terapêutica',
   'ESC', 2021, 'cardiologia',
   '4 pilares: IECA/ARNI + BB + ARM + iSGLT2 desde diagnóstico, em titulação simultânea.',
   'Início simultâneo dos 4 pilares (sacubitril-valsartan ou IECA, bisoprolol/carvedilol/metoprolol, espironolactona/eplerenona, dapagliflozina/empagliflozina) com titulação a cada 2 semanas conforme tolerado. Adicionar diurético de ansa apenas se congestão. Vericiguat em IC avançada. Avaliar TRC se QRS > 130ms BCRE e CDI conforme FE.',
   ARRAY['IC','IECA','ARNI','SGLT2','espironolactona','beta-bloqueador']),
  ('30000000-0000-0000-0000-000000000002', 'Sépsis — bundle de 1 hora',
   'SCCM', 2021, 'emergencia',
   'Lactato, hemocultura, antibiótico empírico, fluidoterapia 30 mL/kg, vasopressores se TAM < 65.',
   'Sequência: 1) Medir lactato (se > 2, repetir em 2-4h). 2) Colher hemoculturas antes do antibiótico. 3) Antibiótico de largo espectro adequado ao foco em < 1h. 4) Cristalóides 30 mL/kg em hipotensão ou lactato > 4. 5) Noradrenalina se TAM persistir < 65 mmHg após fluidos.',
   ARRAY['sépsis','sepsis','choque','antibiótico','noradrenalina']),
  ('30000000-0000-0000-0000-000000000003', 'AVC isquémico — janela e trombólise',
   'AHA/ASA', 2019, 'neurologia',
   'rt-PA até 4h30 (NIHSS, ASPECTS, sem hemorragia). Trombectomia até 24h se grande artéria.',
   'rt-PA 0.9 mg/kg (máx 90 mg, 10% bólus, restante 60 min) em AVC isquémico < 4h30 sem contra-indicações. Trombectomia mecânica em oclusão de grande vaso (M1, ACI) até 6h por imagem TC, até 24h se mismatch perfusão/core favorável (DAWN/DEFUSE-3). TA < 185/110 antes de rt-PA; < 180/105 nas 24h seguintes.',
   ARRAY['AVC','stroke','trombólise','trombectomia','NIHSS']),
  ('30000000-0000-0000-0000-000000000004', 'DPOC — exacerbação',
   'GOLD', 2024, 'pneumologia',
   'Broncodilatadores SABA + SAMA neb, prednisolona 40mg 5 dias, antibiótico se purulência, VNI se acidose.',
   'Salbutamol + ipratrópio nebulizados 4/4h. Prednisolona 40mg/dia oral 5 dias. Antibiótico (amoxiclav, doxiciclina ou macrólido) se ≥ 2 critérios de Anthonisen (dispneia, volume, purulência). VNI se pH < 7.35 e pCO2 > 45 com falência respiratória. Avaliação fenótipo e pneumologia ambulatório pós-alta.',
   ARRAY['DPOC','COPD','exacerbação','VNI','prednisolona']),
  ('30000000-0000-0000-0000-000000000005', 'Antibioterapia — pneumonia da comunidade',
   'IDSA/ATS', 2019, 'infecciologia',
   'CURB-65 estratifica. Amoxicilina ou amoxiclav + macrólido em internado.',
   'Ambulatório saudável: amoxicilina 1g 8/8h 5 dias. Ambulatório com comorbilidades: amoxiclav 875/125 8/8h + azitromicina 500mg 5 dias. Internado não-UCI: ceftriaxone 1g/dia + azitromicina. UCI: ceftriaxone 2g + azitromicina ou fluoroquinolona respiratória. Cobrir Pseudomonas se factores de risco (DPOC grave, bronquiectasias, AB prévio).',
   ARRAY['pneumonia','PAC','amoxicilina','macrólido','CURB-65']),
  ('30000000-0000-0000-0000-000000000006', 'Anafilaxia — adrenalina IM',
   'WAO', 2020, 'urgencia',
   'Adrenalina IM 1:1000 — 0.5 mg adulto (0.01 mg/kg criança) na coxa, repetir 5-15min se necessário.',
   'Reconhece anafilaxia (pele + cardiovascular OU respiratório). Adrenalina IM 0.3-0.5 mg na coxa antero-lateral, repetir 5-15min. Decúbito dorsal com membros elevados (se sem dispneia). Oxigénio. Fluidos 1-2L cristalóide. Anti-H1 e corticóide são adjuvantes — NÃO substituem adrenalina. Observação 4-12h. Auto-injector na alta.',
   ARRAY['anafilaxia','adrenalina','reacção alérgica'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';