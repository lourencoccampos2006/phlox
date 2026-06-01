// lib/docExtract.ts
// Extração de texto client-side, sem dependências server. Carrega pdf.js de
// CDN só quando preciso (lazy) para não pesar o bundle.
//
// Suporta:
//   • application/pdf            → pdfjs-dist (CDN)
//   • application/vnd.openxmlformats-officedocument.wordprocessingml.document
//                                  (.docx) → fetch + DOMParser do XML
//   • application/vnd.openxmlformats-officedocument.presentationml.presentation
//                                  (.pptx) → fetch + DOMParser dos slides
//   • text/* e application/json   → leitor directo
//
// Para imagens (OCR), redirecionamos para a ferramenta existente /api/ai-vision
// e usamos a resposta como texto. Não tratamos imagens aqui.

export type ExtractedDoc = {
  kind: 'pdf' | 'docx' | 'pptx' | 'text'
  text: string
  pageCount?: number
  warnings?: string[]
}

const PDFJS_VERSION = '4.5.136'
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`

let pdfJsLoaded: Promise<any> | null = null
function loadPdfJs(): Promise<any> {
  if (pdfJsLoaded) return pdfJsLoaded
  pdfJsLoaded = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Só no browser'))
    const w = window as any
    if (w.pdfjsLib) return resolve(w.pdfjsLib)
    const s = document.createElement('script')
    s.src = `${PDFJS_CDN}/pdf.min.mjs`
    s.type = 'module'
    s.onerror = () => reject(new Error('Falhou a carregar o leitor de PDF.'))
    // pdf.min.mjs exporta pdfjsLib globalmente em runtime moderno; o fallback é
    // importar como modulo. Usamos dynamic import.
    document.head.appendChild(s)
    // Em alternativa: usamos import() — mais previsível
    ;(async () => {
      try {
        const mod = await import(/* webpackIgnore: true */ `${PDFJS_CDN}/pdf.min.mjs`)
        const lib = (mod as any).default || mod
        if (lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`
        resolve(lib)
      } catch (e) { reject(e) }
    })()
  })
  return pdfJsLoaded
}

async function extractPdf(file: File): Promise<ExtractedDoc> {
  const pdfjs = await loadPdfJs()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = (content.items as any[]).map(it => it.str || '').join(' ').replace(/\s+/g, ' ').trim()
    pages.push(`[Página ${i}]\n${text}`)
  }
  return { kind: 'pdf', text: pages.join('\n\n'), pageCount: pdf.numPages }
}

// .docx é um zip com word/document.xml — extraímos texto entre tags <w:t>.
// Para evitar dependência de JSZip, fazemos uso de DecompressionStream se
// suportado, senão fallback.
async function extractDocx(file: File): Promise<ExtractedDoc> {
  const text = await extractXmlFromOoxml(file, 'word/document.xml', '</w:p>')
  return { kind: 'docx', text }
}

// .pptx é um zip com ppt/slides/slide1.xml, slide2.xml, …
async function extractPptx(file: File): Promise<ExtractedDoc> {
  const slides = await extractAllOoxmlSlides(file)
  return {
    kind: 'pptx',
    text: slides.map((t, i) => `[Slide ${i + 1}]\n${t}`).join('\n\n'),
    pageCount: slides.length,
  }
}

async function extractText(file: File): Promise<ExtractedDoc> {
  const text = await file.text()
  return { kind: 'text', text }
}

export async function extractFromFile(file: File): Promise<ExtractedDoc> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return extractPdf(file)
  if (name.endsWith('.docx')) return extractDocx(file)
  if (name.endsWith('.pptx')) return extractPptx(file)
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) return extractText(file)
  // Fallback: tenta ler como texto
  return extractText(file)
}

// ── OOXML helpers (zip parse mínimo) ─────────────────────────────────────────
// Implementa-se um mini parser de ZIP-central-directory para tirar entradas
// específicas. Suficiente para .docx e .pptx, sem deps externas.

async function readZip(file: File): Promise<Map<string, Uint8Array>> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const map = new Map<string, Uint8Array>()
  // Procura End of Central Directory
  const sig = new Uint8Array([0x50, 0x4b, 0x05, 0x06])
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf[i] === sig[0] && buf[i + 1] === sig[1] && buf[i + 2] === sig[2] && buf[i + 3] === sig[3]) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('ZIP inválido (sem EOCD)')
  const dv = new DataView(buf.buffer)
  const cdSize = dv.getUint32(eocd + 12, true)
  const cdOffset = dv.getUint32(eocd + 16, true)
  let p = cdOffset
  while (p < cdOffset + cdSize) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const uncompSize = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const localOffset = dv.getUint32(p + 42, true)
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen))
    // ler local file header
    const lh = localOffset
    const lhNameLen = dv.getUint16(lh + 26, true)
    const lhExtraLen = dv.getUint16(lh + 28, true)
    const dataStart = lh + 30 + lhNameLen + lhExtraLen
    const compressed = buf.subarray(dataStart, dataStart + compSize)
    let data: Uint8Array
    if (method === 0) data = compressed
    else if (method === 8) {
      // deflate raw — usa DecompressionStream
      const ds = new (window as any).DecompressionStream('deflate-raw')
      const stream = new Blob([compressed]).stream().pipeThrough(ds)
      const ab = await new Response(stream).arrayBuffer()
      data = new Uint8Array(ab)
      if (data.length !== uncompSize) {
        // alguns escritores enchem com extra; corta
        data = data.subarray(0, uncompSize)
      }
    } else {
      data = new Uint8Array(0)
    }
    map.set(name, data)
    p += 46 + nameLen + extraLen + commentLen
  }
  return map
}

async function extractXmlFromOoxml(file: File, path: string, paragraphEnd: string): Promise<string> {
  const map = await readZip(file)
  const xmlBytes = map.get(path)
  if (!xmlBytes) throw new Error(`Entrada não encontrada: ${path}`)
  const xml = new TextDecoder().decode(xmlBytes)
  return xmlToText(xml, paragraphEnd)
}

async function extractAllOoxmlSlides(file: File): Promise<string[]> {
  const map = await readZip(file)
  const slideKeys = Array.from(map.keys())
    .filter(k => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = parseInt((a.match(/slide(\d+)/i) || [])[1] || '0', 10)
      const nb = parseInt((b.match(/slide(\d+)/i) || [])[1] || '0', 10)
      return na - nb
    })
  const out: string[] = []
  for (const k of slideKeys) {
    const xml = new TextDecoder().decode(map.get(k)!)
    out.push(xmlToText(xml, '</a:p>'))
  }
  return out
}

/**
 * Tira texto de um XML OOXML: junta o conteúdo dos elementos `<*:t>` (texto)
 * em cada parágrafo. Não usa libs porque DOMParser do browser corta XML
 * grande, e regex chega.
 */
function xmlToText(xml: string, paragraphEnd: string): string {
  // Cada parágrafo termina em </w:p> (Word) ou </a:p> (PowerPoint)
  const paragraphs = xml.split(paragraphEnd)
  const lines: string[] = []
  for (const p of paragraphs) {
    // <w:t>texto</w:t>  ou  <a:t>texto</a:t>
    const matches = p.match(/<(?:w|a):t[^>]*>([\s\S]*?)<\/(?:w|a):t>/g) || []
    const line = matches.map(m => m.replace(/<[^>]+>/g, '')).join('').trim()
    if (line) lines.push(decodeEntities(line))
  }
  return lines.join('\n')
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}
