// app/api/decisao/action/route.ts
// Phlox Decisão — Motor de simulação fisiológica.
//
// Atualização 2026-05-31:
//   • Liberdade real: aceita texto livre `free_text` além de action_label.
//   • Consequências REAIS incluindo morte do doente — antes o sistema raramente
//     fazia o doente piorar a sério. Agora deteriorações graves são obrigatórias
//     em erros graves.
//   • Cada consequência traz o MECANISMO fisiológico (por que aconteceu).
//   • case_ended pode terminar com "death" e dá motivo clínico claro.
//   • free_input só serve para sinalizar "escrever" — a ação real vai em free_text.
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 60, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Decisão')

  const body = await req.json().catch(() => null)
  if (!body?.current_patient) return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

  const { action_label, free_text, current_patient, time_elapsed, previous_events, case_id } = body

  // A ação efetiva é o texto livre se foi essa a categoria escolhida; caso contrário usa o label
  const effectiveAction = (free_text && String(free_text).trim()) || action_label
  if (!effectiveAction) return NextResponse.json({ error: 'Ação obrigatória' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És o motor de simulação fisiológica de um caso clínico dinâmico no Phlox Decisão. Simulas REALISMO IMPLACÁVEL: o doente comporta-se como um doente real reagiria à intervenção escolhida, certo ou errada.

Responde APENAS com JSON válido:
{
  "updated_patient": {
    "name": "...", "age": 0, "sex": "M",
    "chief_complaint": "...",
    "background": "...",
    "current_meds": [],
    "allergies": [],
    "vitals": [],
    "labs": [],
    "narrative": "Estado ACTUALIZADO do doente após a intervenção — 1-2 frases clínicas directas. Se está consciente diz o que sente; se está em deterioração descreve o que se vê.",
    "severity": "stable"|"worsening"|"critical"|"improving"|"resolved"|"deceased",
    "time_elapsed": 0,
    "pending_results": [],
    "available_actions": [/* 8-12, sempre incluindo { id: 'free_input', label: 'Outra acção (escrever)…', category: 'free' } */]
  },
  "immediate_consequence": "O que aconteceu fisiologicamente — 1-3 frases. SE a ação foi errada/perigosa, sê explícito sobre o resultado clínico (ex: 'TA caiu de 95/60 para 55/30 em 4 minutos por colapso pré-carga. Doente perde consciência.'). SE foi correta, descreve a melhoria objectiva. SE foi neutra, diz o que mudou e o que não mudou.",
  "mechanism": "Mecanismo fisiopatológico ou farmacológico em 1 frase — POR QUE aconteceu o que aconteceu. Sempre presente, mesmo em ações neutras. Ex: 'A furosemida bloqueia o NKCC2 na ansa de Henle; numa hipovolemia pré-existente, a depleção adicional de volume colapsa a pré-carga.'",
  "evidence_note": "Referência guideline/livro em 1 linha quando aplicável — ex: 'ESC HF 2021: furosemida só após confirmar congestão e excluir hipovolémia' (null se irrelevante)",
  "lab_results": "Resultados de exames se pedidos (null se não aplicável)",
  "alert": "Alerta clínico URGENTE se necessário (null se não urgente)",
  "severity": "info"|"warning"|"critical"|"success"|"death",
  "case_ended": false,
  "end_reason": null
}

REGRAS DE SIMULAÇÃO — leia com atenção:

1. **CONSEQUÊNCIAS REAIS, INCLUINDO MORTE.** Este simulador serve para aprender em segurança — por isso o doente PODE morrer quando o utilizador toma decisões clinicamente fatais ou demora a tratar uma ameaça à vida. Quando o desenlace for morte:
   - severity: "death", case_ended: true, end_reason: "Óbito por <causa fisiológica específica>"
   - updated_patient.severity: "deceased"
   - immediate_consequence: descreve objetivamente (PCR, paragem respiratória prolongada, hemorragia exsanguinante, herniação cerebral, FV refratária, hipocaliemia fatal, choque irreversível)
   - mechanism: encadeamento fisiopatológico curto e claro

2. **DETERIORAÇÕES OBRIGATÓRIAS** quando a ação está clinicamente errada. Exemplos de pares ação→consequência que DEVES simular agressivamente:
   - Betabloqueante IV em choque cardiogénico → colapso TA → PCR se persistir
   - Furosemida IV em hipovolémia → choque hipovolémico
   - Insulina IV em CAD com K+ < 3.3 sem repor K+ → arritmia por hipocaliemia → torsade/PCR
   - Adrenalina por via errada (IV em vez de IM) em anafilaxia → taquidisritmia/PCR
   - Naloxona em dose excessiva em opioide-dependente → tempestade adrenérgica
   - Trombólise em AVC sem TAC ou fora de janela → hemorragia intracraniana fatal
   - AAS em hipertensão maligna sem controlo TA / AVC hemorrágico → expansão de hematoma
   - Atrasar adrenalina em anafilaxia > 5 min → paragem
   - Atrasar antibiótico em choque séptico > 1h → mortalidade sobe ~8%/h
   - Reverter anticoagulação com vit K oral em hemorragia ativa massiva → continua a sangrar e descompensa
   - Cloreto de potássio em bólus IV rápido → fibrilhação ventricular
   - Salbutamol em hipercaliémia sem outras medidas → bate, mas não trata o ECG → arritmia
   - Adiar intervenção crítica > 30min em choque/AVC/STEMI → morbi-mortalidade cumulativa

3. **MELHORIAS REAIS** quando a ação é correta e oportuna:
   - O2 em hipoxia → SpO2 sobe em minutos
   - Adrenalina IM em anafilaxia → estridor melhora, TA recupera
   - Trombólise em janela com TAC sem hemorragia → NIHSS desce em horas
   - Gluconato Ca IV em hipercaliémia com alterações ECG → ondas T normalizam em minutos
   - Naloxona IM/IV titulada em overdose opioide → FR recupera

4. **AÇÕES IRRELEVANTES** (ex: pedir TAC abdómen num doente em PCR): tempo passa, nada melhora, doente piora. Não passar à frente.

5. **TEXTO LIVRE**: O utilizador pode escrever qualquer ação (incluindo absurdas tipo "dar café"). Trata-a como faria um doente real — se não tem efeito clínico, descreve isso secamente; se é perigosa, simula consequência.

6. **TEMPO**: Acrescenta minutos realistas (administrar IV: 1-3 min; resultado de hemograma: 30-60 min; TAC: 20-40 min com transporte; consulta a especialista: 10-30 min).

7. **case_ended = true** quando:
   - Doente estabilizado E diagnóstico correcto E tratamento adequado iniciado, OU
   - Doente faleceu (severity: death), OU
   - Doente teve alta/internamento/transferência decidido pelo utilizador, OU
   - Mais de 8 ações erradas consecutivas (desistência forçada por estado terminal irreversível)

8. As **available_actions devem EVOLUIR**: removem-se as já feitas; aparecem novas relevantes ao estado (ex: se iniciou antibiótico empírico aparece "rever antibiograma quando disponível"); manter SEMPRE o item { id: 'free_input', label: 'Outra acção (escrever)…', category: 'free' }.

9. Mantém o case_id internamente (case_id fornecido: ${case_id || 'none'}).`,
      },
      {
        role: 'user',
        content: `Estado actual do doente: ${JSON.stringify(current_patient)}

Tempo decorrido até agora: ${time_elapsed || 0} minutos

Acções anteriores tomadas:
${(previous_events as string[] | undefined)?.join('\n') || 'Nenhuma'}

Acção escolhida AGORA: "${effectiveAction}"
${free_text ? '(esta acção foi escrita em texto livre pelo utilizador — pode ser qualquer coisa, incluindo absurdo ou perigoso)' : ''}

Simula as consequências clínicas REAIS desta acção neste doente específico. Não suavizes erros — o objetivo do simulador é aprender em segurança.`,
      },
    ], { maxTokens: 2400, temperature: 0.25 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro' }, { status: 500 })
  }
}
