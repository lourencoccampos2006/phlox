'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useState, useRef } from 'react'

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURED_TOOLS = [
  {
    href: '/interactions',
    tag: 'Grátis · Toda a gente',
    tagColor: 'var(--green)',
    title: 'Verificador de Interações',
    desc: 'Escreve o nome que está na caixa — Brufen, Voltaren, Xarelto. Reconhecemos automaticamente. Analisamos a interação com mecanismo, gravidade e recomendação.',
    demo: { drugs: ['Brufen (ibuprofeno)', 'Sintrom (acenocumarol)'], severity: 'GRAVE', result: 'Risco hemorrágico elevado. Evitar esta combinação.' },
  },
  {
    href: '/labs',
    tag: 'Grátis · Toda a gente',
    tagColor: 'var(--green)',
    title: 'Perceber as Análises',
    desc: 'Recebeste o PDF das análises mas não percebeste tudo? Faz upload ou cola os valores. Explicamos o que está fora do normal, o que significa, e o que perguntar ao médico.',
    demo: null,
  },
  {
    href: '/prescription',
    tag: 'Grátis · Foto incluída',
    tagColor: 'var(--green)',
    title: 'Explicador de Receita',
    desc: 'Tira foto à receita médica com o telemóvel. O Gemini lê a imagem e nós explicamos em linguagem simples para que serve cada medicamento, como tomar, e o que vigiar.',
    demo: null,
  },
  {
    href: '/compare',
    tag: 'Student',
    tagColor: '#7c3aed',
    title: 'Comparador de Fármacos',
    desc: 'Metoprolol vs bisoprolol? Sertralina vs escitalopram? Compara linha a linha — mecanismo, potência, semivida, efeitos adversos. Com dica de exame no fim.',
    demo: null,
  },
  {
    href: '/disease',
    tag: 'Student',
    tagColor: '#7c3aed',
    title: 'Fármacos por Diagnóstico',
    desc: 'Pesquisa pela doença — hipertensão, diabetes, fibrilhação auricular. Recebe 1ª e 2ª linha com doses reais, racional clínico, guideline fonte e dicas de exame.',
    demo: null,
  },
  {
    href: '/nursing',
    tag: 'Profissionais',
    tagColor: '#1d4ed8',
    title: 'Farmacotecnia IV · SC · IM',
    desc: 'Dois fármacos na mesma via? Concentração máxima? Estabilidade após diluição? Compatibilidade para seringa driver? Informação para profissionais — sem tutoriais básicos.',
    demo: null,
  },
  {
    href: '/ai',
    tag: 'Pro',
    tagColor: '#1d4ed8',
    title: 'Phlox AI',
    desc: 'Farmacologista clínico virtual. Questões complexas, análise de perfil farmacológico, fundamentação com evidência. Não um chatbot — um consultor especializado.',
    demo: null,
  },
  {
    href: '/vaccines',
    tag: 'Grátis · Toda a gente',
    tagColor: 'var(--green)',
    title: 'Verificador de Vacinas',
    desc: 'Selecciona o teu perfil — adulto, idoso, grávida, viajante, profissional de saúde. Verificamos que vacinas estão em falta e o que tomar antes de qualquer destino.',
    demo: null,
  },
]

