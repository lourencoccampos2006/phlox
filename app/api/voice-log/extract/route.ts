// app/api/voice-log/extract/route.ts
// Passo 2 de 3 do "Regista falando": a partir da transcrição já REVISTA pelo
// utilizador (nunca do áudio cru), propõe ações estruturadas — nunca grava
// nada aqui. Mesmo padrão do Copilot (app/api/copilot-chat/route.ts):
// "proposedAction" que só se torna escrita real depois de confirmação
// explícita (app/api/voice-log/commit).
//
// Medicação (2026-07-30, a pedido de Fernando): a IA NUNCA inventa o nome de
// um medicamento — só pode escolher de entre a lista real da medicação ATIVA
// desta pessoa (fornecida no prompt), e mesmo assim o servidor volta a
// confirmar a correspondência por nome antes de aceitar a ação (nunca confia
// cegamente no que a IA disse) — se não houver correspondência clara, a ação
// é descartada em vez de arriscar. Ocorrências/quedas continuam de fora desta
// versão — a única das áreas sem um caminho de registo manual estruturado e
// específico já existente para comparar/confirmar a extração.
//
// Sinais vitais + atividades (2026-08-07, a pedido de Fernando: "mais opções
// do que dá para fazer por voz"): sinais vitais mapeiam para o MESMO campo
// care_records.vitals já editável à mão em /care-log; atividades seguem o
// mesmo padrão anti-alucinação da medicação — só pode escolher de uma lista
// REAL de atividades agendadas para hoje, nunca inventa uma.
//
// Reconhecimento de assunto reforçado (mesmo pedido — "não reconhece muito
// bem o assunto"): exemplos concretos por domínio no prompt (few-shot), que
// ajudam um modelo pequeno a classificar frases reais de sala melhor do que
// só a definição abstrata do domínio.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sb } from '@/lib/orgAuth'
import { aiJSON } from '@/lib/ai'

export const runtime = 'nodejs'

interface RawAction {
  domain: 'nutrition' | 'health_checkin' | 'support_service' | 'medication' | 'vitals' | 'activity' | 'medication_prep' | 'recurring_service' | 'dietary_reinforcement' | 'transport_service'
  summary: string
  payload: Record<string, any>
}

