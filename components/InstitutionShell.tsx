'use client'

// InstitutionShell — o shell institucional.
//
// ── O QUE MUDOU (2026-08-31, a partir de docs/designs/Painel Phlox.html) ──
//
// 1. O NOME DA INSTITUIÇÃO APARECIA DUAS VEZES. Estava no header e outra vez
//    no topo da sidebar, uma por baixo da outra. Agora está no header, uma vez,
//    ao lado da marca — e a sidebar começa logo na navegação.
//
// 2. A MARCA PASSOU A SER A FLOR. Antes o canto superior esquerdo era texto. A
//    flor usada é a variante escura (public/flor-escura-64.png), gerada por
//    scripts/logo-flor-escura.mjs precisamente porque a original é rosa pálido
//    e desaparece em fundo branco.
//
// 3. O HEADER DEIXOU DE TER UM BURACO NO MEIO. Em ecrã grande havia o nome à
//    esquerda, a data ao centro, e dois ícones à direita — com um vazio enorme
//    pelo meio. Agora o espaço leva o turno e a hora, que é a informação que
//    quem está a trabalhar olha mais vezes ao longo do dia.
//
// 4. ACABOU O "MAIS FERRAMENTAS". Eram 24 entradas no menu, 16 delas atrás de
//    um acordeão que ninguém abria. Ficam as oito do núcleo; as outras vivem em
//    pastas no painel (blueprint.toolFolders). Nada foi retirado do produto —
//    deixou é de competir com o que se usa todos os dias.

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { blueprintFor, type ToolEntry } from '@/lib/institutionBlueprint'
import { iconForHref } from '@/lib/clinicalIcons'
import Icon from '@/components/Icon'
import NotificationBell from '@/components/NotificationBell'
import { useOrgName } from '@/lib/useOrgName'
import TurnoResumo from '@/components/institution/TurnoResumo'

/** Os separadores de topo. São VISTAS DO PAINEL, não atalhos para ferramentas:
 *  trocam o que o painel mostra (?aba=…) e nunca saltam para outra página.
 *
 *  Estavam a apontar para /care-log, /patients, /equipa e /painel-dono — cinco
 *  destinos diferentes com o nome de um separador. Isso fazia da barra um
 *  segundo menu: quem carregava em "Cuidados" à espera de ver como está a casa
 *  aterrava num formulário de registo. As ferramentas têm o seu lugar (a barra
 *  lateral e as pastas do painel); esta barra é para ver dados. */
const SEPARADORES: { label: string; aba: string }[] = [
  { label: 'Hoje', aba: 'hoje' },
  { label: 'Cuidados', aba: 'cuidados' },
  { label: 'Pessoas', aba: 'pessoas' },
  { label: 'Equipa', aba: 'equipa' },
  { label: 'Gestão', aba: 'gestao' },
]

