'use client'

// /familia — ÍNDICE da família. REESCRITO 2026-08-10 (2ª volta, pedido do
// Fernando): a 1ª reescrita (2026-08-09) ainda tinha o cartão de cada pessoa
// a fazer TUDO — ações, ferramentas Pro, o diário institucional inteiro —
// ficando as duas páginas "dependentes uma da outra". Esta versão faz só UMA
// coisa: listar quem acompanha, o estado de cada um num relance, e levar para
// /perfil/[id] — que passa a ser a ÚNICA página com o detalhe completo (para
// perfis ligados a uma instituição E para perfis pessoais). Nenhum atalho,
// nenhuma ferramenta, nenhuma ficha vive aqui dentro — só a lista + adicionar.
//
// "+ Adicionar familiar" abre agora DOIS caminhos (pedido desde o início,
// nunca construído): preencher à mão (perfil pessoal, como sempre foi) OU
// "Já está num lar ou centro de dia" — o perfil nasce a partir do código da
// instituição, com o nome real do residente, sem a família escrever nada.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { analyzeFamilyMember, WATCH_LEVEL_META } from '@/lib/caregiverWatch'
import { carregarEntradaCuidador, sinaisLongitudinais, adesaoEm, type EntradaCuidador } from '@/lib/caregiverSentinel'
import LinhaDoTempo, { type EventoLinha } from '@/components/cuidador/LinhaDoTempo'
import { ptDate } from '@/lib/ptTime'
import PushNudge from '@/components/PushNudge'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

interface Profile { id: string; name: string; relation?: string; age?: number; sex?: string; weight?: number; conditions?: string; allergies?: string }
interface Med { id: string; profile_id: string; name: string; pills_remaining?: number; pills_per_day?: number }
interface Vital { profile_id: string; recorded_at: string; bp_sys?: number; bp_dia?: number; hr?: number; spo2?: number; weight?: number; glucose?: number; temp?: number }
interface Sym { profile_id: string; at: string; pain?: number; temperature?: number; symptoms?: string[] }
interface LinkInfo { code: string; verify_digits: string; patient_name: string }

const ACCENT = 'var(--amber)'
const RELATION_OPTIONS = ['Pai', 'Mãe', 'Filho', 'Filha', 'Cônjuge', 'Parceiro/a', 'Avô', 'Avó', 'Irmão', 'Irmã', 'Outro']
const initials = (n: string) => n.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase()
const SEV: Record<string, { c: string; b: string; bd: string }> = {
  critical: { c: 'var(--red)', b: 'var(--badge-red-bg)', bd: 'var(--badge-red-border)' },
  major: { c: 'var(--red)', b: 'var(--badge-red-bg)', bd: 'var(--badge-red-border)' },
}

