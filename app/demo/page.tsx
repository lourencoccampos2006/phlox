'use client'

// /demo — DEMONSTRAÇÃO ISOLADA do Centro de Dia (showcase de vendas).
// ⚠️ TOTALMENTE REMOVÍVEL: dados de exemplo EM MEMÓRIA, sem base de dados, sem
// auth, sem tocar em nada real. Apagar a pasta app/demo/ remove isto por completo.
// Serve para um centro de dia VER o produto sem precisar de conta, e como peça
// de marketing (link partilhável). Reproduz o visual real do painel/portal.

import { useState } from 'react'
import Link from 'next/link'

const ACCENT = '#0d9488'
const SOFT = '#f0fdfa'
const today = () => new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

// ── Dados de exemplo (fictícios, só para a demo) ─────────────────────────────
const UTENTES = [
  { nome: 'Maria Conceição', presente: true,  humor: 4, tomas: '2/2', nota: 'Boa disposição, participou na ginástica.' },
  { nome: 'António Ferreira', presente: true,  humor: 5, tomas: '1/1', nota: 'Almoçou tudo, animado nos jogos.' },
  { nome: 'Glória Sousa',     presente: true,  humor: 2, tomas: '2/2', nota: 'Mais calada hoje — a acompanhar.' },
  { nome: 'Joaquim Pinto',    presente: true,  humor: 4, tomas: '1/1', nota: 'Tudo bem.' },
  { nome: 'Rosa Martins',     presente: false, humor: 0, tomas: '—',   nota: 'Não veio hoje (avisou a família).' },
]
const ATIVIDADES = [
  { hora: '10:30', titulo: 'Ginástica suave', participantes: 8 },
  { hora: '11:30', titulo: 'Jogos de memória', participantes: 6 },
  { hora: '15:00', titulo: 'Ateliê de pintura', participantes: 5 },
]
const HUMOR = ['', '😟', '😐', '🙂', '😊', '😄']

const card: React.CSSProperties = { background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '16px 18px' }
const h: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }

