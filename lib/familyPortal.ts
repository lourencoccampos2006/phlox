// lib/familyPortal.ts
// Lógica partilhada de resolução de código + verificação por telefone do
// Portal Família — extraída de app/api/family-portal/route.ts (2026-08-09)
// para ser reutilizada também por app/api/family-link/route.ts (ligação
// institucional persistida, autenticada, dentro de /familia — antes só
// existia como sessão local em /portal-familia). Comportamento inalterado.
import { createClient } from '@supabase/supabase-js'

export const HAS_SERVICE_KEY = !!process.env.SUPABASE_SERVICE_ROLE_KEY

export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function resolveCode(code: string): Promise<{ patient: any } | { errorCode: 'short' | 'no_column' | 'not_found' | 'db' | 'no_key' }> {
  const c = (code || '').toUpperCase().trim()
  if (!c || c.length < 4) return { errorCode: 'short' }
  if (!HAS_SERVICE_KEY) return { errorCode: 'no_key' }
  const sb = admin()
  const { data, error } = await sb.from('patients').select('id, name, room_number, user_id, org_id, age, sex, weight, height, creatinine, egfr, conditions, allergies').eq('family_code', c).maybeSingle()
  if (error) {
    if (/column .*family_code.* does not exist/i.test(error.message) || error.code === '42703') return { errorCode: 'no_column' }
    return { errorCode: 'db' }
  }
  if (!data) return { errorCode: 'not_found' }
  return { patient: data }
}

export function codeErrorResponse(errorCode: string): { error: string; status: number } {
  if (errorCode === 'no_key') return { error: 'O portal família está temporariamente indisponível (configuração do servidor). Tente mais tarde.', status: 503 }
  if (errorCode === 'no_column') return { error: 'O portal ainda não está disponível para esta instituição.', status: 503 }
  if (errorCode === 'db') return { error: 'Erro de ligação à base de dados. Tente novamente.', status: 500 }
  if (errorCode === 'short') return { error: 'Código demasiado curto.', status: 400 }
  return { error: 'Código inválido. Confirme com a instituição.', status: 404 }
}

export const last4 = (phone?: string | null) => (phone || '').replace(/\D/g, '').slice(-4)

export async function verifyFamily(patientId: string, digits: string): Promise<{ ok: boolean; gated: boolean; noContacts?: boolean; contact?: any }> {
  const sb = admin()
  const { data: contacts } = await sb.from('resident_contacts').select('id, name, phone').eq('patient_id', patientId)
  const withPhone = (contacts || []).filter((c: any) => last4(c.phone).length === 4)
  if (withPhone.length === 0) return { ok: false, gated: true, noContacts: true }
  const d = (digits || '').replace(/\D/g, '').slice(-4)
  const match = withPhone.find((c: any) => last4(c.phone) === d)
  return { ok: !!match, gated: true, contact: match }
}
