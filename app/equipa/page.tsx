'use client'

// /equipa — Gestão da equipa da instituição (só dono/admin).
// • Sem organização ainda → formulário para criar a instituição (fase de testes,
//   sem Stripe). • Com organização → lista a equipa, permite adicionar funcionários
//   de duas formas (gerar login na hora OU convidar por email), e ver convites
//   pendentes. As credenciais geradas mostram-se UMA vez, prontas a imprimir.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs, INST_META, OFFERED_INSTITUTIONS } from '@/lib/useClinicPrefs'
import EscalasEquipa from '@/components/team/EscalasEquipa'
import MuralEquipa from '@/components/team/MuralEquipa'
import AcessosPessoa from '@/components/team/AcessosPessoa'
import {
  resumoCurto, PAPEL_ANTIGO_PARA_NOVO, PAPEIS_ATRIBUIVEIS,
  normalizarPapel, permissoesDe, pode,
} from '@/lib/permissoes'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, Campo, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import PerfisDeAcesso from '@/components/team/PerfisDeAcesso'

/* O acento era turquesa (var(--green-3)), a unica cor da aplicacao fora dos tokens.
   Desde 2026-10-07 e o verde da casa, como em todo o resto. */
const ACCENT = 'var(--green)'
/* ── O «PERFIS DE ACESSO» DEIXOU DE SER UM SEPARADOR (2026-10-14) ─────────
   «Não quero que coloques mais um menu de "perfis de acesso", isso é
    claramente algo para adicionar à parte dos acessos e contas.» (Fernando)

   Tinha razão. Um perfil de acesso não é um assunto — é uma forma de dar
   acessos a várias pessoas de uma vez. Pô-lo num separador próprio obrigava a
   sair da lista de pessoas para o criar e a voltar para o aplicar, quando as
   duas coisas são o mesmo trabalho e se fazem olhando para a mesma lista.

   Agora vive dentro de «Conta e acesso», por baixo das pessoas, que é onde a
   pergunta nasce: estou a olhar para dez pessoas com a mesma função e quero
   dar-lhes o mesmo. */
type PageTab = 'conta' | 'escalas' | 'mural'

// Os papéis que se podem dar a alguém, tirados de lib/permissoes — que é também
// de onde sai o SQL. Escrever a lista aqui à mão foi o que fez esta página
// oferecer 'assistant' e 'nurse' durante meses enquanto a base de dados tinha
// onze papéis diferentes.
const ROLES = PAPEIS_ATRIBUIVEIS.map(p => ({ id: p.id, label: p.label, hint: p.descricao }))

interface Member { user_id: string; role: string; name: string; email: string; department?: string }
interface Invite { email: string; role: string; created_at: string }
interface GenLogin { name: string; username: string; password: string; role: string }

