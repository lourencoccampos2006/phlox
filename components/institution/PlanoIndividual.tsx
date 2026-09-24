'use client'

// components/institution/PlanoIndividual.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O Plano Individual de uma pessoa — PIC num lar, PII num centro de dia.
//
// ── O QUE ESTE ECRÃ TEM DE CONSEGUIR ───────────────────────────────────────
// Três leituras diferentes, na mesma página, sem modos:
//
//   1. A auxiliar que chega ao pé da pessoa e quer saber o que se faz com ela.
//      Lê os objetivos e as ações, de cima a baixo, e sai.
//   2. A direção técnica que está a escrever ou a rever o plano.
//   3. A visita da Segurança Social, que quer o plano em papel, com datas,
//      com quem o elaborou e com a revisão feita.
//
// É por isso que isto é UMA página e não um formulário atrás de um botão
// «editar». Um plano que vive dentro de um formulário é um plano que ninguém
// lê — e um plano que ninguém lê não muda nada no dia.
//
// ── O TOM ──────────────────────────────────────────────────────────────────
// Um centro de dia não é um serviço clínico. Nada aqui diz «em atraso», nada
// conta dívidas, nada usa vocabulário de enfermaria. A revisão que passou da
// data diz «vale a pena marcar», que é o que uma colega diria.
//
// ── PORQUE É QUE A VOZ DA PESSOA ESTÁ NO TOPO ──────────────────────────────
// Porque um plano escrito só pela equipa é um plano feito SOBRE alguém, e não
// COM alguém. Pô-la em primeiro é a única forma de ela não acabar numa caixa
// de notas no fim, preenchida quando sobra tempo.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { AREAS, POR_AREA } from '@/lib/permissoes'
import { ptDate } from '@/lib/ptTime'
import { printDoc } from '@/lib/print'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import {
  nomeDoPlano, CADENCIAS, POR_CADENCIA, DIAS_DA_SEMANA,
  cadenciaEmPalavras, proximaRevisao, estadoDaRevisao, objetivosSemAcoes,
  type Plano, type Objetivo, type Acao, type Avaliacao, type Cadencia,
} from '@/lib/plano'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

const TURNOS = [
  { id: null as string | null, label: 'Qualquer altura' },
  { id: 'manha', label: 'De manhã' },
  { id: 'tarde', label: 'À tarde' },
  { id: 'noite', label: 'À noite' },
]

interface Props {
  pid: string
  nome: string
  cor: string
}

