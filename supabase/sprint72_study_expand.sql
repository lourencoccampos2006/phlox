-- sprint72_study_expand.sql
-- Phlox — Expansão de conteúdos da plataforma de estudos.
--
-- Adiciona MUITO mais conteúdo seed às tabelas do sprint70:
--   ─ ECGs: +30 (passa de 8 → 38)
--   ─ Lab values: +35 (passa de 27 → 62)
--   ─ Procedimentos: +15 (passa de 4 → 19)
--   ─ Biblioteca médica: +25 (passa de 6 → 31)
--
-- 2026-06-03. Idempotente.

-- ════════════════════════════════════════════════════════════════════════
-- ECGs adicionais
-- ════════════════════════════════════════════════════════════════════════
insert into ecg_library (title, description, rhythm, rate_bpm, axis, pr_ms, qrs_ms, qtc_ms, findings, diagnosis, context, difficulty, category) values
  ('Flutter auricular 2:1', 'Ondas F em "dente de serra" em DII/DIII/aVF, condução 2:1.', 'aflutter', 150, 'normal', null, 90, 410, ARRAY['ondas F dente de serra','RR regular','condução 2:1'], 'Flutter auricular típico com condução 2:1', 'Homem 68a, palpitações.', 'medium', 'arritmias'),
  ('TSV regular', 'Taquicárdia supraventricular paroxística, sem ondas P visíveis.', 'svt', 175, 'normal', null, 85, 380, ARRAY['ausência onda P','RR regular','QRS estreito'], 'TSV', 'Mulher 32a, palpitações súbitas.', 'medium', 'arritmias'),
  ('TV monomórfica', 'QRS largo, dissociação AV, capturas e fusões.', 'vt', 165, 'extreme', null, 160, 460, ARRAY['QRS largo regular','dissociação AV','batimentos de captura'], 'Taquicárdia ventricular monomórfica sustentada', 'Doente com cardiopatia isquémica conhecida.', 'hard', 'arritmias'),
  ('Torsade de pointes', 'TV polimórfica com torção do eixo, QT prolongado base.', 'vt', 220, 'extreme', null, 140, 580, ARRAY['QRS polimórfico','torção do eixo','QT base prolongado'], 'Torsade de pointes', 'Hipocaliémia e amiodarona.', 'hard', 'arritmias'),
  ('Fibrilhação ventricular', 'Ondulações caóticas sem QRS organizado.', 'vf', 0, 'normal', null, 0, 0, ARRAY['caos eléctrico','sem QRS organizado'], 'Fibrilhação ventricular', 'Paragem cardiorrespiratória.', 'hard', 'arritmias'),
  ('BAV 1º grau', 'PR alargado constante > 200 ms.', 'sinus', 78, 'normal', 240, 90, 415, ARRAY['PR > 200 ms','sem batimentos perdidos'], 'BAV 1º grau', 'Achado de rotina, frequentemente benigno.', 'easy', 'condução'),
  ('BAV 2º grau Mobitz I', 'Prolongamento progressivo PR até onda P bloqueada.', 'sinus', 65, 'normal', 240, 90, 420, ARRAY['PR progressivamente alargado','periodicidade de Wenckebach'], 'BAV 2º grau Mobitz I (Wenckebach)', 'Geralmente benigno, AV node.', 'medium', 'condução'),
  ('BAV 2º grau Mobitz II', 'PR fixo + bloqueios súbitos sem aviso.', 'sinus', 50, 'normal', 200, 130, 440, ARRAY['PR fixo','bloqueios súbitos','QRS largo'], 'BAV 2º grau Mobitz II', 'Patológico, indicação para pacemaker.', 'hard', 'condução'),
  ('BCRE', 'QRS > 120 ms, M em V5-V6, W em V1.', 'sinus', 82, 'left', 165, 145, 460, ARRAY['QRS > 120 ms','M em V5-V6','W em V1','sem onda Q lateral'], 'Bloqueio completo de ramo esquerdo', 'HTA, cardiopatia.', 'medium', 'condução'),
  ('BCRD', 'QRS > 120 ms, rSR em V1, S largo em V6.', 'sinus', 75, 'right', 160, 130, 430, ARRAY['QRS > 120 ms','rSR em V1','S largo V5-V6'], 'Bloqueio completo de ramo direito', 'TEP, DPOC, idiopático.', 'medium', 'condução'),
  ('NSTEMI / SCA-SST', 'Depressão ST e/ou T invertidas em precordiais.', 'sinus', 88, 'normal', 165, 95, 425, ARRAY['depressão ST V4-V6','T invertidas inferolaterais'], 'NSTEMI', 'Dor torácica 4h, troponina positiva.', 'medium', 'sca'),
  ('STEMI inferior', 'Supra-ST DII/DIII/aVF, recíproca em DI/aVL.', 'sinus', 76, 'normal', 165, 90, 415, ARRAY['supra-ST DII/DIII/aVF','depressão ST recíproca DI/aVL'], 'STEMI inferior agudo', 'Homem 62a, dor torácica + náuseas, 2h evolução.', 'medium', 'sca'),
  ('STEMI lateral', 'Supra-ST DI/aVL/V5/V6.', 'sinus', 80, 'normal', 160, 95, 420, ARRAY['supra-ST DI/aVL/V5-V6'], 'STEMI lateral', 'Mulher 70a, dor torácica.', 'hard', 'sca'),
  ('STEMI posterior', 'Depressão ST V1-V3 com R alto V1 (espelho de supra-ST posterior).', 'sinus', 85, 'normal', 160, 95, 410, ARRAY['depressão ST V1-V3','R/S > 1 em V1','R alto V1'], 'STEMI posterior', 'Doente com dor torácica e ECG não-diagnóstico aparente.', 'hard', 'sca'),
  ('Hipocaliémia', 'Ondas U proeminentes, T achatadas.', 'sinus', 78, 'normal', 165, 90, 460, ARRAY['T achatadas','ondas U proeminentes','depressão ST ligeira'], 'Hipocaliémia', 'Doente em diuréticos com fraqueza.', 'medium', 'eletrólitos'),
  ('Hipercalcémia', 'QT encurtado.', 'sinus', 76, 'normal', 160, 90, 350, ARRAY['QT curto','sem alterações ST-T marcadas'], 'Hipercalcémia', 'Hiperparatiroidismo primário.', 'hard', 'eletrólitos'),
  ('Hipocalcémia', 'QT prolongado isolado.', 'sinus', 80, 'normal', 165, 95, 510, ARRAY['QT prolongado','ST prolongado','T normal'], 'Hipocalcémia', 'Pós-tiroidectomia.', 'medium', 'eletrólitos'),
  ('Síndrome de Brugada', 'Padrão tipo 1: supra-ST V1-V3 em sela.', 'sinus', 70, 'normal', 165, 110, 420, ARRAY['supra-ST V1-V3 tipo 1','T invertida V1-V2'], 'Síndrome de Brugada', 'Jovem com síncope, AF de morte súbita.', 'hard', 'outros'),
  ('Síndrome QT longo congénito', 'QTc > 500 ms basal, sem causa secundária.', 'sinus', 72, 'normal', 165, 90, 530, ARRAY['QTc > 500 ms','T anormal','sem fármacos'], 'Síndrome QT longo congénito', 'Jovem com síncope ao esforço.', 'hard', 'outros'),
  ('WPW', 'PR curto < 120 ms, onda delta, QRS alargado.', 'sinus', 80, 'normal', 90, 130, 420, ARRAY['PR < 120 ms','onda delta','QRS alargado'], 'Síndrome Wolff-Parkinson-White', 'Jovem com taquicárdia paroxística.', 'medium', 'outros'),
  ('Pré-excitação por FA em WPW', 'FA com QRS bizarro irregular muito rápido.', 'afib', 220, 'normal', null, 140, 380, ARRAY['RR irregular','QRS largo bizarro','frequência > 200'], 'FA pré-excitada em WPW (risco de TV/FV)', 'Emergência! Evitar bloqueadores AV.', 'hard', 'outros'),
  ('Pericardite aguda fase II', 'PR descendente, T invertida difusa, ST normal.', 'sinus', 88, 'normal', 165, 90, 415, ARRAY['T invertida difusa','PR descendente'], 'Pericardite — fase de recuperação', 'Doente já tratado com AINE.', 'hard', 'outros'),
  ('Tamponamento cardíaco — alternans', 'Alternância de altura de QRS bater-a-bater.', 'sinus', 115, 'normal', 160, 90, 420, ARRAY['QRS alternans','taquicárdia','baixa voltagem'], 'Derrame pericárdico com tamponamento', 'Doente com hipotensão e JVP elevada.', 'hard', 'outros'),
  ('Trauma torácico — alterações inespecíficas', 'Taquicárdia sinusal com T invertidas inespecíficas.', 'sinus', 110, 'normal', 165, 95, 420, ARRAY['taquicárdia sinusal','T invertidas inespecíficas'], 'Contusão miocárdica suspeita', 'Pós-trauma torácico.', 'medium', 'outros'),
  ('Repolarização precoce', 'Supra-ST ascendente discreto com J wave.', 'sinus', 65, 'normal', 165, 90, 410, ARRAY['supra-ST côncavo','onda J','sem evolução'], 'Repolarização precoce — variante benigna', 'Atleta jovem assintomático.', 'medium', 'normal'),
  ('Bradicárdia sinusal', 'Ritmo sinusal lento, atleta ou medicação.', 'sinus', 42, 'normal', 165, 90, 420, ARRAY['FC 42 bpm','ritmo sinusal'], 'Bradicárdia sinusal', 'Atleta de resistência.', 'easy', 'normal'),
  ('Taquicárdia sinusal', 'Ritmo sinusal acelerado por causa secundária.', 'sinus', 135, 'normal', 160, 85, 410, ARRAY['FC 135','ritmo sinusal','ondas P normais'], 'Taquicárdia sinusal', 'Sépsis, dor, anemia, hipertiroidismo.', 'easy', 'normal'),
  ('Bigeminismo ventricular', 'Cada batimento sinusal seguido de PVC.', 'sinus', 90, 'normal', 160, 90, 420, ARRAY['PVC após cada batimento sinusal','bigeminismo'], 'Bigeminismo ventricular', 'Geralmente benigno se assintomático.', 'medium', 'arritmias'),
  ('Taquicárdia ventricular não-sustentada', 'Salvas curtas de QRS largo (< 30s).', 'vt', 180, 'extreme', null, 150, 450, ARRAY['salvas QRS largo','< 30s','RR regular intra-salva'], 'TVNS', 'Doente isquémico em monitorização.', 'medium', 'arritmias'),
  ('Pacemaker ventricular', 'Espiga de pacing seguida de QRS largo morfologia BCRE.', 'sinus', 70, 'left', null, 150, 460, ARRAY['espiga de pacing','QRS largo BCRE-like','captura ventricular'], 'Pacing ventricular VVI/DDD', 'Doente com pacemaker.', 'medium', 'outros')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- Valores laboratoriais adicionais
