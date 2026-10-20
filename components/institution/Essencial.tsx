'use client'

// components/institution/Essencial.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A folha que se lê antes de tocar na pessoa. A regra, o porquê e os três
// estados de cada campo estão em `lib/essencial.ts` — aqui é só a cara.
//
// ── PORQUE É QUE ISTO NÃO É SÓ UM BOTÃO DE IMPRIMIR ────────────────────────
// Porque metade das casas não tem impressora à mão da sala, e quem substitui
// alguém às três da tarde tem o telemóvel. A folha lê-se no ecrã, e imprime-se
// quando é para ficar pendurada.
//
// ── PORQUE É QUE O QUE FALTA VEM EM CIMA ───────────────────────────────────
// Um O essencial com o campo das alergias vazio é pior do que não haver O essencial: a
// folha dá a entender que não há alergias. Por isso o que falta não está no
// fim como um resumo — está em cima, antes de qualquer coisa, e com o nome de
// cada campo que falta.
//
// ── E PORQUE É QUE NÃO HÁ UMA BOLINHA NO SEPARADOR ─────────────────────────
// A tentação era pôr um aviso no separador «O essencial» quando falta o essencial.
// Para isso, toda a abertura de uma ficha tinha de carregar o plano de
// cuidados, as avaliações e as feridas só para pintar um ponto — três
// consultas a mais, em todas as fichas, para uma bolinha.
//
// O tecto do plano gratuito do Supabase é o NÚMERO de chamadas, e esta ficha
// já faz uma dúzia. As três consultas só acontecem quando alguém abre o
// separador, que é quando servem para alguma coisa.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, shiftsFor } from '@/lib/institutionConfig'
import { printDoc, type PrintRecord } from '@/lib/print'
import { ptDate } from '@/lib/ptTime'
import { emPortugues } from '@/lib/periodo'
import {
  montarFolha, resumoDaFolha,
  type Folha as FolhaDoEssencial, type CampoDaFolha, type SecaoDaFolha,
} from '@/lib/essencial'
import { useOrgScope } from '@/lib/orgScope'
import { registar, ACOES } from '@/lib/registo'
import LinhaEditavel from '@/components/institution/LinhaEditavel'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

/** Um campo em branco não se pinta como os outros — é esse o ponto todo. */
interface Edicao {
  podeEditar: boolean
  /** O que está mesmo na coluna — não o que a folha escreve por cima. */
  bruto: (c: CampoDaFolha) => string | null
  guardar: (c: CampoDaFolha, valor: string | null) => Promise<string | null>
}

function corDoCampo(c: CampoDaFolha): { cor: string; fundo: string | null } {
  if (c.estado !== 'branco') return { cor: 'var(--ink)', fundo: null }
  return c.critico
    ? { cor: 'var(--red)', fundo: 'var(--badge-red-bg)' }
    : { cor: 'var(--ink-5)', fundo: null }
}

/* ── TOCAR PARA MUDAR, TAMBÉM AQUI (2026-10-14) ───────────────────────────
   «Aquilo de tocar para mudar no perfil do utente, podias fazer isso para a
    página d'O essencial.» (Fernando)

   E faz mais sentido aqui do que em qualquer outro sítio: esta folha existe
   para mostrar o que FALTA — o aviso vermelho em cima diz «falta a dieta,
   falta a mobilidade, falta o médico assistente». Até agora dizia-o e mandava
   a pessoa para outro ecrã. Quem lê isto está a dois metros de quem sabe a
   resposta; o sítio de a escrever é aqui.

   ── O QUE NÃO SE EDITA ───────────────────────────────────────────────────
   Os campos calculados (a idade, que sai da data de nascimento; a restrição de
   líquidos, que são duas colunas numa frase). Não levam `coluna` e continuam
   de leitura — editar um valor calculado é editar a conta, não o dado.

   E o VALOR que se edita é o bruto, não o que está no ecrã: a folha escreve
   «⚠ NÃO ESTÁ REGISTADO» num campo branco, e abrir a caixa com essa frase lá
   dentro fazia quem gravasse escrever o aviso dentro do campo. */
