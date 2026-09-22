'use client'

// components/DocumentoPartilhado.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O ficheiro de um documento partilhado por código, visto por quem não tem
// conta no Phlox.
//
// ── QUEM ESTÁ DO OUTRO LADO ────────────────────────────────────────────────
// Um médico numa consulta, com o telemóvel na mão, a quem alguém passou um
// código de oito caracteres. Tem trinta segundos de paciência. Se a página
// abrir e o exame não aparecer, o Phlox acabou de falhar exatamente na coisa
// que prometia.
//
// Daí as três origens possíveis, por ordem: o ficheiro no bucket privado
// (`ficheiro_url`, um URL assinado que expira com a partilha), um `data:` URL
// dos documentos antigos, ou nada. E os PDFs desenham-se com o pdf.js em vez
// de irem para um <iframe>, que nos browsers de telemóvel não mostra nada.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import VisualizadorPDF from './VisualizadorPDF'

interface Doc {
  title: string
  body_url?: string | null
  ficheiro_url?: string | null
  file_type?: string | null
  file_name?: string | null
}

export default function DocumentoPartilhado({ doc }: { doc: Doc }) {
  const [bytes, setBytes] = useState<Blob | null>(null)
  const [urlLocal, setUrlLocal] = useState<string | null>(null)
  const [falhou, setFalhou] = useState(false)

  const tipo = doc.file_type || (doc.body_url?.match(/^data:([^;]+)/) || [])[1] || ''
  const ehPdf = tipo === 'application/pdf'
  const ehImagem = tipo.startsWith('image/')
  const temFicheiro = !!(doc.ficheiro_url || doc.body_url)

  useEffect(() => {
    if (!ehPdf) return
    let vivo = true
    let url: string | null = null

    ;(async () => {
      try {
        if (doc.ficheiro_url) {
          const r = await fetch(doc.ficheiro_url)
          if (!r.ok) throw new Error('não deu')
          const b = await r.blob()
          if (!vivo) return
          setBytes(b)
          url = URL.createObjectURL(b)
          setUrlLocal(url)
          return
        }
        if (doc.body_url?.startsWith('data:')) {
          const [, dados] = doc.body_url.split(',')
          const bin = atob(dados)
          const arr = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
          const b = new Blob([arr], { type: 'application/pdf' })
          if (!vivo) return
          setBytes(b)
          url = URL.createObjectURL(b)
          setUrlLocal(url)
        }
      } catch {
        if (vivo) setFalhou(true)
      }
    })()

    return () => { vivo = false; if (url) URL.revokeObjectURL(url) }
  }, [doc.ficheiro_url, doc.body_url, ehPdf])

  if (!temFicheiro) return null

  if (ehImagem) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={doc.ficheiro_url || doc.body_url || undefined}
        alt={doc.title}
        style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e5e7eb', display: 'block' }}
      />
    )
  }

  if (ehPdf) {
    if (falhou) {
      return (
        <a href={doc.ficheiro_url || doc.body_url || undefined} target="_blank" rel="noopener"
          style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#0d6e42' }}>
          Abrir o ficheiro →
        </a>
      )
    }
    return (
      <div style={{ background: '#0b1120', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <VisualizadorPDF dados={bytes} url={urlLocal} nome={doc.file_name || doc.title} />
      </div>
    )
  }

  // Qualquer outra coisa (um .docx, um ficheiro sem tipo): dá-se o ficheiro.
  return (
    <a href={doc.ficheiro_url || doc.body_url || undefined} download={doc.file_name || doc.title}
      target="_blank" rel="noopener"
      style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#0d6e42' }}>
      Descarregar {doc.file_name || 'o ficheiro'} →
    </a>
  )
}
