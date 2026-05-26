import { NextRequest, NextResponse } from 'next/server'
import { aiJSON, callGeminiVision } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.symptom && !body?.image) return NextResponse.json({ error: 'Sintoma ou imagem obrigatório' }, { status: 400 })

  const symptom = String(body?.symptom || '').trim().slice(0, 200)
  const context = String(body?.context || '').trim().slice(0, 300)
  const image = body?.image as string | undefined
  const mimeType = String(body?.mimeType || 'image/jpeg')

  // Se vier imagem, descreve o que se vê (sintoma visível). Linguagem objetiva,
  // sem diagnosticar a partir da foto — só descrever, para o passo seguinte decidir.
  let effectiveSymptom = symptom
  if (image && !symptom) {
    try {
      const description = await callGeminiVision(
        'Descreve OBJETIVAMENTE em português apenas o que é visível nesta imagem relacionado com saúde (ex: "erupção avermelhada no antebraço", "embalagem de paracetamol"). NÃO faças diagnóstico nem adivinhes a causa. Se não for claro, diz "não é possível identificar". Máx 1 frase.',
        image, mimeType, { maxTokens: 120 }
      )
      effectiveSymptom = description.trim()
    } catch (e) {
      effectiveSymptom = 'sintoma não identificado'
    }
    if (/não é possível identificar|nao e possivel/i.test(effectiveSymptom))
      return NextResponse.json({ error: 'Não consegui perceber o sintoma na foto. Descreve por palavras.' }, { status: 400 })
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico comunitário experiente em Portugal. Dado um sintoma, recomendas medicamentos OTC (sem receita) disponíveis nas farmácias portuguesas, em linguagem simples acessível a qualquer pessoa.

Responde APENAS em português europeu (PT-PT) com JSON válido sem markdown:
{
  "symptom": "sintoma conforme descrito",
  "severity_assessment": "avaliação rápida da gravidade em 1 frase",
  "red_flags": ["sinal de alarme que requer urgência médica"],
  "recommended_otc": [
    {
      "name": "nome comercial mais comum em Portugal (ex: 'Ben-u-ron')",
      "active": "substância activa (ex: 'paracetamol')",
      "dose": "dose concreta para adulto (ex: '500-1000mg de 6/6h, máx 4g/dia')",
      "when": "quando tomar (ex: 'com dor ou febre > 38°C')",
      "notes": "nota prática útil — null se não aplicável",
      "avoid_if": ["condição que contraindica este medicamento"]
    }
  ],
  "alternatives": ["alternativa se o primeiro não puder ser usado"],
  "non_pharmacological": ["medida não farmacológica eficaz e concreta"],
  "when_to_see_doctor": ["situação que justifica consulta médica"],
  "duration_expected": "quanto tempo dura tipicamente este sintoma sem tratamento"
}

Regras:
- Máximo 3 OTCs por ordem de preferência — o primeiro é o mais recomendado
- Usa SEMPRE nomes comerciais portugueses que existem de facto nas farmácias PT
- Inclui SEMPRE dose concreta — nunca dizes "conforme indicação médica"
- Se o contexto menciona gravidez, crianças, idosos ou medicação — adapta TODAS as recomendações
- Se o sintoma não deve ser auto-medicado (ex: dor torácica, dispneia grave): recommended_otc pode ser vazio e red_flags deve ser extenso
- Para febre: sempre menciona quando usar e quando não usar antitérmico
- Sê sempre honesto sobre limitações da automedicação${context ? `\n\nContexto do utilizador: ${context}` : ''}`,
      },
      {
        role: 'user',
        content: `Sintoma: ${effectiveSymptom}`,
      },
    ], { maxTokens: 1200, temperature: 0 })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('OTC error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}