'use client'

// /familia — ÍNDICE da família. REESCRITO 2026-08-10 (2ª volta, pedido do
// Fernando): a 1ª reescrita (2026-08-09) ainda tinha o cartão de cada pessoa
// a fazer TUDO — ações, ferramentas Pro, o diário institucional inteiro —
// ficando as duas páginas "dependentes uma da outra". Esta versão faz só UMA
// coisa: listar quem acompanha, o estado de cada um num relance, e levar para
// /perfil/[id] — que passa a ser a ÚNICA página com o detalhe completo (para
// perfis ligados a uma instituição E para perfis pessoais). Nenhum atalho,
// nenhuma ferramenta, nenhuma ficha vive aqui dentro — só a lista + adicionar.
//
// "+ Adicionar familiar" abre agora DOIS caminhos (pedido desde o início,
// nunca construído): preencher à mão (perfil pessoal, como sempre foi) OU
// "Já está num lar ou centro de dia" — o perfil nasce a partir do código da
// instituição, com o nome real do residente, sem a família escrever nada.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { analyzeFamilyMember, WATCH_LEVEL_META } from '@/lib/caregiverWatch'
import PushNudge from '@/components/PushNudge'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Profile { id: string; name: string; relation?: string; age?: number; sex?: string; weight?: number; conditions?: string; allergies?: string }
interface Med { id: string; profile_id: string; name: string; pills_remaining?: number; pills_per_day?: number }
interface Vital { profile_id: string; recorded_at: string; bp_sys?: number; bp_dia?: number; hr?: number; spo2?: number; weight?: number; glucose?: number; temp?: number }
interface Sym { profile_id: string; at: string; pain?: number; temperature?: number; symptoms?: string[] }
interface LinkInfo { code: string; verify_digits: string; patient_name: string }

const ACCENT = '#b45309'
const RELATION_OPTIONS = ['Pai', 'Mãe', 'Filho', 'Filha', 'Cônjuge', 'Parceiro/a', 'Avô', 'Avó', 'Irmão', 'Irmã', 'Outro']
const initials = (n: string) => n.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase()
const SEV: Record<string, { c: string; b: string; bd: string }> = {
  critical: { c: '#991b1b', b: '#fee2e2', bd: '#fca5a5' },
  major: { c: '#b91c1c', b: '#fef2f2', bd: '#fca5a5' },
}

