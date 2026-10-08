'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { reportError, MSG } from '@/lib/clientError'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import ModelosDeDocumentos from '@/components/institution/ModelosDeDocumentos'
// A auditoria vive na rota /auditoria, que so redirecciona para ca. Durante
// meses apontou para `?tab=auditoria` — uma aba que esta pagina nunca teve,
// pelo que quem clicava aterrava nos modelos. Agora existe.
import { AuditoriaTool } from '@/app/auditoria/page'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, Campo, Folha, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

// /documentos = cofre de documentos da instituição, só isso. (A auditoria vive no
// /painel-dono "quem fez o quê"; a notificação RAM em /adr-report.)
export default function DocumentosPage() {
  return <DocumentosTool />
}

type Cat = 'contrato' | 'consentimento' | 'identificacao' | 'medico' | 'seguro' | 'rgpd' | 'financeiro' | 'outro'
interface Patient { id: string; name: string; active?: boolean }
interface Doc { id: string; patient_id?: string | null; name: string; category: Cat; file_path: string; expiry_date?: string | null; notes?: string | null; created_at: string }

/* A CATEGORIA DE UM DOCUMENTO E UM FACTO, NAO UM ESTADO (2026-10-07)
   Cada uma tinha a sua cor — e uma delas, o «Seguro», era um `var(--green)` azul
   que nao existe em mais lado nenhum da aplicacao. Oito cores a dizer «que
   tipo de papel e este», a competir com as tres que dizem se ha um problema.

   O que tem de saltar a vista num cofre de documentos e a VALIDADE: o que
   expirou e o que expira este mes. Essas, sim, sao estado — e ficam com o
   vermelho e o ambar so para elas. A categoria le-se em quatro letras. */
const CATS: Record<Cat, { label: string; codigo: string }> = {
  contrato:      { label: 'Contrato',      codigo: 'CONT' },
  consentimento: { label: 'Consentimento', codigo: 'CONS' },
  identificacao: { label: 'Identificação', codigo: 'IDEN' },
  medico:        { label: 'Médico',        codigo: 'MED' },
  seguro:        { label: 'Seguro',        codigo: 'SEG' },
  rgpd:          { label: 'RGPD',          codigo: 'RGPD' },
  financeiro:    { label: 'Financeiro',    codigo: 'FIN' },
  outro:         { label: 'Outro',         codigo: 'OUTR' },
}
const CAT_KEYS = Object.keys(CATS) as Cat[]
const ddmmaaaa = (iso?: string | null) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—'
const daysTo = (d?: string | null) => d ? Math.round((new Date(d).getTime() - Date.now()) / 86400000) : null

