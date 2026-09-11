// lib/rotaTransporte.ts
// ─────────────────────────────────────────────────────────────────────────────
// A rota de transporte do dia, montada a partir dos horários recorrentes.
//
// Devolve a sequência do dia: quem, a que horas, em que ordem, onde.
//
// As coordenadas vêm de app/api/geocode (OpenStreetMap), convertidas UMA vez
// por morada e guardadas na ficha — o mapa em components/institution/
// MapaDaRota.tsx desenha-as. Quem não tem morada localizável fica sem ponto:
// não se aproxima, porque um ponto errado manda a carrinha ao sítio errado.
//
// As zonas saem do código postal (os quatro primeiros dígitos) ou, quando não
// há, da última parte da morada — servem para agrupar em texto, no papel do
// motorista, e são independentes das coordenadas.
// ─────────────────────────────────────────────────────────────────────────────
import { separarMorada, zonaDaMoradaPartida } from './morada'

export interface HorarioTransporte {
  id: string
  patient_id: string
  label: string
  time: string | null      // 'HH:MM:SS'
  weekdays: number[] | null
}

export interface PessoaRota {
  id: string
  name: string
  address?: string | null
  photo_url?: string | null
  lat?: number | null
  lon?: number | null
}

export interface Paragem {
  scheduleId: string
  patientId: string
  nome: string
  label: string
  hora: string | null        // 'HH:MM'
  morada: string | null
  zona: string               // etiqueta da zona (código postal ou localidade)
  feito: boolean
  /** minutos desde a paragem anterior — null na primeira ou sem horas */
  intervalo: number | null
  /** primeira paragem desta zona: é aqui que a linha muda de faixa */
  abreZona: boolean
  /** coordenadas reais, quando a morada já foi convertida — nunca aproximadas */
  lat: number | null
  lon: number | null
}

export interface Rota {
  paragens: Paragem[]
  zonas: string[]
  primeira: string | null
  ultima: string | null
  duracaoMin: number | null
  feitas: number
  semHora: number
}


/** "Rua X, 2745-123 Queluz" -> "2745 . Queluz". Sem codigo postal, a terra.
 *  Delega em lib/morada: tinha aqui a MESMA leitura errada do /api/geocode,
 *  em que "Rua das Flores 1234" dava a zona "1234" — o numero da porta. */
export function zonaDaMorada(morada?: string | null): string {
  return zonaDaMoradaPartida(separarMorada(morada))
}

const minutos = (hhmm: string | null): number | null => {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return isNaN(h) ? null : h * 60 + (m || 0)
}

/**
 * Monta a rota de hoje. `feitos` é o conjunto de schedule_id já marcados.
 * Ordena por hora (quem não tem hora vai para o fim, sem inventar uma).
 */
export function montarRota(
  horarios: HorarioTransporte[],
  pessoas: PessoaRota[],
  feitos: Set<string>,
  diaSemana: number,
): Rota {
  const porId = new Map(pessoas.map(p => [p.id, p]))

  const doDia = horarios.filter(h =>
    !Array.isArray(h.weekdays) || !h.weekdays.length || h.weekdays.includes(diaSemana))

  const ordenadas = doDia
    .map(h => {
      const p = porId.get(h.patient_id)
      const hora = h.time ? String(h.time).slice(0, 5) : null
      return {
        scheduleId: h.id, patientId: h.patient_id,
        nome: p?.name || 'Utente', label: h.label || 'Transporte',
        hora, morada: p?.address || null,
        zona: zonaDaMorada(p?.address),
        lat: typeof p?.lat === 'number' ? p.lat : null,
        lon: typeof p?.lon === 'number' ? p.lon : null,
        feito: feitos.has(h.id),
      }
    })
    .sort((a, b) => {
      const ma = minutos(a.hora), mb = minutos(b.hora)
      if (ma == null && mb == null) return a.nome.localeCompare(b.nome)
      if (ma == null) return 1
      if (mb == null) return -1
      return ma - mb || a.nome.localeCompare(b.nome)
    })

  let zonaAnterior: string | null = null
  let horaAnterior: number | null = null
  const paragens: Paragem[] = ordenadas.map(p => {
    const m = minutos(p.hora)
    const intervalo = m != null && horaAnterior != null ? m - horaAnterior : null
    const abreZona = p.zona !== zonaAnterior
    zonaAnterior = p.zona
    if (m != null) horaAnterior = m
    return { ...p, intervalo, abreZona }
  })

  const comHora = paragens.filter(p => p.hora)
  const ini = comHora.length ? minutos(comHora[0].hora) : null
  const fim = comHora.length ? minutos(comHora[comHora.length - 1].hora) : null

  return {
    paragens,
    zonas: [...new Set(paragens.map(p => p.zona))],
    primeira: comHora[0]?.hora ?? null,
    ultima: comHora[comHora.length - 1]?.hora ?? null,
    duracaoMin: ini != null && fim != null ? fim - ini : null,
    feitas: paragens.filter(p => p.feito).length,
    semHora: paragens.filter(p => !p.hora).length,
  }
}