export default function DemoPage() {
  const [familia, setFamilia] = useState(false)
  const presentes = UTENTES.filter(u => u.presente)

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      {/* Barra de demo */}
      <div style={{ background: '#0b1120', color: 'white', padding: '8px 16px', fontSize: 12.5, textAlign: 'center' }}>
        Demonstração · dados fictícios ·{' '}
        <Link href="/pricing" style={{ color: '#5eead4', fontWeight: 700, textDecoration: 'none' }}>Ver planos</Link> ou{' '}
        <Link href="/onboarding" style={{ color: '#5eead4', fontWeight: 700, textDecoration: 'none' }}>experimentar a sério →</Link>
      </div>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px clamp(14px,3vw,28px) 64px' }}>
        {/* Cabeçalho do produto */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 5 }}>O seu Centro de Dia</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,34px)', fontWeight: 500, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>Vamos a mais um dia.</h1>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: '5px 0 0', textTransform: 'capitalize' }}>{today()}</p>
        </div>

        {/* Toggle: vista equipa vs vista família */}
        <div style={{ display: 'inline-flex', background: 'white', border: '1px solid #e9eaec', borderRadius: 99, padding: 3, marginBottom: 18 }}>
          {[['equipa', '👩‍⚕️ O que a equipa vê'], ['familia', '👨‍👩‍👧 O que a família vê']].map(([k, l]) => (
            <button key={k} onClick={() => setFamilia(k === 'familia')}
              style={{ border: 'none', borderRadius: 99, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: (familia === (k === 'familia')) ? ACCENT : 'transparent', color: (familia === (k === 'familia')) ? 'white' : '#64748b' }}>{l}</button>
          ))}
        </div>

        {!familia ? (
          // ── VISTA EQUIPA (painel) ──
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 14 }}>
            <div style={{ gridColumn: 'span 12', ...card, background: ACCENT, border: 'none', color: 'white' }}>
              <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, marginBottom: 10 }}>O dia de hoje</div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {[[presentes.length, 'utentes presentes'], [4, 'atividades'], [6, 'tomas dadas'], [1, 'a acompanhar']].map(([n, l], i) => (
                  <div key={i}><div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{n}</div><div style={{ fontSize: 11.5, marginTop: 4, opacity: 0.85, fontWeight: 600 }}>{l}</div></div>
                ))}
              </div>
            </div>

            <div className="demo-col" style={{ gridColumn: 'span 8', ...card }}>
              <div style={h}>🟢 Presenças <span style={{ color: '#94a3b8', fontWeight: 600 }}>{presentes.length}/{UTENTES.length}</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {UTENTES.map(u => (
                  <span key={u.nome} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99,
                    color: u.presente ? '#15803d' : '#b45309', background: u.presente ? '#f0fdf4' : '#fffbeb', border: `1px solid ${u.presente ? '#bbf7d0' : '#fde68a'}` }}>
                    {u.presente ? '' : '🏠 '}{u.nome.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>

            <div className="demo-col" style={{ gridColumn: 'span 4', ...card }}>
              <div style={h}>👁 A vigiar <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', padding: '2px 7px', borderRadius: 6 }}>1</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#fffbeb', border: '1.5px solid #fde68a', color: '#b45309', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</span>
                <span><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b1120' }}>Glória Sousa</span><span style={{ display: 'block', fontSize: 11, color: '#b45309' }}>Humor em baixo hoje</span></span>
              </div>
            </div>

            <div className="demo-col" style={{ gridColumn: 'span 6', ...card }}>
              <div style={h}>🎯 Atividades de hoje</div>
              {ATIVIDADES.map(a => (
                <div key={a.titulo} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8', minWidth: 38 }}>{a.hora}</span>
                  <span style={{ fontWeight: 600, flex: 1 }}>{a.titulo}</span>
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{a.participantes} participantes</span>
                </div>
              ))}
            </div>

            <div className="demo-col" style={{ gridColumn: 'span 6', ...card }}>
              <div style={h}>💊 Medicação · casa ↔ centro</div>
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                <div>Maria Conceição — <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0d9488', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '1px 7px', borderRadius: 99 }}>almoço no centro</span></div>
                <div>António Ferreira — <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 7px', borderRadius: 99 }}>🏠 manhã em casa</span></div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>A equipa só dá as tomas do centro. A família vê o que dá em casa.</div>
              </div>
            </div>
          </div>
        ) : (
          // ── VISTA FAMÍLIA (portal) ──
          <div style={{ maxWidth: 560 }}>
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Como tem corrido</div>
              {[{ d: 'Hoje', u: UTENTES[0] }, { d: 'Ontem', u: { ...UTENTES[0], humor: 5, nota: 'Dia muito bom — cantou no ateliê de música.' } }].map(({ d, u }) => (
                <div key={d} style={{ background: SOFT, border: '1px solid #99f6e4', borderRadius: 12, padding: '13px 15px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0b1120' }}>{d}</span>
                    <span style={{ fontSize: 16 }}>{HUMOR[u.humor]}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55 }}>
                    Às refeições, a {u.nome.split(' ')[0]} comeu bem. {u.nota} Tomou toda a medicação prevista.
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Resumo gerado a partir dos registos da equipa de cuidados.</div>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, textAlign: 'center' }}>
              A família abre o telemóvel e <strong>vê como correu o dia</strong> — sem ter de ligar. É isto que dá tranquilidade e confiança.
            </p>
          </div>
        )}

        {/* CTA final */}
        <div style={{ marginTop: 28, background: 'white', border: `1.5px solid ${ACCENT}`, borderRadius: 16, padding: '22px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: '#0b1120', marginBottom: 6 }}>Quer isto no seu centro de dia?</div>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 auto 16px', maxWidth: 440, lineHeight: 1.6 }}>
            Tudo montado de raiz para um centro de dia. Sem configurar nada — diz-nos que é um centro de dia e o Phlox adapta-se.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/centro-de-dia" style={{ padding: '12px 24px', background: ACCENT, color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Saber mais</Link>
            <Link href="/onboarding" style={{ padding: '12px 24px', background: 'white', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Experimentar grátis</Link>
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 760px){ .demo-col { grid-column: span 12 !important; } }`}</style>
    </div>
  )
}
