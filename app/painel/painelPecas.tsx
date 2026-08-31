'use client'

// app/painel/painelPecas.tsx
// ─────────────────────────────────────────────────────────────────────────────
// As peças visuais do painel, copiadas de docs/designs/Painel Phlox.html.
//
// Medidas, espaçamentos, tamanhos de letra e grelhas são os do desenho — não
// aproximações. Onde o desenho usa um valor que existe como token do produto
// (var(--ink-4) para #767b86, var(--border) para #e7e8ea…) usa-se o token; onde
// não existe, fica o valor literal do desenho.
//
// A única coisa que muda em relação ao HTML é o verde: no desenho está fixo em
// #0d6e42, aqui é a cor de acento do tipo de instituição (teal no centro de
// dia, âmbar no lar). É a mesma peça, pintada pela casa.
//
// Todas as peças aceitam `vazio`: quando não há dados, a moldura do cartão
// mantém-se e o corpo diz o que falta. Nenhuma peça inventa uma forma para
// preencher o espaço — um gráfico bonito sobre dados que não existem é pior do
// que uma frase a dizer que ainda não há nada.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import Icon from '@/components/Icon'

/* ── Tipos das peças (o painel monta-os em painelAbas.ts) ─────────────────── */

export type Kpi = {
  etiqueta: string
  valor: string | number
  de?: string
  nota: string
  serie: number[]        // até 10 pontos; vazio = sem faísca
  alerta?: boolean
}

export type DadosLinha = {
  titulo: string
  valor: string
  delta: string | null
  deltaBom: boolean
  a: number[]
  b: number[] | null
  etiquetas: string[]
  legendaA: string
  legendaB: string | null
  vazio?: string
}

export type DadosBarras = {
  titulo: string
  itens: { rotulo: string; valor: number; teto: number; texto?: string }[]
  rodape: string
  /** Qual das barras leva a cor da casa. Sem isto era sempre a última, o que
   *  não quer dizer nada quando as barras são categorias (manhã/tarde/noite):
   *  a noite não é mais importante do que a manhã. Cada aba diz qual é a que
   *  interessa — a hora de agora, o mês corrente, o pico da semana. */
  destaque?: number
  vazio?: string
}

export type DadosRosca = {
  titulo: string
  grande: string
  unidade: string
  a: number
  b: number
  total: number
  legenda: { rotulo: string; valor: string; cor: string }[]
  vazio?: string
}

export type LinhaTabela = {
  id: string
  href?: string
  a: string
  b: string
  barra: number | null    // 0–100; null esconde a barra
  c: string
  etiqueta: string
  destaque: boolean       // pinta ponto + etiqueta a tinta forte
}

export type DadosTabela = {
  titulo: string
  rodape: string
  cols: string
  cabecalho: string[]
  linhas: LinhaTabela[]
  vazio?: string
}

export type ItemLista = {
  id: string
  icone: string
  titulo: string
  sub: string
  cta: string
  href: string
}

export type DadosLista = {
  titulo: string
  contagem: string
  itens: ItemLista[]
  vazio?: string
}

/* ── Constantes do desenho ────────────────────────────────────────────────── */

const CINZA_LINHA = '#c8ccd2'   // a segunda linha do gráfico (comparação)
const CINZA_MEIO = '#8e939c'    // o segundo arco da rosca
const RISCA = '#f2f3f4'         // separadores internos, mais leves que --border

const MONO_ETIQUETA: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-4)',
}
const MONO_MINI: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 500,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-5)',
}

/* ── Moldura ─────────────────────────────────────────────────────────────── */

export function Cartao({ span, padding, children, className }: {
  span: number; padding: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`pn-cel pn-s${span}${className ? ' ' + className : ''}`} style={{
      gridColumn: `span ${span}`, background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding, minWidth: 0,
    }}>{children}</div>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55, padding: '18px 0 6px', textWrap: 'pretty' as any }}>
      {children}
    </div>
  )
}

/* ── A faixa dos cinco números ────────────────────────────────────────────── */

function Faisca({ serie, cor }: { serie: number[]; cor: string }) {
  if (serie.length < 2) return null
  const max = Math.max(...serie) || 1
  return (
    <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }} aria-hidden>
      {serie.map((v, i) => (
        <span key={i} style={{
          width: 3, borderRadius: 1,
          background: i >= serie.length - 2 ? cor : 'var(--bg-4)',
          height: Math.max(2, Math.round((v / max) * 14)),
        }} />
      ))}
    </span>
  )
}

