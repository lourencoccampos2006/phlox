'use client'

// components/PreferenciasNotificacao.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Escolher o que se quer receber.
//
// Só guarda o que a pessoa MEXEU. Uma chave em falta usa a omissão do catálogo
// (lib/notificacoes.ts) — assim, quando se acrescenta um aviso novo, quem nunca
// entrou aqui passa a recebê-lo sem ter de vir ligá-lo, e quem desligou uma
// coisa continua com ela desligada. Guardar o mapa inteiro congelava as
// escolhas no dia em que foram feitas.
//
// Os interruptores da casa só existem para quem tem conta de instituição. Um
// interruptor de "stock abaixo do mínimo" numa conta pessoal é ruído.
//
// Isto governa as NOTIFICAÇÕES — o que interrompe. O sino continua a mostrar
// tudo: ver e ser interrompido são coisas diferentes.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import {
  tiposPara, querReceber, ROTULO_AMBITO,
  type AmbitoNotificacao, type TipoNotificacao,
} from '@/lib/notificacoes'

export default function PreferenciasNotificacao({ supabase, userId }: { supabase: any; userId: string }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [temOrg, setTemOrg] = useState(false)
  const [tipoInstituicao, setTipoInstituicao] = useState<string | null>(null)
  const [carregado, setCarregado] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [aGuardar, setAGuardar] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('notification_prefs, active_org_id, org_id, institution_type')
      .eq('id', userId).maybeSingle()

    if (error) {
      // A coluna vem do sprint145. Sem ela mostra-se a lista à mesma, em modo
      // de leitura, em vez de desaparecer sem explicação.
      setIndisponivel(true); setCarregado(true); return
    }
    setPrefs((data?.notification_prefs as Record<string, boolean>) || {})
    setTemOrg(!!(data?.active_org_id || data?.org_id))
    setTipoInstituicao(data?.institution_type || null)
    setCarregado(true)
  }, [supabase, userId])

  useEffect(() => { carregar() }, [carregar])

  async function alternar(t: TipoNotificacao) {
    const novo = !querReceber(prefs, t.id)
    const antes = prefs
    const seguinte = { ...prefs, [t.id]: novo }
    setPrefs(seguinte); setAGuardar(t.id); setErro('')

    const { error } = await supabase
      .from('profiles').update({ notification_prefs: seguinte }).eq('id', userId)
    if (error) {
      setPrefs(antes)
      setErro('Não foi possível guardar essa escolha. Tenta outra vez.')
    }
    setAGuardar(null)
  }

  if (!carregado) {
    return <div className="skeleton" style={{ height: 180, borderRadius: 10 }} />
  }

  const tipos = tiposPara({ temOrg, tipoInstituicao })
  const ambitos: AmbitoNotificacao[] = ['pessoal', 'cuidador', 'instituicao']

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
        O que queres receber
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.65 }}>
        Isto escolhe o que te <strong>interrompe</strong>. O sino continua a mostrar tudo —
        podes desligar uma notificação sem deixar de ver o assunto quando abrires o Phlox.
      </div>

      {indisponivel && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, fontSize: 12.5, color: '#854d0e', lineHeight: 1.6 }}>
          As escolhas ainda não estão disponíveis nesta conta. Por agora recebes todas as
          notificações da lista em baixo.
        </div>
      )}

      {erro && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 7, fontSize: 12.5, color: '#c53030' }}>{erro}</div>
      )}

      {ambitos.map(ambito => {
        const doAmbito = tipos.filter(t => t.ambito === ambito)
        if (!doAmbito.length) return null
        const meta = ROTULO_AMBITO[ambito]
        return (
          <div key={ambito} style={{ marginBottom: 22 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)',
            }}>{meta.titulo}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-5)', margin: '3px 0 11px', lineHeight: 1.5, maxWidth: '58ch' }}>
              {meta.nota}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
              {doAmbito.map(t => {
                const ligado = querReceber(prefs, t.id)
                return (
                  <label key={t.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 13, padding: '13px 15px',
                    background: 'white', cursor: indisponivel ? 'default' : 'pointer',
                    opacity: aGuardar === t.id ? 0.6 : 1,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink)' }}>{t.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5, marginTop: 2 }}>{t.descricao}</div>
                    </div>

                    {/* O interruptor. Um checkbox a sério por baixo, para o
                        teclado e os leitores de ecrã continuarem a funcionar. */}
                    <span style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
                      <input
                        type="checkbox"
                        checked={ligado}
                        disabled={indisponivel || aGuardar === t.id}
                        onChange={() => alternar(t)}
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
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {!temOrg && (
        <div style={{ fontSize: 12, color: 'var(--ink-5)', lineHeight: 1.55, maxWidth: '60ch' }}>
          As notificações do trabalho de uma casa — doses do turno, ocorrências, famílias à
          espera — aparecem aqui quando a conta pertencer a uma instituição.
        </div>
      )}
    </div>
  )
}