export default function PlanoIndividual({ pid, nome, cor }: Props) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const nomes = nomeDoPlano(institution)
  const podeEditar = scope.pode('utentes', 'editar')

  const [plano, setPlano] = useState<Plano | null>(null)
  const [objetivos, setObjetivos] = useState<Objetivo[]>([])
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [revisoes, setRevisoes] = useState<Avaliacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')

  const [aCriarObjetivo, setACriarObjetivo] = useState(false)
  const [aCriarAcaoEm, setACriarAcaoEm] = useState<string | null>(null)
  const [aRever, setARever] = useState(false)

  // ── Carregar ──────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)

    const { data: p, error: erroPlano } = await supabase
      .from('planos').select('*')
      .eq('patient_id', pid).neq('estado', 'arquivado')
      .order('inicio', { ascending: false }).limit(1).maybeSingle()

    if (erroPlano) {
      // A migração ainda não correu, ou esta pessoa não pode ver utentes. Em
      // qualquer dos casos, esconde-se a secção em vez de mostrar uma caixa
      // vazia que parece dizer «esta pessoa não tem plano».
      setIndisponivel(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setPlano(p || null)

    if (!p) { setObjetivos([]); setAcoes([]); setRevisoes([]); setCarregando(false); return }

    const [objs, revs] = await Promise.all([
      supabase.from('plano_objetivos').select('*').eq('plano_id', p.id).order('ordem'),
      supabase.from('plano_avaliacoes').select('*').eq('plano_id', p.id).order('data', { ascending: false }),
    ])
    if (objs.error) { setErro(reportError('plano-objetivos-ler', objs.error, MSG.load)); setCarregando(false); return }

    const lista: Objetivo[] = objs.data || []
    setObjetivos(lista)
    setRevisoes(revs.error ? [] : (revs.data || []))

    if (lista.length) {
      const { data: acs, error: erroAcoes } = await supabase
        .from('plano_acoes').select('*').in('objetivo_id', lista.map(o => o.id)).order('created_at')
      setAcoes(erroAcoes ? [] : (acs || []))
    } else {
      setAcoes([])
    }
    setCarregando(false)
  }, [pid, user, supabase])

  useEffect(() => { carregar() }, [carregar])

  // ── Escrever ──────────────────────────────────────────────────────────────
  async function criarPlano() {
    if (!user) return
    const linha = scope.stamp({
      user_id: user.id, patient_id: pid,
      estado: 'ativo', inicio: ptDate(), rever_em: proximaRevisao(),
      elaborado_por: user.name || user.email || '',
    })
    const { data, error } = await supabase.from('planos').insert(linha).select().single()
    if (error || !data) {
      // Antes da migracao correr, isto e um «ainda nao esta disponivel» e nao
      // um erro — senao quem o ve vai procurar um bug que nao existe.
      setErro(reportError('plano-criar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setPlano(data)
  }

  async function guardarPlano(patch: Partial<Plano>) {
    if (!plano) return
    const antes = plano
    setPlano({ ...plano, ...patch })
    const { error } = await supabase.from('planos')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', plano.id)
    if (error) {
      // Devolve-se o ecrã ao que estava. Um plano que parece guardado e não
      // está é pior do que um erro: a pessoa fecha a página descansada.
      setPlano(antes)
      setErro(reportError('plano-guardar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
    } else setErro('')
  }

  async function criarObjetivo(area: string, titulo: string, porque: string) {
    if (!plano || !user || !titulo.trim()) return
    const linha = scope.stamp({
      user_id: user.id, plano_id: plano.id, area,
      titulo: titulo.trim(), porque: porque.trim() || null,
      ordem: objetivos.length,
    })
    const { data, error } = await supabase.from('plano_objetivos').insert(linha).select().single()
    if (error || !data) {
      setErro(reportError('plano-objetivo', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setObjetivos(prev => [...prev, data]); setACriarObjetivo(false)
  }

  async function mudarEstadoObjetivo(o: Objetivo, estado: Objetivo['estado']) {
    const antes = objetivos
    setObjetivos(prev => prev.map(x => x.id === o.id ? { ...x, estado } : x))
    const { error } = await supabase.from('plano_objetivos').update({ estado }).eq('id', o.id)
    if (error) { setObjetivos(antes); setErro(reportError('plano-objetivo-estado', error, MSG.save)) }
  }

  async function apagarObjetivo(o: Objetivo) {
    const { error } = await supabase.from('plano_objetivos').delete().eq('id', o.id)
    if (error) { setErro(reportError('plano-objetivo-apagar', error, MSG.save)); return }
    setObjetivos(prev => prev.filter(x => x.id !== o.id))
    setAcoes(prev => prev.filter(a => a.objetivo_id !== o.id))
  }

  async function criarAcao(objetivoId: string, campos: Partial<Acao>) {
    if (!user || !campos.o_que?.trim()) return
    const linha = scope.stamp({
      user_id: user.id, objetivo_id: objetivoId,
      o_que: campos.o_que.trim(),
      quem: campos.quem || null,
      cadencia: campos.cadencia || 'diaria',
      dias: campos.cadencia === 'dias_da_semana' ? (campos.dias || []) : null,
      turno: campos.turno || null,
      desde: ptDate(),
      ativa: true,
      notas: campos.notas?.trim() || null,
    })
    const { data, error } = await supabase.from('plano_acoes').insert(linha).select().single()
    if (error || !data) {
      setErro(reportError('plano-acao', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setAcoes(prev => [...prev, data]); setACriarAcaoEm(null)
  }

  async function alternarAcao(a: Acao) {
    const antes = acoes
    setAcoes(prev => prev.map(x => x.id === a.id ? { ...x, ativa: !x.ativa } : x))
    const { error } = await supabase.from('plano_acoes').update({ ativa: !a.ativa }).eq('id', a.id)
    if (error) { setAcoes(antes); setErro(reportError('plano-acao-estado', error, MSG.save)) }
  }

  async function apagarAcao(a: Acao) {
    const { error } = await supabase.from('plano_acoes').delete().eq('id', a.id)
    if (error) { setErro(reportError('plano-acao-apagar', error, MSG.save)); return }
    setAcoes(prev => prev.filter(x => x.id !== a.id))
  }

  async function registarRevisao(texto: string, decisao: Avaliacao['decisao']) {
    if (!plano || !user || !texto.trim()) return
    const linha = scope.stamp({
      user_id: user.id, plano_id: plano.id, data: ptDate(),
      texto: texto.trim(), autor: user.name || user.email || '', decisao,
    })
    const { data, error } = await supabase.from('plano_avaliacoes').insert(linha).select().single()
    if (error || !data) {
      setErro(reportError('plano-revisao', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setRevisoes(prev => [data, ...prev]); setARever(false)
    // Rever repõe o relógio. Se não repusesse, o aviso ficava para sempre e a
    // equipa aprendia a ignorá-lo.
    await guardarPlano({ rever_em: proximaRevisao() })
  }

  // ── O que se mostra ───────────────────────────────────────────────────────
  const acoesDe = useCallback((oid: string) => acoes.filter(a => a.objetivo_id === oid), [acoes])
  const revisao = plano ? estadoDaRevisao(plano.rever_em) : null
  const semAcoes = useMemo(() => objetivosSemAcoes(objetivos, acoes), [objetivos, acoes])
  const abertos = objetivos.filter(o => o.estado === 'aberto')
  const fechados = objetivos.filter(o => o.estado !== 'aberto')

  function imprimir() {
    if (!plano) return
    printDoc({
      docTitle: nomes.longo,
      docSubtitle: nome,
      author: plano.elaborado_por || undefined,
      meta: [
        { label: 'Início', value: new Date(plano.inicio).toLocaleDateString('pt-PT') },
        { label: 'Revisão', value: plano.rever_em ? new Date(plano.rever_em).toLocaleDateString('pt-PT') : '—' },
        { label: 'Objetivos', value: String(abertos.length) },
      ],
      sections: [
        ...(plano.voz_da_pessoa ? [{
          heading: 'O que a pessoa e a família disseram',
          records: [{ title: nome, body: plano.voz_da_pessoa }],
        }] : []),
        {
          heading: 'Objetivos e ações',
          note: 'Cada objetivo com o que se faz para lá chegar, e com que frequência.',
          records: abertos.map(o => ({
            title: o.titulo,
            meta: POR_AREA.get(o.area)?.label || o.area,
            body: o.porque || undefined,
            bullets: acoesDe(o.id).filter(a => a.ativa)
              .map(a => `${a.o_que} — ${cadenciaEmPalavras(a)}${a.quem ? ` (${a.quem})` : ''}`),
          })),
        },
        ...(revisoes.length ? [{
          heading: 'Revisões',
          records: revisoes.map(r => ({
            title: new Date(r.data).toLocaleDateString('pt-PT'),
            meta: [r.autor, r.decisao === 'manter' ? 'manter' : r.decisao === 'ajustar' ? 'ajustar' : r.decisao === 'fechar' ? 'fechar' : null]
              .filter(Boolean).join(' · ') || undefined,
            body: r.texto,
          })),
        }] : []),
      ],
      footerNote: `${nomes.longo} de ${nome}. Documento gerado pelo Phlox.`,
    })
  }

  if (indisponivel) return null

  if (carregando) {
    return <div style={{ padding: 'var(--space-12)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar o plano…</div>
  }

  // ── Ainda não há plano ────────────────────────────────────────────────────
  if (!plano) {
    return (
      <div style={{
        marginTop: 'var(--space-10)', padding: 'var(--space-12)', borderRadius: 'var(--r-xl)',
        border: '1px dashed var(--border-2)', textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>
          {nome.split(' ')[0]} ainda não tem {nomes.curto === 'PIC' ? 'plano de cuidados' : 'plano de intervenção'}
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 18px' }}>
          É aqui que se escreve o que se quer para esta pessoa e o que se faz para lá chegar.
          É também o documento que a Segurança Social pede numa visita.
        </p>
        {podeEditar ? (
          <button onClick={criarPlano} style={{
            minHeight: 46, padding: '0 22px', borderRadius: 'var(--r-lg)', border: 'none',
            background: cor, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>Começar o {nomes.curto}</button>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-5)' }}>
            Fale com quem gere a casa para o plano ser criado.
          </div>
        )}
        {erro && <div style={{ marginTop: 12, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 'var(--space-10)' }}>
      {erro && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030',
          fontSize: 13, fontWeight: 600,
        }}>{erro}</div>
      )}

      {/* ── Cabeçalho: o que é, desde quando, quando se revê ─────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-7)',
        alignItems: 'baseline', justifyContent: 'space-between',
        paddingBottom: 'var(--space-6)', borderBottom: '1px solid var(--ink)',
      }}>
        <div>
          <span style={MONO}>{nomes.longo}</span>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 4 }}>
            Desde {new Date(plano.inicio).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
            {plano.elaborado_por ? ` · elaborado por ${plano.elaborado_por}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {revisao && (
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 20,
              background: revisao.chama ? 'var(--badge-amber-bg)' : 'var(--bg-2)',
              border: `1px solid ${revisao.chama ? 'var(--badge-amber-border)' : 'var(--border)'}`,
              color: revisao.chama ? 'var(--badge-amber-fg)' : 'var(--ink-4)',
            }}>{revisao.frase}</span>
          )}
          <button onClick={imprimir} style={{
            minHeight: 34, padding: '0 12px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-2)', background: 'transparent',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', cursor: 'pointer',
          }}>Imprimir</button>
        </div>
      </div>

      {/* ── A voz da pessoa ──────────────────────────────────────────────── */}
      <CaixaDeTexto
        titulo="O que a pessoa e a família querem"
        ajuda="Nas palavras delas. É o que impede este plano de ser um documento escrito sobre alguém em vez de com alguém."
        valor={plano.voz_da_pessoa || ''}
        podeEditar={podeEditar}
        aoGuardar={v => guardarPlano({ voz_da_pessoa: v || null })}
        cor={cor}
      />

      {/* ── Um aviso honesto ─────────────────────────────────────────────── */}
      {semAcoes.length > 0 && podeEditar && (
        <div style={{
          marginTop: 'var(--space-8)', padding: '11px 14px', borderRadius: 'var(--r-lg)',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55,
        }}>
          {semAcoes.length === 1
            ? <>O objetivo <strong>{semAcoes[0].titulo}</strong> ainda não tem nenhuma ação.</>
            : <><strong>{semAcoes.length} objetivos</strong> ainda não têm ações.</>}
          {' '}Um objetivo sem ações fica bonito no plano e não produz trabalho nenhum no dia.
        </div>
      )}

      {/* ── Os objetivos ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'var(--space-10)' }}>
        {abertos.length === 0 && !aCriarObjetivo && (
          <div style={{ fontSize: 13.5, color: 'var(--ink-4)', padding: 'var(--space-8) 0' }}>
            Ainda não há objetivos. Comece por um: o que é que se quer para {nome.split(' ')[0]} nos próximos meses?
          </div>
        )}

        {abertos.map(o => (
          <CartaoObjetivo
            key={o.id} o={o} acoes={acoesDe(o.id)} cor={cor} podeEditar={podeEditar}
            aCriarAcao={aCriarAcaoEm === o.id}
            abrirNovaAcao={() => setACriarAcaoEm(aCriarAcaoEm === o.id ? null : o.id)}
            criarAcao={campos => criarAcao(o.id, campos)}
            alternarAcao={alternarAcao}
            apagarAcao={apagarAcao}
            mudarEstado={estado => mudarEstadoObjetivo(o, estado)}
            apagar={() => apagarObjetivo(o)}
          />
        ))}

        {podeEditar && (
          aCriarObjetivo
            ? <NovoObjetivo cor={cor} aoCriar={criarObjetivo} aoCancelar={() => setACriarObjetivo(false)} />
            : <button onClick={() => setACriarObjetivo(true)} style={{
                marginTop: 'var(--space-7)', minHeight: 44, padding: '0 18px',
                borderRadius: 'var(--r-lg)', border: `1.5px dashed ${cor}`, background: 'transparent',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: cor, cursor: 'pointer',
              }}>+ Novo objetivo</button>
        )}
      </div>

      {/* ── Objetivos já fechados ────────────────────────────────────────── */}
      {fechados.length > 0 && (
        <details style={{ marginTop: 'var(--space-12)' }}>
          <summary style={{ ...MONO, cursor: 'pointer', paddingBottom: 6 }}>
            {fechados.length === 1 ? '1 objetivo fechado' : `${fechados.length} objetivos fechados`}
          </summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fechados.map(o => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '9px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-2)',
                border: '1px solid var(--border)', fontSize: 13, color: 'var(--ink-4)',
              }}>
                <span>{o.titulo} <span style={{ fontSize: 11.5 }}>· {o.estado === 'atingido' ? 'atingido' : 'suspenso'}</span></span>
                {podeEditar && (
                  <button onClick={() => mudarEstadoObjetivo(o, 'aberto')} style={{
                    background: 'none', border: 'none', color: cor, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                  }}>reabrir</button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── As revisões ──────────────────────────────────────────────────── */}
      <section style={{ marginTop: 'var(--space-14)' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
        }}>
          <span style={MONO}>Revisões</span>
          {podeEditar && !aRever && (
            <button onClick={() => setARever(true)} style={{
              background: 'none', border: 'none', color: cor, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            }}>+ Registar revisão</button>
          )}
        </div>

        {aRever && <NovaRevisao cor={cor} aoGuardar={registarRevisao} aoCancelar={() => setARever(false)} />}

        {revisoes.length === 0 && !aRever && (
          <div style={{ fontSize: 13, color: 'var(--ink-4)', paddingTop: 'var(--space-7)', lineHeight: 1.55 }}>
            Ainda não há nenhuma revisão escrita. É o que a inspeção pergunta primeiro — e é
            também a única forma de saber se o plano serviu para alguma coisa.
          </div>
        )}

        <div style={{ marginTop: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {revisoes.map(r => (
            <div key={r.id} style={{
              padding: '12px 14px', borderRadius: 'var(--r-lg)',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  {new Date(r.data).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {r.autor && <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>{r.autor}</span>}
                {r.decisao && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>
                    {r.decisao === 'manter' ? 'manter como está' : r.decisao === 'ajustar' ? 'ajustar' : 'fechar o plano'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.texto}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PEÇAS
// ─────────────────────────────────────────────────────────────────────────────

/** Um campo de texto longo que se edita no sítio, sem modo de edição. */
function CaixaDeTexto({ titulo, ajuda, valor, podeEditar, aoGuardar, cor }: {
  titulo: string; ajuda: string; valor: string; podeEditar: boolean
  aoGuardar: (v: string) => void; cor: string
}) {
  const [texto, setTexto] = useState(valor)
  const [aEditar, setAEditar] = useState(false)
  useEffect(() => { setTexto(valor) }, [valor])

  if (!podeEditar && !valor) return null

  return (
    <section style={{ marginTop: 'var(--space-10)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={MONO}>{titulo}</span>
        {podeEditar && !aEditar && (
          <button onClick={() => setAEditar(true)} style={{
            background: 'none', border: 'none', color: cor, fontSize: 12.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}>{valor ? 'alterar' : 'escrever'}</button>
        )}
      </div>

      {aEditar ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={texto} onChange={e => setTexto(e.target.value)} rows={4} autoFocus
            placeholder="Ex.: quer voltar a almoçar na sala grande com as colegas, e a filha pede que não a deixem sair sozinha."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14,
              lineHeight: 1.55, resize: 'vertical', background: 'var(--bg)', color: 'var(--ink)',
            }} />
          <div style={{ display: 'flex', gap: 9, marginTop: 8 }}>
            <button onClick={() => { aoGuardar(texto); setAEditar(false) }} style={{
              minHeight: 38, padding: '0 16px', borderRadius: 'var(--r-md)', border: 'none',
              background: cor, color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            }}>Guardar</button>
            <button onClick={() => { setTexto(valor); setAEditar(false) }} style={{
              minHeight: 38, padding: '0 14px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border-2)', background: 'transparent',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      ) : valor ? (
        <div style={{ marginTop: 8, fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {valor}
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-5)', lineHeight: 1.55 }}>{ajuda}</div>
      )}
    </section>
  )
}

function CartaoObjetivo({
  o, acoes, cor, podeEditar, aCriarAcao, abrirNovaAcao, criarAcao,
  alternarAcao, apagarAcao, mudarEstado, apagar,
}: {
  o: Objetivo; acoes: Acao[]; cor: string; podeEditar: boolean
  aCriarAcao: boolean; abrirNovaAcao: () => void
  criarAcao: (campos: Partial<Acao>) => void
  alternarAcao: (a: Acao) => void
  apagarAcao: (a: Acao) => void
  mudarEstado: (e: Objetivo['estado']) => void
  apagar: () => void
}) {
  const area = POR_AREA.get(o.area)
  const ativas = acoes.filter(a => a.ativa)
  const paradas = acoes.filter(a => !a.ativa)

  return (
    <div style={{
      marginTop: 'var(--space-7)', padding: 'var(--space-8)',
      borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{
            ...MONO, fontSize: 9.5, color: cor,
          }}>{area?.label || o.area}</span>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)',
            lineHeight: 1.35, marginTop: 4, textWrap: 'pretty' as any,
          }}>{o.titulo}</div>
          {o.porque && (
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 5, lineHeight: 1.55 }}>{o.porque}</div>
          )}
        </div>
        {podeEditar && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => mudarEstado('atingido')} title="Marcar como atingido" style={botaoMini}>✓</button>
            <button onClick={() => mudarEstado('suspenso')} title="Suspender" style={botaoMini}>⏸</button>
            <button onClick={apagar} title="Remover do plano" style={botaoMini}>×</button>
          </div>
        )}
      </div>

      {/* As ações */}
      <div style={{ marginTop: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {ativas.length === 0 && !aCriarAcao && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-5)', lineHeight: 1.5 }}>
            Sem ações. Enquanto não houver nenhuma, este objetivo não produz nada no dia de trabalho.
          </div>
        )}
        {ativas.map(a => (
          <LinhaAcao key={a.id} a={a} cor={cor} podeEditar={podeEditar}
            alternar={() => alternarAcao(a)} apagar={() => apagarAcao(a)} />
        ))}
        {paradas.length > 0 && (
          <details>
            <summary style={{ fontSize: 11.5, color: 'var(--ink-5)', cursor: 'pointer' }}>
              {paradas.length === 1 ? '1 ação parada' : `${paradas.length} ações paradas`}
            </summary>
            <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {paradas.map(a => (
                <LinhaAcao key={a.id} a={a} cor={cor} podeEditar={podeEditar}
                  alternar={() => alternarAcao(a)} apagar={() => apagarAcao(a)} />
              ))}
            </div>
          </details>
        )}
      </div>

      {podeEditar && (
        aCriarAcao
          ? <NovaAcao cor={cor} aoCriar={criarAcao} aoCancelar={abrirNovaAcao} />
          : <button onClick={abrirNovaAcao} style={{
              marginTop: 'var(--space-6)', background: 'none', border: 'none', color: cor,
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            }}>+ Acrescentar ação</button>
      )}
    </div>
  )
}

const botaoMini: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 'var(--r-sm)', border: '1px solid var(--border-2)',
  background: 'transparent', color: 'var(--ink-4)', fontSize: 13, cursor: 'pointer',
  fontFamily: 'inherit', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function LinhaAcao({ a, cor, podeEditar, alternar, apagar }: {
  a: Acao; cor: string; podeEditar: boolean; alternar: () => void; apagar: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '9px 11px', borderRadius: 'var(--r-md)',
      background: a.ativa ? 'var(--bg-2)' : 'transparent',
      border: `1px solid ${a.ativa ? 'var(--border)' : 'var(--border-2)'}`,
      opacity: a.ativa ? 1 : 0.6,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{a.o_que}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
          {cadenciaEmPalavras(a)}
          {a.quem ? ` · ${a.quem}` : ''}
          {!POR_CADENCIA.get(a.cadencia)?.noDia ? ' · não entra no dia de trabalho' : ''}
        </div>
        {a.notas && <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 3, lineHeight: 1.5 }}>{a.notas}</div>}
      </div>
      {podeEditar && (
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button onClick={alternar} title={a.ativa ? 'Parar esta ação' : 'Retomar'} style={botaoMini}>
            {a.ativa ? '⏸' : '▶'}
          </button>
          <button onClick={apagar} title="Remover" style={botaoMini}>×</button>
        </div>
      )}
    </div>
  )
}

function NovoObjetivo({ cor, aoCriar, aoCancelar }: {
  cor: string; aoCriar: (area: string, titulo: string, porque: string) => void; aoCancelar: () => void
}) {
  const [area, setArea] = useState('utentes')
  const [titulo, setTitulo] = useState('')
  const [porque, setPorque] = useState('')

  return (
    <div style={{
      marginTop: 'var(--space-7)', padding: 'var(--space-8)',
      borderRadius: 'var(--r-xl)', border: `1.5px solid ${cor}`, background: 'var(--bg)',
    }}>
      <label style={{ display: 'block', marginBottom: 10 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>De que é este objetivo</span>
        <select value={area} onChange={e => setArea(e.target.value)} style={campo}>
          {AREAS.filter(a => !a.acao).map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-5)', marginTop: 5, lineHeight: 1.45 }}>
          Decide quem da equipa vê e mexe neste objetivo.
        </span>
      </label>

      <label style={{ display: 'block', marginBottom: 10 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>O que se quer</span>
        <input
          value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus
          placeholder="Ex.: voltar a almoçar na sala grande"
          style={campo} />
      </label>

      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Porquê</span>
        <textarea
          value={porque} onChange={e => setPorque(e.target.value)} rows={2}
          placeholder="Uma frase. Daqui a seis meses é isto que diz se valeu a pena."
          style={{ ...campo, resize: 'vertical' }} />
      </label>

      <div style={{ display: 'flex', gap: 9 }}>
        <button
          onClick={() => aoCriar(area, titulo, porque)}
          disabled={!titulo.trim()}
          style={{
            minHeight: 42, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
            background: titulo.trim() ? cor : 'var(--bg-3)',
            color: titulo.trim() ? '#fff' : 'var(--ink-5)',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            cursor: titulo.trim() ? 'pointer' : 'default',
          }}>Acrescentar</button>
        <button onClick={aoCancelar} style={{
          minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-2)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer',
        }}>Cancelar</button>
      </div>
    </div>
  )
}

function NovaAcao({ cor, aoCriar, aoCancelar }: {
  cor: string; aoCriar: (campos: Partial<Acao>) => void; aoCancelar: () => void
}) {
  const [oQue, setOQue] = useState('')
  const [cadencia, setCadencia] = useState<Cadencia>('diaria')
  const [dias, setDias] = useState<number[]>([])
  const [turno, setTurno] = useState<string | null>(null)
  const [quem, setQuem] = useState('')
  const opcao = POR_CADENCIA.get(cadencia)

  const valido = oQue.trim().length > 0 && (cadencia !== 'dias_da_semana' || dias.length > 0)

  return (
    <div style={{
      marginTop: 'var(--space-6)', padding: 'var(--space-7)',
      borderRadius: 'var(--r-lg)', border: `1.5px solid ${cor}`, background: 'var(--bg-2)',
    }}>
      <label style={{ display: 'block', marginBottom: 10 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>O que se faz</span>
        <input
          value={oQue} onChange={e => setOQue(e.target.value)} autoFocus
          placeholder="Ex.: acompanhar à mesa grande ao almoço"
          style={campo} />
      </label>

      <label style={{ display: 'block', marginBottom: 10 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Com que frequência</span>
        <select value={cadencia} onChange={e => { setCadencia(e.target.value as Cadencia); setDias([]) }} style={campo}>
          {CADENCIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {opcao && (
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-5)', marginTop: 5, lineHeight: 1.45 }}>
            {opcao.ajuda}
          </span>
        )}
      </label>

      {cadencia === 'dias_da_semana' && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Em que dias</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {DIAS_DA_SEMANA.map(d => {
              const on = dias.includes(d.n)
              return (
                <button key={d.n}
                  onClick={() => setDias(p => on ? p.filter(x => x !== d.n) : [...p, d.n])}
                  title={d.label}
                  style={{
                    minWidth: 42, minHeight: 36, borderRadius: 'var(--r-md)', cursor: 'pointer',
                    border: `1.5px solid ${on ? cor : 'var(--border-2)'}`,
                    background: on ? cor : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                  }}>{d.curto}</button>
              )
            })}
          </div>
        </div>
      )}

      {opcao?.noDia && (
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Altura do dia</span>
          <select value={turno ?? ''} onChange={e => setTurno(e.target.value || null)} style={campo}>
            {TURNOS.map(t => <option key={t.id ?? 'x'} value={t.id ?? ''}>{t.label}</option>)}
          </select>
        </label>
      )}

      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>Quem costuma fazer</span>
        <input
          value={quem} onChange={e => setQuem(e.target.value)}
          placeholder="Ex.: auxiliar do turno da manhã (opcional)"
          style={campo} />
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-5)', marginTop: 5, lineHeight: 1.45 }}>
          A função, não o nome. As pessoas mudam de turno, e um plano com nomes fica errado sozinho.
        </span>
      </label>

      <div style={{ display: 'flex', gap: 9 }}>
        <button
          onClick={() => aoCriar({ o_que: oQue, cadencia, dias, turno, quem: quem.trim() || null })}
          disabled={!valido}
          style={{
            minHeight: 42, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
            background: valido ? cor : 'var(--bg-3)', color: valido ? '#fff' : 'var(--ink-5)',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: valido ? 'pointer' : 'default',
          }}>Acrescentar</button>
        <button onClick={aoCancelar} style={{
          minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-2)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer',
        }}>Cancelar</button>
      </div>
    </div>
  )
}

function NovaRevisao({ cor, aoGuardar, aoCancelar }: {
  cor: string; aoGuardar: (texto: string, decisao: Avaliacao['decisao']) => void; aoCancelar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [decisao, setDecisao] = useState<Avaliacao['decisao']>('manter')

  const DECISOES: { id: Avaliacao['decisao']; label: string }[] = [
    { id: 'manter', label: 'Manter como está' },
    { id: 'ajustar', label: 'Ajustar' },
    { id: 'fechar', label: 'Fechar o plano' },
  ]

  return (
    <div style={{
      marginTop: 'var(--space-7)', padding: 'var(--space-8)',
      borderRadius: 'var(--r-xl)', border: `1.5px solid ${cor}`, background: 'var(--bg)',
    }}>
      <label style={{ display: 'block', marginBottom: 12 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>O que mudou desde a última vez</span>
        <textarea
          value={texto} onChange={e => setTexto(e.target.value)} rows={4} autoFocus
          placeholder="O que correu bem, o que não correu, e o que se decidiu fazer a seguir."
          style={{ ...campo, resize: 'vertical' }} />
      </label>

      <div style={{ marginBottom: 14 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 6 }}>E então</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DECISOES.map(d => {
            const on = decisao === d.id
            return (
              <button key={d.id} onClick={() => setDecisao(d.id)} style={{
                minHeight: 38, padding: '0 14px', borderRadius: 20, cursor: 'pointer',
                border: `1.5px solid ${on ? cor : 'var(--border-2)'}`,
                background: on ? cor + '14' : 'transparent', color: on ? cor : 'var(--ink-3)',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              }}>{d.label}</button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9 }}>
        <button
          onClick={() => aoGuardar(texto, decisao)}
          disabled={!texto.trim()}
          style={{
            minHeight: 42, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
            background: texto.trim() ? cor : 'var(--bg-3)', color: texto.trim() ? '#fff' : 'var(--ink-5)',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: texto.trim() ? 'pointer' : 'default',
          }}>Registar revisão</button>
        <button onClick={aoCancelar} style={{
          minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-2)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer',
        }}>Cancelar</button>
      </div>
    </div>
  )
}

const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 14, minHeight: 42,
  background: 'var(--bg)', color: 'var(--ink)',
}
