'use client'

// /organizacao — Hub central da organização ativa
// Lista TODAS as ferramentas disponíveis, agrupadas por área.
// Cada cartão mostra ícone, nome, descrição e abre a ferramenta directamente.

import Link from 'next/link'
import { useState } from 'react'
import { useMemberships, setActiveOrgId } from '@/lib/orgContext'
import { ROLE_META } from '@/lib/capabilities'

const ACCENT = '#0d6e42'

interface Tool {
  href: string
  title: string
  desc: string
  icon: string
  cap: string
}

interface Section {
  label: string
  color: string
  tools: Tool[]
}

const SECTIONS: Section[] = [
  {
    label: 'Hospital',
    color: '#dc2626',
    tools: [
      { href: '/hospital/camas', title: 'Mapa de camas', desc: 'Estado em tempo real por ala', icon: '🛏️', cap: 'beds.read' },
      { href: '/hospital/triagem', title: 'Triagem Manchester', desc: 'Fila de urgência com 5 prioridades', icon: '🚨', cap: 'triage.read' },
      { href: '/hospital/bloco', title: 'Bloco operatório', desc: 'Agenda + checklist OMS', icon: '🔪', cap: 'surgery.read' },
    ],
  },
  {
    label: 'Farmácia',
    color: '#0d6e42',
    tools: [
      { href: '/farmacia/fornecedores', title: 'Fornecedores', desc: 'Laboratórios, armazenistas, KPIs', icon: '🏭', cap: 'suppliers.read' },
      { href: '/farmacia/compras', title: 'Compras & recepção', desc: 'Encomendas, lotes, validades', icon: '📦', cap: 'stock.read' },
      { href: '/farmacia/fidelizacao', title: 'Fidelização', desc: 'Programa, cartões, pontos, recompensas', icon: '⭐', cap: 'loyalty.read' },
      { href: '/stock', title: 'Stock & validades', desc: 'Inventário, mínimos, expiração', icon: '📋', cap: 'stock.read' },
    ],
  },
  {
    label: 'Clínico',
    color: '#1d4ed8',
    tools: [
      { href: '/patients', title: 'Doentes', desc: 'Fichas, histórico, prescrições', icon: '👥', cap: 'patients.read' },
      { href: '/mar', title: 'Administração (MAR)', desc: 'Registo de tomas', icon: '💊', cap: 'mar.read' },
      { href: '/rounds', title: 'Ronda farmacêutica', desc: 'Intervenções PCNE', icon: '👨‍⚕️', cap: 'rounds.read' },
      { href: '/residentes', title: 'Rev. farmacoterapêutica', desc: 'STOPP/START, polimedicação', icon: '🔍', cap: 'patients.read' },
      { href: '/soap', title: 'Nota clínica SOAP', desc: 'Notas estruturadas', icon: '📝', cap: 'patients.read' },
    ],
  },
  {
    label: 'Inteligência',
    color: '#7c3aed',
    tools: [
      { href: '/bi', title: 'BI conversacional', desc: 'Pergunta em linguagem natural', icon: '💬', cap: 'bi.use' },
      { href: '/automacoes', title: 'Automações & agentes', desc: 'Regras + tarefas autónomas', icon: '⚡', cap: 'automation.read' },
      { href: '/insights', title: 'Insights operacionais', desc: 'Tendências e indicadores', icon: '📊', cap: 'bi.use' },
    ],
  },
  {
    label: 'Comunicação',
    color: '#0891b2',
    tools: [
      { href: '/crm', title: 'CRM', desc: 'Leads, prospectos, parceiros', icon: '🤝', cap: 'crm.read' },
      { href: '/telemedicina', title: 'Telemedicina', desc: 'Consultas remotas', icon: '📹', cap: 'telemed.read' },
      { href: '/traduzir', title: 'Tradução clínica', desc: 'PT-PT ↔ EN/ES/FR/UK/AR', icon: '🌍', cap: 'translate.use' },
      { href: '/connect', title: 'Connect', desc: 'Rede entre profissionais', icon: '🔗', cap: 'patients.read' },
    ],
  },
  {
    label: 'Operações',
    color: '#b45309',
    tools: [
      { href: '/sala-espera', title: 'Sala de espera', desc: 'Walk-ins sem conta', icon: '⏰', cap: 'patients.read' },
      { href: '/tarefas-equipa', title: 'Tarefas da equipa', desc: 'Limpeza, manutenção, secretaria', icon: '✅', cap: 'team.read' },
      { href: '/schedule', title: 'Equipa & escalas', desc: 'Turnos, ausências', icon: '📅', cap: 'team.read' },
      { href: '/quality', title: 'Qualidade & KPIs', desc: 'Indicadores e eventos', icon: '🎯', cap: 'quality.read' },
      { href: '/vendas', title: 'Ponto de venda', desc: 'Recibos, vendas, POS', icon: '💳', cap: 'pos.use' },
      { href: '/faturacao', title: 'Faturação', desc: 'Faturas, SAF-T', icon: '🧾', cap: 'billing.read' },
    ],
  },
  {
    label: 'Administração',
    color: '#0f172a',
    tools: [
      { href: '/settings?tab=organizacoes', title: 'Identidade da org', desc: 'Nome, logo, NIF, director', icon: '🏢', cap: 'org.admin' },
      { href: '/settings?tab=seguranca', title: 'Segurança', desc: 'MFA, sessões, anomalias', icon: '🔒', cap: 'patients.read' },
      { href: '/settings?tab=integracoes', title: 'Integrações & API', desc: 'FHIR, laboratórios, webhooks', icon: '🔌', cap: 'org.admin' },
      { href: '/auditoria', title: 'Audit trail', desc: 'Histórico de eventos', icon: '📜', cap: 'audit.read' },
      { href: '/conformidade', title: 'Conformidade', desc: 'Checklists RGPD/INFARMED', icon: '🛡️', cap: 'org.admin' },
    ],
  },
]

