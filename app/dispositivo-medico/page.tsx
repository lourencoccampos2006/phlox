import { Metadata } from 'next'
import Link from 'next/link'
import { MEDICAL_DEVICE_STATEMENT, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Enquadramento — não é um dispositivo médico',
  description: 'Porque é que o Phlox Clinical é uma ferramenta de organização e apoio à decisão, e não um dispositivo médico.',
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'O Phlox faz diagnósticos?',
    a: 'Não. O Phlox não diagnostica, não prevê doenças nem prognostica. Reúne e organiza a informação que você ou a sua equipa registam e destaca o que sai de um padrão definido — para a pessoa qualificada decidir.',
  },
  {
    q: 'Então o que é, ao certo?',
    a: 'É uma ferramenta de organização da informação e de apoio à decisão, e de educação. Ajuda a não deixar escapar o que foi registado, a preparar uma consulta, a perceber uma bula, a estudar farmacologia, a gerir uma instituição. A decisão clínica é sempre de um profissional.',
  },
  {
    q: 'E os alertas e os "sinais"?',
    a: 'Os destaques do Phlox (por exemplo, "este registo saiu do padrão habitual") são determinísticos e transparentes: mostram os dados que a equipa registou a cruzar limiares conhecidos. Não são uma avaliação de risco clínico autónoma — servem para a equipa olhar e decidir.',
  },
  {
    q: 'Isto está enquadrado em alguma lei?',
    a: 'Na União Europeia, o que é um dispositivo médico é definido pelo Regulamento (UE) 2017/745 (MDR). Um software que apenas armazena, organiza, comunica ou apresenta informação — sem finalidade médica própria de diagnóstico, prevenção, monitorização, previsão, prognóstico ou tratamento — geralmente não é, por si só, um dispositivo médico. O Phlox foi desenhado deliberadamente para ficar deste lado da linha.',
  },
  {
    q: 'E a IA?',
    a: 'A IA do Phlox gera texto de apoio e organiza informação. Não toma decisões clínicas nem as substitui. Mantemos a IA num papel de apoio e educação, com avisos claros e sempre com o profissional a decidir.',
  },
  {
    q: 'O que devo fazer numa emergência?',
    a: 'O Phlox não é para emergências. Em caso de emergência, ligue 112.',
  },
]

export default function DispositivoMedicoPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>Enquadramento</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>O Phlox não é um dispositivo médico</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 26 }}>Última atualização: {LEGAL_UPDATED}</p>

        {/* Statement canónico */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '18px 20px', marginBottom: 30 }}>
          {MEDICAL_DEVICE_STATEMENT.long.map((p, i) => (
            <p key={i} style={{ fontSize: 14.5, color: '#14532d', lineHeight: 1.7, margin: i === 0 ? '0 0 10px' : '0 0 10px' }}>{p}</p>
          ))}
        </div>

        {FAQ.map(({ q, a }, i) => (
          <div key={i} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: i < FAQ.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', marginBottom: 8 }}>{q}</h2>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, margin: 0 }}>{a}</p>
          </div>
        ))}

        <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, marginTop: 8 }}>
          Esta página explica a nossa posição e não constitui aconselhamento jurídico. Veja também a{' '}
          <Link href="/privacy" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>privacidade</Link> e os{' '}
          <Link href="/terms" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>termos</Link>.
        </p>
      </div>
    </div>
  )
}
