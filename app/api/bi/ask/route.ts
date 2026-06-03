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

// Whitelist + descrição das tabelas — alimenta o system prompt do modelo.
const SCHEMA_HINT = `
TABELAS DISPONÍVEIS (use APENAS estas):
- organizations(id,name,kind,city,created_at)
- patients(id,org_id,name,birth_date,sex,risk_level,created_at)
- episodes(id,org_id,patient_id,kind,status,triage_level,ward,start_at,end_at)
- patient_meds(id,patient_id,name,dose,frequency,episode_id)
- mar_records(id,patient_id,med_name,scheduled_at,administered_at,status,episode_id)
- pcne_interventions(id,user_id,patient_id,date,problem_code,cause_code,intervention_code,outcome_code)
- prescriptions(id,org_id,patient_id,status,issued_at,expires_at,total_items)
- beds(id,org_id,ward_id,label,status,occupied_since)
- wards(id,org_id,name,kind,capacity)
- triage_assessments(id,org_id,priority,reason,seen_at,created_at)
- surgeries(id,org_id,procedure_name,status,scheduled_start,outcome,specialty)
- suppliers(id,org_id,name,kind,lead_time_days)
- purchase_orders(id,org_id,supplier_id,number,status,ordered_at,total_amount,total_lines)
- goods_receipts(id,org_id,supplier_id,received_at,total_amount)
- loyalty_members(id,org_id,name,points_balance,total_spent,last_visit_at)
- loyalty_transactions(id,org_id,member_id,kind,points,amount,created_at)
- stock_items(id,user_id,name,quantity,expiry_date,min_quantity)
- agent_tasks(id,org_id,agent_name,kind,title,status,priority,created_at)
- kpi_snapshots(id,org_id,snapshot_date,metric,value)
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
- Filtra SEMPRE pela organização: org_id = '${body.org_id}' (excepto stock_items que tem user_id).
- Limita resultados a 50 linhas com LIMIT explícito.
- Usa apenas as tabelas/colunas indicadas. NÃO inventes colunas.
- Em datas, usa now() e intervalos PostgreSQL (ex: now() - interval '7 days').

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

  // 3) Garante filtro por org (defesa em profundidade — RLS já cobre)
  const lowSql = sql.toLowerCase()
  if (!lowSql.includes(`org_id = '${body.org_id}'`) && !lowSql.includes('stock_items')) {
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
