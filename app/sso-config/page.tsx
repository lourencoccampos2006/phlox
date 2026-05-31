// /sso-config — guia técnico de configuração SSO empresarial (Institucional).
// O Phlox usa o suporte SAML 2.0 e OIDC do Supabase Auth. Esta página dá ao IT
// da instituição exatamente os endpoints, ACS URL, Entity ID e os atributos
// esperados, sem ter de perguntar nada.

import Link from 'next/link'
import { CardItem, SecuritySection } from '../seguranca/_parts'

export const metadata = { title: 'SSO Empresarial — Phlox' }

export default function SSOConfigPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://YOUR-PROJECT.supabase.co'
  const entityId = `${supabaseUrl}/auth/v1/sso/saml/metadata`
  const acsUrl = `${supabaseUrl}/auth/v1/sso/saml/acs`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Institucional</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3.4vw,38px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Single Sign-On (SSO)</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '8px 0 0', lineHeight: 1.6 }}>
            SAML 2.0 e OpenID Connect — Microsoft Entra ID, Google Workspace, Okta, Auth0. Os utilizadores entram com a conta da organização. Configurado pelo IT da instituição em ~15 minutos.
          </p>
        </div>

        <SecuritySection title="Endpoints para o teu Identity Provider (IdP)" intro="Cola estes valores no Entra ID / Workspace / Okta ao registar a aplicação SAML.">
          <CardItem k="Entity ID" v={<code style={{ fontSize: 12 }}>{entityId}</code>} />
          <CardItem k="ACS URL (Reply URL)" v={<code style={{ fontSize: 12 }}>{acsUrl}</code>} />
          <CardItem k="Name ID" v="Email Address (urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress)" />
          <CardItem k="Binding" v="HTTP-POST" />
          <CardItem k="Signature" v="RSA-SHA256 (assinatura no AuthnRequest e na Response)" />
        </SecuritySection>

        <SecuritySection title="Atributos esperados (Attribute Statement)" intro="Mapeia estes atributos no IdP para que o utilizador entre com o nome certo.">
          <CardItem k="email" v="endereço primário do utilizador (obrigatório)" />
          <CardItem k="first_name / given_name" v="primeiro nome" />
          <CardItem k="last_name / family_name" v="último nome" />
          <CardItem k="organization" v="opcional — usado para mostrar a instituição na sessão" />
        </SecuritySection>

        <SecuritySection title="Microsoft Entra ID (antigo Azure AD)" intro="Passo-a-passo abreviado.">
          <CardItem k="1." v="Entra ID → Enterprise Applications → New application → Create your own → Integrate any other application (Non-gallery)" />
          <CardItem k="2." v="Single sign-on → SAML. Carregar metadata XML do Phlox: https://phloxclinical.com/sso/metadata (preenche tudo)" />
          <CardItem k="3." v="Atribuir utilizadores e/ou grupos. Save." />
          <CardItem k="4." v="Pede ao Phlox para registar o teu Tenant (envia o domínio de email da instituição: ex. minhaorg.pt)" />
        </SecuritySection>

        <SecuritySection title="Google Workspace" intro="Passo-a-passo abreviado.">
          <CardItem k="1." v="Admin Console → Apps → Web and mobile apps → Add custom SAML app" />
          <CardItem k="2." v="Copia ACS URL e Entity ID acima; descarrega o IdP metadata e envia ao Phlox" />
          <CardItem k="3." v="Atributos: Primary email → email; First name → first_name; Last name → last_name" />
          <CardItem k="4." v="Atribui ao OU ou grupo apropriado" />
        </SecuritySection>

        <SecuritySection title="Okta / Auth0" intro="Suporte completo via OIDC.">
          <CardItem k="OIDC" v={<>Discovery: <code style={{ fontSize: 12 }}>{supabaseUrl}/auth/v1/.well-known/openid-configuration</code></>} />
          <CardItem k="Scopes" v="openid · email · profile" />
        </SecuritySection>

        <SecuritySection title="Provisionamento de utilizadores" intro="Apenas Just-in-Time (JIT). SCIM no roteiro 2026 Q3.">
          <CardItem k="JIT" v="Ao primeiro login bem-sucedido, o Phlox cria a conta com o email do SAML/OIDC" />
          <CardItem k="Domain binding" v="Os emails do domínio da instituição (@minhaorg.pt) são automaticamente associados à organização" />
          <CardItem k="Revogação" v="Bloquear no IdP → próximo login negado; revogação imediata da sessão por força quando admin executar 'Forçar saída global'" />
        </SecuritySection>

        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', marginTop: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Próximo passo</div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Depois de configurar a aplicação no teu IdP, envia o metadata XML/URL e o teu domínio de email para o Phlox em <Link href="/webhooks" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>integrações</Link> ou abre um ticket dentro de <Link href="/settings" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Definições</Link>. Ativamos em 24 horas úteis.
          </p>
          <Link href="/sso/login" style={{ display: 'inline-block', padding: '11px 18px', background: '#0d6e42', color: 'white', textDecoration: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 700 }}>
            Testar SSO →
          </Link>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--ink-5)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/seguranca" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Modelo de segurança →</Link>
          <Link href="/auditoria" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Audit Trail →</Link>
        </div>
      </div>
    </div>
  )
}
