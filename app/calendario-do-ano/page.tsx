'use client'
// app/calendario-do-ano/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O ano inteiro num ecrã.
//
// ── PORQUE É QUE NÃO É O /calendario QUE JÁ EXISTE ─────────────────────────
// O /calendario é pessoal: as consultas e os exames de uma pessoa, um mês de
// cada vez, preso ao `user_id`. Este é da casa, e o que faz não é mostrar um
// mês — é mostrar DOZE, porque a pergunta que se faz a um calendário de
// parede numa direção técnica é de longo alcance: quando é a Páscoa, em que
// semana cai o 25 de Abril, quantos aniversários há em março, que documentos
// caducam antes do verão.
//
// ── O QUE ELE NÃO FAZ ───────────────────────────────────────────────────────
// Não guarda cópias. As atividades, as visitas, as consultas, os prazos e as
// validades continuam a viver onde sempre viveram; isto lê-as. Copiá-las
// criava uma segunda verdade que se desencontrava da primeira em silêncio.
//
// Só o que não tinha sítio nenhum — a festa de Natal, a semana de obras, a
// visita da segurança social — é que fica guardado aqui (sprint166).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import { ptDate } from '@/lib/ptTime'
import ClinicalGate from '@/components/ClinicalGate'
import { carregarAno } from '@/lib/carregarAno'
import { invalidar } from '@/lib/leituraPartilhada'
import { CAMADA } from '@/lib/camadas'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import {
  MESES, DIAS_CURTOS, ORIGENS, grelhaDoMes, porDia, porExtenso,
  contarPorOrigem, corDe, rotuloDe, ehBissexto, diasDoAno,
  type Marca, type Origem,
} from '@/lib/calendario'

/* OITO NOMES, QUATRO CORES — e de propósito.
   Eram oito cores distintas, três delas fora do sistema (laranja, amarelo,
   rosa). Num ano inteiro desenhado com pontos de 8px, laranja e amarelo não
   se distinguem um do outro, e o vermelho — o único que TEM de saltar à
   vista — perde-se no meio deles.
   Os nomes ficam porque a `lib/calendario` os usa; o que muda é para onde
   apontam. Quem precisa de saber qual origem é lê a legenda, que está
   sempre no ecrã e também serve de filtro. */
const CORES: Record<string, string> = {
  vermelho: 'var(--red)',                    // o que falha ou expira
  laranja: 'var(--amber)', amarelo: 'var(--amber)', rosa: 'var(--amber)',   // o que pede atenção
  verde: 'var(--green)',                     // o que está tratado
  cinza: 'var(--ink-4)', azul: 'var(--ink-2)', roxo: 'var(--ink-3)',        // o que só é
}

