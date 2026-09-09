'use client'

// components/institution/TurnoEmCurso.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Quem ESTÁ na casa agora — não quem está escalado.
//
// O Phlox sabia a escala, que é uma previsão. Se alguém troca um turno à última
// hora, ou fica para além da hora, a escala continua a dizer outra coisa: a
// passagem de turno sai com o nome errado e o "quem fez o quê" fica a apontar
// para quem não estava cá. Um toque a entrar e um a sair resolvem isso, e
// transformam o turno num facto.
//
// Fica no painel, por cima de tudo: é o primeiro gesto de quem chega, antes
// mesmo de marcar as presenças dos utentes.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { currentShiftFor } from '@/lib/institutionConfig'
import { ptDate } from '@/lib/ptTime'
import { registar } from '@/lib/registo'
import { iniciais, corDaPessoa } from '@/lib/presenca'
import { eFaltaDeSetup } from '@/lib/setupCodes'
import { useLiveData } from '@/lib/useLiveData'

interface Presente {
  id: string; user_id: string; person_name: string | null
  shift: string; entrou_at: string; saiu_at: string | null
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-5)',
}
const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const hora = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })
}

export default function TurnoEmCurso({ cor }: { cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const [gente, setGente] = useState<Presente[]>([])
  const [semTabela, setSemTabela] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)

  const turno = currentShiftFor(institution)
  const hoje = ptDate()

  const carregar = useCallback(async () => {
    if (!user) return
    let q = supabase.from('shift_checkins')
      .select('id,user_id,person_name,shift,entrou_at,saiu_at')
      .eq('date', hoje).order('entrou_at')
    q = scope.orgId ? q.eq('org_id', scope.orgId) : q.eq('user_id', scope.userId)
    const { data, error } = await q
    if (error) { if (eFaltaDeSetup(error)) setSemTabela(true); return }
    setSemTabela(false)
    setGente(data || [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, hoje])

  useEffect(() => { carregar() }, [carregar])
  // Duas pessoas entram ao mesmo tempo à porta: sem tempo real, uma não via a outra.
  useLiveData({
    supabase, userId: user?.id, table: ['shift_checkins'],
    filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue,
    onChange: carregar,
  })

  const meu = gente.find(g => g.user_id === user?.id && !g.saiu_at)
  const presentes = gente.filter(g => !g.saiu_at)

  async function entrar() {
    if (!user || aGuardar) return
    setAGuardar(true)
    const nome = user.name || user.email?.split('@')[0] || 'Equipa'
    const { error } = await supabase.from('shift_checkins').upsert({
      ...(scope.orgId ? { org_id: scope.orgId } : {}),
      user_id: user.id, person_name: nome, date: hoje, shift: turno,
      entrou_at: new Date().toISOString(), saiu_at: null, recorded_by_id: user.id,
    }, { onConflict: 'user_id,date,shift' })
    setAGuardar(false)
    if (error) { alert('Não foi possível entrar no turno. Tenta de novo.'); return }
    registar({ supabase, scope, user }, {
      action: 'turno.entrada', entity: 'shift',
      summary: `${nome} entrou no turno da ${TURNO_LABEL[turno]?.toLowerCase() || turno}.`,
      meta: { turno, data: hoje },
    })
    carregar()
  }

  async function sair() {
    if (!meu || aGuardar) return
    setAGuardar(true)
    const { error } = await supabase.from('shift_checkins')
      .update({ saiu_at: new Date().toISOString() }).eq('id', meu.id)
    setAGuardar(false)
    if (error) { alert('Não foi possível sair do turno. Tenta de novo.'); return }
    registar({ supabase, scope, user }, {
      action: 'turno.saida', entity: 'shift',
      summary: `${meu.person_name || 'Alguém'} saiu do turno da ${TURNO_LABEL[meu.shift]?.toLowerCase() || meu.shift}.`,
      meta: { turno: meu.shift, data: hoje },
    })
    carregar()
  }

  // Sem a migração aplicada, isto simplesmente não aparece: é uma adição ao
  // painel, não uma peça sem a qual o dia não anda.
  if (semTabela || !scope.canEdit) return null

  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={MONO}>Turno da {TURNO_LABEL[turno]?.toLowerCase() || turno}</div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.4 }}>
          {presentes.length === 0
            ? 'Ainda ninguém entrou no turno.'
            : `${presentes.length} ${presentes.length === 1 ? 'pessoa' : 'pessoas'} em serviço.`}
        </div>
      </div>

      {presentes.length > 0 && (
        <div style={{ display: 'flex', gap: -6, alignItems: 'center' }}>
          {presentes.slice(0, 8).map((g, i) => (
            <span key={g.id}
              title={`${g.person_name || 'Equipa'} — desde as ${hora(g.entrou_at)}`}
              style={{
                width: 30, height: 30, borderRadius: '50%', marginLeft: i ? -8 : 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: corDaPessoa(g.user_id), color: 'white',
                fontSize: 10.5, fontWeight: 700, border: '2px solid var(--bg)',
              }}>{iniciais(g.person_name || 'Equipa')}</span>
          ))}
          {presentes.length > 8 && (
            <span style={{ ...MONO, marginLeft: 8 }}>+{presentes.length - 8}</span>
          )}
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {meu && (
          <span style={{ ...MONO, fontSize: 9.5 }}>desde as {hora(meu.entrou_at)}</span>
        )}
        <button
          onClick={meu ? sair : entrar}
          disabled={aGuardar}
          style={{
            minHeight: 40, padding: '0 18px', borderRadius: 'var(--r-md)',
            border: `1px solid ${meu ? 'var(--border-2)' : cor}`,
            background: meu ? 'var(--bg)' : cor,
            color: meu ? 'var(--ink-3)' : 'white',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            cursor: aGuardar ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          }}>
          {aGuardar ? '…' : meu ? 'Sair do turno' : 'Entrar no turno'}
        </button>
      </div>
    </div>
  )
}
