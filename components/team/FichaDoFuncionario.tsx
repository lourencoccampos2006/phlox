'use client'

// components/team/FichaDoFuncionario.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A formação e as ausências de uma pessoa da equipa.
//
// ── DE ONDE VEIO ───────────────────────────────────────────────────────────
// Da pesquisa ao Ankira (módulo de Recursos Humanos) e do que a ASAE verifica
// numa inspeção antes de olhar para o plano HACCP: a formação dos
// colaboradores.
//
// O Phlox tinha um campo de texto chamado «próxima formação» e um `status` sem
// datas. Nenhum dos dois responde às perguntas que se fazem de facto — «quem
// tem formação por renovar?» e «quando é que ela volta?».
//
// ── O QUE ESTÁ A CADUCAR VEM PRIMEIRO ──────────────────────────────────────
// É a única coisa desta ficha que pede uma ação. O histórico é consulta; o
// certificado fora de prazo é trabalho — e é o que a inspeção pede primeiro.
//
// ── E UMA AUSÊNCIA TEM DATAS ───────────────────────────────────────────────
// Ao contrário do `status`, que fica ligado até alguém se lembrar de o
// desligar. Com início e fim, quem volta de férias volta sozinho.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { ptDate } from '@/lib/ptTime'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import {
  formacoesEmRisco, estadoDaFormacao, ausenciasNoDia, ausenciaEmPalavras,
  resumoDoFuncionario, diasAte, TIPOS_AUSENCIA, ROTULO_AUSENCIA,
  type Formacao, type Ausencia, type TipoAusencia,
} from '@/lib/equipaRh'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'block',
}
const inp: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box', background: 'white',
}

const pt = (d: string | null | undefined) => (d ? d.split('-').reverse().join('/') : '')