const ALL_TOOLS = [
  { href: '/interactions',  label: 'Verificador de Interações',    plan: 'free',    who: 'Todos' },
  { href: '/labs',          label: 'Análises Clínicas',            plan: 'free',    who: 'Todos' },
  { href: '/prescription',  label: 'Explicador de Receita',        plan: 'free',    who: 'Todos' },
  { href: '/otc',           label: 'Guia de Automedicação',        plan: 'free',    who: 'Todos' },
  { href: '/drugs',         label: 'Base de Dados FDA',            plan: 'free',    who: 'Todos' },
  { href: '/safety',        label: 'Segurança do Medicamento',     plan: 'free',    who: 'Todos' },
  { href: '/vaccines',      label: 'Verificador de Vacinas',       plan: 'free',    who: 'Todos' },
  { href: '/quickcheck',    label: 'Análise Rápida de Lista',      plan: 'free',    who: 'Todos' },
  { href: '/mymeds',        label: 'A Minha Medicação',            plan: 'free',    who: 'Todos' },
  { href: '/study',         label: 'Flashcards e Quizzes',         plan: 'student', who: 'Estudantes' },
  { href: '/exam',          label: 'Modo Exame',                   plan: 'student', who: 'Estudantes' },
  { href: '/cases',         label: 'Casos Clínicos',               plan: 'student', who: 'Estudantes' },
  { href: '/compare',       label: 'Comparar Fármacos A vs B',     plan: 'student', who: 'Estudantes' },
  { href: '/disease',       label: 'Fármacos por Diagnóstico',     plan: 'student', who: 'Estudantes' },
  { href: '/ai',            label: 'Phlox AI',                     plan: 'pro',     who: 'Profissionais' },
  { href: '/nursing',       label: 'Farmacotecnia IV·SC·IM',       plan: 'free',    who: 'Profissionais' },
  { href: '/strategy',      label: 'Estratégias Terapêuticas',     plan: 'pro',     who: 'Profissionais' },
  { href: '/protocol',      label: 'Protocolo Terapêutico',        plan: 'pro',     who: 'Profissionais' },
  { href: '/briefing',      label: 'Briefing de Consulta',         plan: 'pro',     who: 'Profissionais' },
  { href: '/med-review',    label: 'Revisão de Medicação + PDF',   plan: 'pro',     who: 'Profissionais' },
  { href: '/calculators',   label: 'Calculadoras Clínicas',        plan: 'free',    who: 'Profissionais' },
  { href: '/monograph',     label: 'Monografia Clínica',           plan: 'free',    who: 'Profissionais' },
  { href: '/doses',         label: 'Posologia por Indicação',      plan: 'free',    who: 'Profissionais' },
  { href: '/compatibility', label: 'Compatibilidade IV',           plan: 'free',    who: 'Profissionais' },
  { href: '/dilutions',     label: 'Diluições IV',                 plan: 'free',    who: 'Profissionais' },
]

const PLAN_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  free:    { bg: 'var(--bg-3)', color: 'var(--ink-4)', label: 'Grátis' },
  student: { bg: '#f3e8ff', color: '#7c3aed', label: 'Student' },
  pro:     { bg: '#dbeafe', color: '#1d4ed8', label: 'Pro' },
}

const TESTIMONIALS = [
  {
    text: 'Tomei sempre brufen com o meu anticoagulante sem saber o risco. O Phlox explicou-me em dois segundos o que o meu médico nunca teve tempo de me explicar.',
    role: 'Reformado com fibrilhação auricular, 67 anos, Lisboa',
    plan: 'Gratuito',
  },
  {
    text: 'O modo exame é ao nível dos exames reais. Passei em Farmacologia com 17 depois de uma semana a usar. O comparador de fármacos é o que mais uso para perceber a lógica clínica.',
    role: 'Estudante de Medicina, 3.º ano, Faculdade de Medicina de Coimbra',
    plan: 'Student',
  },
  {
    text: 'Verifico as compatibilidades IV e SC todos os dias no serviço de oncologia. Antes ligava à farmácia para tudo. Agora resolvo em 10 segundos — e com mais confiança.',
    role: 'Enfermeira especialista, UCI de Oncologia, Hospital de Santa Maria',
    plan: 'Pro',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Pesquisa pelo nome da caixa',
    desc: 'Escreve Brufen, Voltaren ou Xarelto. Ou tira uma foto à caixa. Reconhecemos mais de 500 nomes comerciais portugueses e europeus.',
  },
  {
    step: '02',
    title: 'Recebe informação verificada',
    desc: 'Os dados vêm de fontes reguladas — FDA, RxNorm, NIH. A IA interpreta e explica em português, mas os factos são sempre verificados.',
  },
  {
    step: '03',
    title: 'Faz perguntas melhores ao médico',
    desc: 'O objectivo não é substituir o médico — é ajudares a chegar à consulta com as perguntas certas e a perceber as respostas.',
  },
]

