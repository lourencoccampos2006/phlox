import { NextRequest, NextResponse } from 'next/server'
import { aiJSON, callGeminiVision } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// "O que é este medicamento?" — explica um medicamento em linguagem simples,
// para pessoas sem formação clínica. Aceita nome OU foto da caixa.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.name && !body?.image) return NextResponse.json({ error: 'Nome ou foto obrigatório' }, { status: 400 })

  let name = String(body?.name || '').trim().slice(0, 120)
  const image = body?.image as string | undefined
  const mimeType = String(body?.mimeType || 'image/jpeg')

  // Foto da caixa → extrair o nome/substância primeiro
  if (image && !name) {
    try {
      name = (await callGeminiVision(
        'Esta é a foto de uma embalagem/caixa de medicamento. Indica APENAS o nome do medicamento e a dosagem que vês (ex: "Ben-u-ron 1000 mg"). Se não conseguires ler, responde "ilegível".',
        image, mimeType, { maxTokens: 60 }
      )).trim().replace(/^["']|["']$/g, '')
    } catch {
      return NextResponse.json({ error: 'Não foi possível ler a caixa. Tenta uma foto mais nítida ou escreve o nome.' }, { status: 400 })
    }
    if (/ileg[íi]vel/i.test(name) || name.length < 2) return NextResponse.json({ error: 'Não consegui identificar o medicamento na foto. Escreve o nome.' }, { status: 400 })
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico português que explica medicamentos a pessoas SEM formação em saúde, de forma simples, calorosa e clara. Usa português de Portugal. NUNCA uses jargão sem explicar.

Responde APENAS com JSON válido (sem markdown):
{
  "identified": "nome e dosagem do medicamento conforme reconhecido",
  "active": "substância ativa em linguagem simples",
  "what_it_is": "o que é, em 1 frase simples (ex: 'um analgésico e antipirético, ou seja, tira dores e baixa a febre')",
  "what_it_treats": ["doença ou problema concreto que trata", "..."],
  "symptoms": ["sintoma para o qual costuma ser usado", "..."],
  "how_to_take": "como se costuma tomar, em linguagem simples (ex: 'um comprimido com água, podendo repetir de 8 em 8 horas')",
  "prescription": "sem receita | com receita médica | com receita médica especial",
  "common_side_effects": ["efeito secundário comum e como é sentido"],
  "cautions": ["cuidado importante para o utente (ex: 'não tomar com álcool', 'cuidado se tem problemas no fígado')"],
  "avoid_if": ["situação em que NÃO deve tomar sem falar com o médico"],
  "good_to_know": "uma dica prática ou tranquilizadora, 1 frase",
  "confidence": "alta | media | baixa"
}

Regras:
- Linguagem de quem fala com um familiar, não com um médico.
- Sê concreto sobre QUE doenças/sintomas trata.
- Em "prescription", diz claramente se precisa de receita em Portugal.
- Se não reconheceres o medicamento com segurança, confidence="baixa" e diz no "good_to_know" para confirmar na farmácia.
- Termina sempre lembrando que isto é informação geral e não substitui o farmacêutico/médico (mete isso no "good_to_know").`,
      },
      { role: 'user', content: `Medicamento: ${name}` },
    ], { maxTokens: 1100, temperature: 0.15 })

    return NextResponse.json({ ...result, queried: name })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