export default function FichaDoFuncionario({ membroId, nome, cor }: {
  membroId: string; nome: string; cor: string
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('equipa', 'editar')

  const [formacoes, setFormacoes] = useState<Formacao[]>([])
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [jaCarregou, setJaCarregou] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aAbrir, setAAbrir] = useState<'formacao' | 'ausencia' | null>(null)

  const hoje = ptDate()

  const carregar = useCallback(async () => {
    if (!membroId || !user) return
    setCarregando(true)
    const [f, a] = await Promise.all([
      supabase.from('formacoes_da_equipa').select('*')
        .eq('team_member_id', membroId).order('data', { ascending: false }),
      supabase.from('ausencias_da_equipa').select('*')
        .eq('team_member_id', membroId).order('inicio', { ascending: false }),
    ])

    if (f.error && isSetupError(f.error)) {
      setIndisponivel(true); setJaCarregou(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setFormacoes(f.error ? [] : (f.data || []))
    setAusencias(a.error ? [] : (a.data || []))
    setJaCarregou(true)
    setCarregando(false)
  }, [membroId, user, supabase])

  useEffect(() => { carregar() }, [carregar])

  const risco = useMemo(() => formacoesEmRisco(formacoes, hoje), [formacoes, hoje])
  const foraHoje = useMemo(() => ausenciasNoDia(ausencias, hoje), [ausencias, hoje])
  const resumo = useMemo(
    () => resumoDoFuncionario(formacoes, ausencias, hoje), [formacoes, ausencias, hoje])

  async function gravarFormacao(f: {
    tema: string; data: string; horas: string; entidade: string; valida_ate: string
  }) {
    if (!user) return false
    const { data, error } = await supabase.from('formacoes_da_equipa').insert(scope.stamp({
      user_id: user.id, team_member_id: membroId,
      tema: f.tema.trim(), data: f.data,
      horas: f.horas.trim() ? Number(f.horas.replace(',', '.')) : null,
      entidade: f.entidade.trim() || null,
      valida_ate: f.valida_ate || null,
    })).select().single()
    if (error || !data) {
      setErro(reportError('rh-formacao', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return false
    }
    setErro(''); setFormacoes(p => [data, ...p]); return true
  }

  async function gravarAusencia(a: {
    tipo: TipoAusencia; inicio: string; fim: string; motivo: string
  }) {
    if (!user) return false
    const { data, error } = await supabase.from('ausencias_da_equipa').insert(scope.stamp({
      user_id: user.id, team_member_id: membroId,
      tipo: a.tipo, inicio: a.inicio, fim: a.fim || null,
      motivo: a.motivo.trim() || null,
    })).select().single()
    if (error || !data) {
      setErro(reportError('rh-ausencia', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return false
    }
    setErro(''); setAusencias(p => [data, ...p]); return true
  }

  if (indisponivel || carregando || !jaCarregou) return null

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>
        {resumo}
      </div>

      {erro && <div style={{ fontSize: 12.5, color: '#b91c1c', fontWeight: 600, marginBottom: 10 }}>{erro}</div>}

      {/* ── O que pede ação ───────────────────────────────────────────────
          Em cima e só quando existe. Uma caixa de «tudo bem» em cada ficha
          ensina a saltar a caixa — e depois também se salta quando ela diz
          alguma coisa. */}
      {(risco.length > 0 || foraHoje.length > 0) && (
        <div style={{
          padding: '10px 12px', borderRadius: 9, marginBottom: 12,
          background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)',
        }}>
          {foraHoje.map(a => (
            <div key={a.id} style={{ fontSize: 12.5, color: 'var(--badge-amber-fg)', fontWeight: 600, lineHeight: 1.5 }}>
              {ausenciaEmPalavras(a)}
            </div>
          ))}
          {risco.map(r => (
            <div key={r.formacao.id} style={{ fontSize: 12.5, color: 'var(--badge-amber-fg)', fontWeight: 600, lineHeight: 1.5 }}>
              {r.formacao.tema}: {r.estado === 'caducada'
                ? `caducou a ${pt(r.formacao.valida_ate)}`
                : `caduca a ${pt(r.formacao.valida_ate)} (${r.dias} ${r.dias === 1 ? 'dia' : 'dias'})`}
            </div>
          ))}
        </div>
      )}

      {/* ── Formação ──────────────────────────────────────────────────────── */}
      <span style={MONO}>Formação</span>
      {formacoes.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--ink-5)', margin: '0 0 8px', lineHeight: 1.5 }}>
          Nada registado. A ASAE pede a formação dos colaboradores — e é a validade que
          permite saber quem está por renovar.
        </p>
      ) : (
        <div style={{ borderRadius: 9, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
          {formacoes.map((f, i) => {
            const e = estadoDaFormacao(f, hoje)
            return (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 11px',
                borderTop: i === 0 ? 'none' : '1px solid var(--bg-3)',
                opacity: e === 'caducada' ? 0.75 : 1,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{f.tema}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>
                    {[
                      pt(f.data),
                      f.horas ? `${f.horas}h` : null,
                      f.entidade,
                      // «Não caduca» e «ninguém disse quando caduca» são coisas
                      // diferentes, e é por isso que a segunda aparece escrita.
                      f.valida_ate ? `válida até ${pt(f.valida_ate)}` : 'sem validade indicada',
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {e !== 'valida' && (
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                    background: e === 'caducada' ? 'var(--badge-amber-bg)' : 'var(--bg-2)',
                    color: e === 'caducada' ? 'var(--badge-amber-fg)' : 'var(--ink-4)',
                  }}>{e === 'caducada' ? 'caducada' : e === 'a_caducar' ? 'a caducar' : 'sem validade'}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {podeEditar && (aAbrir === 'formacao'
        ? <FormularioFormacao cor={cor} aoFechar={() => setAAbrir(null)}
            aoGravar={async f => { if (await gravarFormacao(f)) setAAbrir(null) }} />
        : <BotaoAbrir cor={cor} onClick={() => setAAbrir('formacao')} rotulo="+ Formação" />)}

      {/* ── Ausências ─────────────────────────────────────────────────────── */}
      <span style={{ ...MONO, marginTop: 14 }}>Ausências</span>
      {ausencias.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--ink-5)', margin: '0 0 8px', lineHeight: 1.5 }}>
          Nada registado. Com início e fim, quem volta de férias volta sozinho à escala.
        </p>
      ) : (
        <div style={{ borderRadius: 9, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
          {ausencias.map((a, i) => {
            const t = TIPOS_AUSENCIA.find(x => x.id === a.tipo)
            const futura = a.inicio > hoje
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 11px',
                borderTop: i === 0 ? 'none' : '1px solid var(--bg-3)',
                borderLeft: `3px solid ${t?.cor || 'var(--border-2)'}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {ROTULO_AUSENCIA[a.tipo]}
                    {a.motivo && <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}> — {a.motivo}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>
                    {pt(a.inicio)}{a.fim ? ` a ${pt(a.fim)}` : ' · sem data de regresso'}
                  </div>
                </div>
                {futura && (
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--ink-5)',
                  }}>daqui a {diasAte(a.inicio, hoje)} dias</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {podeEditar && (aAbrir === 'ausencia'
        ? <FormularioAusencia cor={cor} aoFechar={() => setAAbrir(null)}
            aoGravar={async a => { if (await gravarAusencia(a)) setAAbrir(null) }} />
        : <BotaoAbrir cor={cor} onClick={() => setAAbrir('ausencia')} rotulo="+ Ausência" />)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function BotaoAbrir({ cor, onClick, rotulo }: { cor: string; onClick: () => void; rotulo: string }) {
  return (
    <button onClick={onClick} style={{
      minHeight: 34, padding: '0 12px', borderRadius: 8, marginBottom: 4,
      border: `1.5px dashed ${cor}`, background: 'transparent',
      fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: cor, cursor: 'pointer',
    }}>{rotulo}</button>
  )
}

function FormularioFormacao({ cor, aoFechar, aoGravar }: {
  cor: string; aoFechar: () => void
  aoGravar: (f: { tema: string; data: string; horas: string; entidade: string; valida_ate: string }) => void
}) {
  const [f, setF] = useState({ tema: '', data: ptDate(), horas: '', entidade: '', valida_ate: '' })
  const valido = f.tema.trim() !== '' && !!f.data

  return (
    <div style={{ padding: 11, borderRadius: 9, border: `1px solid ${cor}`, background: 'var(--bg-2)', marginBottom: 8 }}>
      <input autoFocus value={f.tema} onChange={e => setF(x => ({ ...x, tema: e.target.value }))}
        placeholder="Ex.: Suporte básico de vida" style={inp} />
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
        <label style={{ flex: '1 1 130px' }}>
          <span style={{ ...MONO, marginBottom: 4 }}>Quando foi</span>
          <input type="date" value={f.data} onChange={e => setF(x => ({ ...x, data: e.target.value }))} style={inp} />
        </label>
        {/* A validade é o campo que faz esta ficha valer a pena, e por isso
            está ao lado da data e não escondido no fim. */}
        <label style={{ flex: '1 1 130px' }}>
          <span style={{ ...MONO, marginBottom: 4 }}>Válida até</span>
          <input type="date" value={f.valida_ate} onChange={e => setF(x => ({ ...x, valida_ate: e.target.value }))} style={inp} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
        <input value={f.horas} inputMode="decimal" onChange={e => setF(x => ({ ...x, horas: e.target.value }))}
          placeholder="Horas" aria-label="Horas de formação" style={{ ...inp, flex: '0 1 90px', width: 'auto' }} />
        <input value={f.entidade} onChange={e => setF(x => ({ ...x, entidade: e.target.value }))}
          placeholder="Quem deu a formação" style={{ ...inp, flex: '1 1 160px', width: 'auto' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 6, lineHeight: 1.45 }}>
        Deixe a validade em branco se não caducar. Fica escrito como «sem validade indicada» —
        que não é o mesmo que «não caduca».
      </div>
      <Botoes cor={cor} valido={valido} aoFechar={aoFechar} aoGravar={() => aoGravar(f)} />
    </div>
  )
}

function FormularioAusencia({ cor, aoFechar, aoGravar }: {
  cor: string; aoFechar: () => void
  aoGravar: (a: { tipo: TipoAusencia; inicio: string; fim: string; motivo: string }) => void
}) {
  const [a, setA] = useState({ tipo: 'ferias' as TipoAusencia, inicio: ptDate(), fim: '', motivo: '' })
  const valido = !!a.inicio && (!a.fim || a.fim >= a.inicio)

  return (
    <div style={{ padding: 11, borderRadius: 9, border: `1px solid ${cor}`, background: 'var(--bg-2)', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
        {TIPOS_AUSENCIA.map(t => {
          const on = a.tipo === t.id
          return (
            <button key={t.id} onClick={() => setA(x => ({ ...x, tipo: t.id }))} style={{
              minHeight: 32, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${on ? t.cor : 'var(--border-2)'}`,
              background: on ? t.cor : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
            }}>{t.label}</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 130px' }}>
          <span style={{ ...MONO, marginBottom: 4 }}>Desde</span>
          <input type="date" value={a.inicio} onChange={e => setA(x => ({ ...x, inicio: e.target.value }))} style={inp} />
        </label>
        <label style={{ flex: '1 1 130px' }}>
          <span style={{ ...MONO, marginBottom: 4 }}>Até</span>
          <input type="date" value={a.fim} onChange={e => setA(x => ({ ...x, fim: e.target.value }))} style={inp} />
        </label>
      </div>
      <input value={a.motivo} onChange={e => setA(x => ({ ...x, motivo: e.target.value }))}
        placeholder="Motivo (opcional)" style={{ ...inp, marginTop: 7 }} />
      <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 6, lineHeight: 1.45 }}>
        Sem data de fim fica «sem data de regresso» — é o caso de uma baixa que ainda não se
        sabe quanto dura, e é mais honesto do que inventar um dia.
      </div>
      {!valido && a.fim && (
        <div style={{ fontSize: 11.5, color: '#b45309', fontWeight: 600, marginTop: 6 }}>
          A data de regresso não pode ser antes do início.
        </div>
      )}
      <Botoes cor={cor} valido={valido} aoFechar={aoFechar} aoGravar={() => aoGravar(a)} />
    </div>
  )
}

function Botoes({ cor, valido, aoFechar, aoGravar }: {
  cor: string; valido: boolean; aoFechar: () => void; aoGravar: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
      <button onClick={aoGravar} disabled={!valido} style={{
        minHeight: 36, padding: '0 14px', borderRadius: 8, border: 'none',
        background: valido ? cor : 'var(--bg-3)', color: valido ? '#fff' : 'var(--ink-5)',
        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
        cursor: valido ? 'pointer' : 'default',
      }}>Registar</button>
      <button onClick={aoFechar} style={{
        minHeight: 36, padding: '0 12px', borderRadius: 8,
        border: '1px solid var(--border-2)', background: 'transparent',
        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer',
      }}>Cancelar</button>
    </div>
  )
}
