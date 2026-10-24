'use client'

// components/ui/mesa.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A LINGUAGEM DO DESENHO D, extraída para peças.
//
// ── A ORDEM CERTA, DESTA VEZ ───────────────────────────────────────────────
// Na semana 1 fiz ao contrário: construí peças e só depois desenhei com elas.
// As peças trouxeram dentro o aspeto antigo, e os desenhos saíram iguais ao
// que já havia. O Fernando disse-o em três palavras: «está igual a antes».
//
// Agora o desenho existe, está aprovado, e é DELE que estas peças saem —
// linha a linha do `components/o-dia/DesenhoD.tsx`.
//
// ── O QUE FAZ UM PROGRAMA PARECER SÉRIO ────────────────────────────────────
//   1. Densidade com estrutura: muita informação, alinhada em colunas.
//   2. Zero emoji. Códigos de três letras com cor própria.
//   3. Monoespaçada em tudo o que é número — horas, doses, quartos, contagens.
//   4. Linhas finas, não sombras. Uma sombra diz «cartão»; um filete diz
//      «tabela», e uma tabela parece um instrumento.
//   5. Quatro cores de estado, com significado fixo e legenda.
//   6. A mesa tem a altura da janela e o conteúdo rola por dentro. Uma página
//      que rola é um documento; isto é um programa.
//
// ── O QUE ESTAS PEÇAS NÃO ACEITAM ──────────────────────────────────────────
// `style`, `className`, cor, tamanho ou espaçamento por fora. Se não servem,
// muda-se a peça — e a mudança aparece em todas as páginas ao mesmo tempo,
// que é a única razão de elas existirem.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'

/* ══════════════════════════════════════════════════════════════════════════
   OS ESTILOS DE BASE
   ══════════════════════════════════════════════════════════════════════════ */

/** Tudo o que é número. Alinha em coluna e lê-se de relance. */
export const MONO: CSSProperties = {
  fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
}

/** O rótulo de uma coluna ou de uma secção. */
export const ROTULO: CSSProperties = {
  ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.12em', textTransform: 'uppercase',
  color: 'var(--ink-4)', fontWeight: 'var(--peso-forte)' as any,
}

export type Tom = 'bom' | 'atencao' | 'mau' | 'neutro'

export const COR: Record<Tom, string> = {
  bom: 'var(--green)', atencao: 'var(--amber)', mau: 'var(--red)', neutro: 'var(--ink-4)',
}

/* ══════════════════════════════════════════════════════════════════════════
   A MESA
   ══════════════════════════════════════════════════════════════════════════
   O invólucro de uma página de trabalho: altura da janela no computador,
   página normal no telemóvel.

   ── A ARITMÉTICA QUE JÁ CORREU MAL UMA VEZ ────────────────────────────────
   A altura MEDE-SE, não se adivinha. A moldura desta aplicação tem duas
   barras (58 + 50 = 108px), e um `100vh - 58px` escrito à mão deixava a
   coluna da esquerda 50px mais alta do que a janela — o que fazia a página
   inteira rolar 50px em TODAS as páginas do site. Parecia um erro de
   espaçamento; era aritmética.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O ecrã é largo o suficiente para duas colunas?
 *
 * O MESMO corte que a `Mesa` usa, e por isso vive aqui: duas páginas com dois
 * cortes diferentes mudam de forma em alturas diferentes, e quem arrasta a
 * janela vê uma a partir-se antes da outra sem perceber porquê.
 */
export function useLargo(): boolean {
  const [largo, setLargo] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1040px)')
    const ver = () => setLargo(mq.matches)
    ver(); mq.addEventListener('change', ver)
    return () => mq.removeEventListener('change', ver)
  }, [])
  return largo
}

export function Mesa({ barra, rodape, children, altura = 'janela' }: {
  /** A barra de trabalho do topo: onde está, filtros, totais. Fica fixa. */
  barra?: ReactNode
  /** A barra de estado do fundo: a legenda. Fica colada ao fundo da janela. */
  rodape?: ReactNode
  children: ReactNode
  /**
   * MESA DE TRABALHO ou DOCUMENTO?
   *
   * `janela` (o que quase todas as páginas são): uma ou duas listas que rolam
   * POR DENTRO, com a barra de estado colada ao fundo. O /o-dia, o /mar, as
   * /patients. A altura da janela é o enquadramento.
   *
   * `documento`: uma sequência de secções que se lê de cima a baixo — as
   * /estatisticas, com oito painéis empilhados. Aqui limitar à altura da
   * janela não é enquadramento, é uma tesoura: os oito painéis dividiam
   * entre si o espaço e cada um ficava com uma fatia onde cabia o cabeçalho
   * e meia linha de número.
   */
  altura?: 'janela' | 'documento'
}) {
  const raiz = useRef<HTMLDivElement>(null)
  const [alturaPx, setAlturaPx] = useState<number | null>(null)
  const [largo, setLargo] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1040px)')
    const medir = () => {
      setLargo(mq.matches)
      const topo = raiz.current?.getBoundingClientRect().top ?? 0
      // `innerHeight` e não `100vh`: no telemóvel o `vh` conta a barra do
      // browser que desaparece ao rolar, e a mesa ficava sempre mais alta
      // do que o ecrã.
      setAlturaPx(Math.max(420, window.innerHeight - topo - 4))
    }
    medir()
    mq.addEventListener('change', medir)
    window.addEventListener('resize', medir)
    return () => { mq.removeEventListener('change', medir); window.removeEventListener('resize', medir) }
  }, [])

  return (
    /* `maxHeight` e não `height` (2026-10-07).
       Com altura fixa, uma página de sete linhas tinha meio ecrã de chão
       cinzento entre o último painel e a barra de estado — trocava-se um
       vazio dentro da caixa por um vazio por baixo dela. Assim a mesa cresce
       com o que tem: cheia, é a janela e rola por dentro; curta, é curta. */
    <div ref={raiz} className="mesa-chao" style={{
      background: 'var(--chao)',
      maxHeight: largo && alturaPx && altura === 'janela' ? alturaPx : undefined,
      padding: largo ? '0 clamp(10px, 1.2vw, 16px) 0' : '0 clamp(12px, 2vw, 20px) 48px',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxSizing: 'border-box', color: 'var(--ink)',
    }}>
      {barra}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        flex: '1 1 auto', minHeight: 0,
        /* Num documento o conteúdo não é limitado: cada painel tem a altura
           do que tem, e é a PÁGINA que rola. A classe desliga o
           `maxHeight: 100%` dos painéis lá dentro. */
        ...(altura === 'documento' ? { minHeight: undefined } : null),
      }} className={altura === 'documento' ? 'mesa-documento' : undefined}>
        {children}
      </div>
      {rodape}
    </div>
  )
}

