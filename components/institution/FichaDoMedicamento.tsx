'use client'

// components/institution/FichaDoMedicamento.tsx
// ═══════════════════════════════════════════════════════════════════════════
// O QUE ESTE MEDICAMENTO É, AO ALCANCE DE UM TOQUE NO NOME
// ═══════════════════════════════════════════════════════════════════════════
//
// Na ficha de alguém, a linha de um medicamento diz o nome, a dose e o turno.
// Quem está a dar a volta à medicação e não conhece um nome tem de sair da
// página, procurar noutro lado, e voltar. A maior parte das vezes não procura.
//
// Tocar no nome abre isto: o que o rótulo do medicamento diz, organizado em
// quatro perguntas, mais a dose e o horário que ESTA pessoa tem prescritos.
//
// ── A ORDEM DAS ABAS NÃO É ARBITRÁRIA ──────────────────────────────────────
// «Nesta pessoa» primeiro, porque é a única parte que é desta pessoa e não do
// medicamento em geral. Depois «Para que serve», que é a pergunta que alguém
// faz primeiro. Depois «O que pode causar», que é a que importa quando algo
// corre mal. «Cuidados» e «Interações» por último — são as que se consultam,
// não as que se leem de passagem.
//
// ── O QUE ISTO NÃO É ───────────────────────────────────────────────────────
// Não é a bula oficial portuguesa. É o rótulo publicado pela FDA, em inglês,
// escrito pelo fabricante — e isso está dito no fim, não escondido. Um
// medicamento que não exista nesse registo aparece com uma frase honesta em
// vez de uma ficha vazia que pareça completa.

import { useState, useEffect } from 'react'
import {
  Folha, Botao, Seletor, Codigo, Vazio, ACarregar, Aviso, MONO, ROTULO,
} from '@/components/ui/mesa'

interface Explicacao {
  resumo: string
  serve: string | null
  vigiar: string[]
  cuidados: string[]
  interacoes: string[]
}

interface Dados {
  encontrado: boolean
  nome_original: string | null
  indicacoes: string | null
  texto_adversos: string | null
  avisos: string | null
  interacoes: string | null
  fonte: string | null
  efeitos: string[]
  /** A bula lida, traduzida e arrumada. Null quando não foi possível ler. */
  explicacao: Explicacao | null
  origemDaLeitura: string | null
}

type Aba = 'pessoa' | 'serve' | 'causa' | 'cuidados' | 'interacoes'

