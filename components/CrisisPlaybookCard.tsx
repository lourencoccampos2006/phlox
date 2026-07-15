'use client'

// CrisisPlaybookCard — Playbook de Crise personalizado (Pro, objetivo=cuidador).
// "O que fazer se..." específico às condições/medicação REAIS do familiar,
// gerado por IA e cacheado (regenera só quando algo muda). Botão explícito
// (não auto-dispara IA ao abrir /familia) — mesmo padrão do /medico-bolso.

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { printDoc } from '@/lib/print'

interface Scenario { trigger: string; signs: string[]; immediate_action: string; when_to_call_112: string; relevant_medication: string }

export default function CrisisPlaybookCard({ profileId, name }: { profileId: string; name: string }) {
  const { supabase } = useAuth() as any
  const [open, setOpen] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function load(force = false) {
    setLoading(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/crisis-playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ profile_id: profileId, force }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setScenarios(data.scenarios || [])
    } catch (e: any) { setErr(e.message || 'Erro ao gerar o playbook.') }
    finally { setLoading(false) }
  }

  function print() {
    if (!scenarios) return
    printDoc({
      docTitle: `Playbook de Crise — ${name}`,
      docSubtitle: 'O que fazer em cada situação',
      sections: scenarios.map(s => ({
        heading: s.trigger,
        note: `Relevante por: ${s.relevant_medication}`,
        records: [
          { title: 'Sinais a que estar atento', bullets: s.signs },
          { title: 'Ação imediata', body: s.immediate_action },
          { title: 'Ligar 112 se', body: s.when_to_call_112 },
        ],
      })),
      footerNote: `Relevante por: ${scenarios.map(s => s.relevant_medication).filter(Boolean).join(', ')}. Apoio de orientação — não substitui o 112 em emergência real.`,
    })
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); if (!scenarios) load() }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
        🚨 Playbook de crise
      </button>
    )
  }

  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#991b1b' }}>🚨 Playbook de crise — {name.split(' ')[0]}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {scenarios && <button onClick={print} style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', background: 'white', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 9px', cursor: 'pointer' }}>🖨 Imprimir</button>}
          <button onClick={() => setOpen(false)} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>

      {loading && <div style={{ fontSize: 12.5, color: '#7f1d1d' }}>A preparar os protocolos para {name.split(' ')[0]}…</div>}
      {err && <div style={{ fontSize: 12.5, color: '#7f1d1d' }}>{err}</div>}

      {scenarios && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scenarios.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#7f1d1d' }}>Sem condições/medicação suficientes para gerar cenários específicos ainda.</div>
          ) : scenarios.map((s, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7f1d1d', marginBottom: 4 }}>{s.trigger}</div>
              <div style={{ fontSize: 11.5, color: '#991b1b', marginBottom: 4 }}>{s.signs.join(' · ')}</div>
              <div style={{ fontSize: 12.5, color: '#3f3f46', lineHeight: 1.5, marginBottom: 4 }}>{s.immediate_action}</div>
              <div style={{ fontSize: 11.5, color: '#7f1d1d', fontWeight: 700 }}>🚑 Ligar 112 se: {s.when_to_call_112}</div>
            </div>
          ))}
          <button onClick={() => load(true)} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', alignSelf: 'flex-start' }}>Atualizar playbook</button>
        </div>
      )}
    </div>
  )
}
