import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Endpoint público de saúde da plataforma — sem dados sensíveis.
// Verifica latência ao Supabase (DB ping) e devolve metadados públicos.
// Usado pela página /status e pelo indicador do rodapé.

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  const checks: { name: string; ok: boolean; ms?: number; detail?: string }[] = []

  // ── Database (Supabase) ──
  try {
    const t0 = Date.now()
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    // count em tabela pública: peso mínimo, valida ligação + autorização
    const { error } = await sb.from('profiles').select('id', { count: 'exact', head: true })
    const ms = Date.now() - t0
    checks.push({ name: 'database', ok: !error, ms, detail: error ? error.message.slice(0, 120) : undefined })
  } catch (e: any) {
    checks.push({ name: 'database', ok: false, detail: String(e?.message || e).slice(0, 120) })
  }

  // ── Auth ──
  try {
    const t0 = Date.now()
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } })
    checks.push({ name: 'auth', ok: r.ok, ms: Date.now() - t0 })
  } catch (e: any) {
    checks.push({ name: 'auth', ok: false, detail: String(e?.message || e).slice(0, 120) })
  }

  const ok = checks.every(c => c.ok)
  return NextResponse.json({
    status: ok ? 'operational' : 'degraded',
    checks,
    region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'eu',
    runtime: process.env.NEXT_RUNTIME || 'nodejs',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
  })
}
