import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dose de Paracetamol para Crianças — Calculadora por Peso (2026) | Phlox Clinical',
  description: 'Dose correcta de paracetamol para crianças por peso e idade. Tabela completa, calculadora gratuita, alertas de segurança e quando ir ao médico. Actualizado 2026.',
  keywords: 'dose paracetamol criança, paracetamol peso criança, ben-u-ron criança dose, febre criança tratamento, paracetamol mg kg',
  openGraph: {
    title: 'Dose de Paracetamol para Crianças por Peso — Guia Completo 2026',
    description: 'Tabela completa de doses por peso. Calculadora gratuita. Alertas de segurança.',
    type: 'article',
  },
}

const DOSE_TABLE = [
  { peso: '3–5 kg',   idade: '0–3 meses',   xarope: '2,5–4 mL',   supositorio: '125 mg',  comp: '—' },
  { peso: '6–9 kg',   idade: '3–12 meses',   xarope: '4–6 mL',     supositorio: '250 mg',  comp: '—' },
  { peso: '10–15 kg', idade: '1–4 anos',     xarope: '6–10 mL',    supositorio: '500 mg',  comp: '½ comp. 500mg' },
  { peso: '16–21 kg', idade: '4–7 anos',     xarope: '10–14 mL',   supositorio: '500 mg',  comp: '1 comp. 500mg' },
  { peso: '22–32 kg', idade: '7–12 anos',    xarope: '14–21 mL',   supositorio: '1000 mg', comp: '1 comp. 500mg' },
  { peso: '33–45 kg', idade: '12–15 anos',   xarope: '21–30 mL',   supositorio: '1000 mg', comp: '1–2 comp. 500mg' },
]

function Schema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Dose de Paracetamol para Crianças por Peso",
    "description": "Guia completo com tabela de doses de paracetamol por peso para crianças, calculadora gratuita e alertas de segurança.",
    "author": { "@type": "Organization", "name": "Phlox Clinical" },
    "publisher": { "@type": "Organization", "name": "Phlox Clinical" },
    "datePublished": "2026-01-10",
    "dateModified": "2026-05-01",
    "medicalAudience": [{ "@type": "MedicalAudience", "audienceType": "Patient" }],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
}

