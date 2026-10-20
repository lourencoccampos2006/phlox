'use client'

// components/o-dia/DesenhoD.tsx
// ─────────────────────────────────────────────────────────────────────────────
// DESENHO D — «A mesa de trabalho»
//
// ── O QUE O FERNANDO DISSE, E O QUE ISSO QUER DIZER ────────────────────────
// Sobre o desenho C: «parece muito infantil, tipo um software de brincar».
// E o que quer: «mais informação, mais complexidade, parecer mais profissional
// — mas fácil de interagir e perceber».
//
// Tem razão. O C tinha cartões grandes, emoji e três palavras por pessoa. Isso
// é a gramática de uma aplicação de consumo, e esta é uma ferramenta clínica
// que alguém usa sete horas por dia.
//
// ── O QUE FAZ UM PROGRAMA PARECER SÉRIO ────────────────────────────────────
// Não é ser escuro nem ter ângulos rectos. É isto, e é tudo verificável:
//
//   1. DENSIDADE COM ESTRUTURA. Muita informação por ecrã, mas alinhada em
//      colunas que se leem de cima a baixo. O que cansa não é a quantidade —
//      é a desordem.
//   2. ZERO EMOJI. É o sinal número um de «software de brincar». No lugar
//      deles, códigos de três letras com cor própria (MED, CUI, ATV), que é
//      como as folhas de serviço de uma casa já estão escritas.
//   3. MONOESPAÇADA EM TUDO O QUE É NÚMERO. Horas, doses, quartos, contagens.
//      Alinham em coluna e leem-se de relance.
//   4. LINHAS FINAS, NÃO SOMBRAS. Uma sombra diz «cartão»; uma linha de 1px
//      diz «tabela». Uma tabela parece um instrumento.
//   5. ESTADO POR CÓDIGO, NÃO POR DECORAÇÃO. Quatro cores com significado
//      fixo e uma legenda. Nunca mais do que quatro.
//   6. MOSTRAR O QUE O SISTEMA SABE. Idade, dieta, alergias, risco de queda,
//      mobilidade, progresso por área. A sensação de «isto é sério» vem de a
//      ferramenta saber muito sobre a pessoa e dizê-lo sem lhe pedirem.
//
// ── E A FACILIDADE NÃO SE PERDE ────────────────────────────────────────────
// Denso não é apertado. A linha de cada pessoa continua a ser UM alvo grande,
// e dentro dela cada toma é outro. O que encolheu foi o espaço desperdiçado,
// não os sítios onde se toca.
//
// ── DUAS COLUNAS NO COMPUTADOR, UMA NO TELEMÓVEL ───────────────────────────
// No computador: a lista à esquerda, a pessoa escolhida à direita, as duas ao
// mesmo tempo. É o que distingue uma mesa de trabalho de um site — não se
// perde o contexto para ver o detalhe.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { anosDesde } from '@/lib/estatisticas'
import { COR_DA_FONTE, ROTULO_DA_FONTE, type Tarefa, type Fonte } from '@/lib/oDia'
import type { DadosDoDia } from './tipos'

/* ══════════════════════════════════════════════════════════════════════════
   A PALETA
   ══════════════════════════════════════════════════════════════════════════
   Neutros frios, de instrumento. E QUATRO cores de estado, com significado
   fixo em todo o ecrã — a quinta cor é o princípio do fim. */
const CHAO = 'var(--bg-3)'
const PAINEL = 'var(--bg)'
const RISCA = 'var(--blue-light)'
const RISCA_F = 'var(--border-2)'
const TINTA = 'var(--ink)'
const TINTA_2 = 'var(--badge-blue-fg)'
const TINTA_3 = 'var(--blue)'
const TINTA_4 = 'var(--ink-5)'

const CRITICO = 'var(--red)'   // em atraso, ou alergia
const AVISO   = 'var(--amber)'   // a precisar de confirmação
const FEITO   = 'var(--green-3)'   // tratado
const MARCA   = 'var(--green)'   // a casa

