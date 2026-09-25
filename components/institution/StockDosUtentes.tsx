'use client'

// components/institution/StockDosUtentes.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Quem está a ficar sem o quê — o resumo da casa toda, para o /stock.
//
// ── PORQUE É QUE ISTO NÃO ESTÁ SÓ NA FICHA DE CADA PESSOA ──────────────────
// Porque ninguém abre trinta fichas para descobrir que faltam fraldas a duas.
// O stock por pessoa responde-se na ficha («a D. Maria ainda tem?»); a reposição
// faz-se aqui, de uma vez, com a lista de compras à frente.
//
// São a mesma informação, e é a mesma tabela — muda a pergunta.
//
// ── SÓ APARECE QUANDO HÁ ALGUMA COISA ──────────────────────────────────────
// Uma casa que ainda não usa stock por utente não vê aqui um cartão vazio a
// perguntar-lhe porque é que não o usa. Não aparece nada.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { CATEGORIAS, precisamDeAtencao, type ArtigoDoUtente, type Movimento } from '@/lib/stockUtente'

export default function StockDosUtentes({ cor }: { cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()

  const [artigos, setArtigos] = useState<ArtigoDoUtente[]>([])
  const [movs, setMovs] = useState<Movimento[]>([])
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const [pronto, setPronto] = useState(false)

  const carregar = useCallback(async () => {
    if (!user) return
    let q = supabase.from('stock_utente').select('*')
    q = scope.filter(q)
    const { data, error } = await q
    // Sem a tabela (migração por correr) ou sem permissão de stock, esta
    // secção simplesmente não existe. É o comportamento certo: o /stock da
    // casa continua a funcionar tal e qual.
    if (error || !data?.length) { setPronto(true); return }
    setArtigos(data)

    let qm = supabase.from('stock_movimentos').select('*')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    qm = scope.filter(qm)
    const [m, p] = await Promise.all([
      qm,
      supabase.from('patients').select('id, name').in('id', [...new Set(data.map((a: any) => a.patient_id))]),
    ])
    setMovs(m.error ? [] : (m.data || []))
    const mapa: Record<string, string> = {}
    for (const x of (p.error ? [] : (p.data || []))) mapa[x.id] = x.name
    setNomes(mapa)
    setPronto(true)
  }, [user, supabase, scope])

  useEffect(() => { carregar() }, [carregar])

  if (!pronto || !artigos.length) return null

  const emFalta = precisamDeAtencao(artigos, movs)
  if (!emFalta.length) return null

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#dc2626',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
      }}>A acabar, por utente ({emFalta.length})</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {emFalta.map(({ artigo, situacao }) => {
          const cat = CATEGORIAS[artigo.categoria] || CATEGORIAS.geral
          const grave = situacao.aviso === 'acabou'
          return (
            <Link key={artigo.id} href={`/patients/${artigo.patient_id}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '12px 14px', minHeight: 44, textDecoration: 'none',
              borderRadius: 10, border: `1px solid ${grave ? '#fed7d7' : 'var(--badge-amber-border)'}`,
              background: grave ? '#fff5f5' : 'var(--badge-amber-bg)',
            }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                  <span aria-hidden style={{ marginRight: 5 }}>{cat.icone}</span>
                  {nomes[artigo.patient_id] || 'Utente'} — {artigo.nome}
                </span>
                <span style={{
                  display: 'block', fontSize: 11.5, marginTop: 3,
                  color: grave ? '#c53030' : 'var(--badge-amber-fg)', fontWeight: 600,
                }}>{situacao.frase}</span>
              </span>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: cor }}>ver ficha</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
