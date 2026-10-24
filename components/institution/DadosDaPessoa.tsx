'use client'

// components/institution/DadosDaPessoa.tsx
// ═══════════════════════════════════════════════════════════════════════════
// «QUERO TUDO O QUE VOCÊS TÊM SOBRE A MINHA MÃE»
// ═══════════════════════════════════════════════════════════════════════════
//
// O direito de acesso do art. 15.º, numa página. A casa tem um mês para
// responder (art. 12.º/3) e a resposta tem de ser completa — e completa quer
// dizer as duas metades do artigo, não só a primeira:
//
//   1. a CÓPIA dos dados;
//   2. a FINALIDADE de cada tratamento, as categorias, os destinatários, o
//      prazo de conservação, os direitos que assistem e como reclamar.
//
// Quase toda a gente entrega a primeira e esquece a segunda. Aqui a segunda
// está escrita no documento, saída do mesmo `lib/ropa.ts` que gera o registo
// do art. 30.º — por isso o que a casa diz à família e o que a casa diz à
// CNPD são a mesma coisa, e não podem divergir.
//
// ── O QUE NÃO SE FAZ AQUI ──────────────────────────────────────────────────
// Não se decide o que ocultar. Um registo de turno pode nomear a auxiliar que
// o escreveu; uma ocorrência pode descrever outro residente. O art. 15.º/4 diz
// que o direito de acesso não prejudica os direitos de terceiros — e a decisão
// de tapar um nome é de quem responde, não de quem programa. O que se faz é
// MARCAR onde é preciso olhar.

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import {
  blocos, semAtividade, prazoDe, basesDe, PODE_NOMEAR_TERCEIROS,
  AVISO_DE_TERCEIROS, AVISO_DE_TERCEIROS_GERAL, O_QUE_SE_TEM_DE_DIZER,
  PRAZO_DE_RESPOSTA, FORA,
} from '@/lib/direitoDeAcesso'
import { Painel, Cabecalho, Botao, Aviso, ACarregar, MONO, ROTULO } from '@/components/ui/mesa'
import { printDoc } from '@/lib/print'

interface Resposta {
  utente: { id: string; nome: string; nascimento: string | null; entrada: string | null }
  feito_em: string
  feito_por: string
  dados: Record<string, any[]>
  recusadas: Record<string, string>
  excluidas: Record<string, string>
  tabelas_lidas: number
}

