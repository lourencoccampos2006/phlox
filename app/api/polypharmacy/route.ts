import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 8, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.medications || !body?.age) {
    return NextResponse.json({ error: 'Idade e lista de medicamentos obrigatórios' }, { status: 400 })
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico especialista em polimedicação e revisão da terapêutica em idosos. Realizas auditorias de polimedicação para lares, clínicas e hospitais.

Analisa o perfil do doente e identifica:
1. Medicamentos potencialmente inapropriados (MPI) — critérios STOPP v3, Beers 2023, EU-PIM list
2. Duplicações terapêuticas
3. Cascatas de prescrição (efeito adverso de A → prescrição de B)
4. Medicamentos sem indicação aparente
5. Omissões terapêuticas relevantes
6. Interações clinicamente significativas
7. Score de carga anticolinérgica (ACB scale)
8. Score de carga sedativa

Responde APENAS com JSON válido:
{
  "risk_score": número de 0-100,
  "risk_level": "baixo" | "moderado" | "alto" | "muito_alto",
  "total_meds": número,
  "polypharmacy": true/false,
  "hyperpolypharmacy": true/false,
  "anticholinergic_burden": {
    "score": número,
    "level": "baixo" | "moderado" | "alto",
    "drugs_contributing": ["fármaco (pontos ACB)"]
  },
  "sedative_burden": {
    "score": número,
    "level": "baixo" | "moderado" | "alto",
    "drugs_contributing": ["fármaco"]
  },
  "inappropriate_meds": [
    {
      "drug": "nome do fármaco",
      "criterion": "critério STOPP/Beers/EU-PIM",
      "criterion_code": "ex: STOPP-C4",
      "severity": "alto" | "moderado" | "baixo",
      "reason": "porquê é inapropriado neste doente",
      "recommendation": "suspender / reduzir dose / substituir / vigiar",
      "alternative": "alternativa terapêutica se disponível"
    }
  ],
  "duplications": [
    {
      "class": "classe terapêutica",
      "drugs": ["fármaco 1", "fármaco 2"],
      "recommendation": "o que fazer"
    }
  ],
  "prescribing_cascades": [
    {
      "cause_drug": "fármaco causador",
      "adverse_effect": "efeito adverso que gerou nova prescrição",
      "consequence_drug": "fármaco prescrito para tratar o efeito",
      "recommendation": "recomendação"
    }
  ],
  "missing_treatments": [
    {
      "condition": "condição",
      "missing_drug_class": "classe em falta",
      "rationale": "porquê deveria estar prescrito",
      "note": "precauções"
    }
  ],
  "key_interactions": [
    {
      "drug_a": "fármaco A",
      "drug_b": "fármaco B",
      "severity": "grave" | "moderada" | "ligeira",
      "effect": "efeito da interação",
      "management": "como gerir"
    }
  ],
  "priority_actions": [
    {
      "priority": número de 1-5,
      "action": "ação concreta a tomar",
      "drug": "fármaco(s) envolvido(s)",
      "timeline": "urgência: imediato / próxima visita / próxima consulta"
    }
  ],
  "summary": "resumo executivo para o farmacêutico/médico (3-5 frases)"
}`,
      },
      {
        role: 'user',
        content: `Auditoria de polimedicação:

Idade: ${body.age} anos
Sexo: ${body.sex || 'não especificado'}
Peso: ${body.weight ? body.weight + ' kg' : 'não especificado'}
Diagnósticos: ${body.diagnoses || 'não especificados'}
Parâmetros laboratoriais: ${body.labs || 'não disponíveis'}
Contexto: ${body.context || 'lar de idosos / ambulatório'}

Medicação actual (${body.medications.split('\n').filter((l: string) => l.trim()).length} medicamentos):
${body.medications}

${body.recent_falls ? `Quedas recentes: ${body.recent_falls}` : ''}
${body.cognitive ? `Estado cognitivo: ${body.cognitive}` : ''}`,
      },
    ], { maxTokens: 3500, temperature: 0.0 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro na auditoria de polimedicação.' }, { status: 500 })
  }
}