/** O código de três letras de cada fonte. Substitui os emoji. */
const CODIGO: Record<Fonte, string> = {
  medicacao: 'MED', servico: 'CUI', plano: 'PLN',
  atividade: 'ATV', apoio: 'APO', reforco: 'REF',
}

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
}

/** A etiqueta de uma fonte: três letras, na cor dela. */
function Codigo({ fonte, apagado }: { fonte: Fonte; apagado?: boolean }) {
  return (
    <span style={{
      ...mono, fontSize: 'var(--t-micro)', letterSpacing: '.09em', fontWeight: 'var(--peso-corpo)' as any,
      padding: '2px 5px', borderRadius: 3,
      color: apagado ? TINTA_4 : COR_DA_FONTE[fonte],
      border: `1px solid ${apagado ? RISCA : COR_DA_FONTE[fonte] + '55'}`,
      background: apagado ? 'transparent' : COR_DA_FONTE[fonte] + '0f',
      whiteSpace: 'nowrap',
    }}>{CODIGO[fonte] || '—'}</span>
  )
}

/** Uma bandeira clínica: «ALERG», «QUEDA», «DIETA». Só aparece se for verdade. */
function Bandeira({ texto, tom }: { texto: string; tom: 'critico' | 'aviso' | 'neutro' }) {
  const cor = tom === 'critico' ? CRITICO : tom === 'aviso' ? AVISO : TINTA_3
  return (
    <span title={texto} style={{
      ...mono, fontSize: 'var(--t-micro)', letterSpacing: '.07em', fontWeight: 'var(--peso-corpo)' as any,
      color: cor, border: `1px solid ${cor}44`, background: cor + '0d',
      padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap',
      maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{texto}</span>
  )
}

/**
 * A barra de uma área: feito / total, em segmentos.
 *
 * Segmentos e não uma barra contínua: com quatro tomas, uma barra a 75% não
 * diz «falta uma», diz «falta um bocado». Os segmentos contam-se.
 */
function Barra({ feitos, total, cor }: { feitos: number; total: number; cor: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: Math.min(total, 10) }).map((_, i) => (
        <span key={i} style={{
          width: 9, height: 6, borderRadius: 1.5,
          background: i < feitos ? cor : RISCA_F,
        }} />
      ))}
      {total > 10 && <span style={{ ...mono, fontSize: 'var(--t-micro)', color: TINTA_4 }}>+{total - 10}</span>}
    </span>
  )
}

interface Pessoa {
  id: string
  nome: string
  quarto: string | null
  idade: number | null
  sexo: string | null
  dieta: string | null
  alergias: string | null
  riscoQueda: string | null
  mobilidade: string | null
  tarefas: Tarefa[]
  porFazer: number
  emAtraso: number
  /** `{ medicacao: { feitos, total } , … }` — só as áreas que esta pessoa tem. */
  porArea: { fonte: Fonte; feitos: number; total: number }[]
}

const ORDEM_DAS_AREAS: Fonte[] = ['medicacao', 'servico', 'plano', 'reforco', 'apoio', 'atividade']

/* ══════════════════════════════════════════════════════════════════════════
   O ECRÃ
   ══════════════════════════════════════════════════════════════════════════ */