const DIFFERENCES = [
  {
    title: 'Português europeu, de verdade',
    desc: 'Não é uma tradução automática do inglês. O conteúdo foi pensado para o sistema de saúde português, com terminologia clínica usada em Portugal.',
  },
  {
    title: 'Nome da caixa, não o nome científico',
    desc: 'Qualquer pessoa pode usar. Não precisas de saber que Brufen é ibuprofeno ou que Xarelto é rivaroxabano. Nós traduzimos automaticamente.',
  },
  {
    title: 'Foto funciona mesmo',
    desc: 'Tira foto à receita, à caixa, ou a um sintoma visível. O Gemini Vision analisa a imagem e nós interpretamos o resultado em português.',
  },
  {
    title: 'Para profissionais, sem paternalismo',
    desc: 'Médicos e enfermeiros não precisam de tutoriais básicos. A ferramenta de farmacotecnia não te ensina a dar uma injecção — dá-te os dados que realmente precisas.',
  },
  {
    title: 'Grátis sem truques',
    desc: 'As 9 ferramentas essenciais são gratuitas para sempre, sem registo obrigatório. Os planos pagos adicionam funcionalidades — não bloqueiam o que já existe.',
  },
  {
    title: 'Dados regulados, não opiniões',
    desc: 'OpenFDA, RxNorm, NIH, ECDC. A inteligência artificial interpreta informação verificada — não inventa respostas nem dá opiniões médicas.',
  },
]

