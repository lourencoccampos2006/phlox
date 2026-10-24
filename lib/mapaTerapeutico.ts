// lib/mapaTerapeutico.ts
// ═══════════════════════════════════════════════════════════════════════════
// O MAPA TERAPÊUTICO COM MEMÓRIA
// ═══════════════════════════════════════════════════════════════════════════
//
// Até aqui, mudar uma dose sobrescrevia a linha. Ficava a última versão e mais
// nada — quem mudou, quando, e por indicação de quem perdia-se no instante em
// que se gravava. É a primeira pergunta quando um utente piora, e não tinha
// resposta.
//
// O histórico é escrito por um gatilho na base de dados (sprint189), não por
// este ficheiro: assim nenhuma alteração escapa, venha do ecrã que vier. O que
// a aplicação acrescenta é a PROVENIÊNCIA — por indicação de quem — que é a
// única coisa que a base de dados não pode saber sozinha.
//
// Nada aqui interpreta a medicação. Regista, compara duas versões e diz o que
// mudou. É registo e comunicação, e por isso fica fora da Regra 11 do
// Regulamento (UE) 2017/745.

export type TipoDeIndicacao =
  | 'medico_familia' | 'hospital' | 'especialista' | 'enfermagem' | 'familia' | 'outro'

export const TIPOS_DE_INDICACAO: { id: TipoDeIndicacao; rotulo: string }[] = [
  { id: 'medico_familia', rotulo: 'Médico de família' },
  { id: 'hospital', rotulo: 'Hospital / alta' },
  { id: 'especialista', rotulo: 'Especialista' },
  { id: 'enfermagem', rotulo: 'Enfermagem da casa' },
  { id: 'familia', rotulo: 'Família' },
  { id: 'outro', rotulo: 'Outro' },
]

export interface Indicacao { de: string; tipo: TipoDeIndicacao; nota?: string }

/** As colunas a gravar na `patient_meds` junto com a alteração. */
export function colunasDaIndicacao(i: Indicacao) {
  return {
    indicacao_de: i.de.trim() || null,
    indicacao_tipo: i.tipo,
    indicacao_nota: (i.nota || '').trim() || null,
    /* É este instante que diz ao gatilho que ESTA escrita traz proveniência.
       Sem ele, uma alteração sem indicação herdava a da anterior. */
    indicacao_em: new Date().toISOString(),
  }
}

/**
 * A indicação mais recente que esta pessoa teve, para vir já preenchida.
 * Quase sempre é o mesmo médico — e pré-preencher torna a pergunta num toque.
 */
export function ultimaIndicacao(meds: Record<string, any>[]): Indicacao | null {
  const comIndicacao = meds
    .filter(m => m?.indicacao_em && m?.indicacao_de)
    .sort((a, b) => String(b.indicacao_em).localeCompare(String(a.indicacao_em)))
  const m = comIndicacao[0]
  return m ? { de: m.indicacao_de, tipo: (m.indicacao_tipo || 'medico_familia') as TipoDeIndicacao } : null
}

export interface Alteracao {
  id: string
  created_at: string
  tipo: 'nova' | 'alterada' | 'suspensa' | 'retomada' | 'removida'
  med_nome: string
  antes: Record<string, any> | null
  depois: Record<string, any> | null
  indicacao_de: string | null
  indicacao_tipo: string | null
  indicacao_nota: string | null
  alterado_por_nome: string | null
  vista_farmacia_em: string | null
}

export const ROTULO_DO_TIPO: Record<Alteracao['tipo'], string> = {
  nova: 'Nova', alterada: 'Alterada', suspensa: 'Suspensa', retomada: 'Retomada', removida: 'Apagada',
}

export function rotuloDaIndicacao(tipo: string | null): string {
  return TIPOS_DE_INDICACAO.find(t => t.id === tipo)?.rotulo || ''
}

/** «Dr.ª Silva (médico de família)», ou o aviso de que não ficou dito. */
export function quemIndicou(a: Pick<Alteracao, 'indicacao_de' | 'indicacao_tipo'>): string {
  const tipo = rotuloDaIndicacao(a.indicacao_tipo)
  if (a.indicacao_de) return tipo ? `${a.indicacao_de} (${tipo.toLowerCase()})` : a.indicacao_de
  return tipo || 'indicação não registada'
}

