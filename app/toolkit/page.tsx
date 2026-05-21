'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useClinicPrefs, INST_META, InstitutionType } from '@/lib/useClinicPrefs'

interface Tool {
  href: string
  icon: string
  label: string
  desc: string
  badge?: string
  institutions?: InstitutionType[] // if set, highlight only for these
}

const CATEGORIES: { id: string; label: string; color: string; icon: string; tools: Tool[] }[] = [
  {
    id: 'documentation',
    label: 'Análise e Documentação',
    color: '#7c3aed',
    icon: '📝',
    tools: [
      { href: '/oracle',      icon: '🔮', label: 'Oracle AI',           desc: 'Análise clínica com IA e templates SOAP', institutions: ['hospital','pharmacy_hospital','clinic','health_center'] },
      { href: '/nota-clinica',icon: '🗒️', label: 'Nota Clínica SOAP',   desc: 'Estrutura SOAP com sugestões inteligentes', badge: 'Novo' },
      { href: '/handover',    icon: '🔁', label: 'Passagem de Turno',   desc: 'Relatório de turno gerado por IA', badge: 'Novo', institutions: ['hospital','pharmacy_hospital','nursing_home'] },
      { href: '/counseling',  icon: '📋', label: 'Aconselhamento',      desc: 'Folha de informação ao doente em linguagem simples', institutions: ['pharmacy_community','clinic','health_center','nursing_home'] },
    ],
  },
  {
    id: 'safety',
    label: 'Segurança do Doente',
    color: '#dc2626',
    icon: '🛡️',
    tools: [
      { href: '/adr-report',   icon: '⚠️',  label: 'Notificação RAM',         desc: 'Formulário WHO-UMC e INFARMED de reação adversa' },
      { href: '/reconciliacao',icon: '🔄',  label: 'Reconciliação Terapêutica',desc: 'Comparação admissão vs. medicação atual', badge: 'Novo', institutions: ['hospital','pharmacy_hospital','nursing_home','clinic'] },
      { href: '/stopp-start',  icon: '🛑',  label: 'STOPP/START v3',          desc: 'Critérios 2023 + Beers — desprescrição em idosos', badge: 'Pro', institutions: ['nursing_home','hospital','clinic','health_center'] },
      { href: '/polypharmacy', icon: '⚕️',  label: 'Revisão Polimedicação',   desc: 'Auditoria de cascatas e carga anticolinérgica (ACB)', badge: 'Pro', institutions: ['nursing_home','hospital','health_center','clinic'] },
    ],
  },
  {
    id: 'pharmacotherapy',
    label: 'Farmacoterapia',
    color: '#0d9488',
    icon: '💊',
    tools: [
      { href: '/drug-info',       icon: '💊', label: 'Info Fármaco',        desc: 'Monografia completa, doses, interações, RCM', badge: 'Novo' },
      { href: '/interactions',    icon: '🔍', label: 'Verificar Interações', desc: 'Análise de interações para qualquer combinação' },
      { href: '/antibiotics',     icon: '💉', label: 'Antibioterapia',       desc: 'Protocolo empírico · MRSA/ESBL · stewardship', badge: 'Pro', institutions: ['hospital','pharmacy_hospital','clinic'] },
      { href: '/iv-compatibility',icon: '🧪', label: 'Compatibilidade IV',  desc: 'Y-site, mistura em seringa e saco', badge: 'Pro', institutions: ['hospital','pharmacy_hospital'] },
      { href: '/electrolytes',    icon: '⚡', label: 'Gestão Eletrólitos',  desc: 'Protocolos K⁺, Na⁺, Mg²⁺, Ca²⁺', badge: 'Pro', institutions: ['hospital','pharmacy_hospital'] },
    ],
  },
  {
    id: 'calculators',
    label: 'Calculadoras e Doses',
    color: '#2563eb',
    icon: '🧮',
    tools: [
      { href: '/calculos',        icon: '🧮', label: 'Calculadoras Clínicas', desc: 'CrCl, eGFR, IBW, BMI, BSA, AG, Child-Pugh, Vancomicina', badge: 'Novo' },
      { href: '/pk-dosing',       icon: '🔬', label: 'Console PK',           desc: 'Vancomicina AUC · Aminoglicosídeos · Fenitoína', badge: 'Pro', institutions: ['hospital','pharmacy_hospital'] },
      { href: '/tpn',             icon: '🧴', label: 'Nutrição Parentérica', desc: 'ASPEN 2022 · Cálculo completo · Rótulo PDF', badge: 'Pro', institutions: ['hospital','pharmacy_hospital'] },
      { href: '/emergency-doses', icon: '🚨', label: 'Doses Urgência',       desc: 'Doses de emergência calculadas por peso', badge: 'Pro', institutions: ['hospital','pharmacy_hospital','clinic'] },
      { href: '/calculators',     icon: '🔢', label: 'Outras Calculadoras',  desc: 'CURB-65, MEWS, VTE, CKD, CHADS₂-VASc…' },
    ],
  },
]

