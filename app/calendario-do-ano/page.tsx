'use client'
// app/calendario-do-ano/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O ano inteiro num ecrã.
//
// ── PORQUE É QUE NÃO É O /calendario QUE JÁ EXISTE ─────────────────────────
// O /calendario é pessoal: as consultas e os exames de uma pessoa, um mês de
// cada vez, preso ao `user_id`. Este é da casa, e o que faz não é mostrar um
// mês — é mostrar DOZE, porque a pergunta que se faz a um calendário de
// parede numa direção técnica é de longo alcance: quando é a Páscoa, em que
// semana cai o 25 de Abril, quantos aniversários há em março, que documentos
// caducam antes do verão.
//
// ── O QUE ELE NÃO FAZ ───────────────────────────────────────────────────────
// Não guarda cópias. As atividades, as visitas, as consultas, os prazos e as
// validades continuam a viver onde sempre viveram; isto lê-as. Copiá-las
// criava uma segunda verdade que se desencontrava da primeira em silêncio.
//
// Só o que não tinha sítio nenhum — a festa de Natal, a semana de obras, a
// visita da segurança social — é que fica guardado aqui (sprint166).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import { ptDate } from '@/lib/ptTime'
import ClinicalGate from '@/components/ClinicalGate'
import { carregarAno } from '@/lib/carregarAno'
import { invalidar } from '@/lib/leituraPartilhada'
import { CAMADA } from '@/lib/camadas'
import {
  MESES, DIAS_CURTOS, ORIGENS, grelhaDoMes, porDia, porExtenso,
  contarPorOrigem, corDe, rotuloDe, ehBissexto, diasDoAno,
  type Marca, type Origem,
} from '@/lib/calendario'

const CORES: Record<string, string> = {
  cinza: '#64748b', vermelho: '#dc2626', laranja: '#ea580c', amarelo: '#ca8a04',
  verde: '#16a34a', azul: '#2563eb', roxo: '#7c3aed', rosa: '#db2777',
}