export default function FamiliaPage() {
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [meds, setMeds] = useState<Med[]>([])
  const [vitals, setVitals] = useState<Vital[]>([])
  const [syms, setSyms] = useState<Sym[]>([])
  const [links, setLinks] = useState<Record<string, LinkInfo>>({})
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [chooserOpen, setChooserOpen] = useState(false)

  const familyLimit = (user?.plan === 'pro' || user?.plan === 'clinic') ? Infinity : 1

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!user?.id) return
    const { data: p } = await supabase.from('family_profiles')
      .select('id,name,relation,age,sex,weight,conditions,allergies').eq('user_id', user.id).order('name')
    const list = (p || []) as Profile[]
    setProfiles(list)
    if (list.length) {
      const ids = list.map(x => x.id)
      const since = new Date(Date.now() - 90 * 86400000).toISOString()
      const [m, v, s] = await Promise.all([
        supabase.from('family_profile_meds').select('id,profile_id,name,pills_remaining,pills_per_day').in('profile_id', ids),
        supabase.from('vitals').select('profile_id,recorded_at,bp_sys,bp_dia,hr,spo2,weight,glucose,temp').in('profile_id', ids).gte('recorded_at', since),
        supabase.from('symptom_logs').select('profile_id,at,pain,temperature,symptoms').in('profile_id', ids).gte('at', since).then((r: any) => r, () => ({ data: [] })),
      ])
      setMeds((m.data || []) as Med[])
      setVitals((v.data || []) as Vital[])
      setSyms((s.data || []) as Sym[])
    }
    setLoading(false)
  }, [user, supabase])

  const loadLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/family-link', { headers: await authHeaders() })
      const d = await res.json()
      if (res.ok && Array.isArray(d.links)) {
        const map: Record<string, LinkInfo> = {}
        d.links.forEach((l: any) => { map[l.family_profile_id] = { code: l.code, verify_digits: l.verify_digits, patient_name: l.patient_name } })
        setLinks(map)
      }
    } catch { /* offline */ }
  }, [authHeaders])

  useEffect(() => { load(); loadLinks() }, [load, loadLinks])

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 36, marginBottom: 12 }}>👨‍👩‍👧</div><Link href="/login" style={{ color: 'var(--green)', fontWeight: 700 }}>Iniciar sessão →</Link></div>
    </div>
  )

  const watched = profiles.map(p => {
    const linked = !!links[p.id]
    if (linked) return { p, level: 'linked' as const, signals: [] as any[] }
    const result = analyzeFamilyMember({
      age: p.age, sex: p.sex, weight: p.weight, conditions: p.conditions, allergies: p.allergies,
      meds: meds.filter(m => m.profile_id === p.id),
      vitals: vitals.filter(v => v.profile_id === p.id),
      symptoms: syms.filter(s => s.profile_id === p.id),
    })
    return { p, level: result.level, signals: result.signals }
  })

  const attention = watched.flatMap(({ p, signals }) =>
    signals.filter((s: any) => s.severity === 'critical' || s.severity === 'major').map((s: any) => ({ p, s, key: `${p.id}:${s.kind}` }))
  ).filter(x => !dismissed.has(x.key)).sort((a, b) => (a.s.severity === 'critical' ? 0 : 1) - (b.s.severity === 'critical' ? 0 : 1))

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px clamp(14px,4vw,28px) 80px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Cuidar</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,5vw,34px)', fontWeight: 500, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>A sua família</h1>
        <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>Quem acompanha, e o que precisa de si — o resto vive no perfil de cada um.</p>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 14 }} />)}</div>
        ) : profiles.length === 0 && !chooserOpen ? (
          <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 14 }}>👨‍👩‍👧</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: '#0b1120', marginBottom: 8 }}>De quem está a cuidar?</div>
            <div style={{ fontSize: 14.5, color: '#64748b', marginBottom: 22, lineHeight: 1.6, maxWidth: 380, margin: '0 auto 22px' }}>Crie um espaço para o pai, a mãe, um filho — ou ligue-se ao lar/centro de dia se já lá estiverem, com o código que a instituição lhe dá.</div>
            <button onClick={() => setChooserOpen(true)} style={{ display: 'inline-block', padding: '14px 26px', background: ACCENT, color: 'white', borderRadius: 12, fontSize: 16, fontWeight: 800, border: 'none', cursor: 'pointer' }}>+ Adicionar a primeira pessoa</button>
          </div>
        ) : (
          <>
            <PushNudge text="Ativa notificações para saberes logo quando alguém da tua família precisar de atenção." />

            {attention.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Precisa de atenção hoje</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attention.map(({ p, s, key }) => {
                    const sv = SEV[s.severity]
                    return (
                      <div key={key} style={{ background: sv.b, border: `1px solid ${sv.bd}`, borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'white', border: `1px solid ${sv.bd}`, color: sv.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{initials(p.name)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0b1120' }}>{p.name.split(' ')[0]} · {s.title}</div>
                            <div style={{ fontSize: 13, color: sv.c, lineHeight: 1.5, marginTop: 2 }}>{s.detail}</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                              <Link href={`/perfil/${p.id}`} style={{ fontSize: 12.5, fontWeight: 700, color: 'white', background: sv.c, borderRadius: 8, padding: '7px 13px', textDecoration: 'none' }}>Abrir perfil →</Link>
                              <button onClick={() => setDismissed(d => new Set(d).add(key))} style={{ fontSize: 12.5, fontWeight: 600, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Dispensar</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {watched.map(({ p, level }) => {
                const linked = level === 'linked'
                const meta = !linked ? WATCH_LEVEL_META[level as Exclude<typeof level, 'linked'>] : null
                return (
                  <Link key={p.id} href={`/perfil/${p.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', textDecoration: 'none',
                    background: 'white', border: `1px solid ${!linked && level === 'critical' ? '#fca5a5' : '#e9eaec'}`, borderRadius: 14,
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: linked ? '#eff6ff' : '#fef3c7', color: linked ? '#1d4ed8' : ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{initials(p.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700, color: '#0b1120' }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                        {p.relation && <span style={{ fontSize: 11, color: '#94a3b8' }}>{p.relation}</span>}
                        {linked ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 8px' }}>🏡 No lar/centro</span>
                        ) : meta ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 6, padding: '2px 8px' }}>{meta.label}</span>
                        ) : null}
                      </div>
                    </div>
                    <span style={{ fontSize: 18, color: '#cbd5e1', flexShrink: 0 }}>›</span>
                  </Link>
                )
              })}

              <button onClick={() => setChooserOpen(true)} style={{ display: 'block', width: '100%', padding: '14px', background: 'white', border: '2px dashed #fde68a', borderRadius: 14, textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Adicionar familiar</button>
            </div>
          </>
        )}
      </div>

      {chooserOpen && (
        <AddFamilyChooser
          onClose={() => setChooserOpen(false)}
          canAdd={profiles.length < familyLimit}
          authHeaders={authHeaders}
          onCreated={(newId) => { setChooserOpen(false); router.push(`/perfil/${newId}`) }}
        />
      )}
    </div>
  )
}

// ─── Escolher como adicionar: à mão, ou já está num lar/centro de dia ───────
function AddFamilyChooser({ onClose, canAdd, authHeaders, onCreated }: {
  onClose: () => void
  canAdd: boolean
  authHeaders: () => Promise<Record<string, string>>
  onCreated: (id: string) => void
}) {
  const { user, supabase } = useAuth() as any
  const [mode, setMode] = useState<'choose' | 'manual' | 'institution'>('choose')
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [code, setCode] = useState('')
  const [verify, setVerify] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function createManual() {
    if (!name.trim() || !user?.id) return
    setBusy(true); setError('')
    const { data, error: err } = await supabase.from('family_profiles').insert({ user_id: user.id, name: name.trim(), relation: relation || null }).select('id').single()
    setBusy(false)
    if (err || !data) { setError('Não foi possível criar o perfil agora.'); return }
    onCreated(data.id)
  }

  async function linkFromInstitution() {
    if (!code.trim()) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/family-link', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ code: code.trim(), verify: verify.trim(), relation }),
      })
      const d = await res.json()
      if (d.needsVerify) { setNeedsVerify(true); setError(d.error || ''); setBusy(false); return }
      if (!res.ok || d.error) { setError(d.error || 'Não foi possível ligar.'); setBusy(false); return }
      onCreated(d.familyProfileId)
    } catch { setError('Erro de ligação. Tente novamente.') }
    setBusy(false)
  }

  const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '16px 18px', background: 'white', border: '1.5px solid #e9eaec', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit' }
  const inp: React.CSSProperties = { border: '1.5px solid #e9eaec', borderRadius: 9, padding: '10px 13px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fbfaf8', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: '22px 20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: '#0b1120', fontWeight: 500 }}>
            {mode === 'choose' ? 'Adicionar familiar' : mode === 'manual' ? 'Preencher os dados' : 'Ligar ao lar/centro de dia'}
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: '50%', background: 'white', border: '1px solid #e9eaec', cursor: 'pointer', fontSize: 16, color: '#94a3b8' }}>×</button>
        </div>

        {!canAdd && mode === 'choose' ? (
          <div style={{ fontSize: 13.5, color: '#94a3b8', background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: 16, textAlign: 'center' }}>
            No plano gratuito e Plus pode acompanhar 1 familiar. Com o Pro, acompanha os que quiser. <Link href="/pricing" style={{ color: ACCENT, fontWeight: 700 }}>Ver planos →</Link>
          </div>
        ) : mode === 'choose' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setMode('manual')} style={card}>
              <span style={{ fontSize: 26 }}>✍️</span>
              <span>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#0b1120' }}>Vou preencher eu</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#64748b', marginTop: 1 }}>Nome, medicação, alergias — o que quiser, quando quiser</span>
              </span>
            </button>
            <button onClick={() => setMode('institution')} style={card}>
              <span style={{ fontSize: 26 }}>🏡</span>
              <span>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#0b1120' }}>Já está num lar ou centro de dia</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#64748b', marginTop: 1 }}>Tem o código? Ligamos o perfil automaticamente</span>
              </span>
            </button>
          </div>
        ) : mode === 'manual' ? (
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" autoFocus style={{ ...inp, marginTop: 6, marginBottom: 12 }} />
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Relação</label>
            <select value={relation} onChange={e => setRelation(e.target.value)} style={{ ...inp, marginTop: 6, marginBottom: 16, background: 'white' }}>
              <option value="">Escolher…</option>
              {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {error && <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createManual} disabled={busy || !name.trim()} style={{ flex: 1, padding: '12px', background: busy || !name.trim() ? '#e2e8f0' : ACCENT, color: busy || !name.trim() ? '#94a3b8' : 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'A criar…' : 'Criar perfil'}</button>
              <button onClick={() => setMode('choose')} style={{ padding: '12px 16px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>← Voltar</button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.55, margin: '0 0 14px' }}>Peça à instituição o código de acesso da família — o nome e os dados de {relation || 'quem procura'} vêm de lá automaticamente.</p>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>A sua relação</label>
            <select value={relation} onChange={e => setRelation(e.target.value)} style={{ ...inp, marginTop: 6, marginBottom: 12, background: 'white' }}>
              <option value="">Escolher…</option>
              {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Código da instituição</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Ex: PHLOX-AB12CD" style={{ ...inp, marginTop: 6, marginBottom: 12, fontFamily: 'var(--font-mono)' }} />
            {needsVerify && (
              <>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Últimos 4 dígitos do telemóvel registado</label>
                <input value={verify} onChange={e => setVerify(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" inputMode="numeric" style={{ ...inp, marginTop: 6, marginBottom: 12, fontFamily: 'var(--font-mono)' }} />
              </>
            )}
            {error && <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={linkFromInstitution} disabled={busy || !code.trim() || (needsVerify && verify.length !== 4)} style={{ flex: 1, padding: '12px', background: busy || !code.trim() ? '#e2e8f0' : '#1d4ed8', color: busy || !code.trim() ? '#94a3b8' : 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'A ligar…' : needsVerify ? 'Confirmar' : 'Ligar'}</button>
              <button onClick={() => setMode('choose')} style={{ padding: '12px 16px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>← Voltar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
