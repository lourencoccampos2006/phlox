'use client'

// app/i/[codigo]/page.tsx
// ═══════════════════════════════════════════════════════════════════════════
// O INQUÉRITO, PARA QUEM NÃO TEM CONTA
// ═══════════════════════════════════════════════════════════════════════════
//
// ── QUEM ABRE ISTO ─────────────────────────────────────────────────────────
// A filha de uma utente, no telemóvel, no carro, à porta do centro. Não tem
// conta no Phlox, nunca vai ter, e tem dois minutos. Tudo nesta página é
// desenhado para esses dois minutos:
//
//   · nada de login, nada de email, nada de nome;
//   · uma pergunta por bloco, com os cinco botões todos à vista — sem menus
//     suspensos, que num telemóvel são dois toques e uma lista que tapa a
//     pergunta;
//   · «Não sei» sempre presente, porque quem não sabe escolhendo o meio
//     estraga a média de toda a gente;
//   · pode mandar-se com metade por responder. Uma folha incompleta é uma
//     opinião; uma folha que não se consegue mandar é silêncio.
//
// ── O ENDEREÇO É CURTO DE PROPÓSITO ────────────────────────────────────────
// `/i/ABC123`. Vai escrito num papel afixado na entrada, dito ao telefone, e
// colado num SMS. Cada carácter a mais é um erro a mais a escrever à mão.
//
// ── ANÓNIMO POR CONSTRUÇÃO ─────────────────────────────────────────────────
// Não há sessão, não se pede nome, e a rota não guarda IP nem agente. Isto não
// é uma promessa de interface: é o que a rota faz, e está escrito lá.

import { useState, useEffect, use } from 'react'

interface Pergunta { id: string; texto: string; dimensao: string; aberta?: boolean }

const ESCALA = [
  { valor: 1, rotulo: 'Mau' },
  { valor: 2, rotulo: 'Fraco' },
  { valor: 3, rotulo: 'Razoável' },
  { valor: 4, rotulo: 'Bom' },
  { valor: 5, rotulo: 'Muito bom' },
]

const ROTULO_PUBLICO: Record<string, string> = {
  utentes: 'Para quem é cuidado aqui',
  familias: 'Para as famílias',
  equipa: 'Para quem trabalha aqui',
}

