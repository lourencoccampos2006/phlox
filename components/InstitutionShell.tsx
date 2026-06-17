'use client'

// InstitutionShell — o NOVO shell institucional (reformulação 2026-06-12).
// Substitui o ClinicalLayout (771 linhas, nav própria, OrgSwitcher à vista).
// Tudo lê do blueprint: sidebar curada (núcleo + "mais"), topbar premium com a
// "cara" do produto do tipo, tom por tipo (warm/sober). Sem escolher ferramentas,
// sem criar organização. Uma só fonte de navegação: lib/institutionBlueprint.ts.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { blueprintFor, type ToolEntry } from '@/lib/institutionBlueprint'
import NotificationBell from '@/components/NotificationBell'

function greetingDate() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function InstitutionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth() as any
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const warm = bp.tone === 'warm'

  const [mounted, setMounted] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [showMore, setShowMore] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setMobileNav(false) }, [pathname])

  const firstName = user?.name?.split(' ')[0] || ''
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Item de navegação
  const NavItem = ({ t }: { t: ToolEntry }) => {
    const active = isActive(t.href)
    return (
      <Link href={t.href} title={t.hint}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 11,
          textDecoration: 'none', background: active ? bp.accentSoft : 'transparent',
          color: active ? bp.accent : '#475569', fontWeight: active ? 700 : 600, fontSize: 14,
          border: `1px solid ${active ? bp.accent + '33' : 'transparent'}`,
        }}>
        <span style={{ fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0 }}>{t.icon}</span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
      </Link>
    )
  }

  const SidebarInner = (
    <>
      {/* Cabeçalho do produto */}
      <Link href="/painel" style={{ textDecoration: 'none', display: 'block', padding: '4px 6px 16px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginBottom: 3 }}>Phlox</div>
        <div style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: 18, fontWeight: warm ? 600 : 800, color: '#0b1120', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{bp.productName}</div>
      </Link>

      {/* Painel (sempre primeiro) */}
      <Link href="/painel" title="Painel"
        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 11, textDecoration: 'none', marginBottom: 4,
          background: isActive('/painel') ? bp.accent : 'transparent', color: isActive('/painel') ? 'white' : '#475569', fontWeight: 700, fontSize: 14 }}>
        <span style={{ fontSize: 17, width: 22, textAlign: 'center' }}>🏠</span> Painel
      </Link>

      {/* Núcleo curado */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
        {bp.coreTools.map(t => <NavItem key={t.href} t={t} />)}
      </nav>

      {/* Extras (escondidos atrás de "Mais") */}
      {bp.extraTools.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eef0f2' }}>
          <button onClick={() => setShowMore(s => !s)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Mais ferramentas <span style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>⌄</span>
          </button>
          {showMore && <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>{bp.extraTools.map(t => <NavItem key={t.href} t={t} />)}</nav>}
        </div>
      )}
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f7f8fa' }}>
      {/* ── TOPBAR premium ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40, height: 58, display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 clamp(14px,2.5vw,24px)', background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #eceef0',
      }}>
        {/* botão menu (mobile) */}
        <button onClick={() => setMobileNav(v => !v)} className="ish-burger" aria-label="Menu"
          style={{ display: 'none', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#475569' }}>☰</button>

        {/* nome do produto */}
        <Link href="/painel" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
          <span style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: 16, fontWeight: warm ? 600 : 800, color: '#0b1120', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bp.productName}</span>
        </Link>

        {/* dia (centro). Esconde-se em mobile via opacity, MAS mantém o flex-grow
            como espaçador — senão os controlos da direita colam-se ao nome. */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 13, color: '#94a3b8', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden' }} className="ish-date">
          {mounted ? greetingDate() : ''}
        </div>

        {/* direita: notificações + perfil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <NotificationBell />
          <Link href="/settings" title="Definições" style={{ width: 34, height: 34, borderRadius: '50%', background: bp.accentSoft, color: bp.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
            {(firstName[0] || 'U').toUpperCase()}
          </Link>
        </div>
      </header>

      {/* ── CORPO: sidebar + conteúdo ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1320, margin: '0 auto' }}>
        {/* Sidebar (desktop) */}
        <aside className="ish-sidebar" style={{ width: 244, flexShrink: 0, position: 'sticky', top: 58, height: 'calc(100vh - 58px)', overflowY: 'auto', padding: '18px 14px', borderRight: '1px solid #eceef0' }}>
          {SidebarInner}
        </aside>

        {/* Conteúdo */}
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>

      {/* Drawer mobile */}
      {mobileNav && (
        <>
          <div onClick={() => setMobileNav(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 48 }} />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 270, background: warm ? '#fbfaf8' : 'white', zIndex: 49, padding: '18px 14px', overflowY: 'auto', boxShadow: '4px 0 24px rgba(0,0,0,0.12)' }}>
            {SidebarInner}
          </aside>
        </>
      )}

      <style>{`
        @media (max-width: 860px) {
          .ish-sidebar { display: none; }
          .ish-burger { display: inline-block !important; }
          /* Mantém o espaçador flex (empurra os controlos p/ a direita) mas
             esconde o texto da data — antes era display:none e o header colapsava. */
          .ish-date { color: transparent !important; }
        }
      `}</style>
    </div>
  )
}
