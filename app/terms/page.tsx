import { Metadata } from 'next'
import Link from 'next/link'
import { CONTROLLER, MEDICAL_DEVICE_STATEMENT, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Termos e Condições',
  description: 'Termos de utilização e de subscrição da plataforma Phlox Clinical.',
}

const SECTIONS = [
  {
    title: 'Aceitação dos termos',
    content: 'Ao aceder à plataforma Phlox Clinical, aceita estes termos. Se não concordar, não deve usar a plataforma.',
  },
  {
    title: 'Natureza do serviço',
    content: 'A Phlox Clinical é uma ferramenta de organização da informação, de apoio à decisão e de educação na área da saúde. Destina-se a fins educativos, de organização e de apoio informativo. Não constitui aconselhamento médico ou farmacêutico profissional e não substitui a avaliação, o diagnóstico ou o tratamento de um profissional de saúde qualificado.',
  },
  {
    title: 'Não é um dispositivo médico',
    content: `${MEDICAL_DEVICE_STATEMENT.long[1]} ${MEDICAL_DEVICE_STATEMENT.long[2]} Em caso de emergência, contacte o 112. Mais detalhes em /dispositivo-medico.`,
  },
  {
    title: 'Aviso sobre a informação',
    content: 'A informação baseia-se em fontes públicas (por exemplo, INFARMED, EMA, OpenFDA, RxNorm, NIH), em orientações publicadas e em modelos de IA. Pode conter erros, estar desatualizada ou não se aplicar à sua situação. Nunca tome decisões clínicas baseadas apenas nesta plataforma — confirme sempre com um médico ou farmacêutico.',
  },
  {
    title: 'Conta de utilizador',
    content: `É responsável pela confidencialidade da sua conta e por tudo o que nela acontece. Notifique-nos de imediato em caso de uso não autorizado, para ${CONTROLLER.supportEmail}.`,
  },
  {
    title: 'Planos e subscrições',
    content: 'Algumas funcionalidades exigem um plano pago (por exemplo, Plus, Pro ou Institucional). Os pagamentos são processados pela Stripe. As subscrições renovam-se automaticamente no fim de cada período (mensal ou anual), ao preço em vigor, até serem canceladas. Pode cancelar a qualquer momento nas Definições; o cancelamento produz efeitos no fim do período já pago, mantendo o acesso até lá.',
  },
  {
    title: 'Direito de livre resolução e reembolsos',
    content: `Se for consumidor na União Europeia, tem 14 dias de direito de livre resolução após a compra. Como o serviço é digital e de acesso imediato, ao subscrever pode pedir o início imediato da prestação; nesse caso, o direito de livre resolução pode não se aplicar à parte já utilizada, nos termos da lei. Em caso de cobrança indevida ou erro, contacte-nos e resolvemos. Pedidos de reembolso: ${CONTROLLER.supportEmail}.`,
  },
  {
    title: 'Uso aceitável',
    content: 'Compromete-se a não usar a plataforma para fins ilegais, a não tentar contornar limites de utilização, a não fazer recolha automatizada de dados (scraping) e a não usar a plataforma para prejudicar terceiros.',
  },
  {
    title: 'Propriedade intelectual',
    content: 'O código, o design e o conteúdo original da plataforma pertencem à Phlox Clinical. Os dados farmacológicos provêm de fontes públicas, sujeitas às respetivas licenças. Os dados que você ou a sua instituição registam continuam a ser seus.',
  },
  {
    title: 'Limitação de responsabilidade',
    content: 'Na medida máxima permitida por lei, a Phlox Clinical não se responsabiliza por danos indiretos ou consequentes resultantes do uso da plataforma ou da informação nela contida. Nada nestes termos exclui responsabilidades que não possam ser excluídas por lei (por exemplo, perante consumidores).',
  },
  {
    title: 'Alterações aos termos',
    content: 'Podemos atualizar estes termos. Avisamos os utilizadores registados de alterações significativas por email, e a data de "última atualização" reflete a versão em vigor.',
  },
  {
    title: 'Lei aplicável e resolução de litígios',
    content: 'Estes termos são regidos pela lei portuguesa. Sendo consumidor, pode recorrer ao Livro de Reclamações eletrónico e às entidades de Resolução Alternativa de Litígios de Consumo competentes em Portugal, sem prejuízo de recorrer aos tribunais.',
  },
  {
    title: 'Contacto',
    content: `Para questões sobre estes termos: ${CONTROLLER.supportEmail}.`,
  },
]

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>
          Termos de Serviço
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Termos e condições
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
          Última atualização: {LEGAL_UPDATED}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 34 }}>
          {[['/privacy', 'Privacidade'], ['/cookies', 'Cookies'], ['/dispositivo-medico', 'Dispositivo médico']].map(([h, l]) => (
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
