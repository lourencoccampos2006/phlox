'use client'
// app/inscricoes/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A lista de espera, e a calculadora dos critérios de entrada.
//
// ── PORQUE É QUE ESTA PÁGINA EXISTE ────────────────────────────────────────
// Até agora o botão «Novo utente» criava a pessoa na casa nesse instante. Isso
// serve para quem já lá está. A realidade portuguesa é outra:
//
//   a família preenche a ficha  →  fica em espera  →  abre vaga  →  entra
//
// Entre o primeiro e o último passo passam meses, às vezes anos, e não havia
// onde guardar essas pessoas. São exactamente elas sobre quem os critérios de
// prioridade decidem: uma calculadora sem lista de espera não ordena nada.
//
// ── A CALCULADORA NÃO DECIDE ───────────────────────────────────────────────
// Ordena e mostra a conta por extenso. Quem admite é a direção. Não há, e não
// vai haver, «admitir o primeiro da lista»: há sempre coisas que nenhum
// critério apanha, e a lei quer a decisão assinada por pessoas.
//
// É por isso que a conta está sempre à vista, e não escondida atrás do
// número. A pergunta que uma direção mais ouve é «porque é que ele está à
// frente da minha mãe?», e a resposta não pode ser 34.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import { ptDate } from '@/lib/ptTime'
import { CAMADA } from '@/lib/camadas'
import FichaDeInscricao from '@/components/institution/FichaDeInscricao'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import ClinicalGate from '@/components/ClinicalGate'
import {
  fichaVazia, paraColunas, paraFicha, completude, ACORDOS,
} from '@/lib/inscricao'
import {
  pontuar, ordenar, perguntas, idadeDe, mesesDeEspera, porExtenso,
  estadoDe, VALENCIAS, type Criterio, type Pontuacao,
} from '@/lib/prioridade'

type Candidatura = Record<string, any> & {
  id: string
  nome: string
  estado: string
  respostas: Record<string, string>
  criada_em: string
  data_nascimento?: string | null
}

type Aba = 'espera' | 'fechadas' | 'criterios'

