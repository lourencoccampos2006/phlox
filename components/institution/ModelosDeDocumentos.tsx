'use client'
// components/institution/ModelosDeDocumentos.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Escreve-se o documento uma vez; preenche-se para cada pessoa.
//
// ── O QUE ELE PEDIU ─────────────────────────────────────────────────────────
// «Em documentos deveria de conseguir enviar-se apenas uma "template" de um
//  documento, por exemplo, do documento de inscrição, e aquilo preenchia o
//  documento com base nas condições da pessoa.»
//
// ── AS TRÊS DECISÕES QUE MANDAM AQUI ────────────────────────────────────────
// 1. Os campos disponíveis são os MESMOS da ficha de inscrição. Não há segunda
//    lista (ver lib/modelos.ts). Um campo novo na ficha aparece aqui sozinho.
//
// 2. Um campo em falta trava a impressão. Sai um contrato com o NIF em branco,
//    alguém assina, e só se descobre quando a Segurança Social o devolve — por
//    isso o que falta aparece em cima, por extenso, ANTES do botão.
//
// 3. O que sai fica guardado tal como saiu (`documentos_emitidos.corpo_final`).
//    Um contrato assinado em março tem de continuar a ler-se como estava em
//    março, mesmo que em setembro alguém corrija uma cláusula do modelo.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import { ptDate } from '@/lib/ptTime'
import { printDoc } from '@/lib/print'
import { paraFicha } from '@/lib/inscricao'
import {
  campos, marcasDe, marcasDesconhecidas, preencher, estaPronto,
  CATEGORIAS, categoriaDe, type Casa, type Preenchido,
} from '@/lib/modelos'
import { lerModelo, DocxIlegivel } from '@/lib/lerDocx'
import { CAMADA } from '@/lib/camadas'
import AvisoDeSetup from '@/components/AvisoDeSetup'

type Modelo = {
  id: string; nome: string; categoria: string; corpo: string
  descricao?: string | null; ativo?: boolean
}
type Pessoa = { id: string; name: string } & Record<string, any>

