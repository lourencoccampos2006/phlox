'use client'

// components/team/PerfisDeAcesso.tsx
// ═══════════════════════════════════════════════════════════════════════════
// A MESMA CONFIGURAÇÃO DE ACESSOS, COM UM NOME, PARA VÁRIAS PESSOAS
// ═══════════════════════════════════════════════════════════════════════════
// Hoje, para dizer «as seis auxiliares da noite não veem o financeiro»,
// abre-se a ficha de cada uma e marca-se a mesma matriz seis vezes. À sétima
// contratação alguém se engana — e o engano não dá erro nenhum: dá acesso a
// mais do que devia, calado.
//
// Um perfil é um nome, uma explicação e a lista de permissões. Aplica-se a
// quantas pessoas se quiser, de uma vez.
//
// ── O PERFIL É UM CARIMBO, NÃO UM VÍNCULO ──────────────────────────────────
// Aplicar COPIA as permissões para cada pessoa. Mudar o perfil depois não
// muda ninguém. É deliberado: um perfil que mudasse sozinho o acesso de seis
// pessoas a meio de um turno é a espécie de surpresa que ninguém quer numa
// casa com inspeção. Quem muda vê quantas pessoas o usam e decide se reaplica.
//
// ── ESCONDER NÃO É PROTEGER ────────────────────────────────────────────────
// Quem guarda é a /api/org/perfis-acesso, que verifica outra vez do lado do
// servidor com as mesmas três regras da página de acessos: só mexe quem tem
// `permissoes.editar`, ninguém mexe no Dono, ninguém se dá permissões a si.

import { useState, useEffect, useCallback } from 'react'
import {
  AREAS, GRUPOS, PAPEIS_ATRIBUIVEIS, permissoesDe, chave, POR_AREA,
  type Nivel,
} from '@/lib/permissoes'
import {
  Painel, Cabecalho, Botao, Campo, Vazio, ACarregar, Aviso, Folha, Codigo,
  CAIXA, CAIXA_TEXTO, MONO, ROTULO,
} from '@/components/ui/mesa'
import AvisoDeSetup from '@/components/AvisoDeSetup'

interface Perfil {
  id: string
  nome: string
  descricao: string | null
  papel_base: string | null
  permissoes: string[]
  /** `null` quando a contagem não pôde ser lida — e aí não se diz número. */
  pessoas: number | null
}
interface Pessoa { user_id: string; nome: string; papel: string }

/** «Abre 7 áreas, 3 delas com edição.» O `resumoCurto` do lib/permissoes diz
 *  o nome do PAPEL; aqui o que interessa é a dimensão do que se está a dar. */
function emPalavras(permissoes: string[]): string {
  const areas = new Set(permissoes.map(p => p.split('.')[0]).filter(a => POR_AREA.has(a)))
  const comEscrita = new Set(
    permissoes.filter(p => p.endsWith('.editar') || p.endsWith('.eliminar'))
      .map(p => p.split('.')[0]))
  if (!areas.size) return 'Não abre nada — a pessoa não vê nenhuma área.'
  return `Abre ${areas.size} ${areas.size === 1 ? 'área' : 'áreas'}`
    + (comEscrita.size ? `, ${comEscrita.size} com edição.` : ', todas só de leitura.')
}

