'use client'

// components/institution/NaoPrestado.tsx
// ─────────────────────────────────────────────────────────────────────────────
// «Não foi feito» — e porquê.
//
// ── PORQUE É QUE ISTO É UM COMPONENTE E NÃO UM CAMPO EM CADA PÁGINA ────────
// O motivo tem de ser o MESMO em todo o lado. Se as atividades tiverem uma
// lista de motivos e o registo do dia tiver outra, ninguém consegue perguntar
// «o que é que esta pessoa tem recusado» — porque a resposta está escrita em
// duas línguas. A lista vive em lib/naoPrestado.ts e entra aqui.
//
// ── O QUE ESTE ECRÃ EVITA ──────────────────────────────────────────────────
// A forma preguiçosa seria um campo de texto livre. Texto livre dá «não quis»,
// «recusou», «recusou-se», «não aceitou» — quatro maneiras de escrever a mesma
// coisa, e nenhuma que se possa contar. O motivo é escolhido de uma lista; a
// nota é livre, e é onde cabe o que aconteceu mesmo.
//
// ── TOM ────────────────────────────────────────────────────────────────────
// Nada aqui culpa ninguém. Nem a pessoa que recusou («não quis» não é
// desobediência), nem a equipa («não houve condições» é sobre a casa). Quem
// escreve isto está a fazer o seu trabalho bem; o ecrã tem de o tratar assim.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { MOTIVOS, type MotivoId, emPalavras, rotuloMotivo } from '@/lib/naoPrestado'
import { ptDate } from '@/lib/ptTime'
import { estiloFundoModal } from '@/lib/camadas'
import { reportError, isSetupError, MSG } from '@/lib/clientError'

interface Props {
  patientId: string
  /** Área de permissões do cuidado: 'registos', 'atividades', 'medicacao'. */
  area: string
  /** O que não foi feito, em palavras de quem cuida: «banho», «almoço». */
  oQue: string
  /** De onde veio, para se poder voltar lá. */
  origem?: string
  origemId?: string
  turno?: string | null
  /** Nome da pessoa, só para a frase de confirmação ficar humana. */
  nome?: string
  aoFechar: () => void
  /** Chamado depois de gravar, com a frase já escrita. */
  aoGravar?: (frase: string, motivo: MotivoId) => void
}

