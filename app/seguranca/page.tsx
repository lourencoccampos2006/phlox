// Modelo de segurança do Phlox — página técnica honesta para clientes institucionais.
// Tudo o que está descrito reflete a infraestrutura real (Vercel + Supabase, ambos UE).

import Link from 'next/link'
import { CardItem, SecuritySection } from './_parts'

export const metadata = {
  title: 'Segurança — Phlox',
  description: 'Modelo técnico de segurança do Phlox: encriptação, isolamento por linha (RLS), hospedagem na UE, backups e retenção.',
}

export default function SegurancaPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 820 }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Segurança</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3.4vw,38px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Modelo de segurança</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '8px 0 0', lineHeight: 1.6 }}>
            O que está em causa quando confias dados clínicos a uma plataforma. Aqui está, sem floreados.
          </p>
        </div>

        {/* Hosting & data residency */}
        <SecuritySection title="Hospedagem e residência dos dados" intro="Infraestrutura na União Europeia. Sem trânsito para fora do EEE.">
          <CardItem k="Aplicação" v="Vercel · região Frankfurt (fra1) · UE" />
          <CardItem k="Base de dados" v="Supabase (Postgres gerido) · região Frankfurt · UE" />
          <CardItem k="Ficheiros" v="Supabase Storage · UE" />
          <CardItem k="Pagamentos" v="Stripe (Irlanda) — não recebe dados clínicos" />
        </SecuritySection>

        {/* Encryption */}
        <SecuritySection title="Encriptação" intro="Em trânsito e em repouso, em todas as camadas.">
          <CardItem k="Em trânsito" v="TLS 1.3 obrigatório (HSTS) em toda a aplicação e APIs" />
          <CardItem k="Em repouso" v="AES-256 na base de dados e nos backups (Supabase)" />
          <CardItem k="Segredos" v="Variáveis de ambiente cifradas (Vercel) · nunca expostas ao cliente" />
          <CardItem k="Assinaturas" v="HMAC-SHA256 nos webhooks · Stripe Signing Secret nos eventos de pagamento" />
        </SecuritySection>

        {/* Authentication */}
        <SecuritySection title="Autenticação e sessões" intro="Sem palavras-passe partilhadas. Sem segredos em URLs.">
          <CardItem k="Autenticação" v="Supabase Auth · OAuth Google · email + magic link" />
          <CardItem k="Tokens" v="JWT assinados · sessões refrescadas automaticamente" />
          <CardItem k="2FA" v="Disponível para contas Institucionais" />
          <CardItem k="Roteiro" v="SSO empresarial (SAML / Microsoft Entra ID) no plano Institucional" />
        </SecuritySection>

        {/* Authorization / RLS */}
        <SecuritySection title="Isolamento dos dados (RLS)" intro="O Postgres recusa-se a devolver dados que não te pertencem — não a aplicação.">
          <CardItem k="Row-Level Security" v="Política user_id = auth.uid() em todas as tabelas com dados clínicos" />
          <CardItem k="Service role" v="Apenas no servidor, para endpoints públicos específicos (Health Pass, faturação)" />
          <CardItem k="Auditoria" v="Cadeia SHA-256 nos documentos fiscais (Portaria 363/2010 — mecanismo)" />
        </SecuritySection>

        {/* Backups & retention */}
        <SecuritySection title="Backups e retenção" intro="Recuperação medida em horas, não em dias.">
          <CardItem k="Backups" v="Diários automáticos · Point-in-time recovery (PITR) até 7 dias" />
          <CardItem k="Retenção de logs" v="30 dias · acesso restrito" />
          <CardItem k="Apagar conta" v="Cascade DELETE remove todos os dados pessoais em definitivo" />
        </SecuritySection>

        {/* Compliance / RGPD */}
        <SecuritySection title="RGPD e conformidade" intro="Cumpre a lei e os direitos dos titulares — passo a passo.">
          <CardItem k="Base legal" v="Execução de contrato (cuidados) · obrigação legal (registos)" />
          <CardItem k="Direitos do titular" v="Acesso, retificação, portabilidade, eliminação — pedido em Definições" />
          <CardItem k="Notificação de violação" v="Procedimento interno · CNPD em 72 horas" />
          <CardItem k="Subprocessadores" v={<Link href="#subprocessadores" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Lista pública abaixo ↓</Link>} />
        </SecuritySection>

        {/* Fiscal & PT-specific */}
        <SecuritySection title="Mecanismos fiscais portugueses" intro="O Phlox não é software certificado pela AT — é mega-compatível com o que a tua instituição já usa.">
          <CardItem k="ATCUD" v="Gerado no formato oficial da AT (CodigoValidacao-Sequência)" />
          <CardItem k="QR Code AT" v="Estrutura A:nif*B:*C:PT*D:tipo*...*Q:hash4*R:0 conforme Portaria 195/2020" />
          <CardItem k="SAF-T (PT)" v="Exportador conforme esquema 1.04_01 da AT — para o teu contabilista submeter" />
          <CardItem k="Cadeia de hash" v="SHA-256 encadeado entre documentos — inviolabilidade interna" />
        </SecuritySection>

        {/* Subprocessors */}
        <div id="subprocessadores" style={{ scrollMarginTop: 80 }} />
        <SecuritySection title="Subprocessadores (Art. 28.º RGPD)" intro="Quem trata dados em nome do Phlox — atualizado a cada alteração.">
          <CardItem k="Vercel" v="Hosting da aplicação · UE · TLS · sem acesso aos dados" />
          <CardItem k="Supabase" v="Base de dados e autenticação · UE · titular do tratamento técnico" />
          <CardItem k="Stripe" v="Pagamentos de subscrição · não recebe dados clínicos" />
          <CardItem k="Google" v="Login via OAuth (opcional) · apenas para autenticação" />
        </SecuritySection>

        <div style={{ marginTop: 26, padding: 18, background: 'white', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          Encontraste algo que mereça atenção? Vai a <Link href="/settings" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Definições</Link> e usa a ligação direta no perfil. Tratamos com prioridade.
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--ink-5)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/status" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Estado em tempo real →</Link>
          <Link href="/changelog" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Histórico de alterações →</Link>
        </div>
      </div>
    </div>
  )
}
