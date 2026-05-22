// app/blog/interacoes-comuns-a-evitar/page.tsx
// Artigo SEO de alto volume — "interações medicamentosas comuns portugal"
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'As 10 Interações Medicamentosas Mais Comuns em Portugal (2026) | Phlox Clinical',
  description: 'Varfarina + AINEs, estatinas + antibióticos, antidepressivos + tramadol — as 10 combinações perigosas mais comuns em Portugal. Com alternativas seguras e fontes INFARMED/FDA.',
  keywords: 'interações medicamentosas portugal, varfarina ibuprofeno, estatinas antibioticos, interações perigosas medicamentos, farmacologia clínica',
  openGraph: {
    title: 'As 10 Interações Medicamentosas Mais Comuns em Portugal',
    description: 'As combinações de medicamentos que causam mais problemas em Portugal. Mecanismo, risco e alternativas.',
    type: 'article',
  },
  alternates: { canonical: 'https://phloxclinical.com/blog/interacoes-comuns-a-evitar' },
}

const INTERACTIONS = [
  {
    rank: 1,
    pair: 'Varfarina + AINEs (Ibuprofeno, Naproxeno)',
    severity: 'GRAVE',
    sevColor: '#dc2626',
    sevBg: '#fee2e2',
    mechanism: 'Os AINEs inibem a COX-1 plaquetária (reduz agregação) e podem deslocar a varfarina da albumina, aumentando a fracção livre. O resultado é aumento do INR e risco de hemorragia gastrointestinal ou intracraniana.',
    risk: 'Risco de hemorragia grave 3–15× superior ao basal. Um dos principais motivos de admissão hospitalar por reacção adversa em Portugal.',
    alternative: 'Paracetamol (com cautela — altas doses também afectam ligeiramente o INR) · AINE tópico para dor localizada · Tramadol (com precaução)',
    source: 'INFARMED · FDA Drug Safety Communication · Lexicomp',
  },
  {
    rank: 2,
    pair: 'Sertralina/Fluoxetina + Tramadol',
    severity: 'GRAVE',
    sevColor: '#92400e',
    sevBg: '#fff7ed',
    mechanism: 'Ambos aumentam a serotonina a nível central: os ISRS bloqueiam o recaptador (SERT) e o tramadol tem actividade serotoninérgica intrínseca. A combinação pode causar síndrome serotoninérgica — hipertermia, clonus, agitação, instabilidade autonómica.',
    risk: 'Síndrome serotoninérgica é potencialmente fatal. Início em horas após a toma. Mais frequente com fluoxetina (semivida longa) e paroxetina.',
    alternative: 'Para dor crónica: paracetamol, AINE tópico, gabapentina · Para dor aguda: paracetamol + codeína (com precaução) · Evitar opióides com acção serotoninérgica',
    source: 'FDA Drug Safety Communication 2010 · UpToDate · Micromedex',
  },
  {
    rank: 3,
    pair: 'Atorvastatina/Sinvastatina + Claritromicina',
    severity: 'GRAVE',
    sevColor: '#7c2d12',
    sevBg: '#fff7ed',
    mechanism: 'A claritromicina é um potente inibidor do CYP3A4, a enzima que metaboliza a maioria das estatinas. A inibição aumenta a AUC da atorvastatina em 3–4× e da sinvastatina até 10×. Níveis elevados de estatina causam miopatia e, nos casos graves, rabdomiólise.',
    risk: 'Risco de rabdomiólise com insuficiência renal aguda secundária. A sinvastatina tem maior risco que a atorvastatina por maior metabolismo hepático.',
    alternative: 'Suspender a estatina durante o ciclo de antibiótico (5–7 dias) · Ou usar estatina não metabolizada pelo CYP3A4: rosuvastatina, pravastatina, fluvastatina',
    source: 'EMA · INFARMED RCM Sinvastatina · ESC Guidelines Dyslipidaemia 2019',
  },
  {
    rank: 4,
    pair: 'Metformina + Contraste Iodado IV',
    severity: 'MODERADA',
    sevColor: '#1e40af',
    sevBg: '#eff6ff',
    mechanism: 'O contraste iodado pode causar deterioração aguda da função renal. A metformina elimina-se exclusivamente por via renal — com IR, acumula-se e inibe o complexo I mitocondrial, produzindo acidose láctica.',
    risk: 'Acidose láctica é rara mas com mortalidade elevada (>50%). O risco é maior em doentes com função renal borderline, IC, ou dose elevada de contraste.',
    alternative: 'Suspender metformina 48h antes e após contraste IV · Retomar apenas com TFG confirmada estável · Verificar TFG antes do exame',
    source: 'ESUR Guidelines Contrast Media 2023 · INFARMED · Sociedade Portuguesa de Radiologia',
  },
  {
    rank: 5,
    pair: 'IECAs/ARA-II + Espironolactona',
    severity: 'MODERADA',
    sevColor: '#1e40af',
    sevBg: '#eff6ff',
    mechanism: 'Ambos aumentam o potássio: os IECAs/ARA-II reduzem a aldosterona (↓ excreção de K+) e a espironolactona bloqueia directamente os receptores mineralocorticóides. Efeito aditivo → hipercaliemia.',
    risk: 'Hipercaliemia com risco de arritmias graves e paragem cardíaca. Risco aumentado com IR, diabetes, ou dose elevada de espironolactona.',
    alternative: 'Monitorizar K+ e creatinina no início e a cada 3 meses · Reduzir dose de espironolactona · Verificar outras fontes de K+ (suplementos, substitutos de sal)',
    source: 'ESC Heart Failure Guidelines 2021 · INFARMED · BMJ Evidence',
  },
  {
    rank: 6,
    pair: 'Hipericão (Erva de São João) + Anticontraceptivos Orais',
    severity: 'GRAVE',
    sevColor: '#dc2626',
    sevBg: '#fee2e2',
    mechanism: 'O hipericão é um indutor potente do CYP3A4 e da P-glicoproteína. Aumenta o metabolismo dos estrogénios e progestagénios, reduzindo as concentrações plasmáticas em 50% ou mais.',
    risk: 'Falha contraceptiva com gravidez não planeada. Documentados vários casos. Também afecta anticoncepcionais de emergência.',
    alternative: 'Suspender o hipericão · Usar método contraceptivo de barreira adicional durante e até 2 ciclos após suspensão',
    source: 'INFARMED Circular Informativa · EMA Safety Assessment · NICE CKS',
  },
  {
    rank: 7,
    pair: 'Amiodarona + Varfarina',
    severity: 'GRAVE',
    sevColor: '#dc2626',
    sevBg: '#fee2e2',
    mechanism: 'A amiodarona e os seus metabolitos inibem o CYP2C9 (metabolismo da varfarina-S, a mais potente) e o CYP3A4. O INR pode duplicar ou triplicar. O efeito persiste semanas a meses após parar a amiodarona pela sua semivida extremamente longa (40–55 dias).',
    risk: 'Hemorragia grave. O aumento do INR pode demorar 1–4 semanas a ser máximo. Monitorização insuficiente causa eventos hemorrágicos graves.',
    alternative: 'Reduzir a dose de varfarina em 30–50% ao iniciar amiodarona · Monitorizar INR semanalmente nas primeiras 4–6 semanas · Considerar NOAC se elegível',
    source: 'INFARMED RCM Amiodarona · AHA/ACC Guidelines · Lexicomp',
  },
  {
    rank: 8,
    pair: 'Alopurinol + Azatioprina/Mercaptopurina',
    severity: 'GRAVE',
    sevColor: '#dc2626',
    sevBg: '#fee2e2',
    mechanism: 'O alopurinol inibe a xantina oxidase, a enzima que inactiva a mercaptopurina e a azatioprina (convertida em mercaptopurina). A inibição aumenta os níveis plasmáticos em 4× ou mais, causando toxicidade medular grave.',
    risk: 'Mielossupressão severa: neutropenia, trombocitopenia, anemia aplástica. Pode ser fatal.',
    alternative: 'Evitar a combinação sempre que possível · Se necessário, reduzir a dose de azatioprina/mercaptopurina para 25% · Monitorizar hemograma semanalmente',
    source: 'INFARMED · BNF · Micromedex',
  },
  {
    rank: 9,
    pair: 'Fluconazol + Estatinas (Sinvastatina)',
    severity: 'MODERADA',
    sevColor: '#1e40af',
    sevBg: '#eff6ff',
    mechanism: 'O fluconazol inibe o CYP3A4 e CYP2C9. A inibição do CYP3A4 aumenta significativamente os níveis de sinvastatina e lovastatina. O fluconazol também potencia o efeito da varfarina por inibição do CYP2C9.',
    risk: 'Miopatia e risco de rabdomiólise com sinvastatina. Com varfarina, risco de hemorragia grave.',
    alternative: 'Suspender sinvastatina/lovastatina durante o tratamento com fluconazol · Alternativa: usar rosuvastatina (não afectada pelo CYP3A4)',
    source: 'INFARMED · FDA Safety Communication · Clinical Pharmacokinetics',
  },
  {
    rank: 10,
    pair: 'Digoxina + Amiodarona/Verapamilo/Claritromicina',
    severity: 'GRAVE',
    sevColor: '#dc2626',
    sevBg: '#fee2e2',
    mechanism: 'Amiodarona e verapamilo inibem a P-gp e reduzem a clearance renal da digoxina, duplicando ou triplicando os níveis. A claritromicina inibe a P-gp intestinal, aumentando a absorção. Qualquer aumento da digoxinémia pode causar toxicidade.',
    risk: 'Toxicidade digitálica: náuseas, alterações visuais (halos amarelos/verdes), bradiarritmias, taquiarritmia ventricular, bloqueio AV.',
    alternative: 'Reduzir dose de digoxina em 50% ao iniciar amiodarona · Monitorizar digoxinémia e ECG · Considerar alternativa ao verapamilo',
    source: 'INFARMED RCM Digoxina · ESC Guidelines AF 2020 · Lexicomp',
  },
]