/** Turno atual pela hora de Portugal. */
function turnoAgora(d: Date): { nome: string; hora: string } {
  const h = Number(d.toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', hour12: false }))
  const hora = d.toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' })
  const nome = h < 8 ? 'Turno da noite' : h < 14 ? 'Turno da manhã' : h < 21 ? 'Turno da tarde' : 'Turno da noite'
  return { nome, hora }
}

export default function InstitutionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth() as any
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const warm = bp.tone === 'warm'
  // O nome da CASA, não o da categoria. "O seu Centro de Dia" era o mesmo
  // texto para toda a gente; quem lá trabalha quer ver o nome do sítio.
  const nomeCasa = useOrgName()

  const [mounted, setMounted] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [agora, setAgora] = useState<Date | null>(null)

  // Só depois de montar, e a hora atualiza-se de minuto a minuto. Renderizar a
  // hora no servidor daria um desencontro de hidratação garantido.
  useEffect(() => {
    setMounted(true); setAgora(new Date())
    const t = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { setMobileNav(false) }, [pathname])

  const firstName = user?.name?.split(' ')[0] || ''
  const isActive = (href: string) => {
    const base = href.split('?')[0]
    return pathname === base || pathname.startsWith(base + '/')
  }
  const turno = agora ? turnoAgora(agora) : null

  const NavItem = ({ t }: { t: ToolEntry }) => {
    const active = isActive(t.href)
    return (
      <Link href={t.href} title={t.hint}
        style={{
          display: 'flex', alignItems: 'center', gap: 11,
          padding: 'var(--space-4) var(--space-5)', borderRadius: 'var(--r-md)',
          textDecoration: 'none', background: active ? bp.accentSoft : 'transparent',
          color: active ? bp.accent : 'var(--ink-3)', fontWeight: active ? 700 : 600, fontSize: 14,
          border: `1px solid ${active ? bp.accent + '33' : 'transparent'}`,
        }}>
        <span style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={iconForHref(t.href)} size={18} color={active ? bp.accent : 'var(--ink-4)'} />
        </span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
      </Link>
    )
  }

  // Sem o nome do produto: já está no header, e tê-lo nos dois sítios era a
  // duplicação que se via ao abrir a página.
  const SidebarInner = (
    <>
      <Link href="/painel" title="Painel"
        style={{
          display: 'flex', alignItems: 'center', gap: 11,
          padding: 'var(--space-4) var(--space-5)', borderRadius: 'var(--r-md)',
          textDecoration: 'none', marginBottom: 'var(--space-1)',
          background: isActive('/painel') ? bp.accent : 'transparent',
          color: isActive('/painel') ? 'white' : 'var(--ink-3)', fontWeight: 700, fontSize: 14,
        }}>
        <span style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
          <Icon name="grid" size={18} color={isActive('/painel') ? 'white' : 'var(--ink-4)'} />
        </span> Painel
      </Link>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 'var(--space-2)' }}>
        {bp.coreTools.map(t => <NavItem key={t.href} t={t} />)}
      </nav>

      {/* As restantes ferramentas não desapareceram: estão em pastas no painel.
          Dizê-lo aqui evita que alguém que as conhecia ache que sumiram. */}
      {(bp.toolFolders?.length ?? 0) > 0 && (
        <Link href="/painel"
          style={{
            display: 'block', marginTop: 'var(--space-5)', paddingTop: 'var(--space-5)',
            borderTop: '1px solid var(--border)', padding: 'var(--space-5) var(--space-5) 0',
            fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', lineHeight: 1.5,
          }}>
          As restantes ferramentas estão em <span style={{ color: bp.accent, fontWeight: 700 }}>pastas no painel →</span>
        </Link>
      )}

      <TurnoResumo cor={bp.accent} />
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f7f8fa', ['--accent' as any]: bp.accent, ['--accent-soft' as any]: bp.accentSoft }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40, height: 58, display: 'flex', alignItems: 'center',
        gap: 'var(--space-6)', padding: '0 clamp(14px,2.5vw,24px)',
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={() => setMobileNav(v => !v)} className="ish-burger" aria-label="Menu"
          style={{ display: 'none', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-3)' }}>☰</button>

        {/* Marca: a flor + o nome da instituição, uma vez só */}
        <Link href="/painel" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 1 }}>
          {/* O logótipo completo — a palavra com a flor no lugar do "o", o mesmo
              do rodapé da homepage. Variante escura: a flor original é rosa
              pálido e some-se em fundo branco. Gerada da fonte 3D em
              scripts/logo-2d.mjs (--instalar), não retocada por cima. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo-escuro.png" alt="Phlox" width={72} height={30}
            style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }} draggable={false} />
          <span style={{
            fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: 16,
            fontWeight: warm ? 600 : 800, color: 'var(--ink)', letterSpacing: '-0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            paddingLeft: 'var(--space-4)', borderLeft: '1px solid var(--border)',
          }}>{nomeCasa || bp.productName}</span>
        </Link>

        {/* O espaço do meio leva o turno e a hora — o que quem trabalha olha
            mais vezes. Antes estava vazio em ecrã grande. */}
        <div className="ish-turno" style={{
          display: 'flex', alignItems: 'baseline', gap: 9, paddingLeft: 'var(--space-6)',
          borderLeft: '1px solid var(--border)', minWidth: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.13em',
            textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700, whiteSpace: 'nowrap',
          }}>{turno?.nome || ''}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-2)', fontWeight: 700 }}>
            {turno?.hora || ''}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }} />

        <div className="ish-data" style={{
          fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: 'var(--ink-4)', whiteSpace: 'nowrap',
        }}>
          {mounted && agora ? agora.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
          <NotificationBell />
          <Link href="/settings" title="Definições" style={{
            width: 34, height: 34, borderRadius: '50%', background: bp.accentSoft, color: bp.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, textDecoration: 'none',
          }}>
            {(firstName[0] || 'U').toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Separadores — as cinco vistas do painel. Fora do painel nenhum acende:
          é a forma honesta de dizer "estás numa ferramenta, não numa vista". */}
      <nav className="ish-tabs" style={{
        display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
        padding: '0 clamp(14px,2.5vw,24px)', borderBottom: '1px solid var(--border)',
        background: 'var(--bg)', overflowX: 'auto',
      }}>
        {SEPARADORES.map(sep => {
          const activo = pathname === '/painel' && (searchParams.get('aba') || 'hoje') === sep.aba
          return (
            <Link key={sep.aba} href={sep.aba === 'hoje' ? '/painel' : `/painel?aba=${sep.aba}`} style={{
              padding: 'var(--space-6) var(--space-5) var(--space-5)',
              fontSize: 13.5, fontWeight: activo ? 700 : 600, whiteSpace: 'nowrap',
              color: activo ? 'var(--ink)' : 'var(--ink-4)', textDecoration: 'none',
              borderBottom: `2px solid ${activo ? bp.accent : 'transparent'}`, marginBottom: -1,
            }}>{sep.label}</Link>
          )
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1320, margin: '0 auto' }}>
        <aside className="ish-sidebar" style={{
          width: 260, flexShrink: 0, position: 'sticky', top: 58, height: 'calc(100vh - 58px)',
          overflowY: 'auto', padding: 'var(--space-8) var(--space-6)', borderRight: '1px solid var(--border)',
        }}>
          {SidebarInner}
        </aside>

        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>

      {mobileNav && (
        <>
          <div onClick={() => setMobileNav(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 48 }} />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 270, background: warm ? '#fbfaf8' : 'white', zIndex: 49, padding: 'var(--space-8) var(--space-6)', overflowY: 'auto', boxShadow: '4px 0 24px rgba(0,0,0,0.12)' }}>
            {SidebarInner}
          </aside>
        </>
      )}

      <style>{`
        @media (max-width: 980px) { .ish-turno { display: none !important; } }
        @media (max-width: 860px) {
          .ish-sidebar { display: none; }
          .ish-burger { display: inline-block !important; }
          .ish-data { display: none; }
        }
      `}</style>
    </div>
  )
}
