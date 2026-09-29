// app/api/o-dia/progresso/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Quanto do dia está tratado — para o /inicio poder mostrar o MESMO número que
// o /o-dia.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// O `/inicio` tinha uma conta própria: `(doses + registos) / (pessoas × 2)`.
// Inventada, e a medir outra coisa. O Fernando pediu que a percentagem fosse a
// mesma do `/o-dia`, e a única forma de duas páginas mostrarem o mesmo número
// é montarem o dia com o mesmo código — que é o `lib/carregarODia`.
//
// ── PORQUE É QUE NÃO É O /inicio A MONTAR O DIA ────────────────────────────
// Porque montar o dia são doze consultas. O `/inicio` é a primeira página que
// abre de manhã, em telemóveis de turno, e não pode esperar por doze idas à
// base de dados para mostrar uma barra de progresso. Aqui correm todas em
// paralelo, no servidor, ao lado da base de dados, e volta um número.
//
// Usa o TOKEN de quem pergunta, nunca a chave de serviço: o progresso é o do
// trabalho que aquela pessoa pode ver.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { authedClient } from '@/lib/orgAuth'
import { carregarODia, progressoDoDia } from '@/lib/carregarODia'
import { currentShiftFor } from '@/lib/institutionConfig'
import type { InstitutionType } from '@/lib/useClinicPrefs'

export const runtime = 'nodejs'
// Doze consultas. Num dia mau da base de dados isto não pode ficar pendurado a
// segurar a primeira página da manhã.
export const maxDuration = 15

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org') || ''
  const tipo = (req.nextUrl.searchParams.get('tipo') || 'day_care') as InstitutionType
  // Sem casa não há dia de trabalho nenhum — e isso não é um erro, é o modo
  // pessoal. Devolve-se `null` e quem chama não mostra barra nenhuma.
  if (!orgId) return NextResponse.json({ progresso: null })

  const sb = authedClient(req)
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user?.id) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })

  try {
    const { tarefas, falharam } = await carregarODia(sb, orgId, currentShiftFor(tipo))
    const progresso = progressoDoDia(tarefas)
    // `falharam` viaja com a resposta: uma barra a 90% porque uma fonte não
    // respondeu é uma mentira tranquilizadora, e quem a vê tem de o saber.
    return NextResponse.json({ progresso, falharam })
  } catch (e: any) {
    console.error('[phlox:o-dia-progresso]', e?.message)
    return NextResponse.json({ progresso: null })
  }
}