export default function OrganizationHubPage() {
  const { memberships, active, loading, refresh } = useMemberships()
  const [showSwitcher, setShowSwitcher] = useState(false)

  if (loading) {
    return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  }

  if (memberships.length === 0) {
    return (
      <main style={{ padding: '24px clamp(16px, 4vw, 32px)', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>🏥</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Ainda não tens organizações</h1>
          <p style={{ color: '#6b7280', margin: '0 0 18px', fontSize: 14 }}>
            Cria a primeira para aceder a hospital, farmácia, ronda, BI, telemedicina e mais.
          </p>
          <Link href="/settings?tab=organizacoes&new=1" style={{
            display: 'inline-block', padding: '10px 18px', background: ACCENT, color: 'white',
            borderRadius: 8, textDecoration: 'none', fontWeight: 600,
          }}>
            + Criar organização
          </Link>
        </div>
      </main>
    )
  }

  if (!active) {
    return (
      <main style={{ padding: '24px clamp(16px, 4vw, 32px)', maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700 }}>Escolhe uma organização</h1>
        <p style={{ color: '#6b7280', margin: '0 0 18px', fontSize: 14 }}>
          Pertences a {memberships.length} organização{memberships.length === 1 ? '' : 'es'}.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {memberships.map(m => (
            <button key={m.org.id} onClick={() => { setActiveOrgId(m.org.id); refresh() }} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 16,
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
              cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{
                width: 44, height: 44, borderRadius: 12,
                background: m.org.accent_color || ACCENT, color: 'white',
                fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{(m.org.short_name || m.org.name).charAt(0).toUpperCase()}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{m.org.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{ROLE_META[m.role]?.label || m.role}</div>
              </div>
            </button>
          ))}
        </div>
      </main>
    )
  }

  const caps = active.capabilities
  const roleMeta = ROLE_META[active.role] || ROLE_META.viewer

  return (
    <main style={{ padding: '24px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20,
        marginBottom: 22, display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <span style={{
          width: 56, height: 56, borderRadius: 14, background: active.org.accent_color || ACCENT, color: 'white',
          fontWeight: 800, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{(active.org.short_name || active.org.name).charAt(0).toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{active.org.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: roleMeta.color, fontWeight: 700, padding: '2px 10px', background: roleMeta.color + '15', borderRadius: 999 }}>
              {roleMeta.label}
            </span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{active.org.kind}</span>
          </div>
        </div>
        {memberships.length > 1 && (
          <button onClick={() => setShowSwitcher(s => !s)} style={{
            padding: '8px 14px', background: '#f3f4f6', border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>↻ Trocar org</button>
        )}
      </div>

      {showSwitcher && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            As tuas organizações
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {memberships.map(m => (
              <button key={m.org.id} onClick={() => { setActiveOrgId(m.org.id); setShowSwitcher(false); refresh() }} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                background: m.org.id === active.org.id ? '#f0fdf5' : 'white',
                border: `1px solid ${m.org.id === active.org.id ? ACCENT : '#e5e7eb'}`,
                borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: m.org.accent_color || ACCENT, color: 'white',
                  fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{(m.org.short_name || m.org.name).charAt(0).toUpperCase()}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.org.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{ROLE_META[m.role]?.label || m.role}</div>
                </div>
                {m.org.id === active.org.id && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>activa</span>}
              </button>
            ))}
          </div>
          <Link href="/settings?tab=organizacoes&new=1" style={{
            display: 'block', marginTop: 8, padding: 10, background: '#f3f4f6', color: '#374151',
            textDecoration: 'none', borderRadius: 8, textAlign: 'center', fontSize: 13, fontWeight: 600,
          }}>+ Nova organização</Link>
        </div>
      )}

      {/* Secções */}
      {SECTIONS.map(section => {
        const allowed = section.tools.filter(t => caps.includes(t.cap))
        if (allowed.length === 0) return null
        return (
          <section key={section.label} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 4, height: 18, background: section.color, borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {section.label}
              </h2>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{allowed.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {allowed.map(t => (
                <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                    padding: 14, transition: 'border-color 0.12s, transform 0.12s',
                    height: '100%', cursor: 'pointer',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = section.color; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'none' }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{t.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.45 }}>{t.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      {SECTIONS.every(s => s.tools.filter(t => caps.includes(t.cap)).length === 0) && (
        <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#6b7280' }}>
            O teu perfil de <b>{ROLE_META[active.role]?.label}</b> não tem acesso a nenhuma ferramenta nesta organização.
            Contacta o administrador.
          </p>
        </div>
      )}
    </main>
  )
}
