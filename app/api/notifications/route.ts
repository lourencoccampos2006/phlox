import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'
import { ptDate } from '@/lib/ptTime'

// ── O SINO (reescrito 2026-08-31) ─────────────────────────────────────────
// Mostrava só mensagens do Mural marcadas como importantes ou urgentes, das
// últimas 48 horas, escritas por outra pessoa. É uma fatia estreitíssima: na
// maioria dos dias não havia nenhuma, o sino ficava vazio, e um sino que está
// sempre vazio lê-se como um sino avariado.
//
// Agora junta as quatro coisas que num lar ou centro de dia mesmo pedem
// atenção hoje, por esta ordem:
//   1. ocorrências que ficaram com seguimento por fazer
//   2. famílias à espera de resposta
//   3. tomas recusadas ou suspensas hoje (o que a passagem de turno tem de levar)
//   4. mensagens do Mural por resolver
//
// NADA é inventado: cada linha aponta para um registo real e leva o utilizador
// ao sítio onde ele está. Se não houver nada, o sino diz que não há nada — que
// é uma resposta legítima e, num dia bom, a mais comum.

type Aviso = {
  id: string
  type: string
  title: string
  body: string
  href: string
  created_at: string
  priority: 'high' | 'normal'
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ notifications: [], unread: 0 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: prof } = await supabase
    .from('profiles').select('active_org_id, org_id').eq('id', userId).maybeSingle()
  const orgId = prof?.active_org_id || prof?.org_id || null

  // Sem organização não há nada institucional para mostrar. Devolvemos vazio,
  // mas com `sem_org` — antes isto era indistinguível de "está tudo em ordem",
  // e foi exatamente por aqui que o sino pareceu partido durante meses.
  if (!orgId) return NextResponse.json({ notifications: [], unread: 0, sem_org: true })

  const hoje = ptDate()
  const desde48h = new Date(Date.now() - 48 * 3600000).toISOString()

  const [inc, fam, mar, mural, pts] = await Promise.all([
    supabase.from('incidents')
      .select('id, date, type, description, patient_id')
      .eq('org_id', orgId).eq('follow_up_required', true)
      .order('date', { ascending: false }).limit(10)
      .then(r => r, () => ({ data: [] as any[] })),
    supabase.from('family_thread_messages')
      .select('id, patient_id, body, created_at, author_side')
      .eq('org_id', orgId).eq('author_side', 'family')
      .gte('created_at', desde48h)
      .order('created_at', { ascending: false }).limit(10)
      .then(r => r, () => ({ data: [] as any[] })),
    supabase.from('mar_records')
      .select('id, patient_id, status, date')
      .eq('org_id', orgId).eq('date', hoje).in('status', ['refused', 'held'])
      .limit(10)
      .then(r => r, () => ({ data: [] as any[] })),
    supabase.from('team_messages')
      .select('id, channel, body, author_name, priority, created_at')
      .eq('org_id', orgId).neq('author_id', userId)
      .in('priority', ['importante', 'urgente']).eq('resolved', false)
      .gte('created_at', desde48h)
      .order('created_at', { ascending: false }).limit(10)
      .then(r => r, () => ({ data: [] as any[] })),
    supabase.from('patients').select('id, name').eq('org_id', orgId)
      .then(r => r, () => ({ data: [] as any[] })),
  ])

  const nome: Record<string, string> = {}
  ;((pts as any).data || []).forEach((p: any) => { nome[p.id] = p.name })
  const quem = (id: string) => nome[id] || 'Utente'

  const TIPOS: Record<string, string> = {
    fall: 'Queda', medication_error: 'Erro de medicação', pressure_ulcer: 'Úlcera de pressão',
    behavioral: 'Incidente comportamental', choking: 'Engasgamento', infection: 'Infeção', other: 'Ocorrência',
  }

  const avisos: Aviso[] = [
    ...((inc as any).data || []).map((i: any): Aviso => ({
      id: `inc-${i.id}`,
      type: 'incidente',
      title: `${TIPOS[i.type] || 'Ocorrência'} · ${quem(i.patient_id)}`,
      body: 'Seguimento por fazer.',
      href: '/incidents',
      created_at: i.date,
      priority: 'high',
    })),
    ...((fam as any).data || []).map((m: any): Aviso => ({
      id: `fam-${m.id}`,
      type: 'familia',
      title: `Família de ${quem(m.patient_id)}`,
      body: (m.body || '').slice(0, 90),
      href: '/family',
      created_at: m.created_at,
      priority: 'normal',
    })),
    ...((mar as any).data || []).map((d: any): Aviso => ({
      id: `mar-${d.id}`,
      type: 'medicacao',
      title: `${quem(d.patient_id)} · toma ${d.status === 'refused' ? 'recusada' : 'suspensa'}`,
      body: 'Confirmar na passagem de turno.',
      href: '/mar',
      created_at: d.date,
      priority: 'high',
    })),
    ...((mural as any).data || []).map((m: any): Aviso => ({
      id: `mural-${m.id}`,
      type: 'mural',
      title: `${m.channel} · ${m.author_name}`,
      body: (m.body || '').slice(0, 90),
      href: '/equipa?tab=mural',
      created_at: m.created_at,
      priority: m.priority === 'urgente' ? 'high' : 'normal',
    })),
  ]

  // Urgente primeiro, e dentro de cada grupo o mais recente à frente.
  avisos.sort((a, b) =>
    a.priority === b.priority
      ? String(b.created_at).localeCompare(String(a.created_at))
      : a.priority === 'high' ? -1 : 1
  )

  return NextResponse.json({ notifications: avisos.slice(0, 20), unread: avisos.length })
}
