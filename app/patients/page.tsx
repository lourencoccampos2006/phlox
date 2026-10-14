'use client'

// /patients — REFEITA DO ZERO (2026-06-26). A página bandeira das instituições:
//  • partilhada por organização (toda a equipa vê os mesmos utentes — org_id)
//  • dados REAIS: contagem de medicação e alertas (ocorrências abertas) por pessoa,
//    e se já tem registo do dia hoje — antes os crachás existiam mas sem dados
//  • filtros rápidos (com alertas · polimedicados · sem registo hoje)
//  • adicionar (um a um) + importar CSV (deteção de colunas) + remover
//  • vocabulário por instituição (utente / residente / doente)
//  • visual adaptado ao tom (centro de dia/lar = quente; clínica/CSP = sóbrio)

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Vazio, ACarregar,
  Codigo, Bandeira, Botao, Seletor, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import { corDe, curto, filtrarPorEtiquetas, contarPorEtiqueta, type Etiqueta } from '@/lib/etiquetas'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import ClinicalGate from '@/components/ClinicalGate'
import { riskScore as calcRiskScore, riskLevel } from '@/lib/riskScore'
import { useLiveData } from '@/lib/useLiveData'
import { useOrgScope } from '@/lib/orgScope'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import FichaDeInscricao from '@/components/institution/FichaDeInscricao'
import { fichaVazia, paraColunas } from '@/lib/inscricao'

// ── CSV helpers ───────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  return lines.map(line => {
    const fields: string[] = []; let inQuotes = false, field = ''
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') inQuotes = !inQuotes
      else if ((c === ',' || c === ';') && !inQuotes) { fields.push(field.trim().replace(/^"|"$/g, '')); field = '' }
      else field += c
    }
    fields.push(field.trim().replace(/^"|"$/g, '')); return fields
  })
}
function detectMapping(headers: string[]): Record<string, number> {
  const m: Record<string, number> = {}
  headers.forEach((h, i) => {
    const l = h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (m.name === undefined && /^(nome|name|doente|residente|utente|paciente)/.test(l)) m.name = i
    // A data de nascimento ANTES da idade, de propósito. Uma folha que traga
    // as duas colunas deve ficar com a data — que é a que não envelhece.
    else if (m.birth === undefined && /nascimento|nasc\.?$|^dn$|birth|dob/.test(l)) m.birth = i
    else if (m.age === undefined && /idade|age|anos$/.test(l)) m.age = i
    else if (m.sex === undefined && /^(sexo|sex|genero|gender)/.test(l)) m.sex = i
    else if (m.room === undefined && /quarto|room|cama|bed|unidade/.test(l)) m.room = i
    else if (m.admission === undefined && /admiss|entrada|internamento/.test(l)) m.admission = i
    else if (m.conditions === undefined && /diagnos|condicao|patolog|doenca|proble/.test(l)) m.conditions = i
    else if (m.allergies === undefined && /alergi|allerg/.test(l)) m.allergies = i
    else if (m.weight === undefined && /^(peso|weight)/.test(l)) m.weight = i
    else if (m.contact === undefined && /contacto|contact|emergencia|familiar/.test(l)) m.contact = i
    else if (m.nif === undefined && /^(nif|contribuinte)/.test(l)) m.nif = i
    else if (m.sns === undefined && /sns|utente de saude|n\.? ?utente/.test(l)) m.sns = i
    else if (m.address === undefined && /morada|address|residencia/.test(l)) m.address = i
    else if (m.phone === undefined && /telefone|telemovel|phone|contact?o tel/.test(l)) m.phone = i
  })
  return m
}

/**
 * Uma data de uma folha portuguesa.
 *
 * Isto existe porque as folhas de cálculo em Portugal trazem 15/03/1938 e a
 * coluna do lado de lá é do tipo `date`. O Postgres, com o DateStyle que o
 * Supabase usa, lê 15/03 como mês 15 e recusa a linha inteira — e como o
 * importador não lia o erro, a linha desaparecia sem deixar rasto e o
 * contador dizia que tinha entrado.
 *
 * Aceita dd/mm/aaaa, dd-mm-aaaa e aaaa-mm-dd. Qualquer outra coisa devolve
 * null, que é melhor do que uma data inventada.
 */
