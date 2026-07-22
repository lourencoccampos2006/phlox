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
  const { track_id, new_track_label, new_track_body_area, image, mimeType } = body || {}
  if (!image) return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })

  let trackId = track_id
  if (!trackId) {
    if (!new_track_label) return NextResponse.json({ error: 'Indica um nome para esta lesão a vigiar' }, { status: 400 })
    const { data: newTrack, error } = await supabase.from('skin_lesion_tracks')
      .insert({ user_id: userId, label: new_track_label, body_area: new_track_body_area || null }).select().single()
    if (error || !newTrack) return NextResponse.json({ error: error?.message || 'Erro ao criar track' }, { status: 500 })
    trackId = newTrack.id
  } else {
    const { data: owned } = await supabase.from('skin_lesion_tracks').select('id').eq('id', trackId).eq('user_id', userId).maybeSingle()
    if (!owned) return NextResponse.json({ error: 'Track não encontrada' }, { status: 404 })
  }

  // Foto anterior desta track, para dar contexto de evolução à IA.
  const { data: prevPhoto } = await supabase.from('skin_lesion_photos').select('abcde, taken_at').eq('track_id', trackId).order('taken_at', { ascending: false }).limit(1).maybeSingle()
  const context = prevPhoto
    ? `Foto anterior desta mesma lesão (${new Date(prevPhoto.taken_at).toLocaleDateString('pt-PT')}): ${JSON.stringify(prevPhoto.abcde)}. Compara com a imagem atual e preenche "evolution_note" com o que mudou.`
    : undefined

  // Upload da foto para o Storage (bucket 'skin-lesions').
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

  // Chama o motor de visão partilhado (mesmo endpoint que /scan usa, modo diferente).
  const visionRes = await fetch(new URL('/api/vision', req.nextUrl.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: 'skin_lesion', image, mimeType: mimeType || 'image/jpeg', context }),
  })
  const analysis = await visionRes.json().catch(() => null)
  if (!visionRes.ok || !analysis) {
    return NextResponse.json({ error: analysis?.error || 'Erro na análise de visão' }, { status: 502 })
  }

  const abcde = {
    asymmetry: analysis.asymmetry, border: analysis.border, color: analysis.color,
    diameter_mm: analysis.diameter_estimate_mm, evolution_note: analysis.evolution_note,
    recommendation: analysis.recommendation, confidence: analysis.confidence,
  }
  const riskScore = Math.max(0, Math.min(100, Number(analysis.risk_score) || 0))
  const riskLevel = ['baixo', 'moderado', 'alto'].includes(analysis.risk_level) ? analysis.risk_level : 'baixo'

  const { data: saved, error: saveErr } = await supabase.from('skin_lesion_photos')
    .insert({ track_id: trackId, user_id: userId, photo_url: photoUrl, abcde, risk_score: riskScore, risk_level: riskLevel })
    .select().single()
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({ track_id: trackId, photo: saved, previous: prevPhoto || null })
}
