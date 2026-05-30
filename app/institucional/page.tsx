import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Phlox Clinical Institucional — Para Farmácias, Hospitais e Clínicas',
  description: 'A plataforma farmacológica colaborativa para equipas de saúde. Ward, Connect, Rounds, PCNE, passagem de turno. 89€/mês por instituição, utilizadores ilimitados.',
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill={color} style={{ flexShrink: 0, marginTop: 2 }}>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
    </svg>
  )
}

const INSTITUTION_TYPES = [
  {
    title: 'Farmácia Comunitária',
    color: '#0d6e42',
    challenge: 'Os doentes chegam com receitas que ninguém explicou, medicação de múltiplos médicos sem ninguém a coordenar, e o farmacêutico tem 3 minutos por doente.',
    solution: 'Phlox Ward cria uma ficha por doente que toda a equipa actualiza. O Connect permite comunicar directamente com o médico prescritor. O Rounds gera o relatório de intervenção PCNE automaticamente.',
    tools: ['Phlox Ward por doente', 'Phlox Connect → Médico', 'Phlox Rounds + PCNE', 'Care Plan imprimível', 'Monitor de adesão'],
  },
  {
    title: 'Hospital / Serviço Clínico',
    color: '#1d4ed8',
    challenge: 'A passagem de turno é feita de forma verbal ou em papel. A informação perde-se entre turnos. O farmacêutico faz ronda mas não tem sistema para registar intervenções.',
    solution: 'O Ward centraliza tudo por doente — notas de enfermagem, decisões médicas, parâmetros, alertas. A passagem de turno é gerada automaticamente por AI. O Rounds substitui o Excel de intervenções PCNE.',
    tools: ['Phlox Ward multi-equipa', 'Passagem de turno automática', 'Phlox Rounds + relatório PCNE', 'Phlox Connect inter-serviços', 'MAR digital por turno'],
  },
  {
    title: 'Clínica Médica / Centro de Saúde',
    color: '#7c3aed',
    challenge: 'Os doentes vêm com medicação de outros especialistas, os médicos não têm tempo para rever tudo, e a reconciliação medicamentosa não é feita sistematicamente.',
    solution: 'O Phlox Consulta faz o copiloto da consulta — briefing antes, registo depois. O Care Plan garante que o doente percebe o que muda. O Connect permite comunicação entre médico e farmacêutico da clínica.',
    tools: ['Phlox Consulta bidirecional', 'Reconciliação medicamentosa', 'Care Plan por doente', 'Phlox Connect interno', 'Análise de correlações temporais'],
  },
  {
    title: 'Lar / IPSS',
    color: '#b45309',
    challenge: 'Múltiplos residentes polimedicados, diferentes cuidadores em turnos diferentes, sem sistema de registo centralizado. A passagem de turno é uma folha A4 à mão.',
    solution: 'Um Ward por residente. Cada cuidador regista em tempo real. Passagem de turno gerada automaticamente. Calendários de toma imprimíveis. Alertas de interações automáticos para todos os residentes.',
    tools: ['Phlox Ward por residente', 'Calendário de toma imprimível', 'Passagem de turno automática', 'Monitor de adesão', 'Alertas de interações automáticos'],
  },
]

const COMPARISON_ITEMS = [
  { label: 'EHR Hospitalar (ex: Glintt, Alert)',   price: '€50.000–500.000/ano',   phlox: '89€/mês',    highlight: true },
  { label: 'Software de gestão de farmácia',        price: '150–500€/mês',           phlox: '89€/mês',    highlight: false },
  { label: 'Sistema de passagem de turno',          price: 'Não existe acessível',   phlox: 'Incluído',   highlight: true },
  { label: 'Registo de intervenções PCNE',          price: 'Excel manual',           phlox: 'Incluído',   highlight: false },
  { label: 'Comunicação inter-profissional',        price: 'WhatsApp pessoal',       phlox: 'Incluído',   highlight: true },
  { label: 'Utilizadores incluídos',                price: 'Por utilizador',          phlox: 'Ilimitados', highlight: false },
]

