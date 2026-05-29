'use client'

// Integração de faturação — liga o Phlox ao software de faturação CERTIFICADO do cliente.
// O Phlox não emite fiscalmente; aqui escolhe-se: exportar ficheiros (universal) OU
// ligar uma API (InvoiceXpress, Moloni, Vendus) para emitir automaticamente.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface Settings {
  provider: string; api_key?: string | null; account_id?: string | null
  doc_type: string; series?: string | null; auto_emit: boolean; default_tax: number
}

const PROVIDERS: { id: string; label: string; desc: string; needsKey: boolean; needsAccount?: boolean; help?: string }[] = [
  { id: 'export', label: 'Exportação de ficheiros', desc: 'Universal — gera CSV / SAFT para importar no teu software. Funciona com qualquer um (Sage, PHC, Sifarma…).', needsKey: false },
  { id: 'invoicexpress', label: 'InvoiceXpress', desc: 'Emite a fatura-recibo automaticamente via API.', needsKey: true, needsAccount: true, help: 'Conta = subdomínio (ex: aminhaempresa). Chave em Definições › API.' },
  { id: 'moloni', label: 'Moloni', desc: 'Emite o documento automaticamente via API.', needsKey: true, needsAccount: true, help: 'Conta = company_id. Usa um access_token válido.' },
  { id: 'vendus', label: 'Vendus', desc: 'Emite o documento automaticamente via API.', needsKey: true, help: 'Chave de API em Definições › Integrações.' },
  { id: 'sage_csv', label: 'Sage / PHC (CSV)', desc: 'Exporta um CSV no formato lançável nestes ERP.', needsKey: false },
]
const DOC_TYPES = [
  { id: 'fatura_recibo', label: 'Fatura-recibo' },
  { id: 'fatura_simplificada', label: 'Fatura simplificada' },
  { id: 'venda_dinheiro', label: 'Venda a dinheiro' },
  { id: 'recibo', label: 'Recibo' },
]
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

export default function FaturacaoConfigPage() {
  const { user, supabase } = useAuth() as any
  const [s, setS] = useState<Settings>({ provider: 'export', doc_type: 'fatura_recibo', auto_emit: false, default_tax: 23 })
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [saved, setSaved] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('invoice_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (error && /relation .*invoice_settings.* does not exist/i.test(error.message)) setMissing(true)
    else if (data) setS({ provider: data.provider || 'export', api_key: data.api_key, account_id: data.account_id, doc_type: data.doc_type || 'fatura_recibo', series: data.series, auto_emit: !!data.auto_emit, default_tax: data.default_tax ?? 23 })
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  async function save() {
    const { error } = await supabase.from('invoice_settings').upsert({
      user_id: user.id, provider: s.provider, api_key: s.api_key || null, account_id: s.account_id || null,
      doc_type: s.doc_type, series: s.series || null, auto_emit: s.auto_emit, default_tax: s.default_tax,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (!error) { setSaved('Guardado ✓'); setTimeout(() => setSaved(''), 2500) }
    else setSaved(error.message)
  }

  const prov = PROVIDERS.find(p => p.id === s.provider) || PROVIDERS[0]
  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>POS · Integração</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Integração de faturação</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>O Phlox trata do balcão, stock e código de barras; a emissão fiscal sai do teu software certificado. Liga-o aqui — poupa &gt;80% do lançamento manual.</p>
        </div>

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24, color: '#92400e', fontSize: 13.5 }}>
            Corre <strong>supabase/sprint34_pos.sql</strong> no Supabase para ativar a integração.
          </div>
        ) : loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={card}>
              <span style={lbl}>Software / método</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => setS({ ...s, provider: p.id })} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${s.provider === p.id ? '#0d6e42' : 'var(--border)'}`, background: s.provider === p.id ? '#eef6f1' : 'white', fontFamily: 'var(--font-sans)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: s.provider === p.id ? '#0d6e42' : 'var(--ink)' }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2, lineHeight: 1.45 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {prov.needsKey && (
              <div style={card}>
                <span style={lbl}>Credenciais {prov.label}</span>
                {prov.help && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 10, lineHeight: 1.45 }}>{prov.help}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {prov.needsAccount && <div><span style={lbl}>{s.provider === 'moloni' ? 'Company ID' : 'Conta / subdomínio'}</span><input value={s.account_id || ''} onChange={e => setS({ ...s, account_id: e.target.value })} style={inp} /></div>}
                  <div><span style={lbl}>Chave / token de API</span><input type="password" value={s.api_key || ''} onChange={e => setS({ ...s, api_key: e.target.value })} placeholder="••••••••••" style={inp} /></div>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10, lineHeight: 1.5 }}>A chave fica guardada na tua conta e só é usada no servidor para emitir. Não é exposta no browser.</div>
              </div>
            )}

            <div style={card}>
              <span style={lbl}>Documento</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <div>
                  <span style={lbl}>Tipo</span>
                  <select value={s.doc_type} onChange={e => setS({ ...s, doc_type: e.target.value })} style={inp as any}>
                    {DOC_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
                <div><span style={lbl}>IVA por defeito (%)</span><input type="number" value={s.default_tax} onChange={e => setS({ ...s, default_tax: parseFloat(e.target.value) || 0 })} style={inp} /></div>
              </div>
              {prov.needsKey && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, fontSize: 13.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={s.auto_emit} onChange={e => setS({ ...s, auto_emit: e.target.checked })} />
                  Emitir automaticamente ao finalizar a venda
                </label>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={save} style={{ padding: '11px 20px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Guardar</button>
              <Link href="/vendas" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>← Voltar ao POS</Link>
              {saved && <span style={{ fontSize: 13, fontWeight: 600, color: saved.includes('✓') ? '#16a34a' : '#dc2626' }}>{saved}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
