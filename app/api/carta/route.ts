// app/api/carta/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const TYPE_PROMPTS: Record<string, string> = {
  referenciacao: `Redige uma carta de referenciação médica formal, em português europeu (PT-PT), com a seguinte estrutura:

1. Cabeçalho (remetente, destinatário, data)
2. Exmo(a) Sr(a) Dr(a) [destinatário],
3. Paragrafo de apresentação do doente e motivo de referenciação
4. História clínica relevante e antecedentes
5. Medicação actual (lista formatada)
6. Exames complementares relevantes
7. Diagnóstico(s) activo(s)
8. Motivo específico do pedido de referenciação
9. Frase de disponibilidade para contacto
10. Despedida formal e assinatura

Tom: formal, clínico, objetivo. Sem jargão desnecessário. Máximo 400 palavras.`,

  alta: `Redige uma nota de alta hospitalar em português europeu (PT-PT), com a seguinte estrutura:

1. NOTA DE ALTA — [data]
2. IDENTIFICAÇÃO DO DOENTE
3. MOTIVO DE INTERNAMENTO
4. RESUMO DO INTERNAMENTO (evolução, procedimentos, intercorrências)
5. DIAGNÓSTICOS DE ALTA (principal + secundários)
6. MEDICAÇÃO DE ALTA (lista completa com doses e frequência)
7. CUIDADOS E RESTRIÇÕES PÓS-ALTA
8. SEGUIMENTO (consultas marcadas, análises, avisos ao doente)
9. INFORMAÇÃO DE URGÊNCIA (quando regressar ao SU)
10. Assinatura

Tom: formal, estruturado, directo. Inclui tudo o que o doente e o MF precisam de saber.`,

  medico_familia: `Redige uma carta de comunicação da especialidade para o médico de família, em português europeu (PT-PT):

1. Exmo(a) colega,
2. Refiro doente observado neste serviço
3. Contexto e motivo da consulta
4. Achados relevantes e exames efectuados
5. Diagnóstico e proposta terapêutica
6. Medicação actual (com alterações destacadas)
7. Plano de seguimento — o que o MF deve monitorizar
8. Quando referenciar novamente
9. Contacto para dúvidas
10. Despedida colegial

Tom: colegial, directo, útil. Foca no que o MF precisa de fazer.`,

  intervencao_farmaceutica: `Redige um registo formal de intervenção farmacêutica em português europeu (PT-PT), estruturado segundo o formato PCNE:

1. INTERVENÇÃO FARMACÊUTICA — [data e farmacêutico]
2. IDENTIFICAÇÃO DO DOENTE
3. PROBLEMA IDENTIFICADO (classificação PCNE P1/P2/P3)
4. CAUSA PROVÁVEL (classificação PCNE C1-C8)
5. DESCRIÇÃO TÉCNICA DO PROBLEMA (mecanismo, evidência, risco para o doente)
6. INTERVENÇÃO EFECTUADA (classificação PCNE I1-I4)
7. COMUNICAÇÃO AO PRESCRITOR (se efectuada)
8. RESULTADO ESPERADO
9. OUTCOME (se já conhecido) (classificação PCNE O0-O5)
10. Assinatura do Farmacêutico

Tom: técnico, formal, PCNE-compatível. Adequado para acreditação e auditoria.`,

  aptidao: `Redige uma declaração de aptidão médica em português europeu (PT-PT):

1. DECLARAÇÃO DE APTIDÃO
2. O abaixo assinado, [profissional], declara que observou
3. Nome completo do declarado
4. Data de nascimento / BI/CC
5. Que o mesmo apresenta estado de saúde compatível com [actividade]
6. Condições ou restrições (se aplicável)
7. Validade da declaração
8. Nota: esta declaração não dispensa avaliação por médico do trabalho se exigida por lei
9. Data e local
10. Assinatura e número de cédula profissional

Tom: formal, legal, conciso.`,
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 8, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Carta')

  const body = await req.json().catch(() => null)
  if (!body?.tipo || !body?.motivo || !body?.patient_name) {
    return NextResponse.json({ error: 'Tipo, motivo e nome do doente obrigatórios.' }, { status: 400 })
  }

  const typePrompt = TYPE_PROMPTS[body.tipo]
  if (!typePrompt) return NextResponse.json({ error: 'Tipo de carta inválido.' }, { status: 400 })

  const patientDOB = body.patient_dob ? new Date(body.patient_dob).toLocaleDateString('pt-PT') : null

  const context = [
    body.from_name && `Remetente: ${body.from_name}${body.from_role ? `, ${body.from_role}` : ''}${body.from_institution ? `, ${body.from_institution}` : ''}${body.from_service ? ` (${body.from_service})` : ''}`,
    body.to_name && `Destinatário: ${body.to_name}${body.to_role ? `, ${body.to_role}` : ''}${body.to_institution ? `, ${body.to_institution}` : ''}`,
    `Doente: ${body.patient_name}${patientDOB ? `, nascido em ${patientDOB}` : ''}${body.patient_sns ? `, SNS: ${body.patient_sns}` : ''}`,
    body.motivo && `Motivo: ${body.motivo}`,
    body.historia && `História clínica: ${body.historia}`,
    body.medicacao && `Medicação: ${body.medicacao}`,
    body.exames && `Exames: ${body.exames}`,
    body.diagnostico && `Diagnóstico: ${body.diagnostico}`,
    body.plano && `Plano/pedido: ${body.plano}`,
    body.notas && `Notas adicionais: ${body.notas}`,
  ].filter(Boolean).join('\n')

  try {
    const result = await aiComplete([
      {
        role: 'system',
        content: `${typePrompt}

Usa APENAS os dados fornecidos. Não inventes informação que não foi dada.
Se algum campo estiver em branco, omite essa secção naturalmente.
Responde APENAS com o texto da carta — sem título, sem introdução, sem comentários.
Data de hoje: ${new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      },
      {
        role: 'user',
        content: context,
      },
    ], { maxTokens: 1200, temperature: 0.2 })

    return NextResponse.json({ carta: result.text.trim() })

  } catch (err: any) {
    console.error('Carta error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar carta. Tenta novamente.' }, { status: 500 })
  }
}