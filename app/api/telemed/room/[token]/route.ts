// app/api/telemed/room/[token]/route.ts
// GET → metadata pública da sala (sem detalhes clínicos), para JOIN do paciente
//        Pacientes podem aceder via link único; clínicos via sessão autenticada.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 16) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  const db = admin()
  const { data, error } = await db.from('telemed_sessions')
    .select('id, status, scheduled_at, duration_min, motive, room_token, provider, recording_consent')
    .eq('room_token', token)
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
  if (data.status === 'cancelled' || data.status === 'no_show') {
    return NextResponse.json({ error: 'Sala não disponível' }, { status: 410 })
  }
  return NextResponse.json({ session: data })
}
