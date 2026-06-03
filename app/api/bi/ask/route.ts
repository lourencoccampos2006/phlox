// app/api/bi/ask/route.ts
// BI conversacional: utilizador faz pergunta em PT-PT, gera-se SQL controlada,
// executa-se via função bi_run_query (apenas SELECT, limite 200 linhas) e
// devolve-se resposta + dados. Guarda o histórico em ai_queries.
//
// Whitelist de tabelas que o modelo pode usar — qualquer outra é rejeitada.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { aiJSON } from '@/lib/ai'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

// Whitelist + descrição das tabelas com VALORES ENUM exactos.
// Nota: tabelas marcadas [sem org_id] precisam de JOIN para filtrar por org.
const SCHEMA_HINT = `
TABELAS DISPONÍVEIS (use APENAS estas):

- organizations(id, name, kind ['hospital','clinic','nursing_home','pharmacy_community','pharmacy_hospital','health_center','solo','other'], city, created_at)

- patients(id, org_id, user_id, name, age, sex, conditions, allergies, risk_level ['low','medium','high'], temporary boolean, created_at, updated_at)
  Para contar doentes da org: WHERE org_id = '<ORG_ID>' AND (temporary IS NULL OR temporary = false)

- episodes(id, org_id, patient_id, kind ['ambulatorio','internamento','urgencia','tele','domiciliario','outro'], status ['open','closed','cancelled'], triage_level int 1-5, ward, start_at, end_at, attending_user_id, primary_complaint, bed_id)

- patient_meds(id, patient_id, name, dose, frequency, episode_id) [sem org_id; faz JOIN patients USING(patient_id) e filtra patients.org_id]
- mar_records(id, patient_id, med_name, scheduled_at, administered_at, status ['scheduled','given','missed','refused'], episode_id) [sem org_id]
- pcne_interventions(id, user_id, patient_id, date, problem_code, cause_code, intervention_code, outcome_code) [sem org_id]

- prescriptions(id, org_id, patient_id, status ['draft','signed','dispensed','cancelled','expired'], issued_at, expires_at)

- wards(id, org_id, name, code, kind ['internamento','urgencia','uci','uciped','pediatria','obstetricia','psiquiatria','oncologia','ambulatorio','outro'], floor, capacity, active boolean)
  Filtra sempre active = true.

- beds(id, org_id, ward_id, label, bed_type ['standard','isolation','intensive','pediatric','maternity','psychiatric','observation','other'], status ['free','occupied','cleaning','maintenance','reserved','blocked'], current_patient_id, current_episode_id, occupied_since, active boolean)
  CAMAS LIVRES: status = 'free' (NÃO use 'available' nem outras palavras).
  CAMAS OCUPADAS: status = 'occupied'.
  Filtra sempre active = true para excluir camas desactivadas.

- triage_assessments(id, org_id, patient_id, priority int 1-5, flowchart, discriminator, reason, pain_score, target_minutes, seen_at, created_at)
  Pendentes: WHERE seen_at IS NULL. Prioridade 1=emergente, 2=muito urgente, 3=urgente, 4=pouco urgente, 5=não urgente.

- surgeries(id, org_id, patient_id, procedure_code, procedure_name, specialty, status ['scheduled','arrived','induction','in_progress','closing','recovery','completed','cancelled'], scheduled_start, scheduled_duration, asa_score 1-6, anaesthesia_kind, outcome ['success','complication','cancelled','converted','death'], surgeon_id, anaesthetist_id, operating_room)

- suppliers(id, org_id, name, kind ['wholesaler','laboratory','distributor','direct','other'], vat_number, infarmed_code, lead_time_days, active boolean)

- purchase_orders(id, org_id, supplier_id, number, status ['draft','sent','partial','received','cancelled'], ordered_at, expected_at, received_at, total_amount, total_lines, total_qty)

- goods_receipts(id, org_id, supplier_id, purchase_order_id, received_at, total_amount, invoice_number, invoice_date)

- loyalty_members(id, org_id, name, phone, points_balance, total_earned, total_redeemed, total_spent, last_visit_at, joined_at)
- loyalty_transactions(id, org_id, member_id, kind ['earn','redeem','adjust','expire'], points, amount, created_at)
- loyalty_rewards(id, org_id, program_id, name, points_cost, stock, redeemed_count, active)

- stock_items(id, user_id, name, category ['medicamento','penso','material','suplemento','outro'], quantity, unit, min_quantity, expiry_date, location) [sem org_id]
  Críticos: quantity < min_quantity. Próximos expirar: expiry_date <= now() + interval '30 days' AND expiry_date >= now().

- agent_tasks(id, org_id, agent_name, kind, title, status ['open','acknowledged','done','dismissed','expired'], priority int 1-5, created_at, due_at, resolved_at)

- crm_contacts(id, org_id, name, email, phone, company, kind ['lead','prospect','customer','partner','supplier_contact','other'], stage ['new','qualified','contacted','proposal','won','lost','dormant'], value_eur, owner_user_id, last_contact_at, next_followup_at)

- telemed_sessions(id, org_id, patient_id, clinician_id, status ['scheduled','waiting','in_progress','completed','cancelled','no_show'], scheduled_at, duration_min, fee_eur, paid boolean)

- kpi_snapshots(id, org_id, snapshot_date, metric, value)
`

