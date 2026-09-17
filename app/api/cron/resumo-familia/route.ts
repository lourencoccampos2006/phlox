// app/api/cron/resumo-familia/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// "Como correu o dia" — o email que a família recebe ao fim da tarde.
//
// ── PORQUE É QUE ISTO EXISTE ────────────────────────────────────────────────
// O modelo `familyDailyEmail` estava escrito em lib/email.ts há muito e nunca
// foi ligado a nada. O resumo do dia existia, mas só para quem abrisse o
// portal — e quem tem o pai num centro de dia não abre uma aplicação todos os
// dias às sete da tarde. Abre o email.
//
// É a diferença entre um centro que comunica e um que tem uma página onde a
// informação está, caso alguém se lembre de a ir ver.
//
// ── O QUE SE ENVIA, E O QUE NÃO SE ENVIA ────────────────────────────────────
// Sai de lib/diaDaFamilia (o mesmo texto que o portal mostra — se divergissem,
// a família via o mesmo dia contado de duas maneiras). É DETERMINÍSTICO: conta
// o que a equipa registou, sem IA e sem interpretação clínica.
//
// **Sem registos, não há email.** Um "correu tudo bem" num dia em que ninguém
// registou nada é mentira — e é exatamente o género de mentira que destrói a
// confiança de uma família num centro. Silêncio é melhor.
//
// Nada de clínico no assunto: aparece no ecrã de bloqueio do telemóvel.
//
// ── A TRAVA ─────────────────────────────────────────────────────────────────
// `correio_enviado` tem um unique (chave, dia). Uma repetição do cron, ou um
// disparo à mão, bate no índice e não envia. Ver sprint148.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, familyDailyEmail } from '@/lib/email'
import { summariseDay } from '@/lib/diaDaFamilia'
import { querReceber } from '@/lib/notificacoes'
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

  const simular = req.nextUrl.searchParams.get('simular') === '1'
  const hoje = ptDate()

  // As ligações família↔residente. Cada uma é uma pessoa à espera de saber
  // como correu o dia de alguém.
  const { data: ligacoes, error: erroLigacoes } = await sb
    .from('family_institution_links')
    .select('id, user_id, patient_id, patient_name')
  if (erroLigacoes) {
    return NextResponse.json({ error: 'Não foi possível ler as ligações.', detalhe: erroLigacoes.message }, { status: 500 })
  }
  if (!ligacoes?.length) return NextResponse.json({ dia: hoje, ligacoes: 0, enviados: 0 })

  // Emails e preferências, de uma vez — uma consulta por família seria uma
  // consulta por linha.
  const idsUtilizador = [...new Set(ligacoes.map((l: any) => l.user_id))]
  const { data: perfis } = await sb.from('profiles')
    .select('id, email, blocked, notification_prefs').in('id', idsUtilizador)
  const porUtilizador = new Map((perfis || []).map((p: any) => [p.id, p]))

  const idsResidente = [...new Set(ligacoes.map((l: any) => l.patient_id))]
  const { data: residentes } = await sb.from('patients')
    .select('id, name, org_id').in('id', idsResidente)
  const porResidente = new Map((residentes || []).map((p: any) => [p.id, p]))

  const { data: orgs } = await sb.from('organizations').select('id, suspended')
  const suspensas = new Set((orgs || []).filter((o: any) => o.suspended).map((o: any) => o.id))

  let enviados = 0, semNada = 0, jaEnviados = 0, semDestino = 0
  const falhas: string[] = []

  for (const l of ligacoes as any[]) {
    try {
      const perfil = porUtilizador.get(l.user_id)
      const residente = porResidente.get(l.patient_id)
      if (!perfil?.email || perfil.blocked) { semDestino++; continue }
      if (!residente || suspensas.has(residente.org_id)) { semDestino++; continue }

      // A escolha da pessoa manda. Ver /settings → O que queres receber.
      if (!querReceber(perfil.notification_prefs || {}, 'resumo_centro')) { semDestino++; continue }

      // ── O dia ────────────────────────────────────────────────────────────
      const [{ data: recs }, { data: mar }, { data: att }] = await Promise.all([
        sb.from('care_records').select('date, nutrition, mood, notes').eq('patient_id', l.patient_id).eq('date', hoje),
        sb.from('mar_records').select('date, status').eq('patient_id', l.patient_id).eq('date', hoje),
        // Lista, nao maybeSingle: se houver duas marcacoes para o mesmo dia
        // (acontece quando alguem corrige a chegada), o maybeSingle devolvia
        // erro e a familia ficava sem email.
        sb.from('attendance').select('date, status, arrived_at, left_at').eq('patient_id', l.patient_id).eq('date', hoje).limit(1),
      ])

      const nome = (l.patient_name || residente.name || '').trim()
      const primeiro = nome.split(/\s+/)[0] || 'o seu familiar'
      // `isToday: false` de propósito. O dia no centro já acabou quando isto
      // corre — "já tomou 2 de 3 até agora" seria uma frase de meio da tarde.
      const resumo = summariseDay(hoje, recs || [], mar || [], primeiro, false, (att || [])[0] || null)

      // Sem registos, não se escreve nada. Ver o cabeçalho.
      if (!resumo.lines.length) { semNada++; continue }

      // ── A trava ──────────────────────────────────────────────────────────
      const marca = `resumo-familia:${l.id}`
      if (!simular) {
        const { error: erroMarca } = await sb.from('correio_enviado').insert({ chave: marca, dia: hoje })
        if (erroMarca) { jaEnviados++; continue }   // 23505 = já foi hoje
      }

      const { subject, html } = familyDailyEmail(primeiro, resumo.lines)
      if (simular) { enviados++; continue }

      const envio = await sendEmail({ to: perfil.email, subject, html })
      if (!envio.ok) {
        // O envio falhou: tira-se a marca, senão o dia fica perdido para sempre.
        await sb.from('correio_enviado').delete().eq('chave', marca).eq('dia', hoje)
        falhas.push(`${l.id}: ${String(envio.error || 'o email não saiu').slice(0, 80)}`)
        continue
      }
      enviados++
    } catch (e: any) {
      // Uma família com um problema não pode calar as outras.
      falhas.push(`${l.id}: ${String(e?.message || e).slice(0, 80)}`)
    }
  }

  return NextResponse.json({
    dia: hoje, simulacao: simular,
    ligacoes: ligacoes.length, enviados, semNada, jaEnviados, semDestino, falhas,
  })
}
