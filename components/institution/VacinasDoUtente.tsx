'use client'

// components/institution/VacinasDoUtente.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O boletim de vacinas, dentro da ficha.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Da pesquisa ao MySenior, que tem isto desde 2020. A gripe todos os outonos,
// a COVID, o tétano, a pneumocócica.
//
// A pergunta que se faz uma vez por ano, a correr, é «quem é que falta». Hoje
// responde-se a folhear o boletim em papel de cada pessoa, trinta vezes — e o
// que acontece na prática é que se vacina quem está à mão e se descobre em
// janeiro que faltaram dois.
//
// ── A COLUNA QUE FAZ A DIFERENÇA É A PRÓXIMA ───────────────────────────────
// Guardar o que já foi dado é fácil e é metade do valor. É `proxima_em` que
// permite a pergunta útil — e é por isso que o campo está no formulário com a
// data da gripe já sugerida a um ano, em vez de ser um campo opcional no fim
// que ninguém preenche.
//
// ── E NÃO É UMA LISTA FECHADA ──────────────────────────────────────────────
// O calendário vacinal muda. Uma lista fechada obrigava a uma migração a cada
// vacina nova — e, enquanto ela não corresse, a casa não tinha onde registar o
// que tinha acabado de dar. As habituais aparecem como atalhos; o resto
// escreve-se.
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

interface Vacina {
  id: string
  vacina: string
  dose: string | null
  data: string
  lote: string | null
  onde: string | null
  administrada_por: string | null
  proxima_em: string | null
  notas: string | null
}

/** As que uma casa dá de facto, e de quanto em quanto tempo se repetem. */
const HABITUAIS: { nome: string; mesesAteProxima: number | null }[] = [
  { nome: 'Gripe', mesesAteProxima: 12 },
  { nome: 'COVID-19', mesesAteProxima: 12 },
  { nome: 'Pneumocócica', mesesAteProxima: null },
  { nome: 'Tétano', mesesAteProxima: 120 },
  { nome: 'Herpes zóster', mesesAteProxima: null },
]

const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 42,
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)',
}

const pt = (d: string | null) => (d ? d.split('-').reverse().join('/') : '')

