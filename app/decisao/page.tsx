'use client'

// app/decisao/page.tsx — Phlox Decisão
// Simulador de raciocínio clínico dinâmico.
// O caso evolui baseado nas tuas decisões. O doente melhora ou piora.
// Cada acção tem consequências fisiológicas simuladas.
// Exclusivo no mercado — zero concorrentes em PT ou internacionalmente neste formato.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { logStudy } from '@/lib/studyProgress'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'menu' | 'briefing' | 'active' | 'result'
type Severity = 'stable' | 'worsening' | 'critical' | 'improving' | 'resolved' | 'deceased'

interface Vital {
  name: string
  value: string
  unit: string
  status: 'normal' | 'abnormal' | 'critical'
  trend: 'stable' | 'up' | 'down'
}

interface PatientState {
  name: string
  age: number
  sex: 'M' | 'F'
  chief_complaint: string
  background: string
  current_meds: string[]
  allergies: string[]
  vitals: Vital[]
  labs: { name: string; value: string; unit: string; status: 'normal' | 'abnormal' | 'critical' }[]
  narrative: string        // o que está a acontecer agora
  severity: Severity
  time_elapsed: number     // minutos desde início
  pending_results: string[] // resultados a aguardar
  available_actions: Action[]
}

interface Action {
  id: string
  label: string
  category: 'exam' | 'treatment' | 'consult' | 'monitor' | 'discharge' | 'free'
  consequence_preview?: string  // dica opcional
}

interface CaseEvent {
  time: number
  type: 'action' | 'update' | 'result' | 'alert' | 'system'
  content: string
  severity?: 'info' | 'warning' | 'critical' | 'success'
}

interface CaseConfig {
  id: string
  title: string
  specialty: string
  difficulty: 'intern' | 'resident' | 'specialist'
  difficultyLabel: string
  description: string
  /* Não há `color` aqui de propósito. Havia — uma cor por caso, escolhida à
     mão, que devia significar a especialidade. Vinte especialidades para
     sete cores, com três delas a partilhar o mesmo roxo: a cor nunca disse
     qual era a especialidade, e três das sete eram vermelho e laranja, que
     em todo o resto desta aplicação querem dizer «atenção».
     A cor passa a sair da `difficulty`, que é ordenada e é por ela que
     alguém escolhe um caso. Ver a função `cor` mais abaixo. */
  estimated_minutes: number
}

// ─── Case configs ─────────────────────────────────────────────────────────────

