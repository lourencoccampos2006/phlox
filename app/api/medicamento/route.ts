import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON, callGeminiVisionJSON } from '@/lib/ai'
import { resolveDrugName } from '@/lib/drugNames'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Lookup local primeiro — tabela infarmed_drugs (sprint74) com 50+ medicamentos
// mais comuns em Portugal. Se há match, evita IA totalmente.
async function lookupLocalDrug(query: string) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await sb.rpc('find_drug', { p_query: query })
    return data
  } catch {
    return null
  }
}

function formatLocalDrug(row: any): any {
  return {
    identified: row.brand_name || row.active_ingredient,
    active: row.active_ingredient,
    what_it_is: row.what_it_is,
    what_it_treats: row.what_it_treats || [],
    symptoms: row.symptoms || [],
    how_to_take: row.how_to_take || '',
    prescription: row.prescription,
    prescription_note: row.prescription_note || '',
    common_side_effects: row.common_side_effects || [],
    cautions: row.cautions || [],
    avoid_if: row.avoid_if || [],
    good_to_know: row.good_to_know || '',
    confidence: row.source === 'ai_cache' ? 'media' : 'alta',
    source: row.source === 'ai_cache' ? 'cache_IA' : 'base_local_PT',
  }
}

// Segunda passagem para fármacos menos comuns: pede explicitamente uma resposta
// ESTRUTURADA e completa (não aceita campos vazios). Resolve resultados "magros".
async function freeTextDrug(name: string): Promise<any | null> {
  try {
    const res = await aiJSON<any>([
      {
        role: 'system',
        content: `És farmacêutico português com conhecimento profundo de TODOS os medicamentos, suplementos e produtos de venda livre em Portugal (marcas como Guronsan, Cerebrum, Aspegic, Ben-u-ron; genéricos; DCIs). Conheces este produto — praticamente tudo é conhecido.

OBRIGATÓRIO: preenche TODOS os campos com informação real. NUNCA deixes "what_it_is", "what_it_treats" ou "active" vazios. Se for combinação, explica os componentes (ex: Guronsan = cafeína + ácido ascórbico + aspartato de arginina, um tónico/estimulante para fadiga, VENDA LIVRE/sem receita).

PRESCRIÇÃO (sê rigoroso e NÃO assumas "com receita" por defeito):
- Tónicos, suplementos, vitaminas, estimulantes de venda livre (Guronsan, Cerebrum, Centrum…), analgésicos OTC, anti-histamínicos OTC → "sem receita".
- Antibióticos, psicofármacos, anticoagulantes, antidiabéticos, hormonas → "com receita médica".
- Na dúvida sobre um produto de bem-estar/suplemento, é tipicamente "sem receita".

${RULES}

Esquema:
${SCHEMA}`,
      },
      { role: 'user', content: `Medicamento/produto: "${name}". Identifica o(s) princípio(s) ativo(s), o que é, para que serve, e se precisa de receita em Portugal. Preenche TODOS os campos.` },
    ], { maxTokens: 1300, temperature: 0.1 })
    if (res && (res.what_it_is || (res.what_it_treats && res.what_it_treats.length))) {
      return { ...res, confidence: res.confidence === 'baixa' ? 'media' : (res.confidence || 'media') }
    }
  } catch { /* cai para null */ }
  return null
}

// Auto-cache: guarda em infarmed_drugs as respostas que a IA gerou com
// confiança alta/media, para que da próxima vez vá directamente à base local
// (mais rápido, mais fiável, sem alucinação).
async function cacheAiResult(result: any) {
  try {
    if (!result?.active || !result?.what_it_is) return
    if (result.confidence === 'baixa') return // só cache resultados confiáveis
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await sb.rpc('cache_drug_from_ai', {
      p_brand: result.identified || null,
      p_active: result.active,
      p_class: result.what_it_is?.slice(0, 80) || null,
      p_what: result.what_it_is || '',
      p_treats: result.what_it_treats || [],
      p_symptoms: result.symptoms || [],
      p_how: result.how_to_take || '',
      p_prescription: result.prescription || 'com receita médica',
      p_prescription_note: result.prescription_note || null,
      p_side_effects: result.common_side_effects || [],
      p_cautions: result.cautions || [],
      p_avoid: result.avoid_if || [],
      p_good: result.good_to_know || null,
      p_forms: null,
      p_strengths: null,
    })
  } catch {
    // cache best-effort — falha silenciosa
  }
}

