'use client'

// components/institution/AusenciasDoUtente.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Quando esta pessoa não está cá.
//
// ── PORQUE É QUE ISTO MUDA MAIS DO QUE PARECE ──────────────────────────────
// Marcar aqui um internamento tira as tarefas desta pessoa do «O Dia». Sem
// isso, o dia de trabalho continua a pedir a medicação e o banho de quem está
// no hospital há duas semanas — e numa lista de setenta linhas, as que são
// impossíveis ensinam a equipa a ignorar a lista toda.
//
// ── E É POR ISSO QUE O ECRÃ O DIZ ──────────────────────────────────────────
// Quem marca uma ausência tem de perceber que isto não é só um apontamento.
// Um botão que muda o dia de trabalho de toda a gente sem avisar é um botão
// que alguém carrega sem querer.
//
// ── A DATA DE REGRESSO É OPCIONAL, E ISSO É A VERDADE ──────────────────────
// Uma ida ao hospital sem data de alta é o caso normal. Obrigar a escrever uma
// data punha a pessoa de volta na lista num dia inventado — e aí, no dia
// seguinte, aparecia-lhe a medicação outra vez sem ninguém perceber porquê.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { ptDate } from '@/lib/ptTime'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import { emPortugues, aindaNaoComecou } from '@/lib/periodo'
import {
  estaFora, emPalavras, diasFora, TIPOS, ROTULO,
  type AusenciaDoUtente, type TipoAusenciaUtente,
} from '@/lib/ausenciasDoUtente'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}
const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 42,
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)',
}

