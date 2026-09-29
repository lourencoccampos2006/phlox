'use client'

// components/institution/EtiquetasDoUtente.tsx
// ─────────────────────────────────────────────────────────────────────────────
// As etiquetas de uma pessoa: o que se precisa de saber antes de tudo o resto.
//
// ── PARA QUE SERVEM ─────────────────────────────────────────────────────────
// «Risco de queda», «disfagia», «alergias». Coisas que hoje vivem no meio das
// notas — onde só as encontra quem já sabe que estão lá.
//
// Numa lista de trinta pessoas, uma etiqueta vermelha vê-se antes de se ler
// seja o que for. E é por elas que se procura: «quem é que tem risco de
// queda?» é uma pergunta que se faz antes de montar uma escala de noite.
//
// ── O CATÁLOGO EXISTE PARA A PESQUISA FUNCIONAR ────────────────────────────
// Se cada pessoa escrevesse o que quisesse, ao fim de um mês havia
// «diabético», «Diabético», «diabetes» e «DM2» — e a pesquisa que devia dar
// oito pessoas dava duas. Por isso escolhe-se de uma lista; quem precisa de
// uma etiqueta nova cria-a, mas cria-a uma vez.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import { CORES_DE_ETIQUETA, type Etiqueta } from '@/lib/etiquetas'

export default function EtiquetasDoUtente({ pid, cor }: { pid: string; cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('utentes', 'editar')

  const [catalogo, setCatalogo] = useState<Etiqueta[]>([])
  const [postas, setPostas] = useState<{ id: string; etiqueta_id: string }[]>([])
  const [indisponivel, setIndisponivel] = useState(false)
  const [aEscolher, setAEscolher] = useState(false)
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    let qc = supabase.from('etiquetas').select('*').eq('ativa', true).order('nome')
    qc = scope.filter(qc)
    const [c, e] = await Promise.all([
      qc,
      supabase.from('etiquetas_do_utente').select('id, etiqueta_id').eq('patient_id', pid),
    ])
    if (c.error) { setIndisponivel(true); return }
    setIndisponivel(false)
    setCatalogo(c.data || [])
    setPostas(e.error ? [] : (e.data || []))
  }, [pid, user, supabase, scope])

  useEffect(() => { carregar() }, [carregar])

  async function por(et: Etiqueta) {
    if (!user) return
    const { data, error } = await supabase.from('etiquetas_do_utente').insert(scope.stamp({
      user_id: user.id, patient_id: pid, etiqueta_id: et.id,
      posta_por: (user as any).name || user.email || '',
    })).select().single()
    if (error || !data) {
      setErro(reportError('etiqueta-por', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setPostas(p => [...p, data])
  }

  async function tirar(id: string) {
    const antes = postas
    setPostas(p => p.filter(x => x.id !== id))
    const { error } = await supabase.from('etiquetas_do_utente').delete().eq('id', id)
    if (error) { setPostas(antes); setErro(reportError('etiqueta-tirar', error, MSG.save)) }
  }

  /** Criar uma etiqueta nova no catálogo E pô-la já nesta pessoa. */
  async function criar() {
    const nome = nova.trim()
    if (!nome || !user) return
    const { data, error } = await supabase.from('etiquetas').insert(scope.stamp({
      user_id: user.id, nome, cor: 'cinza',
    })).select().single()
    if (error || !data) {
      // Uma etiqueta com este nome já existe: em vez de dar erro, usa-se a que
      // existe. É o que a pessoa queria, e é o ponto todo de haver catálogo.
      if (error && /duplicate key/i.test(error.message)) {
        const ja = catalogo.find(c => c.nome.toLowerCase() === nome.toLowerCase())
        if (ja) { await por(ja); setNova(''); return }
      }
      setErro(reportError('etiqueta-criar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setCatalogo(p => [...p, data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')))
    await por(data)
    setNova('')
  }

  const porId = useMemo(() => new Map(catalogo.map(c => [c.id, c])), [catalogo])
  const minhas = useMemo(
    () => postas.map(p => ({ ligacao: p.id, et: porId.get(p.etiqueta_id) })).filter(x => x.et),
    [postas, porId])
  const jaTem = useMemo(() => new Set(postas.map(p => p.etiqueta_id)), [postas])
  const disponiveis = useMemo(() => catalogo.filter(c => !jaTem.has(c.id)), [catalogo, jaTem])

  if (indisponivel) return null
  if (!minhas.length && !podeEditar) return null

  return (
    <div style={{ marginTop: 'var(--space-7)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {minhas.map(({ ligacao, et }) => {
          const c = CORES_DE_ETIQUETA[et!.cor] || CORES_DE_ETIQUETA.cinza
          return (
            <span key={ligacao} title={et!.descricao || undefined} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 999,
              background: c.fundo, border: `1px solid ${c.borda}`, color: c.texto,
              fontSize: 12, fontWeight: 700,
            }}>
              {et!.nome}
              {podeEditar && (
                <button onClick={() => tirar(ligacao)} aria-label={`Tirar ${et!.nome}`} style={{
                  background: 'none', border: 'none', color: c.texto, cursor: 'pointer',
                  fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.6,
                }}>×</button>
              )}
            </span>
          )
        })}

        {podeEditar && !aEscolher && (
          <button onClick={() => setAEscolher(true)} style={{
            padding: '5px 11px', minHeight: 30, borderRadius: 999, cursor: 'pointer',
            border: '1px dashed var(--border-2)', background: 'transparent',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--ink-4)',
          }}>+ etiqueta</button>
        )}
      </div>

      {erro && <div style={{ marginTop: 8, fontSize: 12.5, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>}

      {aEscolher && podeEditar && (
        <div style={{
          marginTop: 10, padding: '12px 14px', borderRadius: 'var(--r-lg)',
          border: `1.5px solid ${cor}`, background: 'var(--bg)',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: disponiveis.length ? 10 : 0 }}>
            {disponiveis.map(et => {
              const c = CORES_DE_ETIQUETA[et.cor] || CORES_DE_ETIQUETA.cinza
              return (
                <button key={et.id} onClick={() => por(et)} title={et.descricao || undefined} style={{
                  padding: '6px 11px', minHeight: 32, borderRadius: 999, cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${c.borda}`, color: c.texto,
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                }}>+ {et.nome}</button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={nova} onChange={e => setNova(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') criar() }}
              placeholder="Criar etiqueta nova"
              style={{
                flex: 1, minWidth: 0, padding: '8px 11px', minHeight: 38, borderRadius: 8,
                border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13,
              }} />
            <button onClick={criar} disabled={!nova.trim()} style={{
              flexShrink: 0, padding: '0 14px', minHeight: 38, borderRadius: 8, border: 'none',
              background: nova.trim() ? cor : 'var(--bg-3)', color: nova.trim() ? '#fff' : 'var(--ink-5)',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              cursor: nova.trim() ? 'pointer' : 'default',
            }}>Criar</button>
            <button onClick={() => { setAEscolher(false); setNova('') }} style={{
              flexShrink: 0, padding: '0 12px', minHeight: 38, borderRadius: 8,
              border: '1px solid var(--border-2)', background: 'transparent',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer',
            }}>Fechar</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 8, lineHeight: 1.5 }}>
            Uma etiqueta criada aqui fica disponível para toda a casa — é isso que faz
            a pesquisa funcionar.
          </div>
        </div>
      )}
    </div>
  )
}
