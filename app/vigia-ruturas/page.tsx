'use client'

// /vigia-ruturas — cruza a medicação dos UTENTES com a Lista de Notificação
// Prévia do INFARMED (uma tabela Excel publicada oficialmente, ingerida em
// lib/shortageIngest.ts — não OCR, não scraping ao vivo).
//
// ── REFEITA 2026-10-12, a pedido do Fernando ───────────────────────────────
// Lia a `personal_meds`: a medicação de quem tinha a sessão aberta, mais a
// dos familiares que essa pessoa acompanha. Numa casa, é exactamente a lista
// que não interessa — ninguém abre isto para saber se o próprio Ozempic está
// em rutura; abre para saber qual dos utentes vai ficar sem o dele.
//
// E a FORMA também mudou. Estava agrupada por pessoa, o que obrigava a
// percorrer dezoito listas para encontrar as ruturas. Agora agrupa pelo
// MEDICAMENTO em rutura, com quem o toma por baixo: é essa a pergunta que
// faz alguém abrir a página, e é essa a encomenda que vai ter de fazer.
//
// A 2ª secção — recolhas de lote e alertas de segurança do INFARMED
// (lib/recallIngest.ts) — fica, pela mesma razão de sempre: é a mesma
// pergunta («a medicação desta casa está nas listas oficiais?»).

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

interface MatchResult {
  medication: string
  match: 'exato' | 'parcial' | null
  matched_name: string | null
  source_document: string | null
  quem?: string | null
  patient_id?: string | null
}
interface RecallMatch { medication: string; url: string; title: string; notice_date: string | null }

/** Uma rutura, com todas as pessoas que tomam esse medicamento. */
interface Rutura {
  medicamento: string
  match: 'exato' | 'parcial'
  naLista: string | null
  documento: string | null
  pessoas: { nome: string; id: string | null }[]
}