export default function CalendarioDoAnoPage() {
  const largo = useLargo()
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const hoje = useMemo(() => ptDate(), [])
  const [ano, setAno] = useState(() => +ptDate().slice(0, 4))
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [falharam, setFalharam] = useState<string[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [escondidas, setEscondidas] = useState<Origem[]>([])
  const [diaAberto, setDiaAberto] = useState<string | null>(null)
  const [aMarcar, setAMarcar] = useState(false)

  const podeVer = scope.pode('utentes', 'ver')
  const podeEditar = scope.pode('utentes', 'editar')

  const carregar = useCallback(async () => {
    if (!user) { setACarregar(false); return }
    setACarregar(true)
    try {
      const { marcas: m, falharam: f } = await carregarAno(supabase, scope.filter, ano)
      setMarcas(m); setFalharam(f)
    } catch (e) {
      toast.error('Não foi possível montar o ano',
        reportError('calendario-ano', e, 'Tenta recarregar a página.'))
    } finally { setACarregar(false) }
  }, [user, supabase, scope.filter, ano, toast])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(
    () => marcas.filter(m => !escondidas.includes(m.origem)),
    [marcas, escondidas],
  )
  const doDia = useMemo(() => porDia(visiveis), [visiveis])
  const contagem = useMemo(() => contarPorOrigem(marcas), [marcas])

  const abertas = diaAberto ? (doDia.get(diaAberto) || []) : []

  if (!user) return null
  const plano = (user?.plan || 'free') as string
  if (plano !== 'pro' && plano !== 'clinic') {
    return <ClinicalGate emoji="🗓️" accent="var(--green)"
      title="Calendário do ano"
      description="O ano inteiro num ecrã: aniversários, atividades, visitas, consultas, prazos e feriados, tudo marcado sozinho. Faz parte do plano Institucional." />
  }
  if (!podeVer) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', lineHeight: 1.6 }}>
          A sua conta não tem acesso ao calendário da casa.
        </p>
      </div>
    )
  }

  /* A MOLDURA — refeita (2026-10-08).

     Tinha «Calendário do ano» a 25px/800 com um parágrafo por baixo, e a
     barra lateral já diz «Calendário do ano». O ano, as setas e o «Marcar»
     sobem para a barra de trabalho, onde ficam à vista ao rolar os doze
     meses — que era o problema: a meio do ano já não se via em que ano se
     estava nem como mudar.

     A legenda-filtro desce para a barra de estado. Continua a clicar-se:
     é a melhor ideia desta página e não se toca nela, só se muda de sítio. */
  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>O ano</span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Botao onClick={() => setAno(a => a - 1)} titulo="Ano anterior">‹</Botao>
            <span style={{
              ...MONO, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any,
              color: 'var(--ink)', minWidth: 54, textAlign: 'center',
            }}>{ano}</span>
            <Botao onClick={() => setAno(a => a + 1)} titulo="Ano seguinte">›</Botao>
          </span>

          {/* O pedido dele, dito no ecrã. Num ano bissexto vê-se porquê: o
              29 de fevereiro está lá, e nos outros anos não está. */}
          <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
            {ehBissexto(ano) ? `BISSEXTO · ${diasDoAno(ano)} DIAS` : `${diasDoAno(ano)} DIAS`}
          </span>

          <span style={{ display: 'inline-flex', gap: 6, marginLeft: largo ? 'auto' : undefined }}>
            {ano !== +hoje.slice(0, 4) && (
              <Botao onClick={() => setAno(+hoje.slice(0, 4))}>VOLTAR A {hoje.slice(0, 4)}</Botao>
            )}
            {/* Se a tabela das marcas não respondeu, este botão abria um
                formulário que ia falhar a gravar no fim. Melhor não haver
                botão do que haver um que desiste depois de a pessoa escrever. */}
            {podeEditar && !falharam.includes('Marcado à mão') && (
              <Botao feitio="principal" onClick={() => setAMarcar(true)}>MARCAR</Botao>
            )}
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          {/* A LEGENDA É O FILTRO. Clicar numa origem esconde-a do ano
              inteiro. Estava a meio da página, a 16px do topo do conteúdo;
              aqui está sempre no ecrã, que é o que uma legenda tem de ser. */}
          {ORIGENS.filter(o => contagem[o.id]).map(o => {
            const fora = escondidas.includes(o.id)
            return (
              <button key={o.id} aria-pressed={!fora}
                onClick={() => setEscondidas(e => fora ? e.filter(x => x !== o.id) : [...e, o.id])}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  ...MONO, fontSize: 'var(--t-meta)',
                  color: fora ? 'var(--border-2)' : 'var(--ink-3)',
                  textDecoration: fora ? 'line-through' : 'none',
                }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 'var(--r)', flexShrink: 0,
                  background: fora ? 'var(--border-2)' : o.cor,
                }} />
                {o.rotulo}
                <span style={{ color: 'var(--ink-5)' }}>{contagem[o.id]}</span>
              </button>
            )
          })}
        </BarraDeEstado>
      }
    >
      {/* Uma fonte que não respondeu tem de se ver. Um calendário a que falta
          silenciosamente as visitas parece completo e engana. */}
      {falharam.length > 0 && (
        <div style={{
          margin: '14px 0 0', padding: '11px 14px', borderRadius: 'var(--r-lg)',
          background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-bg)', fontSize: 'var(--t-meta)',
          color: 'var(--amber)', lineHeight: 1.6,
        }}>
          Não consegui ler {falharam.length === 1 ? 'uma fonte' : `${falharam.length} fontes`}:{' '}
          <strong>{falharam.join(', ').toLowerCase()}</strong>. O resto do ano está certo —
          só falta o que vinha daí.
        </div>
      )}

      {/* A legenda-filtro subiu para a barra de estado, onde está sempre no
          ecrã em vez de desaparecer ao rolar os doze meses. */}


      {aCarregar ? (
        <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)' }}>A montar o ano…</p>
      ) : (
        <>
          <div className="ano-grelha">
            {MESES.map((nome, mes) => (
              <Mes key={mes} ano={ano} mes={mes} nome={nome} hoje={hoje}
                doDia={doDia} aberto={diaAberto} onAbrir={setDiaAberto} />
            ))}
          </div>

          {!marcas.length && (
            <p style={{ marginTop: 18, fontSize: 'var(--t-dado)', color: 'var(--ink-5)', lineHeight: 1.7 }}>
              Só os feriados, para já. Os aniversários aparecem sozinhos assim que as pessoas
              tiverem data de nascimento na ficha — que é o que a{' '}
              <Link href="/patients" style={{ color: 'var(--green)' }}>inscrição</Link> passou a
              perguntar.
            </p>
          )}
        </>
      )}

      {diaAberto && (
        <PainelDoDia data={diaAberto} marcas={abertas} onFechar={() => setDiaAberto(null)}
          person={cfg.personNoun.toLowerCase()} />
      )}

      {aMarcar && (
        <ModalMarcar ano={ano} onFechar={() => setAMarcar(false)}
              onGravado={() => {
            // Sem isto, a marca acabada de gravar não aparecia durante cinco
            // minutos: a `leituraPartilhada` guarda a resposta por esse tempo
            // e devolvia a cópia antiga ao recarregar. Parecia não ter gravado.
            invalidar('ano:marcas')
            setAMarcar(false); carregar()
          }} />
      )}

      <style>{`
        .ano-grelha { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        @media (max-width: 1000px) { .ano-grelha { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 760px)  { .ano-grelha { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 460px)  { .ano-grelha { grid-template-columns: 1fr; } }
      `}</style>
    </Mesa>
  )
}