export default function PerfisDeAcesso({ auth, pessoas, aoAplicar }: {
  auth: () => Promise<Record<string, string>>
  /** A equipa, para escolher a quem aplicar. O Dono e a própria conta não entram. */
  pessoas: Pessoa[]
  /** Para a página mãe recarregar a equipa depois de aplicar. */
  aoAplicar?: () => void | Promise<void>
}) {
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [carregando, setCarregando] = useState(true)
  const [porInstalar, setPorInstalar] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [aEditar, setAEditar] = useState<Partial<Perfil> | null>(null)
  const [aAplicar, setAAplicar] = useState<Perfil | null>(null)
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set())
  const [aGuardar, setAGuardar] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('')
    try {
      const r = await fetch('/api/org/perfis-acesso', { headers: await auth() })
      const j = await r.json()
      if (j.porInstalar) { setPorInstalar(j.porInstalar); setPerfis([]); return }
      if (!r.ok) { setErro(j.error || 'Não foi possível ler os perfis.'); return }
      setPorInstalar(null)
      setPerfis(j.perfis || [])
    } catch { setErro('Não foi possível ler os perfis. Verifique a ligação.') }
    finally { setCarregando(false) }
  }, [auth])

  useEffect(() => { carregar() }, [carregar])

  async function guardar() {
    if (!aEditar?.nome?.trim()) { setErro('O perfil precisa de um nome.'); return }
    setAGuardar(true); setErro('')
    try {
      const r = await fetch('/api/org/perfis-acesso', {
        method: 'POST', headers: await auth(),
        body: JSON.stringify({
          acao: 'guardar', id: aEditar.id, nome: aEditar.nome,
          descricao: aEditar.descricao, papelBase: aEditar.papel_base,
          permissoes: aEditar.permissoes || [],
        }),
      })
      const j = await r.json()
      if (!r.ok) { setErro(j.error || 'Não foi possível guardar.'); return }
      setAEditar(null)
      await carregar()
    } finally { setAGuardar(false) }
  }

  async function apagar(p: Perfil) {
    const aviso = p.pessoas === null
      ? 'Não foi possível saber quantas pessoas usam este perfil. Apagá-lo NÃO tira acesso a ninguém — só deixa de haver a etiqueta. Apagar?'
      : p.pessoas
        ? `${p.pessoas} ${p.pessoas === 1 ? 'pessoa usa' : 'pessoas usam'} este perfil. Apagá-lo NÃO lhes tira o acesso que já têm — só deixa de haver a etiqueta. Apagar?`
        : 'Apagar este perfil?'
    if (!confirm(aviso)) return
    const r = await fetch('/api/org/perfis-acesso', {
      method: 'POST', headers: await auth(),
      body: JSON.stringify({ acao: 'apagar', id: p.id }),
    })
    const j = await r.json()
    if (!r.ok) { setErro(j.error || 'Não foi possível apagar.'); return }
    await carregar()
  }

  async function aplicar() {
    if (!aAplicar || !escolhidas.size) return
    setAGuardar(true); setErro('')
    try {
      const r = await fetch('/api/org/perfis-acesso', {
        method: 'POST', headers: await auth(),
        body: JSON.stringify({ acao: 'aplicar', id: aAplicar.id, userIds: [...escolhidas] }),
      })
      const j = await r.json()
      if (!r.ok) { setErro(j.error || 'Não foi possível aplicar.'); return }
      setAAplicar(null); setEscolhidas(new Set())
      await carregar()
      await aoAplicar?.()
    } finally { setAGuardar(false) }
  }

  /** Começar um perfil a partir de um papel poupa marcar quarenta e oito caixas. */
  function novoDe(papelId: string | null) {
    setAEditar({
      nome: '', descricao: '', papel_base: papelId,
      permissoes: papelId ? permissoesDe(papelId) : [],
    })
  }

  if (porInstalar) {
    return <AvisoDeSetup codigo={porInstalar as any}
      oQue="Os perfis de acesso ainda não estão disponíveis nesta conta." />
  }

  if (carregando) return <Painel><ACarregar oQue="A ler os perfis…" /></Painel>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {erro && <Aviso tom="mau">{erro}</Aviso>}

      <Painel
        cabeca={<Cabecalho>
          <span style={{ flex: 1 }}>Perfis de acesso</span>
          <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>{perfis.length}</span>
        </Cabecalho>}
        rodape={
          <span>
            Um perfil é um carimbo: aplicar copia as permissões para a pessoa.
            Mudar o perfil depois não muda quem já o tem.
          </span>
        }
      >
        {perfis.length === 0 ? (
          <Vazio
            titulo="Ainda não há perfis."
            oQueFazer="Um perfil guarda uma configuração de acessos com um nome — «Auxiliar de noite», «Administrativo sem clínico» — para aplicar a várias pessoas de uma vez, sem marcar a mesma matriz em cada ficha." />
        ) : (
          <div>
            {perfis.map((p, i) => (
              <div key={p.id} style={{
                padding: '10px 13px', display: 'flex', alignItems: 'flex-start',
                gap: 10, flexWrap: 'wrap',
                borderTop: i ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>
                      {p.nome}
                    </span>
                    {p.papel_base && (
                      <Codigo texto={(PAPEIS_ATRIBUIVEIS.find(x => x.id === p.papel_base)?.label || p.papel_base).toUpperCase()} />
                    )}
                    {p.pessoas !== null && (
                      <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: p.pessoas ? 'var(--ink-3)' : 'var(--ink-5)' }}>
                        {p.pessoas} {p.pessoas === 1 ? 'PESSOA' : 'PESSOAS'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.5, marginTop: 2 }}>
                    {p.descricao || emPalavras(p.permissoes)}
                  </div>
                </div>
                <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                  <Botao feitio="principal" onClick={() => { setAAplicar(p); setEscolhidas(new Set()) }}>APLICAR</Botao>
                  <Botao onClick={() => setAEditar(p)}>MUDAR</Botao>
                  <Botao feitio="calmo" onClick={() => apagar(p)}>APAGAR</Botao>
                </span>
              </div>
            ))}
          </div>
        )}
      </Painel>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={ROTULO}>Novo perfil a partir de</span>
        {PAPEIS_ATRIBUIVEIS.map(p => (
          <Botao key={p.id} onClick={() => novoDe(p.id)} titulo={p.descricao}>{p.label.toUpperCase()}</Botao>
        ))}
        <Botao onClick={() => novoDe(null)} titulo="Sem nada marcado — marca-se tudo à mão">DO ZERO</Botao>
      </div>

      {/* ── Criar ou mudar ──────────────────────────────────────────────── */}
      {aEditar && (
        <Folha titulo={aEditar.id ? 'Mudar o perfil' : 'Novo perfil de acesso'} aoFechar={() => setAEditar(null)}>
          <Campo rotulo="Nome" para="perfil-nome" obrigatorio
            ajuda="Como aparece na lista. Por exemplo: «Auxiliar de noite».">
            <input id="perfil-nome" value={aEditar.nome || ''} maxLength={60}
              onChange={e => setAEditar(p => ({ ...p!, nome: e.target.value }))}
              style={{ ...CAIXA, width: '100%' }} />
          </Campo>

          <Campo rotulo="Para que serve" para="perfil-desc"
            ajuda="Uma linha. Quem aplicar isto daqui a seis meses precisa de saber porquê.">
            <textarea id="perfil-desc" value={aEditar.descricao || ''} maxLength={240} rows={2}
              onChange={e => setAEditar(p => ({ ...p!, descricao: e.target.value }))}
              style={{ ...CAIXA_TEXTO, width: '100%' }} />
          </Campo>

          <Campo rotulo="O que esta pessoa vai poder" ajuda={emPalavras(aEditar.permissoes || [])}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {Object.entries(GRUPOS).map(([gid, g]) => {
                const doGrupo = AREAS.filter(a => a.grupo === gid)
                if (!doGrupo.length) return null
                return (
                  <div key={gid}>
                    <div style={{ ...ROTULO, marginBottom: 4 }}>{g.label}</div>
                    {doGrupo.map(a => (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        padding: '5px 0', borderBottom: '1px solid var(--border)',
                      }}>
                        <span style={{ flex: '1 1 150px', fontSize: 'var(--t-dado)', color: 'var(--ink-2)' }}
                          title={a.descricao}>{a.label}</span>
                        {a.niveis.map((n: Nivel) => {
                          const k = chave(a.id, n)
                          const on = (aEditar.permissoes || []).includes(k)
                          return (
                            <label key={n} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              ...MONO, fontSize: 'var(--t-micro)',
                              color: on ? 'var(--green)' : 'var(--ink-5)', cursor: 'pointer',
                            }}>
                              <input type="checkbox" checked={on}
                                onChange={() => setAEditar(p => {
                                  const atual = new Set(p!.permissoes || [])
                                  if (atual.has(k)) {
                                    atual.delete(k)
                                    // Tirar `ver` tira o resto: editar sem ver não é nada.
                                    if (n === 'ver') a.niveis.forEach(x => atual.delete(chave(a.id, x)))
                                  } else {
                                    atual.add(k)
                                    // Dar `editar` ou `eliminar` dá `ver` por baixo.
                                    if (a.niveis.includes('ver')) atual.add(chave(a.id, 'ver'))
                                  }
                                  return { ...p!, permissoes: [...atual] }
                                })} />
                              {n.toUpperCase()}
                            </label>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </Campo>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Botao feitio="principal" onClick={guardar} esperando={aGuardar}>GUARDAR</Botao>
            <Botao onClick={() => setAEditar(null)}>CANCELAR</Botao>
          </div>
        </Folha>
      )}

      {/* ── Aplicar a pessoas ───────────────────────────────────────────── */}
      {aAplicar && (
        <Folha titulo={`Aplicar «${aAplicar.nome}»`} aoFechar={() => setAAplicar(null)}>
          <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.55, marginTop: 4 }}>
            As permissões deste perfil passam a ser as destas pessoas, substituindo
            o que tinham. O Dono e a sua própria conta não aparecem na lista — nenhum
            dos dois pode ser alterado por aqui.
          </div>

          {pessoas.length === 0 ? (
            <Vazio titulo="Não há mais ninguém na equipa a quem aplicar." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              {pessoas.map(p => (
                <label key={p.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 9, minHeight: 'var(--alvo)',
                  padding: '0 2px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={escolhidas.has(p.user_id)}
                    onChange={() => setEscolhidas(s => {
                      const n = new Set(s)
                      n.has(p.user_id) ? n.delete(p.user_id) : n.add(p.user_id)
                      return n
                    })} />
                  <span style={{ flex: 1, fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>{p.nome}</span>
                  <Codigo texto={(PAPEIS_ATRIBUIVEIS.find(x => x.id === p.papel)?.label || p.papel).toUpperCase()} apagado />
                </label>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Botao feitio="principal" onClick={aplicar} esperando={aGuardar} disabled={!escolhidas.size}>
              {escolhidas.size ? `APLICAR A ${escolhidas.size}` : 'ESCOLHA ALGUÉM'}
            </Botao>
            <Botao onClick={() => setAAplicar(null)}>CANCELAR</Botao>
          </div>
        </Folha>
      )}
    </div>
  )
}
