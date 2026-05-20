import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'


export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan, userId } = await getUserPlan(req)
  // Free plan: limited to 5 messages per session (handled by rate limit)
  // All plans can use AI - Pro gets clinical patient context

  const body = await req.json().catch(() => null)
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'Mensagens obrigatórias' }, { status: 400 })
  }

  const { messages, patientContext, experienceMode } = body

  // ─── NOVO: persona da AI por modo de experiência ───
  const AI_PERSONAS: Record<string, string> = {
    clinical: `MODO: Farmacologista Clínico — Profissional de Saúde. Respondes de forma técnica e precisa usando nomenclatura DCI/INN. Referencias guidelines portuguesas e europeias por ordem de prioridade: DGS, INFARMED, SNS, depois ESC/ADA/NICE/WHO. Quando relevante, mencionas a Circular Normativa DGS ou Prontuário Terapêutico. Sugeres acções concretas: ajuste de dose, monitorização (laboratório/clínica), alternativas terapêuticas. Nunca subestimas o profissional — responde ao nível dele.`,
    student: `MODO: Tutor Socrático de Farmacologia. PRIMEIRO fazes sempre uma pergunta de raciocínio antes da resposta ("Sabes qual o receptor alvo?", "O que acontece ao CYP3A4 nesta combinação?"). Depois explicas com: 1) mecanismo molecular, 2) efeito clínico, 3) implicação prática. Usas analogias criativas para mecanismos farmacocinéticos. Terminas SEMPRE com: "Próximo tópico sugerido: [X]" e um link para /study. O objectivo é construir raciocínio, não transmitir factos.`,
    caregiver: `MODO: Conselheiro Familiar Empático. Linguagem simples — nunca jargão clínico sem explicação. Cada resposta tem: 1) o que está a acontecer em linguagem simples, 2) o que deves fazer AGORA, 3) quando ir ao médico/farmácia. Urgências reais: indica claramente "liga para o 112" ou "vai à urgência". Usa exemplos do quotidiano. O cuidador precisa de clareza para agir, não de ambiguidade.`,
    personal: `MODO: Farmacêutico Amigo. Directo e sem dramatismo. Dás a informação relevante + a recomendação prática em 3-5 frases. Quando há dúvida de segurança real, dizes "confirma com o teu farmacêutico antes de tomar" — não em vez de informar, mas depois. Sem clichés como "não sou médico" ou "consulte um profissional" como única resposta.`,
  }
  const personaText = AI_PERSONAS[experienceMode || 'personal'] || AI_PERSONAS.personal
  const isPro = plan === 'pro' || plan === 'clinic'

  // Build patient context string
  let patientStr = ''
  
  // Clinical patient context (Pro ?patient= param)
  if (patientContext?.clinicalPatient) {
    const pat = patientContext.clinicalPatient
    patientStr += `\n\nCONTEXTO CLÍNICO DO DOENTE: ${pat.name}`
    if (pat.age) patientStr += ` | ${pat.age} anos`
    if (pat.sex) patientStr += ` | ${pat.sex === 'M' ? 'Masculino' : 'Feminino'}`
    if (pat.conditions) patientStr += `\nDiagnósticos: ${pat.conditions}`
    if (pat.allergies) patientStr += `\nAlergias: ${pat.allergies}`
    if (pat.crCl) patientStr += `\nFunção renal: CrCl ${pat.crCl} mL/min (${pat.crCl < 30 ? 'DRC severa — ajustar doses' : pat.crCl < 60 ? 'DRC moderada — atenção às doses' : 'normal'})`
    if (pat.weight) patientStr += ` | Peso: ${pat.weight}kg`
  }
  
  // Family profile context (?profile= param)
  if (patientContext?.familyProfile) {
    const fp = patientContext.familyProfile
    patientStr += `\n\nPERFIL FAMILIAR: ${fp.name}`
    if (fp.age) patientStr += ` | ${fp.age} anos`
    if (fp.conditions) patientStr += `\nCondições: ${fp.conditions}`
    if (fp.allergies) patientStr += `\nAlergias: ${fp.allergies}`
    if (fp.crCl) patientStr += `\nCrCl: ${fp.crCl} mL/min`
  }
  
  if (patientContext?.meds?.length > 0) {
    patientStr += `\n\nMEDICAÇÃO ACTUAL:\n${patientContext.meds.map((m: any) => `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}${m.indication ? ` (${m.indication})` : ''}`).join('\n')}`
  }
  if (patientContext?.history?.length > 0) {
    const recentSearches = patientContext.history.slice(0, 5)
    patientStr += `\n\nPESQUISAS RECENTES:\n${recentSearches.map((h: any) => `- ${h.query}${h.result_severity ? ` (${h.result_severity})` : ''}`).join('\n')}`
  }

  const systemPrompt = `És o Phlox AI — um farmacologista clínico especializado a trabalhar para utilizadores em Portugal.

${personaText}


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
    const maxTokens = isPro ? 900 : experienceMode === 'clinical' ? 750 : 600

    // Run thinking and main response (thinking is optional, never blocks)
    const [thinkingRes, responseRes] = await Promise.allSettled([
      aiComplete(thinkingMessages, { maxTokens: 150, temperature: 0.1, preferFast: true }),
      aiComplete([
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ], { maxTokens, temperature: 0.2 }),
    ])

    const thinking = thinkingRes.status === 'fulfilled'
      ? thinkingRes.value.text.trim()
      : undefined

    if (responseRes.status === 'rejected') throw new Error('Serviço de IA indisponível. Tenta novamente.')
    const response = responseRes.value.text.trim() || ''

    // Detect sources used in response
    const rl = response.toLowerCase()
    const sources: string[] = []
    if (rl.includes('rxnorm') || rl.includes('nih')) sources.push('RxNorm/NIH')
    if (rl.includes('esc') || rl.includes('guideline')) sources.push('Guidelines ESC')
    if (rl.includes('ada') || rl.includes('diabetes')) sources.push('ADA 2024')
    if (rl.includes('fda') || rl.includes('openfda')) sources.push('OpenFDA')
    if (rl.includes('beers') || rl.includes('stopp')) sources.push('Critérios Beers/STOPP')
    if (rl.includes('dgs') || rl.includes('infarmed') || rl.includes('prontuário')) sources.push('DGS/INFARMED')
    if (rl.includes('cyp') || rl.includes('cyp3a4') || rl.includes('cyp2d6')) sources.push('CYP450')
    if (patientContext?.meds?.length > 0) sources.push('Perfil do utilizador')

    // Detect suggested actions
    const actions: { label: string; href?: string; prompt?: string }[] = []
    if (response.toLowerCase().includes('interação') || response.toLowerCase().includes('interaçã')) {
      actions.push({ label: 'Verificar no verificador de interações', href: '/interactions' })
    }
    if (response.toLowerCase().includes('dose renal') || response.toLowerCase().includes('insuficiência renal')) {
      actions.push({ label: 'Calcular ajuste de dose renal', href: '/calculators' })
    }
    if (rl.includes('compatibilidade') || rl.includes('soro')) {
      actions.push({ label: 'Verificar compatibilidade IV', href: '/compatibility' })
    }
    if (rl.includes('tensão arterial') || rl.includes('glicemia') || rl.includes('sinais vitais') || rl.includes('monitoriz')) {
      actions.push({ label: 'Registar sinais vitais', href: '/vitals' })
    }
    if (rl.includes('bula') || rl.includes('folheto informativo')) {
      actions.push({ label: 'Traduzir bula', href: '/bula' })
    }

    return NextResponse.json({ response, thinking, sources, actions })

  } catch (err: any) {
    console.error('AI route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao processar. Tenta novamente.' }, { status: 500 })
  }
}