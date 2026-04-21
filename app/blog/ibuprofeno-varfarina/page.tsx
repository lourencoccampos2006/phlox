import Header from '@/components/Header'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Posso tomar ibuprofeno com varfarina? — Phlox',
  description: 'Ibuprofeno e varfarina juntos podem causar hemorragia grave. Explica o mecanismo, o risco real, e o que podes tomar em alternativa. Verificado com dados FDA.',
  openGraph: {
    title: 'Posso tomar ibuprofeno com varfarina?',
    description: 'Uma das interações mais perigosas e mais comuns em Portugal.',
    type: 'article',
  },
}

export default function PostIbuprofenWarfarin() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          <span>·</span>
          <span>Interações</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#fff5f5', color: '#dc2626', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>INTERAÇÕES</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Posso tomar ibuprofeno com varfarina?
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
            Resposta curta: <strong>não</strong>. Esta combinação pode causar hemorragia grave. Mas a resposta completa — o porquê, o risco real, e o que podes tomar em alternativa — é o que este artigo explica.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            <span>1 de Abril de 2026</span>
            <span>·</span>
            <span>4 min de leitura</span>
            <span>·</span>
            <span>Verificado com dados FDA/RxNorm</span>
          </div>
        </div>

        {/* Alert box */}
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.08em', marginBottom: 6 }}>⚠ INTERAÇÃO GRAVE</div>
          <p style={{ fontSize: 14, color: '#742a2a', lineHeight: 1.7, margin: 0 }}>
            Ibuprofeno + varfarina é uma interação classificada como <strong>grave</strong> pela FDA e pelo RxNorm. Pode aumentar significativamente o risco de hemorragia gastrointestinal e outros sangramentos.
          </p>
        </div>

        {/* Content */}
        <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }}>O que é a varfarina e como funciona</h2>
          <p style={{ marginBottom: 20 }}>
            A varfarina é um anticoagulante — um medicamento que "afina o sangue" para prevenir coágulos. É usada em pessoas com fibrilhação auricular, próteses valvulares, ou historial de trombose. Funciona inibindo a vitamina K, que o fígado precisa para produzir factores de coagulação.
          </p>
          <p style={{ marginBottom: 20 }}>
            O problema da varfarina é que tem uma <strong>janela terapêutica muito estreita</strong> — a dose tem de ser exacta. Demasiado pouca e não protege. Demasiada e há risco de hemorragia. É por isso que quem toma varfarina faz análises regulares (INR) para ajustar a dose.
          </p>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }}>Por que o ibuprofeno é perigoso com varfarina</h2>
          <p style={{ marginBottom: 20 }}>
            Dois mecanismos independentes tornam esta combinação perigosa.
          </p>
          <p style={{ marginBottom: 20 }}>
            <strong>Primeiro:</strong> o ibuprofeno inibe as plaquetas. As plaquetas são as células que formam o "tampão" inicial quando há um corte. Com ibuprofeno, esse mecanismo fica comprometido — e com a varfarina a inibir a coagulação secundária, o corpo perde as duas linhas de defesa ao mesmo tempo.
          </p>
          <p style={{ marginBottom: 20 }}>
            <strong>Segundo:</strong> o ibuprofeno irrita a mucosa gástrica e pode causar úlceras ou micro-hemorragias no estômago. Normalmente o corpo coagula rapidamente esses pequenos sangramentos. Com varfarina, não consegue — e o que seria uma irritação minor transforma-se numa hemorragia que pode necessitar de urgência.
          </p>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }}>Qual é o risco real?</h2>
          <p style={{ marginBottom: 20 }}>
            Estudos mostram que doentes anticoagulados que tomam ibuprofeno têm 3 a 5 vezes mais risco de hospitalização por hemorragia gastrointestinal. O risco é maior nas primeiras semanas de combinação, em idosos, e em pessoas com história de úlcera péptica.
          </p>
          <p style={{ marginBottom: 20 }}>
            Não é um risco teórico — é uma das causas mais comuns de admissão hospitalar por efeito adverso medicamentoso em Portugal.
          </p>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }}>O que podes tomar em alternativa</h2>
          <p style={{ marginBottom: 16 }}>
            Para dor e febre, a alternativa segura é o <strong>paracetamol</strong>. Não inibe plaquetas, não irrita a mucosa gástrica, e não tem interação clinicamente significativa com a varfarina nas doses normais (até 2g/dia). É a opção recomendada pela maioria das guidelines internacionais para doentes anticoagulados.
          </p>
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-2)', marginBottom: 4 }}>✓ Alternativa recomendada</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              <strong>Paracetamol</strong> até 2g/dia — seguro com varfarina nas doses habituais. Para doses mais altas ou uso prolongado, confirma sempre com o teu médico ou farmacêutico.
            </div>
          </div>
          <p style={{ marginBottom: 20 }}>
            Para dor inflamatória específica (artrite, lesão muscular), onde o efeito anti-inflamatório do ibuprofeno é necessário, tem de ser o médico a decidir — em alguns casos pode ser considerado com monitorização intensiva do INR, mas nunca em automedicação.
          </p>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }}>O que dizer ao médico</h2>
          <p style={{ marginBottom: 16 }}>Se tomares varfarina, diz sempre ao médico, farmacêutico e dentista antes de qualquer medicamento novo. Incluindo os que não precisam de receita. Pergunta especificamente:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              '"Este medicamento interage com a minha varfarina?"',
              '"Preciso de medir o INR mais cedo depois de o tomar?"',
              '"Qual é a alternativa mais segura para a minha situação?"',
            ].map(q => (
              <li key={q} style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, fontStyle: 'italic' }}>{q}</li>
            ))}
          </ul>
        </div>

        {/* CTA to tool */}
        <div style={{ marginTop: 48, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Verifica as tuas interações em segundos
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>
            O verificador da Phlox analisa todos os teus medicamentos ao mesmo tempo e identifica interações com mecanismo e recomendação.
          </p>
          <Link href="/interactions"
            style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Verificar interações grátis →
          </Link>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
            Este artigo destina-se a fins informativos e educativos. Não substitui o aconselhamento de um profissional de saúde. Confirma sempre a tua medicação com o teu médico ou farmacêutico. Dados baseados em FDA, RxNorm e NIH.
          </p>
        </div>
      </article>
    </div>
  )
}