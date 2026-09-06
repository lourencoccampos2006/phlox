// lib/presenca.ts
// ─────────────────────────────────────────────────────────────────────────────
// Marcar presenças — FONTE ÚNICA. Usada pelo painel (grelha de fotos, um toque)
// e pela ficha de cada pessoa (botões completos, com forma de desfazer).
//
// Duas superfícies com regras diferentes de propósito:
//   • /painel  — rápido, para a chegada. Um toque marca a chegada, outro marca
//                a saída. Não deixa apagar: um engano corrige-se na ficha.
//   • /patients/[id] — completo. Presente, ausente, saiu, e RETIRAR a marca.
//
// A parte delicada é a família. Num centro de dia, a família recebe um recado
// automático quando a pessoa chega e quando sai — é metade do valor do produto.
// Isso significa que um engano na marcação já foi para fora: por isso, quando
// se retira ou corrige uma marca que já gerou recado, sai um segundo recado a
// desfazer o primeiro. Nunca se apaga em silêncio uma coisa que a família já leu.
// ─────────────────────────────────────────────────────────────────────────────

import { ptDate } from './ptTime'
import { registar, ACOES } from './registo'

export type EstadoPresenca = 'present' | 'absent' | 'left' | null

export interface AlvoPresenca {
  id: string
  name: string
  photo_url?: string | null
  room_number?: string | null
}

interface Ctx {
  supabase: any
  scope: { orgId: string | null; userId: string | null; canEdit: boolean; stamp: <T extends Record<string, any>>(r: T) => T; filter: <T>(q: T) => T }
  user: { id: string; name?: string | null; email?: string | null }
  /** só o centro de dia avisa a família de chegadas e saídas — num lar a pessoa vive lá */
  avisaFamilia: boolean
}

/** Iniciais para quem não tem fotografia. "Maria da Conceição Silva" → "MS".
 *  Ignora partículas ("da", "de", "dos") e tudo o que não comece por letra —
 *  senão "João Silva (teste)" dava "J(", que foi exatamente o que apareceu. */
export function iniciais(nome: string): string {
  const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'du', 'del', 'la'])
  const partes = String(nome || '')
    .replace(/\([^)]*\)/g, ' ')                 // fora o que está entre parênteses
    .split(/\s+/)
    .map(p => p.replace(/[^\p{L}]/gu, ''))       // fora pontuação, símbolos, números
    .filter(p => p && !PARTICULAS.has(p.toLowerCase()))
  if (!partes.length) return '—'
  const a = partes[0][0]
  const b = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (a + b).toUpperCase()
}

/** Uma cor estável por pessoa, para o círculo de iniciais não ser tudo cinzento. */
export function corDaPessoa(id: string): string {
  const paleta = ['#0d9488', '#b45309', '#4f46e5', '#be123c', '#15803d', '#7c3aed', '#0e7490', '#a16207']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return paleta[h % paleta.length]
}

const primeiroNome = (n: string) => String(n || '').trim().split(/\s+/)[0] || 'a pessoa'
const horaPt = (iso?: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })
}

/** Os recados de presença de hoje desta pessoa, do mais antigo para o mais recente. */
async function recadosDeHoje(c: Ctx, patientId: string) {
  const { data } = await c.supabase.from('family_thread_messages')
    .select('id, metadata, created_at')
    .eq('patient_id', patientId)
    .gte('created_at', ptDate() + 'T00:00:00')
    .order('created_at')
  return ((data || []) as any[]).filter(m => m?.metadata?.presenca)
}

async function enviarRecado(c: Ctx, alvo: AlvoPresenca, texto: string, marca: string) {
  try {
    await c.supabase.from('family_thread_messages').insert(c.scope.stamp({
      user_id: c.user.id, patient_id: alvo.id, author_side: 'staff',
      author_name: c.user.name || 'Equipa', kind: 'update',
      content: texto, metadata: { presenca: marca, date: ptDate() },
      read_by_family: false, read_by_staff: true,
    }))
  } catch { /* o recado é um extra: nunca impede a marcação de ficar registada */ }
}