/**
 * A barra de trabalho do topo da mesa.
 *
 * A classe `.mesa-barra` nao e decoracao: garante que nenhum filho e mais
 * largo do que a barra, e que um filho que seja um grupo de botoes quebra de
 * linha por dentro. Sem isso, na /equipa dois botoes de 215px somavam 430 e
 * punham a pagina inteira a rolar de lado a 390px.
 */
export function BarraDeTrabalho({ children }: { children: ReactNode }) {
  return (
    <div className="mesa-barra" style={{
      background: 'var(--bg)', border: '1px solid var(--border)', borderTop: 'none',
      borderRadius: '0 0 var(--r-md) var(--r-md)', padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', flexShrink: 0,
      maxWidth: '100%', boxSizing: 'border-box',
    }}>{children}</div>
  )
}

/**
 * A barra de estado do fundo. É aqui que vive a legenda.
 *
 * ── UMA LINHA, E SÓ UMA (2026-10-07) ──────────────────────────────────────
 * Tinha `flexWrap: 'wrap'`. A advertência regulatória da /radar tem 180
 * caracteres: a barra crescia para três linhas, comia a mesa por baixo, e a
 * última linha ficava escondida atrás do botão redondo que flutua no canto.
 *
 * Uma barra de estado é uma linha. Se a legenda não cabe numa linha, não é
 * legenda — é texto, e texto vive no `Vazio` ou num `title`. Esta regra é o
 * que obriga a escrever legendas curtas, e por isso fica na peça.
 *
 * O `paddingRight` grande no computador é para o botão do copiloto, que
 * flutua por cima do canto inferior direito de todas as páginas.
 */
export function BarraDeEstado({ children }: { children: ReactNode }) {
  /* Isto e a legenda de uma TABELA: diz o que querem dizer as colunas. No
     telemovel a `LinhaTabela` deixa de ser uma tabela — cada numero leva o
     seu rotulo ao lado — e a legenda fica sem nada para explicar. A 390px
     dava quatro reticencias («A função… DONO … CONV… Acessos …») numa linha
     inteira. Nao se encolhe: sai. */
  const largo = useLargo()
  if (!largo) return null
  return (
    /* A classe nao e decoracao: o `textOverflow` de um contentor nao corta os
       FILHOS, corta o texto directo. Sem a regra `.mesa-estado > *` a ultima
       legenda transbordava para fora do painel em vez de acabar em «…». */
    <div className="mesa-estado" style={{
      display: 'flex', gap: 16, flexWrap: 'nowrap', alignItems: 'center',
      padding: '6px 14px', paddingRight: 84, background: 'var(--bg)', flexShrink: 0,
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
      overflow: 'hidden', whiteSpace: 'nowrap',
    }}>{children}</div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   O PAINEL
   ══════════════════════════════════════════════════════════════════════════
   Cabeçalho que não foge, corpo que rola, rodapé colado ao fundo. É a forma
   de qualquer coisa que se consulta enquanto se trabalha. */

/**
 * ── A ALTURA DE UM PAINEL É A DO QUE ELE TEM (2026-10-07) ─────────────────
 * Esticavam todos até ao fundo da janela. Na /carga, sete dias de escala
 * ficavam com 400px de nada por baixo; na /radar, um «Escolha uma pessoa» de
 * três linhas flutuava no meio de uma caixa de 800px.
 *
 * `alignSelf: 'start'` + `maxHeight: '100%'` resolve os dois casos sem
 * decisão por página: sete linhas são sete linhas, e sessenta linhas enchem
 * a mesa e rolam por dentro.
 */
export function Painel({ cabeca, rodape, children }: {
  cabeca?: ReactNode
  rodape?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mesa-painel" style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      /* `alignSelf: 'start'` + `width: '100%'`, e os dois sao precisos.
         Numa GRELHA, o `start` alinha ao topo e da-lhe a altura do conteudo.
         Numa COLUNA flex, porem, o eixo cruzado e o HORIZONTAL — e o `start`
         sozinho encolhia o painel a largura do texto. Vi a /patients com a
         tabela a ocupar dois tercos do ecra por causa disto. O `width: 100%`
         devolve a largura sem desfazer o que o `start` faz na grelha. */
      alignSelf: 'start', width: '100%', maxHeight: '100%',
    }}>
      {cabeca && <div style={{ flexShrink: 0 }}>{cabeca}</div>}
      <div className="mesa-painel-corpo" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
      {rodape && (
        <div style={{
          flexShrink: 0, padding: '8px 16px', background: 'var(--bg-2)',
          borderTop: '1px solid var(--border)', fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>{rodape}</div>
      )}
    </div>
  )
}

/** A fila de cabeçalhos de uma tabela. Não foge ao rolar. */
export function Cabecalho({ children }: { children: ReactNode }) {
  /* No telemovel a `LinhaTabela` deixa de ser uma fila e passa a duas linhas
     com os rotulos junto a cada numero. Um cabecalho de colunas por cima de
     linhas que ja nao sao colunas so engana — por isso some-se. */
  const largo = useLargo()
  if (!largo) return null
  return (
    <div className="mesa-cabecalho" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 12px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg-2)',
    }}>{children}</div>
  )
}

