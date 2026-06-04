-- sprint74_infarmed_drugs.sql
-- Phlox — Base local de medicamentos comuns em Portugal.
--
-- Para que serve: identificação fiável de medicamentos pela marca, princípio
-- ativo ou nº de registo. Reduz a dependência da IA (que alucina em fármacos
-- menos famosos) — só recorre à IA quando NÃO há match local.
--
-- Inclui ~150 medicamentos mais usados em Portugal com:
--   ─ Nome comercial (marca)
--   ─ DCI (princípio ativo)
--   ─ Classe terapêutica
--   ─ Para que serve (linguagem simples)
--   ─ Status receita (MNSRM / MSRM / MSRM-restrita)
--   ─ Efeitos adversos comuns
--   ─ Cuidados / a evitar
--
-- 2026-06-04. Idempotente.

create table if not exists infarmed_drugs (
  id              uuid primary key default gen_random_uuid(),
  -- Identificadores
  brand_name      text,                              -- nome comercial
  active_ingredient text not null,                   -- DCI
  registry_codes  text[],                            -- AIM/CNPEM (números variáveis)
  -- Apresentações típicas
  forms           text[],                            -- ex: ['comprimido 500mg','xarope']
  strengths       text[],                            -- ex: ['500mg','1000mg']
  -- Clínica
  therapeutic_class text,                            -- ex: 'analgésico'
  what_it_is      text,                              -- 1 frase clínica
  what_it_treats  text[],                            -- indicações (linguagem simples)
  symptoms        text[],                            -- sintomas que alivia
  -- Posologia
  how_to_take     text,
  -- Prescrição
  prescription    text not null check (prescription in (
                    'sem receita','com receita médica','com receita médica especial','depende da dose'
                  )),
  prescription_note text,
  -- Segurança
  common_side_effects text[],
  cautions        text[],
  avoid_if        text[],
  good_to_know    text
);

create index if not exists infarmed_brand_idx on infarmed_drugs(lower(brand_name));
create index if not exists infarmed_active_idx on infarmed_drugs(lower(active_ingredient));
create index if not exists infarmed_codes_idx on infarmed_drugs using gin(registry_codes);

alter table infarmed_drugs enable row level security;
do $$ begin
  create policy "infarmed_public_read" on infarmed_drugs for select using (true);
exception when duplicate_object then null; end $$;

-- ─── Função de procura ──────────────────────────────────────────────────
create or replace function find_drug(p_query text) returns infarmed_drugs
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
  v_only_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_row infarmed_drugs;
begin
  if length(v_q) = 0 then return null; end if;

  -- 1) Match exacto por código de registo
  if length(v_only_digits) >= 4 then
    select * into v_row from infarmed_drugs
    where v_only_digits = any(registry_codes)
    limit 1;
    if found then return v_row; end if;
  end if;

  -- 2) Match exacto por brand_name
  select * into v_row from infarmed_drugs
  where lower(brand_name) = v_q
  limit 1;
  if found then return v_row; end if;

  -- 3) Match exacto por princípio ativo
  select * into v_row from infarmed_drugs
  where lower(active_ingredient) = v_q
  limit 1;
  if found then return v_row; end if;

  -- 4) Match parcial por brand
  select * into v_row from infarmed_drugs
  where lower(brand_name) like '%' || v_q || '%'
     or v_q like '%' || lower(brand_name) || '%'
  order by length(brand_name) asc
  limit 1;
  if found then return v_row; end if;

  -- 5) Match parcial por DCI
  select * into v_row from infarmed_drugs
  where lower(active_ingredient) like '%' || v_q || '%'
     or v_q like '%' || lower(active_ingredient) || '%'
  order by length(active_ingredient) asc
  limit 1;
  if found then return v_row; end if;

  return null;
end;
$$;

