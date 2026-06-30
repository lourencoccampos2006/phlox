// app/api/family/documents/route.ts
// Cofre de documentos POR FAMILIAR. O cuidador fotografa um exame/receita/relatório
// de um familiar → a IA (reusa o motor do /scan) identifica e resume → guardamos o
// texto + resumo em family_documents (RLS: dono). Depois o cuidador pode PERGUNTAR
// sobre o documento (resposta usa o texto guardado no prompt — RAG leve, sem embeddings).
//   POST  { profile_id, image, mimeType }            → analisa + guarda → devolve o doc
//   GET   ?profile_id=...                            → lista os documentos do familiar
//   PUT   { document_id, question }                  → responde sobre o documento
//   DELETE{ id }                                     → apaga
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { callGeminiVisionJSON, aiJSON } from '@/lib/ai'

export const maxDuration = 45

function db(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

const NO_TABLE = (msg: string) => /relation .*family_documents.* does not exist|column .*does not exist/i.test(msg || '')

const SCAN_PROMPT = `És um assistente de saúde português. Recebes UMA foto de um documento de saúde de um familiar de quem o utilizador cuida. Identifica o que é e resume de forma útil, PT-PT simples.
Responde APENAS JSON:
{
  "kind": "receita|analise|relatorio|bula|outro|nao_saude",
  "title": "título curto",
  "summary": "resumo claro em 2-6 frases",
  "text": "transcrição do texto relevante do documento (o máximo que conseguires ler)",
  "warning": "alerta se algo precisa de atenção médica (opcional)"
}
NUNCA dês diagnóstico definitivo — orienta para o médico quando apropriado.`

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = db(req)
  const body = await req.json().catch(() => null) as { profile_id?: string; image?: string; mimeType?: string } | null
  if (!body?.image) return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })

  let scan: any
  try {
    scan = await callGeminiVisionJSON<any>(SCAN_PROMPT, body.image, body.mimeType || 'image/jpeg', { maxTokens: 1800 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não consegui ler. Tenta com mais luz e foco.' }, { status: 500 })
  }
  if (!scan?.summary) return NextResponse.json({ error: 'Não consegui interpretar o documento.' }, { status: 422 })

  // Guardamos texto + resumo. Não guardamos a imagem (privacidade/custo) — file_url null.
  const extracted = [scan.text, scan.summary].filter(Boolean).join('\n\n').slice(0, 8000)
  const { data, error } = await supabase.from('family_documents').insert({
    user_id: userId,
    profile_id: body.profile_id || null,
    title: (scan.title || 'Documento').slice(0, 120),
    kind: scan.kind || 'outro',
    extracted_text: extracted,
    summary: (scan.summary || '').slice(0, 1200),
  }).select().single()

  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ error: 'O cofre familiar ainda não está ativo. Aplica supabase/sprint95_caregiver.sql.' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ document: data, warning: scan.warning || null })
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = db(req)
  const profileId = req.nextUrl.searchParams.get('profile_id')
  let q = supabase.from('family_documents').select('id, profile_id, title, kind, summary, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  if (profileId) q = q.eq('profile_id', profileId)
  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ documents: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ documents: data || [] })
}

export async function PUT(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = db(req)
  const { document_id, question } = await req.json().catch(() => ({})) as { document_id?: string; question?: string }
  if (!document_id || !question?.trim()) return NextResponse.json({ error: 'Documento e pergunta obrigatórios' }, { status: 400 })

  const { data: doc, error } = await supabase.from('family_documents').select('title, kind, extracted_text, summary').eq('id', document_id).eq('user_id', userId).single()
  if (error || !doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })

  try {
    const res = await aiJSON<{ answer: string }>([
      { role: 'system', content: `És um assistente de saúde português. Responde à pergunta do cuidador SÓ com base no documento abaixo. Se a resposta não estiver no documento, di-lo honestamente. PT-PT, linguagem simples. NUNCA dês diagnóstico definitivo. Responde JSON: { "answer": "..." }` },
      { role: 'user', content: `DOCUMENTO (${doc.kind}): ${doc.title}\n${doc.extracted_text || doc.summary}\n\nPERGUNTA: ${question.slice(0, 400)}` },
    ], { maxTokens: 700, temperature: 0.2 })
    return NextResponse.json({ answer: res?.answer || 'Não consegui responder com base neste documento.' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao responder.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = db(req)
  const { id } = await req.json().catch(() => ({})) as { id?: string }
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })
  await supabase.from('family_documents').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