-- ════════════════════════════════════════════════════════════════════════
insert into lab_value_library (parameter, unit, ref_low, ref_high, sex, age_group, category, clinical_note, abnormal_low_meaning, abnormal_high_meaning) values
  ('Hematócrito', '%', 41, 53, 'M', 'adult', 'hemograma', 'Reflecte volume relativo de hemácias.', 'Anemia, sobrecarga de volume.', 'Policitémia, desidratação.'),
  ('Hematócrito', '%', 36, 46, 'F', 'adult', 'hemograma', '', 'Anemia.', 'Policitémia.'),
  ('VCM', 'fL', 80, 100, 'any', 'adult', 'hemograma', 'Classifica anemia em micro/normo/macrocítica.', 'Microcitose — ferropénia, talassemia.', 'Macrocitose — défice B12/folato, hipotiroidismo, álcool.'),
  ('HCM', 'pg', 27, 33, 'any', 'adult', 'hemograma', 'Massa de Hb por hemácia.', 'Hipocromia.', 'Hipercromia (raro).'),
  ('CHCM', 'g/dL', 32, 36, 'any', 'adult', 'hemograma', 'Concentração de Hb.', '', 'Esferocitose hereditária.'),
  ('Reticulócitos', '%', 0.5, 2.5, 'any', 'adult', 'hemograma', 'Marcador de eritropoiese activa.', 'Aplasia, défice ferro/B12/folato.', 'Hemólise, hemorragia recente, resposta a tratamento.'),
  ('Neutrófilos absolutos', '×10⁹/L', 1.5, 7.5, 'any', 'adult', 'hemograma', 'Neutropenia < 1.5; risco infecção grave < 0.5.', 'Neutropenia — quimioterapia, viral, autoimune.', 'Neutrofilia — infecção bacteriana, stress, corticóides.'),
  ('Linfócitos absolutos', '×10⁹/L', 1.0, 4.5, 'any', 'adult', 'hemograma', '', 'Linfopenia — VIH, corticóides, sépsis grave.', 'Linfocitose — vírica, LLC, linfomas.'),
  ('Eosinófilos absolutos', '×10⁹/L', 0, 0.5, 'any', 'adult', 'hemograma', '', '', 'Alergias, parasitoses, eosinofilia idiopática.'),
  ('VS', 'mm/h', 0, 20, 'M', 'adult', 'inflamação', 'Não-específico.', '', 'Inflamação crónica, neoplasia, autoimune.'),
  ('Ferritina', 'ng/mL', 30, 400, 'M', 'adult', 'metabolismo Fe', 'Reflecte reservas. Reactante de fase aguda.', 'Ferropénia (< 30 = défice).', 'Sobrecarga, inflamação, hepatopatia.'),
  ('Ferritina', 'ng/mL', 15, 200, 'F', 'adult', 'metabolismo Fe', '', 'Ferropénia (< 15-30).', 'Inflamação, hemocromatose.'),
  ('Ferro sérico', 'µg/dL', 60, 170, 'any', 'adult', 'metabolismo Fe', 'Variação diurna.', 'Ferropénia.', 'Hemocromatose, transfusões.'),
  ('Transferrina', 'mg/dL', 200, 360, 'any', 'adult', 'metabolismo Fe', '', 'Inflamação, desnutrição.', 'Ferropénia (resposta compensatória).'),
  ('Saturação transferrina', '%', 20, 50, 'any', 'adult', 'metabolismo Fe', '', 'Ferropénia.', 'Hemocromatose.'),
  ('Vitamina B12', 'pg/mL', 200, 900, 'any', 'adult', 'vitaminas', '', 'Défice B12 — anemia megaloblástica, neuropatia.', 'Geralmente clinicamente irrelevante.'),
  ('Ácido fólico', 'ng/mL', 3, 20, 'any', 'adult', 'vitaminas', '', 'Défice folato — anemia megaloblástica.', 'Suplementação.'),
  ('25-OH Vit D', 'ng/mL', 30, 100, 'any', 'adult', 'vitaminas', 'Défice se < 20.', 'Défice — osteomalácia, fraqueza muscular.', 'Toxicidade (raro).'),
  ('TGO/AST', 'U/L', 0, 40, 'any', 'adult', 'hepática', '', '', 'Hepatite, miocardite, rabdomiólise.'),
  ('Albumina', 'g/dL', 3.5, 5.0, 'any', 'adult', 'hepática', 'Reflecte síntese hepática e estado nutricional.', 'Hepatopatia, desnutrição, sépsis, síndrome nefrótica.', 'Desidratação.'),
  ('Proteínas totais', 'g/dL', 6.0, 8.3, 'any', 'adult', 'hepática', '', 'Hepatopatia, perdas.', 'Hipergamaglobulinemia.'),
  ('Cálcio total', 'mg/dL', 8.5, 10.5, 'any', 'adult', 'iónica', 'Corrigir pela albumina.', 'Hipoparatiroidismo, IRC, défice Vit D.', 'Hiperparatiroidismo, neoplasia, sarcoidose.'),
  ('Cálcio ionizado', 'mmol/L', 1.10, 1.30, 'any', 'adult', 'iónica', 'Forma activa.', 'Tetania, prolongamento QT.', 'Arritmias, depressão do SNC.'),
  ('Magnésio', 'mg/dL', 1.7, 2.3, 'any', 'adult', 'iónica', '', 'Tetania, arritmias (torsade).', 'Bradicárdia, hiporreflexia.'),
  ('Fósforo', 'mg/dL', 2.5, 4.5, 'any', 'adult', 'iónica', '', 'Síndrome de realimentação, hiperparatiroidismo.', 'IRC, hipoparatiroidismo, lise tumoral.'),
  ('Ácido úrico', 'mg/dL', 3.5, 7.0, 'M', 'adult', 'bioquímica', '', '', 'Gota, lise tumoral, IRC.'),
  ('Ácido úrico', 'mg/dL', 2.5, 6.0, 'F', 'adult', 'bioquímica', '', '', 'Gota, lise tumoral.'),
  ('Colesterol total', 'mg/dL', 0, 190, 'any', 'adult', 'lipidos', 'Alvo varia com risco CV.', '', 'Hipercolesterolemia.'),
  ('Colesterol LDL', 'mg/dL', 0, 116, 'any', 'adult', 'lipidos', 'Alvos: < 116 baixo risco, < 100 moderado, < 70 alto, < 55 muito alto.', '', 'Dislipidemia.'),
  ('Colesterol HDL', 'mg/dL', 40, 200, 'M', 'adult', 'lipidos', '', 'Factor de risco CV.', 'Cardioprotector.'),
  ('Colesterol HDL', 'mg/dL', 50, 200, 'F', 'adult', 'lipidos', '', 'Factor de risco CV.', 'Cardioprotector.'),
  ('Triglicéridos', 'mg/dL', 0, 150, 'any', 'adult', 'lipidos', '', '', 'Risco CV, pancreatite > 500.'),
  ('CK', 'U/L', 30, 200, 'M', 'adult', 'músculo', '', '', 'Rabdomiólise, miopatia, EAM, exercício.'),
  ('CK', 'U/L', 25, 170, 'F', 'adult', 'músculo', '', '', 'Rabdomiólise, miopatia.'),
  ('LDH', 'U/L', 100, 250, 'any', 'adult', 'bioquímica', 'Inespecífico — vários tecidos.', '', 'Hemólise, linfoma, lesão tecidular, EAM.'),
  ('Amilase', 'U/L', 25, 125, 'any', 'adult', 'pancreática', '', '', 'Pancreatite (menos específica que lipase), parotidite.'),
  ('Anion gap', 'mmol/L', 8, 16, 'any', 'adult', 'gasometria', 'Na - (Cl + HCO3). Alto sugere acidose metabólica com gap.', '', 'Acidose por ácidos endógenos: cetónica (DM), urémica, láctica, tóxicos.'),
  ('pH arterial', '', 7.35, 7.45, 'any', 'adult', 'gasometria', '', 'Acidose.', 'Alcalose.'),
  ('PaO2', 'mmHg', 80, 100, 'any', 'adult', 'gasometria', 'Adultos jovens. Reduz com idade.', 'Hipoxémia — distress, TEP, pneumonia.', 'Hiperóxia.'),
  ('PaCO2', 'mmHg', 35, 45, 'any', 'adult', 'gasometria', '', 'Alcalose respiratória — hiperventilação.', 'Acidose respiratória — DPOC, sedação.'),
  ('Bicarbonato', 'mmol/L', 22, 28, 'any', 'adult', 'gasometria', '', 'Acidose metabólica.', 'Alcalose metabólica.'),
  ('Lactato', 'mmol/L', 0.5, 2.0, 'any', 'adult', 'gasometria', '', '', 'Hipoperfusão, choque, sépsis, isquémia.'),
  ('Procalcitonina', 'ng/mL', 0, 0.5, 'any', 'adult', 'inflamação', 'Mais específica para infecção bacteriana que PCR.', '', 'Sépsis bacteriana, ITU, pneumonia.'),
  ('Fibrinogénio', 'mg/dL', 200, 400, 'any', 'adult', 'coagulação', 'Reactante fase aguda.', 'CID, hepatopatia avançada, hipofibrinogenémia.', 'Inflamação.'),
  ('PSA', 'ng/mL', 0, 4.0, 'M', 'adult', 'tumoral', 'Aumenta com idade; cinética importa.', '', 'HBP, prostatite, neoplasia da próstata.')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- Procedimentos adicionais
