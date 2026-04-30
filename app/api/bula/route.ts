// ─── NOVO: app/api/bula/route.ts ───
// Tradutor de Bula — gratuito, sem login obrigatório.
// Rate limit: 8 pedidos/minuto por IP.

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP } from '@/lib/rateLimit'

interface BulaResult {
  para_que_serve: string
  o_que_nao_podes_fazer: string[]
  quando_ir_ao_medico: string[]
  seguranca_especial: { criancas: string; idosos: string; gravidas: string }
  interacoes: string[]
  nome_medicamento: string
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const { allowed } = checkRateLimit(ip, 8, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um minuto.' }, { status: 429 })

  let body: { texto?: string; medicamento?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 }) }

  const { texto, medicamento } = body
  if (!texto?.trim() && !medicamento?.trim()) {
    return NextResponse.json({ error: 'Indica o nome do medicamento ou cola o texto da bula.' }, { status: 400 })
  }

  const input = texto?.trim()
    ? `Bula completa:\n${texto.trim()}`
    : `Nome do medicamento: ${medicamento!.trim()}`

  try {
    const result = await aiJSON<BulaResult>([
      {
        role: 'system',
        content: `És um farmacêutico clínico português. Explicas bulas de medicamentos em linguagem simples para doentes, não médicos.
Responde SEMPRE em português europeu (PT-PT). Sê claro, directo e empático.
Devolve APENAS JSON válido com esta estrutura exacta:
{
  "nome_medicamento": "nome do medicamento identificado",
  "para_que_serve": "explicação simples em 2-3 frases do que o medicamento faz",
  "o_que_nao_podes_fazer": ["lista de restrições importantes enquanto tomas (máx 5)"],
  "quando_ir_ao_medico": ["lista de sinais de alarme que exigem consulta urgente (máx 5)"],
  "seguranca_especial": {
    "criancas": "seguro/contraindicado/com precaução — e porquê",
    "idosos": "ajuste de dose/risco/precauções",
    "gravidas": "seguro/contraindicado/categoria de risco"
  },
  "interacoes": ["lista de interações com álcool, alimentos e medicamentos comuns (máx 5)"]
}`,
      },
      {
        role: 'user',
        content: `Traduz esta bula para linguagem simples:\n\n${input}`,
      },
    ], { maxTokens: 1200, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao processar. Tenta novamente.' }, { status: 500 })
  }
}
