// app/api/cron/diario/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// O correio da manhã. Corre uma vez por dia e envia, por instituição:
//   • o que merece atenção hoje (o Sentinel, para quem gere a casa)
//   • as famílias que ficaram à espera de resposta
//   • o stock abaixo do mínimo
//
// Porque é que isto importa: até aqui, tudo o que o Phlox sabe só chegava a
// quem abrisse a aplicação. Um aviso que espera que alguém se lembre de ir vê-lo
// não é um aviso. É isto que faz uma diretora abrir o Phlox de manhã.
//
// Regras: um email por assunto e por dia, nunca dados clínicos no assunto (fica
// visível no ecrã de bloqueio), e nada disto falha o cron — cada instituição é
// tratada isoladamente.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, attentionDigestEmail, familyWaitingEmail, stockLowEmail } from '@/lib/email'
import { loadSentinel, combinedLevel } from '@/lib/sentinel'
import { ptDate } from '@/lib/ptTime'

export const runtime = 'nodejs'
export const maxDuration = 300

function autorizado(req: NextRequest): boolean {
  const s = process.env.CRON_SECRET
  if (!s) return false
  return req.headers.get('authorization') === `Bearer ${s}`
    || req.headers.get('x-cron-secret') === s
    || req.nextUrl.searchParams.get('secret') === s
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) return NextResponse.json({ error: 'Sem chave de serviço.' }, { status: 503 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave)

  const { data: orgs } = await sb.from('organizations').select('id, name, suspended')
  const ativas = (orgs || []).filter((o: any) => !o.suspended)
  const hoje = ptDate()
  let enviados = 0
  const falhas: string[] = []

  for (const org of ativas) {
    try {
      // Quem recebe: donos e administradores da casa.
      const { data: membros } = await sb.from('org_members')
        .select('user_id, role').eq('org_id', org.id).eq('active', true)
        .in('role', ['owner', 'admin'])
      const ids = (membros || []).map((m: any) => m.user_id)
      if (!ids.length) continue
      const { data: perfis } = await sb.from('profiles').select('id, email, blocked').in('id', ids)
      const destinos = (perfis || []).filter((p: any) => p.email && !p.blocked).map((p: any) => p.email)
      if (!destinos.length) continue

      const scope = { filter: <T,>(q: T) => (q as any).eq('org_id', org.id) }

      // ── 1. O que merece atenção ──────────────────────────────────────────
      const { results, trends } = await loadSentinel(sb, scope as any)
      const urgentes = results
        .filter(r => { const n = combinedLevel(r, trends[r.patientId]); return n === 'critical' || n === 'warning' })
        .slice(0, 10)
        .map(r => ({
          quem: r.name,
          porque: (r.outOfPattern[0]?.title || r.openItems[0]?.title || 'merece uma olhada'),
        }))
      if (urgentes.length) {
        const { subject, html } = attentionDigestEmail(org.name || 'a casa', urgentes)
        for (const to of destinos) { await sendEmail({ to, subject, html }); enviados++ }
      }

      // ── 2. Famílias à espera ─────────────────────────────────────────────
      // A última mensagem do fio é da família e ninguém respondeu.
      const { data: msgs } = await sb.from('family_thread_messages')
        .select('patient_id, author_side, created_at').eq('org_id', org.id)
        .order('created_at', { ascending: false }).limit(400)
      const ultimaPor: Record<string, string> = {}
      ;(msgs || []).forEach((m: any) => { if (!ultimaPor[m.patient_id]) ultimaPor[m.patient_id] = m.author_side })
      const aEsperar = Object.values(ultimaPor).filter(l => l === 'family').length
      if (aEsperar > 0) {
        const { subject, html } = familyWaitingEmail(aEsperar)
        for (const to of destinos) { await sendEmail({ to, subject, html }); enviados++ }
      }

      // ── 3. Stock no mínimo ───────────────────────────────────────────────
      const { data: stock } = await sb.from('stock_items')
        .select('name, quantity, unit, min_quantity').eq('org_id', org.id)
      const baixos = (stock || [])
        .filter((i: any) => Number(i.min_quantity) > 0 && Number(i.quantity) <= Number(i.min_quantity))
        .map((i: any) => ({ nome: i.name, quantidade: `${i.quantity}${i.unit ? ' ' + i.unit : ''} (mínimo ${i.min_quantity})` }))
      if (baixos.length) {
        const { subject, html } = stockLowEmail(baixos)
        for (const to of destinos) { await sendEmail({ to, subject, html }); enviados++ }
      }
    } catch (e: any) {
      // Uma casa com um problema não pode impedir o correio das outras.
      falhas.push(`${org.id}: ${String(e?.message || e).slice(0, 80)}`)
    }
  }

  return NextResponse.json({ dia: hoje, instituicoes: ativas.length, enviados, falhas })
}
