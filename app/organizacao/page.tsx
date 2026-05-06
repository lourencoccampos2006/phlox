'use client'

// ─── NOVO: app/organizacao/page.tsx ───
// Página de gestão da organização/instituição.
// Acessível a org_role = 'owner' | 'admin'.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface OrgMember {
  id: string
  name: string
  email: string
  org_role: 'owner' | 'admin' | 'member'
  plan: string
  created_at: string
}

interface Org {
  id: string
  name: string
  type: string
  member_limit: number
  billing_email: string | null
}

const TYPE_LABELS: Record<string, string> = {
  pharmacy: 'Farmácia',
  clinic: 'Clínica / Consultório',
  hospital: 'Hospital',
  care_home: 'Lar / IPSS',
  other: 'Outra',
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  owner: { label: 'Proprietário', color: '#1d4ed8', bg: '#eff6ff' },
  admin: { label: 'Administrador', color: '#0d6e42', bg: '#f0fdf5' },
  member: { label: 'Membro', color: 'var(--ink-4)', bg: 'var(--bg-3)' },
}

export default function OrganizacaoPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [org, setOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'members' | 'billing'>('overview')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  const orgRole = (user as any)?.org_role
  const orgId = (user as any)?.org_id
  const canManage = orgRole === 'owner' || orgRole === 'admin'

  useEffect(() => {
    if (!user) return
    if (!orgId) { setLoading(false); return }

    Promise.all([
      supabase.from('organizations').select('*').eq('id', orgId).single(),
      supabase.from('profiles').select('id, name, email, org_role, plan, created_at').eq('org_id', orgId),
    ]).then(([{ data: orgData }, { data: membersData }]) => {
      setOrg(orgData)
      setMembers(membersData || [])
      setLoading(false)
    })
  }, [user, supabase, orgId])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg('')
    // Simplified: in production this would send an email invite
    // For now, look up user by email and add to org
    const { data: targetUser, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('email', inviteEmail.trim())
      .single()

    if (error || !targetUser) {
      setInviteMsg('Utilizador não encontrado. Certifica-te que já criou conta no Phlox.')
      setInviting(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ org_id: orgId, org_role: 'member' })
      .eq('id', targetUser.id)

    if (updateError) {
      setInviteMsg('Erro ao adicionar membro. Tenta novamente.')
    } else {
      setMembers(prev => [...prev, { ...targetUser, org_role: 'member', plan: 'pro', created_at: new Date().toISOString() }])
      setInviteMsg(`${targetUser.name} adicionado com sucesso!`)
      setInviteEmail('')
    }
    setInviting(false)
  }

  const tabStyle = (t: string) => ({
    padding: '10px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#1d4ed8' : 'transparent'}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: tab === t ? '#1d4ed8' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1, whiteSpace: 'nowrap' as const,
  })

  if (!user) return null

  // Utilizador sem organização
  if (!loading && !orgId) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header />
        <div className="page-container page-body">
          <div style={{ maxWidth: 520, margin: '0 auto', background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🏥</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Plano Institucional</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 28 }}>
              O plano institucional permite que toda a tua equipa — farmacêuticos, médicos, enfermeiros — aceda ao Phlox com uma única subscrição centralizada. Dashboard multi-utilizador, MAR digital, auditoria completa.
            </p>
            <a href="mailto:hello@phlox-clinical.com?subject=Licença Institucional"
              style={{ display: 'inline-block', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '13px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Falar com a equipa →
            </a>
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>ou <Link href="/pricing#institucional" style={{ color: '#1d4ed8', textDecoration: 'none' }}>ver preços institucionais</Link></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Header institucional */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 0 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 2, background: '#1d4ed8', borderRadius: 1 }} />
              {org ? TYPE_LABELS[org.type] || 'Instituição' : 'A carregar...'}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#f8fafc', fontWeight: 400 }}>
              {org?.name || '—'}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
              {members.length} membro{members.length !== 1 ? 's' : ''} · Limite: {org?.member_limit || 10}
            </div>
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid #1e293b', overflowX: 'auto' }}>
            {[['overview', 'Visão Geral'], ['members', 'Equipa'], ['billing', 'Faturação']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as any)}
                style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? '#1d4ed8' : 'transparent'}`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: tab === id ? '#f8fafc' : '#475569', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: -1, whiteSpace: 'nowrap' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* VISÃO GERAL */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { label: 'Membros activos', value: members.length, max: org?.member_limit || 10, color: '#1d4ed8' },
                { label: 'Plano', value: 'Institucional', color: '#0d6e42' },
              ].map(s => (
                <div key={s.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: s.color, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                  {'max' in s && (
                    <div style={{ marginTop: 8, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (members.length / (s.max as number)) * 100)}%`, background: s.color, borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ferramentas activas */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Ferramentas institucionais activas</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Gestão de Doentes', href: '/patients' },
                  { label: 'MAR Digital', href: '/mar' },
                  { label: 'Phlox AI Clínico', href: '/ai' },
                  { label: 'Protocolos', href: '/protocol' },
                  { label: 'Importar Medicamentos', href: '/importar' },
                  { label: 'Revisão de Medicação', href: '/med-review' },
                ].map(({ label, href }) => (
                  <Link key={href} href={href}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--bg-2)', borderRadius: 7, textDecoration: 'none' }}
                    className="tool-link">
                    <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{label}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EQUIPA */}
        {tab === 'members' && (
          <div>
            {canManage && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Adicionar membro</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    placeholder="Email do profissional (deve ter conta Phlox)"
                    style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}
                    style={{ padding: '11px 18px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: inviteEmail.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}>
                    {inviting ? 'A adicionar...' : 'Adicionar'}
                  </button>
                </div>
                {inviteMsg && (
                  <div style={{ marginTop: 10, fontSize: 13, color: inviteMsg.includes('sucesso') ? '#0d6e42' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                    {inviteMsg}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  O profissional deve já ter conta Phlox. Vagas: {(org?.member_limit || 10) - members.length} restantes.
                </div>
              </div>
            )}

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {members.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
                  Nenhum membro na equipa ainda.
                </div>
              ) : members.map((m, i) => {
                const roleMeta = ROLE_LABELS[m.org_role] || ROLE_LABELS.member
                const isMe = m.id === user.id
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < members.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                        {m.name} {isMe && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 400 }}>(tu)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{m.email}</div>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: roleMeta.color, background: roleMeta.bg, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                      {roleMeta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FATURAÇÃO */}
        {tab === 'billing' && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ background: '#0f172a', padding: '18px 20px' }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Plano actual</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>Institucional</div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 16 }}>
                  A faturação é gerida directamente pela equipa Phlox. Para alterações ao plano, número de membros ou dados de faturação, contacta-nos.
                </div>
                <a href="mailto:hello@phlox-clinical.com?subject=Faturação Institucional"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '10px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700 }}>
                  Contactar suporte →
                </a>
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`.tool-link:hover { background: #eff6ff !important; }`}</style>
    </div>
  )
}