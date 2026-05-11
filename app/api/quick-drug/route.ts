// app/api/quick-drug/route.ts
// Ficha rápida de medicamento — tudo o que um profissional precisa num segundo.
// Gratuita, sem limite, sem login. Viral por design.

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 12 // 12h

const rateLimitMap = new Map<string, { count: number; reset: number }>()

function getIP(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const r = rateLimitMap.get(ip)
  if (!r || now > r.reset) { rateLimitMap.set(ip, { count: 1, reset: now + 60000 }); return true }
  if (r.count >= 30) return false
  r.count++; return true
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req))) return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  if (!body?.drug || typeof body.drug !== 'string') return NextResponse.json({ error: 'Medicamento obrigatório' }, { status: 400 })

  const drug = body.drug.trim().slice(0, 100)
  const cacheKey = drug.toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return NextResponse.json({ ...cached.result, cached: true })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico. Cria fichas de medicamento completas, precisas e accionáveis em português europeu (PT-PT).

Responde APENAS com JSON válido sem markdown:
{
  "name": "DCI / Nome genérico principal",
  "brand_names_pt": ["Nomes comerciais em Portugal — máx 5"],
  "class": "Classe farmacológica",
  "subclass": "Subclasse (ex: IECA, ISRS, Penicilina)",
  "mechanism": "Mecanismo de acção em 1-2 frases claras",
  "indications": ["Indicação clínica 1", "Indicação clínica 2"],
  "contraindications": ["Contraindicação absoluta 1"],
  "dosing": {
    "adult_standard": "Dose padrão adulto com via e frequência",
    "adult_max": "Dose máxima diária",
    "renal_note": "Ajuste se IR (se aplicável)",
    "hepatic_note": "Ajuste se IH (se aplicável)",
    "elderly_note": "Precauções em idosos (se relevante)"
  },
  "adverse_effects": {
    "common": ["Efeito adverso frequente (> 1/10 ou > 1/100)"],
    "serious": ["Efeito adverso grave ou raro mas importante"],
    "monitoring": ["Parâmetro a monitorizar e periodicidade"]
  },
  "key_interactions": [
    { "drug": "Nome do fármaco", "severity": "GRAVE"|"MODERADA"|"LIGEIRA", "effect": "O que acontece" }
  ],
  "pharmacokinetics": {
    "absorption": "Biodisponibilidade oral e pico",
    "half_life": "Semivida de eliminação",
    "metabolism": "Via de metabolismo (ex: CYP3A4)",
    "excretion": "Via de excreção principal"
  },
  "pregnancy": "Categoria de risco na gravidez (FDA ou EMA) e recomendação",
  "lactation": "Segurança durante amamentação",
  "patient_counselling": ["Instrução essencial para o doente — máx 5"],
  "clinical_pearls": ["Pérola clínica que um especialista daria — máx 3"],
  "available_forms_pt": ["Forma farmacêutica disponível em Portugal (ex: Comprimido 10mg, Solução injectável 40mg/2mL)"],
  "infarmed_url": "URL do RCM no INFARMED se conhecida (ou null)",
  "last_updated_guideline": "Guideline mais recente que referencia este fármaco"
}

Regras:
- Foca em Portugal — INFARMED, SNS, medicamentos disponíveis PT
- Doses em unidades correctas (mg, µg, UI)
- Interações: máx 5, as mais relevantes clinicamente
- patient_counselling em linguagem simples (sem jargão)
- clinical_pearls são insights que diferenciam um bom clínico (CYP, populações especiais, timing)
- Se não tiveres dados fiáveis sobre algo, usa null em vez de inventar`,
      },
      {
        role: 'user',
        content: `Cria a ficha completa de: ${drug}`,
      },
    ], { maxTokens: 1800, temperature: 0.05 })

    cache.set(cacheKey, { result, timestamp: Date.now() })
    if (cache.size > 300) { const first = cache.keys().next().value; if (first) cache.delete(first) }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Quick drug error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar ficha. Tenta novamente.' }, { status: 500 })
  }
}