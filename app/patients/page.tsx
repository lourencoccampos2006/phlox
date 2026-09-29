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
import { corDe, filtrarPorEtiquetas, contarPorEtiqueta, type Etiqueta } from '@/lib/etiquetas'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import ClinicalGate from '@/components/ClinicalGate'
import { riskScore as calcRiskScore } from '@/lib/riskScore'
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
  const warm = institution === 'day_care' || institution === 'nursing_home'
  const accent = warm ? '#0d9488' : '#1d4ed8'
  const accentSoft = warm ? '#f0fdfa' : '#eff6ff'

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
    return <ClinicalGate emoji="🧑‍🤝‍🧑" accent={accent}
      title={`Gestão de ${nounPlural}`}
      description="Fichas com medicação, diagnósticos e função renal — partilhadas por toda a equipa. Faz parte do plano Pro e Institucional." />
  }

  return (
    <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px clamp(14px,3vw,28px) 70px' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, fontWeight: 700, marginBottom: 6 }}>{nounCap}</div>
            <h1 style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: warm ? 'clamp(26px,4vw,34px)' : 'clamp(22px,3vw,28px)', fontWeight: warm ? 500 : 800, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>
              {loading ? '—' : `${patients.length} ${patients.length === 1 ? noun : nounPlural}`}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => { setShowImport(true); setImportPreview(null); setImportError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 15px', background: 'white', color: accent, border: `1.5px solid ${accent}`, borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
              ↑ Importar
            </button>
            <button onClick={() => setShowAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: accent, color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
              + Novo {noun}
            </button>
          </div>
        </div>

        {/* Pesquisa + filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${noun} ou diagnóstico…`}
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px 10px 38px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['all', `Todos`, patients.length],
              ['alerts', 'Com alertas', counts.alerts],
              ['poly', 'Polimedicados', counts.poly],
              ['no_log', 'Sem registo hoje', counts.no_log],
            ] as [FilterKey, string, number][]).map(([k, label, n]) => (
              <button key={k} onClick={() => setFilter(k)}
                style={{ padding: '8px 12px', borderRadius: 999, border: `1.5px solid ${filter === k ? accent : '#e2e8f0'}`, background: filter === k ? accentSoft : 'white', color: filter === k ? accent : '#475569', fontSize: 12.5, fontWeight: filter === k ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {label}{n > 0 ? ` · ${n}` : ''}
              </button>
            ))}
          </div>

          {/* ── Filtrar por etiqueta ────────────────────────────────────────
              So aparece quando a casa tem etiquetas. Uma barra de filtros
              vazia a perguntar porque e que ninguem a usa nao ajuda ninguem. */}
          {etiquetas.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {etiquetas.map(et => {
                const on = etiquetasEscolhidas.includes(et.id)
                const c = corDe(et.cor)
                const n = contagemEtiquetas.get(et.id) || 0
                if (!n && !on) return null
                return (
                  <button key={et.id} title={et.descricao || undefined}
                    onClick={() => setEtiquetasEscolhidas(p => on ? p.filter(x => x !== et.id) : [...p, et.id])}
                    style={{
                      padding: '6px 11px', minHeight: 32, borderRadius: 999, cursor: 'pointer',
                      border: `1.5px solid ${on ? c.solido : c.borda}`,
                      background: on ? c.fundo : 'transparent',
                      color: on ? c.texto : '#64748b',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 500,
                      whiteSpace: 'nowrap',
                    }}>
                    <span aria-hidden style={{
                      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                      background: c.solido, marginRight: 6, verticalAlign: 'middle',
                    }} />
                    {et.nome}{n > 0 ? ` · ${n}` : ''}
                  </button>
                )
              })}
              {etiquetasEscolhidas.length > 0 && (
                <button onClick={() => setEtiquetasEscolhidas([])} style={{
                  padding: '6px 11px', minHeight: 32, borderRadius: 999, cursor: 'pointer',
                  border: 'none', background: 'transparent', color: '#64748b',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600, textDecoration: 'underline',
                }}>limpar</button>
              )}
            </div>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 12 }} />)}</div>
        ) : visible.length === 0 ? (
          <div style={{ background: 'white', border: '2px dashed #e2e8f0', borderRadius: 14, padding: '52px 24px', textAlign: 'center' }}>
            {search || filter !== 'all' ? (
              <>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 10 }}>Nenhum {noun} corresponde ao filtro.</div>
                <button onClick={() => { setSearch(''); setFilter('all') }} style={{ fontSize: 13, color: accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Limpar</button>
              </>
            ) : (
              <>
                <div style={{ display: 'inline-flex', marginBottom: 12 }}><Icon name="users" size={36} color="#cbd5e1" /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120', marginBottom: 8 }}>{cfg.emptyPeopleMsg}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Adicione o primeiro {noun}, ou importe de uma folha (CSV).</div>
                <button onClick={() => setShowAdd(true)} style={{ background: accent, color: 'white', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{cfg.addPersonCta} →</button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
            {visible.map(p => {
              const mc = medsCount[p.id] || 0, ac = alertCount[p.id] || 0
              const rs = calcRiskScore({ ...p, alerts: ac, meds_count: mc } as any)
              const cr = crCl(p)
              const logged = loggedToday.has(p.id)
              return (
                <div key={p.id} className="pt-card" style={{ position: 'relative', background: 'white', border: '1px solid #e9eaec', borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.15s, transform 0.12s' }}>
                  <Link href={`/patients/${p.id}`} style={{ display: 'block', padding: '16px 18px', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: accentSoft, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{p.name.charAt(0).toUpperCase()}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[p.age ? `${p.age}a` : null, p.sex, p.room_number ? `Q ${p.room_number}` : null].filter(Boolean).join(' · ') || 'Sem dados'}
                        </div>
                      </div>
                      {rs >= 45 && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rs >= 70 ? '#991b1b' : '#854d0e', background: rs >= 70 ? '#fee2e2' : '#fef9c3', border: `1px solid ${rs >= 70 ? '#fecaca' : '#fde68a'}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>{rs >= 70 ? 'CRÍTICO' : 'ALTO'}</span>}
                    </div>

                    {/* crachás reais */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 22 }}>
                      {ac > 0 && <Badge color="#991b1b" bg="#fee2e2" border="#fca5a5">{ac} {ac === 1 ? 'alerta' : 'alertas'}</Badge>}
                      {mc >= 5 && <Badge color="#854d0e" bg="#fef9c3" border="#fde68a">Polimedicado</Badge>}
                      {p.allergies && <Badge color="#dc2626" bg="#fee2e2" border="#fca5a5">⚠ Alergia</Badge>}
                      {cr != null && cr < 60 && <Badge color={cr < 30 ? '#991b1b' : '#b45309'} bg={cr < 30 ? '#fee2e2' : '#fef3c7'} border={cr < 30 ? '#fca5a5' : '#fde68a'}>CrCl {cr}</Badge>}
                      {mc > 0 && <Badge color="#475569" bg="#f1f5f9" border="#e2e8f0">{mc} med.</Badge>}
                    </div>
                    {p.conditions && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 10, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.conditions}</div>}
                  </Link>

                  {/* rodapé: registo de hoje + remover */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: logged ? '#15803d' : '#94a3b8' }}>
                      {logged ? '✓ Com registo hoje' : '○ Sem registo hoje'}
                    </span>
                    <button onClick={() => archivePatient(p.id, p.name)} title={`Arquivar ${noun}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 12, fontWeight: 700 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#b45309')} onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}>Arquivar</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Arquivados — repor um utente arquivado. Só aparece se houver algum. */}
        {archived.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <button onClick={() => setShowArchived(s => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'var(--font-sans)' }}>
              {showArchived ? '▾' : '▸'} Arquivados ({archived.length})
            </button>
            {showArchived && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {archived.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#f9fafb', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 13px' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{a.name}</span>
                    <button onClick={() => restorePatient(a.id)} style={{ background: 'white', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Repor</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
            <button onClick={addPatient} disabled={!newP.nome?.trim() || adding} style={{ flex: 1, background: accent, color: 'white', border: 'none', borderRadius: 9, padding: '12px', fontSize: 14, fontWeight: 700, cursor: newP.nome?.trim() ? 'pointer' : 'not-allowed', opacity: newP.nome?.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>{adding ? 'A criar…' : 'Criar ficha →'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '12px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 14, cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Modal: importar */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)} title={`Importar ${nounPlural}`} accent={accent} wide>
          {!importPreview ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${accent}`, borderRadius: 12, padding: '38px 24px', cursor: 'pointer', background: accentSoft, gap: 10 }}>
                <span style={{ fontSize: 32 }}>📄</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>Selecionar ficheiro CSV ou Excel</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>.csv, .xlsx ou .xls · exportado do Excel ou de outro sistema · até 500 {nounPlural}</span>
                <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleCSVFile} style={{ display: 'none' }} />
              </label>
              {importError && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>{importError}</div>}
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Primeira linha = cabeçalho. Exemplo:</div>
                <code style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)', display: 'block', lineHeight: 1.7 }}>Nome, Idade, Sexo, {cfg.roomLabel || 'Sala'}, Diagnósticos, Alergias<br/>Maria Silva, 82, F, 12A, HTA; DM2, Penicilina</code>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#15803d', fontWeight: 700 }}>
                {importPreview.rows.length} {importPreview.rows.length === 1 ? noun : nounPlural} · colunas: {Object.keys(importPreview.mapping).join(', ')}
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'auto', maxHeight: 260, marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#f8fafc' }}>{importPreview.headers.map((h, i) => <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>{importPreview.rows.slice(0, 8).map((row, i) => <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>{row.map((c, j) => <td key={j} style={{ padding: '7px 10px', color: '#475569', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {importLoading && <div style={{ padding: 11, background: accentSoft, borderRadius: 8, marginBottom: 12, fontSize: 13, color: accent, fontWeight: 700 }}>A importar… {importDone}/{importPreview.rows.length}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={doImport} disabled={importLoading} style={{ flex: 1, padding: 12, background: importLoading ? '#94a3b8' : accent, color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: importLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{importLoading ? 'A importar…' : `Importar ${importPreview.rows.length} →`}</button>
                <button onClick={() => { setImportPreview(null); setImportError('') }} disabled={importLoading} style={{ padding: '12px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}>Voltar</button>
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
    </div>
  )
}

function Badge({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '2px 7px', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
}

function Modal({ children, onClose, title, accent, wide }: { children: React.ReactNode; onClose: () => void; title: string; accent: string; wide?: boolean }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,24,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 26, width: '100%', maxWidth: wide ? 620 : 520, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(8,12,24,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: accent, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

