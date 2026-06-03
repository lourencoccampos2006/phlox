// app/api/internship/ai/route.ts
// POST com action:
//   - generate_report : Gera relatório final/intermédio/semanal a partir das actividades
//   - generate_case   : Gera caso clínico estruturado a partir de doente seguido
//   - improve_note    : IA dá feedback construtivo a uma nota/SOAP
//   - suggest_diagnosis : Diagnóstico diferencial a partir dos dados do doente
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiComplete, aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'Assistente IA do Estágio')

  const body = await req.json().catch(() => null) as any
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  const db = sb(req)

  // ── 1) GENERATE REPORT ──
  if (body.action === 'generate_report') {
    const { internship_id, kind = 'final' } = body
    if (!internship_id) return NextResponse.json({ error: 'internship_id obrigatório' }, { status: 400 })

    // Recolhe TODOS os dados do estágio
    const [intRes, patRes, logRes, procRes, objRes, reflRes] = await Promise.all([
      db.from('internships').select('*').eq('id', internship_id).single(),
      db.from('internship_patients').select('initials, age, sex, diagnosis, learning_points').eq('internship_id', internship_id).limit(40),
      db.from('internship_log_entries').select('entry_date, what_was_done, learning, highlights, difficulties').eq('internship_id', internship_id).order('entry_date').limit(60),
      db.from('internship_procedures').select('procedure_name, level, performed_at').eq('internship_id', internship_id),
      db.from('internship_objectives').select('category, title, level, status').eq('internship_id', internship_id),
      db.from('internship_reflections').select('framework, description, analysis, action_plan, free_text').eq('internship_id', internship_id).limit(10),
    ])

    if (!intRes.data) return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    const intr = intRes.data

    const procCounts = (procRes.data || []).reduce<Record<string, number>>((acc, p) => {
      const k = `${p.procedure_name} (${p.level})`
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    const completed = (objRes.data || []).filter(o => o.status === 'completed' || o.status === 'validated').length
    const totalObj = (objRes.data || []).length

    try {
      const { text } = await aiComplete([
        {
          role: 'system',
          content: `És coach académico para estudantes de saúde em Portugal.
Gera o relatório de estágio em PT-PT, formal mas pessoal, em markdown.

Tipo de relatório: ${kind}
Área: ${intr.area}
Local: ${intr.institution || '—'} · ${intr.ward || '—'}
Datas: ${intr.start_date} a ${intr.end_date}
Supervisor: ${intr.supervisor || '—'}

Secções obrigatórias:
1. **Identificação** (estágio, local, datas, supervisor)
2. **Objectivos pessoais e académicos** (com base nos objectivos do currículo)
3. **Actividades desenvolvidas** (síntese das actividades diárias)
4. **Doentes seguidos / casos relevantes** (resumo)
5. **Procedimentos** (lista com nível de participação)
6. **Competências adquiridas / objectivos cumpridos** (${completed}/${totalObj})
7. **Reflexão crítica** (pontos fortes, dificuldades, aprendizagens-chave)
8. **Conclusão e plano de melhoria**

Tom: maduro, autocrítico, profissional. PT-PT.`,
        },
        {
          role: 'user',
          content: `Dados do estágio:

LOG DIÁRIO (${logRes.data?.length || 0} entradas):
${(logRes.data || []).slice(0, 20).map(l => `${l.entry_date}: ${l.what_was_done || ''} | aprendi: ${l.learning || ''}`).join('\n')}

DOENTES SEGUIDOS (${patRes.data?.length || 0}):
${(patRes.data || []).slice(0, 15).map(p => `${p.initials || '—'} ${p.age || '?'}a ${p.sex || '?'} — ${p.diagnosis || ''} ${p.learning_points ? '| aprendi: ' + p.learning_points : ''}`).join('\n')}

PROCEDIMENTOS:
${Object.entries(procCounts).map(([k, v]) => `${k}: ${v}x`).join('\n')}

OBJECTIVOS (${completed}/${totalObj} concluídos):
${(objRes.data || []).slice(0, 20).map(o => `[${o.status}] ${o.category}: ${o.title}`).join('\n')}

REFLEXÕES:
${(reflRes.data || []).map(r => r.free_text || `${r.description || ''} ${r.analysis || ''}`).slice(0, 5).join('\n---\n')}

Gera o relatório completo.`,
        },
      ], { maxTokens: 3500, temperature: 0.3 })

      // Grava como relatório
      const { data: report } = await db.from('internship_reports').insert({
        user_id: userId,
        internship_id,
        kind,
        title: `Relatório ${kind === 'final' ? 'Final' : kind === 'weekly' ? 'Semanal' : 'Intermédio'} — ${intr.name}`,
        body: text,
        ai_assisted: true,
      }).select().single()

      return NextResponse.json({ report })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 2) GENERATE CASE PRESENTATION from PATIENT ──
  if (body.action === 'generate_case') {
    const { patient_id } = body
    if (!patient_id) return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })

    const { data: pat } = await db.from('internship_patients').select('*, internship:internship_id(area, name)').eq('id', patient_id).single()
    if (!pat) return NextResponse.json({ error: 'Doente não encontrado' }, { status: 404 })

    const { data: fups } = await db.from('patient_followups').select('*').eq('internship_patient_id', patient_id).order('followup_date')

    try {
      const result = await aiJSON<any>([
        {
          role: 'system',
          content: `És clínico sénior. Constrói um CASO CLÍNICO estruturado em PT-PT para apresentação académica.
Recebes dados ANÓNIMOS de um doente seguido por um estudante. Tu organizas, completas com raciocínio clínico esperado e enriqueces para uso pedagógico.

Responde APENAS JSON:
{
  "title": "Título do caso (ex: 'Mulher 67a com dispneia progressiva')",
  "history": "História clínica organizada (HDA, AP, AF, hábitos)",
  "exam_findings": "Achados de exame físico organizados por sistemas",
  "investigations": "Exames pedidos e resultados (estruturados)",
  "differential": "Diagnóstico diferencial ordenado por probabilidade com justificação",
  "final_diagnosis": "Diagnóstico final",
  "management": "Conduta terapêutica fundamentada",
  "outcome": "Evolução",
  "discussion": "Discussão pedagógica — 2-3 pontos-chave para aprendizagem",
  "references_text": "Referências bibliográficas sugeridas"
}`,
        },
        {
          role: 'user',
          content: `Dados do doente:
Iniciais: ${pat.initials || '—'} · ${pat.age || '?'} anos · ${pat.sex || '?'}
Queixa principal: ${pat.chief_complaint || '—'}
Diagnóstico: ${pat.diagnosis || '—'}
Diagnósticos secundários: ${(pat.secondary_diagnoses || []).join(', ')}
Comorbilidades: ${(pat.comorbidities || []).join(', ')}
Alergias: ${(pat.allergies || []).join(', ')}
Medicação: ${pat.current_meds || '—'}
História: ${pat.background || '—'}
Pontos aprendidos: ${pat.learning_points || '—'}

EVOLUÇÃO (${fups?.length || 0} dias):
${(fups || []).map(f => `${f.followup_date}: S:${f.subjective || ''} O:${f.objective || ''} A:${f.assessment || ''} P:${f.plan || ''}`).join('\n')}`,
        },
      ], { maxTokens: 2500, temperature: 0.25 })

      const { data: caseRow } = await db.from('case_presentations').insert({
        user_id: userId,
        internship_id: pat.internship_id,
        patient_id,
        title: result.title || `Caso ${pat.initials}`,
        history: result.history,
        exam_findings: result.exam_findings,
        investigations: result.investigations,
        differential: result.differential,
        final_diagnosis: result.final_diagnosis,
        management: result.management,
        outcome: result.outcome,
        discussion: result.discussion,
        references_text: result.references_text,
        ai_assisted: true,
      }).select().single()

      return NextResponse.json({ case: caseRow })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 3) IMPROVE NOTE ──
  if (body.action === 'improve_note') {
    const { note_text, note_type = 'SOAP' } = body
    if (!note_text) return NextResponse.json({ error: 'note_text obrigatório' }, { status: 400 })
    try {
      const result = await aiJSON<{ score: number; strengths: string[]; missing: string[]; improved: string }>([
        {
          role: 'system',
          content: `És clínico sénior a rever uma nota clínica de estudante (formato ${note_type}).
Avalia rigorosamente em PT-PT. Identifica o que está bem, o que falta e produz uma versão melhorada.

Responde APENAS JSON:
{
  "score": 0-100,
  "strengths": ["pontos bem feitos"],
  "missing": ["elementos em falta ou imprecisos"],
  "improved": "versão melhorada da nota, mantendo a essência mas mais completa e clínica"
}`,
        },
        { role: 'user', content: `Nota do estudante:\n"${note_text}"` },
      ], { maxTokens: 1500, temperature: 0.2 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 4) SUGGEST DIAGNOSIS / DDX from patient ──
  if (body.action === 'suggest_diagnosis') {
    const { patient_id } = body
    if (!patient_id) return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
    const { data: pat } = await db.from('internship_patients').select('*').eq('id', patient_id).single()
    if (!pat) return NextResponse.json({ error: 'Doente não encontrado' }, { status: 404 })
    try {
      const result = await aiJSON<{ differential: { dx: string; probability: string; reason: string }[]; next_steps: string[] }>([
        {
          role: 'system',
          content: `És médico interno. Constrói diagnóstico diferencial em PT-PT a partir de dados clínicos. Responde APENAS JSON:
{
  "differential": [{ "dx": "diagnóstico", "probability": "alta|média|baixa", "reason": "justificação em 1 frase" }],
  "next_steps": ["próximo passo diagnóstico ou terapêutico"]
}`,
        },
        {
          role: 'user',
          content: `${pat.initials || '—'} · ${pat.age || '?'}a · ${pat.sex || '?'}
Queixa: ${pat.chief_complaint || '—'}
Comorbilidades: ${(pat.comorbidities || []).join(', ')}
História: ${pat.background || '—'}`,
        },
      ], { maxTokens: 900, temperature: 0.25 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
