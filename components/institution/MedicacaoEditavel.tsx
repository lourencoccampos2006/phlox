'use client'

// components/institution/MedicacaoEditavel.tsx
// ═══════════════════════════════════════════════════════════════════════════
// MUDAR UMA DOSE SEM ABRIR UM FORMULÁRIO
// ═══════════════════════════════════════════════════════════════════════════
//
// Uma dose muda. O médico corta a varfarina de 5 para 2,5; a furosemida passa
// de manhã para a manhã e a tarde; um medicamento que se tomava em casa passa
// a dar-se aqui. Nenhuma dessas coisas é rara — são o dia a dia de uma casa.
//
// Até aqui, qualquer uma obrigava a abrir o formulário completo do
// medicamento, com nome, dose, via, indicação, horários, turnos, SOS, máximo
// por dia, intervalo mínimo e notas. Quinze campos para mudar um número.
//
// ── PORQUE É QUE SE MOSTRA O QUE MUDA, E NÃO SÓ O NOVO VALOR ───────────────
// Numa ficha de medicação, uma alteração silenciosa é a pior espécie de
// alteração. Quem muda uma dose vê, antes de gravar, a frase do que vai
// mudar — «5 mg → 2,5 mg» — e o livro de registos guarda as duas.
//
// ── O QUE NÃO SE MUDA AQUI ─────────────────────────────────────────────────
// O NOME. Mudar o nome de um medicamento não é uma correção de passagem: é
// trocar um medicamento por outro, e isso faz-se parando um e acrescentando o
// seguinte, para o histórico ficar com os dois. Quem precisa disso tem o
// formulário completo, que continua onde estava.

import { useState } from 'react'
import { Botao, Campo, CAIXA, MONO, ROTULO } from '@/components/ui/mesa'

const TURNOS: { id: string; rotulo: string }[] = [
  { id: 'manha', rotulo: 'Manhã' },
  { id: 'tarde', rotulo: 'Tarde' },
  { id: 'noite', rotulo: 'Noite' },
]

const ONDE: { id: string; rotulo: string; oQue: string }[] = [
  { id: 'centro', rotulo: 'Aqui', oQue: 'A casa dá esta medicação.' },
  { id: 'casa', rotulo: 'Em casa', oQue: 'A família dá — não entra na volta da medicação.' },
  { id: 'ambos', rotulo: 'Nos dois', oQue: 'Parte aqui, parte em casa.' },
]

export interface MedParaEditar {
  id: string
  name: string
  dose?: string | null
  frequency?: string | null
  shifts?: string[] | null
  take_location?: string | null
  indication?: string | null
}

