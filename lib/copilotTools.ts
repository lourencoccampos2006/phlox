// lib/copilotTools.ts
// Ferramentas REAIS que o Phlox Copilot pode invocar para fundamentar as suas
// respostas — em vez de adivinhar, executa a mesma lógica rigorosa que as
// ferramentas dedicadas já usam. Chamadas do lado do servidor
// (app/api/copilot-chat/route.ts), nunca pela IA diretamente.

import type { SupabaseClient } from '@supabase/supabase-js'
import { checkInteractions } from '@/lib/interactionsEngine'

export const COPILOT_TOOLS = ['check_interactions', 'patient_data'] as const
export type CopilotToolName = typeof COPILOT_TOOLS[number]

/** Verifica interações reais (RxNorm + IA verificada) entre 2-10 fármacos. Devolve texto compacto para o prompt. */
export async function checkInteractionsTool(drugs: string[]): Promise<string> {
  try {
    const r = await checkInteractions(drugs)
    const lines = [
      `Verificação real de interações entre ${r.drugs.join(', ')} (fonte: ${r.source === 'ai_enhanced' ? 'RxNorm/NIH + farmacologia clínica' : r.source === 'rxnorm' ? 'RxNorm/NIH' : 'nenhuma interação documentada'}):`,
      `Gravidade: ${r.severity}`,
      r.summary && `Resumo: ${r.summary}`,
      r.mechanism && `Mecanismo: ${r.mechanism}`,
      r.consequences && `Consequências: ${r.consequences}`,
      r.recommendation && `Recomendação: ${r.recommendation}`,
      r.monitor?.length ? `Monitorizar: ${r.monitor.join(', ')}` : '',
      r.alternatives?.length ? `Alternativas: ${r.alternatives.join(', ')}` : '',
    ].filter(Boolean)
    return lines.join('\n')
  } catch (e: any) {
    if (e?.code === 'invalid_count') return 'Não foi possível verificar: são precisos pelo menos 2 fármacos (máx. 10).'
    return 'A verificação de interações falhou tecnicamente — responde com cautela e sugere confirmar em /interactions.'
  }
}

interface ActiveProfileArg { id: string; type: 'self' | 'family' | 'patient' }
export interface PatientDataResult { text: string; meds: string[] }

/** Busca dados ATUAIS e completos (não o resumo compacto do contexto) da pessoa em foco, respeitando RLS via o cliente autenticado do pedido. Devolve também os nomes dos fármacos ativos, para encadear check_interactions sem precisar de outro turno. */
export async function patientDataTool(supabase: SupabaseClient, profile: ActiveProfileArg | null): Promise<PatientDataResult> {
  if (!profile || profile.type === 'self' || !profile.id) return { text: 'Não há nenhum doente/familiar em foco neste momento — a pergunta deve ser sobre o próprio utilizador.', meds: [] }

  try {
    if (profile.type === 'patient') {
      const [{ data: pat }, { data: meds }] = await Promise.all([
        supabase.from('patients').select('name, room_number, conditions, allergies').eq('id', profile.id).maybeSingle(),
        supabase.from('patient_meds').select('name, dose, frequency').eq('patient_id', profile.id).eq('active', true).limit(20),
      ])
      if (!pat) return { text: 'Não consegui aceder ao registo deste utente (sem permissão ou não encontrado).', meds: [] }
      const medNames = (meds || []).map((m: any) => m.name).filter(Boolean)
      const lines = [
        `Registo atual de ${pat.name}${pat.room_number ? ` (quarto ${pat.room_number})` : ''}:`,
        pat.conditions ? `Condições: ${pat.conditions}` : 'Sem condições registadas.',
        pat.allergies ? `Alergias: ${pat.allergies}` : 'Sem alergias registadas.',
        meds?.length ? `Medicação ativa: ${meds.map((m: any) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`).join('; ')}` : 'Sem medicação ativa registada.',
      ]
      return { text: lines.join('\n'), meds: medNames }
    }
    // family
    const [{ data: fam }, { data: meds }, { data: vit }] = await Promise.all([
      supabase.from('family_profiles').select('name, age, sex, conditions, allergies').eq('id', profile.id).maybeSingle(),
      supabase.from('family_profile_meds').select('name, dose, frequency').eq('profile_id', profile.id).eq('active', true).limit(20).then((r: any) => r, () => ({ data: [] })),
      supabase.from('vitals').select('recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp').eq('profile_id', profile.id).order('recorded_at', { ascending: false }).limit(1).then((r: any) => r, () => ({ data: [] })),
    ])
    if (!fam) return { text: 'Não consegui aceder ao registo deste familiar (sem permissão ou não encontrado).', meds: [] }
    const medNames = (meds || []).map((m: any) => m.name).filter(Boolean)
    const v = vit?.[0]
    const lines = [
      `Registo atual de ${fam.name}${fam.age ? `, ${fam.age} anos` : ''}${fam.sex ? `, ${fam.sex}` : ''}:`,
      fam.conditions ? `Condições: ${fam.conditions}` : 'Sem condições registadas.',
      fam.allergies ? `Alergias: ${fam.allergies}` : 'Sem alergias registadas.',
      meds?.length ? `Medicação ativa: ${meds.map((m: any) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`).join('; ')}` : 'Sem medicação ativa registada.',
      v ? `Últimas vitais (${new Date(v.recorded_at).toLocaleDateString('pt-PT')}): ${[v.bp_sys && v.bp_dia && `TA ${v.bp_sys}/${v.bp_dia}`, v.hr && `FC ${v.hr}`, v.spo2 && `SpO2 ${v.spo2}%`, v.glucose && `glicemia ${v.glucose}`, v.temp && `temp ${v.temp}º`, v.weight && `peso ${v.weight}kg`].filter(Boolean).join(', ')}` : 'Sem vitais recentes.',
    ]
    return { text: lines.join('\n'), meds: medNames }
  } catch {
    return { text: 'A consulta ao registo falhou tecnicamente.', meds: [] }
  }
}