/** Uma celula de `LinhaTabela`: um numero com o rotulo que o nomeia. */
export interface Celula {
  /** O nome da coluna. No computador vive no `Cabecalho`; no telemovel vem aqui. */
  rotulo: string
  valor: ReactNode
  /** A largura da coluna no computador. */
  largura: number
  cor?: string
  forte?: boolean
  /** Alinhar o numero a direita, que e como os numeros se comparam. */
  direita?: boolean
  /** Esconder no telemovel: colunas que so fazem sentido na vista larga. */
  soLargo?: boolean
}

/**
 * UMA LINHA DE TABELA QUE SABE QUE UM TELEMOVEL NAO E UMA TABELA.
 *
 * Computador: `[antes] nome · detalhe | celula | celula | celula [fim]`
 * Telemovel:  `[antes] nome · detalhe [fim]`
 *             `RÓTULO valor   RÓTULO valor   RÓTULO valor`
 *
 * Porque e que isto existe: a /patients a 390px tinha 512px de colunas de
 * largura fixa e esmagou o nome — que era o unico `flex: 1` — a zero. O ecra
 * ficou com oito linhas de numeros e nenhum nome.
 */
export function LinhaTabela({
  principal, secundaria, antes, celulas = [], fim,
  aoTocar, href, ativa, filete,
}: {
  principal: ReactNode
  secundaria?: ReactNode
  /** O que vai antes do nome: um codigo, um quarto, uma hora. */
  antes?: { conteudo: ReactNode; largura: number }
  celulas?: Celula[]
  /** O que vai depois das celulas: botoes, uma marca. */
  fim?: ReactNode
  aoTocar?: () => void
  href?: string
  ativa?: boolean
  /** A cor do filete da esquerda. Sem ela, nao ha filete. */
  filete?: string
}) {
  const largo = useLargo()

  /* ── NO TELEMÓVEL ISTO NÃO É UMA LINHA DE TABELA: É UM CARTÃO ───────────
     «Em telemóvel o design tem de ser completamente novo (…) em mobile
      continua péssimo.» (Fernando, 2026-10-14)

     Da primeira vez comprimi: menos espaço, menos padding, menos intervalo.
     Estava errado, e ele disse-o outra vez. Comprimir não é redesenhar —
     uma linha de tabela comprimida continua a ser uma linha de tabela, e uma
     tabela num ecrã de 390px não é uma tabela: é uma pilha de texto com
     hairlines a fingir que são colunas.

     O que um telemóvel faz bem é o cartão: uma coisa de cada vez, com
     fronteira própria, espaço a sério por dentro e um alvo grande. É o
     contrário do que fiz da primeira vez — e é por isso que o padding SOBE
     aqui enquanto desce em todo o resto.

     No computador nada muda: lá a tabela está certa e é o que ele gosta. */
  const estilo: CSSProperties = largo ? {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', textAlign: 'left', boxSizing: 'border-box',
    flexDirection: 'row', padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    borderLeft: `3px solid ${ativa ? 'var(--green)' : filete || 'transparent'}`,
    borderTop: 'none', borderRight: 'none',
    background: ativa ? 'var(--green-light)' : 'transparent',
    fontFamily: 'inherit', color: 'var(--ink)',
    cursor: aoTocar || href ? 'pointer' : 'default',
    textDecoration: 'none',
  } : {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    width: '100%', textAlign: 'left', boxSizing: 'border-box',
    flexDirection: 'column',
    padding: '13px 14px',
    border: '1px solid var(--border)',
    borderLeft: `3px solid ${ativa ? 'var(--green)' : filete || 'var(--border)'}`,
    borderRadius: 'var(--r-md)',
    marginBottom: 7,
    background: ativa ? 'var(--green-light)' : 'var(--bg)',
    fontFamily: 'inherit', color: 'var(--ink)',
    cursor: aoTocar || href ? 'pointer' : 'default',
    textDecoration: 'none',
  }

  /* O `fim` sai do `nome` quando a linha e clicavel — ver a nota la em baixo
     sobre o botao dentro do botao. */
  const fimDentro = !(href || aoTocar)

  /* O `antes` e um no de JSX e nao um valor — nao da para lhe perguntar se
     esta vazio. O que da para perguntar e se o TEXTO que ele contem e so um
     travessao, que e como as paginas escrevem «nao ha». Vale para o
     `<span>{p.room_number || '—'}</span>` da /patients, que e o caso que isto
     existe para apanhar. */
  const antesVazio = (() => {
    const c: any = antes?.conteudo
    const t = c?.props?.children
    return t === '—' || t === null || t === undefined || t === ''
  })()

  const nome = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: largo ? 1 : undefined, width: largo ? undefined : '100%' }}>
      {/* No telemovel, um `antes` vazio nao se desenha. Na /patients o `antes`
          e o numero do quarto, e numa casa onde ninguem tem quarto preenchido
          dava uma coluna de travessoes a toda a altura da lista — a primeira
          coisa que o olho encontra em cada linha, a dizer que nao ha nada.
          Na vista larga fica: la ha uma coluna, e um travessao alinhado com
          os numeros das outras linhas diz-se a si proprio. */}
      {antes && (largo || !antesVazio) && (
        <span style={{ width: largo ? antes.largura : undefined, flexShrink: 0 }}>{antes.conteudo}</span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        {/* Num cartão, o nome é o título do cartão — e um título a 14,5px
            lido de pé, com o telemóvel a meio metro, é pequeno. */}
        {/* ── NUM CARTÃO, O TÍTULO NÃO SE CORTA ────────────────────────────
            A vista larga trunca com `nowrap` + reticências, e lá está certo:
            uma coluna de tabela tem largura fixa e o resto da linha precisa
            do espaço.

            No telemóvel isso estava a cortar nomes — e a fazer a página rolar
            de lado. «Animador sociocultural ou educador social» a 19px mede
            378px num cartão de 374: com `nowrap`, essa frase passa a ser a
            largura MÍNIMA do cartão, o cartão empurra a grelha, e a /equipa
            inteira ganhava 28px de rolamento horizontal. Medido a 390px.

            Um cartão tem altura à vontade e largura nenhuma a dar. Por isso
            o título passa a quebrar em vez de ser cortado, e o `anywhere`
            parte também o que não tem espaços — um email de 38 caracteres,
            que é o caso que se vê nesta mesma página. */}
        <span style={{
          display: 'block',
          fontSize: largo ? 'var(--t-corpo)' : 'var(--t-destaque)',
          lineHeight: largo ? undefined : 1.25,
          fontWeight: 'var(--peso-corpo)' as any,
          overflow: 'hidden',
          ...(largo
            ? { textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
            : { overflowWrap: 'anywhere' as const }),
        }}>{principal}</span>
        {secundaria && (
          <span style={{
            display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 2,
            overflow: 'hidden',
            ...(largo
              ? { textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
              /* A secundária quebra, mas para em duas linhas: é contexto, e
                 um parágrafo inteiro por baixo de cada nome afogava a lista.
                 Duas linhas com reticências dizem que há mais; uma linha
                 cortada a meio da primeira palavra não dizia nada. */
              : {
                overflowWrap: 'anywhere' as const,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
              }),
          }}>{secundaria}</span>
        )}
      </span>
      {fim && fimDentro && !largo && <span style={{ flexShrink: 0, display: 'flex', gap: 6 }}>{fim}</span>}
    </span>
  )

  /* ── NO TELEMOVEL, UMA CELULA VAZIA NAO SE ESCREVE ──────────────────────
     Na vista larga, uma coluna sem valor mostra «—» e isso esta certo: a
     coluna existe, esta alinhada com as das outras linhas, e o travessao diz
     «aqui nao ha nada» num sitio onde a ausencia e comparavel.

     No telemovel nao ha colunas. Cada celula leva o seu rotulo ao lado, e uma
     celula vazia escreve-se «ALERTA —» — tres centimetros de linha a dizer
     que nao ha nada para dizer. A /patients tinha quatro por pessoa
     («MED — ALERTA — HOJE —»), oito pessoas, trinta e dois travessoes num
     ecra de 390px. O que importa — o nome, a idade, o risco — ficava afogado
     no que nao importa.

     Aqui a ausencia ja esta dita por a celula nao estar la. */
  const vazia = (v: ReactNode) => v === null || v === undefined || v === '' || v === '—'
  const comValor = celulas.filter(c => !c.soLargo && !vazia(c.valor))


  const conteudo = largo ? (
    <>
      {nome}
      {celulas.map(c => (
        <span key={c.rotulo} style={{
          ...MONO, fontSize: 'var(--t-dado)', width: c.largura, flexShrink: 0,
          textAlign: c.direita ? 'right' : 'left',
          color: c.cor || 'var(--ink-3)',
          fontWeight: (c.forte ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{c.valor}</span>
      ))}
      {fim && fimDentro && <span style={{ flexShrink: 0, display: 'flex', gap: 6 }}>{fim}</span>}
    </>
  ) : (
    <>
      {nome}
      {/* `order: 1` poe os NUMEROS em ultimo.
          Com a linha clicavel, o `fim` (as etiquetas, as alergias) e irmao
          destes dois por via do `display: contents` do link — e vinha depois,
          o que punha «RQ» sozinho numa terceira linha, por baixo dos numeros,
          onde se lia como mais uma medida. As etiquetas sao atributos da
          PESSOA: pertencem junto ao nome. Os numeros medem-se e vao no fim. */}
      {/* ── OS NÚMEROS, EM PROSA ────────────────────────────────────────────
          Eram pares de MAIÚSCULAS MONO com o valor ao lado:
          «IDADE 81a   MED 1   RISCO 15». Numa tabela de computador isso é
          certo — os rótulos estão no cabeçalho e aqui repetem-se em pequeno.
          Num cartão de telemóvel é uma linha de código a meio de uma ficha de
          uma pessoa, e lê-se com esforço.

          Agora os rótulos ficam em minúsculas e na letra do texto, e os
          valores destacam-se por peso e não por tipo de letra. O mono fica
          onde ganha alguma coisa: nos números que se comparam entre linhas. */}
      {comValor.length > 0 && (
        <span style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, order: 1,
          fontSize: 'var(--t-dado)', lineHeight: 1.5,
        }}>
          {comValor.map(c => (
            <span key={c.rotulo} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ color: 'var(--ink-4)' }}>{c.rotulo.toLowerCase()}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', color: c.cor || 'var(--ink)',
                fontWeight: 'var(--peso-forte)' as any,
              }}>{c.valor}</span>
            </span>
          ))}
        </span>
      )}
    </>
  )

  /* Com a linha clicavel, o `fim` ja nao entra no `conteudo` (ver `fimDentro`),
     por isso o `conteudo` E a versao sem fim. O nome diz o que ele e no sitio
     onde e usado. */
  const conteudoSemFim = conteudo

  /* ── UM BOTAO NAO PODE ESTAR DENTRO DE OUTRO (2026-10-07) ────────────────
     Com `aoTocar` E `fim`, os botoes do `fim` ficavam DENTRO do botao da
     linha. HTML invalido — e o React diz:

         In HTML, <button> cannot be a descendant of <button>.
         This will cause a hydration error.

     Na /apoio-psicossocial eram oito erros por render. E nao e so barulho:
     um botao dentro de outro tem comportamento de clique indefinido, e com o
     teclado so se chega ao de fora.

     Havendo `fim`, a linha e uma `<div>` e o clicavel envolve so a parte que
     abre. Sem `fim`, continua a ser um botao so — que e o alvo maior. */
  const clicavel = !!(href || aoTocar)

  if (clicavel && fim) {
    const { padding, cursor, ...moldura } = estilo
    return (
      <div style={{ ...moldura, padding, cursor: 'default' }}>
        {href ? (
          <a href={href} style={{
            display: 'contents', textDecoration: 'none', color: 'inherit', cursor: 'pointer',
          }}>{conteudoSemFim}</a>
        ) : (
          <button type="button" onClick={aoTocar} style={{
            display: 'contents', border: 'none', background: 'none',
            font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer',
          }}>{conteudoSemFim}</button>
        )}
        <span style={{ flexShrink: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}>{fim}</span>
      </div>
    )
  }

  if (href) return <a href={href} style={estilo}>{conteudo}</a>
  if (aoTocar) return <button type="button" onClick={aoTocar} style={estilo}>{conteudo}</button>
  return <div style={estilo}>{conteudo}</div>
}

