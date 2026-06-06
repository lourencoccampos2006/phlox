// app/api/study/transcribe/route.ts
// Gravar aula/consulta → nota estruturada (Pro).
//   action 'transcribe' → áudio (base64) → texto (Groq Whisper)
//   action 'structure'  → transcrição → nota clínica em markdown + título + domínio
import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio, aiComplete } from '@/lib/ai'
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
  // NÃO usamos JSON (o markdown no body parte o JSON em transcrições longas).
  // Usamos um formato com delimitadores, robusto para aulas de 1h+.
  if (body.action === 'structure') {
    if (!body.transcript) return NextResponse.json({ error: 'transcript obrigatório' }, { status: 400 })
    const kind = body.kind === 'consulta' ? 'consulta clínica' : 'aula'
    // Transcrições muito longas: corta com segurança (Whisper de 1h ~ 50-80k chars).
    const transcript = body.transcript.slice(0, 40000)
    try {
      const { text } = await aiComplete([
        {
          role: 'system',
          content: `Recebes a transcrição (com possíveis erros) de uma ${kind} de ciências da saúde, em PT-PT.
Transforma-a numa nota de estudo limpa e bem estruturada.
Corrige erros óbvios de transcrição, organiza por temas, remove muletas de oralidade ("portanto", "não é", repetições). NÃO inventes conteúdo que não tenha sido dito.
${body.kind === 'consulta' ? 'Se for consulta, organiza em SOAP e ANONIMIZA (só iniciais/idade/sexo, sem nomes/SNS).' : 'Usa secções com ##, listas com -, **negrito** nos termos-chave.'}

Responde EXACTAMENTE neste formato (sem mais nada):
TITULO: <título curto, máx 8 palavras>
DOMINIO: <um de: farmacologia, cardiologia, medicina_interna, clinico, microbiologia, anatomia, fisiologia, estudo>
---
<a nota em markdown>`,
        },
        { role: 'user', content: transcript },
      ], { maxTokens: 3000, temperature: 0.2 })

      if (!text?.trim()) throw new Error('A IA não devolveu conteúdo. Tenta novamente.')
      // Parse robusto do formato delimitado
      const titleMatch = text.match(/TITULO:\s*(.+)/i)
      const domainMatch = text.match(/DOMINIO:\s*([a-z_]+)/i)
      const sepIdx = text.indexOf('---')
      const noteBody = sepIdx >= 0 ? text.slice(sepIdx + 3).trim() : text.trim()
      const validDomains = ['farmacologia', 'cardiologia', 'medicina_interna', 'clinico', 'microbiologia', 'anatomia', 'fisiologia', 'estudo']
      const dom = (domainMatch?.[1] || '').toLowerCase()
      return NextResponse.json({
        note: {
          title: (titleMatch?.[1] || (kind === 'aula' ? 'Apontamentos de aula' : 'Nota de consulta')).trim().slice(0, 80),
          domain: validDomains.includes(dom) ? dom : 'estudo',
          body: noteBody || text.trim(),
        },
      })
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Falha ao estruturar' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
