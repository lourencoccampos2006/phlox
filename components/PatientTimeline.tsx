'use client'

// PatientTimeline — a linha do tempo ÚNICA da pessoa (Ronda 12). Funde tudo o
// que se registou (medicação, cuidados, vitais, ocorrências, avaliações,
// consultas, família, pedidos) numa história cronológica navegável. Determinística
// (lib/patientTimeline). Org-scoped. Filtro por tipo. Impressão A4.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { buildPatientTimeline, groupTimelineByDay, type TimelineItem, type TimelineKind } from '@/lib/patientTimeline'
import { printDoc } from '@/lib/print'

const KIND_META: Record<TimelineKind | 'all', { label: string; icon: string }> = {
  all: { label: 'Tudo', icon: '📜' },
  med: { label: 'Medicação', icon: '💊' },
  care: { label: 'Cuidados', icon: '📝' },
  vital: { label: 'Vitais', icon: '❤️' },
  incident: { label: 'Ocorrências', icon: '⚠️' },
  assessment: { label: 'Avaliações', icon: '📐' },
  appointment: { label: 'Consultas', icon: '📅' },
  family: { label: 'Família', icon: '👨‍👩‍👧' },
  request: { label: 'Pedidos', icon: '🙋' },
}

const TONE_COLOR: Record<string, string> = { good: '#0d6e42', warn: '#b45309', alert: '#b91c1c', default: '#475569' }

export default function PatientTimeline({ patientId, supabase, scope, patientName, accent = '#0d9488' }: {
  patientId: string; supabase: any; scope: any; patientName?: string; accent?: string
}) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TimelineKind | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) // 90 dias
    const safe = async (q: any) => { try { const r = await q; return r.error ? [] : (r.data || []) } catch { return [] } }
    const [meds, mar, care, incidents, assessments, appointments, family, requests] = await Promise.all([
      safe(supabase.from('patient_meds').select('id,name').eq('patient_id', patientId)),
      safe(supabase.from('mar_records').select('date,shift,status,med_id,recorded_at,recorded_by,source').eq('patient_id', patientId).gte('date', since)),
      safe(supabase.from('care_records').select('date,shift,notes,mood,nutrition,vitals,created_at').eq('patient_id', patientId).gte('date', since)),
      safe(supabase.from('incidents').select('date,type,severity,description,created_at').eq('patient_id', patientId).gte('date', since)),
      safe(supabase.from('assessments').select('scale,score,date,created_at').eq('patient_id', patientId).gte('date', since)),
      safe(supabase.from('appointments').select('date,time,title,type,status').eq('patient_id', patientId)),
      safe(supabase.from('family_thread_messages').select('author_side,author_name,content,kind,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(40)),
      safe(supabase.from('resident_requests').select('kind,content,status,created_at').eq('patient_id', patientId).gte('created_at', since + 'T00:00:00')),
    ])
    const medNames: Record<string, string> = {}
    for (const m of meds) medNames[m.id] = m.name
    // vitais vêm do jsonb care_records.vitals
    const vitals = (care as any[]).filter(c => c.vitals && typeof c.vitals === 'object')
      .map(c => ({ ...c.vitals, date: c.date, recorded_at: c.created_at }))
    setItems(buildPatientTimeline({ mar, medNames, care, vitals, incidents, assessments, appointments, family, requests }))
    setLoading(false)
  }, [patientId, supabase])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => filter === 'all' ? items : items.filter(i => i.kind === filter), [items, filter])
  const groups = useMemo(() => groupTimelineByDay(shown), [shown])

  function print() {
    printDoc({
      docTitle: `Linha do tempo — ${patientName || 'Utente'}`,
      docSubtitle: `Últimos 90 dias · ${filter === 'all' ? 'tudo' : KIND_META[filter].label}`,
      sections: groups.map(g => ({
        heading: g.label,
        records: g.items.map(it => ({ title: `${it.icon} ${it.title}`, meta: [it.at.slice(11, 16), it.detail].filter(Boolean).join(' · ') })),
      })),
      footerNote: 'Reúne o que a equipa registou. Documento organizacional, não é avaliação clínica.',
    })
  }

  const kinds: (TimelineKind | 'all')[] = ['all', 'med', 'care', 'vital', 'incident', 'assessment', 'appointment', 'family', 'request']
  const present = new Set(items.map(i => i.kind))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {kinds.filter(k => k === 'all' || present.has(k as TimelineKind)).map(k => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '5px 11px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${filter === k ? accent : '#e5e7eb'}`,
              background: filter === k ? accent + '12' : 'white', color: filter === k ? accent : '#64748b',
            }}>{KIND_META[k].icon} {KIND_META[k].label}</button>
          ))}
        </div>
        {items.length > 0 && <button onClick={print} style={{ padding: '6px 12px', background: 'white', color: accent, border: `1.5px solid ${accent}55`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>🖨 Imprimir</button>}
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 13, padding: '20px 0' }}>A reunir a história…</div>
      ) : shown.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Ainda sem registos {filter !== 'all' ? `de ${KIND_META[filter].label.toLowerCase()}` : ''}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map(g => (
            <div key={g.day}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '2px solid #eef0f2', paddingLeft: 14, marginLeft: 4 }}>
                {g.items.map((it, i) => (
                  <div key={i} style={{ position: 'relative', padding: '7px 0' }}>
                    <span style={{ position: 'absolute', left: -21, top: 9, width: 8, height: 8, borderRadius: '50%', background: TONE_COLOR[it.tone || 'default'], border: '2px solid white' }} />
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'var(--font-mono)', minWidth: 34 }}>{it.at.slice(11, 16)}</span>
                      <span style={{ fontSize: 14 }}>{it.icon}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, color: it.tone === 'alert' ? '#b91c1c' : '#0b1120', fontWeight: it.tone === 'alert' ? 700 : 500, lineHeight: 1.4 }}>{it.title}</span>
                        {it.detail && <span style={{ display: 'block', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{it.detail}</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
