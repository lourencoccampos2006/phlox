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
  chf_decompensation: `Cria um caso de descompensação cardíaca aguda. Homem 72 anos, FA paroxística conhecida, IC-FEr (FE 35%) prévia. Recorre à urgência com dispneia em repouso, ortopneia de 3 almofadas, edemas. TA 160/95, FC 110 irregular, FR 28, SpO2 88% AA, apirético. Faz bisoprolol 5mg, furosemida 40mg, ramipril 10mg, varfarina.`,
  sepsis_antibiotics: `Cria um caso de sépsis associada aos cuidados de saúde. Mulher 58 anos, internada há 3 dias por pneumonia, em amoxicilina. Novo pico febril (39.2°C), FC 118, TA 90/60, FR 24, SpO2 93%. Confusa. Cateter venoso periférico 3 dias. Leucocitose 22.000.`,
  dm_ketoacidosis: `Cria um caso de cetoacidose diabética. Mulher 45 anos, DM1, insulina basal-bólus. Últimos 3 dias de vómitos, recusa alimentar, não ajustou insulina. Glicémia 450 mg/dL, cetona urinária 4+, pH 7.21, Bic 12, Na 132 (corrigido 138), K+ 3.2 mEq/L. TA 100/65, FC 120, mucosas secas.`,
  anticoag_bleeding: `Cria um caso de hemorragia digestiva alta no doente anticoagulado. Homem 68 anos, FA permanente em varfarina 5mg. INR 8.2 colhido hoje. Hematemese de sangue vivo há 1h. TA 95/60, FC 118, Hb 8.2 g/dL, hematócrito 25%.`,
  pneumonia_abx: `Cria um caso de pneumonia sem resposta ao antibiótico. Mulher 55 anos, internada há 3 dias com pneumonia lobar direita, iniciou amoxicilina 1g TID. Sem melhoria: ainda febril (38.8°C), PCR subiu de 180 para 240 mg/L. Culturais de escarro pendentes. Sem alergias conhecidas. Não institucionalizada, sem antibióticos recentes.`,
  polypharmacy_elderly: `Cria um caso de queda no idoso polimedicado. Homem 84 anos, 11 medicamentos: furosemida 40mg, espironolactona 25mg, ramipril 5mg, bisoprolol 5mg, amlodipina 10mg, sinvastatina 20mg, metformina 500mg BD, alprazolam 0.5mg noite, omeprazol 20mg, ácido acetilsalicílico 100mg, donepezilo 10mg. Queda às 3h da manhã ao ir à casa de banho. Sem traumatismo craniano. TA deitado 130/80, TA em pé 95/60.`,
  anaphylaxis: `Cria um caso de anafilaxia grave. Mulher 28 anos, sem antecedentes relevantes, no SU 15 minutos após toma de amoxicilina prescrita por infeção urinária (primeira toma na vida). Urticária generalizada, edema labial, estridor inspiratório audível à distância, dispneia. TA 78/40, FC 138, FR 30, SpO2 89% AA. Mantém-se consciente mas ansiosa.`,
  ischemic_stroke: `Cria um caso de AVC isquémico em janela. Homem 64 anos, HTA e dislipidemia controladas. Familiares trouxeram-no 1h45 após início súbito de hemiparesia direita e disartria — viu-o bem 1h45 antes. NIHSS 14. TA 198/108, FC 88, glicémia capilar 142 mg/dL, sem febre. TAC-CE sem hemorragia, ASPECTS 9. Faz AAS 100mg, atorvastatina 20mg, ramipril 5mg. Sem anticoagulantes.`,
  hyperkalemia: `Cria um caso de hipercaliémia grave. Homem 76 anos, DRC estádio 4 (TFGe 22), HTA, DM2. Vem a consulta por fraqueza generalizada de início no dia. ECG: ondas T apiculadas em precordiais, PR alargado, QRS 0.14s. K+ 7.2 mEq/L, creatinina 3.1 (basal 2.4), HCO3- 16, glicémia 248. Faz ramipril 10mg, espironolactona 25mg, metformina 850mg BD, insulina basal 12U, AAS 100mg. Recentemente iniciou trimetoprim por ITU.`,
  opioid_overdose: `Cria um caso de depressão respiratória por opioides. Homem 58 anos, dor oncológica em morfina LP 60mg 12/12h + breakthrough 20mg PRN. Encontrado pela esposa em casa, pouco reativo, FR 6/min, SpO2 82% AA, miose puntiforme, TA 100/60, FC 58. Última toma de breakthrough há 90 min — esposa diz que tomou 3 doses em poucas horas por dor.`,
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
