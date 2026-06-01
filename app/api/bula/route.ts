// app/api/bula/route.ts
// Tradutor de Bula — gratuito, sem login obrigatório.
// 2026-06-01: aceita imageBase64 (foto da bula) além de texto/nome.
// Devolve receita_medica { necessaria, nota } — algumas doses são MNSRM
// (sem receita) e outras precisam (ex: ibuprofeno 200/400 vs 600/800 mg).
// Rate limit: 8 pedidos/minuto por IP.

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON, callGeminiVisionJSON } from '@/lib/ai'
import { checkRateLimit, getIP } from '@/lib/rateLimit'

interface BulaResult {
  para_que_serve: string
  o_que_nao_podes_fazer: string[]
  quando_ir_ao_medico: string[]
  seguranca_especial: { criancas: string; idosos: string; gravidas: string }
  interacoes: string[]
  nome_medicamento: string
  receita_medica?: { necessaria: boolean; nota: string }
  confidence?: 'alta' | 'media' | 'baixa'
}

const SYSTEM_PROMPT = `És um farmacêutico clínico português. Explicas bulas de medicamentos em linguagem simples para doentes, não médicos.
Responde SEMPRE em português europeu (PT-PT). Sê claro, directo e empático.

Devolve APENAS JSON válido com esta estrutura exacta:
{
  "nome_medicamento": "nome do medicamento identificado (DCI + dose se relevante, ex: 'Ibuprofeno 600 mg')",
  "para_que_serve": "explicação simples em 2-3 frases do que o medicamento faz",
  "o_que_nao_podes_fazer": ["lista de restrições importantes enquanto tomas (máx 5)"],
  "quando_ir_ao_medico": ["lista de sinais de alarme que exigem consulta urgente (máx 5)"],
  "seguranca_especial": {
    "criancas": "seguro/contraindicado/com precaução — e porquê",
    "idosos": "ajuste de dose/risco/precauções",
    "gravidas": "seguro/contraindicado/categoria de risco"
  },
  "interacoes": ["lista de interações com álcool, alimentos e medicamentos comuns (máx 5)"],
  "receita_medica": {
    "necessaria": true ou false,
    "nota": "1 frase a explicar. Sê preciso com o limiar de dose em Portugal. Exemplos:
       • Paracetamol até 1 g unidose (Ben-u-ron 500/1000 mg) — MNSRM (sem receita).
       • Ibuprofeno 200 ou 400 mg — MNSRM. 600 mg e 800 mg — sujeito a receita.
       • Omeprazol 20 mg em embalagens ≤14 cápsulas — MNSRM. >14 cápsulas ou 40 mg — receita.
       • Diclofenac sódico 12.5/25 mg — MNSRM. ≥50 mg — receita.
       • Loratadina/cetirizina 10 mg — MNSRM.
       • Antibióticos, antidepressivos, ansiolíticos, opioides, insulina, antidiabéticos — TODOS receita.
       Se a dose não estiver indicada, presume a apresentação MAIS comum e diz isso na nota."
  },
  "confidence": "alta | media | baixa"
}

RIGOR ABSOLUTO:
- Identifica primeiro a DCI (substância activa) e depois responde.
- Se NÃO tiveres a certeza de que medicamento é, confidence="baixa" e diz para confirmar na farmácia. Nunca inventes.
- Nunca adivinhes utilização pelo som do nome.
- Se a foto for ilegível ou não for uma bula, confidence="baixa" e nome_medicamento="Não identificado".`

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const { allowed } = checkRateLimit(ip, 8, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um minuto.' }, { status: 429 })

  let body: { texto?: string; medicamento?: string; imageBase64?: string; mimeType?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 }) }

  const { texto, medicamento, imageBase64, mimeType } = body
  if (!texto?.trim() && !medicamento?.trim() && !imageBase64) {
    return NextResponse.json({ error: 'Indica o nome do medicamento, cola o texto da bula ou envia uma foto.' }, { status: 400 })
  }

  try {
    let result: BulaResult
    if (imageBase64) {
      const prompt = `${SYSTEM_PROMPT}\n\nLê a foto desta bula e traduz para linguagem simples seguindo o esquema. Identifica também se requer receita médica em Portugal e em que dose.`
      result = await callGeminiVisionJSON<BulaResult>(prompt, imageBase64, mimeType || 'image/jpeg', { maxTokens: 1600 })
    } else {
      const input = texto?.trim()
        ? `Bula completa:\n${texto.trim()}`
        : `Nome do medicamento: ${medicamento!.trim()}`
      result = await aiJSON<BulaResult>([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Traduz esta bula para linguagem simples:\n\n${input}` },
      ], { maxTokens: 1400, temperature: 0 })
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao processar. Tenta novamente.' }, { status: 500 })
  }
}