const BASE_SYSTEM = `Ajudas uma equipa de um centro de dia/lar português a transformar uma frase falada durante a ronda em registos estruturados.

Extrai APENAS o que foi dito EXPLICITAMENTE. Nunca inventes nem infiras valores que não foram ditos — na dúvida sobre um VALOR, não incluas o campo. Mas não sejas excessivamente conservador a CLASSIFICAR o assunto: se a frase claramente fala de comida, saúde, sinais vitais, uma atividade ou um pedido de apoio, cria a ação mesmo que falte algum detalhe menor — usa só os campos que foram mesmo ditos.

Uma frase pode conter MAIS DE UM assunto (ex: "comeu bem e a tensão estava alta" = nutrition + vitals) — cria uma ação por assunto.

Nunca extraias ocorrências, quedas, incidentes ou qualquer coisa que soe a episódio de segurança — isso fica sempre para registo manual em /incidents, mesmo que a frase o mencione.

Os assuntos possíveis:

1. "nutrition" — o que a pessoa comeu/bebeu. Campos: breakfast/lunch/dinner (0, 25, 50, 75 ou 100 — a % da refeição que comeu, arredonda ao valor mais próximo destes 5; "comeu tudo"=100, "comeu bem"=75, "comeu pouco"=25, "recusou"/"não comeu nada"=0), appetite ("Bom"|"Razoável"|"Fraco"|"Recusou"), fluid_ml (número, só se mencionar quantidade de líquido).
   Exemplos: "A Dona Maria comeu bem ao almoço" → {domain:"nutrition",payload:{lunch:75}}. "Ele recusou o pequeno-almoço todo" → {domain:"nutrition",payload:{breakfast:0,appetite:"Recusou"}}. "Bebeu um copo de água, uns 200ml" → {domain:"nutrition",payload:{fluid_ml:200}}.

2. "health_checkin" — enfermagem básica ou acompanhamento (NÃO administração de medicação, NÃO sinais vitais numéricos — isso é "vitals"). Campos: kind ("enfermagem"|"acompanhamento"), notes (resumo curto do que foi feito/observado, em PT-PT, começa por maiúscula), duration_min (só se mencionar tempo).
   Exemplos: "Fiz o penso à ferida do pé" → {domain:"health_checkin",payload:{kind:"enfermagem",notes:"Penso à ferida do pé"}}. "Passei 20 minutos a conversar com ele, estava bem-disposto" → {domain:"health_checkin",payload:{kind:"acompanhamento",notes:"Conversou, bem-disposto",duration_min:20}}.

3. "support_service" — pedido de roupa/transporte/outro serviço de apoio. Campos: kind ("roupa"|"transporte"|"outro"), notes (detalhe curto).
   Exemplos: "Precisa de roupa lavada para amanhã" → {domain:"support_service",payload:{kind:"roupa",notes:"Roupa lavada para amanhã"}}. "Tem consulta e precisa de transporte marcado" → {domain:"support_service",payload:{kind:"transporte",notes:"Transporte para consulta"}}.

4. "vitals" — sinais vitais medidos agora, com número. Campos (só os mencionados): bp_sys/bp_dia (tensão arterial sistólica/diastólica, ex: "13 por 8" = bp_sys:130,bp_dia:80), hr (frequência cardíaca), temp (temperatura em ºC), spo2 (saturação de oxigénio, %), glucose (glicemia), weight (peso em kg). Nunca inventes um valor não dito.
   Exemplos: "Medi a tensão, estava 14 por 9" → {domain:"vitals",payload:{bp_sys:140,bp_dia:90}}. "Temperatura de 37 e 2" → {domain:"vitals",payload:{temp:37.2}}. "Saturação a 96, pulso a 78" → {domain:"vitals",payload:{spo2:96,hr:78}}.`

const MED_SYSTEM = `

5. "medication" — administração de um medicamento da lista de medicação ATIVA desta pessoa, fornecida abaixo. Campos: med_name (copia EXATAMENTE o nome como aparece na lista fornecida — nunca escrevas um nome que não esteja na lista), status ("administered" se foi dado/tomado, "refused" se recusou, "held" se foi propositadamente suspenso/não dado por decisão clínica). Se o medicamento mencionado não corresponder claramente a NENHUM da lista, NÃO cries a ação — não adivinhes qual seria.`

const ACTIVITY_SYSTEM = `

6. "activity" — participação numa atividade agendada para HOJE, da lista fornecida abaixo. Campos: activity_title (copia EXATAMENTE o título como aparece na lista — nunca inventes uma atividade que não esteja na lista), attended (true se participou, false se recusou/não foi), notes (opcional, curto). Se a atividade mencionada não corresponder claramente a nenhuma da lista de hoje, NÃO cries a ação.
   Exemplo: "Ele foi à ginástica e participou bem" → {domain:"activity",payload:{activity_title:"Ginástica",attended:true}}.`

const PREP_SYSTEM = `

7. "medication_prep" — preparação física da medicação da semana (pastilheiro/blister), DIFERENTE de dar/administrar. Só existe esta ação se a pessoa disser explicitamente que PREPAROU/ORGANIZOU a medicação da semana (não "dei"/"tomou" — isso é "medication"). Sem campos — só cria a ação.
   Exemplos: "Já preparei a medicação semanal da Dona Maria" → {domain:"medication_prep",payload:{}}. "Organizei o pastilheiro dele para esta semana" → {domain:"medication_prep",payload:{}}.`

const RECURRING_SYSTEM = `

8. "recurring_service" — um serviço complementar agendado que se repete (roupa, higiene de fim de semana, alimentação de fim de semana, reforço noturno) foi CUMPRIDO hoje, da lista fornecida abaixo. Campo: kind (copia EXATAMENTE o kind da lista fornecida). Se não corresponder claramente a nenhum da lista, NÃO cries a ação.
   Exemplo (com "roupa" na lista): "Já tratei da roupa dele" → {domain:"recurring_service",payload:{kind:"roupa"}}.`