function Campo({ c, bruto, podeEditar, aoGuardar }: {
  c: CampoDaFolha
  /** O que está mesmo na coluna. Null num campo em branco. */
  bruto?: string | null
  podeEditar?: boolean
  aoGuardar?: (c: CampoDaFolha, valor: string | null) => Promise<string | null>
}) {
  const { cor, fundo } = corDoCampo(c)

  if (podeEditar && aoGuardar && c.tabela && c.coluna) {
    return (
      <div style={{
        padding: fundo ? '2px 10px' : 0, borderRadius: fundo ? 'var(--r-sm)' : 0,
        background: fundo || 'transparent',
      }}>
        <LinhaEditavel
          rotulo={c.rotulo}
          cor={c.estado === 'branco' && c.critico ? 'var(--red)' : undefined}
          valor={bruto ?? null}
          podeEditar
          aoGuardar={v => aoGuardar(c, v)}
        />
        {/* O aviso do campo crítico em branco não se perde ao tornar-se
            editável: é ele que diz porque é que vale a pena escrever já. */}
        {c.estado === 'branco' && c.critico && (
          <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', paddingBottom: 6 }}>
            {c.valor}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      padding: fundo ? '8px 10px' : '8px 0', borderRadius: fundo ? 'var(--r-sm)' : 0,
      background: fundo || 'transparent',
      borderBottom: fundo ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ ...MONO, fontSize: 9.5, marginBottom: 2 }}>{c.rotulo}</div>
      <div style={{
        fontSize: 14.5, lineHeight: 1.45, color: cor,
        fontWeight: c.estado === 'branco' && c.critico ? 700 : 500,
        whiteSpace: 'pre-wrap',
      }}>{c.valor}</div>
    </div>
  )
}

function Secao({ s, cor, edicao }: {
  s: SecaoDaFolha; cor: string
  /** O que torna um campo editável. Omitido, a secção é só de leitura. */
  edicao?: Edicao
}) {
  const temLinhas = !!s.linhas?.length
  const temCampos = !!s.campos?.length
  // Uma secção de lista vazia não desaparece: diz que está vazia. «Sem feridas
  // registadas» e «ninguém se lembrou de registar» são a mesma imagem no ecrã
  // quando a secção simplesmente não aparece.
  if (!temLinhas && !temCampos && !s.vazia) return null
  const avisa = !temLinhas && !temCampos && (s.vazia || '').includes('⚠')

  return (
    <section style={{ marginTop: 'var(--space-10)' }}>
      <div style={{
        ...MONO, color: cor, paddingBottom: 'var(--space-4)',
        borderBottom: `1.5px solid ${cor}`,
      }}>{s.titulo}</div>

      {temCampos && (
        <div style={{
          display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-5)',
          /* 220px chegavam para um rótulo por cima de um valor, que é como
             isto era. Com as linhas editáveis o rótulo passa para a ESQUERDA
             do valor, e numa coluna de 220 sobram 120 para o texto — «POR
             REGISTAR — tocar para escrever» saía em três linhas, e um
             diagnóstico escrito saía picado.
             Com edição, colunas mais largas e menos delas. */
          gridTemplateColumns: edicao?.podeEditar
            ? 'repeat(auto-fit, minmax(340px, 1fr))'
            : 'repeat(auto-fit, minmax(220px, 1fr))',
        }}>
          {(s.campos || []).map(c => (
            <Campo key={c.rotulo} c={c}
              bruto={edicao?.bruto(c)} podeEditar={edicao?.podeEditar}
              aoGuardar={edicao?.guardar} />
          ))}
        </div>
      )}

      {temLinhas && (
        <ul style={{ margin: 'var(--space-5) 0 0', padding: 0, listStyle: 'none' }}>
          {(s.linhas || []).map((l, i) => {
            // As linhas da medicação vêm com o turno como cabeçalho («Manhã:»)
            // e as doses indentadas. É a única maneira de uma lista de texto
            // dizer a que horas é cada coisa sem inventar uma tabela.
            const cabeca = l.endsWith(':')
            return (
              <li key={i} style={{
                fontSize: cabeca ? 11.5 : 14.5, lineHeight: 1.5,
                padding: cabeca ? '10px 0 2px' : '3px 0 3px 14px',
                fontWeight: cabeca ? 800 : 500,
                letterSpacing: cabeca ? '0.08em' : undefined,
                textTransform: cabeca ? 'uppercase' : undefined,
                color: cabeca ? 'var(--ink-4)' : (l.includes('⚠') ? 'var(--red)' : 'var(--ink)'),
              }}>{cabeca ? l.slice(0, -1) : l}</li>
            )
          })}
        </ul>
      )}

      {!temLinhas && !temCampos && (
        <div style={{
          marginTop: 'var(--space-5)', fontSize: 13.5, lineHeight: 1.5,
          padding: avisa ? '10px 12px' : 0, borderRadius: avisa ? 'var(--r-sm)' : 0,
          background: avisa ? 'var(--badge-red-bg)' : 'transparent',
          color: avisa ? 'var(--red)' : 'var(--ink-5)', fontWeight: avisa ? 700 : 400,
        }}>{s.vazia}</div>
      )}
    </section>
  )
}

