// app/api/shift/evaluate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.shift_case || !body?.decisions) {
    return NextResponse.json({ error: 'Dados obrigatórios em falta' }, { status: 400 })
  }

  const { shift_case, decisions } = body

  const caseSummary = shift_case.patients.map((p: any, i: number) => {
    const d = decisions[i]
    return `DOENTE ${i + 1}: ${p.name}, ${p.age}a ${p.sex}
Queixa: ${p.chief_complaint}
História: ${p.history}
Vitais: ${Object.entries(p.vitals).map(([k, v]) => `${k}=${v}`).join(', ')}
Medicação actual: ${p.current_meds.join(', ') || 'nenhuma'}
Labs: ${Object.entries(p.labs).map(([k, v]) => `${k}: ${v}`).join(', ') || 'sem labs'}
Alergias: ${p.allergies.join(', ') || 'nenhuma'}
RESPOSTA DO ESTUDANTE: Diagnóstico="${d?.diagnosis || '—'}" | Tratamento=[${(d?.treatment || []).join(', ') || '—'}] | Raciocínio="${d?.reasoning || '—'}"`
  }).join('\n\n')

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És o chefe de serviço a avaliar as decisões de um interno/estudante após o turno. Sê rigoroso mas justo. Responde em português europeu (PT-PT).

Avalia cada doente individualmente e dá feedback construtivo e específico.

Responde APENAS com JSON válido sem markdown:
{
  "total_score": número de 0 a 300,
  "max_score": 300,
  "grade": "A" | "B" | "C" | "D" | "F",
  "patient_feedback": [
    {
      "patient_id": "p1",
      "patient_name": "nome do doente",
      "score": número de 0 a 100,
      "correct_diagnosis": "diagnóstico correcto completo",
      "correct_treatment": ["tratamento farmacológico correcto com dose se relevante"],
      "your_diagnosis": "diagnóstico dado pelo estudante",
      "your_treatment": ["tratamento dado pelo estudante"],
      "feedback": "feedback detalhado do chefe de serviço — 2-3 frases sobre o raciocínio clínico",
      "critical_errors": ["erro crítico que pode prejudicar o doente — se existir"],
      "well_done": ["o que o estudante fez bem — se houver"]
    }
  ],
  "overall_feedback": "avaliação geral do turno em 2-3 frases — como um chefe de serviço experiente falaria a um interno",
  "weak_areas": ["área a melhorar — concreta e accionável"],
  "strong_areas": ["área forte demonstrada — se existir"]
}

Critérios de pontuação por doente (0-100):
- Diagnóstico correcto: 40 pontos
- Tratamento farmacológico correcto: 40 pontos (parcial se incompleto)
- Sem erros críticos (interações graves, contraindicações, doses erradas): 20 pontos
Grade: A=270-300, B=240-269, C=180-239, D=120-179, F<120`,
      },
      { role: 'user', content: caseSummary },
    ], { maxTokens: 2500, temperature: 0.2 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao avaliar turno' }, { status: 500 })
  }
}