/* Os campos que contam para quem dá ou prepara a medicação. Uma alteração que
   só mexe noutros (o `updated_at`, uma nota interna) não aparece como mudança. */
const CAMPOS: { k: string; rotulo: string; fmt?: (v: any) => string }[] = [
  { k: 'name', rotulo: 'medicamento' },
  { k: 'dose', rotulo: 'dose' },
  { k: 'frequency', rotulo: 'frequência' },
  { k: 'shifts', rotulo: 'turnos', fmt: v => (Array.isArray(v) && v.length ? v.join(', ') : 'todos') },
  {
    k: 'horas', rotulo: 'horas',
    fmt: v => (v && typeof v === 'object' && Object.keys(v).length
      ? Object.entries(v).map(([t, h]) => `${t} ${h}`).join(', ') : '—'),
  },
  { k: 'sos', rotulo: 'SOS', fmt: v => (v ? 'sim' : 'não') },
  { k: 'sos_para', rotulo: 'SOS para' },
  { k: 'sos_max_dia', rotulo: 'máx. por dia' },
  { k: 'sos_intervalo_horas', rotulo: 'intervalo (h)' },
  { k: 'take_location', rotulo: 'onde se toma', fmt: v => (v === 'casa' ? 'em casa' : v === 'centro' ? 'no centro' : '—') },
]

function mostra(v: any, fmt?: (v: any) => string): string {
  if (fmt) return fmt(v)
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

/** A posologia de uma versão, numa linha. */
export function posologia(m: Record<string, any> | null | undefined): string {
  if (!m) return ''
  const partes = [m.dose, m.frequency].filter(Boolean)
  if (m.sos) partes.push(`SOS${m.sos_para ? ` — ${m.sos_para}` : ''}`)
  else if (Array.isArray(m.shifts) && m.shifts.length) partes.push(m.shifts.join(', '))
  return partes.join(' · ')
}

/** O que mudou, em frases curtas. Compara duas versões; não julga nenhuma. */
export function oQueMudou(a: Pick<Alteracao, 'tipo' | 'antes' | 'depois'>): string[] {
  if (a.tipo === 'nova') return [posologia(a.depois) || 'sem posologia escrita']
  if (a.tipo === 'suspensa') return ['suspensa']
  if (a.tipo === 'retomada') return ['retomada' + (posologia(a.depois) ? ` — ${posologia(a.depois)}` : '')]
  if (a.tipo === 'removida') return ['apagada da ficha']
  const antes = a.antes || {}, depois = a.depois || {}
  const out: string[] = []
  for (const c of CAMPOS) {
    if (JSON.stringify(antes[c.k] ?? null) !== JSON.stringify(depois[c.k] ?? null)) {
      out.push(`${c.rotulo}: ${mostra(antes[c.k], c.fmt)} → ${mostra(depois[c.k], c.fmt)}`)
    }
  }
  return out.length ? out : ['sem mudança na posologia']
}

/** As colunas do mapa que a farmácia vê. Nada mais sai pelo link. */
export const CAMPOS_PARA_A_FARMACIA =
  'id, name, dose, frequency, shifts, horas, sos, sos_para, sos_max_dia, sos_intervalo_horas, take_location'

/**
 * Depois de qualquer mudança à medicação: avisa o resto da página (o
 * histórico recarrega) e pede ao servidor que avise a farmácia, se a pessoa
 * tiver o mapa partilhado com uma.
 *
 * O aviso à farmácia é melhor-esforço: a alteração já está gravada, e um
 * email que falha não a pode desfazer nem fazer parecer que falhou.
 */
export async function depoisDeMudarMedicacao(supabase: any, pid: string): Promise<void> {
  try { window.dispatchEvent(new CustomEvent('phlox:medicacao-mudou', { detail: pid })) } catch { /* sem janela */ }
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return
    await fetch('/api/farmacia/avisar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patient_id: pid }),
    })
  } catch { /* melhor-esforço — ver em cima */ }
}
