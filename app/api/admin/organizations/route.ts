import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/adminAuth'

// GET /api/admin/organizations — todas as instituições, com dono e nº de
// membros. Só a conta admin (ver lib/adminAuth.ts) — dá visibilidade de quem
// já tem acesso institucional, sem abrir a tabela organizations/org_members
// a mais ninguém (RLS normal só deixa ver a própria org).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const db = adminDb()
  const [{ data: orgs, error: orgsErr }, { data: members }] = await Promise.all([
    db.from('organizations').select('id, name, kind, created_at').order('created_at', { ascending: false }),
    db.from('org_members').select('org_id, user_id, role, active'),
  ])
  if (orgsErr) return NextResponse.json({ error: orgsErr.message }, { status: 500 })

  const ownerIds = [...new Set((members || []).filter(m => m.role === 'owner').map(m => m.user_id))]
  const { data: owners } = ownerIds.length
    ? await db.from('profiles').select('id, email, name').in('id', ownerIds)
    : { data: [] as any[] }
  const ownerById = new Map((owners || []).map(o => [o.id, o]))

  const result = (orgs || []).map(o => {
    const orgMembers = (members || []).filter(m => m.org_id === o.id)
    const owner = orgMembers.find(m => m.role === 'owner')
    return {
      id: o.id, name: o.name, kind: o.kind, created_at: o.created_at,
      member_count: orgMembers.filter(m => m.active !== false).length,
      owner_email: owner ? ownerById.get(owner.user_id)?.email || null : null,
      owner_name: owner ? ownerById.get(owner.user_id)?.name || null : null,
    }
  })

  return NextResponse.json({ organizations: result })
}
