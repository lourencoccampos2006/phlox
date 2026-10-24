// app/api/export-me/route.ts
// ───────────────────────────────────────────────────────────────────────────
// OS DADOS DE QUEM PEDE — ART. 20.º DO RGPD (PORTABILIDADE)
//
// ── O QUE ESTAVA MAL, E É SÉRIO (2026-10-21) ───────────────────────────────
// A rota exportava toda a linha com `user_id = quem pede`, numa lista de
// trinta e cinco tabelas escrita à mão. Entre elas: `patients`, `care_records`,
// `mar_records`, `assessments`, `care_plans`, `wounds`.
//
// Num lar, o `user_id` de um registo é QUEM O ESCREVEU (ver `scope.stamp()`).
// Uma auxiliar que registe o turno de trinta residentes durante um ano tem o
// seu `user_id` em milhares de linhas sobre OUTRAS PESSOAS. Ao carregar em
// «exportar os meus dados», recebia um ficheiro com os nomes, os diagnósticos,
// as alergias e os registos de cuidados dessas pessoas — fora da casa, sem
// registo, e com a etiqueta de «dados pessoais dela» por cima.
//
// Medido a 21/10/2026 com a conta de QA: o ficheiro trazia uma ficha de utente
// com «Diabetes tipo 2, HTA» e «Penicilina», mais 23 registos de cuidados e 2
// avaliações dessa pessoa.
//
// São dois erros numa só linha de código. O de confidencialidade é óbvio. O
// outro é de direito: o art. 20.º dá a cada um os dados QUE LHE DIZEM
// RESPEITO, e não os dados que escreveu sobre terceiros. Exportá-los aqui não
// cumpre o artigo — inventa um direito que ele não dá.
//
// ── A REGRA AGORA ──────────────────────────────────────────────────────────
// Quem pertence a uma casa leva a CONTA e mais nada: quem é, como entra, o que
// lhe pertence. O que registou sobre utentes é dos utentes, e nesses dados a
// responsável é a casa — o Phlox trata-os por conta dela (art. 28.º) e não os
// entrega a um funcionário a pedido deste.
//
// A primeira tentativa foi excluir as tabelas com `patient_id`. Não chegava: a
// `patients` não tem `patient_id` (a pessoa É a linha) e saía à mesma, e tabelas
// como a `wound_assessments` chegam ao residente por `wound_id`. Uma lista de
// exclusões tem de estar completa para proteger; uma lista do que PODE sair
// protege mesmo quando está incompleta. Está em `SOBRE_A_CONTA`, com a razão
// de cada linha.
//
// Para uma conta pessoal (sem casa) nada disto se aplica: lá o `user_id` é
// mesmo o dono dos dados, e continua a sair tudo. Pôr-lhe também uma lista
// branca tornaria o art. 20.º incompleto — que é o engano ao contrário, e
// numa conta pessoal é o engano que custa.
//
// ── DUAS CORREÇÕES QUE PARECEM BOAS E NÃO SÃO ──────────────────────────────
// 1. «Usar o token de quem pede, em vez da chave de serviço, e deixar a RLS
//    decidir.» Não teria evitado nada: a RLS DÁ a um membro ativo acesso às
//    linhas da casa dele, por isso `where user_id = eu` devolvia na mesma os
//    registos que ele escreveu sobre residentes. E trocar agora arriscava
//    perder dados de contas pessoais em tabelas sem política de «ver o meu» —
//    num direito de portabilidade, devolver de menos em silêncio é o pior dos
//    dois enganos. Quem garante aqui é a lista branca, não a origem do cliente.
// 2. «Decidir a pertença por `org_id` não nulo nas linhas.» Também não chega:
//    a coluna só nasceu no sprint91 e as linhas anteriores têm-na a nulo,
//    medido (19 de 23 `care_records` da conta de QA). Serve de camada de baixo,
//    e está lá — mas quem decide é a pertença, ativa ou não.
//
// ── E A LISTA DEIXOU DE SER ESCRITA À MÃO ──────────────────────────────────
// Eram trinta e cinco nomes, vários da era da farmácia, e nenhuma das dezenas
// de tabelas que nasceram depois. Uma lista escrita à mão é a mesma classe de
// defeito que pôs os inquéritos oito dias partidos: duas cópias da mesma
// verdade, uma delas a envelhecer em silêncio. Agora pergunta-se ao esquema
// quais têm `user_id`.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { SOBRE_A_CONTA, PORQUE_FICA_NA_CASA, NUNCA_SAI } from '@/lib/direitoDeAcesso'

