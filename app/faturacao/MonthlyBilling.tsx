'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { printDoc, type PrintRecord } from '@/lib/print'
import FinanceLedger from './FinanceLedger'
import ContaCorrente from './ContaCorrente'
import { useOrgName } from '@/lib/useOrgName'

interface Patient { id: string; name: string; room_number?: string | null; active?: boolean }
interface Entry {
  id: string; patient_id: string; month: string
  fee: number; subsidy: number; extras: number; discount: number
  paid: boolean; paid_date?: string | null; method?: string | null; notes?: string | null
}

const euro = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
const thisMonth = () => new Date().toISOString().slice(0, 7)
const due = (e: Entry) => e.fee + e.extras - e.subsidy - e.discount

import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho,
  Botao, Seletor, Vazio, ACarregar, Aviso, Campo, Folha, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function MonthlyBilling() {
  const largo = useLargo()
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O nome da casa, e nao o tipo dela. Os recibos e o mapa saiam assinados
  // «Lar» — que e o que a casa E, nao como se chama.
  const nomeCasa = useOrgName()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const personPlural = cfg.personNounPlural.toLowerCase()
  const [tab, setTab] = useState<'mensalidades' | 'conta' | 'movimentos'>('mensalidades')
  const [patients, setPatients] = useState<Patient[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [month, setMonth] = useState(thisMonth())
  const [generating, setGenerating] = useState(false)
  const [edit, setEdit] = useState<Entry | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, e] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number,active')).order('name'),
      scope.filter(supabase.from('billing_entries').select('*')),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    if (e.error) { setTableMissing(true); setEntries([]) } else { setTableMissing(false); setEntries(e.data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['billing_entries', 'patients'], userId: scope.liveFilterValue || user?.id, onChange: load })

  const nameOf = (id: string) => patients.find(p => p.id === id)?.name || cfg.personNoun
  const monthEntries = entries.filter(e => e.month === month)
  const byPatient: Record<string, Entry> = {}; monthEntries.forEach(e => { byPatient[e.patient_id] = e })

  // residents without an entry this month
  const missing = patients.filter(p => !byPatient[p.id])

  async function generateMonth() {
    if (!user || missing.length === 0) return
    setGenerating(true)
    // copia mensalidade/comparticipação do mês anterior do residente, se existir
    const rows = missing.map(p => {
      const prev = entries.filter(e => e.patient_id === p.id).sort((a, b) => b.month.localeCompare(a.month))[0]
      return scope.stamp({ patient_id: p.id, month, fee: prev?.fee || 0, subsidy: prev?.subsidy || 0, extras: 0, discount: 0, paid: false })
    })
    await supabase.from('billing_entries').insert(rows)
    setGenerating(false); load()
  }
  async function togglePaid(e: Entry) {
    const paid = !e.paid
    await supabase.from('billing_entries').update({ paid, paid_date: paid ? new Date().toISOString().slice(0, 10) : null }).eq('id', e.id)
    setEntries(prev => prev.map(x => x.id === e.id ? { ...x, paid, paid_date: paid ? new Date().toISOString().slice(0, 10) : null } : x))
  }
  async function saveEdit() {
    if (!user || !edit) return
    setSaving(true)
    await supabase.from('billing_entries').update({ fee: edit.fee, subsidy: edit.subsidy, extras: edit.extras, discount: edit.discount, method: edit.method || null, notes: edit.notes || null, updated_at: new Date().toISOString() }).eq('id', edit.id)
    setSaving(false); setEdit(null); load()
  }

  const totalFee = monthEntries.reduce((s, e) => s + due(e), 0)
  const received = monthEntries.filter(e => e.paid).reduce((s, e) => s + due(e), 0)
  const owed = totalFee - received
  const rate = totalFee > 0 ? Math.round((received / totalFee) * 100) : 0

  function printMonth() {
    const records: PrintRecord[] = monthEntries.map(e => ({
      title: nameOf(e.patient_id),
      tags: [{ label: e.paid ? 'Pago' : 'Pendente', color: e.paid ? 'var(--green)' : 'var(--amber)' }],
      fields: [
        { label: 'Mensalidade', value: euro(e.fee) },
        { label: 'Comparticipação', value: euro(e.subsidy) },
        { label: 'Extras', value: euro(e.extras) },
        { label: 'Desconto', value: euro(e.discount) },
        { label: 'A pagar', value: euro(due(e)) },
        { label: 'Pago em', value: e.paid_date || '—' },
      ],
    }))
    printDoc({
      docTitle: 'Mapa de Faturação',
      docSubtitle: new Date(month + '-01T12:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
      institution: nomeCasa || cfg.unitNoun,
      meta: [
        { label: 'faturado', value: euro(totalFee) },
        { label: 'recebido', value: euro(received) },
        { label: 'em dívida', value: euro(owed) },
        { label: 'cobrança', value: `${rate}%` },
      ],
      sections: [{ heading: cfg.personNounPlural, records: records.length ? records : [{ title: 'Sem registos neste mês' }] }],
      footerNote: 'Mapa de faturação · Phlox',
    })
  }

  // Recibo individual de mensalidade para entregar à família
  function printReceipt(e: Entry) {
    const mLabel = new Date(e.month + '-01T12:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    const lines: PrintRecord[] = [{
      title: `Mensalidade — ${mLabel}`,
      fields: [
        { label: 'Mensalidade', value: euro(e.fee) },
        ...(e.extras ? [{ label: 'Extras', value: euro(e.extras) }] : []),
        ...(e.subsidy ? [{ label: 'Comparticipação', value: `- ${euro(e.subsidy)}` }] : []),
        ...(e.discount ? [{ label: 'Desconto', value: `- ${euro(e.discount)}` }] : []),
        { label: 'TOTAL A PAGAR', value: euro(due(e)) },
      ],
      ...(e.notes ? { body: e.notes } : {}),
    }]
    printDoc({
      docTitle: e.paid ? 'Recibo de Mensalidade' : 'Aviso de Pagamento',
      docSubtitle: nameOf(e.patient_id),
      institution: nomeCasa || cfg.unitNoun,
      meta: [
        { label: 'estado', value: e.paid ? 'PAGO' : 'PENDENTE' },
        ...(e.paid && e.paid_date ? [{ label: 'pago em', value: e.paid_date }] : []),
        ...(e.method ? [{ label: 'método', value: e.method }] : []),
      ],
      sections: [
        { heading: 'Detalhe', records: lines },
        { heading: 'Validação', records: [{ title: 'Assinaturas', fields: [{ label: 'Recebido por', value: '' }, { label: 'Data', value: '' }] }] },
      ],
      footerNote: `${e.paid ? 'Recibo' : 'Aviso'} de mensalidade · Phlox`,
    })
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Cada pessoa era um cartão com a conta em texto corrido: «Mens. 450,00 € ·
     compart. 120,00 € · extras 15,00 € · desc. 0,00 €». Quatro valores numa
     frase não se somam de cabeça nem se comparam entre linhas — e a pergunta
     que se faz a esta página, «quem é que ainda não pagou», respondia-se a
     ler sessenta frases.

     Passa a tabela, com os quatro valores em colunas. Os números alinham, e a
     coluna «a pagar» lê-se de cima a baixo.
     ══════════════════════════════════════════════════════════════════════════ */
  const ordenadas = [...monthEntries].sort((a, b) =>
    Number(a.paid) - Number(b.paid) || nameOf(a.patient_id).localeCompare(nameOf(b.patient_id)))

  return (
    <>
    <Mesa
      altura={tab === 'mensalidades' ? 'janela' : 'documento'}
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Faturação</span>

          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            aria-label="Mês" style={{ ...CAIXA, width: 150 }} />

          {/* A conta de cada um fica no MEIO, e de propósito: as mensalidades
              são o acordo, a conta é o que cada pessoa deve de facto, e as
              despesas da casa são outra conversa. A ordem vai do mais próximo
              da pessoa para o mais longe. */}
          <Seletor
            opcoes={[
              { id: 'mensalidades', rotulo: 'Mensalidades' },
              { id: 'conta', rotulo: 'Conta de cada um' },
              { id: 'movimentos', rotulo: 'Despesas e receitas' },
            ]}
            ativa={tab} aoMudar={t => setTab(t as any)} />

          {tab === 'mensalidades' && !loading && !tableMissing && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {euro(totalFee)} FATURADO
              </span>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--green)' }}>
                {euro(received)} RECEBIDO
              </span>
              {owed > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
                  {euro(owed)} EM DÍVIDA
                </span>
              )}
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                {rate}% COBRADO
              </span>
            </span>
          )}

          {tab === 'mensalidades' && (
            <div style={{ marginLeft: 'auto' }}>
              <Botao onClick={printMonth}>IMPRIMIR O MAPA</Botao>
            </div>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        tab === 'mensalidades' ? (
          <BarraDeEstado>
            <span style={{ ...MONO, color: 'var(--green)' }}>PAGO</span>
            <span style={{ ...MONO, color: 'var(--amber)' }}>POR PAGAR</span>
            <span style={MONO}>A pagar = mensalidade − comparticipação + extras − desconto</span>
            <span style={{ ...MONO, color: 'var(--ink-5)' }}>
              Mensalidades, comparticipações, extras e pagamentos — por {cfg.personNoun.toLowerCase()} e por mês
            </span>
          </BarraDeEstado>
        ) : undefined
      }
    >
      {tab === 'movimentos' ? (
        <Painel>
          <div style={{ padding: 14 }}>
            <FinanceLedger month={month} monthlyReceived={received} />
          </div>
        </Painel>
      ) : tab === 'conta' ? (
        <Painel>
          <div style={{ padding: 14 }}>
            {/* Recebe as mensalidades que esta página já carregou. Uma segunda
                leitura das mesmas linhas acabaria por discordar da primeira —
                e num ecrã de dinheiro, duas respostas é não ter nenhuma. */}
            <ContaCorrente month={month} patients={patients} mensalidades={entries as any} />
          </div>
        </Painel>
      ) : tableMissing ? (
        <Painel>
          <Vazio titulo="A faturação ainda não está ativa nesta conta."
            oQueFazer="Fale connosco e ativamos — tudo o resto continua a funcionar normalmente." />
        </Painel>
      ) : (
        <>
          {missing.length > 0 && (
            <Aviso tom="atencao" titulo={`${missing.length} ${personPlural} sem faturação este mês`}>
              Os valores do mês anterior podem ser copiados de uma vez.{' '}
              <span style={{ display: 'inline-block', marginTop: 7 }}>
                <Botao feitio="principal" onClick={generateMonth} esperando={generating}>
                  GERAR O MÊS A PARTIR DO ANTERIOR
                </Botao>
              </span>
            </Aviso>
          )}

          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>{cfg.personNounPlural}</span>
                <span style={{ ...ROTULO, width: 76, textAlign: 'right' }}>Mensalid.</span>
                <span style={{ ...ROTULO, width: 76, textAlign: 'right' }}>Compart.</span>
                <span style={{ ...ROTULO, width: 66, textAlign: 'right' }}>Extras</span>
                <span style={{ ...ROTULO, width: 66, textAlign: 'right' }}>Desconto</span>
                <span style={{ ...ROTULO, width: 84, textAlign: 'right' }}>A pagar</span>
                <span style={{ ...ROTULO, width: 190 }}> </span>
              </Cabecalho>
            }
            rodape={
              <>
                <span style={MONO}>{ordenadas.length} linha{ordenadas.length === 1 ? '' : 's'}</span>
                <span style={{ ...MONO, marginLeft: 'auto' }}>
                  {euro(received)} de {euro(totalFee)} · {rate}% cobrado
                </span>
              </>
            }
          >
            {loading ? (
              <ACarregar oQue="A somar o mês…" />
            ) : ordenadas.length === 0 ? (
              <Vazio titulo="Sem faturação neste mês."
                oQueFazer="Os valores do mês anterior podem ser copiados de uma vez — e depois acerta-se o que mudou."
                acao={<Botao feitio="principal" onClick={generateMonth} esperando={generating}>
                  GERAR O MÊS A PARTIR DO ANTERIOR
                </Botao>} />
            ) : ordenadas.map(e => (
              <LinhaTabela key={e.id}
                filete={e.paid ? undefined : 'var(--amber)'}
                principal={nameOf(e.patient_id)}
                secundaria={e.method || undefined}
                celulas={[
                  { rotulo: 'Mensalidade', valor: euro(e.fee), largura: 76, direita: true },
                  { rotulo: 'Comparticipação', valor: e.subsidy ? euro(e.subsidy) : '—', largura: 76, direita: true, cor: e.subsidy ? 'var(--ink-3)' : 'var(--ink-5)' },
                  { rotulo: 'Extras', valor: e.extras ? euro(e.extras) : '—', largura: 66, direita: true, cor: e.extras ? 'var(--ink-3)' : 'var(--ink-5)' },
                  { rotulo: 'Desconto', valor: e.discount ? euro(e.discount) : '—', largura: 66, direita: true, cor: e.discount ? 'var(--ink-3)' : 'var(--ink-5)' },
                  { rotulo: 'A pagar', valor: euro(due(e)), largura: 84, direita: true, forte: true, cor: e.paid ? 'var(--green)' : 'var(--ink)' },
                ]}
                fim={
                  <>
                    <button type="button" className="mesa-botao" onClick={() => togglePaid(e)}
                      style={{
                        ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                        textTransform: 'uppercase', padding: '0 11px',
                        borderRadius: 'var(--r-md)', cursor: 'pointer', whiteSpace: 'nowrap',
                        border: `1px solid ${e.paid ? 'var(--green)' : 'var(--amber)'}`,
                        background: e.paid ? 'var(--green)' : 'transparent',
                        color: e.paid ? 'var(--sobre-acento)' : 'var(--amber)',
                        fontWeight: 'var(--peso-forte)' as any,
                      }}>{e.paid ? 'Pago' : 'Marcar pago'}</button>
                    <Botao onClick={() => printReceipt(e)}
                      titulo={e.paid ? 'Imprimir o recibo' : 'Imprimir o aviso de pagamento'}>
                      {e.paid ? 'RECIBO' : 'AVISO'}
                    </Botao>
                    <Botao feitio="calmo" onClick={() => setEdit(e)}>MUDAR</Botao>
                  </>
                } />
            ))}
          </Painel>
        </>
      )}
    </Mesa>

    {edit && (
      <Folha titulo={nameOf(edit.patient_id)} aoFechar={() => setEdit(null)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Mensalidade (€)" para="fat-fee">
            <input id="fat-fee" type="number" inputMode="decimal" value={edit.fee}
              onChange={e => setEdit({ ...edit, fee: parseFloat(e.target.value) || 0 })}
              style={{ ...CAIXA, width: '100%' }} />
          </Campo>
          <Campo rotulo="Comparticipação (€)" para="fat-sub"
            ajuda="O que a Segurança Social ou outra entidade paga — abate ao que a família paga.">
            <input id="fat-sub" type="number" inputMode="decimal" value={edit.subsidy}
              onChange={e => setEdit({ ...edit, subsidy: parseFloat(e.target.value) || 0 })}
              style={{ ...CAIXA, width: '100%' }} />
          </Campo>
          <Campo rotulo="Extras (€)" para="fat-ext">
            <input id="fat-ext" type="number" inputMode="decimal" value={edit.extras}
              onChange={e => setEdit({ ...edit, extras: parseFloat(e.target.value) || 0 })}
              style={{ ...CAIXA, width: '100%' }} />
          </Campo>
          <Campo rotulo="Desconto (€)" para="fat-desc">
            <input id="fat-desc" type="number" inputMode="decimal" value={edit.discount}
              onChange={e => setEdit({ ...edit, discount: parseFloat(e.target.value) || 0 })}
              style={{ ...CAIXA, width: '100%' }} />
          </Campo>
        </div>

        <Campo rotulo="Como paga" para="fat-metodo">
          <input id="fat-metodo" value={edit.method || ''}
            onChange={e => setEdit({ ...edit, method: e.target.value })}
            placeholder="Transferência, débito direto…" style={{ ...CAIXA, width: '100%' }} />
        </Campo>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          margin: '16px 0 0', paddingTop: 12, borderTop: '1px solid var(--border-2)',
        }}>
          <span style={ROTULO}>Total a pagar</span>
          <span style={{
            ...MONO, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any,
          }}>{euro(due(edit))}</span>
        </div>

        <div style={{ marginTop: 14 }}>
          <Botao feitio="principal" onClick={saveEdit} esperando={saving}>GUARDAR</Botao>
        </div>
      </Folha>
    )}
    </>
  )
}
