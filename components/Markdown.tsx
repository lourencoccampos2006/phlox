'use client'

// Renderer leve de markdown para respostas da AI — sem libs.
// Suporta: # H1, ## H2, ### H3, **bold**, *italic*, `code`, listas (-, *, 1.),
// quebras de parágrafo, e ```code``` em bloco.
// Foi pensado para ler respostas LLM em português, mantendo um aspecto limpo.

import { Fragment } from 'react'

// ── inline: **bold**, *italic*, `code` ──────────────────────────────────────────
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  // Tokenize por delimitadores; ordem importa: code → bold → italic
  const tokens: React.ReactNode[] = []
  let i = 0, k = 0
  while (i < text.length) {
    // `code`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end > i) {
        tokens.push(<code key={`${keyPrefix}-c${k++}`} style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'var(--font-mono)', color: '#334155' }}>{text.slice(i + 1, end)}</code>)
        i = end + 1; continue
      }
    }
    // **bold**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end > i + 1) {
        const inner = text.slice(i + 2, end)
        tokens.push(<strong key={`${keyPrefix}-b${k++}`} style={{ color: '#0b1120', fontWeight: 700 }}>{inline(inner, `${keyPrefix}-b${k}`)}</strong>)
        i = end + 2; continue
      }
    }
    // *italic* (mas evitar bullets — verifica que não está no início de uma linha)
    if (text[i] === '*' && (i > 0 && text[i - 1] !== ' ' && text[i - 1] !== '\n' || true)) {
      // Heurística: é itálico só se houver fecho dentro de 80 caracteres
      const end = text.indexOf('*', i + 1)
      if (end > i && end - i < 80 && text[i + 1] !== ' ' && text[end - 1] !== ' ') {
        tokens.push(<em key={`${keyPrefix}-i${k++}`} style={{ fontStyle: 'italic', color: '#0b1120' }}>{text.slice(i + 1, end)}</em>)
        i = end + 1; continue
      }
    }
    // texto normal — acumula até ao próximo delimitador
    let next = text.length
    for (const c of ['*', '`']) {
      const x = text.indexOf(c, i)
      if (x !== -1 && x < next) next = x
    }
    tokens.push(<Fragment key={`${keyPrefix}-t${k++}`}>{text.slice(i, next)}</Fragment>)
    i = next
  }
  return tokens
}

// ── block: parágrafos, headings, listas, code blocks ──────────────────────────
export default function Markdown({ text }: { text: string }) {
  if (!text) return null

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0, key = 0

  const Heading = ({ level, content }: { level: 1 | 2 | 3; content: string }) => {
    const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
    const sizes: Record<number, string> = { 1: '1.35em', 2: '1.18em', 3: '1.05em' }
    return (
      <Tag style={{ fontSize: sizes[level], fontWeight: 700, color: '#0b1120', margin: level === 1 ? '0 0 10px' : '14px 0 6px', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
        {inline(content, `h${level}-${key++}`)}
      </Tag>
    )
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // linha vazia → ignora (separação faz-se nos blocos)
    if (!trimmed) { i++; continue }

    // ``` code block ```
    if (trimmed.startsWith('```')) {
      const end = lines.findIndex((l, j) => j > i && l.trim().startsWith('```'))
      const code = (end > i ? lines.slice(i + 1, end) : lines.slice(i + 1)).join('\n')
      blocks.push(
        <pre key={`pre-${key++}`} style={{ background: '#0b1120', color: '#e2e8f0', borderRadius: 8, padding: '12px 14px', margin: '10px 0', overflow: 'auto', fontSize: 12.5, lineHeight: 1.55, fontFamily: 'var(--font-mono)' }}>
          <code>{code}</code>
        </pre>
      )
      i = end > 0 ? end + 1 : lines.length
      continue
    }

    // Headings
    if (trimmed.startsWith('### ')) { blocks.push(<Heading key={`b-${key++}`} level={3} content={trimmed.slice(4)} />); i++; continue }
    if (trimmed.startsWith('## '))  { blocks.push(<Heading key={`b-${key++}`} level={2} content={trimmed.slice(3)} />); i++; continue }
    if (trimmed.startsWith('# '))   { blocks.push(<Heading key={`b-${key++}`} level={1} content={trimmed.slice(2)} />); i++; continue }

    // Listas — bullet (-, *, •) ou numerada (1.)
    const bulletRe = /^\s*[-*•]\s+(.+)$/
    const numberRe = /^\s*\d+\.\s+(.+)$/
    if (bulletRe.test(line) || numberRe.test(line)) {
      const items: string[] = []
      const ordered = numberRe.test(line)
      const re = ordered ? numberRe : bulletRe
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].match(re)![1])
        i++
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={`l-${key++}`} style={{ margin: '8px 0', paddingLeft: 22, lineHeight: 1.7 }}>
          {items.map((it, j) => <li key={j} style={{ margin: '3px 0' }}>{inline(it, `li-${key}-${j}`)}</li>)}
        </Tag>
      )
      continue
    }

    // Parágrafo — junta linhas consecutivas que não sejam outro tipo de bloco
    const para: string[] = [line]
    i++
    while (i < lines.length) {
      const l = lines[i]
      const t = l.trim()
      if (!t) break
      if (t.startsWith('```') || t.startsWith('# ') || t.startsWith('## ') || t.startsWith('### ') || bulletRe.test(l) || numberRe.test(l)) break
      para.push(l)
      i++
    }
    blocks.push(
      <p key={`p-${key++}`} style={{ margin: '6px 0', lineHeight: 1.7 }}>
        {inline(para.join(' '), `p-${key}`)}
      </p>
    )
  }

  return <>{blocks}</>
}
