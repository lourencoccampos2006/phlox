'use client'

// components/institution/Responsavel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Quem fica com isto.
//
// ── O QUE PEDISTE ──────────────────────────────────────────────────────────
// «É necessário haver em várias ferramentas a atribuição de um responsável.»
//
// «Várias ferramentas» é o requisito todo: se cada uma tiver o seu seletor, ao
// fim de cinco páginas há cinco feitios diferentes de escolher a mesma pessoa,
// e quem muda de página tem de reaprender. Isto é o seletor, uma vez.
//
// ── PORQUE É QUE MOSTRA O CÍRCULO E NÃO SÓ O NOME ──────────────────────────
// Numa lista de trinta linhas, «Ana Costa» escrito trinta vezes lê-se como
// ruído — é preciso ler cada linha para saber de quem é. Um círculo com a cor
// da pessoa reconhece-se sem ler, e a cor sai do `id` (lib/equipaDaCasa), por
// isso a Ana é da mesma cor em todas as páginas e em todas as sessões.
//
// O nome continua lá. O círculo é para percorrer, o nome é para confirmar.
//
// ── E QUEM NÃO PODE ESCREVER NÃO VÊ UM BOTÃO QUE NÃO FUNCIONA ──────────────
// Sem permissão de escrita isto fica texto. Um botão que não faz nada é pior
// do que botão nenhum: quem carrega nele fica a achar que a aplicação está
// avariada, e da próxima vez não tenta.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { useEquipa, iniciais, corDe, type MembroDaCasa } from '@/lib/equipaDaCasa'

export interface ResponsavelProps {
  supabase: any
  orgId: string | null
  /** Quem está lá agora. */
  valorId?: string | null
  valorNome?: string | null
  /** `null` nos dois quer dizer «tirar o responsável». */
  aoEscolher: (id: string | null, nome: string | null) => void
  podeEditar?: boolean
  /** O id de quem está a ver, para «Eu» aparecer em primeiro. */
  euId?: string | null
  /** Só o círculo, sem nome — para linhas apertadas. */
  compacto?: boolean
}

export default function Responsavel({
  supabase, orgId, valorId, valorNome, aoEscolher,
  podeEditar = true, euId, compacto = false,
}: ResponsavelProps) {
  const { membros } = useEquipa(supabase, orgId)
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  // O nome pode vir gravado na linha (`responsavel`) e a pessoa já ter saído
  // da casa. Nesse caso o `id` não resolve para membro nenhum — e é o nome
  // gravado que salva o registo de quem tinha ficado com aquilo.
  const membro = valorId ? membros.find(m => m.id === valorId) : null
  const nome = membro?.nome || valorNome || null

  // ── Ordem: eu primeiro ────────────────────────────────────────────────────
  // Quem abre isto está, na esmagadora maioria das vezes, a ficar com a tarefa
  // ele próprio. Ter de procurar o próprio nome numa lista de quinze é uma
  // fricção por nada.
  const lista: MembroDaCasa[] = euId
    ? [...membros].sort((a, b) => (a.id === euId ? -1 : b.id === euId ? 1 : 0))
    : membros

  if (!podeEditar) {
    return nome
      ? <Bolha id={valorId || nome} nome={nome} compacto={compacto} />
      : <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>{compacto ? '' : 'sem responsável'}</span>
  }

  return (
    <div ref={caixa} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setAberto(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={nome ? `Responsável: ${nome}. Mudar.` : 'Escolher responsável'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          minHeight: 32, padding: nome ? '0 8px 0 3px' : '0 10px',
          borderRadius: 999, cursor: 'pointer',
          border: `1px solid ${nome ? 'var(--border)' : 'var(--border-2)'}`,
          background: 'transparent', fontFamily: 'inherit',
          fontSize: 11.5, fontWeight: 700,
          color: nome ? 'var(--ink-3)' : 'var(--ink-5)',
          maxWidth: compacto ? 44 : 150,
        }}>
        {nome
          ? <>
              <Bolha id={valorId || nome} nome={nome} compacto />
              {!compacto && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {primeiroNome(nome)}
                </span>
              )}
            </>
          : <span style={{ whiteSpace: 'nowrap' }}>{compacto ? '＋' : '＋ responsável'}</span>}
      </button>

      {aberto && (
        <div role="listbox" style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 130,
          minWidth: 210, maxHeight: 300, overflowY: 'auto',
          borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
          background: 'var(--bg)', boxShadow: '0 12px 32px rgba(0,0,0,.14)', padding: 5,
        }}>
          {lista.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5 }}>
              Ainda não há mais ninguém nesta casa. Convide a equipa em Equipa.
            </div>
          )}

          {lista.map(m => (
            <button
              key={m.id} role="option" aria-selected={m.id === valorId}
              onClick={() => { aoEscolher(m.id, m.nome); setAberto(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                minHeight: 38, padding: '0 9px', borderRadius: 'var(--r-md)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: m.id === valorId ? 'var(--bg-2)' : 'transparent',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)',
              }}>
              <Bolha id={m.id} nome={m.nome} compacto />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.nome}{m.id === euId ? ' (eu)' : ''}
              </span>
              {m.id === valorId && <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>✓</span>}
            </button>
          ))}

          {valorId && (
            <button
              onClick={() => { aoEscolher(null, null); setAberto(false) }}
              style={{
                display: 'block', width: '100%', minHeight: 36, marginTop: 4,
                paddingTop: 7, borderTop: '1px solid var(--bg-3)',
                border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                padding: '7px 9px 0', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 700, color: 'var(--ink-4)',
              }}>
              Tirar o responsável
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** O círculo com as iniciais. */
export function Bolha({ id, nome, compacto }: { id: string; nome: string; compacto?: boolean }) {
  return (
    <span
      title={nome}
      style={{
        width: 24, height: 24, flexShrink: 0, borderRadius: '50%',
        background: corDe(id), color: 'var(--bg)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.02em',
      }}>{iniciais(nome)}</span>
  )
}

function primeiroNome(nome: string): string {
  return String(nome).trim().split(/\s+/)[0] || nome
}
