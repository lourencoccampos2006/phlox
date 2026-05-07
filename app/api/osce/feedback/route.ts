import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 10, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox OSCE')
  const body = await req.json().catch(() => ({}))
  const { station, course, anamnesis_messages = [], checklist_results = [], student_diagnosis, student_plan } = body

  const anamnesisStr = anamnesis_messages.filter((m: any) => m.role === 'student').map((m: any) => m.content).join(' | ')
  const checklistStr = checklist_results.map((i: any) => `${i.done ? '✓' : '✗'} ${i.item} (${i.marks}pt${i.mandatory ? ', obrig.' : ''})`).join('\n')

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És examinador de OSCE a avaliar estudante de ${course}. Rigoroso mas construtivo. JSON válido sem markdown em PT-PT.
{ "anamnesis_score": 0-100, "anamnesis_feedback": "2-3 frases", "checklist_score": 0-100, "checklist_feedback": "1-2 frases", "diagnosis_score": 0-100, "diagnosis_feedback": "2-3 frases", "total_score": número, "max_score": 100, "percentage": 0-100, "grade": "A|B|C|D", "strengths": ["ponto 1","ponto 2"], "improvements": ["melhoria 1","melhoria 2","melhoria 3"], "model_answer": "o que o estudante ideal teria feito" }
Ponderação: anamnese 35%, checklist 40%, diagnóstico 25%. A≥80%, B≥65%, C≥50%, D<50%.`,
    },
    {
      role: 'user',
      content: `Estação: ${station?.title} (${station?.station_type})\nPerguntas estudante: ${anamnesisStr || '(nenhuma)'}\nChecklist:\n${checklistStr}\nDiagnóstico: ${student_diagnosis || '—'}\nPlano: ${student_plan || '—'}\nModelo esperado: ${station?.model_diagnosis} / ${station?.model_plan}`,
    },
  ], { maxTokens: 1500, temperature: 0.2 })

  return NextResponse.json(result)
}