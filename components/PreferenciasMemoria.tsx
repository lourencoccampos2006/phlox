'use client'

// components/PreferenciasMemoria.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A memória de documentos, e quem manda nela.
//
// ── PORQUE É QUE ISTO TEM DE EXISTIR ───────────────────────────────────────
// O Phlox passa a guardar os documentos que lhe pedem para explicar. Isso faz
// duas coisas boas — a mesma análise deixa de mudar de resposta, e o Copiloto
// passa a conhecer a história de saúde de quem o usa — mas guardar dados de
// saúde de alguém sem essa pessoa poder dizer que não, não se faz.
//
// Por isso este painel não é uma formalidade. É onde se desliga, e onde se
// apaga o que já lá está. Um interruptor que só impede daqui para a frente mas
// deixa o passado guardado não é um "desligar" — é meia verdade.
//
// O segundo interruptor (cofre) só aparece a quem tem cofre. Oferecê-lo a quem
// não tem seria vender por dentro das definições.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'

function Interruptor({ ligado, ocupado, onChange }: { ligado: boolean; ocupado: boolean; onChange: () => void }) {
  return (
    <span style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
      <input
        type="checkbox" checked={ligado} disabled={ocupado} onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 42, height: 24, margin: 0, cursor: 'pointer' }}
      />
      <span aria-hidden style={{
        display: 'block', width: 42, height: 24, borderRadius: 999,
        background: ligado ? 'var(--green, #0d9488)' : 'var(--bg-4, #cbd5e1)',
        transition: 'background 140ms ease',
      }}>
        <span style={{
          display: 'block', width: 18, height: 18, borderRadius: '50%', background: 'white',
          margin: 3, transform: ligado ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform 140ms ease', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        }} />
      </span>
    </span>
  )
}

