import Header from '@/components/Header'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre o Phlox — Plataforma Farmacológica Clínica',
  description: 'O Phlox é uma plataforma farmacológica all-in-one criada por estudantes de farmácia para profissionais e estudantes de saúde.',
}

const STATS = [
  { value: '10.000+', label: 'Medicamentos indexados' },
  { value: '5', label: 'Ferramentas clínicas' },
  { value: '3', label: 'Bases de dados oficiais' },
  { value: '100%', label: 'Gratuito para começar' },
]

const SOURCES = [
  { name: 'OpenFDA', desc: 'Base de dados oficial da FDA — informação de bulas, efeitos adversos e farmacovigilância', href: 'https://open.fda.gov' },
  { name: 'RxNorm / NIH', desc: 'Base de dados de nomenclatura e interações medicamentosas do National Institutes of Health', href: 'https://www.nlm.nih.gov/research/umls/rxnorm' },
  { name: 'Groq / Llama 3.3', desc: 'IA de análise clínica — usada apenas quando as bases de dados oficiais não têm dados suficientes', href: 'https://groq.com' },
]

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--border)', padding: '72px 40px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--green-2)', textTransform: 'uppercase', marginBottom: 20 }}>
            Sobre o Phlox
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 48, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 24 }}>
            Informação farmacológica rigorosa,<br />
            <em style={{ fontStyle: 'italic', color: 'var(--green-2)' }}>acessível a todos.</em>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 16 }}>
            O Phlox nasceu da frustração de estudantes de farmácia e medicina que precisavam de uma ferramenta 
            rápida, fiável e gratuita para verificar interações medicamentosas e consultar informação clínica — 
            sem anúncios intrusivos, sem paywalls para informação básica, sem interfaces confusas.
          </p>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8 }}>
            Construído sobre dados públicos e verificados de agências regulatórias, o Phlox é uma ferramenta 
            de apoio à decisão clínica — nunca um substituto ao julgamento profissional.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '48px 40px', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {STATS.map(({ value, label }) => (
              <div key={label} style={{ background: 'var(--bg)', padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>{value}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section style={{ padding: '64px 40px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', marginBottom: 24, letterSpacing: '-0.01em' }}>
            O nosso compromisso
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { title: 'Dados verificados', text: 'Toda a informação clínica provém de bases de dados oficiais — FDA, NIH, e RxNorm. A IA é usada apenas como fallback quando os dados oficiais não cobrem uma combinação específica, e isso é sempre indicado ao utilizador.' },
              { title: 'Privacidade primeiro', text: 'Não vendemos dados pessoais. O histórico de pesquisas pertence ao utilizador. Os dados de uso são anonimizados e agregados. Compliance total com o RGPD.' },
              { title: 'Ferramenta, não substituto', text: 'O Phlox é uma ferramenta de apoio à decisão clínica. Nunca substitui a consulta de um médico, farmacêutico ou outro profissional de saúde qualificado. Cada página tem este aviso de forma clara.' },
              { title: 'Gratuito para o essencial', text: 'As ferramentas core — verificador de interações, base de dados de medicamentos e calculadoras básicas — são e serão sempre gratuitas. Os planos pagos financiam o desenvolvimento de funcionalidades avançadas.' },
            ].map(({ title, text }) => (
              <div key={title} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, padding: '20px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green-2)', fontWeight: 600, paddingTop: 2 }}>{title}</div>
                <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section style={{ padding: '64px 40px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Fontes de dados
          </h2>
          <p style={{ fontSize: 15, color: 'var(--ink-4)', marginBottom: 32, lineHeight: 1.6 }}>
            Toda a informação clínica provém de fontes públicas, verificadas e reguladas.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {SOURCES.map(({ name, desc, href }) => (
              <div key={name} style={{ background: 'white', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{name}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.5 }}>{desc}</div>
                </div>
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', paddingTop: 2 }}>
                  Ver fonte →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 40px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
            Pronto para começar?
          </h2>
          <p style={{ fontSize: 15, color: 'var(--ink-4)', marginBottom: 32, lineHeight: 1.6 }}>
            As ferramentas core são gratuitas e não precisam de registo.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/interactions" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
              Verificar interações
            </Link>
            <Link href="/login" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 500, border: '1px solid var(--border-2)' }}>
              Criar conta gratuita
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}