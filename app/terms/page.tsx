import Header from '@/components/Header'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos e Condições | Phlox Clinical',
  description: 'Termos de serviço da plataforma farmacológica Phlox Clinical.',
}

const SECTIONS = [
  {
    title: 'Aceitação dos termos',
    content: 'Ao acederes à plataforma Phlox Clinical, aceitas estes termos de serviço. Se não concordares, não deves usar a plataforma.',
  },
  {
    title: 'Natureza do serviço',
    content: 'A Phlox Clinical é uma plataforma de informação farmacológica educacional. A informação disponibilizada destina-se a fins educativos e de apoio à decisão clínica. Não constitui aconselhamento médico ou farmacêutico profissional e não substitui a consulta de um profissional de saúde qualificado.',
  },
  {
    title: 'Aviso médico',
    content: 'A informação clínica disponibilizada baseia-se em bases de dados públicas (OpenFDA, RxNorm, NIH) e em modelos de linguagem de IA. Pode conter erros, estar desactualizada, ou não ser aplicável à situação específica do utilizador. Nunca tomes decisões clínicas baseadas exclusivamente nesta plataforma. Consulta sempre um médico ou farmacêutico.',
  },
  {
    title: 'Conta de utilizador',
    content: 'És responsável pela confidencialidade da tua conta e por todas as actividades realizadas com ela. Deves notificar-nos imediatamente em caso de uso não autorizado em hello@phlox.health.',
  },
  {
    title: 'Uso aceitável',
    content: 'Comprometes-te a não usar a plataforma para fins ilegais, a não tentar contornar limitações de uso, a não fazer scraping automatizado de dados, e a não usar a plataforma para prejudicar terceiros.',
  },
  {
    title: 'Propriedade intelectual',
    content: 'O código, design e conteúdo original da plataforma são propriedade da Phlox Clinical. Os dados farmacológicos são provenientes de fontes públicas e estão sujeitos às respectivas licenças.',
  },
  {
    title: 'Limitação de responsabilidade',
    content: 'A Phlox Clinical não se responsabiliza por danos directos, indirectos, ou consequentes resultantes do uso da plataforma ou da informação nela contida. O uso da plataforma é da inteira responsabilidade do utilizador.',
  },
  {
    title: 'Alterações aos termos',
    content: 'Podemos actualizar estes termos ocasionalmente. Notificaremos os utilizadores registados de alterações significativas por email.',
  },
  {
    title: 'Lei aplicável',
    content: 'Estes termos são regidos pela lei portuguesa. Qualquer litígio será submetido aos tribunais competentes de Portugal.',
  },
  {
    title: 'Contacto',
    content: 'Para questões sobre estes termos: hello@phlox.health',
  },
]

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>
          Termos de Serviço
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Termos e Condições
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