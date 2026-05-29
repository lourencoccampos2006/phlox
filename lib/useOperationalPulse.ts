'use client'

// Pulso operacional — reúne, num só sítio, os sinais vivos das ferramentas de
// operações/legal (sala de espera, tarefas, stock, conformidade) para o cockpit
// mostrar a instituição COMO UM TODO. Tolerante a tabelas em falta (sprint32):
// se uma tabela não existir, esse sinal fica simplesmente ausente (nunca rebenta).

import { useState, useEffect, useCallback } from 'react'
import { checklistFor } from './complianceChecklists'
import type { InstitutionType } from './useClinicPrefs'

export interface OperationalPulse {
  waiting: number | null            // pessoas a aguardar agora
  inService: number | null          // a ser atendidas
  tasksOpen: number | null          // tarefas por fazer/a decorrer
  tasksOverdue: number | null       // tarefas em atraso
  stockLow: number | null           // produtos em rutura
  stockExpiring: number | null      // validade ≤30d ou expirados
  compliancePct: number | null      // % de prontidão para auditoria
  compliancePending: number | null  // itens pendentes
  loading: boolean
}

const EMPTY: OperationalPulse = {
  waiting: null, inService: null, tasksOpen: null, tasksOverdue: null,
  stockLow: null, stockExpiring: null, compliancePct: null, compliancePending: null, loading: true,
}

// Resolve uma query Supabase ignorando erros (tabela em falta → null)
async function safe<T>(p: any): Promise<T[] | null> {
  try { const { data, error } = await p; if (error) return null; return data || [] } catch { return null }
}

export function useOperationalPulse(supabase: any, userId: string | null | undefined, institution: InstitutionType): OperationalPulse {
  const [pulse, setPulse] = useState<OperationalPulse>(EMPTY)

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    const today = new Date().toISOString().slice(0, 10)
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)

    const [waitRows, taskRows, stockRows, compRows] = await Promise.all([
      safe<any>(supabase.from('waiting_room').select('status,arrived_at').eq('user_id', userId).gte('arrived_at', dayStart.toISOString())),
      safe<any>(supabase.from('team_tasks').select('status,due_date').eq('user_id', userId).neq('status', 'done')),
      safe<any>(supabase.from('stock_items').select('quantity,min_quantity,expiry_date').eq('user_id', userId)),
      safe<any>(supabase.from('compliance_items').select('key,status').eq('user_id', userId)),
    ])

    const next: OperationalPulse = { ...EMPTY, loading: false }

    if (waitRows) {
      next.waiting = waitRows.filter(r => r.status === 'waiting').length
      next.inService = waitRows.filter(r => r.status === 'called' || r.status === 'in_service').length
    }
    if (taskRows) {
      next.tasksOpen = taskRows.length
      next.tasksOverdue = taskRows.filter(r => r.due_date && r.due_date < today).length
    }
    if (stockRows) {
      next.stockLow = stockRows.filter(r => Number(r.min_quantity) > 0 && Number(r.quantity) <= Number(r.min_quantity)).length
      next.stockExpiring = stockRows.filter(r => {
        if (!r.expiry_date) return false
        const d = Math.floor((new Date(r.expiry_date + 'T12:00').getTime() - Date.now()) / 86400000)
        return d <= 30
      }).length
    }
    if (compRows) {
      // % calculada sobre os itens APLICÁVEIS do checklist desta instituição
      const items = checklistFor(institution).flatMap(g => g.items)
      const stMap: Record<string, string> = {}
      compRows.forEach(r => { stMap[r.key] = r.status })
      const na = items.filter(i => stMap[i.key] === 'na').length
      const done = items.filter(i => stMap[i.key] === 'done').length
      const applicable = items.length - na
      next.compliancePct = applicable > 0 ? Math.round((done / applicable) * 100) : 0
      next.compliancePending = items.filter(i => (stMap[i.key] || 'pending') === 'pending').length
    }

    setPulse(next)
  }, [supabase, userId, institution])

  useEffect(() => { load() }, [load])

  return pulse
}
