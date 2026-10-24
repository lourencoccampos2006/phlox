// app/api/dados-do-utente/route.ts
// ───────────────────────────────────────────────────────────────────────────
// TUDO O QUE A CASA TEM SOBRE UMA PESSOA — ART. 15.º DO RGPD
//
// Uma filha pede tudo o que a casa tem sobre a mãe. A casa tem um mês para
// responder e a resposta tem de ser COMPLETA. Esta rota junta-a.
//
// ── A LISTA DE TABELAS NÃO ESTÁ ESCRITA AQUI ───────────────────────────────
// Pergunta-se ao PostgREST quais existem e quais têm `patient_id`. A
// `/api/export-me`, que faz o mesmo para uma conta, tem a lista escrita à mão
// — trinta e cinco nomes, vários da era da farmácia, e nenhuma das dezenas
// que nasceram depois. Numa resposta a um direito de acesso, uma lista
// desatualizada é uma resposta incompleta que ninguém vê ser incompleta.
//
// O que fica de fora e o que pode nomear terceiros está em
// `lib/direitoDeAcesso.ts`, com a razão de cada um, e a
// `scripts/check-direito-acesso.mjs` confronta essas listas com o esquema
// real a cada passagem das guardas.
//
// ── QUEM PODE PEDIR ────────────────────────────────────────────────────────
// Lê-se com o TOKEN DE QUEM PEDE, nunca com a chave de serviço. Assim é a RLS
// que decide o que sai, e o documento nunca pode conter mais do que a pessoa
// já vê na aplicação — uma auxiliar sem acesso ao financeiro não recebe a
// conta corrente por esta porta.
//
// Em cima disso exige-se `utentes.ver` e que o utente seja da casa de quem
// pede: uma segunda camada, porque já houve uma fuga de RLS (sprint109) e
// porque um 403 limpo é melhor do que um documento vazio sem explicação.
import { NextRequest, NextResponse } from 'next/server'
import { authedClient, permissoesNaOrg } from '@/lib/orgAuth'
import { pode } from '@/lib/permissoes'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { FORA, REDIGIR } from '@/lib/direitoDeAcesso'

export const runtime = 'nodejs'
/* Setenta e tal leituras em sequência contra o Supabase. Com uma casa cheia e
   um residente de três anos, a primeira passagem demora. */
export const maxDuration = 120

/* ── O esquema real, uma vez por processo ──────────────────────────────────
   O `GET /rest/v1/` devolve o OpenAPI com todas as tabelas e colunas.

   ── A CHAVE DE SERVIÇO APARECE AQUI, E SÓ AQUI ──────────────────────────
   O Supabase só serve este endereço a uma chave secreta: com a anónima ou com
   o token de quem pede responde «Secret API key required». Medido.

   Isto NÃO abre nada. O que vem daqui são nomes de tabelas e de colunas — não
   há uma linha de ninguém no meio — e serve apenas para decidir a que tabelas
   perguntar a seguir. Todas as perguntas que se seguem são feitas com o token
   de quem pediu, debaixo da RLS: a chave de serviço nunca toca numa linha, e
   o documento continua a não poder conter mais do que essa pessoa já vê na
   aplicação.

   Faltando a chave (um ambiente sem ela), a rota diz que não consegue em vez
   de cair para a anónima e devolver um documento incompleto a fingir que está
   inteiro.

   Guarda-se dez minutos: buscá-lo a cada pedido punha uma ida à rede à frente
   de setenta, e uma tabela nascida há cinco minutos não muda nada num pedido
   que tem um mês de prazo. */
let esquema: { em: number; tabelas: string[] } | null = null
const VALIDADE = 10 * 60_000

async function tabelasComUtente(): Promise<string[]> {
  if (esquema && Date.now() - esquema.em < VALIDADE) return esquema.tabelas
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!segredo) throw new Error('sem chave de serviço')
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: segredo, Authorization: `Bearer ${segredo}` },
  })
  if (!r.ok) throw new Error('esquema indisponível')
  const spec = await r.json()
  const defs = spec.definitions || spec.components?.schemas || {}
  const tabelas = Object.entries(defs)
    .filter(([, d]: any) => Object.keys(d?.properties || {}).includes('patient_id'))
    .map(([t]) => t)
    .filter(t => !(t in FORA))
    .sort()
  esquema = { em: Date.now(), tabelas }
  return tabelas
}

