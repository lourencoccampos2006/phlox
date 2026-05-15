import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ notifications: [], unread: 0 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const since = new Date(Date.now() - 48 * 3600000).toISOString()

  const { data: wardAlerts } = await supabase
    .from('channel_messages')
    .select('id, type, content, author_name, created_at')
    .in('type', ['alert', 'task'])
    .neq('user_id', userId)
    .gte('created_at', since)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(15)

  const notifications = (wardAlerts || []).map((m: any) => ({
    id: `ward-${m.id}`,
    type: m.type === 'alert' ? 'ward_alert' : 'ward_task',
    title: m.type === 'alert' ? `Alerta — ${m.author_name}` : `Tarefa — ${m.author_name}`,
    body: (m.content || '').slice(0, 90),
    href: '/teams',
    created_at: m.created_at,
    priority: m.type === 'alert' ? 'high' : 'normal',
  }))

  return NextResponse.json({ notifications, unread: notifications.length })
}