import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('protocol', plan)

  const body = await req.json().catch(() => null)
  if (!body?.medications || !Array.isArray(body.medications) || body.medications.length === 0) {
    return NextResponse.json({ error: 'Lista de medicamentos obrigatória' }, { status: 400 })
  }

  const meds = body.medications
    .map((m: any) => ({ name: String(m.name || '').trim().slice(0, 80), dose: m.dose || '', frequency: m.frequency || '' }))
    .filter((m: any) => m.name)
    .slice(0, 20)

  const medList = meds.map((m: any) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join('\n')

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico sénior com 20 anos de experiência em revisão de medicação, formado em farmacologia clínica. Fazes revisões de medicação ao nível do que se pratica em farmácia hospitalar e clínica de cuidados primários.

Responde APENAS com JSON válido sem markdown:
{
  "generated_at": "ISO date string",
  "patient_summary": "resumo do perfil do doente em 1 frase baseado nos medicamentos (ex: 'Doente com HTA, dislipidemia e profilaxia antiagregante sob 4 fármacos')",
  "overall_risk": "BAIXO" | "MODERADO" | "ALTO" | "CRITICO",
  "medications_reviewed": ["lista dos medicamentos tal como recebidos"],
  "findings": [
    {
      "id": "f1",
      "priority": "CRITICA" | "ALTA" | "MEDIA" | "INFO",
      "category": "interacao" | "duplicacao" | "monitorizacao" | "contraindicacao" | "dose" | "adesao" | "positivo",
      "title": "título conciso da observação",
      "description": "descrição clínica detalhada em português europeu — explica porquê é relevante, mecanismo se aplicável, magnitude do risco",
      "action": "acção concreta e específica que o doente deve tomar (ex: 'Discute com o teu médico na próxima consulta a possibilidade de substituir o ibuprofeno por paracetamol')",
      "drugs_involved": ["fármaco1", "fármaco2"],
      "evidence": "guideline ou fonte (ex: 'Critérios Beers 2023', 'ESC 2023', 'RxNorm/NIH') — opcional"
    }
  ],
  "positives": ["aspecto positivo da medicação em linguagem clara — ex: 'A combinação de IECA com estatina está bem indicada no teu perfil cardiovascular'"],
  "lab_monitoring": [
    { "test": "nome do teste", "frequency": "frequência recomendada", "reason": "porquê é necessário dado os medicamentos" }
  ],
  "follow_up": "recomendação de follow-up (ex: 'Em 3 meses com o médico de família para reavaliação dos electrólitos')",
  "pharmacist_note": "nota final do farmacologista — síntese personalizada das prioridades mais importantes para este doente específico, em linguagem directa e empática"
}

Regras clínicas que DEVES verificar sistematicamente:
1. Interações farmacológicas clinicamente relevantes (especialmente: anticoagulantes + AINEs, IECAs + poupadores de K+, QT prolongers, inibidores CYP3A4 + estatinas)
2. Duplicações terapêuticas (duas estatinas, dois inibidores da bomba de protões, etc.)
3. Critérios de Beers 2023 (se medicamentos típicos de idosos: BZD, anticolinérgicos, AINEs em idosos)
4. Medicamentos que requerem monitorização laboratorial (varfarina→INR, IECAs→creatinina+K, metformina→B12, amiodarona→TSH+transaminases, lítio→litemias, estatinas→CK+transaminases)
5. Omissões evidentes (ex: doente com antiagregante sem IBP, doente com IC sem betabloqueador)
6. Problemas de adesão (polifarmácia complexa, múltiplas tomas diárias)
Sê específico, clínico e útil. Evita generalismos. Cada finding deve ser directamente accionável.`,
      },
      {
        role: 'user',
        content: `Faz uma revisão clínica completa da seguinte medicação:\n\n${medList}`,
      },
    ], { maxTokens: 2500, temperature: 0.1 })

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Med review error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro ao gerar revisão. Tenta novamente.' }, { status: 500 })
  }
}