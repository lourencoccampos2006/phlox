// app/api/medicamento-ficha/route.ts
// ───────────────────────────────────────────────────────────────────────────
// O rótulo de um medicamento, da cache ou do OpenFDA.
//
// É a mesma `lib/efeitosDaMedicacao` que serve o cruzamento com as ocorrências
// — de propósito: se a ficha mostrasse uma lista de efeitos e o cruzamento
// usasse outra, as duas acabariam por discordar e ninguém saberia qual seguir.
//
// Precisa de sessão, mas não de pertencer a uma casa: o que está aqui é
// referência pública (o que o fabricante publicou), e não há aqui dado de
// pessoa nenhuma. Esconder a bula de um medicamento a quem está a cuidar de
// alguém não protege nada.
import { NextRequest, NextResponse } from 'next/server'
import { makeSupabase, getToken } from '@/lib/orgAuth'
import { efeitosDe } from '@/lib/efeitosDaMedicacao'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })

  const nome = (req.nextUrl.searchParams.get('nome') || '').trim()
  if (nome.length < 2) return NextResponse.json({ error: 'Falta o nome.' }, { status: 400 })

  const supabase = makeSupabase(token)
  const f = await efeitosDe(supabase, nome)

  /* Sem rótulo e sem cache, devolve-se um registo HONESTO em vez de um 404.
     A ficha precisa de poder dizer «não encontrámos», que é diferente de
     «falhou» — e um 404 na consola faria a página mostrar um erro quando o
     que há é ausência de informação. */
  if (!f) {
    return NextResponse.json({
      encontrado: false, nome_original: nome,
      indicacoes: null, texto_adversos: null, avisos: null, interacoes: null,
      fonte: null, efeitos: [],
    })
  }

  return NextResponse.json({
    encontrado: f.encontrado,
    nome_original: f.nome_original,
    indicacoes: f.indicacoes,
    texto_adversos: f.texto_adversos,
    avisos: f.avisos,
    interacoes: f.interacoes,
    fonte: f.fonte,
    efeitos: f.efeitos || [],
  })
}
