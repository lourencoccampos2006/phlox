'use client'

// components/institution/BensDoUtente.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O que a pessoa trouxe, e o que levou.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Da pesquisa ao MySenior. Parece a funcionalidade mais pequena da lista deles
// e não é.
//
// Numa casa com trinta pessoas a roupa vai para uma lavandaria comum e volta.
// O que desaparece desaparece sem ninguém saber se chegou a entrar — e a
// conversa que se segue é sempre a mesma: a família diz que trouxe, a casa não
// tem como dizer que sim nem que não, e a confiança parte-se por causa de uma
// camisola.
//
// E não é só roupa. Óculos, aparelhos auditivos e próteses dentárias custam
// centenas de euros e perdem-se em lares todos os dias.
//
// ── O QUE FAZ A DIFERENÇA É QUEM ENTREGOU ──────────────────────────────────
// «Entrou a 3 de março» não resolve nada. «Entrou a 3 de março, entregue pela
// filha» resolve — porque a conversa deixa de ser sobre memórias e passa a ser
// sobre um registo que as duas partes reconhecem.
//
// ── E A SAÍDA É UMA DATA, NÃO UM APAGAR ────────────────────────────────────
// Quando um objeto vai embora, marca-se a saída e fica na lista, a cinzento.
// Apagá-lo perdia exactamente a informação que interessa um ano depois: que
// aquilo existiu, esteve cá, e saiu com alguém num certo dia.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { ptDate } from '@/lib/ptTime'
import { reportError, isSetupError, MSG } from '@/lib/clientError'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

interface Bem {
  id: string
  descricao: string
  categoria: string
  quantidade: number
  entrou_em: string
  entregue_por: string | null
  saiu_em: string | null
  levado_por: string | null
  motivo_saida: string | null
  notas: string | null
}

const CATEGORIAS: Record<string, { label: string; cor: string }> = {
  roupa:      { label: 'Roupa',      cor: '#5a6d7c' },
  calcado:    { label: 'Calçado',    cor: '#7c6f5a' },
  higiene:    { label: 'Higiene',    cor: '#5f7161' },
  // Óculos, aparelho auditivo, prótese. Os que custam dinheiro a sério e os
  // que fazem falta no mesmo dia em que desaparecem.
  saude:      { label: 'Saúde',      cor: '#a1544c' },
  valor:      { label: 'De valor',   cor: '#8a6d3b' },
  eletronico: { label: 'Eletrónico', cor: '#6b6a80' },
  outro:      { label: 'Outro',      cor: '#7a5f70' },
}
const ORDEM = ['saude', 'valor', 'eletronico', 'roupa', 'calcado', 'higiene', 'outro']

const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 42,
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)',
}

