'use client'

// components/institution/CuidadosDeRotina.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Os cuidados que esta pessoa leva, e quando.
//
// ── O QUE ISTO RESOLVE ──────────────────────────────────────────────────────
// O dia de uma casa é feito sobretudo de cuidado de rotina — o banho, o
// levante, a ajuda à refeição — e o produto não tinha onde o descrever. O
// resultado via-se no «O Dia»: só aparecia medicação, e ficava com ar de
// página vazia.
//
// ── O ECRÃ TEM DE SER RÁPIDO DE PREENCHER ──────────────────────────────────
// Quem faz isto está a dar entrada a alguém e tem dez fichas pela frente. Por
// isso os serviços aparecem TODOS, já escritos, agrupados por assunto, e
// ligam-se com um toque. A cadência vem a «todos os dias» — que é o que a
// maior parte é — e só se muda quando é preciso.
//
// Uma lista vazia com um botão «+ Adicionar serviço» obrigaria a inventar o
// nome de cada um, vinte e cinco vezes, e no fim cada casa teria os seus
// nomes — e nada se conseguiria contar entre casas nem dentro da mesma.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import { CADENCIAS, POR_CADENCIA, DIAS_DA_SEMANA, cadenciaEmPalavras, type Cadencia } from '@/lib/plano'
import {
  CATEGORIAS, ORDEM_DAS_CATEGORIAS, tempoEmPalavras,
  type ServicoDoCatalogo, type ServicoDoUtente,
} from '@/lib/servicos'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

const TURNOS = [
  { id: null as string | null, label: 'Qualquer altura' },
  { id: 'manha', label: 'De manhã' },
  { id: 'tarde', label: 'À tarde' },
  { id: 'noite', label: 'À noite' },
]

