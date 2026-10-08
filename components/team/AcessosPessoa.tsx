'use client'

// components/team/AcessosPessoa.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O que uma pessoa da equipa vê e faz.
//
// ── PORQUE É QUE A FRASE VEM ANTES DA MATRIZ ────────────────────────────────
// O Ankira mostra uma matriz de duzentas caixas. Tem a potência toda e não se
// lê: ninguém a percorre para perceber se a auxiliar nova vê as mensalidades.
//
// Aqui começa-se pela pergunta que se faz de facto — «o que é que esta pessoa
// consegue fazer?» — respondida numa frase em português. A matriz existe, com
// a mesma granularidade, atrás de «Afinar». Quem precisa dela encontra-a; quem
// só quer pôr a Ana a auxiliar não tem de a ver.
//
// ── O QUE FICA GUARDADO ─────────────────────────────────────────────────────
// Se as marcas coincidirem com o molde do papel, grava-se `null` — a pessoa
// SEGUE o papel, e uma mudança futura ao papel chega-lhe. Guardar uma cópia
// congelá-la-ia no dia em que foi gravada. Ver a rota /api/org/permissoes.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { estiloFundoModal } from '@/lib/camadas'
import {
  AREAS, GRUPOS, PAPEIS_ATRIBUIVEIS, POR_PAPEL, chave, permissoesDe, emPalavras,
  DETALHES_POR_AREA, negar, podeDetalhe, detalhesTirados,
  type Nivel,
} from '@/lib/permissoes'

const ACCENT = 'var(--green-3)'

interface Pessoa {
  user_id: string
  nome: string
  email?: string
  papel: string
  sobreposicao?: string[] | null
}

