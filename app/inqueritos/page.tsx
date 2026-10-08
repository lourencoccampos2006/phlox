'use client'

// app/inqueritos/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Os inquéritos de satisfação. A regra e as contas vivem em lib/inqueritos.ts.
//
// ── O QUE ESTA PÁGINA TEM DE FAZER BEM ─────────────────────────────────────
// Três coisas, e a ordem é esta:
//
//   1. IMPRIMIR A FOLHA. Metade das respostas de um lar vêm em papel, com
//      alguém sentado ao lado a ler as perguntas em voz alta. Se o papel sair
//      mal, o inquérito não acontece.
//   2. LANÇAR UMA RESPOSTA DEPRESSA. Quarenta folhas para passar a computador
//      é uma tarde de trabalho. Cada resposta tem de se lançar sem rato, de
//      cima a baixo, e a seguinte abrir sozinha.
//   3. MOSTRAR O RESULTADO COM O `n` À FRENTE. Um 4,7 de três respostas e um
//      4,7 de quarenta não são a mesma frase.
//
// ── E A PROMESSA DE ANONIMATO APARECE DOS DOIS LADOS ───────────────────────
// A quem responde, para que acredite nela — sem isso, ninguém escreve o que
// pensa e o inquérito mede medo.
//
// E a quem lê os resultados, para que saiba que não vale a pena procurar: a
// informação não existe na base de dados (ver o cabeçalho do sprint178).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { ptDate } from '@/lib/ptTime'
import { printDoc } from '@/lib/print'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import { eFaltaDeSetup } from '@/lib/setupCodes'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Grupo,
  Vazio, ACarregar, Aviso, Codigo, Botao, Seletor, Campo, CAIXA, CAIXA_TEXTO,
  Linha, Numero, MONO, ROTULO, useLargo, type Tom,
} from '@/components/ui/mesa'
import {
  ESCALA, NAO_SEI, ROTULO_DO_PUBLICO, perguntasDe, analisar, piores,
  comQuantas, confianca, comparar, estaAberto, oQueFalta,
  folhaParaImprimir, relatorioParaImprimir,
  type Publico, type Pergunta, type Inquerito, type Resposta, type Analise,
  type ResultadoDaPergunta as Resultado,
} from '@/lib/inqueritos'

/**
 * Que tom é que uma média pede.
 *
 * ── TRÊS, E NÃO CINCO ──────────────────────────────────────────────────────
 * A primeira versão desta página pintava a barra de distribuição com um
 * degradê de cinco cores, uma por degrau da escala. Era bonito e não se lê:
 * ninguém decora um código de cinco cores para saber que o amarelo-torrado é
 * «fraco» e o amarelo-mostarda é «razoável».
 *
 * A regra 03 do sistema diz que a cor diz três coisas. Aqui são mesmo três, e
 * o resultado lê-se melhor: vê-se o tamanho da mancha vermelha contra o
 * tamanho da verde, que é a pergunta que se estava a fazer.
 */
function tomDaMedia(m: number | null): Tom {
  if (m == null) return 'neutro'
  if (m < 2.5) return 'mau'
  if (m < 3.5) return 'atencao'
  return 'bom'
}

const COR_DO_TOM: Record<Tom, string> = {
  mau: 'var(--red)', atencao: 'var(--amber)', bom: 'var(--green)', neutro: 'var(--ink-5)',
}

/** Quantas respostas caíram em cada um dos três tons. */
function porTom(distribuicao: Record<number, number>) {
  let mau = 0, atencao = 0, bom = 0
  for (const e of ESCALA) {
    const q = distribuicao[e.valor] || 0
    if (e.valor <= 2) mau += q
    else if (e.valor === 3) atencao += q
    else bom += q
  }
  return { mau, atencao, bom }
}

