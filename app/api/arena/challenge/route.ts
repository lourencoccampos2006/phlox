import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

const DOMAIN_CTX: Record<string, string> = {
  farmacologia: 'farmacologia clínica — mecanismos, interações, efeitos adversos, decisão terapêutica',
  medicina_interna: 'medicina interna — diagnóstico diferencial, fisiopatologia, guidelines',
  emergencia: 'medicina de emergência — algoritmos ACLS/ATLS, reconhecimento, tratamento imediato',
  cirurgia: 'cirurgia — indicações, complicações, peri-operatório',
  pediatria: 'pediatria — especificidades pediátricas, doses, desenvolvimento',
  gineco_obstetricia: 'ginecologia e obstetrícia — gravidez, patologia, tratamento',
  enfermagem: 'enfermagem clínica — avaliação, técnicas, protocolos, escalas',
  nutricao: 'nutrição clínica — avaliação nutricional, suporte, dietas terapêuticas',
  anatomia_fisiologia: 'anatomia e fisiologia — estrutura, função, relações clínicas',
  semiologia: 'semiologia — exame físico, sinais, diagnóstico diferencial',
}

const DIFF_INST: Record<string, string> = {
  facil: 'caso clássico, diagnóstico directo, estudante de 2º ano consegue responder',
  medio: 'caso com complicação ou comorbilidade, requer raciocínio clínico',
  dificil: 'caso atípico, diagnóstico diferencial exigente, nível de interno',
  especialista: 'caso raro ou complexo, múltiplas comorbilidades, nível de especialista',
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 20, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Arena')

  const body = await req.json().catch(() => null)
  const domain = body?.domain || 'farmacologia'
  const difficulty = body?.difficulty || 'medio'
  const ctx = DOMAIN_CTX[domain] || DOMAIN_CTX.farmacologia

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `Crias casos clínicos para a Phlox Arena — competição de conhecimento para estudantes de saúde. O caso deve ser ${DIFF_INST[difficulty] || DIFF_INST.medio} na área de ${ctx}. Responde APENAS com JSON válido sem markdown, em português PT-PT.

{
  "title": "título breve do caso (máx 8 palavras)",
  "presentation": "apresentação clínica concisa e realista (2-3 frases com dados concretos)",
  "question": "pergunta clínica directa de escolha múltipla — o que escolhes?",
  "options": [
    { "label": "opção A — concisa", "is_correct": false, "explanation": "porquê errada — 1 frase" },
    { "label": "opção B — concisa", "is_correct": true, "explanation": "porquê correcta — fundamentação clínica" },
    { "label": "opção C — concisa", "is_correct": false, "explanation": "porquê errada — 1 frase" },
    { "label": "opção D — concisa", "is_correct": false, "explanation": "porquê errada — 1 frase" }
  ],
  "learning_point": "pearl clínico específico que fica para sempre — 1 frase memorável",
  "reference": "guideline ou fonte (ex: ESC 2023, UpToDate, DGS)"
}

Regras:
- Exactamente 4 opções, exactamente 1 correcta
- Opções plausíveis — não pode ser óbvio
- Nível de dificuldade: ${difficulty}
- Língua: português PT-PT`,
    },
    { role: 'user', content: `Gera um caso de ${ctx}, dificuldade: ${difficulty}` },
  ], { maxTokens: 1200, temperature: 0.6 })

  // Save to Supabase
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    const { data } = await sb.from('arena_challenges').insert({
      title: result.title, domain, difficulty,
      case_data: JSON.stringify(result),
      active: true,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }).select().single()
    if (data) return NextResponse.json({ ...data, case_data: result })
  } catch {}

  return NextResponse.json({ id: crypto.randomUUID(), ...result, domain, difficulty })
}