export default function VigiaRuturasPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const largo = useLargo()

  const [resultados, setResultados] = useState<MatchResult[]>([])
  const [recalls, setRecalls] = useState<RecallMatch[]>([])
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

      const r = await fetch('/api/shortage-watch?ambito=utentes', { headers }).then(x => x.json())
      if (r.error) throw new Error(r.error)
      setSyncInfo(r.list_status)
      setResultados(r.results || [])

      const rc = await fetch('/api/recall-watch?ambito=utentes', { headers })
        .then(x => x.json()).catch(() => null)
      setRecalls(rc?.matches || [])
    } catch (e: any) {
      setErr(e.message || 'Não foi possível verificar as ruturas.')
    } finally { setLoading(false) }
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  /* Agrupar pelo MEDICAMENTO, não pela pessoa.
     O mesmo medicamento em rutura tomado por quatro pessoas é UMA encomenda a
     resolver, não quatro linhas em quatro listas diferentes. */
  const ruturas = useMemo<Rutura[]>(() => {
    const por = new Map<string, Rutura>()
    for (const r of resultados) {
      if (!r.match) continue
      const chave = `${r.match}|${r.medication.toLowerCase()}`
      if (!por.has(chave)) {
        por.set(chave, {
          medicamento: r.medication, match: r.match,
          naLista: r.matched_name, documento: r.source_document, pessoas: [],
        })
      }
      const g = por.get(chave)!
      if (r.quem && !g.pessoas.some(p => p.nome === r.quem)) {
        g.pessoas.push({ nome: r.quem, id: r.patient_id ?? null })
      }
    }
    // As confirmadas primeiro, e dentro de cada grupo as que afetam mais gente.
    return [...por.values()].sort((a, b) =>
      (a.match === b.match ? 0 : a.match === 'exato' ? -1 : 1)
      || b.pessoas.length - a.pessoas.length)
  }, [resultados])

  const comRutura = ruturas.filter(r => r.match === 'exato')
  const aConfirmar = ruturas.filter(r => r.match === 'parcial')
  const pessoasAfetadas = new Set(
    ruturas.flatMap(r => r.pessoas.map(p => p.nome))).size

  if (!user) return (
    <Mesa altura="documento">
      <Painel>
        <Vazio titulo="É preciso ter sessão iniciada."
          acao={<Link href="/login" style={{ textDecoration: 'none' }}><Botao feitio="principal">INICIAR SESSÃO</Botao></Link>} />
      </Painel>
    </Mesa>
  )

  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Ruturas</span>

          {!loading && (
            <>
              <span style={{
                ...MONO, fontWeight: 'var(--peso-forte)' as any,
                color: comRutura.length ? 'var(--red)' : 'var(--green)',
              }}>
                {comRutura.length} {comRutura.length === 1 ? 'EM RUTURA' : 'EM RUTURA'}
              </span>
              {aConfirmar.length > 0 && (
                <span style={{ ...MONO, color: 'var(--amber)' }}>{aConfirmar.length} POR CONFIRMAR</span>
              )}
              {pessoasAfetadas > 0 && (
                <span style={{ ...MONO, color: 'var(--ink-4)' }}>
                  {pessoasAfetadas} {pessoasAfetadas === 1 ? cfg.personNoun.toUpperCase() : cfg.personNounPlural.toUpperCase()}
                </span>
              )}
            </>
          )}

          <span style={{ marginLeft: largo ? 'auto' : undefined }}>
            <Botao onClick={load} esperando={loading}>VERIFICAR AGORA</Botao>
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--red)' }}>Consta na lista do INFARMED</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>Parece corresponder — confirmar</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            {syncInfo?.last_synced_at
              ? `Lista de ${new Date(syncInfo.last_synced_at).toLocaleDateString('pt-PT')} · ${syncInfo.source_document || 'INFARMED'}`
              : 'Lista ainda por sincronizar'}
          </span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Confirme sempre na farmácia antes de mudar alguma coisa
          </span>
        </BarraDeEstado>
      }
    >
      {err && <Aviso tom="mau">{err}</Aviso>}

      {loading ? (
        <Painel><ACarregar oQue="A cruzar a medicação da casa com a lista do INFARMED…" /></Painel>
      ) : ruturas.length === 0 ? (
        <Painel>
          <Vazio
            titulo={resultados.length === 0
              ? `Ainda não há medicação registada nas fichas d${cfg.personNounPlural.toLowerCase().startsWith('u') ? 'os' : 'os'} ${cfg.personNounPlural.toLowerCase()}.`
              : 'Nenhum medicamento da casa consta da última lista do INFARMED.'}
            oQueFazer={resultados.length === 0
              ? 'Assim que houver medicação nas fichas, esta página passa a cruzá-la com a lista.'
              : `Foram verificados ${resultados.length} medicamentos. Volte a abrir quando o INFARMED publicar uma lista nova.`} />
        </Painel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ruturas.map((r, i) => (
            <Painel key={i}>
              <div style={{
                padding: '10px 13px',
                borderLeft: `3px solid ${r.match === 'exato' ? 'var(--red)' : 'var(--amber)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', marginBottom: 5 }}>
                  <span style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>
                    {r.medicamento}
                  </span>
                  <Codigo texto={r.match === 'exato' ? 'EM RUTURA' : 'POR CONFIRMAR'}
                    cor={r.match === 'exato' ? 'var(--red)' : 'var(--amber)'} />
                  <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                    {r.pessoas.length} {r.pessoas.length === 1 ? 'PESSOA' : 'PESSOAS'}
                  </span>
                </div>

                {r.match === 'parcial' && r.naLista && (
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginBottom: 6, lineHeight: 1.5 }}>
                    Parece corresponder a <b>{r.naLista}</b> na lista. Os nomes não são iguais —
                    confirme antes de contar com a falta.
                  </div>
                )}

                {/* Quem toma. É isto que transforma a lista do INFARMED numa
                    coisa que se pode fazer: a encomenda tem destinatários. */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {r.pessoas.map(p => p.id ? (
                    <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
                      <span style={{
                        ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-2)',
                        border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                        padding: '2px 7px', display: 'inline-block',
                      }}>{p.nome}</span>
                    </Link>
                  ) : (
                    <span key={p.nome} style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{p.nome}</span>
                  ))}
                </div>

                {r.documento && (
                  <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 6 }}>
                    {r.documento}
                  </div>
                )}
              </div>
            </Painel>
          ))}
        </div>
      )}

      {/* ── Recolhas de lote e alertas de segurança ─────────────────────── */}
      {recalls.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Painel cabeca={<Cabecalho>
            <span style={{ flex: 1 }}>Recolhas e alertas de segurança</span>
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>{recalls.length}</span>
          </Cabecalho>}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recalls.map((m, i) => (
                <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'block', padding: '9px 13px', textDecoration: 'none',
                  borderTop: i ? '1px solid var(--border)' : 'none',
                  borderLeft: '3px solid var(--red)',
                }}>
                  <div style={{ ...ROTULO, color: 'var(--red)' }}>{m.medication}</div>
                  <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.45, marginTop: 2 }}>{m.title}</div>
                  {m.notice_date && (
                    <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 3 }}>
                      {m.notice_date} · abrir no site do INFARMED
                    </div>
                  )}
                </a>
              ))}
            </div>
          </Painel>
        </div>
      )}
    </Mesa>
  )
}