/* ══════════════════════════════════════════════════════════════════════════
   AS MARCAS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Um código de três letras, com cor própria.
 *
 * Substitui os emoji, que são o sinal número um de software de brincar — e
 * é como as folhas de serviço de uma casa já estão escritas: MED, CUI, ATV.
 */
export function Codigo({ texto, cor, apagado, titulo }: {
  texto: string
  /** A cor própria deste código. Omitida, fica neutro. */
  cor?: string
  apagado?: boolean
  /**
   * O que o código quer dizer por extenso.
   *
   * Um código de três a seis letras é legível para quem o conhece e opaco
   * para quem chega hoje. Quem o puser num sítio onde o nome inteiro não cabe
   * tem aqui onde o guardar — e sem isto, abreviar era perder a palavra.
   */
  titulo?: string
}) {
  const c = apagado ? 'var(--ink-5)' : (cor || 'var(--ink-3)')
  return (
    <span title={titulo} style={{
      ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.09em', fontWeight: 'var(--peso-corpo)' as any,
      padding: '2px 5px', borderRadius: 'var(--r-sm)', whiteSpace: 'nowrap',
      color: c,
      border: `1px solid ${apagado ? 'var(--border)' : c + '55'}`,
      background: apagado ? 'transparent' : c + '0f',
    }}>{texto}</span>
  )
}

