// app/api/admin/instalacao/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Estado da instalação, para o /admin do dono do Phlox.
//
// Responde a uma pergunta só: que migrações estão por aplicar nesta base de
// dados? Quando um cliente manda o código `PHX-K7`, é aqui que se confirma.
//
// ── O QUE ESTA ROTA NÃO FAZ, E NÃO PODE VIR A FAZER ────────────────────────
// Não lê uma única linha de dados de nenhuma instituição. Cada verificação é
// um `select ... limit 0`: pergunta se a TABELA existe, nunca o que está lá
// dentro. O livro de registos (activity_log) é verificado da mesma maneira —
// saber que existe é uma coisa, ler o que uma equipa fez é outra, e essa é
// da instituição. Ver a nota de fronteira em sprint137_activity_log.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SETUP_CODES, type CodigoSetup } from '@/lib/setupCodes'

export const runtime = 'nodejs'

const ADMIN_EMAILS = ['lourencoccampos2006@gmail.com']

/** Que tabela prova cada código. 'env' = não é tabela, é configuração. */
const TABELA_DE: Record<CodigoSetup, string | 'env'> = {
  'PHX-B2': 'stock_items',
  'PHX-C4': 'resident_requests',
  'PHX-D6': 'team_messages',
  'PHX-E1': 'family_profile_shares',
  'PHX-F8': 'shift_vacancies',
  'PHX-G3': 'patients',                      // coluna photo_url — verificada à parte
  'PHX-H5': 'support_transport_schedules',
  'PHX-J9': 'meal_dishes',
  'PHX-K7': 'medication_prep_logs',
  'PHX-L2': 'support_recurring_logs',
  'PHX-M4': 'adl_reviews',
  'PHX-N8': 'meal_plan_entries',             // coluna course — verificada à parte
  'PHX-P1': 'user_sessions',
  'PHX-S3': 'activity_log',
  'PHX-T5': 'patients',                      // coluna lat — verificada à parte
  'PHX-R6': 'env',
}
/** Códigos que dependem de uma COLUNA e não da tabela inteira. */
const COLUNA_DE: Partial<Record<CodigoSetup, string>> = {
  'PHX-G3': 'photo_url', 'PHX-N8': 'course', 'PHX-T5': 'lat',
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: u } = await anon.auth.getUser(token)
  if (!u?.user || !ADMIN_EMAILS.includes(u.user.email || '')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) return NextResponse.json({ error: 'Sem chave de serviço no ambiente.', codigos: [] }, { status: 503 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave)

  const resultados = await Promise.all(
    (Object.keys(TABELA_DE) as CodigoSetup[]).map(async codigo => {
      const alvo = TABELA_DE[codigo]
      if (alvo === 'env') {
        return { codigo, ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY, detalhe: SETUP_CODES[codigo], sobre: 'ambiente' }
      }
      const coluna = COLUNA_DE[codigo]
      try {
        // limit(0): pergunta se existe, nunca traz conteúdo nenhum.
        const { error } = await sb.from(alvo).select(coluna || 'id').limit(0)
        return { codigo, ok: !error, detalhe: SETUP_CODES[codigo], sobre: coluna ? `${alvo}.${coluna}` : alvo }
      } catch {
        return { codigo, ok: false, detalhe: SETUP_CODES[codigo], sobre: alvo }
      }
    })
  )

  return NextResponse.json({
    codigos: resultados.sort((a, b) => Number(a.ok) - Number(b.ok)),
    porAplicar: resultados.filter(r => !r.ok).length,
  })
}
