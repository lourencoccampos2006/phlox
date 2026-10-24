'use client'

// components/institution/RegistoDeTratamentos.tsx
// ═══════════════════════════════════════════════════════════════════════════
// O REGISTO DE ATIVIDADES DE TRATAMENTO, PRONTO A ENTREGAR
// ═══════════════════════════════════════════════════════════════════════════
//
// É o artigo 30.º do RGPD, e é a primeira coisa que a CNPD pede. A checklist
// de conformidade dizia «tenha um registo de atividades de tratamento» e
// deixava a direção técnica a olhar para o teto — porque quem escreve o
// documento é ela e quem sabe que dados o software guarda é o software.
//
// Aqui o documento gera-se, com os nomes reais das tabelas por baixo de cada
// atividade. Em papel, assinado, é o que se entrega.
//
// ── O AVISO NÃO SE TIRA ────────────────────────────────────────────────────
// Isto cobre o tratamento feito ATRAVÉS DO PHLOX. A casa trata quase de certeza
// dados por outras vias — videovigilância, livro de reclamações, currículos por
// email, processos em papel — e esses tem de os acrescentar. Um registo que se
// apresenta como completo sem o ser dá uma falsa segurança numa inspeção, e é
// por isso que o aviso vai no topo do documento impresso e não num rodapé.

import { useMemo, useState } from 'react'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useOrgName } from '@/lib/useOrgName'
import { printDoc } from '@/lib/print'
import {
  atividadesDa, LIMITE_DO_REGISTO, BASES_GERAIS, BASES_ESPECIAIS, PRAZOS,
  type Atividade,
} from '@/lib/ropa'
import { CONTROLLER, SUBPROCESSORS, SUPERVISORY_AUTHORITY } from '@/lib/legal'
import { PAPEIS } from '@/lib/rgpd'
import {
  Painel, Cabecalho, Botao, Aviso, MONO, ROTULO,
} from '@/components/ui/mesa'

