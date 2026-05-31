'use client'

// /health-import — importar dados do Apple Health (e Google Fit no futuro).
// O utilizador faz "Exportar dados de saúde" na app Saúde → recebe um zip;
// abre, extrai o export.xml e arrasta-o aqui. Lemos peso, TA, FC, SpO2, glicose
// e temperatura, e adicionamos ao histórico do Phlox.

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

interface Summary { total_records_read: number; vitals_count: number; byType: Record<string, number> }

const TYPE_LABEL: Record<string, string> = {
  HKQuantityTypeIdentifierHeartRate: 'Frequência cardíaca',
  HKQuantityTypeIdentifierBloodPressureSystolic: 'TA sistólica',
  HKQuantityTypeIdentifierBloodPressureDiastolic: 'TA diastólica',
  HKQuantityTypeIdentifierOxygenSaturation: 'SpO₂',
  HKQuantityTypeIdentifierBodyMass: 'Peso',
  HKQuantityTypeIdentifierBloodGlucose: 'Glicemia',
  HKQuantityTypeIdentifierBodyTemperature: 'Temperatura',
}

export default function HealthImportPage() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ inserted: number; summary?: Summary } | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function importXml(file: File) {
    if (!user) { toast.error('Inicia sessão para importar.'); return }
    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast.error('Ficheiro inesperado', 'Espera-se export.xml (extrai do zip da Apple Health primeiro).')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Demasiado grande', 'Limite 25 MB. Tenta exportar um intervalo mais curto na app Saúde.')
      return
    }
    setBusy(true); setResult(null); setError('')
    try {
      const xml = await file.text()
      const t = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch('/api/health-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ xml }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha ao importar')
      setResult({ inserted: j.inserted, summary: j.summary })
      if (j.inserted > 0) toast.success(`${j.inserted} medições importadas`, 'Estão no teu histórico de vitais.')
      else toast.info('Sem vitais novos', j.warning || 'Não foi reconhecido nenhum vital.')
    } catch (e: any) {
      setError(e.message || 'Erro')
      toast.error('Não consegui importar', e.message)
    } finally { setBusy(false) }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) importXml(f); e.target.value = ''
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]; if (f) importXml(f)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 720 }}>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Importar dados</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Apple Health</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '8px 0 0', lineHeight: 1.6 }}>Importa o teu histórico de vitais — peso, TA, FC, SpO₂, glicemia, temperatura — direto da app Saúde do iPhone. Tudo entra no teu histórico.</p>
        </div>

        {/* Zona de drop */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#0d6e42' : '#cbd5e1'}`,
            background: dragOver ? '#f0fdf4' : 'white',
            borderRadius: 14, padding: '36px 24px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.15s', marginBottom: 16,
          }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📥</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120', marginBottom: 4 }}>{busy ? 'A processar…' : 'Arrasta o export.xml para aqui'}</div>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>ou clica para escolher o ficheiro</div>
        </div>
        <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" onChange={onPick} style={{ display: 'none' }} />

        {/* Instruções */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 10 }}>Como obter o ficheiro</div>
          <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 13.5, color: '#374151', lineHeight: 1.65 }}>
            <li>Abre a app <strong>Saúde</strong> no iPhone</li>
            <li>Toca na <strong>tua foto/iniciais</strong> no canto superior direito</li>
            <li>Desce até <strong>"Exportar todos os dados de saúde"</strong></li>
            <li>Espera (pode demorar uns minutos) e <strong>partilha por AirDrop, email ou Drive</strong> para o computador</li>
            <li>Abre o ficheiro <code>.zip</code>, extrai a pasta <code>apple_health_export</code> e arrasta o <code>export.xml</code> para aqui</li>
          </ol>
          <div style={{ marginTop: 14, padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, color: '#1e40af' }}>
            🔒 O XML é processado no servidor temporariamente; só são guardados os vitais com timestamp (peso, TA, FC, SpO₂, glicemia, temperatura). Nada de localização, treinos ou outras categorias.
          </div>
        </div>

        {result && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 22px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 10 }}>Resultado</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#0d6e42' }}>{result.inserted}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medições novas</div>
              </div>
              {result.summary && (
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#0b1120' }}>{result.summary.total_records_read.toLocaleString('pt-PT')}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Registos lidos</div>
                </div>
              )}
            </div>
            {result.summary && Object.keys(result.summary.byType).length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>Por tipo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(result.summary.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                    <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                      <span>{TYPE_LABEL[t] || t}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{n.toLocaleString('pt-PT')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/dashboard" style={{ padding: '9px 16px', background: '#0d6e42', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Ver no Dashboard →</Link>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>{error}</div>
        )}

        <div style={{ marginTop: 18, fontSize: 12.5, color: '#64748b', lineHeight: 1.65 }}>
          Tens dados de <strong>Google Fit / Samsung Health</strong>? Exporta via Google Takeout (json/csv) e abre-nos um ticket — adicionamos suporte. Para WHOOP, Garmin, Oura: também queremos.
        </div>
      </div>
    </div>
  )
}
