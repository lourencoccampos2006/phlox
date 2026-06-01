// app/api/study-plan/route.ts
// Gera plano de estudo com AI a partir de tópicos + data do exame + ritmo.
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 8, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Plano de estudo AI')

  const body = await req.json().catch(() => null)
  if (!body?.exam_date || !Array.isArray(body.topics) || body.topics.length === 0) {
    return NextResponse.json({ error: 'Falta exam_date ou topics' }, { status: 400 })
  }
  const { title, exam_date, subject, topics, days_per_week, minutes_per_session } = body

  // Quantas semanas até ao exame?
  const daysToExam = Math.ceil((new Date(exam_date).getTime() - Date.now()) / 86400000)
  if (daysToExam < 1) return NextResponse.json({ error: 'O exame já passou ou é hoje.' }, { status: 400 })
  const weeks = Math.max(1, Math.ceil(daysToExam / 7))

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um tutor de farmacologia clínica em Portugal a criar planos de estudo realistas. Português PT-PT. Devolves APENAS JSON:
{
  "weeks": [
    { "focus": "tema principal da semana", "sessions": ["frase descrevendo a sessão 1", "sessão 2", "..."] }
  ],
  "milestones": [
    { "at_week": 1, "what": "marco a atingir (ex: cartões SRS dos antibióticos beta-lactâmicos completos)" }
  ],
  "advice": "1-2 frases com conselho concreto baseado no nº de semanas e nº de tópicos."
}

Regras:
- Distribuir os tópicos pelas semanas de forma equilibrada — sem deixar tudo para a última semana.
- Cada semana tem 'days_per_week' sessões de 'minutes_per_session' minutos. Indica nas sessões o tópico + tipo de atividade (ler, fazer flashcards SRS, fazer perguntas, simular caso).
- A última semana deve ser dedicada a REVISÃO + simulação de exame, não a matéria nova.
- Se há mais tópicos do que semanas, agrupar relacionados.
- Se há menos tópicos do que semanas, aprofundar com revisão espaçada.`,
    },
    {
      role: 'user',
      content: `Título: ${title || 'Plano de estudo'}
Área: ${subject || 'Farmacologia clínica'}
Data do exame: ${exam_date} (faltam ~${daysToExam} dias, ~${weeks} semanas)
Sessões: ${days_per_week || 5}/semana × ${minutes_per_session || 50} min

Tópicos:
${topics.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}

Cria o plano semanal.`,
    },
  ], { maxTokens: 2200, temperature: 0.3 })

  return NextResponse.json({ plan: result, weeks })
}