/**
 * Uma bandeira: «ALERGIAS: penicilina», «RISCO QUEDA», «DIETA MOLE».
 *
 * Só aparece quando é verdade. Uma bandeira que aparece sempre não é uma
 * bandeira — é um rótulo.
 */
export function Bandeira({ texto, tom = 'neutro' }: { texto: string; tom?: Tom }) {
  const c = COR[tom]
  return (
    <span title={texto} style={{
      ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.07em', fontWeight: 'var(--peso-corpo)' as any,
      color: c, border: `1px solid ${c}44`, background: `${c}0d`,
      padding: '1px 4px', borderRadius: 'var(--r-sm)', whiteSpace: 'nowrap',
      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{texto}</span>
  )
}

/**
 * Feito de total, em segmentos que se CONTAM.
 *
 * Segmentos e não uma barra contínua: com quatro tomas, uma barra a 75% não
 * diz «falta uma», diz «falta um bocado».
 */
export function Segmentos({ feitos, total, cor }: { feitos: number; total: number; cor?: string }) {
  const c = feitos >= total ? 'var(--green)' : (cor || 'var(--ink-3)')
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: Math.min(total, 10) }).map((_, i) => (
        <span key={i} style={{
          width: 9, height: 6, borderRadius: 1.5,
          background: i < feitos ? c : 'var(--border-2)',
        }} />
      ))}
      {total > 10 && <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>+{total - 10}</span>}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   OS CONTROLOS
   ══════════════════════════════════════════════════════════════════════════ */

