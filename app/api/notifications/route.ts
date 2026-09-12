import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'
import { avisosDaInstituicao, avisosPessoais, type Aviso } from '@/lib/avisos'

// ── O SINO ────────────────────────────────────────────────────────────────
// Reescrito 2026-08-31 (juntava só mensagens do Mural e estava quase sempre
// vazio) e outra vez 2026-09-12, por uma razão diferente: o cálculo do que
// merece atenção passou para lib/avisos.ts, partilhado com o cron das
// notificações.
//
// Antes eram dois cálculos independentes que davam respostas diferentes — o
// sino mostrava quatro tipos de aviso, o push enviava um só, e mal. Agora se
// está no sino é porque foi (ou vai ser) empurrado, e vice-versa.
//
// Fora de uma instituição o sino deixou de estar vazio: mostra o que falta
// tomar hoje e o que está a acabar (ver avisosPessoais).

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ notifications: [], unread: 0 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return NextResponse.json({ notifications: [], unread: 0 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })

  const { data: prof } = await supabase
    .from('profiles').select('active_org_id, org_id, institution_type').eq('id', userId).maybeSingle()
  const orgId = prof?.active_org_id || prof?.org_id || null

  const avisos: Aviso[] = orgId
    ? await avisosDaInstituicao(supabase, orgId, {
        excluirAutor: userId,
        tipoInstituicao: (prof as any)?.institution_type || null,
      })
    : await avisosPessoais(supabase, userId)

  // O formato que o componente do sino já lê. Mantido de propósito: mudar o
  // motor por baixo não é razão para mexer na interface.
  return NextResponse.json({
    notifications: avisos.slice(0, 20).map(a => ({
      id: a.id,
      type: a.tipo,
      title: a.titulo,
      body: a.corpo,
      href: a.href,
      created_at: a.quando,
      priority: a.urgencia === 'alta' ? 'high' : 'normal',
    })),
    unread: avisos.length,
    sem_org: !orgId,
  })
}