// Tools that appear prominently in the main sidebar per institution (to avoid duplication)
const SIDEBAR_TOOLS: Record<InstitutionType, string[]> = {
  hospital:           ['/cockpit','/turno','/rounds','/mar','/patients','/prescription-queue','/drug-intelligence','/quality','/team','/calculos'],
  pharmacy_hospital:  ['/cockpit','/turno','/rounds','/mar','/patients','/prescription-queue','/drug-intelligence','/quality','/team','/calculos'],
  pharmacy_community: ['/cockpit','/patients','/interactions','/counseling','/drug-info','/drug-intelligence','/quality','/team','/calculos'],
  nursing_home:       ['/cockpit','/patients','/mar','/rounds','/stopp-start','/polypharmacy','/quality','/team','/calculos'],
  clinic:             ['/cockpit','/patients','/mar','/rounds','/interactions','/reconciliacao','/quality','/drug-intelligence','/team','/calculos'],
  health_center:      ['/cockpit','/patients','/mar','/rounds','/interactions','/reconciliacao','/quality','/drug-intelligence','/team','/calculos'],
}

export default function ToolkitPage() {
  const { institution } = useClinicPrefs()
  const instMeta = INST_META[institution]
  const sidebarTools = SIDEBAR_TOOLS[institution]

  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const visibleCategories = CATEGORIES.map(cat => ({
    ...cat,
    tools: cat.tools.filter(t => {
      // Don't show tools already prominently in the sidebar
      if (sidebarTools.includes(t.href)) return false
      return true
    }),
  })).filter(cat => cat.tools.length > 0)

  // Highlight tools relevant to this institution
  const isRelevant = (tool: Tool) =>
    !tool.institutions || tool.institutions.includes(institution)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
      <style>{`
        @media(max-width:768px){.toolkit-grid{grid-template-columns:1fr!important}}
        .tool-card:hover{background:#f8fafc!important;border-color:#cbd5e1!important}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🧰</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Ferramentas Clínicas
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
          Ferramentas complementares para {instMeta.icon} {instMeta.label}
        </p>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: activeCategory === null ? '#0f172a' : '#f1f5f9',
            color: activeCategory === null ? 'white' : '#475569',
          }}
        >
          Todas
        </button>
        {visibleCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: activeCategory === cat.id ? cat.color : '#f1f5f9',
              color: activeCategory === cat.id ? 'white' : '#475569',
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Categories */}
      {visibleCategories
        .filter(cat => activeCategory === null || cat.id === activeCategory)
        .map(cat => (
          <div key={cat.id} style={{ marginBottom: 32 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 14, paddingBottom: 8,
              borderBottom: `2px solid ${cat.color}22`,
            }}>
              <span style={{ fontSize: 16 }}>{cat.icon}</span>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: cat.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {cat.label}
              </h2>
            </div>

            <div
              className="toolkit-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}
            >
              {cat.tools.map(tool => {
                const relevant = isRelevant(tool)
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="tool-card"
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 16px', borderRadius: 10,
                      border: `1px solid ${relevant ? '#e2e8f0' : '#f1f5f9'}`,
                      background: relevant ? 'white' : '#fafafa',
                      textDecoration: 'none',
                      transition: 'all 0.15s',
                      opacity: relevant ? 1 : 0.6,
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                      background: relevant ? `${cat.color}15` : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    }}>
                      {tool.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{tool.label}</span>
                        {tool.badge === 'Novo' && (
                          <span style={{ fontSize: 9, background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: 3, fontWeight: 800, letterSpacing: '0.06em' }}>NOVO</span>
                        )}
                        {tool.badge === 'Pro' && (
                          <span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 3, fontWeight: 800, letterSpacing: '0.06em' }}>PRO</span>
                        )}
                        {relevant && (
                          <span style={{ fontSize: 9, background: `${cat.color}20`, color: cat.color, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                            {instMeta.shortLabel}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{tool.desc}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

      {visibleCategories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧰</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Ferramentas disponíveis na navegação principal</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>
            As ferramentas para {instMeta.label} já aparecem na barra lateral.
          </div>
        </div>
      )}
    </div>
  )
}