const CASE_CONFIGS: CaseConfig[] = [
  // ── Cardiologia ───────────────────────────────────────────────────────
  { id: 'chf_decompensation', title: 'Dispneia aguda no idoso', specialty: 'Cardiologia', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Homem 72 anos, FA, dispneia progressiva, ortopneia, edemas. SpO2 88%. Diuresar? IECA? Ventilação?', estimated_minutes: 15 },
  { id: 'stemi_anterior', title: 'STEMI anterior extenso', specialty: 'Cardiologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Homem 58 anos, dor torácica há 90 min, supra-ST V2-V6, troponina 1850. Hemodinâmica a 35 min — fibrinólise ou aguarda?', estimated_minutes: 18 },
  { id: 'nstemi', title: 'NSTEMI no idoso diabético', specialty: 'Cardiologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Mulher 67 anos, DM2, dor torácica intermitente, subdesnível ST, troponina sobe. GRACE 142. Quão urgente é o cateterismo?', estimated_minutes: 18 },
  { id: 'aortic_dissection', title: 'Dor torácica "rasgada" com hipertensão', specialty: 'Cardiologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Homem 56 anos, dor súbita irradiando dorso, diferencial TA 50 mmHg entre braços, sopro diastólico novo. Beta-bloquear ou alfa?', estimated_minutes: 20 },
  { id: 'pericarditis_tamponade', title: 'Pericardite com tamponamento iminente', specialty: 'Cardiologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Mulher 32 anos, dor pleurítica, atrito, pulso paradoxal 18, colapso AD na eco. Pericardiocentese ou aguardar?', estimated_minutes: 18 },
  { id: 'bradyarrhythmia_block', title: 'BAV completo com síncope', specialty: 'Cardiologia', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Mulher 78 anos em betabloqueante + digoxina, síncope, FC 32, dissociação AV. Atropina? Pacing? Suspender fármacos?', estimated_minutes: 15 },
  // ── Pulmonar ─────────────────────────────────────────────────────────
  { id: 'copd_exacerbation', title: 'Exacerbação grave de DPOC', specialty: 'Pneumologia', difficulty: 'intern', difficultyLabel: 'Interno', description: 'GOLD 3, esputo purulento, SpO2 84%, pH 7.30 com pCO2 65. Quanto O2? VNI? Antibiótico empírico?', estimated_minutes: 18 },
  { id: 'asthma_severe', title: 'Crise asmática quase fatal', specialty: 'Pneumologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Jovem 24 anos, frases incompletas, peito silencioso, PEF 25%. Beta-2 contínuo? Magnésio? Quando intubar?', estimated_minutes: 16 },
  { id: 'pulmonary_embolism', title: 'TEP submaciço pós-cirurgia', specialty: 'Pneumologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Mulher 52 anos, pós-op, dispneia súbita, troponina+. AngioTAC positiva. Anticoagular? Trombolisar?', estimated_minutes: 18 },
  { id: 'pneumothorax_tension', title: 'Pneumotórax hipertensivo', specialty: 'Pneumologia', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Magro 28 anos, dor torácica súbita, desvio traqueal, hipotenso. Drenar primeiro, imagem depois.', estimated_minutes: 10 },
  { id: 'pneumonia_abx', title: 'Pneumonia sem resposta ao antibiótico', specialty: 'Infecciologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Mulher 55 anos, D3 amoxicilina sem melhoria. PCR sobe. Escalar para piperacilina-tazobactam? Atípicos?', estimated_minutes: 25 },
  // ── Sépsis / Infeções ───────────────────────────────────────────────
  { id: 'sepsis_antibiotics', title: 'Sépsis nosocomial — hora dourada', specialty: 'Medicina Interna', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Doente internada com novo pico febril, hipotensão, leucocitose. Antibiótico em <1h. Largo espectro empírico ou dirigido?', estimated_minutes: 20 },
  { id: 'meningitis_bacterial', title: 'Meningite com púrpura', specialty: 'Neurologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Universitário 22 anos, febre, rigidez, petéquias, GCS 13. Antibiótico antes ou depois da PL? Corticoides?', estimated_minutes: 18 },
  { id: 'neutropenic_fever', title: 'Neutropenia febril no oncológico', specialty: 'Infecciologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'LMA D+8, febre 38.7°C, neutrófilos 280. Antibiótico empírico imediato — qual? Mocs do cateter?', estimated_minutes: 18 },
  { id: 'tropical_malaria', title: 'Febre tropical importada', specialty: 'Infecciologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Regressou de África há 5 dias sem profilaxia. Falciparum 4%. Hipoglicémia. Artesunato IV ou oral?', estimated_minutes: 20 },
  { id: 'urinary_pyelonephritis', title: 'Pielonefrite aguda complicada', specialty: 'Urologia', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Diabética 68 anos, dor lombar, febre, hipotensão, dilatação pielocalicial. Antibiótico + drenagem?', estimated_minutes: 18 },
  // ── Endócrino / Metabólico ──────────────────────────────────────────
  { id: 'dm_ketoacidosis', title: 'Cetoacidose diabética grave', specialty: 'Endocrinologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'DM1, vómitos, glicémia 450, pH 7.21, K+ 3.2. Repor volume? Insulina? Quando começar K+?', estimated_minutes: 20 },
  { id: 'hyperosmolar_state', title: 'Estado hiperosmolar', specialty: 'Endocrinologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'DM2 78 anos, glicémia 920, Na 158, osm 360, confuso. Soros, ritmo de descida, insulina.', estimated_minutes: 22 },
  { id: 'thyroid_storm', title: 'Tempestade tiroideia', specialty: 'Endocrinologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Graves descompensada, febre 39.7°C, FA 158, ICC. Antitiroideu, betabloqueante, iodo — qual ordem?', estimated_minutes: 22 },
  { id: 'adrenal_crisis', title: 'Crise addisoniana', specialty: 'Endocrinologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'DAI sem cortisol há 4 dias, hipotensão refratária, hipoNa, hipoglicémia. Hidrocortisona já — sim, mas como?', estimated_minutes: 18 },
  { id: 'hyperkalemia', title: 'Hipercaliémia com alterações ECG', specialty: 'Nefrologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'DRC4, K+ 7.2, T apiculadas, QRS largo. Estabilizar membrana? Translocar? Remover? Ordem.', estimated_minutes: 18 },
  { id: 'hyponatremia_severe', title: 'Hiponatremia com convulsão', specialty: 'Nefrologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Idosa em tiazida + ISRS, Na 112, convulsão. Sódio hipertónico — quanto? Risco de mielinólise.', estimated_minutes: 18 },
  // ── Neurologia ───────────────────────────────────────────────────────
  { id: 'ischemic_stroke', title: 'AVC isquémico em janela', specialty: 'Neurologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'NIHSS 14, ASPECTS 9, TA 198/108. Trombólise? Trombectomia? Controlo de TA antes ou depois?', estimated_minutes: 20 },
  { id: 'hemorrhagic_stroke', title: 'AVC hemorrágico extenso', specialty: 'Neurologia', difficulty: 'resident', difficultyLabel: 'Residente', description: '28 mL putaminal, GCS 11, TA 215/120. Quanto baixar a TA? Indicação cirúrgica?', estimated_minutes: 18 },
  { id: 'status_epilepticus', title: 'Status epilépticus', specialty: 'Neurologia', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Crises consecutivas há 8 min. Benzodiazepina dose certa? E se falha? Quando intubar?', estimated_minutes: 16 },
  { id: 'guillain_barre', title: 'Tetraparesia ascendente', specialty: 'Neurologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Pós-GE, fraqueza ascendente, capacidade vital 1.2L. IVIG ou plasmaferese? Quando intubar?', estimated_minutes: 18 },
  { id: 'meningitis_viral', title: 'Meningoencefalite herpética', specialty: 'Neurologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Alteração comportamento, crise focal, hiperintensidade temporal. Aciclovir empírico já?', estimated_minutes: 18 },
  // ── GI / Hepato ──────────────────────────────────────────────────────
  { id: 'anticoag_bleeding', title: 'Hemorragia digestiva sob varfarina', specialty: 'Gastroenterologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Hematemese, INR 8.2, Hb 8.2. Reverter como? CCP ou plasma? Endoscopia urgente?', estimated_minutes: 15 },
  { id: 'acute_pancreatitis', title: 'Pancreatite aguda grave', specialty: 'Gastroenterologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Litíase, dor 18h, lipase 1850, BISAP 4. Reposição volémica agressiva? Antibiótico profilático ou não?', estimated_minutes: 22 },
  { id: 'perforated_ulcer', title: 'Úlcera perfurada com peritonite', specialty: 'Cirurgia Geral', difficulty: 'resident', difficultyLabel: 'Residente', description: 'AINEs, abdómen em tábua, pneumoperitoneu. Cirurgia já — quando o doente está suficientemente estável?', estimated_minutes: 18 },
  { id: 'hepatic_encephalopathy', title: 'Encefalopatia hepática grau III', specialty: 'Gastroenterologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Cirrose, asterixis, sonolento, obstipação. Lactulose, rifaximina, identificar o precipitante.', estimated_minutes: 18 },
  { id: 'cholangitis', title: 'Colangite com choque', specialty: 'Gastroenterologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Charcot + Reynolds, bilirrubina 8.2, cálculo coledociano. CPRE quando? Antibiótico antes.', estimated_minutes: 20 },
  // ── Toxicologia ──────────────────────────────────────────────────────
  { id: 'opioid_overdose', title: 'Depressão respiratória por opioides', specialty: 'Toxicologia', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Oncológico em morfina LP, FR 6, miose. Naloxona — dose, via, repetir? Cuidado com a tempestade adrenérgica.', estimated_minutes: 14 },
  { id: 'paracetamol_overdose', title: 'Intoxicação por paracetamol', specialty: 'Toxicologia', difficulty: 'resident', difficultyLabel: 'Residente', description: '30 cp há 10h, nomograma na linha. N-acetilcisteína IV — quando começa, dose total. Lista de transplante?', estimated_minutes: 18 },
  { id: 'tca_overdose', title: 'Overdose de tricíclicos com QRS largo', specialty: 'Toxicologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Amitriptilina, QRS 0.14s, R em aVR. Bicarbonato — quando, quanto? Antiarrítmico?', estimated_minutes: 18 },
  { id: 'bb_overdose', title: 'Intoxicação por betabloqueante', specialty: 'Toxicologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Propranolol 40x40cp, FC 35, TA 75/40, hipoglicémia. Glucagon? Insulina-glicose? Lípidos?', estimated_minutes: 18 },
  { id: 'organophosphate', title: 'Intoxicação por organofosforados', specialty: 'Toxicologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Agricultor com SLUDGE-Killer Bs. Atropina em titulação — alvo. Pralidoxima? Descontaminação primeiro?', estimated_minutes: 18 },
  // ── Hematologia / Oncologia ────────────────────────────────────────
  { id: 'tumor_lysis', title: 'Síndrome de lise tumoral', specialty: 'Hematologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'LBA pós-quimio, K 6.4, P 9.8, Ca 7.2. Hidratação, rasburicase ou alopurinol? Hemodiálise?', estimated_minutes: 18 },
  { id: 'ttp_microangiopathy', title: 'PTT com esquizócitos', specialty: 'Hematologia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Trombocitopenia, anemia hemolítica, neuro, febre, renal. Plasmaferese urgente — começar antes do ADAMTS13?', estimated_minutes: 20 },
  // ── Trauma ────────────────────────────────────────────────────────────
  { id: 'head_trauma_severe', title: 'TCE grave com sinais de herniação', specialty: 'Neurocirurgia', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'GCS 7, pupila anisocórica, hematoma subdural 14mm, desvio 8mm. Manitol/salino hipertónico? Neurocirurgia urgente.', estimated_minutes: 18 },
  { id: 'trauma_polytrauma', title: 'Politraumatismo grave', specialty: 'Cirurgia Geral', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Atropelamento, FAST positivo, fractura aberta. Damage control? Ácido tranexâmico? Bloco já?', estimated_minutes: 20 },
  // ── Obstetrícia ───────────────────────────────────────────────────────
  { id: 'eclampsia', title: 'Eclâmpsia às 34 semanas', specialty: 'Obstetrícia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Convulsão na pré-eclâmptica. Sulfato de magnésio — dose, monitorização. Terminar a gravidez?', estimated_minutes: 18 },
  { id: 'pph_postpartum', title: 'Hemorragia pós-parto atónica', specialty: 'Obstetrícia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Útero atónico, 1500 mL perdidos. Massagem, oxitocina, ergot, prostaglandinas, balão — escada.', estimated_minutes: 16 },
  // ── Pediatria ─────────────────────────────────────────────────────────
  { id: 'pediatric_bronchiolitis', title: 'Bronquiolite grave em lactente', specialty: 'Pediatria', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Lactente 4m, ex-prematuro, FR 72, SpO2 88%, apneias. CNAF? VNI? Quando intubar?', estimated_minutes: 16 },
  { id: 'pediatric_febrile_seizure', title: 'Convulsão febril complicada', specialty: 'Pediatria', difficulty: 'intern', difficultyLabel: 'Interno', description: '18 meses, crise prolongada com otite. Antibiótico? PL? EEG?', estimated_minutes: 14 },
  { id: 'pediatric_intussusception', title: 'Invaginação intestinal', specialty: 'Pediatria', difficulty: 'resident', difficultyLabel: 'Residente', description: 'Lactente 9m com cólica e "geleia de morango". Redução hidrostática? Cirurgia se falha.', estimated_minutes: 16 },
  // ── Comportamental / Iatrogenia ────────────────────────────────────
  { id: 'serotonin_syndrome', title: 'Síndrome serotoninérgica', specialty: 'Toxicologia', difficulty: 'resident', difficultyLabel: 'Residente', description: 'ISRS + tramadol, hiperreflexia, clónus, febre 39.4. Suspender tudo, ciproheptadina, refrigerar.', estimated_minutes: 16 },
  { id: 'nms', title: 'Síndrome neuroléptico maligno', specialty: 'Psiquiatria', difficulty: 'specialist', difficultyLabel: 'Especialista', description: 'Haloperidol depot, rigidez tubo de chumbo, T 40.1, CK 18500. Bromocriptina? Dantroleno? Rabdomiolise.', estimated_minutes: 18 },
  // ── Geriatria / Polimedicação ──────────────────────────────────────
  { id: 'polypharmacy_elderly', title: 'Queda no doente polimedicado', specialty: 'Farmácia Clínica', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Homem 84 anos, 11 medicamentos, hipotensão ortostática. Que medicamentos desprescrever? STOPP/START.', estimated_minutes: 20 },
  { id: 'delirium_hyperactive', title: 'Delirium hiperactivo no idoso', specialty: 'Geriatria', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Pós-pneumonia, agitação, alucinações, globo vesical. Identificar precipitantes, não-farmacológico primeiro.', estimated_minutes: 16 },
  { id: 'warfarin_inr_elevation', title: 'INR 9.5 sem hemorragia', specialty: 'Farmácia Clínica', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Pós ciprofloxacina. Suspender, vit K oral baixa-dose? Internar?', estimated_minutes: 12 },
  // ── Alergia ──────────────────────────────────────────────────────────
  { id: 'anaphylaxis', title: 'Anafilaxia pós-antibiótico', specialty: 'Urgência', difficulty: 'intern', difficultyLabel: 'Interno', description: 'Mulher 28 anos, edema labial e estridor após amoxicilina. TA 78/40. Adrenalina IM já — depois.', estimated_minutes: 12 },
]

// ─── Vital badge component ────────────────────────────────────────────────────
function VitalBadge({ vital }: { vital: Vital }) {
  const colors = { normal: 'var(--green)', abnormal: 'var(--amber)', critical: 'var(--red)' }
  const bgs = { normal: 'var(--green-light)', abnormal: 'var(--badge-amber-bg)', critical: 'var(--badge-red-bg)' }
  const borders = { normal: 'var(--green-mid)', abnormal: 'var(--badge-amber-border)', critical: 'var(--badge-red-border)' }
  const trendIcon = vital.trend === 'up' ? '↑' : vital.trend === 'down' ? '↓' : '→'

  return (
    <div style={{ padding: '8px 12px', background: bgs[vital.status], border: `1px solid ${borders[vital.status]}`, borderRadius: 'var(--r-md)', minWidth: 90 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: colors[vital.status], fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{vital.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: colors[vital.status], lineHeight: 1 }}>{vital.value}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: colors[vital.status], opacity: 0.7 }}>{vital.unit}</span>
        <span style={{ fontSize: 'var(--t-meta)', color: colors[vital.status], marginLeft: 2 }}>{trendIcon}</span>
      </div>
    </div>
  )
}

// ─── Timeline event ───────────────────────────────────────────────────────────
function EventEntry({ event }: { event: CaseEvent }) {
  const styles = {
    info:     { color: 'var(--ink-2)', bg: 'var(--bg-2)',  border: 'var(--border)', dot: 'var(--ink-3)' },
    warning:  { color: 'var(--amber)', bg: 'var(--badge-amber-bg)',  border: 'var(--badge-amber-border)', dot: 'var(--amber)' },
    critical: { color: 'var(--red)', bg: 'var(--badge-red-bg)',  border: 'var(--badge-red-border)', dot: 'var(--red)' },
    success:  { color: 'var(--green-3)', bg: 'var(--green-light)',  border: 'var(--green-mid)', dot: 'var(--green)' },
  }
  const s = styles[event.severity || 'info']

  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--bg-3)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginBottom: 4 }}>{event.time}m</div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ padding: '8px 12px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--r-md)' }}>
          <p style={{ fontSize: 'var(--t-dado)', color: s.color, lineHeight: 1.6, margin: 0 }}>{event.content}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Free-text action input ───────────────────────────────────────────────────
// Permite ao utilizador escrever qualquer ação clínica que queira tentar,
// mesmo as que o motor não listou (incluindo absurdas — o doente reage como
// um doente real reagiria, é assim que se aprende em segurança).
function FreeActionInput({ onSubmit, disabled }: { onSubmit: (txt: string) => void; disabled: boolean }) {
  const [val, setVal] = useState('')
  const submit = () => {
    const t = val.trim()
    if (!t || disabled) return
    onSubmit(t)
    setVal('')
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="Ex: Adrenalina 0.5 mg IM lateral coxa; ou pedir TAC-CE; ou chamar anestesia…"
        disabled={disabled}
        style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--ink-3)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}
      />
      <button onClick={submit} disabled={!val.trim() || disabled}
        style={{ padding: '8px 14px', background: val.trim() && !disabled ? 'var(--ink-3)' : 'var(--bg-3)', color: val.trim() && !disabled ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 'var(--r-md)', cursor: val.trim() && !disabled ? 'pointer' : 'not-allowed', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'var(--font-sans)' }}>
        Fazer →
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DecisaoPage() {
  const { user, supabase } = useAuth()
  const [phase, setPhase] = useState<Phase>('menu')
  const [selectedCase, setSelectedCase] = useState<CaseConfig | null>(null)
  const [patient, setPatient] = useState<PatientState | null>(null)
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [finalScore, setFinalScore] = useState<any>(null)
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [customTopic, setCustomTopic] = useState('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const plan = (user as any)?.plan || 'free'
  const canPlay = plan !== 'free'

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  // Timer
  useEffect(() => {
    if (phase !== 'active') return
    timerRef.current = setInterval(() => setTimeElapsed(t => t + 1), 60000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  const addEvent = useCallback((event: CaseEvent) => {
    setEvents(prev => [...prev, event])
  }, [])

  const startCase = async (caseConfig: CaseConfig, customTopicText?: string) => {
    setSelectedCase(caseConfig)
    setLoading(true)
    setError('')
    setEvents([])
    setTimeElapsed(0)

    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      const res = await fetch('/api/decisao/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(customTopicText ? { custom_topic: customTopicText } : { case_id: caseConfig.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()

      setPatient(data.patient)
      addEvent({ time: 0, type: 'system', content: `Caso iniciado: ${caseConfig.title}. O doente está à tua frente.`, severity: 'info' })
      setPhase('briefing')
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar caso.')
    } finally {
      setLoading(false)
    }
  }

  const takeAction = async (action: Action, freeText?: string) => {
    if (!patient || !selectedCase) return
    setActionLoading(true)

    const isFree = action.category === 'free'
    const labelShown = isFree ? (freeText || '').trim() : action.label

    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      addEvent({
        time: timeElapsed,
        type: 'action',
        content: `Decisão: ${labelShown}${isFree ? '  (texto livre)' : ''}`,
        severity: 'info',
      })

      const res = await fetch('/api/decisao/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          case_id: selectedCase.id,
          action_label: isFree ? freeText : action.label,
          free_text: isFree ? freeText : undefined,
          current_patient: patient,
          time_elapsed: timeElapsed,
          previous_events: events.slice(-8).map(e => e.content),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()

      // Update patient state
      setPatient(data.updated_patient)

      // Tempo do estado atualizado vem da AI (acrescenta minutos realistas)
      if (typeof data.updated_patient?.time_elapsed === 'number' && data.updated_patient.time_elapsed > timeElapsed) {
        setTimeElapsed(data.updated_patient.time_elapsed)
      }

      // Consequência imediata + mecanismo fisiopatológico
      if (data.immediate_consequence) {
        const sev: CaseEvent['severity'] = data.severity === 'death' ? 'critical' : data.severity || 'info'
        const txt = data.mechanism
          ? `${data.immediate_consequence}\n\n→ Porquê: ${data.mechanism}${data.evidence_note ? `\n→ Referência: ${data.evidence_note}` : ''}`
          : data.immediate_consequence
        addEvent({ time: timeElapsed, type: 'update', content: txt, severity: sev })
      }

      if (data.lab_results) {
        addEvent({ time: timeElapsed + 1, type: 'result', content: `Resultados: ${data.lab_results}`, severity: 'info' })
      }

      if (data.alert) {
        addEvent({ time: timeElapsed + 2, type: 'alert', content: data.alert, severity: 'critical' })
      }

      // Quando o caso acaba, chama o /end para ter debriefing completo.
      // Cobre estabilizado, óbito, alta — qualquer terminação.
      if (data.case_ended) {
        if (timerRef.current) clearInterval(timerRef.current)
        // Mostra evento de fim no log
        if (data.end_reason) {
          addEvent({ time: timeElapsed, type: 'system', content: `Fim do caso: ${data.end_reason}`, severity: data.severity === 'death' ? 'critical' : 'info' })
        }
        // Trigger debriefing
        try {
          const { data: sd2 } = await supabase.auth.getSession()
          const token2 = sd2?.session?.access_token
          const r2 = await fetch('/api/decisao/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
            body: JSON.stringify({
              case_id: selectedCase.id,
              patient_final: data.updated_patient,
              events: [...events.map(e => e.content), `Acção final: ${labelShown}`, data.immediate_consequence || ''].filter(Boolean),
              time_elapsed: timeElapsed,
              end_reason: data.end_reason,
            }),
          })
          if (r2.ok) {
            const d2 = await r2.json()
            setFinalScore(d2.final_score)
            logStudy({ kind: 'case', area: selectedCase.specialty, correct: (d2.final_score?.score ?? 0) >= 60, xp: Math.max(15, Math.round((d2.final_score?.score ?? 0) / 3)) })
          }
        } catch { /* fallback: deixa null, página de resultado lida com isso */ }
        setPhase('result')
      }

    } catch (e: any) {
      addEvent({ time: timeElapsed, type: 'system', content: `Erro: ${e.message}`, severity: 'warning' })
    } finally {
      setActionLoading(false)
    }
  }

  const endCase = async () => {
    if (!patient || !selectedCase) return
    setActionLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch('/api/decisao/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          case_id: selectedCase.id,
          patient_final: patient,
          events: events.map(e => e.content),
          time_elapsed: timeElapsed,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      if (timerRef.current) clearInterval(timerRef.current)
      setFinalScore(data.final_score)
      logStudy({ kind: 'case', area: selectedCase.specialty, correct: (data.final_score?.score ?? 0) >= 60, xp: Math.max(15, Math.round((data.final_score?.score ?? 0) / 3)) })
      setPhase('result')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const reset = () => {
    setPhase('menu')
    setSelectedCase(null)
    setPatient(null)
    setEvents([])
    setTimeElapsed(0)
    setFinalScore(null)
    setError('')
  }

  const severityMeta: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
    stable: { label: 'Estável', color: 'var(--green)', bg: 'var(--green-light)', border: 'var(--green-mid)' },
    improving: { label: 'A melhorar', color: 'var(--green)', bg: 'var(--green-light)', border: 'var(--green-mid)' },
    worsening: { label: 'A piorar', color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)' },
    critical: { label: 'Crítico', color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)' },
    resolved: { label: 'Resolvido', color: 'var(--green)', bg: 'var(--green-light)', border: 'var(--green-mid)' },
    deceased: { label: 'Óbito', color: 'var(--ink)', bg: 'var(--ink-2)', border: 'var(--ink)' },
  }

  /* Três graus, três cores — e são as do sistema. */
  const cor = (d: string) => d === 'specialist' ? 'var(--red)' : d === 'resident' ? 'var(--amber)' : 'var(--green)'

  // ── MENU ────────────────────────────────────────────────────────────────────
  if (phase === 'menu') return (
    <Mesa
      altura="documento"
      barra={
        /* Eram 190px antes do primeiro caso: migalha, «Phlox Decisão» em
           serifa de 42px, um parágrafo de três linhas e três marcas com
           bolinha. Numa página que é um catálogo de casos, o que interessa
           é o catálogo. O que o produto é diz-se uma vez, na barra de
           estado, por baixo. */
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--roxo)', fontWeight: 'var(--peso-forte)' as any,
          }}>Decisão</span>

          <Seletor
            opcoes={[
              { id: 'all', rotulo: `Todos ${CASE_CONFIGS.length}` },
              { id: 'intern', rotulo: 'Interno' },
              { id: 'resident', rotulo: 'Residente' },
              { id: 'specialist', rotulo: 'Especialista' },
            ]}
            ativa={difficultyFilter} aoMudar={setDifficultyFilter} />

          <span style={{ ...MONO, color: 'var(--ink-4)' }}>
            {CASE_CONFIGS.filter(c => difficultyFilter === 'all' || c.difficulty === difficultyFilter).length} CASOS
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--green)' }}>Interno</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>Residente</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>Especialista</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            O doente evolui conforme decide — cada ação tem consequências simuladas
          </span>
        </BarraDeEstado>
      }
    >
      <div>

        {/* O MEU TEMA — escreve qualquer matéria e gera um caso evolutivo sobre ela */}
        {canPlay && (
          <div style={{ background: 'white', border: '1.5px solid var(--roxo-borda)', borderRadius: 'var(--r-xl)', padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>Treinar um tema à tua escolha</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customTopic.trim()) startCase({ id: 'custom', title: customTopic.trim(), specialty: 'Tema livre', description: customTopic.trim(), difficulty: 'resident', difficultyLabel: 'Personalizado', estimated_minutes: 10 } as any, customTopic.trim()) }}
                placeholder="Ex: choque séptico, cetoacidose diabética, hipertensão na grávida…"
                style={{ flex: '1 1 300px', border: '1.5px solid var(--roxo-borda)', borderRadius: 'var(--r-lg)', padding: '11px 14px', fontSize: 'var(--t-corpo)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />
              <button onClick={() => customTopic.trim() && startCase({ id: 'custom', title: customTopic.trim(), specialty: 'Tema livre', description: customTopic.trim(), difficulty: 'resident', difficultyLabel: 'Personalizado', estimated_minutes: 10 } as any, customTopic.trim())}
                disabled={!customTopic.trim() || loading}
                style={{ padding: '11px 20px', background: customTopic.trim() ? 'var(--roxo)' : 'var(--bg-3)', color: customTopic.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: customTopic.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
                {loading ? 'A gerar…' : 'Começar →'}
              </button>
            </div>
          </div>
        )}

        {/* O filtro de dificuldade subiu para a barra. */}

        {/* Cases grid */}
        {error && <div style={{ background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 16, fontSize: 'var(--t-dado)', color: 'var(--red)' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,268px),1fr))', gap: 7 }}>
          {CASE_CONFIGS.filter(c => difficultyFilter === 'all' || c.difficulty === difficultyFilter).map(c => (
            /* A COR PASSA A SER A DIFICULDADE.
               Era a da especialidade — e não dizia nada: vinte especialidades
               para sete cores, com a Endocrinologia, a Gastroenterologia e a
               Psiquiatria no mesmo roxo. Quem procurasse a especialidade pela
               cor acertava por acaso. A dificuldade, essa, é ordenada, e é
               por ela que alguém escolhe um caso. */
            <div key={c.id} style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${cor(c.difficulty)}`, borderRadius: 'var(--r-sm)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '11px 13px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ ...ROTULO, color: 'var(--ink-3)' }}>{c.specialty}</span>
                  <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', flexShrink: 0 }}>~{c.estimated_minutes} MIN</span>
                </div>
                <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 5 }}>{c.title}</div>
                <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.5, margin: '0 0 9px' }}>{c.description}</p>
                <Codigo texto={c.difficultyLabel.toUpperCase()} cor={cor(c.difficulty)} />
              </div>
              <div style={{ padding: '8px 13px', borderTop: '1px solid var(--border)' }}>
                <Botao feitio={canPlay ? 'principal' : 'calmo'} disabled={!canPlay}
                  esperando={loading && selectedCase?.id === c.id}
                  onClick={() => canPlay ? startCase(c) : undefined}>
                  {canPlay ? 'INICIAR' : 'REQUER PLUS'}
                </Botao>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Mesa>
  )

  // ── BRIEFING ────────────────────────────────────────────────────────────────
  if (phase === 'briefing' && patient && selectedCase) return (
    /* Era um ecrã escuro. Ver a nota na /emergency-doses: fundo preto com
       um acento, sem razão escrita em lado nenhum, no meio de sessenta
       páginas claras. Se a razão existir, faz-se um modo escuro para tudo. */
    <div style={{ minHeight: '100vh', background: 'var(--chao)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container" style={{ paddingTop: 40, paddingBottom: 40, maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Phlox Decisão · {selectedCase.specialty}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-numero)', color: 'var(--ink)', fontWeight: 'var(--peso-normal)' as any, letterSpacing: '-0.02em', marginBottom: 4 }}>{selectedCase.title}</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>Lê o briefing. Quando estiveres pronto, inicia o caso.</div>
        </div>

        {/* Patient card */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink-3)', flexShrink: 0 }}>{patient.name.charAt(0)}</div>
            <div>
              <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{patient.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{patient.age} anos · {patient.sex === 'M' ? 'Masculino' : 'Feminino'}</div>
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Queixa principal</div>
            <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)', lineHeight: 1.6, marginBottom: 16 }}>{patient.chief_complaint}</p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Antecedentes relevantes</div>
            <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)', lineHeight: 1.7, marginBottom: 16 }}>{patient.background}</p>
            {patient.current_meds.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Medicação habitual</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                  {patient.current_meds.map(m => <span key={m} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', background: 'var(--ink-3)', padding: '3px 10px', borderRadius: 'var(--r)' }}>{m}</span>)}
                </div>
              </>
            )}
            {patient.allergies.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Alergias</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {patient.allergies.map(a => <span key={a} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--badge-red-border)', background: 'var(--badge-red-fg)', padding: '3px 10px', borderRadius: 'var(--r)' }}>{a}</span>)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Initial vitals */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Sinais vitais de entrada</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {patient.vitals.map(v => <VitalBadge key={v.name} vital={v} />)}
          </div>
        </div>

        <button onClick={() => setPhase('active')}
          style={{ width: '100%', padding: '15px', background: cor(selectedCase.difficulty), color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' }}>
          Entrar no caso →
        </button>
      </div>
    </div>
  )

  // ── ACTIVE CASE ─────────────────────────────────────────────────────────────
  if (phase === 'active' && patient && selectedCase) {
    const sm = severityMeta[patient.severity]
    const actionCategories: Record<string, Action[]> = {}
    patient.available_actions.forEach(a => {
      if (!actionCategories[a.category]) actionCategories[a.category] = []
      actionCategories[a.category].push(a)
    })

    const catLabels: Record<string, string> = {
      exam: 'Pedir Exames',
      treatment: 'Tratar',
      consult: 'Consultar',
      monitor: 'Monitorizar',
      discharge: 'Destino',
      free: 'Outra acção (livre)',
    }
    const catColors: Record<string, string> = {
      exam: 'var(--ink-2)', treatment: 'var(--green)', consult: 'var(--roxo)',
      monitor: 'var(--amber)', discharge: 'var(--ink)', free: 'var(--ink-3)',
    }

    return (
      <div style={{ minHeight: '100vh', background: 'var(--chao)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>


        {/* Case header */}
        <div style={{ background: 'var(--ink)', padding: '12px 0', borderBottom: '1px solid var(--ink-2)', flexShrink: 0 }}>
          <div className="page-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Phlox Decisão · Em curso</div>
                <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginTop: 2 }}>{patient.name} · {patient.age}a</div>
              </div>
              {/* Severity */}
              <div style={{ padding: '5px 14px', background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: 'var(--r-xl)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: sm.color, animation: patient.severity === 'critical' ? 'pulse-dot 1s infinite' : 'none' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: sm.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{sm.label}</span>
              </div>
              {/* Timer */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
                {timeElapsed < 60 ? `${timeElapsed} min` : `${Math.floor(timeElapsed / 60)}h${timeElapsed % 60 > 0 ? ` ${timeElapsed % 60}m` : ''}`}
              </div>
              <button onClick={endCase} disabled={actionLoading}
                style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--ink-3)', borderRadius: 'var(--r)', color: 'var(--ink-4)', fontSize: 'var(--t-meta)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 'var(--peso-corpo)' as any }}>
                Terminar caso
              </button>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', flex: 1, overflow: 'hidden', height: 'calc(100vh - 120px)' }} className="ward-grid">

          {/* Left: Patient state */}
          <div style={{ background: 'white', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '16px' }}>
            {/* Vitals */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Sinais vitais</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {patient.vitals.map(v => <VitalBadge key={v.name} vital={v} />)}
              </div>
            </div>

            {/* Labs */}
            {patient.labs.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Resultados analíticos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {patient.labs.map(lab => {
                    const lc = lab.status === 'critical' ? 'var(--red)' : lab.status === 'abnormal' ? 'var(--amber)' : 'var(--green)'
                    return (
                      <div key={lab.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: lab.status !== 'normal' ? `${lc}08` : 'var(--bg-2)', borderRadius: 'var(--r)', border: `1px solid ${lab.status !== 'normal' ? `${lc}30` : 'var(--border)'}` }}>
                        <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{lab.name}</span>
                        <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: lc, fontFamily: 'var(--font-mono)' }}>{lab.value} {lab.unit}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pending */}
            {patient.pending_results.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>A aguardar</div>
                {patient.pending_results.map(r => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', animation: 'pulse-dot 1.5s infinite', flexShrink: 0 }} />
                    {r}
                  </div>
                ))}
              </div>
            )}

            {/* Current narrative */}
            <div style={{ padding: '12px', background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: 'var(--r-md)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: sm.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Estado actual</div>
              <p style={{ fontSize: 'var(--t-dado)', color: sm.color, lineHeight: 1.6, margin: 0 }}>{patient.narrative}</p>
            </div>
          </div>

          {/* Right: Events + Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-2)' }}>
            {/* Events timeline */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {events.map((e, i) => <EventEntry key={i} event={e} />)}
              <div ref={eventsEndRef} />
            </div>

            {/* Actions */}
            <div style={{ borderTop: '2px solid var(--border)', padding: '12px 16px', background: 'white', flexShrink: 0 }}>
              {actionLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', justifyContent: 'center' }}>
                  <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>O caso está a evoluir...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(actionCategories).map(([cat, actions]) => {
                    const c = catColors[cat] || 'var(--ink-3)'
                    return (
                      <div key={cat}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{catLabels[cat] || cat}</div>
                        {cat === 'free' ? (
                          <FreeActionInput onSubmit={(txt) => takeAction(actions[0], txt)} disabled={actionLoading} />
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {actions.map(action => (
                              <button key={action.id} onClick={() => takeAction(action)}
                                style={{ padding: '7px 14px', background: 'white', border: `1.5px solid ${c}`, borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: c, fontFamily: 'var(--font-sans)', transition: 'all 0.1s', position: 'relative' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.08)' }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                                title={action.consequence_preview}>
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.4}} @media(max-width:768px){.ward-grid{grid-template-columns:minmax(0,1fr)!important;height:auto!important}}`}</style>
      </div>
    )
  }

  // ── RESULT ──────────────────────────────────────────────────────────────────
  if (phase === 'result' && selectedCase) {
    const fs = finalScore || { score: 0, grade: 'Sem avaliação', overall_feedback: 'O motor de avaliação não respondeu. Os eventos do caso estão acima.', outcome: 'desconhecido' }
    const died = fs.outcome === 'óbito' || patient?.severity === 'deceased'
    return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        {/* Score */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-2)', padding: '28px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: died ? 'var(--red)' : 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>
              {died ? 'DOENTE FALECEU' : 'CASO CONCLUÍDO'}
            </div>
            {/* Era serifa de 72px. Uma pontuação compara-se com a da vez
                anterior — mono tabular. */}
            <div style={{ ...MONO, fontSize: 'var(--t-numero)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', lineHeight: 1 }}>{fs.score}<span style={{ fontSize: 'var(--t-destaque)', color: 'var(--ink-4)' }}>/100</span></div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: fs.score >= 80 ? 'var(--green)' : fs.score >= 60 ? 'var(--amber)' : 'var(--red)', marginTop: 8 }}>
              {fs.grade}
            </div>
            {fs.outcome_summary && (
              <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', marginTop: 14, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>{fs.outcome_summary}</p>
            )}
          </div>
          <div style={{ padding: '24px' }}>
            <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)', lineHeight: 1.75, marginBottom: 20 }}>{fs.overall_feedback}</p>

            {fs.time_assessment && (
              <div style={{ background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderLeft: '3px solid var(--amber)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Análise de tempo</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--amber)', lineHeight: 1.55 }}>{fs.time_assessment}</div>
              </div>
            )}

            {fs.correct_decisions?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Decisões correctas</div>
                {fs.correct_decisions.map((d: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-md)', marginBottom: 6 }}>
                    <span style={{ color: 'var(--green)', fontSize: 'var(--t-corpo)', flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 'var(--t-dado)', color: 'var(--green-3)', lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
              </div>
            )}

            {fs.critical_errors?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Erros críticos — o que nunca fazer</div>
                {fs.critical_errors.map((e: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', marginBottom: 6 }}>
                    <span style={{ color: 'var(--red)', fontSize: 'var(--t-corpo)', flexShrink: 0 }}>✗</span>
                    <span style={{ fontSize: 'var(--t-dado)', color: 'var(--red)', lineHeight: 1.5 }}>{e}</span>
                  </div>
                ))}
              </div>
            )}

            {fs.missed_opportunities?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>O que faltou</div>
                {fs.missed_opportunities.map((m: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-md)', marginBottom: 6 }}>
                    <span style={{ color: 'var(--amber)', fontSize: 'var(--t-corpo)', flexShrink: 0 }}>!</span>
                    <span style={{ fontSize: 'var(--t-dado)', color: 'var(--amber)', lineHeight: 1.5 }}>{m}</span>
                  </div>
                ))}
              </div>
            )}

            {fs.teaching_points?.length > 0 && (
              <div style={{ background: 'var(--roxo-claro)', border: '1px solid var(--roxo-borda)', borderLeft: '3px solid var(--roxo)', borderRadius: 'var(--r-md)', padding: '16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--roxo)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Pontos de aprendizagem</div>
                {fs.teaching_points.map((tp: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < fs.teaching_points.length - 1 ? 8 : 0 }}>
                    <span style={{ color: 'var(--roxo)', fontSize: 'var(--t-meta)', flexShrink: 0, marginTop: 1 }}>◆</span>
                    <span style={{ fontSize: 'var(--t-dado)', color: 'var(--roxo-escuro)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{tp}</span>
                  </div>
                ))}
              </div>
            )}

            {fs.key_references?.length > 0 && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Referências</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {fs.key_references.map((r: string, i: number) => (
                    <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--ink-3)', background: 'white', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 'var(--r-lg)' }}>{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={reset}
            style={{ flex: 1, padding: '13px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Tentar outro caso →
          </button>
          <button onClick={() => { setPhase('briefing') }}
            style={{ padding: '13px 20px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>
            Rever caso
          </button>
        </div>
      </div>
    </div>
    )
  }

  return null
}