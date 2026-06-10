// app/api/study/documents/route.ts
// RAG pessoal (Pro). O utilizador carrega documentos; a IA responde com base neles.
//   GET                     → lista documentos
//   POST {action:'ingest'}  → recebe texto extraído → parte em chunks → grava
//   POST {action:'ask'}     → pergunta → recupera trechos → responde com citações
//   DELETE ?id=             → apaga documento (e chunks por cascade)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse, isPlanSufficient } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

// Parte texto em chunks de ~900 chars respeitando parágrafos.
function chunkText(text: string, size = 900): string[] {
  const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  const paras = clean.split(/\n\n+/)
  const chunks: string[] = []
  let cur = ''
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > size && cur) { chunks.push(cur.trim()); cur = p }
    else cur = cur ? cur + '\n\n' + p : p
  }
  if (cur.trim()) chunks.push(cur.trim())
  // chunks demasiado grandes (um parágrafo enorme) → corta à força
  return chunks.flatMap(c => c.length <= size * 1.5 ? [c] : c.match(new RegExp(`.{1,${size}}`, 'gs')) || [c]).slice(0, 200)
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db.from('user_documents').select('*').order('created_at', { ascending: false })
  if (error && /does not exist/i.test(error.message)) return NextResponse.json({ documents: [], needs_migration: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data || [] })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const db = sb(req)
  await db.from('user_documents').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPlanSufficient(plan, 'pro')) return planGateResponse('pro', 'Os meus documentos (RAG)')

  const body = await req.json().catch(() => null) as any
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })
  const db = sb(req)

  // ── Ingerir documento (texto já extraído no cliente) ──
  if (body.action === 'ingest') {
    const text = String(body.text || '').trim()
    const title = String(body.title || 'Documento').slice(0, 200)
    if (text.length < 20) return NextResponse.json({ error: 'Texto demasiado curto ou vazio.' }, { status: 400 })

    const { data: doc, error: de } = await db.from('user_documents')
      .insert({ user_id: userId, title, kind: body.kind || 'pdf', domain: body.domain || null, char_count: text.length })
      .select().single()
    if (de) return NextResponse.json({ error: de.message }, { status: 500 })

    const chunks = chunkText(text)
    const rows = chunks.map((content, idx) => ({ user_id: userId, document_id: doc.id, idx, content }))
    // Insert em lotes de 50
    for (let i = 0; i < rows.length; i += 50) {
      const { error: ce } = await db.from('document_chunks').insert(rows.slice(i, i + 50))
      if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })
    }
    await db.from('user_documents').update({ chunk_count: chunks.length }).eq('id', doc.id)
    return NextResponse.json({ document: { ...doc, chunk_count: chunks.length } })
  }

  // ── Perguntar ao material do utilizador ──
  if (body.action === 'ask') {
    const question = String(body.question || '').trim()
    if (!question) return NextResponse.json({ error: 'question obrigatória' }, { status: 400 })
    const { data: hits, error } = await db.rpc('search_my_documents', { p_query: question, p_limit: 6 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!hits || hits.length === 0) {
      return NextResponse.json({ answer: 'Não encontrei nada sobre isso nos teus documentos. Tenta reformular ou carrega o material relevante.', sources: [] })
    }
    const context = (hits as any[]).map((h, i) => `[${i + 1}] (${h.doc_title})\n${h.content}`).join('\n\n---\n\n')
    try {
      const { text } = await aiComplete([
        {
          role: 'system',
          content: `Responde à pergunta do estudante EXCLUSIVAMENTE com base nos excertos dos documentos DELE, em PT-PT.
- Cita as fontes com [1], [2]… quando usas a informação.
- Se os excertos não cobrem a pergunta, di-lo claramente — NÃO inventes.
- Resposta clara e estruturada.

Excertos do material do utilizador:
${context}`,
        },
        { role: 'user', content: question },
      ], { maxTokens: 1000, temperature: 0.2 })
      const sources = (hits as any[]).map((h, i) => ({ n: i + 1, title: h.doc_title, snippet: String(h.content).slice(0, 160) }))
      return NextResponse.json({ answer: text, sources })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Resumir um documento (funcionalidade vinda do /biblioteca) ──
  if (body.action === 'summarize') {
    if (!body.document_id) return NextResponse.json({ error: 'document_id obrigatório' }, { status: 400 })
    const { data: chunks } = await db.from('document_chunks').select('content').eq('document_id', body.document_id).order('idx').limit(60)
    const txt = (chunks || []).map((c: any) => c.content).join('\n').slice(0, 12000)
    if (!txt) return NextResponse.json({ error: 'Documento vazio.' }, { status: 400 })
    try {
      const { text } = await aiComplete([
        { role: 'system', content: 'Resume este material de estudo de saúde em PT-PT, markdown. Secções claras (## ), pontos-chave em bullets, **negrito** nos termos essenciais. Fiel ao conteúdo, sem inventar. 300-600 palavras.' },
        { role: 'user', content: txt },
      ], { maxTokens: 1800, temperature: 0.2 })
      return NextResponse.json({ summary: text })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Gerar flashcards de um documento (funcionalidade do /biblioteca) ──
  if (body.action === 'flashcards') {
    if (!body.document_id) return NextResponse.json({ error: 'document_id obrigatório' }, { status: 400 })
    const { data: chunks } = await db.from('document_chunks').select('content').eq('document_id', body.document_id).order('idx').limit(60)
    const txt = (chunks || []).map((c: any) => c.content).join('\n').slice(0, 12000)
    if (!txt) return NextResponse.json({ error: 'Documento vazio.' }, { status: 400 })
    try {
      const { aiJSON } = await import('@/lib/ai')
      const res = await aiJSON<{ flashcards: { front: string; back: string }[] }>([
        { role: 'system', content: 'Cria flashcards de revisão espaçada a partir deste material, em PT-PT. 8-15 cartões, cada um testa UMA ideia. Responde APENAS JSON: { "flashcards": [{ "front": "...", "back": "..." }] }' },
        { role: 'user', content: txt },
      ], { maxTokens: 2200, temperature: 0.2 })
      return NextResponse.json({ flashcards: res?.flashcards || [] })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