export const runtime = 'nodejs'
export const maxDuration = 120

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/* ── O esquema real, uma vez por processo ─────────────────────────────────
   O Supabase só serve o OpenAPI a uma chave secreta. O que vem daqui são
   nomes de tabelas e de colunas — nenhuma linha de ninguém. */
let esquema: { em: number; comUser: string[]; comOrg: Set<string> } | null = null
const VALIDADE = 10 * 60_000

async function lerEsquema() {
  if (esquema && Date.now() - esquema.em < VALIDADE) return esquema
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!segredo) throw new Error('sem chave de serviço')
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: segredo, Authorization: `Bearer ${segredo}` },
  })
  if (!r.ok) throw new Error('esquema indisponível')
  const spec = await r.json()
  const defs = spec.definitions || spec.components?.schemas || {}
  const comUser: string[] = []
  const comOrg = new Set<string>()
  for (const [t, d] of Object.entries<any>(defs)) {
    const cols = Object.keys(d?.properties || {})
    if (cols.includes('org_id')) comOrg.add(t)
    if (cols.includes('user_id') && !(t in NUNCA_SAI)) comUser.push(t)
  }
  esquema = { em: Date.now(), comUser: comUser.sort(), comOrg }
  return esquema
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sb = admin()

  let esq
  try { esq = await lerEsquema() } catch {
    return NextResponse.json({ error: 'Não foi possível ler o esquema da base de dados.' }, { status: 503 })
  }

  /* ── Pertence a alguma casa? ────────────────────────────────────────────
     É esta resposta que decide o que entra. Numa casa, o que esta pessoa
     escreveu sobre residentes não é dela: é dos residentes. */
  /* SEM `.eq('active', true)`.
     Sair de uma casa é `active: false` — a linha fica e o `user_id` da pessoa
     continua em tudo o que ela escreveu lá. Com o filtro de ativo, um
     EX-FUNCIONÁRIO caía no ramo «conta pessoal» e levava daqui os registos de
     cuidados, os diagnósticos e as alergias dos residentes que acompanhou.

     É a mesma fuga que esta rota foi reescrita para fechar, entregue à pessoa
     a quem menos se quer entregar: a que já saiu. Quem alguma vez pertenceu a
     uma casa conta como pertencendo, para este efeito, para sempre. */
  const { data: casas, error: erroCasas } = await sb.from('org_members')
    .select('org_id').eq('user_id', userId)
  /* Falhando a leitura, assume-se QUE SIM.
     Escrito como `(casas || []).length > 0`, um erro dava `naCasa = false` — e
     `false` aqui é o ramo que exporta tudo o que tem `user_id`, incluindo os
     registos que esta pessoa escreveu sobre residentes. Ou seja, uma falha
     passageira da base de dados reabria exactamente o vazamento que esta rota
     foi reescrita para fechar, sem erro nenhum no ecrã.
     Entre exportar de menos e exportar dados de residentes, exporta-se de
     menos — e diz-se porquê no ficheiro. */
  if (erroCasas) {
    return NextResponse.json({
      error: 'Não foi possível confirmar a que instituição esta conta pertence, '
        + 'e sem isso não dá para saber o que é seu. Tente outra vez daqui a pouco.',
    }, { status: 503 })
  }
  const naCasa = (casas || []).length > 0

  /* Numa casa: só o que está em `SOBRE_A_CONTA`. Fora dela: tudo o que tem
     `user_id`, porque aí o `user_id` é mesmo o dono dos dados. */
  const tabelas = naCasa
    ? esq.comUser.filter(t => t in SOBRE_A_CONTA)
    : esq.comUser

  const out: Record<string, any> = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    rgpd_article: '20',
    note:
      'Exportação dos dados pessoais associados a esta conta no Phlox. '
      + 'Tabelas vazias foram omitidas.',
    ...(naCasa ? {
      nota_instituicao: PORQUE_FICA_NA_CASA,
      o_que_entra: SOBRE_A_CONTA,
    } : {}),
    tables: {},
  }

  const sizes: Record<string, number> = {}
  const LOTE = 8
  for (let i = 0; i < tabelas.length; i += LOTE) {
    await Promise.all(tabelas.slice(i, i + LOTE).map(async t => {
      try {
        /* ── A INVARIANTE, E É ELA QUE GARANTE ISTO ────────────────────────
           Uma linha com `org_id` pertence a uma CASA. Nesses dados a
           responsável é a casa e o Phlox é subcontratante (art. 28.º): não
           saem por um pedido de portabilidade de uma conta, seja de quem for.

           Isto não depende de saber se a pessoa é da casa: apanha quem saiu,
           quem teve a linha de membro apagada à mão, quem escreveu numa casa
           sem nunca ter sido membro.

           ── MAS NÃO CHEGA SOZINHO, E ISSO FOI MEDIDO ───────────────────
           Escrevi aqui «completo por construção» e a medição desmentiu-me.
           A coluna `org_id` só nasceu no sprint91: as linhas anteriores têm-na
           a NULO mesmo sendo de uma casa. Na base de dados, a 21/10/2026, a
           conta de QA tinha 23 `care_records` e 19 deles sem `org_id`.

           Quem garante é a lista branca `SOBRE_A_CONTA`, que se aplica a quem
           alguma vez pertenceu a uma casa — ativo ou não. Este filtro é a
           camada de baixo, para os casos que a pertença não apanha.

           Para uma conta pessoal não tira nada: aí o `org_id` é mesmo nulo. */
        /* O filtro NÃO se aplica ao que está na lista branca.
           O `org_members` é a pertença da própria pessoa — a que casa
           pertence, com que função, com que acessos — e isso é dela: é a
           primeira coisa que a lista branca promete. Com o filtro a apanhá-lo,
           a linha saía sempre vazia e a lista prometia uma coisa que nunca
           chegava. Medido: o `summary` passou a vir sem `org_members`.

           É o mesmo defeito que a `check-direito-acesso` procura entre o
           `SOBRE_A_CONTA` e o `NUNCA_SAI`, cometido noutro sítio. O que está
           na lista branca já foi pesado um a um; o filtro é para o resto. */
        let q = sb.from(t).select('*').eq('user_id', userId).limit(50_000)
        if (esq.comOrg.has(t) && !(t in SOBRE_A_CONTA)) q = q.is('org_id', null)
        const { data, error } = await q
        if (error || !data?.length) return
        out.tables[t] = data
        sizes[t] = data.length
      } catch { /* tabela inexistente — ignora */ }
    }))
  }

  /* O `profiles` é à parte nos dois casos: a coluna da pessoa lá chama-se `id`
     e não `user_id`, por isso o ciclo de cima nunca lhe acerta. */
  const { data: perfil, error: erroPerfil } = await sb.from('profiles').select('*').eq('id', userId)
  if (erroPerfil) out.profiles_em_falta = erroPerfil.message || 'Não foi possível ler o perfil.'
  else if (perfil?.length) { out.tables.profiles = perfil; sizes.profiles = perfil.length }

  out.summary = sizes
  return new NextResponse(JSON.stringify(out, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="phlox-export-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