export default function BensDoUtente({ pid, nome, cor }: { pid: string; nome: string; cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('utentes', 'editar')

  const [bens, setBens] = useState<Bem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [jaCarregou, setJaCarregou] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aAcrescentar, setAAcrescentar] = useState(false)
  const [mostrarSaidos, setMostrarSaidos] = useState(false)
  const [aDevolver, setADevolver] = useState<Bem | null>(null)

  const [form, setForm] = useState({
    descricao: '', categoria: 'roupa', quantidade: '1', entregue_por: '', notas: '',
  })

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)
    const { data, error } = await supabase.from('bens_do_utente')
      .select('*').eq('patient_id', pid).order('entrou_em', { ascending: false })

    if (error && isSetupError(error)) {
      setIndisponivel(true); setJaCarregou(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setBens(error ? [] : (data || []))
    setJaCarregou(true)
    setCarregando(false)
  }, [pid, user, supabase])

  useEffect(() => { carregar() }, [carregar])

  async function acrescentar() {
    if (!form.descricao.trim() || !user) return
    const { data, error } = await supabase.from('bens_do_utente').insert(scope.stamp({
      user_id: user.id, patient_id: pid,
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      quantidade: Math.max(1, Number(form.quantidade) || 1),
      entrou_em: ptDate(),
      entregue_por: form.entregue_por.trim() || null,
      notas: form.notas.trim() || null,
    })).select().single()

    if (error || !data) {
      // O formulário fica ABERTO e preenchido. Fechá-lo seria dizer que ficou
      // registado — e é exactamente este registo que depois se invoca.
      setErro(reportError('bens-acrescentar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro('')
    setBens(p => [data, ...p])
    setForm({ descricao: '', categoria: form.categoria, quantidade: '1', entregue_por: '', notas: '' })
    setAAcrescentar(false)
  }

  async function devolver(b: Bem, levadoPor: string, motivo: string) {
    const antes = bens
    const saida = { saiu_em: ptDate(), levado_por: levadoPor.trim() || null, motivo_saida: motivo.trim() || null }
    setBens(p => p.map(x => x.id === b.id ? { ...x, ...saida } : x))
    setADevolver(null)

    const { error } = await supabase.from('bens_do_utente').update(saida).eq('id', b.id)
    if (error) {
      setBens(antes)
      setErro(reportError('bens-devolver', error, MSG.save))
    } else setErro('')
  }

  const caEstao = useMemo(() => bens.filter(b => !b.saiu_em), [bens])
  const saidos = useMemo(() => bens.filter(b => b.saiu_em), [bens])

  const porCategoria = useMemo(() => {
    const m = new Map<string, Bem[]>()
    for (const b of caEstao) {
      const l = m.get(b.categoria)
      if (l) l.push(b); else m.set(b.categoria, [b])
    }
    return ORDEM.filter(c => m.has(c)).map(c => ({ categoria: c, bens: m.get(c)! }))
  }, [caEstao])

  if (indisponivel) return null
  if (carregando || !jaCarregou) return null

  const primeiroNome = String(nome || '').trim().split(/\s+/)[0] || nome

  return (
    <section style={{ marginTop: 'var(--space-12)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>Bens</span>
        <span style={{ ...MONO, color: 'var(--ink-5)' }}>
          {caEstao.length === 0 ? 'nenhum' : `${caEstao.length} ${caEstao.length === 1 ? 'objeto' : 'objetos'}`}
        </span>
      </div>

      {erro && <div style={{ marginTop: 10, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>}

      {caEstao.length === 0 && !aAcrescentar && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, marginTop: 'var(--space-7)' }}>
          Nada registado. Vale sobretudo para os óculos, o aparelho auditivo e a prótese —
          são os que fazem falta no mesmo dia em que desaparecem.
        </p>
      )}

      <div style={{ marginTop: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
        {porCategoria.map(g => {
          const cat = CATEGORIAS[g.categoria] || CATEGORIAS.outro
          return (
            <div key={g.categoria}>
              <div style={{ ...MONO, fontSize: 9.5, color: cat.cor, marginBottom: 7 }}>{cat.label}</div>
              <div style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {g.bens.map((b, i) => (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--bg-3)',
                    borderLeft: `3px solid ${cat.cor}`,
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
                        {b.quantidade > 1 && <span style={{ color: 'var(--ink-4)' }}>{b.quantidade}× </span>}
                        {b.descricao}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.4 }}>
                        {[
                          `entrou ${b.entrou_em.split('-').reverse().join('/')}`,
                          b.entregue_por ? `por ${b.entregue_por}` : null,
                          b.notas,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {podeEditar && (
                      <button onClick={() => setADevolver(b)} style={{
                        flexShrink: 0, minHeight: 32, padding: '0 10px', borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--border-2)', background: 'transparent',
                        fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                        color: 'var(--ink-4)', cursor: 'pointer',
                      }}>Saiu</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* O que já saiu. Fica, a cinzento e fechado — apagá-lo perdia a única
          coisa que interessa um ano depois: que aquilo existiu e saiu com
          alguém num certo dia. */}
      {saidos.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <button onClick={() => setMostrarSaidos(v => !v)} style={{
            minHeight: 34, padding: '0 10px', borderRadius: 'var(--r-sm)',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-4)',
          }}>
            {mostrarSaidos ? 'Esconder' : `Ver ${saidos.length} que já ${saidos.length === 1 ? 'saiu' : 'saíram'}`}
          </button>

          {mostrarSaidos && (
            <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {saidos.map(b => (
                <div key={b.id} style={{ fontSize: 12.5, color: 'var(--ink-5)', lineHeight: 1.5 }}>
                  <span style={{ textDecoration: 'line-through' }}>{b.descricao}</span>
                  {' — saiu '}{b.saiu_em?.split('-').reverse().join('/')}
                  {b.levado_por ? `, com ${b.levado_por}` : ''}
                  {b.motivo_saida ? ` (${b.motivo_saida})` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {podeEditar && (aAcrescentar ? (
        <div style={{
          marginTop: 'var(--space-8)', padding: 13, borderRadius: 'var(--r-lg)',
          border: `1px solid ${cor}`, background: 'var(--bg-2)',
        }}>
          <input autoFocus value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="O que é. Ex.: óculos de ver ao perto, armação castanha" style={campo} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              style={{ ...campo, flex: '1 1 150px', width: 'auto' }}>
              {ORDEM.map(c => <option key={c} value={c}>{CATEGORIAS[c].label}</option>)}
            </select>
            <input value={form.quantidade} inputMode="numeric"
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value.replace(/\D/g, '') }))}
              placeholder="Quantos" aria-label="Quantidade"
              style={{ ...campo, flex: '0 1 100px', width: 'auto' }} />
          </div>

          {/* Quem entregou. É isto que faz o registo valer alguma coisa na
              conversa que vem meses depois. */}
          <input value={form.entregue_por} onChange={e => setForm(f => ({ ...f, entregue_por: e.target.value }))}
            placeholder={`Quem entregou (ex.: a filha de ${primeiroNome})`}
            style={{ ...campo, marginTop: 9 }} />
          <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            placeholder="Marca, cor, sinais — o que o distingue de outro igual (opcional)"
            style={{ ...campo, marginTop: 9 }} />

          <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
            <button onClick={acrescentar} disabled={!form.descricao.trim()} style={{
              minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-md)', border: 'none',
              background: form.descricao.trim() ? cor : 'var(--bg-3)',
              color: form.descricao.trim() ? '#fff' : 'var(--ink-5)',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              cursor: form.descricao.trim() ? 'pointer' : 'default',
            }}>Registar</button>
            <button onClick={() => setAAcrescentar(false)} style={{
              minHeight: 42, padding: '0 14px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border-2)', background: 'transparent',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAAcrescentar(true)} style={{
          marginTop: 'var(--space-7)', minHeight: 44, padding: '0 18px',
          borderRadius: 'var(--r-lg)', border: `1.5px dashed ${cor}`, background: 'transparent',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: cor, cursor: 'pointer',
        }}>+ Registar um bem</button>
      ))}

      {aDevolver && <FolhaDeSaida b={aDevolver} cor={cor}
        aoFechar={() => setADevolver(null)}
        aoGravar={(quem, motivo) => devolver(aDevolver, quem, motivo)} />}
    </section>
  )
}

/** Quem levou, e porquê. */
function FolhaDeSaida({ b, cor, aoFechar, aoGravar }: {
  b: Bem; cor: string
  aoFechar: () => void
  aoGravar: (levadoPor: string, motivo: string) => void
}) {
  const [quem, setQuem] = useState('')
  const [motivo, setMotivo] = useState('')

  return (
    <div
      onClick={aoFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 130,
        background: 'rgba(0,0,0,.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 420, borderRadius: 'var(--r-xl)',
        background: 'var(--bg)', padding: 'var(--space-9)',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)' }}>
          {b.descricao}
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '6px 0 0', lineHeight: 1.55 }}>
          Fica na lista, marcado como saído. Não se apaga — o que interessa um ano
          depois é que esteve cá e saiu com alguém.
        </p>

        <input autoFocus value={quem} onChange={e => setQuem(e.target.value)}
          placeholder="Quem levou" style={{ ...campo, marginTop: 14 }} />
        <input value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder="Porquê (ex.: foi para arranjo; levou para casa)" style={{ ...campo, marginTop: 9 }} />

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={() => aoGravar(quem, motivo)} style={{
            flex: 1, minHeight: 44, borderRadius: 'var(--r-md)', border: 'none',
            background: cor, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Marcar saída</button>
          <button onClick={aoFechar} style={{
            minHeight: 44, padding: '0 16px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-2)', background: 'transparent',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer',
          }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
