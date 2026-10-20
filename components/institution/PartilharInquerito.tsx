'use client'

// components/institution/PartilharInquerito.tsx
// ═══════════════════════════════════════════════════════════════════════════
// O LINK, O CÓDIGO E O CARTAZ
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O PEDIDO ───────────────────────────────────────────────────────────────
// «Os inquéritos deviam de dar para partilhar.» (Fernando)
//
// ── TRÊS CANAIS, PORQUE AS FAMÍLIAS NÃO SÃO TODAS IGUAIS ───────────────────
// Numa casa portuguesa, as famílias de trinta utentes distribuem-se assim: uma
// parte abre um link no WhatsApp sem pensar; outra parte lê um papel afixado à
// entrada e escreve o endereço à mão; e há sempre quem não faça nem uma coisa
// nem outra, e para essa continua a haver a folha em papel que já existia.
//
// Por isso aqui há o LINK (copiar e colar), o CÓDIGO em grande (para dizer ao
// telefone ou escrever num quadro) e um CARTAZ para imprimir e afixar. É o
// mesmo inquérito pelos três.
//
// ── PORQUE É QUE NÃO HÁ UM QR CÓDIGO ───────────────────────────────────────
// Porque desenhá-lo bem obriga a uma biblioteca, e uma biblioteca de QR no
// pacote de toda a gente para uma página que se abre uma vez por ano é caro
// pelo que vale. O endereço tem seis caracteres de propósito: escreve-se à mão
// mais depressa do que se aponta uma câmara. Se um dia houver procura, entra.

import { useState } from 'react'
import { printDoc } from '@/lib/print'
import { Folha, Botao, MONO, ROTULO } from '@/components/ui/mesa'

export default function PartilharInquerito({ inquerito, casa, aoFechar }: {
  /* `codigo?` e nao `codigo`: os inqueritos criados antes de haver links
     nao o tem, e e esse o caso que a folha trata logo a seguir. Exigi-lo aqui
     obrigava quem chama a inventar uma cadeia vazia — e a folha deixava de
     saber distinguir «sem codigo» de «codigo por preencher». */
  inquerito: { titulo: string; codigo?: string | null; publico: string }
  /** O nome da casa. Entra no cartaz, não no link. */
  casa: string
  aoFechar: () => void
}) {
  const [copiado, setCopiado] = useState<'link' | 'codigo' | null>(null)

  /* `window.location.origin` e não um endereço escrito à mão: em pré-produção
     o link tem de apontar para pré-produção, senão quem o testa responde ao
     inquérito de produção sem dar por isso. */
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const codigo = (inquerito.codigo || '').toUpperCase()
  const link = `${base}/i/${codigo}`

  async function copiar(o: 'link' | 'codigo') {
    try {
      await navigator.clipboard.writeText(o === 'link' ? link : codigo)
      setCopiado(o)
      setTimeout(() => setCopiado(null), 2500)
    } catch {
      /* Sem área de transferência (acontece em browsers antigos e em
         contextos não seguros) o texto está à vista e seleciona-se à mão —
         por isso não se diz nada em vez de dar um erro por uma conveniência. */
    }
  }

  function imprimirCartaz() {
    printDoc({
      docTitle: inquerito.titulo,
      docSubtitle: `${casa} — a sua opinião, sem nome`,
      institution: casa,
      /* `corpo` e nao `sections`: um cartaz e prosa com linhas em branco que
         contam, nao uma tabela de registos. Ver a nota no PrintDoc. */
      sections: [],
      corpo: [
        'No telemóvel, escreva este endereço:',
        '',
        link,
        '',
        `Ou vá a ${base.replace(/^https?:\/\//, '')} e escreva o código:   ${codigo}`,
        '',
        '',
        'São poucas perguntas e leva dois minutos.',
        '',
        'NÃO LHE PEDIMOS O NOME. Ninguém consegue saber que a resposta é sua —',
        'nem quem trabalha aqui, nem quem fez a aplicação.',
        '',
        'Se preferir em papel, peça a folha na receção.',
      ].join('\n'),
    })
  }

  if (!codigo) {
    return (
      <Folha titulo="Partilhar" aoFechar={aoFechar}>
        <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 12 }}>
          Este inquérito foi criado antes de haver links de partilha e não tem
          código. Crie um inquérito novo para o poder partilhar — a folha em
          papel deste continua a funcionar.
        </p>
        <div style={{ marginTop: 14 }}><Botao onClick={aoFechar}>FECHAR</Botao></div>
      </Folha>
    )
  }

  return (
    <Folha titulo="Partilhar o inquérito" aoFechar={aoFechar}>
      <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6, margin: '12px 0 0' }}>
        Quem abrir isto responde sem conta e sem dar o nome. As respostas entram
        aqui misturadas com as que forem lançadas em papel.
      </p>

      {/* ── O CÓDIGO EM GRANDE ──────────────────────────────────────────────
          Antes do link, de propósito. O link copia-se; o código diz-se ao
          telefone e escreve-se num quadro, e é por isso que tem de ser o que
          se lê primeiro e de longe. */}
      <div style={{
        marginTop: 16, padding: '16px 14px', textAlign: 'center',
        border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)',
        background: 'var(--bg-2)',
      }}>
        <div style={{ ...ROTULO, color: 'var(--ink-4)' }}>O código</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 'var(--t-numero)',
          letterSpacing: '0.18em', color: 'var(--ink)', margin: '6px 0 2px',
          fontWeight: 'var(--peso-forte)' as any,
        }}>{codigo}</div>
        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
          {base.replace(/^https?:\/\//, '')}/i/{codigo}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
        <Botao feitio="principal" onClick={() => copiar('link')}>
          {copiado === 'link' ? 'COPIADO ✓' : 'COPIAR O LINK'}
        </Botao>
        <Botao onClick={() => copiar('codigo')}>
          {copiado === 'codigo' ? 'COPIADO ✓' : 'COPIAR O CÓDIGO'}
        </Botao>
        <Botao onClick={imprimirCartaz}>IMPRIMIR O CARTAZ</Botao>
      </div>

      <div style={{
        marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)',
        fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.6,
      }}>
        <div style={{ ...MONO, color: 'var(--ink-4)', marginBottom: 4 }}>Enquanto estiver aberto</div>
        O link recebe respostas até fechar o inquérito. Depois de fechado, quem
        lá chegar vê que já terminou — e não há forma de responder por engano a
        um inquérito do ano passado.
      </div>
    </Folha>
  )
}
