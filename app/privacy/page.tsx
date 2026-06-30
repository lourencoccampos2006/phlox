import { Metadata } from 'next'
import Link from 'next/link'
import { CONTROLLER, SUPERVISORY_AUTHORITY, SUBPROCESSORS, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como a Phlox Clinical recolhe, usa e protege os seus dados pessoais. Conformidade com o RGPD.',
}

const SECTIONS: { title: string; content: string }[] = [
  {
    title: 'Quem é o responsável pelo tratamento',
    content: `A Phlox Clinical (${CONTROLLER.website}) é uma ferramenta de organização e de apoio à decisão na área da saúde, do estudo e dos cuidados. O responsável pelo tratamento dos dados é a entidade que opera a plataforma — ${CONTROLLER.legalEntity}. Para questões de proteção de dados, contacte ${CONTROLLER.privacyEmail}.`,
  },
  {
    title: 'Que dados recolhemos',
    content: 'Dados de conta: nome, email e foto de perfil (se iniciar sessão com Google) ou apenas email (se usar email e palavra-passe). Dados de utilização: que ferramentas usa, para lhe prestar o serviço e melhorar a plataforma. Dados de saúde que você ou a sua equipa registam: por exemplo, medicação, sinais vitais, sintomas, notas de cuidados. Estes são "categorias especiais" de dados (art. 9.º do RGPD) e merecem proteção reforçada.',
  },
  {
    title: 'Com que finalidade e com que base legal',
    content: 'Usamos os dados para lhe prestar o serviço (execução do contrato, art. 6.º/1-b), para cumprir obrigações legais (art. 6.º/1-c) e, quando aplicável, com o seu consentimento (art. 6.º/1-a). Os dados de saúde que regista são tratados com base no seu consentimento explícito (art. 9.º/2-a) ou para os fins de prestação de cuidados quando aplicável (art. 9.º/2-h). Os cookies de publicidade só são usados com o seu consentimento.',
  },
  {
    title: 'Inteligência artificial',
    content: 'Algumas funcionalidades usam modelos de IA de fornecedores externos para gerar texto de apoio (por exemplo, explicar uma bula ou organizar informação). Esses fornecedores tratam apenas o necessário para devolver a resposta e, nos planos de API que usamos, não retêm os dados para treinar os seus modelos. A IA do Phlox organiza e apoia — não toma decisões clínicas. Veja o nosso enquadramento em /dispositivo-medico.',
  },
  {
    title: 'Quem trata os dados por nós (subprocessadores)',
    content: `Não vendemos dados pessoais. Recorremos a fornecedores que tratam dados em nosso nome, sob contratos conformes com o RGPD: ${SUBPROCESSORS.map(s => s.name).join(', ')}. A lista completa, com finalidades e localizações, está em /subprocessadores.`,
  },
  {
    title: 'Transferências internacionais',
    content: 'Alguns fornecedores estão sediados fora do Espaço Económico Europeu (por exemplo, nos EUA). Nesses casos, as transferências são protegidas por Cláusulas Contratuais-Tipo aprovadas pela Comissão Europeia e/ou pelo Data Privacy Framework, conforme indicado na página de subprocessadores.',
  },
  {
    title: 'Os seus direitos (RGPD)',
    content: `Tem direito de acesso, retificação, apagamento, limitação, portabilidade e oposição ao tratamento dos seus dados, e de retirar o consentimento a qualquer momento. Pode exportar os seus dados a partir das Definições. Para exercer qualquer direito, contacte ${CONTROLLER.privacyEmail}; respondemos no prazo de 30 dias. Tem também o direito de apresentar reclamação à autoridade de controlo: ${SUPERVISORY_AUTHORITY.name} (${SUPERVISORY_AUTHORITY.url}).`,
  },
  {
    title: 'Retenção de dados',
    content: 'Mantemos os dados da sua conta enquanto a conta estiver ativa. Se eliminar a conta, os dados pessoais são apagados no prazo de 30 dias, salvo quando a lei exigir a conservação (por exemplo, dados de faturação). Dados anónimos e agregados podem ser mantidos.',
  },
  {
    title: 'Segurança',
    content: 'Os dados são cifrados em trânsito e em repouso. Não armazenamos palavras-passe em texto simples (usamos autenticação segura). O acesso aos dados é restrito ao nível da base de dados por Row Level Security, e a partilha em equipa é limitada à organização a que pertence.',
  },
  {
    title: 'Menores',
    content: 'A plataforma destina-se a maiores de 16 anos. Não recolhemos intencionalmente dados de menores sem o consentimento de quem exerce as responsabilidades parentais. Se tomarmos conhecimento de tal, apagamos os dados.',
  },
  {
    title: 'Cookies',
    content: 'Usamos cookies essenciais ao funcionamento e, com o seu consentimento, cookies de publicidade. Pode gerir a sua escolha a qualquer momento em /cookies.',
  },
  {
    title: 'Alterações e contacto',
    content: `Podemos atualizar esta política; a data de "última atualização" reflete a versão em vigor. Para qualquer questão sobre privacidade, contacte ${CONTROLLER.privacyEmail}.`,
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>
          Política de Privacidade
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Privacidade e dados
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
          Última atualização: {LEGAL_UPDATED}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 34 }}>
          {[['/cookies', 'Cookies'], ['/subprocessadores', 'Subprocessadores'], ['/terms', 'Termos'], ['/dispositivo-medico', 'Dispositivo médico']].map(([h, l]) => (
            <Link key={h} href={h} style={{ fontSize: 12.5, color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>{l} →</Link>
          ))}
        </div>
        {SECTIONS.map(({ title, content }, i) => (
          <div key={title} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