/** A folha que vai com quem conduz. Papel, não ecrã: números grandes e ordem. */
export function folhaDoMotorista(casa: string, data: string, rota: Rota): boolean {
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  const d = new Date(data + 'T12:00:00')
  const dia = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

  const linhas = rota.paragens.map((p, i) => `
    <tr${p.abreZona && i > 0 ? ' class="nz"' : ''}>
      <td class="n">${i + 1}</td>
      <td class="h">${esc(p.hora || '—')}</td>
      <td><div class="nome">${esc(p.nome)}</div><div class="mor">${esc(p.morada || 'Sem morada registada')}</div>
          <div class="lbl">${esc(p.label)}</div></td>
      <td class="chk"></td>
    </tr>`).join('')

  const html = `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">
<title>Rota de transporte — ${esc(dia)}</title><style>
@page { size: A4; margin: 15mm 14mm; }
body { margin:0; color:#14150f; font-family:'Iowan Old Style',Palatino,Georgia,serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
header { border-bottom:1.5px solid #14150f; padding-bottom:9px; margin-bottom:20px; display:flex; align-items:flex-end; justify-content:space-between; gap:20px; }
.casa { font-size:9.5px; letter-spacing:.22em; text-transform:uppercase; color:#6b6d63; font-family:ui-monospace,Menlo,Consolas,monospace; }
h1 { font-size:28px; font-weight:400; margin:5px 0 0; }
.meta { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#6b6d63; font-family:ui-monospace,Menlo,Consolas,monospace; text-align:right; white-space:nowrap; }
table { width:100%; border-collapse:collapse; }
td { padding:11px 8px; border-bottom:1px solid #e6e7e0; vertical-align:top; }
tr.nz td { border-top:2px solid #14150f; }
td.n { width:26px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11px; color:#9a9c92; }
td.h { width:62px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:19px; font-weight:600; }
.nome { font-size:17px; line-height:1.25; }
.mor { font-size:11.5px; color:#5e6057; margin-top:2px; }
.lbl { font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:#9a9c92; font-family:ui-monospace,Menlo,Consolas,monospace; margin-top:3px; }
td.chk { width:34px; }
td.chk::after { content:''; display:block; width:20px; height:20px; border:1.5px solid #9a9c92; border-radius:4px; margin-left:auto; }
footer { margin-top:22px; border-top:1px solid #d9dad2; padding-top:8px; font-size:9px; color:#8b8d83; font-family:ui-monospace,Menlo,Consolas,monospace; display:flex; justify-content:space-between; }
</style></head><body>
<header><div><div class="casa">${esc(casa)}</div><h1>Rota de transporte</h1></div>
<div class="meta">${esc(dia)}<br>${rota.paragens.length} paragens${rota.primeira ? ` · ${esc(rota.primeira)}–${esc(rota.ultima)}` : ''}</div></header>
<table><tbody>${linhas || '<tr><td colspan="4">Sem transportes marcados para hoje.</td></tr>'}</tbody></table>
<footer><span>Marcar cada paragem à saída. A ordem é a das horas combinadas.</span><span>Phlox</span></footer>
</body></html>`

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const w = window.open(url, '_blank')
  if (!w) { URL.revokeObjectURL(url); return false }
  w.focus()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}


// ─────────────────────────────────────────────────────────────────────────────
// O CIRCUITO: uma hora de partida, e as chegadas saem sozinhas.
//
// Num transporte casa-centro-casa nao faz sentido marcar uma hora a cada
// pessoa. O motorista sai a uma hora e vai recolhendo toda a gente pela ordem
// que faz menos quilometros; a hora a que chega a cada porta e uma CONSEQUENCIA
// da rota, nao uma decisao de quem organiza. Pedir essas horas uma a uma era
// pedir a alguem para adivinhar o transito.
//
// Por isso: a pessoa diz a que horas o carro sai, e isto calcula o resto a
// partir dos tempos de estrada reais que o /api/rota-otimizada devolve.
// ─────────────────────────────────────────────────────────────────────────────

export interface ParagemComHora extends Paragem {
  /** hora estimada de chegada a esta porta, "HH:MM" */
  horaEstimada: string
  /** minutos de estrada desde a paragem anterior (da casa, na primeira) */
  minutosDeEstrada: number
}

export interface Circuito {
  paragens: ParagemComHora[]
  partida: string
  /** hora a que o carro esta de volta a casa com toda a gente */
  regresso: string
  minutosTotal: number
  /** true quando os tempos sao estimados por distancia, sem estradas reais */
  aproximado: boolean
}

const paraHHMM = (m: number): string => {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`
}

/**
 * Calcula a que horas o carro chega a cada porta.
 *
 * @param paragens   ja pela ordem do percurso (a que o /api/rota-otimizada deu)
 * @param partida    "HH:MM" a que o carro sai da instituicao
 * @param pernas     minutos de estrada de cada troco, na mesma ordem:
 *                   pernas[0] = casa -> 1a paragem, pernas[1] = 1a -> 2a, ...
 *                   A ultima perna, se existir, e o regresso a casa.
 * @param minutosPorParagem  quanto demora a recolher cada pessoa a porta
 */
export function horariosDoCircuito(
  paragens: Paragem[],
  partida: string,
  pernas: number[],
  minutosPorParagem = 3,
): Circuito {
  const inicio = minutos(partida) ?? 8 * 60
  let relogio = inicio
  const aproximado = !pernas.length

  const comHora: ParagemComHora[] = paragens.map((p, i) => {
    // Sem tempos reais de estrada (sem coordenadas, ou o servico em baixo),
    // usa-se um valor honesto e diz-se que e aproximado — nunca se finge
    // precisao que nao ha.
    const estrada = pernas[i] != null ? pernas[i] : 6
    relogio += estrada
    const horaEstimada = paraHHMM(relogio)
    relogio += minutosPorParagem
    return { ...p, horaEstimada, minutosDeEstrada: estrada }
  })

  // O troco de volta a casa: a ultima perna quando o servico a devolveu.
  const volta = pernas.length > paragens.length ? pernas[paragens.length] : (pernas.length ? 6 : 6)
  const fim = relogio - minutosPorParagem + volta

  return {
    paragens: comHora,
    partida: paraHHMM(inicio),
    regresso: paraHHMM(fim),
    minutosTotal: Math.max(0, Math.round(fim - inicio)),
    aproximado,
  }
}
