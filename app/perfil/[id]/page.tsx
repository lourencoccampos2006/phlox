'use client'

// /perfil/[id] — a ÚNICA página com o detalhe completo de um familiar.
// REESCRITO DO ZERO 2026-08-10 (pedido do Fernando, 2ª volta): a versão
// anterior tinha 6 separadores escondidos num strip sem scrollbar (cortados
// em mobile real), jargão clínico em bruto sem explicação, e um "Notas"
// morto que mandava editar noutro sítio. E, criticamente, não sabia NADA
// sobre instituições — só lia family_profiles. Agora esta página adapta-se:
//
//  · Perfil LIGADO a um lar/centro de dia → o que a equipa regista sobre a
//    pessoa, traduzido e sempre atual: hoje, plano de cuidados, avaliações
//    (nível + tendência, nunca a pontuação em bruto), feridas (sem fotos),
//    incidentes, mudanças de medicação, diário com fotos, mensagens, visitas.
//  · Perfil PESSOAL (nunca ligado) → o que sempre foi: dados clínicos,
//    medicação, notas (agora editáveis aqui mesmo), agenda, ajuda, passagem.
//
// Em AMBOS os casos, mensagens (quando ligado) e este perfil completo
// continuam sempre acessíveis — era precisamente isto que tinha ficado
// partido na reescrita anterior de /familia.
//
// Sem separadores: secções empilhadas, a maioria fechada por omissão
// (mesmo padrão "▸ Mais ferramentas" já usado esta sessão) — nada de tabs
// escondidos, nada de parede de conteúdo sempre aberta.

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { setActiveProfile } from '@/lib/profileContext'
import { usePhloxContext } from '@/lib/copilotContext'
import ProfileAgenda from '@/components/ProfileAgenda'
import ProfileHelpBoard from '@/components/ProfileHelpBoard'
import HandoffNotes from '@/components/HandoffNotes'
import RiskIndexCard from '@/components/RiskIndexCard'
import CrisisPlaybookCard from '@/components/CrisisPlaybookCard'
import ZaritBurdenCard from '@/components/ZaritBurdenCard'
import ShareInviteButton from '@/components/ShareInviteButton'
import HandoffSheetButton from '@/components/HandoffSheetButton'
import FamilyChat, { type ChatMessage } from '@/components/FamilyChat'

const ACCENT_PERSONAL = '#7c3aed'
const ACCENT_LINKED = '#1d4ed8'
const RELATION_OPTIONS = ['Pai', 'Mãe', 'Filho', 'Filha', 'Cônjuge', 'Parceiro/a', 'Avô', 'Avó', 'Irmão', 'Irmã', 'Outro']

interface FamilyProfile { id: string; name: string; relation?: string; age?: number; sex?: string; weight?: number; height?: number; creatinine?: number; conditions?: string; allergies?: string; notes?: string }
interface Med { id: string; name: string; dose?: string; frequency?: string; indication?: string; reminder_times?: string[] | null }
interface MedLog { id: string; med_id: string; scheduled_time: string }
interface LinkRow { code: string; verify_digits: string; patient_name: string }

function calcCrCl(age?: number, weight?: number, sex?: string, creatinine?: number): number | null {
  if (!age || !weight || !creatinine || creatinine <= 0) return null
  const base = ((140 - age) * weight) / (72 * creatinine)
  return Math.round(base * (sex === 'F' ? 0.85 : 1) * 10) / 10
}
function crClLabel(crcl: number | null): { label: string; color: string } | null {
  if (crcl === null) return null
  if (crcl >= 90) return { label: 'Normal', color: '#16a34a' }
  if (crcl >= 60) return { label: 'Ligeira', color: '#d97706' }
  if (crcl >= 30) return { label: 'Moderada', color: '#f97316' }
  if (crcl >= 15) return { label: 'Grave', color: '#dc2626' }
  return { label: 'Falência', color: '#7f1d1d' }
}

export default function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#fbfaf8' }} />}>
      <PerfilPageInner params={params} />
    </Suspense>
  )
}

