import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Como organizar a medicação de um idoso em casa | Phlox',
  description: 'Guia prático para cuidadores: como organizar a medicação de um familiar idoso, evitar erros e esquecimentos, usar caixa de comprimidos e lembretes. Sem complicações.',
  openGraph: {
    title: 'Como organizar a medicação de um idoso em casa',
    description: 'Um sistema simples para nunca falhar nem trocar tomas.',
    type: 'article',
  },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 20 }

export default function PostOrganizarMedicacao() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          <span>·</span><span>Cuidadores</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#fffbeb', color: '#b45309', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>CUIDADORES</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Como organizar a medicação de um idoso em casa
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
            Quando um familiar toma 5, 8 ou 10 comprimidos por dia, o risco de trocar, esquecer ou repetir é real. A boa notícia: com um sistema simples, deixa de andar a adivinhar. Aqui está como o montar.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            <span>15 de Junho de 2026</span><span>·</span><span>7 min de leitura</span>
          </div>
        </div>

        <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
          <h2 style={H2}>1. Faz a lista completa — toda</h2>
          <p style={P}>Junta <strong>tudo</strong> o que a pessoa toma: receitados, de venda livre, suplementos e vitaminas. É aqui que aparecem as surpresas — duas embalagens do mesmo medicamento com nomes diferentes (marca vs. genérico), ou um suplemento que ninguém contava. Tira foto a cada caixa ou à receita; é mais rápido e não há erros de transcrição.</p>

          <h2 style={H2}>2. Organiza por hora do dia, não por caixa</h2>
          <p style={P}>O que interessa ao cuidador não é "que medicamentos existem" — é "o que dou agora". Reorganiza a lista por momento: ao pequeno-almoço, ao almoço, ao jantar, ao deitar. Uma <strong>caixa de comprimidos semanal</strong> (com divisórias por dia e por período) é o melhor amigo do cuidador: prepara-se uma vez por semana, com calma, e durante a semana é só seguir.</p>

          <h2 style={H2}>3. Cria um gatilho para cada toma</h2>
          <p style={P}>O esquecimento não se resolve com força de vontade — resolve-se com rotina. Liga cada toma a algo que já acontece: o café da manhã, o noticiário das 20h. Um lembrete no telemóvel reforça. O objetivo é que a toma deixe de depender de "lembrar-se".</p>
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-2)', marginBottom: 4 }}>✓ Dica</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>Marca a toma <strong>depois</strong> de a dar, não antes. Assim, se for interrompido, sabe sempre onde ficou.</div>
          </div>

          <h2 style={H2}>4. Verifica se os medicamentos se dão bem</h2>
          <p style={P}>Quanto mais medicamentos, maior a hipótese de dois se "morderem". Algumas combinações comuns (anticoagulantes com anti-inflamatórios, por exemplo) são perigosas. Não tens de ser farmacêutico — basta verificar a lista de uma vez e levar as dúvidas ao médico ou à farmácia.</p>

          <h2 style={H2}>5. Mantém uma lista atualizada sempre à mão</h2>
          <p style={P}>Numa ida às urgências ou numa consulta nova, a primeira pergunta é "o que toma?". Ter a lista atualizada — com doses e horários — poupa tempo e evita erros graves. Atualiza-a sempre que o médico mudar alguma coisa.</p>

          <h2 style={H2}>O que perguntar ao médico ou farmacêutico</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['"Algum destes pode ser tomado de uma forma mais simples (ex: uma vez por dia)?"', '"Há algum que já se possa deixar de tomar?"', '"Estes medicamentos dão-se todos bem uns com os outros?"'].map(q => (
              <li key={q} style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, fontStyle: 'italic' }}>{q}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 48, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Organiza a medicação da tua família no Phlox</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>Tira foto às caixas, cria a lista com horários e lembretes, e verifica interações — para ti e para quem cuidas.</p>
          <Link href="/scan" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Começar com uma foto →</Link>
        </div>

        <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
            Conteúdo educativo para cuidadores. Não substitui o aconselhamento do médico ou farmacêutico. Qualquer alteração à medicação deve ser confirmada com um profissional.
          </p>
        </div>
      </article>
    </div>
  )
}
