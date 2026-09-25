'use client'

// components/institution/StockDoUtente.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O que esta pessoa tem cá: fraldas, medicação, cremes.
//
// ── A PERGUNTA ──────────────────────────────────────────────────────────────
// «Ainda tem fraldas para o fim de semana?» Hoje a resposta anda na cabeça de
// quem tratou dela de manhã, e à sexta à tarde essa pessoa já foi embora.
//
// ── O QUE APARECE PRIMEIRO ─────────────────────────────────────────────────
// O que está a acabar. Um artigo com stock para três semanas não precisa de
// atenção nenhuma; o que chega até quinta precisa hoje, porque é hoje que se
// telefona à família.
//
// ── PORQUE É QUE O NÚMERO É EM DIAS ────────────────────────────────────────
// «Restam 8» não diz nada: depende de quantas se usam por dia. «Chega até
// sexta» é uma frase sobre a qual se age.
//
// ── A BAIXA AUTOMÁTICA NÃO ESTÁ NESTE FICHEIRO ─────────────────────────────
// Está num gatilho da base de dados (sprint160). Marcar uma toma desconta
// sozinho, venha de onde vier — do /mar, do /o-dia, do portal da família ou de
// uma toma SOS. Aqui só se lê o resultado e se mexe à mão no que não tem
// ligação a medicamento nenhum (as fraldas, por exemplo).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { estiloFundoModal } from '@/lib/camadas'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import {
  CATEGORIAS, situacao, movimentoEmPalavras,
  type ArtigoDoUtente, type Movimento,
} from '@/lib/stockUtente'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

const CORES = {
  ok: { bg: 'var(--bg-2)', bd: 'var(--border)', fg: 'var(--ink-4)' },
  a_acabar: { bg: 'var(--badge-amber-bg)', bd: 'var(--badge-amber-border)', fg: 'var(--badge-amber-fg)' },
  acabou: { bg: '#fff5f5', bd: '#fed7d7', fg: '#c53030' },
}

interface MedLigavel { id: string; name: string; dose: string | null }

