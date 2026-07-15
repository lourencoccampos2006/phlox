import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

// Sino de notificações do topo — mostra avisos importantes/urgentes por resolver
// do Mural da equipa (era o feed do Phlox Ward, que deixou de existir como
// página própria; a comunicação de equipa agora vive só em /equipa?tab=mural).
export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ notifications: [], unread: 0 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: prof } = await supabase.from('profiles').select('active_org_id, org_id').eq('id', userId).maybeSingle()
  const orgId = prof?.active_org_id || prof?.org_id || null
  if (!orgId) return NextResponse.json({ notifications: [], unread: 0 })

  const since = new Date(Date.now() - 48 * 3600000).toISOString()
  const { data: msgs } = await supabase
    .from('team_messages')
    .select('id, channel, body, author_name, priority, created_at')
    .eq('org_id', orgId)
    .neq('author_id', userId)
    .in('priority', ['importante', 'urgente'])
    .eq('resolved', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(15)

  const notifications = (msgs || []).map((m: any) => ({
    id: `mural-${m.id}`,
    type: m.priority === 'urgente' ? 'mural_urgent' : 'mural_important',
    title: `${m.priority === 'urgente' ? '🔴' : '🟠'} ${m.channel} · ${m.author_name}`,
    body: (m.body || '').slice(0, 90),
    href: '/equipa?tab=mural',
    created_at: m.created_at,
    priority: m.priority === 'urgente' ? 'high' : 'normal',
  }))

  return NextResponse.json({ notifications, unread: notifications.length })
}
