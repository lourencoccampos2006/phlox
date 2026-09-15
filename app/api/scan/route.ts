// app/api/scan/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Decifrar — uma foto de qualquer papel de saúde, explicado em português
// simples.
//
// Reescrito 2026-09-15. A versão anterior devolvia um resumo de 2-5 frases e
// pouco mais. Isso responde a "o que é isto?" e deixa por responder tudo o
// resto — que é onde está o trabalho de quem recebe um relatório do hospital:
// o que quer dizer aquela palavra, o que é que importa, o que pergunto ao
// médico, o que faço a seguir.
//
// Agora devolve um documento decifrado: o essencial em duas linhas, os pontos
// que importam, um glossário dos termos que lá estão, as secções do relatório
// reescritas, perguntas para levar à consulta e os passos seguintes.
//
// A IA é a de qualidade (`qualidade: true` → Claude primeiro). Num relatório
// médico, ler mal uma frase não é um defeito de estilo.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON, aiJSON } from '@/lib/ai'
import { getIP, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { enforceDailyLimit } from '@/lib/serverLimit'

export const maxDuration = 120

const PROMPT = `És um médico português a explicar um documento de saúde à pessoa a quem ele pertence — não a outro médico. Escreves em português europeu, simples, sem jargão, e sem nunca inventar.

PRIMEIRO identifica o que é o documento. DEPOIS decifra-o por inteiro.

Tipos (kind):
- "receita": receita médica → extrai os medicamentos, como se tomam e para que servem.
- "medicamento": caixa/embalagem → identifica, explica para que é e o essencial de segurança.
- "analise": análises ao sangue/urina/exames laboratoriais → interpreta cada valor.
- "relatorio": relatório, carta médica, alta hospitalar, resultado de exame de imagem → reescreve em linguagem simples, secção a secção.
- "bula": folheto informativo → explica o principal.
- "outro": outra coisa de saúde.
- "nao_saude": não tem a ver com saúde.

Responde APENAS JSON válido:
{
  "kind": "<um dos acima>",
  "title": "o que é este documento, em 3-6 palavras",
  "emDuasLinhas": "o essencial, como se explicasses a um amigo ao telefone. Duas frases, no máximo três. Sem jargão nenhum.",
  "oQueImporta": ["o que uma pessoa precisa mesmo de reter, uma ideia por linha, no máximo 5"],
  "termos": [{ "termo": "a palavra difícil tal como aparece no documento", "simples": "o que quer dizer, numa frase" }],
  "secoes": [{ "titulo": "o nome da secção do documento", "texto": "o que ela diz, reescrito em simples" }],
  "meds": [{ "name": "...", "dose": "...", "frequency": "...", "paraQue": "para que serve, em poucas palavras" }],
  "values": [{ "name": "...", "value": "...", "unit": "...", "reference": "...", "status": "normal|baixo|alto", "note": "o que significa ESTE valor nesta pessoa" }],
  "perguntasParaOMedico": ["perguntas concretas para levar à próxima consulta, no máximo 4"],
  "aSeguir": ["o que fazer a seguir, em passos concretos, no máximo 4"],
  "warning": "só se houver algo que precise de atenção médica sem demora",
  "legibilidade": "se a foto/documento estava difícil de ler, diz o quê — senão deixa vazio",
  "confidence": "alta|media|baixa"
}

REGRAS QUE NÃO SE QUEBRAM:
- Preenche só os campos que fazem sentido para o tipo. Um relatório não tem "values"; uma análise não tem "secoes".
- NUNCA dás um diagnóstico. Explicas o que o documento diz e o que as palavras significam.
- NUNCA inventas um valor, uma data ou um medicamento que não consegues ler. Se não se lê, diz em "legibilidade" e baixa a "confidence".
- "termos" é o que faz esta ferramenta valer a pena: procura as palavras que uma pessoa sem formação clínica não perceberia e explica-as. Entre 3 e 8, se as houver.
- Não repitas o "emDuasLinhas" dentro do "oQueImporta".
- Não escreves "consulte o seu médico" em todo o lado: isso já está dito na aplicação. Diz antes O QUE perguntar.`

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const gate = await enforceDailyLimit(req, 'scan')
  if (!gate.ok) return gate.response!

  const body = await req.json().catch(() => null) as { image?: string; mimeType?: string; text?: string } | null
  if (!body?.image && !body?.text) return NextResponse.json({ error: 'Imagem ou documento obrigatório' }, { status: 400 })

  try {
    let res: any
    if (body.image) {
      res = await callGeminiVisionJSON<any>(
        `${PROMPT}\n\nO que se segue é UMA FOTO de um documento.`,
        body.image, body.mimeType || 'image/jpeg',
        { maxTokens: 3000, qualidade: true },
      )
    } else {
      res = await aiJSON<any>([
        { role: 'system', content: PROMPT },
        { role: 'user', content: `Documento:\n${(body.text || '').slice(0, 24000)}` },
      ], { maxTokens: 3000, qualidade: true })
    }
    if (!res || !res.kind) throw new Error('Não consegui interpretar.')
    return NextResponse.json(res)
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Não consegui ler. Tenta com mais luz, sem sombra e com o papel direito.' },
      { status: 500 },
    )
  }
}
