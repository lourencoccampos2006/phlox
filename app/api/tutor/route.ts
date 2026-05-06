import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

type Phase = 'intro' | 'exploration' | 'deepening' | 'consolidation' | 'complete'
type MsgType = 'question' | 'feedback_good' | 'feedback_correct' | 'hint' | 'explanation' | 'summary'

function getPhase(exchanges: number): Phase {
  if (exchanges === 0) return 'intro'
  if (exchanges <= 3) return 'exploration'
  if (exchanges <= 6) return 'deepening'
  if (exchanges <= 8) return 'consolidation'
  return 'complete'
}

const DOMAIN_CONTEXT: Record<string, string> = {
  farmacologia: 'farmacologista clínico especialista em farmacologia aplicada',
  medicina_interna: 'internista especialista em medicina interna',
  emergencia: 'especialista em medicina de emergência',
  cirurgia: 'cirurgião com experiência em ensino',
  pediatria: 'pediatra especialista',
  gineco_obstetricia: 'ginecologista-obstetra',
  anatomia_fisiologia: 'professor de anatomia e fisiologia',
  semiologia: 'clínico especialista em semiologia',
  enfermagem: 'enfermeiro especialista e professor',
  nutricao: 'nutricionista clínico especialista',
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 30, 60_000).allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox AI Tutor')

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { action, topic, domain, messages = [], exchangeCount = 0, studentAnswer } = body
  const domainCtx = DOMAIN_CONTEXT[domain || 'farmacologia'] || DOMAIN_CONTEXT.farmacologia
  const phase = getPhase(exchangeCount)

  const SYSTEM_PROMPT = `És um ${domainCtx} e tutor universitário socrático experiente. O teu papel é guiar o raciocínio do estudante — NÃO dar respostas directas.

MÉTODO SOCRÁTICO:
- Faz perguntas abertas que activem o pensamento crítico
- Quando o estudante erra, não corriges directamente — fazes uma pergunta que o leve a perceber o erro
- Quando o estudante acerta, elogias brevemente e aprofundas com a próxima pergunta
- Revelar a resposta só nas fases finais ou quando o estudante está completamente bloqueado (depois de 2 tentativas)

FASES DA SESSÃO (${exchangeCount} trocas completadas, fase actual: ${phase}):
- intro (0 trocas): Pergunta o que o estudante já sabe sobre o tema. Uma única pergunta aberta.
- exploration (1-3 trocas): Explora os conceitos fundamentais com perguntas progressivas
- deepening (4-6 trocas): Aprofunda com casos clínicos, excepções, aplicação prática
- consolidation (7-8 trocas): Sintetiza e consolida. Faz uma última pergunta de integração.
- complete (9+ trocas): Dá um resumo final dos pontos-chave e avalia o desempenho com score 0-100

AVALIAÇÃO: Em cada resposta do estudante, avalia a qualidade do raciocínio (0-10 pontos).

RESPONDE SEMPRE EM JSON:
{
  "message": "a tua resposta como tutor (em PT-PT, máx 200 palavras)",
  "type": "question|feedback_good|feedback_correct|hint|explanation|summary",
  "phase": "${phase}",
  "score": 0-10
}

Tipos:
- question: quando fazes uma pergunta socrática
- feedback_good: quando o estudante acertou (breve elogio + próxima pergunta)
- feedback_correct: quando está parcialmente correcto
- hint: quando dás uma pista sem revelar a resposta
- explanation: quando explicas directamente (usar com moderação)
- summary: só na fase complete — resumo final com avaliação

Tópico desta sessão: "${topic}" (domínio: ${domain || 'farmacologia'})`

  try {
    let userContent: string

    if (action === 'start') {
      userContent = `Inicia uma sessão socrática sobre "${topic}". Começa com uma pergunta que active o conhecimento prévio do estudante.`
    } else {
      const historyStr = (messages as any[])
        .slice(-8) // last 8 messages for context
        .map((m: any) => `${m.role === 'tutor' ? 'TUTOR' : 'ESTUDANTE'}: ${m.content}`)
        .join('\n')
      userContent = `Histórico:\n${historyStr}\n\nÚltima resposta do estudante: "${studentAnswer}"\n\nResponde como tutor socrático para a fase ${phase}.`
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const raw = completion.choices[0].message.content || ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Resposta inválida')

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      message: parsed.message || 'Continua o teu raciocínio...',
      type: (parsed.type as MsgType) || 'question',
      phase: getPhase(exchangeCount + 1),
      score: Math.min(10, Math.max(0, parseInt(parsed.score) || 5)),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 })
  }
}