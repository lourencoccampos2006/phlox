// app/api/org/export/route.ts
// Painel do dono, aba "Registos & auditoria": exportação por intervalo de
// datas. Para responder a uma inspeção sem ter de ir dia a dia — o dono
// escolhe o intervalo e o tipo de registo, recebe um .xlsx com tudo já
// legível (nomes em vez de IDs, valores traduzidos). Só owner/admin. Os
// registos nunca são apagados (sem limpeza automática nas tabelas clínicas),
// por isso isto lê o que já existe — não reconstrói nada.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

const STATUS_PT: Record<string, string> = { administered: 'Administrada', refused: 'Recusada', held: 'Suspensa', pending: 'Por dar' }

// Achatamento simples de um campo jsonb (vitais/nutrição/etc.) numa string
// legível — em vez de despejar JSON cru numa célula.
function flatten(v: any): string {
  if (v === null || v === undefined) return ''
  if (typeof v !== 'object') return String(v)
  const entries = Object.entries(v).filter(([, val]) => val !== null && val !== '' && val !== undefined)
  if (!entries.length) return ''
  return entries.map(([k, val]) => `${k}: ${val}`).join('; ')
}

interface SourceDef {
  table: string
  dateCol: string
  label: string
  sheetCols: string[]
  build: (rows: any[], ctx: Ctx) => Record<string, any>[]
}
interface Ctx { patientName: Record<string, string>; staffName: Record<string, string> }

