import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Medicamentos a evitar em idosos — critérios Beers | Phlox',
  description: 'A lista dos medicamentos potencialmente inapropriados em pessoas com mais de 65 anos (critérios Beers/STOPP): benzodiazepinas, anticolinérgicos, AINEs e mais — com alternativas.',
  openGraph: {
    title: 'Medicamentos a evitar em idosos — critérios Beers',
    description: 'Os medicamentos que merecem uma segunda vista depois dos 65 — e porquê.',
    type: 'article',
  },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 20 }

export default function PostBeers() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          <span>·</span><span>Geriatria</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>GERIATRIA</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Medicamentos a evitar em idosos — critérios Beers
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
            Com a idade, o corpo processa os medicamentos de forma diferente — o que era seguro aos 50 pode ser arriscado aos 75. Os <strong>critérios Beers</strong> (e os europeus STOPP/START) listam os medicamentos que merecem uma segunda vista nos mais velhos.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            <span>1 de Março de 2026</span><span>·</span><span>9 min de leitura</span><span>·</span><span>Base: Beers 2023, STOPP/START v3</span>
          </div>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #2563eb', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1e40af', letterSpacing: '0.08em', marginBottom: 6 }}>ℹ NÃO PARES NADA SOZINHO</div>
          <p style={{ fontSize: 14, color: '#1e3a5f', lineHeight: 1.7, margin: 0 }}>
            "Potencialmente inapropriado" não significa "proibido para todos". Significa "vale a pena rever com o médico". Parar de repente alguns destes medicamentos é perigoso.
          </p>
        </div>

        <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
          <h2 style={H2}>Por que a idade muda tudo</h2>
          <p style={P}>Nos idosos, os rins e o fígado eliminam os medicamentos mais devagar, o cérebro é mais sensível, e muitas pessoas tomam vários medicamentos ao mesmo tempo (polimedicação). Tudo isto faz com que efeitos secundários — quedas, confusão, tonturas — sejam mais prováveis e mais graves.</p>

          <h2 style={H2}>Os grupos que mais aparecem na lista</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li><strong>Benzodiazepinas e "comprimidos para dormir"</strong> (diazepam, lorazepam, zolpidem) — aumentam quedas, fraturas e confusão. Das causas mais comuns de ida às urgências por queda.</li>
            <li><strong>Anticolinérgicos</strong> (alguns antialérgicos, antidepressivos antigos, medicamentos para a bexiga) — causam confusão, obstipação, retenção urinária e boca seca. A "carga anticolinérgica" soma-se quando há vários.</li>
            <li><strong>AINEs</strong> (ibuprofeno, naproxeno em uso prolongado) — risco de hemorragia gástrica e de afetar os rins e a tensão.</li>
            <li><strong>Antipsicóticos</strong> usados para agitação na demência — só em casos específicos, pelo risco cardiovascular e de AVC.</li>
            <li><strong>Sulfonilureias de longa ação</strong> (glibenclamida) — risco de hipoglicemia prolongada.</li>
          </ul>

          <h2 style={H2}>O que costuma ser a alternativa</h2>
          <p style={P}>Para o sono, medidas não farmacológicas e revisão da higiene do sono antes de comprimidos. Para a dor, paracetamol como base. Para a alergia, antihistamínicos mais recentes (menos anticolinérgicos). Mas a alternativa certa depende sempre da pessoa — é o médico que decide.</p>

          <h2 style={H2}>O que é uma "revisão da medicação"</h2>
          <p style={P}>É sentar com o médico ou farmacêutico e olhar para <strong>toda</strong> a medicação ao mesmo tempo: o que ainda faz sentido, o que se pode reduzir, o que se "mordem" entre si. Pelo menos uma vez por ano, e sempre que há um medicamento novo. É das coisas que mais melhora a qualidade de vida de uma pessoa mais velha.</p>

          <h2 style={H2}>O que dizer ao médico</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['"Pode rever toda a minha medicação? Tomo X comprimidos por dia."', '"Algum destes pode estar a causar tonturas, quedas ou confusão?"', '"Há algum que já possa deixar de tomar?"'].map(q => (
              <li key={q} style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, fontStyle: 'italic' }}>{q}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 48, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Verifica a tua medicação</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>O Phlox cruza a tua medicação à procura de interações e fármacos a evitar no idoso — para levares à conversa com o médico.</p>
          <Link href="/interactions" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Verificar a minha medicação →</Link>
        </div>

        <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
            Este artigo destina-se a fins informativos e educativos. Não substitui o aconselhamento médico nem é uma ordem para parar medicação. Qualquer alteração deve ser feita com o médico. Base: Beers 2023, STOPP/START v3.
          </p>
        </div>
      </article>
    </div>
  )
}
