'use client'

// EpisodesPanel — lista episódios clínicos de um utente.
// Permite abrir novo episódio (admissão / consulta / urgência / tele).
// Mostra timeline cronológica com cor por tipo.

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { useActiveOrg } from '@/lib/orgContext'

const KIND_META: Record<string, { label: string; color: string; icon: string }> = {
  ambulatorio:   { label: 'Ambulatório',    color: '#1d4ed8', icon: '🩺' },
  internamento:  { label: 'Internamento',   color: '#dc2626', icon: '🛏' },
  urgencia:      { label: 'Urgência',        color: '#b91c1c', icon: '🚨' },
  tele:          { label: 'Teleconsulta',   color: '#0891b2', icon: '📹' },
  domiciliario:  { label: 'Domiciliário',   color: '#0d6e42', icon: '🏠' },
  outro:         { label: 'Outro',           color: '#475569', icon: '·' },
}

export default function EpisodesPanel({ patientId }: { patientId: string }) {
  const { user, supabase } = useAuth() as any
  const { org } = useActiveOrg()
  const toast = useToast()
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function refresh() {
    if (!patientId) return
    setLoading(true)
    const { data, error } = await supabase.from('episodes')
      .select('*').eq('patient_id', patientId)
      .order('start_at', { ascending: false }).limit(50)
    if (error) console.error('[episodes]', error)
    setEpisodes(data || [])
    setLoading(false)
  }
  useEffect(() => { refresh() }, [patientId])

  async function create(kind: string) {
    if (!user?.id) return
    const { error } = await supabase.from('episodes').insert({
      patient_id: patientId,
      org_id: org?.id || null,
      kind,
      attending_user_id: user.id,
      created_by: user.id,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Episódio aberto.')
    setCreating(false); refresh()
  }

  async function close(episodeId: string) {
    if (!confirm('Encerrar este episódio?')) return
    await supabase.from('episodes').update({
      status: 'closed', end_at: new Date().toISOString(),
    }).eq('id', episodeId)
    refresh()
  }

  const open = episodes.filter(e => e.status === 'open')
  const past = episodes.filter(e => e.status !== 'open')

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>Episódios clínicos</div>
          <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>
            {open.length} aberto{open.length === 1 ? '' : 's'} · {past.length} histórico
          </div>
        </div>
        <button onClick={() => setCreating(true)} style={{ padding: '7px 12px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Novo</button>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', padding: 14 }}>A carregar…</div>}

      {!loading && episodes.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-5)', textAlign: 'center', padding: 18 }}>
          Sem episódios. Cria o primeiro quando o utente for consultado/internado.
        </div>
      )}

      {!loading && open.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {open.map(ep => {
            const meta = KIND_META[ep.kind] || KIND_META.outro
            return (
              <div key={ep.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: `3px solid ${meta.color}`, borderRadius: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label} · ABERTO</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    Iniciado {new Date(ep.start_at).toLocaleString('pt-PT')}
                    {ep.ward && ` · ${ep.ward}`}
                    {ep.triage_level && ` · Triagem ${ep.triage_level}`}
                  </div>
                  {ep.primary_complaint && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 3 }}>{ep.primary_complaint}</div>}
                </div>
                <button onClick={() => close(ep.id)} style={{ padding: '5px 10px', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Encerrar</button>
              </div>
            )
          })}
        </div>
      )}

      {!loading && past.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12, color: 'var(--ink-4)', cursor: 'pointer', padding: '6px 0', fontWeight: 700 }}>Histórico ({past.length})</summary>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {past.map(ep => {
              const meta = KIND_META[ep.kind] || KIND_META.outro
              return (
                <div key={ep.id} style={{ display: 'flex', gap: 8, padding: '7px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12 }}>
                  <span>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--ink)' }}>{meta.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(ep.start_at).toLocaleDateString('pt-PT')}
                      {ep.end_at && ` → ${new Date(ep.end_at).toLocaleDateString('pt-PT')}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}

      {creating && (
        <div onClick={() => setCreating(false)} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 20, width: 380, maxWidth: '100%' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 14 }}>Abrir novo episódio</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.entries(KIND_META).map(([k, meta]) => (
                <button key={k} onClick={() => create(k)}
                  style={{ padding: '13px 10px', background: 'white', border: `1.5px solid ${meta.color}40`, borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 24 }}>{meta.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