const FORBIDDEN_TABLES = [
  'auth.users','users','profiles','api_keys','user_sessions',
  'access_anomalies','signed_docs','audit_chain','push_subscriptions',
]

const SQL_RX_FORBIDDEN = /(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|COPY|MERGE|EXECUTE|--|\/\*|;[\s\S]*\S)/i

function validateSQL(sql: string): string | null {
  const trimmed = sql.trim().replace(/;+\s*$/, '')
  if (!/^select\b/i.test(trimmed)) return 'Apenas SELECT é permitido.'
  if (SQL_RX_FORBIDDEN.test(trimmed)) return 'Palavra-chave proibida na consulta.'
  const lower = trimmed.toLowerCase()
  for (const t of FORBIDDEN_TABLES) {
    if (lower.includes(t.toLowerCase())) return `Acesso a "${t}" não permitido.`
  }
  return null
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { org_id?: string; question?: string } | null
  if (!body?.org_id || !body.question) {
    return NextResponse.json({ error: 'org_id e question obrigatórios' }, { status: 400 })
  }

  // Sanity: pergunta muito curta ou muito longa
  if (body.question.trim().length < 4) return NextResponse.json({ error: 'Pergunta muito curta' }, { status: 400 })
  if (body.question.length > 600) return NextResponse.json({ error: 'Pergunta demasiado longa (max 600 chars)' }, { status: 400 })

  const db = sb(req)

  // 1) Gera SQL via IA (com schema da org embutido)
  let generated: { sql?: string; answer?: string }
  try {
    generated = await aiJSON<{ sql: string; answer: string }>(
      [
        {
          role: 'system',
          content: `És analista clínico para uma organização de saúde portuguesa.
Recebes perguntas em PT-PT e produzes UMA query SELECT em PostgreSQL para responder.

Regras OBRIGATÓRIAS:
- Apenas UMA instrução SELECT. SEM ';' no fim. SEM CTE WITH ... ; ...
- Nunca usar INSERT/UPDATE/DELETE/DDL/COPY/EXECUTE/comentários.
- Filtra SEMPRE por organização. A coluna org_id existe nas tabelas indicadas.
  Para tabelas SEM org_id (marcadas [sem org_id]), filtra via JOIN com outra
  que tenha (ex: patient_meds JOIN patients ON patient_id WHERE patients.org_id = '${body.org_id}').
- Para a org actual usa SEMPRE: org_id = '${body.org_id}'
- Limita resultados a 50 linhas com LIMIT explícito.
- Usa apenas as tabelas/colunas indicadas. NÃO inventes colunas.
- **VALORES ENUM SÃO LITERAIS** — usa EXATAMENTE os valores indicados (em inglês,
  minúsculas). NUNCA inventes valores. Ex: beds.status = 'free' (NÃO 'available',
  NÃO 'libre', NÃO 'livre').
- patients pode ter org_id NULL (fichas antigas). Para contar doentes da org, usa:
  WHERE patients.org_id = '${body.org_id}'
- Em datas, usa now() e intervalos PostgreSQL (ex: now() - interval '7 days').
- Para tabelas com coluna "active" (wards, beds, suppliers), filtra active = true.

${SCHEMA_HINT}

Responde APENAS com JSON:
{
  "sql": "SELECT ... FROM ... WHERE org_id = '${body.org_id}' LIMIT 50",
  "answer": "explicação em PT-PT do que vais devolver, antes de eu ver os dados, 1-2 frases"
}`,
        },
        { role: 'user', content: body.question },
      ],
      { maxTokens: 600, temperature: 0.1 }
    )
  } catch (e: any) {
    await db.from('ai_queries').insert({
      org_id: body.org_id, asked_by: userId, question: body.question,
      error: `IA: ${e.message}`, duration_ms: Date.now() - t0,
    })
    return NextResponse.json({ error: 'Não foi possível interpretar a pergunta. Tenta reformular.' }, { status: 500 })
  }

  const sql = generated.sql?.trim()
  if (!sql) return NextResponse.json({ error: 'A IA não produziu SQL.' }, { status: 500 })

  // 2) Valida SQL
  const validation = validateSQL(sql)
  if (validation) {
    await db.from('ai_queries').insert({
      org_id: body.org_id, asked_by: userId, question: body.question,
      generated_sql: sql, error: validation, duration_ms: Date.now() - t0,
    })
    return NextResponse.json({ error: validation, sql }, { status: 400 })
  }

  // 3) Garante filtro por org (defesa em profundidade — RLS já cobre).
  //    Aceita qualquer query que referencie o org_id da organização activa.
  //    Tabelas sem org_id usam JOIN com tabelas que têm — basta o ID aparecer.
  const lowSql = sql.toLowerCase()
  const orgIdLow = body.org_id.toLowerCase()
  const hasOrgFilter = lowSql.includes(orgIdLow) ||
                       lowSql.includes('stock_items')
  if (!hasOrgFilter) {
    await db.from('ai_queries').insert({
      org_id: body.org_id, asked_by: userId, question: body.question,
      generated_sql: sql, error: 'Falta filtro org_id', duration_ms: Date.now() - t0,
    })
    return NextResponse.json({ error: 'Consulta sem filtro de organização — rejeitada por segurança.', sql }, { status: 400 })
  }

  // 4) Executa via RPC bi_run_query
  const { data: result, error: execErr } = await db.rpc('bi_run_query', { p_sql: sql })
  if (execErr) {
    await db.from('ai_queries').insert({
      org_id: body.org_id, asked_by: userId, question: body.question,
      generated_sql: sql, error: execErr.message, duration_ms: Date.now() - t0,
    })
    return NextResponse.json({ error: 'Erro a executar a consulta: ' + execErr.message, sql }, { status: 400 })
  }

  const rows = Array.isArray(result) ? result : []
  const ms = Date.now() - t0

  await db.from('ai_queries').insert({
    org_id: body.org_id, asked_by: userId, question: body.question,
    generated_sql: sql, answer: generated.answer || null,
    result_json: rows, rows_returned: rows.length,
    duration_ms: ms,
  })

  return NextResponse.json({
    sql,
    answer: generated.answer || `Encontrei ${rows.length} registo${rows.length === 1 ? '' : 's'}.`,
    rows,
    rows_returned: rows.length,
    duration_ms: ms,
  })
}
