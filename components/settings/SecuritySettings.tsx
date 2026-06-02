'use client'

// components/settings/SecuritySettings.tsx
// Tab "Segurança" em /settings — sessões ativas + MFA enrollment.
// MFA usa o Supabase Auth (factors API).

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

export default function SecuritySettings() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()

  // ─── MFA ────────────────────────────────────────────────────────────────
  const [factors, setFactors] = useState<any[]>([])
  const [enrolling, setEnrolling] = useState<any | null>(null)  // { id, qr, secret }
  const [verifyCode, setVerifyCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadFactors() {
    try {
      const r = await supabase.auth.mfa.listFactors()
      setFactors([...(r.data?.totp || []), ...(r.data?.phone || [])])
    } catch { /* noop */ }
  }
  useEffect(() => { loadFactors() }, [])

  async function startEnroll() {
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' })
      if (error) throw error
      setEnrolling({
        id: data.id,
        qr: data.totp?.qr_code,
        secret: data.totp?.secret,
      })
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  async function verifyEnroll() {
    if (!enrolling?.id || !verifyCode.trim()) return
    setBusy(true)
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrolling.id })
      if (challenge.error) throw challenge.error
      const verify = await supabase.auth.mfa.verify({
        factorId: enrolling.id,
        challengeId: challenge.data.id,
        code: verifyCode.trim(),
      })
      if (verify.error) throw verify.error
      toast.success('MFA ativado.')
      setEnrolling(null); setVerifyCode('')
      await loadFactors()
    } catch (e: any) { toast.error(e.message || 'Código inválido') }
    finally { setBusy(false) }
  }

  async function unenroll(id: string) {
    if (!confirm('Desativar este fator MFA?')) return
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
      if (error) throw error
      toast.success('Removido.')
      await loadFactors()
    } catch (e: any) { toast.error(e.message) }
  }

  // ─── Sessões ────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<any[]>([])
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data } = await supabase.from('user_sessions').select('*').eq('user_id', user.id).order('last_seen_at', { ascending: false }).limit(20)
      setSessions(data || [])
    })()
  }, [user?.id])

  async function revokeSession(id: string) {
    if (!confirm('Revogar esta sessão?')) return
    await supabase.from('user_sessions').update({ revoked: true, revoked_at: new Date().toISOString() }).eq('id', id)
    setSessions(s => s.map(x => x.id === id ? { ...x, revoked: true } : x))
  }

  // ─── Anomalias ──────────────────────────────────────────────────────────
  const [anomalies, setAnomalies] = useState<any[]>([])
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data } = await supabase.from('access_anomalies').select('*').eq('user_id', user.id).order('detected_at', { ascending: false }).limit(10)
      setAnomalies(data || [])
    })()
  }, [user?.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── MFA ────────────────────────────────────────────────────────── */}
      <Card title="Verificação em dois passos (MFA)" subtitle="Adiciona uma 2ª camada à tua conta — código de app autenticadora.">
        {factors.filter(f => f.status === 'verified').length > 0 ? (
          <>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#15803d', marginBottom: 10 }}>
              ✓ MFA ativo
            </div>
            {factors.filter(f => f.status === 'verified').map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--bg-3)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{f.friendly_name || 'Authenticator'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>Criado {new Date(f.created_at).toLocaleDateString('pt-PT')}</div>
                </div>
                <button onClick={() => unenroll(f.id)} style={{ ...ghostBtn, color: '#dc2626' }}>Desativar</button>
              </div>
            ))}
          </>
        ) : enrolling ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.55 }}>
              1) Abre a tua app autenticadora (Google Authenticator, Authy, 1Password).<br />
              2) Digitaliza o QR ou cola o segredo.<br />
              3) Introduz o código de 6 dígitos abaixo.
            </div>
            {enrolling.qr && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={enrolling.qr} alt="QR MFA" style={{ width: 160, height: 160, display: 'block', margin: '0 auto 12px', border: '1px solid var(--border)', borderRadius: 8 }} />
            )}
            {enrolling.secret && (
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginBottom: 10, textAlign: 'center', wordBreak: 'break-all' }}>
                {enrolling.secret}
              </div>
            )}
            <input value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" inputMode="numeric" maxLength={6}
              style={{ ...input, textAlign: 'center', fontSize: 18, letterSpacing: '0.3em', fontFamily: 'var(--font-mono)' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={() => setEnrolling(null)} style={ghostBtn}>Cancelar</button>
              <button onClick={verifyEnroll} disabled={busy || verifyCode.length !== 6} style={{ ...primaryBtn, flex: 1, opacity: busy || verifyCode.length !== 6 ? 0.5 : 1 }}>
                {busy ? 'A verificar…' : 'Confirmar'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={startEnroll} disabled={busy} style={primaryBtn}>+ Ativar MFA</button>
        )}
      </Card>

      {/* ── Sessões ─────────────────────────────────────────────────────── */}
      <Card title="Sessões ativas" subtitle="Dispositivos onde estás autenticado(a). Revoga qualquer um que não reconheças.">
        {sessions.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-5)', textAlign: 'center', padding: 14 }}>Sem sessões registadas ainda. Esta funcionalidade requer aplicar sprint53_sessions_mfa.sql.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sessions.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: s.revoked ? '#f8fafc' : 'white', border: '1px solid var(--border)', borderRadius: 8, opacity: s.revoked ? 0.6 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{s.device_label || 'Dispositivo'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                    {s.geo_last || s.ip_last || '—'} · última vez {new Date(s.last_seen_at).toLocaleString('pt-PT')}
                  </div>
                </div>
                {s.revoked
                  ? <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>REVOGADA</span>
                  : <button onClick={() => revokeSession(s.id)} style={{ ...ghostBtn, color: '#dc2626' }}>Revogar</button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Anomalias ───────────────────────────────────────────────────── */}
      {anomalies.length > 0 && (
        <Card title="Atividade suspeita detetada" subtitle="">
          {anomalies.map(a => {
            const c = a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#b45309' : '#1d4ed8'
            return (
              <div key={a.id} style={{ padding: '10px 12px', border: `1px solid ${c}40`, borderLeft: `3px solid ${c}`, borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{a.description}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{new Date(a.detected_at).toLocaleString('pt-PT')} · {a.kind}</div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

function Card({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14, lineHeight: 1.55 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none' }
const primaryBtn: React.CSSProperties = { padding: '9px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const ghostBtn: React.CSSProperties = { padding: '7px 11px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