export default function CalendarioDoAnoPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const hoje = useMemo(() => ptDate(), [])
  const [ano, setAno] = useState(() => +ptDate().slice(0, 4))
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [falharam, setFalharam] = useState<string[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [escondidas, setEscondidas] = useState<Origem[]>([])
  const [diaAberto, setDiaAberto] = useState<string | null>(null)
  const [aMarcar, setAMarcar] = useState(false)

  const podeVer = scope.pode('utentes', 'ver')
  const podeEditar = scope.pode('utentes', 'editar')

  const carregar = useCallback(async () => {
    if (!user) { setACarregar(false); return }
    setACarregar(true)
    try {
      const { marcas: m, falharam: f } = await carregarAno(supabase, scope.filter, ano)
      setMarcas(m); setFalharam(f)
    } catch (e) {
      toast.error('Não foi possível montar o ano',
        reportError('calendario-ano', e, 'Tenta recarregar a página.'))
    } finally { setACarregar(false) }
  }, [user, supabase, scope.filter, ano, toast])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(
    () => marcas.filter(m => !escondidas.includes(m.origem)),
    [marcas, escondidas],
  )
  const doDia = useMemo(() => porDia(visiveis), [visiveis])
  const contagem = useMemo(() => contarPorOrigem(marcas), [marcas])

  const abertas = diaAberto ? (doDia.get(diaAberto) || []) : []

  if (!user) return null
  const plano = (user?.plan || 'free') as string
  if (plano !== 'pro' && plano !== 'clinic') {
    return <ClinicalGate emoji="🗓️" accent="#0d9488"
      title="Calendário do ano"
      description="O ano inteiro num ecrã: aniversários, atividades, visitas, consultas, prazos e feriados, tudo marcado sozinho. Faz parte do plano Institucional." />
  }
  if (!podeVer) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.6 }}>
          A sua conta não tem acesso ao calendário da casa.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 20px 80px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontSize: 25, fontWeight: 800, margin: '0 0 6px', color: '#0b1120', letterSpacing: '-.02em' }}>
            Calendário do ano
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#64748b', lineHeight: 1.6, maxWidth: 640 }}>
            Tudo o que tem data, no ano inteiro. Enche-se sozinho a partir do que já está
            registado; o resto marca-se à mão.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setAno(a => a - 1)} aria-label="Ano anterior" style={seta}>‹</button>
          <div style={{ textAlign: 'center', minWidth: 96 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 21, fontWeight: 700, lineHeight: 1.1, color: '#0b1120' }}>
              {ano}
            </div>
            {/* O pedido dele, dito no ecrã. Num ano bissexto vê-se porquê: o
                29 de fevereiro está lá, e nos outros anos não está. */}
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>
              {ehBissexto(ano) ? `bissexto · ${diasDoAno(ano)} dias` : `${diasDoAno(ano)} dias`}
            </div>
          </div>
          <button onClick={() => setAno(a => a + 1)} aria-label="Ano seguinte" style={seta}>›</button>
          {ano !== +hoje.slice(0, 4) && (
            <button onClick={() => setAno(+hoje.slice(0, 4))} style={{ ...botao, marginLeft: 6 }}>
              Voltar a {hoje.slice(0, 4)}
            </button>
          )}
          {/* Se a tabela das marcas não respondeu, este botão abria um
              formulário que ia falhar a gravar no fim. Melhor não haver
              botão do que haver um que desiste depois de a pessoa escrever. */}
          {podeEditar && !falharam.includes('Marcado à mão') && (
            <button onClick={() => setAMarcar(true)} style={{ ...botao, background: '#0b1120', color: 'white', border: 'none' }}>
              Marcar
            </button>
          )}
        </div>
      </header>

      {/* Uma fonte que não respondeu tem de se ver. Um calendário a que falta
          silenciosamente as visitas parece completo e engana. */}
      {falharam.length > 0 && (
        <div style={{
          margin: '14px 0 0', padding: '11px 14px', borderRadius: 10,
          background: '#fffbeb', border: '1px solid #fef3c7', fontSize: 12.5,
          color: '#92400e', lineHeight: 1.6,
        }}>
          Não consegui ler {falharam.length === 1 ? 'uma fonte' : `${falharam.length} fontes`}:{' '}
          <strong>{falharam.join(', ').toLowerCase()}</strong>. O resto do ano está certo —
          só falta o que vinha daí.
        </div>
      )}

      {/* ── A legenda, que também é o filtro ─────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '16px 0 18px' }}>
        {ORIGENS.filter(o => contagem[o.id]).map(o => {
          const fora = escondidas.includes(o.id)
          return (
            <button key={o.id} aria-pressed={!fora}
              onClick={() => setEscondidas(e => fora ? e.filter(x => x !== o.id) : [...e, o.id])}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 600,
                border: `1px solid ${fora ? '#e2e8f0' : `${o.cor}55`}`,
                background: fora ? '#f8fafc' : `${o.cor}12`,
                color: fora ? '#cbd5e1' : '#334155',
                textDecoration: fora ? 'line-through' : 'none',
              }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                background: fora ? '#cbd5e1' : o.cor,
              }} />
              {o.rotulo}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.1, color: '#94a3b8' }}>
                {contagem[o.id]}
              </span>
            </button>
          )
        })}
      </div>

      {aCarregar ? (
        <p style={{ fontSize: 13.5, color: '#94a3b8' }}>A montar o ano…</p>
      ) : (
        <>
          <div className="ano-grelha">
            {MESES.map((nome, mes) => (
              <Mes key={mes} ano={ano} mes={mes} nome={nome} hoje={hoje}
                doDia={doDia} aberto={diaAberto} onAbrir={setDiaAberto} />
            ))}
          </div>

          {!marcas.length && (
            <p style={{ marginTop: 18, fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
              Só os feriados, para já. Os aniversários aparecem sozinhos assim que as pessoas
              tiverem data de nascimento na ficha — que é o que a{' '}
              <Link href="/patients" style={{ color: '#0d9488' }}>inscrição</Link> passou a
              perguntar.
            </p>
          )}
        </>
      )}

      {diaAberto && (
        <PainelDoDia data={diaAberto} marcas={abertas} onFechar={() => setDiaAberto(null)}
          person={cfg.personNoun.toLowerCase()} />
      )}

      {aMarcar && (
        <ModalMarcar ano={ano} onFechar={() => setAMarcar(false)}
              onGravado={() => {
            // Sem isto, a marca acabada de gravar não aparecia durante cinco
            // minutos: a `leituraPartilhada` guarda a resposta por esse tempo
            // e devolvia a cópia antiga ao recarregar. Parecia não ter gravado.
            invalidar('ano:marcas')
            setAMarcar(false); carregar()
          }} />
      )}

      <style>{`
        .ano-grelha { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        @media (max-width: 1000px) { .ano-grelha { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 760px)  { .ano-grelha { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 460px)  { .ano-grelha { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}

const seta: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white',
  cursor: 'pointer', fontSize: 17, color: '#475569', lineHeight: 1, fontFamily: 'inherit',
}
const botao: React.CSSProperties = {
  padding: '8px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white',
  cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#475569', fontFamily: 'inherit',
}

// ═══════════════════════════════════════════════════════════════════════════
// Um mês
// ═══════════════════════════════════════════════════════════════════════════
function Mes({ ano, mes, nome, hoje, doDia, aberto, onAbrir }: {
  ano: number; mes: number; nome: string; hoje: string
  doDia: Map<string, Marca[]>; aberto: string | null; onAbrir: (d: string) => void
}) {
  const semanas = grelhaDoMes(ano, mes)
  // `reduce<number>` porque o array é de `number | null` e sem isto o
  // acumulador herda o `null` do elemento.
  const quantas = semanas.flat().reduce<number>((n, d) => {
    if (d === null) return n
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return n + (doDia.get(iso)?.length || 0)
  }, 0)

  return (
    <section style={{ border: '1px solid #eef2f7', borderRadius: 11, padding: '11px 10px 9px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8, padding: '0 3px' }}>
        <h2 style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 700, color: '#0b1120' }}>{nome}</h2>
        {quantas > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.1, color: '#cbd5e1' }}>
            {quantas}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DIAS_CURTOS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 9.5, fontWeight: 700, lineHeight: 1.1,
            color: i >= 5 ? '#cbd5e1' : '#94a3b8', paddingBottom: 4,
          }}>{d}</div>
        ))}

        {semanas.flat().map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const doDiaEste = doDia.get(iso) || []
          const eHoje = iso === hoje
          const estaAberto = iso === aberto
          const fimDeSemana = i % 7 >= 5
          // Até três pontos. Com mais, a casa fica preta e deixa de dizer nada.
          const cores = [...new Set(doDiaEste.map(m => corDe(m.origem)))].slice(0, 3)

          return (
            <button key={i} onClick={() => onAbrir(iso)}
              title={doDiaEste.length ? doDiaEste.map(m => m.titulo).join(' · ') : undefined}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                border: estaAberto ? '1.5px solid #0b1120' : eHoje ? '1.5px solid #0d9488' : '1.5px solid transparent',
                borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                background: estaAberto ? '#f1f5f9' : 'transparent',
              }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1,
                fontWeight: eHoje ? 700 : 500,
                color: eHoje ? '#0d9488' : fimDeSemana ? '#cbd5e1' : '#475569',
              }}>{d}</span>
              <span style={{ display: 'flex', gap: 1.5, height: 4, alignItems: 'center' }}>
                {cores.map((c, j) => (
                  <span key={j} style={{ width: 3.5, height: 3.5, borderRadius: 2, background: c }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// O que há num dia
// ═══════════════════════════════════════════════════════════════════════════
function PainelDoDia({ data, marcas, onFechar, person }: {
  data: string; marcas: Marca[]; onFechar: () => void; person: string
}) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
      background: 'white', borderTop: '1px solid #e2e8f0',
      boxShadow: '0 -8px 32px rgba(11,17,32,.1)', maxHeight: '58vh', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 13 }}>
          <h3 style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 800, color: '#0b1120' }}>
            {porExtenso(data, true)}
          </h3>
          <button onClick={onFechar} aria-label="Fechar" style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 22,
            color: '#cbd5e1', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {!marcas.length ? (
          <p style={{ margin: 0, fontSize: 13.5, color: '#94a3b8' }}>Nada marcado neste dia.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {marcas.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 12px',
                border: '1px solid #eef2f7', borderRadius: 9,
                borderLeft: `3px solid ${corDe(m.origem)}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    {m.hora && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.1, color: '#0b1120', fontWeight: 700 }}>
                        {m.hora}
                      </span>
                    )}
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0b1120' }}>{m.titulo}</span>
                    <span style={{ fontSize: 11, color: corDe(m.origem) }}>{rotuloDe(m.origem)}</span>
                  </div>
                  {m.detalhe && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                      {m.detalhe}
                    </p>
                  )}
                  {/* O 29 de fevereiro. Sem esta linha a pessoa parecia ter
                      nascido a 28, e ninguém saberia porquê. */}
                  {m.movida && (
                    <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#d97706', lineHeight: 1.5 }}>
                      A data certa é {porExtenso(m.movida)} — este ano não tem esse dia,
                      por isso assinala-se hoje.
                    </p>
                  )}
                </div>
                {m.quemId && (
                  <Link href={`/patients/${m.quemId}`} style={{
                    fontSize: 11.5, color: '#0d9488', textDecoration: 'none',
                    whiteSpace: 'nowrap', fontWeight: 600,
                  }}>Ver {person} →</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Marcar à mão
// ═══════════════════════════════════════════════════════════════════════════
function ModalMarcar({ ano, onFechar, onGravado }: {
  ano: number; onFechar: () => void; onGravado: () => void
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const [f, setF] = useState({
    titulo: '', detalhe: '', data: `${ano}-01-01`, ate: '', hora: '',
    repete: 'nao', cor: 'azul',
  })
  const [aGravar, setAGravar] = useState(false)

  const intervaloAoContrario = !!f.ate && f.ate < f.data

  async function gravar() {
    if (!f.titulo.trim() || !f.data || intervaloAoContrario) return
    setAGravar(true)
    try {
      const { error } = await supabase.from('calendario_marcas').insert(scope.stamp({
        user_id: user.id, titulo: f.titulo.trim(), detalhe: f.detalhe.trim() || null,
        data: f.data, ate: f.ate || null, hora: f.hora || null,
        repete: f.repete, cor: f.cor, criada_por: user.email || null,
      }))
      if (error) {
        toast.error('Não foi possível marcar',
          reportError('calendario-marcar', error, 'O que escreveste não se perdeu.'))
        return
      }
      onGravado()
    } finally { setAGravar(false) }
  }

  return (
    <div onClick={onFechar} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,17,32,.45)', zIndex: CAMADA.fundoModal,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '8vh 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 15, maxWidth: 520, width: '100%',
        padding: '22px', boxShadow: '0 22px 60px rgba(11,17,32,.22)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#0b1120' }}>
          Marcar no calendário
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <Campo rotulo="O quê">
            <input value={f.titulo} onChange={e => setF(x => ({ ...x, titulo: e.target.value }))}
              autoFocus placeholder="Festa de Natal, obras na cozinha, visita da segurança social…"
              style={caixa} />
          </Campo>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Campo rotulo="Quando"><input type="date" value={f.data}
              onChange={e => setF(x => ({ ...x, data: e.target.value }))} style={caixa} /></Campo>
            <Campo rotulo="Até (se durar dias)"><input type="date" value={f.ate}
              onChange={e => setF(x => ({ ...x, ate: e.target.value }))} style={caixa} /></Campo>
            <Campo rotulo="Hora (se tiver)"><input type="time" value={f.hora}
              onChange={e => setF(x => ({ ...x, hora: e.target.value }))} style={caixa} /></Campo>
          </div>

          {intervaloAoContrario && (
            <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>
              A data de fim está antes da de início.
            </p>
          )}

          <Campo rotulo="Notas"><textarea value={f.detalhe} rows={2}
            onChange={e => setF(x => ({ ...x, detalhe: e.target.value }))}
            style={{ ...caixa, resize: 'vertical' }} /></Campo>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Campo rotulo="Repete">
              <select value={f.repete} onChange={e => setF(x => ({ ...x, repete: e.target.value }))}
                style={caixa}>
                <option value="nao">Só este ano</option>
                <option value="anual">Todos os anos</option>
              </select>
            </Campo>
            <Campo rotulo="Cor">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 4 }}>
                {Object.entries(CORES).map(([nome, cor]) => (
                  <button key={nome} onClick={() => setF(x => ({ ...x, cor: nome }))}
                    aria-label={nome} aria-pressed={f.cor === nome}
                    style={{
                      width: 24, height: 24, borderRadius: 7, cursor: 'pointer', background: cor,
                      border: f.cor === nome ? '2.5px solid #0b1120' : '2.5px solid transparent',
                    }} />
                ))}
              </div>
            </Campo>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={gravar} disabled={!f.titulo.trim() || aGravar || intervaloAoContrario}
            style={{
              flex: 1, background: '#0b1120', color: 'white', border: 'none', borderRadius: 9,
              padding: 12, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              cursor: f.titulo.trim() && !intervaloAoContrario ? 'pointer' : 'not-allowed',
              opacity: f.titulo.trim() && !intervaloAoContrario ? 1 : 0.5,
            }}>{aGravar ? 'A marcar…' : 'Marcar'}</button>
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

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
        {rotulo}
      </label>
      {children}
    </div>
  )
}
