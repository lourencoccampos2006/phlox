'use client'

import Link from 'next/link'

const TOOLS = [
  {
    href: '/interactions',
    icon: '🔍',
    label: 'Verificar interações',
    desc: 'Verifica se dois ou mais medicamentos são seguros juntos. Cobre mecanismos, gravidade e o que fazer.',
    badge: null,
    color: '#0d9488',
    featured: true,
  },
  {
    href: '/food-drug',
    icon: '🥗',
    label: 'Alimentos a evitar',
    desc: 'Descobre quais os alimentos que não deves misturar com a tua medicação. Ex: sumo de toranja, laticínios, álcool.',
    badge: null,
    color: '#0d9488',
    featured: true,
  },
  {
    href: '/bula',
    icon: '📄',
    label: 'Perceber uma bula',
    desc: 'Cola aqui qualquer texto de bula e o Phlox explica em linguagem simples o que realmente importa.',
    badge: null,
    color: '#0d9488',
    featured: false,
  },
  {
    href: '/schedule',
    icon: '⏰',
    label: 'Horário inteligente',
    desc: 'A IA cria o horário ideal para os teus medicamentos, evitando interações e respeitando refeições.',
    badge: 'Novo',
    color: '#0d9488',
    featured: false,
  },
  {
    href: '/optimizer',
    icon: '⚡',
    label: 'Otimizar prescrição',
    desc: 'Analisa a tua lista de medicamentos com critérios STOPP/START e sugere alternativas mais seguras ou económicas.',
    badge: 'Novo',
    color: '#0d9488',
    featured: false,
  },
  {
    href: '/labs',
    icon: '🧪',
    label: 'Perceber análises',
    desc: 'Sobe um resultado de análises e a IA explica cada valor, o que significa e quando deves falar com o médico.',
    badge: null,
    color: '#e11d48',
    featured: false,
  },
]

export default function VerificarPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '40px 24px 36px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            Segurança
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 10px', lineHeight: 1.15 }}>
            Verificar
          </h1>
          <p style={{ fontSize: 15, color: '#64748b', margin: 0, maxWidth: 480 }}>
            Todas as ferramentas de segurança e verificação num só lugar. Antes de tomar, verifica.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 20px 72px' }}>

        {/* Featured tools */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          Mais usadas
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))', gap: 12, marginBottom: 36 }}>
          {TOOLS.filter(t => t.featured).map(tool => (
            <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none' }} className="ver-card">
              <div style={{
                background: 'white',
                border: `1.5px solid ${tool.color}20`,
                borderRadius: 16,
                padding: '22px 22px 20px',
                display: 'flex', gap: 18,
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `${tool.color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, flexShrink: 0,
                }}>
                  {tool.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {tool.label}
                    {tool.badge && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: tool.color, background: `${tool.color}15`, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
                    {tool.desc}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* All tools */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          Outras ferramentas
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
          {TOOLS.filter(t => !t.featured).map(tool => (
            <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none' }} className="ver-card">
              <div style={{
                background: 'white',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 14,
                padding: '16px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${tool.color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {tool.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {tool.label}
                    {tool.badge && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: tool.color, background: `${tool.color}15`, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{tool.desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer CTA */}
        <div style={{ marginTop: 40, textAlign: 'center', padding: '28px 24px', background: 'white', borderRadius: 16, border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Precisas de outra ferramenta?</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Vê todas as ferramentas disponíveis no Phlox.</div>
          <Link href="/ferramentas" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 22px', borderRadius: 24,
            background: '#0f172a', color: 'white',
            fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
            Todas as ferramentas
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </div>

      <style>{`
        .ver-card > div:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.08) !important;
        }
      `}</style>
    </div>
  )
}
