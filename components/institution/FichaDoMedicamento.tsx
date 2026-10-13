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

interface Dados {
  encontrado: boolean
  nome_original: string | null
  indicacoes: string | null
  texto_adversos: string | null
  avisos: string | null
  interacoes: string | null
  fonte: string | null
  efeitos: string[]
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
  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'pessoa', rotulo: 'Nesta pessoa' },
    ...(temTexto(d?.indicacoes) ? [{ id: 'serve' as Aba, rotulo: 'Para que serve' }] : []),
    ...(temTexto(d?.texto_adversos) ? [{ id: 'causa' as Aba, rotulo: 'O que pode causar' }] : []),
    ...(temTexto(d?.avisos) ? [{ id: 'cuidados' as Aba, rotulo: 'Cuidados' }] : []),
    ...(temTexto(d?.interacoes) ? [{ id: 'interacoes' as Aba, rotulo: 'Interações' }] : []),
  ]

  const Paragrafo = ({ texto }: { texto: string | null | undefined }) => (
    <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.65, margin: '8px 0 0' }}>
      {texto}
    </p>
  )

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
          <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 10, lineHeight: 1.5 }}>
            É isto que está prescrito a {pessoa}. O resto das abas é sobre o medicamento,
            não sobre esta pessoa.
          </div>
        </div>
      )}

      {carregando && aba !== 'pessoa' && <ACarregar oQue="A consultar o rótulo…" />}
      {erro && aba !== 'pessoa' && <Aviso tom="mau">{erro}</Aviso>}

      {aba === 'serve' && <Paragrafo texto={d?.indicacoes} />}
      {aba === 'cuidados' && <Paragrafo texto={d?.avisos} />}
      {aba === 'interacoes' && <Paragrafo texto={d?.interacoes} />}

      {aba === 'causa' && (
        <div>
          {(d?.efeitos?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
              {(d?.efeitos || []).map(e => <Codigo key={e} texto={e.toUpperCase()} cor="var(--amber)" />)}
            </div>
          )}
          <Paragrafo texto={d?.texto_adversos} />
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
      {d?.encontrado && aba !== 'pessoa' && (
        <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 12, lineHeight: 1.5 }}>
          {d.fonte || 'Rótulo publicado pelo fabricante'}
          {' — '}texto do fabricante, em inglês, não traduzido. Não substitui a bula da embalagem
          nem a indicação de quem prescreveu.
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Botao onClick={aoFechar}>FECHAR</Botao>
      </div>
    </Folha>
  )
}
