// app/api/patient-summary/route.ts
// PRO — Resumo clínico de uma pessoa (próprio, familiar ou doente) num clique.
// Junta a medicação registada + dados demográficos e devolve um resumo
// estruturado (perfil, o que vigiar, possíveis interações, próximo passo).
// O cliente guarda-o no histórico da pessoa (lib/saves), por isso vira um
// registo durável — não um chat efémero. Só Pro/Institucional.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan, planGateResponse, isPlanSufficient } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

function makeSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}
function getToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

interface PatientSummary {
  profile_line: string                 // 1 linha: idade/sexo/condições
  overview: string                     // visão geral curta
  watch_for: { level: 'alta' | 'média' | 'baixa'; text: string }[]
  interactions: string[]               // possíveis interações a confirmar
  suggestions: string[]                // próximos passos / sugestões
  disclaimer: string
  generated_at: string
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPlanSufficient(plan, 'pro')) return planGateResponse('pro', 'Resumo clínico')

  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    profileId?: string; profileType?: 'self' | 'family' | 'patient'
    name?: string; age?: number | null; sex?: string | null
    conditions?: string | null; allergies?: string | null
  } | null
  if (!body) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })

  const supabase = makeSupabase(token)

  // Carrega medicação da fonte certa consoante o tipo de perfil.
  let meds: { name: string; dose?: string; frequency?: string }[] = []
  try {
    if (body.profileType === 'patient' && body.profileId) {
      const { data } = await supabase.from('patient_meds').select('name, dose, frequency').eq('patient_id', body.profileId)
      meds = data || []
    } else if (body.profileType === 'family' && body.profileId) {
      const { data } = await supabase.from('family_profile_meds').select('name, dose, frequency').eq('profile_id', body.profileId)
      meds = data || []
    } else {
      const { data } = await supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', userId)
      meds = data || []
    }
  } catch { /* tabela pode variar — segue sem meds */ }

  const demo = [
    body.age ? `${body.age} anos` : null,
    body.sex === 'M' ? 'masculino' : body.sex === 'F' ? 'feminino' : null,
    body.conditions ? `condições: ${body.conditions}` : null,
    body.allergies ? `alergias: ${body.allergies}` : null,
  ].filter(Boolean).join(' · ') || 'sem dados demográficos registados'

  const medsLine = meds.length
    ? meds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`).join('; ')
    : 'sem medicação registada'

  try {
    const summary = await aiJSON<PatientSummary>([
      {
        role: 'system',
        content: `És o Phlox, assistente clínico em PT-PT. Geras um RESUMO CLÍNICO breve e útil de uma pessoa, para um profissional/cuidador ler em segundos. Rigor: não inventes diagnósticos, doses ou interações; quando apontas uma interação, di-la como "a confirmar". Não prescreves.
Responde EXCLUSIVAMENTE em JSON:
{
  "profile_line": "string — idade/sexo/condições/alergias numa linha",
  "overview": "string — 2-3 frases de visão geral clínica",
  "watch_for": [{"level":"alta|média|baixa","text":"o que vigiar"}],
  "interactions": ["interações possíveis a confirmar (ou vazio)"],
  "suggestions": ["próximos passos / sugestões práticas"],
  "disclaimer": "Informação educacional, não substitui avaliação clínica.",
  "generated_at": "${new Date().toISOString()}"
}`,
      },
      {
        role: 'user',
        content: `Pessoa: ${body.name || 'Sem nome'}\nDemografia: ${demo}\nMedicação: ${medsLine}\n\nGera o resumo clínico.`,
      },
    ], { maxTokens: 700, temperature: 0.3 })

    return NextResponse.json({ ...summary, meds_count: meds.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha ao gerar resumo' }, { status: 500 })
  }
}