/**
 * Marca (ou retira) a presença de uma pessoa hoje.
 * `estado: null` retira a marca — só permitido a partir da ficha.
 */
export async function marcarPresenca(
  c: Ctx, alvo: AlvoPresenca, estado: EstadoPresenca
): Promise<{ erro?: string; avisouFamilia?: boolean }> {
  if (!c.scope.canEdit) return { erro: 'A sua conta é só de leitura.' }
  const hoje = ptDate()
  const agora = new Date().toISOString()

  if (estado === null) {
    const anteriores = await recadosDeHoje(c, alvo.id)
    const { error } = await c.supabase.from('attendance').delete().eq('patient_id', alvo.id).eq('date', hoje)
    if (error) return { erro: 'Não foi possível retirar a presença. Tenta de novo.' }
    registar(c, { ...ACOES.presencaRetirada(alvo.name), subjectId: alvo.id, subjectName: alvo.name, entityId: alvo.id })
    // A família já leu o recado da chegada. Retirar em silêncio deixava-a a
    // pensar que a pessoa está no centro quando não está.
    if (c.avisaFamilia && anteriores.length) {
      await enviarRecado(c, alvo,
        `Correção: o registo de hoje do/da ${primeiroNome(alvo.name)} foi marcado por engano e já foi anulado. Pedimos desculpa pelo email a mais.`,
        'correcao')
      return { avisouFamilia: true }
    }
    return {}
  }

  const linha = c.scope.stamp({
    patient_id: alvo.id, date: hoje, status: estado,
    arrived_at: estado === 'absent' ? null : agora,
    left_at: estado === 'left' ? agora : null,
    recorded_by_id: c.user.id,
  })
  // A hora de chegada não se perde ao marcar a saída — só a saída é nova.
  if (estado === 'left') {
    const { data } = await c.supabase.from('attendance').select('arrived_at').eq('patient_id', alvo.id).eq('date', hoje).maybeSingle()
    if (data?.arrived_at) (linha as any).arrived_at = data.arrived_at
  }
  const { error } = await c.supabase.from('attendance').upsert(linha, { onConflict: 'patient_id,date' })
  if (error) return { erro: 'Não foi possível guardar a presença. Tenta de novo.' }

  registar(c, {
    ...(estado === 'present' ? ACOES.presencaChegada(alvo.name)
      : estado === 'left' ? ACOES.presencaSaida(alvo.name)
      : ACOES.presencaFalta(alvo.name)),
    subjectId: alvo.id, subjectName: alvo.name, entityId: alvo.id,
    meta: { hora: agora },
  })

  if (!c.avisaFamilia) return {}

  const nome = primeiroNome(alvo.name)
  const h = horaPt(agora)
  if (estado === 'present') {
    await enviarRecado(c, alvo, `O/A ${nome} chegou ao centro${h ? ` às ${h}` : ''}. Bom dia! 🌿`, 'chegada')
    return { avisouFamilia: true }
  }
  if (estado === 'left') {
    await enviarRecado(c, alvo, `O/A ${nome} saiu do centro${h ? ` às ${h}` : ''}. Até amanhã! 🌿`, 'saida')
    return { avisouFamilia: true }
  }
  // Ausência: se já tinha sido dada como chegada, a família tem de saber que não.
  const anteriores = await recadosDeHoje(c, alvo.id)
  if (anteriores.some(m => m.metadata?.presenca === 'chegada')) {
    await enviarRecado(c, alvo,
      `Correção: afinal o/a ${nome} não veio hoje ao centro. O recado anterior foi um engano nosso.`,
      'correcao')
    return { avisouFamilia: true }
  }
  return {}
}

/** O que acontece se se tocar numa pessoa no painel, dado o estado atual. */
export function proximoNoPainel(atual: EstadoPresenca): EstadoPresenca | 'nada' {
  if (atual === null) return 'present'
  if (atual === 'present') return 'left'
  return 'nada'   // já saiu ou está ausente — corrige-se na ficha
}
