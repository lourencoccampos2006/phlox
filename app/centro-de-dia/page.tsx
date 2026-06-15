import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Software para Centro de Dia — Phlox',
  description: 'O software feito de raiz para centros de dia: o dia de cada utente, a medicação casa↔centro, e as famílias a verem como correu o dia. Sem configurar nada. Experimente grátis.',
  openGraph: {
    title: 'Phlox — o software do seu Centro de Dia',
    description: 'O dia dos utentes, as famílias tranquilas, tudo num sítio.',
    type: 'website',
  },
}

const TEAL = '#0d9488'
const INK = '#16181d'
const BORDER = '#e7e8ea'

const serif: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }

function Dor({ emoji, titulo, texto }: { emoji: string; titulo: string; texto: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ fontSize: 26, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 14, color: '#545862', lineHeight: 1.6 }}>{texto}</div>
    </div>
  )
}

export default function CentroDeDiaLanding() {
  return (
    <div style={{ background: '#fff', color: INK, fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>

      {/* HERO */}
      <section style={{ padding: 'clamp(40px,7vw,72px) 0', background: 'linear-gradient(180deg, #f0fdfa 0%, #fff 100%)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 clamp(16px,4vw,24px)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 999, background: '#fff', border: `1px solid ${BORDER}`, marginBottom: 18, fontSize: 12.5, fontWeight: 600, color: TEAL }}>
            ☀️ Feito de raiz para Centros de Dia
          </div>
          <h1 style={{ ...serif, fontSize: 'clamp(30px,5.2vw,52px)', lineHeight: 1.1, margin: '0 0 16px' }}>
            O dia dos seus utentes, as famílias tranquilas.
          </h1>
          <p style={{ fontSize: 'clamp(16px,2.2vw,19px)', color: '#545862', lineHeight: 1.6, maxWidth: 580, margin: '0 auto 26px' }}>
            O Phlox organiza o dia no centro — presenças, atividades, refeições, medicação — e mostra às famílias como correu, sem ninguém ter de ligar. Tudo montado para si. Sem configurar nada.
          </p>
          <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/demo" style={{ padding: '13px 26px', background: TEAL, color: '#fff', borderRadius: 9, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Ver a demonstração</Link>
            <Link href="/onboarding" style={{ padding: '13px 24px', background: '#fff', color: INK, border: `1px solid ${BORDER}`, borderRadius: 9, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>Experimentar grátis</Link>
          </div>
        </div>
      </section>

      {/* A DOR */}
      <section style={{ padding: 'clamp(44px,7vw,72px) 0', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 clamp(16px,4vw,24px)' }}>
          <h2 style={{ ...serif, fontSize: 'clamp(22px,3.2vw,32px)', textAlign: 'center', margin: '0 0 10px' }}>Gerir um centro de dia é malabarismo.</h2>
          <p style={{ fontSize: 15, color: '#545862', textAlign: 'center', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Papéis, cadernos, e as famílias a ligar a perguntar como correu o dia. O Phlox põe tudo num sítio.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 14 }}>
            <Dor emoji="📋" titulo="Registos espalhados" texto="Refeições, humor, atividades e medicação em cadernos diferentes. O Phlox junta o dia de cada utente num registo só." />
            <Dor emoji="💊" titulo="Medicação casa ↔ centro" texto="Umas tomas são no centro, outras em casa. O Phlox mostra claramente o que a equipa dá e o que fica para a família — sem dose a dobrar nem falhada." />
            <Dor emoji="📞" titulo="Famílias ansiosas" texto="As famílias ligam para saber como correu. Com o Phlox, abrem o telemóvel e veem — almoçou bem, esteve animado, tomou a medicação." />
          </div>
        </div>
      </section>

      {/* A CONFIANÇA (o diferenciador) */}
      <section style={{ padding: 'clamp(44px,7vw,72px) 0', borderTop: `1px solid ${BORDER}`, background: '#f0fdfa' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 clamp(16px,4vw,24px)', textAlign: 'center' }}>
          <h2 style={{ ...serif, fontSize: 'clamp(22px,3.4vw,36px)', lineHeight: 1.15, margin: '0 0 16px' }}>
            O centro de dia que as famílias confiam.
          </h2>
          <p style={{ fontSize: 16, color: '#374151', lineHeight: 1.7, margin: '0 auto 24px', maxWidth: 600 }}>
            Quando a família vem buscar o pai ou a mãe ao fim do dia, já viu no telemóvel como correu. É a diferença entre uma família que confia e uma que tira o utente do centro. O Phlox transforma o cuidado que já fazem em <strong>confiança visível</strong> — o seu melhor argumento de venda às famílias.
          </p>
          <Link href="/demo" style={{ display: 'inline-block', padding: '12px 24px', background: TEAL, color: '#fff', borderRadius: 9, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Ver o que a família vê →</Link>
        </div>
      </section>

      {/* COMO É */}
      <section style={{ padding: 'clamp(44px,7vw,72px) 0', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 clamp(16px,4vw,24px)' }}>
          <h2 style={{ ...serif, fontSize: 'clamp(22px,3.2vw,32px)', textAlign: 'center', margin: '0 0 32px' }}>Montado para si, não uma plataforma genérica.</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              ['Diz-nos que é um centro de dia', 'No registo, escolhe "Centro de Dia". O painel, o menu e as ferramentas adaptam-se — sem configurar nada.'],
              ['A equipa regista o dia', 'Presenças, refeições, humor, atividades e medicação — rápido, num só ecrã, feito para o ritmo de um centro de dia (sem turno da noite, sem coisas de lar que não se aplicam).'],
              ['As famílias acompanham', 'Recebem o resumo do dia no telemóvel, com um código seguro. Veem como correu, sem ter de ligar.'],
            ].map(([t, d], i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: TEAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <div><div style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 4 }}>{t}</div><div style={{ fontSize: 14.5, color: '#545862', lineHeight: 1.6 }}>{d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: 'clamp(44px,7vw,80px) 0', borderTop: `1px solid ${BORDER}`, background: '#0b1120', color: '#fff', textAlign: 'center' }}>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '0 clamp(16px,4vw,24px)' }}>
          <h2 style={{ ...serif, fontSize: 'clamp(24px,3.6vw,38px)', margin: '0 0 14px' }}>Quer ver no seu centro?</h2>
          <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 26px' }}>
            Veja a demonstração em 1 minuto, ou comece já — é grátis para experimentar.
          </p>
          <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/demo" style={{ padding: '13px 26px', background: TEAL, color: '#fff', borderRadius: 9, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Ver demonstração</Link>
            <Link href="/onboarding" style={{ padding: '13px 24px', background: 'transparent', color: '#fff', border: '1px solid #334155', borderRadius: 9, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>Experimentar grátis</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
