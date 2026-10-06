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
import { blueprintFor } from '@/lib/institutionBlueprint'
import { ptDate } from '@/lib/ptTime'
import { printDoc } from '@/lib/print'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import { eFaltaDeSetup } from '@/lib/setupCodes'
import {
  ESCALA, NAO_SEI, ROTULO_DO_PUBLICO, perguntasDe, analisar, piores, melhores,
  comQuantas, confianca, comparar, estaAberto, oQueFalta,
  folhaParaImprimir, relatorioParaImprimir,
  type Publico, type Pergunta, type Inquerito, type Resposta, type Analise,
} from '@/lib/inqueritos'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

const campoStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 42,
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)',
}

const pt = (d: string | null | undefined) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '')

/** A cor de uma média. Não é decoração: é por onde os olhos entram na folha. */
function corDaMedia(m: number | null): string {
  if (m == null) return 'var(--ink-5)'
  if (m < 2.5) return '#b91c1c'
  if (m < 3.5) return '#b45309'
  return '#15803d'
}

/* ══════════════════════════════════════════════════════════════════════════
   A BARRA DE UMA PERGUNTA
   ══════════════════════════════════════════════════════════════════════════ */

function Barra({ distribuicao, n }: { distribuicao: Record<number, number>; n: number }) {
  if (!n) return null
  // Do pior para o melhor, da esquerda para a direita. Quem olha vê de
  // relance o tamanho da mancha vermelha, que é a pergunta toda.
  const cores = ['#b91c1c', '#ea580c', '#ca8a04', '#65a30d', '#15803d']
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-3)' }}>
      {ESCALA.map((e, i) => {
        const quantas = distribuicao[e.valor] || 0
        if (!quantas) return null
        return (
          <div key={e.valor}
            title={`${e.rotulo}: ${quantas}`}
            style={{ width: `${(quantas / n) * 100}%`, background: cores[i] }} />
        )
      })}
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
  const cor = blueprintFor(institution).accent
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
      <div style={{ padding: 'var(--space-11) clamp(16px,3vw,32px) var(--space-18)', maxWidth: 640, margin: '0 auto' }}>
        <span style={{ ...MONO, color: cor }}>Qualidade</span>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 500,
          color: 'var(--ink)', letterSpacing: '-0.025em', margin: 'var(--space-4) 0 var(--space-6)', lineHeight: 1.1,
        }}>Inquéritos de satisfação</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: '0 0 var(--space-8)', lineHeight: 1.6 }}>
          A Segurança Social pede que a satisfação dos {cfg.personNounPlural.toLowerCase()} e das
          famílias seja medida pelo menos uma vez por ano, analisada, e que daí saiam ações de
          melhoria. As respostas são anónimas: o programa não guarda quem respondeu o quê.
        </p>
        <AvisoDeSetup codigo="PHX-Y2"
          oQue="Os inquéritos de satisfação ainda não estão disponíveis nesta conta." />
      </div>
    )
  }

  if (!scope.pode('qualidade', 'ver')) {
    return (
      <div style={{ padding: 'var(--space-14)', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Esta página é de quem acompanha a qualidade do serviço.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-11) clamp(16px,3vw,32px) var(--space-18)', maxWidth: 920, margin: '0 auto' }}>

      <header style={{ marginBottom: 'var(--space-9)' }}>
        <span style={{ ...MONO, color: cor }}>Qualidade</span>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 500,
          color: 'var(--ink)', letterSpacing: '-0.025em', margin: 'var(--space-4) 0 0', lineHeight: 1.1,
        }}>Inquéritos de satisfação</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: 'var(--space-5) 0 0', lineHeight: 1.55, maxWidth: '58ch' }}>
          {!jaCarregou ? 'A ver o que já há…'
            : inqueritos.length === 0
              ? 'A Segurança Social pede que a satisfação dos utentes e das famílias seja medida '
                + 'pelo menos uma vez por ano, analisada, e que daí saiam ações de melhoria.'
              : `${inqueritos.length} inquérito${inqueritos.length > 1 ? 's' : ''}. `
                + 'As respostas são anónimas: o programa não guarda quem respondeu o quê.'}
        </p>
      </header>

      {erro && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030',
          fontSize: 13, fontWeight: 600,
        }}>{erro}</div>
      )}

      {/* ── A lista ────────────────────────────────────────────────────────── */}
      {!emFoco && (
        <>
          {podeEditar && !aCriar && (
            <button onClick={() => setACriar(true)} style={{
              minHeight: 44, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
              background: cor, color: '#fff', fontFamily: 'inherit', fontSize: 14,
              fontWeight: 700, cursor: 'pointer', marginBottom: 'var(--space-8)',
            }}>Novo inquérito</button>
          )}

          {aCriar && (
            <div style={{
              marginBottom: 'var(--space-9)', padding: 'var(--space-7)',
              borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface-2)',
            }}>
              <div style={{ ...MONO, color: cor, marginBottom: 'var(--space-5)' }}>Novo inquérito</div>

              <label style={{ ...MONO, fontSize: 9.5, display: 'block', marginBottom: 4 }}>A quem</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
                {(['utentes', 'familias', 'equipa'] as Publico[]).map(p => {
                  const on = novo.publico === p
                  return (
                    <button key={p} onClick={() => setNovo(n => ({ ...n, publico: p }))} style={{
                      minHeight: 40, padding: '0 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                      border: `1.5px solid ${on ? cor : 'var(--border)'}`,
                      background: on ? cor : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
                      fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                    }}>{p === 'utentes' ? cfg.personNounPlural : ROTULO_DO_PUBLICO[p]}</button>
                  )
                })}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-5)', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
                {novo.publico === 'utentes'
                  ? `${perguntasDe('utentes').length} perguntas sobre o quarto, a comida, a higiene, a maneira como lhe falam.`
                  : novo.publico === 'familias'
                    ? `${perguntasDe('familias').length} perguntas sobre a informação que recebem, o cuidado e o acolhimento.`
                    : `${perguntasDe('equipa').length} perguntas sobre condições de trabalho, formação e coordenação.`}
                {' '}Pode imprimir a folha e dar em papel.
              </div>

              <label style={{ ...MONO, fontSize: 9.5, display: 'block', marginBottom: 4 }}>
                Quantas pessoas vão ser convidadas
              </label>
              <input value={novo.convidados} inputMode="numeric"
                onChange={e => setNovo(n => ({ ...n, convidados: e.target.value }))}
                placeholder="Ex.: 28"
                style={{ ...campoStyle, maxWidth: 160 }} />
              <div style={{ fontSize: 12.5, color: 'var(--ink-5)', margin: '6px 0 var(--space-6)', lineHeight: 1.5 }}>
                É o denominador da taxa de resposta — a primeira coisa que uma inspeção pergunta.
                Pode escrever-se depois.
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={criar} style={{
                  minHeight: 44, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
                  background: cor, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>Criar</button>
                <button onClick={() => setACriar(false)} style={{
                  minHeight: 44, padding: '0 16px', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--ink-4)', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
                }}>Cancelar</button>
              </div>
            </div>
          )}

          {jaCarregou && inqueritos.length === 0 && !aCriar && (
            <p style={{ fontSize: 14, color: 'var(--ink-5)', lineHeight: 1.6 }}>
              Ainda não há nenhum inquérito.
            </p>
          )}

          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            {inqueritos.map(i => {
              const rs = respostasPorInquerito[i.id] || []
              const a = analisar(i.perguntas || [], rs, i.convidados || 0)
              return (
                <button key={i.id} onClick={() => setAberto(i.id)} style={{
                  textAlign: 'left', padding: 'var(--space-6)', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  cursor: 'pointer', fontFamily: 'inherit', display: 'block', width: '100%',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{i.titulo}</span>
                    <span style={{ ...MONO, color: estaAberto(i) ? '#15803d' : 'var(--ink-5)' }}>
                      {estaAberto(i) ? 'Aberto' : `Fechado a ${pt(i.fechado_em)}`}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-4)', marginTop: 5, lineHeight: 1.5 }}>
                    {ROTULO_DO_PUBLICO[i.publico]} · {comQuantas(a.respostas, i.convidados || 0)}
                    {a.global?.media != null && (
                      <> · no geral <strong style={{ color: corDaMedia(a.global.media) }}>
                        {a.global.media.toFixed(1).replace('.', ',')}
                      </strong></>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Um inquérito ───────────────────────────────────────────────────── */}
      {emFoco && analise && (
        <>
          <button onClick={() => { setAberto(null); setALancar(false) }} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            ...MONO, color: 'var(--ink-4)', marginBottom: 'var(--space-7)',
          }}>← Todos os inquéritos</button>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500,
              color: 'var(--ink)', margin: 0,
            }}>{emFoco.titulo}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => printDoc(folhaParaImprimir(emFoco, cfg.unitNoun))} style={{
                minHeight: 40, padding: '0 14px', borderRadius: 'var(--r-md)',
                border: `1px solid ${cor}`, background: 'transparent', color: cor,
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              }}>Imprimir a folha</button>
              <button onClick={() => printDoc(relatorioParaImprimir(emFoco, analise, cfg.unitNoun))} style={{
                minHeight: 40, padding: '0 14px', borderRadius: 'var(--r-md)',
                border: `1px solid ${cor}`, background: 'transparent', color: cor,
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              }}>Imprimir o relatório</button>
              {podeEditar && estaAberto(emFoco) && (
                <button onClick={() => fechar(emFoco)} style={{
                  minHeight: 40, padding: '0 14px', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--ink-4)', fontFamily: 'inherit', fontSize: 13.5, cursor: 'pointer',
                }}>Fechar</button>
              )}
            </div>
          </div>

          {/* ── O que estes números aguentam ──────────────────────────────── */}
          {(() => {
            const c = confianca(analise)
            const fundo = c.nivel === 'poucas' ? '#fef2f2' : c.nivel === 'alguma' ? '#fffbeb' : 'var(--surface-2)'
            const borda = c.nivel === 'poucas' ? '#fecaca' : c.nivel === 'alguma' ? '#fde68a' : 'var(--border)'
            const tinta = c.nivel === 'poucas' ? '#991b1b' : c.nivel === 'alguma' ? '#78350f' : 'var(--ink-4)'
            return (
              <div style={{
                marginTop: 'var(--space-7)', padding: 'var(--space-6)', borderRadius: 'var(--r-md)',
                background: fundo, border: `1px solid ${borda}`,
              }}>
                <div style={{ fontSize: 14, color: tinta, lineHeight: 1.6 }}>{c.frase}</div>
                <div style={{ fontSize: 12.5, color: tinta, marginTop: 8, lineHeight: 1.55, opacity: 0.85 }}>
                  As respostas são anónimas por construção — não se guarda quem respondeu o quê,
                  e por isso ninguém (nem o dono da casa) consegue descobrir.
                </div>
              </div>
            )
          })()}

          {oQueFalta(emFoco, analise.respostas, hoje).map((f, n) => (
            <div key={n} style={{
              marginTop: 'var(--space-5)', fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55,
              paddingLeft: 12, borderLeft: '2px solid var(--border-2)',
            }}>{f}</div>
          ))}

          {/* ── Lançar uma resposta ───────────────────────────────────────── */}
          {podeEditar && estaAberto(emFoco) && (
            <div style={{ marginTop: 'var(--space-9)' }}>
              {!aLancar ? (
                <button onClick={() => { setALancar(true); setFolha({}) }} style={{
                  minHeight: 44, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
                  background: cor, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>Lançar uma resposta em papel</button>
              ) : (
                <div style={{
                  padding: 'var(--space-7)', borderRadius: 'var(--r-md)',
                  border: `1.5px solid ${cor}`, background: 'var(--surface)',
                }}>
                  <div style={{ ...MONO, color: cor }}>Resposta em papel</div>
                  <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '6px 0 var(--space-7)', lineHeight: 1.55 }}>
                    Escreva o que está na folha. Não escreva de quem é — e não há aqui onde o fazer.
                  </p>

                  {(emFoco.perguntas || []).map((p: Pergunta, n: number) => (
                    <div key={p.id} style={{
                      padding: 'var(--space-5) 0', borderTop: n ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ fontSize: 14.5, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.4 }}>
                        <span style={{ color: 'var(--ink-5)', marginRight: 6 }}>{n + 1}.</span>{p.texto}
                      </div>
                      {p.aberta ? (
                        <textarea rows={2}
                          value={(folha[p.id] as string) || ''}
                          onChange={e => setFolha(f => ({ ...f, [p.id]: e.target.value }))}
                          placeholder="Tal como está escrito na folha"
                          style={{ ...campoStyle, resize: 'vertical' }} />
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[...ESCALA.map(e => ({ v: e.valor as number | null, r: e.rotulo })),
                            { v: null, r: NAO_SEI.rotulo }].map(op => {
                            const on = p.id in folha && folha[p.id] === op.v
                            return (
                              <button key={String(op.v)}
                                onClick={() => setFolha(f => ({ ...f, [p.id]: op.v }))}
                                style={{
                                  minHeight: 40, padding: '0 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                                  border: `1.5px solid ${on ? cor : 'var(--border)'}`,
                                  background: on ? cor : 'transparent',
                                  color: on ? '#fff' : 'var(--ink-3)',
                                  fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500,
                                }}>{op.r}</button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-7)', flexWrap: 'wrap' }}>
                    <button onClick={gravarResposta} disabled={aGravar || Object.keys(folha).length === 0} style={{
                      minHeight: 44, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
                      background: Object.keys(folha).length ? cor : 'var(--bg-3)',
                      color: Object.keys(folha).length ? '#fff' : 'var(--ink-5)',
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                      cursor: Object.keys(folha).length && !aGravar ? 'pointer' : 'default',
                    }}>{aGravar ? 'A gravar…' : 'Gravar e abrir a folha seguinte'}</button>
                    <button onClick={() => setALancar(false)} style={{
                      minHeight: 44, padding: '0 16px', borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--ink-4)', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
                    }}>Terminar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── O resultado ───────────────────────────────────────────────── */}
          {analise.respostas > 0 && (
            <>
              {analise.global?.media != null && (
                <div style={{ marginTop: 'var(--space-11)' }}>
                  <div style={{ ...MONO, color: cor }}>No geral</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                    <span style={{
                      fontFamily: 'var(--font-serif)', fontSize: 44, lineHeight: 1,
                      color: corDaMedia(analise.global.media), fontWeight: 500,
                    }}>{analise.global.media.toFixed(1).replace('.', ',')}</span>
                    <span style={{ fontSize: 13.5, color: 'var(--ink-4)' }}>
                      em 5 · {comQuantas(analise.global.n, emFoco.convidados || 0)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-5)', marginTop: 6, lineHeight: 1.5, maxWidth: '56ch' }}>
                    É a resposta à pergunta «{analise.global.pergunta.texto}», e não uma média de
                    tudo. As pessoas podem queixar-se de várias coisas e ainda assim gostar da casa.
                  </div>
                </div>
              )}

              {piores(analise, 5).length > 0 && (
                <div style={{ marginTop: 'var(--space-10)' }}>
                  <div style={{ ...MONO, color: '#991b1b' }}>Onde agir primeiro</div>
                  <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
                    {piores(analise, 5).map(p => (
                      <div key={p.pergunta.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 14, color: 'var(--ink)' }}>{p.pergunta.texto}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: corDaMedia(p.media) }}>
                            {p.media!.toFixed(1).replace('.', ',')}
                          </span>
                        </div>
                        <div style={{ marginTop: 5 }}><Barra distribuicao={p.distribuicao} n={p.n} /></div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 3 }}>{comQuantas(p.n)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Por dimensão */}
              <div style={{ marginTop: 'var(--space-11)' }}>
                <div style={{ ...MONO, color: cor }}>Por dimensão</div>
                {analise.porDimensao.filter(d => d.perguntas.length).map(d => (
                  <section key={d.dimensao.id} style={{ marginTop: 'var(--space-7)' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      gap: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{d.dimensao.nome}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: corDaMedia(d.media) }}>
                        {d.media == null ? '—' : d.media.toFixed(1).replace('.', ',')}
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-5)', marginLeft: 6 }}>
                          {comQuantas(d.n)}
                        </span>
                      </span>
                    </div>
                    {d.perguntas.map(p => (
                      <div key={p.pergunta.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>{p.pergunta.texto}</span>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: corDaMedia(p.media) }}>
                            {p.media == null ? '—' : p.media.toFixed(1).replace('.', ',')}
                          </span>
                        </div>
                        <div style={{ marginTop: 5 }}><Barra distribuicao={p.distribuicao} n={p.n} /></div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 3 }}>
                          {comQuantas(p.n)}{p.naoSei ? ` · ${p.naoSei} «não sei»` : ''}
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>

              {/* O que escreveram */}
              {analise.abertas.filter(x => x.textos.length).map(x => (
                <div key={x.pergunta.id} style={{ marginTop: 'var(--space-10)' }}>
                  <div style={{ ...MONO, color: cor }}>{x.pergunta.texto}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-5)', margin: '6px 0 var(--space-5)', lineHeight: 1.5 }}>
                    Tal como foi escrito. É daqui que saem as ações concretas — não dos números.
                  </div>
                  <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    {x.textos.map((t, n) => (
                      <blockquote key={n} style={{
                        margin: 0, padding: '10px 14px', borderLeft: `3px solid ${cor}`,
                        background: 'var(--surface-2)', borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                        fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55,
                      }}>{t}</blockquote>
                    ))}
                  </div>
                </div>
              ))}

              {/* Comparação com o ano anterior */}
              {variacoes.length > 0 && anterior && (
                <div style={{ marginTop: 'var(--space-11)' }}>
                  <div style={{ ...MONO, color: cor }}>Comparado com {anterior.ano}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-5)', margin: '6px 0 var(--space-5)', lineHeight: 1.5 }}>
                    Só as perguntas que existem nos dois anos e que tiveram respostas suficientes
                    dos dois lados.
                  </div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {variacoes.map(v => (
                      <div key={v.pergunta.id} style={{
                        display: 'flex', justifyContent: 'space-between', gap: 10,
                        alignItems: 'baseline', fontSize: 13.5,
                      }}>
                        <span style={{ color: 'var(--ink-3)' }}>{v.pergunta.texto}</span>
                        <span style={{ fontWeight: 700, color: v.diferenca < 0 ? '#b91c1c' : v.diferenca > 0 ? '#15803d' : 'var(--ink-5)' }}>
                          {v.antes.toFixed(1).replace('.', ',')} → {v.agora.toFixed(1).replace('.', ',')}
                          <span style={{ marginLeft: 6, fontSize: 12 }}>
                            ({v.diferenca > 0 ? '+' : ''}{v.diferenca.toFixed(1).replace('.', ',')})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {analise.respostas === 0 && (
            <p style={{ marginTop: 'var(--space-9)', fontSize: 14, color: 'var(--ink-5)', lineHeight: 1.6 }}>
              Ainda não há respostas. Imprima a folha, distribua, e lance aqui as que voltarem.
            </p>
          )}
        </>
      )}
    </div>
  )
}