export default function InstitucionalPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>


      {/* Hero */}
      <section style={{ background: '#0f172a', padding: '72px 0 64px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
        <div className="page-container" style={{ position: 'relative' }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1e293b', border: '1px solid #334155', borderRadius: 4, padding: '4px 12px', marginBottom: 24 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#64748b', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Para instituições</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,48px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 20 }}>
              A alternativa acessível<br />
              ao EHR que ninguém consegue pagar.
            </h1>
            <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.75, maxWidth: 580, marginBottom: 36 }}>
              Ward colaborativo. Passagem de turno automática. Registo PCNE. Comunicação inter-profissional estruturada. Por 89€/mês para toda a equipa — sem limite de utilizadores.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/checkout?plan=clinic"
                style={{ padding: '13px 28px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, letterSpacing: '0.01em', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Ativar plano Institucional →
              </Link>
              <Link href="/login"
                style={{ padding: '13px 22px', background: 'transparent', color: '#64748b', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid #334155' }}>
                Experimentar grátis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Price callout */}
      <div style={{ background: '#0d6e42', padding: '16px 0' }}>
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'white', fontWeight: 400 }}>89€</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>/mês · utilizadores ilimitados · sem fidelização</span>
          </div>
          <Link href="/checkout?plan=clinic"
            style={{ fontSize: 13, fontWeight: 700, color: 'white', textDecoration: 'none', fontFamily: 'var(--font-sans)', padding: '8px 18px', background: 'rgba(255,255,255,0.15)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)' }}>
            Começar →
          </Link>
        </div>
      </div>

      {/* Institution types */}
      <section style={{ padding: '72px 0', background: 'var(--bg)' }}>
        <div className="page-container">
          <div style={{ marginBottom: 48 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Onde é usado</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.015em', lineHeight: 1.2 }}>
              O problema é diferente em cada instituição.<br />A solução adapta-se.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,480px),1fr))', gap: 12 }}>
            {INSTITUTION_TYPES.map(inst => (
              <div key={inst.title} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: 3, background: inst.color }} />
                <div style={{ padding: '22px 22px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: inst.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>{inst.title}</div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>O problema hoje</div>
                    <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{inst.challenge}</p>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: inst.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>O que o Phlox resolve</div>
                    <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, margin: 0 }}>{inst.solution}</p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {inst.tools.map(t => (
                        <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: inst.color, background: `${inst.color}10`, border: `1px solid ${inst.color}25`, padding: '3px 9px', borderRadius: 3 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section style={{ padding: '72px 0', background: 'white', borderTop: '1px solid var(--border)' }}>
        <div className="page-container" style={{ maxWidth: 720 }}>
          <div style={{ marginBottom: 40 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Comparação</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.015em' }}>
              O que o mercado cobra.<br />O que o Phlox cobra.
            </h2>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 140px', background: 'var(--bg-2)', padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Funcionalidade / Alternativa</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Mercado actual</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Phlox</div>
            </div>
            {COMPARISON_ITEMS.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 200px 140px', padding: '13px 18px', borderBottom: i < COMPARISON_ITEMS.length - 1 ? '1px solid var(--bg-3)' : 'none', background: item.highlight ? 'var(--bg)' : 'white', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: item.highlight ? 600 : 400 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{item.price}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0d6e42', fontFamily: 'var(--font-mono)' }}>{item.phlox}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.6 }}>
            * Preços de mercado são estimativas públicas. O Phlox não é um EHR completo — é uma camada de comunicação e farmacologia clínica que complementa sistemas existentes.
          </div>
        </div>
      </section>

      {/* Onboarding process */}
      <section style={{ padding: '72px 0', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <div className="page-container" style={{ maxWidth: 620 }}>
          <div style={{ marginBottom: 40 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Como funciona</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.015em' }}>
              Em produção em 48 horas.
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { step: '01', title: 'Contacto e demo', desc: 'Marcamos uma demo de 30 minutos adaptada ao teu contexto — farmácia, hospital, clínica ou lar. Sem compromisso.' },
              { step: '02', title: 'Configuração da equipa', desc: 'Criamos a conta institucional, adicionamos todos os membros da equipa com os seus papéis (médico, farmacêutico, enfermeiro), e configuramos os primeiros doentes ou utentes.' },
              { step: '03', title: 'Onboarding em 1 hora', desc: 'Sessão de formação com toda a equipa — Ward, Connect, Rounds. A maioria das pessoas usa o sistema no primeiro dia.' },
              { step: '04', title: 'Suporte dedicado', desc: 'Resposta garantida em 24 horas. Para hospitais e clínicas com volume alto, suporte prioritário e SLA definido.' },
            ].map((item, i, arr) => (
              <div key={item.step} className="timeline-item" style={{ paddingBottom: i < arr.length - 1 ? 0 : 0 }}>
                <div className="timeline-dot">
                  <div className="timeline-dot-circle" style={{ background: '#0d6e42', borderColor: 'white', boxShadow: '0 0 0 1px #0d6e42' }} />
                  {i < arr.length - 1 && <div className="timeline-line" />}
                </div>
                <div className="timeline-content" style={{ paddingBottom: i < arr.length - 1 ? 24 : 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#0d6e42', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Passo {item.step}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '64px 0', background: '#0f172a' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 560 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,36px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>
            Pronto para substituir o papel e o WhatsApp clínico?
          </h2>
          <p style={{ fontSize: 15, color: '#475569', marginBottom: 32, lineHeight: 1.7 }}>
            89€/mês por instituição. Utilizadores ilimitados. Cancela quando quiseres, no próprio site.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/checkout?plan=clinic"
              style={{ padding: '13px 28px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Ativar agora →
            </Link>
            <Link href="/pricing"
              style={{ padding: '13px 20px', background: 'transparent', color: '#475569', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid #334155' }}>
              Ver preços
            </Link>
          </div>
          <div style={{ marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            hello@phlox-clinical.com
          </div>
        </div>
      </section>
    </div>
  )
}