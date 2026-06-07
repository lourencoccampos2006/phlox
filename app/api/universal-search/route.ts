// app/api/universal-search/route.ts
// Pesquisa universal: interpreta linguagem natural e decide para que ferramenta
// levar o utilizador, com os parâmetros já preenchidos.
// Ex: "varfarina + ibuprofeno" → /interactions; "como tratar DPOC" → /study/biblioteca;
//     "o que é o ben-u-ron" → /medicamento.
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Catálogo de destinos que a IA pode escolher. Mantido curto e claro.
const TOOLS = `
- interactions: verificar interações entre 2+ medicamentos. param: drugs (lista). Ex: "varfarina e ibuprofeno", "posso misturar X com Y".
- medicamento: o que é um medicamento / para que serve. param: name. Ex: "o que é o ben-u-ron", "para que serve o ozempic".
- bula: explicar a bula de um medicamento. param: name.
- biblioteca: pergunta clínica geral (como tratar/diagnosticar/doses). param: question. Ex: "como tratar DPOC", "abordagem do AVC isquémico".
- labs: interpretar análises laboratoriais. param: text.
- ecg: treinar/ver ECG. (sem param)
- saude-agora: triagem de sintomas, "devo ir ao médico". param: complaint.
- calculadoras: scores/doses (SCORE2, CKD-EPI, etc). (sem param)
- escalas: escalas clínicas. (sem param)
- mymeds: a minha medicação. (sem param)
- estudo: estudar um tópico (quiz/flashcards). param: topic.
`

// Mapa destino → rota + query string builder
const ROUTES: Record<string, (p: any) => string> = {
  interactions: p => `/interactions${p.drugs?.length ? `?drugs=${encodeURIComponent((p.drugs || []).join(','))}` : ''}`,
  medicamento: p => `/medicamento${p.name ? `?q=${encodeURIComponent(p.name)}` : ''}`,
  bula: p => `/bula${p.name ? `?q=${encodeURIComponent(p.name)}` : ''}`,
  biblioteca: p => `/study/biblioteca${p.question ? `?q=${encodeURIComponent(p.question)}` : ''}`,
  labs: p => `/study/lab${p.text ? `?q=${encodeURIComponent(p.text)}` : ''}`,
  ecg: () => `/study/ecg`,
  'saude-agora': p => `/saude-agora${p.complaint ? `?q=${encodeURIComponent(p.complaint)}` : ''}`,
  calculadoras: () => `/calculators/renal-dose`,
  escalas: () => `/escalas`,
  mymeds: () => `/mymeds`,
  estudo: p => `/study${p.topic ? `?topic=${encodeURIComponent(p.topic)}` : ''}`,
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as { query?: string } | null
  const query = (body?.query || '').trim().slice(0, 300)
  if (!query) return NextResponse.json({ error: 'query obrigatória' }, { status: 400 })

  try {
    const res = await aiJSON<{ tool: string; params: any; answer_hint?: string }>([
      {
        role: 'system',
        content: `És o roteador de pesquisa do Phlox (plataforma de saúde PT). Recebes o que o utilizador escreveu e escolhes a MELHOR ferramenta e extrais os parâmetros.

Ferramentas:${TOOLS}

Responde APENAS JSON: { "tool": "<id>", "params": { ... }, "answer_hint": "1 frase a dizer o que vais mostrar" }
Regras:
- Se menciona 2+ medicamentos juntos → interactions (params.drugs = lista).
- Se pergunta o que é/para que serve UM medicamento → medicamento (params.name).
- Pergunta clínica (como tratar, diagnóstico, doses, protocolo) → biblioteca (params.question = a pergunta reformulada).
- Valores de análises (números com unidades) → labs (params.text).
- Sintomas pessoais / "devo ir ao médico" → saude-agora (params.complaint).
- Em dúvida entre medicamento e pergunta clínica, escolhe biblioteca.
- Usa só ids da lista.`,
      },
      { role: 'user', content: query },
    ], { maxTokens: 400, temperature: 0 })

    const tool = res?.tool && ROUTES[res.tool] ? res.tool : 'biblioteca'
    const params = res?.params || (tool === 'biblioteca' ? { question: query } : {})
    const route = ROUTES[tool](params)
    return NextResponse.json({ tool, route, params, hint: res?.answer_hint || '' })
  } catch (e: any) {
    // Fallback: manda para a biblioteca com a query como pergunta
    return NextResponse.json({ tool: 'biblioteca', route: `/study/biblioteca?q=${encodeURIComponent(query)}`, params: { question: query }, hint: '' })
  }
}
