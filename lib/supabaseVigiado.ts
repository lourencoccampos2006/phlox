// lib/supabaseVigiado.ts
// ─────────────────────────────────────────────────────────────────────────────
// Uma consulta ao Supabase que falha deixa de poder falhar em silêncio.
//
// ── O PROBLEMA, E PORQUE É QUE NÃO SE RESOLVE SÍTIO A SÍTIO ────────────────
// O cliente do Supabase não lança exceções: devolve `{ data, error }`. Quem
// escreve `const { data } = await …` atira o erro ao chão. E o PostgREST recusa
// o select INTEIRO quando uma coluna não existe — devolve `data: null`, que é
// indistinguível de "não há registos".
//
// A avaria não aparece como avaria: aparece como uma lista vazia. Já custou,
// neste projeto, semanas de notificações de medicação caladas (uma coluna
// `shifts` que não existia), um aviso de "família à espera" que nunca chegou a
// existir, e um verificador de interações a dizer "não encontrei nada" a quem
// toma oito medicamentos.
//
// Há 239 sítios com esta forma. Editá-los um a um seria muito trabalho, muita
// agitação no código e — o que é pior — deixaria de fora todos os que se
// escreverem amanhã.
//
// ── A INTERVENÇÃO ───────────────────────────────────────────────────────────
// O cliente do Supabase aceita o seu próprio `fetch`. Passa-se um que olha para
// as respostas e ESCREVE NA CONSOLA as que vêm com erro, com a tabela, o método
// e a mensagem real do PostgREST. Um sítio, e cobre todas as consultas — as de
// hoje e as de amanhã.
//
// Isto não conserta a mentira na interface: uma lista que devia ter dados
// continua a aparecer vazia. O que conserta é a INVISIBILIDADE — que era a
// razão por que estas avarias duravam semanas. Onde a lista vazia engana com
// consequência (o cofre, as sessões ativas, a medicação de alguém), o sítio
// próprio distingue "vazio" de "não consegui ler".
//
// ── O QUE NÃO SE REGISTA, E PORQUÊ ─────────────────────────────────────────
// • `PGRST116` / 406 — é o "0 linhas" de um `.single()`. É esperado em código
//   correto e enchia a consola de ruído.
// • pedidos repetidos — uma página com uma consulta partida numa lista de 50
//   linhas escreveria 50 vezes a mesma coisa. Junta-se.
//
// Uma regra que grita onde não há problema é ignorada em duas semanas.
// ─────────────────────────────────────────────────────────────────────────────

/** O que já se disse, para não repetir. A chave é tabela+estado+mensagem. */
const jaDito = new Map<string, number>()
const JANELA_MS = 10_000

function tabelaDoUrl(url: string): string {
  try {
    const u = new URL(url, 'http://x')
    const m = u.pathname.match(/\/rest\/v1\/([^/?]+)/)
    if (m) return m[1]
    const s = u.pathname.match(/\/storage\/v1\/object\/[^/]+\/([^/?]+)/)
    if (s) return `storage:${s[1]}`
    return u.pathname
  } catch { return url.slice(0, 80) }
}

/** Envolve um `fetch` para registar as respostas de erro do Supabase.
 *
 *  Nunca lança, nunca altera a resposta e nunca atrasa nada: lê uma CÓPIA do
 *  corpo, depois de a resposta já ter seguido para quem a pediu. */
export function comVigilancia(original: typeof fetch = fetch): typeof fetch {
  return async function (input: any, init?: any) {
    const res = await original(input, init)
    try {
      const url = typeof input === 'string' ? input : (input?.url || String(input))
      if (!res.ok && /\/(rest|storage)\/v1\//.test(url)) {
        // 406 de um `.single()` sem linhas é normal — não é avaria.
        if (res.status !== 406) {
          const metodo = (init?.method || (input?.method) || 'GET').toUpperCase()
          const tabela = tabelaDoUrl(url)
          // A cópia: ler o corpo do original tirava-o a quem o pediu.
          res.clone().text().then(corpo => {
            let detalhe = corpo.slice(0, 400)
            let codigo = ''
            try {
              const j = JSON.parse(corpo)
              codigo = j?.code || ''
              if (codigo === 'PGRST116') return    // 0 linhas num .single()
              detalhe = [j?.message, j?.details, j?.hint].filter(Boolean).join(' · ').slice(0, 400) || detalhe
            } catch { /* nem sempre é JSON */ }

            const chave = `${metodo} ${tabela} ${res.status} ${detalhe.slice(0, 120)}`
            const agora = Date.now()
            const visto = jaDito.get(chave)
            if (visto && agora - visto < JANELA_MS) return
            jaDito.set(chave, agora)
            if (jaDito.size > 200) jaDito.clear()

            // A mensagem diz o que faz falta para agir: a tabela, o que se
            // estava a fazer, e o que o PostgREST respondeu.
            console.error(
              `[phlox:supabase] ${metodo} ${tabela} → ${res.status}`,
              codigo ? `(${codigo})` : '',
              detalhe,
              '\n  ↳ Se isto veio de um `const { data } = …`, a página está a mostrar uma lista vazia em vez desta avaria.',
            )
          }, () => { /* o corpo já foi lido por outro lado — deixa estar */ })
        }
      }
    } catch { /* vigiar nunca pode estragar o pedido */ }
    return res
  } as typeof fetch
}
