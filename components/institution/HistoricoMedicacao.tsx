'use client'

// components/institution/HistoricoMedicacao.tsx
// ═══════════════════════════════════════════════════════════════════════════
// QUEM MUDOU A MEDICAÇÃO, QUANDO, E POR INDICAÇÃO DE QUEM
// ═══════════════════════════════════════════════════════════════════════════
//
// A pergunta que se faz quando um utente piora — «desde quando é que ela toma
// meio comprimido?» — e que até agora não tinha resposta: mudar uma dose
// sobrescrevia a linha. As linhas vêm da `medicacao_alteracoes`, escrita por
// um gatilho (sprint189), por isso nenhuma mudança escapa.
//
// Mostra também quando a farmácia viu cada alteração — é o que fecha o ciclo:
// quem mudou a dose sabe que quem prepara a caixa já sabe.
//
// Só regista e compara versões. Não diz se uma mudança está certa.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { isSetupError } from '@/lib/clientError'
import { printDoc } from '@/lib/print'
import {
  oQueMudou, ROTULO_DO_TIPO, quemIndicou, posologia, type Alteracao,
} from '@/lib/mapaTerapeutico'
import {
  Painel, Cabecalho, LinhaTabela, Botao, Vazio, ACarregar, Aviso, MONO, ROTULO,
} from '@/components/ui/mesa'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-PT', {
  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
})

const COR_DO_TIPO: Record<Alteracao['tipo'], string> = {
  nova: 'var(--green)', alterada: 'var(--ink-2)', suspensa: 'var(--amber)',
  retomada: 'var(--green)', removida: 'var(--ink-4)',
}

const MOSTRA = 8

export default function HistoricoMedicacao({ pid, nome }: { pid: string; nome: string }) {
  const { user, supabase } = useAuth() as any
  const [linhas, setLinhas] = useState<Alteracao[] | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [todas, setTodas] = useState(false)

  const carregar = useCallback(async () => {
    if (!user || !pid) return
    const { data, error } = await supabase.from('medicacao_alteracoes')
      .select('id, created_at, tipo, med_nome, antes, depois, indicacao_de, indicacao_tipo, indicacao_nota, alterado_por_nome, vista_farmacia_em')
      .eq('patient_id', pid).order('created_at', { ascending: false }).limit(200)
    if (error) {
      // Sem o sprint189 a tabela não existe. Não é uma avaria: é uma
      // migração por correr, e o resto da ficha funciona sem isto.
      if (isSetupError(error)) { setIndisponivel(true); setLinhas([]); return }
      console.error('[phlox:historico-medicacao]', error)
      setErro('Não foi possível ler o histórico da medicação.')
      setLinhas([])
      return
    }
    setErro('')
    setLinhas((data || []) as Alteracao[])
  }, [user, supabase, pid])

  useEffect(() => { carregar() }, [carregar])

  // Qualquer ecrã que mude a medicação avisa — ver `depoisDeMudarMedicacao`.
  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (!d || d === pid) carregar()
    }
    window.addEventListener('phlox:medicacao-mudou', ouvir)
    return () => window.removeEventListener('phlox:medicacao-mudou', ouvir)
  }, [carregar, pid])

  /* O mapa em papel: a medicação de hoje e o que mudou nos últimos 90 dias.
     É o que se leva a uma consulta, se entrega numa visita, ou se manda a
     quem prepara a medicação. */
  async function imprimir() {
    const { data: meds, error } = await supabase.from('patient_meds')
      .select('name, dose, frequency, shifts, sos, sos_para, active')
      .eq('patient_id', pid).or('active.is.null,active.eq.true').order('name')
    if (error) { setErro('Não foi possível ler a medicação para imprimir.'); return }
    const desde = Date.now() - 90 * 86_400_000
    const recentes = (linhas || []).filter(l => new Date(l.created_at).getTime() >= desde)
    printDoc({
      docTitle: 'Mapa terapêutico',
      docSubtitle: `${nome} · ${new Date().toLocaleDateString('pt-PT')}`,
      sections: [
        {
          heading: 'Medicação atual',
          records: (meds || []).map((m: any) => ({ title: m.name, meta: posologia(m) || 'sem posologia escrita' })),
        },
        {
          heading: 'Alterações dos últimos 90 dias',
          note: recentes.length ? undefined : 'Nenhuma alteração registada neste período.',
          records: recentes.map(l => ({
            title: `${quando(l.created_at)} · ${ROTULO_DO_TIPO[l.tipo]} · ${l.med_nome}`,
            body: oQueMudou(l).join('\n'),
            meta: `Por indicação de: ${quemIndicou(l)}${l.alterado_por_nome ? ` · registado por ${l.alterado_por_nome}` : ''}`,
          })),
        },
      ],
      footerNote: 'Registo da instituição. Não substitui a prescrição médica.',
    })
  }

  if (indisponivel) return null

  const cabeca = (
    <Cabecalho>
      <span style={{ ...ROTULO, flex: 1 }}>Histórico da medicação</span>
      {linhas && linhas.length > 0 && <span style={{ ...ROTULO, color: 'var(--ink-5)' }}>{linhas.length}</span>}
    </Cabecalho>
  )

  if (linhas === null) return <Painel cabeca={cabeca}><ACarregar oQue="A ler o histórico…" /></Painel>

  const visiveis = todas ? linhas : linhas.slice(0, MOSTRA)

  return (
    <Painel cabeca={cabeca} rodape={
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Botao onClick={imprimir}>IMPRIMIR O MAPA</Botao>
        {linhas.length > MOSTRA && (
          <Botao onClick={() => setTodas(v => !v)}>{todas ? 'MOSTRAR MENOS' : `VER AS ${linhas.length}`}</Botao>
        )}
      </div>
    }>
      {erro && <div style={{ padding: 14 }}><Aviso tom="mau">{erro}</Aviso></div>}
      {linhas.length === 0 ? (
        <Vazio titulo="Ainda não há alterações registadas."
          oQueFazer={`A partir de agora, cada mudança à medicação de ${nome.split(' ')[0]} fica aqui — com quem a fez, quando, e por indicação de quem.`} />
      ) : visiveis.map(l => (
        <LinhaTabela key={l.id}
          antes={{
            largura: 92,
            conteudo: <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{quando(l.created_at)}</span>,
          }}
          principal={l.med_nome}
          secundaria={oQueMudou(l).join(' · ')}
          celulas={[
            { rotulo: 'O quê', valor: ROTULO_DO_TIPO[l.tipo], largura: 78, cor: COR_DO_TIPO[l.tipo] },
            { rotulo: 'Indicação', valor: quemIndicou(l), largura: 200 },
            { rotulo: 'Registou', valor: l.alterado_por_nome || '—', largura: 120, soLargo: true },
          ]}
          fim={l.vista_farmacia_em ? (
            <span title={`A farmácia viu a ${quando(l.vista_farmacia_em)}`}
              style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--green)' }}>FARMÁCIA VIU</span>
          ) : undefined}
        />
      ))}
    </Painel>
  )
}
