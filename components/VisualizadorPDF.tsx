'use client'

// components/VisualizadorPDF.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Ver um PDF inteiro, em qualquer telemóvel.
//
// ── PORQUE É QUE UM IFRAME NÃO SERVE ───────────────────────────────────────
// `<iframe src="blob:…">` com um PDF funciona no Chrome e no Firefox de
// computador, porque eles trazem um visualizador de PDF embutido. Nos
// browsers de telemóvel — Safari do iOS, Chrome do Android — **não há
// visualizador embutido para conteúdo em iframe**. O que aparece é uma caixa
// em branco, uma primeira página estática, ou um pedido para descarregar.
//
// Era esta a queixa: "guardar um documento com várias páginas apenas permite
// que se visualize uma delas". A causa nunca esteve no ficheiro nem no URL —
// está em pedir ao browser uma coisa que ele não faz no telemóvel.
//
// A solução é desenhar o PDF nós mesmos. O pdf.js já estava no projeto (é o
// que tira o texto dos documentos em lib/docExtract); aqui usa-se a outra
// metade: `page.render()` para uma canvas. Uma canvas por página, empilhadas,
// e o scroll é o da página. Funciona igual em todo o lado, mostra as páginas
// TODAS, e não depende de plugin nenhum.
//
// ── DECISÕES ────────────────────────────────────────────────────────────────
// • Desenha-se em duas fases: as três primeiras páginas de imediato (para não
//   se esperar por um documento de 40 páginas antes de ver a primeira) e o
//   resto a seguir.
// • A escala acompanha a largura disponível e o `devicePixelRatio`, senão num
//   telemóvel o texto sai esborratado.
// • Se o pdf.js falhar — sem rede, CDN em baixo, PDF corrompido — cai-se num
//   link para descarregar. Nunca se fica com um quadrado vazio sem explicação.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { loadPdfJs } from '@/lib/docExtract'

interface Props {
  /** O ficheiro. Blob (do Storage) ou ArrayBuffer. */
  dados: Blob | ArrayBuffer | null
  /** Para o link de descarregar, quando nada mais funcionar. */
  url?: string | null
  nome?: string
}

const PRIMEIRAS = 3

export default function VisualizadorPDF({ dados, url, nome }: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const [paginas, setPaginas] = useState(0)
  const [desenhadas, setDesenhadas] = useState(0)
  const [erro, setErro] = useState('')
  const [aCarregar, setACarregar] = useState(true)

  useEffect(() => {
    if (!dados) return
    let vivo = true
    const canvases: HTMLCanvasElement[] = []

    ;(async () => {
      setErro(''); setACarregar(true); setDesenhadas(0); setPaginas(0)
      try {
        const pdfjs = await loadPdfJs()
        const buf = dados instanceof Blob ? await dados.arrayBuffer() : dados
        // `data` fica com o buffer; cópia para o pdf.js não o esvaziar debaixo
        // dos pés se o mesmo blob for lido outra vez.
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise
        if (!vivo) return
        setPaginas(pdf.numPages)

        const larguraCaixa = caixa.current?.clientWidth || 700
        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        async function desenhar(n: number) {
          const page = await pdf.getPage(n)
          if (!vivo) return
          const base = page.getViewport({ scale: 1 })
          // Cabe na largura disponível, mas nunca abaixo do legível.
          const escala = Math.max(larguraCaixa / base.width, 0.5)
          const viewport = page.getViewport({ scale: escala * dpr })

          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.style.display = 'block'
          canvas.style.background = 'white'
          canvas.style.marginBottom = '10px'
          canvas.style.borderRadius = '4px'
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', `Página ${n} de ${pdf.numPages}`)

          const ctx = canvas.getContext('2d')
          if (!ctx) return
          await page.render({ canvasContext: ctx, viewport }).promise
          if (!vivo) return
          caixa.current?.appendChild(canvas)
          canvases.push(canvas)
          setDesenhadas(d => d + 1)
        }

        // As primeiras primeiro: num documento de 40 páginas ninguém espera
        // que as 40 estejam prontas para ver a primeira.
        const logo = Math.min(PRIMEIRAS, pdf.numPages)
        for (let n = 1; n <= logo; n++) await desenhar(n)
        if (!vivo) return
        setACarregar(false)
        for (let n = logo + 1; n <= pdf.numPages; n++) {
          if (!vivo) return
          await desenhar(n)
        }
      } catch (e: any) {
        if (!vivo) return
        setErro(e?.message || 'Não consegui abrir este PDF.')
        setACarregar(false)
      }
    })()

    return () => {
      vivo = false
      for (const c of canvases) c.remove()
    }
  }, [dados])

  if (erro) {
    return (
      <div style={{ padding: '28px 20px', textAlign: 'center', color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>
        Não consegui mostrar este PDF aqui.
        {url && (
          <>
            {' '}
            <a href={url} download={nome || 'documento.pdf'} target="_blank" rel="noopener" style={{ color: 'white', fontWeight: 700 }}>
              Abrir o ficheiro →
            </a>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      {paginas > 1 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          background: 'rgba(11,17,32,0.92)', color: '#cbd5e1',
          fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em',
          textTransform: 'uppercase', padding: '6px 12px', textAlign: 'center',
        }}>
          {desenhadas < paginas ? `${desenhadas} de ${paginas} páginas…` : `${paginas} páginas`}
        </div>
      )}
      <div ref={caixa} style={{ padding: 10 }} />
      {aCarregar && (
        <div style={{ padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          A abrir o documento…
        </div>
      )}
    </div>
  )
}
