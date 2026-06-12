// app/api/study/weakspots/route.ts
// "Onde vais falhar" — cruza o que o estudante ERROU (quiz_results), onde
// competiu (arena_attempts) e onde passou tempo (study_sessions) para dizer
// ONDE focar a seguir. O núcleo é DETERMINÍSTICO (estatística real dos registos);
// a IA só escreve uma frase de orientação curta. Sem inventar desempenho.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

function makeSupabase(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } })
}
function getToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

interface TopicStat {
  topic: string
  attempts: number       // nº de respostas de quiz nesse tópico
  correct: number        // nº de acertos
  accuracy: number | null // % ou null se sem dados de quiz
  minutes: number        // tempo de estudo nesse tópico
  level: 'fraco' | 'a-melhorar' | 'bom' | 'sem-treino'
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip, 8, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    const { userId } = await getUserPlan(req)
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const supabase = makeSupabase(token)
    const [{ data: quiz }, { data: arena }, { data: sessions }] = await Promise.all([
      supabase.from('quiz_results').select('drug_class, correct, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
      supabase.from('arena_attempts').select('domain, score').eq('user_id', userId).limit(500),
      supabase.from('study_sessions').select('topic, minutes').eq('user_id', userId).limit(500),
    ])

    // ── Agregação determinística por tópico ──
    const byTopic: Record<string, TopicStat> = {}
    const ensure = (t: string) => (byTopic[t] ||= { topic: t, attempts: 0, correct: 0, accuracy: null, minutes: 0, level: 'sem-treino' })

    ;(quiz || []).forEach((q: any) => {
      if (!q.drug_class) return
      const s = ensure(q.drug_class)
      s.attempts++; if (q.correct) s.correct++
    })
    ;(sessions || []).forEach((s: any) => { if (s.topic) ensure(s.topic).minutes += (s.minutes || 0) })
    // arena: domínios atemptados sem grande acerto contam como "a treinar"
    ;(arena || []).forEach((a: any) => { if (a.domain) ensure(a.domain) })

    const topics = Object.values(byTopic).map(s => {
      s.accuracy = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : null
      s.level = s.accuracy == null ? 'sem-treino'
        : s.accuracy < 50 ? 'fraco'
        : s.accuracy < 75 ? 'a-melhorar' : 'bom'
      return s
    })

    // ── Ranking: primeiro os fracos (com dados), depois a-melhorar, depois sem-treino ──
    const order = { fraco: 0, 'a-melhorar': 1, 'sem-treino': 2, bom: 3 } as const
    topics.sort((a, b) => order[a.level] - order[b.level] || (a.accuracy ?? 101) - (b.accuracy ?? 101))

    const focus = topics.filter(t => t.level === 'fraco' || t.level === 'a-melhorar').slice(0, 5)
    const blindspots = topics.filter(t => t.level === 'sem-treino').slice(0, 4)
    const strong = topics.filter(t => t.level === 'bom').slice(0, 3)

    const hasData = topics.some(t => t.attempts > 0) || (arena || []).length > 0 || (sessions || []).length > 0

    // ── Uma frase de orientação (IA, barata, opcional) ──
    let guidance = ''
    if (focus.length) {
      try {
        const r = await aiJSON<{ guidance: string }>([
          { role: 'system', content: 'És um tutor de ciências da saúde em PT-PT. Em UMA frase curta, encorajadora e prática, diz ao estudante por onde começar a estudar, dado onde está mais fraco. Não inventes notas. Responde JSON {"guidance":"..."}.' },
          { role: 'user', content: `Tópicos mais fracos: ${focus.map(f => `${f.topic} (${f.accuracy ?? '—'}%)`).join(', ')}. Escreve a frase de orientação.` },
        ], { maxTokens: 80, temperature: 0.4 })
        guidance = r?.guidance || ''
      } catch { /* sem frase */ }
    }

    return NextResponse.json({ hasData, focus, blindspots, strong, guidance })
  } catch (err: any) {
    console.error('weakspots error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao analisar' }, { status: 500 })
  }
}