type Feitio = 'principal' | 'contorno' | 'calmo'

/**
 * Um botão. 30px de altura no computador, 44 no telemóvel.
 *
 * ── PORQUE É QUE A ALTURA MUDA AQUI E NÃO MUDAVA ANTES ────────────────────
 * Na semana 1 pus uma altura única para tudo, por causa do polegar. Estava
 * certo para o telemóvel e errado para a mesa de trabalho: um botão de 48px
 * numa barra de ferramentas densa parece um botão de brincar.
 *
 * A regra verdadeira não é «uma altura»: é «uma altura POR CONTEXTO, e nunca
 * duas no mesmo ecrã». No telemóvel toca-se com o dedo; no computador
 * aponta-se com o rato.
 */
export function Botao({ feitio = 'contorno', children, onClick, disabled, titulo, esperando }: {
  feitio?: Feitio
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  titulo?: string
  /**
   * Está a correr um pedido por causa deste botão?
   *
   * Desliga o clique (um segundo toque grava a mesma passagem de turno duas
   * vezes), baixa o contraste e, se a espera passar de 400ms, troca a legenda
   * por «A GUARDAR…». Os 400ms não são decoração: num pedido de 80ms um
   * pisca-pisca é mais confuso do que não mostrar nada.
   */
  esperando?: boolean
}) {
  const [demora, setDemora] = useState(false)
  useEffect(() => {
    if (!esperando) { setDemora(false); return }
    const t = setTimeout(() => setDemora(true), 400)
    return () => clearTimeout(t)
  }, [esperando])

  const inerte = disabled || esperando
  const feitios: Record<Feitio, CSSProperties> = {
    principal: {
      border: 'none',
      background: inerte ? 'var(--bg-3)' : 'var(--green)',
      color: inerte ? 'var(--ink-5)' : 'var(--sobre-acento)',
      fontWeight: 'var(--peso-forte)' as any,
    },
    contorno: {
      border: `1px solid ${inerte ? 'var(--border)' : 'var(--border-2)'}`,
      background: 'var(--bg)', color: inerte ? 'var(--ink-5)' : 'var(--ink-2)',
    },
    calmo: {
      border: '1px solid transparent', background: 'transparent',
      color: inerte ? 'var(--ink-5)' : 'var(--ink-4)',
    },
  }
  return (
    <button type="button" onClick={onClick} disabled={inerte} title={titulo}
      aria-busy={esperando || undefined}
      className="mesa-botao"
      style={{
        ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
        padding: '0 12px', borderRadius: 'var(--r-md)',
        cursor: inerte ? 'default' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        whiteSpace: 'nowrap', ...feitios[feitio],
      }}>{demora ? 'A GUARDAR…' : children}</button>
  )
}

/** Um seletor de uma opção entre poucas. O ativo é sempre o verde da casa. */
export function Seletor<T extends string>({ opcoes, ativa, aoMudar }: {
  opcoes: { id: T; rotulo: string }[]
  ativa: T
  aoMudar: (id: T) => void
}) {
  const largo = useLargo()
  return (
    /* `overflow-x: auto` e nao `hidden` (2026-10-07).
       Com `hidden`, quatro separadores a 390px cortavam o ultimo a meio da
       palavra: a /patients mostrava «SEM R» e nao havia maneira nenhuma de
       lhe chegar. Agora arrasta-se de lado, que e o que um telemovel faz.
       O `maxWidth: '100%'` e preciso: sem ele o flex do pai deixa a caixa
       crescer para alem do ecra em vez de a por a rolar. */
    <div role="tablist" style={{
      display: 'flex', border: '1px solid var(--border-2)',
      borderRadius: 'var(--r-md)', overflowX: 'auto', overflowY: 'hidden',
      maxWidth: '100%', scrollbarWidth: 'none',
    }}>
      {opcoes.map(o => {
        const on = o.id === ativa
        return (
          <button key={o.id} role="tab" aria-selected={on} onClick={() => aoMudar(o.id)}
            className="mesa-botao"
            /* ── MAIÚSCULAS MONO SÃO PARA O COMPUTADOR ────────────────────
               «TODOS 8  ALERTAS 0  POLIMED. 0  SEM REGISTO 8» numa barra de
               computador é um separador denso e legível: a caixa alta e o
               espaçamento entre letras dizem «isto é um controlo, não é texto».

               A 390px é outra coisa. As maiúsculas ocupam mais ~15% de largura
               do que as minúsculas, o espaçamento entre letras acrescenta
               mais, e o resultado foi o que se via: quatro opções em que a
               quarta saía cortada a meio da palavra contra a borda.

               Em ecrã estreito a mesma informação vai em minúsculas, na letra
               do texto e sem espaçamento. Cabe mais, lê-se melhor, e continua
               a ser evidente que é um separador — isso quem o diz é a moldura
               e o fundo do ativo, não a caixa alta. */
            style={largo ? {
              ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.08em', textTransform: 'uppercase',
              padding: '0 12px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: on ? 'var(--green)' : 'transparent',
              color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
              fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
            } : {
              fontFamily: 'inherit', fontSize: 'var(--t-corpo)', letterSpacing: 0,
              padding: '0 14px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: on ? 'var(--green)' : 'transparent',
              color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
              fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
            }}>{o.rotulo}</button>
        )
      })}
    </div>
  )
}

