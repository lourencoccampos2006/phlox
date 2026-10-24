'use client'

// components/team/RaciosDePessoal.tsx
// ═══════════════════════════════════════════════════════════════════════════
// O QUADRO DE PESSOAL, CONTADO
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O QUE ISTO SUBSTITUI ───────────────────────────────────────────────────
// Uma caixa na checklist de conformidade que dizia «cumprimento dos rácios
// mínimos» e esperava que alguém a marcasse. A aplicação sabe quantas pessoas
// a casa tem e em que função, sabe quantos utentes lá estão, e pedia à direção
// técnica que fizesse a divisão de cabeça e lhe dissesse o resultado.
//
// ── A ORDEM DO ECRÃ É UM ARGUMENTO ─────────────────────────────────────────
// Primeiro o que a casa TEM, em números grandes: «6 ajudantes · 24 utentes ·
// 1 para cada 4». Isso sai dos dados dela e é sempre verdade.
//
// O mínimo legal vem depois, numa coluna à parte, com o artigo ao lado e um
// aviso para o ir confirmar. Não é cautela decorativa: um rácio legal mal
// transcrito aqui dentro pode levar uma casa a trabalhar com menos gente do
// que devia.
//
// Para o centro de dia não se mostra mínimo nenhum, porque o diploma é outro
// (Despacho Normativo n.º 62/99) e não o temos. Mostra-se a conta da casa e
// diz-se onde está o número — ver `lib/racios.ts`.

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import {
  lerRacios, emPalavras, AVISO_DOS_MINIMOS, AVISO_DA_CONTAGEM,
  MINIMOS_CONHECIDOS, SEM_MINIMOS,
} from '@/lib/racios'
import {
  Painel, Cabecalho, LinhaTabela, Aviso, ACarregar,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function RaciosDePessoal({ membros }: {
  /** A equipa que a página já carregou. Uma segunda leitura discordaria da primeira. */
  membros: { role: string | null }[]
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const largo = useLargo()

  const [utentes, setUtentes] = useState<number | null>(null)
  const [erro, setErro] = useState(false)

  /* ── QUEM NÃO VÊ OS UTENTES NÃO VÊ ESTE PAINEL ──────────────────────────
     O número sai da `patients`, e a RLS recusa-o a quem não tem essa área.
     Sem esta guarda, uma auxiliar sem acesso a utentes abria a Equipa e lia
     «não foi possível contar os utentes» — um erro, por uma permissão que
     está a funcionar exactamente como devia.

     `pronto` porque as permissões chegam um render depois: a correr antes
     delas, `ve()` responde «não» a todos e o painel desaparecia e voltava. */
  const podeVerUtentes = scope.pronto && scope.ve('utentes')

  useEffect(() => {
    if (!user || !podeVerUtentes) return
    let vivo = true
    ;(async () => {
      /* `head: true` com `count`: a pergunta é «quantos», e trazer as fichas
         das pessoas para as contar seria pedir dados de saúde para não olhar
         para eles. */
      /* `or(is null, eq true)` e NÃO `neq('active', false)`.
         A coluna `active` só ganhou `default true` quando foi criada, e as
         fichas anteriores ficaram a NULL. Em SQL, `active <> false` é NULL
         para essas linhas — logo ficam de fora. Uma casa com utentes antigos
         veria menos utentes do que tem, e o rácio dava-a por cumprida quando
         não está. O resto da aplicação usa `active !== false`, que conta os
         nulos; esta consulta tem de dizer o mesmo. */
      const { count, error } = await scope.filter(
        supabase.from('patients').select('id', { count: 'exact', head: true }))
        .or('active.is.null,active.eq.true')
      if (!vivo) return
      if (error) { setErro(true); return }
      setUtentes(count || 0)
    })()
    return () => { vivo = false }
  }, [user, supabase, scope, podeVerUtentes])

  const leitura = useMemo(
    () => (utentes === null ? null : lerRacios(membros, utentes, institution)),
    [membros, utentes, institution])

  const cabeca = (
    <Cabecalho>
      <span style={{ ...ROTULO, flex: 1 }}>Quadro de pessoal</span>
      {leitura && (
        <span style={{ ...ROTULO, color: 'var(--ink-5)' }}>
          {MINIMOS_CONHECIDOS[institution]?.diploma || 'contagem da casa'}
        </span>
      )}
    </Cabecalho>
  )

  if (!podeVerUtentes) return null

  if (erro) {
    return (
      <Painel cabeca={cabeca}>
        <div style={{ padding: 14 }}>
          <Aviso tom="neutro">
            Não foi possível contar os utentes agora, e sem esse número o rácio não
            se calcula. Volte a abrir a página.
          </Aviso>
        </div>
      </Painel>
    )
  }

  if (!leitura) return <Painel cabeca={cabeca}><ACarregar oQue="A contar…" /></Painel>

  /* ── A LINHA DE CIMA ─────────────────────────────────────────────────────
     Os dois números de que tudo o resto depende, ditos antes de qualquer
     julgamento sobre eles. Quem abre isto numa visita lê esta linha primeiro. */
  const emFalta = leitura.emFalta.length

  return (
    <Painel cabeca={cabeca}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: largo ? 28 : 18,
        padding: largo ? '14px 16px' : '13px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <Numero rotulo="Utentes" valor={leitura.utentes} />
        <Numero
          rotulo="Equipa ativa"
          valor={leitura.racios.reduce((s, r) => s + r.tem, 0) + leitura.foraDeRacio} />
        {leitura.comMinimos && (
          <Numero
            rotulo={emFalta ? 'Funções em falta' : 'Funções cobertas'}
            valor={emFalta || leitura.racios.length}
            tom={emFalta ? 'var(--red)' : 'var(--green)'} />
        )}
      </div>

      <Cabecalho>
        <span style={{ ...ROTULO, flex: 1 }}>Função</span>
        <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Tem</span>
        {leitura.comMinimos && (
          <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Mínimo</span>
        )}
        <span style={{ ...ROTULO, width: 170, textAlign: 'right' }}>Na casa</span>
      </Cabecalho>

      {leitura.racios.map(r => (
        <LinhaTabela
          key={r.papel}
          principal={r.naPortaria}
          secundaria={
            r.pede === null ? undefined : [
              r.artigo,
              r.umPorCada ? `1 por cada ${r.umPorCada}` : 'a tempo inteiro',
              r.nota,
            ].filter(Boolean).join(' · ')
          }
          /* O filete vermelho só aparece quando há um mínimo com que comparar
             E ele não está cumprido. Sem mínimo não há incumprimento — e um
             filete de alarme numa linha que ninguém pode resolver é ruído. */
          filete={r.cumpre === false ? 'var(--red)' : undefined}
          celulas={[
            {
              rotulo: 'Tem', largura: 56, direita: true, forte: true,
              valor: r.tem,
              cor: r.cumpre === false ? 'var(--red)' : undefined,
            },
            ...(leitura.comMinimos ? [{
              rotulo: 'Mínimo', largura: 56, direita: true,
              valor: r.pede,
            }] : []),
            {
              rotulo: 'Na casa', largura: 170, direita: true,
              valor: emPalavras(r, leitura.utentes),
              cor: r.tem === 0 ? 'var(--ink-5)' : undefined,
            },
          ]}
          fim={r.cumpre === false ? (
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--red)' }}>
              {r.faltam === 1 ? 'falta 1' : `faltam ${r.faltam}`}
            </span>
          ) : undefined}
        />
      ))}

      <div style={{ padding: 14, display: 'grid', gap: 10 }}>
        {leitura.foraDeRacio > 0 && (
          <Aviso tom="neutro">
            {leitura.foraDeRacio === 1
              ? 'Uma pessoa da equipa tem uma função que não entra nestes rácios'
              : `${leitura.foraDeRacio} pessoas da equipa têm funções que não entram nestes rácios`}
            {' '}(administrativo, convidado, ou sem função atribuída). Contam para a
            casa, não para estas linhas.
          </Aviso>
        )}

        <Aviso tom="neutro">{AVISO_DA_CONTAGEM}</Aviso>

        {leitura.comMinimos
          ? <Aviso tom="atencao" titulo="Os mínimos são para confirmar">{AVISO_DOS_MINIMOS}</Aviso>
          : SEM_MINIMOS[institution] && (
            <Aviso tom="atencao" titulo="O diploma desta casa é outro">
              {SEM_MINIMOS[institution]}
            </Aviso>
          )}
      </div>
    </Painel>
  )
}

/** Um número grande com o seu rótulo. Mono e tabular, como todos os números daqui. */
function Numero({ rotulo, valor, tom }: {
  rotulo: string; valor: number; tom?: string
}) {
  return (
    <div>
      <div style={{ ...ROTULO, color: 'var(--ink-5)', marginBottom: 2 }}>{rotulo}</div>
      <div style={{
        ...MONO, fontSize: 'var(--t-numero)', lineHeight: 1,
        color: tom || 'var(--ink)',
      }}>{valor}</div>
    </div>
  )
}