export default function DesenhoD({ d }: { d: DadosDoDia }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()

  /* ── O que a ficha sabe ─────────────────────────────────────────────────
     A sensação de «isto é um sistema a sério» vem daqui: o programa já sabe
     a idade, a dieta, as alergias e o risco de queda de cada pessoa, e até
     agora não dizia nada disso no ecrã onde se trabalha. */
  const [fichas, setFichas] = useState<Map<string, any>>(new Map())
  const carregar = useCallback(async () => {
    if (!user || !scope.orgId) return
    const { data, error } = await supabase.from('patients')
      .select('id,name,room_number,date_of_birth,birth_date,age,sex,diet,allergies,fall_risk,mobility')
      .eq('org_id', scope.orgId).eq('active', true)
    if (error) return
    setFichas(new Map((data || []).map((p: any) => [p.id, p])))
  }, [user, supabase, scope.orgId])
  useEffect(() => { carregar() }, [carregar])

  /* ══════════════════════════════════════════════════════════════════════
     A MESA TEM A ALTURA DA JANELA
     ══════════════════════════════════════════════════════════════════════
     ── PORQUE E QUE ISTO NAO E UMA PAGINA QUE ROLA ──────────────────────
     Uma pagina que rola e um documento: o cabecalho vai-se embora, a legenda
     fica a meio do nada, e por baixo do conteudo sobra meio ecra em branco.
     Foi o que o Fernando viu e disse: «usa mais a pagina, a legenda podia
     ficar em baixo, e nao ter tanto espaco vazio».

     Uma MESA DE TRABALHO nao rola. Tem a altura do ecra, a barra fica em
     cima, a legenda fica em baixo, e o que rola e o conteudo DENTRO de cada
     painel. E a diferenca entre abrir um site e abrir um programa.

     A altura mede-se, nao se adivinha: a moldura da aplicacao (cabecalho e
     barra de menus) muda de altura entre o computador e o telemovel, e um
     `100vh - 140px` escrito a mao fica errado num deles.
     ══════════════════════════════════════════════════════════════════════ */
  const raiz = useRef<HTMLDivElement>(null)
  const [altura, setAltura] = useState<number | null>(null)
  useEffect(() => {
    const medir = () => {
      const topo = raiz.current?.getBoundingClientRect().top ?? 0
      // `innerHeight` e nao `100vh`: no telemovel o `vh` conta a barra do
      // browser que desaparece ao rolar, e a mesa ficava sempre um bocado
      // mais alta do que o ecra.
      setAltura(Math.max(420, window.innerHeight - topo - 4))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  /* ── Duas colunas, ou uma ───────────────────────────────────────────── */
  const [largo, setLargo] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1040px)')
    const ver = () => setLargo(mq.matches)
    ver(); mq.addEventListener('change', ver)
    return () => mq.removeEventListener('change', ver)
  }, [])

  const minutosAgora = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(d.agora || '')
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
  }, [d.agora])

  const pessoas: Pessoa[] = useMemo(() => {
    const por = new Map<string, Tarefa[]>()
    for (const t of d.visiveis) {
      if (!por.has(t.patientId)) por.set(t.patientId, [])
      por.get(t.patientId)!.push(t)
    }
    const lista = [...por].map(([id, tarefas]) => {
      const f = fichas.get(id) || {}
      const porArea = ORDEM_DAS_AREAS.map(fonte => {
        const minhas = tarefas.filter(t => t.fonte === fonte)
        return { fonte, feitos: minhas.filter(t => t.feito || t.naoPrestado).length, total: minhas.length }
      }).filter(a => a.total > 0)

      const emAtraso = minutosAgora == null ? 0 : tarefas.filter(t => {
        if (t.feito || t.naoPrestado || !t.hora) return false
        const m = /^(\d{1,2}):(\d{2})$/.exec(t.hora)
        return !!m && (Number(m[1]) * 60 + Number(m[2])) < minutosAgora - 30
      }).length

      return {
        id, nome: tarefas[0].nome,
        quarto: f.room_number || null,
        idade: anosDesde(f.date_of_birth || f.birth_date) ?? (f.age ?? null),
        sexo: f.sex || null,
        dieta: (f.diet || '').trim() || null,
        alergias: (f.allergies || '').trim() || null,
        riscoQueda: (f.fall_risk || '').trim() || null,
        mobilidade: (f.mobility || '').trim() || null,
        tarefas: [...tarefas].sort((a, b) => {
          const fa = (a.feito || !!a.naoPrestado) ? 1 : 0
          const fb = (b.feito || !!b.naoPrestado) ? 1 : 0
          if (fa !== fb) return fa - fb
          if (a.hora && b.hora) return a.hora.localeCompare(b.hora)
          if (a.hora) return -1
          if (b.hora) return 1
          return ORDEM_DAS_AREAS.indexOf(a.fonte) - ORDEM_DAS_AREAS.indexOf(b.fonte)
        }),
        porFazer: tarefas.filter(t => !t.feito && !t.naoPrestado).length,
        emAtraso, porArea,
      } as Pessoa
    })
    return lista.sort((a, b) => {
      const qa = a.quarto ? parseInt(a.quarto, 10) : NaN
      const qb = b.quarto ? parseInt(b.quarto, 10) : NaN
      const va = Number.isNaN(qa) ? Infinity : qa
      const vb = Number.isNaN(qb) ? Infinity : qb
      if (va !== vb) return va - vb
      return a.nome.localeCompare(b.nome, 'pt')
    })
  }, [d.visiveis, fichas, minutosAgora])

  const [escolhida, setEscolhida] = useState<string | null>(null)
  const pessoa = pessoas.find(p => p.id === escolhida) || null
  // No computador há sempre uma aberta: um painel vazio ao lado de uma lista
  // cheia é meio ecrã a não fazer nada.
  useEffect(() => {
    if (largo && !escolhida && pessoas.length) setEscolhida(pessoas[0].id)
  }, [largo, escolhida, pessoas])

  /* ── Os totais do turno, por área ───────────────────────────────────── */
  const totais = useMemo(() => ORDEM_DAS_AREAS.map(fonte => {
    const t = d.visiveis.filter(x => x.fonte === fonte)
    return { fonte, feitos: t.filter(x => x.feito || x.naoPrestado).length, total: t.length }
  }).filter(a => a.total > 0), [d.visiveis])

  const porFazer = pessoas.reduce((n, p) => n + p.porFazer, 0)
  const atrasadas = pessoas.reduce((n, p) => n + p.emAtraso, 0)

  return (
    <div ref={raiz} style={{
      background: CHAO,
      // SEM margem negativa. A primeira versao puxava a mesa para fora do
      // `<main>` para o chao sangrar ate a borda — mas o `<main>` desta
      // moldura nao tem espacamento lateral nenhum para cancelar, e o que a
      // margem fazia era enfiar a lista POR BAIXO da coluna da esquerda,
      // cortando as primeiras letras de cada linha.
      //
      // Viu-se na fotografia: «QT RESIDENTE» aparecia a comecar no T.
      // No computador, a mesa tem a altura da janela e nada rola por fora.
      // No telemovel volta a ser uma pagina normal: um ecra de 844px com
      // paineis a rolar por dentro e uma gaveta dentro de outra gaveta.
      height: largo && altura ? altura : undefined,
      padding: largo ? '0 clamp(10px, 1.2vw, 16px) 0' : '0 clamp(12px, 2vw, 24px) 60px',
      color: TINTA,
      display: 'flex', flexDirection: 'column', gap: 10,
      boxSizing: 'border-box',
    }}>
      {/* Sem tecto de largura: numa casa com trinta pessoas, cada centimetro
          da lista e uma linha que se ve sem rolar. */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        flex: 1, minHeight: 0, width: '100%',
      }}>

        {/* ══ A BARRA DE TRABALHO ═══════════════════════════════════════ */}
        <div style={{
          background: PAINEL, border: `1px solid ${RISCA}`, borderTop: 'none',
          borderRadius: '0 0 4px 4px', padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              ...mono, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase',
              color: MARCA, fontWeight: 'var(--peso-forte)' as any,
            }}>O dia</span>
            <span style={{ ...mono, fontSize: 'var(--t-meta)', color: TINTA_3 }}>{d.data} · {d.agora}</span>
          </div>

          {/* Turnos */}
          <div style={{ display: 'flex', border: `1px solid ${RISCA_F}`, borderRadius: 4, overflow: 'hidden' }}>
            {d.turnos.map(t => {
              const on = t === d.turno
              return (
                <button key={t} onClick={() => d.aoMudarTurno(t)} style={{
                  ...mono, fontSize: 'var(--t-meta)', letterSpacing: '.08em', textTransform: 'uppercase',
                  padding: '0 12px', height: 30, border: 'none', cursor: 'pointer',
                  background: on ? MARCA : 'transparent', color: on ? 'var(--bg)' : TINTA_2,
                  fontWeight: on ? 700 : 500,
                }}>{t === 'manha' ? 'Manhã' : t === 'tarde' ? 'Tarde' : 'Noite'}</button>
              )
            })}
          </div>

          {/* Os totais por área — a leitura do turno inteiro, numa linha. */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {totais.map(a => (
              <span key={a.fonte} title={ROTULO_DA_FONTE[a.fonte]}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Codigo fonte={a.fonte} />
                <span style={{ ...mono, fontSize: 'var(--t-meta)', color: a.feitos === a.total ? FEITO : TINTA_2 }}>
                  {a.feitos}/{a.total}
                </span>
              </span>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            {atrasadas > 0 && (
              <span style={{ ...mono, fontSize: 'var(--t-meta)', color: CRITICO, fontWeight: 'var(--peso-forte)' as any }}>
                {atrasadas} EM ATRASO
              </span>
            )}
            {d.meuTotal > 0 && (
              <button onClick={() => d.aoMudarSoMeu(!d.soMeu)} style={{
                ...mono, fontSize: 'var(--t-meta)', letterSpacing: '.06em', height: 30, padding: '0 10px',
                border: `1px solid ${d.soMeu ? MARCA : RISCA_F}`, borderRadius: 4, cursor: 'pointer',
                background: d.soMeu ? MARCA : 'transparent', color: d.soMeu ? 'var(--bg)' : TINTA_2,
              }}>MEUS {d.meuTotal}</button>
            )}
            <span style={{ ...mono, fontSize: 'var(--t-meta)', color: TINTA_2 }}>
              {d.progresso ? `${d.progresso.feitos}/${d.progresso.total}` : '—'}
            </span>
          </div>
        </div>

        {/* ══ A MESA ════════════════════════════════════════════════════ */}
        <div style={{
          display: 'grid', gap: 10,
          gridTemplateColumns: largo ? 'minmax(380px, 440px) 1fr' : '1fr',
          alignItems: 'stretch',
          flex: 1, minHeight: 0,
        }}>

          {/* ── A LISTA ─────────────────────────────────────────────── */}
          {(largo || !pessoa) && (
            <div style={{
              background: PAINEL, border: `1px solid ${RISCA}`, borderRadius: 4,
              display: 'flex', flexDirection: 'column', minHeight: 0,
              overflow: 'hidden',
            }}>
              {/* O cabecalho das colunas nao se vai embora ao rolar: sem ele a
                  meio da lista deixa de se saber o que e cada numero. */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                padding: '7px 12px', borderBottom: `1px solid ${RISCA}`, background: 'var(--bg-2)',
              }}>
                <span style={{
                  ...mono, fontSize: 'var(--t-micro)', letterSpacing: '.12em', textTransform: 'uppercase',
                  color: TINTA_3, fontWeight: 'var(--peso-forte)' as any,
                }}>Qt</span>
                <span style={{
                  ...mono, fontSize: 'var(--t-micro)', letterSpacing: '.12em', textTransform: 'uppercase',
                  color: TINTA_3, fontWeight: 'var(--peso-forte)' as any, flex: 1,
                }}>Residente · {pessoas.length}</span>
                <span style={{
                  ...mono, fontSize: 'var(--t-micro)', letterSpacing: '.12em', textTransform: 'uppercase',
                  color: TINTA_3, fontWeight: 'var(--peso-forte)' as any,
                }}>Por fazer</span>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {d.carregando && pessoas.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: TINTA_3, fontSize: 'var(--t-dado)' }}>
                  A montar o dia…
                </div>
              ) : pessoas.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--t-corpo)', color: TINTA_2 }}>Nada marcado para este turno.</div>
                  <div style={{ fontSize: 'var(--t-dado)', color: TINTA_3, marginTop: 6, lineHeight: 1.5 }}>
                    Quando houver medicação, cuidados ou atividades, aparecem aqui por quarto.
                  </div>
                </div>
              ) : pessoas.map(p => {
                const on = p.id === escolhida
                const tratada = p.porFazer === 0
                return (
                  <button key={p.id} onClick={() => setEscolhida(p.id)} style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '9px 12px', border: 'none', borderBottom: `1px solid ${RISCA}`,
                    borderLeft: `3px solid ${on ? MARCA : p.emAtraso > 0 ? CRITICO : 'transparent'}`,
                    background: on ? 'var(--bg-3)' : 'transparent',
                    fontFamily: 'inherit',
                  }}>
                    {/* Linha 1 — identificação */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{
                        ...mono, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any,
                        color: p.quarto ? TINTA_2 : TINTA_4, width: 30, flexShrink: 0,
                      }}>{p.quarto || '—'}</span>

                      <span style={{
                        fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: tratada ? TINTA_3 : TINTA,
                        flex: 1, minWidth: 0, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{p.nome}</span>

                      {p.emAtraso > 0 && (
                        <span style={{ ...mono, fontSize: 'var(--t-micro)', color: CRITICO, fontWeight: 'var(--peso-forte)' as any }}>
                          {p.emAtraso} ATR
                        </span>
                      )}
                      <span style={{
                        ...mono, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, width: 24, textAlign: 'right',
                        color: tratada ? FEITO : p.emAtraso > 0 ? CRITICO : TINTA,
                      }}>{tratada ? '✓' : p.porFazer}</span>
                    </div>

                    {/* Linha 2 — o que a ficha sabe */}
                    <div style={{
                      display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
                      marginTop: 4, paddingLeft: 40, fontSize: 'var(--t-meta)', color: TINTA_3,
                    }}>
                      {p.idade != null && <span style={mono}>{p.idade}a</span>}
                      {p.sexo && <span style={mono}>{p.sexo.toUpperCase().slice(0, 1)}</span>}
                      {p.alergias && <Bandeira texto={`ALERG ${p.alergias}`} tom="critico" />}
                      {p.riscoQueda && /alto|elevad/i.test(p.riscoQueda) && <Bandeira texto="RISCO QUEDA" tom="aviso" />}
                      {p.dieta && <Bandeira texto={p.dieta} tom="neutro" />}
                      {p.mobilidade && <Bandeira texto={p.mobilidade} tom="neutro" />}
                    </div>

                    {/* Linha 3 — progresso por área */}
                    <div style={{
                      display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
                      marginTop: 5, paddingLeft: 40,
                    }}>
                      {p.porArea.map(a => (
                        <span key={a.fonte} title={ROTULO_DA_FONTE[a.fonte]}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Codigo fonte={a.fonte} apagado={a.feitos === a.total} />
                          <Barra feitos={a.feitos} total={a.total}
                            cor={a.feitos === a.total ? FEITO : COR_DA_FONTE[a.fonte]} />
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
              </div>
            </div>
          )}

          {/* ── O PAINEL DA PESSOA ──────────────────────────────────── */}
          {pessoa && (
            <div style={{
              background: PAINEL, border: `1px solid ${RISCA}`, borderRadius: 4,
              display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${RISCA}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  {!largo && (
                    <button onClick={() => setEscolhida(null)} style={{
                      ...mono, fontSize: 'var(--t-meta)', letterSpacing: '.08em', border: `1px solid ${RISCA_F}`,
                      borderRadius: 4, background: 'transparent', color: TINTA_2,
                      height: 30, padding: '0 10px', cursor: 'pointer',
                    }}>← LISTA</button>
                  )}
                  <span style={{ ...mono, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: TINTA_2 }}>
                    {pessoa.quarto ? `QT ${pessoa.quarto}` : 'SEM QUARTO'}
                  </span>
                  <span style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-corpo)' as any, letterSpacing: '-0.01em' }}>{pessoa.nome}</span>
                  <span style={{ ...mono, fontSize: 'var(--t-meta)', color: TINTA_3 }}>
                    {pessoa.idade != null ? `${pessoa.idade} anos` : 'idade por registar'}
                    {pessoa.sexo ? ` · ${pessoa.sexo}` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {pessoa.alergias
                    ? <Bandeira texto={`ALERGIAS: ${pessoa.alergias}`} tom="critico" />
                    : <Bandeira texto="ALERGIAS POR REGISTAR" tom="aviso" />}
                  {pessoa.dieta && <Bandeira texto={`DIETA: ${pessoa.dieta}`} tom="neutro" />}
                  {pessoa.riscoQueda && <Bandeira texto={`QUEDA: ${pessoa.riscoQueda}`} tom="aviso" />}
                  {pessoa.mobilidade && <Bandeira texto={pessoa.mobilidade} tom="neutro" />}
                </div>
              </div>

              {/* A tabela de tarefas */}
              <div style={{
                display: 'flex', gap: 10, padding: '6px 16px', flexShrink: 0,
                borderBottom: `1px solid ${RISCA}`, background: 'var(--bg-2)',
              }}>
                {['Hora', 'Área', 'O que', 'Estado'].map((h, i) => (
                  <span key={h} style={{
                    ...mono, fontSize: 'var(--t-micro)', letterSpacing: '.12em', textTransform: 'uppercase',
                    color: TINTA_3, fontWeight: 'var(--peso-forte)' as any,
                    width: i === 0 ? 46 : i === 1 ? 40 : undefined,
                    flex: i === 2 ? 1 : undefined,
                    marginLeft: i === 0 ? 44 : undefined,
                  }}>{h}</span>
                ))}
              </div>

              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {pessoa.tarefas.map(t => {
                const tratada = t.feito || !!t.naoPrestado
                const atrasada = !tratada && !!t.hora && minutosAgora != null
                  && (() => { const m = /^(\d{1,2}):(\d{2})$/.exec(t.hora!); return !!m && Number(m[1]) * 60 + Number(m[2]) < minutosAgora - 30 })()
                return (
                  <div key={t.chave} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 16px', borderBottom: `1px solid ${RISCA}`,
                    opacity: d.aMarcar.has(t.chave) ? 0.5 : 1,
                    background: atrasada ? 'var(--red-light)' : 'transparent',
                  }}>
                    <button
                      onClick={() => d.podeEditar && !t.naoPrestado && d.marcar(t)}
                      aria-pressed={t.feito} aria-label={`${t.feito ? 'Desmarcar' : 'Marcar'} ${t.oQue}`}
                      style={{
                        width: 30, height: 30, flexShrink: 0, padding: 0, borderRadius: 3,
                        border: t.feito ? 'none' : `1.5px solid ${t.naoPrestado ? AVISO : RISCA_F}`,
                        background: t.feito ? FEITO : 'transparent', color: 'var(--bg)',
                        fontSize: 'var(--t-destaque)', lineHeight: 1, cursor: d.podeEditar && !t.naoPrestado ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{t.feito ? '✓' : t.naoPrestado ? '—' : ''}</button>

                    <span style={{
                      ...mono, fontSize: 'var(--t-dado)', width: 46, flexShrink: 0,
                      color: atrasada ? CRITICO : tratada ? TINTA_4 : TINTA_2,
                      fontWeight: atrasada ? 700 : 400,
                    }}>{t.hora || <span style={{ color: TINTA_4 }}>—</span>}</span>

                    <span style={{ width: 40, flexShrink: 0 }}>
                      <Codigo fonte={t.fonte} apagado={tratada} />
                    </span>

                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: 'var(--t-corpo)', color: tratada ? TINTA_3 : TINTA,
                        textDecoration: t.feito ? 'line-through' : undefined,
                      }}>{t.oQue}</span>
                      {t.detalhe && (
                        <span style={{ ...mono, fontSize: 'var(--t-meta)', color: TINTA_3, marginLeft: 8 }}>{t.detalhe}</span>
                      )}
                      {t.responsavel && (
                        <span style={{ fontSize: 'var(--t-meta)', color: TINTA_3, marginLeft: 8 }}>· {t.responsavel}</span>
                      )}
                    </span>

                    {t.naoPrestado ? (
                      <span style={{ ...mono, fontSize: 'var(--t-micro)', color: AVISO, fontWeight: 'var(--peso-corpo)' as any, whiteSpace: 'nowrap' }}>
                        {t.naoPrestado.motivo.toUpperCase()}
                      </span>
                    ) : t.feito ? (
                      <span style={{ ...mono, fontSize: 'var(--t-micro)', color: FEITO, fontWeight: 'var(--peso-corpo)' as any }}>DADO</span>
                    ) : d.podeEditar ? (
                      <button onClick={() => d.aoExplicar(t)} style={{
                        ...mono, fontSize: 'var(--t-micro)', letterSpacing: '.06em', height: 30, padding: '0 8px',
                        border: `1px solid ${RISCA_F}`, borderRadius: 3, background: 'transparent',
                        color: TINTA_3, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>NÃO FEITO</button>
                    ) : null}
                  </div>
                )
              })}

              </div>

              {/* O rodape do painel: o que falta, em numeros. Colado ao fundo,
                  nao a seguir a ultima linha — senao com tres tarefas fica a
                  meio do painel a flutuar. */}
              <div style={{
                display: 'flex', gap: 16, padding: '8px 16px', flexWrap: 'wrap', flexShrink: 0,
                fontSize: 'var(--t-meta)', color: TINTA_3, background: 'var(--bg-2)',
                borderTop: `1px solid ${RISCA}`,
              }}>
                <span style={mono}>
                  {pessoa.tarefas.length - pessoa.porFazer}/{pessoa.tarefas.length} TRATADAS
                </span>
                {pessoa.emAtraso > 0 && (
                  <span style={{ ...mono, color: CRITICO, fontWeight: 'var(--peso-forte)' as any }}>{pessoa.emAtraso} EM ATRASO</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══ A LEGENDA ═════════════════════════════════════════════════
            Um codigo de cores sem legenda e decoracao.

            Fica no FUNDO da janela, como a barra de estado de um programa —
            e e por isso que a mesa tem altura fixa: numa pagina que rola, ela
            acabava a meio do ecra com espaco vazio por baixo.

            ── NO TELEMOVEL SAI (2026-10-14) ──────────────────────────────
            Uma legenda e uma linha. A 390px esta ocupava TRES — «MED Medicacao
            CUI Cuidado PLN Plano / REF Reforco alimentar APO Apoio ATV
            Atividades / ATR = mais de 30 min depois da hora» — e ficava
            imediatamente por cima da barra de navegacao, que e onde o polegar
            esta. Tres linhas de glossario no sitio mais valioso do ecra.

            E a razao de ser dela tambem muda: num computador a legenda
            explica uma COLUNA de codigos que se le de alto a baixo. No
            telemovel cada codigo esta ja ao lado do que nomeia, na linha da
            propria pessoa — o MED esta colado as marcas de medicacao daquela
            pessoa. A legenda explica o que ja esta explicado.

            E a mesma regra da `BarraDeEstado` em components/ui/mesa.tsx, e
            pela mesma razao. */}
        {largo && <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
          padding: '6px 14px', background: PAINEL, flexShrink: 0,
          border: `1px solid ${RISCA}`, borderRadius: 4,
          fontSize: 'var(--t-meta)', color: TINTA_3,
        }}>
          {ORDEM_DAS_AREAS.map(f => (
            <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Codigo fonte={f} /> {ROTULO_DA_FONTE[f]}
            </span>
          ))}
          <span style={{ ...mono, color: CRITICO }}>ATR = mais de 30 min depois da hora</span>
          {porFazer === 0 && pessoas.length > 0 && (
            <span style={{ ...mono, color: FEITO, fontWeight: 'var(--peso-forte)' as any, marginLeft: 'auto' }}>TURNO TRATADO</span>
          )}
        </div>}

        {/* «Turno tratado» NAO e legenda: e o fim do trabalho, e a unica coisa
            daquela barra que vale a pena ver num telemovel. Fica. */}
        {!largo && porFazer === 0 && pessoas.length > 0 && (
          <div style={{
            ...mono, color: FEITO, fontWeight: 'var(--peso-forte)' as any,
            padding: '10px 14px', textAlign: 'center', flexShrink: 0,
          }}>TURNO TRATADO</div>
        )}
      </div>
    </div>
  )
}
