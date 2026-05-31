'use client'

// Exportação dos meus dados (Art. 20.º RGPD — direito à portabilidade).
// Descarrega tudo num JSON único e estruturado.

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

export default function ExportarDadosPage() {
  const { user, supabase } = useAuth() as any
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function exportNow() {
    setBusy(true); setMsg('A preparar exportação completa…')
    try {
      const t = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch('/api/export-me', { headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) throw new Error('Falha ao exportar.')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `phlox-export-${new Date().toISOString().slice(0, 10)}.json`; a.click()
      URL.revokeObjectURL(url)
      setMsg('Exportação descarregada.')
    } catch (e: any) { setMsg(e.message || 'Erro') }
    setBusy(false)
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 680 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>RGPD · Portabilidade</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,34px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Exportar os meus dados</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '5px 0 0', lineHeight: 1.6 }}>
            Direito previsto no <strong>Artigo 20.º do RGPD</strong>. Descarrega tudo o que o Phlox guarda associado à tua conta num único JSON estruturado e legível.
          </p>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>O que está incluído</div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7 }}>
            <li>Perfil e definições</li>
            <li>Doentes, perfis familiares, medicação, sintomas, vitais, visitas</li>
            <li>Atendimentos, ocorrências, registos de cuidado e MAR</li>
            <li>Vendas, linhas, stock, recibos e configurações fiscais</li>
            <li>Webhooks, chaves de API e logs de uso</li>
            <li>Audit Trail completo (com cadeia de hash)</li>
          </ul>

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 9, fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.55 }}>
            O ficheiro é gerado em direto, com os teus dados atuais. Pode ser grande se tens muitos registos. Conta: <strong style={{ color: 'var(--ink-2)' }}>{user?.email || '—'}</strong>.
          </div>

          <button onClick={exportNow} disabled={busy} style={{ width: '100%', marginTop: 16, padding: 13, background: busy ? 'var(--bg-3)' : '#0d6e42', color: busy ? 'var(--ink-5)' : 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
            {busy ? 'A preparar…' : 'Exportar tudo (JSON)'}
          </button>

          {msg && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: msg.includes('Erro') || msg.includes('Falha') ? '#dc2626' : '#16a34a' }}>{msg}</div>}
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-5)', lineHeight: 1.6 }}>
          Queres apagar a conta? Vai a <Link href="/settings" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Definições</Link>. <Link href="/trust" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Trust Center →</Link>
        </div>
      </div>
    </div>
  )
}
