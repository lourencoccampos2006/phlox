import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan, userId } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('cases', plan)

  const body = await req.json().catch(() => null)
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'Mensagens obrigatórias' }, { status: 400 })
  }

  const { messages, patientContext } = body
  const isPro = plan === 'pro' || plan === 'clinic'

  // Build patient context string
  let patientStr = ''
  if (patientContext?.meds?.length > 0) {
    patientStr += `\n\nMEDICAMENTOS DO UTILIZADOR:\n${patientContext.meds.map((m: any) => `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}`).join('\n')}`
  }
  if (patientContext?.history?.length > 0) {
    const recentSearches = patientContext.history.slice(0, 5)
    patientStr += `\n\nPESQUISAS RECENTES:\n${recentSearches.map((h: any) => `- ${h.query}${h.result_severity ? ` (${h.result_severity})` : ''}`).join('\n')}`
  }

  const systemPrompt = `És o Phlox AI — um farmacologista clínico especializado a trabalhar para utilizadores em Portugal.

IDENTIDADE:
- És um farmacologista clínico com profundo conhecimento em farmacoterapia, interações medicamentosas, farmacocinética e guidelines clínicas
- Respondes em português europeu (PT-PT), de forma clara e clinicamente precisa
- Não és um chatbot genérico — és especializado em farmacologia clínica
- Nível de detalhe adaptado ao utilizador: se faz perguntas técnicas, responde tecnicamente; se é leigo, simplifica

CONTEXTO DO UTILIZADOR:${patientStr || '\nUtilizador sem medicamentos registados.'}
Plano: ${plan}${isPro ? ' (Pro — acesso a protocolo terapêutico e análise avançada)' : ''}

REGRAS DE RESPOSTA:
1. Sê directo e útil. Não começas com "Como posso ajudar" nem terminas com "Qualquer dúvida estou aqui"
2. Quando analisas medicamentos, estrutura a resposta: problema identificado → mecanismo → risco → recomendação
3. Usa **negrito** para nomes de fármacos e termos clínicos importantes
4. Quando não tens dados suficientes, PERGUNTA — "Qual o peso? Tem insuficiência renal? Que dose toma?"
5. Cita as fontes quando relevante: RxNorm, guidelines ESC/ADA/DGS, Micromedex
6. NUNCA dizes "consulte um médico" como única resposta — dás a informação clínica E depois referes que deve confirmar
7. Se a pergunta envolve uma emergência (overdose, reação grave), indica imediatamente o 112/Centro de Informação Antivenenos (808 250 143)
8. Máximo 400 palavras por resposta — sê denso e útil, não verboso

FORMATO:
- Usa parágrafos curtos e listas quando apropriado
- Para interações: GRAVIDADE → Mecanismo → Consequências → O que fazer
- Para dúvidas de dose: Dose padrão → Ajuste necessário → Monitorização
- Para questões gerais: Resposta directa → Contexto clínico → Acção recomendada`

  // Build thinking prompt to extract reasoning
  const thinkingMessages = [
    { role: 'system' as const, content: `Antes de responder ao utilizador, pensa em voz alta sobre: que medicamentos estão envolvidos, que interações ou problemas existem, que guidelines são relevantes, que informação adicional precisas. Máximo 3 frases de raciocínio. Sê técnico e conciso.` },
    ...messages.slice(-6).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  try {
    // Run thinking and response in parallel for speed
    const [thinkingRes, responseRes] = await Promise.allSettled([
      // Thinking trace
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: thinkingMessages,
        temperature: 0.1,
        max_tokens: 150,
      }),
      // Main response
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    ])

    const thinking = thinkingRes.status === 'fulfilled'
      ? thinkingRes.value.choices[0]?.message?.content?.trim()
      : undefined

    if (responseRes.status === 'rejected') throw new Error('Groq failed')
    const response = responseRes.value.choices[0]?.message?.content?.trim() || ''

    // Detect sources used in response
    const sources: string[] = []
    if (response.toLowerCase().includes('rxnorm') || response.toLowerCase().includes('nih')) sources.push('RxNorm/NIH')
    if (response.toLowerCase().includes('esc') || response.toLowerCase().includes('guideline')) sources.push('Guidelines ESC')
    if (response.toLowerCase().includes('ada') || response.toLowerCase().includes('diabetes')) sources.push('ADA 2024')
    if (response.toLowerCase().includes('fda') || response.toLowerCase().includes('openfda')) sources.push('OpenFDA')
    if (response.toLowerCase().includes('beers') || response.toLowerCase().includes('stopp')) sources.push('Critérios Beers')
    if (patientContext?.meds?.length > 0) sources.push('Perfil do utilizador')

    // Detect suggested actions
    const actions: { label: string; href?: string; prompt?: string }[] = []
    if (response.toLowerCase().includes('interação') || response.toLowerCase().includes('interaçã')) {
      actions.push({ label: 'Verificar no verificador de interações', href: '/interactions' })
    }
    if (response.toLowerCase().includes('dose renal') || response.toLowerCase().includes('insuficiência renal')) {
      actions.push({ label: 'Calcular ajuste de dose renal', href: '/calculators' })
    }
    if (response.toLowerCase().includes('compatibilidade') || response.toLowerCase().includes('soro')) {
      actions.push({ label: 'Verificar compatibilidade IV', href: '/compatibility' })
    }

    return NextResponse.json({ response, thinking, sources, actions })

  } catch (err: any) {
    console.error('AI route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao processar. Tenta novamente.' }, { status: 500 })
  }
}