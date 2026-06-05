// app/api/study/transcribe/route.ts
// Gravar aula/consulta → nota estruturada (Pro).
//   action 'transcribe' → áudio (base64) → texto (Groq Whisper)
//   action 'structure'  → transcrição → nota clínica em markdown + título + domínio
import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio, aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse, isPlanSufficient } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPlanSufficient(plan, 'pro')) return planGateResponse('pro', 'Gravar aula/consulta')

  const body = await req.json().catch(() => null) as { action?: string; audio?: string; mimeType?: string; transcript?: string; kind?: string } | null
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  // ── Transcrever áudio ──
  if (body.action === 'transcribe') {
    if (!body.audio) return NextResponse.json({ error: 'audio obrigatório' }, { status: 400 })
    try {
      const text = await transcribeAudio(body.audio, body.mimeType || 'audio/webm', 'pt')
      return NextResponse.json({ transcript: text })
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Falha na transcrição' }, { status: 500 })
    }
  }

  // ── Estruturar transcrição em nota ──
  if (body.action === 'structure') {
    if (!body.transcript) return NextResponse.json({ error: 'transcript obrigatório' }, { status: 400 })
    const kind = body.kind === 'consulta' ? 'consulta clínica' : 'aula'
    try {
      const res = await aiJSON<{ title: string; domain: string; body: string }>([
        {
          role: 'system',
          content: `Recebes a transcrição (possivelmente com erros) de uma ${kind} de ciências da saúde, em PT-PT.
Transforma-a numa nota de estudo limpa e bem estruturada em markdown.
- "title": título curto do tema (máx 8 palavras).
- "domain": um de: farmacologia, cardiologia, medicina_interna, clinico, microbiologia, anatomia, fisiologia, estudo.
- "body": markdown organizado (## secções, listas, **negrito** nos termos-chave). Corrige erros óbvios de transcrição. Organiza por temas. Remove muletas de oralidade ("portanto", "não é", repetições). NÃO inventes conteúdo que não tenha sido dito.
${body.kind === 'consulta' ? 'Se for consulta, organiza em formato SOAP quando possível, e ANONIMIZA (sem nomes, sem nº SNS — só iniciais/idade/sexo).' : ''}
Responde APENAS JSON: { "title": "...", "domain": "...", "body": "..." }`,
        },
        { role: 'user', content: body.transcript.slice(0, 12000) },
      ], { maxTokens: 2500, temperature: 0.2 })
      if (!res?.body) throw new Error('Não consegui estruturar a transcrição.')
      return NextResponse.json({ note: res })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