export default function DadosDaPessoa({ pid, nome, cor }: {
  pid: string; nome: string; cor: string
}) {
  const { supabase } = useAuth() as any
  const [r, setR] = useState<Resposta | null>(null)
  const [aJuntar, setAJuntar] = useState(false)
  const [erro, setErro] = useState('')

  /* Não se carrega sozinho. Isto são setenta leituras da base de dados sobre
     uma pessoa, e abrir a ficha de alguém não é pedir o processo todo — fazê-
     lo a cada abertura seria custo e exposição por nada. Pede-se quando
     alguém pediu mesmo. */
  const juntar = useCallback(async () => {
    setAJuntar(true); setErro(''); setR(null)
    try {
      const { data } = await supabase.auth.getSession()
      const resp = await fetch(`/api/dados-do-utente?utente=${encodeURIComponent(pid)}`, {
        headers: { Authorization: `Bearer ${data?.session?.access_token || ''}` },
      })
      const j = await resp.json()
      if (!resp.ok) { setErro(j.error || 'Não foi possível juntar os dados.'); return }
      setR(j)
    } catch {
      setErro('Não foi possível juntar os dados. Verifique a ligação.')
    } finally { setAJuntar(false) }
  }, [supabase, pid])

  const comDados = r ? Object.keys(r.dados) : []
  const osBlocos = r ? blocos(comDados) : []
  const soltas = r ? semAtividade(comDados) : []
  const linhas = r ? Object.values(r.dados).reduce((s, v) => s + v.length, 0) : 0
  const recusadas = r ? Object.entries(r.recusadas) : []

  function imprimir() {
    if (!r) return
    printDoc({
      docTitle: 'Dados pessoais — direito de acesso',
      docSubtitle: `${r.utente.nome} · art. 15.º do RGPD`,
      author: r.feito_por,
      meta: [
        { label: 'Pedido respondido em', value: new Date(r.feito_em).toLocaleDateString('pt-PT') },
        { label: 'Blocos de tratamento', value: String(osBlocos.length) },
        { label: 'Registos', value: String(linhas) },
      ],
      sections: [
        {
          heading: 'O que a lei obriga a dizer, além dos dados',
          note: PRAZO_DE_RESPOSTA.frase,
          records: O_QUE_SE_TEM_DE_DIZER.map(x => ({
            title: x.titulo, meta: x.artigo, body: x.texto,
          })),
        },
        ...osBlocos.map(b => {
          const p = prazoDe(b.atividade)
          return {
            heading: b.atividade.nome,
            note: b.atividade.finalidade,
            records: [
              {
                title: 'Sobre este tratamento',
                fields: [
                  { label: 'Base legal', value: basesDe(b.atividade).join(' · ') },
                  {
                    label: 'Categorias',
                    value: b.atividade.categorias.join(' · '),
                  },
                  {
                    label: 'Destinatários',
                    value: b.atividade.destinatarios.length
                      ? b.atividade.destinatarios.join(' · ')
                      : 'Ninguém fora da casa e de quem a serve (ver subcontratantes).',
                  },
                  ...(p ? [{
                    label: 'Conservação',
                    value: `${p.quanto}, ${p.desde}. ${p.naLei ? 'Fixado na lei' : 'Prazo escolhido pela casa'}: ${p.fundamento}`,
                  }] : []),
                ],
                ...(b.revejaTerceiros ? { body: AVISO_DE_TERCEIROS } : {}),
              },
              ...b.tabelas.map(t => ({
                title: t,
                meta: `${r.dados[t].length} ${r.dados[t].length === 1 ? 'registo' : 'registos'}`
                  + (PODE_NOMEAR_TERCEIROS.has(t) ? ' · pode nomear terceiros' : ''),
                body: JSON.stringify(r.dados[t], null, 1),
              })),
            ],
          }
        }),
        ...(soltas.length ? [{
          heading: 'Ainda por classificar',
          note: 'Guardam dados desta pessoa e ainda não estão associados a uma finalidade no registo de tratamentos. Vão aqui para a resposta não ficar incompleta.',
          records: soltas.map(t => ({
            title: t,
            meta: `${r.dados[t].length} registos`,
            body: JSON.stringify(r.dados[t], null, 1),
          })),
        }] : []),
        ...(recusadas.length ? [{
          heading: 'O que esta conta não conseguiu ler',
          note: 'Estes blocos existem e não entraram no documento. Peça-os a quem tem acesso a essas áreas antes de entregar a resposta.',
          records: recusadas.map(([t, porque]) => ({ title: t, body: porque })),
        }] : []),
      ],
      footerNote:
        'Documento gerado pelo Phlox a partir do registo de atividades de tratamento (art. 30.º). '
        + 'Reclamações: Comissão Nacional de Proteção de Dados, www.cnpd.pt.',
    })
  }

  return (
    <Painel
      cabeca={
        <Cabecalho>
          <span style={{ ...ROTULO, flex: 1 }}>Tudo o que a casa tem sobre {nome.split(' ')[0]}</span>
          <span style={{ ...ROTULO, color: 'var(--ink-5)' }}>art. 15.º RGPD</span>
        </Cabecalho>
      }
    >
      <div style={{ padding: 14, display: 'grid', gap: 12 }}>
        {!r && !aJuntar && (
          <>
            <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.55, maxWidth: '68ch' }}>
              Quando a pessoa, ou quem a representa, pede o que a casa guarda sobre ela,
              a resposta tem de ser completa e sair no prazo de um mês. Isto junta tudo
              o que está na aplicação — e diz, ao lado de cada bloco, para que serve,
              durante quanto tempo fica guardado e a quem pode ser comunicado.
            </p>
            <div>
              <Botao feitio="principal" onClick={juntar}>JUNTAR TUDO</Botao>
            </div>
            <Aviso tom="neutro">
              {PRAZO_DE_RESPOSTA.frase} ({PRAZO_DE_RESPOSTA.artigo})
            </Aviso>
          </>
        )}

        {aJuntar && <ACarregar oQue="A percorrer tudo o que está guardado…" />}
        {erro && <Aviso tom="mau" titulo="Não deu">{erro}</Aviso>}

        {r && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              <Medida rotulo="Blocos" valor={osBlocos.length} cor={cor} />
              <Medida rotulo="Registos" valor={linhas} cor={cor} />
              <Medida rotulo="Tabelas lidas" valor={r.tabelas_lidas} cor="var(--ink-4)" />
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Botao feitio="principal" onClick={imprimir}>IMPRIMIR / PDF</Botao>
              <Botao onClick={juntar}>VOLTAR A JUNTAR</Botao>
            </div>

            {recusadas.length > 0 && (
              <Aviso tom="atencao" titulo="Falta uma parte">
                {recusadas.length === 1
                  ? 'Há um bloco que esta conta não pode ler'
                  : `Há ${recusadas.length} blocos que esta conta não pode ler`}
                {' '}({recusadas.map(([t]) => t).join(', ')}). Entregar a resposta assim é
                entregá-la incompleta — peça essa parte a quem tem acesso a essas áreas.
              </Aviso>
            )}

            {/* O aviso do art. 15.º/4 fica AQUI, uma vez, e nao em cada bloco.
                Estava em cada um: quatro paragrafos identicos no mesmo ecra.
                Um aviso repetido quatro vezes deixa de ser lido a primeira. */}
            {osBlocos.some(b => b.revejaTerceiros) && (
              <Aviso tom="atencao" titulo="Rever antes de entregar">
                {AVISO_DE_TERCEIROS_GERAL}
              </Aviso>
            )}

            {soltas.length > 0 && (
              <Aviso tom="atencao" titulo="Ainda por classificar">
                {soltas.join(', ')} — guardam dados desta pessoa e ainda não estão
                associados a uma finalidade no registo de tratamentos. Entram no
                documento à mesma.
              </Aviso>
            )}

            {/* ── A LISTA, PARA SE VER ANTES DE IMPRIMIR ──────────────────
                Quem responde a um pedido destes quer saber O QUE VAI SAIR
                antes de o mandar. Os registos em si não se mostram aqui — são
                milhares de linhas e já estão nos ecrãs próprios; o que falta
                é o inventário. */}
            <div style={{ display: 'grid', gap: 8 }}>
              {osBlocos.map(b => (
                <div key={b.atividade.id} style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                  borderLeft: `3px solid ${b.revejaTerceiros ? 'var(--amber)' : cor}`,
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 'var(--t-corpo)', marginBottom: 3 }}>{b.atividade.nome}</div>
                  <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
                    {b.tabelas.map(t => `${t} ${r.dados[t].length}`).join('  ·  ')}
                  </div>
                  {b.revejaTerceiros && (
                    <div style={{ ...ROTULO, color: 'var(--amber)', marginTop: 5 }}>
                      Rever antes de entregar
                    </div>
                  )}
                </div>
              ))}
            </div>

            {osBlocos.length === 0 && (
              <Aviso tom="neutro">
                Não há nada guardado sobre esta pessoa além da ficha — o que acontece
                quando alguém foi inscrito e ainda não começou.
              </Aviso>
            )}

            <details>
              <summary style={{ ...ROTULO, cursor: 'pointer', color: 'var(--ink-4)' }}>
                O que não entra, e porquê ({Object.keys(FORA).length})
              </summary>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {Object.entries(FORA).map(([t, porque]) => (
                  <div key={t} style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.45 }}>
                    <span style={{ ...MONO, color: 'var(--ink-3)' }}>{t}</span> — {porque}
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </Painel>
  )
}

function Medida({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div>
      <div style={{ ...ROTULO, color: 'var(--ink-5)', marginBottom: 2 }}>{rotulo}</div>
      <div style={{ ...MONO, fontSize: 'var(--t-numero)', lineHeight: 1, color: cor }}>{valor}</div>
    </div>
  )
}
