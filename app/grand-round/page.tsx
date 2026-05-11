'use client'

// ─── PHLOX GRAND ROUND ────────────────────────────────────────────────────────
// O Reddit clínico que a medicina precisava mas nunca teve.
// Profissionais submetem casos reais anónimos. A comunidade debate.
// O autor revela o diagnóstico e plano. Aprende-se com casos reais.

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface GrandRoundCase {
  id: string
  title: string
  presentation: string
  key_findings: string[]
  question: string
  specialty: string
  difficulty: 'comum' | 'incomum' | 'raro'
  submitted_by: string
  submitted_role: string
  created_at: string
  reveal_at: string | null
  revealed: boolean
  diagnosis: string | null
  management: string | null
  learning_points: string[] | null
  votes: number
  comments_count: number
  my_vote: boolean
  my_diagnosis?: string
}

interface Comment {
  id: string
  case_id: string
  user_id: string
  author_name: string
  author_role: string | null
  content: string
  votes: number
  is_answer: boolean
  created_at: string
}

const SPECIALTIES = [
  'Farmacologia Clínica', 'Medicina Interna', 'Cardiologia', 'Pneumologia',
  'Neurologia', 'Nefrologia', 'Gastroenterologia', 'Endocrinologia',
  'Infecciologia', 'Oncologia', 'Pediatria', 'Geriatria',
  'Farmácia Hospitalar', 'Farmácia Comunitária', 'Enfermagem', 'Outro',
]

