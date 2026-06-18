// app/api/health-check/route.ts
// Diagnóstico para o DONO do produto: diz quais as tabelas/funcionalidades que
// estão a funcionar e quais faltam (migração SQL por correr). Resolve o "não sei
// se está a funcionar". Protegido pelo CRON_SECRET (não é público).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Tabela → funcionalidade que depende dela. Se a tabela faltar, a funcionalidade
// mostra "temporariamente indisponível".
const CHECKS: { table: string; feature: string; sql: string }[] = [
  { table: 'patients', feature: 'Utentes/Residentes/Doentes', sql: 'base' },
  { table: 'personal_meds', feature: 'Os meus medicamentos', sql: 'base' },
  { table: 'appointments', feature: 'Agenda', sql: 'sprint (agenda)' },
  { table: 'care_records', feature: 'Registo do dia', sql: 'base' },
  { table: 'mar_records', feature: 'Administração de medicação (MAR)', sql: 'base' },
  { table: 'incidents', feature: 'Ocorrências', sql: 'base' },
  { table: 'wounds', feature: 'Feridas', sql: 'base' },
  { table: 'hydration_logs', feature: 'Hidratação', sql: 'sprint20' },
  { table: 'activities', feature: 'Atividades', sql: 'sprint12' },
  { table: 'activity_participations', feature: 'Participação em atividades', sql: 'sprint12' },
  { table: 'family_thread_messages', feature: 'Portal das famílias', sql: 'base' },
  { table: 'stock_items', feature: 'Stock & validades', sql: 'base' },
  { table: 'sales', feature: 'Vendas / Caixa', sql: 'base' },
  { table: 'prescription_queue', feature: 'Validação de receitas', sql: 'base' },
  { table: 'documents', feature: 'Documentos & conformidade', sql: 'base' },
  { table: 'cal_events', feature: 'Calendário', sql: 'sprint43' },
  { table: 'team_tasks', feature: 'Tarefas da equipa', sql: 'base' },
  { table: 'push_subscriptions', feature: 'Notificações push', sql: 'sprint (push)' },
  { table: 'usage_counters', feature: 'Limites diários (server)', sql: 'sprint88' },
]

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado. Usa ?secret=O_TEU_CRON_SECRET' }, { status: 401 })
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const results = await Promise.all(CHECKS.map(async c => {
    const { error } = await sb.from(c.table).select('*', { count: 'exact', head: true }).limit(1)
    const missing = !!error && /does not exist|schema cache/i.test(error.message || '')
    return { feature: c.feature, table: c.table, ok: !error, missing, migration: c.sql }
  }))

  const faltam = results.filter(r => r.missing)
  return NextResponse.json({
    resumo: faltam.length === 0
      ? '✅ Todas as funcionalidades têm a base de dados pronta.'
      : `⚠️ ${faltam.length} funcionalidade(s) com tabela em falta — corre a migração SQL correspondente no Supabase.`,
    vapid_configurado: !!process.env.VAPID_PRIVATE_KEY && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    cron_secret_configurado: !!process.env.CRON_SECRET,
    faltam,
    tudo: results,
  })
}
