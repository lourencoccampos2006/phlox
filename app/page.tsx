'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

// Cores (alinhadas com globals.css)
const INK = '#16181d'
const INK_3 = '#545862'
const INK_4 = '#767b86'
const GREEN = '#0d6e42'
const BORDER = '#e7e8ea'

// ── Demo real: verificar se dois medicamentos se dão bem ──────────────────────
// Mantemos a verificação de interações porque é a coisa mais útil e imediata do
// Phlox. Mostramo-la como aparece mesmo no produto — não como um terminal.
const PARES = [
  {
    a: 'Varfarina', b: 'Ibuprofeno', nivel: 'Não misturar', cor: '#a82828',
    txt: 'O ibuprofeno aumenta o risco de hemorragia em quem toma varfarina.',
    em_vez: 'Para as dores, paracetamol costuma ser mais seguro — confirma com o farmacêutico.',
  },
  {
    a: 'Sertralina', b: 'Tramadol', nivel: 'Não misturar', cor: '#a82828',
    txt: 'Juntos podem causar excesso de serotonina, o que é perigoso.',
    em_vez: 'Há outras opções para a dor. Fala com o médico antes de combinar.',
  },
  {
    a: 'Omeprazol', b: 'Paracetamol', nivel: 'Sem problema', cor: '#0d6e42',
    txt: 'Não há interação conhecida entre estes dois. Podes tomar à vontade.',
    em_vez: '',
  },
]

function Verificador() {
  const [i, setI] = useState(0)
  const p = PARES[i]
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: INK_4 }}>
        Os meus medicamentos dão-se bem?
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap' }}>
        {PARES.map((x, k) => (
          <button key={k} onClick={() => setI(k)} style={{
            padding: '6px 12px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
            border: `1px solid ${i === k ? GREEN : BORDER}`,
            background: i === k ? '#f0fdf5' : '#fff', color: i === k ? GREEN : INK_3,
            fontWeight: i === k ? 700 : 500,
          }}>{x.a} + {x.b}</button>
        ))}
      </div>
      <div style={{ padding: '4px 16px 18px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 999, background: p.cor === GREEN ? '#f0fdf5' : '#fbf2f2', marginBottom: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.cor }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: p.cor }}>{p.nivel}</span>
        </div>
        <p style={{ fontSize: 15, color: INK, lineHeight: 1.6, margin: '0 0 8px' }}>{p.txt}</p>
        {p.em_vez && <p style={{ fontSize: 13.5, color: INK_4, lineHeight: 1.55, margin: 0 }}>{p.em_vez}</p>}
      </div>
    </div>
  )
}