export default function FamiliaPage() {
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [meds, setMeds] = useState<Med[]>([])
  const [vitals, setVitals] = useState<Vital[]>([])
  const [syms, setSyms] = useState<Sym[]>([])
  const [links, setLinks] = useState<Record<string, LinkInfo>>({})
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [chooserOpen, setChooserOpen] = useState(false)

  const familyLimit = (user?.plan === 'pro' || user?.plan === 'clinic') ? Infinity : 1

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!user?.id) return
    const { data: p } = await supabase.from('family_profiles')
      .select('id,name,relation,age,sex,weight,conditions,allergies').eq('user_id', user.id).order('name')
    const list = (p || []) as Profile[]
    setProfiles(list)
    if (list.length) {
      const ids = list.map(x => x.id)
      const since = new Date(Date.now() - 90 * 86400000).toISOString()
      const [m, v, s] = await Promise.all([
        supabase.from('family_profile_meds').select('id,profile_id,name,pills_remaining,pills_per_day').in('profile_id', ids),
        supabase.from('vitals').select('profile_id,recorded_at,bp_sys,bp_dia,hr,spo2,weight,glucose,temp').in('profile_id', ids).gte('recorded_at', since),
        supabase.from('symptom_logs').select('profile_id,at,pain,temperature,symptoms').in('profile_id', ids).gte('at', since).then((r: any) => r, () => ({ data: [] })),
      ])
      setMeds((m.data || []) as Med[])
      setVitals((v.data || []) as Vital[])
      setSyms((s.data || []) as Sym[])
    }
    setLoading(false)
  }, [user, supabase])

  const loadLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/family-link', { headers: await authHeaders() })
      const d = await res.json()
      if (res.ok && Array.isArray(d.links)) {
        const map: Record<string, LinkInfo> = {}
        d.links.forEach((l: any) => { map[l.family_profile_id] = { code: l.code, verify_digits: l.verify_digits, patient_name: l.patient_name } })
        setLinks(map)
      }
    } catch { /* offline */ }
  }, [authHeaders])

  useEffect(() => { load(); loadLinks() }, [load, loadLinks])

  /* ESTES DOIS ESTAVAM DEPOIS DO `if (!user) return` — 2026-10-08.
     Quando o `user` ainda não tinha chegado, a página saía antes e estes dois
     `useState` não corriam; quando chegava, corriam. O React conta os hooks
     pela ORDEM, e viu a ordem mudar entre dois renders:

         React has detected a change in the order of Hooks called by FamiliaPage

     Não é um aviso de estilo: a partir do ponto onde a ordem diverge, o React
     entrega a CADA hook o estado que pertencia a outro. Subiram para cima do
     return, que é onde todos os hooks têm de estar. */
  // ── A leitura longitudinal ───────────────────────────────────────────────
  // O analyzeFamilyMember lê o INSTANTE (medicação atual, última tensão). Isto
  // lê as SEMANAS: adesão real, silêncio, e o que está a piorar face ao
  // próprio hábito da pessoa. Ver lib/caregiverSentinel.
  const [longit, setLongit] = useState<Record<string, { sinais: any[]; entrada: EntradaCuidador }>>({})
  const [aberto, setAberto] = useState<string | null>(null)

  /* E este também — era o terceiro hook depois do return. Já tem a sua
     própria guarda `if (!user || !profiles.length) return` lá dentro, que é
     onde essa verificação pertence: o hook corre sempre, o TRABALHO é que
     só acontece quando há dados. */
  useEffect(() => {
    if (!user || !profiles.length) return
    let vivo = true
    const hoje = ptDate()
    ;(async () => {
      const out: Record<string, { sinais: any[]; entrada: EntradaCuidador }> = {}
      for (const p of profiles) {
        if (links[p.id]) continue   // ligado a uma instituição: quem regista é o lar
        try {
          const entrada = await carregarEntradaCuidador(supabase, p.id, hoje)
          out[p.id] = { entrada, sinais: sinaisLongitudinais(entrada, p.name, p.id, hoje) }
        } catch { /* sem dados, sem sinais */ }
      }
      if (vivo) setLongit(out)
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, profiles.length, Object.keys(links).length])

  if (!user) return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Família</span>
        </BarraDeTrabalho>
      }
    >
      <div style={{ textAlign: 'center' }}><Link href="/login" style={{ color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>Iniciar sessão →</Link></div>
    </Mesa>
  )


  /** Tudo o que ficou registado sobre uma pessoa, por dia. */
  function eventosDe(perfilId: string): EventoLinha[] {
    const e = longit[perfilId]?.entrada
    if (!e) return []
    const nomeMed = new Map(e.meds.map(m => [m.id, m.name]))
    const ev: EventoLinha[] = []
    const DADA = new Set(['taken', 'given', 'administered'])
    // Doses agrupadas por dia: "3 tomas marcadas" diz mais do que três linhas.
    const porDia = new Map<string, { dadas: number; falhadas: string[] }>()
    e.doses.forEach(d => {
      const k = String(d.date).slice(0, 10)
      if (!porDia.has(k)) porDia.set(k, { dadas: 0, falhadas: [] })
      if (DADA.has(d.status)) porDia.get(k)!.dadas++
      else porDia.get(k)!.falhadas.push(nomeMed.get(d.med_id) || 'medicamento')
    })
    porDia.forEach((v, k) => {
      if (v.dadas) ev.push({ data: k, tipo: 'dose', texto: `${v.dadas} ${v.dadas === 1 ? 'toma marcada' : 'tomas marcadas'}` })
      if (v.falhadas.length) ev.push({ data: k, tipo: 'dose', alerta: true,
        texto: `${v.falhadas.length} ${v.falhadas.length === 1 ? 'dose não tomada' : 'doses não tomadas'}`,
        detalhe: [...new Set(v.falhadas)].slice(0, 3).join(', ') })
    })
    e.vitals.forEach(v => {
      if (v.weight != null) ev.push({ data: String(v.recorded_at).slice(0, 10), tipo: 'vital', texto: `Peso: ${v.weight} kg` })
    })
    e.sintomas.forEach(sy => {
      const d = String((sy as any).at || (sy as any).created_at || '').slice(0, 10)
      // `pain`, não `severity`: essa coluna não existe em symptom_logs, por isso
      // o alerta era sempre falso. Ver scripts/check-colunas.mjs.
      if (d) ev.push({ data: d, tipo: 'sintoma', alerta: Number((sy as any).pain) >= 7, texto: 'Queixa registada' })
    })
    return ev
  }

  const watched = profiles.map(p => {
    const linked = !!links[p.id]
    if (linked) return { p, level: 'linked' as const, signals: [] as any[] }
    const result = analyzeFamilyMember({
      age: p.age, sex: p.sex, weight: p.weight, conditions: p.conditions, allergies: p.allergies,
      meds: meds.filter(m => m.profile_id === p.id),
      vitals: vitals.filter(v => v.profile_id === p.id),
      symptoms: syms.filter(s => s.profile_id === p.id),
    })
    // Os dois motores respondem a perguntas diferentes sobre a mesma pessoa;
    // quem lê não tem de saber de onde veio cada sinal.
    const extra = longit[p.id]?.sinais || []
    if (extra.length) result.signals = [...extra, ...result.signals]
    return { p, level: result.level, signals: result.signals }
  })

  const attention = watched.flatMap(({ p, signals }) =>
    signals.filter((s: any) => s.severity === 'critical' || s.severity === 'major').map((s: any) => ({ p, s, key: `${p.id}:${s.kind}` }))
  ).filter(x => !dismissed.has(x.key)).sort((a, b) => (a.s.severity === 'critical' ? 0 : 1) - (b.s.severity === 'critical' ? 0 : 1))

  return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Família</span>
        </BarraDeTrabalho>
      }
    >
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px clamp(14px,4vw,28px) 80px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 'var(--peso-forte)' as any, marginBottom: 6 }}>Cuidar</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,5vw,34px)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>A sua família</h1>
        <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', margin: '0 0 20px', lineHeight: 1.5 }}>Quem acompanha, e o que precisa de si — o resto vive no perfil de cada um.</p>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 'var(--r-xl)' }} />)}</div>
        ) : profiles.length === 0 && !chooserOpen ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--t-numero)', marginBottom: 14 }}>👨‍👩‍👧</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink)', marginBottom: 8 }}>De quem está a cuidar?</div>
            <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', marginBottom: 22, lineHeight: 1.6, maxWidth: 380, margin: '0 auto 22px' }}>Crie um espaço para o pai, a mãe, um filho — ou ligue-se ao lar/centro de dia se já lá estiverem, com o código que a instituição lhe dá.</div>
            <button onClick={() => setChooserOpen(true)} style={{ display: 'inline-block', padding: '14px 26px', background: ACCENT, color: 'white', borderRadius: 'var(--r-xl)', fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, border: 'none', cursor: 'pointer' }}>+ Adicionar a primeira pessoa</button>
          </div>
        ) : (
          <>
            <PushNudge text="Ativa notificações para saberes logo quando alguém da tua família precisar de atenção." />

            {attention.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Precisa de atenção hoje</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attention.map(({ p, s, key }) => {
                    const sv = SEV[s.severity]
                    return (
                      <div key={key} style={{ background: sv.b, border: `1px solid ${sv.bd}`, borderRadius: 'var(--r-xl)', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'white', border: `1px solid ${sv.bd}`, color: sv.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, flexShrink: 0 }}>{initials(p.name)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{p.name.split(' ')[0]} · {s.title}</div>
                            <div style={{ fontSize: 'var(--t-dado)', color: sv.c, lineHeight: 1.5, marginTop: 2 }}>{s.detail}</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                              <Link href={`/perfil/${p.id}`} style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'white', background: sv.c, borderRadius: 'var(--r-md)', padding: '7px 13px', textDecoration: 'none' }}>Abrir perfil →</Link>
                              <button onClick={() => setDismissed(d => new Set(d).add(key))} style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer' }}>Dispensar</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {watched.map(({ p, level }) => {
                const linked = level === 'linked'
                const meta = !linked ? WATCH_LEVEL_META[level as Exclude<typeof level, 'linked'>] : null
                return (
                  <div key={p.id}>
                  <Link href={`/perfil/${p.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', textDecoration: 'none',
                    background: 'white', border: `1px solid ${!linked && level === 'critical' ? 'var(--badge-red-border)' : 'var(--border)'}`, borderRadius: 'var(--r-xl)',
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: linked ? 'var(--bg-2)' : 'var(--badge-amber-bg)', color: linked ? 'var(--ink-2)' : ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, flexShrink: 0 }}>{initials(p.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                        {p.relation && <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{p.relation}</span>}
                        {linked ? (
                          <span style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '2px 8px' }}>No lar/centro</span>
                        ) : meta ? (
                          <span style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 'var(--r)', padding: '2px 8px' }}>{meta.label}</span>
                        ) : null}
                      </div>
                    </div>
                    <span style={{ fontSize: 'var(--t-destaque)', color: 'var(--border-2)', flexShrink: 0 }}>›</span>
                  </Link>

                  {/* ── Como tem estado ─────────────────────────────────────
                      A pergunta que se faz mesmo sobre alguém de quem se
                      cuida. Estava espalhada por três páginas (medicação,
                      vitais, sintomas) e por isso ninguém a respondia. Aqui é
                      uma linha do tempo só, com os buracos à vista. */}
                  {!linked && (
                    <div style={{ marginTop: -4, marginBottom: 4 }}>
                      <button onClick={() => setAberto(aberto === p.id ? null : p.id)}
                        style={{
                          width: '100%', textAlign: 'left', background: 'white',
                          border: '1px solid var(--border)', borderTop: 'none',
                          borderRadius: '0 0 12px 12px', padding: '9px 16px',
                          fontFamily: 'inherit', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any,
                          color: 'var(--ink-4)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        }}>
                        <span>
                          Como tem estado
                          {(() => {
                            const a = longit[p.id] ? adesaoEm(longit[p.id].entrada, 14, ptDate()) : null
                            return a ? ` · ${a.pct}% da medicação marcada em 14 dias` : ''
                          })()}
                        </span>
                        <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--border-2)' }}>{aberto === p.id ? '−' : '+'}</span>
                      </button>
                      {aberto === p.id && (
                        <div style={{
                          background: 'white', border: '1px solid var(--border)', borderTop: 'none',
                          borderRadius: '0 0 12px 12px', padding: '16px 18px 14px', marginTop: -1,
                        }}>
                          <LinhaDoTempo
                            eventos={eventosDe(p.id)}
                            dias={30}
                            vazioTexto={`Ainda não há nada registado sobre ${p.name.split(' ')[0]}. A linha do tempo enche-se à medida que fores marcando as tomas e as medições — e é o que se leva para a consulta.`}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                )
              })}

              <button onClick={() => setChooserOpen(true)} style={{ display: 'block', width: '100%', padding: '14px', background: 'white', border: '2px dashed var(--badge-amber-border)', borderRadius: 'var(--r-xl)', textAlign: 'center', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: ACCENT, cursor: 'pointer' }}>+ Adicionar familiar</button>
            </div>
          </>
        )}
      </div>

      {chooserOpen && (
        <AddFamilyChooser
          onClose={() => setChooserOpen(false)}
          canAdd={profiles.length < familyLimit}
          authHeaders={authHeaders}
          onCreated={(newId) => { setChooserOpen(false); router.push(`/perfil/${newId}`) }}
        />
      )}
    </Mesa>
  )
}

// ─── Escolher como adicionar: à mão, ou já está num lar/centro de dia ───────
function AddFamilyChooser({ onClose, canAdd, authHeaders, onCreated }: {
  onClose: () => void
  canAdd: boolean
  authHeaders: () => Promise<Record<string, string>>
  onCreated: (id: string) => void
}) {
  const { user, supabase } = useAuth() as any
  const [mode, setMode] = useState<'choose' | 'manual' | 'institution'>('choose')
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [code, setCode] = useState('')
  const [verify, setVerify] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function createManual() {
    if (!name.trim() || !user?.id) return
    setBusy(true); setError('')
    const { data, error: err } = await supabase.from('family_profiles').insert({ user_id: user.id, name: name.trim(), relation: relation || null }).select('id').single()
    setBusy(false)
    if (err || !data) { setError('Não foi possível criar o perfil agora.'); return }
    onCreated(data.id)
  }

  async function linkFromInstitution() {
    if (!code.trim()) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/family-link', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ code: code.trim(), verify: verify.trim(), relation }),
      })
      const d = await res.json()
      if (d.needsVerify) { setNeedsVerify(true); setError(d.error || ''); setBusy(false); return }
      if (!res.ok || d.error) { setError(d.error || 'Não foi possível ligar.'); setBusy(false); return }
      onCreated(d.familyProfileId)
    } catch { setError('Erro de ligação. Tente novamente.') }
    setBusy(false)
  }

  const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '16px 18px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 'var(--r-xl)', cursor: 'pointer', fontFamily: 'inherit' }
  const inp: React.CSSProperties = { border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 13px', fontSize: 'var(--t-corpo)', outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-2)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: '22px 20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink)', fontWeight: 'var(--peso-corpo)' as any }}>
            {mode === 'choose' ? 'Adicionar familiar' : mode === 'manual' ? 'Preencher os dados' : 'Ligar ao lar/centro de dia'}
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: '50%', background: 'white', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 'var(--t-destaque)', color: 'var(--ink-5)' }}>×</button>
        </div>

        {!canAdd && mode === 'choose' ? (
          <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16, textAlign: 'center' }}>
            No plano gratuito e Plus pode acompanhar 1 familiar. Com o Pro, acompanha os que quiser. <Link href="/pricing" style={{ color: ACCENT, fontWeight: 'var(--peso-forte)' as any }}>Ver planos →</Link>
          </div>
        ) : mode === 'choose' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setMode('manual')} style={card}>
              <span style={{ fontSize: 'var(--t-numero)' }}>✍️</span>
              <span>
                <span style={{ display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>Vou preencher eu</span>
                <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 1 }}>Nome, medicação, alergias — o que quiser, quando quiser</span>
              </span>
            </button>
            <button onClick={() => setMode('institution')} style={card}>
              <span style={{ fontSize: 'var(--t-numero)' }}>🏡</span>
              <span>
                <span style={{ display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>Já está num lar ou centro de dia</span>
                <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 1 }}>Tem o código? Ligamos o perfil automaticamente</span>
              </span>
            </button>
          </div>
        ) : mode === 'manual' ? (
          <div>
            <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" autoFocus style={{ ...inp, marginTop: 6, marginBottom: 12 }} />
            <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Relação</label>
            <select value={relation} onChange={e => setRelation(e.target.value)} style={{ ...inp, marginTop: 6, marginBottom: 16, background: 'white' }}>
              <option value="">Escolher…</option>
              {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {error && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createManual} disabled={busy || !name.trim()} style={{ flex: 1, padding: '12px', background: busy || !name.trim() ? 'var(--border)' : ACCENT, color: busy || !name.trim() ? 'var(--ink-5)' : 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'A criar…' : 'Criar perfil'}</button>
              <button onClick={() => setMode('choose')} style={{ padding: '12px 16px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', cursor: 'pointer' }}>← Voltar</button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', lineHeight: 1.55, margin: '0 0 14px' }}>Peça à instituição o código de acesso da família — o nome e os dados de {relation || 'quem procura'} vêm de lá automaticamente.</p>
            <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>A sua relação</label>
            <select value={relation} onChange={e => setRelation(e.target.value)} style={{ ...inp, marginTop: 6, marginBottom: 12, background: 'white' }}>
              <option value="">Escolher…</option>
              {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Código da instituição</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Ex: PHLOX-AB12CD" style={{ ...inp, marginTop: 6, marginBottom: 12, fontFamily: 'var(--font-mono)' }} />
            {needsVerify && (
              <>
                <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Últimos 4 dígitos do telemóvel registado</label>
                <input value={verify} onChange={e => setVerify(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" inputMode="numeric" style={{ ...inp, marginTop: 6, marginBottom: 12, fontFamily: 'var(--font-mono)' }} />
              </>
            )}
            {error && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={linkFromInstitution} disabled={busy || !code.trim() || (needsVerify && verify.length !== 4)} style={{ flex: 1, padding: '12px', background: busy || !code.trim() ? 'var(--border)' : 'var(--ink-2)', color: busy || !code.trim() ? 'var(--ink-5)' : 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'A ligar…' : needsVerify ? 'Confirmar' : 'Ligar'}</button>
              <button onClick={() => setMode('choose')} style={{ padding: '12px 16px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', cursor: 'pointer' }}>← Voltar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
