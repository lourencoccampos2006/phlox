import { NextRequest, NextResponse } from 'next/server'
import { aiJSON, callGeminiVisionJSON } from '@/lib/ai'
import { resolveDrugName } from '@/lib/drugNames'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// "O que é este medicamento?" — explicação simples e CONSISTENTE.
// Estrutura única: nome, princípio ativo e foto convergem no mesmo esquema.
// Anti-alucinação: temperature 0, regras estritas, confiança honesta.

const SCHEMA = `{
  "identified": "nome comercial reconhecido (ou o princípio ativo se for esse o input)",
  "active": "princípio ativo (DCI) — string única e correta",
  "what_it_is": "classe terapêutica explicada em 1 frase simples (ex: 'um anti-inflamatório que alivia dores e baixa a febre')",
  "what_it_treats": ["indicação concreta e correta", "..."],
  "symptoms": ["sintoma típico para que é usado", "..."],
  "how_to_take": "como se costuma tomar, linguagem simples",
  "prescription": "sem receita | com receita médica | com receita médica especial",
  "common_side_effects": ["efeito secundário comum"],
  "cautions": ["cuidado importante"],
  "avoid_if": ["situação em que não deve tomar sem falar com médico"],
  "good_to_know": "dica prática (1 frase)",
  "confidence": "alta | media | baixa"
}`

const RULES = `REGRAS CRÍTICAS (a tua resposta tem de ser factualmente correta):
- Baseia-te SÓ no princípio ativo. Identifica primeiro a substância ativa (DCI) e responde a partir dela — é a substância que determina para que serve, NÃO o nome comercial.
- Se NÃO tiveres a certeza absoluta de qual é o medicamento ou a sua substância ativa: confidence="baixa", NÃO inventes indicações, e em "good_to_know" diz para confirmar na farmácia. É MUITO melhor admitir incerteza do que indicar uma utilização errada.
- NUNCA adivinhes a indicação a partir do som/nome do medicamento.
- "what_it_treats" tem de corresponder às indicações reais e aprovadas da substância ativa em Portugal (Infomed/folheto).
- Linguagem de quem fala com um familiar, simples, PT-PT, sem jargão por explicar.
- Responde APENAS com JSON válido, sem markdown.`

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.name && !body?.image) return NextResponse.json({ error: 'Nome ou foto obrigatório' }, { status: 400 })

  const name = String(body?.name || '').trim().slice(0, 120)
  const image = body?.image as string | undefined
  const mimeType = String(body?.mimeType || 'image/jpeg')

  try {
    let result: any

    if (image && !name) {
      // ── FOTO: um único passo de visão. A IA lê a caixa INTEIRA (nome, dosagem,
      //    substância ativa e indicações impressas) e responde já com o esquema. ──
      const prompt = `És um farmacêutico português. Esta é a foto de uma embalagem de medicamento.
Lê com atenção TODO o texto visível: nome comercial, dosagem, e sobretudo a SUBSTÂNCIA ATIVA / princípio ativo (geralmente em letras pequenas, ex: "ibuprofeno", "paracetamol"). A substância ativa é o que determina para que serve.
Se a caixa estiver ilegível ou não for um medicamento, devolve confidence="baixa" e deixa "what_it_treats" vazio.

Explica para uma pessoa sem formação clínica. ${RULES}

Esquema:
${SCHEMA}`
      result = await callGeminiVisionJSON<any>(prompt, image, mimeType, { maxTokens: 1200 })
    } else {
      // ── NOME ou PRINCÍPIO ATIVO: resolve marca→DCI localmente como pista, depois texto. ──
      const resolved = resolveDrugName(name)
      const hint = resolved ? `\n\nPista (base local PT): o nome "${name}" corresponde provavelmente ao princípio ativo "${resolved.dci}". Confirma com o teu conhecimento; se não bater certo, ignora a pista.` : ''
      result = await aiJSON<any>([
        { role: 'system', content: `És um farmacêutico português que explica medicamentos a pessoas sem formação clínica, com rigor factual.\n\n${RULES}\n\nEsquema:\n${SCHEMA}` },
        { role: 'user', content: `Medicamento ou princípio ativo: "${name}".${hint}\n\nIdentifica o princípio ativo e explica a partir dele.` },
      ], { maxTokens: 1100, temperature: 0 })
    }

    if (!result || typeof result !== 'object') throw new Error('Resposta inválida')
    return NextResponse.json({
      ...result,
      queried: name || result.identified || '',
      disclaimer: 'Informação geral de apoio — confirma sempre com o teu farmacêutico ou médico.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Não foi possível. Tenta com o nome escrito ou uma foto mais nítida.' }, { status: 500 })
  }
}
