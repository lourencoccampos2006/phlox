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
      content: `És examinador sénior de OSCE a avaliar um estudante de ${course}. Avaliação RIGOROSA, específica e acionável — como num exame real. Aponta exatamente o que faltou. JSON válido, sem markdown, PT-PT.
{
  "anamnesis_score": 0-100,
  "anamnesis_feedback": "análise específica: que boas perguntas fez, que perguntas-chave FALTARAM (nomeia-as), se explorou red flags",
  "questions_missed": ["pergunta importante que não fez", "outra"],
  "checklist_score": 0-100,
  "checklist_feedback": "1-2 frases sobre os itens obrigatórios falhados",
  "diagnosis_score": 0-100,
  "diagnosis_feedback": "o diagnóstico/plano estava certo? o que faltou no raciocínio?",
  "red_flags_missed": ["sinal de alarme que devia ter procurado, se aplicável"],
  "total_score": número, "max_score": 100, "percentage": 0-100, "grade": "A|B|C|D",
  "strengths": ["2-3 pontos fortes concretos"],
  "improvements": ["3-4 melhorias específicas e acionáveis"],
  "model_answer": "passo-a-passo do que o estudante ideal teria feito nesta estação (5-8 linhas)",
  "next_station_tip": "1 conselho para a próxima estação deste tipo"
}
Ponderação: anamnese 35%, checklist 40%, diagnóstico 25%. A≥80%, B≥65%, C≥50%, D<50%.
Sê honesto: se fez poucas perguntas ou falhou itens obrigatórios, a nota TEM de refletir isso. Não inflaciones.`,
    },
    {
      role: 'user',
      content: `Estação: ${station?.title} (${station?.station_type}) · dificuldade ${station?.difficulty}
Briefing: ${station?.patient_briefing || '—'}
Perguntas/intervenções do estudante: ${anamnesisStr || '(nenhuma — não interagiu com o doente)'}
Checklist do examinador:
${checklistStr}
Diagnóstico do estudante: ${student_diagnosis || '— (não deu)'}
Plano do estudante: ${student_plan || '— (não deu)'}
Modelo esperado: ${station?.model_diagnosis} / ${station?.model_plan}`,
    },
  ], { maxTokens: 2200, temperature: 0.2 })

  return NextResponse.json(result)
}