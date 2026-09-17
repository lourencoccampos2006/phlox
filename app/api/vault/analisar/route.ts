// app/api/vault/analisar/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// A leitura a fundo de um documento guardado no cofre.
//
// ── EM QUE É QUE DIFERE DO /api/scan ───────────────────────────────────────
// O Explicar responde à pergunta de quem tem um papel na mão e não o percebe:
// rápido, o essencial, as palavras difíceis. Corta o texto aos 24 mil
// caracteres e escreve no máximo 3 mil tokens, porque uma resposta que demora
// um minuto não serve quem está de pé numa farmácia.
//
// Isto é outra coisa. É para um relatório de dez páginas que já está guardado,
// com tempo para o ler. **Sem corte de texto** e com orçamento para uma
// resposta longa: página a página, secção a secção, tudo explicado.
//
// E um PDF vai INTEIRO para o Claude, como documento — não como fotografia da
// primeira página. É aí que a diferença se nota: ele lê as dez páginas, as
// tabelas de valores de referência e os rodapés.
//
// É a funcionalidade que justifica o cofre ser pago, por isso está atrás do
// plano — mas a mensagem de recusa diz o que se ganha, não só que não se pode.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON, aiJSON } from '@/lib/ai'
import { getIP, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan } from '@/lib/planGate'

export const runtime = 'nodejs'
export const maxDuration = 300

const PROMPT = `És um médico português a ler um documento de saúde COM TEMPO, para a pessoa a quem ele pertence. Não é um resumo à pressa: é uma leitura completa, do princípio ao fim, em português europeu simples.

Lê TUDO. Se são dez páginas, são dez páginas. Não saltes secções por parecerem acessórias — os antecedentes, a medicação à entrada e as notas de rodapé são muitas vezes onde está o que a pessoa não sabia.

Responde APENAS JSON válido:
{
  "kind": "relatorio|analise|receita|medicamento|bula|outro",
  "title": "o que é este documento, em 3-6 palavras",
  "emDuasLinhas": "o essencial, como se explicasses a um amigo ao telefone",
  "oQueImporta": ["o que reter, uma ideia por linha, até 6"],
  "secoes": [
    { "titulo": "o nome da secção tal como aparece no documento",
      "texto": "o que ela diz, reescrito em simples, SEM encurtar o que importa",
      "porqueImporta": "porque é que esta secção interessa a esta pessoa — uma frase" }
  ],
  "values": [{ "name": "...", "value": "...", "unit": "...", "reference": "...", "status": "normal|baixo|alto", "note": "o que significa" }],
  "meds": [{ "name": "...", "dose": "...", "frequency": "...", "paraQue": "..." }],
  "termos": [{ "termo": "a palavra difícil tal como aparece", "simples": "o que quer dizer, numa frase" }],
  "cronologia": [{ "quando": "a data tal como aparece", "o_que": "o que aconteceu" }],
  "perguntasParaOMedico": ["perguntas concretas para a próxima consulta, até 6"],
  "aSeguir": ["passos concretos, até 5"],
  "warning": "só se houver algo que precise de atenção médica sem demora",
  "legibilidade": "o que não conseguiste ler, se aplicável",
  "paginas": "quantas páginas ou partes distintas encontraste",
  "confidence": "alta|media|baixa"
}

REGRAS QUE NÃO SE QUEBRAM:
- Aqui a profundidade é o ponto. "secoes" deve cobrir o documento TODO — se ele tem oito partes, são oito entradas, não três.
- "termos" é generoso: procura tudo o que uma pessoa sem formação clínica não perceberia. Dez, quinze, se as houver.
- "cronologia" só se o documento tiver datas que contem uma história (internamentos, exames, mudanças de medicação). Senão, deixa vazio.
- NUNCA dás um diagnóstico e NUNCA inventas. O que não se lê, diz-se em "legibilidade" e baixa-se a "confidence".
- Preenche só os campos que fazem sentido: um relatório não tem "values"; uma folha de análises não tem "secoes" longas.
- Não escrevas "consulte o seu médico" em cada parágrafo — a aplicação já o diz. Diz antes O QUE perguntar.`

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 6, 60_000).allowed) return rateLimitResponse()

  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })

  // Atrás do plano — mas a recusa explica o que se ganha.
  if (!['pro', 'clinic'].includes(plan)) {
    return NextResponse.json({
      error: 'A leitura a fundo faz parte do plano Pro.',
      detalhe: 'Lê o documento inteiro — todas as páginas — e devolve-o secção a secção, com as palavras difíceis explicadas, a cronologia e as perguntas para levar à consulta. O "Explicar" continua disponível e dá-te o essencial.',
      upgrade: true,
    }, { status: 402 })
  }

  const body = await req.json().catch(() => null) as
    { ficheiro?: string; mimeType?: string; texto?: string; titulo?: string } | null
  if (!body?.ficheiro && !body?.texto) {
    return NextResponse.json({ error: 'Não há nada para ler neste documento.' }, { status: 400 })
  }

  try {
    let res: any
    if (body.ficheiro) {
      // O PDF vai inteiro. O Claude lê-o como documento (ver callAnthropicVision
      // em lib/ai.ts) — todas as páginas, não só a primeira.
      res = await callGeminiVisionJSON<any>(
        `${PROMPT}\n\nO que se segue é um documento${body.titulo ? ` intitulado "${body.titulo}"` : ''}. Lê-o por inteiro.`,
        body.ficheiro,
        body.mimeType || 'application/pdf',
        { maxTokens: 8000, qualidade: true },
      )
    } else {
      // SEM corte. O /api/scan corta aos 24 mil caracteres porque tem de ser
      // rápido; aqui o ponto é o contrário.
      res = await aiJSON<any>([
        { role: 'system', content: PROMPT },
        { role: 'user', content: `Documento${body.titulo ? ` — ${body.titulo}` : ''}:\n\n${body.texto}` },
      ], { maxTokens: 8000, qualidade: true })
    }
    if (!res || !res.kind) throw new Error('Não consegui interpretar este documento.')
    return NextResponse.json(res)
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Não consegui ler este documento a fundo. Tenta outra vez.' },
      { status: 500 },
    )
  }
}
