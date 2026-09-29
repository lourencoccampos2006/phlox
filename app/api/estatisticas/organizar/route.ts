// app/api/estatisticas/organizar/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// A IA organiza as estatísticas. Não as calcula, e não lhes acrescenta nada.
//
// ── O QUE O FERNANDO PEDIU ──────────────────────────────────────────────────
// «Quero também uma página de estatísticas super completa, quero que tenha IA
//  para organizar.»
//
// ── O QUE ESTA ROTA RECEBE, E O QUE NÃO RECEBE ──────────────────────────────
// Recebe uma lista de FRASES DE FACTOS já calculadas no browser por
// lib/estatisticas.ts: «Quedas: 14 (em 12 meses) · variação: +17% desde ago
// 26 · se subir é mau».
//
// Não recebe — e não pode receber — nomes de pessoas, diagnósticos, ou linhas
// de registo. A IA não precisa deles para dizer por que ordem ler vinte
// números, e mandá-los era mandar dados clínicos para fora sem motivo nenhum.
// É o mesmo princípio de /api/org/weekly-summary e de /api/tendencias/narrative.
//
// ── A GUARDA QUE FAZ ISTO SER UTILIZÁVEL ────────────────────────────────────
// Uma IA a escrever sobre números inventa números. Não às vezes: sempre que a
// frase soa melhor com um. «As quedas subiram 30%» quando subiram 17% é uma
// mentira plausível, e numa reunião de direção ninguém vai verificar.
//
// Por isso TODO o número que a IA escreva é conferido contra os factos que lhe
// foram dados (`numerosInventados`). Um destaque com um número que não recebeu
// é DESCARTADO — não corrigido, não avisado, descartado. E se a leitura geral
// tiver um, é a leitura que cai.
//
// Prefiro devolver menos e certo do que mais e plausível. Um painel de
// estatísticas com um número inventado é pior do que não existir: leva a
// decidir com confiança sobre uma coisa que não aconteceu.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'
import { numerosPermitidos, numerosInventados } from '@/lib/estatisticas'

type Destaque = { titulo: string; porque: string; secao?: string }
type Resposta = { destaques: Destaque[]; leitura: string }

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    factos?: string[]; periodo?: string; casa?: string
  } | null

  const factos = (body?.factos || []).filter(f => typeof f === 'string' && f.length > 3).slice(0, 40)
  if (factos.length < 3) {
    // Menos de três números não se organizam: leem-se. Dizê-lo é melhor do que
    // gastar uma chamada de IA para devolver uma frase vazia.
    return NextResponse.json({
      destaques: [], leitura: '',
      semDados: 'Ainda há poucos números para organizar. À medida que a equipa regista, esta leitura enche-se.',
    })
  }

  const permitidos = numerosPermitidos(factos)

  try {
    const out = await aiJSON<Resposta>([
      {
        role: 'system',
        content: `Organizas estatísticas de um lar ou centro de dia em Portugal, em PT-PT, para quem dirige a casa.

Recebes uma lista de FACTOS JÁ CALCULADOS. O teu trabalho é ORGANIZAR: dizer quais são os três a cinco que merecem atenção agora, por que ordem, e porquê.

REGRAS ABSOLUTAS:
- Usa APENAS os números que estão nos factos. Nunca escrevas um número que não esteja lá — nem arredondado, nem somado, nem estimado. Se quiseres dizer que uma coisa subiu, usa a variação que te foi dada.
- Nunca inventes causas nem ligações entre factos. Podes dizer "vale a pena olhar", não podes dizer "porque houve menos pessoal" nem "resultando em" — dois números que desceram no mesmo mês não explicam um ao outro.
- Escreve as descidas sem duplo negativo: "desceu 12%" e não "desceu -12%".
- Nunca sugeres diagnóstico nem tratamento de ninguém.
- Um facto que diz "se subir é mau" e que subiu merece atenção. Um que diz "se subir é bom" e que desceu também.
- Se estiver tudo estável, diz isso em vez de inventar um destaque.

Cada destaque tem um "titulo" curto (até 60 caracteres) e um "porque" de uma ou duas frases. A "leitura" é um parágrafo de 2 a 4 frases sobre o conjunto.

Responde EXCLUSIVAMENTE em JSON:
{"destaques":[{"titulo":"...","porque":"...","secao":"..."}],"leitura":"..."}`,
      },
      {
        role: 'user',
        content: `Casa: ${body?.casa || 'a instituição'}\nPeríodo: ${body?.periodo || 'últimos 12 meses'}\n\nFactos:\n${factos.map(f => `- ${f}`).join('\n')}`,
      },
    // Sem `qualidade: true`, de propósito: isto é um resumo de gestão como o
    // /api/org/weekly-summary, não uma leitura clínica. O modelo rápido chega
    // para ordenar vinte números, e a escada de qualidade custa orçamento que
    // as rotas clínicas precisam mais. O que garante que não sai errado é a
    // conferência dos números aqui em baixo, não o tamanho do modelo.
    ], { maxTokens: 900, temperature: 0.3, json: true })

    // ── A conferência ────────────────────────────────────────────────────
    const descartados: string[] = []
    const destaques = (Array.isArray(out?.destaques) ? out.destaques : [])
      .filter(d => d && typeof d.titulo === 'string' && typeof d.porque === 'string')
      .filter(d => {
        const maus = numerosInventados(`${d.titulo} ${d.porque}`, permitidos)
        if (maus.length) { descartados.push(`${d.titulo} (${maus.join(', ')})`); return false }
        return true
      })
      .slice(0, 5)
      .map(d => ({
        titulo: String(d.titulo).slice(0, 80),
        porque: String(d.porque).slice(0, 320),
        secao: typeof d.secao === 'string' ? d.secao.slice(0, 30) : undefined,
      }))

    const leituraCrua = typeof out?.leitura === 'string' ? out.leitura : ''
    const mausNaLeitura = numerosInventados(leituraCrua, permitidos)
    const leitura = mausNaLeitura.length ? '' : leituraCrua.slice(0, 800)

    if (descartados.length || mausNaLeitura.length) {
      // Fica no registo do servidor: se acontecer muito, o problema é do
      // prompt e não do modelo, e quero saber.
      console.warn('[phlox:estatisticas] a IA escreveu números que não recebeu:',
        JSON.stringify({ descartados, mausNaLeitura }))
    }

    return NextResponse.json({
      destaques, leitura,
      // O ecrã tem de poder dizer que houve coisas descartadas. Esconder isso
      // era fingir que a IA acertou sempre.
      descartados: descartados.length,
    })
  } catch (e: any) {
    console.error('[phlox:estatisticas] organizar falhou:', e?.message)
    // Sem leitura, mas os números continuam todos no ecrã — a IA é um extra
    // por cima deles, nunca o caminho para eles.
    return NextResponse.json({
      destaques: [], leitura: '',
      erro: 'Não foi possível organizar agora. Os números em baixo estão todos certos.',
    })
  }
}
