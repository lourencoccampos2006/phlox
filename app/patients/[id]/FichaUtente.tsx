'use client'

// FichaUtente — a ficha de utente de lares e centros de dia, a partir de
// docs/designs/Ficha de Utente v3 (offline).html.
//
// A página antiga era um formulário: campos, secções, botões de editar. Esta é
// uma LEITURA — foi desenhada para quem chega ao pé de uma pessoa e precisa de
// saber, em cinco segundos, o que já foi feito hoje e o que falta. Editar
// continua a existir, mas deixou de ser o que a página é.
//
// Duas regras herdadas do resto desta ronda:
//   · Nenhum número sem registo por trás. Onde não há dados, diz-se.
//   · Nada de percentagens de adesão. patient_meds.frequency é texto livre, e
//     já houve aqui um dossier a dar 100% a quem tinha um dia registado.

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { ptDate } from '@/lib/ptTime'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

const TURNOS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const ONDE: Record<string, string> = { centro: 'no centro', casa: 'em casa', ambos: 'casa + centro' }

function Seccao({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 'var(--space-14)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>{titulo}</span>
        {extra && <span style={{ ...MONO, color: 'var(--ink-5)' }}>{extra}</span>}
      </div>
      {children}
    </section>
  )
}

function Etiqueta({ tom, children }: { tom: 'verde' | 'ambar' | 'cinza'; children: React.ReactNode }) {
  const cores = {
    verde: { bg: 'var(--badge-green-bg)', bd: 'var(--badge-green-border)', fg: 'var(--badge-green-fg)' },
    ambar: { bg: 'var(--badge-amber-bg)', bd: 'var(--badge-amber-border)', fg: 'var(--badge-amber-fg)' },
    cinza: { bg: 'var(--bg-2)', bd: 'var(--border)', fg: 'var(--ink-4)' },
  }[tom]
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.09em', textTransform: 'uppercase',
      fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--r-sm)', whiteSpace: 'nowrap',
      background: cores.bg, border: `1px solid ${cores.bd}`, color: cores.fg,
    }}>{children}</span>
  )
}

type Props = {
  pid: string
  /**
   * A fila de ações (imprimir, editar, arquivar).
   *
   * Vem de fora em vez de viver aqui porque essas funções — cartão de
   * emergência, ficha clínica, relatório do mês, dossier mensal — são 200
   * linhas de HTML de impressão que já existiam e funcionavam. Trazê-las para
   * dentro desta ficha era reescrevê-las, e reescrever código de impressão que
   * já saiu certo em papel é como se perdem features sem ninguém dar por isso.
   */
  acoes?: React.ReactNode
  /** Botões da secção de medicação ("+ Medicamento", "Verificar interações"). */
  acoesMedicacao?: React.ReactNode
  /** Botões da secção de contactos ("+ Contacto"). */
  acoesContactos?: React.ReactNode
  /**
   * Pedidos e observações do utente. Entra como secção logo a seguir a "O
   * dia", porque é a mesma pergunta: o que está por resolver com esta pessoa.
   */
  pedidos?: React.ReactNode
  /**
   * Revisão da medicação. Entra a seguir à lista de medicação, que é onde
   * pertence — analisar a medicação longe da medicação obriga a subir e descer
   * a página para confrontar as duas coisas.
   */
  revisaoMedicacao?: React.ReactNode
  /** Modais e diálogos que a página dona quer manter montados. */
  children?: React.ReactNode
  /** Avisa a página dona que os dados mudaram (depois de gravar num modal). */
  aoMudar?: (recarregar: () => void) => void
}