// "O que é este medicamento?" — explicação simples e CONSISTENTE.
//
// 2026-06-01: refeito com:
//  • Necessidade de receita por DOSE (Ben-u-ron, Brufen, omeprazol, …)
//  • prescription_note com o limiar específico
//  • fallback_advice quando confiança baixa
//  • Anti-alucinação reforçada

const SCHEMA = `{
  "identified": "nome comercial reconhecido (ou o princípio ativo se foi esse o input)",
  "active": "princípio ativo (DCI) — string única e correta",
  "what_it_is": "classe terapêutica explicada em 1 frase simples (ex: 'um anti-inflamatório que alivia dores e baixa a febre')",
  "what_it_treats": ["indicação concreta e correta — máximo 5"],
  "symptoms": ["sintoma típico para que é usado — máximo 5"],
  "how_to_take": "como se costuma tomar, linguagem simples",
  "prescription": "sem receita | com receita médica | com receita médica especial | depende da dose",
  "prescription_note": "1 frase a explicar (sobretudo quando 'depende da dose'). Exemplos:
    • Paracetamol até 1 g unidose (Ben-u-ron 500/1000 mg) — MNSRM (sem receita).
    • Ibuprofeno 200 ou 400 mg — MNSRM. 600 mg e 800 mg — sujeito a receita.
    • Omeprazol 20 mg em embalagens ≤14 cápsulas — MNSRM. >14 cápsulas ou 40 mg — receita.
    • Diclofenac sódico 12.5/25 mg — MNSRM. ≥50 mg — receita.
    • Loratadina/cetirizina 10 mg — MNSRM.
    • Antibióticos, antidepressivos, ansiolíticos, opioides, insulina, antidiabéticos — TODOS receita.
    Se a dose for indicada, usa 'sem receita' ou 'com receita médica' conforme aplicável.
    Se NÃO sabes a dose, usa 'depende da dose' e explica claramente o limiar.",
  "common_side_effects": ["efeito secundário comum"],
  "cautions": ["cuidado importante"],
  "avoid_if": ["situação em que não deve tomar sem falar com médico"],
  "good_to_know": "dica prática (1 frase, opcional)",
  "confidence": "alta | media | baixa",
  "fallback_advice": "SÓ se confidence='baixa'. Sugere 'Tira foto à BULA (com o texto técnico) em /bula — o motor de bula tem maior precisão' ou 'Pede ajuda ao farmacêutico'."
}`