export default function CuidadosDeRotina({ pid, nome, cor }: { pid: string; nome: string; cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('registos', 'editar')

  const [catalogo, setCatalogo] = useState<ServicoDoCatalogo[]>([])
  const [atribuidos, setAtribuidos] = useState<ServicoDoUtente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aEscolher, setAEscolher] = useState(false)
  const [aAfinar, setAAfinar] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)
    let qc = supabase.from('catalogo_servicos').select('*').eq('ativo', true).order('ordem')
    qc = scope.filter(qc)
    const [c, a] = await Promise.all([
      qc,
      supabase.from('servicos_do_utente').select('*').eq('patient_id', pid).eq('ativo', true),
    ])
    if (c.error) {
      // A migração ainda não correu, ou esta pessoa não pode ver registos.
      setIndisponivel(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setCatalogo(c.data || [])
    setAtribuidos(a.error ? [] : (a.data || []))
    setCarregando(false)
  }, [pid, user, supabase, scope])

  useEffect(() => { carregar() }, [carregar])

  async function ligar(s: ServicoDoCatalogo) {
    if (!user) return
    const { data, error } = await supabase.from('servicos_do_utente').insert(scope.stamp({
      user_id: user.id, patient_id: pid, servico_id: s.id,
      cadencia: 'diaria', ativo: true,
    })).select().single()
    if (error || !data) {
      setErro(reportError('servico-ligar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setAtribuidos(p => [...p, data])
  }

  async function desligar(a: ServicoDoUtente) {
    const antes = atribuidos
    setAtribuidos(p => p.filter(x => x.id !== a.id))
    // Apaga em vez de desativar: uma atribuição enganada não tem história
    // nenhuma que valha a pena guardar, e o que FOI FEITO fica em
    // `servicos_execucoes`, que não é tocado.
    const { error } = await supabase.from('servicos_do_utente').delete().eq('id', a.id)
    if (error) { setAtribuidos(antes); setErro(reportError('servico-desligar', error, MSG.save)) }
  }

  async function afinar(a: ServicoDoUtente, patch: Partial<ServicoDoUtente>) {
    const antes = atribuidos
    setAtribuidos(p => p.map(x => x.id === a.id ? { ...x, ...patch } : x))
    const { error } = await supabase.from('servicos_do_utente').update(patch).eq('id', a.id)
    if (error) { setAtribuidos(antes); setErro(reportError('servico-afinar', error, MSG.save)) }
  }

  const porId = useMemo(() => new Map(catalogo.map(c => [c.id, c])), [catalogo])
  const jaTem = useMemo(() => new Set(atribuidos.map(a => a.servico_id)), [atribuidos])

  /** O catálogo por assunto, só com o que esta pessoa ainda não leva. */
  const disponiveis = useMemo(() => {
    const grupos = new Map<string, ServicoDoCatalogo[]>()
    for (const s of catalogo) {
      if (jaTem.has(s.id)) continue
      const l = grupos.get(s.categoria)
      if (l) l.push(s); else grupos.set(s.categoria, [s])
    }
    return ORDEM_DAS_CATEGORIAS
      .filter(c => grupos.has(c))
      .map(c => ({ categoria: c, servicos: grupos.get(c) as ServicoDoCatalogo[] }))
  }, [catalogo, jaTem])

  const tempoTotal = useMemo(() => {
    let m = 0
    for (const a of atribuidos) {
      const s = porId.get(a.servico_id)
      if (s?.minutos && a.cadencia === 'diaria') m += s.minutos
    }
    return m
  }, [atribuidos, porId])

  if (indisponivel) return null
  if (carregando) {
    return <div style={{ padding: 'var(--space-10)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar…</div>
  }

  return (
    <section style={{ marginTop: 'var(--space-12)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>Cuidados de rotina</span>
        {tempoTotal > 0 && (
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            {tempoEmPalavras(tempoTotal)} por dia
          </span>
        )}
      </div>

      {erro && <div style={{ marginTop: 10, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>}

      {atribuidos.length === 0 && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, marginTop: 'var(--space-7)' }}>
          {nome.split(' ')[0]} ainda não tem cuidados marcados. É daqui que sai o dia de trabalho —
          sem isto, «O Dia» só mostra medicação.
        </p>
      )}

      {/* O que esta pessoa leva */}
      <div style={{ marginTop: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {atribuidos.map(a => {
          const s = porId.get(a.servico_id)
          if (!s) return null
          const cat = CATEGORIAS[s.categoria] || CATEGORIAS.outro
          const aberto = aAfinar === a.id
          return (
            <div key={a.id} style={{
              borderRadius: 'var(--r-lg)', border: `1px solid ${aberto ? cor : 'var(--border)'}`,
              background: 'var(--bg-2)', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px' }}>
                <span aria-hidden style={{ fontSize: 17, flexShrink: 0 }}>{cat.icone}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{s.nome}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2 }}>
                    {cadenciaEmPalavras(a)}
                    {s.minutos ? ` · ${s.minutos} min` : ''}
                    {a.quem ? ` · ${a.quem}` : ''}
                  </span>
                  {a.notas && (
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-5)', marginTop: 2 }}>{a.notas}</span>
                  )}
                </span>
                {podeEditar && (
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => setAAfinar(aberto ? null : a.id)} style={{
                      minHeight: 34, padding: '0 11px', borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--border-2)', background: 'transparent',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      color: aberto ? cor : 'var(--ink-4)', cursor: 'pointer',
                    }}>{aberto ? 'Fechar' : 'Afinar'}</button>
                    <button onClick={() => desligar(a)} title="Tirar da lista" style={{
                      width: 34, minHeight: 34, borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--border-2)', background: 'transparent',
                      color: 'var(--ink-4)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                    }}>×</button>
                  </div>
                )}
              </div>

              {aberto && <Afinador a={a} cor={cor} aoMudar={patch => afinar(a, patch)} />}
            </div>
          )
        })}
      </div>

      {/* O que se pode acrescentar */}
      {podeEditar && (
        aEscolher ? (
          <div style={{
            marginTop: 'var(--space-8)', padding: 'var(--space-7)',
            borderRadius: 'var(--r-xl)', border: `1.5px solid ${cor}`, background: 'var(--bg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={MONO}>Acrescentar</span>
              <button onClick={() => setAEscolher(false)} style={{
                background: 'none', border: 'none', color: 'var(--ink-4)', fontSize: 12.5,
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
              }}>Fechar</button>
            </div>

            {disponiveis.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55 }}>
                Esta pessoa já leva tudo o que a casa faz. Para acrescentar um serviço novo ao
                catálogo, vá às definições da casa.
              </div>
            ) : disponiveis.map(({ categoria, servicos }) => {
              const cat = CATEGORIAS[categoria] || CATEGORIAS.outro
              return (
                <div key={categoria} style={{ marginBottom: 14 }}>
                  <div style={{ ...MONO, fontSize: 9.5, color: cat.cor, marginBottom: 7 }}>
                    {cat.icone} {cat.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {servicos.map(s => (
                      <button key={s.id} onClick={() => ligar(s)} style={{
                        padding: '8px 13px', borderRadius: 999, minHeight: 38, cursor: 'pointer',
                        border: '1px solid var(--border-2)', background: 'transparent',
                        fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)',
                      }}>+ {s.nome}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <button onClick={() => setAEscolher(true)} style={{
            marginTop: 'var(--space-7)', minHeight: 44, padding: '0 18px',
            borderRadius: 'var(--r-lg)', border: `1.5px dashed ${cor}`, background: 'transparent',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: cor, cursor: 'pointer',
          }}>+ Acrescentar cuidado</button>
        )
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Afinador({ a, cor, aoMudar }: {
  a: ServicoDoUtente; cor: string; aoMudar: (patch: Partial<ServicoDoUtente>) => void
}) {
  const [notas, setNotas] = useState(a.notas || '')
  const [quem, setQuem] = useState(a.quem || '')
  const opcao = POR_CADENCIA.get(a.cadencia)

  const campo: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', minHeight: 40,
    borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
    fontFamily: 'inherit', fontSize: 13.5, background: 'var(--bg)', color: 'var(--ink)',
  }

  return (
    <div style={{ padding: '0 13px 13px', borderTop: '1px solid var(--border)' }}>
      <div style={{ marginTop: 11 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Com que frequência</span>
        <select value={a.cadencia} onChange={e => {
          const c = e.target.value as Cadencia
          aoMudar({ cadencia: c, dias: c === 'dias_da_semana' ? (a.dias || []) : null })
        }} style={campo}>
          {CADENCIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {opcao && (
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-5)', marginTop: 5, lineHeight: 1.45 }}>
            {opcao.ajuda}
          </span>
        )}
      </div>

      {a.cadencia === 'dias_da_semana' && (
        <div style={{ marginTop: 11 }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Em que dias</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {DIAS_DA_SEMANA.map(d => {
              const on = (a.dias || []).includes(d.n)
              return (
                <button key={d.n} title={d.label}
                  onClick={() => aoMudar({
                    dias: on ? (a.dias || []).filter(x => x !== d.n) : [...(a.dias || []), d.n],
                  })}
                  style={{
                    minWidth: 42, minHeight: 36, borderRadius: 'var(--r-md)', cursor: 'pointer',
                    border: `1.5px solid ${on ? cor : 'var(--border-2)'}`,
                    background: on ? cor : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                  }}>{d.curto}</button>
              )
            })}
          </div>
        </div>
      )}

      {opcao?.noDia && (
        <div style={{ marginTop: 11 }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Altura do dia</span>
          <select value={a.turno ?? ''} onChange={e => aoMudar({ turno: e.target.value || null })} style={campo}>
            {TURNOS.map(t => <option key={t.id ?? 'x'} value={t.id ?? ''}>{t.label}</option>)}
          </select>
        </div>
      )}

      <div style={{ marginTop: 11 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Quem costuma fazer</span>
        <input value={quem} onChange={e => setQuem(e.target.value)} onBlur={() => aoMudar({ quem: quem.trim() || null })}
          placeholder="A função, não o nome (opcional)" style={campo} />
      </div>

      <div style={{ marginTop: 11 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Como se faz com esta pessoa</span>
        <input value={notas} onChange={e => setNotas(e.target.value)} onBlur={() => aoMudar({ notas: notas.trim() || null })}
          placeholder="Ex.: prefere de manhã; precisa de ajuda de dois" style={campo} />
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-5)', marginTop: 5, lineHeight: 1.45 }}>
          Aparece ao lado da tarefa, no dia. É o que uma colega nova precisa de saber antes de entrar no quarto.
        </span>
      </div>
    </div>
  )
}
