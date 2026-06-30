// Rodapé simples e honesto — só o que importa a quem visita: o que é o Phlox,
// quem é, e como falar connosco. Sem "Trust Center", sem estado-em-tempo-real,
// sem badges de acrónimos de segurança — isso é ruído que partia o fluxo e dava
// ar de coisa por acabar. Páginas legais e empresariais ficam acessíveis, mas
// discretas. (Aparece só em páginas públicas — ver ClientLayout.)

import Link from 'next/link'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'white', marginTop: 80, fontFamily: 'var(--font-sans)' }}>
      <div className="page-container" style={{ padding: '34px 0 30px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>

          {/* Marca + uma linha do que é */}
          <div style={{ maxWidth: 300 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', marginBottom: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>Phlox</span>
            </Link>
            <p style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>
              A sua saúde, e a de quem cuida, num só sítio. Feito em português, para Portugal.
            </p>
          </div>

          {/* Links úteis, agrupados e curtos */}
          <nav style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <FooterCol title="Phlox" links={[
              ['Planos', '/pricing'],
              ['Centro de Dia', '/centro-de-dia'],
              ['Blog', '/blog'],
            ]} />
            <FooterCol title="Ajuda" links={[
              ['Suporte', 'mailto:suporte@phloxclinical.com'],
              ['Contacto', 'mailto:info@phloxclinical.com'],
            ]} />
            <FooterCol title="Legal" links={[
              ['Termos', '/terms'],
              ['Privacidade', '/privacy'],
              ['Cookies', '/cookies'],
              ['Subprocessadores', '/subprocessadores'],
              ['Dispositivo médico', '/dispositivo-medico'],
              ['Segurança', '/seguranca'],
            ]} />
          </nav>
        </div>

        {/* Sub-rodapé minimal */}
        <div style={{ marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--bg-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>© {year} Phlox · Dados alojados na União Europeia</span>
          <Link href="/dispositivo-medico" style={{ fontSize: 11.5, color: 'var(--ink-5)', textDecoration: 'none' }}>
            Ferramenta de organização e apoio — não é um dispositivo médico.
          </Link>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{title}</div>
      {links.map(([label, href]) =>
        href.startsWith('mailto:')
          ? <a key={href} href={href} style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none' }}>{label}</a>
          : <Link key={href} href={href} style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none' }}>{label}</Link>
      )}
    </div>
  )
}
