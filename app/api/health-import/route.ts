import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { parseAppleHealthXml } from '@/lib/appleHealthParser'

// POST /api/health-import — recebe o XML do Apple Health export e insere vitais.
// O ficheiro export.xml vem dentro de um zip; quem prepara o zip do lado do cliente
// extrai o XML antes de enviar (mais simples para o servidor — sem dependências
// extra de unzip).
//
// Para Google Fit / outros: o endpoint /api/fit-import (a criar) faz o equivalente
// para JSON do Google Takeout. O endpoint atual aceita também um array directo
// `{ vitals: [...] }` para integrações futuras.

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 3, 60_000).allowed) return rateLimitResponse()

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  let vitals: any[] = []
  let summary: any = null

  if (typeof body.xml === 'string' && body.xml.length > 1000) {
    if (body.xml.length > 30_000_000) return NextResponse.json({ error: 'XML demasiado grande (max 25MB).' }, { status: 413 })
    const parsed = parseAppleHealthXml(body.xml)
    vitals = parsed.vitals; summary = parsed.summary
  } else if (Array.isArray(body.vitals)) {
    vitals = body.vitals
  } else {
    return NextResponse.json({ error: 'Envia { xml } (Apple Health) ou { vitals: [...] }.' }, { status: 400 })
  }

  if (vitals.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, summary, warning: 'Nenhum vital reconhecido.' })
  }

  // Inserir em batches de 200; com user_id e profile_id null por defeito
  const sb = admin()
  const rows = vitals.map(v => ({
    user_id: userId,
    recorded_at: v.recorded_at,
    hr: v.hr ?? null, bp_sys: v.bp_sys ?? null, bp_dia: v.bp_dia ?? null,
    spo2: v.spo2 ?? null, weight: v.weight ?? null, glucose: v.glucose ?? null,
    temp: v.temp ?? null, notes: v.notes ?? 'Importado de Apple Health',
  }))

  let inserted = 0
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error } = await sb.from('vitals').insert(batch)
    if (!error) inserted += batch.length
  }

  return NextResponse.json({ ok: true, inserted, summary })
}
