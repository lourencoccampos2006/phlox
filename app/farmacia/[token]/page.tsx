'use client'

// app/farmacia/[token]/page.tsx
// ───────────────────────────────────────────────────────────────────────────
// O mapa terapêutico de UM utente, como a farmácia o vê. Sem conta: o
// endereço é o acesso, e a casa revoga-o quando quiser.
//
// Feito para ser lido ao balcão, com a caixa da semana ao lado: a medicação
// atual em cima, o que mudou em baixo, e um botão para dizer à casa que se
// viu. Esse «recebido» aparece no histórico da ficha — é o que fecha o ciclo
// que hoje é um telefonema.

import { useState, useEffect, use, useCallback } from 'react'

interface Med {
  id: string; name: string; dose: string | null; frequency: string | null
  shifts: string[] | null; horas: Record<string, string> | null
  sos: boolean | null; sos_para: string | null; sos_max_dia: number | null; sos_intervalo_horas: number | null
  take_location: string | null
}
interface Alteracao {
  id: string; quando: string; tipo: string; medicamento: string
  oQueMudou: string[]; indicacao: string; vista: string | null
}
interface Mapa {
  farmacia: string; casa: string | null
  utente: { nome: string; nascimento: string | null; alergias: string | null }
  medicacao: Med[]; alteracoes: Alteracao[]
}

const TIPO: Record<string, string> = {
  nova: 'Nova', alterada: 'Alterada', suspensa: 'Suspensa', retomada: 'Retomada', removida: 'Retirada da ficha',
}

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-PT', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

function quandoSeToma(m: Med): string {
  if (m.sos) {
    const partes = ['SOS']
    if (m.sos_para) partes.push(m.sos_para)
    if (m.sos_max_dia) partes.push(`máx. ${m.sos_max_dia}/dia`)
    if (m.sos_intervalo_horas) partes.push(`intervalo ${m.sos_intervalo_horas} h`)
    return partes.join(' · ')
  }
  const horas = m.horas && Object.keys(m.horas).length
    ? Object.entries(m.horas).map(([t, h]) => `${t} ${h}`).join(', ') : ''
  return [m.frequency, horas || (m.shifts?.length ? m.shifts.join(', ') : '')].filter(Boolean).join(' · ')
}

export default function MapaParaAFarmacia({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [mapa, setMapa] = useState<Mapa | null>(null)
  const [erro, setErro] = useState('')
  const [aMarcar, setAMarcar] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/farmacia-publica?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setErro(j.error || 'Não foi possível abrir o mapa.'); return }
      setMapa(j)
    } catch {
      setErro('Não foi possível abrir o mapa. Verifique a ligação à internet.')
    }
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  async function recebido() {
    setAMarcar(true)
    try {
      const r = await fetch('/api/farmacia-publica', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErro(j.error || 'Não foi possível marcar como recebido.'); return }
      await carregar()
    } finally { setAMarcar(false) }
  }

  const pagina: React.CSSProperties = {
    maxWidth: 820, margin: '0 auto', padding: '24px 16px 64px',
    fontFamily: 'var(--font-sans, system-ui, sans-serif)', color: 'var(--ink, #16181d)',
  }

  if (erro && !mapa) {
    return <main style={pagina}><h1 style={{ fontSize: 20 }}>Mapa terapêutico</h1><p style={{ color: '#9b1c1c' }}>{erro}</p></main>
  }
  if (!mapa) return <main style={pagina}><p style={{ color: '#6b7280' }}>A abrir o mapa…</p></main>

  const porVer = mapa.alteracoes.filter(a => !a.vista)

  return (
    <main style={pagina}>
      <div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280' }}>
        Mapa terapêutico{mapa.casa ? ` · ${mapa.casa}` : ''}
      </div>
      <h1 style={{ fontSize: 26, margin: '6px 0 2px' }}>{mapa.utente.nome}</h1>
      {mapa.utente.nascimento && (
        <div style={{ color: '#4b5563' }}>Nascimento: {new Date(mapa.utente.nascimento + 'T12:00:00').toLocaleDateString('pt-PT')}</div>
      )}

      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 8,
        border: `1px solid ${mapa.utente.alergias ? '#f3c4c4' : '#e5e7eb'}`,
        background: mapa.utente.alergias ? '#fdf2f2' : '#f9fafb',
      }}>
        <strong>Alergias:</strong> {mapa.utente.alergias || 'nenhuma registada pela instituição'}
      </div>

      <h2 style={{ fontSize: 18, margin: '28px 0 8px' }}>Medicação atual</h2>
      {mapa.medicacao.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Sem medicação ativa registada.</p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {mapa.medicacao.map((m, i) => (
            <div key={m.id} style={{ padding: '12px 14px', borderTop: i ? '1px solid #e5e7eb' : 'none' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{m.name}{m.dose ? ` — ${m.dose}` : ''}</div>
              <div style={{ color: '#4b5563', fontSize: 14, marginTop: 2 }}>
                {quandoSeToma(m) || 'sem posologia escrita'}
                {m.take_location === 'casa' ? ' · toma-se em casa' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '28px 0 8px' }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Alterações dos últimos 60 dias</h2>
        {porVer.length > 0 && (
          <button onClick={recebido} disabled={aMarcar} style={{
            minHeight: 44, padding: '0 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#0d6e42', color: 'white', fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
          }}>{aMarcar ? 'A marcar…' : `Marcar ${porVer.length === 1 ? 'a alteração' : `as ${porVer.length} alterações`} como recebida${porVer.length === 1 ? '' : 's'}`}</button>
        )}
      </div>
      {erro && <p style={{ color: '#9b1c1c' }}>{erro}</p>}
      {mapa.alteracoes.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhuma alteração registada neste período.</p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {mapa.alteracoes.map((a, i) => (
            <div key={a.id} style={{
              padding: '12px 14px', borderTop: i ? '1px solid #e5e7eb' : 'none',
              borderLeft: `4px solid ${a.vista ? 'transparent' : '#b45309'}`,
            }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <strong>{a.medicamento}</strong>
                <span style={{ fontSize: 13, color: '#4b5563' }}>{TIPO[a.tipo] || a.tipo} · {dataHora(a.quando)}</span>
                <span style={{ fontSize: 12, color: a.vista ? '#0d6e42' : '#b45309' }}>
                  {a.vista ? `recebida a ${dataHora(a.vista)}` : 'por ver'}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 14 }}>{a.oQueMudou.join(' · ')}</div>
              <div style={{ marginTop: 2, fontSize: 13, color: '#6b7280' }}>Por indicação de: {a.indicacao}</div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: 32, fontSize: 12.5, color: '#6b7280', lineHeight: 1.6 }}>
        Partilhado por {mapa.casa || 'a instituição'} com {mapa.farmacia}. Esta página mostra o que a instituição
        registou e não substitui a prescrição médica. O endereço é pessoal da farmácia: se o recebeu por engano,
        avise a instituição e não o reencaminhe.
      </p>
    </main>
  )
}
