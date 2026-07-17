'use client'

// /vigia-ruturas — Vigia de Ruturas (Pro). Cruza a tua medicação (e a dos
// familiares que acompanhas) com a Lista de Notificação Prévia do INFARMED —
// dados reais, uma tabela Excel publicada oficialmente, não OCR nem scraping
// ao vivo. Atualizado a cada trimestre (ver lib/shortageIngest.ts).
// MELHORIA 2026-07-17 (item B11): ganhou uma 2ª secção — Vigia de Recalls,
// que cruza a mesma medicação com os alertas de qualidade/segurança do
// INFARMED (recolhas de lote). Dobrado nesta página em vez de criar uma nova
// por serem a mesma pergunta ("a minha medicação está nas listas oficiais do
// INFARMED?"). Ver lib/recallIngest.ts para porque o matching é só por título
// (menciona), nunca por nº de lote (não é um dado estruturado e fiável).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d9488'

interface MatchResult { medication: string; match: 'exato' | 'parcial' | null; matched_name: string | null; source_document: string | null }
interface Group { label: string; profileId: string | null; results: MatchResult[] }
interface RecallMatch { medication: string; url: string; title: string; notice_date: string | null }
interface RecallGroup { label: string; profileId: string | null; matches: RecallMatch[] }

export default function VigiaRuturasPage() {
  const { user, supabase } = useAuth() as any
  const [groups, setGroups] = useState<Group[]>([])
  const [recallGroups, setRecallGroups] = useState<RecallGroup[]>([])
  const [syncInfo, setSyncInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token || ''
      const headers = { Authorization: `Bearer ${token}` }

      const { data: familyProfiles } = await supabase.from('family_profiles').select('id, name').eq('user_id', user.id)

      const selfRes = await fetch('/api/shortage-watch', { headers }).then(r => r.json())
      if (selfRes.error) throw new Error(selfRes.error)
      setSyncInfo(selfRes.list_status)

      const newGroups: Group[] = [{ label: 'A minha medicação', profileId: null, results: selfRes.results || [] }]
      const selfRecall = await fetch('/api/recall-watch', { headers }).then(r => r.json()).catch(() => null)
      const newRecallGroups: RecallGroup[] = [{ label: 'A minha medicação', profileId: null, matches: selfRecall?.matches || [] }]

      for (const fp of (familyProfiles || [])) {
        const r = await fetch(`/api/shortage-watch?profile_id=${fp.id}`, { headers }).then(res => res.json())
        if (!r.error) newGroups.push({ label: fp.name, profileId: fp.id, results: r.results || [] })
        const rc = await fetch(`/api/recall-watch?profile_id=${fp.id}`, { headers }).then(res => res.json()).catch(() => null)
        newRecallGroups.push({ label: fp.name, profileId: fp.id, matches: rc?.matches || [] })
      }

      setGroups(newGroups)
      setRecallGroups(newRecallGroups)
    } catch (e: any) { setErr(e.message || 'Erro ao verificar ruturas.') }
    finally { setLoading(false) }
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #0f766e)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Pro · Vigia automático</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Vigia de Ruturas</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>Cruzamos a tua medicação com a Lista de Notificação Prévia do INFARMED — dados oficiais, não uma estimativa.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        {err && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{err}</div>}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />)}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {groups.map(g => (
              <div key={g.profileId || 'self'}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 10 }}>{g.label}</div>
                {g.results.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Sem medicação registada.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {g.results.map((r, i) => (
                      <div key={i} style={{
                        background: r.match === 'exato' ? '#fffbeb' : r.match === 'parcial' ? '#fefce8' : '#f0fdf4',
                        border: `1px solid ${r.match === 'exato' ? '#fde68a' : r.match === 'parcial' ? '#fef08a' : '#bbf7d0'}`,
                        borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ fontSize: 16 }}>{r.match === 'exato' ? '⚠️' : r.match === 'parcial' ? '❓' : '✅'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{r.medication}</div>
                          {r.match === 'exato' && <div style={{ fontSize: 12, color: '#92400e' }}>Consta na Lista de Notificação Prévia do INFARMED ({r.source_document}) — pode haver dificuldade de abastecimento. Fala com a tua farmácia.</div>}
                          {r.match === 'parcial' && <div style={{ fontSize: 12, color: '#854d0e' }}>Parece corresponder a "{r.matched_name}" na lista do INFARMED — confirma o nome exato na farmácia.</div>}
                          {!r.match && <div style={{ fontSize: 12, color: '#15803d' }}>Sem sinais de rutura na última publicação do INFARMED.</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.6, marginTop: 8 }}>
              {syncInfo?.last_synced_at
                ? `Lista atualizada em ${new Date(syncInfo.last_synced_at).toLocaleDateString('pt-PT')} · fonte: ${syncInfo.source_document || 'INFARMED'}.`
                : 'Lista ainda não sincronizada.'}
              {' '}Esta lista reflete o que o INFARMED publica oficialmente — não substitui confirmar na farmácia.
            </div>

            {/* Vigia de Recalls (item B11) — recolhas de lote e alertas de
                segurança, separado das ruturas por serem listas diferentes. */}
            {recallGroups.some(g => g.matches.length > 0) && (
              <div style={{ borderTop: '1px solid var(--bg-3)', paddingTop: 18, marginTop: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', marginBottom: 4 }}>🚨 Alertas de qualidade/segurança que mencionam a tua medicação</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>Recolhas de lote e alertas de segurança recentes do INFARMED — confirma sempre o nº de lote na notícia oficial, não aqui.</div>
                {recallGroups.filter(g => g.matches.length > 0).map(g => (
                  <div key={g.profileId || 'self-recall'} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0b1120', marginBottom: 8 }}>{g.label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {g.matches.map((m, i) => (
                        <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '11px 14px', textDecoration: 'none' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 2 }}>{m.medication}</div>
                          <div style={{ fontSize: 13, color: '#7c2d12', lineHeight: 1.4 }}>{m.title}</div>
                          {m.notice_date && <div style={{ fontSize: 11, color: '#9a3412', marginTop: 3 }}>{m.notice_date} · Ver notícia oficial →</div>}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
