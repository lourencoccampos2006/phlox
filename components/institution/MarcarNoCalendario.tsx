'use client'

// components/institution/MarcarNoCalendario.tsx
// ═══════════════════════════════════════════════════════════════════════════
// ADICIONAR UMA COISA A UM DIA — E QUE ELA VÁ PARA A FERRAMENTA CERTA
// ═══════════════════════════════════════════════════════════════════════════
//
// O calendário da casa lê onze fontes e não escrevia em nenhuma. A única coisa
// que se podia acrescentar era uma «marca» de texto livre com uma cor. Então
// via-se uma consulta num dia e não havia como marcar outra; via-se a ginástica
// de quarta e não havia como pôr a de quinta. Um calendário onde só se olha.
//
// ── PORQUE É QUE ISTO NÃO GUARDA NADA DE SEU ───────────────────────────────
// A tentação era criar uma tabela de «eventos do calendário» e meter tudo lá.
// Isso dava uma segunda verdade: a atividade marcada no calendário não
// aparecia em /activities, a consulta não aparecia em /agenda, e as duas
// listas desencontravam-se em silêncio — que é exactamente o erro que o
// comentário no topo do /calendario-do-ano diz para não cometer.
//
// Por isso isto é um ATALHO, não um sítio. Escolhe-se o que é, escreve-se o
// mínimo, e a linha vai para a tabela de quem é dona do assunto:
//
//     Atividade  → activities       (a mesma que o /activities lê)
//     Consulta   → appointments     (a mesma que a /agenda lê)
//     Visita     → visit_requests   (a mesma que o /family lê)
//     Outra      → calendario_marcas
//
// E diz-se para onde foi. Quem acrescenta uma coisa num calendário precisa de
// saber onde a vai encontrar outra vez.
//
// ── O MÍNIMO É MESMO O MÍNIMO ──────────────────────────────────────────────
// Cada uma destas ferramentas tem um formulário completo, com dez a quinze
// campos. Repeti-los aqui era construir o formulário duas vezes e garantir que
// um dia divergiam. Aqui pede-se o que não se pode adivinhar — o quê, a quem,
// a que hora — e o resto fica como a ferramenta o deixaria por omissão. Quem
// precisar dos outros campos abre a ferramenta, e o atalho diz-lhe qual é.

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import { invalidar } from '@/lib/leituraPartilhada'
import { porExtenso } from '@/lib/calendario'
import { registar, ACOES } from '@/lib/registo'
import { Folha, Campo, Botao, CAIXA, CAIXA_TEXTO, ROTULO } from '@/components/ui/mesa'

type Genero = 'atividade' | 'consulta' | 'visita' | 'marca'

const TIPOS_ATIVIDADE = [
  ['gym', 'Ginástica'], ['games', 'Jogos'], ['music', 'Musicoterapia'],
  ['art', 'Arteterapia'], ['outing', 'Saída'], ['religious', 'Religioso'],
  ['therapy', 'Fisioterapia'], ['social', 'Convívio'], ['reading', 'Leitura'],
  ['other', 'Outro'],
] as const

const TIPOS_CONSULTA = [
  ['consulta', 'Consulta'], ['exame', 'Exame'], ['terapia', 'Terapia'],
  ['visita_medica', 'Visita médica'], ['vacina', 'Vacina'],
  ['reuniao', 'Reunião'], ['transporte', 'Transporte'], ['outro', 'Outro'],
] as const

/** As quatro cores da marca livre. Os nomes são os que a lib/calendario usa. */
const CORES_MARCA = [
  ['azul', 'var(--ink-2)', 'Só acontece'],
  ['verde', 'var(--green)', 'Boa notícia'],
  ['laranja', 'var(--amber)', 'Pede atenção'],
  ['vermelho', 'var(--red)', 'Não pode falhar'],
] as const

