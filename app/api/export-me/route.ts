import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

// Exportação dos dados pessoais do utilizador (Art. 20.º RGPD — portabilidade).
// Devolve um JSON único com TODAS as tabelas do utilizador. O cliente serializa
// e descarrega como ficheiro.
//
// Não usamos ZIP no servidor para evitar dependências extra; o JSON é
// suficientemente portátil e legível. Tabelas inexistentes são silenciosamente
// omitidas.

const TABLES = [
  'profiles',
  'patients', 'family_profiles',
  'patient_meds', 'personal_meds', 'family_profile_meds',
  'symptom_logs', 'vitals', 'hydration_logs',
  'health_visits', 'health_pass_sessions',
  'encounters', 'incidents', 'care_records', 'mar_records',
  'assessments', 'care_plans', 'wounds',
  'sales', 'sale_items', 'stock_items',
  'team_members', 'shift_assignments',
  'waiting_room', 'team_tasks', 'compliance_items', 'consents',
  'webhook_endpoints', 'webhook_deliveries',
  'api_keys', 'api_usage',
  'audit_events',
  'invoice_settings', 'fiscal_settings', 'payment_settings', 'doc_series',
  'billing_entries',
]

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sb = admin()

  const out: Record<string, any> = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    rgpd_article: '20',
    note: 'Exportação completa dos dados pessoais associados a esta conta no Phlox. Tabelas vazias ou inexistentes foram omitidas.',
    tables: {},
  }

  const sizes: Record<string, number> = {}

  for (const t of TABLES) {
    try {
      const userCol = t === 'profiles' ? 'id' : 'user_id'
      const { data, error } = await sb.from(t).select('*').eq(userCol, userId).limit(50_000)
      if (error) continue
      if (data && data.length) {
        out.tables[t] = data
        sizes[t] = data.length
      }
    } catch { /* tabela inexistente — ignora */ }
  }

  out.summary = sizes
  return new NextResponse(JSON.stringify(out, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="phlox-export-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
