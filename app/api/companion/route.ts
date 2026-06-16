// app/api/companion/route.ts
// Médico de bolso proativo — o Phlox olha SOZINHO para os dados do utilizador
// (medicação, sinais vitais, análises, adesão) e deteta o que MERECE ATENÇÃO,
// dizendo de forma simples o que fazer. Não espera que o utilizador pergunte.
//
// Arquitetura: a DETEÇÃO é determinística (regras, custo zero). A IA só serve
// para dar uma frase de abertura calorosa — os alertas em si vêm das regras,
// para nunca inventarmos preocupações médicas.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiComplete } from '@/lib/ai'

function makeSupabase(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } })
}
function getToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

type Sev = 'urgent' | 'attention' | 'info' | 'good'
interface Concern {
  id: string
  severity: Sev
  icon: string
  title: string
  detail: string
  action?: { label: string; route: string }
}

const ORDER: Record<Sev, number> = { urgent: 0, attention: 1, info: 2, good: 3 }

// Pares de interação GRAVE conhecidos (normalizado, sem acentos, minúsculas).
// Mantido pequeno e seguro: só os de altíssimo risco que NUNCA queremos falhar.
const DANGER_PAIRS: [string[], string[], string][] = [
  [['varfarina', 'warfarina'], ['ibuprofeno', 'naproxeno', 'diclofenac', 'aspirina', 'aas'], 'Risco de hemorragia grave'],
  [['varfarina', 'warfarina'], ['amiodarona', 'fluconazol', 'metronidazol'], 'Aumenta muito o efeito da varfarina'],
  [['rivaroxabano', 'apixabano', 'dabigatrano'], ['ibuprofeno', 'naproxeno', 'diclofenac', 'aspirina'], 'Risco de hemorragia'],
  [['sinvastatina', 'atorvastatina'], ['claritromicina', 'eritromicina', 'itraconazol'], 'Risco muscular (rabdomiólise)'],
  [['tramadol', 'sertralina', 'fluoxetina', 'paroxetina', 'venlafaxina'], ['tramadol', 'sertralina', 'fluoxetina', 'paroxetina', 'venlafaxina'], 'Risco de síndrome serotoninérgico'],
  [['espironolactona'], ['ramipril', 'lisinopril', 'enalapril', 'perindopril', 'losartan', 'valsartan'], 'Risco de potássio elevado'],
  [['metotrexato'], ['ibuprofeno', 'naproxeno', 'diclofenac', 'aas'], 'Toxicidade do metotrexato'],
]

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip, 8, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    const { userId } = await getUserPlan(req)
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const supabase = makeSupabase(token)
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const days30 = new Date(now.getTime() - 30 * 86400000).toISOString()
    const days14 = new Date(now.getTime() - 14 * 86400000).toISOString()

    const [
      { data: profile },
      { data: meds },
      { data: vitals },
      { data: labs },
      { data: logs },
    ] = await Promise.all([
      supabase.from('profiles').select('name, birth_date, age').eq('id', userId).maybeSingle(),
      supabase.from('personal_meds').select('name, dose, frequency, pills_remaining, pills_per_day, reminder_times').eq('user_id', userId),
      supabase.from('vitals').select('bp_sys, bp_dia, spo2, glucose, weight, hr, temp, recorded_at').eq('user_id', userId).gte('recorded_at', days30).order('recorded_at', { ascending: false }).limit(60),
      supabase.from('lab_results').select('test_code, test_label, value, unit, ref_low, ref_high, measured_at').eq('user_id', userId).order('measured_at', { ascending: false }).limit(120),
      supabase.from('med_logs').select('status, date, taken_at').eq('user_id', userId).gte('date', days14.slice(0, 10)),
    ])

    const medsList = (meds || []) as any[]
    const vit = (vitals || []) as any[]
    const labList = (labs || []) as any[]
    const logList = (logs || []) as any[]

    // Idade
    let age: number | undefined = profile?.age || undefined
    if (!age && profile?.birth_date) age = Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 86400000))

    const concerns: Concern[] = []

    // ── 1) Interações graves na medicação atual ────────────────────────────
    const medNames = medsList.map(m => norm(m.name)).filter(Boolean)
    const seenPair = new Set<string>()
    for (const [groupA, groupB, why] of DANGER_PAIRS) {
      const a = medsList.find(m => groupA.some(g => norm(m.name).includes(g)))
      const b = medsList.find(m => m !== a && groupB.some(g => norm(m.name).includes(g)))
      if (a && b) {
        const key = [norm(a.name), norm(b.name)].sort().join('|')
        if (seenPair.has(key)) continue
        seenPair.add(key)
        concerns.push({
          id: `int-${key}`, severity: 'urgent', icon: '⚠️',
          title: `${a.name} + ${b.name}`,
          detail: `${why}. Esta combinação merece atenção — fala com o teu farmacêutico ou médico antes de continuares.`,
          action: { label: 'Ver interações em detalhe', route: '/interactions' },
        })
      }
    }

    // ── 2) Tensão arterial alta repetida ───────────────────────────────────
    const bpReadings = vit.filter(v => v.bp_sys && v.bp_dia)
    const highBp = bpReadings.filter(v => v.bp_sys >= 140 || v.bp_dia >= 90)
    if (bpReadings.length >= 2 && highBp.length >= 2) {
      const last = bpReadings[0]
      const veryHigh = highBp.some(v => v.bp_sys >= 180 || v.bp_dia >= 110)
      concerns.push({
        id: 'bp-high', severity: veryHigh ? 'urgent' : 'attention', icon: '🩺',
        title: veryHigh ? 'Tensão arterial muito alta' : 'Tensão arterial alta nas últimas medições',
        detail: `A tua última leitura foi ${last.bp_sys}/${last.bp_dia} mmHg, e ${highBp.length} das últimas medições estiveram acima do normal. ${veryHigh ? 'Se tiveres dores de cabeça fortes, falta de ar ou dor no peito, procura ajuda já.' : 'Vale a pena falares com o teu médico sobre isto.'}`,
        action: { label: 'Ver as minhas tensões', route: '/vitals' },
      })
    }

    // ── 3) Glicemia alta repetida ──────────────────────────────────────────
    const gluc = vit.filter(v => v.glucose != null)
    const highGluc = gluc.filter(v => v.glucose >= 180)
    if (gluc.length >= 2 && highGluc.length >= 2) {
      concerns.push({
        id: 'gluc-high', severity: 'attention', icon: '🩸',
        title: 'Açúcar no sangue elevado',
        detail: `Várias das tuas medições de glicemia estiveram acima de 180 mg/dL. Convém rever a alimentação e a medicação com o teu médico.`,
        action: { label: 'Ver as minhas medições', route: '/vitals' },
      })
    }

    // ── 4) SpO2 baixa ──────────────────────────────────────────────────────
    const lowSpo2 = vit.find(v => v.spo2 != null && v.spo2 < 92)
    if (lowSpo2) {
      concerns.push({
        id: 'spo2-low', severity: 'urgent', icon: '🫁',
        title: 'Oxigénio no sangue baixo',
        detail: `Registaste uma SpO2 de ${lowSpo2.spo2}%. Abaixo de 92% pode ser sinal de alerta — se te sentes com falta de ar, contacta o SNS 24 (808 24 24 24) ou o teu médico.`,
        action: { label: 'Ver sinais vitais', route: '/vitals' },
      })
    }

    // ── 5) Comprimidos a acabar ────────────────────────────────────────────
    for (const m of medsList) {
      if (m.pills_remaining != null && m.pills_per_day) {
        const daysLeft = Math.floor((m.pills_remaining || 0) / Math.max(0.25, m.pills_per_day))
        if (daysLeft <= 7) {
          concerns.push({
            id: `refill-${norm(m.name)}`, severity: daysLeft <= 2 ? 'attention' : 'info', icon: '💊',
            title: `${m.name} está a acabar`,
            detail: daysLeft <= 0 ? `Já não tens comprimidos de ${m.name}. Pede a receita ao teu médico ou vai à farmácia.` : `Tens ${m.name} para cerca de ${daysLeft} dia${daysLeft === 1 ? '' : 's'}. Trata da renovação a tempo.`,
            action: { label: 'Ver a minha medicação', route: '/mymeds' },
          })
        }
      }
    }

    // ── 6) Adesão a cair (doses falhadas) ──────────────────────────────────
    const totalSlots = medsList.reduce((n, m) => n + (m.reminder_times?.length || 0), 0)
    if (totalSlots > 0) {
      const takenDays = new Set(logList.filter(l => l.status === 'taken').map(l => l.date))
      // dias dos últimos 7 sem qualquer registo de toma
      let missedDays = 0
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)
        if (!takenDays.has(d)) missedDays++
      }
      if (missedDays >= 3) {
        concerns.push({
          id: 'adherence', severity: 'attention', icon: '📅',
          title: 'Tens falhado a medicação',
          detail: `Em ${missedDays} dos últimos 7 dias não houve registo de tomas. Saltar doses pode tirar eficácia ao tratamento. Queres ativar lembretes?`,
          action: { label: 'Configurar lembretes', route: '/mymeds' },
        })
      }
    }

    // ── 7) Análises alteradas (último valor de cada teste) ─────────────────
    const seenTest = new Set<string>()
    for (const l of labList) {
      if (seenTest.has(l.test_code)) continue
      seenTest.add(l.test_code)
      const v = Number(l.value)
      if (isNaN(v)) continue
      const low = l.ref_low != null ? Number(l.ref_low) : null
      const high = l.ref_high != null ? Number(l.ref_high) : null
      const isLow = low != null && v < low
      const isHigh = high != null && v > high
      if (isLow || isHigh) {
        concerns.push({
          id: `lab-${l.test_code}`, severity: 'info', icon: '🧪',
          title: `${l.test_label || l.test_code} ${isHigh ? 'acima' : 'abaixo'} do normal`,
          detail: `O teu valor de ${l.test_label || l.test_code} foi ${l.value}${l.unit ? ' ' + l.unit : ''} (referência ${low ?? '–'}–${high ?? '–'}). Mostra ao teu médico na próxima consulta.`,
          action: { label: 'Perceber as minhas análises', route: '/labs' },
        })
      }
    }

    // ── 8) Polimedicação no idoso ──────────────────────────────────────────
    if (age && age >= 75 && medsList.length >= 5) {
      const benzo = medsList.find(m => /diazepam|lorazepam|alprazolam|bromazepam|clonazepam|zolpidem/i.test(norm(m.name)))
      concerns.push({
        id: 'polypharmacy', severity: 'info', icon: '🧓',
        title: 'Muitos medicamentos ao mesmo tempo',
        detail: `Tomas ${medsList.length} medicamentos. ${benzo ? `Um deles (${benzo.name}) merece atenção na tua idade. ` : ''}Vale a pena pedir ao médico uma revisão de toda a medicação.`,
        action: { label: 'Verificar a minha medicação', route: '/interactions' },
      })
    }

    // Limitar análises alteradas a 3 para não inundar
    const labConcerns = concerns.filter(c => c.id.startsWith('lab-'))
    if (labConcerns.length > 3) {
      const keep = new Set(labConcerns.slice(0, 3).map(c => c.id))
      for (let i = concerns.length - 1; i >= 0; i--) {
        if (concerns[i].id.startsWith('lab-') && !keep.has(concerns[i].id)) concerns.splice(i, 1)
      }
    }

    // Nada a assinalar → mensagem positiva
    const hasData = medsList.length > 0 || vit.length > 0 || labList.length > 0
    if (concerns.length === 0 && hasData) {
      concerns.push({
        id: 'all-good', severity: 'good', icon: '✅',
        title: 'Está tudo no bom caminho',
        detail: 'Olhei para a tua medicação, sinais vitais e análises e não encontrei nada que precise de atenção agora. Continua assim!',
      })
    }

    concerns.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])

    // ── Frase de abertura (única chamada de IA, opcional/barata) ────────────
    const firstName = (profile?.name || '').split(' ')[0] || ''
    const hour = now.getHours()
    const greet = hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite'
    let intro = `${greet}${firstName ? ', ' + firstName : ''}.`
    try {
      const urgentCount = concerns.filter(c => c.severity === 'urgent').length
      const attnCount = concerns.filter(c => c.severity === 'attention').length
      const r = await aiComplete([
        { role: 'system', content: 'És o Phlox, um médico de bolso atencioso. Escreves UMA frase curta (máx 18 palavras), calorosa, em PT-PT, a abrir o resumo de saúde do utilizador. Não inventas dados.' },
        { role: 'user', content: `Saudação base: "${intro}". Há ${urgentCount} alerta(s) urgente(s), ${attnCount} a precisar de atenção, e ${concerns.length - urgentCount - attnCount} informativos. Escreve só a frase de abertura.` },
      ], { maxTokens: 60, temperature: 0.5 })
      if (r.text?.trim()) intro = r.text.trim().replace(/^["']|["']$/g, '')
    } catch { /* mantém a saudação base */ }

    const summary = {
      urgent: concerns.filter(c => c.severity === 'urgent').length,
      attention: concerns.filter(c => c.severity === 'attention').length,
      info: concerns.filter(c => c.severity === 'info').length,
    }

    return NextResponse.json({ intro, concerns, summary, hasData })
  } catch (err: any) {
    console.error('companion error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao analisar' }, { status: 500 })
  }
}
