// app/c/[slug]/page.tsx
// Página PÚBLICA de uma instituição — prova social, SEO e angariação. A instituição
// partilha o link (phloxclinical.com/c/<slug>); as famílias veem o que o centro
// oferece e como acompanhar o seu familiar. SSR + indexável.
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 3600   // re-gera de hora a hora

interface OrgPublic { id: string; name: string; kind: string; tagline?: string | null; about?: string | null; city?: string | null }

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

async function getOrg(slug: string): Promise<OrgPublic | null> {
  try {
    const { data } = await admin()
      .from('organizations')
      .select('id, name, kind, tagline, about, city, public')
      .eq('slug', slug).eq('public', true).maybeSingle()
    return data as any || null
  } catch { return null }
}

const KIND_LABEL: Record<string, string> = {
  day_care: 'Centro de Dia', nursing_home: 'Lar / ERPI', pharmacy_community: 'Farmácia',
  clinic: 'Clínica', health_center: 'Centro de Saúde',
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const org = await getOrg(slug)
  if (!org) return { title: 'Instituição — Phlox' }
  const title = `${org.name} — ${KIND_LABEL[org.kind] || 'Instituição'}`
  const desc = org.tagline || `Conheça o ${org.name} e acompanhe o dia do seu familiar com o Phlox.`
  return {
    title, description: desc,
    openGraph: { title, description: desc, type: 'website' },
    alternates: { canonical: `https://phloxclinical.com/c/${slug}` },
  }
}

export default async function PublicInstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await getOrg(slug)
  if (!org) notFound()

  const kindLabel = KIND_LABEL[org.kind] || 'Instituição'
  const accent = '#0d6e42'

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px clamp(16px,5vw,28px) 70px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, fontWeight: 700, marginBottom: 10 }}>{kindLabel}{org.city ? ` · ${org.city}` : ''}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px,6vw,46px)', fontWeight: 400, color: '#0b1120', margin: '0 0 14px', letterSpacing: '-0.025em', lineHeight: 1.1 }}>{org.name}</h1>
        {org.tagline && <p style={{ fontSize: 18, color: '#475569', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 560 }}>{org.tagline}</p>}
        {org.about && <p style={{ fontSize: 15.5, color: '#64748b', lineHeight: 1.75, margin: '0 0 28px', maxWidth: 600 }}>{org.about}</p>}

        {/* O que as famílias ganham — argumento de confiança */}
        <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '22px 24px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 14 }}>Acompanhe o dia do seu familiar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { i: '☀️', t: 'Como correu o dia', d: 'Refeições, humor e atividades, em linguagem simples — sem ter de ligar.' },
              { i: '📸', t: 'Fotos e momentos', d: 'A equipa partilha momentos do dia diretamente consigo.' },
              { i: '💊', t: 'Medicação clara', d: 'Veja o que é dado no centro e marque o que dá em casa.' },
              { i: '💬', t: 'Fale com a equipa', d: 'Mensagens diretas, quando precisar.' },
            ].map(f => (
              <div key={f.t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{f.i}</span>
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: '#0b1120' }}>{f.t}</span>
                  <span style={{ display: 'block', fontSize: 13, color: '#64748b', marginTop: 1, lineHeight: 1.5 }}>{f.d}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA família */}
        <div style={{ background: accent, borderRadius: 16, padding: '24px 26px', textAlign: 'center', color: 'white' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, marginBottom: 8 }}>É família de um utente do {org.name}?</div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: '0 auto 18px', maxWidth: 420, lineHeight: 1.55 }}>Peça o código de acesso à instituição e acompanhe tudo no portal — sem instalar nada.</p>
          <Link href="/portal-familia" style={{ display: 'inline-block', background: 'white', color: accent, textDecoration: 'none', padding: '12px 26px', borderRadius: 10, fontSize: 14, fontWeight: 800 }}>Abrir o portal família →</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12.5, color: '#94a3b8' }}>
          Cuidado acompanhado com <Link href="/" style={{ color: accent, fontWeight: 700, textDecoration: 'none' }}>Phlox</Link>.
          É uma instituição? <Link href="/centro-de-dia" style={{ color: accent, fontWeight: 700, textDecoration: 'none' }}>Saber mais →</Link>
        </div>
      </div>
    </div>
  )
}
