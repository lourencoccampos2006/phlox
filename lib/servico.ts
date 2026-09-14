// lib/servico.ts
// ─────────────────────────────────────────────────────────────────────────────
// O cliente de serviço, e a recusa de fingir que está tudo bem.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// As rotas de cron faziam isto:
//
//     const db = createClient(URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
//
// O `!` é uma promessa ao compilador, não uma verificação. Se a variável não
// estiver definida no ambiente, o supabase-js **não lança** — constrói um
// cliente na mesma, cada consulta volta com `error` em vez de dados, e o
// código continua a correr como se não houvesse nada para fazer. A rota
// responde `{ ok: true, sent: 0 }` com HTTP 200.
//
// Resultado, exatamente o que aconteceu: o GitHub Actions verde de 15 em 15
// minutos, durante semanas, e nem uma notificação enviada. Um cron que não
// consegue falhar não é um cron, é um enfeite.
//
// Duas regras a partir de agora:
//   1. Sem chave → 503 e uma mensagem que diz o nome da variável. O workflow
//      fica VERMELHO e o registo do GitHub diz porquê.
//   2. Com chave, confirma-se que ela FUNCIONA antes de fazer trabalho — uma
//      chave revogada ou de outro projeto passa a primeira regra e falha em
//      silêncio na mesma.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type ResultadoServico =
  | { ok: true; sb: SupabaseClient }
  | { ok: false; estado: number; motivo: string; comoResolver: string }

/** O cliente com privilégios de serviço, ou a razão por que não há um. */
export function clienteDeServico(): ResultadoServico {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    return {
      ok: false, estado: 503,
      motivo: 'Falta NEXT_PUBLIC_SUPABASE_URL no servidor.',
      comoResolver: 'Definir na Vercel → Settings → Environment Variables, e voltar a publicar.',
    }
  }
  if (!chave) {
    return {
      ok: false, estado: 503,
      motivo: 'Falta SUPABASE_SERVICE_ROLE_KEY no servidor. Sem ela o cron corre, não consegue ler nem escrever nada, e responderia 200 na mesma.',
      comoResolver: 'Supabase → Project Settings → API → service_role. Copiar para a Vercel → Settings → Environment Variables (Production), e voltar a publicar — as variáveis só entram em funções publicadas depois disso.',
    }
  }
  return { ok: true, sb: createClient(url, chave) }
}

/** Uma leitura barata para confirmar que a chave é MESMO válida.
 *  Uma chave revogada, de outro projeto, ou colada com um espaço a mais passa
 *  a verificação de existência e falha em silêncio em cada consulta. */
export async function confirmarLigacao(sb: SupabaseClient): Promise<{ ok: true } | { ok: false; motivo: string; comoResolver: string }> {
  try {
    const { error } = await sb.from('profiles').select('id', { count: 'exact', head: true }).limit(1)
    if (error) {
      return {
        ok: false,
        motivo: `A chave de serviço existe mas a base de dados recusou-a: ${error.message}`,
        comoResolver: 'Confirmar que a SUPABASE_SERVICE_ROLE_KEY é a do projeto certo e que foi copiada inteira, sem espaços nem quebras de linha.',
      }
    }
    return { ok: true }
  } catch (e: any) {
    return {
      ok: false,
      motivo: `Não foi possível falar com a base de dados: ${e?.message || e}`,
      comoResolver: 'Ver o estado do projeto no Supabase — um projeto em pausa dá exatamente isto.',
    }
  }
}
