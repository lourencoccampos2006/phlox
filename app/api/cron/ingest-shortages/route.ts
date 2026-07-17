// app/api/cron/ingest-shortages/route.ts
// Vigia de Ruturas — ingestão semanal da Lista de Notificação Prévia (LNP) do
// INFARMED (Excel real, ver lib/shortageIngest.ts). Protegido por CRON_SECRET,
// mesmo padrão do /api/vigilancia/cron já existente.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findLatestLnpUrl, parseLnpWorkbook } from '@/lib/shortageIngest'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Só cabeçalhos — nunca query string (URLs ficam em logs de servidor,
  // proxies e histórico do browser; um segredo ali é um segredo exposto).
  // Para correr manualmente: `curl -H "Authorization: Bearer $CRON_SECRET" ...`.
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  const secret = bearer || req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    const found = await findLatestLnpUrl()
    if (!found) throw new Error('Não encontrei o link da Lista de Notificação Prévia nas páginas do INFARMED (pode ter mudado de sítio)')

    const fileRes = await fetch(found.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PhloxBot/1.0)' } })
    if (!fileRes.ok) throw new Error(`Download falhou: HTTP ${fileRes.status}`)
    const buffer = await fileRes.arrayBuffer()

    const rows = await parseLnpWorkbook(buffer)
    if (rows.length < 20) {
      // Uma LNP real tem centenas de linhas — poucas linhas sugere que o
      // ficheiro descarregado não é o que pensávamos. Não substitui os dados
      // já ingeridos por algo suspeito.
      throw new Error(`Só ${rows.length} linhas encontradas — suspeito, a ingestão foi abortada sem tocar nos dados existentes`)
    }

    // Substitui a lista inteira dentro de uma "transação lógica": insere a
    // nova antes de apagar a antiga NÃO é feito aqui (Supabase REST não tem
    // transações multi-tabela fáceis) — em vez disso, apaga e insere em lote;
    // o pior cenário é uma janela curta com a tabela vazia, aceitável para
    // dados de referência trimestrais.
    await db.from('infarmed_shortage_list').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map(r => ({ ...r, source_document: found.label, source_url: found.url }))
      const { error } = await db.from('infarmed_shortage_list').insert(batch)
      if (error) throw new Error(`Falha ao inserir lote ${i}: ${error.message}`)
    }

    await db.from('infarmed_shortage_sync').upsert({
      id: 1, last_synced_at: new Date().toISOString(), source_document: found.label, row_count: rows.length, status: 'ok', error_detail: null,
    })

    return NextResponse.json({ ok: true, source: found.label, rows: rows.length })
  } catch (err: any) {
    console.error('ingest-shortages error:', err)
    try {
      await db.from('infarmed_shortage_sync').upsert({
        id: 1, last_synced_at: new Date().toISOString(), status: 'error', error_detail: String(err?.message || err).slice(0, 500),
      })
    } catch { /* melhor esforço — não deixar o erro de log esconder o erro real */ }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}
