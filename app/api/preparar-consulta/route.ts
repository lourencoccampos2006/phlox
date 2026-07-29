import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan } from '@/lib/planGate'
import { enforceDailyLimit } from '@/lib/serverLimit'
import { sb as makeSupabase } from '@/lib/orgAuth'

// "Preparar a consulta" (pessoal/família) — transforma sintomas/dúvidas numa folha
// organizada para levar ao médico: resumo, perguntas a fazer, sinais a referir.
//
// 2026-06-01: aceita recent_symptoms e recent_vitals para análise contextual.
// Sugere especialidade quando o utilizador não a indica. Identifica conexões
// possíveis entre sintomas e medicação.
//
// 2026-07-29: a API existia mas NENHUMA página lhe chamava — órfã desde que foi
// escrita. Ao construir a página (/preparar-consulta), aproveitámos para: exigir
// sessão (antes era 100% anónima, sem qualquer limite de plano), aplicar o
// limite diário do Base/Plus (Pro/Institucional sem limite, mesmo padrão do
// resto do produto), e guardar cada folha gerada em `consult_preps` para o
// utilizador poder reabrir/reimprimir antes da consulta real.

const NO_TABLE = (msg: string) =>
  /relation .*consult_preps.* does not exist|column .*does not exist/i.test(msg)

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const gate = await enforceDailyLimit(req, 'preparar_consulta')
  if (!gate.ok) return gate.response!

  const body = await req.json().catch(() => null)
  const notes = String(body?.notes || '').trim().slice(0, 1200)
  if (!notes) return NextResponse.json({ error: 'Descreve o que se passa' }, { status: 400 })
  const who = String(body?.who || '').trim().slice(0, 60)
  const meds = String(body?.meds || '').trim().slice(0, 800)
  const specialty = String(body?.specialty || '').trim().slice(0, 60)
  const profileId = body?.profile_id ? String(body.profile_id) : null
  const recentSymptoms = Array.isArray(body?.recent_symptoms) ? body.recent_symptoms.slice(0, 12).map((s: any) => String(s).slice(0, 200)) : []
  const recentVitals = Array.isArray(body?.recent_vitals) ? body.recent_vitals.slice(0, 8).map((v: any) => String(v).slice(0, 200)) : []
  const suggestSpecialty = body?.suggest_specialty === true || specialty.length === 0

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `Ajudas uma pessoa (ou um cuidador) a PREPARAR uma ida ao médico, em Portugal. Organizas o que ela escreveu numa folha clara para levar à consulta e ajudas a não esquecer nada. Linguagem simples, PT-PT. NÃO diagnosticas nem recomendas tratamento.

Responde APENAS com JSON válido (sem markdown):
{
  "summary": "resumo de 2-3 frases do motivo da consulta, em linguagem simples",
  "timeline": ["facto datado relevante (ex: 'há 1 semana começou a dor')"],
  "questions_to_ask": ["pergunta concreta e útil a fazer ao médico"],
  "symptoms_to_mention": ["sintoma/sinal importante a não esquecer de referir"],
  "to_bring": ["o que levar à consulta (ex: 'lista de medicação', 'análises recentes')"],
  "red_flags": ["sinal que, se aparecer antes da consulta, justifica ir mais cedo/urgência"],
  "possible_connections": ["conexão plausível entre o que se passa e algo registado (ex: 'a tosse seca pode estar relacionada com o ramipril', 'desidratação possível dada a furosemida + diarreia há 3 dias'). NUNCA afirma — usa 'pode', 'é possível'. NÃO inclui se não há ligação clara."]${suggestSpecialty ? ',\n  "suggested_specialty": "especialidade mais provável para esta queixa (ex: Cardiologia, Medicina Geral e Familiar, Otorrino, Dermatologia, Neurologia). Se não houver especialidade óbvia, usa Medicina Geral e Familiar."' : ''},
  "context_used": "1 frase a dizer o que do contexto foi considerado"
}

Regras:
- As perguntas devem ser as que um doente informado faria (diagnóstico, exames, opções, prognóstico, o que vigiar).
- Não dês conselho médico nem nomes de fármacos como recomendação.
- Se houver medicação atual, vê SE alguma é compatível com causa de alguns dos sintomas — coloca essas hipóteses em possible_connections com prudência.
- Adequa ao contexto (idade implícita, medicação, especialidade).`,
      },
      {
        role: 'user',
        content: `Para: ${who || 'mim'}.${specialty ? ` Especialidade indicada: ${specialty}.` : ' (sem especialidade indicada — sugere a mais adequada)'}

${meds ? `Medicação atual:\n${meds}\n` : ''}${recentSymptoms.length ? `Sintomas recentes registados:\n${recentSymptoms.map((s: string) => `- ${s}`).join('\n')}\n` : ''}${recentVitals.length ? `Medições recentes:\n${recentVitals.map((v: string) => `- ${v}`).join('\n')}\n` : ''}
O que se passa:
${notes}`,
      },
    ], { maxTokens: 1600, temperature: 0.2 })

    // Guarda o histórico (melhor esforço — se a tabela ainda não existir nesta
    // conta, ou a inserção falhar por outro motivo, a folha já gerada continua
    // a ser devolvida na mesma; só a possibilidade de a reabrir depois se perde).
    let savedId: string | null = null
    try {
      const supabase = makeSupabase(req)
      const { data } = await supabase.from('consult_preps').insert({
        user_id: userId,
        profile_id: profileId,
        specialty: specialty || result?.suggested_specialty || null,
        notes,
        result,
      }).select('id').single()
      savedId = data?.id || null
    } catch { /* não bloqueia a resposta */ }

    return NextResponse.json({ ...result, id: savedId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = makeSupabase(req)
  const profileId = req.nextUrl.searchParams.get('profile_id')

  let query = supabase.from('consult_preps').select('*').order('created_at', { ascending: false }).limit(20)
  query = profileId ? query.eq('profile_id', profileId) : query.eq('user_id', userId).is('profile_id', null)

  const { data, error } = await query
  if (error) {
    console.error('[phlox:preparar-consulta]', error.message)
    if (NO_TABLE(error.message)) return NextResponse.json({ preps: [] })
    return NextResponse.json({ error: 'Não foi possível carregar agora. Tenta de novo.' }, { status: 500 })
  }
  return NextResponse.json({ preps: data || [] })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = makeSupabase(req)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })
  await supabase.from('consult_preps').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