/** Daqui a quantos dias? Negativo quando já passou. */
function diasAte(data: string): number {
  const hoje = new Date(ptDate() + 'T00:00:00')
  const alvo = new Date(data + 'T00:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

/** `2026-10-01` + 12 meses. */
function somarMeses(iso: string, meses: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

export default function VacinasDoUtente({ pid, nome, cor }: { pid: string; nome: string; cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('avaliacoes', 'editar')

  const [vacinas, setVacinas] = useState<Vacina[]>([])
  const [carregando, setCarregando] = useState(true)
  const [jaCarregou, setJaCarregou] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aAcrescentar, setAAcrescentar] = useState(false)

  const [form, setForm] = useState({
    vacina: '', dose: '', data: ptDate(), lote: '', onde: '', proxima_em: '',
  })

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)
    const { data, error } = await supabase.from('vacinas_do_utente')
      .select('*').eq('patient_id', pid).order('data', { ascending: false })

    if (error && isSetupError(error)) {
      setIndisponivel(true); setJaCarregou(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setVacinas(error ? [] : (data || []))
    setJaCarregou(true)
    setCarregando(false)
  }, [pid, user, supabase])

  useEffect(() => { carregar() }, [carregar])

  /** Escolher uma das habituais preenche a data da próxima. */
  function escolher(h: typeof HABITUAIS[number]) {
    setForm(f => ({
      ...f,
      vacina: h.nome,
      proxima_em: h.mesesAteProxima ? somarMeses(f.data || ptDate(), h.mesesAteProxima) : '',
    }))
  }

  async function acrescentar() {
    if (!form.vacina.trim() || !form.data || !user) return
    const quem = (user as any)?.name || user?.email || ''
    const { data, error } = await supabase.from('vacinas_do_utente').insert(scope.stamp({
      user_id: user.id, patient_id: pid,
      vacina: form.vacina.trim(),
      dose: form.dose.trim() || null,
      data: form.data,
      lote: form.lote.trim() || null,
      onde: form.onde.trim() || null,
      administrada_por: quem || null,
      proxima_em: form.proxima_em || null,
    })).select().single()

    if (error || !data) {
      // O formulário fica aberto e preenchido. Fechá-lo seria dizer que ficou
      // registado — e uma vacina que parece registada e não está é uma vacina
      // que ninguém volta a dar.
      setErro(reportError('vacinas-acrescentar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro('')
    setVacinas(p => [data, ...p])
    setForm({ vacina: '', dose: '', data: ptDate(), lote: '', onde: '', proxima_em: '' })
    setAAcrescentar(false)
  }

  /** O que está a tocar: a próxima mais perto, se já passou ou falta pouco. */
  const aTocar = useMemo(() => {
    const comProxima = vacinas
      .filter(v => v.proxima_em)
      .map(v => ({ v, dias: diasAte(v.proxima_em!) }))
      .sort((a, b) => a.dias - b.dias)
    // 60 dias: tempo de encomendar e de marcar, sem avisar meio ano antes.
    return comProxima.filter(x => x.dias <= 60)
  }, [vacinas])

  if (indisponivel) return null
  if (carregando || !jaCarregou) return null

  const primeiroNome = String(nome || '').trim().split(/\s+/)[0] || nome

  return (
    <section style={{ marginTop: 'var(--space-12)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>Vacinas</span>
        {vacinas.length > 0 && (
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            {vacinas.length} {vacinas.length === 1 ? 'registo' : 'registos'}
          </span>
        )}
      </div>

      {erro && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{erro}</div>}

      {/* O que está a tocar vem primeiro e por cima da lista. É a única coisa
          desta secção que pede uma ação hoje. */}
      {aTocar.length > 0 && (
        <div style={{
          marginTop: 'var(--space-7)', padding: '11px 13px', borderRadius: 'var(--r-md)',
          background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)',
        }}>
          {aTocar.map(({ v, dias }) => (
            <div key={v.id} style={{ fontSize: 13, color: 'var(--badge-amber-fg)', fontWeight: 600, lineHeight: 1.5 }}>
              {v.vacina}: {dias < 0
                ? `estava marcada para ${pt(v.proxima_em)}`
                : dias === 0 ? 'é hoje'
                : `daqui a ${dias} ${dias === 1 ? 'dia' : 'dias'} (${pt(v.proxima_em)})`}
            </div>
          ))}
        </div>
      )}

      {vacinas.length === 0 && !aAcrescentar && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, marginTop: 'var(--space-7)' }}>
          Nada registado. Com a data da próxima preenchida, {primeiroNome} entra sozinho
          na lista de quem falta vacinar.
        </p>
      )}

      {vacinas.length > 0 && (
        <div style={{
          marginTop: 'var(--space-7)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {vacinas.map((v, i) => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'baseline', gap: 11, padding: '11px 13px',
              borderTop: i === 0 ? 'none' : '1px solid var(--bg-3)',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
                  {v.vacina}{v.dose ? ` · ${v.dose}` : ''}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.4 }}>
                  {[
                    v.onde,
                    v.lote ? `lote ${v.lote}` : null,
                    v.administrada_por,
                    v.proxima_em ? `próxima: ${pt(v.proxima_em)}` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{
                flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 12,
                fontWeight: 700, color: 'var(--ink-3)',
              }}>{pt(v.data)}</span>
            </div>
          ))}
        </div>
      )}

      {podeEditar && (aAcrescentar ? (
        <div style={{
          marginTop: 'var(--space-8)', padding: 13, borderRadius: 'var(--r-lg)',
          border: `1px solid ${cor}`, background: 'var(--bg-2)',
        }}>
          {/* As habituais como atalhos, e não como uma lista fechada: escolher
              uma preenche também a data da próxima, que é o campo que ninguém
              preenche quando é opcional e está no fim. */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {HABITUAIS.map(h => {
              const on = form.vacina === h.nome
              return (
                <button key={h.nome} onClick={() => escolher(h)} style={{
                  minHeight: 36, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
                  border: `1.5px solid ${on ? cor : 'var(--border-2)'}`,
                  background: on ? cor : 'transparent', color: on ? 'var(--bg)' : 'var(--ink-3)',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                }}>{h.nome}</button>
              )
            })}
          </div>

          <input value={form.vacina} onChange={e => setForm(f => ({ ...f, vacina: e.target.value }))}
            placeholder="Ou escreva outra" style={campo} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
            <label style={{ flex: '1 1 150px' }}>
              <span style={{ ...MONO, fontSize: 9.5, display: 'block', marginBottom: 5 }}>Quando foi</span>
              <input type="date" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={campo} />
            </label>
            <label style={{ flex: '1 1 150px' }}>
              <span style={{ ...MONO, fontSize: 9.5, display: 'block', marginBottom: 5 }}>Próxima</span>
              <input type="date" value={form.proxima_em}
                onChange={e => setForm(f => ({ ...f, proxima_em: e.target.value }))} style={campo} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
            <input value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
              placeholder="Dose (ex.: reforço)" style={{ ...campo, flex: '1 1 140px', width: 'auto' }} />
            <input value={form.lote} onChange={e => setForm(f => ({ ...f, lote: e.target.value }))}
              placeholder="Lote" style={{ ...campo, flex: '1 1 120px', width: 'auto' }} />
            <input value={form.onde} onChange={e => setForm(f => ({ ...f, onde: e.target.value }))}
              placeholder="Onde (centro de saúde, cá)" style={{ ...campo, flex: '1 1 160px', width: 'auto' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
            <button onClick={acrescentar} disabled={!form.vacina.trim() || !form.data} style={{
              minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-md)', border: 'none',
              background: form.vacina.trim() && form.data ? cor : 'var(--bg-3)',
              color: form.vacina.trim() && form.data ? 'var(--bg)' : 'var(--ink-5)',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              cursor: form.vacina.trim() && form.data ? 'pointer' : 'default',
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
        }}>+ Registar uma vacina</button>
      ))}
    </section>
  )
}
