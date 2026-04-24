import Header from '@/components/Header'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Phlox Clinical',
  description: 'Como a Phlox Clinical recolhe, usa e protege os teus dados pessoais. Compliance RGPD.',
}

const SECTIONS = [
  {
    title: 'Quem somos',
    content: 'A Phlox Clinical é uma plataforma farmacológica educacional. O responsável pelo tratamento dos dados é o operador da plataforma phlox.health.',
  },
  {
    title: 'Que dados recolhemos',
    content: 'Quando crias uma conta com Google OAuth, recebemos o teu nome, endereço de email e foto de perfil. Guardamos o teu histórico de pesquisas associado à tua conta para te fornecer o serviço. Recolhemos também dados de uso anónimos e agregados (que ferramentas são usadas, quais as pesquisas mais comuns) sem qualquer informação pessoal identificável.',
  },
  {
    title: 'Para que usamos os dados',
    content: 'Os dados pessoais são usados exclusivamente para fornecer o serviço — histórico de pesquisas, lista de medicamentos pessoais, e preferências de conta. Os dados agregados e anónimos são usados para melhorar a plataforma.',
  },
  {
    title: 'Cookies e rastreamento',
    content: 'Usamos cookies estritamente necessários para o funcionamento da plataforma (autenticação). Com o teu consentimento, podemos usar cookies de analytics para perceber como a plataforma é usada. Nunca usamos cookies de publicidade comportamental.',
  },
  {
    title: 'Partilha de dados',
    content: 'Não vendemos dados pessoais a terceiros. Os dados são processados pelos nossos fornecedores de infraestrutura (Supabase para base de dados, Cloudflare para alojamento) sob contratos de processamento de dados conformes com o RGPD.',
  },
  {
    title: 'Os teus direitos (RGPD)',
    content: 'Tens direito de acesso, rectificação, apagamento, portabilidade e oposição ao tratamento dos teus dados. Para exercer qualquer destes direitos, contacta-nos em hello@phlox.health. Respondemos no prazo de 30 dias.',
  },
  {
    title: 'Retenção de dados',
    content: 'Os dados da tua conta são mantidos enquanto tiveres uma conta activa. Se eliminares a conta, os dados pessoais são apagados no prazo de 30 dias. Os dados anónimos e agregados podem ser mantidos indefinidamente.',
  },
  {
    title: 'Segurança',
    content: 'Os dados são encriptados em repouso e em trânsito. Usamos autenticação OAuth 2.0 e não armazenamos palavras-passe. O acesso aos dados é restrito por Row Level Security ao nível da base de dados.',
  },
  {
    title: 'Contacto',
    content: 'Para questões sobre privacidade: hello@phlox.health',
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>
          Política de Privacidade
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Privacidade e Dados
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 40 }}>
          Última actualização: 18 de Abril de 2026
        </p>
        {SECTIONS.map(({ title, content }, i) => (
          <div key={title} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em' }}>
              {title}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, margin: 0 }}>{content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}