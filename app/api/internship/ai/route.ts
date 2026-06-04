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

  // ── 5) INTERVIEW: gera perguntas personalizadas para mapear lacunas ──
  if (body.action === 'interview_questions') {
    const { internship_id } = body
    if (!internship_id) return NextResponse.json({ error: 'internship_id obrigatório' }, { status: 400 })
    const { data: intr } = await db.from('internships').select('*').eq('id', internship_id).single()
    if (!intr) return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    try {
      const res = await aiJSON<{ questions: { id: string; text: string; type: 'short'|'long'|'choice'; options?: string[] }[] }>([
        {
          role: 'system',
          content: `És coach académico para um estudante de saúde. Vais fazer 5 perguntas que permitam construir objectivos personalizados de estágio.

Contexto deste estágio:
- Área: ${intr.area}
- Especialidade: ${intr.specialty || '—'}
- Local: ${intr.institution || '—'} · ${intr.ward || '—'}
- Duração: ${intr.start_date} a ${intr.end_date}
- Horas: ${intr.hours_required || '—'}

Cria perguntas ESPECÍFICAS ao contexto. Devem revelar:
1. Nível prévio de experiência
2. O que quer aprender ESPECIFICAMENTE neste estágio
3. Lacunas auto-percebidas
4. Que tipo de doente/casos vai encontrar
5. Que avaliação/exame final tem

Responde APENAS JSON:
{
  "questions": [
    { "id": "q1", "text": "...", "type": "short|long|choice", "options": ["opção1","opção2"] }
  ]
}`,
        },
        { role: 'user', content: 'Cria as 5 perguntas mais úteis para este estágio.' },
      ], { maxTokens: 900, temperature: 0.2 })
      return NextResponse.json(res)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 6) GENERATE OBJECTIVES from interview answers ──
  if (body.action === 'generate_objectives') {
    const { internship_id, answers } = body
    if (!internship_id || !answers) return NextResponse.json({ error: 'internship_id e answers obrigatórios' }, { status: 400 })
    const { data: intr } = await db.from('internships').select('*').eq('id', internship_id).single()
    if (!intr) return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    try {
      const res = await aiJSON<{ objectives: { category: string; title: string; description: string; level: 'see'|'assist'|'do'|'master'; required: boolean }[] }>([
        {
          role: 'system',
          content: `És coach académico. Recebes respostas de um estudante e geras OBJECTIVOS PERSONALIZADOS para o estágio.

Contexto:
- Área: ${intr.area}
- Especialidade: ${intr.specialty || '—'}
- Duração: ${intr.start_date} a ${intr.end_date}
- Horas: ${intr.hours_required || '—'}

Princípios:
- Objectivos SMART (específicos, mensuráveis, alcançáveis, relevantes, com prazo).
- 8-12 objectivos.
- Personaliza ao que o estudante disse (nível, interesses, lacunas).
- Categorias: Anamnese, Exame físico, Procedimentos, Raciocínio clínico, Comunicação, Documentação, Prescrição, etc.
- Mistura níveis: see (observar), assist (ajudar), do (fazer com supervisão), master (autónomo).
- Marca required=true os curriculares mínimos.

Responde APENAS JSON:
{
  "objectives": [
    { "category": "...", "title": "...", "description": "...", "level": "do", "required": true }
  ]
}`,
        },
        {
          role: 'user',
          content: `Respostas do estudante:\n${JSON.stringify(answers, null, 2)}\n\nGera os objectivos personalizados.`,
        },
      ], { maxTokens: 2500, temperature: 0.25 })

      // Insere os objectivos
      if (res.objectives) {
        const rows = res.objectives.map(o => ({
          internship_id, user_id: userId,
          category: o.category, title: o.title, description: o.description,
          level: o.level, required: o.required, status: 'pending',
        }))
        await db.from('internship_objectives').insert(rows)
      }
      return NextResponse.json(res)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 7) VOICE NOTE → SOAP ────────────────────────────────────────────
  // Recebe texto transcrito (de gravação) e estrutura como SOAP automaticamente.
  if (body.action === 'voice_to_soap') {
    const { transcript, patient_id } = body
    if (!transcript) return NextResponse.json({ error: 'transcript obrigatório' }, { status: 400 })
    try {
      const res = await aiJSON<{ subjective: string; objective: string; assessment: string; plan: string; vitals: any }>([
        {
          role: 'system',
          content: `És clínico sénior. Recebes uma gravação transcrita (ditado do estudante após observar um doente) e estruturas como nota SOAP rigorosa em PT-PT.
Reconhece automaticamente: sinais vitais, queixas, achados de exame, raciocínio e plano.
Se faltar informação numa secção, mantém-a curta — não inventes.

Responde APENAS JSON:
{
  "subjective": "queixas, história, sintomas relatados",
  "objective": "exame físico, sinais vitais, exames",
  "assessment": "diagnóstico/raciocínio",
  "plan": "plano terapêutico e seguimento",
  "vitals": { "ta": "120/80", "fc": 78, "fr": 16, "spo2": 98, "temp": 36.5, "gli": 95 }
}`,
        },
        { role: 'user', content: `Transcrição:\n${transcript}` },
      ], { maxTokens: 1500, temperature: 0.15 })
      // Se patient_id, grava como followup
      if (patient_id) {
        await db.from('patient_followups').insert({
          user_id: userId,
          internship_patient_id: patient_id,
          followup_date: new Date().toISOString().slice(0, 10),
          subjective: res.subjective,
          objective: res.objective,
          assessment: res.assessment,
          plan: res.plan,
          vitals: res.vitals || null,
        })
      }
      return NextResponse.json(res)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 8) HANDOVER SBAR — gera passagem de turno estruturada ──────────
  if (body.action === 'handover') {
    const { internship_id, patient_ids } = body
    if (!internship_id) return NextResponse.json({ error: 'internship_id obrigatório' }, { status: 400 })
    let patients: any[] = []
    if (patient_ids?.length) {
      const { data } = await db.from('internship_patients').select('*').in('id', patient_ids)
      patients = data || []
    } else {
      const { data } = await db.from('internship_patients').select('*').eq('internship_id', internship_id).eq('is_followed', true).limit(20)
      patients = data || []
    }
    // Para cada doente, vai buscar último followup
    for (const p of patients) {
      const { data: f } = await db.from('patient_followups').select('*').eq('internship_patient_id', p.id).order('followup_date', { ascending: false }).limit(1)
      p._last_fup = f?.[0]
    }
    try {
      const { text } = await aiComplete([
        {
          role: 'system',
          content: `És clínico sénior. Vais gerar uma passagem de turno SBAR em markdown PT-PT, doente a doente.

Para cada doente, secções: **Situation**, **Background**, **Assessment**, **Recommendation**, com prioridades destacadas (🔴 crítico, 🟡 monitorizar, 🟢 estável).
No fim, **resumo do turno** com:
- Total de doentes seguidos
- Doentes críticos a vigiar
- Tarefas pendentes para próximo turno

PT-PT. Conciso. Para o próximo turno usar imediatamente.`,
        },
        {
          role: 'user',
          content: `Doentes seguidos no turno:\n${patients.map(p => `
${p.initials || '—'} (${p.age || '?'}a ${p.sex || '?'}) — ${p.diagnosis || ''}
Queixa: ${p.chief_complaint || '—'}
Comorbilidades: ${(p.comorbidities || []).join(', ')}
Status: ${p.status}
Última evolução: ${p._last_fup ? `S:${p._last_fup.subjective || ''} O:${p._last_fup.objective || ''} A:${p._last_fup.assessment || ''} P:${p._last_fup.plan || ''}` : 'sem evolução registada'}
`).join('\n---\n')}\n\nGera a passagem de turno SBAR.`,
        },
      ], { maxTokens: 3000, temperature: 0.25 })
      return NextResponse.json({ handover: text, patients: patients.length })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 9) SHIFT COMPANION — chat especializado para a rotação ─────────
  if (body.action === 'shift_question') {
    const { internship_id, question, context } = body
    if (!internship_id || !question) return NextResponse.json({ error: 'internship_id e question obrigatórios' }, { status: 400 })
    const { data: intr } = await db.from('internships').select('*').eq('id', internship_id).single()
    if (!intr) return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    try {
      const { text } = await aiComplete([
        {
          role: 'system',
          content: `És tutor especializado em ${intr.area} ${intr.specialty ? `· ${intr.specialty}` : ''}.
O estudante está agora num turno em ${intr.institution || 'hospital'} ${intr.ward ? `· ${intr.ward}` : ''} e tem uma dúvida prática.

Responde em PT-PT, focado, prático, máximo 200 palavras. Inclui:
- Resposta directa à dúvida
- Acção concreta para o turno
- Como NÃO falhar / armadilhas comuns
- Onde aprofundar (guideline ou capítulo)

Se for uma dúvida clínica grave (anafilaxia, PCR, AVC, hemorragia), dá a abordagem de primeira linha primeiro.`,
        },
        { role: 'user', content: `${context ? `Contexto: ${context}\n\n` : ''}Pergunta: ${question}` },
      ], { maxTokens: 800, temperature: 0.2 })
      return NextResponse.json({ answer: text })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 10) DDx ASSISTANT — diagnóstico diferencial estruturado ──────
  if (body.action === 'ddx_from_symptoms') {
    const { symptoms, demographics, context } = body
    if (!symptoms) return NextResponse.json({ error: 'symptoms obrigatório' }, { status: 400 })
    try {
      const res = await aiJSON<{ ddx: { dx: string; probability: 'alta'|'média'|'baixa'; key_features: string[]; rule_out: string }[]; investigations: string[]; red_flags: string[] }>([
        {
          role: 'system',
          content: `És internista. Constrói diagnóstico diferencial estruturado em PT-PT.
Responde APENAS JSON:
{
  "ddx": [
    { "dx": "diagnóstico", "probability": "alta|média|baixa",
      "key_features": ["sintoma/sinal característico"],
      "rule_out": "como excluir rapidamente" }
  ],
  "investigations": ["próxima investigação prioritária"],
  "red_flags": ["sinal de alarme a vigiar"]
}

Ordena DDx do mais provável para menos. 5-8 hipóteses.`,
        },
        { role: 'user', content: `Sintomas: ${symptoms}\nDemografia: ${demographics || '—'}\nContexto: ${context || '—'}` },
      ], { maxTokens: 1500, temperature: 0.2 })
      return NextResponse.json(res)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── 11) PORTFOLIO EXPORT — gera markdown completo para submissão ──
  if (body.action === 'portfolio_export') {
    const { internship_id } = body
    if (!internship_id) return NextResponse.json({ error: 'internship_id obrigatório' }, { status: 400 })

    const [intRes, objRes, patRes, logRes, procRes, casRes, refRes, evalRes, hourRes] = await Promise.all([
      db.from('internships').select('*').eq('id', internship_id).single(),
      db.from('internship_objectives').select('*').eq('internship_id', internship_id),
      db.from('internship_patients').select('*').eq('internship_id', internship_id),
      db.from('internship_log_entries').select('*').eq('internship_id', internship_id).order('entry_date'),
      db.from('internship_procedures').select('*').eq('internship_id', internship_id).order('performed_at'),
      db.from('case_presentations').select('*').eq('internship_id', internship_id),
      db.from('internship_reflections').select('*').eq('internship_id', internship_id),
      db.from('supervisor_evaluations').select('*').eq('internship_id', internship_id),
      db.from('internship_hours').select('*').eq('internship_id', internship_id).order('hours_date'),
    ])
    if (!intRes.data) return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    const it = intRes.data

    // Constrói markdown
    let md = `# Portefólio de Estágio — ${it.name}\n\n`
    md += `**Área**: ${it.area}${it.specialty ? ` · ${it.specialty}` : ''}\n`
    md += `**Local**: ${it.institution || '—'}${it.ward ? ` · ${it.ward}` : ''}\n`
    md += `**Supervisor**: ${it.supervisor || '—'}\n`
    md += `**Período**: ${it.start_date} a ${it.end_date}\n`
    md += `**Horas**: ${it.hours_done || 0} / ${it.hours_required || 0}\n\n`

    md += `---\n\n## 1. Objectivos\n\n`
    const grouped: Record<string, any[]> = {}
    for (const o of (objRes.data || [])) (grouped[o.category || 'Outros'] ||= []).push(o)
    for (const [cat, items] of Object.entries(grouped)) {
      md += `### ${cat}\n\n`
      for (const o of items) md += `- ${o.status === 'completed' || o.status === 'validated' ? '✅' : '⬜'} **${o.title}** (${o.level}) ${o.required ? '· obrigatório' : ''}\n`
      md += '\n'
    }

    md += `---\n\n## 2. Doentes seguidos (${patRes.data?.length || 0})\n\n`
    for (const p of (patRes.data || [])) {
      md += `### ${p.initials || '—'} · ${p.age || '?'}a · ${p.sex || '?'}\n`
      md += `**Diagnóstico**: ${p.diagnosis || '—'}\n`
      if (p.chief_complaint) md += `**Queixa**: ${p.chief_complaint}\n`
      if (p.learning_points) md += `**Aprendi**: ${p.learning_points}\n`
      md += '\n'
    }

    md += `---\n\n## 3. Procedimentos (${procRes.data?.length || 0})\n\n`
    const procByLevel: Record<string, any[]> = {}
    for (const p of (procRes.data || [])) (procByLevel[p.level] ||= []).push(p)
    for (const [lvl, items] of Object.entries(procByLevel)) {
      md += `### ${lvl} (${items.length})\n\n`
      for (const p of items) md += `- ${p.procedure_name}${p.performed_at ? ` — ${new Date(p.performed_at).toLocaleDateString('pt-PT')}` : ''}\n`
      md += '\n'
    }

    md += `---\n\n## 4. Casos clínicos (${casRes.data?.length || 0})\n\n`
    for (const c of (casRes.data || [])) {
      md += `### ${c.title}\n`
      if (c.final_diagnosis) md += `**Diagnóstico**: ${c.final_diagnosis}\n`
      if (c.history) md += `**História**: ${c.history}\n\n`
      if (c.management) md += `**Conduta**: ${c.management}\n\n`
      if (c.discussion) md += `**Discussão**: ${c.discussion}\n\n`
    }

    md += `---\n\n## 5. Diário (${logRes.data?.length || 0} entradas)\n\n`
    for (const l of (logRes.data || [])) {
      md += `### ${l.entry_date}${l.shift ? ` · ${l.shift}` : ''}\n`
      if (l.what_was_done) md += `**Actividades**: ${l.what_was_done}\n\n`
      if (l.learning) md += `**Aprendi**: ${l.learning}\n\n`
      if (l.difficulties) md += `**Dificuldades**: ${l.difficulties}\n\n`
    }

    md += `---\n\n## 6. Reflexões (${refRes.data?.length || 0})\n\n`
    for (const r of (refRes.data || [])) {
      md += `### ${new Date(r.created_at).toLocaleDateString('pt-PT')} (${r.framework})\n\n`
      if (r.free_text) md += `${r.free_text}\n\n`
      else if (r.description) {
        md += `**Descrição**: ${r.description}\n\n`
        if (r.feelings) md += `**Sentimentos**: ${r.feelings}\n\n`
        if (r.evaluation) md += `**Avaliação**: ${r.evaluation}\n\n`
        if (r.analysis) md += `**Análise**: ${r.analysis}\n\n`
        if (r.conclusion) md += `**Conclusão**: ${r.conclusion}\n\n`
        if (r.action_plan) md += `**Plano de acção**: ${r.action_plan}\n\n`
      }
    }

    md += `---\n\n## 7. Avaliações (${evalRes.data?.length || 0})\n\n`
    for (const e of (evalRes.data || [])) {
      md += `### ${e.evaluator_name || '—'} (${e.kind}) · ${e.evaluation_date || '—'}\n`
      if (e.overall_score) md += `**Pontuação global**: ${e.overall_score}/5\n`
      if (e.strengths) md += `**Pontos fortes**: ${e.strengths}\n\n`
      if (e.improvements) md += `**A melhorar**: ${e.improvements}\n\n`
    }

    md += `---\n\n## 8. Horas (${hourRes.data?.length || 0} registos)\n\n`
    const totalHours = (hourRes.data || []).reduce((s: number, h: any) => s + Number(h.hours || 0), 0)
    md += `**Total**: ${totalHours.toFixed(1)} horas\n\n`
    for (const h of (hourRes.data || [])) {
      md += `- ${h.hours_date}: ${h.hours}h${h.activity ? ` · ${h.activity}` : ''}\n`
    }

    return NextResponse.json({ markdown: md, filename: `portfolio-${it.name.replace(/\s+/g, '-').toLowerCase()}.md` })
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