export default function MedicacaoEditavel({ med, aoFechar, aoGuardar }: {
  med: MedParaEditar
  aoFechar: () => void
  /** Devolve a mensagem de erro, ou null se gravou. */
  aoGuardar: (mudancas: Record<string, any>, emPalavras: string) => Promise<string | null>
}) {
  const [dose, setDose] = useState(med.dose || '')
  const [frequency, setFrequency] = useState(med.frequency || '')
  const [shifts, setShifts] = useState<string[]>(Array.isArray(med.shifts) ? med.shifts : [])
  const [onde, setOnde] = useState(med.take_location || 'centro')
  const [indication, setIndication] = useState(med.indication || '')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  const alternarTurno = (id: string) =>
    setShifts(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id])

  /* O que muda, em palavras. É o que se mostra antes de gravar e o que vai
     para o livro — uma lista de pares «antes → depois» é ilegível seis meses
     depois; uma frase não é. */
  const mudancas: { campo: string; de: string; para: string; valor: any; chave: string }[] = []
  const comparar = (chave: string, campo: string, antes: any, agora: any) => {
    const a = antes == null ? '' : String(antes)
    const b = agora == null ? '' : String(agora)
    if (a.trim() === b.trim()) return
    mudancas.push({ chave, campo, de: a.trim() || '—', para: b.trim() || '—', valor: b.trim() || null })
  }
  comparar('dose', 'a dose', med.dose, dose)
  comparar('frequency', 'o horário', med.frequency, frequency)
  comparar('indication', 'a indicação', med.indication, indication)

  const turnosAntes = (Array.isArray(med.shifts) ? med.shifts : []).slice().sort().join(',')
  const turnosAgora = shifts.slice().sort().join(',')
  if (turnosAntes !== turnosAgora) {
    const nomes = (l: string[]) => l.length
      ? l.map(x => TURNOS.find(t => t.id === x)?.rotulo || x).join(' · ')
      : 'sem turno'
    mudancas.push({
      chave: 'shifts', campo: 'os turnos',
      de: nomes(Array.isArray(med.shifts) ? med.shifts : []), para: nomes(shifts),
      valor: shifts,
    })
  }

  if ((med.take_location || 'centro') !== onde) {
    const nome = (x: string) => ONDE.find(o => o.id === x)?.rotulo || x
    mudancas.push({
      chave: 'take_location', campo: 'onde se toma',
      de: nome(med.take_location || 'centro'), para: nome(onde), valor: onde,
    })
  }

  async function guardar() {
    if (!mudancas.length) { aoFechar(); return }
    setAGravar(true); setErro('')
    const patch: Record<string, any> = {}
    for (const m of mudancas) patch[m.chave] = m.valor
    const frase = mudancas.map(m => `${m.campo}: ${m.de} → ${m.para}`).join('; ')
    const e = await aoGuardar(patch, frase)
    setAGravar(false)
    if (e) { setErro(e); return }
    aoFechar()
  }

  return (
    <div style={{
      padding: 'var(--space-7)', background: 'var(--bg-2)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      marginTop: 'var(--space-5)',
    }}>
      <div style={{ ...ROTULO, color: 'var(--ink-3)' }}>{med.name}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        <Campo rotulo="Dose" para={`me-dose-${med.id}`}>
          <input id={`me-dose-${med.id}`} value={dose} autoFocus
            onChange={e => setDose(e.target.value)}
            placeholder="Ex.: 2,5 mg" style={CAIXA} />
        </Campo>
        <Campo rotulo="Horário" para={`me-freq-${med.id}`}>
          <input id={`me-freq-${med.id}`} value={frequency}
            onChange={e => setFrequency(e.target.value)}
            placeholder="Ex.: 1x/dia, ao pequeno-almoço" style={CAIXA} />
        </Campo>
      </div>

      <Campo rotulo="Turnos">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}>
          {TURNOS.map(t => {
            const on = shifts.includes(t.id)
            return (
              <button key={t.id} type="button" onClick={() => alternarTurno(t.id)}
                aria-pressed={on} className="mesa-botao"
                style={{
                  padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit',
                  borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)',
                  background: on ? 'var(--green)' : 'transparent',
                  color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                  border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                  fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                }}>{t.rotulo}</button>
            )
          })}
        </div>
      </Campo>

      {/* Num centro de dia isto decide quem dá o comprimido, e por isso cada
          opção diz o que significa em vez de só se nomear. */}
      <Campo rotulo="Onde se toma" ajuda={ONDE.find(o => o.id === onde)?.oQue}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}>
          {ONDE.map(o => {
            const on = onde === o.id
            return (
              <button key={o.id} type="button" onClick={() => setOnde(o.id)}
                aria-pressed={on} className="mesa-botao"
                style={{
                  padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit',
                  borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)',
                  background: on ? 'var(--ink)' : 'transparent',
                  color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                  border: `1px solid ${on ? 'var(--ink)' : 'var(--border-2)'}`,
                }}>{o.rotulo}</button>
            )
          })}
        </div>
      </Campo>

      <Campo rotulo="Para quê" para={`me-ind-${med.id}`}>
        <input id={`me-ind-${med.id}`} value={indication}
          onChange={e => setIndication(e.target.value)}
          placeholder="A razão por que esta pessoa o toma." style={CAIXA} />
      </Campo>

      {/* O QUE VAI MUDAR, ANTES DE GRAVAR.
          Numa ficha de medicação, uma alteração silenciosa é a pior espécie de
          alteração — e é fácil escrever «2,5» na caixa errada. */}
      {mudancas.length > 0 && (
        <div style={{
          marginTop: 'var(--space-6)', padding: 'var(--space-5)',
          background: 'var(--bg)', borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-2)',
        }}>
          {mudancas.map(m => (
            <div key={m.chave} style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', lineHeight: 1.6 }}>
              <span style={{ ...MONO, color: 'var(--ink-4)' }}>{m.campo}</span>{' '}
              <span style={{ color: 'var(--ink-5)' }}>{m.de}</span>
              {' → '}
              <span style={{ fontWeight: 'var(--peso-forte)' as any }}>{m.para}</span>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginTop: 'var(--space-4)' }}>{erro}</div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
        <Botao feitio="principal" onClick={guardar} esperando={aGravar} disabled={!mudancas.length}>
          {mudancas.length ? 'GUARDAR' : 'SEM ALTERAÇÕES'}
        </Botao>
        <Botao onClick={aoFechar}>CANCELAR</Botao>
      </div>
    </div>
  )
}