/** A caixa de marcar uma coisa como feita. */
export function Marca({ feito, parcial, aGravar, onClick, oQue }: {
  feito: boolean
  /** Tratada mas não feita — recusada, adiada. */
  parcial?: boolean
  aGravar?: boolean
  onClick?: () => void
  /** Para quem ouve a página em vez de a ver. */
  oQue: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      aria-pressed={feito} aria-label={`${feito ? 'Desmarcar' : 'Marcar'} ${oQue}`}
      style={{
        width: 30, height: 30, flexShrink: 0, padding: 0, borderRadius: 'var(--r-sm)',
        border: feito ? 'none' : `1.5px solid ${parcial ? 'var(--amber)' : 'var(--border-2)'}`,
        background: feito ? 'var(--green)' : 'transparent',
        color: 'var(--sobre-acento)', fontSize: 'var(--t-destaque)', lineHeight: 1,
        cursor: onClick ? 'pointer' : 'default', opacity: aGravar ? 0.5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{feito ? '✓' : parcial ? '—' : ''}</button>
  )
}

/** O aspeto de um campo de escrita de uma linha. */
export const CAIXA: CSSProperties = {
  width: '100%', boxSizing: 'border-box', height: 32,
  padding: '0 10px', borderRadius: 'var(--r-md)',
  border: '1px solid var(--border-2)', fontFamily: 'inherit', fontSize: 'var(--t-dado)',
  background: 'var(--bg)', color: 'var(--ink)',
}

/** E o de várias linhas. */
export const CAIXA_TEXTO: CSSProperties = {
  ...CAIXA, height: undefined, minHeight: 64,
  padding: '8px 10px', lineHeight: 1.5, resize: 'vertical',
}

/**
 * Rótulo por cima, nunca dentro da caixa.
 *
 * ── O `htmlFor` NÃO É DETALHE (2026-10-07) ────────────────────────────────
 * Este `<label>` não tinha `htmlFor`, e isso custava duas coisas a sério:
 * carregar no rótulo não punha o cursor na caixa (num formulário de dezoito
 * campos são dezoito alvos de toque desperdiçados), e um leitor de ecrã
 * anunciava «caixa de texto, vazia» sem dizer de que campo se tratava.
 *
 * Com `para`, o rótulo aponta ao campo. Sem `para`, o `<label>` ENVOLVE o
 * conteúdo — o que também o liga, e serve os casos em que o filho é um grupo
 * de botões e não uma caixa com id.
 */
export function Campo({ rotulo, ajuda, obrigatorio, children, para }: {
  rotulo: string
  ajuda?: ReactNode
  obrigatorio?: boolean
  children: ReactNode
  /** O `id` do campo que este rótulo nomeia. */
  para?: string
}) {
  const idAjuda = ajuda && para ? `${para}-ajuda` : undefined
  const legenda = (
    <>{rotulo}{obrigatorio && <span style={{ color: 'var(--red)' }}> *</span>}</>
  )
  return (
    <div style={{ marginTop: 12 }}>
      {para ? (
        <>
          <label htmlFor={para} style={{ ...ROTULO, display: 'block', marginBottom: 4 }}>{legenda}</label>
          {children}
        </>
      ) : (
        <label style={{ display: 'block' }}>
          <span style={{ ...ROTULO, display: 'block', marginBottom: 4 }}>{legenda}</span>
          {children}
        </label>
      )}
      {ajuda && (
        <div id={idAjuda} style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 4, lineHeight: 1.5, maxWidth: '60ch' }}>
          {ajuda}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   O QUE SE DIZ QUANDO NÃO HÁ NADA, E OS AVISOS
   ══════════════════════════════════════════════════════════════════════════ */

export function Vazio({ titulo, oQueFazer, acao }: {
  titulo: string
  oQueFazer?: ReactNode
  acao?: ReactNode
}) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-2)' }}>{titulo}</div>
      {oQueFazer && (
        <p style={{
          fontSize: 'var(--t-dado)', color: 'var(--ink-4)', margin: '8px auto 0',
          maxWidth: '46ch', lineHeight: 1.55,
        }}>{oQueFazer}</p>
      )}
      {acao && <div style={{ marginTop: 16 }}>{acao}</div>}
    </div>
  )
}

export function ACarregar({ oQue = 'A carregar…' }: { oQue?: string }) {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 'var(--t-dado)' }}
      aria-live="polite">{oQue}</div>
  )
}