const REINFORCEMENT_SYSTEM = `

9. "dietary_reinforcement" — reforço alimentar (diabéticos) dado agora. Sem campos — só cria a ação.
   Exemplo: "Dei o reforço alimentar à Dona Maria" → {domain:"dietary_reinforcement",payload:{}}.`

const TRANSPORT_SYSTEM = `

10. "transport_service" — um transporte agendado que se repete foi CUMPRIDO hoje, da lista fornecida abaixo. Campo: transport_label (copia EXATAMENTE o texto como aparece na lista — nunca inventes um transporte que não esteja na lista). Se não corresponder claramente a nenhum da lista, NÃO cries a ação.
   Exemplo (com "Transporte para fisioterapia" na lista): "Levei-a à fisioterapia" → {domain:"transport_service",payload:{transport_label:"Transporte para fisioterapia"}}.`

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Registo por voz')

  const body = await req.json().catch(() => null) as any
  const transcript = String(body?.transcript || '').trim().slice(0, 2000)
  const patientId = String(body?.patient_id || '')
  if (!transcript) return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 400 })
  if (!patientId) return NextResponse.json({ error: 'patient_id obrigatório.' }, { status: 400 })

  // A RLS do próprio cliente autenticado é a barreira real: se a pessoa não
  // tiver acesso a este utente, a linha simplesmente não aparece.
  const db = sb(req)
  const today = new Date().toISOString().slice(0, 10)
  const todayWeekday = new Date().getDay()
  const [{ data: patient }, { data: meds }, { data: todaysActivities }, { data: recSvcs }, { data: transportScheds }] = await Promise.all([
    db.from('patients').select('id,name,conditions').eq('id', patientId).maybeSingle(),
    db.from('patient_meds').select('id,name,dose').eq('patient_id', patientId).eq('active', true),
    db.from('activities').select('id,title').eq('date', today),
    db.from('support_recurring_services').select('id,kind,weekdays').eq('patient_id', patientId).eq('active', true).then((r: any) => r, () => ({ data: [] })),
    db.from('support_transport_schedules').select('id,label,weekdays').eq('patient_id', patientId).eq('active', true).then((r: any) => r, () => ({ data: [] })),
  ])
  if (!patient) return NextResponse.json({ error: 'Sem acesso a esta pessoa.' }, { status: 403 })

  const activeMeds = meds || []
  const activities = todaysActivities || []
  const KIND_LABEL: Record<string, string> = { roupa: 'Roupa', higiene_fds: 'Higiene de fim de semana', alimentacao_fds: 'Alimentação de fim de semana', reforco_noite: 'Reforço alimentar noturno' }
  const todaysKinds = [...new Set(((recSvcs || []) as any[]).filter(s => !s.weekdays || s.weekdays.includes(todayWeekday)).map(s => s.kind))]
  const todaysTransport = ((transportScheds || []) as any[]).filter(s => !s.weekdays || s.weekdays.includes(todayWeekday))
  const isDiabetic = /diabet|dm2|dm1/i.test(patient.conditions || '')

  const domains = ['nutrition', 'health_checkin', 'support_service', 'vitals']
  let system = BASE_SYSTEM
  if (activeMeds.length > 0) {
    domains.push('medication')
    system += MED_SYSTEM + `\n\nMedicação ativa desta pessoa (usa o nome EXATAMENTE como aqui):\n` + activeMeds.map(m => `- ${m.name}${m.dose ? ` (${m.dose})` : ''}`).join('\n')
    domains.push('medication_prep')
    system += PREP_SYSTEM
  }
  if (activities.length > 0) {
    domains.push('activity')
    system += ACTIVITY_SYSTEM + `\n\nAtividades agendadas para hoje (usa o título EXATAMENTE como aqui):\n` + activities.map(a => `- ${a.title}`).join('\n')
  }
  if (todaysKinds.length > 0) {
    domains.push('recurring_service')
    system += RECURRING_SYSTEM + `\n\nServiços recorrentes agendados para hoje desta pessoa (usa o kind EXATAMENTE como aqui):\n` + todaysKinds.map(k => `- kind:"${k}" (${KIND_LABEL[k] || k})`).join('\n')
  }
  if (todaysTransport.length > 0) {
    domains.push('transport_service')
    system += TRANSPORT_SYSTEM + `\n\nTransportes agendados para hoje desta pessoa (usa o texto EXATAMENTE como aqui):\n` + todaysTransport.map((t: any) => `- ${t.label}`).join('\n')
  }
  if (isDiabetic) {
    domains.push('dietary_reinforcement')
    system += REINFORCEMENT_SYSTEM
  }
  system += `\n\nDevolve APENAS JSON: {"actions": [{"domain": "...", "summary": "frase curta em PT-PT para mostrar num cartão de confirmação, ex: 'Almoço: comeu bem (75%)'", "payload": {...}}]}`

  try {
    const result = await aiJSON<{ actions: RawAction[] }>([
      { role: 'system', content: system },
      { role: 'user', content: `Pessoa: ${patient.name}\nTranscrição: "${transcript}"` },
    ], { maxTokens: 900, temperature: 0.1 })

    const rawActions = (Array.isArray(result?.actions) ? result.actions : [])
      .filter(a => a && domains.includes(a.domain) && a.payload)
      .slice(0, 8)

    // Medicação e atividade: o servidor volta a confirmar a correspondência
    // por nome — nunca confia só na palavra da IA. Sem correspondência clara
    // → descarta a ação em vez de arriscar.
    const activityById = new Map(activities.map(a => [a.title.toLowerCase(), a]))
    const actions = rawActions.map(a => {
      if (a.domain === 'medication') {
        const spoken = String(a.payload?.med_name || '').trim().toLowerCase()
        const match = activeMeds.find(m => m.name.toLowerCase() === spoken)
          || activeMeds.find(m => m.name.toLowerCase().includes(spoken) || spoken.includes(m.name.toLowerCase()))
        if (!match || !['administered', 'refused', 'held'].includes(a.payload?.status)) return null
        return { ...a, payload: { med_id: match.id, med_name: match.name, status: a.payload.status } }
      }
      if (a.domain === 'activity') {
        const spoken = String(a.payload?.activity_title || '').trim().toLowerCase()
        const match = activityById.get(spoken)
          || activities.find(x => x.title.toLowerCase().includes(spoken) || spoken.includes(x.title.toLowerCase()))
        if (!match) return null
        return { ...a, payload: { activity_id: match.id, activity_title: match.title, attended: a.payload?.attended !== false, notes: a.payload?.notes ? String(a.payload.notes).slice(0, 300) : null } }
      }
      if (a.domain === 'recurring_service') {
        const kind = String(a.payload?.kind || '')
        if (!todaysKinds.includes(kind)) return null
        return { ...a, payload: { kind } }
      }
      if (a.domain === 'transport_service') {
        const spoken = String(a.payload?.transport_label || '').trim().toLowerCase()
        const match = todaysTransport.find((t: any) => t.label.toLowerCase() === spoken)
          || todaysTransport.find((t: any) => t.label.toLowerCase().includes(spoken) || spoken.includes(t.label.toLowerCase()))
        if (!match) return null
        return { ...a, payload: { schedule_id: match.id, transport_label: match.label } }
      }
      return a
    }).filter((a): a is RawAction => a !== null)

    return NextResponse.json({ patient: { id: patient.id, name: patient.name }, actions })
  } catch (err: any) {
    console.error('[phlox:voice-log/extract]', err?.message)
    return NextResponse.json({ error: 'Não foi possível interpretar o que foi dito. Tenta descrever de forma mais direta.' }, { status: 502 })
  }
}
