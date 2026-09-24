'use client'

// components/institution/DocumentosDaPessoa.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Os documentos de uma pessoa, dentro da ficha dela.
//
// ── PORQUE É QUE ISTO NÃO É UM ATALHO PARA /documentos ─────────────────────
// Porque a pergunta que se faz aqui não é «onde estão os documentos» — é «esta
// pessoa tem o contrato assinado?». Mandar quem está na ficha para outra
// página, filtrar por nome e voltar é três passos para uma resposta de dois
// segundos.
//
// Não duplica nada: lê a mesma tabela e o mesmo balde que o /documentos, e
// carregar continua a ser lá. Aqui é para VER.
//
// ── O QUE APARECE PRIMEIRO ─────────────────────────────────────────────────
// O que está a caducar. Um documento válido não precisa de atenção nenhuma; um
// que expira daqui a três semanas precisa, e é o único que alguém tem de ver
// sem ir à procura.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { ptDate } from '@/lib/ptTime'
import { reportError, MSG } from '@/lib/clientError'

interface Doc {
  id: string
  name: string
  category: string
  file_path: string
  expiry_date: string | null
  notes: string | null
  created_at: string
}

const CATEGORIAS: Record<string, string> = {
  contrato: 'Contrato',
  consentimento: 'Consentimento',
  identificacao: 'Identificação',
  saude: 'Saúde',
  seguranca_social: 'Segurança Social',
  outro: 'Outro',
}

/** Quantos dias faltam até caducar. Negativo quando já passou. */
function diasAte(data: string): number {
  const hoje = new Date(ptDate() + 'T00:00:00')
  const alvo = new Date(data + 'T00:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

export default function DocumentosDaPessoa({ pid, nome, cor }: { pid: string; nome: string; cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [docs, setDocs] = useState<Doc[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)
    let q = supabase.from('documents')
      .select('id, name, category, file_path, expiry_date, notes, created_at')
      .eq('patient_id', pid).order('created_at', { ascending: false })
    q = scope.filter(q)
    const { data, error } = await q
    if (error) {
      // Esta pessoa não pode ver documentos, ou a tabela não responde. Esconde-se
      // a secção: uma lista vazia diria «não há documentos», que é outra coisa.
      setIndisponivel(true); setCarregando(false)
      return
    }
    setIndisponivel(false); setDocs(data || []); setCarregando(false)
  }, [pid, user, supabase, scope])

  useEffect(() => { carregar() }, [carregar])

  async function abrir(d: Doc) {
    // Um endereço assinado, válido dois minutos. O balde não é público: um
    // link permanente de um consentimento assinado é um documento de saúde a
    // circular por aí para sempre.
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.file_path, 120)
    if (error || !data?.signedUrl) {
      setErro(reportError('documentos-pessoa-abrir', error, MSG.load))
      return
    }
    setErro('')
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (indisponivel) return null
  if (carregando) {
    return <div style={{ padding: 'var(--space-10)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar…</div>
  }

  if (!docs.length) {
    return (
      <div style={{
        marginTop: 'var(--space-10)', padding: 'var(--space-12)', borderRadius: 'var(--r-xl)',
        border: '1px dashed var(--border-2)', textAlign: 'center',
        fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6,
      }}>
        Ainda não há documentos de {nome.split(' ')[0]}.<br />
        Carregam-se em <a href="/documentos" style={{ color: cor, fontWeight: 700 }}>Documentos</a>.
      </div>
    )
  }

  // O que está a caducar primeiro, o resto por ordem de entrada.
  const aCaducar = docs.filter(d => d.expiry_date && diasAte(d.expiry_date) <= 30)
    .sort((a, b) => diasAte(a.expiry_date as string) - diasAte(b.expiry_date as string))
  const resto = docs.filter(d => !aCaducar.includes(d))

  return (
    <div style={{ marginTop: 'var(--space-10)' }}>
      {erro && (
        <div style={{ marginBottom: 12, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>
      )}

      {aCaducar.length > 0 && (
        <div style={{ marginBottom: 'var(--space-9)' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--badge-amber-fg)', fontWeight: 700, marginBottom: 8,
          }}>A precisar de atenção</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aCaducar.map(d => <Linha key={d.id} d={d} cor={cor} abrir={() => abrir(d)} destaque />)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {resto.map(d => <Linha key={d.id} d={d} cor={cor} abrir={() => abrir(d)} />)}
      </div>

      <div style={{ marginTop: 'var(--space-9)', fontSize: 12.5, color: 'var(--ink-5)' }}>
        Para carregar ou remover, vá a <a href="/documentos" style={{ color: cor, fontWeight: 700 }}>Documentos</a>.
      </div>
    </div>
  )
}

function Linha({ d, cor, abrir, destaque }: { d: Doc; cor: string; abrir: () => void; destaque?: boolean }) {
  const dias = d.expiry_date ? diasAte(d.expiry_date) : null
  const validade = dias === null ? null
    : dias < 0 ? `caducou há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`
    : dias === 0 ? 'caduca hoje'
    : dias === 1 ? 'caduca amanhã'
    : `caduca daqui a ${dias} dias`

  return (
    <button
      onClick={abrir}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '12px 14px', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit',
        borderRadius: 'var(--r-lg)',
        border: `1px solid ${destaque ? 'var(--badge-amber-border)' : 'var(--border)'}`,
        background: destaque ? 'var(--badge-amber-bg)' : 'var(--bg-2)',
      }}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
          {CATEGORIAS[d.category] || d.category}
          {validade ? ` · ${validade}` : ''}
        </span>
      </span>
      <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: cor }}>abrir</span>
    </button>
  )
}
