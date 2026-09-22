// app/api/scan/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Explicar — uma foto de qualquer papel de saúde, explicado em português
// simples.
//
// Reescrito 2026-09-15. A versão anterior devolvia um resumo de 2-5 frases e
// pouco mais. Isso responde a "o que é isto?" e deixa por responder tudo o
// resto — que é onde está o trabalho de quem recebe um relatório do hospital:
// o que quer dizer aquela palavra, o que é que importa, o que pergunto ao
// médico, o que faço a seguir.
//
// ── O QUE MUDOU A 2026-09-17: A MEMÓRIA ────────────────────────────────────
// Até aqui cada documento era lido do zero. O décimo relatório da mesma pessoa
// era lido com a mesma ignorância do primeiro — sem saber que ela tem
// hipertensão, que o colesterol vinha a descer, que em novembro esteve com
// gripe. Um médico que lesse assim não seria um bom médico.
//
// Agora vai com o documento o que já se sabe sobre a pessoa (ver lib/dossier),
// e a resposta traz três coisas novas:
//   • `pessoa`    — de quem é o documento, lido do próprio papel. É isto que
//                   permite guardar o relatório de alguém que não usa o Phlox
//                   sem o misturar com o de mais ninguém (ver lib/sujeitos).
//   • `ligacoes`  — o que este documento muda no que já se sabia. É a parte
//                   que só existe por haver memória.
//   • `perguntas` — o que vale a pena perguntar, opcional, para a próxima
//                   leitura ser melhor.
//
// A IA é a de qualidade (`qualidade: true` → Claude primeiro). Num relatório
// médico, ler mal uma frase não é um defeito de estilo.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON, aiJSON } from '@/lib/ai'
import { getIP, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { enforceDailyLimit } from '@/lib/serverLimit'

export const maxDuration = 120

const PROMPT = `És um médico português a explicar um documento de saúde à pessoa que to mostrou. Escreves em português europeu, simples, sem jargão, e sem nunca inventar.

PRIMEIRO identifica o que é o documento e DE QUEM é. DEPOIS explica-o por inteiro.

DE QUEM É O DOCUMENTO — lê isto com atenção:
Quem te mostra o documento pode não ser a pessoa a quem ele pertence. É comum e é legítimo: alguém está com outra pessoa que não percebe o seu relatório e pede ajuda. Documentos de saúde trazem quase sempre o nome (no cabeçalho, junto a "Utente", "Nome" ou "Doente"). Lê-o e devolve-o EXATAMENTE como está escrito no papel, sem corrigir nem completar. Se não houver nome nenhum, deixa vazio — não adivinhes a partir do contexto.

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
  "pessoa": { "nome": "o nome tal como aparece no documento, ou vazio se não houver", "onde": "onde o encontraste (ex: cabeçalho, junto a Utente), ou vazio" },
  "dataDoDocumento": "a data do documento no formato AAAA-MM-DD, ou vazio se não a conseguires ler",
  "title": "o que é este documento, em 3-6 palavras",
  "emDuasLinhas": "o essencial, como se explicasses a um amigo ao telefone. Duas frases, no máximo três. Sem jargão nenhum.",
  "oQueImporta": ["o que uma pessoa precisa mesmo de reter, uma ideia por linha, no máximo 5"],
  "termos": [{ "termo": "a palavra difícil tal como aparece no documento", "simples": "o que quer dizer, numa frase" }],
  "secoes": [{ "titulo": "o nome da secção do documento", "texto": "o que ela diz, reescrito em simples" }],
  "meds": [{ "name": "...", "dose": "...", "frequency": "...", "paraQue": "para que serve, em poucas palavras" }],
  "values": [{ "name": "...", "value": "...", "unit": "...", "reference": "...", "status": "normal|baixo|alto", "note": "o que significa ESTE valor nesta pessoa" }],
  "ligacoes": ["o que este documento muda no que já se sabia sobre esta pessoa — ver as regras em baixo"],
  "perguntasParaOMedico": ["perguntas concretas para levar à próxima consulta, no máximo 4"],
  "aSeguir": ["o que fazer a seguir, em passos concretos, no máximo 4"],
  "factosNovos": {
    "condicoes": [{ "nome": "...", "desde": "quando começou, se o documento disser", "estado": "ativo|resolvido" }],
    "medicamentos": [{ "nome": "...", "detalhe": "a dose e como se toma", "estado": "ativo|parado" }],
    "valores": [{ "nome": "...", "valor": "...", "unidade": "...", "estado": "normal|baixo|alto", "quando": "AAAA-MM-DD" }],
    "acontecimentos": [{ "quando": "AAAA-MM-DD", "o_que": "o que aconteceu, numa frase" }]
  },
  "perguntas": [{ "pergunta": "...", "porque": "porque é que isto ajuda", "tipo": "sim_nao|escolha|aberta", "opcoes": ["só se tipo=escolha"] }],
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
- Não escreves "consulte o seu médico" em todo o lado: isso já está dito na aplicação. Diz antes O QUE perguntar.

"factosNovos" — O QUE FICA A SABER-SE DESTA PESSOA:
- É o que vais querer ter à mão da próxima vez que leres um papel dela. Condições, o que toma, valores medidos, o que aconteceu e quando.
- Se já souberes de uma condição ou de um medicamento pelo que te foi dado em cima, usa EXATAMENTE o mesmo nome. Escrever a mesma coisa de duas maneiras cria duas entradas para a mesma coisa.
- Marca "resolvido" ou "parado" só quando o documento o disser. Um relatório que não menciona uma condição não é prova de que ela acabou.
- Vazio é uma resposta válida. Uma caixa de comprimidos fotografada não diz nada de novo sobre ninguém.

"ligacoes" — SÓ SE HOUVER MEMÓRIA DESTA PESSOA:
- Compara este documento com o que já se sabia: um valor que melhorou ou piorou, um medicamento que mudou de dose, uma queixa que já vinha de trás, algo que o documento anterior mandava vigiar.
- Frases curtas, concretas e em linguagem simples: "O colesterol desceu de 232 para 198 desde junho."
- Se não houver nada a ligar, devolve lista vazia. Inventar uma ligação é pior do que não haver nenhuma.

"perguntas" — O QUE VALE A PENA PERGUNTAR:
- No máximo 3. Zero é o valor por omissão: só perguntas que mudem mesmo a leitura de um documento futuro.
- Pertinentes a ESTE documento E ao que já se sabe da pessoa. Se um papel anterior falava de um problema agudo, perguntar como é que ele evoluiu é exatamente o género de coisa a perguntar.
- NUNCA perguntes o que já está na memória, nem o que já foi respondido.
- NUNCA perguntes nada que não sirva para ler melhor os documentos desta pessoa: nada sobre dinheiro, família, trabalho ou hábitos que o documento não levante.
- Perguntas curtas, de resposta fácil, em linguagem do dia a dia. Trata a pessoa por "você".
- São OPCIONAIS e a pessoa sabe disso. Não implores nem expliques que é para melhorar o serviço.`

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const gate = await enforceDailyLimit(req, 'scan')
  if (!gate.ok) return gate.response!

  const body = await req.json().catch(() => null) as
    { image?: string; mimeType?: string; text?: string; memoria?: string } | null
  if (!body?.image && !body?.text) return NextResponse.json({ error: 'Imagem ou documento obrigatório' }, { status: 400 })

  // ── A memória entra aqui ──────────────────────────────────────────────────
  // Vem do cliente, montada em lib/memoriaDocumentos: são os dados da própria
  // pessoa, lidos com a sessão dela. Vai ANTES do documento, como contexto, e
  // não depois — o modelo tem de já saber de quem pode ser o papel enquanto o
  // lê, não depois de o ter lido.
  const memoria = String(body.memoria || '').slice(0, 6000)
  const comMemoria = memoria
    ? `${PROMPT}\n\n─────\nO QUE JÁ SABES (de documentos anteriores desta conta). Usa isto para ligar, comparar e não repetir perguntas:\n${memoria}\n─────`
    : PROMPT

  try {
    let res: any
    if (body.image) {
      res = await callGeminiVisionJSON<any>(
        `${comMemoria}\n\nO que se segue é UMA FOTO de um documento.`,
        body.image, body.mimeType || 'image/jpeg',
        { maxTokens: 4000, qualidade: true, prazoSegundos: 100 },
      )
    } else {
      res = await aiJSON<any>([
        { role: 'system', content: comMemoria },
        { role: 'user', content: `Documento:\n${(body.text || '').slice(0, 24000)}` },
      ], { maxTokens: 4000, qualidade: true, prazoSegundos: 100 })
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