export function FaixaKpi({ kpis, cor }: { kpis: Kpi[]; cor: string }) {
  return (
    <div className="pn-kpis" style={{
      display: 'grid', gridTemplateColumns: `repeat(${kpis.length},minmax(0,1fr))`,
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden',
    }}>
      {kpis.map((k, i) => (
        <div key={k.etiqueta} style={{
          padding: '16px 20px', minWidth: 0,
          borderLeft: i ? '1px solid var(--bg-3)' : 'none',
        }}>
          <div style={{ ...MONO_ETIQUETA, fontSize: 9.5, letterSpacing: '0.16em' }}>{k.etiqueta}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
            <span style={{
              fontFamily: 'var(--font-serif)', fontSize: 29, fontWeight: 400, lineHeight: 0.9,
              letterSpacing: '-0.02em', color: k.alerta ? '#b91c1c' : 'var(--ink)',
            }}>{k.valor}</span>
            {k.de && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-5)' }}>{k.de}</span>}
          </div>
          <div className="pn-kpi-nota" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, minWidth: 0 }}>
            <Faisca serie={k.serie} cor={cor} />
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.nota}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Gráfico de linha ─────────────────────────────────────────────────────── */

/** Os pontos de uma série no espaço 640×150 do desenho. Igual ao `poly()` do
 *  HTML: normaliza entre o mínimo e o máximo da própria série. */
function pontos(vals: number[], L = 640, A = 150, pad = 12): string {
  if (vals.length < 2) return ''
  const max = Math.max(...vals), min = Math.min(...vals)
  const amplitude = max - min || 1
  return vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * L
    const y = pad + (1 - (v - min) / amplitude) * (A - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

export function CartaoLinha({ dados, cor, corSuave, periodos }: {
  dados: DadosLinha; cor: string; corSuave: string
  periodos?: { id: string; rotulo: string; ativo: boolean; escolher: () => void }[]
}) {
  const pa = pontos(dados.a)
  const pb = dados.b && dados.b.length > 1 ? pontos(dados.b) : ''
  return (
    <Cartao span={7} padding="18px 20px 16px">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={MONO_ETIQUETA}>{dados.titulo}</span>
        {!!periodos?.length && (
          <div style={{ display: 'flex', gap: 2, background: RISCA, borderRadius: 'var(--r)', padding: 2 }}>
            {periodos.map(p => (
              <button key={p.id} onClick={p.escolher} style={{
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9.5,
                letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 10px',
                borderRadius: 'var(--r-flat)', background: p.ativo ? 'var(--bg)' : 'transparent',
                color: p.ativo ? 'var(--ink)' : 'var(--ink-4)', fontWeight: 500,
              }}>{p.rotulo}</button>
            ))}
          </div>
        )}
      </div>

      {dados.vazio ? <Vazio>{dados.vazio}</Vazio> : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 32, lineHeight: 0.9, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{dados.valor}</span>
            {dados.delta && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: dados.deltaBom ? cor : 'var(--ink-4)',
              }}>{dados.delta}</span>
            )}
          </div>

          <div style={{ position: 'relative', marginTop: 16 }}>
            <svg viewBox="0 0 640 150" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 150 }} aria-hidden>
              <line x1="0" y1="12" x2="640" y2="12" stroke={RISCA} strokeWidth="1" />
              <line x1="0" y1="56" x2="640" y2="56" stroke={RISCA} strokeWidth="1" />
              <line x1="0" y1="100" x2="640" y2="100" stroke={RISCA} strokeWidth="1" />
              <line x1="0" y1="144" x2="640" y2="144" stroke="var(--border)" strokeWidth="1" />
              {pa && <polygon points={`${pa} 640,144 0,144`} fill={corSuave} />}
              {pa && <polyline points={pa} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
              {pb && <polyline points={pb} fill="none" stroke={CINZA_LINHA} strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {dados.etiquetas.map((l, i) => <span key={i} style={MONO_MINI}>{l}</span>)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 13, borderTop: `1px solid ${RISCA}`, flexWrap: 'wrap' }}>
            <span style={{ ...MONO_MINI, color: 'var(--ink-4)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 14, height: 2, background: cor }} />{dados.legendaA}
            </span>
            {dados.legendaB && (
              <span style={{ ...MONO_MINI, color: 'var(--ink-4)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 14, height: 2, background: CINZA_LINHA }} />{dados.legendaB}
              </span>
            )}
          </div>
        </>
      )}
    </Cartao>
  )
}

/* ── Gráfico de barras ────────────────────────────────────────────────────── */

export function CartaoBarras({ dados, cor }: { dados: DadosBarras; cor: string }) {
  const teto = Math.max(1, ...dados.itens.map(b => b.teto))
  return (
    <Cartao span={5} padding="18px 20px 16px">
      <div style={MONO_ETIQUETA}>{dados.titulo}</div>
      {dados.vazio ? <Vazio>{dados.vazio}</Vazio> : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, marginTop: 22 }}>
            {dados.itens.map((b, i) => {
              const alvo = i === (dados.destaque ?? dados.itens.length - 1) && b.valor > 0
              return (
              <div key={b.rotulo} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 8, height: '100%', minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: alvo ? 'var(--ink)' : 'var(--ink-5)' }}>
                  {b.texto ?? b.valor}
                </span>
                <div style={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  background: alvo ? cor : b.valor > 0 ? 'var(--bg-4)' : 'var(--bg-3)',
                  height: b.valor > 0 ? Math.max(3, Math.round((b.valor / teto) * 118)) : 2,
                }} />
                <span style={{ ...MONO_MINI, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{b.rotulo}</span>
              </div>
              )
            })}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 14, paddingTop: 13, borderTop: `1px solid ${RISCA}`, lineHeight: 1.5, textWrap: 'pretty' as any }}>
            {dados.rodape}
          </div>
        </>
      )}
    </Cartao>
  )
}

