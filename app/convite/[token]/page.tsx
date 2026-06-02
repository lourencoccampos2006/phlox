'use client'

// /convite/[token] — Aceitar convite para uma organização.
// Se o utilizador não tem sessão, redireciona para /login com return URL.

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { setActiveOrgId } from '@/lib/orgContext'
import { ROLE_META } from '@/lib/capabilities'

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { user, supabase, loading } = useAuth() as any
  const router = useRouter()
  const [invite, setInvite] = useState<any>(null)
  const [err, setErr] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setInvite(d.invite) })
      .catch(e => setErr(e.message))
  }, [token])

  useEffect(() => {
    if (loading || user || !invite) return
    // redireciona para login com return URL
    const ret = encodeURIComponent(`/convite/${token}`)
    router.replace(`/login?next=${ret}`)
  }, [loading, user, invite, token, router])

  async function accept() {
    if (!user) return
    setAccepting(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${sd?.session?.access_token}` },
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Falhou')
      setActiveOrgId(d.org_id)
      router.push('/inicio')
    } catch (e: any) {
      setErr(e.message)
    } finally { setAccepting(false) }
  }

  if (err) return <Center title="Convite inválido" desc={err} />
  if (!invite) return <Center desc="A carregar convite…" />

  const roleMeta = ROLE_META[invite.role] || ROLE_META.viewer
  const org = invite.organizations

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Convite</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#0b1120', fontWeight: 400, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          {org?.name || 'Uma organização'}
        </h1>
        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.55, margin: '0 0 18px' }}>
          Convidaram-te para te juntares como <strong style={{ color: roleMeta.color }}>{roleMeta.label}</strong>
          {invite.department ? ` no departamento ${invite.department}` : ''}.
        </p>
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 12.5, color: '#475569', lineHeight: 1.55, marginBottom: 18 }}>
          {roleMeta.description}
        </div>
        <button onClick={accept} disabled={accepting || !user}
          style={{ width: '100%', padding: '12px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: accepting || !user ? 'wait' : 'pointer' }}>
          {accepting ? 'A aceitar…' : user ? 'Aceitar e entrar' : 'A redirecionar para login…'}
        </button>
      </div>
    </div>
  )
}

function Center({ title, desc }: { title?: string; desc?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 32, maxWidth: 380, textAlign: 'center' }}>
        {title && <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0b1120', marginBottom: 8 }}>{title}</div>}
        {desc && <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{desc}</div>}
      </div>
    </div>
  )
}