export default function FichaUtente({ pid, acoes, acoesMedicacao, acoesContactos, pedidos, revisaoMedicacao, children, aoMudar }: Props) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const cfg = institutionConfig(institution)
  const cor = bp.accent

  const [carregando, setCarregando] = useState(true)
  const [utente, setUtente] = useState<any | null>(null)
  const [meds, setMeds] = useState<any[]>([])
  const [tomas, setTomas] = useState<any[]>([])
  const [registos, setRegistos] = useState<any[]>([])
  const [presenca, setPresenca] = useState<any | null>(null)
  const [contactos, setContactos] = useState<any[]>([])
  const [ocorrencias, setOcorrencias] = useState<any[]>([])

  const carregar = useCallback(async () => {
    if (!user || !pid) { setCarregando(false); return }
    const d = ptDate()
    const tol = async (q: any) => { try { const r = await q; return r.error ? { data: [] } : r } catch { return { data: [] } } }
    const [p, md, mar, cr, att, ct, inc] = await Promise.all([
      tol(supabase.from('patients').select('*').eq('id', pid).maybeSingle()),
      tol(supabase.from('patient_meds').select('id,name,dose,frequency,indication,shifts,take_location,active').eq('patient_id', pid)),
      tol(supabase.from('mar_records').select('id,med_id,status,shift,recorded_at,notes').eq('patient_id', pid).eq('date', d)),
      tol(supabase.from('care_records').select('id,created_at,nutrition,mood,vitals,notes').eq('patient_id', pid).eq('date', d)),
      tol(supabase.from('attendance').select('status,arrived_at,left_at').eq('patient_id', pid).eq('date', d).maybeSingle()),
      tol(supabase.from('resident_contacts').select('*').eq('patient_id', pid)),
      tol(supabase.from('incidents').select('id,date,type,description').eq('patient_id', pid).eq('status', 'open')),
    ])
    setUtente((p as any).data || null)
    setMeds(((md as any).data || []).filter((m: any) => m.active !== false))
    setTomas((mar as any).data || [])
    setRegistos((cr as any).data || [])
    setPresenca((att as any).data || null)
    setContactos((ct as any).data || [])
    setOcorrencias((inc as any).data || [])
    setCarregando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, pid])

  useEffect(() => { carregar() }, [carregar])
  // Dá à página dona uma forma de mandar recarregar depois de gravar num modal.
  useEffect(() => { aoMudar?.(carregar) }, [aoMudar, carregar])

  /** Estado de cada medicamento hoje, cruzando a prescrição com o MAR. */
  const medicacao = useMemo(() => meds.map(m => {
    const suas = tomas.filter(t => t.med_id === m.id)
    const dada = suas.find(t => t.status === 'administered' || t.status === 'given' || t.status === 'taken')
    const recusada = suas.find(t => t.status === 'refused' || t.status === 'held')
    const emCasa = m.take_location === 'casa'
    return {
      ...m,
      turnos: (Array.isArray(m.shifts) && m.shifts.length ? m.shifts : []).map((s: string) => TURNOS[s] || s),
      estado: emCasa ? 'casa' : dada ? 'dada' : recusada ? 'recusada' : 'por-dar',
      hora: dada?.recorded_at ? new Date(dada.recorded_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : null,
    }
  }), [meds, tomas])

  const porDar = medicacao.filter(m => m.estado === 'por-dar')
  const noCentro = medicacao.filter(m => m.take_location !== 'casa').length
  const emCasa = medicacao.length - noCentro

  /** A linha do dia: tudo o que ficou registado, por ordem de hora. */
  const linhaDoDia = useMemo(() => {
    const itens: { hora: string; titulo: string; detalhe?: string; feito: boolean }[] = []
    if (presenca?.arrived_at) {
      itens.push({
        hora: new Date(presenca.arrived_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        titulo: `Chegada ${institution === 'day_care' ? 'ao centro' : ''}`.trim(), feito: true,
      })
    }
    tomas.forEach(t => {
      const m = meds.find(x => x.id === t.med_id)
      if (!m) return
      const dada = t.status === 'administered' || t.status === 'given' || t.status === 'taken'
      itens.push({
        hora: t.recorded_at ? new Date(t.recorded_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—',
        titulo: `${m.name}${m.dose ? ` ${m.dose}` : ''}`,
        detalhe: dada ? 'Dada' : t.status === 'refused' ? 'Recusada' : 'Suspensa',
        feito: dada,
      })
    })
    registos.forEach(r => {
      itens.push({
        hora: r.created_at ? new Date(r.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—',
        titulo: 'Registo do dia',
        detalhe: [r.nutrition && `Alimentação: ${r.nutrition}`, r.mood && `Humor: ${r.mood}`].filter(Boolean).join(' · ') || undefined,
        feito: true,
      })
    })
    return itens.sort((a, b) => a.hora.localeCompare(b.hora))
  }, [presenca, tomas, meds, registos, institution])

  /** A última nota escrita hoje sobre esta pessoa. Não é gerada — é o que a
   *  equipa escreveu. Sem nota, não se inventa uma. */
  const nota = useMemo(() => {
    const comNota = registos.filter(r => (r.notes || '').trim())
    if (!comNota.length) return null
    const ultima = comNota[comNota.length - 1]
    return {
      texto: ultima.notes as string,
      hora: ultima.created_at ? new Date(ultima.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '',
    }
  }, [registos])

  const sinais = useMemo(() => {
    const comVitais = registos.filter(r => r.vitals && Object.keys(r.vitals).length)
    if (!comVitais.length) return null
    const v = comVitais[comVitais.length - 1].vitals as Record<string, any>
    const campos = [
      { k: 'bp', l: 'T.A.' }, { k: 'hr', l: 'F.C.' }, { k: 'temp', l: 'Temp.' },
      { k: 'spo2', l: 'SpO₂' }, { k: 'glucose', l: 'Glicemia' },
    ].map(c => ({ ...c, v: v[c.k] })).filter(c => c.v != null && c.v !== '')
    return campos.length ? campos : null
  }, [registos])

  if (carregando) return <div style={{ padding: 'var(--space-14)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar…</div>
  if (!utente) {
    return (
      <div style={{ padding: 'var(--space-14)' }}>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 'var(--space-5)' }}>Não foi possível encontrar esta pessoa.</p>
        <Link href="/patients" style={{ color: cor, fontWeight: 700, fontSize: 14 }}>← Voltar a {cfg.personNounPlural.toLowerCase()}</Link>
      </div>
    )
  }

  const chegada = presenca?.arrived_at
    ? new Date(presenca.arrived_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : null
  const subtitulo = [
    chegada ? `${institution === 'day_care' ? 'No centro' : 'Presente'} desde ${chegada}` : null,
    utente.age ? `${utente.age} anos` : null,
    utente.room_number ? (institution === 'day_care' ? `Sala ${utente.room_number}` : `Quarto ${utente.room_number}`) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ padding: 'var(--space-11) clamp(16px,3vw,32px) var(--space-18)', maxWidth: 780, margin: '0 auto' }}>

      <Link href="/patients" style={{ ...MONO, textDecoration: 'none', display: 'inline-block', marginBottom: 'var(--space-8)' }}>
        ← {cfg.personNounPlural}
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-9)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px,4.2vw,44px)', fontWeight: 500,
            color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1.08, margin: 0,
          }}>{utente.name}</h1>
          {subtitulo && (
            <div style={{ ...MONO, marginTop: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 7 }}>
              {chegada && <span style={{ width: 6, height: 6, borderRadius: '50%', background: cor }} />}
              {subtitulo}
            </div>
          )}
        </div>
        <Link href={`/care-log?patient=${pid}`} style={{
          padding: '12px 22px', background: 'var(--ink)', color: 'white', borderRadius: 'var(--r-md)',
          fontSize: 13.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}>Registar o dia</Link>
      </div>

      {/* A nota da equipa. Só aparece se alguém a escreveu. */}
      {nota && (
        <blockquote style={{
          margin: 'var(--space-11) 0 0', paddingLeft: 'var(--space-8)',
          borderLeft: `2px solid ${cor}`,
        }}>
          <p style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(17px,2vw,21px)', lineHeight: 1.5,
            color: 'var(--ink-2)', margin: 0, fontStyle: 'italic',
          }}>{nota.texto}</p>
          <div style={{ ...MONO, marginTop: 'var(--space-5)' }}>{nota.hora}</div>
        </blockquote>
      )}

      {/* O que falta agora — o cartão escuro do design. Só existe se houver
          mesmo algo por dar; sem isso, seria um cartão a chamar a atenção para
          nada. */}
      {porDar.length > 0 && (
        <div style={{
          marginTop: 'var(--space-11)', background: 'var(--ink)', borderRadius: 'var(--r-lg)',
          padding: 'var(--space-10) var(--space-11)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 'var(--space-9)', flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...MONO, color: 'rgba(255,255,255,0.55)', marginBottom: 'var(--space-4)' }}>A seguir</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', letterSpacing: '-0.02em' }}>
              {porDar[0].name}{porDar[0].dose ? ` ${porDar[0].dose}` : ''}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', marginTop: 5 }}>
              {porDar[0].turnos.length ? `Toma d${porDar[0].turnos.length === 1 ? 'a ' + porDar[0].turnos[0].toLowerCase() : 'e vários turnos'}` : 'Por dar'}
              {porDar.length > 1 ? ` · mais ${porDar.length - 1} por dar` : ''}
            </div>
          </div>
          <Link href={`/mar?patient=${pid}`} style={{
            padding: '11px 24px', background: 'white', color: 'var(--ink)', borderRadius: 'var(--r-md)',
            fontSize: 13.5, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
          }}>Dar</Link>
        </div>
      )}

      {/* O dia */}
      <Seccao titulo={`O dia d${(utente.sex || '').toLowerCase().startsWith('f') ? 'ela' : 'ele'}`}
        extra={porDar.length ? `${porDar.length} por fazer` : undefined}>
        {linhaDoDia.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--ink-4)', padding: 'var(--space-9) 0', lineHeight: 1.6 }}>
            Ainda não há nada registado hoje. <Link href={`/care-log?patient=${pid}`} style={{ color: cor, fontWeight: 700 }}>Começar o registo →</Link>
          </p>
        ) : linhaDoDia.map((i, k) => (
          <div key={k} style={{
            display: 'grid', gridTemplateColumns: '58px 1fr', gap: 'var(--space-7)',
            padding: 'var(--space-7) 0', borderBottom: '1px solid var(--bg-2)', alignItems: 'start',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-5)', paddingTop: 2 }}>{i.hora}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>{i.titulo}</div>
              {i.detalhe && <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.5 }}>{i.detalhe}</div>}
            </div>
          </div>
        ))}
      </Seccao>

      {pedidos && <Seccao titulo="Pedidos e observações">{pedidos}</Seccao>}

      {/* Nunca esquecer */}
      {(utente.allergies || utente.life_story?.sensitivities || utente.conditions || ocorrencias.length > 0) && (
        <Seccao titulo="Nunca esquecer">
          {utente.allergies && (
            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 'var(--space-7)', padding: 'var(--space-7) 0', borderBottom: '1px solid var(--bg-2)' }}>
              <span style={{ ...MONO, color: '#b91c1c' }}>Alergias</span>
              <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{utente.allergies}</span>
            </div>
          )}
          {/* "Cuidados" — no design é a linha do meio, e o exemplo dela é
              literalmente uma preferência ("Duche, nunca banho de imersão.
              Trata-se por Dona Fernanda."). É onde as sensibilidades desta
              pessoa pertencem: a coisa que quem entra ao turno tem de saber
              antes de lhe tocar. */}
          {utente.life_story?.sensitivities && (
            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 'var(--space-7)', padding: 'var(--space-7) 0', borderBottom: '1px solid var(--bg-2)' }}>
              <span style={{ ...MONO, color: '#92400e' }}>Cuidados</span>
              <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{utente.life_story.sensitivities}</span>
            </div>
          )}
          {utente.conditions && (
            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 'var(--space-7)', padding: 'var(--space-7) 0', borderBottom: '1px solid var(--bg-2)' }}>
              <span style={MONO}>Condições</span>
              <span style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{utente.conditions}</span>
            </div>
          )}
          {ocorrencias.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 'var(--space-7)', padding: 'var(--space-7) 0' }}>
              <span style={{ ...MONO, color: '#92400e' }}>Em aberto</span>
              <span style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>
                {ocorrencias.map(o => o.description || o.type).join(' · ')}
              </span>
            </div>
          )}
        </Seccao>
      )}

      {/* Medicação */}
      <Seccao titulo="Medicação" extra={medicacao.length ? `${noCentro} aqui${emCasa ? ` · ${emCasa} em casa` : ''}` : undefined}>
        {medicacao.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--ink-4)', padding: 'var(--space-9) 0' }}>Sem medicação registada.</p>
        ) : medicacao.map(m => (
          <div key={m.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-7)',
            padding: 'var(--space-7) 0', borderBottom: '1px solid var(--bg-2)',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, color: 'var(--ink)' }}>
                <span style={{ fontWeight: 600 }}>{m.name}</span>
                {m.dose && <span style={{ color: 'var(--ink-4)' }}> {m.dose}</span>}
              </div>
              <div style={{ ...MONO, fontSize: 9.5, marginTop: 4 }}>
                {[m.turnos.join(' · ') || m.frequency, m.indication, ONDE[m.take_location] || null].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              {m.estado === 'dada' && <Etiqueta tom="verde">dada {m.hora}</Etiqueta>}
              {m.estado === 'por-dar' && <Etiqueta tom="ambar">por dar</Etiqueta>}
              {m.estado === 'recusada' && <Etiqueta tom="ambar">recusada</Etiqueta>}
              {m.estado === 'casa' && <Etiqueta tom="cinza">em casa</Etiqueta>}
            </div>
          </div>
        ))}
        {acoesMedicacao && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', paddingTop: 'var(--space-8)' }}>
            {acoesMedicacao}
          </div>
        )}
      </Seccao>

      {revisaoMedicacao && <Seccao titulo="Revisão da medicação">{revisaoMedicacao}</Seccao>}

      {/* Sinais vitais */}
      {sinais && (
        <Seccao titulo="Sinais vitais">
          <div style={{ display: 'flex', gap: 'var(--space-14)', flexWrap: 'wrap', padding: 'var(--space-9) 0' }}>
            {sinais.map(s => (
              <div key={s.k}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', lineHeight: 1 }}>{String(s.v)}</div>
                <div style={{ ...MONO, marginTop: 6 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Seccao>
      )}

      {/* A pessoa — composta dos campos que a história de vida tem mesmo.
          Estava a ler `life_story.summary`, que não existe no tipo: caía
          sempre para as notas e a história de vida nunca aparecia. */}
      {(() => {
        const h = utente.life_story || {}
        const partes = [h.profession, h.family, h.hobbies, h.music, h.notes].filter((x: any) => (x || '').trim())
        if (!partes.length && !(utente.notes || '').trim()) return null
        return (
          <Seccao titulo="A pessoa">
            <div style={{ padding: 'var(--space-9) 0 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {partes.map((t: string, i: number) => (
                <p key={i} style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{t}</p>
              ))}
              {!partes.length && utente.notes && (
                <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{utente.notes}</p>
              )}
            </div>
          </Seccao>
        )
      })()}

      {/* Ações — impressão, edição, arquivo */}
      {acoes && (
        <Seccao titulo="Imprimir e gerir">
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', paddingTop: 'var(--space-9)' }}>
            {acoes}
          </div>
        </Seccao>
      )}

      {/* Contactos */}
      {(contactos.length > 0 || acoesContactos) && (
        <Seccao titulo="Contactos">
          {contactos.map(c => (
            <div key={c.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-7)',
              padding: 'var(--space-7) 0', borderBottom: '1px solid var(--bg-2)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>{c.name}</div>
                <div style={{ ...MONO, fontSize: 9.5, marginTop: 4 }}>
                  {[c.relationship, c.is_emergency ? 'contacto SOS' : null, c.phone].filter(Boolean).join(' · ')}
                </div>
              </div>
              {c.phone && (
                <a href={`tel:${c.phone}`} style={{ ...MONO, color: cor, textDecoration: 'none', flexShrink: 0 }}>Ligar</a>
              )}
            </div>
          ))}
          {contactos.length === 0 && (
            <p style={{ fontSize: 14, color: 'var(--ink-4)', padding: 'var(--space-9) 0 0' }}>Sem contactos registados.</p>
          )}
          {acoesContactos && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', paddingTop: 'var(--space-8)' }}>
              {acoesContactos}
            </div>
          )}
        </Seccao>
      )}

      {children}
    </div>
  )
}
