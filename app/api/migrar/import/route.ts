// app/api/migrar/import/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// TRAZER UMA CASA INTEIRA DE OUTRO SISTEMA
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O QUE ESTAVA MAL, E PORQUE É QUE ERA GRAVE ─────────────────────────────
// Esta rota escrevia `user_id: userId` e MAIS NADA. Sem `org_id`.
//
// Numa casa com equipa — que são todas — isso quer dizer o seguinte: a direção
// técnica importa sessenta residentes do sistema antigo, vê sessenta linhas,
// dá o trabalho por feito. No dia seguinte a auxiliar abre a /patients e não
// vê ninguém. A RLS da `patients` filtra pela casa; linhas sem `org_id` não
// pertencem a casa nenhuma e só aparecem a quem as escreveu.
//
// É o pior momento possível para falhar: a migração é a primeira coisa que uma
// casa faz com o produto, e falha de uma maneira que parece ter corrido bem.
//
// Também faltava:
//   · `active: true` nos utentes — a /patients filtra por `active` e os
//     importados podiam nunca aparecer;
//   · o quarto ia para as NOTAS («Quarto: 12») em vez de `room_number`, que
//     existe desde sempre e é por onde a casa os ordena;
//   · a medicação não dizia se se toma em casa ou no centro (`take_location`),
//     e num centro de dia isso decide quem a dá.
//
// ── PORQUE É QUE CONTINUA A USAR O CLIENTE DO UTILIZADOR ───────────────────
// Anon + o JWT de quem chamou. A RLS é que decide o que entra, e é isso que
// se quer: alguém sem `utentes.editar` não importa sessenta pessoas para a
// casa por esta porta. Com a chave de serviço, a rota passava a decidir
// sozinha — e uma rota que decide sozinha é uma rota que um dia decide mal.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 5, 60_000).allowed) return rateLimitResponse()
  const { plan, userId } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Migração')
  if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const body = await req.json().catch(() => null)
  const { import_mode, items = [], source_system } = body || {}

  if (!items.length) return NextResponse.json({ error: 'Sem dados para importar' }, { status: 400 })

  /* ── A CASA ────────────────────────────────────────────────────────────
     Lê-se COM o cliente do utilizador: a RLS da `org_members` é que confirma
     que esta pessoa é mesmo membro. O `error` é lido de propósito — uma
     leitura falhada não é «não pertence a casa nenhuma», e tratá-la como tal
     era voltar a escrever linhas órfãs, que é o bug que isto corrige. */
  const { data: membro, error: erroMembro } = await supabase
    .from('org_members').select('org_id')
    .eq('user_id', userId).eq('active', true).maybeSingle()

  if (erroMembro) {
    console.error('[phlox:migrar:import]', erroMembro)
    return NextResponse.json({
      error: 'Não foi possível confirmar a que casa pertence. Nada foi importado.',
    }, { status: 503 })
  }

  const orgId = membro?.org_id || null
  /* Sem casa, importa-se para a conta pessoal como sempre se fez — é o caso de
     quem usa o Phlox sozinho. O que não pode acontecer é uma pessoa COM casa
     importar para fora dela sem dar por isso. */
  const daCasa = <T extends object>(linha: T) => (orgId ? { ...linha, org_id: orgId } : linha)

  let inserted = 0
  const errors: string[] = []
  const fonte = `importado:${source_system || 'manual'}`

  /** Alergias como texto: vêm ora em lista, ora já numa cadeia. */
  const alergias = (a: any): string | null => {
    if (Array.isArray(a)) return a.filter(Boolean).join(', ') || null
    const t = String(a || '').trim()
    return t || null
  }

  try {
    if (import_mode === 'medications') {
      // Medicação da PRÓPRIA pessoa (modo pessoal). Não leva `org_id`: é dela.
      const meds = items.map((m: any) => ({
        user_id: userId,
        name: m.name || 'Desconhecido',
        dose: m.dose || null,
        frequency: m.frequency || null,
        route: m.route || null,
        indication: m.indication || null,
        source: fonte,
        created_at: new Date().toISOString(),
      }))
      const { data, error } = await supabase.from('personal_meds').insert(meds).select()
      if (error) throw error
      inserted = data?.length || 0

    } else if (import_mode === 'patients' || import_mode === 'residents') {
      /* Os dois modos ficaram um só. Eram iguais em tudo menos no quarto, e
         ter dois caminhos para a mesma escrita era garantir que um deles
         ficava para trás na correção seguinte — que foi exactamente o que
         aconteceu com o `org_id`. */
      for (const item of items) {
        const { data: pt, error: ptErr } = await supabase.from('patients')
          .insert(daCasa({
            user_id: userId,
            name: item.name || 'Sem nome',
            age: item.age || null,
            birth_date: item.birth_date || null,
            sex: item.sex || null,
            conditions: item.diagnosis || null,
            allergies: alergias(item.allergies),
            room_number: item.room ? String(item.room) : null,
            address: item.address || null,
            telefone: item.phone || null,
            notes: item.sns ? `SNS: ${item.sns}` : null,
            // A /patients lê `.eq('active', true)`. Sem isto, uma coluna com
            // outro valor por omissão fazia a importação inteira desaparecer.
            active: true,
          }))
          .select('id').single()

        if (ptErr) { errors.push(`${item.name || 'sem nome'}: ${ptErr.message}`); continue }

        if (item.medications?.length && pt?.id) {
          const meds = item.medications.map((m: any) => daCasa({
            patient_id: pt.id,
            user_id: userId,
            name: m.name,
            dose: m.dose || null,
            frequency: m.frequency || null,
            // Onde se toma. Num centro de dia é o que decide quem a dá, e o
            // valor seguro é «aqui»: uma pessoa a quem a casa dá a medicação
            // que o sistema antigo dizia ser de casa fica com ela a mais no
            // pastilheiro — visível. Ao contrário, fica sem ela — e ninguém vê.
            take_location: 'centro',
            active: true,
            source: fonte,
          }))
          const { error: medsErr } = await supabase.from('patient_meds').insert(meds)
          if (medsErr) errors.push(`${item.name}: medicação não importada (${medsErr.message})`)
        }

        // Os contactos de família, quando o ficheiro os traz.
        if (item.contacts?.length && pt?.id) {
          const cts = item.contacts.map((c: any) => daCasa({
            patient_id: pt.id,
            user_id: userId,
            name: c.name || 'Contacto',
            relationship: c.relationship || null,
            phone: c.phone || null,
            email: c.email || null,
            is_emergency: !!c.is_emergency,
          }))
          const { error: ctErr } = await supabase.from('resident_contacts').insert(cts)
          if (ctErr) errors.push(`${item.name}: contactos não importados (${ctErr.message})`)
        }

        inserted++
      }

    } else if (import_mode === 'labs') {
      const { error } = await supabase.from('lab_records').insert({
        user_id: userId,
        date: items[0]?.date || new Date().toISOString().split('T')[0],
        lab_name: body.lab_name || 'Importado',
        values: items.map((v: any) => ({
          name: v.name,
          value: v.value,
          unit: v.unit,
          reference: v.reference,
          status: v.status || 'NORMAL',
          interpretation: null,
        })),
        flags: items.filter((v: any) => v.status && v.status !== 'NORMAL').map((v: any) => v.name),
        source: fonte,
        ai_summary: null,
      })
      if (error) throw error
      inserted = 1

    } else {
      return NextResponse.json({ error: 'Não sei importar esse tipo de dados.' }, { status: 400 })
    }

    /* Dizer PARA ONDE foi. Uma conta sem casa que importa sessenta residentes
       tem de o saber antes de fechar a página — e não dois dias depois,
       quando a equipa pergunta onde estão. */
    return NextResponse.json({
      success: inserted,
      errors,
      paraACasa: !!orgId,
      aviso: orgId ? null
        : 'Isto foi importado para a sua conta pessoal — a sua conta ainda não '
          + 'pertence a nenhuma instituição, por isso a equipa não vai ver estes dados.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao importar' }, { status: 500 })
  }
}
