// app/api/translate/route.ts
// POST → traduz texto entre línguas suportadas. Usa cache em translations_cache.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { aiComplete } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const SUPPORTED = ['pt', 'en', 'es', 'fr', 'uk', 'de', 'it', 'ro', 'ar', 'auto']

const LANG_NAMES: Record<string, string> = {
  pt: 'Português (PT-PT)', en: 'Inglês', es: 'Espanhol', fr: 'Francês',
  uk: 'Ucraniano', de: 'Alemão', it: 'Italiano', ro: 'Romeno', ar: 'Árabe',
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    text?: string; source_lang?: string; target_lang?: string
  } | null
  if (!body?.text || !body.target_lang) {
    return NextResponse.json({ error: 'text e target_lang obrigatórios' }, { status: 400 })
  }
  const text = body.text.trim().slice(0, 4000)
  const source = (body.source_lang || 'auto').toLowerCase()
  const target = body.target_lang.toLowerCase()
  if (!SUPPORTED.includes(source) || !SUPPORTED.includes(target)) {
    return NextResponse.json({ error: 'Língua não suportada' }, { status: 400 })
  }
  if (text.length < 1) return NextResponse.json({ error: 'Texto vazio' }, { status: 400 })

  const db = sb(req)
  const hash = await sha256Hex(`${source}|${target}|${text}`)

  // 1) Cache hit?
  const { data: cached } = await db.from('translations_cache')
    .select('id, translated, hit_count').eq('hash', hash).maybeSingle()
  if (cached?.translated) {
    db.from('translations_cache').update({
      hit_count: (cached.hit_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    }).eq('id', cached.id).then(() => {}, () => {})
    return NextResponse.json({ translated: cached.translated, source_lang: source, target_lang: target, cached: true })
  }

  // 2) Gerar via IA
  try {
    const sourceName = source === 'auto' ? 'língua detectada automaticamente' : (LANG_NAMES[source] || source)
    const targetName = LANG_NAMES[target] || target
    const { text: out, provider } = await aiComplete(
      [
        {
          role: 'system',
          content: `És tradutor profissional especializado em saúde. Traduz fielmente de ${sourceName} para ${targetName}. Mantém terminologia clínica correcta. Se o texto for instruções de medicação, preserva doses e unidades exactamente. Responde APENAS com a tradução, sem preâmbulos.`,
        },
        { role: 'user', content: text },
      ],
      { maxTokens: Math.max(400, Math.min(2000, text.length * 3)), temperature: 0.05, preferFast: true },
    )
    const translated = out.trim()
    if (!translated) throw new Error('Resposta vazia')

    db.from('translations_cache').insert({
      source_text: text, source_lang: source, target_lang: target,
      translated, hash,
    }).then(() => {}, () => {})

    return NextResponse.json({ translated, source_lang: source, target_lang: target, cached: false, provider })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro a traduzir' }, { status: 500 })
  }
}
