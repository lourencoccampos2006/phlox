import { NextRequest, NextResponse } from 'next/server'
import { aiJSON, callGeminiVisionJSON } from '@/lib/ai'
import { resolveDrugName } from '@/lib/drugNames'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// "O que é este medicamento?" — explicação simples e CONSISTENTE.
//
// 2026-06-01: refeito com:
//  • Necessidade de receita por DOSE (Ben-u-ron, Brufen, omeprazol, …)
//  • prescription_note com o limiar específico
//  • fallback_advice quando confiança baixa
//  • Anti-alucinação reforçada

const SCHEMA = `{
  "identified": "nome comercial reconhecido (ou o princípio ativo se foi esse o input)",
  "active": "princípio ativo (DCI) — string única e correta",
  "what_it_is": "classe terapêutica explicada em 1 frase simples (ex: 'um anti-inflamatório que alivia dores e baixa a febre')",
  "what_it_treats": ["indicação concreta e correta — máximo 5"],
  "symptoms": ["sintoma típico para que é usado — máximo 5"],
  "how_to_take": "como se costuma tomar, linguagem simples",
  "prescription": "sem receita | com receita médica | com receita médica especial | depende da dose",
  "prescription_note": "1 frase a explicar (sobretudo quando 'depende da dose'). Exemplos:
    • Paracetamol até 1 g unidose (Ben-u-ron 500/1000 mg) — MNSRM (sem receita).
    • Ibuprofeno 200 ou 400 mg — MNSRM. 600 mg e 800 mg — sujeito a receita.
    • Omeprazol 20 mg em embalagens ≤14 cápsulas — MNSRM. >14 cápsulas ou 40 mg — receita.
    • Diclofenac sódico 12.5/25 mg — MNSRM. ≥50 mg — receita.
    • Loratadina/cetirizina 10 mg — MNSRM.
    • Antibióticos, antidepressivos, ansiolíticos, opioides, insulina, antidiabéticos — TODOS receita.
    Se a dose for indicada, usa 'sem receita' ou 'com receita médica' conforme aplicável.
    Se NÃO sabes a dose, usa 'depende da dose' e explica claramente o limiar.",
  "common_side_effects": ["efeito secundário comum"],
  "cautions": ["cuidado importante"],
  "avoid_if": ["situação em que não deve tomar sem falar com médico"],
  "good_to_know": "dica prática (1 frase, opcional)",
  "confidence": "alta | media | baixa",
  "fallback_advice": "SÓ se confidence='baixa'. Sugere 'Tira foto à BULA (com o texto técnico) em /bula — o motor de bula tem maior precisão' ou 'Pede ajuda ao farmacêutico'."
}`

const RULES = `REGRAS CRÍTICAS (a tua resposta tem de ser factualmente correta):
- Baseia-te SÓ no princípio ativo. Identifica primeiro a substância ativa (DCI) e responde a partir dela — é a substância que determina para que serve, NÃO o nome comercial.
- Se NÃO tiveres a certeza absoluta de qual é o medicamento ou a sua substância ativa: confidence="baixa", NÃO inventes indicações ("what_it_treats" pode ficar vazio), e preenche "fallback_advice". É MUITO melhor admitir incerteza do que indicar uma utilização errada.
- NUNCA adivinhes a indicação a partir do som/nome do medicamento.
- "what_it_treats" tem de corresponder às indicações reais e aprovadas da substância ativa em Portugal (Infomed/folheto).
- Linguagem de quem fala com um familiar, simples, PT-PT, sem jargão por explicar.
- Para a prescrição: sê PRECISO com o limiar da dose. Se há dose indicada no input, decide MNSRM/RX. Se não há, usa "depende da dose" e explica.
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
      // ── FOTO: visão lê a caixa inteira ──
      const prompt = `És um farmacêutico português. Esta é a foto de uma embalagem de medicamento.
Lê com atenção TODO o texto visível: nome comercial, dosagem (em mg/g/UI/mcg), e sobretudo a SUBSTÂNCIA ATIVA / princípio ativo (geralmente em letras pequenas). A substância ativa é o que determina para que serve.
Se a caixa estiver ilegível ou não for um medicamento, devolve confidence="baixa" e deixa "what_it_treats" vazio.

Explica para uma pessoa sem formação clínica. ${RULES}

Esquema:
${SCHEMA}`
      result = await callGeminiVisionJSON<any>(prompt, image, mimeType, { maxTokens: 1400 })
    } else {
      // ── NOME ou PRINCÍPIO ATIVO: resolve marca→DCI localmente como pista ──
      const resolved = resolveDrugName(name)
      const hint = resolved
        ? `\n\nPista (base local PT): o nome "${name}" corresponde provavelmente ao princípio ativo "${resolved.dci}". Confirma com o teu conhecimento; se não bater certo, ignora a pista.`
        : ''
      result = await aiJSON<any>([
        { role: 'system', content: `És um farmacêutico português que explica medicamentos a pessoas sem formação clínica, com rigor factual.\n\n${RULES}\n\nEsquema:\n${SCHEMA}` },
        { role: 'user', content: `Medicamento ou princípio ativo: "${name}".${hint}\n\nIdentifica o princípio ativo e explica a partir dele. Se a dose está indicada no nome, usa-a para decidir a prescrição.` },
      ], { maxTokens: 1300, temperature: 0 })
    }

    if (!result || typeof result !== 'object') throw new Error('Resposta inválida')

    // Garante fallback_advice quando confidence baixa
    if (result.confidence === 'baixa' && !result.fallback_advice) {
      result.fallback_advice = 'Não tenho a certeza absoluta sobre este medicamento. Em vez disso, tira foto à BULA (texto técnico) em /bula — esse motor é mais preciso. Em alternativa, pede ajuda ao teu farmacêutico.'
    }

    return NextResponse.json({
      ...result,
      queried: name || result.identified || '',
      disclaimer: 'Informação geral de apoio — confirma sempre com o teu farmacêutico ou médico.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Não foi possível. Tenta com o nome escrito ou uma foto mais nítida.' }, { status: 500 })
  }
}