/* ── Rosca ───────────────────────────────────────────────────────────────── */

export function CartaoRosca({ dados, cor }: { dados: DadosRosca; cor: string }) {
  const C = 2 * Math.PI * 44
  const total = dados.total || 1
  const fa = Math.min(1, dados.a / total)
  const fb = Math.min(1, (dados.a + dados.b) / total)
  return (
    <Cartao span={4} padding="18px 20px">
      <div style={MONO_ETIQUETA}>{dados.titulo}</div>
      {dados.vazio ? <Vazio>{dados.vazio}</Vazio> : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
          <span style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
            <svg width={104} height={104} viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }} aria-hidden>
              <circle cx="52" cy="52" r="44" fill="none" stroke={RISCA} strokeWidth="12" />
              <circle cx="52" cy="52" r="44" fill="none" stroke={CINZA_MEIO} strokeWidth="12" strokeLinecap="butt"
                strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - fb)).toFixed(1)} />
              <circle cx="52" cy="52" r="44" fill="none" stroke={cor} strokeWidth="12" strokeLinecap="butt"
                strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - fa)).toFixed(1)} />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{dados.grande}</span>
              <span style={{ ...MONO_MINI, fontSize: 9, letterSpacing: '0.12em', marginTop: 3 }}>{dados.unidade}</span>
            </span>
          </span>
          <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column' }}>
            {dados.legenda.map(d => (
              <div key={d.rotulo} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: `1px solid ${RISCA}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: d.cor, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.rotulo}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{d.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Cartao>
  )
}

/* ── Tabela ──────────────────────────────────────────────────────────────── */

export function CartaoTabela({ dados, cor }: { dados: DadosTabela; cor: string }) {
  return (
    <Cartao span={8} padding="18px 20px 8px">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={MONO_ETIQUETA}>{dados.titulo}</span>
        <span style={MONO_MINI}>{dados.rodape}</span>
      </div>

      {dados.vazio ? <div style={{ paddingBottom: 10 }}><Vazio>{dados.vazio}</Vazio></div> : (
        <>
          <div className="pn-tab" style={{ gridTemplateColumns: dados.cols, display: 'grid', gap: 12, padding: '14px 0 9px', borderBottom: '1px solid var(--border)' }}>
            {dados.cabecalho.map(h => (
              <span key={h} style={{ ...MONO_MINI, fontSize: 9.5, letterSpacing: '0.14em' }}>{h}</span>
            ))}
          </div>
          {dados.linhas.map(r => {
            const conteudo = (
              <>
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: r.destaque ? 'var(--ink)' : CINZA_LINHA }} />
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.a}</span>
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-4)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.b}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  {r.barra != null && (
                    <span style={{ flex: 1, height: 4, borderRadius: 2, background: RISCA, overflow: 'hidden', minWidth: 40 }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, r.barra))}%`, background: r.barra >= 80 ? cor : r.destaque ? 'var(--ink)' : CINZA_MEIO }} />
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink)', flexShrink: 0 }}>{r.c}</span>
                </span>
                <span style={{ ...MONO_MINI, textAlign: 'right', color: r.destaque ? 'var(--ink)' : 'var(--ink-5)' }}>{r.etiqueta}</span>
              </>
            )
            const estilo: React.CSSProperties = {
              gridTemplateColumns: dados.cols, display: 'grid', gap: 12, alignItems: 'center',
              padding: '11px 0', borderBottom: `1px solid ${RISCA}`, textDecoration: 'none', color: 'inherit',
            }
            return r.href
              ? <Link key={r.id} href={r.href} className="pn-tab pn-linha" style={estilo}>{conteudo}</Link>
              : <div key={r.id} className="pn-tab" style={estilo}>{conteudo}</div>
          })}
        </>
      )}
    </Cartao>
  )
}

