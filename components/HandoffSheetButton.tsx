'use client'

// HandoffSheetButton — Ficha de Handoff para o Hospital/Urgência (Pro, item
// B12 da auditoria). Um clique junta o que já existe espalhado — medicação
// atual, alergias/condições, Índice de Risco e (se já gerado) o Playbook de
// Crise — num único documento A4 para levar à urgência. Sem IA nova: reaproveita
// o /api/risk-index e o /api/crisis-playbook já cacheado (force:false).

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { printDoc } from '@/lib/print'

interface Props { profileId: string; name: string; age?: number | null; allergies?: string | null; conditions?: string | null; meds: { name: string; dose?: string; frequency?: string }[] }

export default function HandoffSheetButton({ profileId, name, age, allergies, conditions, meds }: Props) {
  const { supabase } = useAuth() as any
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function build() {
    setLoading(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token || ''
      /* Saíram o índice de risco e o «playbook de crise»: um punha um nível de
         risco numa pessoa, o outro dizia o que fazer numa crise. Ambos são
         apoio à decisão clínica (Regra 11). A ficha continua a levar o que
         importa a quem recebe a pessoa: quem é, o que toma, o que tem. */
      const playbook: any = null

      printDoc({
        docTitle: `Ficha para o Hospital — ${name}`,
        docSubtitle: `Gerado em ${new Date().toLocaleDateString('pt-PT')} — informação de apoio, não substitui o processo clínico`,
        meta: [
          ...(age ? [{ label: 'idade', value: `${age} anos` }] : []),
        ],
        sections: [
          {
            heading: 'Dados essenciais',
            records: [{
              title: name,
              fields: [
                { label: 'Alergias', value: allergies || 'Nenhuma registada' },
                { label: 'Condições / diagnósticos', value: conditions || 'Nenhuma registada' },
              ],
            }],
          },
          {
            heading: `Medicação atual (${meds.length})`,
            records: meds.length ? meds.map(m => ({ title: m.name, meta: [m.dose, m.frequency].filter(Boolean).join(' · ') })) : [{ title: 'Nenhum medicamento registado' }],
          },
          ...(playbook?.scenarios?.length ? [{
            heading: 'Playbook de crise (o que fazer se…)',
            records: playbook.scenarios.map((s: any) => ({
              title: s.trigger,
              body: s.immediate_action,
              bullets: [`Sinais: ${(s.signs || []).join(', ')}`, `Ligar 112 se: ${s.when_to_call_112}`],
            })),
          }] : []),
        ],
        footerNote: 'Documento gerado pelo Phlox a partir dos dados guardados pelo cuidador — apoio informativo, verificar sempre com a pessoa/família presente.',
      })
    } catch (e: any) { setErr('Não foi possível gerar a ficha agora.') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <button onClick={build} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--amber-light)', color: 'var(--badge-red-fg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-md)', fontSize: 12.5, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
        {loading ? '⏳ A preparar…' : '🏥 Ficha para o hospital'}
      </button>
      {err && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{err}</div>}
    </div>
  )
}
