'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
// ── OS RASTREIOS SAÍRAM DAQUI (2026-10-22) ─────────────────────────────────
// A aba «Rastreios» propunha rastreios e vacinas a cada utente, com o que está
// «em falta agora» e a ação a tomar. Isso é uma recomendação de atuação
// preventiva sobre uma pessoa concreta — apoio à decisão clínica, e por isso
// dispositivo médico na aceção da Regra 11 do Regulamento (UE) 2017/745.
//
// O que fica é a AGENDA: o que foi marcado, quando, com quem, e se já foi.
// Marcar uma consulta é um facto administrativo. Dizer a alguém que consulta
// devia marcar é outra coisa, e não é coisa que este produto faça.
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Campo, Folha, CAIXA, CAIXA_TEXTO,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function AgendaPage() {
  return <AgendaTool />
}
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { printDoc, type PrintRecord } from '@/lib/print'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'

type ApptType = 'consulta' | 'exame' | 'terapia' | 'visita_medica' | 'transporte' | 'reuniao' | 'vacina' | 'outro'
type ApptStatus = 'scheduled' | 'done' | 'cancelled'

interface Patient { id: string; name: string; room_number?: string | null }
interface Appt {
  id: string; patient_id?: string | null; title: string; type: ApptType
  date: string; time?: string | null; end_time?: string | null; location?: string | null
  speciality?: string | null; transport?: boolean; transport_notes?: string | null
  responsible?: string | null; status: ApptStatus; notes?: string | null
}

/* O TIPO E UM FACTO, O ESTADO E QUE E ESTADO (2026-10-07)
   Eram oito cores — uma por tipo, e uma delas um `var(--green)` que nao existe em
   mais lado nenhum da aplicacao. Pior: a HORA, que e o dado mais importante
   desta pagina, era pintada da cor do tipo. Com o transporte a ambar, metade
   das linhas de uma manha pareciam avisos.

   O tipo passa a codigo. A cor fica para o estado, que e onde quer dizer
   alguma coisa: realizado, cancelado, por fazer. */
const TYPES: Record<ApptType, { label: string; codigo: string }> = {
  consulta:      { label: 'Consulta',      codigo: 'CONS' },
  exame:         { label: 'Exame',         codigo: 'EXA' },
  terapia:       { label: 'Terapia',       codigo: 'TERA' },
  visita_medica: { label: 'Visita médica', codigo: 'VIS' },
  transporte:    { label: 'Transporte',    codigo: 'TRAN' },
  reuniao:       { label: 'Reunião',       codigo: 'REUN' },
  vacina:        { label: 'Vacina',        codigo: 'VAC' },
  outro:         { label: 'Outro',         codigo: 'OUTR' },
}
const STATUS: Record<ApptStatus, { label: string; color: string }> = {
  scheduled: { label: 'Por fazer',  color: 'var(--ink-4)' },
  done:      { label: 'Realizado',  color: 'var(--green)' },
  cancelled: { label: 'Cancelado',  color: 'var(--red)' },
}
const TYPE_KEYS = Object.keys(TYPES) as ApptType[]
const todayStr = () => new Date().toISOString().slice(0, 10)

