'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function AuthRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && user) {
      const onboarded = (user as any)?.onboarded === true
      router.replace(onboarded ? '/dashboard' : '/onboarding')
    }
  }, [user, loading, router])
  return null
}

// ─── Feature showcase data ────────────────────────────────────────────────────

const PRO_FEATURES = [
  {
    icon: '🏥', title: 'Phlox Ward', tag: 'Pro · Institucional',
    desc: 'Ficha clínica colaborativa em tempo real. Toda a equipa no mesmo doente — notas, alertas, decisões, parâmetros. Passagem de turno gerada por AI em 1 clique.',
    color: '#1d4ed8', href: '/teams',
    highlights: ['8 tipos de mensagem clínica', 'Passagem de turno automática', 'Multi-utilizador com papéis', 'Histórico auditável'],
  },
  {
    icon: '🔗', title: 'Phlox Connect', tag: 'Pro · Institucional',
    desc: 'A comunicação clínica inter-profissional que ainda não existe em Portugal. Farmacêutico → Médico, dentro do contexto do doente, auditável e estruturado.',
    color: '#0d6e42', href: '/connect',
    highlights: ['Farmacêutico ↔ Médico ↔ Enfermeiro', 'Contexto clínico do doente', 'Análise AI automática', 'Aceite/Rejeição documentada'],
  },
  {
    icon: '⚖️', title: 'Phlox Rounds', tag: 'Pro · Institucional',
    desc: 'Ronda farmacêutica digital. Lista de doentes por score de risco, alertas automáticos, registo PCNE v9.1, e relatório mensal de actividade para acreditação.',
    color: '#7c3aed', href: '/rounds',
    highlights: ['Score de risco 0-100', 'PCNE v9.1 completo', 'Relatório mensal automático', 'Para acreditação hospitalar'],
  },
]

const STUDENT_FEATURES = [
  {
    icon: '🏆', title: 'Phlox Arena', tag: 'Student',
    desc: 'Sistema de ligas de conhecimento clínico. Bronze → Diamante. Casos de todas as áreas da saúde, gerados por AI, com timer e XP. Compete com estudantes de todo o mundo.',
    color: '#7c3aed', href: '/arena',
    highlights: ['5 ligas: Bronze → Diamante', 'Casos de 10 áreas da saúde', 'XP com bónus de velocidade', 'Ranking global'],
  },
  {
    icon: '🩺', title: 'Phlox OSCE', tag: 'Student',
    desc: 'Simulação de OSCE para 6 cursos de saúde. A AI faz de doente em tempo real. Tu fazes de profissional. Checklist + diagnóstico + feedback estação por estação como num exame real.',
    color: '#dc2626', href: '/osce',
    highlights: ['Medicina · Farmácia · Enfermagem', 'Nutrição · Fisioterapia · Dentária', 'AI faz de doente em tempo real', 'Feedback por item como examinador'],
  },
  {
    icon: '🐝', title: 'Phlox Hive', tag: 'Student',
    desc: 'A inteligência colectiva dos estudantes de saúde. Vê onde toda a gente erra mais, identifica os teus pontos cegos vs a comunidade, e estuda exactamente o que falta.',
    color: '#d97706', href: '/hive',
    highlights: ['Dados agregados da comunidade', 'Os teus pontos cegos vs a média', 'Tópicos mais difíceis em tempo real', 'Guia de estudo inteligente'],
  },
]

const FREE_TOOLS = [
  { icon: '⚡', label: 'Verificar Interações', href: '/interactions', desc: 'Qualquer combinação de medicamentos' },
  { icon: '📋', label: 'Tradutor de Bula', href: '/bula', desc: 'Texto técnico em linguagem simples' },
  { icon: '👶', label: 'Dose Pediátrica', href: '/dose-crianca', desc: 'Peso + medicamento = dose certa' },
]