export default function StockDoUtente({ pid, nome, cor }: { pid: string; nome: string; cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('stock', 'editar')

  const [artigos, setArtigos] = useState<ArtigoDoUtente[]>([])
  const [movs, setMovs] = useState<Movimento[]>([])
  const [meds, setMeds] = useState<MedLigavel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aCriar, setACriar] = useState(false)
  const [aMexer, setAMexer] = useState<ArtigoDoUtente | null>(null)

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)
    const [a, m, md] = await Promise.all([
      supabase.from('stock_utente').select('*').eq('patient_id', pid).order('nome'),
      // Trinta dias chegam para o ritmo. Mais do que isso é histórico, e o
      // histórico vive no detalhe de cada artigo.
      supabase.from('stock_movimentos').select('*')
        .eq('patient_id', pid)
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('patient_meds').select('id, name, dose')
        .eq('patient_id', pid).eq('active', true).order('name'),
    ])
    if (a.error) {
      // A migração ainda não correu, ou esta pessoa não pode ver stock.
      setIndisponivel(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setArtigos(a.data || [])
    setMovs(m.error ? [] : (m.data || []))
    setMeds(md.error ? [] : (md.data || []))
    setCarregando(false)
  }, [pid, user, supabase])

  useEffect(() => { carregar() }, [carregar])

  async function criar(campos: Partial<ArtigoDoUtente>) {
    if (!user || !campos.nome?.trim()) return
    const { data, error } = await supabase.from('stock_utente').insert(scope.stamp({
      user_id: user.id, patient_id: pid,
      nome: campos.nome.trim(),
      categoria: campos.categoria || 'geral',
      unidade: campos.unidade?.trim() || null,
      quantidade: campos.quantidade ?? 0,
      minimo: campos.minimo ?? null,
      med_id: campos.med_id || null,
      por_toma: campos.por_toma ?? 1,
    })).select().single()
    if (error || !data) {
      setErro(reportError('stock-utente-criar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setArtigos(p => [...p, data].sort((x, y) => x.nome.localeCompare(y.nome, 'pt')))
    setACriar(false)
  }

  /**
   * Mexer à mão. NÃO escreve a quantidade direta: escreve um MOVIMENTO e soma.
   *
   * Assim, duas pessoas a repor ao mesmo tempo somam as duas reposições em vez
   * de uma apagar a outra — e fica sempre uma linha a dizer o que entrou, que
   * é o que se mostra à família quando ela pergunta.
   */
  async function mexer(art: ArtigoDoUtente, delta: number, motivo: string, nota: string) {
    if (!user || !delta) return
    const nova = Number(art.quantidade) + delta
    const antes = artigos
    setArtigos(p => p.map(x => x.id === art.id ? { ...x, quantidade: nova } : x))
    setAMexer(null)

    const { error: e1 } = await supabase.from('stock_utente')
      .update({ quantidade: nova, updated_at: new Date().toISOString() }).eq('id', art.id)
    if (e1) {
      setArtigos(antes)
      setErro(reportError('stock-utente-mexer', e1, MSG.save))
      return
    }
    const { data, error: e2 } = await supabase.from('stock_movimentos').insert(scope.stamp({
      user_id: user.id, stock_id: art.id, patient_id: pid,
      delta, motivo, origem: 'mao',
      nota: nota.trim() || null,
      feito_por: (user as any).name || user.email || '',
    })).select().single()
    // A quantidade já mudou. Um movimento que não ficou escrito é uma falha de
    // contabilidade, e diz-se — mas não se desfaz a reposição por causa disso.
    if (e2) setErro(reportError('stock-utente-movimento', e2, 'A quantidade mudou, mas não ficou o registo de quem a mudou.'))
    else { setErro(''); if (data) setMovs(p => [data, ...p]) }
  }

  async function apagar(art: ArtigoDoUtente) {
    const { error } = await supabase.from('stock_utente').delete().eq('id', art.id)
    if (error) { setErro(reportError('stock-utente-apagar', error, MSG.save)); return }
    setArtigos(p => p.filter(x => x.id !== art.id))
  }

  const ordenados = useMemo(() => {
    const peso = { acabou: 0, a_acabar: 1, ok: 2 }
    return [...artigos].sort((a, b) => {
      const sa = situacao(a, movs), sb = situacao(b, movs)
      return peso[sa.aviso] - peso[sb.aviso] || a.nome.localeCompare(b.nome, 'pt')
    })
  }, [artigos, movs])

  if (indisponivel) return null
  if (carregando) {
    return <div style={{ padding: 'var(--space-10)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar…</div>
  }
  if (!artigos.length && !podeEditar) return null

  return (
    <section style={{ marginTop: 'var(--space-12)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>O que {nome.split(' ')[0]} tem cá</span>
        {podeEditar && !aCriar && (
          <button onClick={() => setACriar(true)} style={{
            background: 'none', border: 'none', color: cor, fontSize: 12.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}>+ Acrescentar</button>
        )}
      </div>

      {erro && <div style={{ marginTop: 10, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>}

      {aCriar && <NovoArtigo cor={cor} meds={meds} aoCriar={criar} aoCancelar={() => setACriar(false)} />}

      {!artigos.length && !aCriar && (
        <div style={{ marginTop: 'var(--space-7)', fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Nada registado. Serve para as fraldas, os cremes e a medicação que a família traz —
          e, quando um artigo fica ligado a um medicamento, dar a toma desconta sozinho.
        </div>
      )}

      <div style={{ marginTop: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {ordenados.map(a => {
          const s = situacao(a, movs)
          const c = CORES[s.aviso]
          const cat = CATEGORIAS[a.categoria] || CATEGORIAS.geral
          const doArtigo = movs.filter(m => m.stock_id === a.id)
          return (
            <div key={a.id} style={{
              padding: 'var(--space-7)', borderRadius: 'var(--r-xl)',
              border: `1px solid ${c.bd}`, background: c.bg,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                    <span aria-hidden style={{ marginRight: 6 }}>{cat.icone}</span>{a.nome}
                  </div>
                  <div style={{ fontSize: 13, color: c.fg, marginTop: 4, fontWeight: s.aviso === 'ok' ? 500 : 700 }}>
                    {s.frase}
                  </div>
                  {a.med_id && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 4 }}>
                      Desconta sozinho a cada toma
                      {a.por_toma !== 1 ? ` (${Number(a.por_toma)} de cada vez)` : ''}
                    </div>
                  )}
                </div>
                {podeEditar && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setAMexer(a)} style={{
                      minHeight: 40, padding: '0 14px', borderRadius: 'var(--r-md)', border: 'none',
                      background: cor, color: '#fff', fontFamily: 'inherit',
                      fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                    }}>Acertar</button>
                    <button onClick={() => apagar(a)} title="Remover da lista" style={{
                      width: 40, minHeight: 40, borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border-2)', background: 'transparent',
                      color: 'var(--ink-4)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                    }}>×</button>
                  </div>
                )}
              </div>

              {doArtigo.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 11.5, color: 'var(--ink-5)', cursor: 'pointer' }}>
                    {doArtigo.length === 1 ? '1 movimento' : `${doArtigo.length} movimentos`} nos últimos 30 dias
                  </summary>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {doArtigo.slice(0, 20).map(m => (
                      <div key={m.id} style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                        {new Date(m.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                        {' · '}{movimentoEmPalavras(m, a.unidade)}
                        {m.feito_por ? ` · ${m.feito_por}` : ''}
                        {m.nota ? ` — ${m.nota}` : ''}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>

      {aMexer && <FolhaAcertar art={aMexer} cor={cor}
        aoFechar={() => setAMexer(null)}
        aoMexer={(d, motivo, nota) => mexer(aMexer, d, motivo, nota)} />}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function NovoArtigo({ cor, meds, aoCriar, aoCancelar }: {
  cor: string; meds: MedLigavel[]
  aoCriar: (c: Partial<ArtigoDoUtente>) => void; aoCancelar: () => void
}) {
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('incontinencia')
  const [quantidade, setQuantidade] = useState('')
  const [minimo, setMinimo] = useState('')
  const [unidade, setUnidade] = useState('')
  const [medId, setMedId] = useState('')
  const [porToma, setPorToma] = useState('1')

  const campo: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 42,
    borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
    fontFamily: 'inherit', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)',
  }

  return (
    <div style={{
      marginTop: 'var(--space-7)', padding: 'var(--space-8)',
      borderRadius: 'var(--r-xl)', border: `1.5px solid ${cor}`, background: 'var(--bg)',
    }}>
      <label style={{ display: 'block', marginBottom: 10 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>O que é</span>
        <input value={nome} onChange={e => setNome(e.target.value)} autoFocus
          placeholder="Ex.: fraldas noite, tamanho M" style={campo} />
      </label>

      <div style={{ marginBottom: 10 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Categoria</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORIAS).map(([k, c]) => (
            <button key={k} onClick={() => setCategoria(k)} style={{
              padding: '7px 12px', borderRadius: 999, minHeight: 36, cursor: 'pointer',
              border: `1.5px solid ${categoria === k ? c.cor : 'var(--border-2)'}`,
              background: categoria === k ? c.cor + '14' : 'transparent',
              color: categoria === k ? c.cor : 'var(--ink-3)',
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
            }}>{c.icone} {c.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 110px' }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Quantos há</span>
          <input value={quantidade} onChange={e => setQuantidade(e.target.value)}
            inputMode="decimal" placeholder="0" style={campo} />
        </label>
        <label style={{ flex: '1 1 110px' }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Avisar abaixo de</span>
          <input value={minimo} onChange={e => setMinimo(e.target.value)}
            inputMode="decimal" placeholder="opcional" style={campo} />
        </label>
        <label style={{ flex: '1 1 110px' }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Unidade</span>
          <input value={unidade} onChange={e => setUnidade(e.target.value)}
            placeholder="unidades" style={campo} />
        </label>
      </div>

      {meds.length > 0 && categoria === 'medicamento' && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Ligar a um medicamento</span>
            <select value={medId} onChange={e => setMedId(e.target.value)} style={campo}>
              <option value="">Não ligar — acerto à mão</option>
              {meds.map(m => <option key={m.id} value={m.id}>{m.name}{m.dose ? ` · ${m.dose}` : ''}</option>)}
            </select>
          </label>
          {medId && (
            <label style={{ display: 'block' }}>
              <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Quantos por toma</span>
              <input value={porToma} onChange={e => setPorToma(e.target.value)}
                inputMode="decimal" style={{ ...campo, maxWidth: 140 }} />
            </label>
          )}
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-5)', marginTop: 6, lineHeight: 1.5 }}>
            Ligado a um medicamento, cada toma marcada desconta sozinha — venha do mapa
            de medicação, do dia, ou de uma toma SOS.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 9 }}>
        <button
          onClick={() => aoCriar({
            nome, categoria, unidade,
            quantidade: Number(quantidade.replace(',', '.')) || 0,
            minimo: minimo.trim() ? Number(minimo.replace(',', '.')) : null,
            med_id: medId || null,
            por_toma: Number(porToma.replace(',', '.')) || 1,
          })}
          disabled={!nome.trim()}
          style={{
            minHeight: 42, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
            background: nome.trim() ? cor : 'var(--bg-3)', color: nome.trim() ? '#fff' : 'var(--ink-5)',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            cursor: nome.trim() ? 'pointer' : 'default',
          }}>Acrescentar</button>
        <button onClick={aoCancelar} style={{
          minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-2)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer',
        }}>Cancelar</button>
      </div>
    </div>
  )
}

function FolhaAcertar({ art, cor, aoFechar, aoMexer }: {
  art: ArtigoDoUtente; cor: string
  aoFechar: () => void; aoMexer: (delta: number, motivo: string, nota: string) => void
}) {
  const [quanto, setQuanto] = useState('')
  const [motivo, setMotivo] = useState<'entrada' | 'uso' | 'perda' | 'acerto'>('entrada')
  const [nota, setNota] = useState('')

  const n = Number(quanto.replace(',', '.')) || 0
  // «Entrou» soma; tudo o resto tira. Quem está a repor escreve 30 e não −30:
  // pedir um sinal a quem tem as mãos ocupadas é pedir um engano.
  const delta = motivo === 'entrada' ? n : -n
  const fica = Number(art.quantidade) + delta

  const OPCOES = [
    { id: 'entrada' as const, label: 'A família trouxe' },
    { id: 'uso' as const, label: 'Foi usado' },
    { id: 'perda' as const, label: 'Perdeu-se ou estragou' },
    { id: 'acerto' as const, label: 'Contei e era outro número' },
  ]

  return (
    <div onClick={aoFechar} style={{ ...estiloFundoModal, alignItems: 'flex-end', padding: 0 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={`Acertar ${art.nome}`}
        style={{
          width: '100%', maxWidth: 460, background: 'var(--bg, #fff)',
          borderRadius: '18px 18px 0 0', padding: '20px 18px calc(18px + env(safe-area-inset-bottom))',
          maxHeight: '86vh', overflowY: 'auto',
        }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink, #111)' }}>{art.nome}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-4, #6b7280)', marginTop: 3 }}>
          Estão registadas {Number(art.quantidade)} {art.unidade || 'unidades'}.
        </div>

        <div style={{ marginTop: 16 }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 8 }}>O que aconteceu</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OPCOES.map(o => (
              <button key={o.id} onClick={() => setMotivo(o.id)} style={{
                padding: '8px 13px', borderRadius: 999, minHeight: 38, cursor: 'pointer',
                border: `1.5px solid ${motivo === o.id ? cor : 'var(--border, #e5e7eb)'}`,
                background: motivo === o.id ? cor + '14' : 'transparent',
                color: motivo === o.id ? cor : 'var(--ink-3, #374151)',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              }}>{o.label}</button>
            ))}
          </div>
        </div>

        <label style={{ display: 'block', marginTop: 14 }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>
            {motivo === 'acerto' ? 'Quantas a menos' : 'Quantas'}
          </span>
          <input value={quanto} onChange={e => setQuanto(e.target.value)} inputMode="decimal" autoFocus
            placeholder="0"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '11px 13px', minHeight: 46,
              borderRadius: 10, border: '1px solid var(--border, #e5e7eb)',
              fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
            }} />
        </label>

        <input value={nota} onChange={e => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          style={{
            width: '100%', boxSizing: 'border-box', marginTop: 10, padding: '10px 12px', minHeight: 42,
            borderRadius: 10, border: '1px solid var(--border, #e5e7eb)',
            fontFamily: 'inherit', fontSize: 14,
          }} />

        {n > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 13px', borderRadius: 10,
            background: 'var(--bg-2, #f6f6f6)', fontSize: 13.5, color: 'var(--ink-2, #333)', fontWeight: 600,
          }}>
            Fica com {Number(fica.toFixed(2))} {art.unidade || 'unidades'}.
            {fica < 0 && <span style={{ color: '#c53030' }}> Isso é menos do que zero — confirme.</span>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={aoFechar} style={{
            flex: '0 0 auto', minHeight: 46, padding: '0 18px', borderRadius: 11,
            border: '1px solid var(--border-2, #d1d5db)', background: 'transparent',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3, #374151)', cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={() => aoMexer(delta, motivo, nota)} disabled={!n}
            style={{
              flex: 1, minHeight: 46, borderRadius: 11, border: 'none',
              background: n ? cor : 'var(--bg-3, #e5e7eb)', color: n ? '#fff' : 'var(--ink-5, #9ca3af)',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: n ? 'pointer' : 'default',
            }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
