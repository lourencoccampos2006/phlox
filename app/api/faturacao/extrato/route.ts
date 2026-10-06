// app/api/faturacao/extrato/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Enviar o extrato de conta de um utente à família.
//
// ── PORQUE É QUE ISTO É UMA ROTA E NÃO UM BOTÃO NO BROWSER ─────────────────
// Por três razões, e nenhuma é de arquitetura.
//
// 1. OS NÚMEROS CONTAM-SE AQUI. O ecrã podia mandar o extrato já feito — e
//    seria mais simples. Mas então o que chega à família é o que o browser
//    disse, não o que a base de dados sabe. Um separador aberto há duas horas
//    enviava os números de há duas horas, e ninguém daria por isso.
//
// 2. O EMAIL DA FAMÍLIA NÃO É DO LADO DE QUEM MANDA. Está em `profiles`, que
//    a RLS fecha a toda a gente menos ao próprio (sprint168). Ler a lista de
//    ligações e os emails exige a chave de serviço, que nunca sai do servidor.
//
// 3. UM EXTRATO NÃO SE ENVIA DUAS VEZES. A marca em `correio_enviado` é por
//    utente e por mês. Dois cliques seguidos — ou dois separadores abertos —
//    não fazem dois emails.
//
// ── E SÓ QUEM GERE A CASA ───────────────────────────────────────────────────
// Isto manda dinheiro para fora da instituição. O papel é conferido aqui com a
// chave de serviço, e não pela interface: quem chamar esta rota à mão sem ser
// dono recebe 403.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, extratoEmail } from '@/lib/email'
import {
  extratoDoMes, euro, saldoEmPalavras, mesPorExtenso,
  type Mensalidade, type Movimento,
} from '@/lib/contaCorrente'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } })
}