export default function AusenciasDoUtente({ pid, nome, cor }: {
  pid: string; nome: string; cor: string
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('utentes', 'editar')

  const [ausencias, setAusencias] = useState<AusenciaDoUtente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [jaCarregou, setJaCarregou] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aAbrir, setAAbrir] = useState(false)

  const hoje = ptDate()

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)
    const { data, error } = await supabase.from('ausencias_do_utente')
      .select('*').eq('patient_id', pid).order('inicio', { ascending: false })

    if (error && isSetupError(error)) {
      setIndisponivel(true); setJaCarregou(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setAusencias(error ? [] : (data || []))
    setJaCarregou(true)
    setCarregando(false)
  }, [pid, user, supabase])

  useEffect(() => { carregar() }, [carregar])

  const atual = useMemo(() => ausencias.find(a => estaFora(a, hoje)) || null, [ausencias, hoje])

  async function gravar(f: { tipo: TipoAusenciaUtente; inicio: string; fim: string; onde: string; motivo: string }) {
    if (!user) return false
    const { data, error } = await supabase.from('ausencias_do_utente').insert(scope.stamp({
      user_id: user.id, patient_id: pid,
      tipo: f.tipo, inicio: f.inicio, fim: f.fim || null,
      onde: f.onde.trim() || null, motivo: f.motivo.trim() || null,
    })).select().single()
    if (error || !data) {
      setErro(reportError('ausencia-utente', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return false
    }
    setErro(''); setAusencias(p => [data, ...p]); return true
  }

  /** Marca o regresso de hoje. É o gesto que se faz quando a pessoa volta. */
  async function marcarRegresso(a: AusenciaDoUtente) {
    const antes = ausencias
    setAusencias(p => p.map(x => x.id === a.id ? { ...x, fim: hoje } : x))
    const { error } = await supabase.from('ausencias_do_utente')
      .update({ fim: hoje }).eq('id', a.id)
    if (error) { setAusencias(antes); setErro(reportError('ausencia-regresso', error, MSG.save)) }
    else setErro('')
  }

  if (indisponivel || carregando || !jaCarregou) return null

  const primeiroNome = String(nome || '').trim().split(/\s+/)[0] || nome

  return (
    <section style={{ marginTop: 'var(--space-12)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>Ausências</span>
        {ausencias.length > 0 && (
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>{ausencias.length}</span>
        )}
      </div>

      {erro && <div style={{ marginTop: 10, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>}

      {/* Está fora AGORA. É a única coisa desta secção que muda o dia de
          trabalho de toda a gente, por isso é a que está em cima e colorida. */}
      {atual && (
        <div style={{
          marginTop: 'var(--space-7)', padding: '12px 14px', borderRadius: 'var(--r-md)',
          background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--badge-amber-fg)' }}>
              {emPalavras(atual)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--badge-amber-fg)', marginTop: 3, opacity: 0.85 }}>
              {[atual.onde, atual.motivo].filter(Boolean).join(' · ')}
              {(atual.onde || atual.motivo) ? ' · ' : ''}
              O que fosse para lhe fazer não aparece em «O Dia».
            </div>
          </div>
          {podeEditar && (
            <button onClick={() => marcarRegresso(atual)} style={{
              flexShrink: 0, minHeight: 38, padding: '0 14px', borderRadius: 'var(--r-md)',
              border: 'none', background: 'var(--badge-amber-fg)', color: '#fff',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Já voltou</button>
          )}
        </div>
      )}

      {ausencias.length === 0 && !aAbrir && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, marginTop: 'var(--space-7)' }}>
          Nada registado. Marcar aqui um internamento tira as tarefas de {primeiroNome} do dia de
          trabalho — senão a equipa continua a ver medicação por dar a alguém que não está cá.
        </p>
      )}

      {ausencias.length > 0 && (
        <div style={{
          marginTop: 'var(--space-7)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {ausencias.map((a, i) => {
            const t = TIPOS.find(x => x.id === a.tipo)
            const emCurso = estaFora(a, hoje)
            const futura = aindaNaoComecou(a, hoje)
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'baseline', gap: 11, padding: '10px 13px',
                borderTop: i === 0 ? 'none' : '1px solid var(--bg-3)',
                borderLeft: `3px solid ${emCurso ? (t?.cor || 'var(--border-2)') : 'transparent'}`,
                opacity: emCurso || futura ? 1 : 0.72,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                    {ROTULO[a.tipo]}
                    {a.onde && <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}> — {a.onde}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
                    {emPortugues(a.inicio)}
                    {a.fim ? ` a ${emPortugues(a.fim)}` : ' · sem data de regresso'}
                    {a.fim && ` · ${diasFora(a, a.inicio, a.fim)} ${diasFora(a, a.inicio, a.fim) === 1 ? 'dia' : 'dias'}`}
                    {a.motivo ? ` · ${a.motivo}` : ''}
                  </div>
                </div>
                {futura && (
                  <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-5)' }}>
                    marcada
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {podeEditar && (aAbrir
        ? <Formulario cor={cor} aoFechar={() => setAAbrir(false)}
            aoGravar={async f => { if (await gravar(f)) setAAbrir(false) }} />
        : (
          <button onClick={() => setAAbrir(true)} style={{
            marginTop: 'var(--space-7)', minHeight: 44, padding: '0 18px',
            borderRadius: 'var(--r-lg)', border: `1.5px dashed ${cor}`, background: 'transparent',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: cor, cursor: 'pointer',
          }}>+ Registar uma ausência</button>
        ))}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Formulario({ cor, aoFechar, aoGravar }: {
  cor: string; aoFechar: () => void
  aoGravar: (f: { tipo: TipoAusenciaUtente; inicio: string; fim: string; onde: string; motivo: string }) => void
}) {
  const [f, setF] = useState({
    tipo: 'hospital' as TipoAusenciaUtente, inicio: ptDate(), fim: '', onde: '', motivo: '',
  })
  const datasOk = !f.fim || f.fim >= f.inicio
  const valido = !!f.inicio && datasOk

  return (
    <div style={{
      marginTop: 'var(--space-7)', padding: 13, borderRadius: 'var(--r-lg)',
      border: `1px solid ${cor}`, background: 'var(--bg-2)',
    }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {TIPOS.map(t => {
          const on = f.tipo === t.id
          return (
            <button key={t.id} onClick={() => setF(x => ({ ...x, tipo: t.id }))} style={{
              minHeight: 36, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${on ? t.cor : 'var(--border-2)'}`,
              background: on ? t.cor : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
            }}>{t.label}</button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 140px' }}>
          <span style={{ ...MONO, fontSize: 9.5, display: 'block', marginBottom: 5 }}>Desde</span>
          <input type="date" value={f.inicio} onChange={e => setF(x => ({ ...x, inicio: e.target.value }))} style={campo} />
        </label>
        <label style={{ flex: '1 1 140px' }}>
          <span style={{ ...MONO, fontSize: 9.5, display: 'block', marginBottom: 5 }}>Até</span>
          <input type="date" value={f.fim} onChange={e => setF(x => ({ ...x, fim: e.target.value }))} style={campo} />
        </label>
      </div>

      <input value={f.onde} onChange={e => setF(x => ({ ...x, onde: e.target.value }))}
        placeholder="Onde está (ex.: Hospital de Santa Maria; em casa da filha)"
        style={{ ...campo, marginTop: 9 }} />
      <input value={f.motivo} onChange={e => setF(x => ({ ...x, motivo: e.target.value }))}
        placeholder="Motivo (opcional)" style={{ ...campo, marginTop: 9 }} />

      <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 8, lineHeight: 1.5 }}>
        Deixe «até» em branco se ainda não se souber — fica «sem data de regresso», e marca-se o
        regresso quando acontecer. Enquanto estiver fora, as tarefas desta pessoa não aparecem
        em «O Dia».
      </div>

      {!datasOk && (
        <div style={{ fontSize: 12, color: '#b45309', fontWeight: 600, marginTop: 7 }}>
          A data de regresso não pode ser antes do início.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <button onClick={() => aoGravar(f)} disabled={!valido} style={{
          minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-md)', border: 'none',
          background: valido ? cor : 'var(--bg-3)', color: valido ? '#fff' : 'var(--ink-5)',
          fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
          cursor: valido ? 'pointer' : 'default',
        }}>Registar</button>
        <button onClick={aoFechar} style={{
          minHeight: 42, padding: '0 14px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-2)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer',
        }}>Cancelar</button>
      </div>
    </div>
  )
}
