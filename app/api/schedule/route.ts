import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

interface Med { id: string; name: string; dose?: string | null; frequency?: string | null; indication?: string | null }

interface ScheduleSlot {
  time: string            // "08:00"
  label: string           // "Pequeno-almoço"
  meds: {
    med_id: string
    name: string
    dose: string | null
    reason: string
    food: 'com_refeicao' | 'em_jejum' | 'indiferente'
    notes?: string
  }[]
}

interface ScheduleResult {
  slots: ScheduleSlot[]
  warnings: { drug: string; warning: string; severity: 'alta' | 'media' | 'baixa' }[]
  summary: string
  wake_time: string
  sleep_time: string
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip, 5, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { medications: Med[]; wake_time?: string; sleep_time?: string; conditions?: string } = { medications: [] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 }) }

  const { medications, wake_time = '07:30', sleep_time = '23:00', conditions = '' } = body
  if (!medications?.length) return NextResponse.json({ error: 'Lista de medicamentos em falta' }, { status: 400 })

  const medList = medications.slice(0, 25).map(m =>
    `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` (${m.frequency})` : ''}${m.indication ? ` [${m.indication}]` : ''}`
  ).join('\n')

  const prompt = `És um farmacêutico clínico sénior especialista em farmacoterapia. O utilizador acorda às ${wake_time} e dorme às ${sleep_time}.

MEDICAMENTOS:
${medList}
${conditions ? `\nCONDIÇÕES CLÍNICAS: ${conditions}` : ''}

Cria o horário diário ideal considerando:
1. Interações entre medicamentos (separar AINEs+IBP, digoxina longe de antiácidos, etc.)
2. Relação com refeições (metformina COM comida, levotiroxina EM JEJUM, etc.)
3. Half-life e timing farmacológico
4. Evitar medicamentos sedativos de manhã e estimulantes à noite
5. Agrupar quando possível (facilitar adesão)

Devolve APENAS JSON:
{
  "slots": [
    {
      "time": "08:00",
      "label": "Pequeno-almoço",
      "meds": [
        {
          "med_id": "id_do_medicamento",
          "name": "nome do medicamento",
          "dose": "dose ou null",
          "reason": "porque neste horário (1 frase)",
          "food": "com_refeicao" | "em_jejum" | "indiferente",
          "notes": "nota importante ou null"
        }
      ]
    }
  ],
  "warnings": [
    {
      "drug": "nome",
      "warning": "aviso importante",
      "severity": "alta" | "media" | "baixa"
    }
  ],
  "summary": "resumo em PT-PT do horário (2-3 frases, dicas práticas)",
  "wake_time": "${wake_time}",
  "sleep_time": "${sleep_time}"
}

Labels sugeridos para os slots: "Jejum (${wake_time})", "Pequeno-almoço", "Almoço", "Lanche", "Jantar", "Deitar (${sleep_time})"
Não cries slots vazios. Responde APENAS JSON.`

  try {
    const result = await aiJSON<ScheduleResult>(
      [{ role: 'user', content: prompt }],
      { maxTokens: 2000 }
    )

    const safe: ScheduleResult = {
      slots: (Array.isArray(result?.slots) ? result.slots : [])
        .filter((s: any) => s?.time && Array.isArray(s?.meds) && s.meds.length > 0)
        .map((s: any) => ({
          time: String(s.time).slice(0, 5),
          label: String(s.label || '').slice(0, 50),
          meds: s.meds.slice(0, 15).map((m: any) => ({
            med_id: String(m.med_id || m.name || '').slice(0, 50),
            name: String(m.name || '').slice(0, 100),
            dose: m.dose ? String(m.dose).slice(0, 30) : null,
            reason: String(m.reason || '').slice(0, 200),
            food: ['com_refeicao', 'em_jejum', 'indiferente'].includes(m.food) ? m.food : 'indiferente',
            notes: m.notes ? String(m.notes).slice(0, 200) : undefined,
          })),
        }))
        .sort((a: any, b: any) => a.time.localeCompare(b.time)),
      warnings: (Array.isArray(result?.warnings) ? result.warnings : [])
        .slice(0, 8)
        .map((w: any) => ({
          drug: String(w.drug || '').slice(0, 100),
          warning: String(w.warning || '').slice(0, 300),
          severity: ['alta', 'media', 'baixa'].includes(w.severity) ? w.severity : 'baixa',
        })),
      summary: String(result?.summary || '').slice(0, 600),
      wake_time,
      sleep_time,
    }

    return NextResponse.json(safe)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao gerar horário' }, { status: 500 })
  }
}
