'use client'

// components/NaoEDispositivoMedico.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O aviso que tem de estar em todo o lado onde a IA interpreta saúde.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Havia frases deste género espalhadas por doze prompts de API — dentro das
// respostas da IA, onde ninguém garante que aparecem e onde mudam de redação
// conforme o modelo do dia. Do lado do ecrã, onde a pessoa está mesmo a olhar,
// não havia nada.
//
// Isto é uma questão legal antes de ser de produto: um software que interpreta
// análises e relatórios e não se declara como não sendo dispositivo médico
// está a insinuar que é um. A frase é sempre a mesma, vem de um sítio só, e
// não depende de a IA se lembrar de a escrever.
//
// ── COMO SE USA ────────────────────────────────────────────────────────────
//   <NaoEDispositivoMedico />                    (o normal)
//   <NaoEDispositivoMedico variante="linha" />   (uma linha, para rodapés)
//   <NaoEDispositivoMedico quem="farmaceutico" />
//
// Não é dispensável nem escondível de propósito: não há prop para o desligar.
// ─────────────────────────────────────────────────────────────────────────────

export default function NaoEDispositivoMedico({
  variante = 'caixa',
  quem = 'ambos',
  className,
}: {
  variante?: 'caixa' | 'linha'
  /** a quem mandar a pessoa — nem tudo se resolve no médico */
  quem?: 'ambos' | 'medico' | 'farmaceutico'
  className?: string
}) {
  const conselho =
    quem === 'medico' ? 'o seu médico'
    : quem === 'farmaceutico' ? 'o seu farmacêutico'
    : 'o seu médico ou farmacêutico'

  const texto = `O Phlox não é um dispositivo médico e não substitui uma avaliação clínica. O que aqui aparece é uma ajuda a compreender os seus documentos — decisões sobre tratamento são sempre de ${conselho}.`

  if (variante === 'linha') {
    return (
      <p className={className} style={{
        fontSize: 11.5, color: 'var(--ink-5)', lineHeight: 1.55,
        margin: '10px 0 0', maxWidth: '68ch', textWrap: 'pretty' as any,
      }}>{texto}</p>
    )
  }

  return (
    <div className={className} role="note" style={{
      display: 'flex', gap: 11, alignItems: 'flex-start',
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md, 10px)', padding: '12px 14px',
      margin: '14px 0 0',
    }}>
      <span aria-hidden style={{
        flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
        border: '1.5px solid var(--ink-5)', color: 'var(--ink-5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, marginTop: 1, fontFamily: 'var(--font-serif, Georgia, serif)',
      }}>i</span>
      <p style={{
        margin: 0, fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.6,
        maxWidth: '64ch', textWrap: 'pretty' as any,
      }}>{texto}</p>
    </div>
  )
}
