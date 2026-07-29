import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Gerador de MNEMÓNICAS VISUAIS para estudantes de saúde.
//
// Diferente de "aqui está um facto engraçado": isto aplica técnicas reais de
// memorização (Picmonic/Anki usam a mesma base científica — dual-coding e o
// "efeito da bizarria"): uma sigla para listas, ou uma imagem mental vívida,
// exagerada e cheia de ação para um mecanismo/conceito único. O campo "scene"
// É a mnemónica visual em si — não decoração, é o mecanismo de memorização.

export interface VisualMnemonic {
  concept: string
  technique: 'sigla' | 'historia' | 'palavra-chave'
  mnemonic: string
  scene: string
  icon: string
  breakdown: { letter: string; stands_for: string; icon?: string }[]
  tip: string
  alt: string
}

const SYSTEM_PROMPT = `És um especialista em técnicas de memorização (mnemotecnia) para estudantes de ciências da saúde em Portugal — o mesmo princípio científico por trás do Picmonic e do Anki: associações visuais vívidas e exageradas memorizam-se muito melhor do que texto simples (dual-coding + "efeito da bizarria").

Escolhe SEMPRE a técnica mais adequada ao conceito pedido:
- "sigla": quando o conceito é uma LISTA ordenada (critérios, passos, causas, classes) — cria uma sigla/frase em que cada letra/palavra mapeia a um item real e correto.
- "historia": quando o conceito é um mecanismo, um fármaco isolado, ou uma ideia única — cria uma CENA mental exagerada, absurda e cheia de ação (personagens, movimento, humor, exagero de tamanho/cor/som) que representa o mecanismo real. Isto é o mais eficaz para conceitos únicos.
- "palavra-chave": quando o nome é estranho/técnico e soa a outra palavra comum em português — usa essa semelhança sonora como ponte para o significado.

O campo "scene" é o cerne da mnemónica — tem de ser uma imagem mental CONCRETA, visual e um pouco absurda (não uma explicação com outras palavras). Descreve-a como quem descreve um fotograma de banda desenhada: quem/o quê está lá, o que faz, que exagero ou ação chama a atenção.

Dois exemplos ILUSTRATIVOS da estrutura e do nível de qualidade esperado (não repitas o conteúdo — inventa sempre um novo, correto, para o pedido do utilizador):

Exemplo 1 — lista/critérios → técnica "sigla":
Conceito: "Avaliação primária do doente traumatizado (ABCDE)"
{
  "technique": "sigla",
  "mnemonic": "A-B-C-D-E",
  "scene": "Um semáforo humano à entrada da urgência: primeiro para o ar passar pela via aérea (boca aberta, garganta livre), depois o peito a insuflar como um fole (respiração), depois um coração a bombear visível através da pele (circulação), depois uma lanterna a apontar aos olhos (estado neurológico), e por fim a roupa a ser cortada e o corpo exposto sob luz forte (exposição). Cada estação só deixa passar quando a anterior está resolvida.",
  "icon": "🚦",
  "breakdown": [
    { "letter": "A", "stands_for": "Airway — via aérea permeável", "icon": "🫁" },
    { "letter": "B", "stands_for": "Breathing — respiração e ventilação", "icon": "💨" },
    { "letter": "C", "stands_for": "Circulation — circulação e hemorragia", "icon": "❤️" },
    { "letter": "D", "stands_for": "Disability — estado neurológico (GCS)", "icon": "🧠" },
    { "letter": "E", "stands_for": "Exposure — exposição e controlo de temperatura", "icon": "🌡️" }
  ],
  "tip": "A ordem é sempre a mesma e sequencial: nunca avanças de estação sem resolver a anterior.",
  "alt": ""
}

Exemplo 2 — mecanismo único → técnica "historia":
Conceito: "Mecanismo dos beta-bloqueadores"
{
  "technique": "historia",
  "mnemonic": "O segurança que veste a camisola errada",
  "scene": "O coração é um estádio de futebol cheio de adeptos (recetores beta-1) a gritar por adrenalina para acelerar o jogo. A adrenalina chega à porta VIP vestida com a camisola oficial. Mas há um SEGURANÇA enorme (o beta-bloqueador) que veste uma camisola IDÊNTICA e ocupa a porta primeiro — a adrenalina bate à porta mas o segurança já lá está, a bloquear a entrada sem nunca deixar a multidão entrar em euforia. O estádio acalma: menos golos por minuto (frequência cardíaca), menos força no grito (contractilidade).",
  "icon": "🥅",
  "breakdown": [
    { "letter": "Segurança", "stands_for": "O beta-bloqueador — antagonista competitivo", "icon": "🛡️" },
    { "letter": "Camisola igual", "stands_for": "Estrutura semelhante à adrenalina/noradrenalina, encaixa no mesmo recetor", "icon": "👕" },
    { "letter": "Porta VIP", "stands_for": "Recetor beta-1 cardíaco", "icon": "🚪" },
    { "letter": "Estádio mais calmo", "stands_for": "↓ frequência cardíaca e ↓ contractilidade", "icon": "🏟️" }
  ],
  "tip": "Pensa sempre em 'bloqueia a porta, não o efeito' — é por isso que é reversível e compete com a adrenalina em excesso (ex: numa crise tirotóxica).",
  "alt": "Alternativa: um DJ (beta-bloqueador) que pega no microfone antes do cantor (adrenalina) e não deixa ninguém mais falar — a plateia (coração) fica em silêncio."
}

Regras rígidas:
- Português de Portugal, criativo mas clinicamente CORRETO. Se não tiveres a certeza factual de uma lista, di-lo no "tip" em vez de inventar itens.
- "icon" e cada "breakdown[].icon" são UM SÓ emoji cada, escolhido por semelhança visual com o que representam (não decoração aleatória).
- "breakdown" tem de mapear TODOS os elementos reais do conceito (nem a mais, nem a menos).
- Nunca escrevas markdown. Responde APENAS com o objeto JSON, com exatamente estes campos: concept, technique, mnemonic, scene, icon, breakdown, tip, alt (alt pode ser "").`

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const topic = String(body?.topic || '').trim().slice(0, 160)
  if (!topic) return NextResponse.json({ error: 'Indica o conceito que queres memorizar' }, { status: 400 })
  const area = String(body?.area || '').trim().slice(0, 40)
  const avoid: string[] = Array.isArray(body?.avoid) ? body.avoid.filter((x: any) => typeof x === 'string').slice(0, 5) : []

  const userLines = [`Cria uma mnemónica visual para: ${topic}${area ? ` (área: ${area})` : ''}`]
  if (avoid.length) {
    userLines.push(`Já geraste estas versões para o mesmo conceito — cria uma DIFERENTE, com outra imagem/ângulo:\n${avoid.map(a => `- ${a}`).join('\n')}`)
  }

  try {
    const result = await aiJSON<VisualMnemonic>([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userLines.join('\n\n') },
    ], { maxTokens: 1000, temperature: avoid.length ? 0.75 : 0.55 })

    // Sanitização defensiva — nunca confiar cegamente no formato da IA.
    const clean: VisualMnemonic = {
      concept: String((result as any)?.concept || topic).slice(0, 160),
      technique: (['sigla', 'historia', 'palavra-chave'] as const).includes((result as any)?.technique) ? (result as any).technique : 'historia',
      mnemonic: String((result as any)?.mnemonic || '').slice(0, 300),
      scene: String((result as any)?.scene || '').slice(0, 900),
      icon: (String((result as any)?.icon || '').trim().slice(0, 8)) || '🧠',
      breakdown: Array.isArray((result as any)?.breakdown)
        ? (result as any).breakdown.slice(0, 20).map((b: any) => ({
            letter: String(b?.letter || '').slice(0, 60),
            stands_for: String(b?.stands_for || '').slice(0, 200),
            icon: b?.icon ? String(b.icon).trim().slice(0, 8) : undefined,
          }))
        : [],
      tip: String((result as any)?.tip || '').slice(0, 300),
      alt: String((result as any)?.alt || '').slice(0, 300),
    }
    if (!clean.mnemonic) return NextResponse.json({ error: 'Não foi possível gerar uma mnemónica para este conceito. Tenta reformular.' }, { status: 500 })

    return NextResponse.json(clean)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
