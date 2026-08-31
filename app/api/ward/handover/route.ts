import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// ── PORQUE É QUE ESTE PROMPT FOI REESCRITO (2026-08-31) ───────────────────
// A versão anterior produzia instruções clínicas inventadas, e a culpa não era
// do modelo — era da estrutura que lhe foi pedida.
//
// O que entra aqui, por utente, é só isto: as doses que o MAR marcou como
// suspensas ou recusadas, e um contador de tarefas. Não entra nada sobre o que
// aconteceu no turno. E o prompt exigia:
//
//     "status": "estado clínico em 1-2 frases — o que aconteceu neste turno"
//     "action_needed": "SEMPRE prático — 'verificar TA às 22h', ..."
//
// Pedir um estado clínico do turno a quem não recebeu informação do turno, e
// obrigar a preencher uma ação com exemplos concretos, deixa ao modelo uma só
// saída possível: inventar. E o resultado ia para uma passagem de turno, que é
// o documento com que a equipa seguinte decide o que fazer a pessoas reais.
//
// A regra agora é uma só: o modelo REORGANIZA o que recebeu e não acrescenta
// facto nenhum. Onde não há dados, o campo fica vazio e diz-se que não há.
// Uma passagem de turno que diz "sem alterações registadas" é útil. Uma que
// inventa "verificar TA às 22h" é pior do que não existir.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 20, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('pro', 'Phlox Ward')

  const body = await req.json().catch(() => null)
  if (!body?.patients) return NextResponse.json({ error: 'Dados obrigatórios' }, { status: 400 })

  const { shift, patients, from_name, from_role, general_notes } = body

  const SHIFT_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

  // Sem nada registado não há nada para sintetizar. Chamar o modelo aqui só
  // lhe dava a oportunidade de encher o silêncio.
  const semDados = (!patients || patients.length === 0) && !String(general_notes || '').trim()
  if (semDados) {
    return NextResponse.json({
      shift,
      from_name,
      patients_summary: [],
      general_notes: 'Sem alterações registadas neste turno. Nada a assinalar à equipa seguinte.',
      sem_dados: true,
    })
  }

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És ${from_role || 'um profissional'} a organizar uma passagem de turno num lar ou centro de dia em Portugal. Responde APENAS com JSON válido, sem markdown, em português de Portugal.

{
  "shift": "${shift}",
  "from_name": "${from_name}",
  "patients_summary": [
    {
      "patient_id": "o id exato que recebeste",
      "patient_name": "o nome exato que recebeste",
      "registado": "o que ficou registado sobre esta pessoa, pelas palavras do registo. Uma frase.",
      "action_needed": "só se decorrer DIRETAMENTE do que foi registado. Caso contrário, string vazia."
    }
  ],
  "general_notes": "síntese do que está em aberto, em 1-2 frases, sem acrescentar nada"
}

A REGRA, E NÃO HÁ OUTRA: reescreves o que recebeste de forma mais legível. Não
acrescentas um único facto.

Em concreto, é PROIBIDO:
- descrever o estado clínico, o humor ou a evolução de alguém — não recebeste
  essa informação e não a podes deduzir
- inventar sinais vitais, horas, valores, exames ou sintomas
- escrever ações do género "verificar a tensão às 22h" ou "confirmar análises"
  se ninguém registou que isso é preciso
- preencher \`action_needed\` só para o campo não ficar vazio

Se sobre uma pessoa só recebeste que uma dose foi suspensa, então o que escreves
é que a dose foi suspensa — e mais nada. Um campo vazio é uma resposta correta e
é o que se espera na maior parte dos casos.

Quem vai ler isto decide o que fazer a pessoas reais a seguir. Uma frase
inventada aqui vale menos que zero.`,
    },
    {
      role: 'user',
      content: `Turno: ${SHIFT_LABELS[shift] || shift}
De: ${from_name}
${general_notes ? `Notas registadas: ${general_notes}` : 'Sem notas gerais registadas.'}

${patients.length ? `Registos por utente:
${patients.map((p: any) => `- ${p.patient_name} (id ${p.patient_id})
  Doses suspensas ou recusadas: ${p.decisions?.length ? p.decisions.join(' · ') : 'nenhuma'}
  Tarefas em aberto: ${p.open_tasks || 0}`).join('\n')}`
  : 'Nenhum utente com registos neste turno.'}`,
    },
  ], { maxTokens: 1500, temperature: 0 })

  return NextResponse.json(result)
}