const STATS = [
  { value: '35+', label: 'ferramentas clínicas' },
  { value: '10', label: 'domínios de saúde' },
  { value: '6', label: 'cursos suportados' },
  { value: '100%', label: 'grátis para começar' },
]

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: 'var(--font-sans)' }}>
      <AuthRedirect />
      <Header />

      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ background: '#0f172a', padding: '80px 0 0', overflow: 'hidden', position: 'relative' }}>
        {/* Background grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

        <div className="page-container" style={{ position: 'relative' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '6px 14px', marginBottom: 28 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Disponível agora · Portugal e Mundo
              </span>
            </div>

            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 5vw, 60px)', color: '#f8fafc', fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 20 }}>
              A plataforma clínica que<br />
              <span style={{ color: '#22c55e' }}>a saúde em Portugal</span><br />
              estava a espera
            </h1>

            <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#64748b', lineHeight: 1.8, maxWidth: 580, margin: '0 auto 36px' }}>
              Para profissionais que querem ferramentas reais. Para estudantes que querem competir a sério. Para famílias que merecem compreender a sua medicação.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
              <Link href="/login" style={{ padding: '14px 32px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
                className="cta-primary">
                Começar grátis →
              </Link>
              <Link href="/interactions" style={{ padding: '14px 24px', background: 'transparent', color: '#94a3b8', textDecoration: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, border: '1px solid #334155', transition: 'all 0.15s' }}
                className="cta-secondary">
                Experimentar sem conta ↗
              </Link>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#1e293b', borderRadius: 10, overflow: 'hidden', maxWidth: 560, margin: '0 auto 0' }}>
              {STATS.map(s => (
                <div key={s.label} style={{ background: '#0f172a', padding: '18px 12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: '#f8fafc', marginBottom: 3 }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard preview mockup */}
          <div style={{ background: '#1e293b', borderRadius: '12px 12px 0 0', border: '1px solid #334155', borderBottom: 'none', padding: '16px 20px', maxWidth: 880, margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['#ff5f57','#ffbd2e','#28c840'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, minHeight: 200 }}>
              {/* Sidebar */}
              <div style={{ background: '#0f172a', borderRadius: 8, padding: 12 }}>
                {['🏥 Phlox Ward', '🔗 Connect', '⚖️ Rounds', '⚕️ Doentes', '💊 MAR'].map((item, i) => (
                  <div key={i} style={{ padding: '7px 10px', borderRadius: 5, background: i === 0 ? '#1e293b' : 'transparent', fontSize: 11, color: i === 0 ? '#f8fafc' : '#475569', marginBottom: 3, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>{item}</div>
                ))}
              </div>
              {/* Main */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-mono)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Feed — Manuel Cardoso</div>
                  {[
                    { color: '#dc2626', icon: '🚨', text: 'Alerta: TA 180/100 — requer atenção', role: 'Enfermeiro · há 12m' },
                    { color: '#0d6e42', icon: '⚕️', text: 'Decisão: Ajuste para Ramipril 10mg', role: 'Médico · há 45m' },
                    { color: '#1d4ed8', icon: '📊', text: 'Parâmetro: Creatinina 1.8 mg/dL', role: 'Farmacêutico · há 2h' },
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0', borderBottom: i < 2 ? '1px solid #1e293b' : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, color: '#f1f5f9', lineHeight: 1.4 }}>{m.icon} {m.text}</div>
                        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FREE TOOLS BAR ────────────────────────────────────────────────── */}
      <section style={{ background: '#f0fdf5', borderBottom: '1px solid #bbf7d0', padding: '18px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>Grátis · Sem conta:</span>
            {FREE_TOOLS.map(t => (
              <Link key={t.href} href={t.href}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: 'white', border: '1px solid #bbf7d0', borderRadius: 20, textDecoration: 'none', fontSize: 13, color: '#0d6e42', fontWeight: 600, transition: 'all 0.15s' }}
                className="free-tool-chip">
                <span>{t.icon}</span>{t.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRO / INSTITUCIONAL ───────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'white' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#1d4ed8', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Pro e Institucional</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,42px)', color: '#0f172a', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>
              Feito para o trabalho.<br />Não para o fim-de-semana.
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              Farmácias, hospitais, clínicas, lares — as ferramentas que substituem o papel, o fax, e o WhatsApp clínico. A sério.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,320px),1fr))', gap: 16 }}>
            {PRO_FEATURES.map(f => (
              <div key={f.title} style={{ border: `1px solid #e2e8f0`, borderRadius: 14, overflow: 'hidden', transition: 'all 0.2s' }} className="feature-card">
                <div style={{ background: f.color, padding: '24px 24px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', fontWeight: 400 }}>{f.title}</div>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{f.tag}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                </div>
                <div style={{ padding: '18px 24px', background: '#f8fafc' }}>
                  {f.highlights.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: `${f.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke={f.color} strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                      </div>
                      <span style={{ fontSize: 13, color: '#374151' }}>{h}</span>
                    </div>
                  ))}
                  <Link href={f.href}
                    style={{ display: 'block', marginTop: 14, padding: '10px', background: f.color, color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, textAlign: 'center', transition: 'opacity 0.15s' }}>
                    Ver {f.title} →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link href="/pricing" style={{ fontSize: 14, color: '#1d4ed8', textDecoration: 'none', fontWeight: 700 }}>
              Ver todos os planos Pro e Institucional →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── STUDENT ───────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(220,38,38,0.1) 0%, transparent 50%)', pointerEvents: 'none' }} />
        <div className="page-container" style={{ position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#a78bfa', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Student</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,42px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>
              Para estudantes que<br />
              <span style={{ color: '#a78bfa' }}>querem ser os melhores.</span>
            </h2>
            <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              Arena com ligas. OSCE com AI. Inteligência colectiva da comunidade. O estudo em saúde como nunca foi feito.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,300px),1fr))', gap: 14 }}>
            {STUDENT_FEATURES.map(f => (
              <div key={f.title} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, overflow: 'hidden', transition: 'all 0.2s' }} className="feature-card-dark">
                <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 26 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: '#f8fafc', fontWeight: 400 }}>{f.title}</div>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: f.color, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{f.tag}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                </div>
                <div style={{ padding: '14px 22px' }}>
                  {f.highlights.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ color: f.color, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>→</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{h}</span>
                    </div>
                  ))}
                  <Link href={f.href}
                    style={{ display: 'block', marginTop: 12, padding: '9px', background: `${f.color}20`, color: f.color, textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, textAlign: 'center', border: `1px solid ${f.color}40`, transition: 'all 0.15s' }}>
                    Entrar em {f.title} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PERSONAS ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'white' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,36px)', color: '#0f172a', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 12 }}>
              Para todos os que trabalham com saúde
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 460, margin: '0 auto' }}>Uma plataforma, quatro experiências completamente diferentes.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,240px),1fr))', gap: 12 }}>
            {[
              { icon: '⚕️', title: 'Profissional', sub: 'Farmácia · Hospital · Clínica', color: '#1d4ed8', href: '/login?mode=clinical', tools: ['Phlox Ward', 'Phlox Connect', 'Phlox Rounds', 'MAR Digital', 'Phlox AI Clínico'] },
              { icon: '🎓', title: 'Estudante', sub: 'Medicina · Farmácia · Enfermagem · +3', color: '#7c3aed', href: '/login?mode=student', tools: ['Phlox Arena', 'Phlox OSCE', 'Phlox Hive', 'Turno Virtual', 'Modo Exame'] },
              { icon: '👨‍👩‍👧', title: 'Cuidador', sub: 'Família · Pais · Filhos', color: '#b45309', href: '/login?mode=caregiver', tools: ['Perfis familiares', 'Phlox Care Plan', 'Nota de Entrega', 'Calendário de Toma', 'Phlox AI'] },
              { icon: '👤', title: 'Pessoal', sub: 'A minha saúde', color: '#0d6e42', href: '/login?mode=personal', tools: ['Os meus medicamentos', 'Monitor de Adesão', 'Phlox Timeline', 'Perceber análises', 'Phlox AI'] },
            ].map(p => (
              <Link key={p.title} href={p.href} style={{ display: 'flex', flexDirection: 'column', padding: '22px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, textDecoration: 'none', transition: 'all 0.15s' }} className="persona-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 28 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: p.color }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{p.sub}</div>
                  </div>
                </div>
                {p.tools.map((t, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#64748b', padding: '4px 0', borderBottom: i < p.tools.length - 1 ? '1px solid #e2e8f0' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    {t}
                  </div>
                ))}
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: p.color }}>Começar como {p.title.toLowerCase()} →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF / TRUST ──────────────────────────────────────────── */}
      <section style={{ padding: '60px 0', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 32 }}>
            Fontes de informação
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40, alignItems: 'center' }}>
            {['FDA · OpenFDA', 'INFARMED', 'EMA', 'RxNorm / NIH', 'ESC · ADA · NICE · DGS'].map(s => (
              <span key={s} style={{ fontSize: 13, color: '#64748b', fontFamily: 'var(--font-mono)', padding: '6px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 20 }}>{s}</span>
            ))}
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            A IA é usada para síntese e raciocínio — nunca como fonte primária. Toda a informação crítica é verificável nas fontes originais.
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: '#0f172a' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 620 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 16 }}>
            Começa hoje.<br />É grátis.
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', marginBottom: 32, lineHeight: 1.7 }}>
            Três ferramentas sem conta. Upgrade quando quiseres. Cancela quando quiseres.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ padding: '15px 36px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 16, fontWeight: 800, transition: 'all 0.15s' }} className="cta-primary">
              Criar conta grátis →
            </Link>
            <Link href="/pricing" style={{ padding: '15px 24px', background: 'transparent', color: '#64748b', textDecoration: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, border: '1px solid #334155' }}>
              Ver planos e preços
            </Link>
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: '#334155', fontFamily: 'var(--font-mono)' }}>
            © 2026 Phlox Clinical · Feito em Portugal
          </div>
        </div>
      </section>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(34,197,94,0.3) }
        .free-tool-chip:hover { background: #f0fdf5 !important; transform: translateY(-1px) }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.08) }
        .feature-card-dark:hover { border-color: #475569 !important; transform: translateY(-3px) }
        .persona-card:hover { border-color: #cbd5e1 !important; box-shadow: 0 8px 24px rgba(0,0,0,0.06); transform: translateY(-2px) }
        .cta-secondary:hover { border-color: #475569 !important; color: #f8fafc !important }
      `}</style>
    </div>
  )
}