'use client'

// components/settings/DefinicoesDaCasa.tsx
// ═══════════════════════════════════════════════════════════════════════════
// AS DEFINIÇÕES DA INSTITUIÇÃO — e porque é que saíram da página «Equipa»
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O PEDIDO ───────────────────────────────────────────────────────────────
// «Podias começar a utilizar mais as definições em contas institucionais,
//  passar para lá algumas coisas. Está muito confuso algumas partes.»
//
// ── O QUE ESTAVA CONFUSO ───────────────────────────────────────────────────
// Isto vivia dentro de `/equipa`, atrás de um botão, no mesmo painel onde se
// adiciona um funcionário. Ou seja: o nome da casa, a morada, a lotação, a
// mensalidade por utente, o endereço da página pública, o logótipo e a cor de
// marca estavam todos numa página chamada **Equipa**.
//
// Nenhuma dessas coisas é uma pessoa. Quem procura a mensalidade da casa não
// a procura em «Equipa» — procura-a nas Definições, e não a encontra, e
// conclui que não existe. Era o caso.
//
// Agora vive nas Definições, no separador «A casa». A `/equipa` fica com o que
// o nome dela promete: quem trabalha aqui, com que função, e com que acessos.
//
// ── PORQUE É QUE CARREGA OS SEUS PRÓPRIOS DADOS ────────────────────────────
// Para poder estar nos dois sítios sem que nenhum deles tenha de saber o que
// ele precisa. Uma versão que recebesse dez `props` obrigava cada página a
// manter dez pedaços de estado que não são dela — que é exactamente como isto
// estava, e é o que o tornava difícil de mover.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { INST_META } from '@/lib/useClinicPrefs'
import { VERDE_DA_CASA } from '@/lib/institutionBlueprint'
import {
  Botao, Campo, Grupo, Vazio, ACarregar, Aviso, CAIXA, MONO,
} from '@/components/ui/mesa'