function AgendaTool() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const largo = useLargo()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const [patients, setPatients] = useState<Patient[]>([])
  const [appts, setAppts] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [view, setView] = useState<'hoje' | 'proximas' | 'todas'>('hoje')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const blank = { patient_id: '', title: '', type: 'consulta' as ApptType, date: todayStr(), time: '', location: '', speciality: '', transport: false, transport_notes: '', responsible: '', notes: '' }
  const [form, setForm] = useState<any>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, a] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).order('name'),
      scope.filter(supabase.from('appointments').select('*')).order('date').order('time'),
    ])
    setPatients(p.data || [])
    if (a.error) { setTableMissing(true); setAppts([]) }
    else { setTableMissing(false); setAppts(a.data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['appointments', 'patients'], userId: scope.liveFilterValue || user?.id, onChange: load })

  const nameOf = (id?: string | null) => id ? (patients.find(p => p.id === id)?.name || cfg.personNoun) : cfg.noPersonEventLabel
  // Só mostramos "quarto" onde isso existe (lar). Noutras instituições não há camas.
  const roomOf = (id?: string | null) => { if (!cfg.hasBeds) return ''; const r = id && patients.find(p => p.id === id)?.room_number; return r ? `${cfg.roomLabel[0]}${r}` : '' }

  function openNew() { setForm(blank); setEditId(null); setShowForm(true) }
  function openEdit(a: Appt) { setForm({ patient_id: a.patient_id || '', title: a.title, type: a.type, date: a.date, time: a.time || '', location: a.location || '', speciality: a.speciality || '', transport: !!a.transport, transport_notes: a.transport_notes || '', responsible: a.responsible || '', notes: a.notes || '' }); setEditId(a.id); setShowForm(true) }
  async function save() {
    if (!user || !form.title.trim() || !form.date) return
    if (!scope.canEdit) { alert('A sua conta é só de leitura.'); return }
    setSaving(true)
    const payload = scope.stamp({ ...form, patient_id: form.patient_id || null, updated_at: new Date().toISOString() })
    const { error } = editId
      ? await supabase.from('appointments').update(payload).eq('id', editId)
      : await supabase.from('appointments').insert(payload)
    setSaving(false)
    if (error) { alert('Não foi possível guardar: ' + error.message); return }
    setShowForm(false); load()
  }
  async function setStatus(a: Appt, status: ApptStatus) {
    await supabase.from('appointments').update({ status }).eq('id', a.id)
    setAppts(prev => prev.map(x => x.id === a.id ? { ...x, status } : x))
  }
  async function remove(a: Appt) {
    if (!confirm('Eliminar este agendamento?')) return
    await supabase.from('appointments').delete().eq('id', a.id)
    setAppts(prev => prev.filter(x => x.id !== a.id))
  }

  const today = todayStr()
  const visible = appts.filter(a => {
    if (view === 'hoje') return a.date === today && a.status !== 'cancelled'
    if (view === 'proximas') return a.date >= today && a.status === 'scheduled'
    return true
  })
  // group by date
  const groups = new Map<string, Appt[]>()
  visible.forEach(a => { if (!groups.has(a.date)) groups.set(a.date, []); groups.get(a.date)!.push(a) })
  const dates = Array.from(groups.keys()).sort()

  const stats = {
    hoje: appts.filter(a => a.date === today && a.status === 'scheduled').length,
    transportes: appts.filter(a => a.date === today && a.transport && a.status === 'scheduled').length,
    semana: appts.filter(a => a.date >= today && a.date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) && a.status === 'scheduled').length,
  }

  function fmtDate(d: string) {
    const dt = new Date(d + 'T12:00:00')
    if (d === today) return 'Hoje'
    if (d === new Date(Date.now() + 86400000).toISOString().slice(0, 10)) return 'Amanhã'
    return dt.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Folha de transportes do dia — para o motorista/coordenação
  function printTransports() {
    const list = appts.filter(a => a.date === today && a.transport && a.status === 'scheduled')
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    if (list.length === 0) { alert('Sem transportes agendados para hoje.'); return }
    const records: PrintRecord[] = list.map(a => ({
      title: `${a.time || '--:--'} · ${nameOf(a.patient_id)}${roomOf(a.patient_id) ? ` (${roomOf(a.patient_id)})` : ''}`,
      fields: [
        { label: 'Motivo', value: `${TYPES[a.type].label}${a.speciality ? ' — ' + a.speciality : ''}` },
        { label: 'Destino', value: a.location || '—' },
        ...(a.responsible ? [{ label: 'Acompanhante', value: a.responsible }] : []),
      ],
      ...(a.transport_notes ? { body: a.transport_notes } : {}),
    }))
    printDoc({
      docTitle: 'Folha de Transportes',
      docSubtitle: new Date(today + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      institution: cfg.unitNoun,
      meta: [{ label: 'transportes', value: String(list.length) }],
      sections: [{ heading: 'Saídas de hoje', records }],
      footerNote: 'Folha de transportes · Phlox',
    })
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     A pergunta da manhã é «quem é que hoje sai, a que horas, e com que
     transporte». Nenhuma das três era uma coluna: a hora vinha pintada da cor
     do tipo, o transporte era um selo escondido no meio da linha, e as ações
     eram três quadrados de 30px com um SVG dentro, sem rótulo nenhum.

     Passa a tabela: hora | o que é · quem | tipo | onde | transporte | estado.
     Os dias separam-se com uma linha de grupo que fica colada ao topo.
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Agenda</span>

          <Seletor
            opcoes={[
              { id: 'hoje', rotulo: 'Hoje' },
              { id: 'proximas', rotulo: 'Próximas' },
              { id: 'todas', rotulo: 'Todas' },
            ]}
            ativa={view} aoMudar={v => setView(v as 'hoje' | 'proximas' | 'todas')} />

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {stats.hoje} HOJE
              </span>
              {stats.transportes > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
                  {stats.transportes} COM TRANSPORTE
                </span>
              )}
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                {stats.semana} NOS PRÓXIMOS 7 DIAS
              </span>
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Botao onClick={printTransports}
              titulo="A folha que vai com quem conduz: quem sai, a que horas, para onde.">
              FOLHA DE TRANSPORTES{stats.transportes ? ` · ${stats.transportes}` : ''}
            </Botao>
            <Botao feitio="principal" onClick={openNew}>+ AGENDAR</Botao>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--amber)' }}>TRANSPORTE = tem de sair da casa</span>
          <span style={{ ...MONO, color: 'var(--green)' }}>REALIZADO</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>CANCELADO</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            {cfg.appointmentNounPlural}, exames, terapias, visitas e transportes —
            por {cfg.personNoun.toLowerCase()}, num só sítio
          </span>
        </BarraDeEstado>
      }
    >
      {tableMissing ? (
        <Painel>
          <Vazio titulo="A agenda ainda não está disponível nesta conta."
            oQueFazer="Falta um passo de configuração desta casa. Assim que estiver feito, esta página junta consultas, exames e transportes num só sítio." />
        </Painel>
      ) : (
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, width: 48 }}>Hora</span>
              <span style={{ ...ROTULO, flex: 1 }}>O que é · quem</span>
              <span style={{ ...ROTULO, width: 48 }}>Tipo</span>
              <span style={{ ...ROTULO, width: 110 }}>Onde</span>
              <span style={{ ...ROTULO, width: 76 }}>Transporte</span>
              <span style={{ ...ROTULO, width: 76 }}>Estado</span>
              <span style={{ ...ROTULO, width: 150 }}> </span>
            </Cabecalho>
          }
          rodape={<span style={MONO}>{visible.length} de {appts.length}</span>}
        >
          {loading ? (
            <ACarregar oQue="A abrir a agenda…" />
          ) : dates.length === 0 ? (
            <Vazio
              titulo={view === 'hoje' ? 'Nada agendado para hoje.' : 'Sem agendamentos.'}
              oQueFazer="Consultas, exames, terapias e visitas — com e sem transporte. O que tiver transporte marcado sai depois na folha que vai com quem conduz."
              acao={<Botao feitio="principal" onClick={openNew}>+ AGENDAR</Botao>} />
          ) : dates.map(d => (
            <div key={d}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 12px', background: 'var(--bg-2)',
                borderTop: '1px solid var(--border-2)', borderBottom: '1px solid var(--border)',
                position: 'sticky', top: 0, zIndex: 1,
              }}>
                <span style={{ ...ROTULO, flex: 1 }}>{fmtDate(d)}</span>
                <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                  {groups.get(d)!.length}
                </span>
              </div>

              {groups.get(d)!
                .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                .map(a => {
                  const tc = TYPES[a.type] || TYPES.outro
                  const st = STATUS[a.status]
                  return (
                    <LinhaTabela key={a.id}
                      filete={a.status === 'cancelled' ? 'var(--red)' : a.transport ? 'var(--amber)' : undefined}
                      antes={{
                        largura: 48,
                        conteudo: (
                          <span style={{
                            ...MONO, fontSize: 'var(--t-dado)',
                            fontWeight: 'var(--peso-forte)' as any,
                            color: a.status === 'cancelled' ? 'var(--ink-5)' : 'var(--ink-2)',
                            textDecoration: a.status === 'cancelled' ? 'line-through' : 'none',
                          }}>{a.time?.slice(0, 5) || '—'}</span>
                        ),
                      }}
                      principal={a.title}
                      secundaria={[nameOf(a.patient_id), roomOf(a.patient_id), a.responsible]
                        .filter(Boolean).join(' · ') || undefined}
                      celulas={[
                        { rotulo: 'Tipo', valor: tc.codigo, largura: 48 },
                        { rotulo: 'Onde', valor: a.location || '—', largura: 110 },
                        {
                          rotulo: 'Transporte', largura: 76,
                          valor: a.transport ? 'SIM' : '—',
                          forte: !!a.transport,
                          cor: a.transport ? 'var(--amber)' : 'var(--ink-5)',
                        },
                        {
                          rotulo: 'Estado', valor: st.label.toUpperCase(), largura: 76,
                          cor: st.color, forte: a.status !== 'scheduled',
                        },
                      ]}
                      fim={
                        a.status === 'scheduled' ? (
                          <>
                            <Botao onClick={() => setStatus(a, 'done')}>FEITO</Botao>
                            <Botao onClick={() => openEdit(a)}>MUDAR</Botao>
                            <Botao feitio="calmo" onClick={() => remove(a)}>APAGAR</Botao>
                          </>
                        ) : (
                          <Botao feitio="calmo" onClick={() => remove(a)}>APAGAR</Botao>
                        )
                      } />
                  )
                })}
            </div>
          ))}
        </Painel>
      )}
    </Mesa>

    {showForm && (
      <Folha titulo={editId ? 'Mudar o agendamento' : 'Novo agendamento'} aoFechar={() => setShowForm(false)}>
        <Campo rotulo="O que é" para="ag-titulo" obrigatorio>
          <input id="ag-titulo" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Ex: Consulta de cardiologia" style={{ ...CAIXA, width: '100%' }} />
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Tipo" para="ag-tipo">
            <select id="ag-tipo" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              style={{ ...CAIXA, width: '100%' }}>
              {TYPE_KEYS.map(t => <option key={t} value={t}>{TYPES[t].label}</option>)}
            </select>
          </Campo>
          <Campo rotulo={cfg.personNoun} para="ag-pessoa">
            <select id="ag-pessoa" value={form.patient_id}
              onChange={e => setForm({ ...form, patient_id: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              <option value="">{cfg.noPersonEventLabel}</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Campo>
        </div>

        <Campo rotulo="Quando" obrigatorio>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
            <input aria-label="Data" type="date" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })} style={CAIXA} />
            <input aria-label="Hora" type="time" value={form.time}
              onChange={e => setForm({ ...form, time: e.target.value })} style={CAIXA} />
          </div>
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Onde" para="ag-local">
            <input id="ag-local" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="Hospital, clínica…" style={{ ...CAIXA, width: '100%' }} />
          </Campo>
          <Campo rotulo="Quem acompanha" para="ag-resp">
            <input id="ag-resp" value={form.responsible}
              onChange={e => setForm({ ...form, responsible: e.target.value })} style={{ ...CAIXA, width: '100%' }} />
          </Campo>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          marginTop: 14, fontSize: 'var(--t-dado)', color: 'var(--ink)',
        }}>
          <input type="checkbox" checked={form.transport}
            onChange={e => setForm({ ...form, transport: e.target.checked })}
            style={{ accentColor: 'var(--green)' }} />
          Tem de sair da casa — precisa de transporte
        </label>

        {form.transport && (
          <Campo rotulo="O que quem conduz precisa de saber" para="ag-transp">
            <input id="ag-transp" value={form.transport_notes}
              onChange={e => setForm({ ...form, transport_notes: e.target.value })}
              placeholder="Ambulância, cadeira de rodas, hora de saída…"
              style={{ ...CAIXA, width: '100%' }} />
          </Campo>
        )}

        <Campo rotulo="Notas" para="ag-notas">
          <textarea id="ag-notas" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2} style={{ ...CAIXA_TEXTO, width: '100%' }} />
        </Campo>

        <div style={{ marginTop: 16 }}>
          <Botao feitio="principal" onClick={save} esperando={saving} disabled={!form.title.trim()}>
            {editId ? 'GUARDAR AS ALTERAÇÕES' : 'AGENDAR'}
          </Botao>
        </div>
      </Folha>
    )}
    </>
  )
}
