'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { logStudy } from '@/lib/studyProgress'
import StudyProgressBar from '@/components/StudyProgressBar'

// ─── Domínios de estudo — TODAS as áreas das ciências da saúde ───────────────

const DOMAINS = [
  {
    id: 'farmacologia',
    label: 'Farmacologia',
    icon: '💊',
    color: '#0d6e42',
    bg: '#f0fdf5',
    border: '#bbf7d0',
    desc: 'Mecanismos, interações, farmacocinética',
    topics: [
      // ── Cardiovasculares ─────────────────────────────────────────────
      'Beta-bloqueadores', 'IECA / ARA-II', 'ARNI (Sacubitril-Valsartan)', 'Estatinas',
      'PCSK9 (Evolocumab, Alirocumab)', 'Anticoagulantes (Varfarina e NOACs)',
      'Antiagregantes Plaquetários', 'Antiarrítmicos (Classes Vaughan-Williams)',
      'Bloqueadores dos Canais de Cálcio', 'Nitratos', 'Inibidores SGLT2 na IC',
      // ── Neuropsiquiátricos ───────────────────────────────────────────
      'Benzodiazepinas', 'ISRS / IRSN', 'Antidepressivos Tricíclicos', 'IMAO',
      'Antipsicóticos Típicos', 'Antipsicóticos Atípicos', 'Lítio e Estabilizadores de Humor',
      'Antiepilépticos', 'Antiparkinsónicos', 'Inibidores da Acetilcolinesterase',
      'Memantina', 'Bupropiona e Vareniclina (Cessação Tabágica)',
      // ── Antibióticos / Antimicrobianos ───────────────────────────────
      'Antibióticos Beta-lactâmicos', 'Cefalosporinas (Gerações)', 'Carbapenemes',
      'Vancomicina e Glicopeptídeos', 'Aminoglicosídeos', 'Fluoroquinolonas',
      'Macrólidos', 'Tetraciclinas', 'Sulfamidas', 'Linezolida e Daptomicina',
      'Antifúngicos (Triazoles, Equinocandinas)', 'Antivirais (Anti-Herpes, Anti-Hepatite)',
      'Antirretrovirais (HAART)',
      // ── Analgesia e Anti-inflamatórios ───────────────────────────────
      'AINEs e Risco Cardiovascular', 'Opióides — Equivalências e Rotação',
      'Paracetamol — Mecanismo e Toxicidade', 'Adjuvantes da Dor (Gabapentinoides)',
      'Triptanos', 'Glucocorticóides Sistémicos',
      // ── Diabetes / Endocrinologia ────────────────────────────────────
      'Antidiabéticos orais', 'Insulinas (Curta/Longa Duração)', 'GLP-1 (Semaglutido, Liraglutido)',
      'Inibidores SGLT2', 'Hormonas tiróideias', 'Glucocorticóides e Mineralocorticóides',
      'Hormonas Sexuais e THS', 'Bisfosfonatos e Denosumab',
      // ── GI e Respiratório ─────────────────────────────────────────────
      'Inibidores da Bomba de Protões', 'Procinéticos (Metoclopramida, Domperidona)',
      '5-ASA e Imunossupressores na DII', 'Broncodilatadores (SABA, LABA)',
      'Corticosteróides Inalados', 'Antagonistas dos Leucotrienos', 'Anti-IgE (Omalizumab)',
      // ── Imunossupressão / Biológicos ─────────────────────────────────
      'Corticosteróides — Equivalências e Tapering', 'Metotrexato', 'Azatioprina',
      'Ciclosporina e Tacrolimus', 'Anti-TNF-α (Infliximab, Adalimumab)', 'Anti-IL-6 (Tocilizumab)',
      'Rituximab', 'Imunoterapia Oncológica (PD-1, PD-L1, CTLA-4)',
      // ── Hematologia ───────────────────────────────────────────────────
      'Eritropoietina e ESAs', 'Heparinas (HNF, HBPM)', 'Fondaparinux',
      'Reversores de Anticoagulação (Idarucizumab, Andexanet)',
      // ── Outros ────────────────────────────────────────────────────────
      'Diuréticos (Ansa, Tiazidas, Poupadores de K)', 'Imunossupressores',
      'Anticolinérgicos', 'Dopaminérgicos', 'Vacinas e Imunoglobulinas',
      'Antídotos em Toxicologia', 'Antiparasitários',
    ],
  },
  {
    id: 'medicina_interna',
    label: 'Medicina Interna',
    icon: '🫀',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    desc: 'Cardiologia, pneumologia, gastro, nefrologia',
    topics: [
      // ── Cardiologia ─────────────────────────────────────────────────
      'Insuficiência Cardíaca com FE Reduzida', 'Insuficiência Cardíaca com FE Preservada',
      'Fibrilhação Auricular — Ritmo vs Frequência', 'Score CHA2DS2-VASc e HAS-BLED',
      'Síndromes Coronários Agudos (STEMI, NSTEMI, AI)', 'HTA e Hipertensão Resistente',
      'Hipertensão Secundária — Causas', 'Valvulopatias (EA, IM, EM)',
      'Endocardite Infecciosa', 'Pericardite Aguda', 'Miocardite',
      'Doença Arterial Periférica',
      // ── Pneumologia ──────────────────────────────────────────────────
      'DPOC — Classificação GOLD', 'Asma — Steps GINA', 'Pneumonia Adquirida na Comunidade',
      'Pneumonia Nosocomial e Associada ao Ventilador', 'Embolia Pulmonar',
      'Síndrome de Dificuldade Respiratória (ARDS)', 'Fibrose Pulmonar Idiopática',
      'Apneia Obstrutiva do Sono', 'Hipertensão Pulmonar',
      // ── Endocrinologia ───────────────────────────────────────────────
      'Diabetes Mellitus tipo 1', 'Diabetes Mellitus tipo 2', 'Hipoglicemia',
      'Dislipidemia', 'Obesidade e Síndrome Metabólico', 'Hipertiroidismo (Graves)',
      'Hipotiroidismo (Hashimoto)', 'Síndrome de Cushing', 'Insuficiência Suprarrenal',
      'Hiperparatiroidismo', 'Osteoporose', 'Osteomalácia',
      // ── Nefrologia ───────────────────────────────────────────────────
      'Doença Renal Crónica — Estádios e Manejo', 'Síndrome Nefrótico',
      'Glomerulonefrites Agudas', 'Lesão Renal Aguda (KDIGO)', 'Tubulopatias',
      'Doenças Quísticas (Rim Policístico)', 'Acidose Tubular Renal',
      // ── Gastroenterologia / Hepatologia ───────────────────────────────
      'Doença de Crohn e Colite Ulcerosa', 'Cirrose Hepática', 'Hepatite Viral A/B/C/E',
      'Doença Hepática Esteatótica (MASLD)', 'Hipertensão Portal e Varizes',
      'Encefalopatia Hepática', 'Síndrome Hepatorrenal', 'Doença Celíaca',
      'Síndrome do Intestino Irritável', 'Diverticulite', 'DRGE e Esofagite',
      // ── Hematologia ──────────────────────────────────────────────────
      'Anemia Ferropénica', 'Anemia da Doença Crónica', 'Anemias Hemolíticas',
      'Anemias Megaloblásticas', 'Trombocitopenias (PTI, PTT)', 'Coagulopatias',
      'Síndromes Mieloproliferativos', 'Mieloma Múltiplo', 'Linfomas Hodgkin e Não-Hodgkin',
      'Leucemias Agudas',
      // ── Reumatologia ─────────────────────────────────────────────────
      'Artrite Reumatoide', 'Lúpus Eritematoso Sistémico', 'Vasculites (ANCA+)',
      'Polimialgia Reumática e Arterite Temporal', 'Espondilartrites',
      'Gota e Pseudogota', 'Esclerodermia', 'Síndrome de Sjögren',
      // ── Infecciologia ────────────────────────────────────────────────
      'VIH/SIDA — Manejo', 'Tuberculose', 'Hepatite C — Tratamento DAA',
      'Endocardite Infecciosa — Critérios de Duke', 'Sépsis — Bundle de 1 hora',
    ],
  },
  {
    id: 'emergencia',
    label: 'Emergência',
    icon: '🚨',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    desc: 'Algoritmos, protocolos, suporte de vida',
    topics: [
      // ── Suporte de vida ──────────────────────────────────────────────
      'Paragem Cardiorrespiratória e RCP', 'SAV — Suporte Avançado de Vida',
      'SBV — Suporte Básico de Vida', 'Ritmos Desfibriláveis vs Não-Desfibriláveis',
      'Algoritmo de Bradicárdia', 'Algoritmo de Taquicárdia', 'Cuidados Pós-Paragem',
      // ── Choque ───────────────────────────────────────────────────────
      'Choque — Tipos e Tratamento', 'Choque Séptico — Sepsis-3', 'Choque Cardiogénico',
      'Choque Hipovolémico — Transfusão Massiva', 'Choque Anafilático',
      'Choque Obstrutivo (Tamponamento, TEP, Pneumotórax)',
      // ── Neurológicas ─────────────────────────────────────────────────
      'AVC Isquémico — Trombólise e Trombectomia', 'Hemorragia Intracraniana',
      'Status Epilepticus — Algoritmo', 'Coma — Abordagem Diagnóstica',
      'Cefaleia em Trovão', 'Meningite e Meningoencefalite',
      // ── Cardiopulmonar ───────────────────────────────────────────────
      'Crise Hipertensiva (Urgência vs Emergência)', 'Edema Agudo do Pulmão',
      'Tamponamento Cardíaco', 'Embolia Pulmonar Maciça',
      'Pneumotórax Hipertensivo', 'Dissecção Aórtica',
      // ── Trauma ───────────────────────────────────────────────────────
      'Trauma e ABCDE', 'Trauma Crânio-encefálico Grave', 'Trauma Torácico',
      'Trauma Abdominal — FAST', 'Politraumatismo — Damage Control',
      'Queimaduras — Regra dos 9 e Fluidos', 'Hemorragia Massiva e Ácido Tranexâmico',
      // ── Endócrino / Metabólico ───────────────────────────────────────
      'Cetoacidose Diabética', 'Estado Hiperosmolar', 'Hipoglicemia Grave',
      'Crise Tireotóxica', 'Crise Addisoniana', 'Hipercaliemia com Alterações ECG',
      'Hiponatremia Grave', 'Encefalopatia de Wernicke',
      // ── Tóxico ───────────────────────────────────────────────────────
      'Intoxicações Agudas — Abordagem Geral', 'Intoxicação por Paracetamol',
      'Intoxicação por Tricíclicos', 'Intoxicação por Benzodiazepinas',
      'Intoxicação por Opióides — Naloxona', 'Intoxicação por Beta-bloqueante',
      'Intoxicação por Bloqueador dos Canais de Cálcio', 'Intoxicação por Salicilatos',
      'Intoxicação por Organofosforados', 'Intoxicação por Etilenoglicol e Metanol',
      'Síndrome Serotoninérgica', 'Síndrome Neuroléptico Maligno',
      // ── Outras emergências ───────────────────────────────────────────
      'Abdómen Agudo — Diagnóstico Diferencial', 'Hemorragia Digestiva Alta e Baixa',
      'Anafilaxia — Protocolo', 'Eclâmpsia',
    ],
  },
  {
    id: 'cirurgia',
    label: 'Cirurgia',
    icon: '🔪',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    desc: 'Pré e pós-operatório, patologia cirúrgica',
    topics: [
      // ── Abdómen ───────────────────────────────────────────────────────
      'Apendicite Aguda', 'Colecistite Aguda', 'Coledocolitíase e Colangite',
      'Oclusão Intestinal Mecânica', 'Íleo Paralítico', 'Isquémia Mesentérica',
      'Hérnia Inguinal e Crural', 'Hérnia Umbilical e Incisional',
      'Peritonite Generalizada', 'Diverticulite e Diverticulose',
      'Pancreatite Aguda', 'Pancreatite Crónica',
      'Hemorragia Digestiva Alta', 'Hemorragia Digestiva Baixa',
      // ── Oncologia cirúrgica ──────────────────────────────────────────
      'Cancro Colorrectal', 'Cancro Gástrico', 'Cancro do Pâncreas',
      'Cancro do Esófago', 'Cancro Hepatocelular', 'Cancro da Mama',
      'Cancro da Tiroide e Nódulo Tiróideu', 'Tumores das Suprarrenais',
      'Sarcomas dos Tecidos Moles', 'GIST',
      // ── Peri-operatório ──────────────────────────────────────────────
      'Avaliação Pré-operatória e ASA', 'Gestão Peri-operatória de Anticoagulantes',
      'Profilaxia Tromboembólica (HBPM, IPC)', 'Profilaxia Antibiótica Cirúrgica',
      'Jejum Pré-operatório', 'ERAS — Enhanced Recovery',
      'Anestesia — Tipos e Indicações', 'Complicações Pós-operatórias',
      'Atelectasia e Pneumonia Pós-op', 'Íleo Pós-op', 'TVP/TEP Pós-op',
      'Deiscência e Infecção de Ferida', 'Drenos e Sondas — Cuidados',
      // ── Outros ────────────────────────────────────────────────────────
      'Nutrição no Doente Cirúrgico', 'Resposta Metabólica ao Trauma',
      'Trauma Abdominal Fechado', 'Trauma Penetrante Abdominal',
      'Vascular — Aneurisma da Aorta', 'Vascular — Isquémia Aguda dos MI',
      'Cirurgia Bariátrica', 'Cirurgia Tiróidea — Complicações',
    ],
  },
  {
    id: 'pediatria',
    label: 'Pediatria',
    icon: '👶',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#e9d5ff',
    desc: 'Desenvolvimento, doenças pediátricas, doses',
    topics: [
      // ── Desenvolvimento e prevenção ──────────────────────────────────
      'Desenvolvimento Psicomotor Normal', 'Calendário Vacinal PNV',
      'Atrasos do Desenvolvimento — Sinais de Alarme',
      'Crescimento e Curvas de Percentil',
      // ── Infecciosas ──────────────────────────────────────────────────
      'Febre Sem Foco no Lactente', 'Convulsão Febril',
      'Otite Média Aguda', 'Faringite Estreptocócica',
      'Bronquiolite', 'Asma Pediátrica',
      'Pneumonia Pediátrica', 'Tosse Convulsa',
      'Síndrome PIMS pós-COVID', 'Meningite Pediátrica',
      // ── GI e Endócrino ───────────────────────────────────────────────
      'Gastroenterite Aguda Pediátrica', 'Desidratação — Graus e Tratamento',
      'Invaginação Intestinal', 'Estenose Hipertrófica do Piloro',
      'Diabetes Mellitus tipo 1 Pediátrica', 'Hipotiroidismo Congénito',
      'Doença Celíaca Pediátrica',
      // ── Neonatologia ─────────────────────────────────────────────────
      'RN — Adaptação à Vida Extra-uterina', 'Icterícia Neonatal',
      'Hipoglicémia Neonatal', 'Sépsis Neonatal',
      'Prematuridade — Complicações',
      // ── Cardio / Sindromes ───────────────────────────────────────────
      'Cardiopatias Congénitas — Cianóticas', 'Cardiopatias Congénitas — Não-Cianóticas',
      'Sindrome de Down', 'Trissomia 18 e Trissomia 13',
      'Síndrome de Turner', 'Síndromes Cromossómicos Comuns',
      // ── Outros ────────────────────────────────────────────────────────
      'Doses Pediátricas e Ajustes', 'Antibioterapia em Pediatria',
      'Trauma Crânio-encefálico Ligeiro na Criança',
      'Abuso Infantil — Sinais de Alerta',
      'Maus Tratos e Negligência', 'Sopro Cardíaco Funcional vs Patológico',
    ],
  },
  {
    id: 'gineco_obstetricia',
    label: 'Ginecologia e Obstetrícia',
    icon: '🤰',
    color: '#be185d',
    bg: '#fdf2f8',
    border: '#fbcfe8',
    desc: 'Gravidez, parto, patologia ginecológica',
    topics: [
      // ── Obstetrícia — pré-natal ──────────────────────────────────────
      'Vigilância da Gravidez Normal', 'Náuseas e Vómitos na Gravidez',
      'Hiperémese Gravídica', 'Diagnóstico Pré-natal',
      'Rastreio Combinado do 1º Trimestre', 'Aloimunização Rh',
      // ── Complicações da gravidez ─────────────────────────────────────
      'Hipertensão na Gravidez', 'Pré-eclâmpsia e Eclâmpsia',
      'Síndrome HELLP', 'Diabetes Gestacional',
      'Restrição de Crescimento Fetal', 'Ameaça de Parto Prematuro',
      'Rotura Prematura de Membranas', 'Corioamnionite',
      'Tromboembolismo na Gravidez',
      // ── Parto e puerpério ────────────────────────────────────────────
      'Parto Normal — Fases', 'Distócia de Ombros',
      'Cesareana — Indicações e Técnica', 'Indução do Trabalho de Parto',
      'Analgesia Epidural — Indicações', 'Puerpério Normal',
      'Amamentação — Apoio Farmacêutico', 'Hemorragia Pós-Parto',
      'Depressão Pós-parto',
      // ── Aborto e ectópica ────────────────────────────────────────────
      'Aborto Espontâneo — Tipos', 'IVG — Aspectos Legais e Farmacológicos',
      'Gravidez Ectópica — Diagnóstico',
      // ── Patologia ginecológica ───────────────────────────────────────
      'Endometriose', 'Adenomiose',
      'Síndrome do Ovário Poliquístico', 'Miomas Uterinos',
      'Pólipos Endometriais', 'Doença Inflamatória Pélvica',
      'Vulvovaginites — DDx',
      // ── Oncologia ────────────────────────────────────────────────────
      'Cancro do Colo do Útero', 'Rastreio Cervical — HPV e Citologia',
      'Cancro do Ovário', 'Cancro do Endométrio', 'Cancro Vulvar',
      // ── Menopausa e contracepção ─────────────────────────────────────
      'Menopausa — Sintomas e Manejo', 'THS — Riscos e Benefícios',
      'Contracepção Oral Combinada', 'Contracepção Progestativa',
      'DIU — Cobre vs Hormonal', 'Contracepção de Emergência',
      // ── Farmacologia obstétrica ──────────────────────────────────────
      'Fármacos na Gravidez — Categorias FDA/EMA',
      'Fármacos na Amamentação',
    ],
  },
  {
    id: 'anatomia_fisiologia',
    label: 'Anatomia e Fisiologia',
    icon: '🫁',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    desc: 'Estrutura e função dos sistemas',
    topics: [
      // ── Cardiovascular ───────────────────────────────────────────────
      'Sistema Cardiovascular — Anatomia', 'Fisiologia Cardíaca e Ciclo Cardíaco',
      'Sistema de Condução do Coração', 'Regulação da Pressão Arterial',
      'Microcirculação e Permeabilidade',
      // ── Respiratório ──────────────────────────────────────────────────
      'Sistema Respiratório — Anatomia', 'Mecânica Respiratória e Trocas Gasosas',
      'Volumes e Capacidades Pulmonares', 'Curva de Dissociação da Hemoglobina',
      'Regulação Central da Respiração',
      // ── Neuro ─────────────────────────────────────────────────────────
      'Sistema Nervoso Central — Anatomia', 'Sistema Nervoso Periférico',
      'Sistema Nervoso Autónomo (Simpático/Parassimpático)',
      'Sinapse e Neurotransmissão', 'LCR — Produção e Circulação',
      'Vias Sensitivas e Motoras',
      // ── Renal / Ácido-base ───────────────────────────────────────────
      'Rim — Anatomia e Fisiologia', 'Nefrónio e Filtração Glomerular',
      'Equilíbrio Ácido-Base', 'Equilíbrio Hidroelectrolítico',
      'Sistema Renina-Angiotensina-Aldosterona',
      // ── Hepático / GI ─────────────────────────────────────────────────
      'Fígado — Anatomia e Funções', 'Sistema Digestivo — Fisiologia',
      'Metabolismo dos Fármacos (CYP450)', 'Circulação Enterohepática',
      // ── Endócrino ─────────────────────────────────────────────────────
      'Sistema Endócrino — Eixos Hormonais', 'Pâncreas Endócrino',
      'Eixo Hipotálamo-Hipófise', 'Tiróide — Síntese e Regulação',
      'Suprarrenal — Cortex e Medula',
      // ── Imune / Hemato ───────────────────────────────────────────────
      'Sistema Imunitário — Inato e Adaptativo', 'Hipersensibilidade — 4 Tipos',
      'Hemostase e Coagulação', 'Eritropoiese e Megaloblastose',
      'Grupos Sanguíneos e Transfusão',
      // ── Locomotor / Pele ─────────────────────────────────────────────
      'Sistema Musculoesquelético', 'Contracção Muscular',
      'Dermatologia — Estrutura da Pele', 'Cicatrização — Fases',
    ],
  },
  {
    id: 'semiologia',
    label: 'Semiologia',
    icon: '🩺',
    color: '#374151',
    bg: 'var(--bg-2)',
    border: 'var(--border)',
    desc: 'Exame físico, sinais e sintomas',
    topics: [
      // ── Exame geral e cardiopulmonar ─────────────────────────────────
      'Exame Físico Geral — Metodologia', 'Sinais Vitais — Interpretação',
      'Auscultação Cardíaca — Sons e Sopros', 'Sopros Cardíacos — Classificação',
      'Auscultação Pulmonar — Ruídos Adventícios', 'Padrões Respiratórios Anormais',
      'Palpação e Percussão Abdominal', 'Sinal de Murphy, McBurney, Blumberg',
      // ── Neurológico ───────────────────────────────────────────────────
      'Exame Neurológico — Pares Cranianos', 'Reflexos Osteotendinosos',
      'Sinais Meníngeos (Kernig, Brudzinski)', 'Avaliação do Nível de Consciência — GCS',
      'Exame de Força (MRC 0-5)', 'Coordenação e Marcha',
      // ── Sinais cardinais e DDx ───────────────────────────────────────
      'Edema — Causas e Classificação', 'Cianose — Central vs Periférica',
      'Icterícia — Diagnóstico Diferencial', 'Hepatoesplenomegalia',
      'Adenomegalias — Abordagem', 'Ascite — Diagnóstico Diferencial',
      'Eritema e Lesões Cutâneas Comuns', 'Petéquias e Púrpura',
      'Hipocratismo Digital', 'Cefaleia — Tipo e DDx',
      // ── Exames especiais ─────────────────────────────────────────────
      'Avaliação da Dor (EVA, Escala Numérica)',
      'Avaliação Cognitiva (MMSE, MoCA)',
      'Avaliação da Fragilidade (CFS)',
      'Exame Orofaríngeo', 'Exame Otoscópico',
      'Avaliação do Tireoide',
    ],
  },
  {
    id: 'enfermagem',
    label: 'Enfermagem Clínica',
    icon: '💉',
    color: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
    desc: 'Técnicas, protocolos, cuidados',
    topics: [
      // ── Administração de medicação ───────────────────────────────────
      'Administração de Medicação IV, IM, SC', 'Preparação e Cálculo de Doses',
      'Bombas e Seringas Infusoras', 'Diluições e Compatibilidades IV',
      'Administração por SNG/PEG', 'Insulinoterapia — Esquemas',
      'Hemoderivados — Administração e Reacções',
      // ── Acessos vasculares ───────────────────────────────────────────
      'Cateterismo Venoso Periférico', 'Cateter Venoso Central — Cuidados',
      'Cateter Tunelizado (Hickman, Port-a-Cath)', 'Linha Arterial',
      // ── Sondas, drenos, tubos ────────────────────────────────────────
      'Sondagem Nasogástrica', 'Sondagem Vesical — Algaliação',
      'Drenos Torácicos', 'Drenos Abdominais',
      'Traqueostomia — Cuidados',
      // ── Feridas e pressão ────────────────────────────────────────────
      'Prevenção de Úlceras de Pressão', 'Avaliação de Úlcera por Pressão (NPUAP)',
      'Pensos e Cuidados à Ferida', 'Tipos de Penso por Fase',
      'TPN — Terapia de Pressão Negativa',
      // ── Monitorização ────────────────────────────────────────────────
      'Monitorização de Sinais Vitais', 'Oximetria e Oxigenoterapia',
      'NEWS2 e Detecção do Doente Deteriorado',
      'Monitorização da Dor', 'Glicemia Capilar — Técnica',
      // ── Processo e escalas ───────────────────────────────────────────
      'Processo de Enfermagem — NANDA', 'CIPE — Classificação',
      'Escala de Braden (Risco UPP)', 'Escala de Morse (Risco de Queda)',
      'Escala de Barthel e Lawton (AVD)',
      'Escala de Glasgow (GCS)',
      // ── Segurança e controlo de infecção ─────────────────────────────
      'Higiene das Mãos — 5 Momentos', 'EPI — Tipos e Sequência',
      'Isolamento de Contacto, Gotículas, Aéreo',
      'Prevenção da Infecção Associada aos Cuidados',
      // ── Especificidades ──────────────────────────────────────────────
      'Triagem de Manchester', 'Cuidados Paliativos — Sintomas',
      'Via Subcutânea no Doente em Fim de Vida',
      'Cuidados ao Idoso — Particularidades',
      'Bombas PCA (Analgesia Controlada)',
    ],
  },
  {
    id: 'nutricao',
    label: 'Nutrição Clínica',
    icon: '🥗',
    color: '#65a30d',
    bg: '#f7fee7',
    border: '#d9f99d',
    desc: 'Dietética, suporte nutricional, patologias',
    topics: [
      // ── Avaliação ────────────────────────────────────────────────────
      'Avaliação do Estado Nutricional', 'IMC, PCT, CMB — Interpretação',
      'MUST e MNA — Rastreio', 'GLIM Critérios de Desnutrição',
      'Composição Corporal — Bioimpedância',
      // ── Necessidades ─────────────────────────────────────────────────
      'Necessidades Energéticas e Proteicas', 'Equação de Harris-Benedict',
      'Macronutrientes e Micronutrientes', 'Vitaminas e Oligoelementos',
      'Necessidades Hídricas',
      // ── Patologias ────────────────────────────────────────────────────
      'Dieta na Diabetes Mellitus', 'Contagem de Hidratos de Carbono',
      'Dieta na Doença Renal Crónica', 'Dieta no Doente em Hemodiálise',
      'Dieta na Insuficiência Cardíaca', 'Restrição de Sódio',
      'Dieta na Doença Hepática', 'Dieta na DII',
      'Dieta no Doente Oncológico', 'Caquexia Tumoral',
      'Dieta na Doença Celíaca',
      'Dieta na Hipertensão (DASH)', 'Dieta Mediterrânica',
      // ── Suporte nutricional ──────────────────────────────────────────
      'Suporte Nutricional Entérico — Indicações', 'Fórmulas Entéricas — Tipos',
      'Nutrição Parentérica Total', 'NPT — Complicações',
      'Síndrome de Realimentação', 'Disfagia — Texturas Modificadas',
      // ── Desnutrição e obesidade ──────────────────────────────────────
      'Desnutrição — Classificação e Tratamento', 'Sarcopenia no Idoso',
      'Obesidade — Abordagem Clínica', 'Cirurgia Bariátrica — Cuidados Nutricionais',
      // ── Alergias e ciclo de vida ─────────────────────────────────────
      'Alergias e Intolerâncias Alimentares', 'Anafilaxia Alimentar',
      'Nutrição na Gravidez', 'Suplementação Pré-natal',
      'Nutrição Pediátrica e Aleitamento', 'Diversificação Alimentar',
    ],
  },
]

