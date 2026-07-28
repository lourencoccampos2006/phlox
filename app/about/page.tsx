import Link from 'next/link'
import { Metadata } from 'next'
import Icon from '@/components/Icon'

export const metadata: Metadata = {
  title: 'Sobre o Phlox',
  description: 'O Phlox organiza o dia de centros de dia e lares, mostra às famílias como correu, e ajuda quem cuida da sua saúde, da família, ou estuda saúde.',
}

const STATS = [
  { value: '4', label: 'Modos: centro, família, pessoal, estudo' },
  { value: '10.000+', label: 'Medicamentos indexados' },
  { value: '4', label: 'Bases de dados oficiais' },
  { value: '100%', label: 'Gratuito para começar' },
]

const SOURCES = [
  { name: 'OpenFDA', desc: 'Base de dados oficial da FDA — informação de bulas, efeitos adversos e farmacovigilância', href: 'https://open.fda.gov', icon: 'shield' },
  { name: 'INFARMED', desc: 'Autoridade Nacional do Medicamento e Produtos de Saúde — Portugal', href: 'https://www.infarmed.pt', icon: 'shield' },
  { name: 'EMA', desc: 'Agência Europeia do Medicamento — alertas de segurança e EPARs', href: 'https://www.ema.europa.eu', icon: 'shield' },
  { name: 'RxNorm / NIH', desc: 'Base de dados de nomenclatura e interações do National Institutes of Health', href: 'https://www.nlm.nih.gov/research/umls/rxnorm', icon: 'shield' },
  { name: 'Groq + Llama 3.3', desc: 'IA de análise clínica — usada para síntese e raciocínio quando as bases de dados não chegam', href: 'https://groq.com', icon: 'spark' },
  { name: 'Gemini 2.5', desc: 'IA multimodal do Google — usada para análise de imagens e documentos clínicos', href: 'https://deepmind.google/gemini', icon: 'spark' },
]

const MODES = [
  { icon: 'home', title: 'Centro de Dia e Lar', desc: 'O dia de cada utente num só sítio: presenças, medicação, refeições, humor e atividades. As famílias acompanham pelo telemóvel. Toda a equipa, sem limite de utilizadores.', color: '#1d4ed8' },
  { icon: 'family', title: 'Cuidador Familiar', desc: 'Para quem gere a medicação dos pais idosos, filhos ou cônjuge. Perfis por familiar, alertas de interações, tradutor de bula, nota de entrega.', color: '#b45309' },
  { icon: 'user', title: 'Uso Pessoal', desc: 'Gere a tua própria medicação. Verifica interações, percebe receitas e análises, acompanha vacinas e tem resposta a qualquer dúvida.', color: '#0d6e42' },
  { icon: 'book', title: 'Estudante', desc: 'Medicina, farmácia, enfermagem, nutrição e mais. Flashcards e quiz sobre qualquer tema, Arena de casos, OSCE, tutor IA e caso clínico evolutivo. O companheiro de estudo que passa os exames contigo.', color: '#7c3aed' },
]

const ROADMAP = [
  { q: 'Q2 2026', items: ['Lançamento público', 'Centros de dia e lares', 'Portal das famílias', 'Calendário de toma em PDF'] },
  { q: 'Q3 2026', items: ['Importação SNS24 QR', 'Avisos automáticos', 'Rondas coordenadas', 'App mobile (PWA)'] },
  { q: 'Q4 2026', items: ['Relatórios de qualidade para inspeção', 'Diário do utente para a família', 'Modelos de atividades', 'Stock com encomendas'] },
]

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>


      {/* Hero */}
      <section style={{ background: 'var(--ink)', padding: '72px 0 56px', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 20 }}>
            Feito em Portugal · Para o Mundo
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 5vw, 48px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 20, lineHeight: 1.2 }}>
            O cuidado que já existe,<br />finalmente organizado
          </h1>
          <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.8, maxWidth: 560, margin: '0 auto 40px' }}>
            O Phlox nasceu de uma frustração: os centros de dia e os lares cuidam bem, mas em cadernos soltos — e as famílias ficam de fora. Construímos a ferramenta que junta o dia num sítio, mostra às famílias como correu, e serve também quem cuida da sua saúde em casa ou estuda para cuidar dos outros.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#1e293b', borderRadius: 10, overflow: 'hidden', maxWidth: 600, margin: '0 auto' }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background: '#0f172a', padding: '20px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#f8fafc', fontWeight: 400, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modos */}
      <section style={{ padding: '64px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Para quem</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
              Quatro experiências completamente diferentes
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
            {MODES.map(m => (
              <div key={m.title} style={{ padding: '24px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ marginBottom: 12 }}><Icon name={m.icon} size={26} color={m.color} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: m.color, marginBottom: 8 }}>{m.title}</div>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fontes */}
      <section style={{ padding: '64px 0', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Transparência</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--ink)', fontWeight: 400 }}>De onde vem a informação</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.6 }}>
              Todas as fontes são públicas, verificáveis, e atualizadas. A IA é usada para síntese e raciocínio — nunca como fonte primária.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SOURCES.map(s => (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s' }}
                className="source-link">
                <span style={{ flexShrink: 0, marginTop: 2, color: 'var(--ink-4)' }}><Icon name={s.icon} size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 4 }}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#78350f', lineHeight: 1.6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="alert" size={16} color="#b45309" /></span>
            <span>O Phlox é uma ferramenta de apoio à decisão — não substitui o julgamento clínico. Confirma sempre informação crítica com fontes primárias e especialistas.</span>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section style={{ padding: '64px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ maxWidth: 720 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Roadmap 2026</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--ink)', fontWeight: 400 }}>O que vem a seguir</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {ROADMAP.map((r, i) => (
              <div key={r.q} style={{ padding: '20px', background: i === 0 ? 'var(--ink)' : 'var(--bg)', border: `1px solid ${i === 0 ? 'transparent' : 'var(--border)'}`, borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: i === 0 ? '#22c55e' : 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i === 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />}
                  {r.q}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.items.map(item => (
                    <div key={item} style={{ fontSize: 13, color: i === 0 ? 'rgba(255,255,255,0.85)' : 'var(--ink-2)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ color: i === 0 ? '#22c55e' : 'var(--green)', flexShrink: 0, marginTop: 1 }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '56px 0', background: 'var(--bg)' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 560 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 32px)', color: 'var(--ink)', fontWeight: 400, marginBottom: 16 }}>
            Começa hoje. É grátis.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.7 }}>
            Três ferramentas gratuitas sem conta. Upgrade quando quiseres.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '13px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
              Criar conta grátis →
            </Link>
            <Link href="/pricing" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '13px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: '1px solid var(--border)' }}>
              Ver planos
            </Link>
          </div>
        </div>
      </section>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} .source-link:hover{border-color:var(--border-2)!important}`}</style>
    </div>
  )
}