const MINI_DEMO_INTERACTION = {
  drugs: ['ibuprofeno', 'varfarina'],
  severity: 'GRAVE',
  color: '#dc2626',
  bg: '#fef2f2',
  summary: 'Risco hemorrágico significativo — evitar esta combinação',
  mechanism: 'Ibuprofeno inibe plaquetas e lesa a mucosa gástrica, potenciando o efeito anticoagulante da varfarina',
  alternative: 'Paracetamol até 2g/dia — analgésico seguro com anticoagulantes orais',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const [toolsFilter, setToolsFilter] = useState<string>('Todos')
  const [activeStep, setActiveStep] = useState(0)
  const demoRef = useRef<HTMLDivElement>(null)

  const filteredTools = toolsFilter === 'Todos'
    ? ALL_TOOLS
    : ALL_TOOLS.filter(t => t.who === toolsFilter)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ══ HERO ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'white', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="page-container" style={{ paddingTop: 72, paddingBottom: 0 }}>
          <div className="hero-grid" style={{ alignItems: 'flex-start' }}>
            
            {/* Left: text */}
            <div style={{ paddingBottom: 64 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28, padding: '5px 14px 5px 10px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 24 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 500 }}>
                  Phlox Clinical · Plataforma farmacológica · PT-PT
                </span>
              </div>

              <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 24, fontWeight: 400 }}>
                Tens uma dúvida<br />
                sobre medicamentos.<br />
                <em style={{ color: 'var(--green)' }}>Nós respondemos.</em>
              </h1>

              <p style={{ fontSize: 18, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 36, maxWidth: 500, fontWeight: 400 }}>
                Verificar interações, perceber análises, interpretar receitas, estudar farmacologia — tudo em português europeu, tudo com dados verificados, tudo grátis para começar.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 48 }}>
                <Link href="/interactions" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: 'white', padding: '14px 26px', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Verificar interações
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/labs" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'var(--ink)', padding: '14px 26px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1.5px solid var(--border-2)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Perceber análises
                </Link>
              </div>

              {/* Trust signals */}
              <div style={{ display: 'flex', gap: 0, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxWidth: 480, marginBottom: 24 }}>
                {[
                  { value: '25+', label: 'ferramentas' },
                  { value: '500+', label: 'marcas PT' },
                  { value: 'FDA', label: 'dados base' },
                  { value: 'RGPD', label: 'compliant' },
                ].map(({ value, label }, i, arr) => (
                  <div key={label} style={{ flex: 1, padding: '12px 8px', textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--green)', fontStyle: 'italic', fontWeight: 400, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                    <div style={{ fontSize: 9, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.3 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: live demo */}
            <div className="hero-card" ref={demoRef} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px 12px 0 0', overflow: 'hidden', boxShadow: '0 -4px 40px rgba(0,0,0,0.06), 0 20px 40px rgba(0,0,0,0.04)', marginTop: 24, alignSelf: 'flex-end' }}>
              {/* Demo header */}
              <div style={{ background: 'var(--ink)', padding: '16px 20px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    Verificador de Interações
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {MINI_DEMO_INTERACTION.drugs.map(d => (
                    <span key={d} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 6, letterSpacing: '-0.01em' }}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Demo result */}
              <div style={{ padding: '18px 20px' }}>
                <div style={{ background: MINI_DEMO_INTERACTION.bg, borderLeft: `3px solid ${MINI_DEMO_INTERACTION.color}`, padding: '12px 14px', borderRadius: '0 6px 6px 0', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: MINI_DEMO_INTERACTION.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {MINI_DEMO_INTERACTION.severity}
                  </div>
                  <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>{MINI_DEMO_INTERACTION.summary}</div>
                </div>
                
                {[
                  { label: 'Mecanismo', value: MINI_DEMO_INTERACTION.mechanism },
                  { label: 'Alternativa', value: MINI_DEMO_INTERACTION.alternative },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '88px 1fr', padding: '9px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingTop: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{value}</div>
                  </div>
                ))}

                <Link href="/interactions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, padding: '11px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Verificar os meus medicamentos
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ COMO FUNCIONA ══════════════════════════════════════════════════════ */}
      <section style={{ padding: '60px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ marginBottom: 40, maxWidth: 500 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Como funciona</div>
            <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400 }}>
              Simples. Sem jargão.
            </h2>
          </div>
          <div className="card-grid-3" style={{ gap: 12 }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} style={{ background: 'white', border: '1px solid var(--border)', borderTop: `3px solid ${i === 0 ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, padding: '24px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 14 }}>{step.step}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FERRAMENTAS EM DESTAQUE ════════════════════════════════════════════ */}
      <section style={{ padding: '60px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Ferramentas em destaque</div>
              <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400 }}>O que podes fazer aqui</h2>
            </div>
            <Link href="/pricing" style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em' }}>
              Ver todos os planos →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {FEATURED_TOOLS.map(tool => (
              <Link key={tool.href} href={tool.href}
                style={{ display: 'flex', flexDirection: 'column', padding: '24px', background: 'white', textDecoration: 'none', minHeight: 180 }}
                className="featured-tool">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{tool.title}</h3>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: tool.tagColor, border: `1px solid ${tool.tagColor}`, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0, opacity: 0.8 }}>
                    {tool.tag}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, flex: 1 }}>{tool.desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 14, fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Aceder
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TODAS AS FERRAMENTAS ═══════════════════════════════════════════════ */}
      <section style={{ padding: '60px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Plataforma completa</div>
              <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400 }}>Todas as ferramentas</h2>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['Todos', 'Todos', 'Estudantes', 'Profissionais'].filter((v, i, arr) => arr.indexOf(v) === i).map(f => (
                <button key={f} onClick={() => setToolsFilter(f)}
                  style={{ padding: '6px 14px', border: `1.5px solid ${toolsFilter === f ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 20, background: toolsFilter === f ? 'var(--ink)' : 'white', color: toolsFilter === f ? 'white' : 'var(--ink-3)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {filteredTools.map(tool => {
              const planStyle = PLAN_COLORS[tool.plan]
              return (
                <Link key={tool.href} href={tool.href}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'white', textDecoration: 'none', gap: 12 }}
                  className="tool-row">
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{tool.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: planStyle.color, background: planStyle.bg, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {planStyle.label}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </Link>
              )
            })}
          </div>
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <Link href="/pricing" style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em' }}>
              Ver preços e diferenças entre planos →
            </Link>
          </div>
        </div>
      </section>

      {/* ══ O QUE NOS DIFERENCIA ══════════════════════════════════════════════ */}
      <section style={{ padding: '60px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Porquê o Phlox</div>
            <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400, maxWidth: 480 }}>
              Não é mais um site de saúde.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {DIFFERENCES.map((d, i) => (
              <div key={d.title} style={{ padding: '28px', background: i % 2 === 0 ? 'white' : 'var(--bg-2)' }}>
                <div style={{ width: 24, height: 2, background: 'var(--green)', marginBottom: 16 }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{d.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0 }}>{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTEMUNHOS ═══════════════════════════════════════════════════════ */}
      <section style={{ padding: '60px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 32, textAlign: 'center' }}>O que dizem os utilizadores</div>
          <div className="testimonials-grid">
            {TESTIMONIALS.map(({ text, role, plan }) => (
              <div key={role} style={{ padding: '28px', border: '1px solid var(--border)', borderRadius: 10, background: 'white', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1,2,3,4,5].map(i => <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                  </div>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: plan === 'Gratuito' ? 'var(--ink-4)' : plan === 'Student' ? '#7c3aed' : '#1d4ed8', background: plan === 'Gratuito' ? 'var(--bg-3)' : plan === 'Student' ? '#f3e8ff' : '#dbeafe', padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {plan}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, margin: 0, flex: 1 }}>&ldquo;{text}&rdquo;</p>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', paddingTop: 14, borderTop: '1px solid var(--border)', lineHeight: 1.5 }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PREÇOS RESUMO ═════════════════════════════════════════════════════ */}
      <section style={{ padding: '60px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Preços</div>
            <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400, marginBottom: 10 }}>Começa grátis. Escala quando precisares.</h2>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', maxWidth: 400, margin: '0 auto' }}>As ferramentas essenciais são gratuitas para sempre. Os planos pagos adicionam — não bloqueiam.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 12, maxWidth: 900, margin: '0 auto', marginBottom: 24 }}>
            {[
              { name: 'Gratuito', price: '0€', desc: '9 ferramentas essenciais', color: 'var(--ink-3)', href: '/login' },
              { name: 'Student', price: '3,99€/mês', desc: 'Flashcards, exame, casos, comparador', color: '#7c3aed', href: '/pricing' },
              { name: 'Pro', price: '12,99€/mês', desc: 'Phlox AI, protocolos, revisão PDF', color: '#1d4ed8', href: '/pricing', highlight: true },
              { name: 'Clínica', price: '49€/mês', desc: '10 utilizadores + API + suporte', color: 'var(--green)', href: '/pricing' },
            ].map(plan => (
              <Link key={plan.name} href={plan.href}
                style={{ display: 'flex', flexDirection: 'column', padding: '20px', background: 'white', border: `2px solid ${(plan as any).highlight ? plan.color : 'var(--border)'}`, borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s' }}
                className="plan-card">
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: plan.color, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{plan.name}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontStyle: 'italic', fontWeight: 400, marginBottom: 6 }}>{plan.price}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{plan.desc}</div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <Link href="/pricing" style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em' }}>
              Ver comparação completa dos planos →
            </Link>
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL ═════════════════════════════════════════════════════════ */}
      <section style={{ padding: '80px 0', background: 'var(--ink)' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 5vw, 44px)', color: 'white', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15, fontWeight: 400 }}>
            Começa agora.<br />
            <em style={{ color: 'rgba(255,255,255,0.45)' }}>É grátis e não precisa de registo.</em>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginBottom: 36, lineHeight: 1.7 }}>
            As 9 ferramentas essenciais funcionam imediatamente, sem conta, sem cartão de crédito.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <Link href="/interactions" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '14px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Verificar interações — grátis
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', padding: '14px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Ver planos
            </Link>
          </div>
          {/* Final social proof */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {['RGPD Compliant', 'OpenFDA · RxNorm · NIH', 'PT-PT · Português Europeu'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer style={{ background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '52px 0 36px' }}>
        <div className="page-container">
          <div className="footer-grid">
            <div>
              <div style={{ marginBottom: 14 }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="var(--green)"/><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 6 }}>PHLOX CLINICAL</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.8, maxWidth: 200 }}>
                Plataforma farmacológica clínica em português. Dados FDA, RxNorm e NIH.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>Ferramentas</div>
              {[['Verificar Interações', '/interactions'], ['Perceber Análises', '/labs'], ['Automedicação', '/otc'], ['Explicar Receita', '/prescription'], ['Vacinas', '/vaccines'], ['Phlox AI', '/ai']].map(([l, h]) => (
                <Link key={h} href={h} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 9 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>Empresa</div>
              {[['Sobre', '/about'], ['Preços', '/pricing'], ['Blog', '/blog'], ['API', '/api-docs'], ['Privacidade', '/privacy'], ['Termos', '/terms']].map(([l, h]) => (
                <Link key={h} href={h} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 9 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>Contacto</div>
              <a href="mailto:hello@phlox-clinical.com" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 9 }}>
                hello@phlox-clinical.com
              </a>
              <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-mono)', lineHeight: 1.9 }}>
                OpenFDA · RxNorm · NIH<br />ECDC · DGS · PNV<br />RGPD Compliant
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.16)', fontFamily: 'var(--font-mono)' }}>
              © 2026 Phlox Clinical. Informação educacional — não substitui aconselhamento médico profissional.
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.16)', fontFamily: 'var(--font-mono)' }}>
              phlox-clinical.com · PT-PT
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        .featured-tool:hover { background: var(--bg-2) !important; }
        .featured-tool:hover h3 { color: var(--green) !important; }
        .tool-row:hover { background: var(--bg-2) !important; }
        .plan-card:hover { border-color: var(--green) !important; }
      `}</style>
    </div>
  )
}