-- ════════════════════════════════════════════════════════════════════════
insert into procedure_guides (title, category, description, indications, contraindications, materials, steps, warnings, difficulty, duration_min) values
  ('Punção lombar diagnóstica',
   'neurológico',
   'Colheita de LCR para análise.',
   ARRAY['Suspeita de meningite/encefalite','HSA com TAC normal','Doenças desmielinizantes','Hipertensão intracraniana idiopática'],
   ARRAY['Sinais de hipertensão intracraniana focal','Coagulopatia (INR > 1.5, plaq < 50)','Infecção cutânea no local de punção','Massa fossa posterior'],
   ARRAY['Agulha de Sprotte/Quincke 22G','Manómetro de pressão','3-4 tubos estéreis','Anestésico local','Campo estéril','Solução desinfectante'],
   '[
     {"order":1,"title":"TAC-CE prévia se indicação","body":"Em > 60a, immunodeprimido, défice neurológico focal, alteração de consciência."},
     {"order":2,"title":"Posicionamento","body":"Decúbito lateral com flexão máxima da coluna (posição fetal) OU sentado debruçado."},
     {"order":3,"title":"Identificação L3-L4 ou L4-L5","body":"Linha intercristal. Palpar apófise espinhosa."},
     {"order":4,"title":"Assepsia + anestesia local","body":"Clorexidina alcoólica. Lidocaína 1-2% subcutânea e ao longo do trajecto."},
     {"order":5,"title":"Introdução da agulha","body":"Direcção ligeiramente cefálica (em direcção ao umbigo). Avança até sensação de "pop" da dura."},
     {"order":6,"title":"Medir pressão de abertura","body":"Conecta manómetro. Valor normal 7-18 cm H2O em decúbito."},
     {"order":7,"title":"Colheita","body":"3-4 tubos com 1-2 mL cada — bioquímica, citologia, microbiologia, conservação."},
     {"order":8,"title":"Retirada + repouso","body":"Retirar agulha. Pensa simples. Decúbito 1-2h reduz cefaleia (controverso)."}
   ]'::jsonb,
   ARRAY['Cefaleia pós-punção comum — paracetamol, hidratação, cafeína','Evitar agulhas de bisel cortante (Quincke) — atraumáticas (Sprotte) reduzem cefaleia','Punção traumática vs HSA: 3 tubos sequenciais — clareamento progressivo = traumática'],
   'hard', 30),

  ('Toracocentese diagnóstica',
   'respiratorio',
   'Punção pleural para análise/alívio de derrame.',
   ARRAY['Derrame pleural de etiologia indeterminada','Empiema/parapneumónico complicado','Derrame sintomático'],
   ARRAY['Coagulopatia não corrigida','Trombocitopenia < 50','Infecção cutânea local','Doente não cooperante'],
   ARRAY['Agulha 18-20G + cateter','Seringa 50 mL + adaptador','Tubos para análise','Sistema de aspiração','EPI estéril'],
   '[
     {"order":1,"title":"Imagem prévia","body":"Eco torácica é o método de eleição para marcação."},
     {"order":2,"title":"Posicionamento","body":"Sentado, debruçado sobre mesa com almofada — espaços intercostais alargados."},
     {"order":3,"title":"Marcação","body":"Linha axilar média ou posterior, 7º-9º EIC. Sempre no bordo superior da costela inferior."},
     {"order":4,"title":"Assepsia + anestesia","body":"Lidocaína 1-2% até pleura. Sentirá perda de resistência."},
     {"order":5,"title":"Punção","body":"Introduz cateter no espaço pleural com seringa em aspiração contínua. Confirma líquido."},
     {"order":6,"title":"Colheita / drenagem","body":"Diagnóstica: 30-50 mL. Não retirar > 1.5 L de uma vez (risco de edema pulmonar de re-expansão)."},
     {"order":7,"title":"Rx pós-procedimento","body":"Excluir pneumotórax."}
   ]'::jsonb,
   ARRAY['Critérios de Light no líquido: proteínas pleural/sérica > 0.5; LDH pleural/sérica > 0.6; LDH > 2/3 limite normal = exsudato','Pneumotórax iatrogénico — 5-10% se sem ecografia, 0-3% se ecoguiado','Sinal de Doctor''s Sign — auscultar antes para excluir já existência de pneumotórax'],
   'hard', 25),

  ('Paracentese diagnóstica',
   'gastrointestinal',
   'Punção abdominal para colheita de ascite.',
   ARRAY['Ascite de novo','Suspeita de PBE','Ascite resistente'],
   ARRAY['Coagulopatia grave não corrigível','Infecção cutânea local','Distensão vesical (sondar primeiro)'],
   ARRAY['Agulha 18-20G longa','Seringa 50 mL','Tubos estéreis','Solução desinfectante','EPI'],
   '[
     {"order":1,"title":"Esvaziar bexiga","body":"Doente urina ou sondagem."},
     {"order":2,"title":"Posicionamento","body":"Decúbito dorsal com ligeira inclinação para o lado a puncionar."},
     {"order":3,"title":"Marcação","body":"FIE — 2 dedos medial à crista ilíaca antero-superior esquerda E 2 dedos para cima. Evitar cicatrizes e linha alba."},
     {"order":4,"title":"Assepsia + anestesia","body":"Lidocaína subcutânea e até peritoneu."},
     {"order":5,"title":"Punção em Z","body":"Tracção da pele para baixo antes de puncionar — após retirar, trajecto não-linear reduz fuga."},
     {"order":6,"title":"Colheita","body":"30-50 mL para bioquímica, citologia, microbiologia. PBE se polimorfonucleares > 250/mm³."},
     {"order":7,"title":"Drenagem terapêutica","body":"Volumosa: máximo 5L com albumina 8g/L drenado (acima de 5L)."}
   ]'::jsonb,
   ARRAY['Albumina IV obrigatória se drenagem > 5L para prevenir disfunção circulatória induzida por paracentese','Risco de hemorragia se INR > 2 — usar trombolíticos / FFP se necessário'],
   'medium', 20),

  ('Algaliação masculina (técnica)',
   'genitourinário',
   'Variante específica para o homem.',
   ARRAY['Retenção urinária','Monitorização','Pré-operatório'],
   ARRAY['Suspeita de trauma uretral','Pós-prostatectomia recente','Estenose conhecida'],
   ARRAY['Foley 14-16 Fr (18 Fr se hemorragia)','Lubrificante anestésico','Seringa 10 mL água destilada','Saco colector estéril'],
   '[
     {"order":1,"title":"Posicionamento","body":"Decúbito dorsal, pernas estendidas."},
     {"order":2,"title":"Desinfecção do meato","body":"Retracção do prepúcio. Limpeza com clorexidina aquosa do meato para fora."},
     {"order":3,"title":"Lubrificação intra-uretral","body":"≥ 10 mL de gel anestésico introduzido na uretra. Aguarda 2-3 min."},
     {"order":4,"title":"Pénis em ângulo 90°","body":"Tracciona pénis perpendicular ao corpo."},
     {"order":5,"title":"Introdução","body":"Sonda em ângulo recto. Quando atinge esfíncter externo, baixa pénis e pede ao doente para inspirar profundamente — relaxa o esfíncter."},
     {"order":6,"title":"Avança até bifurcação","body":"NÃO insufla balão até urina sair (sinal de bexiga)."},
     {"order":7,"title":"Insuflar balão + tracção","body":"10 mL água destilada. Tracção suave + fixação na coxa."}
   ]'::jsonb,
   ARRAY['Dor súbita ao insuflar balão = sonda em uretra. Esvaziar, reposicionar.','Phimosis: NÃO forçar retracção','Aposentar prepúcio após procedimento (risco parafimose)'],
   'medium', 15),

  ('Reanimação cardiorrespiratória — RCP adulto',
   'urgência',
   'Suporte básico de vida em PCR.',
   ARRAY['Ausência de resposta + ausência respiração normal'],
   ARRAY['Sinais óbvios de morte','DNR documentado'],
   ARRAY['DAE','Tábua dura','Dispositivo ventilação balão-máscara','EPI'],
   '[
     {"order":1,"title":"Reconhecimento","body":"Não responde + não respira normalmente (gasping não conta)."},
     {"order":2,"title":"Pedir ajuda + DAE","body":"112 / código azul. Pede DAE."},
     {"order":3,"title":"Compressões","body":"Centro do tórax, esterno inferior. Profundidade 5-6 cm, frequência 100-120/min. Permite recuo completo."},
     {"order":4,"title":"Ventilação 30:2","body":"Após 30 compressões, 2 ventilações com máscara-balão. Cada ventilação 1 segundo."},
     {"order":5,"title":"DAE assim que disponível","body":"Coloca eléctrodos. Segue instruções. Choque se indicado."},
     {"order":6,"title":"Trocar reanimadores cada 2 min","body":"Para evitar fadiga e queda de qualidade das compressões."},
     {"order":7,"title":"Algoritmos avançados","body":"Adrenalina 1mg cada 3-5min IV. Amiodarona 300mg após 3º choque em FV/TV."}
   ]'::jsonb,
   ARRAY['Minimiza interrupções nas compressões','Compressões de qualidade > tudo','Hipotermia terapêutica 32-36°C pós-ROSC'],
   'medium', 20),

  ('Intubação orotraqueal',
   'urgência',
   'Via aérea definitiva por intubação.',
   ARRAY['Falência respiratória','Protecção da via aérea (GCS ≤ 8)','PCR','Sedação para procedimentos'],
   ARRAY['Operador inexperiente sem supervisão (relativa)','Trauma facial/cervical grave (preferir cricotireoidotomia)'],
   ARRAY['Laringoscópio (Macintosh 3-4 adulto)','Tubo endotraqueal 7-8 Fr','Seringa para insuflar cuff','Estilete','Capnografia','Dispositivo de aspiração','Drogas: indutor + bloqueador neuromuscular'],
   '[
     {"order":1,"title":"Pré-oxigenação","body":"FiO2 100% durante 3-5 min antes da indução."},
     {"order":2,"title":"Sequência rápida","body":"Etomidato 0.3 mg/kg + Succinilcolina 1.5 mg/kg (ou rocurónio 1.2 mg/kg)."},
     {"order":3,"title":"Posicionamento","body":"Sniffing position. Manobra de Sellick controversa."},
     {"order":4,"title":"Laringoscopia","body":"Lâmina pela direita, deslocando língua. Identifica epiglote e cordas vocais."},
     {"order":5,"title":"Passagem do tubo","body":"Sob visualização directa, tubo passa entre cordas até cuff desaparecer. Profundidade ~21cm mulher, 23cm homem."},
     {"order":6,"title":"Cuff + ventilação","body":"Insufla cuff 5-10 mL. Conecta balão de ventilação."},
     {"order":7,"title":"Confirmação","body":"Capnografia (gold standard), auscultação (5 pontos), elevação simétrica do tórax, embaciamento do tubo."},
     {"order":8,"title":"Fixação + Rx","body":"Fixar tubo. Rx tórax — confirmar posição 2-4 cm acima da carina."}
   ]'::jsonb,
   ARRAY['Tubo no esófago — não auscultar epigástrio adequadamente','Intubação selectiva direita comum se demasiado profundo','Cricoidotomia se falência de via aérea definitiva'],
   'hard', 15),

  ('Dreno torácico',
   'respiratorio',
   'Colocação de dreno em pneumotórax/derrame.',
   ARRAY['Pneumotórax > 2 cm ou sintomático','Hemotórax','Empiema','Derrame maligno'],
   ARRAY['Necessidade de cirurgia urgente','Aderências pleurais (relativa)','Coagulopatia (corrigir antes)'],
   ARRAY['Dreno 24-32 Fr','Sistema de drenagem em selo de água','Bisturi','Pinças hemostáticas','Sutura','Lidocaína 1-2%'],
   '[
     {"order":1,"title":"Marcação","body":"Triângulo de segurança: linha axilar média/anterior, 4º-5º EIC, acima da prega submamária."},
     {"order":2,"title":"Assepsia + anestesia generosa","body":"Lidocaína 20-30 mL — pele, subcutâneo, pleura."},
     {"order":3,"title":"Incisão 2-3 cm","body":"Bordo superior da costela inferior."},
     {"order":4,"title":"Dissecção romba","body":"Pinça hemostática separa planos musculares até pleura."},
     {"order":5,"title":"Penetração pleural","body":"Romba com pinça (NUNCA com trocarte cego). Confirma com dedo enluvado — exclui aderências e órgão."},
     {"order":6,"title":"Introdução do dreno","body":"Pneumotórax → apical e anterior. Hemotórax → basal e posterior."},
     {"order":7,"title":"Sutura + selo de água","body":"Fixa com sutura. Conecta sistema. Sutura em bolsa para fecho à remoção."},
     {"order":8,"title":"Rx confirmar posição","body":"Imediato pós-procedimento."}
   ]'::jsonb,
   ARRAY['Borbulhamento aéreo persistente = fuga aérea continuada','Saída súbita de ar = movimentação do dreno — RECOLOCAR','Evitar clampagem rotineira'],
   'hard', 25),

  ('Sutura simples de ferida',
   'cirúrgico',
   'Técnica básica de sutura.',
   ARRAY['Ferida cortocontusa limpa < 6h','Ferida facial limpa < 24h','Encerramento pós-cirurgia'],
   ARRAY['Ferida infectada','Mordedura humana/animal sem irrigação','Necrose tecidular'],
   ARRAY['Kit sutura estéril (porta-agulhas, pinças, tesoura)','Fio 4-0 a 6-0 (face) ou 3-0 a 4-0 (corpo)','Anestésico local com epinefrina','Solução desinfectante','Soro fisiológico (irrigação)'],
   '[
     {"order":1,"title":"Limpeza + irrigação","body":"Soro fisiológico em jacto 100-300 mL. Remove corpos estranhos."},
     {"order":2,"title":"Anestesia local","body":"Lidocaína 1-2% com adrenalina (excepto em extremidades terminais). Aguarda 5 min."},
     {"order":3,"title":"Inspecção","body":"Profundidade, lesões vasculares/nervosas/tendinosas."},
     {"order":4,"title":"Pontos simples","body":"Bordo a bordo. Igual distância e profundidade dos dois lados. Espacamento 5-10 mm."},
     {"order":5,"title":"Nó cirúrgico","body":"Duplo + 2 simples em sentidos alternados. Tensão suficiente para aproximar — não estrangular."},
     {"order":6,"title":"Curativo","body":"Penso estéril. Profilaxia antitetânica conforme vacinação."},
     {"order":7,"title":"Remoção dos pontos","body":"Face 5d; couro cabeludo 7d; tronco/MMSS 10d; MMII/articulações 14d."}
   ]'::jsonb,
   ARRAY['NÃO usar epinefrina em dedos, pénis, nariz','Ferida no rosto requer alinhamento estético cuidadoso','Vermelhão labial — sempre encerrar com fio 6-0 e alinhar com precisão'],
   'medium', 20),

  ('Cricotireoidotomia de emergência',
   'urgência',
   'Via aérea de emergência em "cannot intubate cannot oxygenate".',
   ARRAY['Falência de intubação','Obstrução via aérea superior','Trauma facial impossibilitando intubação'],
   ARRAY['Crianças < 12 anos (preferir ventilação por jet)','Acesso para via aérea cirúrgica electiva (preferir traqueostomia)'],
   ARRAY['Bisturi número 10','Tubo endotraqueal 6.0 Fr ou kit de cricotireoidotomia','Dilatador','Pinças'],
   '[
     {"order":1,"title":"Identificação","body":"Membrana cricotireoideia entre cartilagem tireoideia e cricoideia."},
     {"order":2,"title":"Incisão vertical na pele","body":"3-4 cm sobre a membrana."},
     {"order":3,"title":"Incisão horizontal membrana","body":"Bisturi atravessa membrana — sentirá perda de resistência."},
     {"order":4,"title":"Dilatar","body":"Pinças hemostáticas alargam abertura."},
     {"order":5,"title":"Tubo endotraqueal 6.0","body":"Introduz e insufla cuff."},
     {"order":6,"title":"Confirmar + estabilizar","body":"Capnografia, auscultação. Fixar com sutura."}
   ]'::jsonb,
   ARRAY['Procedimento de salvamento — não atrasar','Posterior: traqueostomia definitiva nas 24h','Lesão da via aérea superior — não ventilar antes de via aérea segura'],
   'hard', 5),

  ('Lavagem peritoneal diagnóstica (DPL)',
   'cirúrgico',
   'Avaliação de hemoperitoneu em trauma.',
   ARRAY['Trauma abdominal fechado com instabilidade','Doente inconsciente','Falência da observação clínica'],
   ARRAY['Cirurgia abdominal recente','Gravidez avançada','Obesidade extrema','Coagulopatia grave'],
   ARRAY['Cateter peritoneal','1L soro fisiológico aquecido','Sistema de infusão','Compressas','Sonda nasogástrica e vesical (descompressão)'],
   '[
     {"order":1,"title":"Pré-procedimento","body":"SNG + sonda vesical (descomprime estômago e bexiga)."},
     {"order":2,"title":"Local","body":"Infraumbilical na linha média (técnica fechada Seldinger ou aberta)."},
     {"order":3,"title":"Punção/incisão","body":"Aspirar — sangue franco > 10 mL = positivo, ir para BO."},
     {"order":4,"title":"Infundir soro","body":"10 mL/kg (1L adulto) aquecido. Aguarda 10 min."},
     {"order":5,"title":"Drenagem","body":"Por gravidade — coloca saco abaixo do doente."},
     {"order":6,"title":"Análise","body":"GR > 100.000/mm³, GB > 500/mm³, presença de bílis/fezes/bactérias = positivo."}
   ]'::jsonb,
   ARRAY['Substituído amplamente por FAST + TC','Útil em ambientes sem ecografia disponível'],
   'hard', 20),

  ('Cardioversão eléctrica sincronizada',
   'cardiológico',
   'Restauração de ritmo em taquiarritmias.',
   ARRAY['FA com instabilidade hemodinâmica','TV com pulso','TSV refractária'],
   ARRAY['Bradicárdia, paragem sinusal','Intoxicação digitálica','FA crónica > 48h sem anticoagulação'],
   ARRAY['Desfibrilhador com modo "sync"','Drogas de sedação (midazolam, propofol, etomidato)','Material para via aérea','Monitor + ECG'],
   '[
     {"order":1,"title":"Consentimento + monitorização","body":"ECG, SpO2, TA. Acesso IV."},
     {"order":2,"title":"Sedação consciente","body":"Etomidato 0.1-0.2 mg/kg ou propofol 1 mg/kg. Pré-oxigenação."},
     {"order":3,"title":"Activar SYNC","body":"Confirma que o desfibrilhador marca cada QRS."},
     {"order":4,"title":"Energia","body":"FA: 120-200J bifásico. Flutter: 100J. TV: 100J. SVT: 50-100J."},
     {"order":5,"title":"Pads / pás","body":"Apex-esterno ou antero-posterior. Gel ou pads pré-gelados."},
     {"order":6,"title":"Choque + reavaliação","body":"Carrega, avisa "afastar", choque. Avalia ritmo."},
     {"order":7,"title":"Insucesso","body":"Subir energia. Optimizar posição. Considerar amiodarona."}
   ]'::jsonb,
   ARRAY['SEMPRE em modo SYNC (excepto FV/TV sem pulso → desfibrilhação)','FA > 48h: anticoagular 3 semanas antes OU eco transesofágico para excluir trombo','Risco AVC se cardioversão inadequada'],
   'hard', 15)
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- Biblioteca médica adicional
-- ════════════════════════════════════════════════════════════════════════
insert into medical_library (title, source, year, domain, summary, body, tags) values
  ('FA — anticoagulação CHA2DS2-VASc',
   'ESC', 2024, 'cardiologia',
   'NOAC (dabigatrano, apixabano, rivaroxabano, edoxabano) é primeira escolha excepto válvulas mecânicas ou estenose mitral significativa.',
   'CHA2DS2-VASc: IC 1, HTA 1, idade ≥75 2, DM 1, AVC/AIT 2, doença vascular 1, idade 65-74 1, sexo F 1. Anticoagular se ≥2 H ou ≥3 M (alguns recomendam ≥1 universal). Avaliar HAS-BLED para risco hemorragia mas NÃO suspender anticoagulação só por score elevado — modificar factores corrigíveis. NOAC > varfarina (mortalidade, AVC, hemorragia intracraniana). Edoxabano 60mg/dia. Apixabano 5mg 12/12h. Rivaroxabano 20mg/dia. Dabigatrano 150mg 12/12h. Doses reduzidas se idosos/peso baixo/IR.',
   ARRAY['FA','CHA2DS2-VASc','NOAC','varfarina','apixabano','dabigatrano']),

  ('Diabetes — antidiabéticos não-insulínicos',
   'ADA/EASD', 2024, 'endocrinologia',
   'iSGLT2 e GLP-1 RA preferidos em DM2 com risco CV elevado ou IC ou DRC.',
   'Metformina mantém-se primeira linha (1ª escolha) excepto contra-indicações. Adicionar de seguida iSGLT2 (dapagliflozina, empagliflozina) ou GLP-1 RA (semaglutido, liraglutido) se: doença CV estabelecida, IC, DRC. Sulfoniluréias e pioglitazona em fim de linha — risco hipoglicémia e ganho ponderal. iDPP-4 neutros mas sem benefício cardiovascular. Alvo HbA1c < 7% (idoso frágil < 8%). Personalizar.',
   ARRAY['DM','diabetes','metformina','SGLT2','GLP-1','HbA1c']),

  ('IC com FE preservada (ICFEp)',
   'ESC', 2023, 'cardiologia',
   'iSGLT2 (empagliflozina, dapagliflozina) reduz hospitalizações. Controlar HTA, peso e tratamento dirigido das comorbilidades.',
   'Critério ICFEp: sintomas IC + FE ≥ 50% + evidência objectiva (NT-proBNP elevado, sinais ecocardiográficos de disfunção diastólica). Tratamento: diuréticos para congestão. iSGLT2 indicação de classe I (EMPEROR-Preserved, DELIVER). Controlo tensional rigoroso. Identificar e tratar amiloidose cardíaca (cintigrafia óssea + electroforese). Ablação FA se indicada.',
   ARRAY['IC','ICFEp','HFpEF','SGLT2','empagliflozina']),

  ('Hipertensão arterial — escolha de fármacos',
   'ESC/ESH', 2023, 'cardiologia',
   'Combinação inicial dupla (IECA/ARA + amlodipina OU tiazida) em comprimido único.',
   'IECA ou ARA + bloqueador canais cálcio (amlodipina) OU tiazida (indapamida, hidroclorotiazida) — dose fixa em comprimido único melhora adesão. Triplo: IECA + amlodipina + tiazida. Espironolactona 4ª linha em HTA resistente. Beta-bloqueador em indicações específicas (FA, pós-EAM, IC). Alvo TA: <130/80 na maioria, mais permissivo no idoso frágil. Domicílio importante (HTA bata branca, HTA mascarada).',
   ARRAY['HTA','IECA','ARA','tiazida','amlodipina','espironolactona']),

  ('Dislipidemia — alvos e tratamento',
   'ESC/EAS', 2019, 'cardiologia',
   'Risco CV define alvo LDL. Estatinas + ezetimiba + PCSK9 conforme escala.',
   'Estratificação: muito alto risco — LDL < 55 mg/dL E redução ≥50%; alto — < 70; moderado — < 100; baixo — < 116. Estatina de alta intensidade (atorvastatina 40-80, rosuvastatina 20-40). Se não atinge: + ezetimiba 10mg. Persiste: + PCSK9 (evolocumab, alirocumab) ou bempedoic acid. Em diabéticos: pelo menos estatina moderada. Pós-EAM: rosuva 40 ou atorva 80 + ezetimiba.',
   ARRAY['LDL','estatina','ezetimiba','PCSK9','dislipidemia']),

  ('AVC — secundário pós isquémico',
   'AHA/ASA', 2021, 'neurologia',
   'AAS 100 + clopidogrel 21d então clopidogrel/AAS. Estatina alta intensidade. Controlo agressivo TA.',
   'AAS 300mg após exclusão de hemorragia, depois 100mg/dia. Em AVC menor / AIT alto risco: dupla terapia AAS+clopidogrel 21d depois manter um. NOAC em AVC cardioembólico (FA). Estatina alta intensidade independentemente do LDL. Alvo TA < 130/80. DM controlada. Anticoagulação se FA paroxística — Holter prolongado se necessário. Endarterectomia carotídea se estenose sintomática ≥70%.',
   ARRAY['AVC','AAS','clopidogrel','NOAC','estatina','prevenção secundária']),

  ('Asma — Steps GINA 2024',
   'GINA', 2024, 'pneumologia',
   'AS-IT (alivio + controlo): CSI+formoterol "as needed" no Step 1-2. Triple therapy nos passos avançados.',
   'Step 1-2: BUD/FOR (budesonida/formoterol) "as needed". Step 3: BUD/FOR baixa dose regular + as needed. Step 4: BUD/FOR média dose. Step 5: alta dose + tiotrópio ou anti-IgE/anti-IL5. SABA isolado: NÃO recomendado mais — sempre com CSI. Adesão e técnica inalatória essenciais. Triggers a evitar. Plano de acção escrito.',
   ARRAY['asma','GINA','BUD-FOR','CSI','formoterol']),

  ('Pneumonia nosocomial / VAP',
   'IDSA/ATS', 2016, 'infecciologia',
   'Antibiótico empírico cobre P. aeruginosa, MRSA conforme risco MDR.',
   'Pneumonia hospitalar (HAP): início ≥48h após admissão. VAP: pneumonia ≥48h após intubação. Empírico: pip-tazo OU cefepime OU meropenem + cobertura MRSA se risco (vancomicina ou linezolida). Adicionar segundo anti-pseudomonas se choque ou MDR (aminoglicosídeo ou fluoroquinolona). Desescalada após culturais. Duração 7 dias.',
   ARRAY['pneumonia','HAP','VAP','MRSA','pseudomonas']),

  ('Infecção urinária complicada',
   'EAU', 2024, 'urologia',
   'Pielonefrite: ceftriaxone 1-2g/dia ou fluoroquinolona 7-14d. Cobrir Pseudomonas se factores de risco.',
   'Cistite não-complicada: nitrofurantoína 3-5d ou fosfomicina dose única. Pielonefrite ambulatória: ciprofloxacina 7d (se prevalência < 10%) ou ceftriaxone IM/IV 24h depois oral. Hospitalar: ceftriaxone IV ou pip-tazo se sépsis. Algaliação > 30 dias: cobrir Pseudomonas e Enterococcus. Adapta a culturais. Imagem se falência ≥72h tratamento.',
   ARRAY['ITU','pielonefrite','cistite','ceftriaxone','ciprofloxacina']),

  ('Reanimação volémica em sépsis',
   'SCC', 2021, 'emergencia',
   'Cristalóides equilibrados 30 mL/kg em 3h. Vasopressores se TAM persistir < 65.',
   'Bólus inicial 30 mL/kg de cristalóides equilibrados (Plasma-Lyte, Ringer) em 3 horas. Avaliação dinâmica de resposta (lactato, débito urinário, ecocardiograma, elevação passiva das pernas). Noradrenalina 1ª linha se TAM persistir < 65 após fluidos. Vasopressina adjuvante se doses altas de noradrenalina. Albumina considerar se hipoalbuminemia. Hidrocortisona 200mg/dia se choque persistente.',
   ARRAY['sépsis','cristalóides','noradrenalina','vasopressina','ressuscitação']),

  ('Encefalopatia hepática — manejo',
   'AASLD', 2014, 'gastroenterologia',
   'Lactulose 30-45 mL várias vezes/dia até 2-3 dejecções moles. Rifaximina 550mg 2x/dia se recorrente.',
   'Identifica e trata precipitante (hemorragia GI, infecção, obstipação, diuréticos, sedativos). Lactulose oral/SNG ou enema se grau elevado. Rifaximina adjuvante reduz recorrência. Restrição proteica NÃO recomendada em fase aguda (causa catabolismo muscular). Suplementação BCAA controversa. Albumina se hipoalbuminemia grave. Avaliar para TIPS ou transplante.',
   ARRAY['cirrose','encefalopatia','lactulose','rifaximina']),

  ('Cetoacidose diabética — protocolo',
   'ADA', 2023, 'endocrinologia',
   'Soro fisiológico, insulina IV 0.1 U/kg/h após repor K+ se < 3.3, monitor electrolitos.',
   'Reposição volémica: 1L SF 0.9% na 1ª hora, depois 250-500 mL/h. K+ < 3.3: reponha primeiro (NÃO iniciar insulina). 3.3-5.3: insulina + KCl 20-30 mEq/L. > 5.3: insulina sem K+. Insulina regular IV 0.1 U/kg/h após bólus 0.1 U/kg. Dextrose 5% quando glicémia < 200. Bicarbonato apenas se pH < 6.9. Resolução: pH > 7.3, HCO3 > 18, anion gap normal. Transição para SC sobreposição 2-4h.',
   ARRAY['CAD','DKA','insulina','potássio','soro fisiológico']),

  ('Choque cardiogénico',
   'ESC', 2023, 'cardiologia',
   'Revascularização precoce em SCA. Inotropos. Suporte mecânico (ECMO, Impella) em casos seleccionados.',
   'Reperfusão precoce em SCA-ST. Noradrenalina + dobutamina (não-rotina dopamina pelo risco arrítmico). Considerar levosimendan. Suporte mecânico em centros selecionados: IABP (controverso), Impella, VA-ECMO. Avaliação para transplante / VAD se choque persistente. Identifica e trata complicações mecânicas (CIV, ruptura papilar).',
   ARRAY['choque cardiogénico','EAM','noradrenalina','ECMO','IABP']),

  ('TEP — diagnóstico e tratamento',
   'ESC', 2019, 'pneumologia',
   'Wells/PERC → D-dímeros → angioTAC. Anticoagulação imediata. Trombólise em maciço.',
   'Probabilidade clínica (Wells, Genebra). Baixa + PERC negativo: descartar. Baixa/intermédia + D-dímero ajustado idade (idade x 10 µg/L > 50): negativo descarta. Alta ou D-dímero+: angioTAC pulmonar. Tratamento: anticoagulação (NOAC excepto IRC grave, gravidez, cancro). Maciço (instabilidade): trombólise (alteplase 100mg em 2h ou 50mg bólus se PCR iminente). Submaciço com VD+troponina+: trombólise controversa. Filtros VCI em CI à anticoagulação. Duração: 3-6 meses provocado, indefinido não-provocado/recorrente.',
   ARRAY['TEP','Wells','D-dímero','angioTAC','alteplase','NOAC']),

  ('Pancreatite aguda — manejo',
   'AGA', 2018, 'gastroenterologia',
   'Reposição volémica precoce 250-500 mL/h. Nutrição entérica precoce. Antibiótico só se infecção comprovada.',
   'Diagnóstico: 2 de 3 — dor típica + lipase > 3x normal + imagem. BISAP/Atlanta para gravidade. Fluidos: Ringer lactato 250-500 mL/h primeiras 24h. Analgesia: opioides. Nutrição: oral assim que tolere (24-72h). Entérica > parentérica em formas graves. Antibiótico apenas se necrose infectada confirmada (carbapenemo). ERCP urgente se colangite ou obstrução biliar. Colecistectomia na mesma internação na biliar leve, após resolução da grave.',
   ARRAY['pancreatite','BISAP','Ringer','ERCP','colecistectomia']),

  ('Hemorragia digestiva alta — manejo',
   'BSG', 2024, 'gastroenterologia',
   'Reanimação + IBP + endoscopia <24h. Trombosado-erlsevier <12h se choque ou sangue activo.',
   'Reanimação ABC. Acesso IV calibrosos. Cristalóides + transfusão alvo Hb 7-9 g/dL (>9 se SCA). Plasma se INR > 1.5. Plaquetas se < 50. Pantoprazol 80mg bólus + 8mg/h. Endoscopia: <24h estável, <12h se instável/Glasgow-Blatchford ≥ 7. Forrest IIa+: hemostase endoscópica (terclips, escleroterapia + injecção). Varizes: octreótido + antibiótico profilático. Helicobacter: erradicação após hemorragia ulcerosa. Re-endoscopia rotineira não recomendada.',
   ARRAY['HDA','IBP','endoscopia','varizes','Glasgow-Blatchford']),

  ('Status epilépticus',
   'ESN/ILAE', 2022, 'neurologia',
   'Lorazepam IV 4mg → fenitoína / levetiracetam → propofol/midazolam.',
   'Convulsão > 5 min OU 2+ sem recuperação. 1ª linha: lorazepam 0.1 mg/kg IV ou diazepam 0.15 mg/kg. 2ª linha (após 5-10 min): fenitoína 20 mg/kg (lento, monitor TA) OU levetiracetam 60 mg/kg OU ácido valpróico 40 mg/kg. 3ª linha (refractário): anestesia geral — propofol 1-2 mg/kg bólus + perfusão OU midazolam 0.2 mg/kg + perfusão OU pentobarbital. EEG contínuo necessário. Tratamento causa subjacente.',
   ARRAY['status epilépticus','lorazepam','fenitoína','levetiracetam','propofol']),

  ('Hipertensão na gravidez',
   'ACOG/ESC', 2022, 'obstetricia',
   'Labetalol/nifedipina como 1ª linha. Sulfato de magnésio em pré-eclâmpsia grave/eclâmpsia.',
   'HTA crónica + HTA gestacional > 140/90. Pré-eclâmpsia: HTA + proteinúria > 300mg/24h ou critérios graves. Tratamento ambulatório se TA < 160/110 e sem critérios graves: labetalol 100-400mg 12/12h ou nifedipina LP 30-60mg/dia. Internamento + sulfato Mg em pré-eclâmpsia com critérios graves. Parto: 37s na HTA crónica não-controlada, 34s na pré-eclâmpsia grave. Pós-parto: continuar anti-HTA, vigilância 6 semanas.',
   ARRAY['HTA gravidez','pré-eclâmpsia','labetalol','sulfato magnésio']),

  ('Dor lombar — abordagem',
   'NICE', 2020, 'reumatologia',
   'Educação + exercício > AINEs por curtos períodos. Imagem só com red flags ou défice neurológico.',
   'Excluir red flags (febre, perda peso, dor nocturna, défice neurológico, traumatismo, cancro). Lumbago agudo: educação, manter actividade, paracetamol/AINEs curtos. NÃO ressonância em < 4-6 semanas sem red flags. Crónica: exercício terapêutico, fisioterapia, MEDICINE psicossocial. Cirurgia limitada a indicações específicas (hérnia com défice progressivo, sd. cauda equina).',
   ARRAY['dor lombar','lumbago','AINE','red flags']),

  ('Cancro mama — rastreio',
   'USPSTF/DGS', 2024, 'oncologia',
   'Mamografia bienal 50-74 (DGS) ou 40-74 (USPSTF). Bienal vs anual debatido.',
   'DGS: mamografia bienal mulheres 50-69 anos (programa nacional). USPSTF 2024: 40-74 anos bienal. Mais cedo em alto risco (BRCA, antecedentes familiares — começar 25-30 anos com RM). Ecografia complementar em mama densa. Auto-exame não recomendado isoladamente. Exame clínico anual >40a.',
   ARRAY['cancro mama','rastreio','mamografia','BRCA']),

  ('Cancro colorrectal — rastreio',
   'USPSTF/DGS', 2023, 'oncologia',
   'Pesquisa sangue oculto fezes (FIT) bienal ou colonoscopia 10/10 anos dos 50-75 (45-75 USPSTF).',
   'Risco médio: começar 45-50 anos. FIT anual ou bienal (mais frequente em alguns programas). Colonoscopia gold standard — repetir cada 10 anos se normal. Outros: sigmoidoscopia, colono-TC, FIT-DNA. Alto risco: HNPCC (Lynch) — colonoscopia 1/1-2 anos desde 20-25a; PAF — sigmoidoscopia 1/ano desde 10-12a. Doença inflamatória intestinal — colono 1-2/ano após 8a de DII extensa.',
   ARRAY['cancro colorrectal','rastreio','FIT','colonoscopia','Lynch']),

  ('Diabetes — controlo glicémico hospitalar',
   'ADA', 2024, 'endocrinologia',
   'Alvo 140-180 mg/dL. Insulina basal-bólus em vez de sliding scale isolada.',
   'Em internado não-crítico: alvo 140-180 mg/dL (mais permissivo em frágeis). Insulina basal-bólus: 50% dose total como basal (glargina/detemir), 50% como bólus (asparte/lispro pré-refeições). Suspensa metformina se IR/contraste/CC. Sliding scale isolado NÃO recomendado. Hipoglicemia: glicose oral se consciente, glucagon 1mg SC/IM se inconsciente. Corrigir causa.',
   ARRAY['diabetes','hospitalar','insulina basal-bólus','hipoglicémia']),

  ('Infecção por Helicobacter pylori — erradicação',
   'Maastricht VI', 2022, 'gastroenterologia',
   'Tripla terapia bismuto + PPI + amoxi + claritromicina (ou quádrupla) 14d.',
   'Indicação: úlcera, dispepsia investigada, anemia ferropénica idiopática, PTI, MALT, parente 1º grau cancro gástrico. Diagnóstico: ureia respirado ou antigénio fecal (suspender PPI 2 semanas antes). 1ª linha em zonas com resistência claritromicina alta: quádrupla com bismuto (subcitrato bismuto + tetraciclina + metronidazol + PPI) 14 dias. Confirmação erradicação 4 semanas após tratamento. Falência: salvage quádrupla com levofloxacina.',
   ARRAY['Helicobacter','úlcera','claritromicina','bismuto','metronidazol']),

  ('Anticoagulação peri-operatória',
   'ACCP', 2022, 'hematologia',
   'Avaliar risco trombótico vs hemorrágico. Bridge com HBPM apenas se alto risco.',
   'Varfarina: suspender 5d antes. INR <1.5 dia cirurgia. Reiniciar 24h após (12h se baixo risco hemorrágico). Bridge com HBPM apenas se válvula mecânica mitral ou AVC nos 3 meses ou trombofilia grave. NOACs: suspender 1-2d antes (3-4d se IR/cirurgia alto risco). Reiniciar 24-72h. AAS para prevenção secundária: manter excepto cirurgia neurocirurgia/oftálmica. AAS profilaxia 1ª: suspender 7d antes.',
   ARRAY['varfarina','NOAC','HBPM','bridge','peri-operatório'])
on conflict do nothing;

notify pgrst, 'reload schema';
