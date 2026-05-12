// app/api/migrar/analyse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Migração')

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Dados obrigatórios' }, { status: 400 })

  const { source_system, import_mode, text = '', pdf_base64, filename } = body
  let dataText = text

  // PDF extraction via Gemini
  if (pdf_base64) {
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [
                { text: `Extrai TODA a informação estruturada deste documento clínico. Para medicamentos: nome, dose, frequência. Para doentes/residentes: nome, idade, quarto, diagnóstico. Para análises: parâmetro, valor, unidade, referência. Responde com o texto extraído em formato tabular claro.` },
                { inline_data: { mime_type: 'application/pdf', data: pdf_base64 } }
              ] }],
              generationConfig: { maxOutputTokens: 3000, temperature: 0.0 }
            })
          }
        )
        const gd = await res.json()
        const extracted = gd.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (extracted.length > 20) dataText = extracted
      } catch (_e: any) {}
    }
  }

  if (!dataText.trim()) return NextResponse.json({ error: 'Sem dados para analisar.' }, { status: 400 })

  const PROMPTS: Record<string, string> = {
    medications: `Extrai TODOS os medicamentos deste texto (pode ser de Sifarma, SClínico, PHC, Excel ou manual).
Para cada medicamento, extrai: nome DCI (converte marca→DCI se possível), dose, frequência, via (se mencionada).
Responde com JSON:
{
  "items": [{ "name": "DCI", "dose": "dose", "frequency": "frequência", "route": "via ou null", "brand": "marca se mencionada ou null", "indication": "indicação se mencionada ou null", "confidence": "high|medium|low" }],
  "warnings": ["aviso se houver ambiguidade"],
  "raw_count": número_de_linhas_processadas
}`,
    patients: `Extrai a lista de doentes/utentes deste texto (pode ser de SClínico, PHC, Excel ou manual).
Para cada doente: nome, idade ou data de nascimento, número SNS se disponível, diagnósticos principais, alergias se mencionadas.
Responde com JSON:
{
  "items": [{ "name": "nome completo", "age": número_ou_null, "dob": "data nascimento YYYY-MM-DD ou null", "sns": "número SNS ou null", "diagnosis": "diagnósticos em string", "allergies": ["alergia"] }],
  "warnings": ["aviso"],
  "raw_count": número
}`,
    residents: `Extrai a lista de residentes de lar deste texto com a sua medicação.
Para cada residente: nome, idade, quarto, diagnósticos, medicação completa.
Responde com JSON:
{
  "items": [{ "name": "nome", "age": número_ou_null, "room": "quarto ou null", "diagnosis": "diagnósticos", "medications": [{ "name": "medicamento", "dose": "dose", "frequency": "frequência" }], "allergies": [] }],
  "warnings": ["aviso"],
  "raw_count": número
}`,
    labs: `Extrai os resultados analíticos deste texto (pode ser de laboratório, PDF de análises, ou texto copiado).
Para cada parâmetro: nome, valor, unidade, intervalo de referência, status (normal/alto/baixo/crítico), data se disponível.
Responde com JSON:
{
  "items": [{ "name": "nome do parâmetro", "value": "valor", "unit": "unidade", "reference": "referência ou null", "status": "NORMAL|ALTO|BAIXO|CRITICO_ALTO|CRITICO_BAIXO", "date": "YYYY-MM-DD ou null" }],
  "lab_name": "nome do laboratório se encontrado",
  "collection_date": "data da colheita se encontrada",
  "warnings": ["aviso"],
  "raw_count": número
}`,
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um especialista em migração de dados clínicos. Extrais informação estruturada de qualquer formato — Sifarma, SClínico, PHC, Excel, PDF hospitalar, texto livre. Respondes APENAS com JSON válido sem markdown. Fonte: ${source_system}.

${PROMPTS[import_mode] || PROMPTS.medications}`,
      },
      { role: 'user', content: dataText.slice(0, 10000) },
    ], { maxTokens: 2000, temperature: 0.05 })

    return NextResponse.json({
      success: result.items?.length || 0,
      errors: 0,
      warnings: result.warnings || [],
      preview: result.items || [],
      raw_count: result.raw_count || 0,
      lab_name: result.lab_name,
      collection_date: result.collection_date,
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao analisar. Tenta novamente.' }, { status: 500 })
  }
}