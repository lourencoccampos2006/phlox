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
import Icon from '@/components/Icon'

const INST_TYPES: { id: string; label: string; emoji: string }[] = [
  { id: 'day_care', label: 'Centro de Dia', emoji: 'clock' },
  { id: 'nursing_home', label: 'Lar / ERPI', emoji: '🏡' },
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
      if (r.noServiceKey) { console.error('[phlox:org-setup] service key missing'); setMsg('A partilha em equipa ainda não está ativa nesta conta — podes continuar a usar sozinho por agora, e ativamos a equipa contigo quando quiseres.'); }
      else if (r.error) setMsg('Não foi possível criar a instituição agora. Tenta de novo daqui a pouco.')
      else { setOrg(r.org); try { setInstitution?.(instType) } catch {} ; setMsg('Instituição criada. Os seus utentes foram associados à equipa.') }
    } catch (e: any) { setMsg(e.message || 'Erro a criar.') }
    setBusy(false)
    refresh()
  }

  const stepDone = { type: !!instType, org: !!org, patients: (patientCount ?? 0) > 0 }

  const Card = ({ n, title, done, children }: any) => (
    <div style={{ background: 'white', border: `1px solid ${done ? 'var(--green-mid)' : 'var(--border)'}`, borderRadius: 'var(--r-xl)', padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: done ? 'var(--green)' : 'var(--green-3)', color: 'white', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{done ? '✓' : n}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{title}</span>
      </div>
      {children}
    </div>
  )

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '26px clamp(14px,4vw,28px) 70px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--green-3)', fontWeight: 700, marginBottom: 6 }}>Arranque · minutos</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 500, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Pôr a sua instituição a postos</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-3)', margin: '0 0 22px', lineHeight: 1.55 }}>Quatro passos rápidos. Pode trazer os dados que já tem — não precisa de começar do zero.</p>

        {/* 1. Tipo de instituição */}
        <Card n={1} title="Que tipo de instituição é?" done={stepDone.type}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INST_TYPES.map(t => (
              <button key={t.id} onClick={() => setInstType(t.id)} disabled={!!org}
                style={{ padding: '9px 14px', borderRadius: 'var(--r-lg)', border: `1.5px solid ${instType === t.id ? 'var(--green-3)' : 'var(--border)'}`, background: instType === t.id ? 'var(--green-light)' : 'white', color: instType === t.id ? 'var(--green)' : 'var(--ink-3)', fontSize: 13.5, fontWeight: 700, cursor: org ? 'default' : 'pointer', opacity: org && instType !== t.id ? 0.5 : 1 }}>
                <Icon name={t.emoji} size={15} />  {t.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 10 }}>O Phlox adapta-se: vocabulário ({cfg.personNoun}), cockpit e ferramentas talhados para {cfg.unitNoun}.</div>
        </Card>

        {/* 2. Criar a equipa partilhada (org) */}
        <Card n={2} title="Criar o espaço da equipa" done={stepDone.org}>
          {org ? (
            <div style={{ fontSize: 13.5, color: 'var(--green)' }}>✓ <strong>{org.name}</strong> está criada. A equipa partilha os mesmos utentes e registos. <Link href="/equipa" style={{ color: 'var(--green-3)', fontWeight: 700 }}>Adicionar funcionários →</Link></div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>Crie a sua instituição para que toda a equipa trabalhe sobre os mesmos dados (e o dono veja tudo).</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Nome da instituição" style={{ flex: '1 1 220px', padding: '10px 13px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 14, outline: 'none' }} />
                <button onClick={createOrg} disabled={busy || !orgName.trim()} style={{ padding: '10px 18px', background: busy || !orgName.trim() ? 'var(--border)' : 'var(--green-3)', color: busy || !orgName.trim() ? 'var(--ink-5)' : 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 14, fontWeight: 800, cursor: busy || !orgName.trim() ? 'default' : 'pointer' }}>{busy ? 'A criar…' : 'Criar'}</button>
              </div>
            </>
          )}
          {msg && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>{msg}</div>}
        </Card>

        {/* 3. Importar os utentes que já tem */}
        <Card n={3} title={`Trazer os seus ${cfg.personNounPlural.toLowerCase()}`} done={stepDone.patients}>
          {(patientCount ?? 0) > 0 ? (
            <div style={{ fontSize: 13.5, color: 'var(--green)' }}>✓ Já tem <strong>{patientCount}</strong> {((patientCount ?? 0) === 1 ? cfg.personNoun : cfg.personNounPlural).toLowerCase()}. <Link href="/migrar" style={{ color: 'var(--green-3)', fontWeight: 700 }}>Importar mais →</Link></div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>Já tem os dados noutro programa (Excel, PDF, Sifarma, SClínico)? Importe-os num clique — não recomece do zero.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/migrar" style={{ padding: '10px 16px', background: 'var(--green-3)', color: 'white', borderRadius: 'var(--r-lg)', fontSize: 13.5, fontWeight: 800, textDecoration: 'none' }}>Importar dados</Link>
                <Link href="/patients" style={{ padding: '10px 16px', background: 'white', color: 'var(--green)', border: '1.5px solid var(--green-mid)', borderRadius: 'var(--r-lg)', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>Adicionar à mão</Link>
              </div>
            </>
          )}
        </Card>

        {/* 4. Pronto */}
        <Card n={4} title="Está pronto" done={false}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.5 }}>O seu cockpit está talhado para {cfg.unitNoun}. A partir daqui, a equipa regista o dia e o Phlox organiza tudo — incluindo o que pode merecer atenção.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/painel')} style={{ padding: '12px 22px', background: 'var(--green-3)', color: 'white', border: 'none', borderRadius: 'var(--r-xl)', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>Abrir o meu cockpit →</button>
            <Link href="/radar" style={{ padding: '12px 18px', background: 'white', color: 'var(--green)', border: '1.5px solid var(--green-mid)', borderRadius: 'var(--r-xl)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Ver o que merece atenção</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
