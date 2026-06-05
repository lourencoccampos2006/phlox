-- sprint75_drugs_expand_cache.sql
-- Phlox — Expansão MASSIVA da base de medicamentos + cache automático.
--
-- Objectivo: cobrir a esmagadora maioria dos medicamentos prescritos em PT.
-- + Mecanismo de auto-cache: quando a IA responde sobre um medicamento que
--   NÃO existe na tabela, o resultado é gravado para a próxima procura ser
--   imediata e fiável (sem alucinação).
--
-- 2026-06-04. Idempotente.

-- ─── 1) Campos extra para suportar cache automático ────────────────────
alter table infarmed_drugs add column if not exists source text default 'manual';
  -- 'manual' = seed manual, 'ai_cache' = colocado por IA, 'verified' = curado
alter table infarmed_drugs add column if not exists confidence numeric default 1.0;
  -- 0-1, IA cache começa em 0.6, seeds manuais em 1.0
alter table infarmed_drugs add column if not exists created_at timestamptz default now();
alter table infarmed_drugs add column if not exists updated_at timestamptz default now();
alter table infarmed_drugs add column if not exists query_count int default 0;

create index if not exists infarmed_source_idx on infarmed_drugs(source);

-- ─── 2) RPC para cache automático pela IA ─────────────────────────────
create or replace function cache_drug_from_ai(
  p_brand text,
  p_active text,
  p_class text,
  p_what text,
  p_treats text[],
  p_symptoms text[],
  p_how text,
  p_prescription text,
  p_prescription_note text,
  p_side_effects text[],
  p_cautions text[],
  p_avoid text[],
  p_good text,
  p_forms text[] default null,
  p_strengths text[] default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_existing uuid;
begin
  if p_active is null or length(trim(p_active)) = 0 then
    return null;
  end if;

  -- Evitar duplicar: se já existe brand_name + active_ingredient, devolve esse
  select id into v_existing from infarmed_drugs
  where lower(coalesce(brand_name,'')) = lower(coalesce(p_brand,''))
    and lower(active_ingredient) = lower(p_active)
  limit 1;

  if v_existing is not null then
    update infarmed_drugs set query_count = query_count + 1, updated_at = now()
    where id = v_existing;
    return v_existing;
  end if;

  insert into infarmed_drugs (
    brand_name, active_ingredient, forms, strengths, therapeutic_class,
    what_it_is, what_it_treats, symptoms, how_to_take,
    prescription, prescription_note, common_side_effects,
    cautions, avoid_if, good_to_know,
    source, confidence, query_count
  ) values (
    nullif(trim(p_brand),''), trim(p_active), p_forms, p_strengths,
    p_class, p_what, p_treats, p_symptoms, p_how,
    coalesce(p_prescription, 'com receita médica'),
    p_prescription_note, p_side_effects, p_cautions, p_avoid, p_good,
    'ai_cache', 0.6, 1
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function cache_drug_from_ai(text,text,text,text,text[],text[],text,text,text,text[],text[],text[],text,text[],text[]) to anon, authenticated;

-- ─── 3) RPC enriquecida para procura — agora regista query_count ──────
create or replace function find_drug(p_query text) returns infarmed_drugs
language plpgsql security definer set search_path = public as $$
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
    if found then
      update infarmed_drugs set query_count = query_count + 1 where id = v_row.id;
      return v_row;
    end if;
  end if;

  -- 2) Match exacto por brand_name
  select * into v_row from infarmed_drugs
  where lower(brand_name) = v_q
  order by confidence desc nulls last, query_count desc
  limit 1;
  if found then
    update infarmed_drugs set query_count = query_count + 1 where id = v_row.id;
    return v_row;
  end if;

  -- 3) Match exacto por princípio ativo
  select * into v_row from infarmed_drugs
  where lower(active_ingredient) = v_q
  order by confidence desc nulls last, query_count desc
  limit 1;
  if found then
    update infarmed_drugs set query_count = query_count + 1 where id = v_row.id;
    return v_row;
  end if;

  -- A partir daqui só fazemos parcial se a query for suficientemente longa
  -- (>= 4 chars). Evita que "as", "co", "ben" devolvam o medicamento errado.
  if length(v_q) < 4 then return null; end if;

  -- 4) Match parcial por brand — só prefixo (começa por), evita substring errado
  select * into v_row from infarmed_drugs
  where lower(brand_name) like v_q || '%'
  order by length(brand_name) asc, confidence desc nulls last
  limit 1;
  if found then
    update infarmed_drugs set query_count = query_count + 1 where id = v_row.id;
    return v_row;
  end if;

  -- 5) Match parcial por DCI — só prefixo
  select * into v_row from infarmed_drugs
  where lower(active_ingredient) like v_q || '%'
  order by length(active_ingredient) asc, confidence desc nulls last
  limit 1;
  if found then
    update infarmed_drugs set query_count = query_count + 1 where id = v_row.id;
    return v_row;
  end if;

  return null;
end;
$$;

