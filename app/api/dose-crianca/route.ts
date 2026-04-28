// ─── NOVO: app/api/dose-crianca/route.ts ───
// Calculadora de Dose Pediátrica — gratuita, sem login.
// Rate limit: 10 pedidos/minuto por IP. Temperature 0.0.

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP } from '@/lib/rateLimit'

interface DosePedResult {
  medicamento: string
  dose_calculada: string
  calculo_mostrado: string
  frequencia: string
  duracao: string
  forma_farmaceutica: string
  alertas_pediatricos: string[]
  contraindicado: boolean
  alternativa?: string
  observacoes: string
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const { allowed } = checkRateLimit(ip, 10, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um minuto.' }, { status: 429 })

  let body: { medicamento?: string; peso?: number; idade_anos?: number; idade_meses?: number; indicacao?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 }) }

  const { medicamento, peso, idade_anos, idade_meses, indicacao } = body
  if (!medicamento?.trim()) return NextResponse.json({ error: 'Nome do medicamento obrigatório' }, { status: 400 })
  if (!peso || peso <= 0) return NextResponse.json({ error: 'Peso obrigatório' }, { status: 400 })

  const idadeTexto = idade_anos != null && idade_anos >= 0
    ? `${idade_anos} anos${idade_meses ? ` e ${idade_meses} meses` : ''}`
    : idade_meses != null ? `${idade_meses} meses`
    : 'não especificada'

  try {
    const result = await aiJSON<DosePedResult>([
      {
        role: 'system',
        content: `És um farmacêutico pediátrico português especialista em posologia pediátrica. Calculado com base em mg/kg.
Responde SEMPRE em português europeu (PT-PT).
Devolve APENAS JSON válido com esta estrutura exacta:
{
  "medicamento": "nome do medicamento",
  "dose_calculada": "dose total calculada (ex: 200mg por toma)",
  "calculo_mostrado": "fórmula do cálculo (ex: 10mg/kg × 20kg = 200mg)",
  "frequencia": "frequência de administração (ex: de 8 em 8 horas)",
  "duracao": "duração do tratamento recomendada",
  "forma_farmaceutica": "forma adequada para a idade (ex: suspensão oral, comprimidos dispersíveis)",
  "alertas_pediatricos": ["lista de alertas específicos para esta faixa etária/medicamento"],
  "contraindicado": false,
  "alternativa": "alternativa mais segura se contraindicado, ou null",
  "observacoes": "informação clínica adicional relevante"
}
Se o medicamento for contraindicado em crianças (ex: aspirina em <12 anos, codeína em <12 anos, fluoroquinolonas em crianças pequenas), coloca contraindicado: true e sugere alternativa.
Alerta sempre se a dose calculada exceder a dose máxima absoluta.`,
      },
      {
        role: 'user',
        content: `Calcula a dose pediátrica para:
- Medicamento: ${medicamento.trim()}
- Peso: ${peso} kg
- Idade: ${idadeTexto}
- Indicação: ${indicacao?.trim() || 'não especificada'}

Mostra o cálculo mg/kg, a dose por toma, frequência, forma farmacêutica adequada e alertas pediátricos relevantes.`,
      },
    ], { maxTokens: 800, temperature: 0.0 })

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao calcular. Tenta novamente.' }, { status: 500 })
  }
}
