'use client'

// /equipa — Gestão da equipa da instituição (só dono/admin).
// • Sem organização ainda → formulário para criar a instituição (fase de testes,
//   sem Stripe). • Com organização → lista a equipa, permite adicionar funcionários
//   de duas formas (gerar login na hora OU convidar por email), e ver convites
//   pendentes. As credenciais geradas mostram-se UMA vez, prontas a imprimir.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs, INST_META } from '@/lib/useClinicPrefs'

const ACCENT = '#0d9488'

const ROLES = [
  { id: 'assistant', label: 'Auxiliar / Cuidador', hint: 'Regista cuidados, medicação e ocorrências' },
  { id: 'nurse', label: 'Enfermeiro/a', hint: 'Tudo do auxiliar + avaliações clínicas' },
  { id: 'admin', label: 'Administrador/a', hint: 'Gere a equipa e vê o painel do dono' },
  { id: 'viewer', label: 'Só leitura', hint: 'Vê, mas não altera' },
]

interface Member { user_id: string; role: string; name: string; email: string; department?: string }
interface Invite { email: string; role: string; created_at: string }
interface GenLogin { name: string; username: string; password: string; role: string }

export default function EquipaPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()

  const [loading, setLoading] = useState(true)
  const [noKey, setNoKey] = useState(false)
  const [org, setOrg] = useState<{ id: string; name: string; kind: string } | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [team, setTeam] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // formulário criar org
  const [orgName, setOrgName] = useState('')
  const [orgKind, setOrgKind] = useState(institution || 'day_care')

  // adicionar membro
  const [addMode, setAddMode] = useState<'generate' | 'invite'>('generate')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('assistant')
  const [lastLogin, setLastLogin] = useState<GenLogin | null>(null)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    try {
      const h = await auth()
      const s = await fetch('/api/org/setup', { headers: h }).then(r => r.json())
      setNoKey(!!s.noServiceKey)
      setOrg(s.org || null); setMyRole(s.role || null)
      if (s.org) {
        const t = await fetch('/api/org/team', { headers: h }).then(r => r.json())
        if (t.error) setErr(t.error)
        else { setTeam(t.team || []); setInvites(t.invites || []) }
      }
    } catch (e: any) { setErr(e.message || 'Erro ao carregar.') }
    setLoading(false)
  }, [user, auth])

  useEffect(() => { loadAll() }, [loadAll])

  async function createOrg() {
    if (!orgName.trim()) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/org/setup', { method: 'POST', headers: await auth(), body: JSON.stringify({ name: orgName.trim(), kind: orgKind }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      try { localStorage.setItem('phlox-clinic-institution', orgKind) } catch {}
      await loadAll()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function addMember() {
    setBusy(true); setErr(''); setLastLogin(null)
    try {
      const payload = addMode === 'generate'
        ? { mode: 'generate', name: newName.trim(), role: newRole }
        : { mode: 'invite', email: newEmail.trim(), role: newRole }
      const r = await fetch('/api/org/team', { method: 'POST', headers: await auth(), body: JSON.stringify(payload) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      if (d.mode === 'generate') setLastLogin(d.login)
      setNewName(''); setNewEmail('')
      await loadAll()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function removeMember(id: string) {
    if (!confirm('Remover este membro da equipa? Deixa de ter acesso.')) return
    setBusy(true)
    try {
      const r = await fetch('/api/org/team', { method: 'DELETE', headers: await auth(), body: JSON.stringify({ memberUserId: id }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      await loadAll()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  function printLogin(l: GenLogin) {
    const w = window.open('', '_blank'); if (!w) return
    const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
    const name = esc(l.name), username = esc(l.username), password = esc(l.password)
    w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Acesso — ${name}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{font-size:20px;font-family:Georgia,serif}
      .box{border:2px solid #0d9488;border-radius:10px;padding:20px;max-width:380px;margin-top:16px}
      .row{margin:10px 0}.lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.1em}
      .val{font-size:20px;font-family:monospace;font-weight:700}</style></head><body>
      <h1>Acesso ao Phlox — ${name}</h1>
      <p style="font-size:13px;color:#555">Entre em phloxclinical.com com estes dados. Troque a palavra-passe depois de entrar.</p>
      <div class="box">
        <div class="row"><div class="lbl">Utilizador</div><div class="val">${username}</div></div>
        <div class="row"><div class="lbl">Palavra-passe</div><div class="val">${password}</div></div>
      </div></body></html>`)
    w.document.close(); setTimeout(() => { w.focus(); w.print() }, 300)
  }

  if (!user) return null

  const card: React.CSSProperties = { background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '20px 22px' }
  const isManager = myRole === 'owner' || myRole === 'admin'

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px clamp(14px,3vw,28px) 70px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Equipa</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 400, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          {org ? org.name : 'A sua instituição'}
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 22px', lineHeight: 1.5 }}>
          {org ? 'Adicione os funcionários e dê-lhes acesso. Todos trabalham sobre os mesmos utentes.' : 'Crie a sua instituição para começar a adicionar a equipa.'}
        </p>

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '11px 15px', fontSize: 13, marginBottom: 16 }}>{err}</div>}
        {loading && <div style={{ ...card, color: '#94a3b8' }}>A carregar…</div>}

        {/* Falta a chave de serviço → explica o que fazer (acordos/testes) */}
        {!loading && noKey && (
          <div style={{ ...card, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e', marginBottom: 8 }}>Falta um passo de configuração</div>
            <p style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.6, margin: '0 0 10px' }}>
              Para criar contas de funcionários em segurança, o Phlox precisa da chave de serviço do Supabase.
              Na <strong>Vercel → Settings → Environment Variables</strong>, adicione <strong>SUPABASE_SERVICE_ROLE_KEY</strong>
              (encontra-a no Supabase → Project Settings → API → <em>service_role</em>) e faça redeploy.
            </p>
            <p style={{ fontSize: 12.5, color: '#92400e', margin: 0 }}>É uma chave secreta — fica só no servidor, nunca é exposta ao navegador.</p>
          </div>
        )}

        {/* ── Sem organização → criar ── */}
        {!loading && !org && !noKey && (
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', marginBottom: 14 }}>Criar a instituição</div>
            <label style={lbl}>Nome da instituição</label>
            <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ex: Centro de Dia São José" style={inp} />
            <label style={{ ...lbl, marginTop: 14 }}>Tipo</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {(['day_care', 'nursing_home', 'pharmacy_community', 'clinic', 'health_center'] as const).map(k => (
                <button key={k} onClick={() => setOrgKind(k)} style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${orgKind === k ? ACCENT : '#e2e8f0'}`, background: orgKind === k ? '#f0fdfa' : 'white', color: orgKind === k ? ACCENT : '#475569', fontSize: 13, fontWeight: orgKind === k ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {INST_META[k].icon} {INST_META[k].label}
                </button>
              ))}
            </div>
            <button onClick={createOrg} disabled={busy || !orgName.trim()} style={{ ...btn, opacity: busy || !orgName.trim() ? 0.5 : 1 }}>
              {busy ? 'A criar…' : 'Criar instituição →'}
            </button>
          </div>
        )}

        {/* ── Com organização ── */}
        {!loading && org && (
          <>
            {!isManager && (
              <div style={{ ...card, marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 }}>
                Só o dono ou administrador pode gerir a equipa.
              </div>
            )}

            {isManager && (
              <>
                {/* Painel do dono — atalho */}
                <Link href="/painel-dono" style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, textDecoration: 'none', borderColor: '#cbd5e1' }}>
                  <span style={{ fontSize: 22 }}>🛡️</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0b1120' }}>Painel do dono — registo de tudo</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#64748b' }}>Quem deu a medicação a quem, e todos os registos da equipa, com data e hora.</span>
                  </span>
                  <span style={{ color: ACCENT, fontWeight: 700 }}>→</span>
                </Link>

                {/* Adicionar membro */}
                <div style={{ ...card, marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', marginBottom: 12 }}>Adicionar funcionário</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {([['generate', '⚡ Gerar login na hora'], ['invite', '✉️ Convidar por email']] as const).map(([m, label]) => (
                      <button key={m} onClick={() => setAddMode(m)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: `1.5px solid ${addMode === m ? ACCENT : '#e2e8f0'}`, background: addMode === m ? '#f0fdfa' : 'white', color: addMode === m ? ACCENT : '#475569', fontSize: 13, fontWeight: addMode === m ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
                    ))}
                  </div>

                  {addMode === 'generate' ? (
                    <>
                      <label style={lbl}>Nome do funcionário</label>
                      <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Ana Silva" style={inp} />
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 0' }}>O Phlox cria o utilizador e a palavra-passe — entrega-os ao funcionário (pode imprimir).</p>
                    </>
                  ) : (
                    <>
                      <label style={lbl}>Email do funcionário</label>
                      <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ana@exemplo.pt" style={inp} />
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 0' }}>Recebe um convite para criar a própria conta.</p>
                    </>
                  )}

                  <label style={{ ...lbl, marginTop: 14 }}>Função</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {ROLES.map(r => (
                      <button key={r.id} onClick={() => setNewRole(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${newRole === r.id ? ACCENT : '#e9eaec'}`, background: newRole === r.id ? '#f0fdfa' : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${newRole === r.id ? ACCENT : '#cbd5e1'}`, background: newRole === r.id ? ACCENT : 'white', flexShrink: 0 }} />
                        <span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{r.label}</span><span style={{ display: 'block', fontSize: 11.5, color: '#94a3b8' }}>{r.hint}</span></span>
                      </button>
                    ))}
                  </div>

                  <button onClick={addMember} disabled={busy || (addMode === 'generate' ? !newName.trim() : !newEmail.trim())} style={{ ...btn, opacity: busy || (addMode === 'generate' ? !newName.trim() : !newEmail.trim()) ? 0.5 : 1 }}>
                    {busy ? 'A processar…' : addMode === 'generate' ? 'Gerar acesso →' : 'Enviar convite →'}
                  </button>

                  {/* Credenciais geradas — mostram-se UMA vez */}
                  {lastLogin && (
                    <div style={{ marginTop: 16, background: '#f0fdfa', border: `1.5px solid ${ACCENT}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>✓ Acesso criado — entregue ao funcionário</div>
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div><div style={lblsm}>Utilizador</div><div style={mono}>{lastLogin.username}</div></div>
                        <div><div style={lblsm}>Palavra-passe</div><div style={mono}>{lastLogin.password}</div></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => printLogin(lastLogin)} style={{ ...btnSm, background: ACCENT, color: 'white' }}>🖨 Imprimir</button>
                        <button onClick={() => { navigator.clipboard?.writeText(`${lastLogin.username} / ${lastLogin.password}`) }} style={{ ...btnSm, background: 'white', color: ACCENT, border: `1px solid ${ACCENT}` }}>Copiar</button>
                      </div>
                      <p style={{ fontSize: 11.5, color: '#64748b', margin: '10px 0 0' }}>Guarde isto agora — a palavra-passe não volta a ser mostrada.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Lista da equipa */}
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', marginBottom: 12 }}>Equipa ({team.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {team.map(m => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #f1f5f9', borderRadius: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#f0fdfa', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{(m.name || '?')[0].toUpperCase()}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{m.name}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: '#94a3b8' }}>{roleLabel(m.role)}{m.email ? ` · ${m.email}` : ''}</span>
                    </span>
                    {isManager && m.role !== 'owner' && (
                      <button onClick={() => removeMember(m.user_id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Remover</button>
                    )}
                    {m.role === 'owner' && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>Dono</span>}
                  </div>
                ))}
              </div>

              {invites.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 8px' }}>Convites por aceitar</div>
                  {invites.map((iv, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', fontSize: 12.5, color: '#64748b' }}>
                      <span>✉️</span><span style={{ flex: 1 }}>{iv.email}</span><span style={{ fontSize: 11 }}>{roleLabel(iv.role)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function roleLabel(r: string) {
  return ({ owner: 'Dono', admin: 'Administrador', nurse: 'Enfermeiro/a', assistant: 'Auxiliar', clinician: 'Clínico', viewer: 'Só leitura' } as any)[r] || r
}
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }
const lblsm: React.CSSProperties = { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)', fontSize: 18, fontWeight: 700, color: '#0b1120' }
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '10px 13px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const btn: React.CSSProperties = { width: '100%', padding: '12px', background: ACCENT, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const btnSm: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