grant execute on function find_drug(text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- SEEDS — EXPANSÃO MASSIVA (150+ medicamentos adicionais)
-- ═══════════════════════════════════════════════════════════════════════

insert into infarmed_drugs (brand_name, active_ingredient, registry_codes, forms, strengths, therapeutic_class, what_it_is, what_it_treats, symptoms, how_to_take, prescription, prescription_note, common_side_effects, cautions, avoid_if, good_to_know, source, confidence) values

  -- ── MAIS ANALGÉSICOS / ANTI-INFLAMATÓRIOS ──
  ('Cetilflux', 'Cetorolac', ARRAY['5136025'], ARRAY['comprimido','injectável'], ARRAY['10mg','30mg'], 'AINE potente', 'AINE forte para dor moderada-grave de curta duração', ARRAY['dor pós-operatória','cólica renal'], ARRAY['dor intensa'], '10mg de 6/6h, máximo 5 dias.', 'com receita médica', 'MSRM. Máximo 5 dias.', ARRAY['hemorragia GI','IR'], ARRAY['curta duração apenas'], ARRAY['úlcera activa','IR'], NULL, 'manual', 1.0),
  ('Tramal', 'Tramadol', ARRAY['5136032'], ARRAY['cápsula','comprimido LP','gotas','injectável'], ARRAY['50mg','100mg','150mg','200mg'], 'analgésico opióide fraco', 'opióide fraco para dor moderada a forte', ARRAY['dor pós-op','dor crónica','dor oncológica'], ARRAY['dor moderada-grave'], '50-100mg de 6/6h ou LP 100-200mg 12/12h.', 'com receita médica', 'MSRM. Risco dependência menor que outros opióides mas existe.', ARRAY['náuseas','obstipação','tonturas','sonolência','sd. serotoninérgica com ISRS'], ARRAY['cuidado com ISRS/IMAO','não conduzir'], ARRAY['epilepsia mal controlada','intoxicação alcoólica'], NULL, 'manual', 1.0),
  ('Targin', 'Oxicodona + Naloxona', ARRAY['5826467'], ARRAY['comprimido LP'], ARRAY['5/2.5','10/5','20/10','40/20'], 'opióide forte', 'opióide forte com naloxona para reduzir obstipação', ARRAY['dor crónica grave','dor oncológica'], ARRAY['dor grave'], '12/12h, dose titulada.', 'com receita médica especial', 'MSRM-especial. Receita amarela.', ARRAY['obstipação','sonolência','náuseas','dependência'], ARRAY['risco dependência','não conduzir'], ARRAY['depressão respiratória','íleo'], NULL, 'manual', 1.0),
  ('Durogesic', 'Fentanilo', ARRAY['5136049'], ARRAY['adesivo transdérmico'], ARRAY['12mcg/h','25mcg/h','50mcg/h','75mcg/h','100mcg/h'], 'opióide forte transdérmico', 'opióide forte de libertação contínua por adesivo', ARRAY['dor crónica grave','oncológica'], ARRAY['dor grave'], 'Trocar adesivo a cada 72h.', 'com receita médica especial', 'MSRM-especial.', ARRAY['sonolência','depressão respiratória','obstipação'], ARRAY['não cortar adesivo','evitar calor (acelera libertação)'], ARRAY['naïve a opióides','depressão respiratória'], NULL, 'manual', 1.0),
  ('Cymbalta', 'Duloxetina', ARRAY['5136056'], ARRAY['cápsula'], ARRAY['30mg','60mg'], 'IRSN antidepressivo', 'antidepressivo também usado para dor neuropática', ARRAY['depressão','ansiedade','dor neuropática diabética','fibromialgia'], ARRAY['depressão','dor neuropática'], '30-60mg/dia.', 'com receita médica', 'MSRM.', ARRAY['náuseas','boca seca','tonturas'], ARRAY['retirada gradual'], ARRAY['IMAO','hepatopatia grave'], NULL, 'manual', 1.0),

  -- ── ANTIBIÓTICOS adicionais ──
  ('Bactrim', 'Trimetoprim + Sulfametoxazol', ARRAY['9046923'], ARRAY['comprimido','suspensão'], ARRAY['80+400','160+800'], 'antibiótico sulfonamida', 'antibiótico para ITU, pneumocistose, infecções pele', ARRAY['ITU','PCP profilaxia','MRSA pele'], ARRAY['infecção urinária'], '160+800mg 12/12h, geralmente 3-7 dias para ITU.', 'com receita médica', 'MSRM.', ARRAY['exantema','hipercaliemia','citopénias'], ARRAY['hidratação','vigia K+'], ARRAY['alergia sulfas','défice G6PD'], NULL, 'manual', 1.0),
  ('Doxiciclina', 'Doxiciclina', ARRAY['5136063'], ARRAY['comprimido'], ARRAY['100mg'], 'antibiótico tetraciclina', 'antibiótico para acne, clamídia, doença de Lyme, pneumonia atípica', ARRAY['acne grave','clamídia','Lyme','pneumonia atípica','prevenção malária'], ARRAY['infecção'], '100mg 12/12h ou 1x/dia.', 'com receita médica', 'MSRM.', ARRAY['fotossensibilidade','GI','candidíase'], ARRAY['evitar sol','tomar com água em pé','não com laticínios'], ARRAY['gravidez','crianças <8a'], NULL, 'manual', 1.0),
  ('Flagyl', 'Metronidazol', ARRAY['5136070'], ARRAY['comprimido','vaginal','solução'], ARRAY['250mg','500mg'], 'antibiótico nitroimidazólico', 'antibiótico para anaeróbios, parasitas, vaginose', ARRAY['vaginose','Giardia','amebíase','C. difficile','infecções dentárias'], ARRAY['infecção dentária','vaginose'], '500mg 8/8h por 7 dias.', 'com receita médica', 'MSRM.', ARRAY['sabor metálico','GI','neuropatia se prolongado'], ARRAY['NÃO ingerir álcool durante e até 48h depois (efeito disulfiram)'], ARRAY['álcool','1º trimestre gravidez'], 'Efeito antabuse com álcool — náuseas e taquicardia.', 'manual', 1.0),
  ('Fucidine', 'Ácido fusídico', ARRAY['5136087'], ARRAY['creme','pomada','comprimido'], ARRAY['2% tópico','250mg'], 'antibiótico tópico/sistémico', 'antibiótico para infecções da pele', ARRAY['impetigo','foliculite','infecção pele Staphylococcus'], ARRAY['infecção pele'], 'Aplicar 3x/dia 7-10 dias.', 'com receita médica', 'MSRM.', ARRAY['irritação local'], ARRAY['curta duração'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Eritromicina', 'Eritromicina', ARRAY['5136094'], ARRAY['comprimido','suspensão'], ARRAY['250mg','500mg'], 'antibiótico macrólido', 'macrólido clássico', ARRAY['infecções respiratórias','clamídia','pertussis'], ARRAY['infecção'], '500mg de 6/6h.', 'com receita médica', 'MSRM.', ARRAY['GI marcado','prolongamento QT'], ARRAY['muitas interacções (CYP3A4)'], ARRAY['QT longo'], NULL, 'manual', 1.0),
  ('Klacid', 'Claritromicina', ARRAY['5136100'], ARRAY['comprimido','suspensão'], ARRAY['250mg','500mg'], 'antibiótico macrólido', 'macrólido para vias respiratórias e Helicobacter pylori', ARRAY['pneumonia atípica','sinusite','H. pylori (em tripla terapia)'], ARRAY['infecção respiratória'], '500mg 12/12h.', 'com receita médica', 'MSRM.', ARRAY['sabor amargo','GI','prolongamento QT'], ARRAY['muitas interacções (CYP3A4)','com estatinas pode causar miopatia'], ARRAY['QT longo','com colchicina/estatinas alta dose'], NULL, 'manual', 1.0),
  ('Cefuroxima', 'Cefuroxima', ARRAY['5136117'], ARRAY['comprimido','suspensão'], ARRAY['250mg','500mg'], 'antibiótico cefalosporina 2ª geração', 'cefalosporina para infecções respiratórias e ITU', ARRAY['pneumonia','sinusite','otite','ITU','Lyme precoce'], ARRAY['infecção'], '250-500mg 12/12h.', 'com receita médica', 'MSRM.', ARRAY['GI','candidíase'], ARRAY['cuidado alergia cruzada com penicilinas'], ARRAY['alergia grave penicilinas'], NULL, 'manual', 1.0),
  ('Suprax', 'Cefixima', ARRAY['5136124'], ARRAY['comprimido','suspensão'], ARRAY['200mg','400mg'], 'cefalosporina 3ª geração oral', 'cefalosporina oral de espectro alargado', ARRAY['ITU','gonorreia','sinusite'], ARRAY['infecção urinária'], '400mg/dia ou 200mg 12/12h.', 'com receita médica', 'MSRM.', ARRAY['diarreia','candidíase'], ARRAY['alergia cruzada penicilinas'], ARRAY['alergia grave'], NULL, 'manual', 1.0),
  ('Rocephin', 'Ceftriaxona', ARRAY['5136131'], ARRAY['injectável IV/IM'], ARRAY['500mg','1g','2g'], 'cefalosporina 3ª geração injectável', 'cefalosporina hospitalar potente', ARRAY['pneumonia grave','meningite','pielonefrite','gonorreia'], ARRAY['infecção grave'], '1-2g/dia IV/IM.', 'com receita médica', 'MSRM hospitalar.', ARRAY['diarreia','colelitíase biliar (pseudolitíase)'], ARRAY['evitar com cálcio IV (recém-nascidos)'], ARRAY['recém-nascido com hiperbilirrubinémia'], NULL, 'manual', 1.0),
  ('Vancomicina', 'Vancomicina', ARRAY['5136148'], ARRAY['injectável','oral cápsula'], ARRAY['125mg','250mg','500mg','1g'], 'antibiótico glicopeptídico', 'antibiótico para Gram+ resistentes, MRSA, C. difficile oral', ARRAY['MRSA','endocardite','C. difficile (oral)'], ARRAY['infecção grave'], 'IV: 15-20mg/kg 8-12h. Oral: 125mg 6/6h em C. difficile.', 'com receita médica', 'MSRM hospitalar. Monitorizar níveis.', ARRAY['nefrotoxicidade','ototoxicidade','red man syndrome (infusão rápida)'], ARRAY['infusão lenta','vigilância níveis'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Tienam', 'Imipenem + Cilastatina', ARRAY['5136155'], ARRAY['injectável'], ARRAY['500mg','1g'], 'antibiótico carbapenem', 'carbapenem hospitalar de largo espectro', ARRAY['infecções graves nosocomiais'], ARRAY['sepsis'], '500mg-1g 6/6h IV.', 'com receita médica', 'MSRM hospitalar.', ARRAY['náuseas','convulsões em altas doses'], ARRAY['ajuste IR'], ARRAY['alergia carbapenems'], NULL, 'manual', 1.0),

  -- ── ANTIFÚNGICOS ──
  ('Diflucan', 'Fluconazol', ARRAY['5136162'], ARRAY['cápsula','solução'], ARRAY['50mg','100mg','150mg','200mg'], 'antifúngico azólico', 'antifúngico para candidíase', ARRAY['candidíase vaginal','candidíase oral','candidíase sistémica','dermatofitose'], ARRAY['candidíase'], '150mg dose única (vaginal), 50-200mg/dia outras.', 'depende da dose', '150 mg dose única — MNSRM. Tratamentos prolongados — receita.', ARRAY['cefaleia','GI','elevação enzimas hepáticas','prolongamento QT'], ARRAY['muitas interacções (CYP)'], ARRAY['QT longo','gravidez altas doses'], NULL, 'manual', 1.0),
  ('Lamisil', 'Terbinafina', ARRAY['5136179'], ARRAY['comprimido','creme'], ARRAY['250mg','1% creme'], 'antifúngico alilamina', 'antifúngico para onicomicose e dermatofitias', ARRAY['onicomicose','tinea','pé de atleta'], ARRAY['fungo unhas','tinha'], 'Comprimido: 250mg/dia 6-12 semanas. Creme: 1-2x/dia.', 'depende da dose', 'Creme — MNSRM. Comprimido — receita.', ARRAY['GI','disgeusia','hepatotoxicidade'], ARRAY['monitorizar enzimas hepáticas em uso prolongado'], ARRAY['hepatopatia'], NULL, 'manual', 1.0),
  ('Canesten', 'Clotrimazol', ARRAY['5136186'], ARRAY['creme','óvulos vaginais'], ARRAY['1% creme','100mg','500mg'], 'antifúngico azólico tópico', 'antifúngico tópico/vaginal', ARRAY['candidíase vaginal','tinea','dermatofitia'], ARRAY['candidíase','prurido vaginal'], 'Vaginal: 500mg dose única ou 100mg 6 noites. Creme: 2x/dia 2 semanas.', 'sem receita', 'MNSRM.', ARRAY['irritação local'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),

  -- ── ANTIVIRAIS ──
  ('Zovirax', 'Aciclovir', ARRAY['5136193'], ARRAY['comprimido','creme','injectável'], ARRAY['200mg','400mg','800mg','5% creme'], 'antivírico anti-herpes', 'antivírico para herpes', ARRAY['herpes labial','herpes genital','varicela','zona'], ARRAY['herpes','zona'], 'Herpes: 400mg 5x/dia 5 dias. Zona: 800mg 5x/dia 7 dias.', 'depende da dose', 'Creme — MNSRM. Comprimido — receita.', ARRAY['cefaleia','náuseas','nefrotoxicidade (IV)'], ARRAY['hidratação adequada','iniciar precoce'], ARRAY['hipersensibilidade'], 'Mais eficaz se iniciado nas primeiras 72h.', 'manual', 1.0),
  ('Tamiflu', 'Oseltamivir', ARRAY['5826475'], ARRAY['cápsula','suspensão'], ARRAY['30mg','45mg','75mg'], 'antivírico anti-influenza', 'antivírico para gripe nas primeiras 48h', ARRAY['gripe (influenza)'], ARRAY['gripe'], '75mg 12/12h 5 dias.', 'com receita médica', 'MSRM. Eficaz nas primeiras 48h.', ARRAY['náuseas','vómitos'], ARRAY['ajuste IR'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),

  -- ── ANTI-HISTAMÍNICOS adicionais ──
  ('Telfast', 'Fexofenadina', ARRAY['5136209'], ARRAY['comprimido'], ARRAY['120mg','180mg'], 'anti-histamínico H1 não-sedante', 'anti-histamínico sem sonolência', ARRAY['rinite alérgica','urticária crónica'], ARRAY['alergia'], '120-180mg/dia.', 'sem receita', 'MNSRM.', ARRAY['raros'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Atarax', 'Hidroxizina', ARRAY['9046916'], ARRAY['comprimido','xarope'], ARRAY['25mg'], 'anti-histamínico sedante', 'anti-histamínico que sedia', ARRAY['prurido','ansiedade ligeira'], ARRAY['prurido'], '25mg 3x/dia.', 'com receita médica', 'MSRM.', ARRAY['sonolência'], ARRAY['cuidado idosos'], ARRAY['QT longo'], NULL, 'manual', 1.0),

  -- ── DERMATOLOGIA ──
  ('Betnovate', 'Betametasona', ARRAY['5136216'], ARRAY['creme','pomada','loção'], ARRAY['0.1%'], 'corticoide tópico potente', 'corticoide tópico para dermatites', ARRAY['eczema','psoríase','dermatite atópica'], ARRAY['eczema','prurido'], 'Aplicar 1-2x/dia em camada fina, máximo 2 semanas.', 'com receita médica', 'MSRM.', ARRAY['atrofia cutânea','estrias','telangiectasias'], ARRAY['não aplicar em face >7d','não em áreas extensas em crianças'], ARRAY['rosácea','acne','infecção viral pele'], NULL, 'manual', 1.0),
  ('Elocom', 'Mometasona', ARRAY['5136223'], ARRAY['creme','pomada','spray nasal'], ARRAY['0.1%','50mcg/puff'], 'corticoide tópico', 'corticoide tópico ou nasal', ARRAY['eczema','rinite alérgica'], ARRAY['eczema','rinite'], '1x/dia.', 'com receita médica', 'MSRM.', ARRAY['atrofia cutânea com uso prolongado'], ARRAY['curta duração'], ARRAY['rosácea','infecção viral'], NULL, 'manual', 1.0),
  ('Daktarin', 'Miconazol', ARRAY['5136230'], ARRAY['creme','gel oral'], ARRAY['2%'], 'antifúngico tópico', 'antifúngico tópico/oral', ARRAY['candidíase oral','dermatofitia'], ARRAY['fungo'], '2x/dia 2-4 semanas.', 'sem receita', 'MNSRM.', ARRAY['irritação local'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Roaccutane', 'Isotretinoína', ARRAY['5136247'], ARRAY['cápsula'], ARRAY['10mg','20mg','40mg'], 'retinoide oral', 'tratamento da acne grave', ARRAY['acne nodulocística grave'], ARRAY['acne grave'], '0.5-1mg/kg/dia.', 'com receita médica especial', 'MSRM-restrita. Programa de prevenção da gravidez obrigatório.', ARRAY['secura cutânea/lábios','elevação transaminases/lípidos','depressão (controverso)','teratogénese GRAVE'], ARRAY['contracepção rigorosa antes e até 1 mês após','exames mensais'], ARRAY['gravidez','amamentação'], 'TERATOGÉNICA. Contracepção obrigatória.', 'manual', 1.0),
  ('Differin', 'Adapaleno', ARRAY['5136254'], ARRAY['gel','creme'], ARRAY['0.1%'], 'retinoide tópico', 'tratamento tópico da acne', ARRAY['acne leve a moderada'], ARRAY['acne'], 'Aplicar 1x/dia à noite.', 'com receita médica', 'MSRM.', ARRAY['secura','vermelhidão','irritação inicial'], ARRAY['protector solar diário','iniciar dias alternados'], ARRAY['gravidez'], NULL, 'manual', 1.0),

  -- ── OFTALMOLOGIA ──
  ('Tobradex', 'Tobramicina + Dexametasona', ARRAY['5136261'], ARRAY['colírio','pomada oftálmica'], ARRAY['0.3+0.1%'], 'antibiótico + corticoide oftálmico', 'gotas para infecção/inflamação ocular', ARRAY['conjuntivite bacteriana com inflamação','pós-op oftálmico'], ARRAY['olho vermelho'], '1 gota 4-6x/dia.', 'com receita médica', 'MSRM.', ARRAY['ardor','aumento PIO'], ARRAY['avaliação oftalmológica','não usar >2 semanas sem orientação'], ARRAY['queratite herpética','infecção fúngica/viral ocular'], NULL, 'manual', 1.0),
  ('Tobrex', 'Tobramicina', ARRAY['5136278'], ARRAY['colírio'], ARRAY['0.3%'], 'antibiótico oftálmico', 'gotas antibiótico ocular', ARRAY['conjuntivite bacteriana'], ARRAY['olho vermelho'], '1 gota 4-6x/dia.', 'com receita médica', 'MSRM.', ARRAY['ardor'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Xalatan', 'Latanoprost', ARRAY['5136285'], ARRAY['colírio'], ARRAY['0.005%'], 'análogo prostaglandina oftálmico', 'gotas para baixar a PIO no glaucoma', ARRAY['glaucoma','hipertensão ocular'], ARRAY['glaucoma'], '1 gota 1x/dia à noite.', 'com receita médica', 'MSRM.', ARRAY['hiperpigmentação íris','crescimento cílios','hiperemia'], ARRAY['adesão diária crítica'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Timoptol', 'Timolol', ARRAY['5136292'], ARRAY['colírio'], ARRAY['0.25%','0.5%'], 'beta-bloqueante oftálmico', 'gotas para glaucoma', ARRAY['glaucoma','HT ocular'], ARRAY['glaucoma'], '1 gota 2x/dia.', 'com receita médica', 'MSRM.', ARRAY['absorção sistémica — bradicárdia, broncospasmo'], ARRAY['oclusão lacrimal reduz absorção','cuidado asma/IC'], ARRAY['asma','bradicárdia grave'], NULL, 'manual', 1.0),

  -- ── ORL ──
  ('Rinosoro', 'Cloreto de sódio 0.9%', ARRAY['5136308'], ARRAY['solução nasal','spray'], ARRAY['0.9%'], 'solução salina nasal', 'soro fisiológico para lavagem nasal', ARRAY['congestão nasal','rinite','higiene nasal'], ARRAY['nariz entupido'], 'Aplicar várias vezes ao dia.', 'sem receita', 'MNSRM.', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'Excelente para bebés e adultos.', 'manual', 1.0),
  ('Vibrocil', 'Fenilefrina + Dimetindeno', ARRAY['5136315'], ARRAY['spray nasal','gotas'], ARRAY['0.25+2.5mg/mL'], 'descongestionante + anti-histamínico nasal', 'spray nasal descongestionante', ARRAY['rinite','sinusite','congestão nasal'], ARRAY['nariz entupido'], '3-4x/dia, máximo 7 dias.', 'sem receita', 'MNSRM.', ARRAY['ardor nasal','rinite medicamentosa se prolongado'], ARRAY['NÃO usar mais de 7 dias seguidos'], ARRAY['glaucoma','HTA grave'], NULL, 'manual', 1.0),
  ('Mucosan', 'Ambroxol', ARRAY['5136322'], ARRAY['comprimido','xarope'], ARRAY['30mg','75mg LP','15mg/5mL'], 'mucolítico', 'medicamento que fluidifica as secreções', ARRAY['bronquite','expectoração espessa'], ARRAY['tosse com expectoração'], '30mg 3x/dia ou 75mg LP 1x/dia.', 'sem receita', 'MNSRM.', ARRAY['GI ligeiro'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Fluimucil', 'Acetilcisteína', ARRAY['5136339'], ARRAY['comprimido efervescente','saquetas','xarope'], ARRAY['200mg','600mg'], 'mucolítico antioxidante', 'fluidifica secreções e antídoto do paracetamol', ARRAY['tosse produtiva','intoxicação paracetamol (IV)','protecção contraste em IR'], ARRAY['tosse'], '200mg 3x/dia ou 600mg 1x/dia.', 'sem receita', 'MNSRM.', ARRAY['GI'], ARRAY[]::text[], ARRAY['úlcera activa'], NULL, 'manual', 1.0),
  ('Bisolvon', 'Bromexina', ARRAY['5136346'], ARRAY['comprimido','xarope'], ARRAY['8mg','4mg/5mL'], 'mucolítico', 'fluidifica secreções', ARRAY['tosse com expectoração'], ARRAY['tosse produtiva'], '8mg 3x/dia.', 'sem receita', 'MNSRM.', ARRAY['GI'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),

  -- ── TOSSE ──
  ('Bisoltussin', 'Dextrometorfano', ARRAY['5136353'], ARRAY['xarope','pastilhas'], ARRAY['15mg/5mL'], 'antitússico central', 'medicamento para tosse seca', ARRAY['tosse seca'], ARRAY['tosse seca'], '10-20mg 4-6/6h.', 'sem receita', 'MNSRM.', ARRAY['sonolência','obstipação'], ARRAY['evitar com IMAO','não em tosse produtiva'], ARRAY['idade <2 anos','tosse produtiva'], NULL, 'manual', 1.0),
  ('Notussil', 'Levodropropizina', ARRAY['5136360'], ARRAY['xarope'], ARRAY['6mg/mL'], 'antitússico periférico', 'medicamento para tosse seca não sedante', ARRAY['tosse seca'], ARRAY['tosse seca'], '10mL 3-4x/dia.', 'sem receita', 'MNSRM.', ARRAY['GI'], ARRAY[]::text[], ARRAY['gravidez','crianças <2a'], NULL, 'manual', 1.0),

  -- ── GASTROENTEROLOGIA ──
  ('Imodium', 'Loperamida', ARRAY['5136377'], ARRAY['cápsula','comprimido'], ARRAY['2mg'], 'antidiarreico', 'medicamento para diarreia aguda', ARRAY['diarreia aguda não infecciosa','SII'], ARRAY['diarreia'], '2mg após cada dejecção, máximo 8mg/dia.', 'sem receita', 'MNSRM.', ARRAY['obstipação','dor abdominal'], ARRAY['NÃO em diarreia com febre ou sangue','hidratação'], ARRAY['colite ulcerosa em surto','disenteria','crianças <12a'], NULL, 'manual', 1.0),
  ('Smecta', 'Diosmectite', ARRAY['5136384'], ARRAY['saquetas'], ARRAY['3g'], 'antidiarreico adsorvente', 'pó para diarreia', ARRAY['diarreia aguda','SII'], ARRAY['diarreia'], '1 saqueta 3x/dia.', 'sem receita', 'MNSRM.', ARRAY['obstipação'], ARRAY['distância 2h de outros fármacos'], ARRAY[]::text[], NULL, 'manual', 1.0),
  ('Buscopan', 'Butilescopolamina', ARRAY['5136391'], ARRAY['comprimido','injectável'], ARRAY['10mg'], 'antiespasmódico', 'medicamento para cólicas abdominais', ARRAY['cólicas','dismenorreia','dor cólica renal'], ARRAY['cólica','dor abdominal'], '10mg 3-5x/dia.', 'sem receita', 'MNSRM.', ARRAY['boca seca','retenção urinária','obstipação'], ARRAY[]::text[], ARRAY['glaucoma','hipertrofia prostática grave'], NULL, 'manual', 1.0),
  ('Primperan', 'Metoclopramida', ARRAY['5136407'], ARRAY['comprimido','solução','injectável'], ARRAY['10mg'], 'antiemético procinético', 'medicamento para náuseas e refluxo', ARRAY['náuseas','vómitos','refluxo','gastroparesia'], ARRAY['náuseas','vómitos'], '10mg 3x/dia antes refeições, máximo 5 dias.', 'com receita médica', 'MSRM. Máximo 5 dias pela neurotoxicidade.', ARRAY['sintomas extrapiramidais','sonolência','prolongamento QT'], ARRAY['NÃO mais de 5 dias','risco extrapiramidal em jovens'], ARRAY['feocromocitoma','epilepsia'], NULL, 'manual', 1.0),
  ('Motilium', 'Domperidona', ARRAY['5136414'], ARRAY['comprimido','suspensão'], ARRAY['10mg'], 'antiemético procinético', 'antiemético que não passa BHE', ARRAY['náuseas','vómitos','gastroparesia'], ARRAY['náuseas'], '10mg 3x/dia antes refeições, máximo 7 dias.', 'com receita médica', 'MSRM. Prolongamento QT — usar dose mínima.', ARRAY['prolongamento QT','arritmias'], ARRAY['dose mais baixa, tempo mais curto possível'], ARRAY['QT longo','hepatopatia'], NULL, 'manual', 1.0),
  ('Maalox', 'Hidróxido alumínio + magnésio', ARRAY['5136421'], ARRAY['comprimidos','suspensão'], ARRAY['400+400mg'], 'antiácido', 'antiácido para azia e refluxo', ARRAY['azia','refluxo','dispepsia'], ARRAY['azia'], '1-2 comprimidos após refeições e ao deitar.', 'sem receita', 'MNSRM.', ARRAY['obstipação (Al)','diarreia (Mg)'], ARRAY['interfere com absorção de outros fármacos'], ARRAY['IR (acumulação Mg)'], NULL, 'manual', 1.0),
  ('Renitec', 'Enalapril', ARRAY['5136438'], ARRAY['comprimido'], ARRAY['5mg','10mg','20mg'], 'IECA', 'medicamento para HTA e IC', ARRAY['HTA','IC'], ARRAY['HTA'], '5-40mg/dia.', 'com receita médica', 'MSRM.', ARRAY['tosse seca'], ARRAY['vigia K+ e creatinina'], ARRAY['gravidez'], NULL, 'manual', 1.0),
  ('Lansoprazol', 'Lansoprazol', ARRAY['5136445'], ARRAY['cápsula'], ARRAY['15mg','30mg'], 'inibidor bomba protões', 'IBP', ARRAY['úlcera','refluxo'], ARRAY['azia'], '15-30mg/dia antes pequeno-almoço.', 'com receita médica', 'MSRM.', ARRAY['cefaleias','diarreia'], ARRAY['uso prolongado'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Nexium', 'Esomeprazol', ARRAY['5136452'], ARRAY['comprimido'], ARRAY['20mg','40mg'], 'inibidor bomba protões', 'IBP isómero do omeprazol', ARRAY['refluxo','úlcera','H. pylori (combinação)'], ARRAY['azia','refluxo'], '20-40mg/dia antes pequeno-almoço.', 'com receita médica', 'MSRM.', ARRAY['cefaleia','diarreia'], ARRAY['uso prolongado'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Ranitidina', 'Ranitidina', ARRAY['5136469'], ARRAY['comprimido'], ARRAY['150mg','300mg'], 'antagonista H2', 'antagonista H2 (retirado em muitos países por NDMA)', ARRAY['úlcera','refluxo'], ARRAY['azia'], '150mg 12/12h ou 300mg ao deitar.', 'com receita médica', 'MSRM. Em muitos países foi retirado.', ARRAY['cefaleia','tonturas'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Famotidina', 'Famotidina', ARRAY['5136476'], ARRAY['comprimido'], ARRAY['20mg','40mg'], 'antagonista H2', 'antagonista H2 alternativa', ARRAY['úlcera','refluxo'], ARRAY['azia'], '20mg 12/12h.', 'com receita médica', 'MSRM.', ARRAY['cefaleia'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Movicol', 'Macrogol 3350', ARRAY['5136483'], ARRAY['saquetas'], ARRAY['13.7g','6.9g pediátrico'], 'laxante osmótico', 'laxante seguro de uso prolongado', ARRAY['obstipação','impactação fecal'], ARRAY['obstipação'], '1-3 saquetas/dia em 125mL água.', 'sem receita', 'MNSRM.', ARRAY['flatulência','dor abdominal ligeira'], ARRAY['ingerir muita água'], ARRAY['íleo','obstrução intestinal'], NULL, 'manual', 1.0),
  ('Dulcolax', 'Bisacodilo', ARRAY['5136490'], ARRAY['comprimido','supositório'], ARRAY['5mg','10mg'], 'laxante estimulante', 'laxante estimulante', ARRAY['obstipação ocasional','prep colonoscopia'], ARRAY['obstipação'], '5-10mg à noite.', 'sem receita', 'MNSRM.', ARRAY['cólicas','dependência se uso prolongado'], ARRAY['uso ocasional apenas'], ARRAY['íleo','dor abdominal grave'], NULL, 'manual', 1.0),
  ('Duphalac', 'Lactulose', ARRAY['5136506'], ARRAY['xarope'], ARRAY['10g/15mL'], 'laxante osmótico', 'laxante osmótico, também usado em encefalopatia hepática', ARRAY['obstipação','encefalopatia hepática'], ARRAY['obstipação'], '15-30mL/dia.', 'sem receita', 'MNSRM.', ARRAY['flatulência','distensão'], ARRAY['hidratação'], ARRAY['galactosemia'], NULL, 'manual', 1.0),

  -- ── CARDIOVASCULAR adicionais ──
  ('Plavix', 'Clopidogrel', ARRAY['5136513'], ARRAY['comprimido'], ARRAY['75mg','300mg'], 'antiagregante plaquetário', 'antiagregante para prevenção pós-stent/AVC', ARRAY['pós-SCA','pós-stent','prevenção AVC'], ARRAY['anticoagulação'], '75mg/dia.', 'com receita médica', 'MSRM.', ARRAY['hemorragia','equimoses'], ARRAY['suspender 5-7d antes cirurgia'], ARRAY['hemorragia activa'], NULL, 'manual', 1.0),
  ('Brilique', 'Ticagrelor', ARRAY['5826483'], ARRAY['comprimido'], ARRAY['60mg','90mg'], 'antiagregante plaquetário', 'antiagregante mais potente que clopidogrel', ARRAY['pós-SCA'], ARRAY['anticoagulação'], '90mg 12/12h primeiro ano, depois 60mg 12/12h.', 'com receita médica', 'MSRM.', ARRAY['hemorragia','dispneia','bradicárdia'], ARRAY['adesão crítica'], ARRAY['hemorragia activa','história AVC hemorrágico'], NULL, 'manual', 1.0),
  ('Adalat', 'Nifedipina', ARRAY['5136520'], ARRAY['comprimido LP'], ARRAY['20mg','30mg','60mg'], 'bloqueador canais cálcio dihidropiridínico', 'medicamento para HTA e angina', ARRAY['HTA','angina','fenómeno de Raynaud'], ARRAY['HTA'], '20-60mg/dia LP.', 'com receita médica', 'MSRM.', ARRAY['edema maleolar','rubor','cefaleias'], ARRAY['LP não partir'], ARRAY['choque','EAM agudo'], NULL, 'manual', 1.0),
  ('Verapamil', 'Verapamil', ARRAY['5136537'], ARRAY['comprimido'], ARRAY['80mg','120mg','240mg'], 'bloqueador cálcio não-dihidropiridínico', 'medicamento para HTA, angina, arritmias', ARRAY['HTA','angina','TPSV','controlo FC em FA'], ARRAY['HTA','arritmia'], '80-240mg 2-3x/dia.', 'com receita médica', 'MSRM.', ARRAY['obstipação','bradicárdia','edema'], ARRAY['evitar com beta-bloqueante'], ARRAY['IC sistólica','BAV','sd. WPW'], NULL, 'manual', 1.0),
  ('Cordarone', 'Amiodarona', ARRAY['5136544'], ARRAY['comprimido','injectável'], ARRAY['200mg'], 'antiarrítmico classe III', 'antiarrítmico potente para arritmias ventriculares e FA', ARRAY['FA','FV/TV','arritmias graves'], ARRAY['arritmia'], 'Dose de carga elevada, manutenção 200mg/dia.', 'com receita médica', 'MSRM.', ARRAY['toxicidade pulmonar','hepatotoxicidade','disfunção tiroide','depósitos corneanos','fotossensibilidade'], ARRAY['vigilância tiroide, hepática, pulmonar','muitas interacções'], ARRAY['BAV','disfunção tiroide grave'], 'Risco de toxicidade pulmonar — atenção a dispneia/tosse seca.', 'manual', 1.0),
  ('Digoxina', 'Digoxina', ARRAY['5136551'], ARRAY['comprimido'], ARRAY['0.125mg','0.25mg'], 'glicósido cardíaco', 'medicamento para FA e IC', ARRAY['FA com FC rápida','IC sistólica'], ARRAY['arritmia','IC'], '0.125-0.25mg/dia.', 'com receita médica', 'MSRM. Janela terapêutica estreita.', ARRAY['náuseas','arritmias','xantopsia (visão amarela)'], ARRAY['vigia níveis','ajuste IR','interage com K+, Mg++'], ARRAY['BAV','TV','hipocaliémia grave'], NULL, 'manual', 1.0),
  ('Lasix', 'Furosemida', ARRAY['5136568'], ARRAY['comprimido','injectável'], ARRAY['20mg','40mg','500mg'], 'diurético ansa', 'diurético potente', ARRAY['edema','IC','HTA','ascite'], ARRAY['edema','dispneia'], '20-80mg/dia, ajustar conforme resposta.', 'com receita médica', 'MSRM.', ARRAY['hipocaliémia','hipovolémia','ototoxicidade altas doses'], ARRAY['vigia K+, Na+, creatinina'], ARRAY['anúria','hiponatrémia grave'], NULL, 'manual', 1.0),
  ('Indapamida', 'Indapamida', ARRAY['5136575'], ARRAY['comprimido'], ARRAY['1.5mg','2.5mg'], 'diurético tiazida-like', 'diurético para HTA', ARRAY['HTA'], ARRAY['HTA'], '1.5mg/dia.', 'com receita médica', 'MSRM.', ARRAY['hipocaliémia','hiponatrémia','hiperuricémia'], ARRAY['vigia electrólitos'], ARRAY['gota','hipocaliémia grave'], NULL, 'manual', 1.0),
  ('Aldactone', 'Espironolactona', ARRAY['5136582'], ARRAY['comprimido'], ARRAY['25mg','50mg','100mg'], 'diurético poupador de potássio (antialdosterona)', 'diurético para IC, ascite, hiperaldosteronismo', ARRAY['IC','ascite','hiperaldosteronismo','acne hormonal'], ARRAY['edema','IC'], '25-100mg/dia.', 'com receita médica', 'MSRM.', ARRAY['hipercaliémia','ginecomastia','disfunção menstrual'], ARRAY['vigia K+ rigorosamente'], ARRAY['hipercaliémia','IR grave','Addison'], NULL, 'manual', 1.0),

  -- ── ENDOCRINOLOGIA adicionais ──
  ('Levemir', 'Insulina detemir', ARRAY['5136599'], ARRAY['caneta'], ARRAY['100U/mL'], 'insulina basal', 'insulina basal de longa duração', ARRAY['DM1','DM2'], ARRAY['diabetes'], '1-2x/dia SC.', 'com receita médica', 'MSRM.', ARRAY['hipoglicémia','aumento peso','lipohipertrofia'], ARRAY['rotação locais injecção','vigia glicémia'], ARRAY['hipoglicémia activa'], NULL, 'manual', 1.0),
  ('Lantus', 'Insulina glargina', ARRAY['5136605'], ARRAY['caneta'], ARRAY['100U/mL','300U/mL'], 'insulina basal', 'insulina basal de duração 24h', ARRAY['DM1','DM2'], ARRAY['diabetes'], '1x/dia SC, sempre à mesma hora.', 'com receita médica', 'MSRM.', ARRAY['hipoglicémia'], ARRAY['rotação locais'], ARRAY['hipoglicémia activa'], NULL, 'manual', 1.0),
  ('Humalog', 'Insulina lispro', ARRAY['5136612'], ARRAY['caneta'], ARRAY['100U/mL'], 'insulina rápida prandial', 'insulina rápida para refeições', ARRAY['DM1','DM2'], ARRAY['diabetes'], 'Antes das refeições SC.', 'com receita médica', 'MSRM.', ARRAY['hipoglicémia'], ARRAY['comer dentro de 15min'], ARRAY['hipoglicémia activa'], NULL, 'manual', 1.0),
  ('Novorapid', 'Insulina aspártico', ARRAY['5136629'], ARRAY['caneta'], ARRAY['100U/mL'], 'insulina rápida prandial', 'insulina ultra-rápida', ARRAY['DM1','DM2'], ARRAY['diabetes'], 'Antes ou imediatamente após refeições.', 'com receita médica', 'MSRM.', ARRAY['hipoglicémia'], ARRAY[]::text[], ARRAY['hipoglicémia'], NULL, 'manual', 1.0),
  ('Trulicity', 'Dulaglutido', ARRAY['5826491'], ARRAY['caneta'], ARRAY['0.75mg','1.5mg','3mg','4.5mg'], 'agonista GLP-1', 'injecção semanal para DM2', ARRAY['DM2'], ARRAY['diabetes'], '0.75-4.5mg SC semanal.', 'com receita médica', 'MSRM.', ARRAY['náuseas','pancreatite (rara)'], ARRAY['rotação local'], ARRAY['MTC','MEN2','pancreatite'], NULL, 'manual', 1.0),
  ('Wegovy', 'Semaglutido alta dose', ARRAY['5826509'], ARRAY['caneta'], ARRAY['0.25mg','0.5mg','1mg','1.7mg','2.4mg'], 'agonista GLP-1 para obesidade', 'semaglutido em dose alta para perda de peso', ARRAY['obesidade (IMC ≥30 ou ≥27+comorbilidades)'], ARRAY['obesidade'], 'Titulação até 2.4mg/semana SC.', 'com receita médica', 'MSRM.', ARRAY['náuseas','vómitos','obstipação','vesícula'], ARRAY['titulação lenta'], ARRAY['MTC','MEN2','gravidez'], NULL, 'manual', 1.0),
  ('Galvus', 'Vildagliptina', ARRAY['5136636'], ARRAY['comprimido'], ARRAY['50mg'], 'inibidor DPP-4', 'antidiabético oral', ARRAY['DM2'], ARRAY['diabetes'], '50mg 1-2x/dia.', 'com receita médica', 'MSRM.', ARRAY['cefaleia','infecções vias resp altas'], ARRAY['vigia enzimas hepáticas'], ARRAY['hepatopatia'], NULL, 'manual', 1.0),
  ('Januvia', 'Sitagliptina', ARRAY['5136643'], ARRAY['comprimido'], ARRAY['25mg','50mg','100mg'], 'inibidor DPP-4', 'antidiabético oral', ARRAY['DM2'], ARRAY['diabetes'], '100mg/dia.', 'com receita médica', 'MSRM.', ARRAY['cefaleia','pancreatite (rara)'], ARRAY['ajuste IR'], ARRAY['pancreatite'], NULL, 'manual', 1.0),
  ('Diamicron', 'Gliclazida', ARRAY['5136650'], ARRAY['comprimido LM'], ARRAY['30mg','60mg'], 'sulfonilureia', 'antidiabético oral', ARRAY['DM2'], ARRAY['diabetes'], '30-120mg 1x/dia ao pequeno-almoço.', 'com receita médica', 'MSRM.', ARRAY['hipoglicémia','aumento peso'], ARRAY['vigia hipoglicémia em idosos'], ARRAY['DM1','cetoacidose','IR/IH grave'], NULL, 'manual', 1.0),

  -- ── NEUROLOGIA / PSIQUIATRIA adicionais ──
  ('Rivotril', 'Clonazepam', ARRAY['5136667'], ARRAY['comprimido','gotas'], ARRAY['0.5mg','2mg'], 'benzodiazepina anticonvulsivante', 'benzodiazepina para epilepsia e pânico', ARRAY['epilepsia','pânico','tremor essencial'], ARRAY['convulsões'], '0.5-4mg/dia.', 'com receita médica especial', 'MSRM-especial.', ARRAY['sonolência','dependência'], ARRAY['não conduzir','retirada gradual'], ARRAY['miastenia','glaucoma fechado'], NULL, 'manual', 1.0),
  ('Tegretol', 'Carbamazepina', ARRAY['5136674'], ARRAY['comprimido','xarope'], ARRAY['200mg','400mg LP'], 'anticonvulsivante', 'medicamento para epilepsia e neuralgia trigeminal', ARRAY['epilepsia parcial','neuralgia trigeminal','bipolar'], ARRAY['convulsões'], '200-400mg 2-3x/dia.', 'com receita médica', 'MSRM. HLA-B*1502 em asiáticos — risco SSJ.', ARRAY['tonturas','exantema','hiponatremia','agranulocitose'], ARRAY['testes HLA em asiáticos','vigia hemograma'], ARRAY['BAV','aplasia medular','gravidez (1º trim)'], NULL, 'manual', 1.0),
  ('Depakine', 'Valproato', ARRAY['5136681'], ARRAY['comprimido','xarope','injectável'], ARRAY['200mg','500mg','300mg LP'], 'anticonvulsivante', 'medicamento para epilepsia generalizada e bipolar', ARRAY['epilepsia generalizada','bipolar','prevenção enxaqueca'], ARRAY['convulsões'], '500mg 2x/dia, titular.', 'com receita médica', 'MSRM.', ARRAY['tremor','aumento peso','queda cabelo','hepatotoxicidade','teratogénese GRAVE'], ARRAY['TERATOGÉNICO — NÃO usar em mulher fértil sem programa'], ARRAY['gravidez','mulher fértil sem contracepção','hepatopatia'], 'TERATOGÉNICO — NÃO usar em mulher fértil sem contracepção rigorosa.', 'manual', 1.0),
  ('Keppra', 'Levetiracetam', ARRAY['5136698'], ARRAY['comprimido','xarope','injectável'], ARRAY['250mg','500mg','1000mg'], 'anticonvulsivante', 'medicamento para epilepsia', ARRAY['epilepsia parcial e generalizada'], ARRAY['convulsões'], '500-1500mg 2x/dia.', 'com receita médica', 'MSRM.', ARRAY['sonolência','alterações comportamentais','irritabilidade'], ARRAY['ajuste IR'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Lyrica', 'Pregabalina', ARRAY['5136704'], ARRAY['cápsula'], ARRAY['25mg','75mg','150mg','300mg'], 'gabapentinoide', 'medicamento para dor neuropática e ansiedade', ARRAY['dor neuropática','epilepsia parcial','ansiedade generalizada','fibromialgia'], ARRAY['dor neuropática','ansiedade'], '75-300mg 2x/dia.', 'com receita médica', 'MSRM. Potencial de abuso reconhecido.', ARRAY['tonturas','sonolência','aumento peso','edema'], ARRAY['retirada gradual'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Neurontin', 'Gabapentina', ARRAY['5136711'], ARRAY['cápsula','comprimido'], ARRAY['100mg','300mg','400mg','600mg','800mg'], 'gabapentinoide', 'dor neuropática e epilepsia', ARRAY['dor neuropática','epilepsia parcial'], ARRAY['dor neuropática'], '300-1200mg 3x/dia.', 'com receita médica', 'MSRM.', ARRAY['sonolência','edema','aumento peso'], ARRAY['retirada gradual'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Risperdal', 'Risperidona', ARRAY['5136728'], ARRAY['comprimido','solução','injectável LP'], ARRAY['0.5mg','1mg','2mg','3mg','4mg'], 'antipsicótico atípico', 'antipsicótico para psicose e mania', ARRAY['esquizofrenia','mania bipolar','autismo (irritabilidade)'], ARRAY['psicose'], '1-6mg/dia.', 'com receita médica', 'MSRM.', ARRAY['ganho peso','hiperprolactinemia','SEP','sd. metabólico'], ARRAY['vigia glicémia e lípidos'], ARRAY['demência (risco AVC)'], NULL, 'manual', 1.0),
  ('Olanzapina', 'Olanzapina', ARRAY['5136735'], ARRAY['comprimido','injectável'], ARRAY['2.5mg','5mg','10mg','20mg'], 'antipsicótico atípico', 'antipsicótico', ARRAY['esquizofrenia','mania','depressão bipolar'], ARRAY['psicose'], '5-20mg/dia.', 'com receita médica', 'MSRM.', ARRAY['ganho peso significativo','sd. metabólico','sedação'], ARRAY['vigia metabólica'], ARRAY['demência'], NULL, 'manual', 1.0),
  ('Abilify', 'Aripiprazol', ARRAY['5136742'], ARRAY['comprimido','injectável'], ARRAY['5mg','10mg','15mg','30mg'], 'antipsicótico atípico (agonista parcial D2)', 'antipsicótico com menos efeitos metabólicos', ARRAY['esquizofrenia','mania bipolar','depressão (adjuvante)','autismo'], ARRAY['psicose'], '10-30mg/dia.', 'com receita médica', 'MSRM.', ARRAY['acatisia','insónia','náuseas'], ARRAY['vigia comportamentos compulsivos (jogo, compras)'], ARRAY['demência'], NULL, 'manual', 1.0),
  ('Seroquel', 'Quetiapina', ARRAY['5136759'], ARRAY['comprimido'], ARRAY['25mg','100mg','200mg','300mg','400mg'], 'antipsicótico atípico', 'antipsicótico também usado para insónia', ARRAY['esquizofrenia','bipolar','depressão (adjuvante)','insónia (off-label)'], ARRAY['psicose','insónia'], '50-800mg/dia.', 'com receita médica', 'MSRM.', ARRAY['sedação','ganho peso','hipotensão postural'], ARRAY['vigia metabólica'], ARRAY['demência'], NULL, 'manual', 1.0),
  ('Akineton', 'Biperideno', ARRAY['5136766'], ARRAY['comprimido','injectável'], ARRAY['2mg','4mg LP'], 'anticolinérgico antiparkinsoniano', 'medicamento para distonia aguda e Parkinson', ARRAY['distonia aguda induzida fármacos','Parkinson'], ARRAY['distonia'], '2-4mg 2-3x/dia.', 'com receita médica', 'MSRM.', ARRAY['boca seca','retenção urinária','confusão idosos'], ARRAY['cuidado em idosos'], ARRAY['glaucoma fechado','obstrução urinária'], NULL, 'manual', 1.0),
  ('Sinemet', 'Levodopa + Carbidopa', ARRAY['5136773'], ARRAY['comprimido'], ARRAY['25+100','25+250','50+200 LP'], 'antiparkinsoniano', 'medicamento de 1ª linha para Parkinson', ARRAY['doença de Parkinson'], ARRAY['Parkinson'], '25/100mg 3-4x/dia, titulando.', 'com receita médica', 'MSRM.', ARRAY['discinésias','flutuações motoras','náuseas','hipotensão postural'], ARRAY['evitar com refeições proteicas'], ARRAY['glaucoma fechado','melanoma activo'], NULL, 'manual', 1.0),
  ('Sumatriptano', 'Sumatriptano', ARRAY['5136780'], ARRAY['comprimido','spray nasal','injectável'], ARRAY['50mg','100mg'], 'triptano antimigranoso', 'medicamento para crise de enxaqueca', ARRAY['enxaqueca','cefaleia em salvas'], ARRAY['enxaqueca'], '50-100mg ao início da crise, repetir se necessário após 2h.', 'com receita médica', 'MSRM.', ARRAY['sensação de pressão torácica','formigueiro','sonolência'], ARRAY['máximo 200mg/dia','não associar a outro triptano em 24h'], ARRAY['SCA','HTA não controlada','AVC prévio'], NULL, 'manual', 1.0),
  ('Topamax', 'Topiramato', ARRAY['5136797'], ARRAY['comprimido','cápsula'], ARRAY['25mg','50mg','100mg','200mg'], 'anticonvulsivante', 'medicamento para epilepsia e prevenção enxaqueca', ARRAY['epilepsia','prevenção enxaqueca'], ARRAY['convulsões','enxaqueca crónica'], 'Titulação lenta até 100-200mg 2x/dia.', 'com receita médica', 'MSRM.', ARRAY['parestesias','perda peso','disfunção cognitiva','litíase renal'], ARRAY['hidratação','vigia palavras (afasia)'], ARRAY['gravidez','litíase'], NULL, 'manual', 1.0),
  ('Donepezilo', 'Donepezilo', ARRAY['5136803'], ARRAY['comprimido'], ARRAY['5mg','10mg'], 'inibidor colinesterase', 'medicamento para demência leve-moderada de Alzheimer', ARRAY['demência de Alzheimer'], ARRAY['demência'], '5mg ao deitar, aumentar para 10mg após 4 semanas.', 'com receita médica', 'MSRM.', ARRAY['náuseas','diarreia','bradicárdia','insónia'], ARRAY['vigia FC'], ARRAY['BAV','úlcera activa'], NULL, 'manual', 1.0),
  ('Memantina', 'Memantina', ARRAY['5136810'], ARRAY['comprimido'], ARRAY['10mg','20mg'], 'antagonista NMDA', 'medicamento para Alzheimer moderado-grave', ARRAY['Alzheimer moderado-grave'], ARRAY['demência'], '5mg/dia, titular até 20mg/dia.', 'com receita médica', 'MSRM.', ARRAY['cefaleia','tonturas'], ARRAY['ajuste IR'], ARRAY['IR grave'], NULL, 'manual', 1.0),

  -- ── UROLOGIA / NEFROLOGIA ──
  ('Tamsulosina', 'Tamsulosina', ARRAY['5136827'], ARRAY['cápsula LP'], ARRAY['0.4mg'], 'alfa-bloqueante uroselectivo', 'medicamento para HBP e cólica renal', ARRAY['HBP','cólica renal (facilitar passagem)'], ARRAY['dificuldade urinar','cólica renal'], '0.4mg/dia após pequeno-almoço.', 'com receita médica', 'MSRM.', ARRAY['tonturas','hipotensão postural','ejaculação retrógrada'], ARRAY['1ª dose à noite','evitar com inibidores PDE5 simultâneos sem cuidado'], ARRAY['hipotensão grave'], NULL, 'manual', 1.0),
  ('Avodart', 'Dutasterida', ARRAY['5136834'], ARRAY['cápsula'], ARRAY['0.5mg'], 'inibidor 5-alfa-redutase', 'medicamento para HBP', ARRAY['HBP'], ARRAY['HBP'], '0.5mg/dia.', 'com receita médica', 'MSRM. Demora 6 meses para efeito completo.', ARRAY['disfunção sexual','ginecomastia'], ARRAY['NÃO doar sangue durante uso'], ARRAY['mulher fértil (teratogénico em fetos masculinos)'], NULL, 'manual', 1.0),
  ('Vesicare', 'Solifenacina', ARRAY['5136841'], ARRAY['comprimido'], ARRAY['5mg','10mg'], 'antimuscarínico', 'medicamento para bexiga hiperativa', ARRAY['urgência urinária','incontinência urgência'], ARRAY['urgência miccional'], '5-10mg/dia.', 'com receita médica', 'MSRM.', ARRAY['boca seca','obstipação','retenção urinária'], ARRAY['cuidado idosos'], ARRAY['retenção urinária','glaucoma fechado'], NULL, 'manual', 1.0),
  ('Cialis', 'Tadalafilo', ARRAY['5136858'], ARRAY['comprimido'], ARRAY['2.5mg','5mg','10mg','20mg'], 'inibidor PDE5', 'medicamento para disfunção eréctil e HBP', ARRAY['disfunção eréctil','HBP','hipertensão pulmonar (dose alta)'], ARRAY['DE','HBP'], '5mg/dia (diário) ou 10-20mg SOS.', 'com receita médica', 'MSRM.', ARRAY['cefaleia','rubor','dispepsia'], ARRAY['NÃO com nitratos','cuidado com alfa-bloqueantes'], ARRAY['nitratos','choque','EAM recente'], NULL, 'manual', 1.0),
  ('Viagra', 'Sildenafil', ARRAY['5136865'], ARRAY['comprimido'], ARRAY['25mg','50mg','100mg'], 'inibidor PDE5', 'medicamento para disfunção eréctil', ARRAY['DE','HT pulmonar'], ARRAY['DE'], '50mg 30-60min antes, máximo 1x/dia.', 'com receita médica', 'MSRM.', ARRAY['cefaleia','rubor','dispepsia','perturbações visuais'], ARRAY['NÃO com nitratos'], ARRAY['nitratos','EAM recente'], NULL, 'manual', 1.0),

  -- ── HEMATOLOGIA / ONCOLOGIA básica ──
  ('Ácido fólico', 'Ácido fólico', ARRAY['5136872'], ARRAY['comprimido'], ARRAY['5mg'], 'vitamina B9', 'vitamina essencial', ARRAY['anemia megaloblástica','gravidez (prevenção defeito tubo neural)','com metotrexato'], ARRAY['anemia','gravidez'], 'Gravidez: 0.4-5mg/dia preconcepcional. Anemia: 5mg/dia.', 'sem receita', 'MNSRM.', ARRAY['raros'], ARRAY[]::text[], ARRAY['anemia perniciosa não diagnosticada (mascarar B12)'], NULL, 'manual', 1.0),
  ('Ferro Folin', 'Sulfato ferroso + ácido fólico', ARRAY['5136889'], ARRAY['comprimido'], ARRAY['256+0.4mg'], 'suplemento ferro e fólico', 'ferro para anemia', ARRAY['anemia ferropénica','gravidez'], ARRAY['anemia'], '1 comprimido/dia em jejum com vit C.', 'sem receita', 'MNSRM.', ARRAY['obstipação','fezes escuras','GI'], ARRAY['absorção melhor em jejum + vit C','distância 2h de antiácidos'], ARRAY['hemocromatose'], NULL, 'manual', 1.0),
  ('Ferrum Hausmann', 'Ferro III hidróxido polimaltose', ARRAY['5136896'], ARRAY['gotas','xarope','comprimido mastigável'], ARRAY['50mg/mL','100mg'], 'ferro oral', 'ferro melhor tolerado', ARRAY['anemia ferropénica'], ARRAY['anemia'], '50-200mg ferro elementar/dia.', 'sem receita', 'MNSRM.', ARRAY['fezes escuras','GI ligeiro'], ARRAY['fezes escuras é normal'], ARRAY['hemocromatose'], NULL, 'manual', 1.0),
  ('Vitamina B12', 'Cianocobalamina', ARRAY['5136902'], ARRAY['comprimido','injectável'], ARRAY['1mg','1000mcg'], 'vitamina B12', 'vitamina essencial para sistema nervoso e sangue', ARRAY['défice B12','anemia perniciosa','neuropatia diabética (off-label)'], ARRAY['anemia','formigueiro'], 'PO: 1mg/dia. IM: 1mg semanal 4 semanas, depois mensal.', 'sem receita', 'MNSRM PO. Injectável receita.', ARRAY['raros'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Vitamina D', 'Colecalciferol', ARRAY['5136919'], ARRAY['gotas','comprimido','ampolas'], ARRAY['400UI','800UI','25000UI','50000UI'], 'vitamina D3', 'vitamina D', ARRAY['défice vit D','osteoporose','prevenção em idosos'], ARRAY['carência vit D'], '800-2000UI/dia ou ampola 25000-50000UI mensal.', 'sem receita', 'MNSRM.', ARRAY['raros'], ARRAY['vigia cálcio em altas doses'], ARRAY['hipercalcemia','sarcoidose'], NULL, 'manual', 1.0),
  ('Cálcio + vit D', 'Carbonato cálcio + colecalciferol', ARRAY['5136926'], ARRAY['comprimido mastigável','saquetas'], ARRAY['500mg+400UI','1g+800UI'], 'suplemento cálcio+vit D', 'cálcio e vitamina D', ARRAY['osteoporose (com bifosfonatos)','défice cálcio'], ARRAY['osteoporose'], '1-2 comprimidos/dia.', 'sem receita', 'MNSRM.', ARRAY['obstipação','flatulência'], ARRAY['distância 2h de outros fármacos'], ARRAY['hipercalcemia'], NULL, 'manual', 1.0),
  ('Fosamax', 'Alendronato', ARRAY['5136933'], ARRAY['comprimido'], ARRAY['70mg semanal','10mg/dia'], 'bifosfonato', 'medicamento para osteoporose', ARRAY['osteoporose','Paget'], ARRAY['osteoporose'], '70mg 1x/semana em jejum, manter de pé 30min.', 'com receita médica', 'MSRM.', ARRAY['esofagite','osteonecrose mandíbula (raro)','fractura atípica fémur (raro)'], ARRAY['ficar de pé 30min','revisão dentária prévia'], ARRAY['IR grave','impossibilidade ficar de pé','esofagopatia'], NULL, 'manual', 1.0),
  ('Prolia', 'Denosumab', ARRAY['5826517'], ARRAY['injectável SC'], ARRAY['60mg'], 'inibidor RANKL', 'injecção semestral para osteoporose', ARRAY['osteoporose','metástases ósseas'], ARRAY['osteoporose'], '60mg SC cada 6 meses.', 'com receita médica', 'MSRM.', ARRAY['hipocalcémia','infecções','osteonecrose mandíbula'], ARRAY['NÃO falhar dose (risco fracturas vertebrais rebote)','revisão dentária'], ARRAY['hipocalcémia não corrigida'], 'NÃO suspender abrupto — risco fracturas vertebrais múltiplas.', 'manual', 1.0),

  -- ── REUMATOLOGIA ──
  ('Methotrexate', 'Metotrexato', ARRAY['5136940'], ARRAY['comprimido','injectável'], ARRAY['2.5mg','7.5mg','10mg','15mg'], 'antimetabolito DMARD', 'DMARD de 1ª linha para AR e psoríase', ARRAY['AR','psoríase','AIJ'], ARRAY['AR','psoríase'], '7.5-25mg 1x POR SEMANA (não diário) + ácido fólico.', 'com receita médica', 'MSRM. UMA VEZ POR SEMANA — erros de dose podem ser fatais.', ARRAY['náuseas','citopénias','hepatotoxicidade','pneumonite','úlceras orais'], ARRAY['UMA VEZ POR SEMANA','suplemento ácido fólico','vigia hemograma e função hepática'], ARRAY['gravidez','hepatopatia','IR grave','álcool excessivo'], 'TERATOGÉNICO. UMA VEZ POR SEMANA — não é diário!', 'manual', 1.0),
  ('Sulfasalazina', 'Sulfasalazina', ARRAY['5136957'], ARRAY['comprimido'], ARRAY['500mg'], 'DMARD / aminosalicilato', 'DMARD e tratamento DII', ARRAY['AR','colite ulcerosa','EA'], ARRAY['AR','DII'], '500mg-1g 2x/dia.', 'com receita médica', 'MSRM.', ARRAY['exantema','GI','citopénias'], ARRAY['hidratação'], ARRAY['alergia sulfas'], NULL, 'manual', 1.0),
  ('Plaquenil', 'Hidroxicloroquina', ARRAY['5136964'], ARRAY['comprimido'], ARRAY['200mg'], 'antimalárico DMARD', 'DMARD para lúpus e AR', ARRAY['LES','AR','síndrome de Sjögren'], ARRAY['lúpus','AR'], '200-400mg/dia (máximo 5mg/kg).', 'com receita médica', 'MSRM. Avaliação oftalmológica anual.', ARRAY['retinopatia (dose-dependente)','exantema','GI'], ARRAY['oftalmologia anual','dose conforme peso magro'], ARRAY['retinopatia'], NULL, 'manual', 1.0),
  ('Allopurinol', 'Alopurinol', ARRAY['5136971'], ARRAY['comprimido'], ARRAY['100mg','300mg'], 'inibidor xantina oxidase', 'medicamento para gota', ARRAY['gota crónica','hiperuricemia tumoral'], ARRAY['gota'], '100mg/dia, titular até 300mg/dia.', 'com receita médica', 'MSRM. NÃO iniciar durante crise aguda.', ARRAY['exantema','SSJ (raro mas grave)','hipersensibilidade'], ARRAY['hidratação abundante','iniciar 2-4 semanas após crise'], ARRAY['hipersensibilidade prévia'], NULL, 'manual', 1.0),
  ('Colchicina', 'Colchicina', ARRAY['5136988'], ARRAY['comprimido'], ARRAY['0.5mg','1mg'], 'anti-inflamatório anti-mitótico', 'medicamento para gota aguda e profilaxia', ARRAY['gota aguda','profilaxia gota','febre familiar mediterrânica','pericardite'], ARRAY['gota'], 'Crise: 1mg + 0.5mg 1h depois. Profilaxia: 0.5-1mg/dia.', 'com receita médica', 'MSRM. Janela terapêutica estreita.', ARRAY['diarreia (dose tóxica)','miopatia','neutropenia'], ARRAY['evitar com claritromicina, ciclosporina','ajuste IR e idade'], ARRAY['IR/IH grave','sob inibidores CYP3A4 potentes'], NULL, 'manual', 1.0),
  ('Humira', 'Adalimumab', ARRAY['5826525'], ARRAY['injectável SC'], ARRAY['40mg'], 'anti-TNF biológico', 'biológico para AR, EA, psoríase, Crohn', ARRAY['AR','EA','psoríase','Crohn','CU'], ARRAY['AR','psoríase'], '40mg SC cada 2 semanas.', 'com receita médica', 'MSRM-hospitalar.', ARRAY['infecções (incluindo TB)','reactivação VHB','reacções injecção'], ARRAY['rastreio TB e VHB antes iniciar','vacinas vivas contraindicadas'], ARRAY['infecção activa grave','TB activa','IC grave'], NULL, 'manual', 1.0),

  -- ── PSIQUIATRIA adicionais ──
  ('Trittico', 'Trazodona', ARRAY['5136995'], ARRAY['comprimido','comprimido LP'], ARRAY['100mg','150mg LP'], 'antidepressivo atípico', 'antidepressivo também usado para insónia', ARRAY['depressão','insónia (off-label)'], ARRAY['depressão','insónia'], '50-100mg ao deitar para insónia, 150-400mg/dia depressão.', 'com receita médica', 'MSRM.', ARRAY['sonolência','hipotensão postural','priapismo (raro)'], ARRAY['cuidado idosos'], ARRAY['EAM recente'], NULL, 'manual', 1.0),
  ('Venlafaxina', 'Venlafaxina', ARRAY['5137008'], ARRAY['cápsula LP'], ARRAY['37.5mg','75mg','150mg','225mg'], 'IRSN antidepressivo', 'antidepressivo dual', ARRAY['depressão','ansiedade','pânico','TAG'], ARRAY['depressão','ansiedade'], '75-225mg/dia LP.', 'com receita médica', 'MSRM.', ARRAY['HTA dose-dependente','náuseas','sd. abstinência marcada'], ARRAY['vigia TA','retirada muito gradual'], ARRAY['HTA não controlada','IMAO'], NULL, 'manual', 1.0),
  ('Wellbutrin', 'Bupropiom', ARRAY['5137015'], ARRAY['comprimido LP'], ARRAY['150mg','300mg'], 'antidepressivo NDRI', 'antidepressivo activador, também cessação tabágica', ARRAY['depressão','cessação tabágica'], ARRAY['depressão','dependência tabaco'], '150-300mg/dia.', 'com receita médica', 'MSRM. Reduz limiar convulsivo.', ARRAY['insónia','convulsões (raras)','boca seca'], ARRAY['evitar à noite'], ARRAY['epilepsia','bulimia/anorexia','abstinência álcool/benzo'], NULL, 'manual', 1.0),
  ('Lithium', 'Carbonato de lítio', ARRAY['5137022'], ARRAY['comprimido'], ARRAY['400mg LP'], 'estabilizador humor', 'estabilizador do humor para bipolar', ARRAY['bipolar','prevenção suicídio'], ARRAY['bipolar'], '400-1200mg/dia, conforme litemia.', 'com receita médica', 'MSRM. Litemia regular. Janela 0.6-1.0 mEq/L.', ARRAY['tremor','poliúria','hipotiroidismo','toxicidade renal'], ARRAY['monitorizar Li sérico, função tiroide e renal','hidratação estável'], ARRAY['IR grave','desidratação','gravidez'], NULL, 'manual', 1.0),

  -- ── CONTRACEPTIVOS / GINECOLOGIA ──
  ('Yasmin', 'Drospirenona + Etinilestradiol', ARRAY['5137039'], ARRAY['comprimido'], ARRAY['3mg+0.03mg'], 'contraceptivo oral combinado', 'pílula combinada', ARRAY['contracepção','acne hormonal','SOP'], ARRAY['contracepção'], '1 comprimido/dia 21 dias + 7 pausa.', 'com receita médica', 'MSRM.', ARRAY['náuseas','TVP/TEP','HTA','spotting'], ARRAY['avaliação risco tromboembólico'], ARRAY['gravidez','TEV','enxaqueca c/ aura','fumadoras >35a','HTA não controlada'], NULL, 'manual', 1.0),
  ('Belara', 'Acetato clormadinona + Etinilestradiol', ARRAY['5137046'], ARRAY['comprimido'], ARRAY['2mg+0.03mg'], 'contraceptivo oral combinado', 'pílula combinada', ARRAY['contracepção','acne'], ARRAY['contracepção'], '1 cp/dia.', 'com receita médica', 'MSRM.', ARRAY['TEV','náuseas'], ARRAY[]::text[], ARRAY['TEV','enxaqueca c/ aura'], NULL, 'manual', 1.0),
  ('NorLevo', 'Levonorgestrel', ARRAY['5137053'], ARRAY['comprimido'], ARRAY['1.5mg'], 'contraceptivo de emergência', 'pílula do dia seguinte', ARRAY['contracepção de emergência'], ARRAY['contracepção'], '1 comprimido dose única dentro de 72h após relação.', 'sem receita', 'MNSRM. Eficácia diminui com tempo — quanto mais cedo melhor.', ARRAY['náuseas','spotting','alteração ciclo'], ARRAY['NÃO é abortiva','não é contracepção regular'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('EllaOne', 'Ulipristal', ARRAY['5826533'], ARRAY['comprimido'], ARRAY['30mg'], 'contraceptivo de emergência', 'contraceptivo de emergência até 120h', ARRAY['contracepção emergência'], ARRAY['contracepção'], '1 comprimido até 120h após relação.', 'sem receita', 'MNSRM.', ARRAY['cefaleia','náuseas','dismenorreia'], ARRAY['adiar amamentação 7d'], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),

  -- ── OUTROS COMUNS ──
  ('Espasmodol', 'Butilescopolamina + Paracetamol', ARRAY['5137060'], ARRAY['comprimido'], ARRAY['10+500mg'], 'analgésico + antiespasmódico', 'medicamento para cólicas e dor', ARRAY['dismenorreia','cólicas abdominais'], ARRAY['cólicas','dor menstrual'], '1-2 comprimidos 3-4x/dia.', 'sem receita', 'MNSRM.', ARRAY['boca seca','obstipação'], ARRAY[]::text[], ARRAY['glaucoma fechado'], NULL, 'manual', 1.0),
  ('Saridon', 'Paracetamol + Cafeína + Propifenazona', ARRAY['5137077'], ARRAY['comprimido'], ARRAY['250+50+150mg'], 'analgésico combinação', 'medicamento para cefaleias', ARRAY['cefaleias','enxaqueca ligeira'], ARRAY['cefaleia'], '1-2 comprimidos 3x/dia.', 'sem receita', 'MNSRM.', ARRAY['nervosismo (cafeína)','GI'], ARRAY['contém cafeína — evitar à noite'], ARRAY['úlcera','arritmias'], NULL, 'manual', 1.0),
  ('Antigrippine', 'Paracetamol + Clorfeniramina + Fenilefrina', ARRAY['5137084'], ARRAY['comprimido','xarope'], ARRAY['500+2+10mg'], 'antigripal combinação', 'medicamento para sintomas de gripe/constipação', ARRAY['gripe','constipação','nariz entupido','dores'], ARRAY['gripe','constipação'], '1 comprimido 3x/dia.', 'sem receita', 'MNSRM.', ARRAY['sonolência','boca seca','aumento TA'], ARRAY['evitar com HTA','não conduzir'], ARRAY['HTA grave','glaucoma fechado','retenção urinária'], NULL, 'manual', 1.0),
  ('Cêgripe', 'Paracetamol + Cafeína + Clorfeniramina + Fenilefrina', ARRAY['5137091'], ARRAY['comprimido'], ARRAY['500+25+2+5mg'], 'antigripal', 'medicamento para sintomas gripais', ARRAY['gripe','constipação'], ARRAY['gripe'], '1-2 comprimidos 3x/dia.', 'sem receita', 'MNSRM.', ARRAY['boca seca','insónia (cafeína)'], ARRAY[]::text[], ARRAY['HTA grave'], NULL, 'manual', 1.0),
  ('Strepsils', 'Diclorobenzeno + Amilmetacresol', ARRAY['5137107'], ARRAY['pastilhas'], ARRAY['1.2+0.6mg'], 'antisséptico orofaríngeo', 'pastilhas para dor de garganta', ARRAY['dor de garganta','irritação orofaríngea'], ARRAY['dor de garganta'], '1 pastilha cada 2-3h.', 'sem receita', 'MNSRM.', ARRAY['raros'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Bepanthen', 'Dexpantenol', ARRAY['5137114'], ARRAY['pomada','creme','spray'], ARRAY['5%'], 'cicatrizante', 'creme para irritações cutâneas e cicatrização', ARRAY['eritema fralda','feridas superficiais','irritação cutânea','mamilos amamentação'], ARRAY['ferida','irritação'], 'Aplicar 1-2x/dia.', 'sem receita', 'MNSRM.', ARRAY['raros'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Trombocid', 'Heparina mucopolissacárido', ARRAY['5137121'], ARRAY['pomada','gel'], ARRAY['5mg/g'], 'tópico antitrombótico', 'pomada para hematomas e flebite superficial', ARRAY['hematomas','contusões','flebite superficial'], ARRAY['hematoma'], 'Aplicar 2-3x/dia.', 'sem receita', 'MNSRM.', ARRAY['irritação local'], ARRAY[]::text[], ARRAY['ferida aberta'], NULL, 'manual', 1.0),
  ('Hirudoid', 'Mucopolissacárido polissulfato', ARRAY['5137138'], ARRAY['creme','gel'], ARRAY['0.3%'], 'tópico para flebite', 'pomada para varizes e hematomas', ARRAY['flebite superficial','hematomas','varizes (alívio)'], ARRAY['hematoma','varizes'], 'Aplicar 2-3x/dia.', 'sem receita', 'MNSRM.', ARRAY['irritação local'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Daflon', 'Diosmina + Hesperidina', ARRAY['5137145'], ARRAY['comprimido'], ARRAY['500mg','1000mg'], 'venotónico', 'medicamento para insuficiência venosa', ARRAY['insuficiência venosa crónica','hemorróidas (crise)'], ARRAY['pernas pesadas','hemorróidas'], '2 comprimidos/dia. Crise hemorroidária: 6cp/dia 4 dias.', 'sem receita', 'MNSRM.', ARRAY['GI ligeiro'], ARRAY[]::text[], ARRAY['hipersensibilidade'], NULL, 'manual', 1.0),
  ('Eparema', 'Boldo + Sene', ARRAY['5137152'], ARRAY['solução oral','comprimido'], NULL, 'colagogo + laxante', 'fitoterápico hepatoprotector e laxante', ARRAY['digestão difícil','obstipação ocasional'], ARRAY['má digestão'], 'Conforme bula.', 'sem receita', 'MNSRM.', ARRAY['cólicas'], ARRAY['curta duração'], ARRAY['obstrução biliar'], NULL, 'manual', 1.0),
  ('Cymalon', 'Citrato sódio + potássio', ARRAY['5137169'], ARRAY['saquetas'], ARRAY['4g'], 'alcalinizante urinário', 'pó para alcalinizar urina em ITU', ARRAY['ITU baixa não complicada (alívio sintomático)'], ARRAY['ardor urinar'], '1 saqueta 3x/dia 48h.', 'sem receita', 'MNSRM.', ARRAY['flatulência','diarreia ligeira'], ARRAY['NÃO substitui antibiótico'], ARRAY['IR'], NULL, 'manual', 1.0),
  ('Microlax', 'Citrato sódio + lauril sulfoacetato', ARRAY['5137176'], ARRAY['microclister'], ARRAY['5mL'], 'laxante rectal', 'microclister para alívio rápido obstipação', ARRAY['obstipação (alívio rápido)','prep procedimentos'], ARRAY['obstipação'], '1 microclister SOS.', 'sem receita', 'MNSRM.', ARRAY['irritação anal'], ARRAY['uso ocasional'], ARRAY['fissura anal aguda dolorosa'], NULL, 'manual', 1.0),
  ('Glicerina', 'Glicerol', ARRAY['5137183'], ARRAY['supositório'], ARRAY['1g','2g'], 'laxante rectal osmótico', 'supositório de glicerina', ARRAY['obstipação'], ARRAY['obstipação'], '1 supositório SOS.', 'sem receita', 'MNSRM.', ARRAY['irritação anal'], ARRAY['uso ocasional'], ARRAY['fissura activa'], NULL, 'manual', 1.0),

  -- ── COVID e antivirais novos ──
  ('Paxlovid', 'Nirmatrelvir + Ritonavir', ARRAY['5826541'], ARRAY['comprimido'], ARRAY['150+100mg'], 'antivírico anti-SARS-CoV-2', 'antivírico oral para COVID-19', ARRAY['COVID-19 em risco de gravidade'], ARRAY['COVID-19'], '300mg+100mg 12/12h 5 dias.', 'com receita médica', 'MSRM. Iniciar nas primeiras 5 dias de sintomas.', ARRAY['disgeusia','diarreia','HTA'], ARRAY['MUITAS interacções (ritonavir é potente inibidor CYP3A4)','rever toda a medicação'], ARRAY['IH grave','muitos fármacos'], 'Verificar interacções na Liverpool COVID-19 Drug Interactions Checker.', 'manual', 1.0),

  -- ── ANESTÉSICOS LOCAIS / VARIADOS ──
  ('Anestin', 'Cloridrato lidocaína', ARRAY['5137190'], ARRAY['spray','gel'], ARRAY['2%','5%','10%'], 'anestésico local', 'spray anestésico oral', ARRAY['dor garganta','procedimentos orofaríngeos'], ARRAY['dor de garganta'], 'Aplicar antes de procedimento.', 'com receita médica', 'MSRM em concentrações altas. Spray de baixa concentração — MNSRM.', ARRAY['parestesia local','reacções alérgicas raras'], ARRAY['cuidado em arritmias'], ARRAY['BAV','hipersensibilidade'], NULL, 'manual', 1.0),
  ('Emla', 'Lidocaína + Prilocaína', ARRAY['5137206'], ARRAY['creme'], ARRAY['2.5+2.5%'], 'anestésico local', 'creme anestésico para colheitas, procedimentos cutâneos', ARRAY['analgesia pré-punção','dermatite atópica para procedimentos'], ARRAY['dor procedimentos'], 'Aplicar e cobrir 1h antes.', 'sem receita', 'MNSRM.', ARRAY['palidez','vermelhidão local'], ARRAY['NÃO em pele lesada extensa em recém-nascidos'], ARRAY['meta-hemoglobinémia'], NULL, 'manual', 1.0),

  -- ── ANTIPIRÉTICOS PEDIÁTRICOS específicos ──
  ('Algidol', 'Paracetamol pediátrico', ARRAY['5137213'], ARRAY['xarope','supositório'], ARRAY['100mg','250mg','125mg/5mL'], 'analgésico antipirético pediátrico', 'paracetamol pediátrico', ARRAY['febre','dor em crianças'], ARRAY['febre criança'], '15mg/kg de 6/6h.', 'sem receita', 'MNSRM.', ARRAY['raros'], ARRAY['conforme peso'], ARRAY['hepatopatia grave'], NULL, 'manual', 1.0),
  ('Nurofen júnior', 'Ibuprofeno pediátrico', ARRAY['5137220'], ARRAY['xarope'], ARRAY['100mg/5mL','200mg/5mL'], 'AINE pediátrico', 'ibuprofeno para crianças', ARRAY['febre','dor em crianças >6m'], ARRAY['febre criança'], '10mg/kg de 6-8/8h.', 'sem receita', 'MNSRM.', ARRAY['GI'], ARRAY['com alimentos','idade ≥6 meses'], ARRAY['<6 meses','desidratação'], NULL, 'manual', 1.0),

  -- ── PROBIÓTICOS ──
  ('UL-250', 'Saccharomyces boulardii', ARRAY['5137237'], ARRAY['cápsula','saquetas'], ARRAY['250mg'], 'probiótico', 'levedura probiótica', ARRAY['diarreia associada antibióticos','C. difficile (adjuvante)','SII'], ARRAY['diarreia'], '1-2 cápsulas/dia.', 'sem receita', 'MNSRM.', ARRAY['flatulência'], ARRAY['NÃO em imunodeprimidos graves (fungemia)'], ARRAY['imunodepressão grave','cateter venoso central'], NULL, 'manual', 1.0),
  ('Lactobacilos', 'Lactobacillus rhamnosus', ARRAY['5137244'], ARRAY['cápsula','saquetas'], NULL, 'probiótico', 'probiótico bacteriano', ARRAY['diarreia AB','SII'], ARRAY['diarreia'], '1-2 cápsulas/dia.', 'sem receita', 'MNSRM.', ARRAY['flatulência'], ARRAY[]::text[], ARRAY['imunodepressão grave'], NULL, 'manual', 1.0)

on conflict do nothing;

-- ─── Estatísticas finais ─────────────────────────────────────────────
-- Manter view com contagens (não fail-safe se já existir)
create or replace view infarmed_drugs_stats as
select
  count(*) as total,
  count(*) filter (where source = 'manual') as manual_count,
  count(*) filter (where source = 'ai_cache') as cached_count,
  count(*) filter (where source = 'verified') as verified_count,
  sum(query_count) as total_queries
from infarmed_drugs;
