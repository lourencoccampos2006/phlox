// app/api/inquerito-publico/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// RESPONDER A UM INQUÉRITO SEM TER CONTA
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O PEDIDO ───────────────────────────────────────────────────────────────
// «Os inquéritos deviam de dar para partilhar.» (Fernando)
//
// ── PORQUE É QUE ISTO NÃO PODE PEDIR SESSÃO ────────────────────────────────
// Quem responde é a filha de uma utente, que não tem conta no Phlox e nunca
// vai ter. Um inquérito de satisfação que obriga a criar conta é um inquérito
// que ninguém responde — e o papel, que é o canal principal deste módulo,
// existe exactamente por isso.
//
// A coluna `codigo` já existia (sprint178) e nunca tinha sido usada: seis
// caracteres, gerados ao criar o inquérito. É a chave.
//
// ── O QUE ISTO NUNCA DEVOLVE ───────────────────────────────────────────────
// O `org_id`, o nome da casa, o número de convidados, as respostas já dadas,
// ou qualquer contagem. Quem abre o link vê as PERGUNTAS e mais nada — porque
// um link partilhado acaba sempre num sítio onde não devia, e o que lá está
// tem de ser inócuo mesmo nas mãos erradas.
//
// Devolve o título e o público (famílias / equipa / utentes), que é o mínimo
// para quem responde saber o que está a responder.
//
// ── E O ANONIMATO ──────────────────────────────────────────────────────────
// A resposta entra SEM `user_id` e sem `recorded_by_id` — a mesma regra do
// lançamento em papel, e pela mesma razão (ver a nota em /inqueritos). Não se
// guarda IP, não se guarda hora ao segundo, não se guarda agente do browser.
// O `como: 'portal'` distingue-a de uma lançada em papel, e é tudo.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { perguntasDe, type Publico } from '@/lib/inqueritos'

export const runtime = 'nodejs'

/** Serviço: não há sessão nenhuma do outro lado, e a RLS é por casa. */
function servico() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } })
}

/** Seis caracteres de A-Z0-9, e nada mais. */
const limpo = (c: string) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)

