// app/api/voice-log/transcribe/route.ts
// Passo 1 de 3 do "Regista falando" (institucional): recebe o áudio gravado
// no browser (base64), devolve só a TRANSCRIÇÃO em texto — nada é
// interpretado nem gravado aqui. O utilizador vê e pode corrigir o texto
// antes de continuar (app/api/voice-log/extract) — nunca se salta direto do
// áudio para a BD. Reutiliza transcribeAudio() já usado por
// /api/study/transcribe (Gravar aula/consulta) — mesma convenção (base64 +
// mimeType), não uma segunda implementação.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { transcribeAudio } from '@/lib/ai'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Registo por voz')

  const body = await req.json().catch(() => null) as { audio?: string; mimeType?: string } | null
  if (!body?.audio) return NextResponse.json({ error: 'Áudio em falta.' }, { status: 400 })
  if (body.audio.length > 20 * 1024 * 1024) return NextResponse.json({ error: 'Gravação demasiado longa.' }, { status: 413 })

  // Gravações curtas (≤60s, ver MAX_RECORD_MS no componente) numa sala
  // possivelmente ruidosa, com vocabulário institucional específico — aqui
  // rigor importa mais que velocidade, por isso o modelo completo (não o
  // turbo) + um vocabulário de arranque que ajuda o Whisper a não confundir
  // termos de cuidados/medicação com palavras parecidas mas erradas.
  const CARE_VOCAB = 'medicação, comprimido, insulina, tensão arterial, glicemia, oxigenação, temperatura, fisioterapia, banho assistido, fralda, refeição, almoço, jantar, lanche, apetite, hidratação, enfermagem, ronda, turno, manhã, tarde, noite, recusou, suspenso, administrado'

  try {
    const text = await transcribeAudio(body.audio, body.mimeType || 'audio/webm', 'pt', { model: 'whisper-large-v3', prompt: CARE_VOCAB })
    if (!text.trim()) return NextResponse.json({ error: 'Não percebi nada na gravação — tenta falar mais perto do microfone.' }, { status: 422 })
    return NextResponse.json({ transcript: text.trim() })
  } catch (err: any) {
    console.error('[phlox:voice-log/transcribe]', err?.message)
    return NextResponse.json({ error: 'Não foi possível perceber a gravação. Tenta falar mais devagar e mais perto do microfone.' }, { status: 502 })
  }
}
