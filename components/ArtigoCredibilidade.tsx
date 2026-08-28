// ArtigoCredibilidade.tsx — o bloco que diz ao leitor, e ao Google, quem
// responde pelo que está escrito no artigo.
//
// Vai no fim de cada artigo de saúde. Diz três coisas, todas verdadeiras:
//   quem edita · quando foi revisto pela última vez · em que fontes assenta
//
// Se houver revisor clínico (lib/autoria.ts), aparece. Se não houver, o bloco
// NÃO finge que houve — diz o que é, e o aviso de que não substitui um
// profissional fica mais visível. Prometer uma revisão que não aconteceu, num
// artigo sobre doses de medicamentos, é pior do que não ter revisão nenhuma.

import { EDITOR, REVISOR_CLINICO, type Fonte } from '@/lib/autoria'

const INK_3 = 'var(--ink-3)'
const INK_4 = 'var(--ink-4)'

export default function ArtigoCredibilidade({
  revistoEm,
  fontes,
}: {
  /** Data ISO da última revisão a sério do texto. */
  revistoEm: string
  fontes: Fonte[]
}) {
  const data = new Date(revistoEm).toLocaleDateString('pt-PT', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <aside
      style={{
        marginTop: 48,
        padding: '22px 24px',
        border: '1px solid var(--border)',
        borderRadius: 3,
        background: 'var(--bg-2)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13.5,
        lineHeight: 1.65,
        color: INK_3,
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: INK_4, fontWeight: 700,
          margin: '0 0 14px',
        }}
      >
        Sobre este artigo
      </h2>

      <p style={{ margin: '0 0 10px' }}>
        Editado por{' '}
        {EDITOR.url
          ? <a href={EDITOR.url} style={{ color: 'var(--green)', textDecoration: 'none' }} rel="author">{EDITOR.nome}</a>
          : EDITOR.nome}
        , {EDITOR.papel}. Última revisão a {data}.
      </p>

      {REVISOR_CLINICO ? (
        <p style={{ margin: '0 0 10px' }}>
          Revisto clinicamente por {REVISOR_CLINICO.nome}, {REVISOR_CLINICO.papel}
          {REVISOR_CLINICO.cedula ? ` (cédula ${REVISOR_CLINICO.cedula})` : ''}.
        </p>
      ) : (
        <p style={{ margin: '0 0 10px' }}>
          Este texto não foi revisto por um profissional de saúde. Assenta nas
          fontes indicadas abaixo e serve para se informar — não para decidir
          sozinho.
        </p>
      )}

      {fontes.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: INK_3, margin: '16px 0 7px' }}>
            Fontes
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {fontes.map((f) => (
              <li key={f.url} style={{ marginBottom: 4 }}>
                <a href={f.url} target="_blank" rel="noopener noreferrer nofollow"
                   style={{ color: 'var(--green)', textDecoration: 'none' }}>
                  {f.nome}
                </a>
                {' — '}{f.descricao}
              </li>
            ))}
          </ul>
        </>
      )}

      <p style={{ margin: '16px 0 0', fontSize: 12.5, color: INK_4 }}>
        Fale com o seu médico ou farmacêutico antes de mudar qualquer
        medicação. O Phlox é uma ferramenta de organização e apoio — não é um
        dispositivo médico e não substitui uma consulta.
      </p>
    </aside>
  )
}
