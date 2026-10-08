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
import { Painel, Cabecalho, Codigo, MONO, ROTULO } from '@/components/ui/mesa'
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
    <Painel
      cabeca={
        <Cabecalho>
          <span style={{ ...ROTULO, color: 'var(--red)', flex: 1 }}>
            A acabar, por {emFalta.length === 1 ? 'utente' : 'utente'} · {emFalta.length}
          </span>
        </Cabecalho>
      }
      rodape={
        <span style={MONO}>
          Isto é o stock de cada pessoa, não o da casa — quem traz as suas próprias fraldas
        </span>
      }
    >
      {emFalta.map(({ artigo, situacao }) => {
        const cat = CATEGORIAS[artigo.categoria] || CATEGORIAS.geral
        const grave = situacao.aviso === 'acabou'
        return (
          <Link key={artigo.id} href={`/patients/${artigo.patient_id}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', textDecoration: 'none', color: 'var(--ink)',
            borderBottom: '1px solid var(--border)',
            borderLeft: `3px solid ${grave ? 'var(--red)' : 'var(--amber)'}`,
          }}>
            <span style={{ width: 48, flexShrink: 0 }}><Codigo texto={cat.codigo} /></span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{
                display: 'block', fontSize: 'var(--t-dado)',
                fontWeight: 'var(--peso-corpo)' as any,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{nomes[artigo.patient_id] || 'Utente'} — {artigo.nome}</span>
              <span style={{
                display: 'block', fontSize: 'var(--t-meta)', marginTop: 1,
                color: grave ? 'var(--red)' : 'var(--amber)',
                fontWeight: 'var(--peso-corpo)' as any,
              }}>{situacao.frase}</span>
            </span>
            <span style={{
              ...MONO, flexShrink: 0, fontSize: 'var(--t-meta)',
              fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)',
            }}>VER A FICHA →</span>
          </Link>
        )
      })}
    </Painel>
  )
}