export default function InqueritoPublico({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params)

  const [dados, setDados] = useState<{ titulo: string; publico: string; ano: number; perguntas: Pergunta[] } | null>(null)
  const [estado, setEstado] = useState<'a-ler' | 'pronto' | 'fechado' | 'nao-existe' | 'avariado' | 'enviado'>('a-ler')
  const [tituloFechado, setTituloFechado] = useState('')
  const [folha, setFolha] = useState<Record<string, number | string>>({})
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch(`/api/inquerito-publico?c=${encodeURIComponent(codigo)}`)
        const j = await r.json()
        if (!vivo) return
        if (r.ok) { setDados(j); setEstado('pronto'); return }
        if (j.error === 'fechado') { setTituloFechado(j.titulo || ''); setEstado('fechado'); return }
        if (j.error === 'nao_existe') { setEstado('nao-existe'); return }
        setEstado('avariado')
      } catch {
        if (vivo) setEstado('avariado')
      }
    })()
    return () => { vivo = false }
  }, [codigo])

  async function enviar() {
    setAEnviar(true); setErro('')
    try {
      const r = await fetch('/api/inquerito-publico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, respostas: folha }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErro(j.error === 'vazia'
          ? 'Falta responder a pelo menos uma pergunta.'
          : j.error === 'fechado'
            ? 'Este inquérito fechou entretanto. Obrigado pelo tempo.'
            : 'Não foi possível enviar. Tente outra vez daqui a pouco.')
        return
      }
      setEstado('enviado')
    } catch {
      setErro('Não foi possível enviar. Verifique a ligação.')
    } finally { setAEnviar(false) }
  }

  const respondidas = Object.keys(folha).length

  // ── Os estados que não são o formulário ──────────────────────────────────
  if (estado === 'a-ler') return <Moldura><p style={P}>A abrir…</p></Moldura>

  if (estado === 'enviado') {
    return (
      <Moldura>
        <h1 style={H1}>Obrigado.</h1>
        <p style={P}>
          A sua resposta ficou registada, sem nome. Ninguém consegue saber que foi
          a sua — nem quem trabalha aqui, nem nós.
        </p>
        <p style={{ ...P, color: 'var(--ink-4)' }}>Já pode fechar esta página.</p>
      </Moldura>
    )
  }

  if (estado === 'fechado') {
    return (
      <Moldura>
        <h1 style={H1}>Este inquérito já fechou.</h1>
        <p style={P}>
          {tituloFechado ? `«${tituloFechado}» ` : 'Este questionário '}
          deixou de receber respostas. Obrigado por ter vindo.
        </p>
      </Moldura>
    )
  }

  if (estado === 'nao-existe') {
    return (
      <Moldura>
        <h1 style={H1}>Não encontrámos este inquérito.</h1>
        <p style={P}>
          O endereço pode ter sido escrito com um carácter trocado. Confirme o
          código e tente outra vez — são seis letras e números.
        </p>
      </Moldura>
    )
  }

  if (estado === 'avariado' || !dados) {
    return (
      <Moldura>
        <h1 style={H1}>Não foi possível abrir.</h1>
        <p style={P}>Tente outra vez daqui a pouco.</p>
      </Moldura>
    )
  }

  // ── O formulário ─────────────────────────────────────────────────────────
  return (
    <Moldura>
      <div style={{ ...ROTULO, color: 'var(--green)' }}>
        {ROTULO_PUBLICO[dados.publico] || 'Inquérito'}
      </div>
      <h1 style={H1}>{dados.titulo}</h1>
      <p style={P}>
        São {dados.perguntas.length} perguntas e leva dois minutos. <strong>Não lhe
        pedimos o nome</strong> — a resposta é anónima e não há forma de saber de
        quem é. Pode deixar em branco o que não quiser responder.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 28 }}>
        {dados.perguntas.map((p, i) => (
          <div key={p.id}>
            <div style={{
              fontSize: 17, lineHeight: 1.45, color: 'var(--ink)', marginBottom: 12,
              fontWeight: 500,
            }}>
              <span style={{ color: 'var(--ink-5)', marginRight: 8 }}>{i + 1}.</span>
              {p.texto}
            </div>

            {p.aberta ? (
              <textarea
                value={String(folha[p.id] ?? '')}
                onChange={e => {
                  const v = e.target.value
                  setFolha(f => {
                    const n = { ...f }
                    if (v.trim()) n[p.id] = v; else delete n[p.id]
                    return n
                  })
                }}
                rows={4} maxLength={600}
                placeholder="Escreva o que quiser. Também pode deixar em branco."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
                  border: '1px solid var(--border-2)', borderRadius: 10,
                  fontSize: 16, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical',
                  background: 'white', color: 'var(--ink)',
                }} />
            ) : (
              /* Os cinco botões e o «Não sei», todos à vista.
                 Num telemóvel uma lista suspensa são dois toques e um painel
                 que tapa a pergunta que se está a responder. */
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ESCALA.map(e => {
                  const on = folha[p.id] === e.valor
                  return (
                    <button key={e.valor} type="button"
                      onClick={() => setFolha(f => {
                        const n = { ...f }
                        if (on) delete n[p.id]; else n[p.id] = e.valor
                        return n
                      })}
                      aria-pressed={on}
                      style={{
                        minHeight: 48, padding: '0 16px', borderRadius: 10, cursor: 'pointer',
                        fontSize: 15, fontFamily: 'inherit', flex: '1 1 auto',
                        background: on ? 'var(--green)' : 'white',
                        color: on ? 'white' : 'var(--ink-2)',
                        border: `1.5px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                        fontWeight: on ? 700 : 500,
                      }}>{e.rotulo}</button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {erro && (
        <p style={{ ...P, color: 'var(--red)', marginTop: 20 }}>{erro}</p>
      )}

      <div style={{
        position: 'sticky', bottom: 0, background: 'var(--bg, #fff)',
        paddingTop: 16, paddingBottom: 20, marginTop: 28,
        borderTop: '1px solid var(--border)',
      }}>
        <button type="button" onClick={enviar} disabled={aEnviar || !respondidas}
          style={{
            width: '100%', minHeight: 54, borderRadius: 12, border: 'none', cursor: respondidas ? 'pointer' : 'default',
            background: respondidas ? 'var(--green)' : 'var(--bg-3, #e7e9ec)',
            color: respondidas ? 'white' : 'var(--ink-5, #8a9099)',
            fontSize: 17, fontWeight: 700, fontFamily: 'inherit',
          }}>
          {aEnviar ? 'A enviar…' : 'Enviar a resposta'}
        </button>
        <p style={{ fontSize: 13, color: 'var(--ink-5)', textAlign: 'center', margin: '10px 0 0' }}>
          {respondidas
            ? `${respondidas} de ${dados.perguntas.length} respondidas — pode enviar assim.`
            : 'Responda a pelo menos uma pergunta.'}
        </p>
      </div>
    </Moldura>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// A moldura — e porque é que não usa a da aplicação
// ═══════════════════════════════════════════════════════════════════════════
// Porque quem abre isto não está na aplicação. Pôr-lhe a barra lateral, o sino
// de notificações e o botão do copiloto seria mostrar-lhe uma casa que não é a
// dela e onde não pode entrar. Uma coluna, texto grande, e mais nada.
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: '100vh', background: 'var(--bg, #fff)',
      padding: '32px 20px 0', boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}</div>
    </main>
  )
}

const H1: React.CSSProperties = {
  fontFamily: 'var(--font-serif)', fontSize: 26, lineHeight: 1.25,
  color: 'var(--ink)', margin: '6px 0 12px', fontWeight: 500,
}
const P: React.CSSProperties = {
  fontSize: 16, lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 10px',
}
const ROTULO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em',
  textTransform: 'uppercase', fontWeight: 700,
}
