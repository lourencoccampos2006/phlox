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
import { makeSupabase, getToken } from '@/lib/orgAuth'

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
    meds?: { name: string; dose?: string; frequency?: string }[]
  } | null
  if (!body) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })

  const supabase = makeSupabase(token)

  // BUG CORRIGIDO 2026-08-07: /patients/[id] chama esta rota sem profileId/
  // profileType (só envia name/age/sex/conditions/allergies/meds) — por isso
  // caía sempre no ramo "else" e ia buscar `personal_meds` DO PROFISSIONAL
  // LOGADO, não do utente que estava a ver. O resumo "clínico" do utente
  // ficava a descrever a medicação PESSOAL de quem estava a gerar o resumo —
  // dados de uma pessoa completamente diferente, sem qualquer relação com o
  // utente na ficha. Isto explicava a alucinação reportada (varfarina,
  // diazepam, enoxaparina, clindamicina — nada disto do utente em causa).
  // Correção: se o cliente já enviou a medicação (o caso real e único hoje —
  // já veio de patient_meds ao carregar a ficha), usa-a diretamente em vez de
  // voltar a inferir a fonte por profileType. profileId/profileType ficam
  // como veio de trás, para outros pontos de entrada que ainda não enviem meds.
  let meds: { name: string; dose?: string; frequency?: string }[] = []
  if (Array.isArray(body.meds)) {
    meds = body.meds
  } else {
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
  }

  const demo = [
    body.age ? `${body.age} anos` : null,
    body.sex === 'M' ? 'masculino' : body.sex === 'F' ? 'feminino' : null,
    body.conditions ? `condições: ${body.conditions}` : null,
    body.allergies ? `alergias: ${body.allergies}` : null,
  ].filter(Boolean).join(' · ') || 'sem dados demográficos registados'

  const medNames = meds.map(m => m.name).filter(Boolean)
  const medsLine = meds.length
    ? meds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`).join('; ')
    : 'sem medicação registada'

  // BUG CORRIGIDO 2026-08-07: o resumo clínico alucinava interações/efeitos de
  // medicamentos que a pessoa não toma (ex: varfarina, diazepam, enoxaparina,
  // clindamicina numa pessoa só com aspirina+alprazolam) — o modelo, ao ser
  // pedido para "listar interações possíveis", puxava dos pares mais comuns do
  // seu treino em vez de se limitar à lista real. A correção não pode ser só
  // "pede-se com mais educação" (o prompt já dizia "não inventes"): dá-se ao
  // modelo a lista EXATA de pares permitidos (calculados aqui, não por ele) e
  // proíbe-se explicitamente qualquer nome de fármaco fora da lista — reduz o
  // espaço de geração em vez de confiar em obediência ao prompt.
  const pairs: string[] = []
  for (let i = 0; i < medNames.length; i++) {
    for (let j = i + 1; j < medNames.length; j++) pairs.push(`${medNames[i]} + ${medNames[j]}`)
  }
  const interactionRule = medNames.length < 2
    ? `Esta pessoa toma ${medNames.length} medicamento(s) — é IMPOSSÍVEL haver interação medicamentosa. O campo "interactions" TEM DE ficar vazio: [].`
    : `Os ÚNICOS pares sobre os quais podes comentar em "interactions" são exatamente estes: ${pairs.join(' | ')}. Nenhum outro par, nenhum outro medicamento.`

  try {
    const summary = await aiJSON<PatientSummary>([
      {
        role: 'system',
        content: `És o Phlox, assistente clínico em PT-PT. Geras um RESUMO CLÍNICO breve e útil de uma pessoa, para um profissional/cuidador ler em segundos. Não prescreves.
REGRA ABSOLUTA E INEGOCIÁVEL: a lista de medicação abaixo é EXAUSTIVA — é a ÚNICA medicação real desta pessoa: ${medNames.length ? medNames.join(', ') : '(nenhuma)'}. É PROIBIDO nomear, mencionar ou referir — em "overview", "watch_for", "interactions" ou "suggestions" — qualquer medicamento, princípio ativo ou classe farmacológica que não esteja NESTA LISTA EXATA, mesmo como exemplo hipotético ou "a confirmar". Mencionar um medicamento que a pessoa não toma é um ERRO GRAVE, não uma cautela razoável. ${interactionRule} Não inventes diagnósticos nem doses.
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
        content: `Pessoa: ${body.name || 'Sem nome'}\nDemografia: ${demo}\nMedicação (lista exaustiva, nada fora disto): ${medsLine}\n\nGera o resumo clínico.`,
      },
    ], { maxTokens: 700, temperature: 0 })

    // Rede de segurança determinística: com <2 medicamentos é matematicamente
    // impossível haver interação — força vazio independentemente do que o
    // modelo devolveu, em vez de confiar só na instrução do prompt.
    if (medNames.length < 2) summary.interactions = []

    return NextResponse.json({ ...summary, meds_count: meds.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha ao gerar resumo' }, { status: 500 })
  }
}