const PAPEIS_QUE_GEREM = ['owner', 'admin', 'dono', 'direcao']

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[phlox:extrato] SUPABASE_SERVICE_ROLE_KEY em falta')
    return NextResponse.json({ error: 'Esta parte ainda não está disponível nesta conta.' }, { status: 503 })
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Sessão em falta.' }, { status: 401 })

  const a = admin()
  const { data: { user } } = await a.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const patientId = String(body.patientId || '')
  const mes = String(body.mes || '')
  // `simular` monta tudo e não envia nada. Serve para ver o que ia sair antes
  // de o mandar para a mão de uma família.
  const simular = body.simular === true
  if (!patientId || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: 'Faltam o utente e o mês.' }, { status: 400 })
  }

  // ── Quem está a pedir, e pode? ─────────────────────────────────────────────
  const { data: prof, error: erroPerfil } = await a.from('profiles')
    .select('active_org_id, org_id').eq('id', user.id).single()
  if (erroPerfil) {
    console.error('[phlox:extrato] perfil:', erroPerfil.message)
    return NextResponse.json({ error: 'Não foi possível confirmar o seu acesso.' }, { status: 500 })
  }
  const orgId = prof?.active_org_id || prof?.org_id || null
  if (!orgId) return NextResponse.json({ error: 'Sem instituição.' }, { status: 400 })

  const { data: mem, error: erroMembro } = await a.from('org_members')
    .select('role').eq('org_id', orgId).eq('user_id', user.id).eq('active', true).maybeSingle()
  // Uma leitura falhada NÃO é «não tem acesso»: é «não sei». E numa
  // verificação de permissões as duas respondem-se da mesma maneira — a negar.
  if (erroMembro) {
    console.error('[phlox:extrato] papel:', erroMembro.message)
    return NextResponse.json({ error: 'Não foi possível confirmar o seu acesso.' }, { status: 500 })
  }
  if (!mem || !PAPEIS_QUE_GEREM.includes(mem.role)) {
    return NextResponse.json({ error: 'Não tem acesso a esta parte.' }, { status: 403 })
  }

  // ── O utente é mesmo desta casa? ──────────────────────────────────────────
  // Sem isto, quem gere uma casa podia pedir o extrato de um utente de outra
  // passando o id — a chave de serviço passa por cima da RLS, e é por isso que
  // a verificação tem de ser escrita à mão em todo o lado onde ela é usada.
  const { data: utente, error: erroUtente } = await a.from('patients')
    .select('id, name, org_id').eq('id', patientId).maybeSingle()
  if (erroUtente) {
    console.error('[phlox:extrato] utente:', erroUtente.message)
    return NextResponse.json({ error: 'Não foi possível ler a ficha agora.' }, { status: 500 })
  }
  if (!utente || utente.org_id !== orgId) {
    return NextResponse.json({ error: 'Utente não encontrado.' }, { status: 404 })
  }

  // ── Os números, contados AQUI ─────────────────────────────────────────────
  const [rMens, rMov] = await Promise.all([
    a.from('billing_entries')
      .select('patient_id, month, fee, subsidy, extras, discount, paid')
      .eq('patient_id', patientId),
    a.from('conta_do_utente')
      .select('id, patient_id, data, mes, sentido, tipo, descricao, valor')
      .eq('patient_id', patientId),
  ])

  // Se UMA destas falhar, o extrato sai com menos linhas e um total errado —
  // e vai à mesma para a mão de uma família. É a falha mais perigosa desta
  // rota, e por isso para-se aqui em vez de se mandar o que se conseguiu ler.
  if (rMens.error || rMov.error) {
    console.error('[phlox:extrato] contas:', rMens.error?.message || rMov.error?.message)
    return NextResponse.json({ error: 'Não foi possível ler a conta agora. Tente outra vez.' }, { status: 500 })
  }
  const mensalidades = rMens.data
  const movimentos = rMov.data

  const extrato = extratoDoMes(
    mes,
    (mensalidades || []) as unknown as Mensalidade[],
    ((movimentos || []) as any[]).map(m => ({ ...m, valor: Number(m.valor) })) as Movimento[],
  )

  // Um mês sem nada não gera email. Mandar um extrato a zeros é mandar um
  // email que não diz nada — e ensina a família a não os abrir.
  if (!extrato.linhas.length && Math.round(extrato.saldoAnterior * 100) === 0) {
    return NextResponse.json({ ok: false, motivo: 'sem_movimentos' })
  }

  // ── A quem? ───────────────────────────────────────────────────────────────
  const { data: ligacoes, error: erroLigacoes } = await a.from('family_institution_links')
    .select('user_id').eq('patient_id', patientId)
  // «Não consegui ler» não é «não tem família». Dizer a segunda mandava quem
  // está do outro lado ligar uma família que já está ligada.
  if (erroLigacoes) {
    console.error('[phlox:extrato] ligações:', erroLigacoes.message)
    return NextResponse.json({ error: 'Não foi possível ver quem recebe. Tente outra vez.' }, { status: 500 })
  }
  const ids = [...new Set((ligacoes || []).map((l: any) => l.user_id))]
  if (!ids.length) return NextResponse.json({ ok: false, motivo: 'sem_familia' })

  const { data: perfis, error: erroPerfis } = await a.from('profiles')
    .select('id, email, blocked').in('id', ids)
  if (erroPerfis) {
    console.error('[phlox:extrato] emails:', erroPerfis.message)
    return NextResponse.json({ error: 'Não foi possível ver quem recebe. Tente outra vez.' }, { status: 500 })
  }
  const destinos = (perfis || []).filter((p: any) => p.email && !p.blocked)
  if (!destinos.length) return NextResponse.json({ ok: false, motivo: 'sem_email' })

  // Esta é a ÚNICA que pode falhar sem parar nada: sem o nome da casa o
  // extrato sai assinado só pelo Phlox, que é pior mas não é errado.
  const { data: casa, error: erroCasa } = await a.from('organizations')
    .select('name').eq('id', orgId).maybeSingle()
  if (erroCasa) console.error('[phlox:extrato] nome da casa:', erroCasa.message)

  const { subject, html } = extratoEmail({
    nomeUtente: utente.name,
    mesPorExtenso: mesPorExtenso(mes),
    nomeCasa: casa?.name || null,
    saldoAnterior: Math.round(extrato.saldoAnterior * 100) !== 0 ? euro(extrato.saldoAnterior) : null,
    linhas: extrato.linhas.map(l => ({
      data: l.data ? l.data.split('-').reverse().join('/') : null,
      descricao: l.descricao,
      debito: l.debito !== null ? euro(l.debito) : null,
      credito: l.credito !== null ? euro(l.credito) : null,
    })),
    totalDebitos: euro(extrato.totalDebitos),
    totalCreditos: euro(extrato.totalCreditos),
    saldoFinal: euro(extrato.saldoFinal),
    saldoEmPalavras: saldoEmPalavras(extrato.saldoFinal),
  })

  if (simular) {
    return NextResponse.json({
      ok: true, simulacao: true,
      para: destinos.length, assunto: subject,
      saldo: extrato.saldoFinal, linhas: extrato.linhas.length,
    })
  }

  // ── A trava: um extrato por utente, por mês ──────────────────────────────
  // `correio_enviado` tem chave única. Se o insert falhar, já foi enviado — e
  // isso não é um erro, é a trava a funcionar.
  const marca = `extrato:${patientId}:${mes}`
  const hoje = new Date().toISOString().slice(0, 10)
  const { error: erroMarca } = await a.from('correio_enviado').insert({ chave: marca, dia: hoje })
  if (erroMarca) return NextResponse.json({ ok: false, motivo: 'ja_enviado' })

  let enviados = 0
  const falhas: string[] = []
  for (const d of destinos) {
    const r = await sendEmail({ to: d.email, subject, html })
    if (r.ok) enviados++
    else falhas.push(String(r.error || 'o email não saiu').slice(0, 80))
  }

  if (!enviados) {
    // Nenhum saiu: tira-se a marca, senão o mês fica trancado para sempre e
    // ninguém percebe porque é que o botão deixou de fazer nada.
    //
    // E se ATÉ ISTO falhar, diz-se alto. É a pior das três falhas possíveis
    // aqui: o email não saiu E o mês ficou trancado, e a pessoa do outro lado
    // fica a carregar num botão que responde sempre «já foi enviado».
    const { error: erroDesmarcar } = await a.from('correio_enviado')
      .delete().eq('chave', marca).eq('dia', hoje)
    if (erroDesmarcar) {
      console.error('[phlox:extrato] A MARCA FICOU. ' + marca + ' tranca o mês:', erroDesmarcar.message)
    }
    console.error('[phlox:extrato] nenhum email saiu:', falhas.join(' | '))
    return NextResponse.json({ ok: false, motivo: 'envio_falhou' })
  }

  return NextResponse.json({ ok: true, enviados, falhas: falhas.length || undefined })
}