type StudyMode = 'home' | 'flashcards' | 'quiz'
type FlashCard = { front: string; back: string }
type QuizQ = { question: string; options: string[]; correct: number; explanation: string }

// ─── Flashcards com SRS (Spaced Repetition System) ───────────────────────────

function FlashcardsMode({ topic, domain, cards, onBack, onSession }: {
  topic: string; domain: typeof DOMAINS[0]; cards: FlashCard[]
  onBack: () => void; onSession: (known: number, total: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<('easy'|'medium'|'hard')[]>([])
  const [done, setDone] = useState(false)

  const answer = (rating: 'easy'|'medium'|'hard') => {
    const newResults = [...results, rating]
    setResults(newResults)
    logStudy({ kind: 'flashcard', area: domain.label, correct: rating !== 'hard' })
    setFlipped(false)
    if (index + 1 >= cards.length) {
      const known = newResults.filter(r => r !== 'hard').length
      onSession(known, cards.length)
      setDone(true)
    } else {
      setTimeout(() => setIndex(p => p + 1), 150)
    }
  }

  if (done) {
    const easy = results.filter(r => r === 'easy').length
    const medium = results.filter(r => r === 'medium').length
    const hard = results.filter(r => r === 'hard').length
    const pct = Math.round(((easy + medium) / results.length) * 100)
    return (
      <div style={{ maxWidth:600, margin:'0 auto', textAlign:'center', padding:'48px 20px' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>{pct>=80?'🏆':pct>=60?'👍':'📚'}</div>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:28, color:'var(--ink)', marginBottom:8 }}>Sessão concluída</div>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:48, color:domain.color, marginBottom:16 }}>{pct}%</div>
        <div style={{ display:'flex', gap:20, justifyContent:'center', marginBottom:28 }}>
          {[['Fácil', easy, '#0d6e42'], ['Médio', medium, '#d97706'], ['Difícil', hard, '#dc2626']].map(([l,v,c]) => (
            <div key={l as string}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:28, color:c as string }}>{v}</div>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:24, fontSize:13, color:'var(--ink-3)' }}>
          {hard > 0 ? `${hard} cartão${hard>1?'s':''} marcado${hard>1?'s':''} para revisão prioritária.` : 'Excelente! Todos os cartões dominados.'}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={() => { setIndex(0); setFlipped(false); setResults([]); setDone(false) }}
            style={{ background:domain.color, color:'white', border:'none', borderRadius:8, padding:'11px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            Repetir
          </button>
          <button onClick={onBack}
            style={{ background:'white', color:'var(--ink-3)', border:'1px solid var(--border)', borderRadius:8, padding:'11px 22px', fontSize:14, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            Voltar
          </button>
        </div>
      </div>
    )
  }

  const card = cards[index]
  const progress = (index / cards.length) * 100

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--ink-4)' }}>{topic} · {index+1}/{cards.length}</div>
        <div style={{ display:'flex', gap:10, fontSize:11, fontFamily:'var(--font-mono)' }}>
          <span style={{ color:'#0d6e42' }}>{results.filter(r=>r==='easy').length} fácil</span>
          <span style={{ color:'#d97706' }}>{results.filter(r=>r==='medium').length} médio</span>
          <span style={{ color:'#dc2626' }}>{results.filter(r=>r==='hard').length} difícil</span>
        </div>
      </div>
      <div style={{ height:5, background:'var(--bg-3)', borderRadius:3, marginBottom:24, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${progress}%`, background:domain.color, borderRadius:3, transition:'width 0.3s' }} />
      </div>

      <div onClick={() => setFlipped(!flipped)}
        style={{ background:'white', border:`2px solid ${flipped ? domain.color : 'var(--border)'}`, borderRadius:12, padding:'44px 28px', minHeight:240, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', marginBottom:20, transition:'border-color 0.2s', position:'relative' }}>
        <div style={{ position:'absolute', top:14, left:16, right:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:9, fontFamily:'var(--font-mono)', color:flipped?domain.color:'var(--ink-5)', letterSpacing:'0.12em', textTransform:'uppercase' }}>
            {flipped ? '✓ RESPOSTA' : 'PERGUNTA'}
          </span>
          <span style={{ fontSize:11, color:'var(--ink-5)' }}>toca para {flipped?'ocultar':'revelar'}</span>
        </div>
        {!flipped
          ? <p style={{ fontFamily:'var(--font-serif)', fontSize:20, color:'var(--ink)', lineHeight:1.5, margin:0, maxWidth:520 }}>{card.front}</p>
          : <p style={{ fontSize:15, color:'var(--ink-2)', lineHeight:1.8, margin:0, maxWidth:520 }}>{card.back}</p>
        }
      </div>

      {flipped ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
          {[
            { label:'Difícil', sub:'Vou rever', rating:'hard' as const, bg:'#fee2e2', border:'#fca5a5', color:'#991b1b' },
            { label:'Médio', sub:'Quase certo', rating:'medium' as const, bg:'#fef9c3', border:'#fde68a', color:'#854d0e' },
            { label:'Fácil', sub:'Sei bem', rating:'easy' as const, bg:'#d1fae5', border:'#6ee7b7', color:'#065f46' },
          ].map(btn => (
            <button key={btn.rating} onClick={() => answer(btn.rating)}
              style={{ padding:'12px 8px', background:btn.bg, border:`1.5px solid ${btn.border}`, borderRadius:8, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              <div style={{ fontSize:14, fontWeight:700, color:btn.color, marginBottom:2 }}>{btn.label}</div>
              <div style={{ fontSize:11, color:btn.color, opacity:0.7 }}>{btn.sub}</div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'14px 0', fontSize:13, color:'var(--ink-4)' }}>
          Avalia o teu conhecimento depois de revelar a resposta
        </div>
      )}
    </div>
  )
}

// ─── Quiz Mode ────────────────────────────────────────────────────────────────

function QuizMode({ topic, domain, questions, onBack, onSession }: {
  topic: string; domain: typeof DOMAINS[0]; questions: QuizQ[]
  onBack: () => void; onSession: (correct: number, total: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number|null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  if (done) {
    const pct = Math.round((score/questions.length)*100)
    return (
      <div style={{ maxWidth:600, margin:'0 auto', textAlign:'center', padding:'48px 20px' }}>
        <div style={{ fontSize:52, marginBottom:14 }}>{pct>=80?'🏆':pct>=60?'📚':'💪'}</div>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--ink)', marginBottom:8 }}>Quiz concluído</div>
        <div style={{ fontSize:52, fontWeight:700, color:pct>=70?domain.color:pct>=50?'#d97706':'#dc2626', margin:'8px 0 16px' }}>{pct}%</div>
        <p style={{ fontSize:15, color:'var(--ink-3)', marginBottom:28 }}>{score} correctas em {questions.length} perguntas</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={() => { setIndex(0); setSelected(null); setScore(0); setDone(false) }}
            style={{ background:domain.color, color:'white', border:'none', borderRadius:8, padding:'11px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Repetir</button>
          <button onClick={onBack}
            style={{ background:'white', color:'var(--ink-3)', border:'1px solid var(--border)', borderRadius:8, padding:'11px 22px', fontSize:14, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Voltar</button>
        </div>
      </div>
    )
  }

  const q = questions[index]
  const answer = (i: number) => {
    if (selected !== null) return
    setSelected(i)
    logStudy({ kind: 'quiz', area: domain.label, correct: i === q.correct })
    if (i === q.correct) setScore(p=>p+1)
  }
  const next = () => {
    if (index+1 >= questions.length) { onSession(score + (selected===q.correct?1:0), questions.length); setDone(true) }
    else { setSelected(null); setIndex(p=>p+1) }
  }

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--ink-4)' }}>{topic} · {index+1}/{questions.length}</span>
        <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:domain.color }}>{score} correctas</span>
      </div>
      <div style={{ height:5, background:'var(--bg-3)', borderRadius:3, marginBottom:24, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${(index/questions.length)*100}%`, background:domain.color, borderRadius:3 }} />
      </div>

      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'24px 22px 20px', marginBottom:12 }}>
        <p style={{ fontFamily:'var(--font-serif)', fontSize:18, color:'var(--ink)', lineHeight:1.6, margin:'0 0 20px' }}>{q.question}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {q.options.map((opt, i) => {
            let bg='var(--bg-2)', border='var(--border-2)', color='var(--ink-2)'
            if (selected !== null) {
              if (i===q.correct) { bg='#d1fae5'; border='#6ee7b7'; color='#065f46' }
              else if (i===selected) { bg='#fee2e2'; border='#fca5a5'; color='#991b1b' }
              else { bg='white'; color='var(--ink-5)' }
            }
            return (
              <button key={i} onClick={() => answer(i)}
                style={{ background:bg, border:`1px solid ${border}`, borderRadius:7, padding:'12px 14px', fontSize:14, color, cursor:selected===null?'pointer':'default', textAlign:'left', fontFamily:'var(--font-sans)', lineHeight:1.5, display:'flex', alignItems:'flex-start', gap:10, transition:'all 0.15s' }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, minWidth:18, flexShrink:0, marginTop:1 }}>{String.fromCharCode(65+i)}.</span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {selected !== null && (
        <>
          <div style={{ background:'#f0fdf5', border:'1px solid #bbf7d0', borderLeft:`4px solid ${domain.color}`, borderRadius:8, padding:'14px 18px', marginBottom:12 }}>
            <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--green-2)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6 }}>EXPLICAÇÃO</div>
            <p style={{ fontSize:13, color:'var(--ink-2)', lineHeight:1.7, margin:0 }}>{q.explanation}</p>
          </div>
          <button onClick={next}
            style={{ width:'100%', background:domain.color, color:'white', border:'none', borderRadius:8, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            {index<questions.length-1 ? 'Próxima →' : 'Ver resultado'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudyPage() {
  const { user, supabase } = useAuth()
  // Vindo do hub /aprender (?mode=quiz|flashcards) memorizamos a atividade
  // pretendida para arrancar nesse modo assim que o utilizador escolhe o tópico.
  const [intent, setIntent] = useState<'quiz' | 'flashcards' | null>(null)
  useEffect(() => {
    try {
      const m = new URLSearchParams(window.location.search).get('mode')
      if (m === 'quiz' || m === 'flashcards') setIntent(m)
    } catch {}
  }, [])
  const [mode, setMode] = useState<StudyMode>('home')
  const [selectedDomain, setSelectedDomain] = useState<typeof DOMAINS[0] | null>(null)
  const [selectedTopic, setSelectedTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flashcards, setFlashcards] = useState<FlashCard[]>([])
  const [quiz, setQuiz] = useState<QuizQ[]>([])
  const [activeDomainId, setActiveDomainId] = useState<string|null>(null)
  const [sessionStats, setSessionStats] = useState<Record<string, { sessions: number; lastScore: number }>>({})
  const plan = (user?.plan || 'free') as string
  const isStudent = plan==='student'||plan==='pro'||plan==='clinic'

  // Load session stats
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { data } = await supabase.from('study_sessions').select('type, metadata, xp_earned')
          .eq('user_id', user.id)
        if (!data) return
        const stats: Record<string, { sessions: number; lastScore: number }> = {}
        data.forEach((s: any) => {
          const key = s.metadata?.topic
          if (!key) return
          if (!stats[key]) stats[key] = { sessions: 0, lastScore: 0 }
          stats[key].sessions++
          if (s.metadata?.score) stats[key].lastScore = s.metadata.score
        })
        setSessionStats(stats)
      } catch {}
    })()
  }, [user, supabase])

  const recordSession = useCallback(async (topic: string, known: number, total: number) => {
    if (!user) return
    try {
      await supabase.from('study_sessions').insert({
        user_id: user.id,
        type: mode === 'flashcards' ? 'flashcard' : 'quiz',
        drug_class: topic,
        xp_earned: Math.round((known/total) * 20) + 5,
        metadata: { topic, score: Math.round((known/total)*100), known, total, domain: selectedDomain?.id },
      })
      if (mode === 'quiz') {
        await supabase.from('quiz_results').insert({
          user_id: user.id, drug_class: topic, correct: known > total/2,
        })
      }
    } catch {}

    setSessionStats(prev => ({
      ...prev,
      [topic]: { sessions: (prev[topic]?.sessions || 0) + 1, lastScore: Math.round((known/total)*100) }
    }))
  }, [user, supabase, mode, selectedDomain])

  const start = async (topic: string, studyMode: 'flashcards'|'quiz') => {
    if (!isStudent) return
    setLoading(true); setError(''); setSelectedTopic(topic)
    try {
      const endpoint = studyMode === 'flashcards' ? '/api/study/flashcards' : '/api/study/quiz'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugClass: topic, domain: selectedDomain?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (studyMode === 'flashcards') { setFlashcards(data.flashcards); setMode('flashcards') }
      else { setQuiz(data.questions); setMode('quiz') }
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const goBack = () => {
    setMode('home')
    if (!activeDomainId) setSelectedDomain(null)
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>

      <div className="page-container page-body">

        {mode === 'home' && !selectedDomain && <StudyProgressBar />}

        {mode !== 'home' && (
          <button onClick={goBack}
            style={{ background:'none', border:'none', fontSize:13, color:'var(--ink-4)', cursor:'pointer', fontFamily:'var(--font-sans)', marginBottom:24, padding:0, display:'flex', alignItems:'center', gap:6 }}>
            ← Voltar
          </button>
        )}

        {error && (
          <div style={{ background:'var(--red-light)', border:'1px solid #fca5a5', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--red)' }}>{error}</div>
        )}

        {loading && (
          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'56px', textAlign:'center' }}>
            <div style={{ width:36, height:36, border:`3px solid ${selectedDomain?.color || 'var(--green)'}30`, borderTop:`3px solid ${selectedDomain?.color || 'var(--green)'}`, borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 16px' }} />
            <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.12em' }}>A gerar conteúdo pedagógico para {selectedTopic}...</div>
          </div>
        )}

        {/* HOME */}
        {!loading && mode === 'home' && (
          <>
            {!selectedDomain ? (
              <>
                {/* Header */}
                <div style={{ marginBottom:28 }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8 }}>Plataforma de Estudo · Plus</div>
                  <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(22px,3vw,32px)', color:'var(--ink)', fontWeight:400, marginBottom:8, letterSpacing:'-0.01em' }}>
                    Todas as áreas das ciências da saúde
                  </h1>
                  <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.6 }}>
                    {DOMAINS.reduce((acc, d) => acc + d.topics.length, 0)} tópicos · {DOMAINS.length} domínios · Flashcards e quizzes gerados por AI · Repetição espaçada (SRS)
                  </p>
                </div>

                {!isStudent && (
                  <div style={{ background:'#faf5ff', border:'2px solid #e9d5ff', borderRadius:12, padding:'24px', marginBottom:24, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                    <span style={{ fontSize:32, flexShrink:0 }}>🎓</span>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:'#5b21b6', marginBottom:4 }}>Plano Plus — estudo sem limites</div>
                      <div style={{ fontSize:13, color:'#7c3aed', lineHeight:1.6 }}>Farmacologia, Medicina Interna, Emergência, Cirurgia, Pediatria e mais. Flashcards e quizzes por IA, repetição espaçada e progresso real — por 3,99€/mês.</div>
                    </div>
                    <Link href="/checkout?plan=student" style={{ background:'#7c3aed', color:'white', textDecoration:'none', padding:'11px 22px', borderRadius:8, fontSize:14, fontWeight:700, flexShrink:0 }}>
                      Activar Plus →
                    </Link>
                  </div>
                )}

                {/* Domain cards */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap:10 }}>
                  {DOMAINS.map(domain => {
                    const domainSessions = domain.topics.reduce((acc, t) => acc + (sessionStats[t]?.sessions || 0), 0)
                    const topicsStudied = domain.topics.filter(t => sessionStats[t]?.sessions > 0).length
                    const avgScore = domain.topics.reduce((acc, t) => acc + (sessionStats[t]?.lastScore || 0), 0) / domain.topics.length

                    return (
                      <button key={domain.id} onClick={() => { setSelectedDomain(domain); setActiveDomainId(domain.id) }}
                        disabled={!isStudent}
                        style={{ display:'flex', flexDirection:'column', padding:'20px', background:isStudent?'white':'var(--bg-2)', border:`1px solid ${domain.border}`, borderRadius:12, cursor:isStudent?'pointer':'not-allowed', textAlign:'left', transition:'all 0.15s', opacity:isStudent?1:0.6 }}
                        className="domain-card">
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                          <span style={{ fontSize:24 }}>{domain.icon}</span>
                          <div>
                            <div style={{ fontSize:15, fontWeight:700, color:domain.color, letterSpacing:'-0.01em' }}>{domain.label}</div>
                            <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>{domain.topics.length} tópicos</div>
                          </div>
                        </div>
                        <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.5, marginBottom:12 }}>{domain.desc}</div>
                        {domainSessions > 0 ? (
                          <div style={{ marginTop:'auto' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{topicsStudied}/{domain.topics.length} estudados</span>
                              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:domain.color }}>{Math.round(avgScore)}% média</span>
                            </div>
                            <div style={{ height:3, background:domain.border, borderRadius:2, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${(topicsStudied/domain.topics.length)*100}%`, background:domain.color, borderRadius:2 }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop:'auto', fontSize:11, color:domain.color, fontFamily:'var(--font-mono)', fontWeight:700 }}>
                            {isStudent ? 'Começar →' : 'Requer Plus'}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Domain topics */}
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                  <button onClick={() => setSelectedDomain(null)}
                    style={{ background:'none', border:'none', fontSize:13, color:'var(--ink-4)', cursor:'pointer', fontFamily:'var(--font-sans)', padding:0, display:'flex', alignItems:'center', gap:4 }}>
                    ← Domínios
                  </button>
                  <div style={{ width:1, height:16, background:'var(--border)' }} />
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{selectedDomain.icon}</span>
                    <span style={{ fontSize:16, fontWeight:700, color:selectedDomain.color }}>{selectedDomain.label}</span>
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {selectedDomain.topics.map(topic => {
                    const ts = sessionStats[topic]
                    const scoreColor = !ts ? 'var(--ink-4)' : ts.lastScore>=80?'#0d6e42':ts.lastScore>=60?'#d97706':'#dc2626'
                    return (
                      <div key={topic} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'white', border:'1px solid var(--border)', borderRadius:10, transition:'border-color 0.15s' }}
                        className="topic-row">
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', letterSpacing:'-0.01em' }}>{topic}</div>
                          {ts && <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>{ts.sessions} sessão{ts.sessions>1?'ões':''} · último score: <span style={{ color:scoreColor, fontWeight:700 }}>{ts.lastScore}%</span></div>}
                        </div>
                        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                          {/* O modo que veio do hub (?mode=) fica como ação principal (preenchida). */}
                          {(['flashcards','quiz'] as ('flashcards'|'quiz')[]).map(m => {
                            const primary = intent ? m === intent : m === 'flashcards'
                            return (
                              <button key={m} onClick={() => start(topic, m)}
                                style={primary
                                  ? { padding:'8px 14px', background:selectedDomain.color, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)' }
                                  : { padding:'8px 14px', background:'white', color:selectedDomain.color, border:`1.5px solid ${selectedDomain.border}`, borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
                                {m === 'flashcards' ? 'Flashcards' : 'Quiz'}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* FLASHCARDS */}
        {!loading && mode==='flashcards' && flashcards.length>0 && selectedDomain && (
          <FlashcardsMode topic={selectedTopic} domain={selectedDomain} cards={flashcards}
            onBack={goBack} onSession={(k,t) => recordSession(selectedTopic, k, t)} />
        )}

        {/* QUIZ */}
        {!loading && mode==='quiz' && quiz.length>0 && selectedDomain && (
          <QuizMode topic={selectedTopic} domain={selectedDomain} questions={quiz}
            onBack={goBack} onSession={(k,t) => recordSession(selectedTopic, k, t)} />
        )}
      </div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .domain-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.06);transform:translateY(-2px)}
        .topic-row:hover{border-color:var(--border-2)!important}
      `}</style>
    </div>
  )
}