export default function EquipaPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()

  // Aceita ?tab=conta|escalas|mural e o antigo ?tab=team|schedule|tarefas|config
  // (do /schedule) para não partir favoritos/links antigos.
  const largo = useLargo()
  const [tab, setTab] = useState<PageTab>('conta')
  // A pessoa cujos acessos estão abertos. Ver components/team/AcessosPessoa.
  const [acessosDe, setAcessosDe] = useState<Member | null>(null)
  const [escalasSubTab, setEscalasSubTab] = useState<'team' | 'schedule' | 'tarefas' | 'config' | undefined>(undefined)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (q === 'mural') setTab('mural')
    else if (q === 'escalas') setTab('escalas')
    // "cobertura" fica como link antigo silencioso — pousa em Escalas em vez de rebentar.
    else if (q === 'cobertura') setTab('escalas')
    else if (['team', 'schedule', 'tarefas', 'config'].includes(q || '')) { setTab('escalas'); setEscalasSubTab(q as any) }
    // ?tab=definicoes — abre já a secção "Definições da instituição" (link
    // direto do HUB em /painel-dono, 2026-08-09: substitui /comecar-instituicao,
    // que era o assistente de CRIAR uma instituição, não de a configurar).
    else if (q === 'definicoes') { setTab('conta'); setShowSettings(true) }
  }, [])

  const [loading, setLoading] = useState(true)
  const [noKey, setNoKey] = useState(false)
  // Aviso para o dev: uma vez por montagem, e como info. Não é uma avaria.
  useEffect(() => { if (noKey) console.info('[phlox:equipa] sem chave de serviço — criação de contas de equipa desligada') }, [noKey])
  const [org, setOrg] = useState<{ id: string; name: string; kind: string } | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [team, setTeam] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // formulário criar org
  const [orgName, setOrgName] = useState('')
  const [orgKind, setOrgKind] = useState(institution || 'day_care')

  // editar a instituição existente (renomear / mudar tipo)
  const [showSettings, setShowSettings] = useState(false)

  // adicionar membro
  const [addMode, setAddMode] = useState<'generate' | 'invite'>('generate')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('auxiliar')
  const [lastLogin, setLastLogin] = useState<GenLogin | null>(null)
  const [inviteMsg, setInviteMsg] = useState('')

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    try {
      const h = await auth()
      const s = await fetch('/api/org/setup', { headers: h }).then(r => r.json())
      setNoKey(!!s.noServiceKey)
      setOrg(s.org || null); setMyRole(s.role || null)
      if (s.org) {
        const t = await fetch('/api/org/team', { headers: h }).then(r => r.json())
        if (t.error) setErr(t.error)
        else { setTeam(t.team || []); setInvites(t.invites || []) }
      }
    } catch (e: any) { setErr(e.message || 'Erro ao carregar.') }
    setLoading(false)
  }, [user, auth])

  useEffect(() => { loadAll() }, [loadAll])

  async function createOrg() {
    if (!orgName.trim()) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/org/setup', { method: 'POST', headers: await auth(), body: JSON.stringify({ name: orgName.trim(), kind: orgKind }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      try { localStorage.setItem('phlox-clinic-institution', orgKind) } catch {}
      // A instituição foi criada; um ajuste de esquema do lado do servidor
      // afina o tipo — irrelevante para o cliente, só se regista para o dev.
      if (d.kindConstraintOutdated) console.error('[phlox:org-setup-kind] kindConstraintOutdated')
      await loadAll()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }


  async function addMember() {
    setBusy(true); setErr(''); setLastLogin(null)
    try {
      const payload = addMode === 'generate'
        ? { mode: 'generate', name: newName.trim(), role: newRole }
        : { mode: 'invite', email: newEmail.trim(), role: newRole }
      const r = await fetch('/api/org/team', { method: 'POST', headers: await auth(), body: JSON.stringify(payload) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      if (d.mode === 'generate') setLastLogin(d.login)
      if (d.mode === 'added') { setInviteMsg(`${d.name || d.email} já tinha conta Phlox — foi adicionado/a à equipa com acesso imediato.`); setTimeout(() => setInviteMsg(''), 6000) }
      if (d.mode === 'invite') { setInviteMsg(`Convite enviado para ${d.email}. Vai receber um email para criar a conta.`); setTimeout(() => setInviteMsg(''), 6000) }
      setNewName(''); setNewEmail('')
      await loadAll()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function removeMember(id: string) {
    if (!confirm('Remover este membro da equipa? Deixa de ter acesso.')) return
    setBusy(true)
    try {
      const r = await fetch('/api/org/team', { method: 'DELETE', headers: await auth(), body: JSON.stringify({ memberUserId: id }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      await loadAll()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  function printLogin(l: GenLogin) {
    const w = window.open('', '_blank'); if (!w) return
    const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
    const name = esc(l.name), username = esc(l.username), password = esc(l.password)
    w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Acesso — ${name}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{font-size:20px;font-family:Georgia,serif}
      .box{border:2px solid #0d9488;border-radius:10px;padding:20px;max-width:380px;margin-top:16px}
      .row{margin:10px 0}.lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.1em}
      .val{font-size:20px;font-family:monospace;font-weight:700}</style></head><body>
      <h1>Acesso ao Phlox — ${name}</h1>
      <p style="font-size:13px;color:#555">Entre em phloxclinical.com com estes dados. Troque a palavra-passe depois de entrar.</p>
      <div class="box">
        <div class="row"><div class="lbl">Utilizador</div><div class="val">${username}</div></div>
        <div class="row"><div class="lbl">Palavra-passe</div><div class="val">${password}</div></div>
      </div></body></html>`)
    w.document.close(); setTimeout(() => { w.focus(); w.print() }, 300)
  }

  if (!user) return null

  // Comparava `myRole === 'owner' || myRole === 'admin'`. Depois do sprint152 o
  // papel é `dono`/`direcao`, e isto ficava FALSO para toda a gente — a página
  // da equipa trancava-se ao próprio dono.
  //
  // E a pergunta certa nunca foi «que papel tem». É «pode gerir a equipa»,
  // que é o que a Direção Técnica pode ter tirado a alguém.
  const papelNaCasa = normalizarPapel(myRole)
  const isManager = !!papelNaCasa && pode(permissoesDe(papelNaCasa), 'equipa', 'editar')

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     A página chama-se «Equipa» e a lista das pessoas estava em último: para
     ver quem trabalha na casa era preciso rolar por cima do atalho ao painel
     do dono, de dezoito campos de configuração da instituição e do formulário
     de adicionar alguém.

     Passa a duas colunas, e a ordem é a da pergunta:

       ESQUERDA   quem trabalha aqui       — sempre visível
       DIREITA    o que se está a fazer    — adicionar, ou as definições

     No telemóvel empilham, com a equipa primeiro.
     ══════════════════════════════════════════════════════════════════════════ */
  /* A aba dos perfis só aparece a quem pode dar acessos. Para quem não pode,
     não é uma aba cinzenta — não existe: uma aba que se vê e não se abre é
     uma promessa por cumprir. */
  const abas: PageTab[] = ['conta', 'escalas', 'mural']
  const ROTULO_ABA: Record<PageTab, string> = {
    conta: 'Conta e acesso',
    escalas: 'Escalas e turnos', mural: 'Mural',
  }

  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{ ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
            Equipa
          </span>

          <span style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>
            {org ? org.name : 'A sua instituição'}
          </span>

          {org && (
            <Seletor
              opcoes={abas.map(t => ({ id: t, rotulo: ROTULO_ABA[t] }))}
              ativa={tab} aoMudar={t => setTab(t as PageTab)} />
          )}

          {/* Enquanto nao se sabe, nao se diz. Dizer «0 PESSOAS» durante o
              carregamento e afirmar uma coisa falsa sobre a casa de alguem. */}
          {org && tab === 'conta' && !loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {team.length} PESSOA{team.length === 1 ? '' : 'S'}
              </span>
              {invites.length > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
                  {invites.length} CONVITE{invites.length === 1 ? '' : 'S'} POR ACEITAR
                </span>
              )}
            </span>
          )}

          {org && isManager && tab === 'conta' && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Botao onClick={() => setShowSettings(s => !s)}>
                {showSettings ? 'FECHAR AS DEFINIÇÕES' : 'DEFINIÇÕES DA CASA'}
              </Botao>
              <Link href="/painel-dono" style={{ textDecoration: 'none' }}>
                <Botao>PAINEL ADMINISTRATIVO →</Botao>
              </Link>
            </div>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        tab === 'conta' ? (
          <BarraDeEstado>
            <span style={MONO}>A função decide o que cada pessoa vê e pode mudar</span>
            <span style={{ ...MONO, color: 'var(--green)' }}>DONO = nunca se limita a si próprio</span>
            <span style={{ ...MONO, color: 'var(--amber)' }}>CONVITE = ainda não entrou</span>
            <span style={{ ...MONO, color: 'var(--ink-5)' }}>
              Acessos = afinar área a área, por cima da função
            </span>
          </BarraDeEstado>
        ) : undefined
      }
    >
      {err && <Aviso tom="mau">{err}</Aviso>}

      {/* As escalas e o mural são ecrãs inteiros próprios. Os perfis de acesso
          já não: vivem dentro de «Conta e acesso» — ver a nota no `PageTab`. */}
      {tab === 'escalas' && org ? (
        <Painel><div style={{ padding: 14 }}><EscalasEquipa initialSubTab={escalasSubTab} /></div></Painel>
      ) : tab === 'mural' && org ? (
        <Painel><div style={{ padding: 14 }}><MuralEquipa /></div></Painel>
      ) : loading ? (
        <Painel><ACarregar oQue="A carregar a equipa…" /></Painel>
      ) : noKey ? (
        /* A criação de contas não está ativa nesta conta. Isto é configuração
           do servidor, não culpa de quem está a usar — a frase não leva
           detalhe técnico nenhum. */
        <Painel>
          <Vazio titulo="Contas de equipa a caminho."
            oQueFazer="A criação de contas para os funcionários ainda não está ativa nesta conta. Fale connosco e ativamos num instante — entretanto pode continuar a usar o Phlox normalmente." />
        </Painel>
      ) : !org ? (
        /* ══ AINDA NÃO HÁ CASA ══════════════════════════════════════════════ */
        <Painel cabeca={<Cabecalho><span style={{ ...ROTULO, flex: 1 }}>Criar a instituição</span></Cabecalho>}>
          <div style={{ padding: 14, maxWidth: 520 }}>
            <Campo rotulo="Nome da instituição" para="org-name-create" obrigatorio>
              <input id="org-name-create" value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="Ex: Centro de Dia São José" style={{ ...CAIXA, width: '100%' }} />
            </Campo>
            <Campo rotulo="Tipo">
              <Seletor
                opcoes={OFFERED_INSTITUTIONS.map(k => ({ id: k, rotulo: INST_META[k].label }))}
                ativa={orgKind} aoMudar={k => setOrgKind(k)} />
            </Campo>
            <div style={{ marginTop: 14 }}>
              <Botao feitio="principal" onClick={createOrg} esperando={busy} disabled={!orgName.trim()}>
                CRIAR INSTITUIÇÃO →
              </Botao>
            </div>
          </div>
        </Painel>
      ) : (
        <div style={{
          display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
          gridTemplateColumns: largo ? 'minmax(400px, 1fr) minmax(360px, 480px)' : '1fr',
        }}>
          {/* ══ QUEM TRABALHA AQUI ════════════════════════════════════════════ */}
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>Nome · email</span>
                <span style={{ ...ROTULO, width: 150 }}>Função</span>
                <span style={{ ...ROTULO, width: 140, textAlign: 'right' }}>Acesso</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{team.length} na equipa · {invites.length} por aceitar</span>}
          >
            {team.length === 0 ? (
              <Vazio titulo="Ainda não há mais ninguém na equipa."
                oQueFazer="Adicione a primeira pessoa ao lado: o Phlox pode gerar o login na hora, ou enviar um convite por email." />
            ) : team.map(m => {
              const papel = PAPEL_ANTIGO_PARA_NOVO[m.role] || m.role
              const ehDono = ['owner', 'dono'].includes(m.role)
              return (
                <LinhaTabela key={m.user_id}
                  principal={m.name}
                  secundaria={m.email || '—'}
                  celulas={[{ rotulo: 'Função', valor: resumoCurto(papel), largura: 150 }]}
                  fim={
                    ehDono ? <Codigo texto="DONO" cor="var(--green)" />
                      : isManager ? (
                        <>
                          <Botao onClick={() => setAcessosDe(m)}>ACESSOS</Botao>
                          <Botao feitio="calmo" onClick={() => removeMember(m.user_id)}>TIRAR</Botao>
                        </>
                      ) : undefined
                  } />
              )
            })}

            {invites.length > 0 && (
              <>
                <div style={{
                  padding: '6px 12px', background: 'var(--bg-2)',
                  borderTop: '1px solid var(--border-2)', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={ROTULO}>Convites por aceitar</span>
                </div>
                {invites.map((iv, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ flex: 1, ...MONO, fontSize: 'var(--t-dado)', color: 'var(--ink-3)' }}>{iv.email}</span>
                    <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{roleLabel(iv.role)}</span>
                    <Codigo texto="POR ACEITAR" cor="var(--amber)" />
                  </div>
                ))}
              </>
            )}
          </Painel>

          {/* ══ O QUE SE ESTÁ A FAZER ═════════════════════════════════════════ */}
          {isManager ? (
            <Painel
              cabeca={
                <Cabecalho>
                  <span style={{ ...ROTULO, flex: 1 }}>
                    {showSettings ? 'Definições da instituição' : 'Adicionar funcionário'}
                  </span>
                </Cabecalho>
              }
            >
              {showSettings ? (
                /* ── AS DEFINIÇÕES DA CASA MUDARAM-SE PARA AS DEFINIÇÕES ───
                   Eram dezoito campos aqui dentro: o nome da instituição, a
                   morada, a lotação, a mensalidade por utente, o endereço da
                   página pública, o logótipo e a cor de marca.

                   Nenhuma dessas coisas é uma pessoa, e esta página chama-se
                   «Equipa». Quem procurava a mensalidade da casa procurava-a
                   nas Definições, não a encontrava, e concluía que não existia.

                   Ficam em /settings?tab=casa. O botão fica, porque quem
                   procurava aqui tem de saber para onde foram — um botão que
                   desaparece ensina menos do que um que aponta. */
                <div style={{ padding: 14 }}>
                  <Vazio titulo="As definições da instituição mudaram de sítio."
                    oQueFazer="O nome, a morada, a lotação, a mensalidade, a página pública e a marca estão agora nas Definições. Esta página fica com quem trabalha na casa."
                    acao={<Link href="/settings?tab=casa" style={{ textDecoration: 'none' }}>
                      <Botao feitio="principal">ABRIR AS DEFINIÇÕES DA CASA →</Botao>
                    </Link>} />
                </div>
              ) : (
                <div style={{ padding: 14 }}>
                  {/* Duas maneiras de dar acesso, e a diferença importa: gerar
                      um login na hora serve a auxiliar que não usa email; o
                      convite serve quem já tem conta Phlox. */}
                  <Campo rotulo="Como é que esta pessoa entra">
                    <Seletor
                      opcoes={[
                        { id: 'generate', rotulo: 'Gerar login na hora' },
                        { id: 'invite', rotulo: 'Convidar por email' },
                      ]}
                      ativa={addMode} aoMudar={m => setAddMode(m as 'generate' | 'invite')} />
                  </Campo>

                  {addMode === 'generate' ? (
                    <Campo rotulo="Nome do funcionário" para="staff-name"
                      ajuda="O Phlox cria o utilizador e a palavra-passe — entrega-os ao funcionário (pode imprimir).">
                      <input id="staff-name" value={newName} onChange={e => setNewName(e.target.value)}
                        placeholder="Ex: Ana Silva" style={{ ...CAIXA, width: '100%' }} />
                    </Campo>
                  ) : (
                    <Campo rotulo="Email do funcionário" para="staff-email"
                      ajuda="Se já tiver conta Phlox, entra logo na equipa. Senão, recebe um convite por email para a criar.">
                      <input id="staff-email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                        placeholder="ana@exemplo.pt" style={{ ...CAIXA, width: '100%' }} />
                    </Campo>
                  )}

                  <div style={{ ...ROTULO, margin: '14px 0 6px' }}>Função</div>
                  {ROLES.map(r => {
                    const on = newRole === r.id
                    return (
                      <button key={r.id} type="button" onClick={() => setNewRole(r.id)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%',
                          textAlign: 'left', padding: '8px 10px', cursor: 'pointer',
                          border: 'none', borderBottom: '1px solid var(--border)',
                          borderLeft: `3px solid ${on ? 'var(--green)' : 'transparent'}`,
                          background: on ? 'var(--green-light)' : 'transparent',
                          fontFamily: 'inherit',
                        }}>
                        <span aria-hidden style={{
                          ...MONO, fontSize: 'var(--t-meta)', color: on ? 'var(--green)' : 'var(--ink-5)',
                          fontWeight: 'var(--peso-forte)' as any, flexShrink: 0, marginTop: 1,
                        }}>{on ? '●' : '○'}</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{
                            display: 'block', fontSize: 'var(--t-dado)',
                            fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
                          }}>{r.label}</span>
                          <span style={{
                            display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.45,
                          }}>{r.hint}</span>
                        </span>
                      </button>
                    )
                  })}

                  <div style={{ marginTop: 14 }}>
                    <Botao feitio="principal" onClick={addMember} esperando={busy}
                      disabled={addMode === 'generate' ? !newName.trim() : !newEmail.trim()}>
                      {addMode === 'generate' ? 'GERAR ACESSO →' : 'ADICIONAR / CONVIDAR →'}
                    </Botao>
                  </div>

                  {inviteMsg && <div style={{ marginTop: 12 }}><Aviso tom="bom">{inviteMsg}</Aviso></div>}

                  {/* As credenciais mostram-se UMA vez. A frase que o diz não é
                      um aviso decorativo: a palavra-passe não está guardada em
                      sítio nenhum em claro, e não há como voltar a mostrá-la. */}
                  {lastLogin && (
                    <div style={{
                      marginTop: 14, border: '1px solid var(--green)',
                      borderRadius: 'var(--r-sm)', overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '6px 12px', background: 'var(--green-light)',
                        borderBottom: '1px solid var(--green)',
                      }}>
                        <span style={{ ...ROTULO, color: 'var(--green)' }}>
                          Acesso criado — entregue ao funcionário
                        </span>
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span>
                            <span style={{ ...ROTULO, display: 'block', marginBottom: 2 }}>Utilizador</span>
                            <span style={{ ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any }}>
                              {lastLogin.username}
                            </span>
                          </span>
                          <span>
                            <span style={{ ...ROTULO, display: 'block', marginBottom: 2 }}>Palavra-passe</span>
                            <span style={{ ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any }}>
                              {lastLogin.password}
                            </span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Botao feitio="principal" onClick={() => printLogin(lastLogin)}>IMPRIMIR</Botao>
                          <Botao onClick={() => { navigator.clipboard?.writeText(`${lastLogin.username} / ${lastLogin.password}`) }}>
                            COPIAR
                          </Botao>
                        </div>
                        <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: '9px 0 0', lineHeight: 1.5 }}>
                          Guarde isto agora — a palavra-passe não volta a ser mostrada.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Painel>
          ) : largo ? (
            <Painel>
              <Vazio titulo="Só quem gere a equipa pode adicionar ou tirar pessoas."
                oQueFazer="Vê a lista toda, com a função de cada um. Para mudar acessos, fale com a Direção Técnica ou com o dono." />
            </Painel>
          ) : null}

          {/* ── OS PERFIS DE ACESSO, POR BAIXO DAS PESSOAS ─────────────────
              `gridColumn: '1 / -1'` para atravessar as duas colunas: isto não
              é sobre uma pessoa, é sobre a casa toda — e a meio de uma coluna
              de 480px lia-se como se fosse mais um painel lateral de alguém.

              Só para quem gere: quem não pode mudar acessos não tem o que
              fazer com um molde de acessos. */}
          {isManager && (
            <div style={{ gridColumn: '1 / -1' }}>
              <PerfisDeAcesso
                auth={auth}
                /* Nem o Dono nem a própria conta entram na lista de quem recebe
                   um perfil — a rota recusa os dois, e oferecê-los aqui seria
                   prometer uma coisa que o servidor vai negar. */
                pessoas={team
                  .filter(m => (PAPEL_ANTIGO_PARA_NOVO[m.role] || m.role) !== 'dono')
                  .filter(m => m.user_id !== user?.id)
                  .map(m => ({
                    user_id: m.user_id,
                    nome: m.name || m.email || 'Sem nome',
                    papel: PAPEL_ANTIGO_PARA_NOVO[m.role] || m.role,
                  }))}
                aoAplicar={loadAll} />
            </div>
          )}
        </div>
      )}
    </Mesa>

    {/* ── Os acessos de uma pessoa ────────────────────────────────────
        A frase primeiro, a matriz atrás de «Afinar». Quem guarda é a rota
        /api/org/permissoes, que volta a verificar tudo do lado do servidor:
        esconder um botão não impede ninguém de chamar a API. */}
    {acessosDe && (
      <AcessosPessoa
        pessoa={{
          user_id: acessosDe.user_id,
          nome: acessosDe.name,
          email: acessosDe.email,
          papel: PAPEL_ANTIGO_PARA_NOVO[acessosDe.role] || acessosDe.role,
        }}
        aoFechar={() => setAcessosDe(null)}
        aoGuardar={async (papel, permissoes) => {
          try {
            const r = await fetch('/api/org/permissoes', {
              method: 'POST', headers: await auth(),
              body: JSON.stringify({ userId: acessosDe.user_id, papel, permissoes }),
            })
            const j = await r.json()
            if (!r.ok) return { ok: false, erro: j.error || 'Não foi possível guardar.' }
            await loadAll()
            return { ok: true }
          } catch {
            return { ok: false, erro: 'Não foi possível guardar. Verifique a ligação.' }
          }
        }}
      />
    )}
    </>
  )
}

function roleLabel(r: string) {
  return ({ owner: 'Dono', admin: 'Administrador', nurse: 'Enfermeiro/a', assistant: 'Auxiliar', clinician: 'Clínico', viewer: 'Só leitura' } as any)[r] || r
}