const seta: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'white',
  cursor: 'pointer', fontSize: 'var(--t-destaque)', color: 'var(--ink-3)', lineHeight: 1, fontFamily: 'inherit',
}
const botao: React.CSSProperties = {
  padding: '8px 13px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'white',
  cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', fontFamily: 'inherit',
}

// ═══════════════════════════════════════════════════════════════════════════
// Um mês
// ═══════════════════════════════════════════════════════════════════════════
function Mes({ ano, mes, nome, hoje, doDia, aberto, onAbrir }: {
  ano: number; mes: number; nome: string; hoje: string
  doDia: Map<string, Marca[]>; aberto: string | null; onAbrir: (d: string) => void
}) {
  const semanas = grelhaDoMes(ano, mes)
  // `reduce<number>` porque o array é de `number | null` e sem isto o
  // acumulador herda o `null` do elemento.
  const quantas = semanas.flat().reduce<number>((n, d) => {
    if (d === null) return n
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return n + (doDia.get(iso)?.length || 0)
  }, 0)

  return (
    <section style={{ border: '1px solid var(--bg-2)', borderRadius: 'var(--r-xl)', padding: '11px 10px 9px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8, padding: '0 3px' }}>
        <h2 style={{ flex: 1, margin: 0, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{nome}</h2>
        {quantas > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', lineHeight: 1.1, color: 'var(--border-2)' }}>
            {quantas}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DIAS_CURTOS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, lineHeight: 1.1,
            color: i >= 5 ? 'var(--border-2)' : 'var(--ink-5)', paddingBottom: 4,
          }}>{d}</div>
        ))}

        {semanas.flat().map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const doDiaEste = doDia.get(iso) || []
          const eHoje = iso === hoje
          const estaAberto = iso === aberto
          const fimDeSemana = i % 7 >= 5
          // Até três pontos. Com mais, a casa fica preta e deixa de dizer nada.
          const cores = [...new Set(doDiaEste.map(m => corDe(m.origem)))].slice(0, 3)

          return (
            <button key={i} onClick={() => onAbrir(iso)}
              title={doDiaEste.length ? doDiaEste.map(m => m.titulo).join(' · ') : undefined}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                border: estaAberto ? '1.5px solid var(--ink)' : eHoje ? '1.5px solid var(--green)' : '1.5px solid transparent',
                borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                background: estaAberto ? 'var(--bg-3)' : 'transparent',
              }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', lineHeight: 1,
                fontWeight: eHoje ? 700 : 500,
                color: eHoje ? 'var(--green)' : fimDeSemana ? 'var(--border-2)' : 'var(--ink-3)',
              }}>{d}</span>
              <span style={{ display: 'flex', gap: 1.5, height: 4, alignItems: 'center' }}>
                {cores.map((c, j) => (
                  <span key={j} style={{ width: 3.5, height: 3.5, borderRadius: 'var(--r-sm)', background: c }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// O que há num dia
// ═══════════════════════════════════════════════════════════════════════════
function PainelDoDia({ data, marcas, onFechar, person }: {
  data: string; marcas: Marca[]; onFechar: () => void; person: string
}) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
      background: 'white', borderTop: '1px solid var(--border)',
      boxShadow: '0 -8px 32px rgba(11,17,32,.1)', maxHeight: '58vh', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 13 }}>
          <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>
            {porExtenso(data, true)}
          </h3>
          <button onClick={onFechar} aria-label="Fechar" style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-destaque)',
            color: 'var(--border-2)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {!marcas.length ? (
          <p style={{ margin: 0, fontSize: 'var(--t-dado)', color: 'var(--ink-5)' }}>Nada marcado neste dia.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {marcas.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 12px',
                border: '1px solid var(--bg-2)', borderRadius: 'var(--r-lg)',
                borderLeft: `3px solid ${corDe(m.origem)}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    {m.hora && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', lineHeight: 1.1, color: 'var(--ink)', fontWeight: 'var(--peso-forte)' as any }}>
                        {m.hora}
                      </span>
                    )}
                    <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{m.titulo}</span>
                    <span style={{ fontSize: 'var(--t-meta)', color: corDe(m.origem) }}>{rotuloDe(m.origem)}</span>
                  </div>
                  {m.detalhe && (
                    <p style={{ margin: '3px 0 0', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.5 }}>
                      {m.detalhe}
                    </p>
                  )}
                  {/* O 29 de fevereiro. Sem esta linha a pessoa parecia ter
                      nascido a 28, e ninguém saberia porquê. */}
                  {m.movida && (
                    <p style={{ margin: '3px 0 0', fontSize: 'var(--t-meta)', color: 'var(--amber)', lineHeight: 1.5 }}>
                      A data certa é {porExtenso(m.movida)} — este ano não tem esse dia,
                      por isso assinala-se hoje.
                    </p>
                  )}
                </div>
                {m.quemId && (
                  <Link href={`/patients/${m.quemId}`} style={{
                    fontSize: 'var(--t-meta)', color: 'var(--green)', textDecoration: 'none',
                    whiteSpace: 'nowrap', fontWeight: 'var(--peso-corpo)' as any,
                  }}>Ver {person} →</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Marcar à mão
// ═══════════════════════════════════════════════════════════════════════════
function ModalMarcar({ ano, onFechar, onGravado }: {
  ano: number; onFechar: () => void; onGravado: () => void
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const [f, setF] = useState({
    titulo: '', detalhe: '', data: `${ano}-01-01`, ate: '', hora: '',
    repete: 'nao', cor: 'azul',
  })
  const [aGravar, setAGravar] = useState(false)

  const intervaloAoContrario = !!f.ate && f.ate < f.data

  async function gravar() {
    if (!f.titulo.trim() || !f.data || intervaloAoContrario) return
    setAGravar(true)
    try {
      const { error } = await supabase.from('calendario_marcas').insert(scope.stamp({
        user_id: user.id, titulo: f.titulo.trim(), detalhe: f.detalhe.trim() || null,
        data: f.data, ate: f.ate || null, hora: f.hora || null,
        repete: f.repete, cor: f.cor, criada_por: user.email || null,
      }))
      if (error) {
        toast.error('Não foi possível marcar',
          reportError('calendario-marcar', error, 'O que escreveste não se perdeu.'))
        return
      }
      onGravado()
    } finally { setAGravar(false) }
  }

  return (
    <div onClick={onFechar} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,17,32,.45)', zIndex: CAMADA.fundoModal,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '8vh 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 'var(--r-md)', maxWidth: 520, width: '100%',
        padding: '22px', boxShadow: '0 22px 60px rgba(11,17,32,.22)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>
          Marcar no calendário
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <Campo rotulo="O quê">
            <input value={f.titulo} onChange={e => setF(x => ({ ...x, titulo: e.target.value }))}
              autoFocus placeholder="Festa de Natal, obras na cozinha, visita da segurança social…"
              style={caixa} />
          </Campo>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Campo rotulo="Quando"><input type="date" value={f.data}
              onChange={e => setF(x => ({ ...x, data: e.target.value }))} style={caixa} /></Campo>
            <Campo rotulo="Até (se durar dias)"><input type="date" value={f.ate}
              onChange={e => setF(x => ({ ...x, ate: e.target.value }))} style={caixa} /></Campo>
            <Campo rotulo="Hora (se tiver)"><input type="time" value={f.hora}
              onChange={e => setF(x => ({ ...x, hora: e.target.value }))} style={caixa} /></Campo>
          </div>

          {intervaloAoContrario && (
            <p style={{ margin: 0, fontSize: 'var(--t-meta)', color: 'var(--red)' }}>
              A data de fim está antes da de início.
            </p>
          )}

          <Campo rotulo="Notas"><textarea value={f.detalhe} rows={2}
            onChange={e => setF(x => ({ ...x, detalhe: e.target.value }))}
            style={{ ...caixa, resize: 'vertical' }} /></Campo>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Campo rotulo="Repete">
              <select value={f.repete} onChange={e => setF(x => ({ ...x, repete: e.target.value }))}
                style={caixa}>
                <option value="nao">Só este ano</option>
                <option value="anual">Todos os anos</option>
              </select>
            </Campo>
            <Campo rotulo="Cor">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 4 }}>
                {Object.entries(CORES).map(([nome, cor]) => (
                  <button key={nome} onClick={() => setF(x => ({ ...x, cor: nome }))}
                    aria-label={nome} aria-pressed={f.cor === nome}
                    style={{
                      width: 24, height: 24, borderRadius: 'var(--r-md)', cursor: 'pointer', background: cor,
                      border: f.cor === nome ? '2.5px solid var(--ink)' : '2.5px solid transparent',
                    }} />
                ))}
              </div>
            </Campo>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={gravar} disabled={!f.titulo.trim() || aGravar || intervaloAoContrario}
            style={{
              flex: 1, background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)',
              padding: 12, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'inherit',
              cursor: f.titulo.trim() && !intervaloAoContrario ? 'pointer' : 'not-allowed',
              opacity: f.titulo.trim() && !intervaloAoContrario ? 1 : 0.5,
            }}>{aGravar ? 'A marcar…' : 'Marcar'}</button>
          <button onClick={onFechar} style={{
            padding: '12px 16px', background: 'white', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'inherit',
          }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const caixa: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
  fontSize: 'var(--t-dado)', fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-4)', marginBottom: 4 }}>
        {rotulo}
      </label>
      {children}
    </div>
  )
}
