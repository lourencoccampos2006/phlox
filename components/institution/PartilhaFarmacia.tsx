'use client'

// components/institution/PartilhaFarmacia.tsx
// ═══════════════════════════════════════════════════════════════════════════
// A FARMÁCIA DO OUTRO LADO DO MAPA
// ═══════════════════════════════════════════════════════════════════════════
//
// Hoje, quando a dose muda, alguém liga para a farmácia — e se ninguém ligar,
// a farmácia sela a caixa da semana com a dose antiga. O Ankira resolve isto
// com uma exportação em PDF; nem o MySenior nem ele têm ligação nenhuma.
//
// Aqui a casa dá à farmácia UM endereço secreto por utente. A farmácia abre-o
// sem conta, vê a medicação atual e o que mudou, e carrega em «recebido» — e
// esse «recebido» aparece no histórico da ficha. Quando há mudança, recebe um
// email que não diz de quem é: só que há alterações e o endereço.
//
// A farmácia não é cliente nem tem conta: é o lar que partilha o mapa de um
// utente seu com a farmácia dele.
//
// ── RGPD ───────────────────────────────────────────────────────────────────
// A farmácia vê o nome, a data de nascimento (para identificar a pessoa), as
// alergias, a medicação atual e as alterações dos últimos 60 dias. Mais nada.
// A ligação revoga-se a qualquer momento, e o registo de a quem foi mostrada
// fica (art. 15.º/1-c: destinatários).

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { isSetupError } from '@/lib/clientError'
import { Painel, Cabecalho, Botao, Aviso, ACarregar, MONO, ROTULO } from '@/components/ui/mesa'

interface Partilha {
  id: string; token: string; farmacia_nome: string; farmacia_email: string | null
  criada_em: string; ultima_visita_em: string | null; visitas: number
}

const CAMPO: CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 'var(--tap-min)', padding: '10px 12px',
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 'var(--t-corpo)', background: 'var(--bg)', color: 'var(--ink)',
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-PT', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

