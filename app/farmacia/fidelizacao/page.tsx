'use client'

// /farmacia/fidelizacao — Programa de fidelização e gestão de clientes
// Lista membros, search rápido, modal de cliente com acumulação/troca de pontos
// e gestão de programas + recompensas (para admin).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'

interface Program {
  id: string; name: string; description: string|null
  points_per_euro: number; euro_per_point: number; min_redeem_pts: number; expiry_months: number
}
interface Member {
  id: string; card_number: string|null; name: string
  phone: string|null; email: string|null
  points_balance: number; total_earned: number; total_redeemed: number; total_spent: number
  last_visit_at: string|null; joined_at: string
}
interface Reward {
  id: string; name: string; description: string|null; points_cost: number
  stock: number|null; redeemed_count: number; active: boolean
}
interface Transaction {
  id: string; kind: 'earn'|'redeem'|'adjust'|'expire'
  points: number; amount: number|null
  reward_name: string|null; note: string|null; created_at: string
}

const ACCENT = '#0d6e42'

export default function FidelizacaoPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()

  const [programs, setPrograms] = useState<Program[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'members' | 'rewards' | 'config'>('members')
  const [showNewMember, setShowNewMember] = useState(false)
  const [showNewReward, setShowNewReward] = useState(false)
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [selected, setSelected] = useState<Member | null>(null)

  const canWrite = caps.includes('loyalty.write')
  const isAdmin = caps.includes('org.admin')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const loadAll = useCallback(async () => {
    if (!org) return
    setLoading(true); setErr(null)
    try {
      const headers = await authHeader()
      const [pp, mm, rr] = await Promise.all([
        fetch(`/api/pharmacy/loyalty/programs?org_id=${org.id}`, { headers }).then(r => r.json()),
        fetch(`/api/pharmacy/loyalty/members?org_id=${org.id}`, { headers }).then(r => r.json()),
        fetch(`/api/pharmacy/loyalty/rewards?org_id=${org.id}`, { headers }).then(r => r.json()),
      ])
      setPrograms(pp.programs || [])
      setMembers(mm.members || [])
      setRewards(rr.rewards || [])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [org, authHeader])

  useEffect(() => { if (user && !orgLoading) loadAll() }, [user, orgLoading, loadAll])

  // Search membros (server-side)
  useEffect(() => {
    if (!org) return
    const id = setTimeout(async () => {
      const headers = await authHeader()
      const url = new URL('/api/pharmacy/loyalty/members', window.location.origin)
      url.searchParams.set('org_id', org.id)
      if (search) url.searchParams.set('q', search)
      const r = await fetch(url.toString(), { headers })
      const j = await r.json()
      if (r.ok) setMembers(j.members || [])
    }, 250)
    return () => clearTimeout(id)
  }, [search, org, authHeader])

  if (orgLoading || loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>Fidelização</h1><p>Seleciona uma organização.</p></main>
  if (!caps.includes('loyalty.read')) return <main style={{ padding: 24 }}><h1>Fidelização</h1><p>Sem permissão.</p></main>

  const noProgram = programs.length === 0
  const program = programs[0]

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1400, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Fidelização</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            {org.name}
            {program && ` · ${program.name} · ${program.points_per_euro} pt/€`}
          </p>
        </div>
        {canWrite && !noProgram && tab === 'members' && (
          <button onClick={() => setShowNewMember(true)} style={btn('primary')}>+ Inscrever cliente</button>
        )}
        {isAdmin && tab === 'rewards' && !noProgram && (
          <button onClick={() => setShowNewReward(true)} style={btn('primary')}>+ Recompensa</button>
        )}
        {isAdmin && tab === 'config' && (
          <button onClick={() => setShowNewProgram(true)} style={btn('primary')}>+ Programa</button>
        )}
      </div>

      {noProgram ? (
        <div style={emptyCard}>
          <p style={{ margin: 0, color: '#6b7280' }}>Ainda não tens nenhum programa de fidelização configurado.</p>
          {isAdmin && <button onClick={() => setShowNewProgram(true)} style={{ ...btn('primary'), marginTop: 12 }}>Criar programa</button>}
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
            <KPI label="Membros activos" value={members.length.toString()} />
            <KPI label="Saldo total pontos" value={members.reduce((s, m) => s + m.points_balance, 0).toLocaleString('pt-PT')} />
            <KPI label="Volume cumulativo" value={`€${members.reduce((s, m) => s + Number(m.total_spent || 0), 0).toFixed(2)}`} />
            <KPI label="Recompensas activas" value={rewards.length.toString()} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
            <Tab label="Clientes" active={tab === 'members'} onClick={() => setTab('members')} count={members.length} />
            <Tab label="Recompensas" active={tab === 'rewards'} onClick={() => setTab('rewards')} count={rewards.length} />
            {isAdmin && <Tab label="Configuração" active={tab === 'config'} onClick={() => setTab('config')} count={programs.length} />}
          </div>

          {tab === 'members' && (
            <>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar por nome, cartão ou telefone…"
                style={{ ...input, marginBottom: 12 }} />
              {members.length === 0 ? (
                <div style={emptyCard}><p style={{ margin: 0, color: '#6b7280' }}>Sem clientes inscritos ainda.</p></div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {members.map(m => (
                    <div key={m.id} onClick={() => setSelected(m)} style={{
                      background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12,
                      cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 12, alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                          {m.name}
                          {m.card_number && <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>#{m.card_number}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {m.phone && `☎ ${m.phone}`}
                          {m.last_visit_at && ` · última visita ${new Date(m.last_visit_at).toLocaleDateString('pt-PT')}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Saldo</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{m.points_balance.toLocaleString('pt-PT')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total gasto</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>€{Number(m.total_spent || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'rewards' && (
            rewards.length === 0 ? (
              <div style={emptyCard}><p style={{ margin: 0, color: '#6b7280' }}>Sem recompensas no catálogo.</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {rewards.map(r => (
                  <div key={r.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{r.name}</div>
                    {r.description && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>{r.description}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{r.points_cost.toLocaleString('pt-PT')} pt</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{r.redeemed_count} trocas</div>
                      </div>
                      {r.stock != null && <div style={{ fontSize: 11, color: r.stock === 0 ? '#dc2626' : '#6b7280' }}>stock: {r.stock}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'config' && (
            <div style={{ display: 'grid', gap: 10 }}>
              {programs.map(p => (
                <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  {p.description && <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#6b7280' }}>{p.description}</p>}
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#374151', marginTop: 8 }}>
                    <span><b>{p.points_per_euro}</b> pt por €</span>
                    <span>1 pt = <b>€{Number(p.euro_per_point).toFixed(4)}</b></span>
                    <span>Min. troca: <b>{p.min_redeem_pts} pt</b></span>
                    <span>Validade: <b>{p.expiry_months} meses</b></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showNewMember && program && (
        <NewMemberModal orgId={org.id} programId={program.id} onClose={() => setShowNewMember(false)} onSaved={() => { setShowNewMember(false); loadAll() }} authHeader={authHeader} />
      )}
      {showNewReward && program && (
        <NewRewardModal orgId={org.id} programId={program.id} onClose={() => setShowNewReward(false)} onSaved={() => { setShowNewReward(false); loadAll() }} authHeader={authHeader} />
      )}
      {showNewProgram && (
        <NewProgramModal orgId={org.id} onClose={() => setShowNewProgram(false)} onSaved={() => { setShowNewProgram(false); loadAll() }} authHeader={authHeader} />
      )}
      {selected && program && (
        <MemberDetailModal member={selected} program={program} rewards={rewards} canWrite={canWrite}
          onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); loadAll() }} authHeader={authHeader} />
      )}
    </main>
  )
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 4 }}>{value}</div>
    </div>
  )
}
function Tab({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
      fontWeight: 600, fontSize: 14, color: active ? ACCENT : '#6b7280',
      borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`, marginBottom: -1,
    }}>
      {label}{count != null && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>({count})</span>}
    </button>
  )
}

function NewMemberModal({ orgId, programId, onClose, onSaved, authHeader }: {
  orgId: string; programId: string; onClose: () => void; onSaved: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [name, setName] = useState('')
  const [card, setCard] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/pharmacy/loyalty/members', { method: 'POST', headers, body: JSON.stringify({
        org_id: orgId, program_id: programId, name, card_number: card || null,
        phone: phone || null, email: email || null, consent_marketing: consent,
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Inscrever cliente" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <Field label="Nome"><input required value={name} onChange={e => setName(e.target.value)} style={input} /></Field>
        <Field label="Nº de cartão (opcional)"><input value={card} onChange={e => setCard(e.target.value)} style={input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Telefone"><input value={phone} onChange={e => setPhone(e.target.value)} style={input} /></Field>
          <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={input} /></Field>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Aceita receber comunicações de marketing (RGPD)
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy || !name} style={btn('primary')}>{busy ? 'A inscrever…' : 'Inscrever'}</button>
        </div>
      </form>
    </Modal>
  )
}

function NewRewardModal({ orgId, programId, onClose, onSaved, authHeader }: {
  orgId: string; programId: string; onClose: () => void; onSaved: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [cost, setCost] = useState(100)
  const [stock, setStock] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/pharmacy/loyalty/rewards', { method: 'POST', headers, body: JSON.stringify({
        org_id: orgId, program_id: programId, name, description: desc, points_cost: cost,
        stock: stock === '' ? null : stock,
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Nova recompensa" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <Field label="Nome"><input required value={name} onChange={e => setName(e.target.value)} style={input} placeholder="ex: 5€ desconto" /></Field>
        <Field label="Descrição"><textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Custo em pontos"><input required type="number" min={1} value={cost} onChange={e => setCost(parseInt(e.target.value) || 0)} style={input} /></Field>
          <Field label="Stock (vazio = ilimitado)"><input type="number" value={stock} onChange={e => setStock(e.target.value === '' ? '' : parseInt(e.target.value))} style={input} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy || !name} style={btn('primary')}>{busy ? 'A criar…' : 'Criar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function NewProgramModal({ orgId, onClose, onSaved, authHeader }: {
  orgId: string; onClose: () => void; onSaved: () => void; authHeader: () => Promise<Record<string, string>>
}) {
  const [name, setName] = useState('Cartão Saúde')
  const [desc, setDesc] = useState('')
  const [ptsPerEuro, setPtsPerEuro] = useState(1)
  const [euroPerPt, setEuroPerPt] = useState(0.01)
  const [minRedeem, setMinRedeem] = useState(100)
  const [expiryMonths, setExpiryMonths] = useState(12)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/pharmacy/loyalty/programs', { method: 'POST', headers, body: JSON.stringify({
        org_id: orgId, name, description: desc,
        points_per_euro: ptsPerEuro, euro_per_point: euroPerPt,
        min_redeem_pts: minRedeem, expiry_months: expiryMonths,
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Novo programa" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <Field label="Nome do programa"><input required value={name} onChange={e => setName(e.target.value)} style={input} /></Field>
        <Field label="Descrição"><textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Pontos por €">
            <input required type="number" step="0.01" value={ptsPerEuro} onChange={e => setPtsPerEuro(parseFloat(e.target.value) || 0)} style={input} />
            <small style={{ color: '#6b7280', fontSize: 11 }}>quantos pontos por cada euro gasto</small>
          </Field>
          <Field label="Valor por ponto (€)">
            <input required type="number" step="0.0001" value={euroPerPt} onChange={e => setEuroPerPt(parseFloat(e.target.value) || 0)} style={input} />
            <small style={{ color: '#6b7280', fontSize: 11 }}>valor em euros de 1 ponto na troca</small>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Min. para trocar"><input type="number" value={minRedeem} onChange={e => setMinRedeem(parseInt(e.target.value) || 0)} style={input} /></Field>
          <Field label="Validade pontos (meses)"><input type="number" value={expiryMonths} onChange={e => setExpiryMonths(parseInt(e.target.value) || 0)} style={input} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy || !name} style={btn('primary')}>{busy ? 'A criar…' : 'Criar programa'}</button>
        </div>
      </form>
    </Modal>
  )
}

function MemberDetailModal({ member, program, rewards, canWrite, onClose, onUpdated, authHeader }: {
  member: Member; program: Program; rewards: Reward[]; canWrite: boolean
  onClose: () => void; onUpdated: () => void; authHeader: () => Promise<Record<string, string>>
}) {
  const [tx, setTx] = useState<Transaction[]>([])
  const [tab, setTab] = useState<'earn' | 'redeem' | 'history'>('earn')
  const [amount, setAmount] = useState<number | ''>('')
  const [pointsManual, setPointsManual] = useState<number | ''>('')
  const [selReward, setSelReward] = useState<Reward | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [m, setMember] = useState<Member>(member)

  useEffect(() => {
    (async () => {
      const headers = await authHeader()
      const r = await fetch(`/api/pharmacy/loyalty/members/${member.id}`, { headers })
      const j = await r.json()
      if (r.ok) {
        setTx(j.transactions || [])
        setMember(j.member)
      }
    })()
  }, [member.id, authHeader])

  async function action(body: any) {
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch(`/api/pharmacy/loyalty/members/${member.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      // Re-carrega
      const r2 = await fetch(`/api/pharmacy/loyalty/members/${member.id}`, { headers })
      const j2 = await r2.json()
      if (r2.ok) { setTx(j2.transactions || []); setMember(j2.member) }
      setAmount(''); setPointsManual(''); setNote(''); setSelReward(null)
      onUpdated() // refresh parent list
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const projectedPoints = amount ? Math.floor(Number(amount) * program.points_per_euro) : 0
  const canRedeem = selReward && m.points_balance >= selReward.points_cost && m.points_balance >= program.min_redeem_pts

  return (
    <Modal title={m.name} onClose={onClose}>
      <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Saldo</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: ACCENT, marginTop: 2 }}>{m.points_balance.toLocaleString('pt-PT')} pt</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#6b7280' }}>
          <div>Ganhos: <b style={{ color: '#111827' }}>{m.total_earned.toLocaleString('pt-PT')}</b></div>
          <div>Trocados: <b style={{ color: '#111827' }}>{m.total_redeemed.toLocaleString('pt-PT')}</b></div>
          <div>Volume: <b style={{ color: '#111827' }}>€{Number(m.total_spent || 0).toFixed(2)}</b></div>
        </div>
      </div>

      {err && <div style={errBox}>{err}</div>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '1px solid #e5e7eb' }}>
        <Tab label="Acumular" active={tab === 'earn'} onClick={() => setTab('earn')} />
        <Tab label="Trocar" active={tab === 'redeem'} onClick={() => setTab('redeem')} />
        <Tab label="Histórico" active={tab === 'history'} onClick={() => setTab('history')} count={tx.length} />
      </div>

      {tab === 'earn' && canWrite && (
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Valor da compra (€)"><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} style={input} placeholder="ex: 12.50" /></Field>
          {amount && (
            <div style={{ background: '#dcfce7', color: '#065f46', padding: 10, borderRadius: 8, fontSize: 13 }}>
              Cliente recebe <b>{projectedPoints} pontos</b> ({program.points_per_euro} pt/€).
            </div>
          )}
          <Field label="Nota (opcional)"><input value={note} onChange={e => setNote(e.target.value)} style={input} /></Field>
          <button disabled={busy || !amount} onClick={() => action({ action: 'earn', amount, note })} style={btn('primary')}>
            {busy ? 'A registar…' : 'Atribuir pontos'}
          </button>
        </div>
      )}

      {tab === 'redeem' && canWrite && (
        <div style={{ display: 'grid', gap: 10 }}>
          {m.points_balance < program.min_redeem_pts && (
            <div style={{ background: '#fef3c7', color: '#92400e', padding: 10, borderRadius: 8, fontSize: 13 }}>
              Mínimo para trocar: {program.min_redeem_pts} pt (faltam {program.min_redeem_pts - m.points_balance})
            </div>
          )}
          <div style={{ display: 'grid', gap: 6 }}>
            {rewards.map(r => (
              <button key={r.id} onClick={() => setSelReward(r)} style={{
                textAlign: 'left', cursor: 'pointer', padding: 12,
                background: selReward?.id === r.id ? ACCENT + '14' : 'white',
                border: `1px solid ${selReward?.id === r.id ? ACCENT : '#e5e7eb'}`,
                borderRadius: 8,
                opacity: m.points_balance < r.points_cost ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</span>
                  <span style={{ fontWeight: 700, color: ACCENT }}>{r.points_cost} pt</span>
                </div>
                {r.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{r.description}</div>}
              </button>
            ))}
          </div>
          <button disabled={busy || !canRedeem} onClick={() => selReward && action({ action: 'redeem', points: selReward.points_cost, reward_id: selReward.id, reward_name: selReward.name })} style={btn('primary')}>
            {busy ? 'A trocar…' : selReward ? `Trocar por "${selReward.name}"` : 'Selecciona uma recompensa'}
          </button>
        </div>
      )}

      {tab === 'history' && (
        tx.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 13 }}>Sem transacções.</p>
        ) : (
          <div style={{ display: 'grid', gap: 4, maxHeight: 350, overflowY: 'auto' }}>
            {tx.map(t => {
              const positive = t.points > 0
              return (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: 8, background: '#f9fafb', borderRadius: 6, fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {t.kind === 'earn' && `Compra €${Number(t.amount || 0).toFixed(2)}`}
                      {t.kind === 'redeem' && `Troca: ${t.reward_name || 'recompensa'}`}
                      {t.kind === 'adjust' && (t.note || 'Ajuste manual')}
                      {t.kind === 'expire' && 'Expiração'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{new Date(t.created_at).toLocaleString('pt-PT')}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: positive ? '#065f46' : '#991b1b', fontSize: 14, alignSelf: 'center' }}>
                    {positive ? '+' : ''}{t.points} pt
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </Modal>
  )
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 14, padding: 20, maxWidth: 620, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>{children}</label>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
const errBox: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 8 }
const emptyCard: React.CSSProperties = { background: 'white', border: '1px dashed #d1d5db', padding: 28, borderRadius: 12, textAlign: 'center' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
