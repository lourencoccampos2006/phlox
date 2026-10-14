'use client'

// components/institution/LinhaEditavel.tsx
// ═══════════════════════════════════════════════════════════════════════════
// MUDAR UMA COISA SEM ABRIR UM FORMULÁRIO
// ═══════════════════════════════════════════════════════════════════════════
//
// As alergias de alguém, as sensibilidades, as condições — são as três coisas
// que mais mudam numa ficha, e mudar qualquer uma obrigava a abrir o
// formulário inteiro do utente, percorrer dezoito campos e gravar tudo. Quem
// descobre uma alergia nova a meio de um turno não faz isso: escreve num
// papel e diz que depois mete.
//
// Aqui toca-se na linha e escreve-se. Grava e fecha.
//
// ── O VAZIO É INFORMAÇÃO ───────────────────────────────────────────────────
// Antes, uma linha sem valor não aparecia — e a secção inteira desaparecia
// quando as três estavam vazias. Isso diz a quem lê que não há alergias, o
// que é diferente de ninguém as ter registado. Numa ficha de utente essa
// diferença pode custar caro: «em branco» não é «não tem».
//
// Por isso a linha aparece sempre, e quando está vazia diz-se POR REGISTAR —
// com o convite a registar já ali.

import { useState, useRef, useEffect } from 'react'
import { Botao, CAIXA_TEXTO, MONO, ROTULO } from '@/components/ui/mesa'

export default function LinhaEditavel({
  rotulo, valor, cor, podeEditar, aoGuardar, placeholder, multilinha = true,
}: {
  rotulo: string
  valor: string | null | undefined
  /** A cor do rótulo. É o que distingue uma alergia de uma preferência. */
  cor?: string
  podeEditar: boolean
  aoGuardar: (novo: string | null) => Promise<string | null>
  placeholder?: string
  multilinha?: boolean
}) {
  const [aEditar, setAEditar] = useState(false)
  const [texto, setTexto] = useState(valor || '')
  const [aGuardar, setAGuardar] = useState(false)
  const [erro, setErro] = useState('')
  const campo = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => { if (aEditar) campo.current?.focus() }, [aEditar])
  useEffect(() => { if (!aEditar) setTexto(valor || '') }, [valor, aEditar])

  async function guardar() {
    setAGuardar(true); setErro('')
    const limpo = texto.trim()
    const e = await aoGuardar(limpo || null)
    setAGuardar(false)
    if (e) { setErro(e); return }
    setAEditar(false)
  }

  const vazio = !valor || !String(valor).trim()

  if (aEditar) {
    const comum = {
      ref: campo as any,
      value: texto,
      onChange: (e: any) => setTexto(e.target.value),
      placeholder,
      style: { ...CAIXA_TEXTO, width: '100%' },
      onKeyDown: (e: any) => {
        if (e.key === 'Escape') { setAEditar(false); setTexto(valor || '') }
        // Enter grava num campo de uma linha; num de várias, só com Ctrl.
        if (e.key === 'Enter' && (!multilinha || e.ctrlKey || e.metaKey)) { e.preventDefault(); guardar() }
      },
    }
    return (
      <div style={{ padding: 'var(--space-5) 0', borderBottom: '1px solid var(--bg-2)' }}>
        <div style={{ ...ROTULO, color: cor || 'var(--ink-4)', marginBottom: 5 }}>{rotulo}</div>
        {multilinha ? <textarea rows={2} {...comum} /> : <input {...comum} />}
        {erro && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginTop: 4 }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
          <Botao feitio="principal" onClick={guardar} esperando={aGuardar}>GUARDAR</Botao>
          <Botao onClick={() => { setAEditar(false); setTexto(valor || ''); setErro('') }}>CANCELAR</Botao>
        </div>
      </div>
    )
  }

  const conteudo = (
    <>
      <span style={{ ...ROTULO, color: cor || 'var(--ink-4)' }}>{rotulo}</span>
      <span style={{
        fontSize: 'var(--t-corpo)', lineHeight: 1.5,
        color: vazio ? 'var(--ink-5)' : 'var(--ink)',
      }}>
        {vazio
          ? <span style={{ ...MONO, fontSize: 'var(--t-meta)' }}>
              POR REGISTAR{podeEditar ? ' — tocar para escrever' : ''}
            </span>
          : valor}
      </span>
    </>
  )

  const molde: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '96px 1fr', gap: 'var(--space-7)',
    padding: 'var(--space-6) 0', borderBottom: '1px solid var(--bg-2)',
    alignItems: 'baseline', textAlign: 'left',
  }

  if (!podeEditar) return <div style={molde}>{conteudo}</div>

  return (
    <button type="button" onClick={() => setAEditar(true)}
      title={vazio ? `Registar ${rotulo.toLowerCase()}` : `Mudar ${rotulo.toLowerCase()}`}
      style={{ ...molde, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
      {conteudo}
    </button>
  )
}
