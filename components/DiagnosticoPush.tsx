'use client'

// components/DiagnosticoPush.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Testar agora" — e, se não chegar, dizer porquê.
//
// Uma notificação atravessa cinco coisas: a permissão do browser, o service
// worker, a subscrição gravada, as chaves do servidor e o serviço de push da
// Google/Mozilla/Apple. Até aqui, falhasse qualquer uma delas, o resultado era
// o mesmo — silêncio — e não havia forma de saber qual.
//
// Isto envia uma notificação a sério e mostra a cadeia toda. Cada etapa que
// falha traz o que fazer a seguir, para não ser preciso adivinhar.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

interface Etapa { etapa: string; ok: boolean; detalhe: string; accao?: string }
interface Dispositivo { onde: string; ok: boolean; motivo?: string; estado?: number }

export default function DiagnosticoPush({ supabase }: { supabase: any }) {
  const [aCorrer, setACorrer] = useState(false)
  const [etapas, setEtapas] = useState<Etapa[] | null>(null)
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [erro, setErro] = useState('')

  async function testar() {
    setACorrer(true); setErro(''); setEtapas(null); setDispositivos([])
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/push/testar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sd.session?.access_token}` },
      })
      // Uma função que estoira devolve HTML, não JSON. Ler como texto primeiro
      // evita o "Unexpected token '<'" que não diz nada a ninguém.
      const bruto = await res.text()
      let j: any = null
      try { j = JSON.parse(bruto) } catch { /* não era JSON */ }
      if (!j) { setErro('O servidor não respondeu como esperado. Tenta outra vez daqui a pouco.'); return }
      if (!res.ok) { setErro(j.error || 'Não foi possível correr o teste.'); return }
      setEtapas(j.etapas || [])
      setDispositivos(j.dispositivos || [])
    } catch {
      setErro('Não foi possível falar com o servidor.')
    } finally {
      setACorrer(false)
    }
  }

  const tudoBem = etapas?.every(e => e.ok)

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
        Não estão a chegar?
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14, lineHeight: 1.65 }}>
        Envia uma notificação de teste a este dispositivo e mostra onde é que a cadeia parte,
        se partir. Não muda nada — só verifica.
      </div>

      <button
        onClick={testar}
        disabled={aCorrer}
        style={{
          padding: '10px 18px', background: aCorrer ? 'var(--bg-3)' : 'var(--bg-2)',
          color: aCorrer ? 'var(--ink-4)' : 'var(--ink)',
          border: '1px solid var(--border)', borderRadius: 7,
          cursor: aCorrer ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700,
          fontFamily: 'var(--font-sans)',
        }}>
        {aCorrer ? 'A testar…' : 'Testar agora'}
      </button>

      {erro && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 7, fontSize: 12.5, color: '#c53030', lineHeight: 1.6 }}>
          {erro}
        </div>
      )}

      {etapas && (
        <div style={{ marginTop: 16 }}>
          {tudoBem && (
            <div style={{ marginBottom: 14, padding: '11px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 12.5, color: '#166534', lineHeight: 1.6 }}>
              Está tudo ligado. A notificação de teste deve aparecer em segundos — se não aparecer
              neste dispositivo mas as etapas estiverem todas verdes, o sistema operativo pode ter
              o Phlox em silêncio (Windows: Assistente de Foco; Android: modo Não Incomodar).
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {etapas.map((e, i) => (
              <div key={i} style={{ background: 'white', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: e.ok ? '#059669' : '#b45309', marginTop: 5,
                  }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--ink)' }}>{e.etapa}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55, marginTop: 2 }}>{e.detalhe}</div>
                    {e.accao && !e.ok && (
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.55, marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--bg-4)' }}>
                        {e.accao}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dispositivos.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 7,
              }}>Por dispositivo</div>
              {dispositivos.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '6px 0', borderBottom: i < dispositivos.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', minWidth: 120 }}>{d.onde}</span>
                  <span style={{ fontSize: 12.5, color: d.ok ? '#059669' : '#b45309', fontWeight: 600 }}>
                    {d.ok ? 'enviada' : `falhou${d.estado ? ` · ${d.estado}` : ''}`}
                  </span>
                  {!d.ok && d.motivo && (
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{d.motivo}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