// ─── Cartão de secção — colapsável, mesmo padrão do resto do site esta sessão ──
function Section({ title, badge, defaultOpen, children, accent }: { title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode; accent: string }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0b1120' }}>{title}</span>
          {badge && <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, background: accent + '18', borderRadius: 6, padding: '2px 7px' }}>{badge}</span>}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 13, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function PerfilPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = useAuth() as any
  const [profileId, setProfileId] = useState<string | null>(null)
  useEffect(() => { params.then(p => setProfileId(p.id)) }, [params])

  const [profile, setProfile] = useState<FamilyProfile | null | undefined>(undefined)
  const [link, setLink] = useState<LinkRow | null | undefined>(undefined)
  const [portal, setPortal] = useState<any | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // ── perfil pessoal (não ligado): medicação própria ──
  const [meds, setMeds] = useState<Med[]>([])
  const [medLogs, setMedLogs] = useState<MedLog[]>([])
  const today = new Date().toISOString().slice(0, 10)

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!user?.id || !profileId) return
    const { data: p } = await supabase.from('family_profiles').select('*').eq('id', profileId).eq('user_id', user.id).maybeSingle()
    setProfile(p || null)
    if (!p) return
    setActiveProfile({ id: p.id, name: p.name, type: 'family', age: p.age, sex: p.sex, weight: p.weight, conditions: p.conditions, allergies: p.allergies, ownerId: user.id })

    const [{ data: linkRow }, { data: m }, { data: logs }] = await Promise.all([
      fetch('/api/family-link', { headers: await authHeaders() }).then(r => r.json()).then(d => ({ data: (d.links || []).find((l: any) => l.family_profile_id === profileId) || null })).catch(() => ({ data: null })),
      supabase.from('family_profile_meds').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }),
      supabase.from('family_profile_med_logs').select('id, med_id, scheduled_time').eq('profile_id', profileId).eq('date', today),
    ])
    setLink(linkRow)
    setMeds(m || [])
    setMedLogs(logs || [])
  }, [user, supabase, profileId, authHeaders, today])

  useEffect(() => { load() }, [load])

  const fetchPortal = useCallback(async (l: LinkRow) => {
    setPortalLoading(true)
    try {
      const res = await fetch(`/api/family-portal?code=${encodeURIComponent(l.code)}&verify=${encodeURIComponent(l.verify_digits)}`)
      const d = await res.json()
      if (res.ok && !d.needsVerify) setPortal(d)
    } catch { /* offline */ }
    setPortalLoading(false)
  }, [])

  useEffect(() => {
    if (!link) return
    fetchPortal(link)
    const t = setInterval(() => fetchPortal(link), 20000)
    return () => clearInterval(t)
  }, [link, fetchPortal])

  usePhloxContext(
    profile ? `Perfil de família: ${profile.name}` : '',
    profile ? { nome: profile.name, ligado_a_instituicao: !!link, medicacao: link ? (portal?.homeMeds || []).map((m: any) => m.name) : meds.map(m => m.name) } as any : {}
  )

  if (profile === undefined) return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 18px' }}>
        <div className="skeleton" style={{ height: 90, borderRadius: 14, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
      </div>
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: '#0b1120', marginBottom: 14 }}>Perfil não encontrado</div>
        <Link href="/familia" style={{ color: '#7c3aed', fontWeight: 700, textDecoration: 'none' }}>← Voltar à família</Link>
      </div>
    </div>
  )

  const linked = !!link
  const accent = linked ? ACCENT_LINKED : ACCENT_PERSONAL
  // Nome/dados a mostrar: quando ligado, a instituição é a fonte oficial —
  // decisão tomada com o Fernando (2026-08-10). O que a família escreveu à
  // mão fica arquivado, não editável, só como referência.
  const displayName = linked && portal?.patient?.name ? portal.patient.name : profile.name

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px clamp(14px,4vw,28px) 70px' }}>

        <Link href="/familia" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8', textDecoration: 'none', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
          ← Todos os perfis
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: linked ? '#eff6ff' : '#f3e8ff', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, flexShrink: 0 }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0b1120', fontWeight: 500, letterSpacing: '-0.01em', margin: 0 }}>{displayName}</h1>
            <div style={{ fontSize: 12.5, color: '#94a3b8', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>
              {profile.relation && <span>{profile.relation}</span>}
              {linked ? <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT_LINKED, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 7px' }}>🏡 No lar/centro de dia</span>
                : profile.age ? <span>{profile.age} anos</span> : null}
            </div>
          </div>
          <Link href={`/ai${linked ? '' : `?profile=${profile.id}`}`} style={{ fontSize: 12, fontWeight: 700, color: accent, textDecoration: 'none', flexShrink: 0 }}>Perguntar à IA →</Link>
        </div>

        {linked ? (
          <LinkedSections portal={portal} loading={portalLoading} accent={accent} link={link!} profile={profile} onUnlink={async () => {
            if (!confirm('Desligar este perfil da instituição? Deixa de ver o diário, medicação e conversa. Pode voltar a ligar quando quiser.')) return
            try { await fetch(`/api/family-link?family_profile_id=${profile.id}`, { method: 'DELETE', headers: await authHeaders() }) } catch { /* offline */ }
            setLink(null); setPortal(null)
          }} onRefresh={() => fetchPortal(link!)} />
        ) : (
          <PersonalSections profile={profile} meds={meds} medLogs={medLogs} today={today}
            onReload={load}
            onLinked={(newLink) => setLink(newLink)}
          />
        )}

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button onClick={async () => {
            if (!confirm(`Apagar o perfil de ${profile.name}? Esta ação não pode ser desfeita.`)) return
            await supabase.from('family_profiles').delete().eq('id', profile.id).eq('user_id', user!.id)
            window.location.href = '/familia'
          }} style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>Apagar perfil</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  PERFIL LIGADO — tudo o que a instituição regista, traduzido e atual
// ════════════════════════════════════════════════════════════════════════
function LinkedSections({ portal, loading, accent, link, profile, onUnlink, onRefresh }: {
  portal: any; loading: boolean; accent: string; link: LinkRow; profile: FamilyProfile
  onUnlink: () => void; onRefresh: () => void
}) {
  const { user, supabase } = useAuth() as any
  const [myName, setMyName] = useState('')
  useEffect(() => { try { setMyName(localStorage.getItem('phlox-familia-name') || '') } catch {} }, [])
  function saveMyName(n: string) { setMyName(n); try { localStorage.setItem('phlox-familia-name', n) } catch {} }

  const [dosing, setDosing] = useState('')
  const [visitOpen, setVisitOpen] = useState(false)
  const [myNote, setMyNote] = useState(profile.notes || '')
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  if (loading && !portal) return <div className="skeleton" style={{ height: 240, borderRadius: 14 }} />
  if (!portal) return (
    <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: 18, textAlign: 'center', color: '#94a3b8', fontSize: 13.5 }}>
      Não foi possível carregar os dados da instituição agora. <button onClick={onRefresh} style={{ color: accent, background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Tentar de novo</button>
    </div>
  )

  const p = portal.patient || {}
  const crcl = calcCrCl(p.age, p.weight, p.sex, p.creatinine)
  const crclInfo = crClLabel(crcl)
  const todayLine = (portal.dailySummaries || [])[0]
  const isToday = todayLine && todayLine.date === new Date().toISOString().slice(0, 10)

  const photos = (portal.messages || []).filter((m: any) => m.photo_url)

  async function markDose(medId: string) {
    setDosing(medId)
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_dose', code: link.code, verify: link.verify_digits, name: myName || 'Família', medId }),
      })
      if (res.ok) onRefresh()
    } catch { /* offline */ }
    setDosing('')
  }
  async function sendMessage(text: string, imageBase64?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', code: link.code, verify: link.verify_digits, name: myName || 'Família', content: text, imageBase64 }),
      })
      const d = await res.json()
      if (res.ok && d.message) { onRefresh(); return true }
      return false
    } catch { return false }
  }
  async function requestVisit(date: string, time: string, notes: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_visit', code: link.code, verify: link.verify_digits, name: myName || 'Família', date, time, notes }),
      })
      const d = await res.json().catch(() => ({}))
      return res.ok ? { ok: true } : { ok: false, error: d.error || 'Não foi possível pedir a visita.' }
    } catch { return { ok: false, error: 'Erro de ligação. Tente novamente.' } }
  }
  async function saveMyNote() {
    setSavingNote(true)
    await supabase.from('family_profiles').update({ notes: myNote }).eq('id', profile.id).eq('user_id', user!.id)
    setSavingNote(false); setNoteSaved(true); setTimeout(() => setNoteSaved(false), 1800)
  }

  return (
    <div>
      {/* HOJE */}
      <Section title="Hoje" accent={accent} defaultOpen badge={isToday && todayLine.attention ? 'Precisa de atenção' : undefined}>
        {todayLine ? (
          <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>
            {todayLine.lines.map((l: string, i: number) => <div key={i}>{l}</div>)}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Ainda sem registos hoje.</div>
        )}
        {(portal.homeMeds || []).length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Medicação para dar em casa</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {portal.homeMeds.map((m: any) => {
                const taken = (portal.todayDoses || []).some((x: any) => x.med_id === m.id && x.source === 'home')
                const givenByTeam = (portal.todayDoses || []).some((x: any) => x.med_id === m.id && x.source !== 'home' && ['administered', 'given', 'taken'].includes(x.status))
                const busy = dosing === m.id
                return (
                  <button key={m.id} onClick={() => markDose(m.id)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', padding: '10px 12px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer', border: `1.5px solid ${taken ? '#bbf7d0' : givenByTeam ? '#bfdbfe' : '#e5e7eb'}`, background: taken ? '#f0fdf4' : givenByTeam ? '#eff6ff' : 'white', fontFamily: 'inherit' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, border: `2px solid ${taken ? '#16a34a' : givenByTeam ? '#3b82f6' : '#cbd5e1'}`, background: taken ? '#16a34a' : givenByTeam ? '#3b82f6' : 'white', color: 'white' }}>{taken || givenByTeam ? '✓' : ''}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{m.name}{m.dose ? ` · ${m.dose}` : ''}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: taken ? '#16a34a' : givenByTeam ? '#2563eb' : '#94a3b8' }}>{busy ? 'A guardar…' : taken ? 'Dado em casa hoje — toque para desmarcar' : givenByTeam ? 'Já dado pela equipa hoje' : 'Toque quando der esta medicação'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      {/* MUDANÇAS DE MEDICAÇÃO */}
      {(portal.medChanges || []).length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '13px 16px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Mudanças de medicação recentes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {portal.medChanges.map((c: any) => (
              <div key={c.id + c.event} style={{ fontSize: 13, color: '#78350f' }}>
                {c.event === 'started' ? '＋ Iniciou' : '– Parou'} <strong>{c.name}</strong>{c.dose ? ` (${c.dose})` : ''} <span style={{ color: '#a16207', fontSize: 11.5 }}>· {new Date(c.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLANO DE CUIDADOS */}
      {portal.carePlan && (
        <Section title="Plano de cuidados" accent={accent} badge={portal.carePlan.lastUpdated ? `Atualizado ${new Date(portal.carePlan.lastUpdated + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}` : undefined}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Mobilidade', portal.carePlan.mobility], ['Higiene', portal.carePlan.hygiene], ['Alimentação', portal.carePlan.nutritionPlan], ['Cuidados de pele', portal.carePlan.skinCare],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l as string}><div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{l}</div><div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>{v}</div></div>
            ))}
            {(portal.carePlan.dietType || portal.carePlan.dietTexture) && (
              <div><div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Dieta</div><div style={{ fontSize: 13.5, color: '#334155' }}>{[portal.carePlan.dietType, portal.carePlan.dietTexture].filter(Boolean).join(' · ')}{portal.carePlan.fluidRestriction ? ` · restrição de líquidos${portal.carePlan.fluidRestrictionMl ? ` (${portal.carePlan.fluidRestrictionMl} ml/dia)` : ''}` : ''}</div></div>
            )}
            {portal.carePlan.fallPrevention?.length > 0 && (
              <div><div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Prevenção de quedas</div><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>{portal.carePlan.fallPrevention.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
            )}
            {portal.carePlan.pressureUlcerPrevention?.length > 0 && (
              <div><div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Prevenção de úlceras de pressão</div><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>{portal.carePlan.pressureUlcerPrevention.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
            )}
            {portal.carePlan.goals?.length > 0 && (
              <div><div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Objetivos</div><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>{portal.carePlan.goals.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
            )}
            {portal.carePlan.familyVisitSchedule && (
              <div><div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Visitas da família</div><div style={{ fontSize: 13.5, color: '#334155' }}>{portal.carePlan.familyVisitSchedule}</div></div>
            )}
          </div>
        </Section>
      )}

      {/* AVALIAÇÕES */}
      {(portal.assessments || []).length > 0 && (
        <Section title="Avaliações" accent={accent}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {portal.assessments.map((a: any) => (
              <div key={a.scale} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{a.scaleLabel}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{new Date(a.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}{a.evaluatedBy ? ` · ${a.evaluatedBy}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: a.levelColor }}>{a.levelLabel}</span>
                  {a.trend && <div style={{ fontSize: 11, color: a.trend.color, marginTop: 2 }}>{a.trend.arrow} {a.trend.label}</div>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* FERIDAS */}
      {(portal.wounds || []).length > 0 && (
        <Section title="Feridas" accent={accent} badge={`${portal.wounds.length}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {portal.wounds.map((w: any) => (
              <div key={w.id} style={{ padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{w.typeLabel} — {w.location}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>{w.statusLabel}{w.stage ? ` · ${w.stage}` : ''}{w.evolution && ` · ${w.evolution === 'melhorando' ? '🟢 a melhorar' : w.evolution === 'atenção' ? '🟠 a precisar de atenção' : '⚪ estável'}`}</div>
                {w.lastAssessedAt && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Última avaliação: {new Date(w.lastAssessedAt + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* INCIDENTES */}
      {(portal.incidents || []).length > 0 && (
        <Section title="Incidentes recentes" accent={accent} badge={`${portal.incidents.length}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {portal.incidents.map((inc: any) => (
              <div key={inc.id} style={{ padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{inc.typeLabel} <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: 11.5 }}>· {new Date(inc.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}{inc.time ? ` às ${inc.time}` : ''}</span></div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 3, lineHeight: 1.5 }}>{inc.description}</div>
                {inc.actionTaken && <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}><strong>O que foi feito:</strong> {inc.actionTaken}</div>}
                <div style={{ fontSize: 11.5, color: inc.followUp ? '#b45309' : '#16a34a', marginTop: 4, fontWeight: 600 }}>{inc.followUp ? 'A equipa continua a acompanhar' : 'Resolvido'}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* DIÁRIO */}
      <Section title="Diário" accent={accent}>
        {(portal.dailySummaries || []).length <= 1 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Ainda sem histórico anterior.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {portal.dailySummaries.slice(1, 15).map((d: any, i: number) => (
              <div key={i} style={{ background: d.attention ? '#fffbeb' : '#f8fafc', border: `1px solid ${d.attention ? '#fde68a' : '#e2e8f0'}`, borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>{new Date(d.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                {d.lines.map((l: string, j: number) => <div key={j} style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{l}</div>)}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* MOMENTOS (fotos) */}
      {photos.length > 0 && (
        <Section title="Momentos" accent={accent} badge={`${photos.length}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {photos.slice().reverse().map((m: any) => (
              <a key={m.id} href={m.photo_url} target="_blank" rel="noreferrer" style={{ display: 'block', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#f1f5f9' }}>
                <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* MENSAGENS */}
      <Section title="Mensagens com a equipa" accent={accent} defaultOpen>
        {!myName && (
          <input value={myName} onChange={e => saveMyName(e.target.value)} placeholder="O seu nome (aparece nas mensagens)" style={{ width: '100%', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
        )}
        <FamilyChat messages={portal.messages as ChatMessage[]} mySide="family" otherLabel="a equipa" accent={accent} height={280} onSend={sendMessage} />
      </Section>

      {/* VISITAS */}
      <Section title="Visitas" accent={accent} badge={(portal.visitRequests || []).some((v: any) => v.status === 'pending') ? 'Pendente' : undefined}>
        {(portal.visitRequests || []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {portal.visitRequests.map((v: any) => {
              const st: Record<string, { label: string; c: string; bg: string; bd: string }> = {
                pending: { label: 'Pendente', c: '#b45309', bg: '#fffbeb', bd: '#fde68a' }, approved: { label: 'Aprovada', c: '#0d6e42', bg: '#f0fdf4', bd: '#bbf7d0' },
                declined: { label: 'Recusada', c: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' }, completed: { label: 'Realizada', c: '#64748b', bg: '#f8fafc', bd: '#e2e8f0' },
              }
              const s = st[v.status] || st.pending
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 9, padding: '8px 11px' }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: '#0b1120' }}>{new Date(v.requested_date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'long' })}{v.requested_time ? ` · ${v.requested_time}` : ''}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.c }}>{s.label}</span>
                </div>
              )
            })}
          </div>
        )}
        {visitOpen ? (
          <VisitForm onCancel={() => setVisitOpen(false)} onSubmit={async (date, time, notes) => { const r = await requestVisit(date, time, notes); if (r.ok) { setVisitOpen(false); onRefresh() } return r }} accent={accent} />
        ) : (
          <button onClick={() => setVisitOpen(true)} style={{ padding: '9px 14px', background: 'white', color: accent, border: `1.5px solid ${accent}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>📅 Pedir uma visita</button>
        )}
      </Section>

      {/* DADOS CLÍNICOS (do lar) */}
      <Section title="Dados clínicos" accent={accent}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['Condições', p.conditions], ['Alergias', p.allergies], ['Peso', p.weight ? `${p.weight} kg` : null], ['Altura', p.height ? `${p.height} cm` : null]]
            .filter(([, v]) => v).map(([l, v]) => (
              <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '7px 0', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ color: '#94a3b8' }}>{l}</span><span style={{ color: '#334155', fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          {crcl !== null && crclInfo && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '7px 0', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ color: '#94a3b8' }}>Função renal</span><span style={{ color: crclInfo.color, fontWeight: 700 }}>{crclInfo.label} ({crcl} mL/min)</span>
            </div>
          )}
        </div>
      </Section>

      {/* AS MINHAS NOTAS — pessoais, nunca vindas da instituição */}
      <Section title="As minhas notas" accent={accent}>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>Só sua — não é partilhado com a instituição.</p>
        <textarea value={myNote} onChange={e => setMyNote(e.target.value)} rows={3} placeholder="Ex: não gosta de peixe, fica ansioso ao fim da tarde…"
          style={{ width: '100%', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <button onClick={saveMyNote} disabled={savingNote} style={{ marginTop: 8, padding: '8px 16px', background: savingNote ? '#e2e8f0' : accent, color: savingNote ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: savingNote ? 'wait' : 'pointer' }}>{savingNote ? 'A guardar…' : noteSaved ? '✓ Guardado' : 'Guardar'}</button>
      </Section>

      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <button onClick={onUnlink} style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>Desligar da instituição</button>
      </div>
    </div>
  )
}

function VisitForm({ onSubmit, onCancel, accent }: { onSubmit: (date: string, time: string, notes: string) => Promise<{ ok: boolean; error?: string }>; onCancel: () => void; accent: string }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  if (done) return <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>✓ Pedido de visita enviado. A equipa vai confirmar.</div>
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: '1 1 150px', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none' }} />
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ flex: '0 1 120px', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none' }} />
      </div>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Nota (opcional)" style={{ width: '100%', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
      {error && <div style={{ fontSize: 12.5, color: '#b91c1c', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={async () => { if (!date) return; setBusy(true); setError(''); const r = await onSubmit(date, time, notes); setBusy(false); if (r.ok) setDone(true); else setError(r.error || 'Não foi possível pedir a visita.') }} disabled={busy || !date} style={{ padding: '9px 16px', background: busy || !date ? '#e2e8f0' : accent, color: busy || !date ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: busy || !date ? 'default' : 'pointer' }}>{busy ? 'A enviar…' : 'Pedir visita'}</button>
        <button onClick={onCancel} style={{ padding: '9px 14px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  PERFIL PESSOAL — nunca ligado a uma instituição
// ════════════════════════════════════════════════════════════════════════
function PersonalSections({ profile, meds, medLogs, today, onReload, onLinked }: {
  profile: FamilyProfile; meds: Med[]; medLogs: MedLog[]; today: string
  onReload: () => void; onLinked: (link: LinkRow) => void
}) {
  const { user, supabase } = useAuth() as any
  const isPro = user?.plan === 'pro' || user?.plan === 'clinic'
  const accent = ACCENT_PERSONAL

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({
    name: profile.name, relation: profile.relation || '', age: profile.age?.toString() || '', sex: profile.sex || '',
    weight: profile.weight?.toString() || '', height: profile.height?.toString() || '', creatinine: profile.creatinine?.toString() || '',
    conditions: profile.conditions || '', allergies: profile.allergies || '',
  })
  const [saving, setSaving] = useState(false)

  const [notes, setNotes] = useState(profile.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  const [addingMed, setAddingMed] = useState(false)
  const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '', indication: '', reminder_times: '' })
  const [savingMed, setSavingMed] = useState(false)

  const [linkOpen, setLinkOpen] = useState(false)
  const [code, setCode] = useState('')
  const [verify, setVerify] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState('')

  const crcl = calcCrCl(profile.age, profile.weight, profile.sex, profile.creatinine)
  const crclInfo = crClLabel(crcl)

  const inp: React.CSSProperties = { border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', width: '100%', boxSizing: 'border-box' }

  async function saveEdit() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('family_profiles').update({
      name: form.name.trim(), relation: form.relation || null, age: form.age ? parseInt(form.age) : null, sex: form.sex || null,
      weight: form.weight ? parseFloat(form.weight) : null, height: form.height ? parseFloat(form.height) : null,
      creatinine: form.creatinine ? parseFloat(form.creatinine) : null, conditions: form.conditions || null, allergies: form.allergies || null,
    }).eq('id', profile.id).eq('user_id', user.id)
    setSaving(false); setEditOpen(false); onReload()
  }
  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('family_profiles').update({ notes }).eq('id', profile.id).eq('user_id', user.id)
    setSavingNotes(false); setNotesSaved(true); setTimeout(() => setNotesSaved(false), 1800)
  }
  async function addMed() {
    if (!newMed.name.trim()) return
    setSavingMed(true)
    const times = newMed.reminder_times.split(',').map(t => t.trim()).filter(Boolean)
    await supabase.from('family_profile_meds').insert({
      profile_id: profile.id, user_id: user.id, name: newMed.name.trim(), dose: newMed.dose || null,
      frequency: newMed.frequency || null, indication: newMed.indication || null, reminder_times: times.length ? times : null,
    })
    setNewMed({ name: '', dose: '', frequency: '', indication: '', reminder_times: '' })
    setSavingMed(false); setAddingMed(false); onReload()
  }
  async function removeMed(id: string) { await supabase.from('family_profile_meds').delete().eq('id', id).eq('user_id', user.id); onReload() }
  async function toggleTaken(medId: string, time: string, currentlyTaken: boolean) {
    if (currentlyTaken) {
      await supabase.from('family_profile_med_logs').delete().eq('profile_id', profile.id).eq('med_id', medId).eq('date', today).eq('scheduled_time', time)
    } else {
      await supabase.from('family_profile_med_logs').upsert({ profile_id: profile.id, med_id: medId, date: today, scheduled_time: time, status: 'taken', logged_by: user.id }, { onConflict: 'profile_id,med_id,date,scheduled_time' })
    }
    onReload()
  }

  async function linkToInstitution() {
    if (!code.trim()) return
    setLinkBusy(true); setLinkError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/family-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ family_profile_id: profile.id, code: code.trim(), verify: verify.trim() }),
      })
      const d = await res.json()
      if (d.needsVerify) { setNeedsVerify(true); setLinkError(d.error || ''); setLinkBusy(false); return }
      if (!res.ok || d.error) { setLinkError(d.error || 'Não foi possível ligar.'); setLinkBusy(false); return }
      onLinked({ code: code.trim().toUpperCase(), verify_digits: verify.replace(/\D/g, '').slice(-4), patient_name: d.patientName })
    } catch { setLinkError('Erro de ligação. Tente novamente.') }
    setLinkBusy(false)
  }

  return (
    <div>
      <Section title="Dados clínicos" accent={accent} defaultOpen badge="Editar ▸" >
        {!editOpen ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {[['Condições', profile.conditions], ['Alergias', profile.allergies], ['Peso', profile.weight ? `${profile.weight} kg` : null], ['Altura', profile.height ? `${profile.height} cm` : null]]
                .filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '7px 0', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#94a3b8' }}>{l}</span><span style={{ color: '#334155', fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              {crcl !== null && crclInfo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '7px 0', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#94a3b8' }}>Função renal</span><span style={{ color: crclInfo.color, fontWeight: 700 }}>{crclInfo.label} ({crcl} mL/min)</span>
                </div>
              )}
              {!profile.conditions && !profile.allergies && !profile.weight && (
                <div style={{ fontSize: 13, color: '#94a3b8', padding: '6px 0' }}>Ainda sem dados — toque em "Editar" para preencher.</div>
              )}
            </div>
            <button onClick={() => setEditOpen(true)} style={{ fontSize: 12.5, fontWeight: 700, color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Editar dados →</button>
          </>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome" style={{ ...inp, flex: '2 1 160px' }} />
              <select value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} style={{ ...inp, flex: '1 1 110px', background: 'white' }}>
                <option value="">Relação…</option>
                {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value.replace(/\D/g, '') }))} placeholder="Idade" inputMode="numeric" style={{ ...inp, flex: '1 1 80px' }} />
              <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))} style={{ ...inp, flex: '1 1 100px', background: 'white' }}>
                <option value="">Sexo…</option><option value="M">Masculino</option><option value="F">Feminino</option><option value="outro">Outro</option>
              </select>
              <input value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="Peso (kg)" style={{ ...inp, flex: '1 1 90px' }} />
              <input value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} placeholder="Altura (cm)" style={{ ...inp, flex: '1 1 90px' }} />
              <input value={form.creatinine} onChange={e => setForm(f => ({ ...f, creatinine: e.target.value }))} placeholder="Creatinina" style={{ ...inp, flex: '1 1 100px' }} />
            </div>
            <input value={form.conditions} onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))} placeholder="Condições (ex: HTA, DM2)" style={{ ...inp, marginBottom: 8 }} />
            <input value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} placeholder="Alergias" style={{ ...inp, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} disabled={saving || !form.name.trim()} style={{ padding: '9px 16px', background: saving ? '#e2e8f0' : accent, color: saving ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'A guardar…' : 'Guardar'}</button>
              <button onClick={() => setEditOpen(false)} style={{ padding: '9px 14px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Medicação" accent={accent} defaultOpen badge={meds.length ? `${meds.length}` : undefined}>
        {meds.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>Sem medicamentos adicionados.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {meds.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9', borderRadius: 9, padding: '9px 12px', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{m.name}</div>
                  {(m.dose || m.frequency) && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{[m.dose, m.frequency].filter(Boolean).join(' · ')}</div>}
                </div>
                <button onClick={() => removeMed(m.id)} aria-label="Remover" style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {meds.some(m => m.reminder_times?.length) && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tomas de hoje</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {meds.filter(m => m.reminder_times?.length).flatMap(m => (m.reminder_times || []).map(time => {
                const taken = medLogs.some(l => l.med_id === m.id && l.scheduled_time === time)
                return (
                  <label key={`${m.id}-${time}`} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, background: taken ? '#f0fdf4' : '#f8fafc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={taken} onChange={() => toggleTaken(m.id, time, taken)} />
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{time}</span><span style={{ fontSize: 12.5, color: '#475569' }}>{m.name}</span>
                  </label>
                )
              }))}
            </div>
          </div>
        )}

        {addingMed ? (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <input value={newMed.name} onChange={e => setNewMed(f => ({ ...f, name: e.target.value }))} placeholder="Nome *" style={{ ...inp, flex: '2 1 120px' }} />
              <input value={newMed.dose} onChange={e => setNewMed(f => ({ ...f, dose: e.target.value }))} placeholder="Dose" style={{ ...inp, flex: '1 1 70px' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <input value={newMed.frequency} onChange={e => setNewMed(f => ({ ...f, frequency: e.target.value }))} placeholder="Frequência" style={{ ...inp, flex: '1 1 100px' }} />
              <input value={newMed.reminder_times} onChange={e => setNewMed(f => ({ ...f, reminder_times: e.target.value }))} placeholder="Horas (08:00, 20:00)" style={{ ...inp, flex: '1 1 130px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addMed} disabled={!newMed.name.trim() || savingMed} style={{ padding: '8px 14px', background: accent, color: 'white', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{savingMed ? '…' : 'Adicionar'}</button>
              <button onClick={() => setAddingMed(false)} style={{ padding: '8px 12px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 9, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingMed(true)} style={{ fontSize: 12.5, fontWeight: 700, color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Adicionar medicamento</button>
        )}

        {meds.length >= 2 && (
          <div style={{ marginTop: 12 }}>
            <Link href={`/interactions?profile=${profile.id}`} style={{ display: 'block', textAlign: 'center', padding: '10px', background: '#f3e8ff', color: accent, textDecoration: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700 }}>Verificar interações entre {meds.length} medicamentos →</Link>
          </div>
        )}
      </Section>

      <Section title="Notas" accent={accent} defaultOpen>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas sobre a saúde ou o dia-a-dia…" style={{ width: '100%', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <button onClick={saveNotes} disabled={savingNotes} style={{ marginTop: 8, padding: '8px 16px', background: savingNotes ? '#e2e8f0' : accent, color: savingNotes ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{savingNotes ? 'A guardar…' : notesSaved ? '✓ Guardado' : 'Guardar'}</button>
      </Section>

      <Section title="Agenda" accent={accent}><ProfileAgenda profileId={profile.id} /></Section>
      <Section title="Preciso de ajuda" accent={accent}><ProfileHelpBoard profileId={profile.id} /></Section>
      <Section title="Passagem de cuidado" accent={accent}><HandoffNotes profileId={profile.id} /></Section>

      <Section title="Mais ferramentas" accent={accent}>
        {isPro ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RiskIndexCard profileId={profile.id} title={`Risco de ${profile.name.split(' ')[0]}`} />
            <CrisisPlaybookCard profileId={profile.id} name={profile.name} />
            <ZaritBurdenCard profileId={profile.id} name={profile.name} />
            <ShareInviteButton profileId={profile.id} name={profile.name} />
            <HandoffSheetButton profileId={profile.id} name={profile.name} age={profile.age} allergies={profile.allergies} conditions={profile.conditions} meds={meds.map(m => ({ name: m.name, dose: m.dose }))} />
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
            Índice de risco, playbook de crise, sobrecarga do cuidador e partilha entre cuidadores são do plano Pro. <Link href="/pricing" style={{ color: accent, fontWeight: 700, textDecoration: 'none' }}>Ver planos →</Link>
          </div>
        )}
      </Section>

      <Section title="Ligar a um lar ou centro de dia" accent={accent}>
        {linkOpen ? (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 10, lineHeight: 1.5 }}>Peça à instituição o código de acesso da família.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Código" style={{ ...inp, flex: '1 1 140px', fontFamily: 'var(--font-mono)' }} />
              {needsVerify && <input value={verify} onChange={e => setVerify(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Últimos 4 dígitos" inputMode="numeric" style={{ ...inp, flex: '0 1 140px', fontFamily: 'var(--font-mono)' }} />}
            </div>
            {linkError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{linkError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={linkToInstitution} disabled={linkBusy || !code.trim()} style={{ padding: '9px 16px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{linkBusy ? 'A ligar…' : needsVerify ? 'Confirmar' : 'Ligar'}</button>
              <button onClick={() => setLinkOpen(false)} style={{ padding: '9px 14px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 9, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setLinkOpen(true)} style={{ fontSize: 12.5, fontWeight: 700, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>🏡 Já está num lar ou centro de dia?</button>
        )}
      </Section>
    </div>
  )
}
