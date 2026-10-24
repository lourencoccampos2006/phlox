// app/api/medicamento-ficha/route.ts
// ───────────────────────────────────────────────────────────────────────────
// O rótulo de um medicamento, da cache ou do OpenFDA.
//
// É a mesma `lib/efeitosDaMedicacao` que serve o cruzamento com as ocorrências
// — de propósito: se a ficha mostrasse uma lista de efeitos e o cruzamento
// usasse outra, as duas acabariam por discordar e ninguém saberia qual seguir.
//
// Precisa de sessão, mas não de pertencer a uma casa: o que está aqui é
// referência pública (o que o fabricante publicou), e não há aqui dado de
// pessoa nenhuma. Esconder a bula de um medicamento a quem está a cuidar de
// alguém não protege nada.
//
// ── MAS «TER TOKEN» NÃO É «TER SESSÃO» (2026-10-13) ────────────────────────
// Estava escrito assim:
//
//     const token = getToken(req)
//     if (!token) return 401
//     const supabase = makeSupabase(token)
//
// O `makeSupabase` não valida nada — pendura a cadeia num cabeçalho e segue.
// Quem é que a valida? O Supabase, quando a consulta chega lá. Só que a
// consulta ao Supabase é uma CACHE, e a cache é um atalho e não uma condição
// (ver `efeitosDe`): falhando, o código vai à mesma ao OpenFDA e escreve o
// resultado na `medicamento_efeitos` COM A CHAVE DE SERVIÇO.
//
// Resultado: um `Authorization: Bearer xpto` — qualquer coisa, desde que não
// vazia — passava o 401 e chegava às duas pontas que importam: pedidos à rede
// a partir do nosso servidor, e escritas com a chave de serviço numa tabela
// que todas as casas leem. Sem sessão e sem tecto nenhum de pedidos.
//
// É a outra metade do buraco que a `lib/rotuloFDA.ts` fechou. Lá tirei o
// endereço que se podia falsificar; faltava exigir que houvesse mesmo alguém
// do outro lado. Agora pergunta-se ao Supabase quem é o dono do token ANTES
// de qualquer outra coisa, e há um tecto de pedidos como na /api/drug-reference.
import { NextRequest, NextResponse } from 'next/server'
import { makeSupabase, getToken } from '@/lib/orgAuth'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { efeitosDe } from '@/lib/efeitosDaMedicacao'
import { explicarMedicamento, ORIGEM_DA_LEITURA } from '@/lib/explicarMedicamento'

export const runtime = 'nodejs'
/* 120s e não os 60 do tecto geral.
   Na PRIMEIRA abertura de um medicamento esta rota faz três coisas em fila:
   normaliza o nome no RxNorm, vai buscar o rótulo ao OpenFDA (duas chamadas
   com 7s de timeout cada, e até quatro tentativas de nome em português), e
   só depois lê a bula com IA. Nas seguintes vem tudo da cache em milissegundos.

   O check-orcamento-rotas não a apanha porque procura o `maxTokens` no
   ficheiro da rota, e a chamada de IA está na lib. Fica aqui dito para quem
   leia o guarda e estranhe a ausência. */
export const maxDuration = 120

export async function GET(req: NextRequest) {
  // O tecto é por IP e vem antes da validação: validar um token custa uma ida
  // ao Supabase, e um tecto que só conta pedidos válidos não trava quem manda
  // lixo.
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()

  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })

  const nome = (req.nextUrl.searchParams.get('nome') || '').trim()
  if (nome.length < 2) return NextResponse.json({ error: 'Falta o nome.' }, { status: 400 })

  const supabase = makeSupabase(token)

  /* Quem é? Se o token não corresponder a ninguém, pára aqui — antes do
     OpenFDA e antes de qualquer escrita. */
  const { data: quem, error: erroSessao } = await supabase.auth.getUser()
  if (erroSessao || !quem?.user) {
    return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })
  }

  const f = await efeitosDe(supabase, nome)

  /* ── A LEITURA EM PORTUGUÊS ─────────────────────────────────────────────
     Pedida pelo Fernando: «lê todo o texto com IA, traduz, e coloca de
     maneira que dê para entender melhor».

     Vai no MESMO pedido e não num segundo: a ficha abre uma vez e tem de
     abrir pronta. Com duas chamadas, o ecrã mostrava a prosa inglesa e
     trocava-a por português meio segundo depois — e um texto que muda debaixo
     dos olhos de quem está a ler lê-se duas vezes.

     Guardada, custa uma chamada de IA por medicamento e nunca mais; por isso
     esperar por ela só acontece a quem for o primeiro a abrir aquele
     medicamento, em qualquer casa.

     Falhando, a ficha mostra o texto do fabricante como mostrava antes. É o
     que já lá estava, e é melhor do que um erro. */
  const { explicacao } = f?.encontrado
    ? await explicarMedicamento(supabase, nome, f).catch(() => ({ explicacao: null }))
    : { explicacao: null }

  /* Sem rótulo e sem cache, devolve-se um registo HONESTO em vez de um 404.
     A ficha precisa de poder dizer «não encontrámos», que é diferente de
     «falhou» — e um 404 na consola faria a página mostrar um erro quando o
     que há é ausência de informação. */
  if (!f) {
    return NextResponse.json({
      encontrado: false, nome_original: nome,
      indicacoes: null, texto_adversos: null, avisos: null, interacoes: null,
      fonte: null, efeitos: [], explicacao: null, origemDaLeitura: null,
    })
  }

  return NextResponse.json({
    encontrado: f.encontrado,
    /* O que se mostra é o que ESTA pessoa escreveu, não o que está guardado.
       A linha é partilhada por todas as casas e o `nome_original` guardado é
       agora o nome normalizado pela FDA — ver a nota em
       `lib/efeitosDaMedicacao.ts`. Aqui devolve-se o termo desta procura, que
       é o que faz sentido ver em cima de uma ficha que se acabou de abrir. */
    nome_original: nome,
    indicacoes: f.indicacoes,
    texto_adversos: f.texto_adversos,
    avisos: f.avisos,
    interacoes: f.interacoes,
    fonte: f.fonte,
    efeitos: f.efeitos || [],
    explicacao,
    origemDaLeitura: explicacao ? ORIGEM_DA_LEITURA : null,
  })
}
