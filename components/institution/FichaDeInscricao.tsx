'use client'
// components/institution/FichaDeInscricao.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A ficha, desenhada uma vez.
//
// Lê as secções de `lib/inscricao.ts`. Um campo novo lá aparece aqui e nos
// dois sítios que usam isto — o «Novo utente» em /patients e a inscrição em
// /inscricoes — sem se tocar em nenhum dos dois.
//
// ── DUAS DECISÕES DE DESENHO QUE PARECEM PEQUENAS ──────────────────────────
// 1. As secções pesadas abrem-se com um clique em vez de estarem sempre
//    abertas. Um formulário de 23 campos todos à vista faz a pessoa fechá-lo
//    e escrever tudo nas notas — que é o sítio onde nada se pesquisa.
//
// 2. Nenhum campo é obrigatório a não ser o nome. A alternativa é a inscrição
//    ficar por fazer porque a filha não sabe o NIF de cor. Fica-se com metade
//    da ficha e diz-se o que falta; é melhor do que não se ficar com nada.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { seccoesPara, completude, type Campo } from '@/lib/inscricao'
import { ptDate } from '@/lib/ptTime'

export default function FichaDeInscricao({
  ficha, onChange, onde, accent = '#2563eb', autoFocus = true, rotulos,
}: {
  ficha: Record<string, string>
  onChange: (id: string, valor: string) => void
  onde: 'utente' | 'candidatura'
  accent?: string
  autoFocus?: boolean
  /**
   * Rótulos que mudam com o tipo de casa: `{ sala: cfg.roomLabel }`. Num lar
   * é «Quarto», num centro de dia é «Sala», e escrever qualquer um dos dois
   * aqui dentro estaria errado em metade das instalações.
   */
  rotulos?: Record<string, string>
}) {
  const seccoes = seccoesPara(onde)
  const [abertas, setAbertas] = useState<string[]>(
    seccoes.filter(s => !s.recolhida).map(s => s.id),
  )
  // O tecto das caixas de data. `ptDate` fixa o fuso em Europe/Lisbon, por
  // isso o servidor e o cliente chegam ao mesmo dia e nao ha desencontro de
  // hidratacao — ao contrario de `toISOString`, que em Portugal no verao
  // devolve o dia anterior de madrugada.
  const hoje = ptDate()

  const cheia = completude(
    Object.fromEntries(seccoes.flatMap(s => s.campos).map(c => [c[onde] as string, ficha[c.id] || ''])),
    onde,
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Quanto está feito. Um formulário longo sem isto não tem fim à vista. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 4, background: '#eef2f7', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${cheia}%`, height: '100%', background: accent, transition: 'width .25s' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#94a3b8', lineHeight: 1.1 }}>
          {cheia}%
        </span>
      </div>

      {seccoes.map((s, iS) => {
        const aberta = abertas.includes(s.id)
        return (
          <section key={s.id} style={{
            border: '1px solid #eef2f7', borderRadius: 10, overflow: 'hidden',
            background: aberta ? 'white' : '#fcfdfe',
          }}>
            <button type="button" onClick={() => setAbertas(a =>
              a.includes(s.id) ? a.filter(x => x !== s.id) : [...a, s.id])}
              aria-expanded={aberta}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                padding: '10px 13px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              {/* Desenhada em CSS e não escrita como «▾».
                  A barra herda a Syne, que é uma fonte de display e não tem
                  estes glifos: o browser vai buscá-los a outro sítio e sai um
                  traço que ninguém percebe ser um botão. Foi o mesmo que fez
                  os crachás saírem como manchas brancas. Um triângulo de
                  bordas não depende de fonte nenhuma. */}
              <span aria-hidden style={{
                width: 0, height: 0, flexShrink: 0,
                borderLeft: '4.5px solid transparent',
                borderRight: '4.5px solid transparent',
                borderTop: '5.5px solid #94a3b8',
                transform: aberta ? 'none' : 'rotate(-90deg)',
                transition: 'transform .15s',
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{s.titulo}</span>
              {!aberta && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#cbd5e1', lineHeight: 1.1 }}>
                  {s.campos.filter(c => ficha[c.id]).length}/{s.campos.length}
                </span>
              )}
            </button>

            {aberta && (
              <div style={{ padding: '0 13px 14px' }}>
                {s.porque && (
                  <p style={{ margin: '0 0 11px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                    {s.porque}
                  </p>
                )}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10,
                }}>
                  {s.campos.map((c, iC) => (
                    <CampoDaFicha key={c.id} campo={c} valor={ficha[c.id] || ''}
                      onChange={v => onChange(c.id, v)} accent={accent} hoje={hoje}
                      rotulo={rotulos?.[c.id]}
                      autoFocus={autoFocus && iS === 0 && iC === 0} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )
      })}

      {/* Num telemovel ninguem quer tres caixas lado a lado. Abaixo dos 560px
          cada campo ocupa a linha toda; os curtos continuam a caber dois. */}
      <style>{`
        @media (max-width: 560px) {
          .ficha-campo { grid-column: span 6 !important; }
          .ficha-campo.ficha-l2 { grid-column: span 3 !important; }
        }
      `}</style>
    </div>
  )
}

const base: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13.5, fontFamily: 'inherit', color: '#0b1120', background: 'white',
  boxSizing: 'border-box',
}

function CampoDaFicha({ campo, valor, onChange, accent, hoje, rotulo, autoFocus }: {
  campo: Campo; valor: string; onChange: (v: string) => void
  accent: string; hoje: string; rotulo?: string; autoFocus?: boolean
}) {
  const largura = campo.largura || 3
  return (
    <div className={`ficha-campo ficha-l${largura}`} style={{ gridColumn: `span ${largura}` }}>
      <label style={{
        display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4,
      }}>
        {rotulo || campo.rotulo}{campo.obrigatorio && <span style={{ color: accent }}> *</span>}
      </label>

      {campo.tipo === 'escolha' ? (
        <select value={valor} onChange={e => onChange(e.target.value)}
          style={{ ...base, color: valor ? '#0b1120' : '#94a3b8' }}>
          <option value="">—</option>
          {campo.opcoes!.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      ) : campo.tipo === 'longo' ? (
        <textarea value={valor} onChange={e => onChange(e.target.value)} rows={3}
          style={{ ...base, resize: 'vertical' }} />
      ) : (
        <input value={valor} onChange={e => onChange(e.target.value)}
          autoFocus={autoFocus}
          type={campo.tipo === 'data' ? 'date' : campo.tipo === 'numero' ? 'number'
            : campo.tipo === 'tel' ? 'tel' : 'text'}
          step={campo.tipo === 'numero' ? 'any' : undefined}
          // Só as datas marcadas: uma data de nascimento não está no futuro,
          // mas uma data de entrada pode muito bem estar — marca-se a entrada
          // de alguém para a semana que vem. Vazio até montar, e aí o atributo
          // simplesmente não existe, que é o mesmo que não limitar.
          max={campo.naoFuturo && hoje ? hoje : undefined}
          inputMode={campo.tipo === 'tel' ? 'tel' : campo.tipo === 'numero' ? 'decimal' : undefined}
          style={base} />
      )}

      {campo.dica && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#a3aec0', lineHeight: 1.45 }}>
          {campo.dica}
        </p>
      )}
    </div>
  )
}
