// app/api/study/note-capture/route.ts
// Captura sem fricção: foto de um quadro/slide/apontamentos → nota estruturada.
// A IA faz OCR + organiza em markdown clínico limpo. 0 segundos a formatar.
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'Captura de notas por foto')

  const body = await req.json().catch(() => null) as { image?: string; mimeType?: string } | null
  if (!body?.image) return NextResponse.json({ error: 'image obrigatória' }, { status: 400 })

  try {
    const res = await callGeminiVisionJSON<{ title: string; domain: string; body: string }>(
      `És um estudante de ciências da saúde a tirar apontamentos. Esta foto é de um quadro, slide, livro ou apontamentos manuscritos.
Lê TODO o texto e organiza num apontamento limpo em markdown PT-PT.
- "title": título curto e claro do tema (máx 8 palavras).
- "domain": um de: farmacologia, cardiologia, medicina_interna, clinico, microbiologia, anatomia, fisiologia, estudo. Escolhe o mais adequado.
- "body": markdown bem estruturado (secções com ##, listas com -, **negrito** em termos-chave). Corrige erros óbvios de OCR. NÃO inventes conteúdo que não esteja na imagem. Se houver fórmulas/valores, preserva-os.
Responde APENAS JSON: { "title": "...", "domain": "...", "body": "..." }`,
      body.image,
      body.mimeType || 'image/jpeg',
      { maxTokens: 2000 }
    )
    if (!res?.body) throw new Error('Não consegui ler a imagem. Tenta uma foto mais nítida.')
    return NextResponse.json({ note: res })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha na captura' }, { status: 500 })
  }
}