const SOURCES: Record<string, SourceDef> = {
  medicacao: {
    table: 'mar_records', dateCol: 'date', label: 'Medicação (MAR)',
    sheetCols: ['Data', 'Turno', 'Utente', 'Medicamento', 'Estado', 'Origem', 'Quem', 'Notas', 'Registado em'],
    build: (rows, ctx) => rows.map(r => ({
      'Data': r.date, 'Turno': r.shift || '',
      'Utente': ctx.patientName[r.patient_id] || '—',
      'Medicamento': r._medName || '—',
      'Estado': STATUS_PT[r.status] || r.status || '',
      'Origem': r.source === 'home' ? 'Casa' : 'Centro',
      'Quem': r.source === 'home' ? `${r.home_by || 'Família'} (em casa)` : (ctx.staffName[r.recorded_by_id] || r.recorded_by || '—'),
      'Notas': r.notes || '',
      'Registado em': r.recorded_at ? new Date(r.recorded_at).toLocaleString('pt-PT') : '',
    })),
  },
  registos: {
    table: 'care_records', dateCol: 'date', label: 'Registo do dia',
    sheetCols: ['Data', 'Turno', 'Utente', 'Registado por', 'Sinais vitais', 'Nutrição', 'Continência', 'Humor', 'Pele', 'Notas', 'Criado em'],
    build: (rows, ctx) => rows.map(r => ({
      'Data': r.date, 'Turno': r.shift || '',
      'Utente': ctx.patientName[r.patient_id] || '—',
      'Registado por': ctx.staffName[r.recorded_by_id] || r.recorded_by || '—',
      'Sinais vitais': flatten(r.vitals), 'Nutrição': flatten(r.nutrition), 'Continência': flatten(r.continence),
      'Humor': flatten(r.mood), 'Pele': flatten(r.skin), 'Notas': r.notes || '',
      'Criado em': r.created_at ? new Date(r.created_at).toLocaleString('pt-PT') : '',
    })),
  },
  ocorrencias: {
    table: 'incidents', dateCol: 'date', label: 'Ocorrências',
    sheetCols: ['Data', 'Utente', 'Tipo', 'Gravidade', 'Estado', 'Descrição', 'Ação tomada', 'Registado por', 'Criado em'],
    build: (rows, ctx) => rows.map(r => ({
      'Data': r.date, 'Utente': ctx.patientName[r.patient_id] || '—',
      'Tipo': r.type || '', 'Gravidade': r.severity || '', 'Estado': r.status || '',
      'Descrição': r.description || '', 'Ação tomada': r.action_taken || '',
      'Registado por': ctx.staffName[r.recorded_by_id] || '—',
      'Criado em': r.created_at ? new Date(r.created_at).toLocaleString('pt-PT') : '',
    })),
  },
  avaliacoes: {
    table: 'assessments', dateCol: 'date', label: 'Avaliações',
    sheetCols: ['Data', 'Utente', 'Escala', 'Pontuação', 'Nível', 'Avaliado por', 'Notas', 'Criado em'],
    build: (rows, ctx) => rows.map(r => ({
      'Data': r.date, 'Utente': ctx.patientName[r.patient_id] || '—',
      'Escala': r.scale || '', 'Pontuação': r.score ?? '', 'Nível': r.level || '',
      'Avaliado por': ctx.staffName[r.recorded_by_id] || r.evaluated_by || '—', 'Notas': r.notes || '',
      'Criado em': r.created_at ? new Date(r.created_at).toLocaleString('pt-PT') : '',
    })),
  },
  atividades: {
    table: 'activity_participations', dateCol: 'date', label: 'Participação em atividades',
    sheetCols: ['Data', 'Utente', 'Atividade', 'Participou', 'Notas'],
    build: (rows, ctx) => rows.map(r => ({
      'Data': r.date, 'Utente': ctx.patientName[r.patient_id] || '—',
      'Atividade': r._activityTitle || '—', 'Participou': r.attended ? 'Sim' : 'Não', 'Notas': r.notes || '',
    })),
  },
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
  const { data: rows, error } = await a.from(src.table).select('*')
    .eq('org_id', orgId).gte(src.dateCol, from).lte(src.dateCol, to)
    .order(src.dateCol, { ascending: true }).limit(20000)

  if (error) {
    console.error('[phlox:org-export] falhou:', error.message)
    return NextResponse.json({ error: 'Não foi possível gerar a exportação agora.' }, { status: 500 })
  }

  const list = rows || []

  // Nomes de utentes (todos os desta org — barato, evita N chamadas)
  const { data: patients } = await a.from('patients').select('id, name').eq('org_id', orgId)
  const patientName: Record<string, string> = {}
  ;(patients || []).forEach((p: any) => { patientName[p.id] = p.name })

  // Nomes de quem registou (staff — profiles), a partir dos recorded_by_id encontrados
  const staffIds = Array.from(new Set(list.map((r: any) => r.recorded_by_id).filter(Boolean)))
  const { data: staffProfs } = staffIds.length ? await a.from('profiles').select('id, name').in('id', staffIds) : { data: [] as any[] }
  const staffName: Record<string, string> = {}
  ;(staffProfs || []).forEach((p: any) => { staffName[p.id] = p.name })

  // Medicamento (só para medicação): junta nome+dose de patient_meds
  if (source === 'medicacao') {
    const medIds = Array.from(new Set(list.map((r: any) => r.med_id).filter(Boolean)))
    const { data: meds } = medIds.length ? await a.from('patient_meds').select('id, name, dose').in('id', medIds) : { data: [] as any[] }
    const medLabel: Record<string, string> = {}
    ;(meds || []).forEach((m: any) => { medLabel[m.id] = m.dose ? `${m.name} (${m.dose})` : m.name })
    list.forEach((r: any) => { r._medName = medLabel[r.med_id] })
  }
  // Atividade (só para atividades): junta título
  if (source === 'atividades') {
    const actIds = Array.from(new Set(list.map((r: any) => r.activity_id).filter(Boolean)))
    const { data: acts } = actIds.length ? await a.from('activities').select('id, title').in('id', actIds) : { data: [] as any[] }
    const actTitle: Record<string, string> = {}
    ;(acts || []).forEach((x: any) => { actTitle[x.id] = x.title })
    list.forEach((r: any) => { r._activityTitle = actTitle[r.activity_id] })
  }

  const built = src.build(list, { patientName, staffName })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Phlox'
  const ws = wb.addWorksheet(src.label.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = src.sheetCols.map(c => ({ header: c, key: c, width: Math.max(14, Math.min(40, c.length + 6)) }))
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: src.sheetCols.length } }
  built.forEach(row => ws.addRow(row))
  ws.eachRow(r => { r.alignment = { vertical: 'top', wrapText: true } })

  const buf = await wb.xlsx.writeBuffer()
  const filename = `phlox-${source}-${from}_a_${to}.xlsx`
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