export default function RegistarNaoPrestado({
  patientId, area, oQue, origem, origemId, turno, nome, aoFechar, aoGravar,
}: Props) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [motivo, setMotivo] = useState<MotivoId | null>(null)
  const [nota, setNota] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  async function gravar() {
    if (!motivo || !user) return
    setAGravar(true); setErro('')

    const linha = scope.stamp({
      user_id: user.id,
      patient_id: patientId,
      data: ptDate(),
      turno: turno || null,
      area,
      o_que: oQue,
      motivo,
      nota: nota.trim() || null,
      origem: origem || null,
      origem_id: origemId || null,
      recorded_by: user.name || user.email || '',
    })

    const { error } = await supabase.from('cuidados_nao_prestados').insert(linha)
    setAGravar(false)

    if (error) {
      // Não se finge que ficou escrito. Um cuidado recusado que não fica no
      // registo é pior do que não o ter tentado registar: a equipa fica a
      // pensar que está lá.
      setErro(reportError('nao-prestado', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    aoGravar?.(emPalavras({ o_que: oQue, motivo, nota }, nome), motivo)
    aoFechar()
  }

  return (
    <div
      onClick={aoFechar}
      // A camada vem de lib/camadas: um z-index escolhido a olho acaba por
      // baixo da barra do telemovel, e o botao de gravar fica tapado.
      style={{ ...estiloFundoModal, alignItems: 'flex-end', padding: 0 }}>
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={`${oQue}: o que aconteceu`}
        style={{
          width: '100%', maxWidth: 460, background: 'var(--bg, var(--bg))',
          borderRadius: '18px 18px 0 0', padding: '20px 18px calc(18px + env(safe-area-inset-bottom))',
          maxHeight: '86vh', overflowY: 'auto',
        }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink, var(--ink))', marginBottom: 4 }}>
          {oQue.charAt(0).toUpperCase() + oQue.slice(1)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-4, var(--ink-4))', marginBottom: 16, lineHeight: 1.5 }}>
          O que aconteceu? Fica escrito no registo{nome ? ` de ${nome.split(' ')[0]}` : ''} — é o que mostra
          que a equipa esteve cá e tentou.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MOTIVOS.map(m => {
            const escolhido = motivo === m.id
            return (
              <button key={m.id} onClick={() => setMotivo(m.id)}
                style={{
                  textAlign: 'left', padding: '11px 13px', borderRadius: 'var(--r-xl)', cursor: 'pointer',
                  minHeight: 44, fontFamily: 'inherit',
                  border: `1.5px solid ${escolhido ? 'var(--accent, var(--green-3))' : 'var(--border, var(--border))'}`,
                  background: escolhido ? 'var(--accent-soft, var(--green-light))' : 'transparent',
                }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink, var(--ink))' }}>
                  {m.label}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4, var(--ink-4))', marginTop: 3, lineHeight: 1.45 }}>
                  {m.ajuda}
                </span>
              </button>
            )
          })}
        </div>

        <label style={{ display: 'block', marginTop: 16 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3, var(--ink-3))', marginBottom: 6 }}>
            O que aconteceu {motivo === 'outro' ? '' : '(se houver mais a dizer)'}
          </span>
          <textarea
            value={nota} onChange={e => setNota(e.target.value)} rows={3}
            placeholder="Ex.: estava com dores nas costas e pediu para ser de tarde."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--r-lg)', resize: 'vertical',
              border: '1px solid var(--border, var(--border))', fontFamily: 'inherit', fontSize: 14,
              background: 'var(--bg-2, var(--bg))', color: 'var(--ink, var(--ink))',
            }} />
        </label>

        {erro && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{erro}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={aoFechar} style={{
            flex: '0 0 auto', minHeight: 46, padding: '0 18px', borderRadius: 'var(--r-xl)',
            border: '1px solid var(--border-2, var(--border-2))', background: 'transparent',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3, var(--ink-3))', cursor: 'pointer',
          }}>Cancelar</button>
          <button
            onClick={gravar}
            disabled={!motivo || aGravar}
            style={{
              flex: 1, minHeight: 46, borderRadius: 'var(--r-xl)', border: 'none',
              background: motivo ? 'var(--accent, var(--green-3))' : 'var(--bg-3, var(--border))',
              color: motivo ? 'var(--bg)' : 'var(--ink-5, var(--ink-5))',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
              cursor: motivo && !aGravar ? 'pointer' : 'default',
            }}>
            {aGravar ? 'A registar…' : 'Registar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// A LISTA DO QUE NÃO FOI FEITO, DENTRO DO REGISTO DO DIA
// ─────────────────────────────────────────────────────────────────────────────
// Fica ao lado do registo normal, não numa ferramenta à parte. Se estivesse
// noutro sítio, escrever-se-ia uma vez na semana de formação e nunca mais: a
// altura de dizer que o banho não foi dado é a altura em que se está a escrever
// o resto do dia dessa pessoa.
//
// Os atalhos são os cuidados que se repetem todos os dias. Não são uma lista
// fechada — «Outro» aceita o que for. São atalhos porque escrever «almoço» à
// mão sessenta vezes por semana é a forma mais rápida de se deixar de escrever.

/** Os cuidados que se repetem todos os dias, num lar e num centro de dia. */
export const CUIDADOS_COMUNS = [
  'Banho', 'Higiene', 'Pequeno-almoço', 'Almoço', 'Lanche', 'Jantar',
  'Levante', 'Atividade', 'Passeio', 'Sesta',
]

/**
 * O painel «O que não foi feito», para dentro do registo do dia.
 *
 * Mostra o que já ficou escrito hoje sobre esta pessoa e dá os atalhos para
 * acrescentar. Quando não há nada, diz que não há nada — e isso também é
 * informação: um dia em que correu tudo é um dia em que correu tudo.
 */
export function CuidadosNaoPrestados({
  patientId, nome, data, turno, podeEditar = true,
}: {
  patientId: string
  nome?: string
  /** O dia que o registo está a mostrar. Por omissão, hoje. */
  data?: string
  turno?: string | null
  podeEditar?: boolean
}) {
  const { supabase } = useAuth() as any
  const scope = useOrgScope()
  const dia = data || ptDate()

  const [linhas, setLinhas] = useState<any[]>([])
  const [aEscolher, setAEscolher] = useState<string | null>(null)
  const [outro, setOutro] = useState('')
  const [indisponivel, setIndisponivel] = useState(false)

  const carregar = useCallback(async () => {
    if (!patientId) { setLinhas([]); return }
    let q = supabase.from('cuidados_nao_prestados')
      .select('id, o_que, motivo, nota, turno, recorded_by')
      .eq('patient_id', patientId).eq('data', dia)
      .order('created_at', { ascending: true })
    q = scope.filter(q)
    const { data: d, error } = await q
    if (error) {
      // A migração ainda não correu, ou esta pessoa não pode ler registos. Em
      // qualquer dos casos: esconde-se a secção em vez de mostrar uma caixa
      // vazia que parece dizer «não há nada a assinalar».
      setIndisponivel(true)
      return
    }
    setIndisponivel(false)
    setLinhas(d || [])
  }, [patientId, dia, supabase, scope])

  useEffect(() => { carregar() }, [carregar])

  async function apagar(id: string) {
    const { error } = await supabase.from('cuidados_nao_prestados').delete().eq('id', id)
    if (!error) setLinhas(prev => prev.filter(l => l.id !== id))
  }

  if (!patientId || indisponivel) return null

  return (
    <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 20, height: 20, background: 'var(--ink-4)', borderRadius: 'var(--r)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontSize: 11, fontWeight: 800 }}>8</span>
        O que não foi feito
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-4)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Um cuidado recusado, escrito com o motivo, é a prova de que a equipa esteve cá e tentou.
      </p>

      {linhas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {linhas.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px',
              background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {emPalavras({ o_que: l.o_que, motivo: l.motivo, nota: l.nota }, nome)}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-5)', marginTop: 3 }}>
                  {rotuloMotivo(l.motivo)}{l.recorded_by ? ` · ${l.recorded_by}` : ''}{l.turno ? ` · ${l.turno}` : ''}
                </span>
              </span>
              {podeEditar && (
                <button onClick={() => apagar(l.id)} title="Apagar este registo"
                  style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--ink-5)', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 2 }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {podeEditar ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CUIDADOS_COMUNS.map(c => (
              <button key={c} onClick={() => setAEscolher(c)}
                style={{
                  padding: '7px 12px', borderRadius: 999, minHeight: 36, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: 'inherit',
                  fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)',
                }}>{c}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={outro} onChange={e => setOutro(e.target.value)}
              placeholder="Outro cuidado…"
              onKeyDown={e => { if (e.key === 'Enter' && outro.trim()) { setAEscolher(outro.trim()); } }}
              style={{
                flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 'var(--r-md)', fontSize: 13,
                border: '1px solid var(--border)', fontFamily: 'inherit',
              }} />
            <button
              onClick={() => outro.trim() && setAEscolher(outro.trim())}
              disabled={!outro.trim()}
              style={{
                flexShrink: 0, padding: '0 14px', minHeight: 38, borderRadius: 'var(--r-md)', border: 'none',
                background: outro.trim() ? 'var(--ink)' : 'var(--border)', color: outro.trim() ? 'var(--bg)' : 'var(--ink-5)',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: outro.trim() ? 'pointer' : 'default',
              }}>Assinalar</button>
          </div>
        </>
      ) : (
        linhas.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-5)' }}>Nada assinalado neste dia.</div>
        )
      )}

      {aEscolher && (
        <RegistarNaoPrestado
          patientId={patientId}
          nome={nome}
          area="registos"
          oQue={aEscolher}
          origem="care-log"
          turno={turno}
          aoFechar={() => { setAEscolher(null); setOutro('') }}
          aoGravar={() => carregar()}
        />
      )}
    </div>
  )
}
