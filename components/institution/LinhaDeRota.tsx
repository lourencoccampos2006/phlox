'use client'

// components/institution/LinhaDeRota.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A rota do dia desenhada como uma LINHA — no espírito de um diagrama de metro,
// não de um mapa de ruas.
//
// A escolha é deliberada e explicada em lib/rotaTransporte.ts: não temos
// coordenadas de ninguém, só moradas em texto. Um mapa geográfico obrigaria a
// inventar posições. Uma linha mostra o que sabemos mesmo — a ordem, as horas,
// os intervalos e as zonas — e é o que quem conduz precisa de ver: o motorista
// conhece as ruas, o que lhe falta é o relógio e a sequência.
//
// A escala é REAL: a distância entre duas paragens no desenho é proporcional
// aos minutos entre elas. Um intervalo grande vê-se como um vão grande. Isso
// transforma o diagrama num gráfico de tempo — dá para ver de relance onde o
// dia aperta e onde há folga, que uma lista nunca mostra.
//
// Tocar numa paragem marca-a como feita. É a mesma marcação de sempre, mas
// dentro de uma coisa que já vale por si mesma antes de se tocar em nada.
// ─────────────────────────────────────────────────────────────────────────────

import { iniciais, corDaPessoa } from '@/lib/presenca'
import type { Rota, Paragem } from '@/lib/rotaTransporte'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-5)',
}

// Altura de uma paragem, e quanto cresce por minuto de intervalo. Os limites
// impedem que uma hora de folga faça uma página de dois metros, e que duas
// paragens ao mesmo minuto fiquem em cima uma da outra.
const BASE = 66
const POR_MINUTO = 1.5
const VAO_MAX = 130

function vao(intervalo: number | null): number {
  if (intervalo == null) return 18
  return Math.max(10, Math.min(VAO_MAX, Math.round(intervalo * POR_MINUTO)))
}

export default function LinhaDeRota({ rota, cor, marcar, aGuardar, podeEditar }: {
  rota: Rota
  cor: string
  marcar: (scheduleId: string) => void
  aGuardar: Set<string>
  podeEditar: boolean
}) {
  if (!rota.paragens.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55, padding: '16px 0 4px', textWrap: 'pretty' as any }}>
        Não há transportes marcados para hoje. Cria um horário recorrente numa pessoa e a rota aparece aqui.
      </div>
    )
  }

  return (
    <div>
      {/* Cabeçalho da rota — o resumo que se lê antes de sair */}
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 18 }}>
        <Numero valor={String(rota.paragens.length)} etiqueta={rota.paragens.length === 1 ? 'paragem' : 'paragens'} />
        {rota.primeira && <Numero valor={`${rota.primeira}–${rota.ultima}`} etiqueta="janela" mono />}
        {rota.duracaoMin != null && rota.duracaoMin > 0 && (
          <Numero valor={rota.duracaoMin >= 60 ? `${Math.floor(rota.duracaoMin / 60)}h${String(rota.duracaoMin % 60).padStart(2, '0')}` : `${rota.duracaoMin} min`} etiqueta="de ponta a ponta" />
        )}
        <Numero valor={`${rota.feitas}/${rota.paragens.length}`} etiqueta="já feitas" cor={rota.feitas === rota.paragens.length ? cor : undefined} />
      </div>

      {/* A linha */}
      <div style={{ position: 'relative', paddingLeft: 2 }}>
        {rota.paragens.map((p, i) => (
          <Paragem2
            key={p.scheduleId}
            p={p}
            primeira={i === 0}
            ultima={i === rota.paragens.length - 1}
            cor={cor}
            guardando={aGuardar.has(p.scheduleId)}
            podeEditar={podeEditar}
            marcar={marcar}
          />
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 16, lineHeight: 1.5, textWrap: 'pretty' as any }}>
        O espaço entre paragens é o tempo entre elas — um vão grande é uma folga grande.
        As zonas vêm do código postal da morada, não de mapa nenhum.
        {rota.semHora > 0 && ` ${rota.semHora} ${rota.semHora === 1 ? 'transporte está' : 'transportes estão'} sem hora e ${rota.semHora === 1 ? 'ficou' : 'ficaram'} no fim.`}
      </div>
    </div>
  )
}

