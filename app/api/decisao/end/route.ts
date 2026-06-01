// app/api/decisao/end/route.ts
// Phlox Decisão — Avaliação final com feedback de especialista.
//
// Atualização 2026-05-31:
//   • Trata explicitamente o desfecho "morte do doente" como cenário de
//     aprendizagem — não desvaloriza, mas explica o encadeamento de decisões
//     que levou lá.
//   • Cada teaching_point tem mecanismo + guideline (ESC, ESH, GOLD, SCCM,
//     Surviving Sepsis, Portuguese Norma DGS, BMJ Best Practice, UpToDate).
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Decisão')

  const body = await req.json().catch(() => null)
  if (!body?.case_id) return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

  const { case_id, patient_final, events, time_elapsed, end_reason } = body
  const died = patient_final?.severity === 'deceased' || (end_reason || '').toLowerCase().includes('óbito')

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um especialista clínico sénior a fazer debriefing de um caso simulado. O objetivo é educativo: ser claro, honesto, e útil. Nada de elogios vazios nem moralismos. Identifica EXATAMENTE o que correu mal, em que minuto, e o que deveria ter sido feito.

Responde APENAS com JSON:
{
  "score": 0-100,
  "grade": "Excelente"|"Bom"|"Suficiente"|"Insuficiente"|"Reprovado",
  "outcome": "estabilizado"|"melhoria parcial"|"deterioração"|"óbito"|"alta inadequada",
  "outcome_summary": "1 frase descrevendo o desfecho clínico final do doente.",
  "overall_feedback": "2-3 frases directas — o que correu bem e o que correu mal globalmente. Se o doente morreu, identifica a cadeia causal (ex: 'Atraso de 18 minutos para administrar adrenalina IM associado a edema da via aérea progressivo; quando administrada a TA já era irrecuperável.').",
  "correct_decisions": ["decisão correcta e porquê foi a certa neste contexto"],
  "critical_errors": ["erro grave com explicação do mecanismo do dano — ex: 'Furosemida 40mg IV num doente com TA 95/60 e mucosas secas (hipovolemia) → colapso da pré-carga → choque'"],
  "missed_opportunities": ["o que devia ter sido feito e não foi, com timing — ex: 'Adrenalina IM 0.5mg na lateral da coxa devia ter sido a 1ª intervenção (< 5 min). Foi feita aos 18 min.'"],
  "teaching_points": [
    "Ponto concreto com mecanismo + referência guideline (ex: 'CAD: insulina só inicia APÓS reposição de K+ se K+ < 3.3. Insulina baixa K+ intracelularmente; com K+ basal baixo causa hipocaliemia fatal por arritmia. ADA 2024 Diabetes Care; SPD 2023.'). Pelo menos 3 pontos."
  ],
  "time_assessment": "Avaliação do tempo de decisão — door-to-needle? door-to-adrenaline? Quantos minutos perdeu até a intervenção crítica?",
  "key_references": ["3-5 referências curtas: guideline ou paper — ex: '2021 ESC HF Guidelines', 'Surviving Sepsis Campaign 2021', 'Norma DGS 014/2022 anafilaxia'"]
}

Critérios de score:
- 90-100: diagnóstico correcto rápido, tratamento guideline-compliant, sem erros graves, doente estabiliza
- 70-89: diagnóstico correcto, tratamento adequado, 1-2 suboptimalidades sem dano significativo
- 50-69: diagnóstico provável, alguns erros mas doente sobrevive sem sequelas major
- 30-49: diagnóstico errado ou atraso significativo, tratamento inadequado, doente fica pior
- 0-29: erros graves potencialmente fatais
- 0: óbito do doente por erro evitável

${died ? 'IMPORTANTE: O doente FALECEU. Não suavizes — mas também não humilhes. Foca-te no encadeamento de decisões e em "o que poderia ter mudado o desfecho". Score automaticamente ≤ 25 se o óbito foi evitável; reconhecer que pode haver casos onde o desfecho era irreversível mesmo com gestão correta — diz isso se for o caso.' : ''}

Sê clínico, específico e útil. Linguagem PT-PT.`,
      },
      {
        role: 'user',
        content: `Caso: ${case_id}

Estado final do doente: ${JSON.stringify(patient_final)}
Desfecho registado: ${end_reason || 'estabilizado / decisão de alta-transferência'}

Sequência de decisões tomadas (em ordem cronológica):
${(events as string[] | undefined)?.join('\n') || 'Nenhuma decisão registada'}

Tempo total: ${time_elapsed || 0} minutos

Faz o debriefing.`,
      },
    ], { maxTokens: 1800, temperature: 0.15 })

    return NextResponse.json({ final_score: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro' }, { status: 500 })
  }
}
