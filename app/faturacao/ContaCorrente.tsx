'use client'

// app/faturacao/ContaCorrente.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A conta de cada pessoa, e o extrato que vai à família.
//
// ── DE ONDE VEIO ───────────────────────────────────────────────────────────
// Da pesquisa ao Resilar, cujo produto inteiro é isto, a 2 € por utente por
// mês. O Phlox tinha uma linha por mês com quatro números — e isso não
// responde à pergunta que a família faz: «os 40 € de extras são de quê?».
//
// ── A ORDEM DO ECRÃ É A ORDEM DA CONVERSA ──────────────────────────────────
// Primeiro quem deve e quanto (a lista), depois a conta de uma pessoa, depois
// o extrato. É por aí que a conversa corre: alguém olha para a lista, repara
// numa dívida, abre a pessoa, e acaba a imprimir ou a enviar o papel.
//
// ── O QUE SE LANÇA É O MOVIMENTO, NUNCA O TOTAL ────────────────────────────
// Não há aqui um campo «extras» para escrever 40. Escreve-se «Farmácia,
// 12,40 €» e o total faz-se sozinho — é o gatilho do sprint174 que mantém a
// `billing_entries.extras` igual à soma, para os ecrãs antigos continuarem
// certos sem lhes tocar.
//
// Um campo de total ao lado da lista seria um segundo sítio para o mesmo
// número, e no dia em que discordassem ninguém saberia qual cobrar.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useOrgName } from '@/lib/useOrgName'
import { printDoc, type PrintRecord } from '@/lib/print'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import { ptDate } from '@/lib/ptTime'
import {
  extratoDoMes, saldoDe, saldoEmPalavras, euro, mesPorExtenso,
  TIPOS, ROTULO_TIPO,
  type Movimento, type Mensalidade, type TipoMovimento,
} from '@/lib/contaCorrente'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block',
}
const inp: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)',
  padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box', background: 'white',
}

interface Pessoa { id: string; name: string }