export function Aviso({ tom = 'neutro', titulo, children }: {
  tom?: Tom; titulo?: string; children: ReactNode
}) {
  const c = COR[tom]
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 'var(--r-md)',
      background: tom === 'neutro' ? 'var(--bg-2)' : `${c}0d`,
      border: `1px solid ${tom === 'neutro' ? 'var(--border)' : c + '40'}`,
      color: tom === 'neutro' ? 'var(--ink-3)' : c,
    }}>
      {titulo && <div style={{ ...ROTULO, color: c, marginBottom: 3 }}>{titulo}</div>}
      <div style={{ fontSize: 'var(--t-dado)', lineHeight: 1.5, maxWidth: '72ch' }}>{children}</div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   AS QUE FALTAVAM
   ══════════════════════════════════════════════════════════════════════════
   Nasceram ao migrar o /inqueritos, que foi a primeira página a precisar de
   mostrar NÚMEROS e de agrupar coisas dentro de um painel. É assim que este
   diretório deve crescer: uma peça nova só existe quando uma página real a
   pede — não antes, por antecipação.
   ══════════════════════════════════════════════════════════════════════════ */

/** Um grupo de linhas dentro de um painel, com o seu cabeçalho. */
export function Grupo({ titulo, extra, children }: {
  titulo: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 12, padding: '7px 16px', background: 'var(--bg-2)',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      }}>
        <span style={ROTULO}>{titulo}</span>
        {extra && <span style={{ ...ROTULO, color: 'var(--ink-5)' }}>{extra}</span>}
      </div>
      <div style={{ padding: '10px 16px' }}>{children}</div>
    </section>
  )
}

/**
 * Um número grande, com a BASE obrigatória.
 *
 * ── PORQUE É QUE A BASE NÃO É OPCIONAL ────────────────────────────────────
 * Um 4,7 de três respostas e um 4,7 de quarenta não são a mesma frase. Em
 * mais do que um sítio desta aplicação isso já esteve prestes a ir para um
 * relatório entregue à Segurança Social. Ou se diz de quantos saiu, ou não se
 * mostra o número.
 */
export function Numero({ valor, unidade, rotulo, base, tom = 'neutro' }: {
  valor: ReactNode
  unidade?: ReactNode
  rotulo: string
  base: ReactNode
  tom?: Tom
}) {
  return (
    <div>
      <div style={ROTULO}>{rotulo}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
        <span style={{
          ...MONO, fontSize: 'var(--t-numero)', lineHeight: 1, fontWeight: 'var(--peso-corpo)' as any, color: COR[tom],
        }}>{valor}</span>
        {unidade && <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{unidade}</span>}
      </div>
      <div style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 4 }}>{base}</div>
    </div>
  )
}

/** Uma linha de lista simples: título, detalhe, e o que vai à direita. */
export function Linha({ titulo, detalhe, fim, aoTocar, tom = 'neutro' }: {
  titulo: ReactNode
  detalhe?: ReactNode
  fim?: ReactNode
  aoTocar?: () => void
  tom?: Tom
}) {
  const conteudo = (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any }}>{titulo}</span>
        {detalhe && (
          <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 2 }}>{detalhe}</span>
        )}
      </span>
      {fim && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>{fim}</span>}
    </>
  )
  const estilo: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '9px 16px', borderBottom: '1px solid var(--border)',
    borderLeft: tom === 'neutro' ? '3px solid transparent' : `3px solid ${COR[tom]}`,
    background: 'transparent', fontFamily: 'inherit', color: 'var(--ink)',
    cursor: aoTocar ? 'pointer' : 'default',
  }
  return aoTocar
    ? <button onClick={aoTocar} style={{ ...estilo, border: 'none', borderBottom: '1px solid var(--border)', borderLeft: estilo.borderLeft }}>{conteudo}</button>
    : <div style={estilo}>{conteudo}</div>
}

/**
 * A FOLHA — um formulário que se abre por cima da mesa.
 *
 * No telemóvel sobe de baixo e ocupa o que precisa; no computador fica ao
 * centro. Não é um «modal» decorativo: é onde se escreve, e por isso tem a
 * mesma densidade do resto — rótulos em mono por cima, caixas de 32px.
 */
export function Folha({ titulo, aoFechar, children }: {
  titulo: string
  aoFechar: () => void
  children: ReactNode
}) {
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) aoFechar() }} style={{
      position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(16,20,24,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border-2)',
        borderRadius: 'var(--r-md)', width: '100%', maxWidth: 520,
        maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box',
      }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)', padding: '9px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ ...ROTULO, flex: 1 }}>{titulo}</span>
          <Botao feitio="calmo" onClick={aoFechar}>FECHAR</Botao>
        </div>
        <div style={{ padding: '4px 14px 16px' }}>{children}</div>
      </div>
    </div>
  )
}