const DIFF_META = {
  comum:   { label: 'Comum',   color: '#0d6e42', bg: '#d1fae5' },
  incomum: { label: 'Incomum', color: '#d97706', bg: '#fef9c3' },
  raro:    { label: 'Raro',    color: '#dc2626', bg: '#fee2e2' },
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff/60000)}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h/24)}d`
}

function CaseCard({ c, onClick }: { c: GrandRoundCase; onClick: () => void }) {
  const diff = DIFF_META[c.difficulty]
  return (
    <div onClick={onClick} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s' }} className="grand-card">
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: diff.color, background: diff.bg, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{diff.label}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{c.specialty}</span>
        {c.revealed && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Revelado</span>}
        <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{timeAgo(c.created_at)}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, marginBottom: 8, lineHeight: 1.3 }}>{c.title}</div>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 12 }}>
        {c.presentation.slice(0, 180)}{c.presentation.length > 180 ? '...' : ''}
      </p>
      {c.key_findings?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {c.key_findings.slice(0, 4).map((f, i) => (
            <span key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 3 }}>{f}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>↑ {c.votes}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>💬 {c.comments_count}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 'auto' }}>{c.submitted_role} · {c.submitted_by}</span>
      </div>
    </div>
  )
}

function CaseDetail({ c, onBack, userId, supabase, myRole, myName }: {
  c: GrandRoundCase; onBack: () => void
  userId: string; supabase: any; myRole: string; myName: string
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [myDiag, setMyDiag] = useState(c.my_diagnosis || '')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [voted, setVoted] = useState(c.my_vote)
  const [votes, setVotes] = useState(c.votes)
  const diff = DIFF_META[c.difficulty]

  useEffect(() => {
    supabase.from('grand_round_comments').select('*')
      .eq('case_id', c.id).order('votes', { ascending: false })
      .then(({ data }: any) => setComments(data || []))
  }, [c.id, supabase])

  const submitDiagnosis = async () => {
    if (!myDiag.trim()) return
    await supabase.from('grand_round_diagnoses').upsert({
      case_id: c.id, user_id: userId, diagnosis: myDiag.trim()
    }, { onConflict: 'case_id,user_id' })
  }

  const submitComment = async () => {
    if (!comment.trim() || submitting) return
    setSubmitting(true)
    const { data } = await supabase.from('grand_round_comments').insert({
      case_id: c.id, user_id: userId, author_name: myName,
      author_role: myRole || null, content: comment.trim(), votes: 0
    }).select().single()
    if (data) setComments(p => [data, ...p])
    setComment('')
    setSubmitting(false)
  }

  const vote = async () => {
    if (voted) return
    setVoted(true); setVotes(v => v + 1)
    await supabase.from('grand_round_votes').insert({ case_id: c.id, user_id: userId })
    await supabase.from('grand_round_cases').update({ votes: votes + 1 }).eq('id', c.id)
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>← Voltar</button>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: diff.color, background: diff.bg, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{diff.label}</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{c.specialty}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, marginBottom: 6 }}>{c.title}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            Submetido por {c.submitted_by} ({c.submitted_role}) · {timeAgo(c.created_at)}
          </div>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Apresentação clínica</div>
          <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.8, fontFamily: 'var(--font-serif)', marginBottom: 16 }}>{c.presentation}</p>

          {c.key_findings?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Achados chave</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {c.key_findings.map((f, i) => (
                  <span key={i} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: 4 }}>{f}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Questão para debate</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e40af', lineHeight: 1.5 }}>{c.question}</div>
          </div>

          {/* Vote */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button onClick={vote} disabled={voted}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: voted ? '#d1fae5' : 'white', border: `1px solid ${voted ? '#6ee7b7' : 'var(--border)'}`, borderRadius: 7, cursor: voted ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, color: voted ? '#0d6e42' : 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
              ↑ {votes} {voted ? 'votaste' : 'votar'}
            </button>
          </div>

          {/* My diagnosis */}
          {!c.revealed && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>O teu diagnóstico / raciocínio</div>
              <textarea value={myDiag} onChange={e => setMyDiag(e.target.value)}
                placeholder="Qual é o teu diagnóstico diferencial? O que farias a seguir?"
                rows={3} style={{ width: '100%', border: '1.5px solid #fde68a', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6, background: 'white', marginBottom: 8 }} />
              <button onClick={submitDiagnosis} disabled={!myDiag.trim()}
                style={{ padding: '8px 16px', background: '#d97706', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: myDiag.trim() ? 1 : 0.5 }}>
                Guardar raciocínio
              </button>
            </div>
          )}

          {/* Revelation */}
          {c.revealed && c.diagnosis && (
            <div style={{ background: '#0f172a', borderRadius: 10, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Diagnóstico e Plano — Revelado pelo autor</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#f8fafc', marginBottom: 10 }}>{c.diagnosis}</div>
              {c.management && <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 10 }}>{c.management}</p>}
              {c.learning_points && (
                <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Pontos de aprendizagem</div>
                  {c.learning_points.map((p, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 4 }}>→ {p}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Comments */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Debate da comunidade ({comments.length})
        </div>
        <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Partilha o teu raciocínio, diagnóstico diferencial, ou questão..."
            rows={3} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6, marginBottom: 8 }} />
          <button onClick={submitComment} disabled={!comment.trim() || submitting}
            style={{ padding: '9px 18px', background: comment.trim() ? 'var(--ink)' : 'var(--bg-3)', color: comment.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            Comentar
          </button>
        </div>
        {comments.map(cm => (
          <div key={cm.id} style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 9, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{cm.author_name}</span>
              {cm.author_role && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{cm.author_role}</span>}
              {cm.is_answer && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', padding: '1px 5px', borderRadius: 3 }}>Resposta do autor</span>}
              <span style={{ fontSize: 10, color: 'var(--ink-5)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{timeAgo(cm.created_at)}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65, margin: 0 }}>{cm.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GrandRoundPage() {
  const { user, supabase } = useAuth()
  const [cases, setCases] = useState<GrandRoundCase[]>([])
  const [selected, setSelected] = useState<GrandRoundCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [myRole, setMyRole] = useState('Farmacêutico')
  const [tab, setTab] = useState<'open' | 'revealed' | 'mine'>('open')

  // New case form
  const [form, setForm] = useState({
    title: '', presentation: '', key_findings: '',
    question: '', specialty: 'Farmacologia Clínica', difficulty: 'incomum' as 'comum'|'incomum'|'raro',
    diagnosis: '', management: '', learning_points: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const plan = (user?.plan || 'free') as string
  const isPro = plan !== 'free'

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('grand_round_cases')
      .select('*').order('votes', { ascending: false }).limit(30)
    setCases(data || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const submitCase = async () => {
    if (!user || !form.title.trim() || !form.presentation.trim()) return
    setSubmitting(true)
    const { data: profile } = await supabase.from('profiles').select('display_name, professional_role').eq('id', user.id).single()
    const { data } = await supabase.from('grand_round_cases').insert({
      title: form.title, presentation: form.presentation,
      key_findings: form.key_findings.split('\n').filter(Boolean),
      question: form.question, specialty: form.specialty,
      difficulty: form.difficulty,
      submitted_by: profile?.display_name || user.name || 'Anónimo',
      submitted_role: profile?.professional_role || myRole,
      submitted_user_id: user.id,
      votes: 0, comments_count: 0, revealed: false,
      // Author can pre-fill the answer (revealed later)
      diagnosis: form.diagnosis || null,
      management: form.management || null,
      learning_points: form.learning_points ? form.learning_points.split('\n').filter(Boolean) : null,
    }).select().single()
    if (data) { setCases(p => [data, ...p]); setComposing(false) }
    setSubmitting(false)
  }

  const filtered = cases.filter(c => {
    if (tab === 'open') return !c.revealed
    if (tab === 'revealed') return c.revealed
    if (tab === 'mine') return c.submitted_by === user?.name
    return true
  })

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--ink)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: tab === t ? 'var(--ink)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1,
  })

  const inp = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }
  const lbl = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 6, display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Phlox Grand Round</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 4 }}>
                Casos clínicos da comunidade
              </h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: 0 }}>
                Submete um caso real. A comunidade debate. O autor revela o diagnóstico.
              </p>
            </div>
            {isPro && !composing && !selected && (
              <button onClick={() => setComposing(true)}
                style={{ padding: '10px 20px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                + Submeter caso
              </button>
            )}
          </div>
          {!selected && !composing && (
            <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setTab('open')} style={tabStyle('open')}>Em aberto</button>
              <button onClick={() => setTab('revealed')} style={tabStyle('revealed')}>Revelados</button>
              {user && <button onClick={() => setTab('mine')} style={tabStyle('mine')}>Os meus</button>}
            </div>
          )}
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        {selected ? (
          <CaseDetail c={selected} onBack={() => setSelected(null)}
            userId={user?.id || ''} supabase={supabase}
            myRole={myRole} myName={user?.name || 'Anónimo'} />
        ) : composing ? (
          <div style={{ background: 'white', border: '1.5px solid var(--ink)', borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
              Submeter caso clínico
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Título *</label>
                <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
                  placeholder="Ex: Jovem de 28 anos com febre e rash cutâneo" style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Especialidade</label>
                  <select value={form.specialty} onChange={e => setForm(p=>({...p,specialty:e.target.value}))} style={{ ...inp }}>
                    {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Frequência</label>
                  <select value={form.difficulty} onChange={e => setForm(p=>({...p,difficulty:e.target.value as any}))} style={{ ...inp }}>
                    <option value="comum">Comum</option>
                    <option value="incomum">Incomum</option>
                    <option value="raro">Raro</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Apresentação clínica * (inclui história, exame, e resultados relevantes)</label>
                <textarea value={form.presentation} onChange={e => setForm(p=>({...p,presentation:e.target.value}))}
                  placeholder="Descreve o caso de forma anónima..." rows={5}
                  style={{ ...inp, resize: 'vertical', lineHeight: 1.7 }} />
              </div>
              <div>
                <label style={lbl}>Achados chave (um por linha)</label>
                <textarea value={form.key_findings} onChange={e => setForm(p=>({...p,key_findings:e.target.value}))}
                  placeholder={'TA 180/110 mmHg\nCreatinina 2.3 mg/dL\nProteinúria 3+'} rows={3}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
              </div>
              <div>
                <label style={lbl}>Questão para a comunidade *</label>
                <input value={form.question} onChange={e => setForm(p=>({...p,question:e.target.value}))}
                  placeholder="Ex: Qual seria o vosso diagnóstico diferencial e plano imediato?" style={inp} />
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#854d0e', marginBottom: 10, background: '#fef9c3', padding: '8px 10px', borderRadius: 6 }}>
                  Resposta do autor — preenche agora e revela quando quiseres
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={lbl}>Diagnóstico final</label>
                    <input value={form.diagnosis} onChange={e => setForm(p=>({...p,diagnosis:e.target.value}))}
                      placeholder="O diagnóstico confirmado..." style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Gestão clínica</label>
                    <textarea value={form.management} onChange={e => setForm(p=>({...p,management:e.target.value}))}
                      placeholder="Tratamento, monitorização, seguimento..." rows={2}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
                  </div>
                  <div>
                    <label style={lbl}>Pontos de aprendizagem (um por linha)</label>
                    <textarea value={form.learning_points} onChange={e => setForm(p=>({...p,learning_points:e.target.value}))}
                      placeholder={'Pearl 1\nPearl 2'} rows={2}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitCase} disabled={submitting || !form.title.trim() || !form.presentation.trim() || !form.question.trim()}
                  style={{ flex: 1, padding: '12px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: (form.title.trim() && form.presentation.trim()) ? 1 : 0.5 }}>
                  {submitting ? 'A submeter...' : 'Submeter caso →'}
                </button>
                <button onClick={() => setComposing(false)}
                  style={{ padding: '12px 16px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 10 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 12, padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 10 }}>
              {tab === 'open' ? 'Ainda sem casos em aberto' : tab === 'revealed' ? 'Ainda sem casos revelados' : 'Ainda não submeteste nenhum caso'}
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto 20px' }}>
              {isPro ? 'Sê o primeiro a submeter um caso clínico para debate da comunidade.' : 'O Grand Round requer plano Pro ou superior.'}
            </p>
            {isPro
              ? <button onClick={() => setComposing(true)} style={{ padding: '11px 24px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>Submeter primeiro caso →</button>
              : <Link href="/pricing" style={{ display: 'inline-block', padding: '11px 24px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Ver planos →</Link>
            }
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => <CaseCard key={c.id} c={c} onClick={() => setSelected(c)} />)}
          </div>
        )}
      </div>
      <style>{`.grand-card:hover { border-color: var(--border-2) !important; transform: translateY(-1px); box-shadow: var(--shadow-md); }`}</style>
    </div>
  )
}