/* ══════════════════════════════════════════════════════════════════════════
   O RESULTADO DE UMA PERGUNTA
   ══════════════════════════════════════════════════════════════════════════
   O título, a média, a mancha e — sempre — de quantas respostas saiu. */

function ResultadoDaPergunta({ r }: { r: Resultado }) {
  const t = tomDaMedia(r.media)
  const { mau, atencao, bom } = porTom(r.distribuicao)
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        gap: 'var(--space-5)', alignItems: 'baseline',
      }}>
        <span style={{ fontSize: 'var(--texto-corpo)', color: 'var(--ink-2)' }}>{r.pergunta.texto}</span>
        <span style={{
          fontSize: 'var(--texto-corpo)', fontWeight: 'var(--peso-forte)' as any,
          color: COR_DO_TOM[t], fontVariantNumeric: 'tabular-nums', flexShrink: 0,
        }}>{r.media == null ? '—' : r.media.toFixed(1).replace('.', ',')}</span>
      </div>

      {r.n > 0 && (
        <div style={{
          display: 'flex', height: 8, borderRadius: 'var(--r-sm)',
          overflow: 'hidden', background: 'var(--bg-3)', marginTop: 'var(--space-2)',
        }}>
          {mau > 0 && <div title={`Mau ou fraco: ${mau}`} style={{ width: `${(mau / r.n) * 100}%`, background: 'var(--red)' }} />}
          {atencao > 0 && <div title={`Razoável: ${atencao}`} style={{ width: `${(atencao / r.n) * 100}%`, background: 'var(--amber)' }} />}
          {bom > 0 && <div title={`Bom ou muito bom: ${bom}`} style={{ width: `${(bom / r.n) * 100}%`, background: 'var(--green)' }} />}
        </div>
      )}

      <div style={{
        fontSize: 'var(--texto-detalhe)', color: 'var(--ink-4)', marginTop: 'var(--space-2)',
      }}>
        {comQuantas(r.n)}{r.naoSei ? ` · ${r.naoSei} «não sei»` : ''}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   A PÁGINA
   ══════════════════════════════════════════════════════════════════════════ */