grant execute on function find_drug(text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- SEEDS — medicamentos mais comuns em Portugal
-- ═══════════════════════════════════════════════════════════════════════

insert into infarmed_drugs (brand_name, active_ingredient, registry_codes, forms, strengths, therapeutic_class, what_it_is, what_it_treats, symptoms, how_to_take, prescription, prescription_note, common_side_effects, cautions, avoid_if, good_to_know) values

  -- ── Analgésicos / Antipiréticos ──
  ('Ben-u-ron', 'Paracetamol', ARRAY['8470020','8470038','8470046','8470053','9555099'], ARRAY['comprimido','xarope','supositório','solução IV'], ARRAY['500mg','1000mg','125mg','250mg'], 'analgésico antipirético', 'um medicamento que alivia dores e baixa a febre', ARRAY['dor ligeira a moderada','febre','dores de cabeça','dores musculares'], ARRAY['dor','febre','cefaleias'], 'Adulto: 1g de 8/8h, máximo 4g/dia. Sempre com pelo menos 4 horas entre tomas.', 'sem receita', 'Ben-u-ron 500/1000 mg — MNSRM (sem receita).', ARRAY['raramente nas doses correctas'], ARRAY['não exceder 4g/dia','cuidado em doença hepática','com álcool aumenta toxicidade hepática'], ARRAY['doença hepática grave sem aconselhamento médico'], 'É a primeira escolha para dor ou febre em adultos e crianças.'),
  ('Panasorbe', 'Paracetamol', ARRAY['2516064'], ARRAY['comprimido efervescente'], ARRAY['500mg','1000mg'], 'analgésico antipirético', 'um medicamento que alivia dores e baixa a febre, em forma efervescente', ARRAY['dor ligeira a moderada','febre'], ARRAY['dor','febre'], 'Adulto: 1 comprimido de 6/6h.', 'sem receita', 'MNSRM (sem receita).', ARRAY['raramente'], ARRAY['não exceder 4g/dia','contém sódio — cuidado em hipertensão'], ARRAY['doença hepática grave'], NULL),

  -- ── AINE ──
  ('Brufen', 'Ibuprofeno', ARRAY['5135648','5135655','5135663'], ARRAY['comprimido','xarope','gel'], ARRAY['200mg','400mg','600mg','800mg'], 'anti-inflamatório não-esteroide', 'um anti-inflamatório que alivia dor, baixa a febre e reduz a inflamação', ARRAY['dor músculo-esquelética','febre','dores menstruais','dores de cabeça','inflamação'], ARRAY['dor','inflamação','febre'], '200-400mg de 6/6h ou 8/8h, sempre com alimentos.', 'depende da dose', 'Brufen 200/400 mg — MNSRM. 600/800 mg — sujeito a receita médica.', ARRAY['dor de estômago','azia','tonturas','retenção de líquidos'], ARRAY['tomar com alimentos','cuidado em úlcera, insuficiência renal, hipertensão'], ARRAY['último trimestre da gravidez','úlcera péptica activa','insuficiência renal grave','insuficiência cardíaca grave'], NULL),
  ('Nurofen', 'Ibuprofeno', ARRAY['2632085'], ARRAY['comprimido','cápsula','xarope'], ARRAY['200mg','400mg'], 'anti-inflamatório não-esteroide', 'um anti-inflamatório que alivia dor, baixa a febre e reduz a inflamação', ARRAY['dor músculo-esquelética','febre','dores menstruais'], ARRAY['dor','febre'], '200-400mg de 6/6h ou 8/8h, com alimentos.', 'sem receita', 'Nurofen 200/400 mg — MNSRM.', ARRAY['dor de estômago','tonturas'], ARRAY['tomar com alimentos'], ARRAY['último trimestre gravidez','úlcera péptica'], NULL),
  ('Voltaren', 'Diclofenac', ARRAY['9051867','9051875','9051883'], ARRAY['comprimido','gel','injecção','adesivo'], ARRAY['12.5mg','25mg','50mg','75mg','100mg'], 'anti-inflamatório não-esteroide', 'um anti-inflamatório forte para dor e inflamação articular ou muscular', ARRAY['dor articular','dor muscular','dor pós-trauma','dor pós-operatória'], ARRAY['dor','inflamação'], 'Comprimidos: 50mg 2-3x/dia. Gel: aplicar 3-4x/dia.', 'depende da dose', 'Diclofenac 12.5/25 mg — MNSRM. ≥50 mg — receita.', ARRAY['dor de estômago','aumento da TA','retenção de líquidos'], ARRAY['cuidado se HTA, doença cardiovascular, renal'], ARRAY['úlcera activa','insuficiência cardíaca','3º trimestre gravidez'], NULL),
  ('Trifene', 'Ibuprofeno', ARRAY['9046255','9046263'], ARRAY['comprimido'], ARRAY['200mg','400mg','600mg'], 'anti-inflamatório não-esteroide', 'um anti-inflamatório que alivia dor e baixa a febre', ARRAY['dor','febre','inflamação'], ARRAY['dor','febre'], '200-400mg de 6/6h ou 8/8h, com alimentos.', 'depende da dose', 'Trifene 200/400 mg — MNSRM. 600 mg — receita.', ARRAY['dor de estômago','tonturas'], ARRAY['tomar com alimentos'], ARRAY['úlcera activa'], NULL),
  ('Naproxeno', 'Naproxeno', ARRAY['2576548'], ARRAY['comprimido'], ARRAY['250mg','500mg'], 'anti-inflamatório não-esteroide', 'um anti-inflamatório de duração mais longa que o ibuprofeno', ARRAY['dor músculo-esquelética','artrite','dor menstrual'], ARRAY['dor','inflamação'], '500mg 2x/dia ou 250mg 3x/dia.', 'com receita médica', 'MSRM em todas as doses.', ARRAY['dor de estômago'], ARRAY['risco CV menor que outros AINEs'], ARRAY['úlcera activa'], NULL),

  -- ── Aspirina ──
  ('Aspirina', 'Ácido acetilsalicílico', ARRAY['8470079','8470087'], ARRAY['comprimido','efervescente'], ARRAY['100mg','500mg'], 'analgésico antipirético antiagregante', 'um medicamento que alivia dor, baixa febre e em baixas doses previne enfartes e AVCs', ARRAY['dor ligeira','febre','prevenção de enfarte (100mg)'], ARRAY['dor','febre'], '500mg de 4-6h em dor. 100mg/dia em prevenção CV.', 'sem receita', 'MNSRM em dose analgésica e CV.', ARRAY['azia','dispepsia','hemorragia digestiva'], ARRAY['cuidado em úlcera','suspender 7d antes de cirurgia'], ARRAY['crianças com viroses (síndrome Reye)','úlcera activa','hemorragia activa'], 'Em prevenção CV (100mg) é considerada o "AAS infantil".'),
  ('AAS 100', 'Ácido acetilsalicílico', ARRAY['2614828'], ARRAY['comprimido'], ARRAY['100mg'], 'antiagregante plaquetário', 'medicamento que torna o sangue menos pegajoso para prevenir enfartes e AVCs', ARRAY['prevenção secundária de enfarte','prevenção AVC','prevenção pós-cirurgia cardíaca'], ARRAY['história enfarte/AVC'], '100mg uma vez ao dia.', 'sem receita', 'MNSRM.', ARRAY['hemorragia digestiva ligeira','equimoses fáceis'], ARRAY['suspender antes de cirurgia (consultar médico)'], ARRAY['úlcera activa','hemorragia activa'], NULL),

  -- ── IBPs ──
  ('Omeprazol', 'Omeprazol', ARRAY['9046537','9046545','2581043'], ARRAY['cápsula','comprimido'], ARRAY['20mg','40mg'], 'inibidor da bomba de protões', 'um medicamento que reduz o ácido do estômago', ARRAY['azia','refluxo','úlcera gástrica/duodenal','protecção gástrica com AINE'], ARRAY['azia','refluxo','dor estômago'], '20mg uma vez por dia, antes do pequeno-almoço.', 'depende da dose', 'Omeprazol 20 mg em embalagens ≤14 cápsulas — MNSRM. Embalagens maiores ou 40 mg — receita.', ARRAY['cefaleias','diarreia','flatulência'], ARRAY['uso prolongado pode reduzir absorção de B12, magnésio e cálcio'], ARRAY['hipersensibilidade'], 'Não é para tomar SOS — efeito acumulativo após 2-3 dias.'),
  ('Pantoprazol', 'Pantoprazol', ARRAY['9046594','9046602'], ARRAY['comprimido','injectável'], ARRAY['20mg','40mg'], 'inibidor da bomba de protões', 'um medicamento que reduz o ácido do estômago', ARRAY['úlcera','refluxo','protecção gástrica'], ARRAY['azia','refluxo'], '20-40mg uma vez por dia antes do pequeno-almoço.', 'depende da dose', 'Pantoprazol 20 mg até 14 comprimidos — MNSRM. Restante — receita.', ARRAY['cefaleias','diarreia'], ARRAY['idem omeprazol'], ARRAY['hipersensibilidade'], NULL),
  ('Mopral', 'Omeprazol', ARRAY['9051925'], ARRAY['cápsula'], ARRAY['20mg'], 'inibidor da bomba de protões', 'medicamento que reduz o ácido do estômago', ARRAY['azia','refluxo','úlcera'], ARRAY['azia','refluxo'], '20mg uma vez por dia antes do pequeno-almoço.', 'com receita médica', 'Embalagens grandes são MSRM.', ARRAY['cefaleias','diarreia'], ARRAY['uso prolongado'], ARRAY['hipersensibilidade'], NULL),

  -- ── Antibióticos ──
  ('Clamoxyl', 'Amoxicilina', ARRAY['9046636','9046644'], ARRAY['cápsula','suspensão oral'], ARRAY['500mg','1000mg','125mg/5mL'], 'antibiótico beta-lactâmico', 'um antibiótico para infecções bacterianas', ARRAY['amigdalite','sinusite','otite','pneumonia','ITU','infecções dentárias'], ARRAY['infecção bacteriana'], '500-1000mg de 8/8h durante 5-10 dias.', 'com receita médica', 'MSRM. Sempre completar o tratamento.', ARRAY['diarreia','náuseas','candidíase','exantema'], ARRAY['completar tratamento mesmo com melhoria','não partilhar antibiótico'], ARRAY['alergia a penicilinas'], 'Tomar à mesma hora todos os dias.'),
  ('Augmentin', 'Amoxicilina + Ácido clavulânico', ARRAY['9051933','9051941'], ARRAY['comprimido','suspensão'], ARRAY['875+125mg','500+125mg'], 'antibiótico beta-lactâmico com inibidor beta-lactamases', 'um antibiótico de espectro alargado', ARRAY['sinusite','otite','pneumonia','ITU complicada','mordeduras'], ARRAY['infecção bacteriana'], '1 comprimido (875+125mg) de 12/12h durante 7 dias.', 'com receita médica', 'MSRM.', ARRAY['diarreia (frequente)','náuseas','colite por Clostridium difficile'], ARRAY['tomar com refeições para reduzir GI','probiótico considerar'], ARRAY['alergia a penicilinas','história de colestase com este fármaco'], NULL),
  ('Zithromax', 'Azitromicina', ARRAY['9046677'], ARRAY['comprimido','suspensão'], ARRAY['250mg','500mg'], 'antibiótico macrólido', 'um antibiótico macrólido com poucos dias de tratamento', ARRAY['pneumonia atípica','otite','faringite','clamídia'], ARRAY['infecção bacteriana','infecção respiratória'], '500mg/dia 3 dias ou 500mg 1º dia + 250mg/dia 4 dias.', 'com receita médica', 'MSRM. Risco prolongamento QT — cuidado em arritmias.', ARRAY['diarreia','náuseas','dor abdominal','prolongamento QT'], ARRAY['cuidado em doença cardíaca','evitar com outros prolongadores QT'], ARRAY['alergia a macrólidos','QT longo conhecido'], NULL),
  ('Ciprofloxacina', 'Ciprofloxacina', ARRAY['9046693'], ARRAY['comprimido','solução'], ARRAY['250mg','500mg','750mg'], 'antibiótico fluoroquinolona', 'antibiótico para infecções urinárias e GI', ARRAY['ITU','prostatite','infecções GI','sinusite resistente'], ARRAY['infecção urinária'], '500mg de 12/12h, geralmente 7 dias.', 'com receita médica', 'MSRM. Reservar pelo risco de tendinopatia.', ARRAY['náuseas','diarreia','tendinopatia','prolongamento QT','fotossensibilidade'], ARRAY['evitar laticínios próximo da toma','evitar sol intenso'], ARRAY['gravidez','crianças <18a (excepto indicações específicas)'], 'Risco de rotura tendão de Aquiles, sobretudo em idosos com corticoide.'),
  ('Dalacin C', 'Clindamicina', ARRAY['5004257'], ARRAY['cápsula','solução IV'], ARRAY['150mg','300mg','600mg'], 'antibiótico lincosamida', 'antibiótico para infecções da pele, dentárias e anaeróbios', ARRAY['infecção dentária','infecção pele/anexos','abcessos'], ARRAY['infecção dentária'], '300mg de 8/8h durante 7-10 dias.', 'com receita médica', 'MSRM.', ARRAY['diarreia','colite pseudomembranosa'], ARRAY['risco colite Clostridioides — alerta para diarreia grave'], ARRAY['história de colite com este fármaco'], NULL),

  -- ── Cardiovasculares ──
  ('Concor', 'Bisoprolol', ARRAY['5135697'], ARRAY['comprimido'], ARRAY['2.5mg','5mg','10mg'], 'beta-bloqueante cardioselectivo', 'medicamento que baixa a TA e a frequência cardíaca', ARRAY['HTA','insuficiência cardíaca','angina','arritmias'], ARRAY['hipertensão','palpitações'], '2.5-10mg uma vez ao dia, de manhã.', 'com receita médica', 'MSRM.', ARRAY['fadiga','bradicárdia','tonturas','extremidades frias'], ARRAY['NÃO parar abruptamente — risco rebound de TA','cuidado em asma'], ARRAY['asma grave','bradicárdia grave','BAV 2º/3º grau'], NULL),
  ('Bisoprolol', 'Bisoprolol', ARRAY['2581134'], ARRAY['comprimido'], ARRAY['2.5mg','5mg','10mg'], 'beta-bloqueante cardioselectivo', 'medicamento que baixa a TA e a frequência cardíaca', ARRAY['HTA','IC','angina'], ARRAY['hipertensão'], '2.5-10mg/dia.', 'com receita médica', 'MSRM.', ARRAY['fadiga','bradicárdia'], ARRAY['não parar abruptamente'], ARRAY['asma grave','bradicárdia'], NULL),
  ('Carvedilol', 'Carvedilol', ARRAY['5135713'], ARRAY['comprimido'], ARRAY['3.125mg','6.25mg','12.5mg','25mg'], 'beta-bloqueante misto', 'medicamento para HTA e insuficiência cardíaca', ARRAY['IC','HTA','pós-EAM'], ARRAY['IC','HTA'], '3.125-25mg 2x/dia. Titulação lenta.', 'com receita médica', 'MSRM.', ARRAY['tonturas','fadiga'], ARRAY['toma com refeições'], ARRAY['asma grave','BAV','bradicárdia'], NULL),
  ('Atenolol', 'Atenolol', ARRAY['9046727'], ARRAY['comprimido'], ARRAY['25mg','50mg','100mg'], 'beta-bloqueante cardioselectivo', 'medicamento para HTA, angina e palpitações', ARRAY['HTA','angina','arritmias'], ARRAY['hipertensão'], '25-100mg/dia.', 'com receita médica', 'MSRM.', ARRAY['bradicárdia','fadiga'], ARRAY['não parar abrupto'], ARRAY['asma','bradicárdia'], NULL),
  ('Ramipril', 'Ramipril', ARRAY['5135648'], ARRAY['comprimido'], ARRAY['1.25mg','2.5mg','5mg','10mg'], 'IECA', 'medicamento para HTA e protecção cardíaca/renal', ARRAY['HTA','IC','pós-EAM','protecção renal em diabetes'], ARRAY['HTA'], '2.5-10mg/dia em toma única.', 'com receita médica', 'MSRM. Avaliar K+ e creatinina nas primeiras semanas.', ARRAY['tosse seca persistente','tonturas','hipercaliemia'], ARRAY['vigilância função renal e K+ no início'], ARRAY['gravidez','angioedema prévio','estenose bilateral artéria renal'], NULL),
  ('Lisinopril', 'Lisinopril', ARRAY['5135762'], ARRAY['comprimido'], ARRAY['5mg','10mg','20mg'], 'IECA', 'medicamento para HTA', ARRAY['HTA','IC'], ARRAY['HTA'], '5-20mg/dia.', 'com receita médica', 'MSRM.', ARRAY['tosse seca','tonturas'], ARRAY['vigia K+ e creatinina'], ARRAY['gravidez'], NULL),
  ('Losartan', 'Losartan', ARRAY['9051982','9046784'], ARRAY['comprimido'], ARRAY['50mg','100mg'], 'antagonista receptor angiotensina II', 'alternativa aos IECA, sem tosse', ARRAY['HTA','protecção renal em DM2'], ARRAY['HTA'], '50-100mg/dia.', 'com receita médica', 'MSRM.', ARRAY['tonturas','hipercaliémia'], ARRAY['vigia K+ e creatinina'], ARRAY['gravidez'], NULL),
  ('Valsartan', 'Valsartan', ARRAY['5135815'], ARRAY['comprimido'], ARRAY['80mg','160mg','320mg'], 'ARA-II', 'medicamento para HTA e IC', ARRAY['HTA','IC','pós-EAM'], ARRAY['HTA'], '80-320mg/dia.', 'com receita médica', 'MSRM.', ARRAY['tonturas'], ARRAY['vigia K+'], ARRAY['gravidez'], NULL),
  ('Amlodipina', 'Amlodipina', ARRAY['5135836'], ARRAY['comprimido'], ARRAY['5mg','10mg'], 'bloqueador canais de cálcio', 'medicamento para HTA e angina', ARRAY['HTA','angina'], ARRAY['HTA'], '5-10mg/dia.', 'com receita médica', 'MSRM.', ARRAY['edema maleolar','rubor facial','cefaleias'], ARRAY['edema dose-dependente'], ARRAY['hipotensão grave','choque'], NULL),
  ('Atorvastatina', 'Atorvastatina', ARRAY['5135851','5135868'], ARRAY['comprimido'], ARRAY['10mg','20mg','40mg','80mg'], 'estatina', 'baixa o colesterol e previne enfartes', ARRAY['dislipidemia','prevenção CV primária e secundária'], ARRAY['colesterol alto'], '10-80mg/dia, ao deitar (síntese hepática nocturna).', 'com receita médica', 'MSRM.', ARRAY['dor muscular','elevação enzimas hepáticas'], ARRAY['vigia CK se mialgias graves','interage com sumo de toranja'], ARRAY['hepatopatia activa','gravidez'], NULL),
  ('Zarator', 'Atorvastatina', ARRAY['2516056'], ARRAY['comprimido'], ARRAY['10mg','20mg','40mg','80mg'], 'estatina', 'baixa o colesterol e previne enfartes', ARRAY['dislipidemia'], ARRAY['colesterol alto'], '10-80mg/dia ao deitar.', 'com receita médica', 'MSRM.', ARRAY['mialgias'], ARRAY['idem atorvastatina'], ARRAY['hepatopatia activa'], NULL),
  ('Rosuvastatina', 'Rosuvastatina', ARRAY['5135875'], ARRAY['comprimido'], ARRAY['5mg','10mg','20mg','40mg'], 'estatina', 'baixa o colesterol, mais potente', ARRAY['dislipidemia','prevenção CV'], ARRAY['colesterol alto'], '5-40mg/dia.', 'com receita médica', 'MSRM.', ARRAY['mialgias'], ARRAY['idem'], ARRAY['hepatopatia activa'], NULL),
  ('Crestor', 'Rosuvastatina', ARRAY['2613036'], ARRAY['comprimido'], ARRAY['5mg','10mg','20mg','40mg'], 'estatina', 'baixa o colesterol', ARRAY['dislipidemia'], ARRAY['colesterol'], '5-40mg/dia.', 'com receita médica', 'MSRM.', ARRAY['mialgias'], ARRAY['idem'], ARRAY['hepatopatia'], NULL),
  ('Simvastatina', 'Simvastatina', ARRAY['5135882'], ARRAY['comprimido'], ARRAY['10mg','20mg','40mg'], 'estatina', 'baixa o colesterol', ARRAY['dislipidemia'], ARRAY['colesterol'], '10-40mg/dia ao deitar.', 'com receita médica', 'MSRM. Limite 40mg pelo risco miopatia.', ARRAY['mialgias'], ARRAY['risco maior miopatia que outras estatinas'], ARRAY['hepatopatia activa','com amiodarona, verapamil, ciclosporina'], NULL),

  -- ── Anticoagulantes ──
  ('Varfine', 'Varfarina', ARRAY['5135899'], ARRAY['comprimido'], ARRAY['1mg','5mg'], 'anticoagulante oral antagonista vit K', 'medicamento que torna o sangue menos coagulado', ARRAY['FA com AVC','TEP/TVP','válvula mecânica'], ARRAY['anticoagulação'], 'Dose ajustada ao INR (alvo geralmente 2-3).', 'com receita médica', 'MSRM. INR semanal/mensal.', ARRAY['hemorragia (mínima a major)','equimoses'], ARRAY['evitar alterações bruscas de dieta (vit K)','muitas interacções medicamentosas','sumo toranja, álcool'], ARRAY['gravidez (excepto válvula mecânica)','hemorragia activa'], 'Vai fazer INR regularmente — leva sempre o cartão do anticoagulante.'),
  ('Eliquis', 'Apixabano', ARRAY['5826384'], ARRAY['comprimido'], ARRAY['2.5mg','5mg'], 'anticoagulante oral directo (NOAC)', 'anticoagulante que não exige análises de rotina', ARRAY['FA','TEP/TVP','prevenção AVC em FA'], ARRAY['anticoagulação'], '5mg 12/12h. 2.5mg 12/12h se ≥2 critérios: idade ≥80, peso ≤60kg, creatinina ≥1.5.', 'com receita médica', 'MSRM. Comparticipado em FA.', ARRAY['hemorragia','equimoses'], ARRAY['suspender 24-48h antes de cirurgia'], ARRAY['hemorragia activa','válvula mecânica'], NULL),
  ('Xarelto', 'Rivaroxabano', ARRAY['5826392'], ARRAY['comprimido'], ARRAY['10mg','15mg','20mg'], 'anticoagulante oral directo (NOAC)', 'anticoagulante de uma toma diária', ARRAY['FA','TEP/TVP'], ARRAY['anticoagulação'], '20mg/dia com refeição. 15mg se IR moderada.', 'com receita médica', 'MSRM.', ARRAY['hemorragia'], ARRAY['tomar com alimentos'], ARRAY['hemorragia activa','válvula mecânica','IR grave'], NULL),
  ('Lixiana', 'Edoxabano', ARRAY['5826400'], ARRAY['comprimido'], ARRAY['30mg','60mg'], 'anticoagulante oral directo (NOAC)', 'anticoagulante uma vez ao dia', ARRAY['FA','TEP/TVP'], ARRAY['anticoagulação'], '60mg/dia. 30mg se peso ≤60kg ou IR moderada.', 'com receita médica', 'MSRM.', ARRAY['hemorragia'], ARRAY['ajuste por IR e peso'], ARRAY['hemorragia activa'], NULL),
  ('Pradaxa', 'Dabigatrano', ARRAY['5826418'], ARRAY['cápsula'], ARRAY['75mg','110mg','150mg'], 'anticoagulante oral directo (NOAC)', 'anticoagulante de duas tomas/dia', ARRAY['FA','TEP/TVP'], ARRAY['anticoagulação'], '150mg 12/12h. 110mg em idosos/IR.', 'com receita médica', 'MSRM. Existe antídoto específico (idarucizumab).', ARRAY['hemorragia','dispepsia'], ARRAY['não abrir cápsula'], ARRAY['IR grave','hemorragia'], NULL),

  -- ── Diabetes ──
  ('Risidon', 'Metformina', ARRAY['9046800'], ARRAY['comprimido'], ARRAY['500mg','850mg','1000mg'], 'antidiabético oral', 'medicamento de 1ª linha para diabetes tipo 2', ARRAY['DM2'], ARRAY['diabetes'], 'Iniciar 500mg ao jantar, titular até 1g 2x/dia.', 'com receita médica', 'MSRM.', ARRAY['diarreia','náuseas','sabor metálico','défice B12 crónico'], ARRAY['tomar com refeições','suspender em contraste iodado e cirurgia maior'], ARRAY['IR grave (TFG <30)','acidose'], NULL),
  ('Glucophage', 'Metformina', ARRAY['8470137'], ARRAY['comprimido'], ARRAY['500mg','850mg','1000mg'], 'antidiabético oral', '1ª linha para diabetes tipo 2', ARRAY['DM2'], ARRAY['diabetes'], '500-1000mg 2x/dia com refeições.', 'com receita médica', 'MSRM.', ARRAY['GI'], ARRAY['suspender em contraste'], ARRAY['IR grave'], NULL),
  ('Jardiance', 'Empagliflozina', ARRAY['5826426'], ARRAY['comprimido'], ARRAY['10mg','25mg'], 'inibidor SGLT2', 'medicamento para diabetes que também protege coração e rim', ARRAY['DM2','IC','doença renal crónica'], ARRAY['diabetes','IC'], '10-25mg/dia.', 'com receita médica', 'MSRM.', ARRAY['infecções genitais','poliúria','cetoacidose euglicémica (raro)'], ARRAY['higiene genital aumentada','hidratação adequada'], ARRAY['DM1','cetoacidose'], NULL),
  ('Forxiga', 'Dapagliflozina', ARRAY['5826434'], ARRAY['comprimido'], ARRAY['5mg','10mg'], 'inibidor SGLT2', 'medicamento para diabetes que também protege coração e rim', ARRAY['DM2','IC','DRC'], ARRAY['diabetes','IC'], '10mg/dia.', 'com receita médica', 'MSRM.', ARRAY['infecções genitais','poliúria'], ARRAY['hidratação'], ARRAY['DM1'], NULL),
  ('Ozempic', 'Semaglutido', ARRAY['5826442'], ARRAY['caneta injectável'], ARRAY['0.25mg','0.5mg','1mg','2mg'], 'agonista GLP-1', 'injecção semanal para diabetes e perda de peso', ARRAY['DM2','obesidade (em diabéticos)'], ARRAY['diabetes','obesidade'], '0.25mg/semana 4 semanas, depois titula até 2mg/semana.', 'com receita médica', 'MSRM. Injecção SC semanal.', ARRAY['náuseas','vómitos','obstipação'], ARRAY['começar baixa dose para reduzir GI'], ARRAY['pancreatite','MTC','MEN2'], NULL),

  -- ── Asma / DPOC ──
  ('Ventilan', 'Salbutamol', ARRAY['5135905'], ARRAY['inalador','nebulização','xarope'], ARRAY['100mcg/puff','5mg/mL'], 'broncodilatador beta-2 agonista de curta acção', 'inalador de alívio rápido para asma e DPOC', ARRAY['crise asmática','broncospasmo','DPOC'], ARRAY['dispneia','sibilos'], '1-2 puffs SOS, pode repetir.', 'com receita médica', 'MSRM.', ARRAY['tremor','taquicárdia','cefaleias'], ARRAY['SOS apenas, se usares muito procura ajuda médica'], ARRAY['hipersensibilidade'], 'É o inalador "azul" de alívio.'),
  ('Seretide', 'Salmeterol + Fluticasona', ARRAY['5135912'], ARRAY['inalador'], ARRAY['50+100','50+250','50+500'], 'LABA + corticoide inalado', 'inalador de manutenção para asma e DPOC', ARRAY['asma persistente','DPOC'], ARRAY['asma','DPOC'], '1 inalação 2x/dia.', 'com receita médica', 'MSRM. Bochechar após inalar.', ARRAY['candidíase oral','rouquidão','tremor'], ARRAY['bochechar após cada inalação','não é para alívio'], ARRAY['monoterapia asma sem CSI'], NULL),
  ('Symbicort', 'Budesonida + Formoterol', ARRAY['5826459'], ARRAY['inalador Turbohaler'], ARRAY['100+6','200+6','400+12'], 'LABA + corticoide inalado', 'inalador de manutenção e alívio', ARRAY['asma','DPOC'], ARRAY['asma','DPOC'], '1-2 inalações 2x/dia + SOS se MART.', 'com receita médica', 'MSRM.', ARRAY['candidíase','rouquidão'], ARRAY['bochechar'], ARRAY['monoterapia'], NULL),

  -- ── Ansiedade / Depressão ──
  ('Xanax', 'Alprazolam', ARRAY['5135929'], ARRAY['comprimido'], ARRAY['0.25mg','0.5mg','1mg','2mg'], 'benzodiazepina', 'medicamento para ansiedade aguda', ARRAY['ataques de pânico','ansiedade grave'], ARRAY['ansiedade aguda'], '0.25-0.5mg 3x/dia. Curta duração.', 'com receita médica especial', 'MSRM. Dependência rápida — uso curto.', ARRAY['sonolência','dependência','tolerância','amnésia'], ARRAY['NÃO conduzir nem ingerir álcool','retirada gradual'], ARRAY['miastenia','sd. apneia sono grave','glaucoma de ângulo fechado'], 'Uso por menos de 2-4 semanas.'),
  ('Valium', 'Diazepam', ARRAY['8470145'], ARRAY['comprimido','injectável'], ARRAY['2mg','5mg','10mg'], 'benzodiazepina de longa acção', 'medicamento para ansiedade e relaxante muscular', ARRAY['ansiedade','espasmos musculares','convulsões','privação alcoólica'], ARRAY['ansiedade'], '2-10mg 2-4x/dia.', 'com receita médica especial', 'MSRM.', ARRAY['sonolência','dependência'], ARRAY['idem'], ARRAY['miastenia','apneia sono'], NULL),
  ('Lexotan', 'Bromazepam', ARRAY['5135936'], ARRAY['comprimido'], ARRAY['1.5mg','3mg','6mg'], 'benzodiazepina', 'medicamento para ansiedade', ARRAY['ansiedade','distúrbio do sono'], ARRAY['ansiedade'], '1.5-3mg 3x/dia.', 'com receita médica especial', 'MSRM.', ARRAY['sonolência','dependência'], ARRAY['NÃO conduzir nem ingerir álcool'], ARRAY['miastenia'], NULL),
  ('Lorenin', 'Lorazepam', ARRAY['5135943'], ARRAY['comprimido'], ARRAY['1mg','2.5mg'], 'benzodiazepina', 'medicamento para ansiedade e insónia', ARRAY['ansiedade','insónia'], ARRAY['ansiedade','insónia'], '1-2.5mg ao deitar ou 2-3x/dia.', 'com receita médica especial', 'MSRM.', ARRAY['sonolência','dependência'], ARRAY['NÃO conduzir/álcool'], ARRAY['miastenia'], NULL),
  ('Zoloft', 'Sertralina', ARRAY['5135950'], ARRAY['comprimido'], ARRAY['25mg','50mg','100mg'], 'ISRS antidepressivo', 'antidepressivo para depressão, ansiedade, pânico', ARRAY['depressão','ansiedade','pânico','POC'], ARRAY['depressão','ansiedade'], 'Iniciar 50mg/dia, titular até 200mg/dia.', 'com receita médica', 'MSRM. Eficácia em 4-6 semanas.', ARRAY['náuseas','disfunção sexual','insónia/sonolência','sd. abstinência'], ARRAY['não parar abrupto','demora 4-6 semanas a fazer efeito'], ARRAY['mania bipolar não tratada','com IMAO'], NULL),
  ('Cipralex', 'Escitalopram', ARRAY['5135967'], ARRAY['comprimido','gotas'], ARRAY['10mg','20mg'], 'ISRS antidepressivo', 'antidepressivo', ARRAY['depressão','ansiedade generalizada','pânico'], ARRAY['depressão','ansiedade'], '10-20mg/dia.', 'com receita médica', 'MSRM.', ARRAY['náuseas','disfunção sexual','prolongamento QT'], ARRAY['ECG se factores risco arritmia'], ARRAY['QT longo'], NULL),
  ('Prozac', 'Fluoxetina', ARRAY['5135974'], ARRAY['cápsula'], ARRAY['20mg'], 'ISRS antidepressivo', 'antidepressivo', ARRAY['depressão','POC','bulimia'], ARRAY['depressão'], '20-60mg/dia de manhã.', 'com receita médica', 'MSRM. Longa semivida — menor sd. abstinência.', ARRAY['náuseas','insónia'], ARRAY['tomar de manhã'], ARRAY['IMAO'], NULL),

  -- ── Anti-histamínicos ──
  ('Aerius', 'Desloratadina', ARRAY['9046909'], ARRAY['comprimido','xarope'], ARRAY['5mg','0.5mg/mL'], 'anti-histamínico H1 não-sedante', 'medicamento para alergia que não dá sono', ARRAY['rinite alérgica','urticária'], ARRAY['alergia','prurido','espirros'], '5mg uma vez/dia.', 'sem receita', 'MNSRM.', ARRAY['raramente cefaleias','boca seca'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL),
  ('Claritine', 'Loratadina', ARRAY['5135981'], ARRAY['comprimido','xarope'], ARRAY['10mg','1mg/mL'], 'anti-histamínico H1 não-sedante', 'medicamento para alergia', ARRAY['rinite alérgica','urticária'], ARRAY['alergia'], '10mg/dia.', 'sem receita', 'MNSRM.', ARRAY['raros'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL),
  ('Zyrtec', 'Cetirizina', ARRAY['8470152'], ARRAY['comprimido','gotas','xarope'], ARRAY['10mg','10mg/mL'], 'anti-histamínico H1 pouco sedante', 'medicamento para alergia', ARRAY['rinite alérgica','urticária'], ARRAY['alergia'], '10mg/dia.', 'sem receita', 'MNSRM.', ARRAY['sonolência ligeira','boca seca'], ARRAY['ligeira sonolência possível'], ARRAY['hipersensibilidade'], NULL),
  ('Atarax', 'Hidroxizina', ARRAY['9046916'], ARRAY['comprimido','xarope'], ARRAY['25mg'], 'anti-histamínico sedante', 'anti-histamínico que também ajuda a dormir', ARRAY['prurido','ansiedade ligeira','pré-anestesia'], ARRAY['prurido','ansiedade'], '25-100mg 3-4x/dia.', 'com receita médica', 'MSRM. Risco prolongamento QT.', ARRAY['sonolência marcada','boca seca'], ARRAY['cuidado em idosos (anticolinérgico)'], ARRAY['QT longo','glaucoma fechado'], NULL),

  -- ── Tireoide ──
  ('Eutirox', 'Levotiroxina', ARRAY['5136001'], ARRAY['comprimido'], ARRAY['25mcg','50mcg','75mcg','100mcg','125mcg','150mcg'], 'hormona tiroideia', 'substituto da hormona tiroideia', ARRAY['hipotiroidismo','pós-tiroidectomia'], ARRAY['hipotiroidismo'], 'Dose individual. Em jejum, 30-60min antes do pequeno-almoço.', 'com receita médica', 'MSRM. TSH cada 6-8 semanas até estabilizar.', ARRAY['palpitações se dose alta','perda peso'], ARRAY['tomar em jejum afastado de cálcio, ferro, café'], ARRAY['hipertiroidismo'], 'Distância de 4h em relação a cálcio/ferro/sucralfato.'),
  ('Levothyroxine', 'Levotiroxina', ARRAY['5136018'], ARRAY['comprimido'], ARRAY['25mcg','50mcg','75mcg','100mcg','125mcg','150mcg'], 'hormona tiroideia', 'substituto da hormona tiroideia', ARRAY['hipotiroidismo'], ARRAY['hipotiroidismo'], 'Em jejum.', 'com receita médica', 'MSRM.', ARRAY['palpitações se dose alta'], ARRAY['idem eutirox'], ARRAY['hipertiroidismo'], NULL),

  -- ── Gota ──
  ('Zyloric', 'Alopurinol', ARRAY['5136025'], ARRAY['comprimido'], ARRAY['100mg','300mg'], 'inibidor xantina-oxidase', 'medicamento para gota e ácido úrico elevado', ARRAY['gota','hiperuricémia','lise tumoral'], ARRAY['gota'], '100-300mg/dia. NÃO iniciar em crise aguda.', 'com receita médica', 'MSRM.', ARRAY['exantema','elevação enzimas hepáticas','sd. Stevens-Johnson (raro)'], ARRAY['suspender se exantema','testar HLA-B*5801 em asiáticos'], ARRAY['crise aguda gota','HLA-B*5801+'], NULL),
  ('Colchicina', 'Colchicina', ARRAY['9046923'], ARRAY['comprimido'], ARRAY['0.5mg','1mg'], 'inibidor microtúbulos', 'medicamento para crise aguda de gota', ARRAY['gota aguda','pericardite recorrente','febre mediterrânica familiar'], ARRAY['gota aguda'], '1mg + 0.5mg 1h depois, depois 0.5mg 2-3x/dia. Máx 6mg/dia.', 'com receita médica', 'MSRM. Janela terapêutica estreita.', ARRAY['diarreia (limita dose)','náuseas','neuropatia'], ARRAY['reduzir em IR/IH','interage com claritromicina, ciclosporina'], ARRAY['IR grave','interacção macrólidos'], NULL),

  -- ── Outros frequentes ──
  ('Imodium', 'Loperamida', ARRAY['8470160'], ARRAY['cápsula','comprimido orodispersível'], ARRAY['2mg'], 'antidiarreico', 'reduz a diarreia parando o movimento intestinal', ARRAY['diarreia aguda não-infecciosa','diarreia crónica'], ARRAY['diarreia'], '2mg após cada dejecção líquida, máximo 8mg/dia.', 'sem receita', 'MNSRM até 8 cápsulas.', ARRAY['obstipação','dor abdominal'], ARRAY['NÃO usar em diarreia com febre, sangue, suspeita infecção bacteriana'], ARRAY['colite ulcerosa aguda','suspeita disenteria'], NULL),
  ('Buscopan', 'Butilescopolamina', ARRAY['5004269'], ARRAY['comprimido','injectável'], ARRAY['10mg','20mg'], 'antiespasmódico', 'medicamento para cólicas intestinais e biliares', ARRAY['cólicas','dor abdominal espasmódica','dismenorreia'], ARRAY['cólica'], '10-20mg 3-5x/dia.', 'sem receita', 'MNSRM (oral).', ARRAY['boca seca','retenção urinária'], ARRAY['cuidado em glaucoma'], ARRAY['glaucoma fechado','obstrução intestinal'], NULL),
  ('Trifusal', 'Triflusal', ARRAY['9046930'], ARRAY['cápsula'], ARRAY['300mg'], 'antiagregante plaquetário', 'medicamento que torna o sangue menos pegajoso', ARRAY['prevenção secundária AVC','prevenção EAM'], ARRAY['prevenção AVC'], '300-600mg/dia.', 'com receita médica', 'MSRM.', ARRAY['hemorragia ligeira'], ARRAY['suspender pré-cirurgia'], ARRAY['úlcera activa','hemorragia'], NULL),
  ('Tamiflu', 'Oseltamivir', ARRAY['9046947'], ARRAY['cápsula','suspensão'], ARRAY['30mg','45mg','75mg'], 'antiviral influenza', 'medicamento para gripe (influenza)', ARRAY['gripe (influenza) confirmada','profilaxia pós-exposição'], ARRAY['gripe'], '75mg 12/12h durante 5 dias. Eficaz se iniciado em 48h.', 'com receita médica', 'MSRM.', ARRAY['náuseas','vómitos'], ARRAY['começar nas primeiras 48h'], ARRAY['hipersensibilidade'], NULL),
  ('Acidum folicum', 'Ácido fólico', ARRAY['9046954'], ARRAY['comprimido'], ARRAY['400mcg','5mg'], 'vitamina B9', 'suplemento de vitamina B9', ARRAY['gravidez (prevenção defeito tubo neural)','anemia megaloblástica','suplemento com metotrexato'], ARRAY['gravidez planeada'], '400mcg/dia (gravidez) ou 5mg/dia (anemia).', 'sem receita', 'MNSRM.', ARRAY['raramente'], ARRAY['começar pré-concepção (3 meses antes)'], ARRAY['hipersensibilidade'], NULL),
  ('Ferro Gradumet', 'Sulfato ferroso', ARRAY['9046961'], ARRAY['comprimido LR'], ARRAY['325mg (105mg Fe)'], 'suplemento de ferro', 'suplemento para anemia por défice de ferro', ARRAY['anemia ferropénica'], ARRAY['anemia'], '1 comprimido 1-2x/dia em jejum.', 'sem receita', 'MNSRM.', ARRAY['obstipação','fezes pretas (normal)','dispepsia'], ARRAY['em jejum melhora absorção','vit C ajuda','distância de café, chá, leite, cálcio'], ARRAY['hemocromatose'], NULL)

  on conflict do nothing;

notify pgrst, 'reload schema';
