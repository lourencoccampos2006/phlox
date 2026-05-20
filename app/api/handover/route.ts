import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiComplete } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { shift, date, patients } = body || {}
  if (!patients?.length) return NextResponse.json({ error: 'Sem dados de doentes' }, { status: 400 })

  const SHIFT_PT: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

  const patientSummaries = patients.map((p: any) => {
    const pending = p.meds?.filter((m: any) => !m.status) || []
    const refused = p.meds?.filter((m: any) => m.status === 'refused') || []
    const held = p.meds?.filter((m: any) => m.status === 'held') || []
    const administered = p.meds?.filter((m: any) => m.status === 'administered') || []
    return `${p.name} (${p.age || '?'}a${p.conditions ? `, ${p.conditions}` : ''}):\n  Administrados: ${administered.length}/${p.meds?.length || 0}${pending.length ? `\n  Em falta: ${pending.map((m: any) => m.name).join(', ')}` : ''}${refused.length ? `\n  Recusados: ${refused.map((m: any) => m.name).join(', ')}` : ''}${held.length ? `\n  Suspensos: ${held.map((m: any) => m.name).join(', ')}` : ''}`
  }).join('\n\n')

  try {
    const text = await aiComplete([
      {
        role: 'system',
        content: `És um farmacêutico clínico a redigir a passagem de turno. Responde em PT-PT formal mas acessível.

Gera uma passagem de turno concisa e útil com:
1. Resumo do turno (totais)
2. Doentes que requerem atenção especial no próximo turno (doses em falta, recusas, intercorrências)
3. Alertas farmacológicos relevantes (alergias, interações suspeitas)
4. Recomendações para o próximo turno

Formato: texto corrido, parágrafos curtos, máximo 300 palavras. Claro e objectivo.`,
      },
      {
        role: 'user',
        content: `Passagem de turno — ${SHIFT_PT[shift] || shift} de ${date}

Resumo de doentes:
${patientSummaries}`,
      },
    ], { maxTokens: 600, temperature: 0.3 })

    return NextResponse.json({ text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
