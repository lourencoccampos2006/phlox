// app/api/decisao/start/route.ts
// Phlox Decisão — Geração inicial do caso evolutivo.
//
// Atualização 2026-05-31:
//   • Adicionada categoria "free" para permitir entrada livre (texto) — antes o
//     utilizador estava limitado a 8-12 botões.
//   • Inclui 1-3 ações claramente perigosas (overdose, fármaco contraindicado,
//     omitir intervenção crítica) que NÃO devem ser sinalizadas como tal — o
//     ponto é aprender com o erro num espaço seguro.
//   • Casos adicionados: anafilaxia, AVC isquémico, hipercaliémia, intoxicação
//     por opioides — para variedade.
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const CASE_DEFINITIONS: Record<string, string> = {
  // ── Cardiologia ─────────────────────────────────────────────────────────
  chf_decompensation: `Cria um caso de descompensação cardíaca aguda. Homem 72 anos, FA paroxística conhecida, IC-FEr (FE 35%) prévia. Recorre à urgência com dispneia em repouso, ortopneia de 3 almofadas, edemas. TA 160/95, FC 110 irregular, FR 28, SpO2 88% AA, apirético. Faz bisoprolol 5mg, furosemida 40mg, ramipril 10mg, varfarina.`,
  stemi_anterior: `Cria um caso de STEMI anterior extenso. Homem 58 anos, fumador, HTA, dislipidemia. Dor retroesternal opressiva há 90 min, irradiando para mandíbula, com sudorese. TA 100/60, FC 105, SpO2 95%. ECG: supra-ST V2-V6, DI, aVL. Troponina T 1850 ng/L (ref <14). Sala de hemodinâmica disponível mas a 35 min.`,
  nstemi: `Cria um caso de NSTEMI. Mulher 67 anos, DM2, HTA. Dor torácica intermitente nas últimas 4h, atualmente assintomática. TA 145/85, FC 78, SpO2 97%. ECG: subdesnivelamento ST V4-V6, ondas T invertidas. Troponina T 95 → 220 ng/L (2h depois). GRACE 142.`,
  aortic_dissection: `Cria um caso de dissecção aórtica tipo A. Homem 56 anos, HTA mal controlada. Dor torácica subitamente intensa "rasgada" há 30 min, irradiando para dorso. TA braço direito 180/100, braço esquerdo 130/70. Sopro diastólico aórtico novo. ECG sem isquémia. Confuso.`,
  pericarditis_tamponade: `Cria um caso de pericardite com tamponamento iminente. Mulher 32 anos, infeção respiratória superior há 1 semana. Dor torácica posicional (pior em decúbito), febrícula. Atrito pericárdico audível. Pulso paradoxal 18mmHg, TA 95/65, FC 115, JVP elevada. Eco: derrame pericárdico moderado-grave, colapso AD em diástole.`,
  bradyarrhythmia_block: `Cria um caso de bloqueio AV completo sintomático. Mulher 78 anos, em bisoprolol 5mg e digoxina 0.125mg. Síncope em casa há 1h. À chegada TA 80/50, FC 32 regular. ECG: dissociação AV, escape ventricular largos, sem onda P relacionada com QRS.`,

  // ── Pulmonar ────────────────────────────────────────────────────────────
  copd_exacerbation: `Cria um caso de exacerbação grave de DPOC. Homem 71 anos, GOLD 3, em LABA+LAMA+CSI. Aumento de dispneia, esputo purulento, sibilos. TA 138/82, FC 108, FR 28, SpO2 84% AA (basal 91%). pH 7.30, pCO2 65, pO2 52 (FiO2 21%). Confuso.`,
  asthma_severe: `Cria um caso de crise asmática grave. Mulher 24 anos, asma persistente moderada (CSI+LABA). Dispneia há 6h, salbutamol 6 puffs sem alívio. Frases incompletas. FC 132, FR 32, SpO2 88% AA. PEF 25% do teórico. Sem sibilos audíveis (peito silencioso).`,
  pulmonary_embolism: `Cria um caso de TEP submaciço. Mulher 52 anos, cirurgia abdominal há 12 dias, alta há 4. Dispneia súbita há 2h, dor pleurítica direita. TA 105/65, FC 118, FR 26, SpO2 90%. D-dímeros 4200. AngioTAC: trombo em ramo lobar direito, sem disfunção do VD na ecocardio. Troponina elevada.`,
  pneumothorax_tension: `Cria um caso de pneumotórax hipertensivo. Homem 28 anos, magro, fumador. Dor torácica esquerda súbita e dispneia há 20 min. TA 85/55, FC 130, FR 32, SpO2 89%. Hipotimpânico à esquerda, sem MV, desvio traqueal para direita, JVP elevada. Sem radiografia ainda disponível.`,
  pneumonia_abx: `Cria um caso de pneumonia sem resposta ao antibiótico. Mulher 55 anos, internada há 3 dias com pneumonia lobar direita, iniciou amoxicilina 1g TID. Sem melhoria: ainda febril (38.8°C), PCR subiu de 180 para 240 mg/L. Culturais de escarro pendentes. Sem alergias conhecidas. Não institucionalizada, sem antibióticos recentes.`,

  // ── Sépsis / Infeções ──────────────────────────────────────────────────
  sepsis_antibiotics: `Cria um caso de sépsis associada aos cuidados de saúde. Mulher 58 anos, internada há 3 dias por pneumonia, em amoxicilina. Novo pico febril (39.2°C), FC 118, TA 90/60, FR 24, SpO2 93%. Confusa. Cateter venoso periférico 3 dias. Leucocitose 22.000.`,
  meningitis_bacterial: `Cria um caso de meningite bacteriana provável. Homem 22 anos, estudante universitário em residência. Cefaleia intensa há 12h, febre 39.4°C, vómitos, rigidez da nuca, exantema petequial nos membros inferiores. Confuso, GCS 13. TA 95/55, FC 124. TAC sem alterações; punção lombar em vias.`,
  neutropenic_fever: `Cria um caso de neutropenia febril. Mulher 56 anos, LMA em quimioterapia D+8. Febre 38.7°C, sem outros sintomas. TA 110/65, FC 102, SpO2 97%. Neutrófilos 280/µL. Sem foco evidente. Cateter central tunelizado há 3 semanas, sem sinais inflamatórios. Sem profilaxia anti-fúngica.`,
  tropical_malaria: `Cria um caso de malária importada por P. falciparum. Homem 34 anos, regressou de Moçambique há 5 dias sem profilaxia. Febre 39.6°C há 48h em picos, calafrios, cefaleia, vómitos. TA 105/70, FC 118, SpO2 96%. Esfregaço positivo: parasitemia 4%. Glicémia 68 mg/dL, plaquetas 65.000.`,
  urinary_pyelonephritis: `Cria um caso de pielonefrite aguda complicada. Mulher 68 anos, DM2. Febre 39°C, dor lombar direita, polaquiúria, vómitos. TA 95/60, FC 108, FR 22. Tira-teste urinária: nitritos+, leucócitos++. Creatinina 1.6 (basal 0.9). Ecografia rim direito: dilatação pielocalicial moderada.`,

  // ── Endócrino / Metabólico ─────────────────────────────────────────────
  dm_ketoacidosis: `Cria um caso de cetoacidose diabética. Mulher 45 anos, DM1, insulina basal-bólus. Últimos 3 dias de vómitos, recusa alimentar, não ajustou insulina. Glicémia 450 mg/dL, cetona urinária 4+, pH 7.21, Bic 12, Na 132 (corrigido 138), K+ 3.2 mEq/L. TA 100/65, FC 120, mucosas secas.`,
  hyperosmolar_state: `Cria um caso de estado hiperosmolar. Homem 78 anos, DM2 em metformina. Família encontra-o confuso e desidratado em casa. Glicémia 920 mg/dL, Na 158 mEq/L, osmolaridade calculada 360, pH 7.35, cetonas urinárias negativas. TA 95/60, FC 124, FR 22, mucosas secas, sinal da prega.`,
  thyroid_storm: `Cria um caso de crise tireotóxica. Mulher 42 anos, doença de Graves não controlada (interrompeu tiamazol há 4 semanas). Após infeção respiratória: febre 39.7°C, FC 158 em FA, agitação, vómitos. TSH suprimida, T4L 6.2x normal. TA 165/95, ICC nova (S3, edemas). GCS 13.`,
  adrenal_crisis: `Cria um caso de crise addisoniana. Mulher 56 anos, DAI em hidrocortisona 20+10mg. Há 4 dias com gastroenterite, não tomou medicação. Hipotensão refractária TA 75/45, FC 130, fraqueza extrema. Na 122, K 5.8, glicémia 58 mg/dL. Sem febre. Hiperpigmentação mucosas.`,
  hyperkalemia: `Cria um caso de hipercaliémia grave. Homem 76 anos, DRC estádio 4 (TFGe 22), HTA, DM2. Vem a consulta por fraqueza generalizada de início no dia. ECG: ondas T apiculadas em precordiais, PR alargado, QRS 0.14s. K+ 7.2 mEq/L, creatinina 3.1 (basal 2.4), HCO3- 16, glicémia 248. Faz ramipril 10mg, espironolactona 25mg, metformina 850mg BD, insulina basal 12U, AAS 100mg. Recentemente iniciou trimetoprim por ITU.`,
  hyponatremia_severe: `Cria um caso de hiponatremia sintomática. Mulher 72 anos, em tiazida e ISRS há 6 meses. Confusão progressiva, cefaleia, 1 crise convulsiva. Na 112 mEq/L. Osmolaridade urinária 480, Na urinário 65. Sem edemas, mucosas húmidas. Convulsão presenciada há 10 min, agora pós-ictal.`,

  // ── Neurologia ──────────────────────────────────────────────────────────
  ischemic_stroke: `Cria um caso de AVC isquémico em janela. Homem 64 anos, HTA e dislipidemia controladas. Familiares trouxeram-no 1h45 após início súbito de hemiparesia direita e disartria — viu-o bem 1h45 antes. NIHSS 14. TA 198/108, FC 88, glicémia capilar 142 mg/dL, sem febre. TAC-CE sem hemorragia, ASPECTS 9. Faz AAS 100mg, atorvastatina 20mg, ramipril 5mg. Sem anticoagulantes.`,
  hemorrhagic_stroke: `Cria um caso de AVC hemorrágico. Mulher 71 anos, HTA mal controlada em 3 fármacos. Cefaleia súbita explosiva há 1h, hemiplegia esquerda, vómitos, GCS 11. TA 215/120, FC 62, FR 18. TAC-CE: hemorragia intraparenquimatosa putaminal direita, 28 mL, sem inundação ventricular. INR 1.0, plaquetas normais.`,
  status_epilepticus: `Cria um caso de status epilépticus. Homem 45 anos, epilepsia conhecida (em lamotrigina), última crise há 2 anos. Crise tónico-clónica há 8 min sem recuperação, agora segunda crise sem voltar a si entre elas. TA 145/85, FC 115, FR 26, SpO2 92%, glicémia 110, sem febre.`,
  guillain_barre: `Cria um caso de síndrome de Guillain-Barré. Homem 38 anos, gastroenterite há 2 semanas. Fraqueza ascendente nas últimas 48h: agora dificuldade em andar e parestesias nas mãos. Reflexos ausentes nos membros inferiores. FR 18, capacidade vital reduzida (1.2L), engasga-se com água. TA 110/70, FC 60. LCR: dissociação albumino-citológica.`,
  meningitis_viral: `Cria um caso de meningoencefalite viral. Mulher 30 anos. Há 3 dias com cefaleia, febre 38.6°C, alterações de comportamento. Hoje primeira crise convulsiva focal. Rigidez ligeira da nuca. RM: hiperintensidade temporal mesial bilateral.`,

  // ── GI / Hepato ────────────────────────────────────────────────────────
  anticoag_bleeding: `Cria um caso de hemorragia digestiva alta no doente anticoagulado. Homem 68 anos, FA permanente em varfarina 5mg. INR 8.2 colhido hoje. Hematemese de sangue vivo há 1h. TA 95/60, FC 118, Hb 8.2 g/dL, hematócrito 25%.`,
  acute_pancreatitis: `Cria um caso de pancreatite aguda grave. Mulher 56 anos, litíase biliar conhecida. Dor epigástrica intensa irradiando para o dorso há 18h, vómitos. TA 95/65, FC 122, FR 24, SpO2 92%. Lipase 1850 U/L (ref < 60). PCR 320. BISAP 4. Distendido, peristalse abolida.`,
  perforated_ulcer: `Cria um caso de úlcera péptica perfurada. Homem 64 anos, em AINEs por lombalgia crónica. Dor epigástrica súbita "como punhalada" há 4h, agora generalizada. TA 100/65, FC 118, FR 24, febrícula. Abdómen em tábua, ausência de peristaltismo. Rx tórax: pneumoperitoneu.`,
  hepatic_encephalopathy: `Cria um caso de encefalopatia hepática grau III. Homem 58 anos, cirrose alcoólica Child B. Há 3 dias com confusão progressiva. Agora desorientado, asterixis evidente, sonolento mas responde à voz. Familiares dizem que esqueceu lactulose há 1 semana e tem tido obstipação. Amónia 142. Sem hemorragia visível.`,
  cholangitis: `Cria um caso de colangite aguda (tríade de Charcot + Reynolds). Mulher 73 anos, ictericia há 4 dias. Dor no HCD, febre 39.3°C, hipotensão TA 88/50, FC 124, confusão. Bilirrubina total 8.2, FA 480, GGT 720, leucócitos 19.000, PCR 280. Ecografia: dilatação biliar e cálculo coledociano.`,

  // ── Toxicologia ────────────────────────────────────────────────────────
  opioid_overdose: `Cria um caso de depressão respiratória por opioides. Homem 58 anos, dor oncológica em morfina LP 60mg 12/12h + breakthrough 20mg PRN. Encontrado pela esposa em casa, pouco reativo, FR 6/min, SpO2 82% AA, miose puntiforme, TA 100/60, FC 58. Última toma de breakthrough há 90 min — esposa diz que tomou 3 doses em poucas horas por dor.`,
  paracetamol_overdose: `Cria um caso de intoxicação por paracetamol. Mulher 19 anos, ingestão de 30 comprimidos de paracetamol 500mg há 10h em tentativa de suicídio. Náuseas, vómitos, sem dor abdominal ainda. Paracetamol sérico 220 mg/L (nomograma: linha de tratamento). ALT 60, INR 1.2. TA 115/75, FC 88.`,
  tca_overdose: `Cria um caso de overdose de tricíclicos. Mulher 27 anos, depressão. Ingestão de amitriptilina 50mg x 30cp há 90 min. Encontrada sonolenta pela mãe. À chegada: GCS 9, FC 132, TA 90/55, midríase, mucosas secas. ECG: QRS 0.14s, QTc 510, ondas R em aVR > 3mm. Crise tónico-clónica há 5 min, acabada de resolver.`,
  bb_overdose: `Cria um caso de overdose de betabloqueante. Homem 45 anos, ingestão suicidária de propranolol 40mg x 40cp há 2h. Bradicardia 35bpm, TA 75/40, hipoglicémia 45 mg/dL, sonolento mas responde à voz. ECG: bradicardia sinusal, PR 280ms, sem outras alterações. Sem resposta a 2mg atropina IV.`,
  organophosphate: `Cria um caso de intoxicação por organofosforados. Homem 56 anos, agricultor, encontrado no campo a aspergir herbicida sem EPI. Vómitos, diarreia, salivação profusa, miose, sibilos, fasciculações. FR 28, SpO2 88%, FC 52, TA 100/65, GCS 13. Pele com odor químico.`,

  // ── Hematologia / Oncologia ────────────────────────────────────────────
  tumor_lysis: `Cria um caso de síndrome de lise tumoral. Homem 49 anos, LBA Burkitt, 12h após início de quimioterapia. Oligúria, náuseas. K 6.4, fósforo 9.8, cálcio 7.2 (corrigido), ácido úrico 14, creatinina 2.4 (basal 1.0). LDH 4800. ECG sem alterações.`,
  ttp_microangiopathy: `Cria um caso de PTT. Mulher 34 anos. Confusão flutuante, febre 38.1°C, petéquias. Hb 7.8 (esquizócitos no esfregaço), plaquetas 18.000, LDH 2400, creatinina 1.5, haptoglobina indetectável. Sem antibióticos recentes. Função hepática normal.`,

  // ── Trauma / Emergência ───────────────────────────────────────────────
  head_trauma_severe: `Cria um caso de TCE grave. Homem 24 anos, motociclista, acidente alta cinética sem capacete há 30 min. GCS na cena 7, intubado pelo INEM. Pupila direita 5mm não reativa, esquerda 3mm reativa. TA 95/55, FC 58, FR 12 (ventilado). TAC-CE: hematoma subdural agudo direito 14mm, desvio linha média 8mm.`,
  trauma_polytrauma: `Cria um caso de politraumatismo. Mulher 38 anos, atropelamento alta cinética há 25 min. GCS 14 (E4V4M6), confusa. TA 90/55, FC 132, FR 28. Equimose abdominal, dor à palpação. Fractura aberta tíbia direita com hemorragia ativa. FAST positivo no hipocôndrio esquerdo. Hb 9.4.`,

  // ── Obstetrícia / Ginecologia ─────────────────────────────────────────
  eclampsia: `Cria um caso de eclâmpsia. Grávida 28 anos, 34 semanas. Cefaleia há 24h, fotofobia, edemas. Hoje primeira crise convulsiva. TA 175/115, proteinúria 4+, plaquetas 92.000, AST 220, LDH 580. Cardiotocografia: CTG normal. Sem trabalho de parto.`,
  pph_postpartum: `Cria um caso de hemorragia pós-parto. Puérpera 31 anos, parto eutócico há 2h. Trabalho de parto longo (18h). Hemorragia abundante contínua, > 1500 mL. TA 85/50, FC 132, palidez. Útero atónico, palpável a nível supraumbilical. Sem laceração visível à inspeção.`,

  // ── Pediatria ──────────────────────────────────────────────────────────
  pediatric_bronchiolitis: `Cria um caso de bronquiolite grave. Lactente 4 meses, ex-prematuro 32 semanas. 3 dias de tosse e dificuldade respiratória crescente. FR 72, SpO2 88% AA, tiragem global, gemido expiratório, adejo nasal. FC 168, mucosas húmidas. Recusa alimentar. Mãe diz que faz pausas respiratórias breves.`,
  pediatric_febrile_seizure: `Cria um caso de convulsão febril complicada. Criança 18 meses, anteriormente saudável. Febre desde manhã (T 39.2°C), crise tónico-clónica generalizada há 7 min em casa, sem recuperação total entre crises. Agora chega ao SU pós-ictal, GCS 13, FC 142. Sem rigidez nucal evidente. Otite média à otoscopia.`,
  pediatric_intussusception: `Cria um caso de invaginação intestinal. Lactente 9 meses, previamente saudável. Crises de choro e abdómen tenso há 12h, intervalos de calma com sonolência. Vómitos verdes nas últimas 4h. Última dejeção: "geleia de morango" (sangue e muco). Abdómen distendido, massa palpável no HCD.`,

  // ── Comportamental / Psiquiátrico ─────────────────────────────────────
  serotonin_syndrome: `Cria um caso de síndrome serotoninérgica. Homem 36 anos, em sertralina 100mg. Há 2 dias adicionou tramadol por dor pós-extracção. Hoje agitação, tremor, sudação profusa, mioclónias, hiper-reflexia mais marcada nos membros inferiores, clónus aquiliano sustentado. Tax 39.4°C, FC 128, TA 165/95.`,
  nms: `Cria um caso de síndrome neuroléptico maligno. Homem 42 anos, esquizofrenia. Início recente de haloperidol depot há 5 dias. Estuporoso, rigidez "tubo de chumbo" generalizada, febre 40.1°C, sudorese profusa, taquicardia 132, TA flutuante, mioglobinúria. CK 18.500.`,

  // ── Polimedicação / Geriatria ─────────────────────────────────────────
  polypharmacy_elderly: `Cria um caso de queda no idoso polimedicado. Homem 84 anos, 11 medicamentos: furosemida 40mg, espironolactona 25mg, ramipril 5mg, bisoprolol 5mg, amlodipina 10mg, sinvastatina 20mg, metformina 500mg BD, alprazolam 0.5mg noite, omeprazol 20mg, ácido acetilsalicílico 100mg, donepezilo 10mg. Queda às 3h da manhã ao ir à casa de banho. Sem traumatismo craniano. TA deitado 130/80, TA em pé 95/60.`,
  delirium_hyperactive: `Cria um caso de delirium hiperactivo no idoso. Mulher 81 anos, internada há 4 dias por pneumonia em recuperação. Esta noite: agitação, alucinações visuais, tenta retirar acessos. Está em ceftriaxone, paracetamol, oxicodona PRN, lorazepam ao deitar há 3 noites. Globo vesical à palpação. Última dejeção há 5 dias.`,
  warfarin_inr_elevation: `Cria um caso de INR muito elevado sem hemorragia. Mulher 76 anos, FA em varfarina 4mg. INR 9.5 colhido hoje em controlo de rotina. Sem hemorragia visível, sem cefaleia, sem alteração de consciência. Tomou ciprofloxacina há 4 dias por ITU. Tem 2 hematomas pequenos nos antebraços.`,

  // ── Alergológico ───────────────────────────────────────────────────────
  anaphylaxis: `Cria um caso de anafilaxia grave. Mulher 28 anos, sem antecedentes relevantes, no SU 15 minutos após toma de amoxicilina prescrita por infeção urinária (primeira toma na vida). Urticária generalizada, edema labial, estridor inspiratório audível à distância, dispneia. TA 78/40, FC 138, FR 30, SpO2 89% AA. Mantém-se consciente mas ansiosa.`,
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 6, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Decisão')

  const body = await req.json().catch(() => null)
  if (!body?.case_id) return NextResponse.json({ error: 'case_id obrigatório' }, { status: 400 })

  const caseDef = CASE_DEFINITIONS[body.case_id]
  if (!caseDef) return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `Crias casos clínicos dinâmicos para simulação de raciocínio médico em Portugal (PT-PT). Responde APENAS com JSON válido:
{
  "patient": {
    "name": "Nome português realista",
    "age": número,
    "sex": "M"|"F",
    "chief_complaint": "Queixa principal em 1-2 frases como o doente ou familiar diria",
    "background": "Antecedentes e história relevante — o que já se sabe",
    "current_meds": ["medicamento dose frequência"],
    "allergies": ["alergia ou 'NKDA'"],
    "vitals": [
      { "name": "TA", "value": "120/80", "unit": "mmHg", "status": "normal"|"abnormal"|"critical", "trend": "stable"|"up"|"down" }
    ],
    "labs": [
      { "name": "Hb", "value": "12.5", "unit": "g/dL", "status": "normal"|"abnormal"|"critical" }
    ],
    "narrative": "O que está a acontecer AGORA — o doente está à tua frente",
    "severity": "stable"|"worsening"|"critical",
    "time_elapsed": 0,
    "pending_results": ["resultado que está a aguardar"],
    "available_actions": [
      { "id": "id_unico", "label": "Descrição precisa da acção", "category": "exam"|"treatment"|"consult"|"monitor"|"discharge"|"free", "consequence_preview": null }
    ]
  }
}

REGRAS CRÍTICAS para available_actions (este é um simulador onde se aprende com o ERRO):
- Inclui 10-14 acções possíveis cobrindo todas as categorias clínicas
- DEVES incluir 1-3 acções claramente erradas / perigosas / contraindicadas — SEM as sinalizar como tal. O ponto é o utilizador escolher mal e ver a consequência (incluindo morte do doente quando aplicável):
    * fármacos com dose errada (ex: "Insulina 20U IV bólus")
    * fármacos contraindicados no contexto (ex: betabloqueante em choque cardiogénico; AAS em AVC sem TAC)
    * adiar uma intervenção crítica (ex: "Aguardar 30 minutos e reavaliar" num choque)
    * pedir um exame irrelevante e demorado em vez de tratar (ex: TAC abdómen num doente em PCR)
- As acções devem ser ESPECÍFICAS e clinicamente realistas (ex: "Furosemida 40mg IV bólus", não "dar diurético")
- Inclui sempre 1 acção de categoria "free" exatamente assim: { "id": "free_input", "label": "Outra acção (escrever)…", "category": "free" } — para o utilizador poder escrever qualquer intervenção em texto livre, mesmo as que tu não listaste. Não devem haver outras ações com categoria "free".
- category "exam" = pedir exames; "treatment" = terapêutica; "consult" = pedir opinião/especialidade; "monitor" = vigiar/reavaliar; "discharge" = decisão de destino (alta, internamento, UCI, transferir).
- NUNCA reveles qual é a correta no consequence_preview — deixa em null sempre.`,
      },
      { role: 'user', content: caseDef },
    ], { maxTokens: 2400, temperature: 0.3 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar caso' }, { status: 500 })
  }
}