/* ── Lista ───────────────────────────────────────────────────────────────── */

export function CartaoLista({ dados, span = 4 }: { dados: DadosLista; span?: number }) {
  return (
    <Cartao span={span} padding="18px 20px">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={MONO_ETIQUETA}>{dados.titulo}</span>
        <span style={{ ...MONO_MINI, color: 'var(--ink)' }}>{dados.contagem}</span>
      </div>
      {dados.vazio ? <Vazio>{dados.vazio}</Vazio> : dados.itens.map(li => (
        <div key={li.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 0', borderBottom: `1px solid ${RISCA}` }}>
          <span style={{ flexShrink: 0, marginTop: 2 }}><Icon name={li.icone} size={16} color="var(--ink-3)" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{li.titulo}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 4, lineHeight: 1.45, textWrap: 'pretty' as any }}>{li.sub}</span>
          </span>
          <Link href={li.href} style={{
            flexShrink: 0, minHeight: 44, display: 'inline-flex', alignItems: 'center',
            border: '1px solid var(--border-2)', color: 'var(--ink)', borderRadius: 7,
            padding: '0 12px', fontSize: 11.5, fontWeight: 600, textDecoration: 'none',
          }}>{li.cta}</Link>
        </div>
      ))}
    </Cartao>
  )
}

/* ── Pastas de ferramentas ───────────────────────────────────────────────── */

export type Pasta = {
  id: string
  nome: string
  hint: string
  mini: string[]
  ferramentas: { href: string; label: string; hint: string; icone: string }[]
}

export function CartaoPastas({ pastas, aberta, abrir, fechar, span = 8 }: {
  pastas: Pasta[]; aberta: string | null; abrir: (id: string) => void; fechar: () => void; span?: number
}) {
  const p = pastas.find(f => f.id === aberta) || null
  return (
    <Cartao span={span} padding="18px 20px 16px">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={MONO_ETIQUETA}>Ferramentas · {p ? p.nome : `${pastas.length} pastas`}</span>
        <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>Toca numa pasta para a abrir</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(158px,1fr))', gap: 12, marginTop: 16 }}>
        {pastas.map(f => {
          const activa = aberta === f.id
          return (
            <button key={f.id} onClick={() => (activa ? fechar() : abrir(f.id))} style={{
              display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left',
              background: activa ? 'var(--bg-2)' : 'var(--bg)',
              border: `1px solid ${activa ? 'var(--ink)' : 'var(--bg-3)'}`,
              borderRadius: 'var(--r-xl)', padding: '12px 14px', cursor: 'pointer',
              fontFamily: 'inherit', minHeight: 44, minWidth: 0,
            }}>
              {/* Sempre quatro quadrados, mesmo em pastas com menos ferramentas:
                  senão a grelha 2×2 colapsa e o cartão fica com outra forma. */}
              <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 3, padding: 5, background: RISCA, borderRadius: 'var(--r-lg)', flexShrink: 0 }}>
                {Array.from({ length: 4 }, (_, i) => (
                  <span key={i} style={{ width: 17, height: 17, borderRadius: 5, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {f.mini[i] && <Icon name={f.mini[i]} size={11} color="var(--ink-3)" />}
                  </span>
                ))}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</span>
                <span style={{ ...MONO_MINI, display: 'block', marginTop: 4 }}>
                  {f.ferramentas.length} {f.ferramentas.length === 1 ? 'ferramenta' : 'ferramentas'}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {p && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)' }}>{p.nome}</span>
            <button onClick={fechar} style={{
              minHeight: 44, background: 'none', border: '1px solid var(--border-2)', borderRadius: 7,
              padding: '0 13px', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer',
            }}>Fechar</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 10 }}>
            {p.ferramentas.map(t => (
              <Link key={t.href} href={t.href} className="pn-ferr" style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, border: '1px solid var(--bg-3)',
                borderRadius: 'var(--r-lg)', padding: '12px 13px', textDecoration: 'none',
              }}>
                <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={t.icone} size={15} color="var(--ink-3)" />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t.label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.45, textWrap: 'pretty' as any }}>{t.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Cartao>
  )
}
