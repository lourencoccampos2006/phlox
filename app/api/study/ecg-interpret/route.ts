// app/api/study/ecg-interpret/route.ts
// POST → avalia a interpretação do utilizador sobre um ECG
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'ECG IA')

  const body = await req.json().catch(() => null) as { ecg_id?: string; interpretation?: string } | null
  if (!body?.ecg_id || !body.interpretation) {
    return NextResponse.json({ error: 'ecg_id e interpretation obrigatórios' }, { status: 400 })
  }

  const db = sb(req)
  const { data: ecg } = await db.from('ecg_library').select('*').eq('id', body.ecg_id).single()
  if (!ecg) return NextResponse.json({ error: 'ECG não encontrado' }, { status: 404 })

  try {
    const res = await aiJSON<{ score: number; feedback: string; missed: string[]; correct: string[] }>([
      {
        role: 'system',
        content: `És cardiologista a avaliar a interpretação de um ECG por estudante/profissional.
Avalia rigorosamente em PT-PT. Responde APENAS com JSON:
{
  "score": 0-100,
  "feedback": "feedback construtivo em 2-3 frases",
  "correct": ["pontos correctamente identificados"],
  "missed": ["pontos importantes em falta"]
}

ECG real:
- Ritmo: ${ecg.rhythm}
- Frequência: ${ecg.rate_bpm} bpm
- Eixo: ${ecg.axis}
- PR: ${ecg.pr_ms} ms, QRS: ${ecg.qrs_ms} ms, QTc: ${ecg.qtc_ms} ms
- Achados: ${(ecg.findings || []).join(', ')}
- Diagnóstico: ${ecg.diagnosis}
- Contexto: ${ecg.context}`,
      },
      { role: 'user', content: `Interpretação do utilizador:\n"${body.interpretation}"\n\nAvalia.` },
    ], { maxTokens: 700, temperature: 0.15 })
    return NextResponse.json(res)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 })
  }
}
