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
// Não duplica nada: é a mesma tabela e o mesmo balde do /documentos. O que
// muda é o sítio — e o sítio importa: quem está a dar entrada a alguém tem o
// contrato na mão NAQUELE momento, e mandá-lo a outra página, escolher a
// pessoa numa lista e voltar é o número de passos que faz com que o documento
// fique por carregar.
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
import { reportError, isSetupError, MSG } from '@/lib/clientError'

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

const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 42,
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)',
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

export default function DocumentosDaPessoa({ pid, nome, cor }: { pid: string; nome: string; cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [docs, setDocs] = useState<Doc[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const podeEditar = scope.pode('documentos', 'editar')
  const [aCarregar, setACarregar] = useState(false)
  const [form, setForm] = useState({ nome: '', categoria: 'contrato', validade: '' })
  const [ficheiro, setFicheiro] = useState<File | null>(null)
  const [aGuardar, setAGuardar] = useState(false)

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

  async function guardar() {
    if (!user || !ficheiro) return
    // O nome do ficheiro serve de nome do documento quando ninguém escreveu
    // outro. Obrigar a escrever «Contrato.pdf» quando o ficheiro já se chama
    // assim é um campo a mais entre a pessoa e o trabalho feito.
    const nome = form.nome.trim() || ficheiro.name.replace(/\.[^.]+$/, '')
    setAGuardar(true); setErro('')
    try {
      const ext = (ficheiro.name.split('.').pop() || 'pdf').toLowerCase()
      // O MESMO caminho do /documentos: `<user>/<utente>/<hora>.<ext>`. Um
      // documento carregado aqui tem de aparecer lá, e ao contrário.
      const caminho = `${user.id}/${pid}/${Date.now()}.${ext}`
      const { error: erroBalde } = await supabase.storage.from('documents')
        .upload(caminho, ficheiro, { upsert: false, contentType: ficheiro.type || undefined })
      if (erroBalde) throw erroBalde

      const { data, error } = await supabase.from('documents').insert(scope.stamp({
        patient_id: pid, name: nome, category: form.categoria,
        file_path: caminho, expiry_date: form.validade || null,
      })).select().single()
      if (error) throw error

      setDocs(p => [data, ...p])
      setForm({ nome: '', categoria: 'contrato', validade: '' })
      setFicheiro(null); setACarregar(false)
    } catch (e: any) {
      setErro(reportError('documentos-pessoa-guardar', e, isSetupError(e) ? MSG.unavailable : MSG.save))
    } finally { setAGuardar(false) }
  }

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

  const Formulario = (
    <div style={{
      marginTop: 'var(--space-8)', padding: 'var(--space-8)',
      borderRadius: 'var(--r-xl)', border: `1.5px solid ${cor}`, background: 'var(--bg)',
    }}>
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        padding: 16, minHeight: 56, cursor: 'pointer', borderRadius: 'var(--r-lg)',
        border: `1.5px dashed ${ficheiro ? cor : 'var(--border-2)'}`,
        color: ficheiro ? 'var(--ink)' : 'var(--ink-4)', fontSize: 13.5,
        fontWeight: ficheiro ? 700 : 500, textAlign: 'center',
      }}>
        {ficheiro ? ficheiro.name : 'Escolher ficheiro (PDF ou imagem)'}
        <input type="file" accept=".pdf,image/*" style={{ display: 'none' }}
          onChange={e => setFicheiro(e.target.files?.[0] || null)} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 10 }}>
        <label>
          <span style={{ ...MONO, display: 'block', marginBottom: 5 }}>Categoria</span>
          <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={campo}>
            {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>
          <span style={{ ...MONO, display: 'block', marginBottom: 5 }}>Validade</span>
          <input type="date" value={form.validade}
            onChange={e => setForm(f => ({ ...f, validade: e.target.value }))} style={campo} />
        </label>
      </div>

      <label style={{ display: 'block', marginTop: 9 }}>
        <span style={{ ...MONO, display: 'block', marginBottom: 5 }}>Nome</span>
        <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          placeholder="Sem isto, fica o nome do ficheiro" style={campo} />
      </label>

      <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
        <button onClick={guardar} disabled={!ficheiro || aGuardar} style={{
          minHeight: 44, padding: '0 20px', borderRadius: 'var(--r-md)', border: 'none',
          background: ficheiro ? cor : 'var(--bg-3)', color: ficheiro ? '#fff' : 'var(--ink-5)',
          fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700,
          cursor: ficheiro && !aGuardar ? 'pointer' : 'default',
        }}>{aGuardar ? 'A carregar…' : 'Carregar'}</button>
        <button onClick={() => { setACarregar(false); setFicheiro(null) }} style={{
          minHeight: 44, padding: '0 16px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-2)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer',
        }}>Cancelar</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 9, lineHeight: 1.5 }}>
        Fica ligado a {nome.split(' ')[0]} e aparece tambem na lista geral de documentos.
      </div>
    </div>
  )

  if (!docs.length) {
    return (
      <div style={{ marginTop: 'var(--space-10)' }}>
        {erro && <div style={{ marginBottom: 12, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>}
        {aCarregar ? Formulario : (
          <div style={{
            padding: 'var(--space-12)', borderRadius: 'var(--r-xl)',
            border: '1px dashed var(--border-2)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, marginBottom: podeEditar ? 14 : 0 }}>
              Ainda nao ha documentos de {nome.split(' ')[0]}.
            </div>
            {podeEditar && (
              <button onClick={() => setACarregar(true)} style={{
                minHeight: 44, padding: '0 20px', borderRadius: 'var(--r-lg)', border: 'none',
                background: cor, color: '#fff', fontFamily: 'inherit',
                fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
              }}>Carregar documento</button>
            )}
          </div>
        )}
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

      {podeEditar && (
        aCarregar ? Formulario : (
          <button onClick={() => setACarregar(true)} style={{
            marginTop: 'var(--space-8)', minHeight: 44, padding: '0 18px',
            borderRadius: 'var(--r-lg)', border: `1.5px dashed ${cor}`, background: 'transparent',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: cor, cursor: 'pointer',
          }}>+ Carregar documento</button>
        )
      )}

      <div style={{ marginTop: 'var(--space-8)', fontSize: 12.5, color: 'var(--ink-5)' }}>
        Para remover, ou ver os documentos da casa toda, va a{' '}
        <a href="/documentos" style={{ color: cor, fontWeight: 700 }}>Documentos</a>.
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
