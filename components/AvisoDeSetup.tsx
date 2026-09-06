'use client'

// components/AvisoDeSetup.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O que um cliente vê quando uma parte da aplicação não está disponível.
//
// Antes, cada página escrevia à cara do cliente coisas como "aplique
// sprint131_recurring_services.sql no Supabase". Isso é a nossa cozinha à
// vista de quem vem jantar: não lhe diz nada, dá a sensação de produto por
// acabar, e num lar pode ser lido por uma família.
//
// A regra passa a ser esta:
//   • o cliente vê UMA linha calma e um CÓDIGO curto;
//   • o código não revela nada (nem tabela, nem migração, nem base de dados);
//   • mas identifica exatamente o que falta, para quem o receber saber ao certo
//     o que corrigir — que é o objetivo do Fernando: "escreve os erros de tal
//     forma que a corrigir eu tos possa mandar e tu saibas exatamente o que
//     falhou".
//
// O que cada código significa está em lib/setupCodes.ts, do lado de cá do
// muro — nunca é enviado para o ecrã.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { detalheDoCodigo, type CodigoSetup } from '@/lib/setupCodes'

export default function AvisoDeSetup({ codigo, oQue, compacto }: {
  codigo: CodigoSetup
  /** o que é que o cliente não vai conseguir fazer, em linguagem dele */
  oQue: string
  /** true numa secção; false quando ocupa a página toda */
  compacto?: boolean
}) {
  const [copiado, setCopiado] = useState(false)

  // Só na consola, e uma linha só: para quem estiver a diagnosticar ao vivo.
  if (typeof window !== 'undefined' && !(window as any).__phloxSetup?.[codigo]) {
    ;(window as any).__phloxSetup = { ...((window as any).__phloxSetup || {}), [codigo]: true }
    console.info(`[phlox:setup ${codigo}] ${detalheDoCodigo(codigo)}`)
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(codigo); setCopiado(true); setTimeout(() => setCopiado(false), 2500) } catch {}
  }

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: compacto ? '11px 14px' : '16px 18px',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: compacto ? 12.5 : 13.5, color: 'var(--ink-3)', lineHeight: 1.5, flex: '1 1 260px', textWrap: 'pretty' as any }}>
        {oQue} Já sabemos e estamos a tratar disso.
      </span>
      <button
        onClick={copiar}
        title="Copiar o código para nos enviar"
        style={{
          flexShrink: 0, minHeight: 32, padding: '0 10px', borderRadius: 6,
          border: '1px solid var(--border-2)', background: 'var(--bg)',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.08em', color: 'var(--ink-4)', cursor: 'pointer',
        }}>{copiado ? 'copiado' : codigo}</button>
    </div>
  )
}
