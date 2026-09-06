'use client'

// components/institution/LivroDeRegistos.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O histórico: quem fez o quê, sobre quem, quando.
//
// Duas utilizações: na ficha de uma pessoa (só o que lhe diz respeito) e como
// vista da casa inteira (tudo, filtrável). É a mesma peça — o que muda é o
// filtro.
//
// O livro pertence à instituição. Nada disto sai daqui para o Phlox: ver a
// nota de fronteira em supabase/sprint137_activity_log.sql.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { familiaDaAcao } from '@/lib/registo'
import { iniciais, corDaPessoa } from '@/lib/presenca'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import { eFaltaDeSetup } from '@/lib/setupCodes'

interface Entrada {
  id: string; action: string; summary: string
  actor_name: string | null; subject_id: string | null; subject_name: string | null
  created_at: string; meta: any
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-5)',
}

const quando = (iso: string) => {
  const d = new Date(iso)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dia = new Date(d); dia.setHours(0, 0, 0, 0)
  const difDias = Math.round((hoje.getTime() - dia.getTime()) / 86400000)
  const hora = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  if (difDias === 0) return `hoje, ${hora}`
  if (difDias === 1) return `ontem, ${hora}`
  if (difDias < 7) return `${d.toLocaleDateString('pt-PT', { weekday: 'long' })}, ${hora}`
  return `${d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}, ${hora}`
}

export default function LivroDeRegistos({ subjectId, limite = 40, titulo }: {
  /** só o histórico desta pessoa; sem isto, o da casa toda */
  subjectId?: string
  limite?: number
  titulo?: string
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [familia, setFamilia] = useState<string>('')
  const [tudo, setTudo] = useState(false)

  const carregar = useCallback(async () => {
    if (!user) return
    setCarregando(true)
    let q = supabase.from('activity_log')
      .select('id,action,summary,actor_name,subject_id,subject_name,created_at,meta')
      .order('created_at', { ascending: false })
      .limit(tudo ? 250 : limite)
    q = scope.orgId ? q.eq('org_id', scope.orgId) : q.eq('user_id', scope.userId)
    if (subjectId) q = q.eq('subject_id', subjectId)
    const { data, error } = await q
    if (error) { if (eFaltaDeSetup(error)) setSemTabela(true); setEntradas([]) }
    else { setSemTabela(false); setEntradas(data || []) }
    setCarregando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, subjectId, limite, tudo])

  useEffect(() => { carregar() }, [carregar])

  const familias = useMemo(
    () => [...new Set(entradas.map(e => familiaDaAcao(e.action)))].sort(),
    [entradas])
  const visiveis = familia ? entradas.filter(e => familiaDaAcao(e.action) === familia) : entradas

  if (semTabela) return <AvisoDeSetup codigo="PHX-S3" oQue="O histórico ainda não está disponível nesta conta." compacto />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-4)', fontWeight: 700 }}>
          {titulo || (subjectId ? 'Histórico' : 'Livro de registos')}
        </span>
        {familias.length > 1 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Chip on={!familia} onClick={() => setFamilia('')}>Tudo</Chip>
            {familias.map(f => <Chip key={f} on={familia === f} onClick={() => setFamilia(f)}>{f}</Chip>)}
          </div>
        )}
      </div>

      {carregando ? (
        <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '12px 0' }}>A carregar…</div>
      ) : !visiveis.length ? (
        <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55, padding: '10px 0', textWrap: 'pretty' as any }}>
          Ainda não há nada registado{subjectId ? ' sobre esta pessoa' : ''}. O livro enche-se sozinho à medida
          que a equipa vai trabalhando — não é preciso escrever aqui nada.
        </div>
      ) : (
        <div>
          {visiveis.map((e, i) => {
            const novoDia = i === 0 || new Date(e.created_at).toDateString() !== new Date(visiveis[i - 1].created_at).toDateString()
            return (
              <div key={e.id}>
                {novoDia && (
                  <div style={{ ...MONO, fontSize: 9, marginTop: i ? 16 : 0, marginBottom: 6 }}>
                    {new Date(e.created_at).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--bg-3)' }}>
                  <span style={{
                    flexShrink: 0, width: 24, height: 24, borderRadius: '50%', marginTop: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: e.subject_id ? corDaPessoa(e.subject_id) : 'var(--bg-4)',
                    color: 'white', fontSize: 9, fontWeight: 700,
                  }}>{e.subject_name ? iniciais(e.subject_name) : '·'}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>{e.summary}</span>
                    <span style={{ ...MONO, display: 'block', marginTop: 2, fontSize: 9 }}>
                      {e.actor_name || 'Equipa'} · {quando(e.created_at)}
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
          {!tudo && entradas.length >= limite && (
            <button onClick={() => setTudo(true)} style={{
              marginTop: 12, minHeight: 36, padding: '0 12px', borderRadius: 8,
              border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--ink-3)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Ver mais atrás</button>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      minHeight: 28, padding: '0 10px', borderRadius: 20,
      border: `1px solid ${on ? 'var(--ink)' : 'var(--border-2)'}`,
      background: on ? 'var(--ink)' : 'var(--bg)', color: on ? 'var(--bg)' : 'var(--ink-4)',
      fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    }}>{children}</button>
  )
}
