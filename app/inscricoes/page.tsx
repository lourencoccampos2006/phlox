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

import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, Campo, Grupo, Folha, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

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

  const largo = useLargo()
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

  // O mesmo tom que /patients: o verde da casa num lar ou centro de dia,
  // sóbrio numa clínica. É a mesma gente a saltar entre as duas páginas.
  // (Era turquesa `var(--green-3)` — a cor que saiu de toda a aplicação a 2026-10-07.)
  const accent = (institution === 'day_care' || institution === 'nursing_home')
    ? 'var(--green)' : 'var(--ink-2)'

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
    return <ClinicalGate icone="clipboard" accent={accent}
      title="Inscrições e lista de espera"
      description="Quem está à espera de vaga, com os critérios de prioridade do regulamento da casa a ordenar a lista. Faz parte do plano Institucional." />
  }

  if (!podeVer) {
    return (
      <Mesa>
        <Painel>
          <Vazio titulo="A sua conta não tem acesso à lista de espera."
            oQueFazer="Quem gere a casa pode dar-lhe acesso em Equipa → Acessos. A lista de espera guarda dados de pessoas que ainda não são utentes, por isso o acesso é dado à parte." />
        </Painel>
      </Mesa>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Cada candidatura era um cartão que abria em acordeão. Para comparar a
     terceira com a sétima — que é exactamente o que uma reunião de admissão
     faz — era preciso abrir uma, fechar, abrir a outra; e o que se leu na
     primeira já não está no ecrã.

     Passa a mestre/detalhe: a lista toda à esquerda, a conta de quem está
     escolhido à direita. Duas pessoas comparam-se a abrir uma e a olhar para
     a linha da outra, sem perder nenhuma das duas.

     O que a página já fazia bem fica: a pontuação sempre com o máximo ao lado
     («34 de 52», não «34»), o aviso de que uma ficha a meio não é uma pessoa
     de baixa prioridade, e a frase pronta para a acta da reunião.
     ══════════════════════════════════════════════════════════════════════════ */
  const escolhida = emEspera.find(e => e.candidatura.id === aberta) || null

  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Lista de espera</span>

          <Seletor
            opcoes={[
              { id: 'espera', rotulo: `Em espera ${candidaturas.filter(c => c.estado === 'em_espera').length}` },
              { id: 'fechadas', rotulo: `Fechadas ${fechadas.length}` },
              { id: 'criterios', rotulo: 'Critérios da casa' },
            ]}
            ativa={aba} aoMudar={a => setAba(a as Aba)} />

          {aba === 'espera' && !porInstalar && (
            <input value={procura} onChange={e => setProcura(e.target.value)}
              placeholder="Procurar por nome, freguesia ou concelho…" aria-label="Procurar"
              style={{ ...CAIXA, width: 280 }} />
          )}

          {!aCarregar && !porInstalar && aba === 'espera' && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
              A ORDEM É UM APOIO À DECISÃO — QUEM ADMITE É A DIREÇÃO
            </span>
          )}

          {/* Sem as tabelas, este botão abria um formulário que não podia
              gravar. É melhor não haver botão do que haver um que falha no fim. */}
          {podeEditar && aba !== 'criterios' && !porInstalar && (
            <div style={{ marginLeft: 'auto' }}>
              <Botao feitio="principal" onClick={abrirNova}>+ NOVA INSCRIÇÃO</Botao>
            </div>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        aba === 'espera' ? (
          <BarraDeEstado>
            <span style={MONO}>A pontuação sai dos critérios do regulamento desta casa</span>
            <span style={{ ...MONO, color: 'var(--amber)' }}>
              PROVISÓRIA = a ficha ainda tem respostas por dar
            </span>
            <span style={{ ...MONO, color: 'var(--ink-5)' }}>
              Uma ficha a meio não é uma pessoa de baixa prioridade — é uma ficha a meio
            </span>
          </BarraDeEstado>
        ) : undefined
      }
    >
      {aCarregar ? (
        <Painel><ACarregar oQue="A abrir a lista…" /></Painel>
      ) : porInstalar ? (
        <Painel>
          <div style={{ padding: 14 }}>
            <AvisoDeSetup codigo="PHX-W4" oQue="guardar inscrições e ordenar a lista de espera" />
          </div>
        </Painel>
      ) : aba === 'criterios' ? (
        <Painel cabeca={<Cabecalho><span style={{ ...ROTULO, flex: 1 }}>Critérios de prioridade desta casa</span></Cabecalho>}>
          <div style={{ padding: 14 }}>
            <Criterios criterios={criterios} podeMexer={podeMexerNosPesos}
              onMudar={mudarCriterio} />
          </div>
        </Painel>
      ) : aba === 'fechadas' ? (
        <Painel cabeca={<Cabecalho><span style={{ ...ROTULO, flex: 1 }}>Admitidas e fechadas · {fechadas.length}</span></Cabecalho>}>
          <div style={{ padding: 14 }}>
            <Fechadas linhas={fechadas} podeEditar={podeEditar} onReabrir={reabrir} />
          </div>
        </Painel>
      ) : (
        <>
          {!criterios.length && <AvisoSemCriterios />}

          <div style={{
            display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
            gridTemplateColumns: largo ? 'minmax(400px, 1fr) minmax(360px, 480px)' : '1fr',
          }}>
            {(largo || !escolhida) && (
              <Painel
                cabeca={
                  <Cabecalho>
                    <span style={{ ...ROTULO, width: 34, textAlign: 'right' }}>Lugar</span>
                    <span style={{ ...ROTULO, flex: 1 }}>Quem · onde mora</span>
                    <span style={{ ...ROTULO, width: 44, textAlign: 'right' }}>Idade</span>
                    <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Espera</span>
                    <span style={{ ...ROTULO, width: 52, textAlign: 'right' }}>Ficha</span>
                    <span style={{ ...ROTULO, width: 82, textAlign: 'right' }}>Pontos</span>
                  </Cabecalho>
                }
                rodape={<span style={MONO}>{emEspera.length} à espera de vaga</span>}
              >
                {!emEspera.length ? (
                  <ListaVazia temProcura={!!procura.trim()} podeEditar={podeEditar}
                    onNova={abrirNova} />
                ) : emEspera.map(({ candidatura, pontuacao, lugar }) => (
                  <NaLista key={candidatura.id}
                    c={candidatura} p={pontuacao} lugar={lugar}
                    aberta={aberta === candidatura.id}
                    onAbrir={() => setAberta(a => a === candidatura.id ? null : candidatura.id)}
                    largo={largo} />
                ))}
              </Painel>
            )}

            {/* ══ PORQUE É QUE ESTA PESSOA ESTÁ NESTE LUGAR ════════════════
                A conta por extenso, critério a critério. É o que se lê numa
                reunião de admissão — e o que se copia para a acta. */}
            {escolhida ? (
              <Painel>
                <Conta e={escolhida} podeEditar={podeEditar} largo={largo}
                  onFecharPainel={() => setAberta(null)}
                  onEditar={() => abrirEdicao(escolhida.candidatura)}
                  onAdmitir={() => admitir(escolhida.candidatura, escolhida.pontuacao)}
                  onFechar={estado => fechar(escolhida.candidatura, estado)} />
              </Painel>
            ) : largo ? (
              <Painel>
                <Vazio titulo="Escolha quem está na lista."
                  oQueFazer="A conta aparece aqui ao lado, critério a critério, com a lista sempre à vista — para se poderem comparar duas pessoas sem perder nenhuma das duas." />
              </Painel>
            ) : null}
          </div>
        </>
      )}
    </Mesa>

    {nova && (
      <ModalInscricao
        ficha={ficha} setFicha={setFicha}
        respostas={respostas} setRespostas={setRespostas}
        criterios={criterios} accent={accent} aGravar={aGravar}
        titulo={emEdicao ? `Inscrição de ${emEdicao.nome}` : 'Nova inscrição'}
        onFechar={() => { setNova(false); setEmEdicao(null) }}
        onGravar={gravar} />
    )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Uma pessoa na lista
// ═══════════════════════════════════════════════════════════════════════════
function NaLista({ c, p, lugar, aberta, onAbrir, largo }: {
  c: Candidatura; p: Pontuacao; lugar: number
  aberta: boolean; onAbrir: () => void; largo: boolean
}) {
  const anos = idadeDe(c.data_nascimento)
  const meses = mesesDeEspera(c.criada_em)
  const cheia = completude(c, 'candidatura')

  return (
    <button type="button" onClick={onAbrir} aria-expanded={aberta} style={{
      display: 'flex', alignItems: largo ? 'center' : 'flex-start', gap: 10,
      flexDirection: largo ? 'row' : 'column',
      width: '100%', textAlign: 'left', boxSizing: 'border-box',
      padding: largo ? '8px 12px' : '10px 12px',
      border: 'none', borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${aberta ? 'var(--green)' : cheia < 60 ? 'var(--amber)' : 'transparent'}`,
      background: aberta ? 'var(--green-light)' : 'transparent',
      cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
    }}>
      {/* O lugar. Era um quadrado de 34px pintado de verde até ao terceiro —
          um lugar é um número: lê-se em mono, alinhado, e vê-se a lista toda
          de uma vez em vez de três medalhas e o resto cinzento. */}
      <span style={{
        ...MONO, width: largo ? 34 : undefined, textAlign: largo ? 'right' : 'left',
        flexShrink: 0, fontSize: 'var(--t-corpo)',
        fontWeight: (lugar <= 3 ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
        color: lugar <= 3 ? 'var(--ink)' : 'var(--ink-4)',
      }}>{lugar}</span>

      <span style={{ flex: largo ? 1 : undefined, minWidth: 0, width: largo ? undefined : '100%' }}>
        <span style={{
          display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {c.nome}
          {c.valencia && (
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
              {' '}· {VALENCIAS.find(v => v.id === c.valencia)?.rotulo}
            </span>
          )}
        </span>
        <span style={{
          display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{[c.freguesia, c.concelho].filter(Boolean).join(' · ') || '—'}</span>
      </span>

      {largo ? (
        <>
          <span style={{ ...MONO, fontSize: 'var(--t-dado)', width: 44, textAlign: 'right', flexShrink: 0, color: 'var(--ink-4)' }}>
            {anos !== null ? `${anos}a` : '—'}
          </span>
          <span style={{ ...MONO, fontSize: 'var(--t-dado)', width: 56, textAlign: 'right', flexShrink: 0, color: 'var(--ink-4)' }}>
            {meses > 0 ? `${meses}m` : '—'}
          </span>
          {/* Uma ficha a meio não é uma pessoa de baixa prioridade — é uma
              ficha a meio. Tem de se ver ANTES de alguém usar o número. */}
          <span style={{
            ...MONO, fontSize: 'var(--t-dado)', width: 52, textAlign: 'right', flexShrink: 0,
            fontWeight: (cheia < 60 ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
            color: cheia < 60 ? 'var(--amber)' : 'var(--ink-4)',
          }}>{cheia}%</span>
          <span style={{ width: 82, textAlign: 'right', flexShrink: 0 }}>
            <span style={{
              ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
              color: p.provisoria ? 'var(--amber)' : 'var(--ink)',
            }}>{p.total}</span>
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>/{p.maximo}</span>
          </span>
        </>
      ) : (
        <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 5 }}>
          {anos !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <span style={ROTULO}>Idade</span>
              <span style={{ ...MONO, fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>{anos}a</span>
            </span>
          )}
          {meses > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <span style={ROTULO}>Espera</span>
              <span style={{ ...MONO, fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>{meses}m</span>
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            <span style={ROTULO}>Ficha</span>
            <span style={{
              ...MONO, fontSize: 'var(--t-dado)',
              fontWeight: (cheia < 60 ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
              color: cheia < 60 ? 'var(--amber)' : 'var(--ink-4)',
            }}>{cheia}%</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            <span style={ROTULO}>Pontos</span>
            <span style={{
              ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any,
              color: p.provisoria ? 'var(--amber)' : 'var(--ink)',
            }}>{p.total}/{p.maximo}</span>
          </span>
        </span>
      )}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Porque é que esta pessoa está neste lugar
// ═══════════════════════════════════════════════════════════════════════════
function Conta({ e, podeEditar, largo, onFecharPainel, onEditar, onAdmitir, onFechar }: {
  e: { candidatura: Candidatura; pontuacao: Pontuacao; lugar: number }
  podeEditar: boolean; largo: boolean
  onFecharPainel: () => void
  onEditar: () => void; onAdmitir: () => void; onFechar: (estado: string) => void
}) {
  const { candidatura: c, pontuacao: p, lugar } = e
  const cheia = completude(c, 'candidatura')
  const [copiado, setCopiado] = useState(false)

  return (
    <>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border-2)',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <Botao onClick={onFecharPainel}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: 'block', fontSize: 'var(--t-destaque)',
            fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
          }}>{c.nome}</span>
          <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            LUGAR {lugar} · {p.total} DE {p.maximo} PONTOS
            {p.provisoria ? ` · PROVISÓRIA, FALTAM ${p.porResponder}` : ''}
          </span>
        </span>
      </div>

      <div style={{ padding: '0 14px 14px' }}>
        {cheia < 60 && (
          <div style={{ marginTop: 12 }}>
            <Aviso tom="atencao">
              A ficha está {cheia}% preenchida. A pontuação pode mudar quando se completar —
              uma ficha a meio não é uma pessoa de baixa prioridade.
            </Aviso>
          </div>
        )}

        <div style={{ ...ROTULO, margin: '14px 0 4px' }}>Critério a critério</div>
        {p.linhas.map(l => (
          <div key={l.criterio.id} style={{
            display: 'flex', alignItems: 'baseline', gap: 10,
            padding: '7px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--t-dado)', color: 'var(--ink-2)' }}>
                {l.criterio.nome}
                {l.estado === 'automatico' && (
                  <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}> AUTOMÁTICO</span>
                )}
              </span>
              <span style={{
                display: 'block', fontSize: 'var(--t-meta)', marginTop: 1,
                color: l.opcao ? 'var(--ink-4)' : 'var(--amber)',
              }}>
                {l.estado === 'por_responder' ? 'por responder'
                  : l.estado === 'resposta_antiga' ? 'a resposta já não existe nos critérios'
                  : l.opcao?.rotulo}
              </span>
            </span>
            <span style={{
              ...MONO, fontSize: 'var(--t-meta)', whiteSpace: 'nowrap', flexShrink: 0,
              color: l.subtotal ? 'var(--ink)' : 'var(--ink-5)',
            }}>
              {l.pontos}×{l.peso} = <strong>{l.subtotal}</strong>
              <span style={{ color: 'var(--ink-5)' }}> /{l.maximo}</span>
            </span>
          </div>
        ))}

        {/* A frase que vai para a acta da reunião. Sem isto, quem escreve a
            acta volta a fazer a conta à mão — e fá-la diferente. */}
        <div style={{ marginTop: 12 }}>
          <Botao onClick={() => {
            navigator.clipboard?.writeText(`${c.nome} — ${porExtenso(p)}`)
            setCopiado(true); setTimeout(() => setCopiado(false), 1800)
          }}>{copiado ? 'COPIADO ✓' : 'COPIAR A CONTA PARA A ACTA'}</Botao>
        </div>

        {podeEditar && (
          <div style={{
            display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap',
            paddingTop: 12, borderTop: '1px solid var(--border-2)',
          }}>
            <Botao feitio="principal" onClick={onAdmitir}>ADMITIR</Botao>
            <Botao onClick={onEditar}>ABRIR A FICHA</Botao>
            <Botao feitio="calmo" onClick={() => onFechar('desistiu')}>DESISTIU</Botao>
            <Botao feitio="calmo" onClick={() => onFechar('suspenso')}>SUSPENDER</Botao>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Os critérios da casa
// ═══════════════════════════════════════════════════════════════════════════
function Criterios({ criterios, podeMexer, onMudar }: {
  criterios: Criterio[]; podeMexer: boolean
  onMudar: (id: string, campos: Partial<Criterio>) => void
}) {
  const maximo = criterios.filter(c => c.ativo !== false)
    .reduce((s, c) => s + Math.max(0, ...c.opcoes.map(o => o.pontos)) * c.peso, 0)

  return (
    <div>
      <p style={{
        margin: 0, fontSize: 'var(--t-dado)', color: 'var(--ink-3)',
        lineHeight: 1.65, maxWidth: '70ch',
      }}>
        Estes são os critérios de admissão desta casa. Vieram preenchidos com os que
        aparecem na maioria dos regulamentos internos — mas o regulamento é de cada
        instituição, e é por isso que os pesos se mexem aqui e não estão escritos no
        programa.{' '}
        <strong style={{ color: 'var(--ink)' }}>
          Mudar um peso reordena a lista de espera na hora.
        </strong>
      </p>
      <p style={{ ...MONO, margin: '8px 0 0', fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
        MÁXIMO POSSÍVEL HOJE: {maximo} PONTOS
      </p>

      {!podeMexer && (
        <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', margin: '10px 0 0' }}>
          Só a direção pode mexer nos pesos. Aqui ficam para consulta.
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        {criterios.map(c => {
          const desligado = c.ativo === false
          return (
            <div key={c.id} style={{
              padding: '10px 0', borderTop: '1px solid var(--border)',
              opacity: desligado ? 0.55 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
                    }}>{c.nome}</span>
                    {c.automatico && <Codigo texto="AUTOMÁTICO" />}
                  </div>
                  {c.descricao && (
                    <p style={{
                      margin: '3px 0 0', fontSize: 'var(--t-meta)',
                      color: 'var(--ink-5)', lineHeight: 1.55,
                    }}>{c.descricao}</p>
                  )}
                </div>

                {podeMexer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={ROTULO}>Peso</span>
                      <input type="number" min={0} max={10} value={c.peso}
                        aria-label={`Peso do critério ${c.nome}, de 0 a 10`}
                        onChange={e => onMudar(c.id, { peso: Math.max(0, Math.min(10, +e.target.value || 0)) })}
                        style={{
                          ...CAIXA, width: 56, textAlign: 'center',
                          ...MONO, fontSize: 'var(--t-dado)',
                        }} />
                    </label>
                    <Botao feitio={desligado ? 'contorno' : 'calmo'}
                      onClick={() => onMudar(c.id, { ativo: desligado })}>
                      {desligado ? 'LIGAR' : 'DESLIGAR'}
                    </Botao>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 9 }}>
                {c.opcoes.map(o => (
                  <span key={o.valor} style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: 5,
                    padding: '3px 8px', borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border-2)',
                    fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
                  }}>
                    {o.rotulo}
                    <span style={{
                      ...MONO, fontSize: 'var(--t-micro)',
                      fontWeight: 'var(--peso-forte)' as any,
                      color: o.pontos ? 'var(--green)' : 'var(--ink-5)',
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
    return (
      <Vazio titulo="Ainda não saiu ninguém da lista."
        oQueFazer="Quem for admitido, desistir ou ficar suspenso passa para aqui — com os pontos que tinha no dia, que é o que permite explicar a decisão meses depois." />
    )
  }
  return (
    <div>
      {linhas.map(c => {
        const e = estadoDe(c.estado)
        return (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap',
          }}>
            <span style={{ width: 86, flexShrink: 0 }}>
              <Codigo texto={e.rotulo.toUpperCase()} cor={e.cor} />
            </span>
            <span style={{
              flex: 1, minWidth: 140, fontSize: 'var(--t-dado)',
              fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
            }}>{c.nome}</span>

            {c.estado === 'admitido' && c.pontuacao_admissao !== null && c.pontuacao_admissao !== undefined && (
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)', flexShrink: 0 }}
                title="Os pontos que tinha no dia em que foi admitido. Não mudam quando os pesos mudarem.">
                {c.pontuacao_admissao} PTS À ENTRADA
              </span>
            )}
            {c.motivo_fecho && (
              <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', flexShrink: 0 }}>
                {c.motivo_fecho}
              </span>
            )}
            {podeEditar && c.estado !== 'admitido' && (
              <Botao onClick={() => onReabrir(c)}>REPOR NA LISTA</Botao>
            )}
          </div>
        )
      })}
    </div>
  )
}

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
    <Folha titulo={titulo} aoFechar={onFechar}>
      <div style={{ marginTop: 10 }}>
        <FichaDeInscricao ficha={ficha} onde="candidatura" accent={accent}
          onChange={(id, v) => setFicha(f => ({ ...f, [id]: v }))} />
      </div>

      {/* A resposta pretendida. Não está na ficha partilhada porque um utente
          que já entrou não «pretende» nada — já cá está. */}
      <Grupo titulo="O que procura">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Escolha rotulo="Resposta" valor={ficha.valencia || ''}
            opcoes={VALENCIAS.map(v => ({ valor: v.id, rotulo: v.rotulo }))}
            onChange={v => setFicha(f => ({ ...f, valencia: v }))} />
          <Escolha rotulo="Como paga" valor={ficha.acordo || ''} opcoes={ACORDOS}
            onChange={v => setFicha(f => ({ ...f, acordo: v }))} />
        </div>
        <Campo rotulo="Quando gostaria de entrar" para="insc-desejada">
          <input id="insc-desejada" type="date" value={ficha.desejada_em || ''}
            onChange={e => setFicha(f => ({ ...f, desejada_em: e.target.value }))}
            style={{ ...CAIXA, width: '100%' }} />
        </Campo>
      </Grupo>

      {/* ── Os critérios ──────────────────────────────────────────────────
          A conta ao lado do título, a mexer-se a cada resposta. */}
      {aResponder.length > 0 && (
        <Grupo titulo="Critérios de prioridade"
          extra={
            <span style={{
              ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
              color: p.provisoria ? 'var(--amber)' : 'var(--green)',
            }}>
              {p.total}
              <span style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>/{p.maximo}</span>
            </span>
          }>
          <p style={{
            margin: '0 0 10px', fontSize: 'var(--t-meta)',
            color: 'var(--ink-5)', lineHeight: 1.55, maxWidth: '64ch',
          }}>
            A idade e o tempo de espera contam sozinhos — não estão aqui porque ninguém
            lhes responde. Ficar por responder não é o mesmo que responder «nenhum»:
            o que faltar aparece marcado na lista.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
        </Grupo>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Botao feitio="principal" onClick={onGravar} esperando={aGravar}
          disabled={!ficha.nome?.trim()}>
          GUARDAR A INSCRIÇÃO
        </Botao>
        <Botao onClick={onFechar}>CANCELAR</Botao>
      </div>
    </Folha>
  )
}

function Escolha({ rotulo, valor, opcoes, onChange, dica }: {
  rotulo: string; valor: string; opcoes: { valor: string; rotulo: string }[]
  onChange: (v: string) => void; dica?: string
}) {
  return (
    <Campo rotulo={rotulo} ajuda={dica}>
      <select value={valor} onChange={e => onChange(e.target.value)} title={dica}
        style={{ ...CAIXA, width: '100%', color: valor ? 'var(--ink)' : 'var(--ink-5)' }}>
        <option value="">—</option>
        {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </Campo>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
function ListaVazia({ temProcura, podeEditar, onNova }: {
  temProcura: boolean; podeEditar: boolean; onNova: () => void
}) {
  return (
    <Vazio
      titulo={temProcura ? 'Ninguém com esse nome na lista.' : 'Ninguém à espera de vaga.'}
      oQueFazer={temProcura ? undefined
        : 'Quando uma família vier inscrever alguém, é aqui que a ficha fica — mesmo que ainda faltem meses para haver lugar. E a ordem sai sozinha dos critérios do regulamento.'}
      acao={podeEditar && !temProcura
        ? <Botao feitio="principal" onClick={onNova}>INSCREVER ALGUÉM</Botao>
        : undefined} />
  )
}

function AvisoSemCriterios() {
  return (
    <Aviso tom="atencao" titulo="Ainda não há critérios definidos">
      Toda a gente fica com zero pontos e a lista sai por ordem de inscrição.
      Defina-os em «Critérios da casa» — e a lista reordena-se na hora.
    </Aviso>
  )
}