export default function DefinicoesDaCasa() {
  const { user, supabase } = useAuth() as any

  const [org, setOrg] = useState<any | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const [orgSaved, setOrgSaved] = useState(false)

  const [editName, setEditName] = useState('')
  const [editKind, setEditKind] = useState('day_care')
  const [editAddress, setEditAddress] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editTagline, setEditTagline] = useState('')
  const [editPublic, setEditPublic] = useState(false)
  const [editCapacity, setEditCapacity] = useState('')
  const [editFee, setEditFee] = useState('')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [editAccentColor, setEditAccentColor] = useState('')

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data?.session?.access_token || ''}`,
    }
  }, [supabase])

  const carregar = useCallback(async () => {
    if (!user) { setCarregando(false); return }
    setCarregando(true); setErro('')
    try {
      const s = await fetch('/api/org/setup', { headers: await auth() }).then(r => r.json())
      setOrg(s.org || null)
      if (s.org) {
        setEditName(s.org.name || '')
        setEditKind(s.org.kind || 'day_care')
        setEditAddress(s.org.address || '')
        setEditSlug(s.org.slug || '')
        setEditTagline(s.org.tagline || '')
        setEditPublic(!!s.org.public)
        setEditCapacity(s.org.capacity != null ? String(s.org.capacity) : '')
        setEditFee(s.org.monthly_fee != null ? String(s.org.monthly_fee) : '')
        setEditLogoUrl(s.org.logo_url || '')
        setEditAccentColor(s.org.accent_color || '')
      }
    } catch (e: any) {
      setErro('Não foi possível ler as definições da casa.')
      console.error('[phlox:definicoes-casa]', e)
    } finally { setCarregando(false) }
  }, [user, auth])

  useEffect(() => { carregar() }, [carregar])

  async function saveOrgSettings() {
    if (!editName.trim()) return
    setSavingOrg(true); setErro(''); setOrgSaved(false)
    try {
      const r = await fetch('/api/org/setup', {
        method: 'POST', headers: await auth(),
        body: JSON.stringify({
          name: editName.trim(), kind: editKind, address: editAddress.trim(),
          slug: editSlug, tagline: editTagline, public: editPublic,
          capacity: editCapacity, monthlyFee: editFee,
          logoUrl: editLogoUrl.trim(), accentColor: editAccentColor.trim(),
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Não foi possível guardar.')
      try { localStorage.setItem('phlox-clinic-institution', editKind) } catch {}
      setOrgSaved(true)
      setTimeout(() => setOrgSaved(false), 3000)
      await carregar()
    } catch (e: any) {
      setErro(e.message || 'Não foi possível guardar.')
    } finally { setSavingOrg(false) }
  }

  if (carregando) return <ACarregar oQue="A ler as definições da casa…" />

  if (!org) {
    return (
      <Vazio titulo="Esta conta ainda não tem uma instituição."
        oQueFazer="As definições da casa aparecem aqui assim que a instituição existir." />
    )
  }

  return (
    <>
      {erro && <Aviso tom="mau">{erro}</Aviso>}
  <Grupo titulo="A casa">
    <Campo rotulo="Nome da instituição" para="org-name-edit" obrigatorio>
      <input id="org-name-edit" value={editName} onChange={e => setEditName(e.target.value)}
        placeholder="Nome da instituição" style={{ ...CAIXA, width: '100%' }} />
    </Campo>

    {/* O TIPO já não se muda aqui (2026-09-06). Muda o vocabulário, as
        ferramentas e os relatórios de toda a casa — passou a ser um acto
        do dono do Phlox, no /admin. Aqui só se lê. */}
    <Campo rotulo="Tipo"
      ajuda="Definido quando a instituição foi criada. Muda o vocabulário, as ferramentas e os relatórios de toda a casa — para mudar, fale connosco.">
      <span style={{
        ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any,
        display: 'inline-block', padding: '4px 9px', color: 'var(--ink-2)',
        border: '1px solid var(--border-2)', borderRadius: 'var(--r-sm)',
        background: 'var(--bg-2)',
      }}>{INST_META[editKind as keyof typeof INST_META]?.label || editKind}</span>
    </Campo>

    <Campo rotulo="Morada da instituição" para="org-address"
      ajuda="É daqui que parte e para aqui volta a rota de transportes. Ao guardar, é convertida em coordenadas automaticamente.">
      <input id="org-address" value={editAddress} onChange={e => setEditAddress(e.target.value)}
        placeholder="Rua, número, código postal e localidade" style={{ ...CAIXA, width: '100%' }} />
    </Campo>
  </Grupo>

  <Grupo titulo="O negócio">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Campo rotulo="Lotação (lugares)" para="org-capacity">
        <input id="org-capacity" value={editCapacity} inputMode="numeric"
          onChange={e => setEditCapacity(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Ex: 30" style={{ ...CAIXA, width: '100%' }} />
      </Campo>
      <Campo rotulo="Mensalidade por utente (€)" para="org-fee">
        <input id="org-fee" value={editFee} inputMode="decimal"
          onChange={e => setEditFee(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="Ex: 450" style={{ ...CAIXA, width: '100%' }} />
      </Campo>
    </div>
    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 5, lineHeight: 1.5 }}>
      Alimentam o painel administrativo: a taxa de ocupação e a receita prevista
      saem destes dois números.
    </div>
  </Grupo>

  <Grupo titulo="A página pública">
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
      fontSize: 'var(--t-dado)', color: 'var(--ink)', marginTop: 10,
    }}>
      <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)} />
      Tornar a página pública
    </label>
    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', margin: '4px 0 0', lineHeight: 1.5 }}>
      Cria um endereço que pode partilhar com as famílias e nas redes.
    </div>

    <Campo rotulo="Endereço" para="org-slug">
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)', whiteSpace: 'nowrap' }}>
          phloxclinical.com/c/
        </span>
        <input id="org-slug" value={editSlug}
          onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
          placeholder="centro-sao-jose" style={{ ...CAIXA, flex: 1 }} />
      </span>
    </Campo>

    <Campo rotulo="Frase de apresentação" para="org-tagline">
      <input id="org-tagline" value={editTagline} onChange={e => setEditTagline(e.target.value)}
        placeholder="Cuidamos de quem mais ama, perto de si." maxLength={160}
        style={{ ...CAIXA, width: '100%' }} />
    </Campo>

    {editPublic && editSlug && (
      <a href={`/c/${editSlug}`} target="_blank" rel="noreferrer" style={{
        ...MONO, display: 'inline-block', marginTop: 8, fontSize: 'var(--t-meta)',
        color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none',
      }}>VER A PÁGINA →</a>
    )}
  </Grupo>

  <Grupo titulo="A marca">
    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.5 }}>
      Opcional — personaliza o painel administrativo e a página pública.
    </div>

    <Campo rotulo="Logótipo (endereço da imagem)" para="org-logo">
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {editLogoUrl && (
          <img src={editLogoUrl} alt="" style={{
            width: 32, height: 32, borderRadius: 'var(--r-sm)', objectFit: 'cover',
            border: '1px solid var(--border)', flexShrink: 0,
          }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
        )}
        <input id="org-logo" value={editLogoUrl} onChange={e => setEditLogoUrl(e.target.value)}
          placeholder="https://…/logotipo.png" style={{ ...CAIXA, flex: 1 }} />
      </span>
    </Campo>

    <Campo rotulo="Cor de marca" para="org-accent">
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <input aria-label="Escolher a cor de marca" type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(editAccentColor) ? editAccentColor : VERDE_DA_CASA}
          onChange={e => setEditAccentColor(e.target.value)}
          style={{
            width: 34, height: 32, borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border)', padding: 2, cursor: 'pointer', flexShrink: 0,
          }} />
        <input id="org-accent" value={editAccentColor} onChange={e => setEditAccentColor(e.target.value)}
          placeholder={VERDE_DA_CASA} style={{ ...CAIXA, flex: 1 }} />
      </span>
    </Campo>
  </Grupo>

  <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
    <Botao feitio="principal" onClick={saveOrgSettings} esperando={savingOrg}
      disabled={!editName.trim()}>
      {orgSaved ? 'GUARDADO ✓' : 'GUARDAR ALTERAÇÕES'}
    </Botao>
    {org && editName.trim() && editName.trim() !== org.name && (
      <span style={{ fontSize: 'var(--t-meta)', color: 'var(--amber)' }}>
        Vai mudar de «{org.name}» para «{editName.trim()}».
      </span>
    )}
  </div>
    </>
  )
}
