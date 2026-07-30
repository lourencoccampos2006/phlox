'use client'

// SaudeApoioTool — aba "Saúde & Apoio" do Registo do dia. Cobre dois GAPS
// confirmados por levantamento (2026-07-30): enfermagem básica e
// acompanhamento de saúde não são atividades de grupo agendadas (não cabem em
// `activities`) nem precisam do fluxo pesado de "ronda coordenada"
// (`rounds`/`round_assignments` exige uma ronda-mãe com turno/participantes)
// — são registos pontuais, por pessoa: "hoje acompanhei a Dona Maria, estava
// bem". Tabela nova e leve: health_checkins (sprint122).
//
// Ginástica/fisioterapia/jogos/ateliers/passeios NÃO vivem aqui — já têm casa
// própria e bem construída em `activities` (aba "Atividades" ao lado).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import NotifyFamilyButton from '@/components/NotifyFamilyButton'

interface Patient { id: string; name: string; room_number?: string | null }
interface CheckIn { id: string; patient_id: string; kind: 'enfermagem' | 'acompanhamento'; date: string; notes: string; duration_min?: number | null; created_at: string }

const KIND_META: Record<CheckIn['kind'], { label: string; color: string; bg: string }> = {
  enfermagem:     { label: 'Enfermagem básica', color: '#0d6e42', bg: '#f0fdf4' },
  acompanhamento: { label: 'Acompanhamento',     color: '#1d4ed8', bg: '#eff6ff' },
}

export function SaudeApoioTool() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const toast = useToast()
  const cfg = institutionConfig(institution)

  const today = new Date().toISOString().slice(0, 10)
  const [patients, setPatients] = useState<Patient[]>([])
  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [kind, setKind] = useState<CheckIn['kind']>('acompanhamento')
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pats }, { data: chks }] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      scope.filter(supabase.from('health_checkins').select('*')).eq('date', today).order('created_at', { ascending: false }),
    ])
    setPatients(pats || [])
    setCheckins(chks || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  function openFor(patientId: string) {
    setOpenId(openId === patientId ? null : patientId)
    setKind('acompanhamento'); setNotes(''); setDuration(''); setErr('')
  }

  async function save(patientId: string) {
    if (!notes.trim()) { setErr('Escreve uma nota curta sobre o que se passou.'); return }
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('health_checkins').insert(scope.stamp({
      user_id: user.id,
      patient_id: patientId,
      kind,
      date: today,
      notes: notes.trim().slice(0, 500),
      duration_min: duration ? parseInt(duration) : null,
    }))
    if (error) { setErr(reportError('health-checkin-save', error, MSG.save)); setSaving(false); return }
    setSaving(false); setOpenId(null); setNotes(''); setDuration('')
    load()
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const checkinsFor = (patientId: string) => checkins.filter(c => c.patient_id === patientId)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '18px clamp(14px,3vw,28px) 60px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
          style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
      </div>

      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
          {cfg.emptyPeopleMsg}
        </div>
      ) : (
        filtered.map(p => {
          const mine = checkinsFor(p.id)
          const isOpen = openId === p.id
          const isExpanded = expandedId === p.id
          return (
            <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                  {p.room_number && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span>}
                  {mine.length > 0 && (
                    <button onClick={() => setExpandedId(isExpanded ? null : p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-4)', marginLeft: 8, textDecoration: 'underline' }}>
                      {mine.length} hoje {isExpanded ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                <button onClick={() => openFor(p.id)} style={{ padding: '6px 12px', background: isOpen ? 'var(--bg-3)' : 'var(--ink)', color: isOpen ? 'var(--ink-3)' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {isOpen ? 'Fechar' : '+ Registar'}
                </button>
              </div>

              {isExpanded && mine.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mine.map(c => (
                    <div key={c.id} style={{ background: KIND_META[c.kind].bg, borderRadius: 8, padding: '8px 10px', fontSize: 12.5 }}>
                      <span style={{ fontWeight: 700, color: KIND_META[c.kind].color }}>{KIND_META[c.kind].label}</span>
                      <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 6 }}>
                        {new Date(c.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        {c.duration_min ? ` · ${c.duration_min}min` : ''}
                      </span>
                      <div style={{ color: 'var(--ink-2)', marginTop: 2 }}>{c.notes}</div>
                      <div style={{ marginTop: 6 }}>
                        <NotifyFamilyButton patientId={c.patient_id} defaultBody={`Boa tarde. Deixamos uma nota sobre o dia de ${p.name.split(' ')[0]}: ${c.notes}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isOpen && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(Object.keys(KIND_META) as CheckIn['kind'][]).map(k => (
                      <button key={k} onClick={() => setKind(k)} style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${kind === k ? KIND_META[k].color : 'var(--border)'}`,
                        background: kind === k ? KIND_META[k].color : 'white', color: kind === k ? 'white' : 'var(--ink-3)',
                      }}>
                        {KIND_META[k].label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="O que se passou (obrigatório)"
                      style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    <input type="number" min={0} value={duration} onChange={e => setDuration(e.target.value)} placeholder="min"
                      style={{ width: 70, border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  </div>
                  {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
                  <button onClick={() => save(p.id)} disabled={saving || !notes.trim()}
                    style={{ alignSelf: 'flex-start', padding: '8px 16px', background: saving || !notes.trim() ? 'var(--bg-3)' : 'var(--ink)', color: saving || !notes.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving || !notes.trim() ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'A guardar…' : 'Guardar registo'}
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
