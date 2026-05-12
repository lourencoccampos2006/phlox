// app/api/residentes/review/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(getIP(req), 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('pro', 'Phlox Residentes')

  const body = await req.json().catch(() => null)
  if (!body?.medications || !body?.name) {
    return NextResponse.json({ error: 'Dados do residente obrigatórios.' }, { status: 400 })
  }

  const medList = (body.medications as any[])
    .map(m => `${m.name} ${m.dose || ''} ${m.frequency || ''}${m.route ? ` (${m.route})` : ''}`.trim())
    .join('\n')

  const patientContext = [
    `Nome: ${body.name}`,
    `Idade: ${body.age} anos`,
    `Diagnósticos: ${body.diagnosis}`,
    body.weight && `Peso: ${body.weight} kg`,
    body.creatinine && `Creatinina: ${body.creatinine} mg/dL`,
    body.allergies?.length && `Alergias: ${body.allergies.join(', ')}`,
    `\nMedicação:\n${medList}`,
  ].filter(Boolean).join('\n')

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico sénior especializado em revisão farmacoterapêutica de idosos institucionalizados (lares, IPSS). Tens formação específica nos Critérios Beers 2023, STOPP/START v3, e guidelines de doença crónica em idosos.

Analisa sistematicamente a medicação do residente e responde APENAS com JSON válido:
{
  "overall_risk": "BAIXO"|"MODERADO"|"ALTO"|"CRITICO",
  "findings": [
    {
      "id": "f1",
      "priority": "CRITICA"|"ALTA"|"MEDIA"|"INFO",
      "category": "interacao"|"duplicacao"|"monitorizacao"|"contraindicacao"|"dose"|"beers"|"positivo",
      "title": "Título conciso",
      "description": "Descrição clínica detalhada em PT-PT — mecanismo, risco, magnitude, impacto neste residente específico",
      "action": "Acção concreta e específica — dirigida ao farmacêutico ou ao médico responsável",
      "drugs_involved": ["fármaco1"],
      "evidence": "Critérios Beers 2023 / STOPP v3 / guideline específica",
      "resolved": false,
      "created_at": "now"
    }
  ],
  "positives": ["Aspecto positivo concreto da medicação"],
  "lab_monitoring": [
    { "test": "Nome do teste", "frequency": "frequência (ex: cada 3 meses)", "reason": "Porquê é necessário dados os fármacos prescritos" }
  ],
  "pharmacist_note": "Nota síntese do farmacêutico dirigida ao médico responsável — 2-3 frases directas com as prioridades mais urgentes",
  "next_review_weeks": 4
}

Verificações obrigatórias (STOPP/START + Beers):
1. BENZODIAZEPINAS em idosos (Beers) — risco de queda, sedação, dependência
2. AINEs com anticoagulante ou antiagregante — risco hemorrágico
3. AINEs em DRC (ClCr estimado pela idade e creatinina) — nefrotóxico
4. METFORMINA em DRC G3b+ (Cr > 1.5 F / > 1.7 M) — acidose láctica
5. DIGOXINA > 0.125mg em idoso > 80 anos (Beers)
6. DUPLICAÇÃO de classe: 2 IBP, 2 estatinas, 2 anti-HTA do mesmo grupo
7. IBP sem indicação clara ou há mais de 8 semanas sem reavaliar
8. ANTIPSICÓTICOS em idosos sem diagnóstico de psicose/esquizofrenia (Beers)
9. ANTICOLINÉRGICOS: tricíclicos, oxibutinina, prometazina, difenidramina em idosos
10. HIPOGLICEMIANTES e risco de hipoglicemia no idoso (sulfonilureias, insulina)
11. POTÁSSIO: IECA/ARA-II + poupador K+ (espironolactona) → hipercaliemia
12. ALENDRONATO — tomar com 200ml água, manter-se erecto 30min
13. Medicação com janela terapêutica estreita: varfarina, digoxina, lítio, fenitoína — monitorização regular?
14. OMEPRAZOL/IBP dose máxima por mais de 8 semanas → risco de hipomagnesemia, hiponatremia, fragilidade óssea
15. ESTATINAS em doente > 85 anos sem DCV documentada — benefício questionável (STOPP)
16. START: doente com FA sem anticoagulante (excepto contra-indicação documentada)?
17. START: doente com IC-FEr sem IECA/ARA-II (excepto contraindicação)?

Categoria "beers" para medicamentos na lista de Beers em idosos.
Sê específico e accionável — o médico responsável deve conseguir agir directamente com esta nota.`,
      },
      { role: 'user', content: patientContext },
    ], { maxTokens: 2500, temperature: 0.05 })

    // Ensure created_at and resolved defaults
    if (result.findings) {
      result.findings = result.findings.map((f: any, i: number) => ({
        ...f,
        id: f.id || `f${i + 1}`,
        resolved: false,
        created_at: new Date().toISOString(),
      }))
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Residentes review error:', err?.message)
    return NextResponse.json({ error: 'Erro ao analisar. Tenta novamente.' }, { status: 500 })
  }
}