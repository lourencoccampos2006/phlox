import { Metadata } from 'next'
import Link from 'next/link'
import { SUBPROCESSORS, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Subprocessadores',
  description: 'Lista dos fornecedores que tratam dados em nome da Phlox Clinical, com finalidades e localizações.',
}

const CAT_LABEL: Record<string, string> = {
  infra: 'Infraestrutura', payments: 'Pagamentos', email: 'Email', ai: 'Inteligência artificial', ads: 'Publicidade', media: 'Conteúdo / media',
}

export default function SubprocessadoresPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 820 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>Transparência</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Subprocessadores</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 22 }}>Última atualização: {LEGAL_UPDATED}</p>

        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 28 }}>
          Estes são os fornecedores que tratam dados em nome da Phlox Clinical, ao abrigo de contratos
          conformes com o RGPD. Não vendemos dados pessoais. Os cookies de publicidade só são ativados
          com o seu <Link href="/cookies" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>consentimento</Link>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SUBPROCESSORS.map(s => (
            <div key={s.name} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>{s.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 9px' }}>{CAT_LABEL[s.category]}</span>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 5 }}>{s.purpose}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span>📍 {s.location}</span>
                {s.transfer && <span>🔐 {s.transfer}</span>}
                <a href={s.policyUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>Política de privacidade ↗</a>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, marginTop: 26 }}>
          Para gerar um Contrato de Subcontratação (DPA, Art. 28.º do RGPD) com esta lista, use o{' '}
          <Link href="/trust/dpa" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>gerador de DPA</Link>.
        </p>
      </div>
    </div>
  )
}