export default function ModelosDeDocumentos({ cor = '#0d6e42' }: { cor?: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const podeEditar = scope.pode('documentos', 'editar')

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [casa, setCasa] = useState<Casa>({})
  const [aCarregar, setACarregar] = useState(true)
  const [porInstalar, setPorInstalar] = useState(false)

  const [aEditar, setAEditar] = useState<Modelo | null>(null)
  const [aPreencher, setAPreencher] = useState<Modelo | null>(null)

  const carregar = useCallback(async () => {
    if (!user || !scope.orgId) { setACarregar(false); return }
    const [m, p, o] = await Promise.all([
      scope.filter(supabase.from('modelos_documentos').select('*')).eq('ativo', true).order('nome'),
      scope.filter(supabase.from('patients').select('*')).eq('active', true).order('name'),
      supabase.from('organizations')
        .select('name, address, city, vat_number, phone, director')
        .eq('id', scope.orgId).maybeSingle(),
    ])
    if (m.error) {
      // «A tabela não existe» é a migração por correr, não uma avaria.
      if (m.error.code === '42P01' || m.error.code === 'PGRST205'
          || /does not exist|could not find the table/i.test(m.error.message || '')) {
        setPorInstalar(true); setACarregar(false); return
      }
      toast.error('Não foi possível abrir os modelos',
        reportError('modelos-load', m.error, 'Tenta recarregar a página.'))
      setACarregar(false); return
    }
    setModelos(m.data || [])
    setPessoas(p.error ? [] : (p.data || []))
    const org: any = o.data || {}
    setCasa({
      nome: org.name, morada: org.address, cidade: org.city,
      nif: org.vat_number, telefone: org.phone, diretor: org.director,
    })
    setACarregar(false)
  }, [user, scope.orgId, scope.filter, supabase, toast])

  useEffect(() => { carregar() }, [carregar])

  if (aCarregar) {
    return <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>A abrir os modelos…</p>
  }
  if (porInstalar) {
    // O molde da casa para isto: uma linha calma, um código que não revela
    // nada ao cliente mas diz exatamente ao Fernando o que falta correr.
    return <AvisoDeSetup codigo="PHX-X6" compacto
      oQue="preencher documentos com os dados de uma pessoa" />
  }

  const porCategoria = CATEGORIAS
    .map(c => ({ ...c, modelos: modelos.filter(m => m.categoria === c.id) }))
    .filter(c => c.modelos.length)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <p style={{ flex: 1, minWidth: 240, margin: 0, fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.65 }}>
          Escreve-se o documento uma vez, com os campos entre chavetas, e depois
          preenche-se para quem for preciso. Os campos são os mesmos da ficha de
          inscrição.
        </p>
        {podeEditar && (
          <button onClick={() => setAEditar({ id: '', nome: '', categoria: 'outro', corpo: '' })}
            style={{
              padding: '9px 15px', borderRadius: 9, border: 'none', background: '#0b1120',
              color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Novo modelo</button>
        )}
      </div>

      {!modelos.length ? (
        <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>
          Ainda não há modelos. Cria o primeiro, ou envia um .docx que já tenhas.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {porCategoria.map(c => (
            <section key={c.id}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 8,
              }}>{c.rotulo}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {c.modelos.map(m => {
                  const usa = marcasDe(m.corpo)
                  const erradas = marcasDesconhecidas(m.corpo)
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px',
                      border: '1px solid var(--border)', borderRadius: 10, background: 'white',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{m.nome}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2 }}>
                          {m.descricao || `${usa.length} ${usa.length === 1 ? 'campo' : 'campos'}`}
                          {/* Uma marca errada num modelo é um espaço em branco
                              num documento assinado. Vê-se aqui, na lista. */}
                          {!!erradas.length && (
                            <span style={{ color: '#dc2626', fontWeight: 600 }}>
                              {' · '}{erradas.length} {erradas.length === 1 ? 'campo que não existe' : 'campos que não existem'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setAPreencher(m)} style={botao(cor, true)}>
                        Preencher para…
                      </button>
                      {podeEditar && (
                        <button onClick={() => setAEditar(m)} style={botao('#64748b')}>Editar</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {aEditar && (
        <Editor modelo={aEditar} cor={cor}
          onFechar={() => setAEditar(null)}
          onGravado={() => { setAEditar(null); carregar() }} />
      )}
      {aPreencher && (
        <Preenchedor modelo={aPreencher} pessoas={pessoas} casa={casa} cor={cor}
          onFechar={() => setAPreencher(null)} />
      )}
    </div>
  )
}

const botao = (c: string, cheio = false): React.CSSProperties => ({
  padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
  border: `1px solid ${cheio ? c : 'var(--border-2)'}`,
  background: cheio ? c : 'white', color: cheio ? 'white' : c,
})

const caixa: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 13.5, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
}

function Moldura({ titulo, largo, onFechar, children }: {
  titulo: string; largo?: boolean; onFechar: () => void; children: React.ReactNode
}) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onFechar() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,17,32,.45)', zIndex: CAMADA.fundoModal,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '5vh 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: 'white', borderRadius: 15, width: '100%', maxWidth: largo ? 860 : 620,
        padding: 22, boxShadow: '0 22px 60px rgba(11,17,32,.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 21,
            color: 'var(--ink-5)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Escrever ou enviar um modelo
   ═══════════════════════════════════════════════════════════════════════════ */
function Editor({ modelo, cor, onFechar, onGravado }: {
  modelo: Modelo; cor: string; onFechar: () => void; onGravado: () => void
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const [f, setF] = useState({
    nome: modelo.nome, categoria: modelo.categoria,
    descricao: modelo.descricao || '', corpo: modelo.corpo,
  })
  const [aGravar, setAGravar] = useState(false)
  const [aLer, setALer] = useState(false)
  const [procura, setProcura] = useState('')

  const todos = useMemo(() => campos(), [])
  const erradas = marcasDesconhecidas(f.corpo)
  const usadas = marcasDe(f.corpo)

  const visiveis = useMemo(() => {
    const q = procura.trim().toLowerCase()
    return todos.filter(c => !q || c.rotulo.toLowerCase().includes(q) || c.id.includes(q))
  }, [todos, procura])

  /** Enviar um .docx: o texto entra na caixa para a pessoa marcar os campos. */
  async function enviar(ficheiro: File) {
    setALer(true)
    try {
      const texto = await lerModelo(ficheiro)
      setF(x => ({
        ...x,
        corpo: texto,
        nome: x.nome || ficheiro.name.replace(/\.[^.]+$/, ''),
      }))
      toast.success('Texto lido',
        'Agora troca os sítios a preencher pelos campos da lista ao lado.')
    } catch (e) {
      // Uma frase que diz o que fazer. Nunca meio texto como se fosse o texto
      // todo: um modelo truncado só se descobre quando sai da impressora.
      toast.error('Não consegui ler esse ficheiro',
        e instanceof DocxIlegivel ? e.message : 'Cole o texto do documento.')
    } finally { setALer(false) }
  }

  function inserir(id: string) {
    setF(x => ({ ...x, corpo: `${x.corpo}{{${id}}}` }))
  }

  async function gravar() {
    if (!f.nome.trim() || !f.corpo.trim()) return
    setAGravar(true)
    try {
      const linha = {
        nome: f.nome.trim(), categoria: f.categoria,
        descricao: f.descricao.trim() || null, corpo: f.corpo,
        updated_at: new Date().toISOString(),
      }
      const { error } = modelo.id
        ? await supabase.from('modelos_documentos').update(linha).eq('id', modelo.id)
        : await supabase.from('modelos_documentos').insert(scope.stamp({
            ...linha, user_id: user.id, criado_por: user.email || null,
          }))
      if (error) {
        toast.error('Não foi possível gravar',
          reportError('modelos-gravar', error, 'O que escreveste não se perdeu.'))
        return
      }
      onGravado()
    } finally { setAGravar(false) }
  }

  return (
    <Moldura titulo={modelo.id ? `Modelo: ${modelo.nome}` : 'Novo modelo'} largo onFechar={onFechar}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <Rotulo>Nome</Rotulo>
          <input value={f.nome} onChange={e => setF(x => ({ ...x, nome: e.target.value }))}
            placeholder="Ficha de inscrição" style={caixa} autoFocus />
        </div>
        <div>
          <Rotulo>Categoria</Rotulo>
          <select value={f.categoria} onChange={e => setF(x => ({ ...x, categoria: e.target.value }))}
            style={caixa}>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Rotulo>Para que serve</Rotulo>
        <input value={f.descricao} onChange={e => setF(x => ({ ...x, descricao: e.target.value }))}
          placeholder="Os dados de quem se inscreve, para assinar e arquivar." style={caixa} />
      </div>

      <div className="mod-grelha" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <Rotulo>O documento</Rotulo>
            <div style={{ flex: 1 }} />
            <label style={{
              fontSize: 11.5, fontWeight: 700, color: cor, cursor: aLer ? 'wait' : 'pointer',
            }}>
              {aLer ? 'a ler…' : 'enviar .docx ou .txt'}
              <input type="file" accept=".docx,.txt,.md" style={{ display: 'none' }}
                onChange={e => { const x = e.target.files?.[0]; if (x) enviar(x); e.target.value = '' }} />
            </label>
          </div>
          <textarea value={f.corpo} onChange={e => setF(x => ({ ...x, corpo: e.target.value }))}
            rows={18} spellCheck={false}
            placeholder={'DECLARAÇÃO\n\nEu, {{nome}}, NIF {{nif}}, declaro…\n\n{{casa.cidade}}, {{hoje}}'}
            style={{
              ...caixa, resize: 'vertical', fontFamily: 'var(--font-mono)',
              fontSize: 12.5, lineHeight: 1.65,
            }} />

          {!!erradas.length && (
            <p style={{ margin: '7px 0 0', fontSize: 12, color: '#dc2626', lineHeight: 1.55 }}>
              Estes campos não existem: <strong>{erradas.map(x => `{{${x}}}`).join(', ')}</strong>.
              Vão sair no documento tal como estão escritos.
            </p>
          )}
          {!erradas.length && !!usadas.length && (
            <p style={{ margin: '7px 0 0', fontSize: 11.5, color: 'var(--ink-4)' }}>
              {usadas.length} {usadas.length === 1 ? 'campo' : 'campos'} a preencher.
            </p>
          )}
        </div>

        {/* A paleta. Clicar acrescenta no fim — mais simples do que tentar
            adivinhar onde está o cursor, e é o que se quer 90% das vezes. */}
        <div>
          <Rotulo>Campos</Rotulo>
          <input value={procura} onChange={e => setProcura(e.target.value)}
            placeholder="procurar…" style={{ ...caixa, marginBottom: 7, fontSize: 12.5 }} />
          <div style={{
            maxHeight: 330, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3,
            border: '1px solid var(--border)', borderRadius: 8, padding: 6,
          }}>
            {visiveis.map(c => (
              <button key={c.id} onClick={() => inserir(c.id)} title={c.rotulo}
                style={{
                  textAlign: 'left', padding: '5px 7px', borderRadius: 6, cursor: 'pointer',
                  border: 'none', background: f.corpo.includes(`{{${c.id}}}`) ? `${cor}14` : 'transparent',
                  fontFamily: 'inherit', fontSize: 11.5, color: 'var(--ink-3)',
                }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: cor }}>
                  {`{{${c.id}}}`}
                </span>
                <span style={{ display: 'block', color: 'var(--ink-5)', fontSize: 10.5 }}>
                  {c.rotulo}
                </span>
              </button>
            ))}
            {!visiveis.length && (
              <p style={{ margin: 6, fontSize: 11.5, color: 'var(--ink-5)' }}>Nenhum campo com esse nome.</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={gravar} disabled={!f.nome.trim() || !f.corpo.trim() || aGravar}
          style={{
            flex: 1, background: cor, color: 'white', border: 'none', borderRadius: 9, padding: 12,
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            cursor: f.nome.trim() && f.corpo.trim() ? 'pointer' : 'not-allowed',
            opacity: f.nome.trim() && f.corpo.trim() ? 1 : 0.5,
          }}>{aGravar ? 'A gravar…' : 'Guardar modelo'}</button>
        <button onClick={onFechar} style={{
          padding: '12px 16px', background: 'white', border: '1px solid var(--border)',
          borderRadius: 9, fontSize: 14, cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'inherit',
        }}>Cancelar</button>
      </div>

      <style>{`
        @media (max-width: 720px) { .mod-grelha { grid-template-columns: 1fr !important; } }
      `}</style>
    </Moldura>
  )
}

const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <label style={{
    display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 4,
  }}>{children}</label>
)

/* ═══════════════════════════════════════════════════════════════════════════
   Preencher para uma pessoa
   ═══════════════════════════════════════════════════════════════════════════ */
function Preenchedor({ modelo, pessoas, casa, cor, onFechar }: {
  modelo: Modelo; pessoas: Pessoa[]; casa: Casa; cor: string; onFechar: () => void
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const [quemId, setQuemId] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const hoje = useMemo(() => ptDate(), [])

  const quem = pessoas.find(p => p.id === quemId) || null

  const feito: Preenchido | null = useMemo(() => {
    if (!quem) return null
    // A ficha pelos IDs de lib/inscricao, e não as colunas cruas: é o mesmo
    // vocabulário que o formulário usa, por isso um modelo nunca precisa de
    // saber como se chama a coluna.
    return preencher(modelo.corpo, paraFicha(quem, 'utente'), casa, hoje)
  }, [quem, modelo.corpo, casa, hoje])

  async function emitir() {
    if (!quem || !feito) return
    setAGuardar(true)
    try {
      // Grava-se ANTES de imprimir: o registo é do que se emitiu, e a
      // impressão pode falhar (pop-ups bloqueados) sem que isso signifique
      // que o documento não foi feito.
      const { error } = await supabase.from('documentos_emitidos').insert(scope.stamp({
        user_id: user.id, modelo_id: modelo.id, modelo_nome: modelo.nome,
        patient_id: quem.id, nome_pessoa: quem.name,
        corpo_final: feito.texto,
        em_falta: feito.emFalta.length ? feito.emFalta.map(x => x.id) : null,
        emitido_por: user.email || null,
      }))
      if (error) {
        toast.error('Não foi possível registar o documento',
          reportError('modelos-emitir', error, 'Não imprimi, para não haver um documento sem registo.'))
        return
      }
      printDoc({
        docTitle: modelo.nome,
        docSubtitle: quem.name,
        institution: casa.nome || undefined,
        corpo: feito.texto,
        sections: [],
        footerNote: `Emitido por ${user.email || 'equipa'}`,
      })
      onFechar()
    } finally { setAGuardar(false) }
  }

  return (
    <Moldura titulo={modelo.nome} largo onFechar={onFechar}>
      <div style={{ marginBottom: 14 }}>
        <Rotulo>Para quem</Rotulo>
        <select value={quemId} onChange={e => setQuemId(e.target.value)} style={caixa} autoFocus>
          <option value="">Escolher…</option>
          {pessoas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!quem ? (
        <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>
          Escolhe a pessoa e o documento aparece preenchido aqui.
        </p>
      ) : (
        <>
          {/* O que falta, ANTES do documento e antes do botão. Um contrato com
              o NIF em branco assinado por duas pessoas de boa fé só se
              descobre quando a Segurança Social o devolve. */}
          {!!feito?.emFalta.length && (
            <div style={{
              padding: '11px 14px', borderRadius: 10, background: '#fffbeb',
              border: '1px solid #fde68a', marginBottom: 12,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                A ficha de {quem.name.split(' ')[0]} não tem{' '}
                {feito.emFalta.length === 1 ? 'este campo' : `estes ${feito.emFalta.length} campos`}:
              </div>
              <div style={{ fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                {feito.emFalta.map(x => x.rotulo.replace(/\s*\(.*\)$/, '').toLowerCase()).join(' · ')}
              </div>
              <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 6, opacity: 0.85 }}>
                Vão sair como linhas a preencher à mão. Podes fechar isto, completar a
                ficha e voltar.
              </div>
            </div>
          )}
          {!!feito?.desconhecidas.length && (
            <div style={{
              padding: '11px 14px', borderRadius: 10, background: '#fef2f2',
              border: '1px solid #fecaca', marginBottom: 12, fontSize: 12.5,
              color: '#991b1b', lineHeight: 1.6,
            }}>
              O modelo tem campos que não existem
              ({feito.desconhecidas.map(x => `{{${x}}}`).join(', ')}) e vão sair no
              documento tal como estão escritos. Corrige o modelo primeiro.
            </div>
          )}

          <Rotulo>Como vai sair</Rotulo>
          <div style={{
            border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px',
            background: '#fdfdfc', maxHeight: '42vh', overflowY: 'auto',
            fontFamily: 'Georgia, serif', fontSize: 13.5, lineHeight: 1.75,
            whiteSpace: 'pre-wrap', color: 'var(--ink)',
          }}>{feito?.texto}</div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
            <button onClick={emitir} disabled={aGuardar}
              style={{
                flex: 1, background: cor, color: 'white', border: 'none', borderRadius: 9,
                padding: 12, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                cursor: aGuardar ? 'wait' : 'pointer',
              }}>
              {aGuardar ? 'A registar…' : 'Emitir e imprimir'}
            </button>
            <button onClick={onFechar} style={{
              padding: '12px 16px', background: 'white', border: '1px solid var(--border)',
              borderRadius: 9, fontSize: 14, cursor: 'pointer', color: 'var(--ink-3)',
              fontFamily: 'inherit',
            }}>Fechar</button>
          </div>
          {feito && !estaPronto(feito) && (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.55 }}>
              Podes emitir assim mesmo — fica registado que saiu incompleto, e o que
              faltava.
            </p>
          )}
        </>
      )}
    </Moldura>
  )
}
