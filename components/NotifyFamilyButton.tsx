'use client'

// NotifyFamilyButton — "avisar a família" de 1 toque a partir de um sinal já
// registado (refeição recusada, registo de saúde preocupante, etc). Mesmo
// padrão já usado em app/incidents/page.tsx (sendNotify): escreve no FIO da
// família (family_thread_messages — o que /family e /familia mostram), nunca
// na tabela antiga family_messages (que a família não vê). Sempre com texto
// pré-preenchido mas EDITÁVEL e um passo de confirmação — nunca envia sozinho.
//
// Extraído para componente partilhado (2026-07-30) para o mesmo cuidado
// (rever antes de enviar, mensagem calma e informativa) chegar a mais sítios
// — refeições, saúde & apoio — sem reescrever a lógica em cada um.

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { reportError, MSG } from '@/lib/clientError'

export default function NotifyFamilyButton({ patientId, defaultBody }: { patientId: string; defaultBody: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(defaultBody)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    if (!user || !body.trim()) return
    setSending(true); setErr('')
    const { error } = await supabase.from('family_thread_messages').insert(scope.stamp({
      user_id: user.id, patient_id: patientId, author_side: 'staff',
      author_name: user.name || 'Equipa', kind: 'update',
      content: body.trim().slice(0, 1000), read_by_family: false, read_by_staff: true,
    }))
    if (error) { setErr(reportError('notify-family', error, MSG.save)); setSending(false); return }
    setSending(false); setDone(true)
    setTimeout(() => { setOpen(false); setDone(false) }, 1800)
  }

  if (done) return <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ Enviado à família</div>

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setBody(defaultBody) }} style={{ padding: '6px 12px', background: 'white', border: '1.5px solid #7c3aed', color: '#7c3aed', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
        Avisar a família
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: 10, marginTop: 6 }}>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
        style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical' }} />
      {err && <div style={{ fontSize: 11.5, color: '#dc2626' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '7px', background: 'white', border: '1px solid var(--border)', color: 'var(--ink-3)', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
        <button onClick={send} disabled={sending || !body.trim()} style={{ flex: 1, padding: '7px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: sending ? 'wait' : 'pointer' }}>
          {sending ? 'A enviar…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
