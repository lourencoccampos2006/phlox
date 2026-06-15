import { ImageResponse } from 'next/og'

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

  'interacoes-comuns-a-evitar': {
    kicker: 'Interações',
    title: 'Interações perigosas a evitar',
    items: ['Varfarina + ibuprofeno', 'Estatinas + alguns antibióticos', 'Metformina + contraste', 'IECA + anti-inflamatórios', 'Hipericão + a pílula'],
    accent: '#f87171', accentSoft: '#7f1d1d', accentText: '#fca5a5',
  },

  'ibuprofeno-varfarina': {
    kicker: 'Interações',
    title: 'Ibuprofeno + Varfarina: porquê o perigo',
    items: ['Aumenta o risco de hemorragia', 'Os dois "afinam" o sangue', 'Pode causar úlcera a sangrar', 'Há analgésicos mais seguros', 'Fala sempre com o farmacêutico'],
    accent: '#f87171', accentSoft: '#7f1d1d', accentText: '#fca5a5',
  },

  'dose-paracetamol-crianca': {
    kicker: 'Pediatria',
    title: 'Paracetamol em crianças: o essencial',
    items: ['A dose é pelo PESO, não pela idade', '15 mg por kg, cada 6-8h', 'Nunca passar 4 tomas por dia', 'Usa a seringa que vem na caixa', 'Febre > 3 dias → ao médico'],
    accent: '#fbbf24', accentSoft: '#78350f', accentText: '#fcd34d',
  },

  'metformina-alcool': {
    kicker: 'Diabetes',
    title: 'Metformina e álcool: o que saber',
    items: ['Beber muito aumenta o risco raro de acidose', 'Pode baixar o açúcar demais', 'Um copo ocasional com comida é menos arriscado', 'Nunca em jejum', 'Fala com o teu médico'],
    accent: '#34d399', accentSoft: '#064e3b', accentText: '#6ee7b7',
  },

  'antibioticos-em-gravidez': {
    kicker: 'Gravidez',
    title: 'Antibióticos na gravidez',
    items: ['Penicilinas: geralmente seguras', 'Tetraciclinas: a evitar', 'Nunca te automedicar', 'O risco da infeção também conta', 'Decide sempre com o médico'],
    accent: '#a78bfa', accentSoft: '#4c1d95', accentText: '#c4b5fd',
  },

  'hipericao-medicamentos': {
    kicker: 'Suplementos',
    title: 'Hipericão: "natural" não é inofensivo',
    items: ['Reduz o efeito da pílula', 'Mexe com antidepressivos', 'Reduz anticoagulantes', 'Interfere com remédios do coração', 'Avisa sempre o farmacêutico'],
    accent: '#fbbf24', accentSoft: '#78350f', accentText: '#fcd34d',
  },

  'medicamentos-idosos-lista-beers': {
    kicker: 'Geriatria',
    title: 'Medicamentos a vigiar em idosos',
    items: ['Calmantes para dormir (benzodiazepinas)', 'Anti-inflamatórios de uso prolongado', 'Alguns anti-alérgicos antigos', 'Doses altas sem revisão', 'Rever a lista todos os anos'],
    accent: '#60a5fa', accentSoft: '#1e3a8a', accentText: '#93c5fd',
  },

  'ajuste-dose-insuficiencia-renal': {
    kicker: 'Renal',
    title: 'Dose e rins: quando ajustar',
    items: ['Rins fracos = fármaco acumula', 'A dose normal pode ser demais', 'Muitos antibióticos precisam de ajuste', 'Hidratação conta muito', 'O médico calcula pela função renal'],
    accent: '#22d3ee', accentSoft: '#155e63', accentText: '#67e8f9',
  },
}