export default function FichaDoMedicamento({ med, pessoa, auth, aoFechar }: {
  /** O que está prescrito a esta pessoa. */
  med: { name: string; dose?: string | null; frequency?: string | null; indication?: string | null; notes?: string | null; route?: string | null }
  pessoa: string
  auth: () => Promise<Record<string, string>>
  aoFechar: () => void
}) {
  const [d, setD] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('pessoa')
  /* O texto do fabricante fica a um toque, não à frente.
     Fica porque é a fonte e alguém há de o querer confrontar; fica ESCONDIDO
     porque, à frente, é o bloco de prosa inglesa que fazia a aba inteira ser
     saltada — que é o problema que a leitura veio resolver. */
  const [verOriginal, setVerOriginal] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch(`/api/medicamento-ficha?nome=${encodeURIComponent(med.name)}`, { headers: await auth() })
        const j = await r.json()
        if (!vivo) return
        if (!r.ok) { setErro(j.error || 'Não foi possível consultar.'); return }
        setD(j)
      } catch {
        if (vivo) setErro('Não foi possível consultar. Verifique a ligação.')
      } finally { if (vivo) setCarregando(false) }
    })()
    return () => { vivo = false }
  }, [med.name, auth])

  const temTexto = (t: string | null | undefined) => !!t && t.trim().length > 2

  /* Uma aba sem conteúdo não aparece. Mostrar «O que pode causar» vazio é
     dizer a quem lê que não há nada a assinalar — e o que há é falta de
     informação, que é outra coisa. */
  const ex = d?.explicacao || null

  /* Uma aba existe se houver leitura OU texto original. A leitura é o que se
     mostra; o original é o que a sustenta, e sem um deles a aba não tem o que
     dizer. */
  const temAlgo = (lido: unknown, bruto: string | null | undefined) =>
    (Array.isArray(lido) ? lido.length > 0 : !!lido) || temTexto(bruto)

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'pessoa', rotulo: 'Nesta pessoa' },
    ...(temAlgo(ex?.serve, d?.indicacoes) ? [{ id: 'serve' as Aba, rotulo: 'Para que serve' }] : []),
    ...(temAlgo(ex?.vigiar, d?.texto_adversos) ? [{ id: 'causa' as Aba, rotulo: 'O que pode causar' }] : []),
    ...(temAlgo(ex?.cuidados, d?.avisos) ? [{ id: 'cuidados' as Aba, rotulo: 'Cuidados' }] : []),
    ...(temAlgo(ex?.interacoes, d?.interacoes) ? [{ id: 'interacoes' as Aba, rotulo: 'Interações' }] : []),
  ]

  const Paragrafo = ({ texto }: { texto: string | null | undefined }) => (
    <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.65, margin: '8px 0 0' }}>
      {texto}
    </p>
  )

  /** Uma lista de coisas lidas da bula. Uma por linha, com um filete. */
  const Pontos = ({ itens, cor }: { itens: string[]; cor?: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
      {itens.map((t, i) => (
        <div key={i} style={{
          display: 'flex', gap: 9, fontSize: 'var(--t-corpo)', color: 'var(--ink-2)',
          lineHeight: 1.55, paddingLeft: 9, borderLeft: `2px solid ${cor || 'var(--border-2)'}`,
        }}>{t}</div>
      ))}
    </div>
  )

  /* O texto do fabricante, atrás de um toque.
     É o que sustenta a leitura e tem de poder ver-se — mas em inglês e em
     prosa regulatória não é o que se põe à frente de quem tem três minutos
     entre dois quartos. */
  const Original = ({ texto }: { texto: string | null | undefined }) => {
    if (!temTexto(texto)) return null
    return (
      <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <button type="button" onClick={() => setVerOriginal(v => !v)}
          style={{
            ...ROTULO, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--ink-4)',
          }}>
          {verOriginal ? '− ' : '+ '}Texto do fabricante, em inglês
        </button>
        {verOriginal && (
          <p style={{
            fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.6, margin: '8px 0 0',
          }}>{texto}</p>
        )}
      </div>
    )
  }

  return (
    <Folha titulo={med.name} aoFechar={aoFechar}>
      {abas.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <Seletor opcoes={abas} ativa={aba} aoMudar={v => setAba(v as Aba)} />
        </div>
      )}

      {/* ── O que esta pessoa tem prescrito ─────────────────────────────── */}
      {aba === 'pessoa' && (
        <div style={{ marginTop: 10 }}>
          {[
            ['Dose', med.dose],
            ['Horário', med.frequency],
            ['Via', med.route],
            ['Para quê', med.indication],
            ['Notas', med.notes],
          ].filter(([, v]) => !!v).map(([r, v]) => (
            <div key={String(r)} style={{
              display: 'flex', gap: 10, padding: '6px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ ...ROTULO, minWidth: 74 }}>{r}</span>
              <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>{v}</span>
            </div>
          ))}
          {/* O RESUMO ENTRA AQUI, E NÃO NUMA ABA SÓ DELE.
              «O que é isto?» é a pergunta que faz alguém tocar no nome de um
              medicamento — não vale a pena obrigar a mudar de aba para a
              responder. Duas frases, por baixo do que está prescrito. */}
          {ex?.resumo && (
            <p style={{
              fontSize: 'var(--t-corpo)', color: 'var(--ink)', lineHeight: 1.6,
              margin: '12px 0 0', paddingLeft: 9, borderLeft: '2px solid var(--green)',
            }}>{ex.resumo}</p>
          )}
          <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 10, lineHeight: 1.5 }}>
            É isto que está prescrito a {pessoa}. O resto das abas é sobre o medicamento,
            não sobre esta pessoa.
          </div>
        </div>
      )}

      {carregando && aba !== 'pessoa' && <ACarregar oQue="A consultar o rótulo…" />}
      {erro && aba !== 'pessoa' && <Aviso tom="mau">{erro}</Aviso>}

      {/* ── O QUE A BULA DIZ, EM PORTUGUÊS ───────────────────────────────
          A leitura vem primeiro e o texto do fabricante fica atrás de um
          toque. A ordem importa: era a prosa inglesa que fazia estas abas
          serem saltadas, e saltar a aba «o que pode causar» numa ficha de
          medicação é o custo real disto. */}
      {aba === 'serve' && (
        <div>
          {ex?.serve
            ? <Paragrafo texto={ex.serve} />
            : <Paragrafo texto={d?.indicacoes} />}
          {ex?.serve && <Original texto={d?.indicacoes} />}
        </div>
      )}

      {aba === 'cuidados' && (
        <div>
          {ex && ex.cuidados.length > 0
            ? <Pontos itens={ex.cuidados} cor="var(--amber)" />
            : <Paragrafo texto={d?.avisos} />}
          {ex && ex.cuidados.length > 0 && <Original texto={d?.avisos} />}
        </div>
      )}

      {aba === 'interacoes' && (
        <div>
          {ex && ex.interacoes.length > 0
            ? <Pontos itens={ex.interacoes} cor="var(--red)" />
            : <Paragrafo texto={d?.interacoes} />}
          {ex && ex.interacoes.length > 0 && <Original texto={d?.interacoes} />}
        </div>
      )}

      {aba === 'causa' && (
        <div>
          {/* Os termos ficam: são o que o cruzamento com as ocorrências
              procura no texto de quem escreve, e vê-los aqui é o que explica
              porque é que uma ocorrência ligou a este medicamento. */}
          {(d?.efeitos?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
              {(d?.efeitos || []).map(e => <Codigo key={e} texto={e.toUpperCase()} cor="var(--amber)" />)}
            </div>
          )}
          {ex && ex.vigiar.length > 0
            ? <Pontos itens={ex.vigiar} cor="var(--amber)" />
            : <Paragrafo texto={d?.texto_adversos} />}
          {ex && ex.vigiar.length > 0 && <Original texto={d?.texto_adversos} />}
        </div>
      )}

      {/* ── Quando não há rótulo ────────────────────────────────────────── */}
      {!carregando && !erro && d && !d.encontrado && aba === 'pessoa' && (
        <div style={{ marginTop: 12 }}>
          <Aviso tom="neutro">
            Não encontrámos este medicamento no registo de rótulos que consultamos.
            Isso não quer dizer que não tenha efeitos ou interações — quer dizer
            que não os temos aqui. A bula da embalagem continua a ser a fonte.
          </Aviso>
        </div>
      )}

      {/* ── De onde vem ─────────────────────────────────────────────────── */}
      {/* A linha de origem muda com o que está no ecrã. Dizer «não traduzido»
          por baixo de um texto traduzido seria falso, e numa ficha de
          medicação a frase que diz de onde vem a informação é a última coisa
          que pode estar errada. */}
      {d?.encontrado && aba !== 'pessoa' && (
        <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 12, lineHeight: 1.5 }}>
          {d.fonte || 'Rótulo publicado pelo fabricante'}
          {' — '}
          {ex && d.origemDaLeitura
            ? d.origemDaLeitura
            : 'texto do fabricante, em inglês, não traduzido. Não substitui a bula da embalagem '
              + 'nem a indicação de quem prescreveu.'}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Botao onClick={aoFechar}>FECHAR</Botao>
      </div>
    </Folha>
  )
}