const RULES = `REGRAS (a tua resposta tem de ser factualmente correta E útil):
- Identifica primeiro a SUBSTÂNCIA ATIVA (DCI) e responde a partir dela — é a substância que determina para que serve.
- A maioria dos medicamentos é conhecida (incluindo marcas portuguesas, genéricos, e DCIs internacionais). DÁ SEMPRE a melhor resposta que tiveres. Se conheces o medicamento — e quase sempre conheces — responde com confidence="alta" ou "media" e preenche TUDO.
- Só usa confidence="baixa" e "what_it_treats" vazio se REALMENTE não reconheceres o nome de todo (ex: erro de escrita irreconhecível). Nesse caso preenche "fallback_advice". NÃO uses "baixa" só por precaução — isso torna a ferramenta inútil para quem procura medicamentos menos comuns.
- NUNCA adivinhes a indicação só pelo som do nome; mas se reconheces o fármaco, usa o teu conhecimento real.
- "what_it_treats" = indicações reais e aprovadas da substância ativa.
- Linguagem simples, PT-PT, como quem explica a um familiar.

PRESCRIÇÃO EM PORTUGAL (sê rigoroso — isto erra muito):
- MNSRM (sem receita): a maioria dos analgésicos/antipiréticos de venda livre (paracetamol, ibuprofeno ≤400mg, AAS), anti-histamínicos H1 (loratadina, cetirizina, desloratadina), antiácidos, descongestionantes nasais, laxantes suaves, antifúngicos tópicos, alguns IBP de baixa dose em embalagem pequena.
- MSRM (com receita): TODOS os antibióticos, antidepressivos, ansiolíticos/benzodiazepinas (receita especial), opióides (receita especial), antidiabéticos (incluindo Ozempic/semaglutido, metformina), anticoagulantes, anti-hipertensores, estatinas, corticoides sistémicos, a maioria dos psicofármacos, hormonas.
- "depende da dose": ibuprofeno (≤400 MNSRM, ≥600 MSRM), diclofenac (≤25mg MNSRM, ≥50 MSRM), omeprazol/pantoprazol (embalagem pequena MNSRM, resto MSRM).
- Suplementos/vitaminas e produtos de conforto: geralmente "sem receita".
- Se tens dúvida razoável, escolhe "com receita médica" (mais seguro) e explica em prescription_note.
- Responde APENAS com JSON válido, sem markdown.`

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.name && !body?.image && !body?.infomed_code) return NextResponse.json({ error: 'Nome, foto ou nº INFARMED/CNPEM obrigatório' }, { status: 400 })

  const name = String(body?.name || '').trim().slice(0, 120)
  const image = body?.image as string | undefined
  const mimeType = String(body?.mimeType || 'image/jpeg')
  // INFARMED / CNPEM: código nacional do produto (7 dígitos) ou registo Infomed.
  // Quando presente, é o ÂNCORA mais fiável — o modelo trata como fonte primária.
  const infomedCode = String(body?.infomed_code || '').replace(/\D/g, '').slice(0, 10)

  try {
    let result: any

    // ── 0) LOOKUP LOCAL PRIORITÁRIO ──
    // Tenta encontrar na base local antes de chamar IA. Match por:
    //   1) CNPEM/registo exacto, 2) marca exacta, 3) DCI exacta, 4) parcial.
    if (!image) {
      const tryQueries = [infomedCode, name].filter(Boolean)
      for (const q of tryQueries) {
        const local = await lookupLocalDrug(q)
        if (local) {
          const formatted = formatLocalDrug(local)
          // Entrada local POBRE (típico de cache antigo incompleto) → não a usamos;
          // deixamos cair para a IA, que dá resposta completa.
          const localThin = (!formatted.what_it_is || String(formatted.what_it_is).trim().length < 20) &&
                            (!formatted.what_it_treats || formatted.what_it_treats.length === 0)
          if (localThin) break  // sai do lookup local → segue para IA
          return NextResponse.json({
            ...formatted,
            queried: name || infomedCode,
            disclaimer: 'Informação verificada com base local de medicamentos comuns em Portugal. Confirma com o teu farmacêutico para casos específicos.',
          })
        }
      }
    }

    if (image && !name) {
      // ── FOTO: visão lê a caixa inteira ──
      const infomedHint = infomedCode
        ? `\n\nO utilizador também forneceu o número INFARMED/CNPEM: ${infomedCode}. Trata este código como a IDENTIFICAÇÃO OFICIAL — usa-o para confirmar/corrigir o nome ou substância ativa que leres na caixa.`
        : ''
      const prompt = `És um farmacêutico português. Esta é a foto de uma embalagem de medicamento.
Lê com atenção TODO o texto visível: nome comercial, dosagem (em mg/g/UI/mcg), e sobretudo a SUBSTÂNCIA ATIVA / princípio ativo (geralmente em letras pequenas). A substância ativa é o que determina para que serve.
Se a caixa estiver ilegível ou não for um medicamento, devolve confidence="baixa" e deixa "what_it_treats" vazio.${infomedHint}

Explica para uma pessoa sem formação clínica. ${RULES}

Esquema:
${SCHEMA}`
      result = await callGeminiVisionJSON<any>(prompt, image, mimeType, { maxTokens: 1400 })
    } else {
      // ── NOME ou PRINCÍPIO ATIVO ou CÓDIGO INFARMED ──
      const resolved = resolveDrugName(name)
      const hintBase = resolved
        ? `\n\nPista (base local PT): o nome "${name}" corresponde provavelmente ao princípio ativo "${resolved.dci}". Confirma com o teu conhecimento; se não bater certo, ignora a pista.`
        : ''
      const infomedHint = infomedCode
        ? `\n\nO utilizador forneceu o nº INFARMED/CNPEM: ${infomedCode}. Este código identifica EXACTAMENTE o produto na base INFOMED. Se conheces o medicamento associado, usa-o como fonte primária e SOBREPÕE-TE a qualquer outra hipótese — mantém confidence="alta". Se não reconheces o código, mantém confidence="media" ou "baixa" e adverte que recomendas consulta directa do INFOMED em https://app.infarmed.pt/infomed/.`
        : ''
      const userInput = name
        ? `Medicamento ou princípio ativo: "${name}".${hintBase}${infomedHint}`
        : `Nº INFARMED/CNPEM fornecido: ${infomedCode}.${infomedHint}\n\nIdentifica o medicamento associado e explica-o.`
      result = await aiJSON<any>([
        { role: 'system', content: `És um farmacêutico português que explica medicamentos a pessoas sem formação clínica, com rigor factual.\n\n${RULES}\n\nEsquema:\n${SCHEMA}` },
        { role: 'user', content: `${userInput}\n\nIdentifica o princípio ativo e explica a partir dele. Se a dose está indicada no nome, usa-a para decidir a prescrição.` },
      ], { maxTokens: 1300, temperature: 0 })
    }

    if (!result || typeof result !== 'object') throw new Error('Resposta inválida')

    // Garante fallback_advice quando confidence baixa
    if (result.confidence === 'baixa' && !result.fallback_advice) {
      result.fallback_advice = 'Não tenho a certeza absoluta sobre este medicamento. Em vez disso, tira foto à BULA (texto técnico) em /bula — esse motor é mais preciso. Em alternativa, pede ajuda ao teu farmacêutico.'
    }

    // ── Deteção de resultado MAGRO ──
    // Se a IA "respondeu" mas com pouco conteúdo útil (what_it_is vazio/curto E
    // sem indicações), NÃO devolvemos isso — fazemos uma 2ª passagem em texto
    // livre para garantir uma resposta completa (resolve o caso "Guronsan").
    const thin = (!result.what_it_is || String(result.what_it_is).trim().length < 20) &&
                 (!result.what_it_treats || result.what_it_treats.length === 0)
    if (thin && name) {
      const enriched = await freeTextDrug(name)
      if (enriched) {
        cacheAiResult(enriched).catch(() => {})
        return NextResponse.json({ ...enriched, queried: name, disclaimer: 'Informação geral de apoio — confirma sempre com o teu farmacêutico ou médico.' })
      }
    }

    // Auto-cache (best-effort, não bloqueia resposta) — guarda IA confiável em
    // infarmed_drugs para futuras procuras serem instantâneas e sem alucinação.
    cacheAiResult(result).catch(() => {})

    return NextResponse.json({
      ...result,
      queried: name || result.identified || '',
      disclaimer: 'Informação geral de apoio — confirma sempre com o teu farmacêutico ou médico.',
    })
  } catch (err: any) {
    // Último recurso: NUNCA devolver vazio — 2ª passagem estruturada.
    if (name) {
      const enriched = await freeTextDrug(name)
      if (enriched) {
        cacheAiResult(enriched).catch(() => {})
        return NextResponse.json({ ...enriched, queried: name, disclaimer: 'Informação geral de apoio — confirma sempre com o teu farmacêutico ou médico.' })
      }
    }
    return NextResponse.json({ error: err.message || 'Não foi possível. Tenta com o nome escrito ou uma foto mais nítida.' }, { status: 500 })
  }
}
