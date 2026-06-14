'use client'

// NextStep — fluxo guiado por contexto. O site olha para o estado REAL do
// utilizador e sugere O próximo passo certo (um só, ou nenhum se estiver tudo
// tratado). Não inventa: cada sugestão é baseada em dados reais (contagens).
// Aparece no /inicio para os modos pessoal/cuidador. Adaptação comportamental:
// guia quem está a começar, cala-se para quem já tem tudo.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface Suggestion { icon: string; title: string; sub: string; href: string; cta: string }

export default function NextStep({ mode }: { mode: string }) {
  const { user, supabase } = useAuth() as any
  const [sug, setSug] = useState<Suggestion | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user?.id || (mode !== 'personal' && mode !== 'caregiver')) return
    let cancelled = false
    ;(async () => {
      // Contagens leves (head:true = sem trazer linhas) do estado do utilizador.
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
      const [meds, vitals, labs, logs] = await Promise.all([
        supabase.from('personal_meds').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('vitals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('lab_results').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('med_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('logged_at', since30),
      ])
      if (cancelled) return
      const nMeds = meds.count ?? 0, nVitals = vitals.count ?? 0, nLabs = labs.count ?? 0, nLogs = logs.count ?? 0

      // Regras por prioridade — devolve a PRIMEIRA que se aplica (passo mais útil agora).
      let s: Suggestion | null = null
      if (nMeds === 0) {
        s = { icon: '💊', title: 'Começa pela tua medicação', sub: 'Adiciona o que tomas — basta uma foto da caixa ou da receita.', href: '/scan', cta: 'Adicionar medicação' }
      } else if (nMeds >= 2 && nLogs === 0) {
        s = { icon: '🔍', title: 'Os teus medicamentos dão-se bem?', sub: `Tens ${nMeds} medicamentos. Verifica num segundo se há interações a evitar.`, href: '/interactions', cta: 'Verificar interações' }
      } else if (nLabs === 0) {
        s = { icon: '🧬', title: 'Tens análises recentes?', sub: 'Tira uma foto e o Phlox explica cada valor em linguagem simples.', href: '/labs', cta: 'Perceber análises' }
      } else if (nVitals === 0) {
        s = { icon: '❤️', title: 'Acompanha a tua tensão e peso', sub: 'Regista para veres a tua evolução ao longo do tempo.', href: '/vitals', cta: 'Registar agora' }
      }
      setSug(s)
    })()
    return () => { cancelled = true }
  }, [user?.id, supabase, mode])

  if (!sug || dismissed) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', borderRadius: 16, padding: '15px 17px', marginBottom: 18, color: 'white' }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>{sug.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.8 }}>Sugestão</div>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>{sug.title}</div>
        <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 1, lineHeight: 1.4 }}>{sug.sub}</div>
      </div>
      <Link href={sug.href} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.18)', color: 'white', padding: '9px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>{sug.cta} →</Link>
      <button onClick={() => setDismissed(true)} aria-label="Dispensar" style={{ flexShrink: 0, background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 2 }}>×</button>
    </div>
  )
}
