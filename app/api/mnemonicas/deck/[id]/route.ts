// app/api/mnemonicas/deck/[id]/route.ts
// Remover uma mnemónica do baralho pessoal (só a própria — RLS + filtro explícito).
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { sb } from '@/lib/orgAuth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const db = sb(req)
  const { error } = await db.from('saved_mnemonics').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
