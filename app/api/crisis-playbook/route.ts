import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'
import { makeSupabase, getToken } from '@/lib/orgAuth'

// Playbook de Crise — Pro, objetivo=cuidador. Para CADA familiar, gera (e
// cacheia) protocolos "o que fazer se..." específicos às condições e
// medicação REAIS da pessoa — não conselhos genéricos. Regenera só quando a
// medicação/condições mudam (source_hash), para não gastar IA à toa nem
// mostrar um playbook desatualizado sem se perceber.

// Hash simples e estável (não criptográfico — só para detetar mudanças).
function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return h.toString(36)
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 8, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Playbook de Crise')
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const supabase = makeSupabase(token)

  const body = await req.json().catch(() => null)
  const profileId = body?.profile_id
  const force = !!body?.force
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const { data: prof } = await supabase.from('family_profiles').select('name,age,conditions,allergies').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (!prof) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  const { data: meds } = await supabase.from('family_profile_meds').select('name').eq('profile_id', profileId)
  const medNames = (meds || []).map((m: any) => m.name).sort()

  const sourceHash = simpleHash(`${prof.conditions || ''}|${prof.allergies || ''}|${medNames.join(',')}`)

  const { data: existing } = await supabase.from('family_crisis_playbooks').select('*').eq('profile_id', profileId).maybeSingle()
  if (existing && existing.source_hash === sourceHash && !force) {
    return NextResponse.json({ scenarios: existing.scenarios, generated_at: existing.generated_at, cached: true })
  }

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um enfermeiro especialista a preparar protocolos de emergência DOMÉSTICOS para o cuidador familiar de uma pessoa específica. Cada cenário tem de ser ESPECÍFICO às condições e medicação REAIS desta pessoa — nunca genérico. Linguagem simples, passos numerados, ação imediata clara.

Responde APENAS com JSON válido, sem markdown, em português PT-PT.

{
  "scenarios": [
    {
      "trigger": "situação concreta (ex: 'Sinais de hipoglicemia')",
      "signs": ["sinal 1", "sinal 2", "sinal 3"],
      "immediate_action": "o que fazer AGORA, passo a passo, numerado dentro do texto",
      "when_to_call_112": "critério claro de quando ligar 112 em vez de só vigiar",
      "relevant_medication": "o medicamento/condição real desta pessoa que torna este cenário relevante"
    }
  ],
  "disclaimer": "aviso curto: apoio de orientação, não substitui 112 em emergência real"
}

Gera 3 a 5 cenários — só os REALMENTE relevantes para a medicação/condições desta pessoa (não inventes cenários genéricos sem ligação aos dados dados).`,
    },
    {
      role: 'user',
      content: `Pessoa: ${prof.name}${prof.age ? `, ${prof.age} anos` : ''}.
Condições: ${prof.conditions || 'nenhuma registada'}.
Alergias: ${prof.allergies || 'nenhuma registada'}.
Medicação atual: ${medNames.length ? medNames.join(', ') : 'nenhuma registada'}.`,
    },
  ], { maxTokens: 1200, temperature: 0.3 })

  const scenarios = result?.scenarios || []
  const row = { user_id: userId, profile_id: profileId, source_hash: sourceHash, scenarios, generated_at: new Date().toISOString() }
  if (existing) {
    await supabase.from('family_crisis_playbooks').update(row).eq('id', existing.id)
  } else {
    await supabase.from('family_crisis_playbooks').insert(row)
  }

  return NextResponse.json({ scenarios, disclaimer: result?.disclaimer, generated_at: row.generated_at, cached: false })
}