export default function ContaCorrente({ month, patients, mensalidades }: {
  month: string
  patients: Pessoa[]
  mensalidades: Mensalidade[]
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O nome A SÉRIO da casa, e não «Lar». Isto vai para a mão de uma família:
  // um extrato de conta assinado «Lar» não é de ninguém.
  const nomeCasa = useOrgName()
  const podeEditar = scope.pode('financeiro', 'editar')

  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [jaCarregou, setJaCarregou] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState<string | null>(null)
  const [recado, setRecado] = useState('')

  const carregar = useCallback(async () => {
    if (!user || !scope.orgId) return
    setCarregando(true)
    // Tudo, e não só o mês: o saldo que vem de trás precisa do histórico. São
    // poucas linhas por pessoa e por ano, e é UMA consulta — o tecto do plano
    // gratuito é o número de chamadas, não os bytes.
    const { data, error } = await supabase.from('conta_do_utente')
      .select('*').eq('org_id', scope.orgId).order('data', { ascending: false })

    if (error && isSetupError(error)) {
      setIndisponivel(true); setJaCarregou(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setMovimentos(error ? [] : (data || []).map((m: any) => ({ ...m, valor: Number(m.valor) })))
    setJaCarregou(true)
    setCarregando(false)
  }, [user, supabase, scope.orgId])

  useEffect(() => { carregar() }, [carregar])

  /** O saldo de cada pessoa, hoje. */
  const saldos = useMemo(() => patients.map(p => ({
    pessoa: p,
    saldo: saldoDe(
      mensalidades.filter(m => m.patient_id === p.id),
      movimentos.filter(m => m.patient_id === p.id)),
  })).sort((a, b) => b.saldo - a.saldo), [patients, mensalidades, movimentos])

  const devem = saldos.filter(s => Math.round(s.saldo * 100) > 0)
  const totalEmDivida = useMemo(
    () => devem.reduce((t, s) => t + Math.round(s.saldo * 100), 0) / 100, [devem])

  async function lancar(patientId: string, m: {
    tipo: TipoMovimento; descricao: string; valor: number; data: string
  }) {
    if (!user) return false
    const sentido = TIPOS.find(t => t.id === m.tipo)?.sentido || 'debito'
    const { data, error } = await supabase.from('conta_do_utente').insert(scope.stamp({
      user_id: user.id, patient_id: patientId,
      data: m.data, mes: m.data.slice(0, 7),
      sentido, tipo: m.tipo, descricao: m.descricao, valor: m.valor,
      lancado_por: (user as any)?.name || user?.email || null,
    })).select().single()

    if (error || !data) {
      setErro(reportError('conta-lancar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return false
    }
    setErro('')
    setMovimentos(p => [{ ...data, valor: Number(data.valor) }, ...p])
    return true
  }

  async function apagar(m: Movimento) {
    const antes = movimentos
    setMovimentos(p => p.filter(x => x.id !== m.id))
    const { error } = await supabase.from('conta_do_utente').delete().eq('id', m.id)
    if (error) { setMovimentos(antes); setErro(reportError('conta-apagar', error, MSG.save)) }
    else setErro('')
  }

  /**
   * Manda o extrato à família.
   *
   * ── OS NÚMEROS NÃO VÃO DAQUI ────────────────────────────────────────────
   * Manda-se o id e o mês, e a rota conta tudo outra vez do lado do servidor.
   * Seria mais simples enviar o extrato já feito — e então o que chegava à
   * família era o que este separador tinha em memória, que pode ter duas horas
   * e um movimento a menos.
   *
   * ── E CONFIRMA-SE PRIMEIRO ──────────────────────────────────────────────
   * Isto sai da instituição e vai para a mão de uma família. Um email de
   * dinheiro enviado por engano não se desfaz.
   */
  async function enviarExtrato(p: Pessoa, saldo: number) {
    if (aEnviar) return
    const ok = window.confirm(
      `Enviar o extrato de ${mesPorExtenso(month)} à família de ${p.name}?\n\n`
      + `${saldoEmPalavras(saldo)}.\n\n`
      + 'O email sai agora e não se desfaz.')
    if (!ok) return

    setAEnviar(p.id)
    try {
      const { data: sessao } = await supabase.auth.getSession()
      const r = await fetch('/api/faturacao/extrato', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessao?.session?.access_token}`,
        },
        body: JSON.stringify({ patientId: p.id, mes: month }),
      }).then(x => x.json())

      // Cada motivo tem a sua frase. «Não foi possível enviar» para tudo
      // deixava quem lê sem saber se o problema é dele, da família ou do
      // Phlox — e as três resolvem-se de maneiras diferentes.
      if (r.ok) {
        setRecado(`Extrato enviado à família de ${p.name}.`)
      } else if (r.motivo === 'ja_enviado') {
        setRecado(`O extrato de ${mesPorExtenso(month)} já tinha sido enviado a esta família.`)
      } else if (r.motivo === 'sem_familia') {
        setRecado(`${p.name} não tem nenhuma família ligada no Phlox. Ligue-a em Famílias.`)
      } else if (r.motivo === 'sem_email') {
        setRecado('A família está ligada mas não tem email válido no Phlox.')
      } else if (r.motivo === 'sem_movimentos') {
        setRecado(`Não há nada lançado em ${mesPorExtenso(month)} — não vale a pena enviar.`)
      } else {
        setErro(r.error || 'Não foi possível enviar agora. Tente outra vez.')
      }
    } catch {
      setErro('Não foi possível enviar agora. Verifique a ligação e tente outra vez.')
    } finally { setAEnviar(null) }
  }

  function imprimirExtrato(p: Pessoa) {
    const e = extratoDoMes(
      month,
      mensalidades.filter(m => m.patient_id === p.id),
      movimentos.filter(m => m.patient_id === p.id))

    const records: PrintRecord[] = [
      ...(Math.round(e.saldoAnterior * 100) !== 0 ? [{
        title: 'Saldo anterior',
        fields: [{ label: '', value: euro(e.saldoAnterior) }],
      }] : []),
      ...e.linhas.map(l => ({
        title: l.descricao,
        fields: [
          ...(l.data ? [{ label: 'Data', value: l.data.split('-').reverse().join('/') }] : []),
          { label: l.debito !== null ? 'Débito' : 'Crédito', value: euro(l.debito ?? l.credito ?? 0) },
        ],
      })),
      {
        title: saldoEmPalavras(e.saldoFinal),
        fields: [
          { label: 'Total a débito', value: euro(e.totalDebitos) },
          { label: 'Total a crédito', value: euro(e.totalCreditos) },
          { label: 'Saldo', value: euro(e.saldoFinal) },
        ],
      },
    ]

    printDoc({
      docTitle: 'Extrato de conta',
      docSubtitle: `${p.name} · ${mesPorExtenso(month)}`,
      institution: nomeCasa || undefined,
      sections: [{ heading: 'Movimentos', records }],
      footerNote: 'Qualquer dúvida sobre este extrato, fale connosco.',
    })
  }

  if (indisponivel) {
    return (
      <div style={{ padding: 20, color: 'var(--ink-4)', fontSize: 13.5, lineHeight: 1.6 }}>
        A conta de cada utente ainda não está montada. Falta um passo de configuração —
        assim que estiver feito, pode lançar farmácia, cabeleireiro e pagamentos aqui.
      </div>
    )
  }
  if (carregando || !jaCarregou) {
    return <div style={{ padding: 20, color: 'var(--ink-4)', fontSize: 13.5 }}>A somar as contas…</div>
  }

  return (
    <div>
      {erro && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', color: 'var(--red)',
          fontSize: 13, fontWeight: 600,
        }}>{erro}</div>
      )}

      {recado && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          color: 'var(--ink-2)', fontSize: 13, fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center',
        }}>
          <span>{recado}</span>
          <button onClick={() => setRecado('')} aria-label="Fechar" style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--ink-5)', fontSize: 16, lineHeight: 1, padding: '0 4px',
          }}>×</button>
        </div>
      )}

      {/* ── Quem deve ──────────────────────────────────────────────────────
          Em cima e em primeiro, porque é a pergunta com que se abre esta
          página. A lista inteira ordenada por dívida punha quem está em dia a
          ocupar o ecrã de quem não está. */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 14,
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>
          {devem.length === 0
            ? 'Está toda a gente em dia.'
            : `${devem.length} ${devem.length === 1 ? 'pessoa deve' : 'pessoas devem'} ${euro(totalEmDivida)}`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {saldos.map(({ pessoa, saldo }) => {
          const cents = Math.round(saldo * 100)
          const estaAberto = aberto === pessoa.id
          return (
            <section key={pessoa.id} style={{
              borderRadius: 'var(--r-xl)', border: `1px solid ${estaAberto ? 'var(--ink)' : 'var(--border)'}`,
              background: 'white', overflow: 'hidden',
            }}>
              <button
                onClick={() => setAberto(estaAberto ? null : pessoa.id)}
                aria-expanded={estaAberto}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', gap: 12,
                  padding: '12px 14px', border: 'none', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {pessoa.name}
                </span>
                <span style={{
                  flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700,
                  color: cents > 0 ? 'var(--amber)' : cents < 0 ? 'var(--green)' : 'var(--ink-5)',
                }}>
                  {cents === 0 ? 'em dia' : euro(saldo)}
                </span>
                <span aria-hidden style={{ flexShrink: 0, color: 'var(--ink-5)', fontSize: 13 }}>
                  {estaAberto ? '▲' : '▼'}
                </span>
              </button>

              {estaAberto && (
                <Conta
                  pessoa={pessoa} month={month}
                  mensalidades={mensalidades.filter(m => m.patient_id === pessoa.id)}
                  movimentos={movimentos.filter(m => m.patient_id === pessoa.id)}
                  podeEditar={podeEditar}
                  lancar={m => lancar(pessoa.id, m)}
                  apagar={apagar}
                  imprimir={() => imprimirExtrato(pessoa)}
                  enviar={() => enviarExtrato(pessoa, saldo)}
                  aEnviar={aEnviar === pessoa.id}
                />
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Conta({ pessoa, month, mensalidades, movimentos, podeEditar, lancar, apagar, imprimir, enviar, aEnviar }: {
  pessoa: Pessoa
  month: string
  mensalidades: Mensalidade[]
  movimentos: Movimento[]
  podeEditar: boolean
  lancar: (m: { tipo: TipoMovimento; descricao: string; valor: number; data: string }) => Promise<boolean>
  apagar: (m: Movimento) => void
  imprimir: () => void
  enviar: () => void
  aEnviar: boolean
}) {
  const e = useMemo(
    () => extratoDoMes(month, mensalidades, movimentos), [month, mensalidades, movimentos])

  const [tipo, setTipo] = useState<TipoMovimento>('farmacia')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => `${month}-${String(Math.min(new Date().getDate(), 28)).padStart(2, '0')}`)
  const [aGravar, setAGravar] = useState(false)

  const numero = Number(valor.replace(',', '.'))
  const valido = descricao.trim() !== '' && Number.isFinite(numero) && numero > 0

  async function gravar() {
    if (!valido || aGravar) return
    setAGravar(true)
    const ok = await lancar({ tipo, descricao: descricao.trim(), valor: numero, data })
    setAGravar(false)
    if (ok) { setDescricao(''); setValor('') }
  }

  return (
    <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
      {/* ── O extrato do mês ─────────────────────────────────────────────── */}
      <div style={{ ...MONO, marginTop: 12 }}>Extrato de {mesPorExtenso(month)}</div>

      <div style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {Math.round(e.saldoAnterior * 100) !== 0 && (
          <Linha descricao="Saldo anterior" valor={e.saldoAnterior} debito={e.saldoAnterior > 0} primeira />
        )}
        {e.linhas.length === 0 && Math.round(e.saldoAnterior * 100) === 0 && (
          <div style={{ padding: '12px 13px', fontSize: 13, color: 'var(--ink-5)' }}>
            Nada lançado neste mês.
          </div>
        )}
        {e.linhas.map((l, i) => (
          <Linha
            key={i}
            descricao={l.descricao}
            data={l.data}
            valor={l.debito ?? l.credito ?? 0}
            debito={l.debito !== null}
            primeira={i === 0 && Math.round(e.saldoAnterior * 100) === 0}
            aoApagar={podeEditar && l.movimentoId
              ? () => {
                  const m = movimentos.find(x => x.id === l.movimentoId)
                  if (m) apagar(m)
                }
              : undefined}
          />
        ))}

        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
          padding: '11px 13px', borderTop: '1.5px solid var(--ink)', background: 'var(--bg-2)',
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>
            {saldoEmPalavras(e.saldoFinal)}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
            color: e.saldoFinal > 0 ? 'var(--amber)' : e.saldoFinal < 0 ? 'var(--green)' : 'var(--ink-5)',
          }}>{euro(e.saldoFinal)}</span>
        </div>
      </div>

      {/* ── Lançar ───────────────────────────────────────────────────────── */}
      {podeEditar && (
        <div style={{ marginTop: 12 }}>
          <span style={MONO}>Lançar</span>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <select value={tipo} onChange={ev => setTipo(ev.target.value as TipoMovimento)}
              aria-label="Tipo de movimento"
              style={{ ...inp, flex: '1 1 140px', width: 'auto' }}>
              {TIPOS.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}{t.sentido === 'credito' ? ' (a favor)' : ''}
                </option>
              ))}
            </select>
            <input value={descricao} onChange={ev => setDescricao(ev.target.value)}
              placeholder="De quê. Ex.: Paracetamol e Ben-u-ron"
              style={{ ...inp, flex: '2 1 200px', width: 'auto' }} />
            <input value={valor} onChange={ev => setValor(ev.target.value)}
              inputMode="decimal" placeholder="12,40" aria-label="Valor em euros"
              style={{ ...inp, flex: '0 1 100px', width: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
            <input type="date" value={data} onChange={ev => setData(ev.target.value)}
              aria-label="Data do movimento"
              style={{ ...inp, flex: '0 1 150px', width: 'auto' }} />
            <button onClick={gravar} disabled={!valido || aGravar} style={{
              minHeight: 40, padding: '0 16px', borderRadius: 'var(--r-md)', border: 'none',
              background: valido ? 'var(--ink)' : 'var(--bg-3)',
              color: valido ? 'white' : 'var(--ink-5)',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              cursor: valido && !aGravar ? 'pointer' : 'default',
            }}>Lançar</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 6, lineHeight: 1.45 }}>
            O total dos extras faz-se sozinho a partir do que lançar aqui — não há nenhum sítio
            para escrever o total à mão, de propósito.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={imprimir} style={{
          minHeight: 38, padding: '0 14px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)', background: 'white',
          fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', cursor: 'pointer',
        }}>Imprimir o extrato</button>

        {/* Só para quem pode mexer no financeiro. Isto manda dinheiro para
            fora da instituição — não é o mesmo gesto que imprimir. */}
        {podeEditar && (
          <button onClick={enviar} disabled={aEnviar} style={{
            minHeight: 38, padding: '0 14px', borderRadius: 'var(--r-md)', border: 'none',
            background: aEnviar ? 'var(--bg-3)' : 'var(--ink)',
            color: aEnviar ? 'var(--ink-5)' : 'white',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
            cursor: aEnviar ? 'default' : 'pointer',
          }}>{aEnviar ? 'A enviar…' : 'Enviar à família'}</button>
        )}
      </div>
    </div>
  )
}

function Linha({ descricao, data, valor, debito, primeira, aoApagar }: {
  descricao: string; data?: string | null; valor: number; debito: boolean
  primeira?: boolean; aoApagar?: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 13px',
      borderTop: primeira ? 'none' : '1px solid var(--bg-3)',
    }}>
      {data && (
        <span style={{
          flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)',
        }}>{data.slice(8, 10)}/{data.slice(5, 7)}</span>
      )}
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink-2)' }}>{descricao}</span>
      {aoApagar && (
        <button onClick={aoApagar} aria-label={`Apagar ${descricao}`} style={{
          flexShrink: 0, border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 11, color: 'var(--ink-5)', fontFamily: 'inherit', padding: '0 4px',
        }}>apagar</button>
      )}
      {/* Débito e crédito em colunas diferentes. Numa só, com sinais, um
          movimento no sentido errado passa despercebido — e é assim que uma
          conta fica errada em dobro sem nada vermelho no ecrã. */}
      <span style={{
        flexShrink: 0, width: 82, textAlign: 'right',
        fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700,
        color: debito ? 'var(--ink)' : 'var(--green)',
      }}>{debito ? euro(valor) : `−${euro(valor)}`}</span>
    </div>
  )
}
