import { ImageResponse } from 'next/og'

// ╔══════════════════════════════════════════════════════════════════════════
// ║  AS CORES DESTE FICHEIRO SÃO HEX À MÃO, E TÊM DE SER.
// ╚══════════════════════════════════════════════════════════════════════════
// Isto é desenhado pelo Satori (`ImageResponse`), que converte JSX em PNG no
// servidor. O Satori NÃO conhece variáveis CSS: um `var(--green)` não resolve
// para nada, cai em `initial`, e o Satori morre a tentar lê-lo:
//
//     Error: Unexpected token type: word
//       in CSS rule `background: initial`.
//
// Em 2026-10-12 a minha varredura de cores trocou os hex deste ficheiro por
// tokens e a build do Vercel parou — não num aviso, numa PARAGEM: o
// `next build` falha a pré-renderizar a primeira das 425 páginas estáticas.
//
// A guarda `auditoria-design.mjs` isenta o que está dentro de um `<style>` ou
// de um `<html>`, por ser papel ou email. Isto é um terceiro sítio com a mesma
// regra e sem nenhuma dessas marcas: JSX normal, lido por outro motor.
// Ver `semSatori()` em scripts/auditoria-design.mjs.

// Sistema de cartões de marketing PARTILHÁVEIS (1080x1080, formato de post de
// Instagram/Facebook). UM design, muitos cartões — para serem visualmente
// consistentes e profissionais. Cada cartão herda a cor da sua categoria.
//
// Como funciona: cada post tem uma rota /partilhar/<slug> com um
// opengraph-image.tsx de 3 linhas que chama renderShareCard(CARD).
// A definição de cada cartão vive em SHARE_CARDS abaixo.

export const cardSize = { width: 1080, height: 1080 }

export type ShareCard = {
  kicker: string        // etiqueta de topo, ex: "Cuidar de idosos"
  title: string         // título curto e direto (NÃO o título SEO longo)
  items: string[]       // 4-5 factos a numerar
  footer?: string       // linha de baixo; default = marca + blog
  accent: string        // cor de destaque (números, etiqueta)
  accentSoft: string    // fundo dos números (versão escura do accent)
  accentText: string    // cor do texto da etiqueta (versão clara)
}

// Tom: fundo escuro "ink", título grande, factos numerados scannáveis.
// Pensado para ler bem no feed do telemóvel (texto grande, alto contraste).
export function renderShareCard(c: ShareCard) {
  const footer = c.footer ?? 'phloxclinical.com — guia completo no blog'
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: '#0b1120', color: 'white', padding: '76px', fontFamily: 'sans-serif',
        }}
      >
        {/* lockup da marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 38 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: c.accent }} />
          <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: c.accentText }}>
            {`Phlox · ${c.kicker}`}
          </div>
        </div>

        {/* título */}
        <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1, marginBottom: 46, maxWidth: 900 }}>
          {c.title}
        </div>

        {/* factos numerados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {c.items.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 33, color: '#e2e8f0', lineHeight: 1.2 }}>
              <div style={{ minWidth: 44, width: 44, height: 44, borderRadius: 22, background: c.accentSoft, color: c.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, fontWeight: 800 }}>
                {i + 1}
              </div>
              <div style={{ display: 'flex' }}>{s}</div>
            </div>
          ))}
        </div>

        {/* rodapé */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 25, color: '#64748b' }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: c.accent }} />
          {footer}
        </div>
      </div>
    ),
    { ...cardSize },
  )
}

// ── Definições dos cartões, por slug do post ────────────────────────────────
// Título curto (não o SEO), 4-5 factos punchy. Cores alinhadas com a categoria.
export const SHARE_CARDS: Record<string, ShareCard> = {
  'sinais-desidratacao-idosos': {
    kicker: 'Cuidar de idosos',
    title: '5 sinais de desidratação num idoso',
    items: ['Boca e lábios secos', 'Urina escura, pouca', 'Confusão ou sonolência novas', 'Tonturas ao levantar', 'Pele que demora a voltar'],
    accent: '#22d3ee', accentSoft: '#155e63', accentText: '#67e8f9',
  },

  'organizar-medicacao-idoso': {
    kicker: 'Cuidadores',
    title: 'Organizar a medicação de um idoso',
    items: ['Uma caixa semanal com 7 dias', 'Uma lista atualizada de tudo', 'Associar a toma a uma rotina', 'Lembrete no telemóvel', 'Rever com o farmacêutico'],
    accent: '#fbbf24', accentSoft: '#78350f', accentText: '#fcd34d',
  },









  'como-ler-receita-medica': {
    kicker: 'Guia prático',
    title: 'Como ler a tua receita médica',
    items: ['3 códigos: receita, dispensa, opção', 'A SMS chega e já tem tudo', 'DCI é o nome do princípio ativo', 'A farmácia sugere sempre o genérico', 'Guarda a SMS até levantar tudo'],
    accent: '#60a5fa', accentSoft: '#1e3a8a', accentText: '#93c5fd',
  },


  'como-guardar-medicamentos-casa': {
    kicker: 'Em casa',
    title: 'Guardar medicamentos: o essencial',
    items: ['Nunca na casa de banho', 'Local seco, fresco, ao abrigo da luz', 'Confirma o que precisa de frigorífico', 'Prazo muda depois de aberto', 'Devolve na farmácia (VALORMED)'],
    accent: '#22d3ee', accentSoft: '#155e63', accentText: '#67e8f9',
  },
}
