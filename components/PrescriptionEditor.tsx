'use client'

// PrescriptionEditor — emite uma prescrição com 1+ items.
// Cada item usa o PosologyEditor (estrutura JSON consistente).
// Pode ser embutido em /patients/[id] ou em /mymeds (uso pessoal).

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { useActiveOrg } from '@/lib/orgContext'
import DrugAutocomplete from '@/components/DrugAutocomplete'
import PosologyEditor, { type Posology, renderPosology } from '@/components/PosologyEditor'

interface DraftItem {
  dci: string
  brand_name?: string
  posology: Posology
  prescription_type?: string
  generic_allowed: boolean
  rationale?: string
}

export default function PrescriptionEditor({ patientId, episodeId, onIssued, onCancel }: {
  patientId?: string
  episodeId?: string
  onIssued?: (rx: any) => void
  onCancel?: () => void
}) {
  const { user, supabase } = useAuth() as any
  const { org } = useActiveOrg()
  const toast = useToast()
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [validity, setValidity] = useState(30)
  const [busy, setBusy] = useState(false)

  function emptyItem(): DraftItem {
    return { dci: '', posology: { dose_amount: 1, dose_unit: 'cp', frequency_per_day: 1, schedule_times: ['08:00'], route: 'oral', prn: false, duration_days: null }, generic_allowed: true }
  }

  function patch(idx: number, patch: Partial<DraftItem>) {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  async function submit(asStatus: 'draft' | 'signed') {
    const valid = items.filter(it => it.dci.trim())
    if (valid.length === 0) { toast.error('Adiciona pelo menos um medicamento.'); return }
    setBusy(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({
          org_id: org?.id || null,
          patient_id: patientId || null,
          episode_id: episodeId || null,
          diagnosis_text: diagnosis.trim() || null,
          notes: notes.trim() || null,
          validity_days: validity,
          status: asStatus,
          items: valid.map(it => ({
            dci: it.dci.trim(),
            brand_name: it.brand_name || null,
            posology_json: it.posology,
            generic_allowed: it.generic_allowed,
            rationale: it.rationale || null,
            prescription_type: it.prescription_type || null,
            dose_text: renderPosology(it.posology),
          })),
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falhou')

      // Se assinar, chama endpoint de sign
      if (asStatus === 'signed') {
        await fetch(`/api/prescriptions/${d.prescription.id}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
          body: JSON.stringify({ method: 'manual' }),
        })
      }
      toast.success(asStatus === 'signed' ? 'Prescrição emitida.' : 'Rascunho guardado.')
      onIssued?.(d.prescription)
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>Nova prescrição</div>
      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>Adiciona medicamentos com posologia estruturada. Podes guardar como rascunho ou assinar.</div>

      <label style={lbl}>Diagnóstico / justificação</label>
      <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="HTA mal controlada" style={inp} />

      {/* Items */}
      {items.map((it, i) => (
        <div key={i} style={{ marginTop: 14, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medicamento {i + 1}</div>
            {items.length > 1 && (
              <button onClick={() => setItems(items.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>× Remover</button>
            )}
          </div>
          <DrugAutocomplete value={it.dci} onChange={v => patch(i, { dci: v })}
            onPick={(dci, displayed) => patch(i, { dci, brand_name: displayed !== dci ? displayed : it.brand_name })} />
          <div style={{ marginTop: 8 }}>
            <PosologyEditor value={it.posology} onChange={p => patch(i, { posology: p })} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>
              <input type="checkbox" checked={it.generic_allowed} onChange={e => patch(i, { generic_allowed: e.target.checked })} />
              Permite genérico
            </label>
            <select value={it.prescription_type || ''} onChange={e => patch(i, { prescription_type: e.target.value || undefined })}
              style={{ ...inp, width: 200, padding: '7px 10px', fontSize: 12 }}>
              <option value="">Tipo de receita</option>
              <option value="mnsrm">MNSRM (venda livre)</option>
              <option value="msrm">MSRM (receita normal)</option>
              <option value="msrm_e">MSRM-E (especial)</option>
              <option value="msrm_r">MSRM-R (restrita)</option>
              <option value="manipulado">Manipulado</option>
            </select>
          </div>
          <input value={it.rationale || ''} onChange={e => patch(i, { rationale: e.target.value })}
            placeholder="Justificação (opcional)" style={{ ...inp, marginTop: 8 }} />
        </div>
      ))}

      <button onClick={() => setItems([...items, emptyItem()])}
        style={{ marginTop: 10, padding: '9px 14px', background: 'white', border: '1.5px dashed var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer', width: '100%' }}>
        + Adicionar medicamento
      </button>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>Validade</label>
          <select value={validity} onChange={e => setValidity(Number(e.target.value))} style={inp}>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias (crónicos)</option>
            <option value={180}>180 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Notas internas</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="opcional" style={inp} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {onCancel && <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: 11, background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>}
        <button onClick={() => submit('draft')} disabled={busy} style={{ flex: 1, padding: 11, background: 'white', color: 'var(--ink)', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
          Guardar rascunho
        </button>
        <button onClick={() => submit('signed')} disabled={busy} style={{ flex: 1, padding: 11, background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'A emitir…' : '✍ Emitir e assinar'}
        </button>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 4, marginTop: 10 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }
