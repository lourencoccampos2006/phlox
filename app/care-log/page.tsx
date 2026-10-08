'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Vazio, Aviso, ACarregar,
  Codigo, Bandeira, Segmentos, Botao, Seletor, CAIXA, CAIXA_TEXTO, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { useOrgScope } from '@/lib/orgScope'
import { CuidadosNaoPrestados } from '@/components/institution/NaoPrestado'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import RegistoDoDia from './RegistoDoDia'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, shiftsFor, currentShiftFor } from '@/lib/institutionConfig'
import { printDoc, type PrintRecord } from '@/lib/print'
import { flagReading, VITAL_LEVEL_COLOR, VITAL_LABEL } from '@/lib/vitalRanges'
import { vitalTrendSignals, type TrendVital } from '@/lib/healthTrends'
import { registar, ACOES } from '@/lib/registo'

// O /care-log é agora a fusão "Registo do dia" (abas: registo + hidratação +
// feridas + atividades, adaptadas por instituição). O formulário de registo em si
// é o CareLogTool (exportado abaixo), usado como a aba "Registo".
export default function CareLogPage() { return <RegistoDoDia /> }

type Shift = 'manha' | 'tarde' | 'noite'

interface Patient { id: string; name: string; age?: number; room_number?: string; conditions?: string | null }

interface CareRecord {
  id: string
  patient_id: string
  patient_name?: string
  date: string
  shift: Shift
  recorded_by?: string
  vitals: { bp_sys?: number; bp_dia?: number; hr?: number; temp?: number; spo2?: number; glucose?: number; weight?: number }
  nutrition: { breakfast?: number; lunch?: number; dinner?: number; fluid_ml?: number; appetite?: string }
  continence: { urinary?: string; bowel?: string }
  mood: { level?: number; activities?: string; behavior?: string }
  skin: { integrity?: string; description?: string }
  notes?: string
  created_at: string
}

// -- OS TURNOS DEIXARAM DE TER COR PROPRIA (2026-10-07) ---------------------
// Eram tres cores: ambar de manha, azul a tarde, roxo a noite. Pareciam uteis
// e eram um quarto sistema de cor a competir com os outros tres.
//
// O que os matou foi uma coisa concreta: o ambar passou a querer dizer «a
// precisar de atencao». Com a manha pintada de ambar, metade dos ecras de uma
// casa ficavam com um aviso falso das sete as duas da tarde -- todos os dias.
//
// Um turno e uma coisa neutra. Qual deles esta escolhido diz-se com o verde do
// que esta ativo, como em todo o resto da aplicacao.
const SHIFTS: Record<Shift, { label: string; hours: string; color: string; bg: string }> = {
  manha: { label: 'Manhã',  hours: '07:00–14:00', color: 'var(--ink-3)', bg: 'var(--bg-2)' },
  tarde: { label: 'Tarde',  hours: '14:00–21:00', color: 'var(--ink-3)', bg: 'var(--bg-2)' },
  noite: { label: 'Noite',  hours: '21:00–07:00', color: 'var(--ink-3)', bg: 'var(--bg-2)' },
}

// Turnos: fonte única em lib/institutionConfig (shiftsFor / currentShiftFor).
// Um centro de dia não tem turno da noite — não o mostramos nem o derivamos.

const MOOD_OPTS = [
  { v: 1, label: 'Agitado',      color: 'var(--red)' },
  { v: 2, label: 'Ansioso',      color: 'var(--amber)' },
  { v: 3, label: 'Neutro',       color: 'var(--ink-4)' },
  { v: 4, label: 'Bem-disposto', color: 'var(--ink-2)' },
  { v: 5, label: 'Muito bem',    color: 'var(--green)' },
]

const APPETITE_OPTS = ['Bom', 'Razoável', 'Fraco', 'Recusou']
const URINARY_OPTS = ['Continente', 'Incontinente', 'Algaliado', 'Retenção']
const BOWEL_OPTS = ['Normal', 'Obstipação', 'Diarreia', 'Sem registo']
const SKIN_OPTS = ['Íntegra', 'Rubor', 'Ferida', 'Escara']

function pctColor(v: number) {
  if (v >= 75) return 'var(--green)'
  if (v >= 40) return 'var(--amber)'
  return 'var(--red)'
}

export function CareLogTool() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('registos', 'editar')
  const toast = useToast()
  const cfg = institutionConfig(institution)
  const personLower = cfg.personNoun.toLowerCase()

  const today = new Date().toISOString().slice(0, 10)

  const [patients, setPatients] = useState<Patient[]>([])
  const [records, setRecords] = useState<CareRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const sp = useSearchParams()
  const [patientId, setPatientId] = useState('')
  const [date, setDate] = useState(today)
  // useClinicPrefs arranca em 'nursing_home' e só lê o tipo real depois do 1º
  // render — re-sincronizamos o turno com a instituição enquanto não for tocado.
  const [shift, setShift] = useState<Shift>(currentShiftFor(institution))
  const [shiftTouched, setShiftTouched] = useState(false)
  const pickShift = (s: Shift) => { setShiftTouched(true); setShift(s) }
  useEffect(() => { if (!shiftTouched) setShift(currentShiftFor(institution)) /* eslint-disable-next-line */ }, [institution])
  const [recordedBy, setRecordedBy] = useState('')
  // BUG CORRIGIDO 2026-08-07: campo ficava sempre vazio — cada registo pedia
  // para escrever o próprio nome à mão, todos os dias. Pré-preenche da sessão
  // (continua editável, ex: registo feito por outra pessoa em nome de alguém)
  // — só na primeira vez que o nome da sessão fica disponível, nunca apaga o
  // que a pessoa já tenha escrito à mão.
  const [recordedByTouched, setRecordedByTouched] = useState(false)
  useEffect(() => {
    if (recordedByTouched || recordedBy) return
    const name = (user as any)?.name || user?.email
    if (name) setRecordedBy(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Vitals
  const [bpSys, setBpSys] = useState('')
  const [bpDia, setBpDia] = useState('')
  const [hr, setHr] = useState('')
  const [temp, setTemp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [glucose, setGlucose] = useState('')
  const [weight, setWeight] = useState('')

  // Nutrition
  const [breakfast, setBreakfast] = useState<number | null>(null)
  const [lunch, setLunch] = useState<number | null>(null)
  const [dinner, setDinner] = useState<number | null>(null)
  const [fluidMl, setFluidMl] = useState('')
  const [appetite, setAppetite] = useState('')

  // Continence
  const [urinary, setUrinary] = useState('')
  const [bowel, setBowel] = useState('')

  // Mood + skin
  const [mood, setMood] = useState<number | null>(null)
  const [activities, setActivities] = useState('')
  const [behavior, setBehavior] = useState('')
  const [skin, setSkin] = useState('')
  const [skinNotes, setSkinNotes] = useState('')

  // Notes
  const [notes, setNotes] = useState('')
  // Atalho "está tudo como ontem?" — ver o bloco na UI. Fica aberto até a
  // pessoa responder ou tocar no formulário.
  const [atalhoUsado, setAtalhoUsado] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pats }, { data: recs }] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,age,room_number,conditions')).eq('active', true).order('name'),
      scope.filter(supabase.from('care_records').select('*')).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    ])
    setPatients(pats || [])
    setRecords(recs || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  // Pré-seleciona a pessoa quando se chega via ?patient= (ex.: do cockpit, tocar
  // num nome "sem registo hoje" abre logo o registo dessa pessoa).
  useEffect(() => {
    const pid = sp?.get('patient')
    if (pid && !patientId && patients.some(p => p.id === pid)) setPatientId(pid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, patients])

  useLiveData({ supabase, table: ['care_records', 'patients'], userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load })

  function resetForm() {
    setBpSys(''); setBpDia(''); setHr(''); setTemp(''); setSpo2(''); setGlucose(''); setWeight('')
    setBreakfast(null); setLunch(null); setDinner(null); setFluidMl(''); setAppetite('')
    setUrinary(''); setBowel('')
    setMood(null); setActivities(''); setBehavior('')
    setSkin(''); setSkinNotes('')
    setNotes('')
  }

  // Último registo do residente selecionado (para pré-preenchimento)
  const lastRecord = patientId ? records.find(r => r.patient_id === patientId) : null
  function prefillFromLast() {
    const r = lastRecord; if (!r) return
    const v = r.vitals || {}, n = r.nutrition || {}, c = r.continence || {}, m = r.mood || {}, s = r.skin || {}
    setBpSys(v.bp_sys != null ? String(v.bp_sys) : ''); setBpDia(v.bp_dia != null ? String(v.bp_dia) : '')
    setHr(v.hr != null ? String(v.hr) : ''); setTemp(v.temp != null ? String(v.temp) : '')
    setSpo2(v.spo2 != null ? String(v.spo2) : ''); setGlucose(v.glucose != null ? String(v.glucose) : '')
    setWeight(v.weight != null ? String(v.weight) : '')
    setBreakfast(n.breakfast ?? null); setLunch(n.lunch ?? null); setDinner(n.dinner ?? null)
    setFluidMl(n.fluid_ml != null ? String(n.fluid_ml) : ''); setAppetite(n.appetite || '')
    setUrinary(c.urinary || ''); setBowel(c.bowel || '')
    setMood(m.level ?? null); setActivities(m.activities || ''); setBehavior(m.behavior || '')
    setSkin(s.integrity || ''); setSkinNotes(s.description || '')
    // notas NÃO se copiam — cada turno tem as suas
  }

  /** "Sim — registar igual": grava DIRETO a partir do último registo.
   *  Não passa pelo estado do formulário de propósito: um prefill seguido de
   *  save() no mesmo tique gravaria os valores antigos do render anterior, ou
   *  seja, um registo em branco. As notas não se copiam — cada turno tem as
   *  suas — e a hora fica a de agora. */
  async function registarIgual() {
    if (!user || !patientId || !lastRecord) return
    if (!podeEditar) { toast.error('Só leitura', 'A sua conta não tem permissão para registar.'); return }
    setSaving(true)
    try {
      const r = lastRecord
      const { error } = await supabase.from('care_records').upsert(scope.stamp({
        user_id: user.id, patient_id: patientId, date, shift,
        recorded_by: recordedBy || null,
        vitals: r.vitals || {},
        nutrition: r.nutrition || {},
        continence: r.continence || {},
        mood: r.mood || {},
        skin: r.skin || {},
        notes: null,
      }), { onConflict: 'patient_id,date,shift' })
      if (error) { toast.error('Não foi possível guardar', reportError('care-log-igual', error, 'Tenta de novo.')); return }
      toast.success('Registado', `${pat?.name || 'Registo'} — igual ao último.`)
      registar({ supabase, scope, user }, { ...ACOES.registoIgual(pat?.name || 'utente'),
        subjectId: patientId, subjectName: pat?.name || null, entityId: patientId, meta: { turno: shift } })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      resetForm(); setAtalhoUsado(false); load()
    } catch (e) {
      toast.error('Não foi possível guardar', reportError('care-log-igual', e, 'Verifica a ligação e tenta de novo.'))
    } finally { setSaving(false) }
  }

  async function save() {
    if (!user || !patientId) return
    if (!podeEditar) { toast.error('Só leitura', 'A sua conta não tem permissão para registar.'); return }
    setSaving(true)
    try {
    const { error } = await supabase.from('care_records').upsert(scope.stamp({
      user_id: user.id,
      patient_id: patientId,
      date,
      shift,
      recorded_by: recordedBy || null,
      vitals: {
        bp_sys: bpSys ? parseInt(bpSys) : null,
        bp_dia: bpDia ? parseInt(bpDia) : null,
        hr: hr ? parseInt(hr) : null,
        temp: temp ? parseFloat(temp) : null,
        spo2: spo2 ? parseInt(spo2) : null,
        glucose: glucose ? parseInt(glucose) : null,
        weight: weight ? parseFloat(weight) : null,
      },
      nutrition: { breakfast: breakfast ?? null, lunch: lunch ?? null, dinner: dinner ?? null, fluid_ml: fluidMl ? parseInt(fluidMl) : null, appetite: appetite || null },
      continence: { urinary: urinary || null, bowel: bowel || null },
      mood: { level: mood ?? null, activities: activities || null, behavior: behavior || null },
      skin: { integrity: skin || null, description: skinNotes || null },
      notes: notes || null,
    }), { onConflict: 'patient_id,date,shift' })

    if (error) { toast.error('Não foi possível guardar', reportError('care-log-save', error, 'Tenta de novo.')); return }
    registar({ supabase, scope, user }, { ...ACOES.registoDoDia(pat?.name || 'utente', SHIFTS[shift]?.label || shift),
      subjectId: patientId, subjectName: pat?.name || null, entityId: patientId, meta: { turno: shift, data: date } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    resetForm()
    load()
    } catch (e) {
      toast.error('Não foi possível guardar', reportError('care-log-save', e, 'Verifica a ligação e tenta de novo.'))
    } finally {
      setSaving(false)
    }
  }

  const pat = patients.find(p => p.id === patientId)
  const patientRecords = records.filter(r => r.patient_id === patientId)
  const todayRecords = records.filter(r => r.date === today)
  // Sinais vitais inteligentes (lib/vitalRanges, já usado em /vitals pessoal):
  // avalia cada valor contra o intervalo seguro PARA ESTA pessoa (idade/condições)
  // em vez dos limiares fixos e parciais que existiam aqui (só T.A./febre/SpO₂,
  // sem F.C. nem glicemia, sem ajustar ao idoso/diabético/DPOC).
  const vitalFlags = flagReading(
    { bp_sys: bpSys ? Number(bpSys) : undefined, bp_dia: bpDia ? Number(bpDia) : undefined, hr: hr ? Number(hr) : undefined, temp: temp ? Number(temp) : undefined, spo2: spo2 ? Number(spo2) : undefined, glucose: glucose ? Number(glucose) : undefined },
    { age: pat?.age, conditions: pat?.conditions }
  )

  // Tendência ao longo do tempo (Módulo 7) — a mesma função já usada em modo
  // pessoal/família (lib/healthTrends), nunca antes ligada ao institucional.
  // flagReading acima só olha para o valor que se está a escrever agora; isto
  // olha para o histórico da pessoa (patientRecords, já carregado) — deteta
  // "3ª leitura elevada seguida" mesmo que cada valor isolado pareça normal.
  const vitalTrends = patientId ? vitalTrendSignals(
    patientRecords.filter(r => r.vitals && Object.values(r.vitals).some(v => v != null)).map((r): TrendVital => ({ recorded_at: r.created_at || r.date, ...r.vitals })),
    true,
  ) : []

  // ── Registo de cuidados profissional (A4) — documento do processo ────────────
  // Imprime os registos do dia selecionado para o utente escolhido, por turno.
  function recordToPrint(r: CareRecord): PrintRecord {
    const v = r.vitals || {}, n = r.nutrition || {}, c = r.continence || {}, m = r.mood || {}, s = r.skin || {}
    const fields = [
      (v.bp_sys ? { label: 'T.A.', value: `${v.bp_sys}/${v.bp_dia ?? '—'} mmHg` } : null),
      (v.hr ? { label: 'F.C.', value: `${v.hr} bpm` } : null),
      (v.temp ? { label: 'Temp.', value: `${v.temp} ºC` } : null),
      (v.spo2 ? { label: 'SpO₂', value: `${v.spo2}%` } : null),
      (v.glucose ? { label: 'Glicemia', value: `${v.glucose} mg/dL` } : null),
      (v.weight ? { label: 'Peso', value: `${v.weight} kg` } : null),
      (n.appetite ? { label: 'Apetite', value: n.appetite } : null),
      (n.fluid_ml ? { label: 'Líquidos', value: `${n.fluid_ml} ml` } : null),
      (c.urinary ? { label: 'Urinária', value: c.urinary } : null),
      (c.bowel ? { label: 'Intestinal', value: c.bowel } : null),
      (m.level ? { label: 'Humor', value: MOOD_OPTS.find(o => o.v === m.level)?.label || String(m.level) } : null),
      (s.integrity ? { label: 'Pele', value: s.integrity } : null),
    ].filter(Boolean) as { label: string; value: string }[]
    const bullets = [m.behavior, m.activities, s.description, r.notes].filter(Boolean) as string[]
    return {
      title: `Turno ${SHIFTS[r.shift].label} (${SHIFTS[r.shift].hours})`,
      meta: r.recorded_by ? `Registado por: ${r.recorded_by}` : '',
      fields,
      bullets: bullets.length ? bullets : undefined,
    }
  }
  function printDayRecord() {
    if (!pat) return
    const dayRecs = patientRecords.filter(r => r.date === date).sort((a, b) => a.shift.localeCompare(b.shift))
    printDoc({
      docTitle: `Registo de cuidados — ${pat.name}`,
      docSubtitle: new Date(date + 'T00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (cfg.hasBeds && pat.room_number ? ` · ${cfg.roomLabel} ${pat.room_number}` : ''),
      institution: cfg.unitNoun,
      author: (user as any)?.name || user?.email || '',
      sections: [{
        heading: 'Registos do dia',
        records: dayRecs.length ? dayRecs.map(recordToPrint) : [{ title: 'Sem registos neste dia', body: 'Não há registos de cuidados para a data selecionada.' }],
      }],
      footerNote: 'Registo de cuidados · Phlox Clinical · Confidencial · Assinatura: __________________',
    })
  }

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)',
    fontSize: 'var(--t-corpo)', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s',
    ...extra,
  })

  /* ══════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════
     O que estava aqui era um formulário de três metros: escolhia-se a pessoa
     numa caixa, e depois rolava-se por seis secções empilhadas até ao botão
     de gravar. A pergunta que a página NÃO respondia era a única que se faz
     num turno: «de quem é que ainda falta o registo?»

     Agora são duas colunas. À esquerda a casa, com quem já tem registo e
     quem não tem; à direita a folha da pessoa escolhida, com os campos em
     grelha em vez de empilhados. O botão de gravar está colado ao fundo do
     painel, à vista, em vez de no fim de um rolo.
     ══════════════════════════════════════════════════════════════════════ */
  const largo = useLargo()

  // Quem já tem registo hoje, e em que turnos.
  const doDia = records.filter(r => r.date === date)
  const linhasDaCasa = patients.map(p => {
    const seus = doDia.filter(r => r.patient_id === p.id)
    return { p, turnos: new Set(seus.map(r => r.shift)), quantos: seus.length }
  })
  const comRegisto = linhasDaCasa.filter(l => l.turnos.has(shift)).length
  const escolhido = patients.find(p => p.id === patientId) || null

  /** Um grupo de campos, com o rótulo em monoespaçada. */
  const Grupo = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <section style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ ...ROTULO, marginBottom: 10 }}>{titulo}</div>
      {children}
    </section>
  )

  /** Uma escolha entre poucas opções. Substitui seis caixas de seleção. */
  const Escolha = ({ opcoes, valor, aoEscolher }: {
    opcoes: string[]; valor: string; aoEscolher: (v: string) => void
  }) => (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {opcoes.map(o => {
        const on = valor === o
        return (
          <button key={o} type="button" onClick={() => aoEscolher(on ? '' : o)}
            className="mesa-botao"
            style={{
              ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.04em', padding: '0 10px',
              borderRadius: 'var(--r-sm)', cursor: 'pointer',
              border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
              background: on ? 'var(--green)' : 'transparent',
              color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
              fontWeight: on ? 700 : 500,
            }}>{o}</button>
        )
      })}
    </div>
  )

  /** Um campo numérico com a unidade colada. */
  const Numerico = ({ rotulo, valor, aoMudar, unidade, ph }: {
    rotulo: string; valor: string; aoMudar: (v: string) => void; unidade: string; ph?: string
  }) => (
    <div>
      <label style={{ ...ROTULO, display: 'block', marginBottom: 3 }}>{rotulo}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <input value={valor} onChange={e => aoMudar(e.target.value)} inputMode="decimal"
          placeholder={ph} style={{ ...CAIXA, ...MONO, width: 72 }} />
        <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>{unidade}</span>
      </div>
    </div>
  )

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
              Registo do dia
            </span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              aria-label="Dia" style={{ ...CAIXA, width: 150 }} />
          </div>

          <Seletor opcoes={shiftsFor(institution).map(s => ({ id: s, rotulo: SHIFTS[s].label }))}
            ativa={shift} aoMudar={s => { setShiftTouched(true); setShift(s) }} />

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: comRegisto === patients.length && patients.length > 0 ? 'var(--green)' : 'var(--ink-2)' }}>
              {comRegisto}/{patients.length}
            </span>
            <Segmentos feitos={comRegisto} total={Math.max(patients.length, 1)} />
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>com registo neste turno</span>
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Botao onClick={printDayRecord}>IMPRIMIR O DIA</Botao>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO }}>Um registo por pessoa e por turno.</span>
          <span style={{ ...MONO, color: 'var(--green)' }}>✓ = já registado neste turno</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>— = por registar</span>
          <span style={{ marginLeft: 'auto', ...MONO }}>
            Fica assinado com o nome de quem registou.
          </span>
        </BarraDeEstado>
      }
    >
      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(320px, 380px) 1fr' : '1fr',
      }}>
        {/* ── A CASA ─────────────────────────────────────────────────── */}
        {(largo || !patientId) && (
          <Painel cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, width: 30 }}>Qt</span>
              <span style={{ ...ROTULO, flex: 1 }}>{cfg.personNounPlural} · {patients.length}</span>
              <span style={{ ...ROTULO }}>Turnos</span>
            </Cabecalho>
          }>
            {loading && patients.length === 0 ? (
              <ACarregar oQue="A carregar a casa…" />
            ) : patients.length === 0 ? (
              <Vazio titulo={`Ainda não há ${cfg.personNounPlural.toLowerCase()} nesta casa.`} />
            ) : linhasDaCasa.map(({ p, turnos, quantos }) => {
              const on = p.id === patientId
              const feito = turnos.has(shift)
              return (
                <button key={p.id} onClick={() => setPatientId(p.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${on ? 'var(--green)' : 'transparent'}`,
                  background: on ? 'var(--green-light)' : 'transparent', fontFamily: 'inherit',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, width: 30, flexShrink: 0, color: p.room_number ? 'var(--ink-3)' : 'var(--ink-5)' }}>
                      {p.room_number || '—'}
                    </span>
                    <span style={{
                      fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, flex: 1, minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: feito ? 'var(--ink-4)' : 'var(--ink)',
                    }}>{p.name}</span>
                    <span style={{ ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: feito ? 'var(--green)' : 'var(--ink-5)' }}>
                      {feito ? '✓' : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 4, paddingLeft: 40 }}>
                    {p.age != null && <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{p.age}a</span>}
                    {shiftsFor(institution).map(s => (
                      <Codigo key={s} texto={SHIFTS[s].label.slice(0, 1).toUpperCase()}
                        cor={turnos.has(s) ? 'var(--green)' : undefined}
                        apagado={!turnos.has(s)} />
                    ))}
                    {quantos > 0 && <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{quantos} hoje</span>}
                  </div>
                </button>
              )
            })}
          </Painel>
        )}

        {/* ── A FOLHA DA PESSOA ──────────────────────────────────────── */}
        {escolhido ? (
          <Painel
            cabeca={
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  {!largo && <Botao onClick={() => setPatientId('')}>← {cfg.personNounPlural.toUpperCase()}</Botao>}
                  <span style={{ ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)' }}>
                    {escolhido.room_number ? `QT ${escolhido.room_number}` : 'SEM QUARTO'}
                  </span>
                  <span style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-corpo)' as any, letterSpacing: '-0.01em' }}>{escolhido.name}</span>
                  <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                    {SHIFTS[shift].label} · {SHIFTS[shift].hours}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <Botao onClick={prefillFromLast} titulo="Copiar os valores do último registo desta pessoa">
                      COPIAR O ÚLTIMO
                    </Botao>
                    <Botao onClick={registarIgual} titulo="Gravar já um registo igual ao último">
                      IGUAL AO ÚLTIMO
                    </Botao>
                  </span>
                </div>
              </div>
            }
            rodape={
              <>
                <input value={recordedBy} onChange={e => { setRecordedByTouched(true); setRecordedBy(e.target.value) }}
                  placeholder="Quem regista" aria-label="Quem regista"
                  style={{ ...CAIXA, width: 180 }} />
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {saved && <span style={{ ...MONO, color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>GRAVADO</span>}
                  <Botao feitio="principal" onClick={save} disabled={saving || !patientId}>
                    {saving ? 'A GRAVAR…' : 'GRAVAR O REGISTO'}
                  </Botao>
                </span>
              </>
            }
          >
            <Grupo titulo="Sinais vitais">
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <Numerico rotulo="T.A. sist." valor={bpSys} aoMudar={setBpSys} unidade="mmHg" ph="120" />
                <Numerico rotulo="T.A. diast." valor={bpDia} aoMudar={setBpDia} unidade="mmHg" ph="80" />
                <Numerico rotulo="Freq. card." valor={hr} aoMudar={setHr} unidade="bpm" ph="72" />
                <Numerico rotulo="Temp." valor={temp} aoMudar={setTemp} unidade="°C" ph="36.6" />
                <Numerico rotulo="SpO₂" valor={spo2} aoMudar={setSpo2} unidade="%" ph="98" />
                <Numerico rotulo="Glicemia" valor={glucose} aoMudar={setGlucose} unidade="mg/dL" ph="100" />
                <Numerico rotulo="Peso" valor={weight} aoMudar={setWeight} unidade="kg" ph="70" />
              </div>
            </Grupo>

            <Grupo titulo="Alimentação e hidratação">
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {([['Pequeno-almoço', breakfast, setBreakfast],
                   ['Almoço', lunch, setLunch],
                   ['Jantar', dinner, setDinner]] as const).map(([rot, val, set]) => (
                  <div key={rot}>
                    <div style={{ ...ROTULO, marginBottom: 3 }}>{rot}</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[0, 25, 50, 75, 100].map(v => {
                        const on = val === v
                        return (
                          <button key={v} type="button" onClick={() => (set as any)(on ? null : v)}
                            className="mesa-botao"
                            style={{
                              ...MONO, fontSize: 'var(--t-meta)', padding: '0 8px', borderRadius: 'var(--r-sm)',
                              cursor: 'pointer',
                              border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                              background: on ? 'var(--green)' : 'transparent',
                              color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                              fontWeight: on ? 700 : 500,
                            }}>{v}%</button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <Numerico rotulo="Líquidos" valor={fluidMl} aoMudar={setFluidMl} unidade="ml" ph="1200" />
                <div>
                  <div style={{ ...ROTULO, marginBottom: 3 }}>Apetite</div>
                  <Escolha opcoes={APPETITE_OPTS} valor={appetite} aoEscolher={setAppetite} />
                </div>
              </div>
            </Grupo>

            <Grupo titulo="Eliminação">
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...ROTULO, marginBottom: 3 }}>Urinária</div>
                  <Escolha opcoes={URINARY_OPTS} valor={urinary} aoEscolher={setUrinary} />
                </div>
                <div>
                  <div style={{ ...ROTULO, marginBottom: 3 }}>Intestinal</div>
                  <Escolha opcoes={BOWEL_OPTS} valor={bowel} aoEscolher={setBowel} />
                </div>
              </div>
            </Grupo>

            <Grupo titulo="Humor e comportamento">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {MOOD_OPTS.map(o => {
                  const on = mood === o.v
                  return (
                    <button key={o.v} type="button" onClick={() => setMood(on ? null : o.v)}
                      className="mesa-botao"
                      style={{
                        ...MONO, fontSize: 'var(--t-meta)', padding: '0 10px', borderRadius: 'var(--r-sm)',
                        cursor: 'pointer',
                        border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                        background: on ? 'var(--green)' : 'transparent',
                        color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                        fontWeight: on ? 700 : 500,
                      }}>{o.v} {o.label}</button>
                  )
                })}
              </div>
              <input value={behavior} onChange={e => setBehavior(e.target.value)}
                placeholder="Comportamento — o que se notou de diferente"
                style={{ ...CAIXA, marginBottom: 8 }} />
              <input value={activities} onChange={e => setActivities(e.target.value)}
                placeholder="Atividades em que participou"
                style={CAIXA} />
            </Grupo>

            <Grupo titulo="Pele">
              <Escolha opcoes={SKIN_OPTS} valor={skin} aoEscolher={setSkin} />
              {skin && skin !== 'Íntegra' && (
                <input value={skinNotes} onChange={e => setSkinNotes(e.target.value)}
                  placeholder="Onde, e que aspeto tem"
                  style={{ ...CAIXA, marginTop: 8 }} />
              )}
            </Grupo>

            <Grupo titulo="Observações">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="O que o turno seguinte tem de saber."
                style={CAIXA_TEXTO} />
            </Grupo>
          </Painel>
        ) : largo ? (
          <Painel>
            <Vazio titulo="Escolha alguém à esquerda."
              oQueFazer="A coluna mostra quem já tem o registo deste turno feito e quem ainda não tem." />
          </Painel>
        ) : null}
      </div>
    </Mesa>
  )
}
