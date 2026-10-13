'use client'

// components/institution/PodeSerDaMedicacao.tsx
// ═══════════════════════════════════════════════════════════════════════════
// «ISTO PODE SER DA MEDICAÇÃO?» — perguntado no momento em que se escreve
// ═══════════════════════════════════════════════════════════════════════════
//
// Aparece por baixo da descrição de uma ocorrência, quando há uma pessoa
// escolhida e já há texto suficiente para valer a pena. Cruza o que está
// escrito com a bula dos medicamentos que essa pessoa toma.
//
// ── PORQUE É QUE NÃO PERGUNTA SOZINHO ──────────────────────────────────────
// Uma caixa que aparece a meio de alguém escrever rouba a atenção ao que
// interessa — registar a ocorrência. Fica um botão. Quem quiser saber, clica;
// quem está com pressa, grava e segue.
//
// ── O QUE NUNCA DIZ ────────────────────────────────────────────────────────
// Que a medicação causou aquilo. Que se deve mudar, parar ou dar seja o que
// for. Uma percentagem. Diz o que a bula lista, diz que a coincidência não é
// causa, e diz que quem decide é quem prescreve.

import { useState } from 'react'
import { Botao, Aviso, Codigo, MONO, ROTULO } from '@/components/ui/mesa'

interface Achado { medicamento: string; termos: string[] }
interface Resposta {
  estado: 'encontrado' | 'nada_encontrado' | 'sem_medicacao' | 'sem_rotulo'
  frase: string
  aviso: string
  achados?: Achado[]
  medicamentosLidos?: string[]
  porLeitura?: boolean
}

export default function PodeSerDaMedicacao({ patientId, descricao, auth }: {
  patientId: string | null
  descricao: string
  auth: () => Promise<Record<string, string>>
}) {
  const [r, setR] = useState<Resposta | null>(null)
  const [aVer, setAVer] = useState(false)
  const [erro, setErro] = useState('')

  // Sem pessoa não há medicação para cruzar; com três palavras não há texto
  // que valha a pena ler.
  if (!patientId || descricao.trim().length < 12) return null

  async function ver() {
    setAVer(true); setErro(''); setR(null)
    try {
      const res = await fetch('/api/ocorrencia-medicacao', {
        method: 'POST', headers: await auth(),
        body: JSON.stringify({ patientId, descricao }),
      })
      const j = await res.json()
      if (!res.ok) { setErro(j.error || 'Não foi possível verificar.'); return }
      setR(j)
    } catch {
      setErro('Não foi possível verificar. Verifique a ligação.')
    } finally { setAVer(false) }
  }

  const tom = r?.estado === 'encontrado' ? 'atencao' : 'neutro'

  return (
    <div style={{ marginTop: 8 }}>
      {!r && (
        <Botao onClick={ver} esperando={aVer}
          titulo="Cruza o que escreveu com a bula dos medicamentos desta pessoa">
          ISTO PODE SER DA MEDICAÇÃO?
        </Botao>
      )}

      {erro && <Aviso tom="mau">{erro}</Aviso>}

      {r && (
        <Aviso tom={tom as any}>
          <div style={{ fontWeight: 'var(--peso-forte)' as any, marginBottom: 6 }}>{r.frase}</div>

          {r.estado === 'encontrado' && (r.achados || []).map(a => (
            <div key={a.medicamento} style={{
              display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap',
              padding: '4px 0', borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 'var(--peso-forte)' as any }}>{a.medicamento}</span>
              {a.termos.map(t => <Codigo key={t} texto={t.toUpperCase()} cor="var(--amber)" />)}
            </div>
          ))}

          {r.porLeitura && (
            <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 6 }}>
              O TEXTO NÃO USA ESTAS PALAVRAS — FOI LIDO E INTERPRETADO
            </div>
          )}

          {(r.medicamentosLidos?.length ?? 0) > 0 && (
            <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 6 }}>
              BULAS CONSULTADAS: {(r.medicamentosLidos || []).join(' · ')}
            </div>
          )}

          <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.55, marginTop: 8 }}>
            {r.aviso}
          </div>

          <div style={{ marginTop: 8 }}>
            <Botao feitio="calmo" onClick={() => setR(null)}>FECHAR</Botao>
          </div>
        </Aviso>
      )}
    </div>
  )
}
