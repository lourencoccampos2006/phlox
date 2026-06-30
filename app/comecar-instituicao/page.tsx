'use client'

// /comecar-instituicao — Assistente de arranque institucional (Ronda 5).
// Liga o que já existe num fio guiado: confirmar a instituição → criar a equipa
// partilhada (org) → importar os utentes que já tem → pronto, cockpit à medida.
// Mata a objeção "dá muito trabalho mudar". Cada passo é opcional e idempotente.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'

const INST_TYPES: { id: string; label: string; emoji: string }[] = [
  { id: 'nursing_home', label: 'Lar / ERPI', emoji: '🏡' },
  { id: 'day_care', label: 'Centro de Dia', emoji: '☀️' },
  { id: 'clinic', label: 'Clínica', emoji: '🩺' },
  { id: 'pharmacy_community', label: 'Farmácia', emoji: '💊' },
  { id: 'health_center', label: 'Centro de Saúde', emoji: '➕' },
]

export default function ComecarInstituicaoPage() {
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const { institution, setInstitution } = useClinicPrefs() as any
  const [orgName, setOrgName] = useState('')
  const [instType, setInstType] = useState<string>(institution || 'nursing_home')
  const [org, setOrg] = useState<any>(null)
  const [patientCount, setPatientCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const cfg = institutionConfig(instType as any)

  const token = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token, [supabase])

  // Estado atual: já tem org? quantos utentes?
  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const t = await token()
      const r = await fetch('/api/org/setup', { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json())
      if (r.org) { setOrg(r.org); if (r.org.name) setOrgName(r.org.name); if (r.org.kind) setInstType(r.org.kind) }
    } catch { /* sem org ainda */ }
    try {
      const { count } = await supabase.from('patients').select('id', { count: 'exact', head: true }).eq('active', true)
      setPatientCount(count ?? 0)
    } catch { setPatientCount(0) }
  }, [user, supabase, token])

  useEffect(() => { refresh() }, [refresh])

  async function createOrg() {
    if (!orgName.trim()) { setMsg('Dê um nome à instituição.'); return }
    setBusy(true); setMsg('')
    try {
      const t = await token()
      const r = await fetch('/api/org/setup', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ name: orgName.trim(), kind: instType }) }).then(r => r.json())
      if (r.noServiceKey) { setMsg('A partilha em equipa precisa da chave de serviço no servidor (SUPABASE_SERVICE_ROLE_KEY). Pode continuar a usar sozinho por agora.'); }
      else if (r.error) setMsg(r.error)
      else { setOrg(r.org); try { setInstitution?.(instType) } catch {} ; setMsg('Instituição criada. Os seus utentes foram associados à equipa.') }
    } catch (e: any) { setMsg(e.message || 'Erro a criar.') }
    setBusy(false)
    refresh()
  }

  const stepDone = { type: !!instType, org: !!org, patients: (patientCount ?? 0) > 0 }

  const Card = ({ n, title, done, children }: any) => (
    <div style={{ background: 'white', border: `1px solid ${done ? '#bbf7d0' : '#e9eaec'}`, borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: done ? '#16a34a' : '#0d9488', color: 'white', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{done ? '✓' : n}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#0b1120' }}>{title}</span>
      </div>
      {children}
    </div>
  )

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '26px clamp(14px,4vw,28px) 70px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#0d9488', fontWeight: 700, marginBottom: 6 }}>Arranque · minutos</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 500, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Pôr a sua instituição a postos</h1>
        <p style={{ fontSize: 14.5, color: '#475569', margin: '0 0 22px', lineHeight: 1.55 }}>Quatro passos rápidos. Pode trazer os dados que já tem — não precisa de começar do zero.</p>

        {/* 1. Tipo de instituição */}
        <Card n={1} title="Que tipo de instituição é?" done={stepDone.type}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INST_TYPES.map(t => (
              <button key={t.id} onClick={() => setInstType(t.id)} disabled={!!org}
                style={{ padding: '9px 14px', borderRadius: 10, border: `1.5px solid ${instType === t.id ? '#0d9488' : '#e9eaec'}`, background: instType === t.id ? '#f0fdfa' : 'white', color: instType === t.id ? '#0d6e42' : '#475569', fontSize: 13.5, fontWeight: 700, cursor: org ? 'default' : 'pointer', opacity: org && instType !== t.id ? 0.5 : 1 }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>O Phlox adapta-se: vocabulário ({cfg.personNoun}), cockpit e ferramentas talhados para {cfg.unitNoun}.</div>
        </Card>

        {/* 2. Criar a equipa partilhada (org) */}
        <Card n={2} title="Criar o espaço da equipa" done={stepDone.org}>
          {org ? (
            <div style={{ fontSize: 13.5, color: '#15803d' }}>✓ <strong>{org.name}</strong> está criada. A equipa partilha os mesmos utentes e registos. <Link href="/equipa" style={{ color: '#0d9488', fontWeight: 700 }}>Adicionar funcionários →</Link></div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.5 }}>Crie a sua instituição para que toda a equipa trabalhe sobre os mesmos dados (e o dono veja tudo).</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Nome da instituição" style={{ flex: '1 1 220px', padding: '10px 13px', border: '1.5px solid #e9eaec', borderRadius: 10, fontSize: 14, outline: 'none' }} />
                <button onClick={createOrg} disabled={busy || !orgName.trim()} style={{ padding: '10px 18px', background: busy || !orgName.trim() ? '#e2e8f0' : '#0d9488', color: busy || !orgName.trim() ? '#94a3b8' : 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: busy || !orgName.trim() ? 'default' : 'pointer' }}>{busy ? 'A criar…' : 'Criar'}</button>
              </div>
            </>
          )}
          {msg && <div style={{ fontSize: 12.5, color: '#475569', marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>{msg}</div>}
        </Card>

        {/* 3. Importar os utentes que já tem */}
        <Card n={3} title={`Trazer os seus ${cfg.personNounPlural.toLowerCase()}`} done={stepDone.patients}>
          {(patientCount ?? 0) > 0 ? (
            <div style={{ fontSize: 13.5, color: '#15803d' }}>✓ Já tem <strong>{patientCount}</strong> {((patientCount ?? 0) === 1 ? cfg.personNoun : cfg.personNounPlural).toLowerCase()}. <Link href="/migrar" style={{ color: '#0d9488', fontWeight: 700 }}>Importar mais →</Link></div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.5 }}>Já tem os dados noutro programa (Excel, PDF, Sifarma, SClínico)? Importe-os num clique — não recomece do zero.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/migrar" style={{ padding: '10px 16px', background: '#0d9488', color: 'white', borderRadius: 10, fontSize: 13.5, fontWeight: 800, textDecoration: 'none' }}>Importar dados</Link>
                <Link href="/patients" style={{ padding: '10px 16px', background: 'white', color: '#0d6e42', border: '1.5px solid #99f6e4', borderRadius: 10, fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>Adicionar à mão</Link>
              </div>
            </>
          )}
        </Card>

        {/* 4. Pronto */}
        <Card n={4} title="Está pronto" done={false}>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 12, lineHeight: 1.5 }}>O seu cockpit está talhado para {cfg.unitNoun}. A partir daqui, a equipa regista o dia e o Phlox organiza tudo — incluindo o que pode merecer atenção.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/painel')} style={{ padding: '12px 22px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 11, fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>Abrir o meu cockpit →</button>
            <Link href="/radar" style={{ padding: '12px 18px', background: 'white', color: '#0d6e42', border: '1.5px solid #99f6e4', borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Ver o que merece atenção</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