export default function Inqueritos() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const hoje = ptDate()

  const [inqueritos, setInqueritos] = useState<Inquerito[]>([])
  const [respostasPorInquerito, setRespostas] = useState<Record<string, Resposta[]>>({})
  const [carregando, setCarregando] = useState(true)
  const [jaCarregou, setJaCarregou] = useState(false)
  const [semSetup, setSemSetup] = useState(false)
  const [erro, setErro] = useState('')

  const [aberto, setAberto] = useState<string | null>(null)
  const [aCriar, setACriar] = useState(false)
  const [aLancar, setALancar] = useState(false)

  const podeEditar = scope.pode('qualidade', 'ver') && scope.canEdit

  const carregar = useCallback(async () => {
    if (!user) { setCarregando(false); return }
    setCarregando(true)

    const { data: iq, error: e1 } = await supabase.from('inqueritos')
      .select('*').order('ano', { ascending: false }).order('aberto_em', { ascending: false })

    if (e1 && eFaltaDeSetup(e1)) {
      setSemSetup(true); setJaCarregou(true); setCarregando(false); return
    }
    setSemSetup(false)
    if (e1) { setErro('Não consegui ler os inquéritos.'); setJaCarregou(true); setCarregando(false); return }

    const lista = (iq || []) as Inquerito[]
    setInqueritos(lista)

    // As respostas de TODOS os inquéritos de uma vez, e não uma consulta por
    // inquérito: o tecto do plano gratuito do Supabase é o número de chamadas.
    if (lista.length) {
      const { data: rs, error: e2 } = await supabase.from('inqueritos_respostas')
        .select('inquerito_id,respostas,como,respondido_em')
        .in('inquerito_id', lista.map(i => i.id))
      if (e2) setErro('Li os inquéritos mas não as respostas.')
      const porId: Record<string, Resposta[]> = {}
      for (const r of (rs || []) as any[]) {
        (porId[r.inquerito_id] ||= []).push(r)
      }
      setRespostas(porId)
    } else {
      setRespostas({})
    }

    setJaCarregou(true)
    setCarregando(false)
  }, [user, supabase])

  useEffect(() => { carregar() }, [carregar])

  const emFoco = inqueritos.find(i => i.id === aberto) || null
  const respostasEmFoco = (emFoco && respostasPorInquerito[emFoco.id]) || []

  const analise: Analise | null = useMemo(() => {
    if (!emFoco) return null
    return analisar(emFoco.perguntas || [], respostasEmFoco, emFoco.convidados || 0)
  }, [emFoco, respostasEmFoco])

  /** O do ano anterior, do mesmo público — para a comparação. */
  const anterior = useMemo(() => {
    if (!emFoco) return null
    return inqueritos.find(i =>
      i.publico === emFoco.publico && i.ano === emFoco.ano - 1) || null
  }, [emFoco, inqueritos])

  const analiseAnterior = useMemo(() => {
    if (!anterior) return null
    return analisar(anterior.perguntas || [], respostasPorInquerito[anterior.id] || [],
      anterior.convidados || 0)
  }, [anterior, respostasPorInquerito])

  // `comparar(antes, agora)` — a ordem importa: trocada, uma descida aparece
  // como subida e ninguém repara, porque o número continua a ser plausível.
  const variacoes = useMemo(
    () => (analiseAnterior && analise ? comparar(analiseAnterior, analise) : []),
    [analiseAnterior, analise])

  /* ── Criar ──────────────────────────────────────────────────────────────── */
  const [novo, setNovo] = useState<{ publico: Publico; titulo: string; convidados: string }>(
    { publico: 'familias', titulo: '', convidados: '' })

  async function criar() {
    setErro('')
    const perguntas = perguntasDe(novo.publico)
    const ano = Number(hoje.slice(0, 4))
    const titulo = novo.titulo.trim() || `${ROTULO_DO_PUBLICO[novo.publico]} ${ano}`

    const { data, error } = await supabase.from('inqueritos').insert(scope.stamp({
      titulo, publico: novo.publico, ano,
      // A CÓPIA das perguntas, e não uma referência ao modelo. Ver a nota em
      // lib/inqueritos.ts: sem isto, as respostas de 2026 passam a ser lidas
      // com as perguntas de 2027.
      perguntas,
      convidados: Number(novo.convidados.replace(/\D/g, '')) || 0,
      aberto_em: hoje,
      codigo: Math.random().toString(36).slice(2, 8).toUpperCase(),
    })).select().maybeSingle()

    if (error) { setErro('Não consegui criar o inquérito.'); return }
    setACriar(false)
    setNovo({ publico: 'familias', titulo: '', convidados: '' })
    if (data) { setAberto(data.id); await carregar() }
  }

  async function fechar(i: Inquerito) {
    const { error } = await supabase.from('inqueritos')
      .update({ fechado_em: hoje }).eq('id', i.id)
    if (error) { setErro('Não consegui fechar o inquérito.'); return }
    await carregar()
  }

  /* ── Lançar uma resposta ────────────────────────────────────────────────── */
  const [folha, setFolha] = useState<Record<string, number | string | null>>({})
  const [aGravar, setAGravar] = useState(false)

  async function gravarResposta() {
    if (!emFoco) return
    setAGravar(true); setErro('')

    // ── NÃO LEVA `scope.stamp()`, E É DE PROPÓSITO ────────────────────────
    // O `stamp` acrescenta `user_id` e `recorded_by_id`. Numa resposta de
    // inquérito isso seria o fim do anonimato: bastava cruzar o `user_id` com
    // a escala do dia para saber quem estava ao lado de quem. Vai só o
    // `org_id`, que é o laço com a CASA e não com uma pessoa.
    const { error } = await supabase.from('inqueritos_respostas').insert({
      inquerito_id: emFoco.id,
      org_id: scope.orgId,
      respostas: folha,
      como: 'papel',
    })

    setAGravar(false)
    if (error) { setErro('Não consegui gravar a resposta.'); return }
    // A folha seguinte abre limpa, sem fechar o formulário: são quarenta.
    setFolha({})
    await carregar()
  }

  /* ── Imprimir ───────────────────────────────────────────────────────────
     Os documentos montam-se em lib/inqueritos.ts e não aqui. O papel é o
     canal principal deste módulo — se a folha sair sem a promessa de
     anonimato ou sem a escala, o inquérito não acontece — e dentro de um
     componente isso só se verificava com um browser aberto e um clique no
     botão de imprimir, que é o que não se faz em QA automático.
     Como dados, testam-se: scripts/teste-inqueritos.mjs. */

  /* ── Ecrã ───────────────────────────────────────────────────────────────── */
  if (!user) return null

  if (semSetup) {
    // A página não desaparece: quem lá chegou veio à procura de uma coisa, e
    // um retângulo cinzento sozinho não lhe diz sequer onde está.
    return (
      <Mesa barra={<BarraDeTrabalho>
        <span style={{ ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
          Inquéritos de satisfação
        </span>
      </BarraDeTrabalho>}>
        <Painel>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.55, maxWidth: '70ch', margin: '0 0 14px' }}>
              A Segurança Social pede que a satisfação dos {cfg.personNounPlural.toLowerCase()} e
              das famílias seja medida pelo menos uma vez por ano, analisada, e que daí saiam
              ações de melhoria. As respostas são anónimas: o programa não guarda quem respondeu o quê.
            </p>
            <AvisoDeSetup codigo="PHX-Y2"
              oQue="Os inquéritos de satisfação ainda não estão disponíveis nesta conta." />
          </div>
        </Painel>
      </Mesa>
    )
  }

  if (!scope.pode('qualidade', 'ver')) {
    return (
      <Mesa barra={<BarraDeTrabalho>
        <span style={{ ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
          Inquéritos de satisfação
        </span>
      </BarraDeTrabalho>}>
        <Painel>
          <Vazio titulo="Esta página é de quem acompanha a qualidade do serviço."
            oQueFazer="Se precisa de lá chegar, peça o acesso a quem gere a casa." />
        </Painel>
      </Mesa>
    )
  }

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{ ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
            Inquéritos
          </span>
          <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            {!jaCarregou ? 'a ver o que já há…'
              : inqueritos.length === 0 ? 'nenhum ainda'
              : `${inqueritos.length} ao todo`}
          </span>
          {emFoco && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
              {emFoco.titulo}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {!emFoco && podeEditar && !aCriar && (
              <Botao feitio="principal" onClick={() => setACriar(true)}>+ NOVO INQUÉRITO</Botao>
            )}
            {emFoco && <>
              <Botao onClick={() => printDoc(folhaParaImprimir(emFoco, cfg.unitNoun))}>IMPRIMIR A FOLHA</Botao>
              {analise && (
                <Botao onClick={() => printDoc(relatorioParaImprimir(emFoco, analise, cfg.unitNoun))}>
                  IMPRIMIR O RELATÓRIO
                </Botao>
              )}
              {podeEditar && estaAberto(emFoco) && (
                <Botao feitio="calmo" onClick={() => fechar(emFoco)}>FECHAR</Botao>
              )}
            </>}
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO }}>
            As respostas são anónimas por construção — não se guarda quem respondeu o quê.
          </span>
          <span style={{ marginLeft: 'auto', ...MONO }}>
            A Segurança Social pede a medição anual, a análise e as ações de melhoria.
          </span>
        </BarraDeEstado>
      }
    >
      <Painel>
      {erro && <Aviso tom="mau">{erro}</Aviso>}

      {/* ══ A LISTA ══════════════════════════════════════════════════════ */}
      {!emFoco && (
        <>
          {aCriar && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)', padding: 16 }}>
              <div style={{ ...MONO, color: 'var(--green)' }}>Novo inquérito</div>

              <Campo rotulo="A quem"
                ajuda={novo.publico === 'utentes'
                  ? `${perguntasDe('utentes').length} perguntas sobre o quarto, a comida, a higiene e a maneira como lhe falam. Pode imprimir a folha e dar em papel.`
                  : novo.publico === 'familias'
                    ? `${perguntasDe('familias').length} perguntas sobre a informação que recebem, o cuidado e o acolhimento. Pode imprimir a folha e dar em papel.`
                    : `${perguntasDe('equipa').length} perguntas sobre condições de trabalho, formação e coordenação.`}>
                <Seletor
                  opcoes={[
                    { id: 'utentes' as Publico, rotulo: cfg.personNounPlural },
                    { id: 'familias' as Publico, rotulo: ROTULO_DO_PUBLICO.familias },
                    { id: 'equipa' as Publico, rotulo: ROTULO_DO_PUBLICO.equipa },
                  ]}
                  ativa={novo.publico}
                  aoMudar={p => setNovo(n => ({ ...n, publico: p }))} />
              </Campo>

              <Campo rotulo="Quantas pessoas vão ser convidadas"
                ajuda="É o denominador da taxa de resposta — a primeira coisa que uma inspeção pergunta. Pode escrever-se depois.">
                <input value={novo.convidados} inputMode="numeric" id="convidados"
                  onChange={e => setNovo(n => ({ ...n, convidados: e.target.value }))}
                  placeholder="Ex.: 28"
                  style={{ ...CAIXA, maxWidth: 180 }} />
              </Campo>

              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-8)', flexWrap: 'wrap' }}>
                <Botao feitio="principal" onClick={criar}>Criar</Botao>
                <Botao feitio="calmo" onClick={() => setACriar(false)}>Cancelar</Botao>
              </div>
            </div>
          )}

          {!jaCarregou ? (
            <ACarregar oQue="A ver o que já há…" />
          ) : inqueritos.length === 0 && !aCriar ? (
            <Vazio
              titulo="Ainda não há nenhum inquérito."
              oQueFazer="Crie um, imprima a folha e distribua. As respostas lançam-se aqui à medida que voltarem."
              acao={podeEditar
                ? <Botao feitio="principal" onClick={() => setACriar(true)}>Novo inquérito</Botao>
                : undefined} />
          ) : (
            <div style={{ marginTop: 'var(--space-9)' }}>
              {inqueritos.map(i => {
                const rs = respostasPorInquerito[i.id] || []
                const a = analisar(i.perguntas || [], rs, i.convidados || 0)
                return (
                  <Linha key={i.id}
                    aoTocar={() => setAberto(i.id)}
                    titulo={i.titulo}
                    detalhe={<>
                      {ROTULO_DO_PUBLICO[i.publico]} · {comQuantas(a.respostas, i.convidados || 0)}
                      {a.global?.media != null && <> · no geral {a.global.media.toFixed(1).replace('.', ',')}</>}
                    </>}
                    fim={estaAberto(i)
                      ? <Codigo texto="ABERTO" cor="var(--green)" />
                      : <Codigo texto="FECHADO" />} />
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══ UM INQUÉRITO ═════════════════════════════════════════════════ */}
      {emFoco && analise && (
        <>
          <Botao feitio="calmo" onClick={() => { setAberto(null); setALancar(false) }}>
            ← Todos os inquéritos
          </Botao>

          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'var(--texto-seccao)',
            fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
            margin: 'var(--space-6) 0 0', lineHeight: 'var(--lh-apertado)',
          }}>{emFoco.titulo}</h2>

          {/* ── O que estes números aguentam ──────────────────────────── */}
          {(() => {
            const c = confianca(analise)
            return (
              <Aviso tom={c.nivel === 'poucas' ? 'mau' : c.nivel === 'alguma' ? 'atencao' : 'neutro'}>
                {c.frase}
                <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--texto-detalhe)', opacity: 0.85 }}>
                  As respostas são anónimas por construção — não se guarda quem respondeu o quê,
                  e por isso ninguém (nem o dono da casa) consegue descobrir.
                </div>
              </Aviso>
            )
          })()}

          {oQueFalta(emFoco, analise.respostas, hoje).map((f, n) => (
            <div key={n} style={{
              marginTop: 'var(--space-5)', fontSize: 'var(--texto-detalhe)',
              color: 'var(--ink-4)', lineHeight: 'var(--lh)',
              paddingLeft: 'var(--space-5)', borderLeft: '2px solid var(--border-2)',
            }}>{f}</div>
          ))}

          {/* ── Lançar uma resposta ───────────────────────────────────── */}
          {podeEditar && estaAberto(emFoco) && (
            <div style={{ marginTop: 'var(--space-10)' }}>
              {!aLancar ? (
                <Botao feitio="principal" onClick={() => { setALancar(true); setFolha({}) }}>
                  Lançar uma resposta em papel
                </Botao>
              ) : (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)', padding: 16 }}>
                  <div style={{ ...MONO, color: 'var(--green)' }}>Resposta em papel</div>
                  <p style={{
                    fontSize: 'var(--texto-detalhe)', color: 'var(--ink-4)',
                    margin: 'var(--space-3) 0 0', lineHeight: 'var(--lh)', maxWidth: 'var(--medida)',
                  }}>
                    Escreva o que está na folha. Não escreva de quem é — e não há aqui onde o fazer.
                  </p>

                  {(emFoco.perguntas || []).map((p: Pergunta, n: number) => (
                    <div key={p.id} style={{
                      padding: 'var(--space-6) 0',
                      borderTop: n ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{
                        fontSize: 'var(--texto-realce)', color: 'var(--ink)',
                        marginBottom: 'var(--space-3)', lineHeight: 'var(--lh-apertado)',
                      }}>
                        <span style={{ color: 'var(--ink-5)', marginRight: 6 }}>{n + 1}.</span>{p.texto}
                      </div>
                      {p.aberta ? (
                        <textarea rows={2} id={`p-${p.id}`}
                          value={(folha[p.id] as string) || ''}
                          onChange={e => setFolha(f => ({ ...f, [p.id]: e.target.value }))}
                          placeholder="Tal como está escrito na folha"
                          style={CAIXA_TEXTO} />
                      ) : (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          {[...ESCALA.map(e => ({ v: e.valor as number | null, r: e.rotulo })),
                            { v: null, r: NAO_SEI.rotulo }].map(op => (
                            <Botao key={String(op.v)}
                              feitio={p.id in folha && folha[p.id] === op.v ? 'principal' : 'contorno'}
                              onClick={() => setFolha(f => ({ ...f, [p.id]: op.v }))}>{op.r}</Botao>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-7)', flexWrap: 'wrap' }}>
                    <Botao feitio="principal" onClick={gravarResposta}
                      disabled={aGravar || Object.keys(folha).length === 0}>
                      {aGravar ? 'A gravar…' : 'Gravar e abrir a folha seguinte'}
                    </Botao>
                    <Botao feitio="calmo" onClick={() => setALancar(false)}>Terminar</Botao>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── O resultado ───────────────────────────────────────────── */}
          {analise.respostas === 0 ? (
            <Vazio titulo="Ainda não há respostas."
              oQueFazer="Imprima a folha, distribua, e lance aqui as que voltarem." />
          ) : (
            <>
              {analise.global?.media != null && (
                <div style={{ marginTop: 'var(--space-12)' }}>
                  <Numero
                    rotulo="No geral"
                    valor={analise.global.media.toFixed(1).replace('.', ',')}
                    unidade="em 5"
                    base={comQuantas(analise.global.n, emFoco.convidados || 0)}
                    tom={analise.global.media < 2.5 ? 'mau' : analise.global.media < 3.5 ? 'atencao' : 'bom'} />
                  <p style={{
                    fontSize: 'var(--texto-detalhe)', color: 'var(--ink-5)',
                    marginTop: 'var(--space-3)', lineHeight: 'var(--lh)', maxWidth: '56ch',
                  }}>
                    É a resposta à pergunta «{analise.global.pergunta.texto}», e não uma média de
                    tudo. As pessoas podem queixar-se de várias coisas e ainda assim gostar da casa.
                  </p>
                </div>
              )}

              {piores(analise, 5).length > 0 && (
                <Grupo titulo="Onde agir primeiro">
                  <div style={{ display: 'grid', gap: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
                    {piores(analise, 5).map(p => (
                      <ResultadoDaPergunta key={p.pergunta.id} r={p} />
                    ))}
                  </div>
                </Grupo>
              )}

              {analise.porDimensao.filter(d => d.perguntas.length).map(d => (
                <Grupo key={d.dimensao.id} titulo={d.dimensao.nome}
                  extra={`${d.media == null ? '—' : d.media.toFixed(1).replace('.', ',')} · ${comQuantas(d.n)}`}>
                  <div style={{ display: 'grid', gap: 'var(--space-5)', marginTop: 'var(--space-6)' }}>
                    {d.perguntas.map(p => <ResultadoDaPergunta key={p.pergunta.id} r={p} />)}
                  </div>
                </Grupo>
              ))}

              {analise.abertas.filter(x => x.textos.length).map(x => (
                <Grupo key={x.pergunta.id} titulo={x.pergunta.texto}>
                  <p style={{
                    fontSize: 'var(--texto-detalhe)', color: 'var(--ink-5)',
                    margin: 'var(--space-4) 0 0', lineHeight: 'var(--lh)',
                  }}>
                    Tal como foi escrito. É daqui que saem as ações concretas — não dos números.
                  </p>
                  <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
                    {x.textos.map((t, n) => (
                      <blockquote key={n} style={{
                        margin: 0, padding: 'var(--space-5) var(--space-6)',
                        borderLeft: '3px solid var(--green)', background: 'var(--bg-2)',
                        borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                        fontSize: 'var(--texto-corpo)', color: 'var(--ink-2)', lineHeight: 'var(--lh)',
                      }}>{t}</blockquote>
                    ))}
                  </div>
                </Grupo>
              ))}

              {variacoes.length > 0 && anterior && (
                <Grupo titulo={`Comparado com ${anterior.ano}`}>
                  <p style={{
                    fontSize: 'var(--texto-detalhe)', color: 'var(--ink-5)',
                    margin: 'var(--space-4) 0 0', lineHeight: 'var(--lh)',
                  }}>
                    Só as perguntas que existem nos dois anos e que tiveram respostas suficientes
                    dos dois lados.
                  </p>
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    {variacoes.map(v => (
                      <Linha key={v.pergunta.id}
                        titulo={v.pergunta.texto}
                        tom={v.diferenca < -0.3 ? 'mau' : v.diferenca > 0.3 ? 'bom' : 'neutro'}
                        fim={
                          <span style={{
                            fontSize: 'var(--texto-corpo)',
                            fontWeight: 'var(--peso-forte)' as any,
                            color: v.diferenca < 0 ? 'var(--red)' : v.diferenca > 0 ? 'var(--green)' : 'var(--ink-5)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {v.antes.toFixed(1).replace('.', ',')} → {v.agora.toFixed(1).replace('.', ',')}
                          </span>
                        } />
                    ))}
                  </div>
                </Grupo>
              )}
            </>
          )}
        </>
      )}
      </Painel>
    </Mesa>
  )
}
