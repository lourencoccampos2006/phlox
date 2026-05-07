import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

const DOMAIN_CTX: Record<string, string> = {
  farmacologia: 'farmacologia clínica — mecanismos, interações, efeitos adversos, decisão terapêutica',
  medicina_interna: 'medicina interna — diagnóstico diferencial, fisiopatologia, guidelines',
  emergencia: 'medicina de emergência — algoritmos ACLS/ATLS, reconhecimento, tratamento imediato',
  cirurgia: 'cirurgia geral — indicações, complicações, peri-operatório',
  pediatria: 'pediatria — especificidades pediátricas, doses, desenvolvimento',
  gineco_obstetricia: 'ginecologia e obstetrícia — gravidez, patologia, tratamento',
  enfermagem: 'enfermagem clínica — avaliação, técnicas, protocolos, escalas',
  nutricao: 'nutrição clínica — avaliação nutricional, suporte, dietas terapêuticas',
  anatomia_fisiologia: 'anatomia e fisiologia — estrutura, função, relações clínicas',
  semiologia: 'semiologia — exame físico, sinais, diagnóstico diferencial',
}

const DIFF_INST: Record<string, string> = {
  facil: 'caso clássico directo — estudante de 2º ano consegue responder',
  medio: 'caso com comorbilidade — requer raciocínio clínico',
  dificil: 'caso atípico — nível de interno',
  especialista: 'caso raro ou complexo — nível de especialista',
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 20, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Arena')

  const body = await req.json().catch(() => ({}))
  const domain = body?.domain || 'farmacologia'
  const difficulty = body?.difficulty || 'medio'
  const ctx = DOMAIN_CTX[domain] || DOMAIN_CTX.farmacologia

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `Crias casos clínicos para a Phlox Arena — competição de conhecimento para estudantes de saúde. Nível: ${DIFF_INST[difficulty] || DIFF_INST.medio}. Área: ${ctx}. Responde APENAS com JSON válido sem markdown, em português PT-PT.

{
  "title": "título breve do caso (máx 8 palavras)",
  "presentation": "apresentação clínica concisa e realista (2-3 frases com dados concretos)",
  "question": "pergunta clínica directa — o que escolhes?",
  "options": [
    { "label": "opção A concisa", "is_correct": false, "explanation": "porquê errada — 1 frase" },
    { "label": "opção B concisa", "is_correct": true, "explanation": "porquê correcta — fundamentação" },
    { "label": "opção C concisa", "is_correct": false, "explanation": "porquê errada — 1 frase" },
    { "label": "opção D concisa", "is_correct": false, "explanation": "porquê errada — 1 frase" }
  ],
  "learning_point": "pearl clínico específico e memorável — 1 frase",
  "reference": "guideline ou fonte (ex: ESC 2023, DGS, UpToDate)"
}

Exactamente 4 opções, exactamente 1 correcta, plausíveis. Língua: português PT-PT.`,
    },
    { role: 'user', content: `Gera um caso de ${ctx}, dificuldade: ${difficulty}` },
  ], { maxTokens: 1000, temperature: 0.6 })

  // Save to Supabase using the user's token
  const id = crypto.randomUUID()
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (token && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const { data } = await sb.from('arena_challenges').insert({
        id, title: result.title, domain, difficulty,
        case_data: JSON.stringify(result), active: true,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      }).select().single()
      if (data) return NextResponse.json({ id: data.id, ...result, domain, difficulty })
    }
  } catch {}

  // If save fails, return without DB id (still playable)
  return NextResponse.json({ id, ...result, domain, difficulty })
}