// ═══════════════════════════════════════════════════════════════════════════
// LER — que perguntas são estas?
// ═══════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  /* Apertado de propósito. O código tem 36^6 combinações, o que é muito para
     adivinhar à mão mas pouco para uma máquina sem tecto. Vinte por minuto por
     IP torna a procura cega inútil sem incomodar ninguém. */
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()

  const codigo = limpo(req.nextUrl.searchParams.get('c') || '')
  if (codigo.length < 4) {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 400 })
  }

  const sv = servico()
  if (!sv) return NextResponse.json({ error: 'Não disponível.' }, { status: 503 })

  const { data, error } = await sv.from('inqueritos')
    .select('id, titulo, publico, perguntas, ano, fechado_em')
    .eq('codigo', codigo).maybeSingle()

  if (error) {
    console.error('[phlox:inquerito-publico:ler]', error)
    return NextResponse.json({ error: 'Não foi possível abrir.' }, { status: 503 })
  }
  /* A mesma resposta para «não existe» e para «fechado» seria mais discreta,
     mas é pior para quem tem o link certo e chegou tarde: essa pessoa merece
     saber que o inquérito fechou, e não ficar a pensar que escreveu mal. */
  if (!data) return NextResponse.json({ error: 'nao_existe' }, { status: 404 })
  if (data.fechado_em) {
    return NextResponse.json({ error: 'fechado', titulo: data.titulo }, { status: 410 })
  }

  /* As perguntas guardadas são a CÓPIA feita quando o inquérito nasceu. Se por
     alguma razão não estiverem lá, usa-se o modelo do público — mas nunca se
     devolve uma lista vazia, que daria um formulário sem perguntas. */
  const perguntas = Array.isArray(data.perguntas) && data.perguntas.length
    ? data.perguntas
    : perguntasDe((data.publico || 'familias') as Publico)

  return NextResponse.json({
    titulo: data.titulo,
    publico: data.publico,
    ano: data.ano,
    perguntas,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONDER
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  // Mais apertado do que a leitura: responder é escrever.
  if (!checkRateLimit(getIP(req), 6, 60_000).allowed) return rateLimitResponse()

  const corpo = await req.json().catch(() => null)
  const codigo = limpo(corpo?.codigo || '')
  if (codigo.length < 4) return NextResponse.json({ error: 'Link inválido.' }, { status: 400 })

  const sv = servico()
  if (!sv) return NextResponse.json({ error: 'Não disponível.' }, { status: 503 })

  const { data: inq, error } = await sv.from('inqueritos')
    .select('id, org_id, publico, perguntas, fechado_em')
    .eq('codigo', codigo).maybeSingle()

  if (error) {
    console.error('[phlox:inquerito-publico:gravar]', error)
    return NextResponse.json({ error: 'Não foi possível gravar.' }, { status: 503 })
  }
  if (!inq) return NextResponse.json({ error: 'nao_existe' }, { status: 404 })
  if (inq.fechado_em) return NextResponse.json({ error: 'fechado' }, { status: 410 })

  /* ── O QUE VEM DE FORA É VERIFICADO CONTRA AS PERGUNTAS ─────────────────
     Guardar o objeto que o browser mandou seria deixar qualquer pessoa
     escrever o que quisesse dentro da coluna `respostas` — chaves inventadas,
     textos de qualquer tamanho, objetos aninhados. A análise lê essa coluna
     por id de pergunta; lixo lá dentro não parte nada hoje e parte tudo no dia
     em que alguém escrever uma média. */
  const perguntas: any[] = Array.isArray(inq.perguntas) && inq.perguntas.length
    ? inq.perguntas
    : perguntasDe((inq.publico || 'familias') as Publico)

  const porId = new Map<string, any>(perguntas.map(p => [String(p.id), p]))
  const vindas = (corpo?.respostas && typeof corpo.respostas === 'object') ? corpo.respostas : {}
  const limpas: Record<string, number | string | null> = {}

  for (const [id, v] of Object.entries(vindas)) {
    const p = porId.get(String(id))
    if (!p) continue                                  // pergunta que não é deste inquérito
    if (v === null || v === undefined || v === '') continue
    if (p.aberta) {
      const t = String(v).trim()
      if (t) limpas[id] = t.slice(0, 600)
    } else {
      const n = Number(v)
      // A escala vai de 1 a 5 e mais nada. Um 7 ou um 0 não é uma opinião.
      if (Number.isInteger(n) && n >= 1 && n <= 5) limpas[id] = n
    }
  }

  // Uma folha em branco não é uma resposta: contá-la baixava a média da casa
  // com uma pessoa que não disse nada.
  if (!Object.keys(limpas).length) {
    return NextResponse.json({ error: 'vazia' }, { status: 400 })
  }

  const { error: eGravar } = await sv.from('inqueritos_respostas').insert({
    inquerito_id: inq.id,
    org_id: inq.org_id,
    respostas: limpas,
    /* `portal` e nao um valor novo. A coluna tem um CHECK
       `('portal','papel','equipa')` e o sprint178 ja dizia o que `portal`
       quer dizer: «respondido em linha», por oposicao ao papel e ao que a
       equipa escreve a ler em voz alta. E isto, exactamente. Inventar um
       `link` dava um 400 na gravacao — e obrigava a uma migracao para dizer
       a mesma coisa com outra palavra. */
    como: 'portal',
    // Sem `user_id`, sem `recorded_by_id`, sem IP, sem agente. Ver o topo.
  })

  if (eGravar) {
    console.error('[phlox:inquerito-publico:insert]', eGravar)
    return NextResponse.json({ error: 'Não foi possível gravar.' }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