// ── Caminhos: a pessoa escolhe o seu ──────────────────────────────────────────
const CAMINHOS = [
  { emoji: '💊', t: 'A minha medicação', d: 'Guardar os comprimidos, lembretes de toma e ver se se dão bem.', href: '/login?mode=personal' },
  { emoji: '🧓', t: 'Cuidar de alguém', d: 'Organizar a medicação de um familiar e ter tudo num sítio.', href: '/login?mode=caregiver' },
  { emoji: '📚', t: 'Estudar saúde', d: 'Casos, quizzes e treino para o curso de medicina, farmácia ou enfermagem.', href: '/login?mode=student' },
  { emoji: '☀️', t: 'Tenho um centro de dia', d: 'O dia dos utentes e as famílias tranquilas — montado de raiz para si.', href: '/centro-de-dia' },
  { emoji: '🏥', t: 'Trabalho em saúde', d: 'Ferramentas para farmácia, lar, hospital ou clínica.', href: '/login?mode=clinical' },
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div style={{ background: '#fff', color: INK, fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>

      {/* ── Topo: o que é, em palavras normais ──────────────────────────────── */}
      <section style={{ paddingTop: 'clamp(56px,10vh,104px)', paddingBottom: 'clamp(40px,7vw,72px)' }}>
        <div className="page-container">
          <div className="home-hero" style={{
            display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 'clamp(36px,6vw,72px)', alignItems: 'center',
            opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(34px,5.6vw,60px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: '0 0 18px' }}>
                A tua medicação,<br />sem confusões.
              </h1>
              <p style={{ fontSize: 'clamp(16px,2vw,18px)', color: INK_3, lineHeight: 1.6, maxWidth: '42ch', margin: '0 0 28px' }}>
                Vê se os teus comprimidos se dão bem, percebe a bula, organiza a medicação da família.
                E, se trabalhas ou estudas na saúde, tens aqui ferramentas a sério. Em português, de graça para começar.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href="/login" className="home-btn-primary" style={{ padding: '13px 24px', background: INK, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Começar de graça</Link>
                <Link href="/interactions" className="home-btn-ghost" style={{ padding: '13px 22px', background: '#fff', color: INK, border: `1px solid ${BORDER}`, borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>Experimentar já</Link>
              </div>
              <p style={{ fontSize: 12.5, color: INK_4, marginTop: 14 }}>Sem cartão. Sem instalar nada.</p>
            </div>
            <Verificador />
          </div>
        </div>
      </section>

      {/* ── Escolhe o teu caminho ───────────────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${BORDER}`, background: '#fafafa', padding: 'clamp(48px,7vw,80px) 0' }}>
        <div className="page-container">
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(22px,3vw,32px)', letterSpacing: '-0.02em', margin: '0 0 6px' }}>O que te traz aqui?</h2>
          <p style={{ fontSize: 15, color: INK_4, margin: '0 0 28px' }}>Escolhe um — depois mudas quando quiseres.</p>
          <div className="home-paths" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {CAMINHOS.map(c => (
              <Link key={c.t} href={c.href} className="home-path-card" style={{
                display: 'block', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14,
                padding: '20px 18px', textDecoration: 'none', color: INK,
              }}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{c.emoji}</div>
                <div style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 6 }}>{c.t}</div>
                <div style={{ fontSize: 13.5, color: INK_4, lineHeight: 1.55 }}>{c.d}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Três coisas concretas que faz ───────────────────────────────────── */}
      <section style={{ padding: 'clamp(52px,8vw,88px) 0' }}>
        <div className="page-container">
          <div className="home-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(28px,4vw,56px)' }}>
            {[
              { t: 'Tira uma foto, e está feito', d: 'Foto da receita ou da caixa e o Phlox lê tudo: que medicamento é, para que serve, e cria-te a lista.' },
              { t: 'Pergunta o que quiseres', d: 'Posso tomar com álcool? Esqueci uma dose, e agora? Respostas claras, sem o palavreado das bulas.' },
              { t: 'Avisa-te antes de haver problema', d: 'O Phlox olha pela tua medicação e diz-te o que merece atenção, mesmo sem tu perguntares.' },
            ].map(x => (
              <div key={x.t}>
                <div style={{ width: 32, height: 2, background: GREEN, marginBottom: 16 }} />
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{x.t}</h3>
                <p style={{ fontSize: 14.5, color: INK_3, lineHeight: 1.65, margin: 0 }}>{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Porquê em português (sem o claim grandioso) ─────────────────────── */}
      <section style={{ borderTop: `1px solid ${BORDER}`, background: '#fafafa', padding: 'clamp(48px,7vw,80px) 0' }}>
        <div className="page-container">
          <div style={{ maxWidth: 680 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(22px,3.4vw,38px)', letterSpacing: '-0.02em', lineHeight: 1.15, margin: '0 0 16px' }}>
              Feito para aqui, não traduzido.
            </h2>
            <p style={{ fontSize: 16, color: INK_3, lineHeight: 1.7, margin: '0 0 24px' }}>
              Os medicamentos são os das farmácias cá (Ben-u-ron, Brufen, Concor…), sabe o que precisa de receita
              segundo as regras do INFARMED, e segue as guidelines que se usam em Portugal. As apps lá de fora
              tropeçam nos nomes de marca e no SNS — esta não.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['INFARMED', 'DGS', 'EMA', 'ESC 2024', 'Beers 2023', 'STOPP/START v3'].map(s => (
                <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: INK_4, padding: '5px 11px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 999 }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Preço, dito como é ──────────────────────────────────────────────── */}
      <section style={{ background: INK, padding: 'clamp(56px,8vw,96px) 0' }}>
        <div className="page-container">
          <div style={{ maxWidth: 600 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(26px,4vw,44px)', color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 16px' }}>
              Começa de graça. Pagas só se gostares.
            </h2>
            <p style={{ fontSize: 16, color: '#9aa0ab', lineHeight: 1.7, margin: '0 0 26px' }}>
              O plano <strong style={{ color: '#fff' }}>Base</strong> é grátis e tem o essencial (com uns anúncios).
              O <strong style={{ color: '#fff' }}>Plus</strong>, a 3,99 € por mês, tira os anúncios e desbloqueia o resto.
              Cancelas quando quiseres, sem letras pequeninas.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/login" className="home-btn-ondark" style={{ padding: '14px 28px', background: '#fff', color: INK, borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Criar conta grátis</Link>
              <Link href="/pricing" className="home-btn-ghost-dark" style={{ padding: '14px 24px', background: 'transparent', color: '#fff', border: '1px solid #3a3d44', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>Ver os planos</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rodapé ──────────────────────────────────────────────────────────── */}
      <footer style={{ background: INK, borderTop: '1px solid #23262d', padding: '22px 0' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#5a5e67', letterSpacing: '0.06em' }}>© 2026 Phlox · feito em Portugal</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Termos', '/terms'], ['Privacidade', '/privacy'], ['Para instituições', '/institucional']].map(([label, href]) => (
              <Link key={href} href={href} className="footer-lp-link" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#7e828b', textDecoration: 'none', letterSpacing: '0.04em' }}>{label}</Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        .home-btn-primary:hover { background:#2b2e36 !important; }
        .home-btn-ghost:hover { border-color:#b9bcc4 !important; }
        .home-btn-ondark:hover { opacity:0.9; }
        .home-btn-ghost-dark:hover { border-color:#5a5e67 !important; }
        .footer-lp-link:hover { color:#b9bcc4 !important; }
        .home-path-card { transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
        .home-path-card:hover { border-color:#cfd2d6 !important; transform: translateY(-2px); box-shadow: var(--shadow-md); }
        @media(max-width:860px) {
          .home-hero { grid-template-columns:1fr !important; }
          .home-paths { grid-template-columns:repeat(2,1fr) !important; }
          .home-three { grid-template-columns:1fr !important; gap:28px !important; }
        }
        @media(max-width:460px) {
          .home-paths { grid-template-columns:1fr !important; }
        }
      `}</style>
    </div>
  )
}