export default function PartilhaFarmacia({ pid, nome }: { pid: string; nome: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('medicacao', 'editar')

  const [partilha, setPartilha] = useState<Partilha | null | undefined>(undefined)
  const [porVer, setPorVer] = useState(0)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [farmacia, setFarmacia] = useState('')
  const [email, setEmail] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    if (!user || !pid) return
    const { data, error } = await supabase.from('partilhas_farmacia')
      .select('id, token, farmacia_nome, farmacia_email, criada_em, ultima_visita_em, visitas')
      .eq('patient_id', pid).is('revogada_em', null)
      .order('criada_em', { ascending: false }).limit(1).maybeSingle()
    if (error) {
      if (isSetupError(error)) { setIndisponivel(true); return }
      console.error('[phlox:partilha-farmacia]', error)
      setErro('Não foi possível ler a partilha com a farmácia.')
      setPartilha(null)
      return
    }
    setPartilha((data as Partilha) || null)
    if (data) {
      const { count, error: e2 } = await supabase.from('medicacao_alteracoes')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', pid).is('vista_farmacia_em', null).gte('created_at', (data as Partilha).criada_em)
      if (e2) console.error('[phlox:partilha-farmacia:por-ver]', e2)
      setPorVer(e2 ? 0 : (count || 0))
    }
  }, [user, supabase, pid])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const ouvir = () => carregar()
    window.addEventListener('phlox:medicacao-mudou', ouvir)
    return () => window.removeEventListener('phlox:medicacao-mudou', ouvir)
  }, [carregar])

  async function criar() {
    if (!farmacia.trim()) { setErro('Escreva o nome da farmácia.'); return }
    setAGravar(true); setErro('')
    const { data, error } = await supabase.from('partilhas_farmacia').insert(scope.stamp({
      user_id: user.id, patient_id: pid,
      farmacia_nome: farmacia.trim(), farmacia_email: email.trim() || null,
    })).select('id, token, farmacia_nome, farmacia_email, criada_em, ultima_visita_em, visitas').single()
    setAGravar(false)
    if (error || !data) {
      console.error('[phlox:partilha-farmacia:criar]', error)
      setErro('Não foi possível criar a ligação. Pode não ter permissão para mexer na medicação.')
      return
    }
    setPartilha(data as Partilha); setPorVer(0); setFarmacia(''); setEmail('')
  }

  async function revogar() {
    if (!partilha) return
    if (!confirm(`A farmácia ${partilha.farmacia_nome} deixa de conseguir abrir o mapa de ${nome.split(' ')[0]}. Continuar?`)) return
    const { error } = await supabase.from('partilhas_farmacia')
      .update({ revogada_em: new Date().toISOString() }).eq('id', partilha.id)
    if (error) {
      console.error('[phlox:partilha-farmacia:revogar]', error)
      setErro('Não foi possível revogar a ligação.')
      return
    }
    setPartilha(null)
  }

  if (indisponivel || !scope.ve('medicacao')) return null

  const ligacao = partilha && typeof window !== 'undefined'
    ? `${window.location.origin}/farmacia/${partilha.token}` : ''

  const cabeca = (
    <Cabecalho>
      <span style={{ ...ROTULO, flex: 1 }}>Farmácia</span>
      {partilha && porVer > 0 && (
        <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--amber)' }}>
          {porVer === 1 ? '1 ALTERAÇÃO POR VER' : `${porVer} ALTERAÇÕES POR VER`}
        </span>
      )}
    </Cabecalho>
  )

  if (partilha === undefined) return <Painel cabeca={cabeca}><ACarregar oQue="A ler…" /></Painel>

  return (
    <Painel cabeca={cabeca}>
      <div style={{ padding: 14, display: 'grid', gap: 12 }}>
        {erro && <Aviso tom="mau">{erro}</Aviso>}

        {partilha ? (
          <>
            <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>
              Partilhado com <strong>{partilha.farmacia_nome}</strong>
              {partilha.farmacia_email && <span style={{ color: 'var(--ink-4)' }}> · avisada por email a cada alteração</span>}
            </div>
            <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)' }}>
              {partilha.ultima_visita_em
                ? `Última visita da farmácia: ${quando(partilha.ultima_visita_em)} · ${partilha.visitas} ${partilha.visitas === 1 ? 'visita' : 'visitas'}`
                : 'A farmácia ainda não abriu a ligação.'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <code style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-3)', overflowWrap: 'anywhere', flex: '1 1 260px' }}>{ligacao}</code>
              <Botao onClick={async () => {
                try { await navigator.clipboard.writeText(ligacao); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
                catch { setErro('Não foi possível copiar. Selecione o endereço e copie à mão.') }
              }}>{copiado ? 'COPIADO' : 'COPIAR'}</Botao>
              {podeEditar && <Botao onClick={revogar}>REVOGAR</Botao>}
            </div>
          </>
        ) : podeEditar ? (
          <>
            <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.55, maxWidth: '68ch' }}>
              A farmácia que prepara a medicação de {nome.split(' ')[0]} recebe um endereço para ver o mapa atual e o
              que mudou, sem precisar de conta. Quando a dose muda aqui, é avisada — e o que ela confirmar aparece no
              histórico.
            </p>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div>
                <label htmlFor="farmacia-nome" style={{ ...ROTULO, display: 'block', marginBottom: 6 }}>Farmácia</label>
                <input id="farmacia-nome" value={farmacia} onChange={e => setFarmacia(e.target.value)}
                  placeholder="Nome da farmácia" style={CAMPO} />
              </div>
              <div>
                <label htmlFor="farmacia-email" style={{ ...ROTULO, display: 'block', marginBottom: 6 }}>Email para avisos (opcional)</label>
                <input id="farmacia-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="farmacia@exemplo.pt" style={CAMPO} />
              </div>
            </div>
            <div>
              <Botao feitio="principal" onClick={criar}>{aGravar ? 'A CRIAR…' : 'CRIAR LIGAÇÃO PARA A FARMÁCIA'}</Botao>
            </div>
            <Aviso tom="neutro">
              A farmácia vê o nome, a data de nascimento, as alergias, a medicação atual e as alterações dos últimos
              60 dias. Mais nada. O email de aviso não diz de quem é. A ligação revoga-se a qualquer momento.
            </Aviso>
          </>
        ) : (
          <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>
            O mapa de {nome.split(' ')[0]} não está partilhado com nenhuma farmácia.
          </div>
        )}
      </div>
    </Painel>
  )
}
