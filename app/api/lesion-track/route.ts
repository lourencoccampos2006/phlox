import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { makeSupabase, getToken } from '@/lib/orgAuth'

// Rastreio Visual — Pro. Cada foto de uma "track" (lesão/mancha que a pessoa
// decide vigiar) é pontuada por IA de visão nos critérios ABCDE via
// /api/vision (mode: 'skin_lesion'), com o contexto da foto anterior da MESMA
// track para a IA avaliar EVOLUÇÃO real, não só uma foto isolada.

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const supabase = makeSupabase(token)

  const { data: tracks } = await supabase.from('skin_lesion_tracks').select('*').eq('user_id', userId).eq('archived', false).order('created_at', { ascending: false })
  const trackIds = (tracks || []).map((t: any) => t.id)
  const { data: photos } = trackIds.length
    ? await supabase.from('skin_lesion_photos').select('*').in('track_id', trackIds).order('taken_at', { ascending: false })
    : { data: [] }

  return NextResponse.json({ tracks: tracks || [], photos: photos || [] })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 10, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Rastreio Visual')
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const supabase = makeSupabase(token)

  const body = await req.json().catch(() => null)
  const { track_id, new_track_label, new_track_body_area, new_track_mode, new_track_condition_name, image, mimeType } = body || {}
  if (!image) return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })

  let trackId = track_id
  let trackMode: 'screening' | 'condition' = 'screening'
  if (!trackId) {
    if (!new_track_label) return NextResponse.json({ error: 'Indica um nome para esta lesão a vigiar' }, { status: 400 })
    trackMode = new_track_mode === 'condition' ? 'condition' : 'screening'
    const { data: newTrack, error } = await supabase.from('skin_lesion_tracks')
      .insert({ user_id: userId, label: new_track_label, body_area: new_track_body_area || null, mode: trackMode, condition_name: trackMode === 'condition' ? (new_track_condition_name || null) : null })
      .select().single()
    if (error || !newTrack) return NextResponse.json({ error: error?.message || 'Erro ao criar track' }, { status: 500 })
    trackId = newTrack.id
  } else {
    const { data: owned } = await supabase.from('skin_lesion_tracks').select('id, mode').eq('id', trackId).eq('user_id', userId).maybeSingle()
    if (!owned) return NextResponse.json({ error: 'Track não encontrada' }, { status: 404 })
    trackMode = owned.mode === 'condition' ? 'condition' : 'screening'
  }

  // Foto anterior desta track, para dar contexto de evolução à IA. Como só
  // guardamos fotos com leitura válida (ver mais abaixo), isto nunca é uma
  // leitura falhada — bug corrigido 2026-07-22: uma primeira foto desfocada
  // (sem lesão identificada, risco 0) ficava gravada como se fosse "sem
  // lesão", e a foto seguinte (a primeira leitura REAL) era comparada com
  // esse "0" e dava um salto de risco enorme, lido como "evolução brusca"
  // quando não passava da IA não ter conseguido ler a 1ª foto.
  const { data: prevPhoto } = await supabase.from('skin_lesion_photos').select('abcde, taken_at').eq('track_id', trackId).order('taken_at', { ascending: false }).limit(1).maybeSingle()
  const context = prevPhoto
    ? (trackMode === 'condition'
      ? `Foto anterior desta mesma condição (${new Date(prevPhoto.taken_at).toLocaleDateString('pt-PT')}): ${JSON.stringify(prevPhoto.abcde)}. Compara com a imagem atual e preenche "trend_note" com o que mudou.`
      : `Foto anterior desta mesma lesão (${new Date(prevPhoto.taken_at).toLocaleDateString('pt-PT')}): ${JSON.stringify(prevPhoto.abcde)}. Compara com a imagem atual e preenche "evolution_note" com o que mudou.`)
    : undefined

  // Chama o motor de visão partilhado (mesmo endpoint que /scan usa, modo
  // diferente conforme o tipo de vigilância desta track) ANTES de gravar nada
  // — se a foto não for legível, não vale a pena gastar upload nem guardar
  // uma leitura falhada que poluiria a comparação seguinte.
  const visionMode = trackMode === 'condition' ? 'skin_condition_progress' : 'skin_lesion'
  const visionRes = await fetch(new URL('/api/vision', req.nextUrl.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: visionMode, image, mimeType: mimeType || 'image/jpeg', context }),
  })
  const analysis = await visionRes.json().catch(() => null)
  if (!visionRes.ok || !analysis) {
    return NextResponse.json({ error: analysis?.error || 'Erro na análise de visão' }, { status: 502 })
  }
  if (analysis.lesion_detected === false) {
    return NextResponse.json({
      track_id: trackId, photo: null, previous: prevPhoto || null,
      retry: true, message: analysis.recommendation || 'Não foi possível identificar uma lesão de pele nesta imagem — tenta uma foto mais próxima e bem iluminada.',
    })
  }

  // Upload da foto para o Storage (bucket 'skin-lesions') — só depois de saber
  // que a leitura foi válida.
  let photoUrl: string | null = null
  try {
    const ext = (mimeType || 'image/jpeg').split('/')[1] || 'jpg'
    const path = `${userId}/${trackId}/${Date.now()}.${ext}`
    const buffer = Buffer.from(image, 'base64')
    const { error: upErr } = await supabase.storage.from('skin-lesions').upload(path, buffer, { upsert: false, contentType: mimeType || 'image/jpeg' })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('skin-lesions').getPublicUrl(path)
    photoUrl = pub?.publicUrl || null
  } catch (e: any) {
    // A mensagem "cria o bucket" só faz sentido quando o bucket não existe —
    // se já existir mas faltarem as políticas de RLS em storage.objects (o
    // erro mais comum quando o bucket é criado à mão no painel), o Supabase
    // devolve "permission denied"/"not authorized", não "not found". Mostrar
    // sempre a mesma sugestão independentemente da causa real só confundia.
    const msg = String(e?.message || '')
    const bucketMissing = /not found|does not exist/i.test(msg)
    const hint = bucketMissing
      ? ' (cria o bucket "skin-lesions" no Supabase Storage)'
      : ' (o bucket existe mas falta aplicar sprint116_skin_lesions_bucket.sql — políticas de acesso em falta)'
    return NextResponse.json({ error: `Não foi possível guardar a foto: ${msg}${hint}` }, { status: 500 })
  }

  // Modo 'condition': guarda-se no MESMO jsonb (não há colunas novas em
  // skin_lesion_photos), com campos próprios em vez dos ABCDE. risk_score/
  // risk_level continuam preenchidos (mapeados a partir de trend/doctor_flag)
  // só para a badge da lista funcionar igual nos dois modos — não é um "risco
  // de cancro" em modo condição, é só uma indicação visual de gravidade.
  const abcde = trackMode === 'condition'
    ? { description: analysis.description, trend: analysis.trend, trend_note: analysis.trend_note, doctor_flag: !!analysis.doctor_flag, doctor_reason: analysis.doctor_reason, confidence: analysis.confidence }
    : { asymmetry: analysis.asymmetry, border: analysis.border, color: analysis.color, diameter_mm: analysis.diameter_estimate_mm, evolution_note: analysis.evolution_note, recommendation: analysis.recommendation, confidence: analysis.confidence }

  let riskScore: number, riskLevel: string
  if (trackMode === 'condition') {
    if (analysis.doctor_flag) { riskScore = 80; riskLevel = 'alto' }
    else if (analysis.trend === 'a_agravar') { riskScore = 55; riskLevel = 'moderado' }
    else if (analysis.trend === 'estavel') { riskScore = 30; riskLevel = 'baixo' }
    else { riskScore = 10; riskLevel = 'baixo' } // melhoria (ou desconhecido)
  } else {
    riskScore = Math.max(0, Math.min(100, Number(analysis.risk_score) || 0))
    riskLevel = ['baixo', 'moderado', 'alto'].includes(analysis.risk_level) ? analysis.risk_level : 'baixo'
  }

  const { data: saved, error: saveErr } = await supabase.from('skin_lesion_photos')
    .insert({ track_id: trackId, user_id: userId, photo_url: photoUrl, abcde, risk_score: riskScore, risk_level: riskLevel })
    .select().single()
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({ track_id: trackId, photo: saved, previous: prevPhoto || null })
}

// Apaga uma lesão vigiada e as suas fotos — dá uma forma de limpar uma track
// que tenha ficado com leituras erradas (ex: antes da correção 2026-07-22 de
// não gravar leituras falhadas), sem precisar de acesso direto à base de dados.
export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const supabase = makeSupabase(token)

  const trackId = req.nextUrl.searchParams.get('track_id')
  if (!trackId) return NextResponse.json({ error: 'track_id obrigatório' }, { status: 400 })
  const { data: owned } = await supabase.from('skin_lesion_tracks').select('id').eq('id', trackId).eq('user_id', userId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Track não encontrada' }, { status: 404 })

  const { data: photos } = await supabase.from('skin_lesion_photos').select('photo_url').eq('track_id', trackId)
  const paths = (photos || [])
    .map((p: any) => { try { return new URL(p.photo_url).pathname.split('/skin-lesions/')[1] } catch { return null } })
    .filter(Boolean) as string[]
  if (paths.length) await supabase.storage.from('skin-lesions').remove(paths).catch(() => {})

  await supabase.from('skin_lesion_photos').delete().eq('track_id', trackId)
  const { error } = await supabase.from('skin_lesion_tracks').delete().eq('id', trackId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