function dataDaFolha(cru: string): string | null {
  const t = (cru || '').trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (!m) return null
  const dia = +m[1], mes = +m[2]
  let ano = +m[3]
  if (dia > 31 || mes > 12 || dia < 1 || mes < 1) return null
  // Uma folha com «38» quer dizer 1938 e não 2038: ninguém nascido no futuro
  // se inscreve num lar. O corte nos 25 anos deixa passar quem tem menos.
  if (ano < 100) ano += ano > 25 ? 1900 : 2000
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

interface Patient {
  id: string; name: string; age: number | null; sex: string | null
  conditions: string | null; allergies: string | null
  room_number?: string | null; creatinine?: number | null; weight?: number | null
  updated_at?: string; photo_url?: string | null
}

type FilterKey = 'all' | 'alerts' | 'poly' | 'no_log'

export default function PatientsPage() {
  const largo = useLargo()
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const toast = useToast()
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('utentes', 'editar')
  const cfg = institutionConfig(institution)
  const noun = cfg.personNoun.toLowerCase()
  const nounPlural = cfg.personNounPlural.toLowerCase()
  const nounCap = cfg.personNounPlural
  /* O acento era turquesa (var(--green-3)) nos lares e centros de dia e cinzento no
     resto — uma cor a mais, e a unica da aplicacao que nao estava nos tokens.
     Desde 2026-10-07 as duas respostas sociais usam o verde da casa. */
  const warm = institution === 'day_care' || institution === 'nursing_home'
  const accent = warm ? 'var(--green)' : 'var(--ink-2)'
  const accentSoft = warm ? 'var(--green-light)' : 'var(--bg-2)'

  const [patients, setPatients] = useState<Patient[]>([])
  const [medsCount, setMedsCount] = useState<Record<string, number>>({})
  const [alertCount, setAlertCount] = useState<Record<string, number>>({})
  const [loggedToday, setLoggedToday] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  // ── Etiquetas (sprint163) ─────────────────────────────────────────────────
  // «Quem e que tem risco de queda?» e uma pergunta que se faz antes de montar
  // a escala da noite, e ate agora a resposta estava no meio das notas.
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [ligacoes, setLigacoes] = useState<{ patient_id: string; etiqueta_id: string }[]>([])
  const [etiquetasEscolhidas, setEtiquetasEscolhidas] = useState<string[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')

  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  // A ficha vem de `lib/inscricao.ts`, que e a MESMA que a inscricao em
  // /inscricoes usa. Antes isto era um objeto de 12 campos escrito a mao aqui
  // — e a tabela `patients` tem 50 colunas. A morada, o NIF, o numero de
  // utente, o medico de familia, a dieta e a mobilidade existiam ha sprints e
  // nunca ninguem os conseguiu preencher.
  //
  // E pedia a IDADE. Um numero escrito a mao, que a partir do dia seguinte
  // esta errado. Agora pede-se a data de nascimento e a idade sai dela
  // sozinha (gatilho `patients_idade`, sprint165).
  const [newP, setNewP] = useState<Record<string, string>>(() => fichaVazia('utente'))
  const mudarFicha = useCallback((id: string, valor: string) => {
    setNewP(f => ({ ...f, [id]: valor }))
  }, [])

  const [archived, setArchived] = useState<{ id: string; name: string }[]>([])
  const [showArchived, setShowArchived] = useState(false)

  const [showImport, setShowImport] = useState(false)
  const [importPreview, setImportPreview] = useState<{ headers: string[]; rows: string[][]; mapping: Record<string, number> } | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone] = useState(0)
  const [importError, setImportError] = useState('')

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    if (!user) return
    // utentes da ORGANIZAÇÃO (ou do próprio, se conta individual)
    const { data: pats } = await scope.filter(
      supabase.from('patients').select('id,name,age,sex,conditions,allergies,room_number,creatinine,weight,updated_at,photo_url').eq('active', true)
    ).order('name')
    const list = (pats || []) as Patient[]
    setPatients(list)
    const ids = list.map(p => p.id)
    if (ids.length) {
      // dados REAIS por utente: nº de medicação, ocorrências abertas, registo de hoje
      const [meds, inc, care] = await Promise.all([
        supabase.from('patient_meds').select('patient_id').in('patient_id', ids).eq('active', true),
        supabase.from('incidents').select('patient_id').in('patient_id', ids).eq('status', 'open'),
        supabase.from('care_records').select('patient_id').in('patient_id', ids).eq('date', today),
      ])
      const mc: Record<string, number> = {}; (meds.data || []).forEach((m: any) => { mc[m.patient_id] = (mc[m.patient_id] || 0) + 1 })
      const ac: Record<string, number> = {}; (inc.data || []).forEach((i: any) => { ac[i.patient_id] = (ac[i.patient_id] || 0) + 1 })
      setMedsCount(mc); setAlertCount(ac)
      setLoggedToday(new Set((care.data || []).map((c: any) => c.patient_id)))
    } else { setMedsCount({}); setAlertCount({}); setLoggedToday(new Set()) }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  const loadArchived = useCallback(async () => {
    if (!user) return
    const { data } = await scope.filter(supabase.from('patients').select('id,name').eq('active', false)).order('name')
    setArchived((data || []) as { id: string; name: string }[])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadArchived() }, [loadArchived])
  useLiveData({ supabase, userId: user?.id, table: ['patients', 'patient_meds', 'incidents', 'care_records'], filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load })

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'n' || e.key === 'N') && isPro) setShowAdd(true)
    }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [isPro])

  // ── ações ──
  async function addPatient() {
    if (!newP.nome?.trim() || !user) return
    if (!podeEditar) { toast.error('Só leitura', 'A sua conta não pode adicionar pessoas.'); return }
    setAdding(true)
    try {
      // `paraColunas` sabe que coluna e que cada campo alimenta, e manda vazio
      // como null e nao como ''. Nao escreve `age`: quem a escreve e o gatilho,
      // a partir da data de nascimento.
      const { data, error } = await supabase.from('patients').insert(scope.stamp({
        user_id: user.id, active: true,
        ...paraColunas(newP, 'utente', { omitirVazios: true }),
      })).select().single()
      // Em falha: NÃO limpar o formulário (a pessoa não perde o que escreveu) e
      // avisar de forma calma. Só limpa + navega quando gravou mesmo.
      if (error) { toast.error('Não foi possível adicionar', reportError('patients-add', error, 'Tenta de novo.')); return }
      setNewP(fichaVazia('utente'))
      if (data) router.push(`/patients/${data.id}`)
    } catch (e) {
      toast.error('Não foi possível adicionar', reportError('patients-add', e, 'Verifica a ligação e tenta de novo.'))
    } finally {
      setAdding(false)
    }
  }

  // ARQUIVAR (soft-delete): não apaga nada — põe active:false. Sai da lista mas o
  // histórico fica, e pode ser reposto. Apagar de vez um utente e todos os seus
  // registos por um clique era perigoso (e irreversível).
  async function archivePatient(id: string, name: string) {
    if (!user) return
    if (!confirm(`Arquivar ${name}? Sai da lista, mas os registos ficam guardados e pode repô-lo em "Arquivados".`)) return
    await supabase.from('patients').update({ active: false }).eq('id', id)
    load(); loadArchived()
  }
  async function restorePatient(id: string) {
    await supabase.from('patients').update({ active: true }).eq('id', id)
    load(); loadArchived()
  }

  // Usa as linhas já normalizadas (headers + dataRows, tudo string[][]) para
  // detetar colunas e preparar a pré-visualização — partilhado por CSV e Excel.
  function applyImportRows(rows: string[][]) {
    if (rows.length < 2) { setImportError('Ficheiro vazio ou inválido.'); return }
    const [headers, ...dataRows] = rows
    const mapping = detectMapping(headers)
    if (mapping.name === undefined) { setImportError('Não consegui detetar a coluna "Nome". Confirma o cabeçalho.'); return }
    setImportPreview({ headers, rows: dataRows.filter(r => r[mapping.name]?.trim()), mapping }); setImportError('')
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const isExcel = /\.xlsx?$/i.test(file.name)
    if (isExcel) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const buf = ev.target?.result as ArrayBuffer
          // Importada só agora, quando alguém escolhe mesmo um ficheiro: a
          // biblioteca são 370 KB e vinha em TODAS as páginas que ligam a
          // /utentes, por causa do prefetch dos links do Next.
          const XLSX = await import('xlsx')
          const wb = XLSX.read(buf, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][])
            .map(row => row.map(cell => String(cell ?? '').trim()))
            .filter(row => row.some(c => c))
          applyImportRows(rows)
        } catch { setImportError('Erro ao ler o ficheiro. É um .xlsx/.xls válido?') }
      }
      reader.readAsArrayBuffer(file); e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        applyImportRows(parseCSV(ev.target?.result as string))
      } catch { setImportError('Erro ao ler o ficheiro. É um CSV válido?') }
    }
    reader.readAsText(file, 'UTF-8'); e.target.value = ''
  }

  async function doImport() {
    if (!importPreview || !user) return
    setImportLoading(true); setImportDone(0)
    const { rows, mapping } = importPreview
    const get = (row: string[], k: string) => (mapping[k] !== undefined ? (row[mapping[k]] || '') : '').trim()
    let done = 0
    const falhadas: string[] = []
    for (const row of rows) {
      const name = get(row, 'name'); if (!name) continue
      const nascimento = dataDaFolha(get(row, 'birth'))
      const { error } = await supabase.from('patients').insert(scope.stamp({
        user_id: user.id, name, active: true,
        date_of_birth: nascimento,
        // A idade da folha só serve para quem não trouxe data. Quem trouxe
        // data fica com a idade que o gatilho calcular, que está sempre certa.
        age: nascimento ? null : (parseInt(get(row, 'age')) || null),
        sex: get(row, 'sex').toUpperCase().startsWith('M') ? 'M' : get(row, 'sex').toUpperCase().startsWith('F') ? 'F' : null,
        weight: parseFloat(get(row, 'weight')) || null,
        conditions: get(row, 'conditions') || null, allergies: get(row, 'allergies') || null,
        room_number: get(row, 'room') || null,
        admission_date: dataDaFolha(get(row, 'admission')),
        emergency_contact: get(row, 'contact') || null,
        nif: get(row, 'nif') || null, sns_number: get(row, 'sns') || null,
        address: get(row, 'address') || null, telefone: get(row, 'phone') || null,
      }))
      // Antes daqui não se lia o erro. Uma linha recusada pela base de dados
      // desaparecia sem deixar rasto, e o contador dizia na mesma que tinha
      // entrado — a pessoa fechava o importador convencida de que estava tudo
      // lá dentro.
      if (error) { falhadas.push(name); continue }
      done++; setImportDone(done)
    }
    setImportLoading(false); setShowImport(false); setImportPreview(null); load()
    if (falhadas.length) {
      toast.error(
        `${falhadas.length} de ${falhadas.length + done} não entraram`,
        `${falhadas.slice(0, 3).join(', ')}${falhadas.length > 3 ? ` e mais ${falhadas.length - 3}` : ''}. As outras ficaram guardadas.`,
      )
    } else if (done) {
      toast.success(`${done} ${done === 1 ? noun : nounPlural}`, 'Importados.')
    }
  }

  // ── derivados ──
  const relativeDate = (iso?: string | null) => {
    if (!iso) return ''
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    return d === 0 ? 'hoje' : d === 1 ? 'ontem' : d < 7 ? `há ${d} dias` : d < 30 ? `há ${Math.floor(d / 7)} sem.` : `há ${Math.floor(d / 30)} meses`
  }
  const crCl = (p: Patient) => {
    if (!p.creatinine || !p.age || !p.weight || !p.sex) return null
    return Math.round(((140 - p.age) * p.weight * (p.sex === 'F' ? 0.85 : 1)) / (72 * p.creatinine))
  }

  const counts = useMemo(() => ({
    alerts: patients.filter(p => (alertCount[p.id] || 0) > 0).length,
    poly: patients.filter(p => (medsCount[p.id] || 0) >= 5).length,
    no_log: patients.filter(p => !loggedToday.has(p.id)).length,
  }), [patients, alertCount, medsCount, loggedToday])

  // Carregadas a parte e nao com os utentes: sao duas tabelas pequenas, a
  // resposta e a mesma para toda a casa, e assim a lista aparece sem esperar
  // por elas.
  useEffect(() => {
    if (!user) return
    let vivo = true
    ;(async () => {
      let qe = supabase.from('etiquetas').select('*').eq('ativa', true).order('nome')
      qe = scope.filter(qe)
      const [e, l] = await Promise.all([
        qe,
        supabase.from('etiquetas_do_utente').select('patient_id, etiqueta_id'),
      ])
      if (!vivo) return
      // Sem a tabela (migracao por correr) ou sem permissao, o filtro
      // simplesmente nao aparece. A lista continua a funcionar tal e qual.
      if (!e.error) setEtiquetas(e.data || [])
      if (!l.error) setLigacoes(l.data || [])
    })()
    return () => { vivo = false }
  }, [user, supabase, scope])

  const contagemEtiquetas = useMemo(() => contarPorEtiqueta(ligacoes), [ligacoes])
  const etiquetasPorPessoa = useMemo(() => {
    const m = new Map<string, Etiqueta[]>()
    const porId = new Map(etiquetas.map(e => [e.id, e]))
    for (const l of ligacoes) {
      const et = porId.get(l.etiqueta_id)
      if (!et) continue
      const lista = m.get(l.patient_id)
      if (lista) lista.push(et); else m.set(l.patient_id, [et])
    }
    return m
  }, [etiquetas, ligacoes])

  const visible = useMemo(() => patients
    .filter(p => {
      if (search && !(p.name.toLowerCase().includes(search.toLowerCase()) || (p.conditions || '').toLowerCase().includes(search.toLowerCase()))) return false
      if (filter === 'alerts') return (alertCount[p.id] || 0) > 0
      if (filter === 'poly') return (medsCount[p.id] || 0) >= 5
      if (filter === 'no_log') return !loggedToday.has(p.id)
      return true
    })
    .filter(p => {
      // «Todas» e nao «alguma»: escolher duas etiquetas quer dizer «quem e as
      // duas coisas». Com «alguma», acrescentar um filtro ALARGAVA a lista.
      if (!etiquetasEscolhidas.length) return true
      const suas = new Set((etiquetasPorPessoa.get(p.id) || []).map(e => e.id))
      return etiquetasEscolhidas.every(e => suas.has(e))
    })
    .sort((a, b) => {
      const ar = calcRiskScore({ ...a, alerts: alertCount[a.id], meds_count: medsCount[a.id] } as any)
      const br = calcRiskScore({ ...b, alerts: alertCount[b.id], meds_count: medsCount[b.id] } as any)
      if (br !== ar) return br - ar
      return (alertCount[b.id] || 0) - (alertCount[a.id] || 0)
    }), [patients, search, filter, alertCount, medsCount, loggedToday, etiquetasEscolhidas, etiquetasPorPessoa])

  if (!user) return null

  // ── sem acesso ── (ClinicalGate distingue "instituição por criar" de "sem plano")
  if (!isPro) {
    return <ClinicalGate icone="users" accent={accent}
      title={`Gestão de ${nounPlural}`}
      description="Fichas com medicação, diagnósticos e função renal — partilhadas por toda a equipa. Faz parte do plano Pro e Institucional." />
  }

  /* ══════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════
     Eram cartões de 320px numa grelha. Num lar de trinta pessoas isso são
     três ecrãs de rolar, e cada cartão mostrava quatro coisas sobre alguém —
     muito espaço para pouca informação.

     Passa a ser uma TABELA. Trinta pessoas cabem num ecrã, com mais sobre
     cada uma do que o cartão mostrava: quarto, idade, etiquetas, medicação,
     alertas, se já tem registo hoje, e o risco. Os números alinham em coluna,
     que é o que permite varrer a casa de cima a baixo sem ler.
     ══════════════════════════════════════════════════════════════════════ */
  const semRegisto = visible.filter(p => !loggedToday.has(p.id)).length

  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{ ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
            {nounCap}
          </span>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Procurar ${noun} ou diagnóstico…`} aria-label="Procurar"
            style={{ ...CAIXA, width: 260 }} />

          <Seletor
            opcoes={([
              ['all', `Todos ${patients.length}`],
              ['alerts', `Alertas ${counts.alerts}`],
              ['poly', `Polimed. ${counts.poly}`],
              ['no_log', `Sem registo ${counts.no_log}`],
            ] as [FilterKey, string][]).map(([id, rotulo]) => ({ id, rotulo }))}
            ativa={filter} aoMudar={setFilter} />

          {etiquetas.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {etiquetas.map(et => {
                const on = etiquetasEscolhidas.includes(et.id)
                const n = contagemEtiquetas.get(et.id) || 0
                if (!n && !on) return null
                return (
                  <button key={et.id} title={et.descricao || undefined}
                    onClick={() => setEtiquetasEscolhidas(l => on ? l.filter(x => x !== et.id) : [...l, et.id])}
                    className="mesa-botao"
                    style={{
                      ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.06em', padding: '0 7px',
                      borderRadius: 'var(--r-sm)', cursor: 'pointer',
                      border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                      background: on ? 'var(--green)' : 'transparent',
                      color: on ? 'var(--sobre-acento)' : 'var(--ink-4)',
                      fontWeight: on ? 700 : 500,
                    }}>{et.nome}{n ? ` ${n}` : ''}</button>
                )
              })}
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Botao onClick={() => { setShowImport(true); setImportPreview(null); setImportError('') }}>
              ↑ IMPORTAR
            </Botao>
            <Botao feitio="principal" onClick={() => setShowAdd(true)}>+ NOVO {noun.toUpperCase()}</Botao>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO }}>MED = medicamentos ativos</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>ALERTA = o que merece atenção</span>
          <span style={{ ...MONO, color: 'var(--green)' }}>✓ = já tem registo hoje</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>— = por registar hoje</span>
          {semRegisto > 0 && (
            <span style={{ ...MONO, color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
              {semRegisto} sem registo hoje
            </span>
          )}
          {archived.length > 0 && (
            <button onClick={() => setShowArchived(s => !s)} style={{
              marginLeft: 'auto', ...MONO, fontSize: 'var(--t-meta)', background: 'none',
              border: 'none', cursor: 'pointer', color: 'var(--ink-4)',
            }}>{showArchived ? '▾' : '▸'} ARQUIVADOS ({archived.length})</button>
          )}
        </BarraDeEstado>
      }
    >
      {showArchived && archived.length > 0 && (
        <Painel cabeca={<Cabecalho><span style={{ ...ROTULO, flex: 1 }}>Arquivados · {archived.length}</span></Cabecalho>}>
          {archived.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-3)' }}>{a.name}</span>
              <Botao onClick={() => restorePatient(a.id)}>REPOR</Botao>
            </div>
          ))}
        </Painel>
      )}

      <Painel
        cabeca={
          <Cabecalho>
            <span style={{ ...ROTULO, width: 34 }}>Qt</span>
            <span style={{ ...ROTULO, flex: 1 }}>{nounCap} · {visible.length}</span>
            <span style={{ ...ROTULO, width: 44, textAlign: 'right' }}>Idade</span>
            <span style={{ ...ROTULO, width: 52, textAlign: 'right' }}>Med</span>
            <span style={{ ...ROTULO, width: 58, textAlign: 'right' }}>Alerta</span>
            <span style={{ ...ROTULO, width: 52, textAlign: 'right' }}>Hoje</span>
            <span style={{ ...ROTULO, width: 62, textAlign: 'right' }}>Risco</span>
            <span style={{ ...ROTULO, width: 150 }}>Sinalizações</span>
          </Cabecalho>
        }
        rodape={
          <>
            <span style={MONO}>{visible.length} de {patients.length}</span>
            {search || filter !== 'all' || etiquetasEscolhidas.length ? (
              <button onClick={() => { setSearch(''); setFilter('all'); setEtiquetasEscolhidas([]) }}
                style={{ ...MONO, fontSize: 'var(--t-meta)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)' }}>
                LIMPAR OS FILTROS
              </button>
            ) : null}
          </>
        }
      >
        {loading ? (
          <ACarregar oQue="A carregar a casa…" />
        ) : visible.length === 0 ? (
          patients.length > 0 ? (
            <Vazio titulo={`Nenhum ${noun} corresponde ao filtro.`}
              acao={<Botao onClick={() => { setSearch(''); setFilter('all'); setEtiquetasEscolhidas([]) }}>LIMPAR</Botao>} />
          ) : (
            <Vazio titulo={cfg.emptyPeopleMsg}
              oQueFazer="Adicione a primeira ficha, ou importe de uma folha de cálculo."
              acao={<Botao feitio="principal" onClick={() => setShowAdd(true)}>{cfg.addPersonCta.toUpperCase()} →</Botao>} />
          )
        ) : visible.map(p => {
          const mc = medsCount[p.id] || 0, ac = alertCount[p.id] || 0
          const rs = calcRiskScore({ ...p, alerts: ac, meds_count: mc } as any)
          const logged = loggedToday.has(p.id)
          const suas = etiquetasPorPessoa.get(p.id) || []
          // `riskScore` devolve um numero; o nivel sai do `riskLevel`, que e a
          // fonte unica dos cortes (70 / 45 / 20).
          const nivel = riskLevel(rs)
          const corRisco = nivel === 'critical' || nivel === 'high' ? 'var(--red)'
            : nivel === 'moderate' ? 'var(--amber)' : 'var(--ink-4)'
          return (
            <LinhaTabela key={p.id} href={`/patients/${p.id}`}
              filete={ac > 0 ? 'var(--red)' : undefined}
              antes={{
                largura: 34,
                conteudo: (
                  <span style={{
                    ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any,
                    color: p.room_number ? 'var(--ink-3)' : 'var(--ink-5)',
                  }}>{p.room_number || '—'}</span>
                ),
              }}
              principal={p.name}
              secundaria={p.conditions || undefined}
              fim={
                suas.length || p.allergies ? (
                  /* O `maxWidth` era 150 fixos. No telemóvel a linha tem 390
                     e as etiquetas ficam por baixo do nome, onde há espaço —
                     o tecto só faz sentido na vista larga, onde compete com as
                     colunas. */
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: largo ? 150 : undefined }}>
                    {p.allergies && <Bandeira texto="ALERG" tom="mau" />}
                    {/* Era `e.nome.slice(0, 6)`. Uma etiqueta chamada «Risco de
                        queda» saía «RISCO » — com o espaço e tudo — e ao lado
                        dos números lia-se como mais uma medida chamada RISCO,
                        que já existe e quer dizer outra coisa. `curto()` corta
                        na palavra e o nome inteiro fica no `title`. */}
                    {suas.slice(0, 2).map(e => <Codigo key={e.id} texto={curto(e.nome)} titulo={e.nome} />)}
                    {suas.length > 2 && (
                      <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                        +{suas.length - 2}
                      </span>
                    )}
                  </span>
                ) : undefined
              }
              celulas={[
                { rotulo: 'Idade', valor: p.age != null ? `${p.age}a` : '—', largura: 44, direita: true },
                { rotulo: 'Med', valor: mc || '—', largura: 52, direita: true, cor: mc >= 5 ? 'var(--amber)' : undefined },
                { rotulo: 'Alerta', valor: ac || '—', largura: 58, direita: true, forte: !!ac, cor: ac ? 'var(--red)' : 'var(--ink-5)' },
                { rotulo: 'Hoje', valor: logged ? '✓' : '—', largura: 52, direita: true, cor: logged ? 'var(--green)' : 'var(--ink-5)' },
                { rotulo: 'Risco', valor: rs, largura: 62, direita: true, forte: true, cor: corRisco },
              ]} />
          )
        })}
      </Painel>
    </Mesa>

      {/* Modal: novo */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title={`Novo ${noun}`} accent={accent} wide>
          <FichaDeInscricao
            ficha={newP} onChange={mudarFicha} onde="utente" accent={accent}
            // Num lar é «Quarto», num centro de dia é «Sala». Escrever
            // qualquer um dos dois dentro do componente estaria errado em
            // metade das instalações.
            rotulos={{ sala: cfg.roomLabel || 'Sala ou lugar' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={addPatient} disabled={!newP.nome?.trim() || adding} style={{ flex: 1, background: accent, color: 'white', border: 'none', borderRadius: 'var(--r-lg)', padding: '12px', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: newP.nome?.trim() ? 'pointer' : 'not-allowed', opacity: newP.nome?.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>{adding ? 'A criar…' : 'Criar ficha →'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'inherit' }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Modal: importar */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)} title={`Importar ${nounPlural}`} accent={accent} wide>
          {!importPreview ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${accent}`, borderRadius: 'var(--r-xl)', padding: '38px 24px', cursor: 'pointer', background: accentSoft, gap: 10 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)',
                  letterSpacing: '.14em', color: 'var(--ink-5)',
                }}>CSV · XLSX</span>
                <span style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: accent }}>Selecionar ficheiro CSV ou Excel</span>
                <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>.csv, .xlsx ou .xls · exportado do Excel ou de outro sistema · até 500 {nounPlural}</span>
                <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleCSVFile} style={{ display: 'none' }} />
              </label>
              {importError && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', color: 'var(--red)' }}>{importError}</div>}
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', marginBottom: 6 }}>Primeira linha = cabeçalho. Exemplo:</div>
                <code style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', display: 'block', lineHeight: 1.7 }}>Nome, Idade, Sexo, {cfg.roomLabel || 'Sala'}, Diagnósticos, Alergias<br/>Maria Silva, 82, F, 12A, HTA; DM2, Penicilina</code>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '10px 14px', background: 'var(--badge-green-bg)', border: '1px solid var(--badge-green-border)', borderRadius: 'var(--r-md)', marginBottom: 14, fontSize: 'var(--t-dado)', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
                {importPreview.rows.length} {importPreview.rows.length === 1 ? noun : nounPlural} · colunas: {Object.keys(importPreview.mapping).join(', ')}
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'auto', maxHeight: 260, marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-meta)' }}>
                  <thead><tr style={{ background: 'var(--bg-2)' }}>{importPreview.headers.map((h, i) => <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>{importPreview.rows.slice(0, 8).map((row, i) => <tr key={i} style={{ borderTop: '1px solid var(--bg-3)' }}>{row.map((c, j) => <td key={j} style={{ padding: '7px 10px', color: 'var(--ink-3)', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {importLoading && <div style={{ padding: 11, background: accentSoft, borderRadius: 'var(--r-md)', marginBottom: 12, fontSize: 'var(--t-dado)', color: accent, fontWeight: 'var(--peso-forte)' as any }}>A importar… {importDone}/{importPreview.rows.length}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={doImport} disabled={importLoading} style={{ flex: 1, padding: 12, background: importLoading ? 'var(--ink-5)' : accent, color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: importLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{importLoading ? 'A importar…' : `Importar ${importPreview.rows.length} →`}</button>
                <button onClick={() => { setImportPreview(null); setImportError('') }} disabled={importLoading} style={{ padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'inherit' }}>Voltar</button>
              </div>
            </>
          )}
        </Modal>
      )}

      <style>{`
        .pt-card:hover { border-color: ${accent}66 !important; transform: translateY(-2px); }
        .pt-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        @media (max-width: 480px) { .pt-3col { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </>
  )
}

function Badge({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return <span style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color, background: bg, border: `1px solid ${border}`, borderRadius: 'var(--r)', padding: '2px 7px', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
}

function Modal({ children, onClose, title, accent, wide }: { children: React.ReactNode; onClose: () => void; title: string; accent: string; wide?: boolean }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,24,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 'var(--r-xl)', padding: 26, width: '100%', maxWidth: wide ? 620 : 520, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(8,12,24,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: accent, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 'var(--peso-forte)' as any }}>{title}</div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 'var(--t-destaque)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