export default function BlogDoseParacetamolCrianca() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Schema />


      <article style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 80px' }}>

        {/* Breadcrumb */}
        <nav style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 28 }}>
          <Link href="/" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Phlox</Link>
          {' › '}
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          {' › '}
          Dose paracetamol criança
        </nav>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#0d6e42', background: '#d1fae5', padding: '2px 8px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pediatria</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>Actualizado Maio 2026 · 5 min de leitura</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,40px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 16 }}>
            Dose de Paracetamol para Crianças:<br />Guia Completo por Peso (2026)
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 20 }}>
            A dose correcta de paracetamol para uma criança depende do peso — não da idade. Este guia tem a tabela completa, as formas farmacêuticas disponíveis em Portugal, os intervalos entre doses, e quando deve procurar ajuda médica.
          </p>
          {/* CTA para calculadora */}
          <Link href="/dose-crianca"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            Calcular a dose exacta agora →
          </Link>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />

        {/* Regra base */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
            A regra base: 15 mg por kg de peso
          </h2>
          <div style={{ background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#0d6e42', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Fórmula</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0d6e42' }}>Dose (mg) = 15 × peso (kg)</div>
            <div style={{ fontSize: 13, color: '#14532d', marginTop: 8, lineHeight: 1.6 }}>
              Exemplo: criança de 20 kg → 15 × 20 = 300 mg por dose
            </div>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75 }}>
            A dose pode variar entre 10 e 15 mg/kg, mas 15 mg/kg é a dose terapêutica recomendada para febre e dor ligeira a moderada. Nunca deve exceder 60 mg/kg/dia nem 4 doses por dia, independentemente do peso.
          </p>
        </section>

        {/* Tabela */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
            Tabela de doses por peso — Ben-u-ron e equivalentes
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 16 }}>
            O xarope de paracetamol pediátrico em Portugal (Ben-u-ron, Paracetamol Ratiopharm e equivalentes) tem concentração de <strong>120 mg/5 mL</strong>. Os supositórios Ben-u-ron existem em 125 mg, 250 mg, 500 mg e 1000 mg.
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Peso</th>
                  <th>Idade aprox.</th>
                  <th>Xarope (120mg/5mL)</th>
                  <th>Supositório</th>
                  <th>Comprimido</th>
                </tr>
              </thead>
              <tbody>
                {DOSE_TABLE.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{row.peso}</td>
                    <td style={{ color: 'var(--ink-3)' }}>{row.idade}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.xarope}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.supositorio}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>{row.comp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', lineHeight: 1.6 }}>
            * Intervalo entre doses: mínimo 6 horas · Máximo 4 doses por dia · Máximo 5 dias sem reavaliação médica
          </div>
        </section>

        {/* Intervalos e duração */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
            Intervalos entre doses e duração do tratamento
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Intervalo mínimo', value: '6 horas', sub: 'Nunca dar antes de 6h após a última dose' },
              { label: 'Máximo por dia', value: '4 doses', sub: 'Mesmo que a febre não baixe' },
              { label: 'Duração máxima', value: '5 dias', sub: 'Sem reavaliação médica' },
              { label: 'Dose máxima/dia', value: '60 mg/kg', sub: 'Nunca exceder este valor' },
            ].map(item => (
              <div key={item.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 2 }}>{item.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Alertas */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
            Quando ir ao médico ou à urgência
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { severity: 'urgencia', text: 'Bebé com menos de 3 meses com temperatura ≥ 38°C — vai à urgência sem esperar' },
              { severity: 'urgencia', text: 'Criança com convulsão febril — urgência imediata' },
              { severity: 'urgencia', text: 'Suspeita de ingestão de dose excessiva (> 150 mg/kg) — urgência e liga ao CIAV 808 250 143' },
              { severity: 'medico', text: 'Febre > 39°C que não cede após 2 doses de paracetamol' },
              { severity: 'medico', text: 'Febre com mais de 3 dias de duração' },
              { severity: 'medico', text: 'Criança muito prostrada, recusa alimentação, ou com manchas na pele' },
            ].map((alert, i) => (
              <div key={i} className={`alert-strip alert-strip-${alert.severity === 'urgencia' ? 'red' : 'amber'}`}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: alert.severity === 'urgencia' ? 'var(--red)' : '#854d0e', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 8 }}>
                    {alert.severity === 'urgencia' ? 'Urgência' : 'Médico'}
                  </span>
                  <span style={{ fontSize: 13, color: alert.severity === 'urgencia' ? '#991b1b' : '#78350f', lineHeight: 1.5 }}>{alert.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ibuprofeno alternativa */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
            Paracetamol vs Ibuprofeno em crianças
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75, marginBottom: 12 }}>
            O ibuprofeno (Brufen, Nurofen) é uma alternativa válida a partir dos 6 meses de idade, com dose de 5–10 mg/kg cada 6–8 horas. Tem a vantagem de ser anti-inflamatório além de antipirético, o que pode ser útil em infecções com componente inflamatório.
          </p>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
            <strong>Nota importante:</strong> Nunca alternar ou combinar paracetamol e ibuprofeno sem indicação médica. Em crianças desidratadas, com varicela, ou com problemas renais, o ibuprofeno é contra-indicado. Em caso de dúvida, o paracetamol é sempre a escolha mais segura.
          </div>
        </section>

        {/* Disclaimer */}
        <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', lineHeight: 1.6 }}>
          ⚠️ Este artigo tem carácter informativo e não substitui a avaliação médica. Em caso de dúvida sobre a saúde do teu filho, consulta sempre um profissional de saúde.
        </div>

        {/* CTA final */}
        <div style={{ marginTop: 32, padding: '20px 22px', background: '#0f172a', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#f8fafc', marginBottom: 4 }}>Calculadora gratuita de dose pediátrica</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Insere o peso e o medicamento — a dose correcta em segundos</div>
          </div>
          <Link href="/dose-crianca"
            style={{ padding: '11px 22px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>
            Usar calculadora →
          </Link>
        </div>

        {/* Related */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Artigos relacionados</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { href: '/blog/ibuprofeno-varfarina', label: 'Ibuprofeno + Varfarina: uma combinação que mata', cat: 'Interações' },
              { href: '/blog', label: 'Ver todos os artigos', cat: 'Blog' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{a.cat}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{a.label}</div>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </div>
  )
}