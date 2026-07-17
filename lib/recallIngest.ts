// lib/recallIngest.ts
// Vigia de Recalls (item B11 da auditoria 2026-07-17) — descoberta + parsing
// dos alertas de qualidade/segurança do INFARMED. Diferente do
// shortageIngest.ts (um ficheiro Excel único trimestral): aqui é uma listagem
// HTML paginada, sem ficheiro em bulk — testado com download real antes de
// escrever isto (ver sprint114_recall_watch.sql para o porquê da decisão de
// arquitetura). Regex testada contra HTML real do INFARMED (não é um palpite).

export interface RecallNotice { url: string; title: string; date: string | null; source_page: 'qualidade' | 'seguranca' }

const PAGES: { path: string; source_page: 'qualidade' | 'seguranca' }[] = [
  { path: '/web/infarmed/alertas-de-qualidade', source_page: 'qualidade' },
  { path: '/web/infarmed/alertas-de-seguranca', source_page: 'seguranca' },
]

const BASE = 'https://www.infarmed.pt'

// Cada notícia no HTML tem esta forma (confirmada com download real):
// <a href="/web/infarmed/.../journal_content/56/15786/ID" class="event-link">
//   ... <h4 class="title"> TÍTULO </h4> ... <strong>Data</strong> : DD/MM/AAAA
const NOTICE_RE = /<a href="([^"]+)" class="event-link">[\s\S]*?<h4 class="title">\s*([\s\S]*?)\s*<\/h4>[\s\S]*?<strong>Data<\/strong>\s*:\s*([\d/]+)/g

export async function fetchRecallPage(sourcePage: 'qualidade' | 'seguranca'): Promise<RecallNotice[]> {
  const page = PAGES.find(p => p.source_page === sourcePage)!
  const res = await fetch(`${BASE}${page.path}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PhloxHealthApp/1.0)' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`INFARMED ${sourcePage}: HTTP ${res.status}`)
  const html = await res.text()

  const out: RecallNotice[] = []
  let m: RegExpExecArray | null
  NOTICE_RE.lastIndex = 0
  while ((m = NOTICE_RE.exec(html))) {
    const url = m[1].startsWith('http') ? m[1] : `${BASE}${m[1]}`
    const title = m[2].replace(/\s+/g, ' ').trim()
    const date = m[3] || null
    if (title) out.push({ url, title, date, source_page: sourcePage })
  }
  return out
}

export async function fetchAllRecallNotices(): Promise<RecallNotice[]> {
  const results = await Promise.allSettled(PAGES.map(p => fetchRecallPage(p.source_page)))
  const out: RecallNotice[] = []
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value)
  return out
}