export default function Essencial({ utente, meds, contactos, cor, aoMudar }: {
  /** A linha de `patients` que a ficha já tem — não se volta a pedir. */
  utente: Record<string, any>
  /** `patient_meds` ativos, lidos com `select('*')` — ver a nota no carregar. */
  meds: any[]
  contactos: any[]
  cor: string
  /** Avisa a ficha de que a linha do utente mudou, para ela recarregar. */
  aoMudar?: () => void
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const podeEditar = scope.pode('utentes', 'editar')

  const [plano, setPlano] = useState<any | null>(null)
  const [avaliacoes, setAvaliacoes] = useState<any[]>([])
  const [feridas, setFeridas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [jaCarregou, setJaCarregou] = useState(false)

  const pid = utente?.id

  /**
   * Qual é o pedido mais recente.
   *
   * ── ISTO NÃO É PRECAUÇÃO: É UM DEFEITO MEDIDO ──────────────────────────
   * O `useClinicPrefs` começa por dizer `nursing_home` e só depois vai buscar
   * o tipo verdadeiro ao servidor. Num centro de dia isso faz este carregar
   * correr duas vezes: a primeira com `hasWounds` a verdadeiro (três
   * consultas), a segunda com ele a falso (duas, e a das feridas resolvida na
   * hora).
   *
   * A segunda ACABA PRIMEIRO, porque é mais curta. A primeira chega atrasada e
   * escreve por cima — e o Folha de um centro de dia aparecia com a secção
   * das feridas de um lar. Apanhado pelo scripts/qa-essencial.mjs, que comparou o
   * ecrã com a base de dados em vez de olhar para ele.
   *
   * O mesmo acontece a saltar de uma ficha para outra: a resposta da primeira
   * pessoa chega depois da segunda e fica no ecrã, com o nome da segunda por
   * cima. Numa folha que diz alergias e medicação, isso é a pior coisa que
   * esta página pode fazer.
   */
  const pedido = useRef(0)

  const carregar = useCallback(async () => {
    if (!pid || !user) { setCarregando(false); return }
    const meu = ++pedido.current
    setCarregando(true)

    // Três consultas, e só as três que a ficha ainda não fez. O utente, a
    // medicação e os contactos vêm por propriedade: já estão carregados, e
    // pedi-los outra vez eram três chamadas por nada.
    //
    // As feridas só se pedem onde há feridas. Num centro de dia, `hasWounds` é
    // falso e a secção não existe — uma consulta a uma tabela que a casa nunca
    // usa é uma chamada desperdiçada em toda a gente.
    const [pl, av, fe] = await Promise.all([
      supabase.from('care_plans').select('*').eq('patient_id', pid).maybeSingle(),
      supabase.from('assessments').select('scale,score,date,created_at').eq('patient_id', pid),
      cfg.hasWounds
        ? supabase.from('wounds').select('location,type,stage,status,dressing,treatment,onset_date').eq('patient_id', pid)
        : Promise.resolve({ data: [], error: null }),
    ])

    // Nenhum destes erros tranca a folha: uma folha destas sem as avaliações continua
    // a dizer as alergias, a dieta e a medicação, que é para o que serve. O que
    // ele não pode é dizer-se completo — e não diz, porque os campos que não
    // vieram contam como em branco.
    // Chegou tarde: já há um pedido mais novo a caminho, ou já respondido.
    if (meu !== pedido.current) return

    if (pl.error) console.warn('[essencial] care_plans', pl.error.message)
    if (av.error) console.warn('[essencial] assessments', av.error.message)
    if (fe.error) console.warn('[essencial] wounds', fe.error.message)

    setPlano(pl.error ? null : pl.data)
    setAvaliacoes(av.error ? [] : (av.data || []))
    setFeridas(fe.error ? [] : (fe.data || []))
    setJaCarregou(true)
    setCarregando(false)
  }, [pid, user, supabase, cfg.hasWounds])

  useEffect(() => { carregar() }, [carregar])

  /* ── O QUE ESTÁ MESMO NA COLUNA ─────────────────────────────────────────
     A folha escreve por cima: um campo em branco sai «⚠ NÃO ESTÁ REGISTADO» e
     um negado sai «Sem alergias conhecidas». Abrir a caixa de edição com
     qualquer uma dessas frases lá dentro fazia quem gravasse escrever o aviso
     dentro do campo — e a partir daí a folha diria que estava preenchido.

     Por isso lê-se da origem, não do que está no ecrã. */
  const bruto = useCallback((c: CampoDaFolha): string | null => {
    if (!c.coluna) return null
    const origem = c.tabela === 'care_plans' ? plano : utente
    const v = origem?.[c.coluna]
    return v == null || v === '' ? null : String(v)
  }, [plano, utente])

  /** Grava um campo. Devolve a mensagem de erro, ou null se gravou. */
  const guardarCampo = useCallback(async (
    c: CampoDaFolha, valor: string | null,
  ): Promise<string | null> => {
    if (!podeEditar) return 'Não tem permissão para alterar esta ficha.'
    if (!c.tabela || !c.coluna) return 'Este campo é calculado — não se escreve aqui.'
    const antes = bruto(c)

    if (c.tabela === 'patients') {
      const { error } = await supabase.from('patients')
        .update({ [c.coluna]: valor }).eq('id', utente.id)
      if (error) {
        console.error('[phlox:essencial:gravar]', error)
        return 'Não foi possível gravar. Pode não ter permissão para alterar esta ficha.'
      }
      aoMudar?.()
    } else {
      /* O PLANO PODE AINDA NÃO EXISTIR.
         Quem escreve a dieta de alguém que nunca teve plano de cuidados está a
         criar o plano — e um `update` sobre zero linhas não dá erro nenhum: dá
         «gravado» e não grava nada. É a pior falha possível num campo que diz
         a textura dos líquidos de quem se engasga. */
      if (plano?.id) {
        const { error } = await supabase.from('care_plans')
          .update({ [c.coluna]: valor }).eq('id', plano.id)
        if (error) {
          console.error('[phlox:essencial:gravar-plano]', error)
          return 'Não foi possível gravar no plano de cuidados.'
        }
      } else {
        const { data, error } = await supabase.from('care_plans')
          .insert(scope.stamp({ patient_id: utente.id, user_id: user?.id, [c.coluna]: valor }))
          .select('*').single()
        if (error) {
          console.error('[phlox:essencial:criar-plano]', error)
          return 'Não foi possível criar o plano de cuidados.'
        }
        setPlano(data)
      }
      // O plano é desta folha: recarrega-se aqui, sem incomodar a ficha.
      await carregar()
    }

    registar({ supabase, scope, user }, {
      ...ACOES.fichaCampo(utente.name || 'a pessoa', c.rotulo.toLowerCase(), antes, valor),
      subjectId: utente.id, subjectName: utente.name, entityId: utente.id,
    })
    return null
  }, [podeEditar, bruto, supabase, utente, plano, scope, user, aoMudar])

  const edicao: Edicao = useMemo(
    () => ({ podeEditar, bruto, guardar: guardarCampo }),
    [podeEditar, bruto, guardarCampo])

  const folha: FolhaDoEssencial | null = useMemo(() => {
    if (!utente) return null
    return montarFolha({
      utente, meds: meds || [], avaliacoes, plano, feridas,
      contactos: contactos || [],
      turnos: shiftsFor(institution),
      temQuartos: cfg.hasBeds,
      temFeridas: cfg.hasWounds,
      comoSeChama: cfg.personNoun.toLowerCase(),
      hoje: ptDate(),
    })
  }, [utente, meds, avaliacoes, plano, feridas, contactos, institution,
    cfg.hasBeds, cfg.hasWounds, cfg.personNoun])

  function imprimir() {
    if (!folha) return
    const secoes = folha.secoes.map(s => {
      const registos: PrintRecord[] = []
      if (s.campos?.length) {
        registos.push({
          title: s.titulo,
          fields: s.campos.map(c => ({ label: c.rotulo, value: c.valor })),
        })
      }
      if (s.linhas?.length) registos.push({ title: s.titulo, bullets: s.linhas })
      if (!registos.length) registos.push({ title: s.titulo, body: s.vazia || '—' })
      return { heading: s.titulo, records: registos }
    })

    printDoc({
      docTitle: `O essencial — ${folha.nome}`,
      docSubtitle: resumoDaFolha(folha),
      institution: cfg.unitNoun,
      meta: folha.cabecalho.map(c => ({ label: c.rotulo, value: c.valor })),
      sections: [
        ...(folha.emFaltaCritico.length ? [{
          heading: 'Falta o essencial',
          note: 'Um campo em branco não quer dizer que não haja. Confirmar antes de agir.',
          records: [{
            title: 'Por preencher',
            bullets: folha.emFaltaCritico.map(c => `${c.rotulo} — ${c.valor}`),
          }],
        }] : []),
        ...(folha.alertas.length ? [{
          heading: 'A confirmar',
          records: [{ title: 'Avisos', bullets: folha.alertas }],
        }] : []),
        ...secoes,
      ],
      footerNote: `Folha de ${emPortugues(folha.em)}. Folha de síntese montada a partir da ficha, `
        + 'do plano de cuidados e dos registos — não substitui a consulta ao processo individual.',
    })
  }

  if (!folha) return null

  // Enquanto não se sabe, não se diz nada. Sem isto, a folha pisca «NÃO ESTÁ
  // REGISTADO» em campos que estão preenchidos, porque o plano de cuidados
  // ainda vem a caminho — e um aviso falso visto uma vez ensina a ignorá-lo.
  if (carregando && !jaCarregou) {
    return (
      <div style={{ marginTop: 'var(--space-12)', color: 'var(--ink-5)', fontSize: 14 }}>
        A montar a folha…
      </div>
    )
  }

  return (
    <div style={{ marginTop: 'var(--space-12)' }}>
      {/* ── O cabeçalho ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
        justifyContent: 'space-between', gap: 'var(--space-5)',
      }}>
        <div>
          <div style={{ ...MONO, color: cor }}>O essencial</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-4)', marginTop: 4, maxWidth: '46ch', lineHeight: 1.5 }}>
            O que é preciso saber para cuidar desta pessoa hoje. Quem entra a
            substituir alguém lê esta folha e sabe o que fazer.
          </div>
        </div>
        <button onClick={imprimir} style={{
          padding: '9px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer',
          border: `1px solid ${cor}`, background: 'transparent', color: cor,
          fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
        }}>Imprimir</button>
      </div>

      {/* ── O que falta, antes de tudo ───────────────────────────────────── */}
      {folha.emFaltaCritico.length > 0 && (
        <div style={{
          marginTop: 'var(--space-8)', padding: 'var(--space-6)',
          borderRadius: 'var(--r-md)', background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)',
        }}>
          <div style={{ ...MONO, color: 'var(--red)' }}>Falta o essencial</div>
          <div style={{ fontSize: 14, color: 'var(--red)', marginTop: 6, lineHeight: 1.55 }}>
            Estes campos estão em branco. Em branco não quer dizer que não haja —
            quer dizer que ninguém escreveu.
          </div>
          <ul style={{ margin: '10px 0 0', padding: '0 0 0 18px', color: 'var(--red)', fontSize: 14, lineHeight: 1.7 }}>
            {folha.emFaltaCritico.map(c => (
              <li key={c.rotulo}>
                <strong>{c.rotulo}</strong>
                {c.onde ? <span style={{ color: 'var(--red)', fontWeight: 400 }}> — preenche-se em {c.onde === 'plano' ? 'O Plano' : 'Dados da pessoa'}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── As incoerências ──────────────────────────────────────────────── */}
      {folha.alertas.length > 0 && (
        <div style={{
          marginTop: 'var(--space-6)', padding: 'var(--space-6)',
          borderRadius: 'var(--r-md)', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)',
        }}>
          <div style={{ ...MONO, color: 'var(--amber)' }}>A confirmar</div>
          <ul style={{ margin: '8px 0 0', padding: '0 0 0 18px', color: 'var(--amber)', fontSize: 13.5, lineHeight: 1.6 }}>
            {folha.alertas.map((a, i) => <li key={i} style={{ marginTop: i ? 6 : 0 }}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* ── O cabeçalho da folha ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-8)',
        gridTemplateColumns: edicao.podeEditar
          ? 'repeat(auto-fit, minmax(300px, 1fr))'
          : 'repeat(auto-fit, minmax(150px, 1fr))',
        padding: 'var(--space-6)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)',
      }}>
        {folha.cabecalho.map(c => (
          <Campo key={c.rotulo} c={c}
            bruto={edicao.bruto(c)} podeEditar={edicao.podeEditar}
            aoGuardar={edicao.guardar} />
        ))}
      </div>

      {/* ── A folha ──────────────────────────────────────────────────────── */}
      {folha.secoes.map(s => <Secao key={s.id} s={s} cor={cor} edicao={edicao} />)}

      <div style={{ marginTop: 'var(--space-12)', fontSize: 12.5, color: 'var(--ink-5)', lineHeight: 1.6 }}>
        Folha de {emPortugues(folha.em)}, montada a partir da ficha, do plano de
        cuidados e dos registos. {folha.emFalta > 0
          ? `${folha.emFalta} de ${folha.total} campos estão por preencher.`
          : 'Todos os campos estão preenchidos.'}
      </div>
    </div>
  )
}