function Numero({ valor, etiqueta, cor, mono }: { valor: string; etiqueta: string; cor?: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-serif)',
        fontSize: mono ? 19 : 24, fontWeight: mono ? 500 : 400,
        lineHeight: 1, color: cor || 'var(--ink)', letterSpacing: '-0.01em',
      }}>{valor}</div>
      <div style={{ ...MONO, marginTop: 6 }}>{etiqueta}</div>
    </div>
  )
}

function Paragem2({ p, primeira, ultima, cor, guardando, podeEditar, marcar }: {
  p: Paragem; primeira: boolean; ultima: boolean; cor: string
  guardando: boolean; podeEditar: boolean; marcar: (id: string) => void
}) {
  const altura = BASE + (primeira ? 0 : vao(p.intervalo))
  const topoNo = primeira ? 10 : vao(p.intervalo) + 10

  return (
    <div style={{ position: 'relative', minHeight: altura, paddingLeft: 96 }}>
      {/* Mudança de zona: uma régua fina com a etiqueta, como a mudança de
          linha num diagrama de metro. */}
      {p.abreZona && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: Math.max(0, topoNo - 26),
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ ...MONO, fontSize: 9, whiteSpace: 'nowrap', flexShrink: 0 }}>{p.zona}</span>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
      )}

      {/* O troço da linha até esta paragem */}
      {!primeira && (
        <span style={{
          position: 'absolute', left: 71, top: 0, width: 2, height: topoNo,
          background: p.feito ? cor : 'var(--bg-4)',
        }} />
      )}
      {/* E o troço que segue */}
      {!ultima && (
        <span style={{
          position: 'absolute', left: 71, top: topoNo + 14, bottom: 0, width: 2,
          background: 'var(--bg-4)',
        }} />
      )}

      {/* A hora, à esquerda da linha */}
      <span style={{
        position: 'absolute', left: 0, top: topoNo - 4, width: 58, textAlign: 'right',
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
        color: p.feito ? 'var(--ink-4)' : 'var(--ink)',
      }}>{p.hora || '—'}</span>
      {p.intervalo != null && p.intervalo > 0 && (
        <span style={{
          position: 'absolute', left: 0, top: topoNo - vao(p.intervalo) / 2 - 4, width: 58,
          textAlign: 'right', ...MONO, fontSize: 9, letterSpacing: '0.08em',
        }}>{p.intervalo}′</span>
      )}

      {/* O nó */}
      <button
        onClick={() => podeEditar && !guardando && marcar(p.scheduleId)}
        disabled={!podeEditar || guardando}
        aria-label={`${p.nome}${p.hora ? ` às ${p.hora}` : ''} — ${p.feito ? 'feito, tocar para desmarcar' : 'tocar para marcar como feito'}`}
        style={{
          position: 'absolute', left: 64, top: topoNo, width: 16, height: 16, padding: 0,
          borderRadius: '50%', border: `2px solid ${p.feito ? cor : 'var(--ink-4)'}`,
          background: p.feito ? cor : 'var(--bg)',
          cursor: podeEditar && !guardando ? 'pointer' : 'default',
          opacity: guardando ? 0.4 : 1, zIndex: 1,
        }} />

      {/* A pessoa */}
      <div style={{ paddingTop: topoNo - 12, display: 'flex', alignItems: 'flex-start', gap: 11, minWidth: 0 }}>
        <span style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: '50%', marginTop: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: corDaPessoa(p.patientId), color: 'white',
          fontSize: 12, fontWeight: 700, opacity: p.feito ? 0.45 : 1,
        }}>{iniciais(p.nome)}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 14.5, fontWeight: 600, lineHeight: 1.25,
            color: p.feito ? 'var(--ink-4)' : 'var(--ink)',
            textDecoration: p.feito ? 'line-through' : 'none',
          }}>{p.nome}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 2, lineHeight: 1.4 }}>
            {p.morada || 'Sem morada registada'}
          </span>
          <span style={{ ...MONO, display: 'block', marginTop: 4, fontSize: 9 }}>{p.label}</span>
        </span>
      </div>
    </div>
  )
}
