// app/api/org/export/route.ts
// Painel do dono, aba "Registos & auditoria": exportação por intervalo de
// datas. Para responder a uma inspeção sem ter de ir dia a dia — o dono
// escolhe o intervalo e o tipo de registo, recebe um CSV com tudo. Só
// owner/admin. Os registos nunca são apagados (sem limpeza automática nas
// tabelas clínicas), por isso isto lê o que já existe — não reconstrói nada.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

// tabela → { colunas a exportar, coluna de data para filtrar }
const SOURCES: Record<string, { table: string; dateCol: string; cols: string[]; label: string }> = {
  medicacao:   { table: 'mar_records',  dateCol: 'date', cols: ['date', 'shift', 'patient_id', 'med_id', 'status', 'source', 'recorded_by', 'recorded_at'], label: 'Medicação (MAR)' },
  registos:    { table: 'care_records', dateCol: 'date', cols: ['date', 'shift', 'patient_id', 'recorded_by', 'vitals', 'nutrition', 'continence', 'mood', 'skin', 'notes', 'created_at'], label: 'Registo do dia' },
  ocorrencias: { table: 'incidents',    dateCol: 'date', cols: ['date', 'patient_id', 'type', 'severity', 'status', 'description', 'created_at'], label: 'Ocorrências' },
  avaliacoes:  { table: 'assessments',  dateCol: 'date', cols: ['date', 'patient_id', 'scale', 'score', 'notes', 'evaluated_by', 'created_at'], label: 'Avaliações' },
  atividades:  { table: 'activity_participations', dateCol: 'date', cols: ['date', 'patient_id', 'activity_id', 'participated', 'notes'], label: 'Participação em atividades' },
}

function toCsv(rows: any[], cols: string[]): string {
  const esc = (v: any) => {
    if (v === null || v === undefined) return ''
    let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    // Campos de texto livre (notas, descrição) vêm de quem usa a app — ao abrir
    // no Excel, um valor começado por =/+/-/@ é interpretado como fórmula
    // (CSV formula injection). Neutraliza com um apóstrofo à frente.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.join(',')
  const lines = rows.map(r => cols.map(c => esc(r[c])).join(','))
  return [header, ...lines].join('\n')
}

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('[phlox:org-export] SUPABASE_SERVICE_ROLE_KEY missing'); return NextResponse.json({ error: 'Esta parte ainda não está disponível nesta conta.' }, { status: 503 }) }
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Sessão em falta.' }, { status: 401 })
  const a = admin()
  const { data: { user } } = await a.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: prof } = await a.from('profiles').select('active_org_id, org_id').eq('id', user.id).single()
  const orgId = prof?.active_org_id || prof?.org_id || null
  if (!orgId) return NextResponse.json({ error: 'Sem organização.' }, { status: 400 })
  const { data: mem } = await a.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).eq('active', true).maybeSingle()
  if (!mem || !['owner', 'admin'].includes(mem.role)) return NextResponse.json({ error: 'Só o dono/admin.' }, { status: 403 })

  const from = req.nextUrl.searchParams.get('from') || ''
  const to = req.nextUrl.searchParams.get('to') || ''
  const source = req.nextUrl.searchParams.get('source') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Datas inválidas.' }, { status: 400 })
  }
  const src = SOURCES[source]
  if (!src) return NextResponse.json({ error: 'Tipo de registo inválido.' }, { status: 400 })

  // limite generoso mas real — evita um export a nunca mais acabar por engano
  const { data, error } = await a.from(src.table).select(src.cols.join(','))
    .eq('org_id', orgId).gte(src.dateCol, from).lte(src.dateCol, to)
    .order(src.dateCol, { ascending: true }).limit(20000)

  if (error) {
    console.error('[phlox:org-export] falhou:', error.message)
    return NextResponse.json({ error: 'Não foi possível gerar a exportação agora.' }, { status: 500 })
  }

  const csv = toCsv(data || [], src.cols)
  const filename = `phlox-${source}-${from}_a_${to}.csv`
  return new NextResponse('﻿' + csv, { // BOM — acentos corretos ao abrir no Excel
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