function Schema() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "As 10 Interações Medicamentosas Mais Comuns em Portugal",
    "description": "Varfarina, estatinas, antibióticos, antidepressivos — as combinações perigosas mais frequentes em Portugal com mecanismo, risco e alternativas.",
    "author": { "@type": "Organization", "name": "Phlox Clinical" },
    "publisher": { "@type": "Organization", "name": "Phlox Clinical", "url": "https://phloxclinical.com" },
    "datePublished": "2026-01-15",
    "dateModified": "2026-01-15",
    "url": "https://phloxclinical.com/blog/interacoes-comuns-a-evitar",
    "mainEntityOfPage": "https://phloxclinical.com/blog/interacoes-comuns-a-evitar",
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
}

export default function BlogInteracoesPage() {
  return (
    <>
      <Schema />
      <article>
        {/* Hero */}
        <div style={{ background: '#0f172a', padding: '56px 0 48px' }}>
          <div className="page-container" style={{ maxWidth: 780 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Interações</span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569' }}>8 min · Actualizado Janeiro 2026</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.5vw,40px)', color: '#f8fafc', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 18 }}>
              As 10 Interações Medicamentosas<br />Mais Comuns em Portugal
            </h1>
            <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, maxWidth: 640 }}>
              As combinações de medicamentos que causam mais internamentos por reacção adversa em Portugal. Com mecanismo farmacológico, risco real e alternativas terapêuticas seguras.
            </p>
          </div>
        </div>

        <div className="page-container page-body" style={{ maxWidth: 780 }}>
          {/* Intro */}
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderLeft: '4px solid #dc2626', borderRadius: 8, padding: '16px 20px', marginBottom: 36 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Nota clínica importante</div>
            <p style={{ fontSize: 14, color: '#991b1b', lineHeight: 1.7, margin: 0 }}>
              As interações abaixo são baseadas em dados FDA, INFARMED e EMA. A gravidade depende sempre do doente específico — dose, função renal, comorbilidades e outros fármacos. Em caso de dúvida, consulta sempre um farmacêutico ou médico.
            </p>
          </div>

          {/* CTA ferramentas */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Verifica as interações da tua medicação</div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Ferramenta gratuita — sem conta, sem limite. Dados RxNorm/NIH com análise AI e mecanismo CYP450.</div>
            </div>
            <Link href="/interactions"
              style={{ padding: '10px 22px', background: '#dc2626', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              Verificar agora →
            </Link>
          </div>

          {/* Interactions list */}
          {INTERACTIONS.map((inter, idx) => (
            <div key={inter.rank} style={{ marginBottom: 40, paddingBottom: 40, borderBottom: idx < INTERACTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: inter.sevBg, border: `1px solid ${inter.sevColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: inter.sevColor, flexShrink: 0 }}>
                  {inter.rank}
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', fontWeight: 400, lineHeight: 1.25, marginBottom: 6, letterSpacing: '-0.01em' }}>{inter.pair}</h2>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: inter.sevColor, background: inter.sevBg, padding: '2px 8px', borderRadius: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{inter.severity}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Mecanismo', value: inter.mechanism, color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
                  { label: 'Risco clínico', value: inter.risk, color: inter.sevColor, bg: inter.sevBg, border: `${inter.sevColor}40` },
                  { label: 'Alternativa segura', value: inter.alternative, color: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0' },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`, borderRadius: 7, padding: '12px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>{label}</div>
                    <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7, margin: 0 }}>{value}</p>
                  </div>
                ))}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', paddingLeft: 4 }}>
                  Fonte: {inter.source}
                </div>
              </div>
            </div>
          ))}

          {/* Bottom CTA */}
          <div style={{ background: '#0f172a', borderRadius: 12, padding: '36px', textAlign: 'center', marginTop: 20 }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#f8fafc', fontWeight: 400, marginBottom: 12 }}>Verifica a tua medicação completa</h3>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
              O Phlox verifica interações entre todos os teus medicamentos em simultâneo — incluindo mecanismo CYP450, alternativas e instruções para o doente.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/interactions"
                style={{ padding: '11px 24px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                Verificar interações →
              </Link>
              <Link href="/blog"
                style={{ padding: '11px 20px', background: 'transparent', color: '#64748b', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid #334155' }}>
                Mais artigos
              </Link>
            </div>
          </div>
        </div>
      </article>
    </>
  )
}