export async function GET(req: NextRequest) {
  /* O tecto vem antes de validar o token: validar custa uma ida ao Supabase, e
     um tecto que só conta pedidos válidos não trava quem manda lixo. Três por
     minuto porque cada pedido são setenta leituras — isto não é um ecrã que se
     atualiza, é um documento que se pede uma vez. */
  if (!checkRateLimit(getIP(req), 3, 60_000).allowed) return rateLimitResponse()

  if (!req.headers.get('authorization')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const sb = authedClient(req)
  const { data: auth, error: erroAuth } = await sb.auth.getUser()
  const user = auth?.user
  if (erroAuth || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const pid = req.nextUrl.searchParams.get('utente') || ''
  if (!pid) return NextResponse.json({ error: 'Falta dizer de quem.' }, { status: 400 })

  /* ── Quem é a pessoa, e é desta casa? ───────────────────────────────────
     A leitura é com o token de quem pede, por isso a RLS já recusa um utente
     de outra casa. Lê-se à mesma o `org_id` porque é ele que diz de que casa
     vêm as permissões a verificar a seguir. */
  const { data: utente, error: erroUtente } = await sb.from('patients')
    .select('id, name, date_of_birth, admission_date, org_id').eq('id', pid).maybeSingle()
  if (erroUtente || !utente) {
    return NextResponse.json({ error: 'Não encontrei essa pessoa.' }, { status: 404 })
  }

  if (utente.org_id) {
    const minhas = await permissoesNaOrg(sb, user.id, utente.org_id)
    if (!pode(minhas, 'utentes', 'ver')) {
      return NextResponse.json({ error: 'Não tem acesso às pessoas desta casa.' }, { status: 403 })
    }
  }

  let tabelas: string[]
  try {
    tabelas = await tabelasComUtente()
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o esquema da base de dados.' }, { status: 503 })
  }

  /* ── As leituras ────────────────────────────────────────────────────────
     Em lotes de oito. Todas ao mesmo tempo abria setenta ligações de uma vez
     e o Supabase começa a recusar; uma a uma demorava um minuto. */
  /* ── A FICHA DA PRÓPRIA PESSOA ENTRA À MÃO ──────────────────────────────
     A `patients` é a única tabela desta lista que não tem `patient_id`: a
     pessoa é a LINHA, não uma referência a outra. A busca automática ignorava-a
     — e o documento saía sem o nome, a data de nascimento, o quarto, os
     diagnósticos e as alergias. Ou seja, sem o processo individual, que é
     exactamente o que alguém pede quando pede «tudo o que têm sobre a minha
     mãe».

     Esta linha já foi lida em cima, para confirmar a casa — mas com cinco
     colunas. Aqui lê-se inteira. */
  const dados: Record<string, any[]> = {}
  const recusadas: Record<string, string> = {}

  const { data: ficha, error: erroFicha } = await sb.from('patients')
    .select('*').eq('id', pid).maybeSingle()
  if (erroFicha) recusadas.patients = erroFicha.message || 'Não foi possível ler a ficha.'
  else if (ficha) dados.patients = [ficha]

  const LOTE = 8
  for (let i = 0; i < tabelas.length; i += LOTE) {
    await Promise.all(tabelas.slice(i, i + LOTE).map(async t => {
      const { data, error } = await sb.from(t).select('*').eq('patient_id', pid).limit(5000)
      if (error) {
        /* Uma recusa da RLS NÃO é um erro a esconder: é informação. Quem
           responde ao pedido precisa de saber que há um bloco que a sua conta
           não pode ler — para o pedir a quem pode, em vez de entregar um
           documento a que falta uma parte sem o dizer. */
        recusadas[t] = error.code === '42501' || error.code === 'PGRST301'
          ? 'Sem acesso a esta área com esta conta.'
          : (error.message || 'Não foi possível ler.')
        return
      }
      if (data && data.length) {
        const tirar = REDIGIR[t] || []
        dados[t] = tirar.length
          ? data.map((l: any) => Object.fromEntries(Object.entries(l).filter(([k]) => !tirar.includes(k))))
          : data
      }
    }))
  }

  return NextResponse.json({
    utente: {
      id: utente.id, nome: utente.name,
      nascimento: utente.date_of_birth, entrada: utente.admission_date,
    },
    feito_em: new Date().toISOString(),
    feito_por: user.email || user.id,
    /* As três listas, separadas de propósito: o que há, o que não se conseguiu
       ler, e o que nem se tentou. As duas últimas são o que distingue uma
       resposta completa de uma que só parece completa. */
    dados,
    recusadas,
    excluidas: FORA,
    tabelas_lidas: tabelas.length,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