export default function PreferenciasMemoria({ supabase, userId, plano }: { supabase: any; userId: string; plano: string }) {
  const temCofre = ['pro', 'clinic'].includes(plano)
  const [memoria, setMemoria] = useState(true)
  const [noCofre, setNoCofre] = useState(false)
  const [quantos, setQuantos] = useState<number | null>(null)
  const [carregado, setCarregado] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [perguntarApagar, setPerguntarApagar] = useState(false)
  const [apagado, setApagado] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles').select('memoria_documentos, guardar_no_cofre').eq('id', userId).maybeSingle()
    if (error) { setIndisponivel(true); setCarregado(true); return }
    setMemoria(data?.memoria_documentos !== false)
    setNoCofre(data?.guardar_no_cofre === true)
    setCarregado(true)

    // Quantos documentos é que o Phlox já conhece. Dizer "alguns" seria
    // esconder; é o número que permite decidir se se quer apagar.
    const { count, error: e2 } = await supabase
      .from('documentos_memoria').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if (!e2) setQuantos(count ?? 0)
  }, [supabase, userId])

  useEffect(() => { carregar() }, [carregar])

  async function gravar(campo: 'memoria_documentos' | 'guardar_no_cofre', valor: boolean) {
    setOcupado(true); setErro('')
    const { error } = await supabase.from('profiles').update({ [campo]: valor }).eq('id', userId)
    setOcupado(false)
    if (error) { setErro('Não foi possível guardar essa escolha. Tenta outra vez.'); return false }
    return true
  }

  async function alternarMemoria() {
    const novo = !memoria
    setMemoria(novo)
    const ok = await gravar('memoria_documentos', novo)
    if (!ok) { setMemoria(!novo); return }
    // Desligar a memória e deixar o guardar-no-cofre automático ligado seria uma
    // contradição: continuaria a escrever no cofre o que se pediu para não
    // guardar. Desliga-se em cadeia.
    if (!novo && noCofre) { setNoCofre(false); gravar('guardar_no_cofre', false) }
    setPerguntarApagar(!novo && !!quantos)
    setApagado(false)
  }

  async function alternarCofre() {
    const novo = !noCofre
    setNoCofre(novo)
    const ok = await gravar('guardar_no_cofre', novo)
    if (!ok) setNoCofre(!novo)
  }

  async function apagarTudo() {
    setOcupado(true); setErro('')
    const { error } = await supabase.from('documentos_memoria').delete().eq('user_id', userId)
    setOcupado(false)
    if (error) { setErro('Não foi possível apagar. Tenta outra vez.'); return }
    setQuantos(0); setPerguntarApagar(false); setApagado(true)
  }

  if (!carregado) return <div className="skeleton" style={{ height: 150, borderRadius: 10 }} />

  const linha = {
    display: 'flex', alignItems: 'flex-start', gap: 13, padding: '13px 15px',
    background: 'white', cursor: indisponivel ? 'default' : 'pointer',
  } as React.CSSProperties

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
        Memória de documentos
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.65, maxWidth: '62ch' }}>
        Quando o Phlox guarda o que já leu, o mesmo documento dá sempre a mesma
        resposta — e deixa de perguntar o que já sabe sobre si.
      </div>

      {indisponivel && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, fontSize: 12.5, color: '#854d0e', lineHeight: 1.6 }}>
          Esta escolha ainda não está disponível nesta conta.
        </div>
      )}

      {erro && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 7, fontSize: 12.5, color: '#c53030' }}>{erro}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
        <label style={linha}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink)' }}>Guardar o que analiso</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5, marginTop: 2 }}>
              Os documentos que manda explicar ficam guardados na sua conta. Desligado,
              cada leitura é nova e não fica registo de nenhuma.
            </div>
          </div>
          <Interruptor ligado={memoria} ocupado={indisponivel || ocupado} onChange={alternarMemoria} />
        </label>

        {temCofre && (
          <label style={{ ...linha, opacity: memoria ? 1 : 0.5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink)' }}>Guardar automaticamente no cofre</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5, marginTop: 2 }}>
                Além de guardados, os documentos passam a aparecer no cofre, onde os pode
                ver, procurar e partilhar. Sem isto, ficam só na memória.
              </div>
            </div>
            <Interruptor ligado={noCofre} ocupado={indisponivel || ocupado || !memoria} onChange={alternarCofre} />
          </label>
        )}
      </div>

      {!temCofre && (
        <div style={{ fontSize: 12, color: 'var(--ink-5)', lineHeight: 1.55, marginTop: 12, maxWidth: '60ch' }}>
          Com o plano Pro, os documentos analisados podem ir também para o cofre — onde
          os vê, procura e partilha com quem quiser.
        </div>
      )}

      {/* ── O que já lá está ───────────────────────────────────────────────
          Um interruptor que só vale para o futuro não é um desligar. Aqui diz-se
          quantos são e dá-se a forma de os apagar. */}
      {quantos !== null && quantos > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
            O Phlox tem <strong style={{ color: 'var(--ink-3)' }}>{quantos} {quantos === 1 ? 'documento guardado' : 'documentos guardados'}</strong> desta conta.
            {' '}
            {!perguntarApagar && (
              <button onClick={() => setPerguntarApagar(true)} disabled={ocupado} style={{
                background: 'none', border: 'none', padding: 0, color: '#b91c1c',
                fontSize: 12.5, fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit',
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}>Apagar tudo</button>
            )}
          </div>

          {perguntarApagar && (
            <div style={{ marginTop: 10, padding: '12px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8 }}>
              <div style={{ fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.6, marginBottom: 10 }}>
                Apagar a memória não apaga nada do cofre — só o que o Phlox guardou por
                si. Não há forma de recuperar.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={apagarTudo} disabled={ocupado} style={{
                  padding: '8px 14px', background: '#b91c1c', color: 'white', border: 'none',
                  borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>{ocupado ? 'A apagar…' : 'Apagar tudo'}</button>
                <button onClick={() => setPerguntarApagar(false)} disabled={ocupado} style={{
                  padding: '8px 14px', background: 'white', color: 'var(--ink-3)',
                  border: '1px solid var(--border)', borderRadius: 7, fontSize: 12.5,
                  fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit',
                }}>Manter</button>
              </div>
            </div>
          )}
        </div>
      )}

      {apagado && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: '#0d6e42', lineHeight: 1.55 }}>
          Apagado. O Phlox já não tem nenhum documento guardado desta conta.
        </div>
      )}
    </div>
  )
}