function DocumentosTool() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('documentos', 'editar')
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const person = cfg.personNoun
  const personLower = person.toLowerCase()
  const largo = useLargo()
  const [patients, setPatients] = useState<Patient[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  // Duas vistas. O cofre e o que esta pagina sempre foi: ficheiros guardados.
  // Os modelos sao o contrario — texto que ainda nao e documento de ninguem e
  // que se preenche na hora. Misturar as duas coisas na mesma lista fazia um
  // «contrato» significar duas coisas diferentes na mesma linha.
  /* O `?tab=` vinha a ser ignorado — e a rota /auditoria redirecciona para
     `?tab=auditoria` justamente para cair aqui. Sem isto, o redireccionamento
     existia e nao fazia nada. */
  const sp = useSearchParams()
  const pedida = sp?.get('tab')
  const [vista, setVista] = useState<'cofre' | 'modelos' | 'auditoria'>(
    pedida === 'cofre' || pedida === 'auditoria' || pedida === 'modelos' ? pedida : 'modelos')
  const [search, setSearch] = useState('')
  const [expFilter, setExpFilter] = useState<'all' | 'expiring' | 'expired'>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const blank = { patient_id: '', name: '', category: 'contrato' as Cat, expiry_date: '', notes: '' }
  const [form, setForm] = useState<any>(blank)
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, d] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,active')).order('name'),
      scope.filter(supabase.from('documents').select('*')).order('created_at', { ascending: false }),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    if (d.error) { setTableMissing(true); setDocs([]) } else { setTableMissing(false); setDocs(d.data || []) }
    setLoading(false)
    // `scope.orgId` TEM de estar aqui: chega depois do primeiro render, e sem
    // ele a unica leitura corria filtrada por `user_id` — cada pessoa via so
    // os documentos que ela propria tinha carregado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['documents', 'patients'], userId: scope.liveFilterValue || user?.id, onChange: load })

  const nameOf = (id?: string | null) => id ? (patients.find(p => p.id === id)?.name || person) : cfg.unitNoun

  async function save() {
    if (!user || !form.name.trim() || !file) { setErr('Nome e ficheiro são obrigatórios.'); return }
    if (!podeEditar) { setErr('A sua conta é só de leitura.'); return }
    setSaving(true); setErr('')
    try {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
      const path = `${user.id}/${form.patient_id || 'instituicao'}/${Date.now()}.${ext}`
      const { error: up } = await supabase.storage.from('documents').upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (up) throw up
      const { error: insErr } = await supabase.from('documents').insert(scope.stamp({ patient_id: form.patient_id || null, name: form.name.trim(), category: form.category, file_path: path, expiry_date: form.expiry_date || null, notes: form.notes || null }))
      if (insErr) throw insErr
      setShowForm(false); setForm(blank); setFile(null); load()
    } catch (e: any) {
      setErr(reportError('documentos-upload', e, MSG.save))
    } finally { setSaving(false) }
  }
  async function open(d: Doc) {
    const { data, error: erroLeitura } = await supabase.storage.from('documents').createSignedUrl(d.file_path, 120)
    if (erroLeitura) reportError('documentos-signed-url', erroLeitura)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('Não foi possível abrir o documento.')
  }
  async function remove(d: Doc) {
    if (!confirm(`Eliminar "${d.name}"?`)) return
    await supabase.storage.from('documents').remove([d.file_path]).catch(() => {})
    await supabase.from('documents').delete().eq('id', d.id)
    load()
  }

  const matchesExp = (d: Doc, f: 'all' | 'expiring' | 'expired') => {
    if (f === 'all') return true
    const n = daysTo(d.expiry_date)
    if (n == null) return false
    return f === 'expired' ? n < 0 : (n >= 0 && n <= 30)
  }
  const filtered = docs.filter(d =>
    (!search || d.name.toLowerCase().includes(search.toLowerCase()) || nameOf(d.patient_id).toLowerCase().includes(search.toLowerCase()))
    && matchesExp(d, expFilter)
  )
  const expiring = docs.filter(d => { const n = daysTo(d.expiry_date); return n != null && n >= 0 && n <= 30 }).length
  const expired = docs.filter(d => { const n = daysTo(d.expiry_date); return n != null && n < 0 }).length

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Os documentos estavam agrupados POR PESSOA, em cartões. Com trinta utentes
     e três documentos cada são trinta cabeçalhos e noventa cartões — três mil
     pixéis de rolar.

     E a pergunta que se faz a um cofre de documentos é quase sempre a outra:
     «o que é que está prestes a expirar?». Passa a uma tabela ordenada pela
     VALIDADE — o que já expirou em cima, o que expira dentro de trinta dias a
     seguir, e o resto por baixo. A pessoa é uma coluna.
     ══════════════════════════════════════════════════════════════════════════ */
  const porValidade = [...filtered].sort((a, b) => {
    const na = daysTo(a.expiry_date), nb = daysTo(b.expiry_date)
    // Sem validade vai para o fim: não é urgente, é um documento que não caduca.
    if (na == null && nb == null) return b.created_at.localeCompare(a.created_at)
    if (na == null) return 1
    if (nb == null) return -1
    return na - nb
  })

  /* A AUDITORIA TRAZ A SUA PRÓPRIA MESA.
     Pô-la dentro desta dava duas barras de trabalho e duas barras de estado
     empilhadas — e a de cima a falar de documentos enquanto a de baixo falava
     de hashes. Sai antes, com os separadores por cima. */
  if (vista === 'auditoria') {
    return (
      <>
        <TiraDeVistas vista={vista} aoMudar={setVista} />
        <AuditoriaTool />
      </>
    )
  }

  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Documentos</span>

          <Seletor
            opcoes={[
              { id: 'modelos', rotulo: 'Modelos' },
              { id: 'cofre', rotulo: 'Guardados' },
              { id: 'auditoria', rotulo: 'Auditoria' },
            ]}
            ativa={vista} aoMudar={v => setVista(v as 'cofre' | 'modelos' | 'auditoria')} />

          {vista === 'cofre' && (
            <>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Procurar documento ou ${personLower}…`} aria-label="Procurar"
                style={{ ...CAIXA, width: 250 }} />

              {!loading && (expired > 0 || expiring > 0) && (
                <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                  {expired > 0 && (
                    <Botao onClick={() => setExpFilter(f => f === 'expired' ? 'all' : 'expired')}
                      feitio={expFilter === 'expired' ? 'principal' : 'contorno'}>
                      {expired} EXPIRADO{expired === 1 ? '' : 'S'}
                    </Botao>
                  )}
                  {expiring > 0 && (
                    <Botao onClick={() => setExpFilter(f => f === 'expiring' ? 'all' : 'expiring')}
                      feitio={expFilter === 'expiring' ? 'principal' : 'contorno'}>
                      {expiring} A EXPIRAR EM 30 DIAS
                    </Botao>
                  )}
                </span>
              )}
            </>
          )}

          {vista === 'cofre' && podeEditar && (
            <div style={{ marginLeft: 'auto' }}>
              <Botao feitio="principal"
                onClick={() => { setForm(blank); setFile(null); setErr(''); setShowForm(true) }}>
                + DOCUMENTO
              </Botao>
            </div>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        vista === 'cofre' ? (
          <BarraDeEstado>
            <span style={{ ...MONO, color: 'var(--red)' }}>EXPIRADO = já passou a validade</span>
            <span style={{ ...MONO, color: 'var(--amber)' }}>A EXPIRAR = menos de 30 dias</span>
            <span style={{ ...MONO, color: 'var(--ink-5)' }}>
              Contratos, consentimentos, RGPD e relatórios — por {personLower} e da instituição
            </span>
          </BarraDeEstado>
        ) : undefined
      }
    >
      {vista === 'modelos' ? (
        <Painel>
          <div style={{ padding: 14 }}><ModelosDeDocumentos cor="var(--green)" /></div>
        </Painel>
      ) : tableMissing ? (
        <Painel>
          <Vazio titulo="O cofre de documentos ainda não está disponível nesta conta."
            oQueFazer="Falta um passo de configuração desta casa. Os modelos, ao lado, continuam a funcionar." />
        </Painel>
      ) : (
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, width: 80, textAlign: 'right' }}>Validade</span>
              <span style={{ ...ROTULO, flex: 1 }}>Documento</span>
              <span style={{ ...ROTULO, width: 52 }}>Tipo</span>
              <span style={{ ...ROTULO, width: 150 }}>De quem</span>
              <span style={{ ...ROTULO, width: 80, textAlign: 'right' }}>Guardado</span>
              <span style={{ ...ROTULO, width: 130 }}> </span>
            </Cabecalho>
          }
          rodape={
            <>
              <span style={MONO}>{porValidade.length} de {docs.length}</span>
              {(search || expFilter !== 'all') && (
                <button onClick={() => { setSearch(''); setExpFilter('all') }} style={{
                  ...MONO, fontSize: 'var(--t-meta)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--green)',
                }}>LIMPAR OS FILTROS</button>
              )}
            </>
          }
        >
          {loading ? (
            <ACarregar oQue="A abrir o cofre…" />
          ) : porValidade.length === 0 ? (
            <Vazio
              titulo={docs.length === 0 ? 'Ainda não há documentos guardados.' : 'Nenhum corresponde ao filtro.'}
              oQueFazer={docs.length === 0
                ? 'Contratos, consentimentos e documentos de identificação. Os que têm validade passam a avisar sozinhos trinta dias antes.'
                : 'Experimente limpar a pesquisa ou o filtro de validade.'}
              acao={docs.length === 0 && podeEditar
                ? <Botao feitio="principal" onClick={() => { setForm(blank); setFile(null); setErr(''); setShowForm(true) }}>+ DOCUMENTO</Botao>
                : undefined} />
          ) : porValidade.map(d => {
            const cc = CATS[d.category] || CATS.outro
            const n = daysTo(d.expiry_date)
            const expirado = n != null && n < 0
            const aExpirar = n != null && n >= 0 && n <= 30
            return (
              <LinhaTabela key={d.id}
                filete={expirado ? 'var(--red)' : aExpirar ? 'var(--amber)' : undefined}
                antes={{
                  largura: 80,
                  conteudo: (
                    <span style={{
                      ...MONO, fontSize: 'var(--t-dado)', display: 'block',
                      textAlign: largo ? 'right' : 'left',
                      fontWeight: (expirado || aExpirar ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
                      color: expirado ? 'var(--red)' : aExpirar ? 'var(--amber)' : 'var(--ink-4)',
                    }}>
                      {d.expiry_date ? ddmmaaaa(d.expiry_date) : 'não caduca'}
                    </span>
                  ),
                }}
                principal={d.name}
                secundaria={
                  expirado ? `expirou há ${Math.abs(n!)} dia${Math.abs(n!) === 1 ? '' : 's'}`
                    : aExpirar ? `expira daqui a ${n} dia${n === 1 ? '' : 's'}`
                    : undefined
                }
                celulas={[
                  { rotulo: 'Tipo', valor: cc.codigo, largura: 52 },
                  { rotulo: 'De quem', valor: nameOf(d.patient_id || null), largura: 150 },
                  { rotulo: 'Guardado', valor: ddmmaaaa(d.created_at.slice(0, 10)), largura: 80, direita: true, soLargo: true },
                ]}
                fim={
                  <>
                    <Botao onClick={() => open(d)}>ABRIR</Botao>
                    {podeEditar && <Botao feitio="calmo" onClick={() => remove(d)}>APAGAR</Botao>}
                  </>
                } />
            )
          })}
        </Painel>
      )}
    </Mesa>

    {showForm && (
      <Folha titulo="Guardar um documento" aoFechar={() => setShowForm(false)}>
        <Campo rotulo="Nome" para="doc-nome" obrigatorio>
          <input id="doc-nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Contrato de prestação de serviços" style={{ ...CAIXA, width: '100%' }} />
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Tipo" para="doc-cat">
            <select id="doc-cat" value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              {CAT_KEYS.map(c => <option key={c} value={c}>{CATS[c].label}</option>)}
            </select>
          </Campo>
          <Campo rotulo="De quem" para="doc-pessoa">
            <select id="doc-pessoa" value={form.patient_id}
              onChange={e => setForm({ ...form, patient_id: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              <option value="">{cfg.unitNoun}</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Campo>
        </div>

        <Campo rotulo="Validade" para="doc-validade"
          ajuda="Se o documento caduca, ponha a data. Trinta dias antes passa a aparecer no topo da lista — é como um contrato não expira sem ninguém dar por isso.">
          <input id="doc-validade" type="date" value={form.expiry_date}
            onChange={e => setForm({ ...form, expiry_date: e.target.value })} style={{ ...CAIXA, width: '100%' }} />
        </Campo>

        <Campo rotulo="Ficheiro" obrigatorio ajuda="PDF, imagem ou documento do Word.">
          <label className="mesa-botao" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '0 14px', border: '1px dashed var(--border-2)',
            borderRadius: 'var(--r-md)', cursor: 'pointer',
            ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
            color: file ? 'var(--ink)' : 'var(--ink-4)',
          }}>
            {file ? file.name : 'ESCOLHER O FICHEIRO'}
            <input type="file" accept=".pdf,image/*,.doc,.docx" style={{ display: 'none' }}
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </Campo>

        {err && <div style={{ marginTop: 10 }}><Aviso tom="mau">{err}</Aviso></div>}

        <div style={{ marginTop: 16 }}>
          <Botao feitio="principal" onClick={save} esperando={saving}
            disabled={!form.name.trim() || !file}>
            GUARDAR O DOCUMENTO
          </Botao>
        </div>
      </Folha>
    )}
    </>
  )
}

/** Os três separadores desta página, para a auditoria os poder mostrar também. */
function TiraDeVistas({ vista, aoMudar }: {
  vista: 'cofre' | 'modelos' | 'auditoria'
  aoMudar: (v: 'cofre' | 'modelos' | 'auditoria') => void
}) {
  return (
    <div style={{
      display: 'flex', gap: 2, alignItems: 'stretch', flexWrap: 'wrap',
      background: 'var(--bg)', borderBottom: '1px solid var(--border)',
      padding: '0 clamp(10px, 1.2vw, 16px)',
    }}>
      {([['modelos', 'Modelos'], ['cofre', 'Guardados'], ['auditoria', 'Auditoria']] as const).map(([id, rotulo]) => {
        const on = vista === id
        return (
          <button key={id} onClick={() => aoMudar(id)} aria-current={on ? 'page' : undefined} style={{
            display: 'flex', alignItems: 'center', height: 38, padding: '0 14px',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: `2px solid ${on ? 'var(--green)' : 'transparent'}`, marginBottom: -1,
            fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', letterSpacing: '.08em',
            textTransform: 'uppercase',
            fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
            color: on ? 'var(--green)' : 'var(--ink-4)',
          }}>{rotulo}</button>
        )
      })}
    </div>
  )
}