export default function MarcarNoCalendario({
  data, pid, nomeUtente, onFechar, onGravado,
}: {
  /** O dia, em 'AAAA-MM-DD'. */
  data: string
  /** Aberto da ficha de alguém? Então a pessoa já é conhecida e não se pergunta. */
  pid?: string
  nomeUtente?: string
  onFechar: () => void
  /** Chamado depois de gravar, com o nome da ferramenta onde a linha ficou. */
  onGravado: (onde: string) => void
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const [genero, setGenero] = useState<Genero | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [utentes, setUtentes] = useState<{ id: string; name: string }[] | null>(null)

  const [f, setF] = useState({
    titulo: '', tipo: 'other', hora: '', local: '', notas: '',
    quem: pid || '', ate: '', cor: 'azul', repete: 'nao',
  })

  /* A lista de pessoas só é precisa para consulta e visita, e só quando não
     vem de uma ficha. Lê-se quando se escolhe, não ao abrir — a maior parte
     das vezes escolhe-se «atividade», que não precisa dela. */
  const precisaDeUtente = (genero === 'consulta' || genero === 'visita') && !pid
  useEffect(() => {
    if (!precisaDeUtente || utentes !== null || !user) return
    let vivo = true
    ;(async () => {
      const { data: linhas, error } = await scope.filter(
        supabase.from('patients').select('id, name').eq('active', true).order('name'))
      if (!vivo) return
      // Um erro aqui não é «não há pessoas» — é «não sei». A lista fica vazia
      // mas o formulário diz-se incapaz em vez de parecer uma casa sem gente.
      if (error) { console.error('[phlox:marcar-calendario]', error); setUtentes([]); return }
      setUtentes(linhas || [])
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaDeUtente, user, supabase])

  const nomeDoDia = porExtenso(data, true)
  const pessoa = cfg.personNoun.toLowerCase()

  const ESCOLHAS: { id: Genero; rotulo: string; onde: string }[] = [
    { id: 'atividade', rotulo: 'Atividade', onde: 'Fica em Atividades.' },
    { id: 'consulta', rotulo: 'Consulta ou exame', onde: 'Fica na Agenda, na ficha da pessoa.' },
    { id: 'visita', rotulo: 'Visita de família', onde: 'Fica nas Visitas.' },
    { id: 'marca', rotulo: 'Outra coisa', onde: 'Fica só no calendário — festas, obras, uma visita da tutela.' },
  ]

  function falta(): string | null {
    if (genero === 'marca' || genero === 'atividade') {
      if (!f.titulo.trim()) return 'Falta dizer o que é.'
    }
    if (genero === 'consulta') {
      if (!f.quem) return `Falta escolher a ${pessoa}.`
      if (!f.titulo.trim()) return 'Falta dizer o que é.'
    }
    if (genero === 'visita' && !f.quem) return `Falta escolher quem recebe a visita.`
    if (f.ate && f.ate < data) return 'A data de fim está antes da de início.'
    return null
  }

  async function gravar() {
    if (!user || !genero || falta()) return
    setAGravar(true)
    try {
      let erro: any = null
      let onde = ''
      let resumo = ''

      if (genero === 'atividade') {
        onde = 'Atividades'
        resumo = f.titulo.trim()
        const r = await supabase.from('activities').insert(scope.stamp({
          user_id: user.id, title: resumo, type: f.tipo,
          date: data, start_time: f.hora || null,
          location: f.local.trim() || null, description: f.notas.trim() || null,
          status: 'planned',
        }))
        erro = r.error
      } else if (genero === 'consulta') {
        onde = 'Agenda'
        resumo = f.titulo.trim()
        const r = await supabase.from('appointments').insert(scope.stamp({
          user_id: user.id, patient_id: f.quem, title: resumo,
          type: f.tipo === 'other' ? 'consulta' : f.tipo,
          date: data, time: f.hora || null,
          location: f.local.trim() || null, notes: f.notas.trim() || null,
          status: 'scheduled',
        }))
        erro = r.error
      } else if (genero === 'visita') {
        onde = 'Visitas'
        resumo = 'Visita de família'
        const r = await supabase.from('visit_requests').insert(scope.stamp({
          user_id: user.id, patient_id: f.quem,
          requested_date: data,
          // A hora é obrigatória nesta tabela e o /family grava '00:00' quando
          // não há. Mantém-se igual: uma visita sem hora é uma visita, e
          // inventar uma dizia à família que vinha às nove.
          requested_time: f.hora || '00:00',
          notes: f.notas.trim() || null,
          status: 'pending',
        }))
        erro = r.error
      } else {
        onde = 'Calendário'
        resumo = f.titulo.trim()
        const r = await supabase.from('calendario_marcas').insert(scope.stamp({
          user_id: user.id, titulo: resumo, detalhe: f.notas.trim() || null,
          data, ate: f.ate || null, hora: f.hora || null,
          repete: f.repete, cor: f.cor, criada_por: user.email || null,
        }))
        erro = r.error
      }

      if (erro) {
        toast.error('Não foi possível marcar',
          reportError('marcar-calendario', erro, 'O que escreveste não se perdeu.'))
        return
      }

      /* Sem isto, o que se acabou de marcar não aparecia durante cinco
         minutos: a leituraPartilhada devolvia a cópia antiga do ano e parecia
         não ter gravado. */
      invalidar('ano:')
      registar({ supabase, scope, user }, {
        ...ACOES.marcouNoCalendario(onde, resumo, data),
        subjectId: f.quem || null,
        subjectName: nomeUtente || (utentes || []).find(u => u.id === f.quem)?.name || null,
      })
      onGravado(onde)
    } finally { setAGravar(false) }
  }

  // ── A escolha ────────────────────────────────────────────────────────────
  if (!genero) {
    return (
      <Folha titulo={`Marcar — ${nomeDoDia}`} aoFechar={onFechar}>
        <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6, margin: '10px 0 4px' }}>
          O que é que vai acontecer neste dia? Cada um destes vai para a sua
          ferramenta — não fica uma cópia solta aqui.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
          {ESCOLHAS.map(e => (
            <button key={e.id} type="button" onClick={() => setGenero(e.id)}
              className="mesa-botao"
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--r-md)', padding: '9px 12px', fontFamily: 'inherit',
              }}>
              <span style={{
                display: 'block', fontSize: 'var(--t-corpo)', color: 'var(--ink)',
                fontWeight: 'var(--peso-forte)' as any,
              }}>{e.rotulo}</span>
              <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 2 }}>
                {e.onde}
              </span>
            </button>
          ))}
        </div>
      </Folha>
    )
  }

  // ── O formulário mínimo ──────────────────────────────────────────────────
  const escolha = ESCOLHAS.find(e => e.id === genero)!
  const impedimento = falta()

  return (
    <Folha titulo={`${escolha.rotulo} — ${nomeDoDia}`} aoFechar={onFechar}>
      <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: '10px 0 0' }}>{escolha.onde}</p>

      {genero !== 'visita' && (
        <Campo rotulo="O quê" obrigatorio para="mc-titulo">
          <input id="mc-titulo" value={f.titulo} autoFocus
            onChange={e => setF(x => ({ ...x, titulo: e.target.value }))}
            placeholder={genero === 'atividade' ? 'Ginástica da manhã'
              : genero === 'consulta' ? 'Consulta de oftalmologia'
              : 'Festa de Natal, obras na cozinha…'}
            style={CAIXA} />
        </Campo>
      )}

      {(genero === 'consulta' || genero === 'visita') && (
        pid ? (
          <Campo rotulo={genero === 'visita' ? 'Quem recebe' : `Para que ${pessoa}`}>
            <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)', paddingTop: 2 }}>{nomeUtente}</div>
          </Campo>
        ) : (
          <Campo rotulo={genero === 'visita' ? 'Quem recebe' : `Para que ${pessoa}`} obrigatorio para="mc-quem">
            {utentes === null ? (
              <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)' }}>A ler a lista…</div>
            ) : utentes.length === 0 ? (
              <div style={{ fontSize: 'var(--t-dado)', color: 'var(--amber)', lineHeight: 1.5 }}>
                Não foi possível ler a lista de pessoas. Marca a partir da ficha da {pessoa}.
              </div>
            ) : (
              <select id="mc-quem" value={f.quem} autoFocus={genero === 'visita'}
                onChange={e => setF(x => ({ ...x, quem: e.target.value }))} style={CAIXA}>
                <option value="">Escolher…</option>
                {utentes.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </Campo>
        )
      )}

      {(genero === 'atividade' || genero === 'consulta') && (
        <Campo rotulo="Tipo" para="mc-tipo">
          <select id="mc-tipo" value={f.tipo} onChange={e => setF(x => ({ ...x, tipo: e.target.value }))} style={CAIXA}>
            {(genero === 'atividade' ? TIPOS_ATIVIDADE : TIPOS_CONSULTA)
              .map(([id, rot]) => <option key={id} value={id}>{rot}</option>)}
          </select>
        </Campo>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: genero === 'marca' ? '1fr 1fr' : '1fr', gap: 10 }}>
        <Campo rotulo="Hora (se tiver)" para="mc-hora">
          <input id="mc-hora" type="time" value={f.hora}
            onChange={e => setF(x => ({ ...x, hora: e.target.value }))} style={CAIXA} />
        </Campo>
        {genero === 'marca' && (
          <Campo rotulo="Até (se durar dias)" para="mc-ate">
            <input id="mc-ate" type="date" value={f.ate} min={data}
              onChange={e => setF(x => ({ ...x, ate: e.target.value }))} style={CAIXA} />
          </Campo>
        )}
      </div>

      {(genero === 'atividade' || genero === 'consulta') && (
        <Campo rotulo="Onde (se não for aqui)" para="mc-local">
          <input id="mc-local" value={f.local}
            onChange={e => setF(x => ({ ...x, local: e.target.value }))}
            placeholder={genero === 'consulta' ? 'Centro de saúde, hospital…' : 'Sala, jardim, exterior…'}
            style={CAIXA} />
        </Campo>
      )}

      {/* A festa de Natal é no dia 25 TODOS os anos, e as obras de 2027 são só
          as de 2027. Esta pergunta já existia no formulário que isto
          substitui, e sem ela a festa de Natal tinha de se marcar outra vez em
          cada janeiro. */}
      {genero === 'marca' && (
        <Campo rotulo="Repete-se" para="mc-repete">
          <select id="mc-repete" value={f.repete}
            onChange={e => setF(x => ({ ...x, repete: e.target.value }))} style={CAIXA}>
            <option value="nao">Só este ano</option>
            <option value="anual">Todos os anos, no mesmo dia</option>
          </select>
        </Campo>
      )}

      {genero === 'marca' && (
        <Campo rotulo="Cor no calendário">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
            {CORES_MARCA.map(([nome, cor, oQue]) => {
              const on = f.cor === nome
              return (
                <button key={nome} type="button" onClick={() => setF(x => ({ ...x, cor: nome }))}
                  aria-pressed={on} className="mesa-botao"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '0 10px', borderRadius: 'var(--r-md)', fontFamily: 'inherit',
                    background: on ? 'var(--bg-3)' : 'transparent',
                    border: `1px solid ${on ? 'var(--ink)' : 'var(--border-2)'}`,
                    fontSize: 'var(--t-meta)', color: 'var(--ink-2)',
                  }}>
                  <span style={{ width: 9, height: 9, borderRadius: 'var(--r)', background: cor, flexShrink: 0 }} />
                  {oQue}
                </button>
              )
            })}
          </div>
        </Campo>
      )}

      <Campo rotulo="Notas" para="mc-notas">
        <textarea id="mc-notas" rows={2} value={f.notas}
          onChange={e => setF(x => ({ ...x, notas: e.target.value }))} style={CAIXA_TEXTO} />
      </Campo>

      {impedimento && (
        <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: '10px 0 0' }}>{impedimento}</p>
      )}

      <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
        <Botao feitio="principal" onClick={gravar} disabled={!!impedimento} esperando={aGravar}>MARCAR</Botao>
        <Botao onClick={() => setGenero(null)}>VOLTAR ATRÁS</Botao>
      </div>
      <div style={{ ...ROTULO, marginTop: 10, color: 'var(--ink-5)' }}>
        {data.split('-').reverse().join('/')}
      </div>
    </Folha>
  )
}