export default function AcessosPessoa({
  pessoa, aoFechar, aoGuardar,
}: {
  pessoa: Pessoa
  aoFechar: () => void
  aoGuardar: (papel: string, permissoes: string[] | null) => Promise<{ ok: boolean; erro?: string }>
}) {
  const [papel, setPapel] = useState(pessoa.papel)
  const [marcadas, setMarcadas] = useState<string[]>(
    () => permissoesDe(pessoa.papel, pessoa.sobreposicao),
  )
  const [afinar, setAfinar] = useState(!!pessoa.sobreposicao)
  const [aGuardar, setAGuardar] = useState(false)
  const [erro, setErro] = useState('')

  // Trocar de papel repõe o molde desse papel. Manter as marcas antigas faria
  // um "Auxiliar" com os acessos de uma "Direção Técnica" sem ninguém notar.
  useEffect(() => {
    setMarcadas(permissoesDe(papel, null))
  }, [papel])

  function alternar(area: string, nivel: Nivel) {
    const k = chave(area, nivel)
    setMarcadas(atual => {
      if (atual.includes(k)) {
        // Tirar "ver" tira também o que depende dele: editar ou eliminar sem
        // ver seria uma pessoa a escrever às cegas.
        if (nivel === 'ver') {
          return atual.filter(x => !x.startsWith(area + '.'))
        }
        if (nivel === 'editar') {
          return atual.filter(x => x !== k && x !== chave(area, 'eliminar'))
        }
        return atual.filter(x => x !== k)
      }
      // Dar "eliminar" implica dar "editar", que implica "ver".
      const juntar = [k]
      const a = AREAS.find(x => x.id === area)
      if (nivel === 'eliminar' && a?.niveis.includes('editar')) juntar.push(chave(area, 'editar'))
      if (nivel !== 'ver' && a?.niveis.includes('ver')) juntar.push(chave(area, 'ver'))
      return [...new Set([...atual, ...juntar])]
    })
  }

  /**
   * Tirar (ou devolver) um pedaco de uma ferramenta.
   *
   * Guarda-se o que foi TIRADO (`nao:utentes.financeiro`) e nao o que foi
   * dado. Ao contrario, cada detalhe novo que eu acrescentasse ao catalogo
   * escondia um pedaco a toda a gente que ja usa o produto, sem ninguem pedir.
   */
  function alternarDetalhe(id: string) {
    const k = negar(id)
    setMarcadas(atual => atual.includes(k)
      ? atual.filter(x => x !== k)
      : [...atual, k])
  }

  async function guardar() {
    setAGuardar(true); setErro('')
    const molde = POR_PAPEL.get(papel as any)?.omissao || []
    const igual = marcadas.length === molde.length && marcadas.every(x => molde.includes(x))
    const r = await aoGuardar(papel, igual ? null : marcadas)
    setAGuardar(false)
    if (!r.ok) { setErro(r.erro || 'Não foi possível guardar. Tente de novo.'); return }
    aoFechar()
  }

  const frase = emPalavras(papel, afinar ? marcadas : null)

  return (
    <div onClick={aoFechar} style={estiloFundoModal}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 'var(--r-xl)', width: 620, maxWidth: '100%',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* ── Quem ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{pessoa.nome}</div>
          {pessoa.email && (
            <div style={{ fontSize: 12, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{pessoa.email}</div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, minHeight: 0 }}>
          {/* ── O papel ─────────────────────────────────────────────────── */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 9,
          }}>O que faz na casa</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {PAPEIS_ATRIBUIVEIS.map(p => (
              <button key={p.id} onClick={() => { setPapel(p.id); setAfinar(false) }} style={{
                padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 650,
                border: `1.5px solid ${papel === p.id ? ACCENT : 'var(--border)'}`,
                background: papel === p.id ? ACCENT : 'white',
                color: papel === p.id ? 'white' : 'var(--ink-3)',
              }}>{p.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.55, marginBottom: 18 }}>
            {POR_PAPEL.get(papel as any)?.descricao}
          </div>

          {/* ── A frase ─────────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-lg)',
            padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 14, color: 'var(--green-3)', lineHeight: 1.65 }}>{frase}</div>
          </div>

          <button onClick={() => setAfinar(v => !v)} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: 'inherit',
          }}>{afinar ? '← Voltar ao papel' : 'Afinar esta pessoa →'}</button>

          {/* ── A matriz ────────────────────────────────────────────────── */}
          {afinar && detalhesTirados(marcadas).length > 0 && (
            <div style={{
              marginTop: 14, padding: '11px 13px', borderRadius: 'var(--r-lg)',
              background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 5 }}>
                Não vai ver, dentro das ferramentas a que tem acesso:
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--red)', lineHeight: 1.6 }}>
                {detalhesTirados(marcadas).map(d => d.label.toLowerCase()).join(' · ')}
              </div>
            </div>
          )}

          {afinar && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.55, marginBottom: 14, maxWidth: '58ch' }}>
                Marque o que esta pessoa pode fazer em cada área. Se voltar a bater
                certo com o papel, deixa de ser uma exceção e volta a seguir o papel.
              </div>

              {(Object.keys(GRUPOS) as (keyof typeof GRUPOS)[]).map(g => {
                const doGrupo = AREAS.filter(a => a.grupo === g)
                if (!doGrupo.length) return null
                return (
                  <div key={g} style={{ marginBottom: 20 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
                      textTransform: 'uppercase', color: 'var(--ink-5)',
                    }}>{GRUPOS[g].label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--border-2)', marginBottom: 8 }}>{GRUPOS[g].nota}</div>

                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 1,
                      background: 'var(--border)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-lg)', overflow: 'hidden',
                    }}>
                      {doGrupo.map(a => (
                        <div key={a.id} style={{
                          background: 'white', padding: '11px 13px',
                          display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap',
                        }}>
                          <div style={{ flex: '1 1 210px', minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink)' }}>{a.label}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-5)', lineHeight: 1.45, marginTop: 2 }}>{a.descricao}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            {a.niveis.map(n => {
                              const on = marcadas.includes(chave(a.id, n))
                              const rotulo = n === 'ver' ? 'Ver' : n === 'editar' ? 'Editar' : 'Eliminar'
                              const perigoso = n === 'eliminar'
                              return (
                                <button key={n} onClick={() => alternar(a.id, n)}
                                  aria-pressed={on}
                                  style={{
                                    padding: '5px 11px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                                    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                                    border: `1.5px solid ${on ? (perigoso ? 'var(--red)' : ACCENT) : 'var(--border)'}`,
                                    background: on ? (perigoso ? 'var(--badge-red-bg)' : 'var(--green-light)') : 'white',
                                    color: on ? (perigoso ? 'var(--red)' : 'var(--green-3)') : 'var(--ink-5)',
                                  }}>{rotulo}</button>
                              )
                            })}
                          </div>

                          {/* ── DENTRO DESTA FERRAMENTA ─────────────────────
                              «Dentro da mesma ferramenta, duas pessoas nao
                              verem sequer as mesmas coisas.» Estes pedacos so
                              aparecem quando a pessoa PODE abrir a ferramenta:
                              afinar o que ve dentro de uma porta fechada nao
                              quer dizer nada.

                              Sao RESTRICOES: por omissao ve tudo, e cada
                              carregar TIRA uma coisa. E por isso que ficam
                              vermelhos quando ligados — um carregar aqui
                              retira, nao acrescenta. */}
                          {marcadas.includes(chave(a.id, 'ver')) && (DETALHES_POR_AREA[a.id] || []).length > 0 && (
                            <div style={{
                              flexBasis: '100%', marginTop: 4, paddingTop: 10,
                              borderTop: '1px dashed var(--border)',
                            }}>
                              <div style={{ fontSize: 11, color: 'var(--ink-5)', marginBottom: 7 }}>
                                Dentro desta ferramenta, esconder:
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {(DETALHES_POR_AREA[a.id] || []).map(d => {
                                  const escondido = !podeDetalhe(marcadas, d.id)
                                  return (
                                    <button key={d.id} onClick={() => alternarDetalhe(d.id)}
                                      title={d.descricao} aria-pressed={escondido}
                                      style={{
                                        padding: '5px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                                        fontFamily: 'inherit', fontSize: 11, fontWeight: escondido ? 700 : 500,
                                        border: `1.5px solid ${escondido ? 'var(--red)' : 'var(--border)'}`,
                                        background: escondido ? 'var(--badge-red-bg)' : 'white',
                                        color: escondido ? 'var(--red)' : 'var(--ink-5)',
                                      }}>
                                      {escondido ? '✕ ' : ''}{d.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {erro && (
            <div style={{
              marginTop: 14, padding: '10px 13px', background: 'var(--badge-red-bg)',
              border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 12.5, color: 'var(--red)',
            }}>{erro}</div>
          )}
        </div>

        {/* ── Ações ──────────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0, display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'white',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}>
          <button onClick={aoFechar} style={{
            padding: '11px 16px', background: 'white', color: 'var(--ink-3)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 13.5,
            fontWeight: 600, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
          }}>Cancelar</button>
          <button onClick={guardar} disabled={aGuardar} style={{
            padding: '11px 20px', background: aGuardar ? 'var(--border-2)' : ACCENT, color: 'white',
            border: 'none', borderRadius: 'var(--r-md)', fontSize: 13.5, fontWeight: 800,
            cursor: aGuardar ? 'wait' : 'pointer', minHeight: 44, fontFamily: 'inherit',
          }}>{aGuardar ? 'A guardar…' : 'Guardar acessos'}</button>
        </div>
      </div>
    </div>
  )
}
