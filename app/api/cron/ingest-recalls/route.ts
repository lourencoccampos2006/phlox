// app/api/cron/ingest-recalls/route.ts
// Vigia de Recalls — ingestão semanal dos alertas de qualidade/segurança do
// INFARMED (ver lib/recallIngest.ts). Ao contrário da Lista de Notificação
// Prévia (um snapshot que se substitui), os alertas ACUMULAM ao longo do
// tempo — por isso é upsert por url (insere só os novos), nunca apaga.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllRecallNotices } from '@/lib/recallIngest'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  const secret = bearer || req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    const notices = await fetchAllRecallNotices()
    if (notices.length === 0) throw new Error('Nenhuma notícia encontrada nas páginas do INFARMED (pode ter mudado de estrutura)')

    const { error } = await db.from('infarmed_recall_notices')
      .upsert(
        notices.map(n => ({ url: n.url, title: n.title, notice_date: n.date, source_page: n.source_page })),
        { onConflict: 'url', ignoreDuplicates: true },
      )
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, seen: notices.length })
  } catch (err: any) {
    console.error('ingest-recalls error:', err)
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}
