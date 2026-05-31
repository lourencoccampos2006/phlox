// Phlox Trust Center — porta única para clientes institucionais validarem o Phlox
// antes de assinar. Status, segurança, RGPD, subprocessadores, DPA descarregável.

import Link from 'next/link'

export const metadata = {
  title: 'Trust Center — Phlox',
  description: 'Estado, segurança, RGPD, subprocessadores e documentação para clientes institucionais.',
}

const RESOURCES: { title: string; desc: string; href: string; icon: string; color: string }[] = [
  { title: 'Estado da plataforma', desc: 'Uptime e saúde dos componentes em tempo real.', href: '/status', icon: '●', color: '#16a34a' },
  { title: 'Modelo de segurança', desc: 'Encriptação, RLS, hospedagem na UE, backups.', href: '/seguranca', icon: '🔒', color: '#7c3aed' },
  { title: 'Audit Trail', desc: 'Cadeia SHA-256 imutável dos teus eventos sensíveis.', href: '/auditoria', icon: '⛓', color: '#0d6e42' },
  { title: 'Histórico de alterações', desc: 'O que mudou e quando.', href: '/changelog', icon: '✏', color: '#2563eb' },
  { title: 'Termos de Serviço', desc: 'Contrato base.', href: '/terms', icon: '§', color: '#64748b' },
  { title: 'Privacidade', desc: 'Como tratamos dados pessoais.', href: '/privacy', icon: '§', color: '#64748b' },
  { title: 'DPA (Art. 28.º RGPD)', desc: 'Contrato de subcontratante gerado por NIF.', href: '/trust/dpa', icon: '✎', color: '#dc2626' },
  { title: 'SSO Empresarial', desc: 'SAML/OIDC com Microsoft Entra ID, Workspace, Okta.', href: '/sso-config', icon: '⌬', color: '#1d4ed8' },
  { title: 'API pública', desc: 'Chaves rotáveis com scopes e rate limit.', href: '/api-keys', icon: '⌘', color: '#0891b2' },
  { title: 'Webhooks', desc: 'Eventos assinados (HMAC-SHA256) para o teu sistema.', href: '/webhooks', icon: '↗', color: '#ca8a04' },
]

const COMMITMENTS: { metric: string; label: string; detail: string }[] = [
  { metric: '99.9%', label: 'Uptime mensal', detail: 'medido publicamente em /status' },
  { metric: '< 24h', label: 'Resposta a incidente de segurança crítico', detail: 'CVSS ≥ 7.0' },
  { metric: '72h', label: 'Notificação de violação de dados', detail: 'titular + CNPD, Art. 33.º RGPD' },
  { metric: 'UE', label: 'Residência de dados', detail: 'Vercel Frankfurt + Supabase Frankfurt' },
]

export default function TrustCenterPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1040 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Phlox · Trust Center</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px,4vw,46px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.05 }}>Tudo o que precisas para confiar no Phlox.</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', margin: '12px 0 0', lineHeight: 1.65, maxWidth: 640 }}>
            Os clientes institucionais sérios pedem isto antes de assinar. Aqui está, num único sítio — sem ter de mandar email a ninguém.
          </p>
        </div>

        {/* Commitments strip */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {COMMITMENTS.map(c => (
              <div key={c.label} style={{ borderLeft: '3px solid #0d6e42', paddingLeft: 14 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, lineHeight: 1 }}>{c.metric}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginTop: 5 }}>{c.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 2, lineHeight: 1.45 }}>{c.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Resources grid */}
        <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Recursos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12, marginBottom: 26 }}>
          {RESOURCES.map(r => (
            <Link key={r.href} href={r.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', height: '100%', transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 7 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: r.color + '14', color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{r.icon}</div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{r.title}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Compliance block */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px', marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, margin: '0 0 12px', letterSpacing: '-0.015em' }}>Compromissos legais e técnicos</div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            <li><strong>RGPD (UE 2016/679)</strong> — bases legais, direitos do titular, notificação de violação em 72h, contratos Art. 28.º com cada subprocessador.</li>
            <li><strong>Hospedagem na UE</strong> — aplicação em Vercel Frankfurt, base de dados em Supabase Frankfurt. Sem trânsito de dados clínicos para fora do EEE.</li>
            <li><strong>Encriptação obrigatória</strong> — TLS 1.3 em trânsito, AES-256 em repouso, segredos isolados em variáveis de ambiente cifradas.</li>
            <li><strong>Isolamento por linha</strong> — políticas Postgres RLS em todas as tabelas com dados clínicos. O Postgres recusa-se a devolver dados que não pertencem ao utilizador autenticado.</li>
            <li><strong>Audit Trail imutável</strong> — cada evento sensível com hash SHA-256 encadeado ao anterior. Adulteração detetável criptograficamente.</li>
            <li><strong>Mecanismos fiscais portugueses</strong> — ATCUD, QR Code AT (Portaria 195/2020), SAF-T (PT) com estrutura 1.04_01. O Phlox NÃO é certificado pela AT — é mega-compatível com o software certificado que a tua instituição usa.</li>
          </ul>
        </div>

        {/* Trust signals */}
        <div style={{ background: 'var(--bg-2)', borderRadius: 14, padding: '22px 24px', marginBottom: 22, fontFamily: 'var(--font-sans)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Construído sobre</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { name: 'Vercel', detail: 'Hosting · UE' },
              { name: 'Supabase', detail: 'Postgres · UE' },
              { name: 'Stripe', detail: 'Subscrições' },
              { name: 'Cloudflare', detail: 'Edge & DNS' },
              { name: 'OpenAI / Gemini', detail: 'IA · sem dados clínicos persistidos' },
            ].map(p => (
              <div key={p.name} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 2 }}>{p.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: '#0b1120', color: 'white', borderRadius: 14, padding: '26px 28px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, letterSpacing: '-0.015em' }}>Pronto a avaliar?</div>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', maxWidth: 480, margin: '8px auto 16px', lineHeight: 1.55 }}>
            Gera o contrato Art. 28.º RGPD com o NIF da tua instituição, ou ativa o plano Institucional para começar.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/trust/dpa" style={{ padding: '12px 22px', background: 'white', color: '#0b1120', textDecoration: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 800 }}>Gerar DPA →</Link>
            <Link href="/checkout?plan=clinic" style={{ padding: '12px 22px', background: '#16a34a', color: 'white', textDecoration: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 800 }}>Ativar Institucional</Link>
          </div>
        </div>

      </div>
    </div>
  )
}