export default function RegistoDeTratamentos({ temSAD }: { temSAD: boolean }) {
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const nomeDaCasa = useOrgName()
  const [aberta, setAberta] = useState<string | null>(null)

  const atividades = useMemo(
    () => atividadesDa(institution, temSAD), [institution, temSAD])

  const prazo = (id: string) => PRAZOS.find(p => p.id === id)
  const casa = nomeDaCasa || cfg.unitNoun

  function imprimir() {
    /* O documento é PROSA e não uma tabela de registos: é para ser lido por
       uma pessoa da CNPD, assinado e arquivado. Ver a nota sobre `corpo` em
       lib/print.ts. */
    const linhas: string[] = [
      'REGISTO DAS ATIVIDADES DE TRATAMENTO',
      'Artigo 30.º do Regulamento (UE) 2016/679 (RGPD)',
      '',
      `Responsável pelo tratamento:  ${casa}`,
      `Subcontratante:               ${CONTROLLER.name} (${CONTROLLER.website})`,
      `Relação:                      ${PAPEIS.institucional.artigo}`,
      `Autoridade de controlo:       ${SUPERVISORY_AUTHORITY.name}`,
      `Data:                         ${new Date().toLocaleDateString('pt-PT')}`,
      '',
      '── ÂMBITO DESTE DOCUMENTO ─────────────────────────────────────────',
      LIMITE_DO_REGISTO,
      '',
      '',
    ]

    atividades.forEach((a, i) => {
      const bg = BASES_GERAIS[a.base]
      const be = BASES_ESPECIAIS[a.baseEspecial]
      const pr = prazo(a.prazo)
      linhas.push(
        `${i + 1}. ${a.nome.toUpperCase()}`,
        '',
        `   Finalidade`,
        `   ${a.finalidade}`,
        '',
        `   Titulares dos dados`,
        `   ${a.titulares.join('; ')}`,
        '',
        `   Categorias de dados`,
        ...a.categorias.map(c => `   · ${c}`),
        '',
        `   Categorias especiais (art. 9.º)   ${a.especiais ? 'Sim' : 'Não'}`,
        `   Base legal (art. 6.º)             ${bg.nome} — ${bg.artigo}`,
        ...(a.especiais ? [`   Base legal (art. 9.º)             ${be.nome} — ${be.artigo}`] : []),
        '',
        `   Conservação`,
        `   ${pr ? `${pr.quanto}${pr.desde !== '—' ? `, a contar ${pr.desde}` : ''}. ${pr.fundamento}` : '—'}`,
        '',
        `   Destinatários`,
        `   ${a.destinatarios.length ? a.destinatarios.join('; ') : 'Apenas a equipa autorizada da instituição e os subcontratantes abaixo.'}`,
        '',
        `   Onde fica guardado`,
        `   ${a.tabelas.join(', ')}`,
        '',
        '',
      )
    })

    linhas.push(
      '── SUBCONTRATANTES E TRANSFERÊNCIAS ──────────────────────────────',
      '',
      ...SUBPROCESSORS.map(sp =>
        `· ${sp.name} — ${sp.purpose}. ${sp.location}.${sp.transfer ? ` ${sp.transfer}.` : ''}`),
      '',
      '',
      '── MEDIDAS DE SEGURANÇA (art. 30.º/1-g) ──────────────────────────',
      '',
      '· Cifra em trânsito (TLS) e em repouso.',
      '· Controlo de acesso ao nível da base de dados (Row Level Security), por',
      '  instituição e por área de permissões — não por ecrã.',
      '· Autenticação com palavra-passe cifrada e sessões com expiração.',
      '· Registo de quem acede e altera dados de saúde, com autor e momento.',
      '· Cópias de segurança diárias, mantidas pelo fornecedor de base de dados.',
      '· Notas de acompanhamento psicossocial com restrição adicional de leitura.',
      '',
      '',
      `Elaborado em ${new Date().toLocaleDateString('pt-PT')}.`,
      '',
      'Assinatura do responsável pelo tratamento: ______________________________',
      '',
    )

    printDoc({
      docTitle: 'Registo das atividades de tratamento',
      docSubtitle: `${casa} — artigo 30.º do RGPD`,
      institution: casa,
      sections: [],
      corpo: linhas.join('\n'),
    })
  }

  return (
    <Painel cabeca={
      <Cabecalho>
        <span style={{ ...ROTULO, flex: 1 }}>Registo das atividades de tratamento</span>
        <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
          RGPD ART. 30.º · {atividades.length} ATIVIDADES
        </span>
        <Botao feitio="principal" onClick={imprimir}>IMPRIMIR</Botao>
      </Cabecalho>
    }>
      <div style={{ padding: 'var(--space-7)' }}>
        <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          É a primeira coisa que a CNPD pede numa fiscalização. Está gerado a partir
          do que o Phlox guarda mesmo — cada atividade diz com que fundamento legal
          trata os dados, durante quanto tempo os guarda e em que tabelas ficam.
        </p>

        {/* O aviso de âmbito vem ANTES da lista, não depois. Depois, lê-se como
            uma ressalva; antes, é a moldura com que se lê o resto. */}
        <div style={{ marginTop: 'var(--space-7)' }}>
          <Aviso tom="atencao" titulo="Isto não é o registo todo da casa">
            {LIMITE_DO_REGISTO}
          </Aviso>
        </div>

        <div style={{ marginTop: 'var(--space-9)', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {atividades.map(a => (
            <UmaAtividade key={a.id} a={a}
              aberta={aberta === a.id}
              aoAbrir={() => setAberta(aberta === a.id ? null : a.id)} />
          ))}
        </div>
      </div>
    </Painel>
  )
}

function UmaAtividade({ a, aberta, aoAbrir }: {
  a: Atividade; aberta: boolean; aoAbrir: () => void
}) {
  const bg = BASES_GERAIS[a.base]
  const be = BASES_ESPECIAIS[a.baseEspecial]
  const pr = PRAZOS.find(p => p.id === a.prazo)

  return (
    <div style={{ borderBottom: '1px solid var(--bg-2)' }}>
      <button type="button" onClick={aoAbrir} className="mesa-botao"
        style={{
          display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
          background: 'none', border: 'none', padding: 'var(--space-6) 0', fontFamily: 'inherit',
        }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)', fontWeight: 'var(--peso-corpo)' as any }}>
            {a.nome}
          </span>
          {/* O art. 9.º é o que muda tudo: dados de saúde têm dois crivos, não
              um. Quem lê esta lista tem de ver de longe quais são. */}
          {a.especiais && (
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--amber)' }}>ART. 9.º</span>
          )}
          <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginLeft: 'auto' }}>
            {pr?.quanto || '—'}
          </span>
        </span>
      </button>

      {aberta && (
        <div style={{ paddingBottom: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Linha rotulo="Finalidade">{a.finalidade}</Linha>
          <Linha rotulo="Titulares">{a.titulares.join(' · ')}</Linha>
          <Linha rotulo="Categorias">
            {a.categorias.map((c, i) => (
              <span key={i} style={{ display: 'block' }}>· {c}</span>
            ))}
          </Linha>
          <Linha rotulo="Base legal">
            <span style={{ display: 'block' }}>{bg.nome} — {bg.artigo}</span>
            {a.especiais && <span style={{ display: 'block' }}>{be.nome} — {be.artigo}</span>}
          </Linha>
          <Linha rotulo="Conservação">
            {pr ? `${pr.quanto}${pr.desde !== '—' ? `, a contar ${pr.desde}` : ''}` : '—'}
            {pr && (
              <span style={{ display: 'block', color: 'var(--ink-5)', fontSize: 'var(--t-meta)', marginTop: 2 }}>
                {pr.fundamento}
                {!pr.naLei && ' — escolha fundamentada da casa, não imposição legal.'}
              </span>
            )}
          </Linha>
          <Linha rotulo="Destinatários">
            {a.destinatarios.length
              ? a.destinatarios.join(' · ')
              : 'Apenas a equipa autorizada e os subcontratantes.'}
          </Linha>
          {/* As tabelas por baixo são o que torna isto verificável em vez de
              declarativo: alguém pode abrir a base de dados e confirmar. */}
          <Linha rotulo="Onde fica">
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', lineHeight: 1.7 }}>
              {a.tabelas.join(' · ')}
            </span>
          </Linha>
        </div>
      )}
    </div>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '118px 1fr', gap: 'var(--space-6)', alignItems: 'baseline' }}>
      <span style={{ ...ROTULO, color: 'var(--ink-4)' }}>{rotulo}</span>
      <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.6 }}>{children}</span>
    </div>
  )
}
