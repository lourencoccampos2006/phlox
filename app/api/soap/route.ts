import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Nota clínica SOAP (clínica/consultório) — estrutura texto livre da consulta em S/O/A/P.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const consult = String(body?.consult || '').trim().slice(0, 2500)
  if (!consult) return NextResponse.json({ error: 'Descreve a consulta' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És médico(a) a redigir uma nota clínica estruturada (SOAP) a partir das notas de uma consulta, em português de Portugal, com rigor e linguagem clínica adequada ao processo.

Responde APENAS com JSON válido (sem markdown):
{
  "subjective": "S — queixa e história relatada pelo doente",
  "objective": "O — exame objetivo, sinais vitais e dados observados (só o que foi referido)",
  "assessment": "A — avaliação/impressão diagnóstica e raciocínio clínico",
  "plan": ["P — cada item do plano (exames, terapêutica, encaminhamento, vigilância)"],
  "icpc2": ["código ICPC-2 provável com descrição, se aplicável"],
  "missing": ["informação relevante que não foi documentada e devia constar"]
}

Regras:
- NÃO inventes dados clínicos. Se algo não foi referido, deixa-o de fora (e, se importante, regista em "missing").
- Mantém o rigor: usa terminologia correta mas não acrescentes diagnósticos sem suporte.
- "plan" acionável e específico.`,
      },
      { role: 'user', content: `Notas da consulta:\n${consult}` },
    ], { maxTokens: 1500, temperature: 0.1 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