export default function InscricoesPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()
  const router = useRouter()

  const podeVer = scope.pode('utentes', 'ver') && scope.veDetalhe('utentes.lista_espera')
  const podeEditar = scope.pode('utentes', 'editar')
  // Mexer nos pesos é mexer no regulamento interno da casa. Não é uma
  // afinação de interface — muda a ordem por que as pessoas entram.
  const podeMexerNosPesos = scope.isManager

  const [aba, setAba] = useState<Aba>('espera')
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [criterios, setCriterios] = useState<Criterio[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [procura, setProcura] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)

  const [emEdicao, setEmEdicao] = useState<Candidatura | null>(null)
  const [nova, setNova] = useState(false)
  const [ficha, setFicha] = useState<Record<string, string>>(() => fichaVazia('candidatura'))
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [aGravar, setAGravar] = useState(false)
  const [porInstalar, setPorInstalar] = useState(false)

  // O mesmo tom que /patients: quente num lar ou centro de dia, sóbrio numa
  // clínica. É a mesma gente a saltar entre as duas páginas.
  const accent = (institution === 'day_care' || institution === 'nursing_home')
    ? '#0d9488' : '#1d4ed8'

  // ── Carregar ──────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!user || !scope.orgId) { setACarregar(false); return }
    // `select('*')` de propósito nos dois: as colunas são novas (sprint165) e
    // o PostgREST recusa a consulta INTEIRA quando uma coluna que se nomeia
    // ainda não existe — devolve `data: null`, que é indistinguível de «não
    // há nada». A página apareceria vazia e sem erro nenhum.
    const [c, k] = await Promise.all([
      supabase.from('candidaturas').select('*').eq('org_id', scope.orgId).order('criada_em'),
      supabase.from('criterios_entrada').select('*').eq('org_id', scope.orgId).order('ordem'),
    ])
    const erro = c.error || k.error
    if (erro) {
      // «A tabela não existe» não é uma avaria: é a migração por correr. Ao
      // cliente não se diz «relation candidaturas does not exist» — mostra-se
      // uma linha calma e um código que diz ao Fernando exactamente o que
      // falta. 42P01 é o código do Postgres para tabela inexistente; o
      // PostgREST devolve PGRST205 quando ela não está no seu esquema.
      if (erro.code === '42P01' || erro.code === 'PGRST205'
          || /does not exist|could not find the table/i.test(erro.message || '')) {
        setPorInstalar(true); setACarregar(false); return
      }
      toast.error('Não foi possível abrir a lista',
        reportError('inscricoes-load', erro, 'Tenta recarregar a página.'))
      setACarregar(false); return
    }
    setPorInstalar(false)
    // `respostas` e `opcoes` nulos vêm de linhas antigas ou de um jsonb
    // vazio. Normalizam-se aqui, uma vez, em vez de em cada sítio que os lê.
    setCandidaturas((c.data || []).map((x: Record<string, any>) => ({ ...x, respostas: x.respostas || {} }) as Candidatura))
    setCriterios((k.data || []).map((x: Record<string, any>) => ({ ...x, opcoes: x.opcoes || [] }) as Criterio))
    setACarregar(false)
  }, [user, scope.orgId, supabase, toast])

  useEffect(() => { carregar() }, [carregar])

  // ── A lista, ordenada ─────────────────────────────────────────────────────
  const emEspera = useMemo(() => {
    const q = procura.trim().toLowerCase()
    const filtradas = candidaturas
      .filter(c => c.estado === 'em_espera')
      .filter(c => !q || c.nome?.toLowerCase().includes(q)
        || c.freguesia?.toLowerCase().includes(q) || c.concelho?.toLowerCase().includes(q))
    return ordenar(filtradas, criterios)
  }, [candidaturas, criterios, procura])

  const fechadas = useMemo(
    () => candidaturas.filter(c => c.estado !== 'em_espera')
      .sort((a, b) => (b.fechada_em || b.admitida_em || '').localeCompare(a.admitida_em || a.fechada_em || '')),
    [candidaturas],
  )

  // ── Gravar uma inscrição ──────────────────────────────────────────────────
  function abrirNova() {
    setFicha(fichaVazia('candidatura')); setRespostas({}); setEmEdicao(null); setNova(true)
  }
  function abrirEdicao(c: Candidatura) {
    setFicha(paraFicha(c, 'candidatura')); setRespostas(c.respostas || {})
    setEmEdicao(c); setNova(true)
  }

  async function gravar() {
    if (!ficha.nome?.trim() || !user || !scope.orgId) return
    if (!podeEditar) { toast.error('Só leitura', 'A sua conta não pode inscrever pessoas.'); return }
    setAGravar(true)
    try {
      // No insert omitem-se os vazios; no update NÃO, senão quem apaga o
      // conteúdo de um campo via-o reaparecer com o valor antigo.
      const linha = { ...paraColunas(ficha, 'candidatura', { omitirVazios: !emEdicao }), respostas }
      const { error } = emEdicao
        ? await supabase.from('candidaturas')
            .update({ ...linha, atualizada_em: new Date().toISOString() }).eq('id', emEdicao.id)
        : await supabase.from('candidaturas').insert(scope.stamp({
            ...linha, user_id: user.id, estado: 'em_espera',
            criada_por: user.email || null,
          }))
      if (error) {
        toast.error('Não foi possível gravar',
          reportError('inscricoes-gravar', error, 'O que escreveste não se perdeu. Tenta de novo.'))
        return
      }
      setNova(false); setEmEdicao(null); carregar()
      toast.success(emEdicao ? 'Inscrição atualizada' : 'Inscrição registada',
        emEdicao ? '' : 'Entrou para a lista de espera.')
    } finally { setAGravar(false) }
  }

  // ── Admitir ───────────────────────────────────────────────────────────────
  async function admitir(c: Candidatura, p: Pontuacao) {
    if (!podeEditar || !user || !scope.orgId) return
    if (!confirm(
      `Admitir ${c.nome}?\n\n`
      + `Cria a ficha de ${cfg.personNoun.toLowerCase()} com os dados desta inscrição. `
      + `A inscrição fica guardada com os ${p.total} pontos que tem hoje, como justificação da decisão.`,
    )) return

    const { data: novo, error } = await supabase.from('patients').insert(scope.stamp({
      user_id: user.id, active: true,
      ...paraColunas(paraFicha(c, 'candidatura'), 'utente'),
      admission_date: ptDate(),
      acordo: c.acordo || null,
      candidatura_id: c.id,
    })).select().single()

    if (error || !novo) {
      toast.error('Não foi possível criar a ficha',
        reportError('inscricoes-admitir', error, 'A inscrição não foi alterada.'))
      return
    }

    // A ficha já existe. Se este segundo passo falhar, a candidatura fica em
    // espera com uma ficha criada — chato, mas visível e corrigível à mão.
    // A ordem inversa (fechar primeiro) perdia a pessoa das duas listas.
    const { error: e2 } = await supabase.from('candidaturas').update({
      estado: 'admitido', patient_id: novo.id, admitida_em: ptDate(),
      pontuacao_admissao: p.total, atualizada_em: new Date().toISOString(),
    }).eq('id', c.id)

    if (e2) {
      toast.error('A ficha foi criada, a inscrição não fechou',
        reportError('inscricoes-fechar', e2, `Abre a inscrição de ${c.nome} e marca como admitida.`))
    }
    carregar()
    router.push(`/patients/${novo.id}`)
  }

  async function fechar(c: Candidatura, estado: string) {
    if (!podeEditar) return
    const motivo = prompt(`Porque é que a inscrição de ${c.nome} fecha? (fica no registo)`)
    if (motivo === null) return
    const { error } = await supabase.from('candidaturas').update({
      estado, fechada_em: ptDate(), motivo_fecho: motivo.trim() || null,
      atualizada_em: new Date().toISOString(),
    }).eq('id', c.id)
    if (error) {
      toast.error('Não foi possível fechar', reportError('inscricoes-estado', error, 'Tenta de novo.'))
      return
    }
    carregar()
  }

  async function reabrir(c: Candidatura) {
    const { error } = await supabase.from('candidaturas').update({
      estado: 'em_espera', fechada_em: null, motivo_fecho: null,
      atualizada_em: new Date().toISOString(),
    }).eq('id', c.id)
    if (error) { toast.error('Não foi possível reabrir', reportError('inscricoes-estado', error, '')); return }
    carregar()
  }

  // ── Os pesos ──────────────────────────────────────────────────────────────
  async function mudarCriterio(id: string, campos: Partial<Criterio>) {
    setCriterios(cs => cs.map(c => c.id === id ? { ...c, ...campos } : c))   // resposta imediata
    const { error } = await supabase.from('criterios_entrada').update(campos).eq('id', id)
    if (error) {
      toast.error('Não ficou gravado', reportError('criterios-guardar', error, 'A lista recarregou.'))
      carregar()
    }
  }

  if (!user) return null

  // Sem isto, a página desenhava-se por inteiro para quem chega de fora: o
  // título, os separadores e o botão de inscrever alguém, tudo à vista de quem
  // não tem sessão nenhuma. Apanhado no QA, não a ler o código.
  const plano = (user?.plan || 'free') as string
  if (plano !== 'pro' && plano !== 'clinic') {
    return <ClinicalGate emoji="📋" accent={accent}
      title="Inscrições e lista de espera"
      description="Quem está à espera de vaga, com os critérios de prioridade do regulamento da casa a ordenar a lista. Faz parte do plano Institucional." />
  }

  if (!podeVer) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.6 }}>
          A sua conta não tem acesso à lista de espera.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 20px 80px' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 25, fontWeight: 800, margin: '0 0 6px', color: '#0b1120', letterSpacing: '-.02em' }}>
          Inscrições e lista de espera
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: '#64748b', lineHeight: 1.6, maxWidth: 620 }}>
          Quem está à espera de vaga, por ordem dos critérios do regulamento desta casa.
          A ordem é um apoio à decisão — quem admite é a direção.
        </p>
      </header>

      <nav style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {([
          ['espera', `Em espera (${candidaturas.filter(c => c.estado === 'em_espera').length})`],
          ['fechadas', `Admitidas e fechadas (${fechadas.length})`],
          ['criterios', 'Critérios da casa'],
        ] as [Aba, string][]).map(([id, rotulo]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: aba === id ? 700 : 500,
              border: `1px solid ${aba === id ? accent : '#e2e8f0'}`,
              background: aba === id ? accent : 'white',
              color: aba === id ? 'white' : '#64748b',
            }}>{rotulo}</button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Sem as tabelas, este botão abria um formulário que não podia
            gravar. É melhor não haver botão do que haver um que falha no fim. */}
        {podeEditar && aba !== 'criterios' && !porInstalar && (
          <button onClick={abrirNova} style={{
            padding: '8px 15px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700, border: 'none', background: '#0b1120', color: 'white',
          }}>Nova inscrição</button>
        )}
      </nav>

      {aCarregar ? (
        <p style={{ fontSize: 13.5, color: '#94a3b8' }}>A abrir…</p>
      ) : porInstalar ? (
        <AvisoDeSetup codigo="PHX-W4"
          oQue="guardar inscrições e ordenar a lista de espera" />
      ) : aba === 'criterios' ? (
        <Criterios criterios={criterios} podeMexer={podeMexerNosPesos}
          onMudar={mudarCriterio} accent={accent} />
      ) : aba === 'fechadas' ? (
        <Fechadas linhas={fechadas} podeEditar={podeEditar} onReabrir={reabrir} />
      ) : (
        <>
          {!criterios.length && (
            <AvisoSemCriterios />
          )}
          <input value={procura} onChange={e => setProcura(e.target.value)}
            placeholder="Procurar por nome, freguesia ou concelho…"
            style={{
              width: '100%', padding: '10px 13px', border: '1px solid #e2e8f0', borderRadius: 9,
              fontSize: 13.5, fontFamily: 'inherit', marginBottom: 14, boxSizing: 'border-box',
            }} />

          {!emEspera.length ? (
            <Vazio temProcura={!!procura.trim()} podeEditar={podeEditar} onNova={abrirNova} accent={accent} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {emEspera.map(({ candidatura, pontuacao, lugar }) => (
                <NaLista key={candidatura.id}
                  c={candidatura} p={pontuacao} lugar={lugar} accent={accent}
                  aberta={aberta === candidatura.id}
                  onAbrir={() => setAberta(a => a === candidatura.id ? null : candidatura.id)}
                  podeEditar={podeEditar}
                  onEditar={() => abrirEdicao(candidatura)}
                  onAdmitir={() => admitir(candidatura, pontuacao)}
                  onFechar={estado => fechar(candidatura, estado)} />
              ))}
            </div>
          )}
        </>
      )}

      {nova && (
        <ModalInscricao
          ficha={ficha} setFicha={setFicha}
          respostas={respostas} setRespostas={setRespostas}
          criterios={criterios} accent={accent} aGravar={aGravar}
          titulo={emEdicao ? `Inscrição de ${emEdicao.nome}` : 'Nova inscrição'}
          onFechar={() => { setNova(false); setEmEdicao(null) }}
          onGravar={gravar} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Uma pessoa na lista
// ═══════════════════════════════════════════════════════════════════════════
function NaLista({ c, p, lugar, aberta, onAbrir, podeEditar, onEditar, onAdmitir, onFechar, accent }: {
  c: Candidatura; p: Pontuacao; lugar: number; aberta: boolean; onAbrir: () => void
  podeEditar: boolean; onEditar: () => void; onAdmitir: () => void
  onFechar: (estado: string) => void; accent: string
}) {
  const anos = idadeDe(c.data_nascimento)
  const meses = mesesDeEspera(c.criada_em)
  const cheia = completude(c, 'candidatura')
  const [copiado, setCopiado] = useState(false)

  return (
    <article style={{
      border: '1px solid #e8edf3', borderRadius: 12, background: 'white', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '13px 15px' }}>
        {/* O lugar na lista. Grande, porque é a pergunta que se faz ao abrir. */}
        <div style={{
          minWidth: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center',
          background: lugar <= 3 ? accent : '#f1f5f9', color: lugar <= 3 ? 'white' : '#64748b',
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, lineHeight: 1.1,
        }}>{lugar}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0b1120' }}>{c.nome}</span>
            {anos !== null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8', lineHeight: 1.1 }}>
                {anos} anos
              </span>
            )}
            {c.valencia && (
              <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                {VALENCIAS.find(v => v.id === c.valencia)?.rotulo}
              </span>
            )}
          </div>
          <div style={{ marginTop: 3, fontSize: 12, color: '#94a3b8' }}>
            {[c.freguesia, c.concelho].filter(Boolean).join(' · ')}
            {meses > 0 && `${c.freguesia || c.concelho ? ' · ' : ''}à espera há ${meses} ${meses === 1 ? 'mês' : 'meses'}`}
          </div>
        </div>

        {/* A pontuação, sempre com o máximo ao lado. Um «34» sozinho não quer
            dizer nada; «34 de 52» quer. */}
        <button onClick={onAbrir} aria-expanded={aberta}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
            fontFamily: 'inherit', padding: 0, flexShrink: 0,
          }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, lineHeight: 1.1,
            color: p.provisoria ? '#d97706' : '#0b1120',
          }}>
            {p.total}<span style={{ fontSize: 11, color: '#cbd5e1' }}>/{p.maximo}</span>
          </div>
          <div style={{ fontSize: 10.5, color: p.provisoria ? '#d97706' : '#94a3b8', marginTop: 2 }}>
            {p.provisoria ? `provisória · faltam ${p.porResponder}` : `${aberta ? '▾' : '▸'} porquê`}
          </div>
        </button>
      </div>

      {/* Uma ficha a meio não é uma pessoa de baixa prioridade — é uma ficha a
          meio. Isto tem de se ver antes de alguém usar o número. */}
      {cheia < 60 && (
        <div style={{
          padding: '7px 15px', background: '#fffbeb', borderTop: '1px solid #fef3c7',
          fontSize: 11.5, color: '#92400e',
        }}>
          Ficha {cheia}% preenchida — a pontuação pode mudar quando se completar.
        </div>
      )}

      {aberta && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '13px 15px', background: '#fcfdfe' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <tbody>
              {p.linhas.map(l => (
                <tr key={l.criterio.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 0', color: '#475569' }}>
                    {l.criterio.nome}
                    {l.estado === 'automatico' && (
                      <span style={{ fontSize: 10.5, color: '#cbd5e1', marginLeft: 6 }}>automático</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', color: l.opcao ? '#64748b' : '#d97706' }}>
                    {l.estado === 'por_responder' ? 'por responder'
                      : l.estado === 'resposta_antiga' ? 'resposta já não existe'
                      : l.opcao?.rotulo}
                  </td>
                  <td style={{
                    padding: '6px 0', textAlign: 'right', whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-mono)', fontSize: 11.5,
                    color: l.subtotal ? '#0b1120' : '#cbd5e1', lineHeight: 1.1,
                  }}>
                    {l.pontos}×{l.peso} = <strong>{l.subtotal}</strong>
                    <span style={{ color: '#cbd5e1' }}> /{l.maximo}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* A frase que vai para a ata da reuniao. Sem isto, quem escreve a
              ata volta a escrever a conta a mao — e escreve-a diferente. */}
          <button onClick={() => {
            navigator.clipboard?.writeText(`${c.nome} — ${porExtenso(p)}`)
            setCopiado(true); setTimeout(() => setCopiado(false), 1800)
          }} style={{
            marginTop: 11, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 11.5, color: copiado ? '#16a34a' : '#94a3b8',
          }}>
            {copiado ? '✓ copiado' : 'Copiar a conta por extenso'}
          </button>

          {podeEditar && (
            <div style={{ display: 'flex', gap: 7, marginTop: 13, flexWrap: 'wrap' }}>
              <button onClick={onAdmitir} style={btn('#16a34a', true)}>Admitir</button>
              <button onClick={onEditar} style={btn('#64748b')}>Abrir ficha</button>
              <button onClick={() => onFechar('desistiu')} style={btn('#94a3b8')}>Desistiu</button>
              <button onClick={() => onFechar('suspenso')} style={btn('#94a3b8')}>Suspender</button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

const btn = (cor: string, cheio = false): React.CSSProperties => ({
  padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12.5, fontWeight: 700,
  border: `1px solid ${cheio ? cor : '#e2e8f0'}`,
  background: cheio ? cor : 'white', color: cheio ? 'white' : cor,
})

// ═══════════════════════════════════════════════════════════════════════════
// Os critérios da casa
// ═══════════════════════════════════════════════════════════════════════════
function Criterios({ criterios, podeMexer, onMudar, accent }: {
  criterios: Criterio[]; podeMexer: boolean
  onMudar: (id: string, campos: Partial<Criterio>) => void; accent: string
}) {
  const maximo = criterios.filter(c => c.ativo !== false)
    .reduce((s, c) => s + Math.max(0, ...c.opcoes.map(o => o.pontos)) * c.peso, 0)

  return (
    <div>
      <div style={{
        padding: '13px 15px', borderRadius: 11, background: '#f8fafc',
        border: '1px solid #eef2f7', marginBottom: 16,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.65 }}>
          Estes são os critérios de admissão desta casa. Vieram preenchidos com os que
          aparecem na maioria dos regulamentos internos — mas o regulamento é de cada
          instituição, e é por isso que os pesos se mexem aqui e não estão escritos no
          programa.
          {' '}<strong style={{ color: '#0b1120' }}>
            Mudar um peso reordena a lista de espera na hora.
          </strong>
        </p>
        <p style={{ margin: '9px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.1 }}>
          Máximo possível hoje: {maximo} pontos
        </p>
      </div>

      {!podeMexer && (
        <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
          Só a direção pode mexer nos pesos. Aqui ficam para consulta.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {criterios.map(c => {
          const desligado = c.ativo === false
          return (
            <div key={c.id} style={{
              border: '1px solid #e8edf3', borderRadius: 11, padding: '13px 15px',
              background: desligado ? '#fafbfc' : 'white', opacity: desligado ? 0.65 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0b1120' }}>{c.nome}</span>
                    {c.automatico && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9.5, lineHeight: 1.1,
                        padding: '3px 6px', borderRadius: 5, background: '#eff6ff', color: '#2563eb',
                      }}>AUTOMÁTICO</span>
                    )}
                  </div>
                  {c.descricao && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.55 }}>
                      {c.descricao}
                    </p>
                  )}
                </div>

                {podeMexer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11.5, color: '#94a3b8' }}>peso</span>
                      <input type="number" min={0} max={10} value={c.peso}
                        onChange={e => onMudar(c.id, { peso: Math.max(0, Math.min(10, +e.target.value || 0)) })}
                        style={{
                          width: 52, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 7,
                          fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'center',
                        }} />
                    </label>
                    <button onClick={() => onMudar(c.id, { ativo: desligado })}
                      style={btn(desligado ? accent : '#94a3b8')}>
                      {desligado ? 'Ligar' : 'Desligar'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
                {c.opcoes.map(o => (
                  <span key={o.valor} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 9px', borderRadius: 7, background: '#f8fafc',
                    border: '1px solid #eef2f7', fontSize: 11.5, color: '#64748b',
                  }}>
                    {o.rotulo}
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.1,
                      color: o.pontos ? accent : '#cbd5e1', fontWeight: 700,
                    }}>{o.pontos * c.peso}</span>
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// As que saíram da lista
// ═══════════════════════════════════════════════════════════════════════════
function Fechadas({ linhas, podeEditar, onReabrir }: {
  linhas: Candidatura[]; podeEditar: boolean; onReabrir: (c: Candidatura) => void
}) {
  if (!linhas.length) {
    return <p style={{ fontSize: 13.5, color: '#94a3b8' }}>Ainda não saiu ninguém da lista.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {linhas.map(c => {
        const e = estadoDe(c.estado)
        return (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px',
            border: '1px solid #eef2f7', borderRadius: 10, background: 'white',
          }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
              background: `${e.cor}14`, color: e.cor,
            }}>{e.rotulo}</span>
            <span style={{ flex: 1, fontSize: 13.5, color: '#0b1120', fontWeight: 600 }}>{c.nome}</span>
            {c.estado === 'admitido' && c.pontuacao_admissao !== null && c.pontuacao_admissao !== undefined && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8', lineHeight: 1.1 }}
                title="Os pontos que tinha no dia em que foi admitido. Não mudam quando os pesos mudarem.">
                {c.pontuacao_admissao} pts à entrada
              </span>
            )}
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
              {c.admitida_em || c.fechada_em || ''}
            </span>
            {c.motivo_fecho && (
              <span style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.motivo_fecho}
              </span>
            )}
            {podeEditar && c.estado !== 'admitido' && (
              <button onClick={() => onReabrir(c)} style={btn('#64748b')}>Repor na lista</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// O formulário
// ═══════════════════════════════════════════════════════════════════════════
function ModalInscricao({
  ficha, setFicha, respostas, setRespostas, criterios, accent, aGravar,
  titulo, onFechar, onGravar,
}: {
  ficha: Record<string, string>
  setFicha: (f: (p: Record<string, string>) => Record<string, string>) => void
  respostas: Record<string, string>
  setRespostas: (f: (p: Record<string, string>) => Record<string, string>) => void
  criterios: Criterio[]; accent: string; aGravar: boolean
  titulo: string; onFechar: () => void; onGravar: () => void
}) {
  const aResponder = perguntas(criterios)
  // A conta actualiza-se à medida que se responde. É a diferença entre
  // «preencher um formulário» e «ver o que cada resposta faz».
  const p = useMemo(
    () => pontuar({ respostas, data_nascimento: ficha.data_nascimento, criada_em: new Date().toISOString() }, criterios),
    [respostas, ficha.data_nascimento, criterios],
  )

  return (
    <div onClick={onFechar} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,17,32,.45)', zIndex: CAMADA.fundoModal,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '5vh 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 15, maxWidth: 760, width: '100%',
        padding: '22px 22px 20px', boxShadow: '0 22px 60px rgba(11,17,32,.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ flex: 1, margin: 0, fontSize: 19, fontWeight: 800, color: '#0b1120' }}>{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#cbd5e1',
            lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <FichaDeInscricao ficha={ficha} onde="candidatura" accent={accent}
          onChange={(id, v) => setFicha(f => ({ ...f, [id]: v }))} />

        {/* A resposta pretendida. Não está na ficha partilhada porque um
            utente que já entrou não «pretende» nada — já cá está. */}
        <div style={{
          marginTop: 10, border: '1px solid #eef2f7', borderRadius: 10, padding: '12px 13px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 10 }}>
            O que procura
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <Escolha rotulo="Resposta" valor={ficha.valencia || ''}
              opcoes={VALENCIAS.map(v => ({ valor: v.id, rotulo: v.rotulo }))}
              onChange={v => setFicha(f => ({ ...f, valencia: v }))} />
            <Escolha rotulo="Como paga" valor={ficha.acordo || ''} opcoes={ACORDOS}
              onChange={v => setFicha(f => ({ ...f, acordo: v }))} />
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Quando gostaria de entrar
              </label>
              <input type="date" value={ficha.desejada_em || ''}
                onChange={e => setFicha(f => ({ ...f, desejada_em: e.target.value }))}
                style={caixa} />
            </div>
          </div>
        </div>

        {/* ── Os critérios ────────────────────────────────────────────────── */}
        {aResponder.length > 0 && (
          <div style={{
            marginTop: 10, border: `1px solid ${accent}33`, borderRadius: 10,
            padding: '13px 14px', background: `${accent}08`,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#334155' }}>
                Critérios de prioridade
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, lineHeight: 1.1,
                color: p.provisoria ? '#d97706' : accent,
              }}>{p.total}/{p.maximo}</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.55 }}>
              A idade e o tempo de espera contam sozinhos — não estão aqui porque ninguém
              lhes responde. Ficar por responder não é o mesmo que responder «nenhum»:
              o que faltar aparece marcado na lista.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {aResponder.map(c => (
                <Escolha key={c.id} rotulo={c.nome} valor={respostas[c.id] || ''}
                  dica={c.descricao || undefined}
                  opcoes={c.opcoes.map(o => ({
                    valor: o.valor, rotulo: `${o.rotulo}${o.pontos ? ` (+${o.pontos * c.peso})` : ''}`,
                  }))}
                  onChange={v => setRespostas(r => {
                    // Escolher o traço TIRA a resposta em vez de a pôr a ''.
                    // Uma resposta vazia guardada é indistinguível de uma
                    // resposta a um critério que entretanto mudou — e as duas
                    // coisas aparecem de maneira diferente na lista.
                    if (!v) { const resto = { ...r }; delete resto[c.id]; return resto }
                    return { ...r, [c.id]: v }
                  })} />
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onGravar} disabled={!ficha.nome?.trim() || aGravar}
            style={{
              flex: 1, background: accent, color: 'white', border: 'none', borderRadius: 9,
              padding: 12, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              cursor: ficha.nome?.trim() ? 'pointer' : 'not-allowed',
              opacity: ficha.nome?.trim() ? 1 : 0.5,
            }}>{aGravar ? 'A gravar…' : 'Guardar inscrição'}</button>
          <button onClick={onFechar} style={{
            padding: '12px 16px', background: 'white', border: '1px solid #e2e8f0',
            borderRadius: 9, fontSize: 14, cursor: 'pointer', color: '#475569', fontFamily: 'inherit',
          }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const caixa: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13.5, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
}

function Escolha({ rotulo, valor, opcoes, onChange, dica }: {
  rotulo: string; valor: string; opcoes: { valor: string; rotulo: string }[]
  onChange: (v: string) => void; dica?: string
}) {
  return (
    <div>
      <label title={dica} style={{
        display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4,
      }}>{rotulo}</label>
      <select value={valor} onChange={e => onChange(e.target.value)}
        style={{ ...caixa, color: valor ? '#0b1120' : '#94a3b8' }}>
        <option value="">—</option>
        {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
function Vazio({ temProcura, podeEditar, onNova, accent }: {
  temProcura: boolean; podeEditar: boolean; onNova: () => void; accent: string
}) {
  return (
    <div style={{
      padding: '44px 24px', textAlign: 'center', border: '1px dashed #e2e8f0', borderRadius: 13,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 14.5, color: '#475569', fontWeight: 600 }}>
        {temProcura ? 'Ninguém com esse nome na lista.' : 'Ninguém à espera de vaga.'}
      </p>
      {!temProcura && (
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          Quando uma família vier inscrever alguém, é aqui que a ficha fica —
          mesmo que ainda faltem meses para haver lugar.
        </p>
      )}
      {podeEditar && !temProcura && (
        <button onClick={onNova} style={{
          padding: '10px 18px', borderRadius: 9, border: 'none', background: accent,
          color: 'white', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>Inscrever alguém</button>
      )}
    </div>
  )
}

function AvisoSemCriterios() {
  return (
    <div style={{
      padding: '13px 15px', borderRadius: 11, background: '#fffbeb',
      border: '1px solid #fef3c7', marginBottom: 14, fontSize: 13, color: '#92400e',
      lineHeight: 1.6,
    }}>
      Ainda não há critérios definidos, por isso toda a gente fica com zero pontos e a
      lista sai por ordem de inscrição. Define-os em <strong>Critérios da casa</strong>.
    </div>
  )
}
