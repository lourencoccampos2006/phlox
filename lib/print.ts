// ─── Phlox professional A4 print system ─────────────────────────────────────
// Generates a clean, dense, multi-page-safe printable document.
// - Repeating header + footer (page numbers) on every A4 page
// - Records never split across pages (page-break-inside: avoid)
// - Each page is self-contained and readable in any order
// - Professional clinical styling (no "screenshot" look)

export interface PrintField { label: string; value: string }
export interface PrintTag { label: string; color: string }

export interface PrintRecord {
  title: string
  meta?: string            // small line under title (e.g. room, age, date)
  tags?: PrintTag[]        // status chips
  fields?: PrintField[]    // label/value grid
  body?: string            // free text block
  bullets?: string[]       // bullet list
}

export interface PrintSection {
  heading: string
  note?: string
  records: PrintRecord[]
}

export interface PrintDoc {
  docTitle: string
  docSubtitle?: string
  institution?: string
  author?: string
  meta?: PrintField[]      // header summary stats (e.g. "Residentes: 28")
  sections: PrintSection[]
  footerNote?: string
}

function esc(s: string | undefined | null): string {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function recordHTML(r: PrintRecord): string {
  const tags = (r.tags || []).map(t =>
    `<span class="tag" style="color:${esc(t.color)};border-color:${esc(t.color)}44;background:${esc(t.color)}12">${esc(t.label)}</span>`
  ).join('')
  const fields = (r.fields && r.fields.length)
    ? `<div class="fields">${r.fields.map(f => `<div class="field"><div class="fl">${esc(f.label)}</div><div class="fv">${esc(f.value) || '—'}</div></div>`).join('')}</div>`
    : ''
  const bullets = (r.bullets && r.bullets.length)
    ? `<ul class="bul">${r.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
    : ''
  const body = r.body ? `<div class="body">${esc(r.body)}</div>` : ''
  return `<div class="rec">
    <div class="rec-head">
      <div class="rec-title">${esc(r.title)}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
    </div>
    ${r.meta ? `<div class="rec-meta">${esc(r.meta)}</div>` : ''}
    ${fields}${bullets}${body}
  </div>`
}

function sectionHTML(s: PrintSection): string {
  return `<section class="sec">
    <div class="sec-head">${esc(s.heading)}${s.note ? `<span class="sec-note">${esc(s.note)}</span>` : ''}</div>
    ${s.records.map(recordHTML).join('')}
  </section>`
}

export function buildPrintHTML(doc: PrintDoc): string {
  const now = new Date().toLocaleString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const metaChips = (doc.meta || []).map(m => `<span class="hchip"><b>${esc(m.value)}</b> ${esc(m.label)}</span>`).join('')

  return `<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8"><title>${esc(doc.docTitle)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0b1120; font-size: 10.5pt; line-height: 1.5; }

  /* Repeating header on every page */
  .pg-head { position: fixed; top: 0; left: 0; right: 0; height: 64px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 2px solid #0d6e42; padding-bottom: 8px; }
  .brand { display: flex; align-items: center; gap: 9px; }
  .logo { width: 26px; height: 26px; border-radius: 6px; background: #0d6e42; color: white;
    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }
  .brand-txt { font-weight: 800; font-size: 14pt; letter-spacing: -0.02em; }
  .brand-sub { font-size: 8pt; color: #64748b; margin-top: 1px; }
  .head-right { text-align: right; font-size: 8pt; color: #64748b; }
  .head-inst { font-weight: 700; color: #0b1120; font-size: 9.5pt; }

  /* Repeating footer with page number */
  .pg-foot { position: fixed; bottom: 0; left: 0; right: 0; height: 22px;
    border-top: 1px solid #e2e8f0; padding-top: 5px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 7.5pt; color: #94a3b8; }
  .pg-foot .pnum::after { content: counter(page) " / " counter(pages); }

  .content { padding-top: 74px; padding-bottom: 26px; }

  .doc-title { font-size: 19pt; font-weight: 800; letter-spacing: -0.02em; margin: 2px 0 2px; }
  .doc-sub { font-size: 10pt; color: #475569; margin-bottom: 10px; }
  .hsummary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .hchip { font-size: 9pt; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 10px; }
  .hchip b { color: #0b1120; }

  .sec { margin-bottom: 14px; }
  .sec-head { font-size: 8.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    color: #0d6e42; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-bottom: 8px;
    display: flex; align-items: baseline; gap: 8px; }
  .sec-note { font-weight: 500; color: #94a3b8; letter-spacing: 0; text-transform: none; font-size: 8pt; }

  .rec { border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px; margin-bottom: 7px;
    page-break-inside: avoid; break-inside: avoid; }
  .rec-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .rec-title { font-weight: 700; font-size: 11pt; }
  .rec-meta { font-size: 8.5pt; color: #64748b; margin-top: 1px; }
  .tags { display: flex; gap: 5px; flex-wrap: wrap; }
  .tag { font-size: 7.5pt; font-weight: 700; border: 1px solid; border-radius: 5px; padding: 2px 7px; white-space: nowrap; }

  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; margin-top: 7px; }
  .field { display: flex; gap: 7px; font-size: 9pt; border-bottom: 1px dotted #eef0f3; padding-bottom: 2px; }
  .fl { color: #94a3b8; min-width: 96px; }
  .fv { color: #0b1120; font-weight: 600; }
  .bul { margin: 6px 0 0; padding-left: 16px; font-size: 9.5pt; }
  .bul li { margin-bottom: 2px; }
  .body { font-size: 9.5pt; color: #1e293b; margin-top: 6px; white-space: pre-wrap; }

  .sec-head { page-break-after: avoid; break-after: avoid; }
</style></head>
<body>
  <div class="pg-head">
    <div class="brand">
      <div class="logo">+</div>
      <div><div class="brand-txt">Phlox</div><div class="brand-sub">Plataforma Clínica</div></div>
    </div>
    <div class="head-right">
      ${doc.institution ? `<div class="head-inst">${esc(doc.institution)}</div>` : ''}
      <div>${esc(doc.docTitle)}</div>
    </div>
  </div>
  <div class="pg-foot">
    <span>${esc(doc.footerNote || 'Documento gerado pelo Phlox')}${doc.author ? ' · ' + esc(doc.author) : ''}</span>
    <span>${esc(now)} · pág. <span class="pnum"></span></span>
  </div>
  <div class="content">
    <div class="doc-title">${esc(doc.docTitle)}</div>
    ${doc.docSubtitle ? `<div class="doc-sub">${esc(doc.docSubtitle)}</div>` : ''}
    ${metaChips ? `<div class="hsummary">${metaChips}</div>` : ''}
    ${doc.sections.map(sectionHTML).join('')}
  </div>
</body></html>`
}

export function printDoc(doc: PrintDoc): void {
  const html = buildPrintHTML(doc)
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) { alert('Permite pop-ups para imprimir.'); return }
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Wait for layout, then print
  const go = () => { try { w.focus(); w.print() } catch { /* ignore */ } }
  if (w.document.readyState === 'complete') setTimeout(go, 350)
  else w.onload = () => setTimeout(go, 350)
}
