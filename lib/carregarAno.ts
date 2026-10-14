// lib/carregarAno.ts
// ─────────────────────────────────────────────────────────────────────────────
// De onde vem o que aparece no calendário do ano.
//
// ── A REGRA: O CALENDÁRIO LÊ, NÃO GUARDA ───────────────────────────────────
// Quase tudo o que aqui aparece já vive noutro sítio: as atividades em
// `activities`, as visitas em `visit_requests`, as consultas em
// `appointments`, os prazos em `incidents`, as validades em `stock_items` e
// `documents`, os aniversários na data de nascimento. Copiar essas datas para
// uma tabela de calendário criava uma segunda verdade que se desencontra da
// primeira em silêncio.
//
// ── UMA FONTE QUE FALHA NÃO PODE DESAPARECER SEM DIZER NADA ────────────────
// São oito consultas. Algumas vão a tabelas que ainda não existem em todas as
// instalações (os prazos das ocorrências são do sprint161, as entradas
// previstas do sprint165). Se eu deixasse uma falha passar em branco, o
// calendário desenhava-se todo, bonito, sem as visitas — e ninguém teria
// maneira de saber que faltava alguma coisa.
//
// Por isso cada fonte é apanhada em separado e o que falhou volta em
// `falharam`, com o nome pelo qual a pessoa a conhece. A página diz.
//
// ── E O NÚMERO DE CHAMADAS ──────────────────────────────────────────────────
// No plano gratuito do Supabase o que conta são as LINHAS DE REGISTO, ou seja
// o número de chamadas. Oito é muito para um ecrã. Vão todas em paralelo e
// passam pela `leituraPartilhada`, que junta pedidos iguais e guarda a
// resposta cinco minutos — mudar de ano para trás e para a frente não volta a
// perguntar nada.
// ─────────────────────────────────────────────────────────────────────────────

import { leituraPartilhada } from './leituraPartilhada'
import { noAno, idadeQueFaz, feriados, CORES_GUARDADAS, type Marca } from './calendario'

type Filtro = <T>(q: T) => T

export type Ano = {
  marcas: Marca[]
  /** Fontes que não responderam, pelo nome que a pessoa lhes dá. */
  falharam: string[]
}

/** Uma fonte: um nome, uma consulta, e como se transforma em marcas. */
type Fonte = {
  nome: string
  chave: string
  ler: () => PromiseLike<{ data: any[] | null; error: any }>
  paraMarcas: (linhas: any[]) => Marca[]
}

/** 'AAAA-MM-DD' de qualquer coisa que o Postgres devolva como data. */
const dia = (v: any): string | null => {
  if (!v) return null
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

/** 'HH:MM' de um `time` ou de um instante. */
const hora = (v: any): string | undefined => {
  if (!v) return undefined
  const m = /(\d{2}):(\d{2})/.exec(String(v))
  return m ? `${m[1]}:${m[2]}` : undefined
}

export async function carregarAno(
  supabase: any, filtro: Filtro, ano: number,
): Promise<Ano> {
  const de = `${ano}-01-01`
  const ate = `${ano}-12-31`

  // Os nomes das pessoas, uma vez, para as outras fontes não terem cada uma
  // de ir buscar o seu. Também é daqui que saem os aniversários.
  const pessoas = await leituraPartilhada(
    `ano:pessoas`,
    () => filtro(supabase.from('patients')
      .select('id, name, date_of_birth, admission_date')
      .eq('active', true)),
  ).catch(() => ({ data: null, error: true }))

  const linhas: any[] = (pessoas as any).data || []
  const nomeDe = new Map<string, string>(linhas.map((p: any) => [p.id, p.name]))

  const fontes: Fonte[] = [
    {
      nome: 'Atividades', chave: `ano:atividades:${ano}`,
      // Cada ocorrência de uma atividade que se repete é uma linha própria,
      // com a sua data (`recurring_id` só as liga). Por isso não há nada para
      // expandir aqui — basta ler o intervalo.
      ler: () => filtro(supabase.from('activities')
        .select('id, title, date, start_time, status, location')
        .gte('date', de).lte('date', ate)),
      paraMarcas: rows => rows.flatMap(r => {
        const d = dia(r.date)
        if (!d || r.status === 'cancelled') return []
        return [{
          id: `ativ-${r.id}`, data: d, titulo: r.title || 'Atividade',
          origem: 'atividade' as const, hora: hora(r.start_time),
          detalhe: r.location || undefined,
        }]
      }),
    },
    {
      nome: 'Visitas', chave: `ano:visitas:${ano}`,
      ler: () => filtro(supabase.from('visit_requests')
        .select('id, patient_id, requested_date, requested_time, status')
        .gte('requested_date', de).lte('requested_date', ate)),
      paraMarcas: rows => rows.flatMap(r => {
        const d = dia(r.requested_date)
        // Uma visita recusada não é uma visita. Mostrá-la fazia a casa contar
        // com uma família que não vem — ou pior, dizer à família que vinha.
        //
        // A palavra é `declined`. Escrevi `rejected` primeiro, de cabeça, e
        // não filtrava nada: as recusadas apareciam todas como se estivessem
        // marcadas. Os valores reais nesta coluna são `declined` e
        // `completed`; `cancelled` fica à espera de vir a existir.
        if (!d || r.status === 'declined' || r.status === 'rejected'
            || r.status === 'cancelled') return []
        const quem = nomeDe.get(r.patient_id)
        return [{
          id: `visita-${r.id}`, data: d, origem: 'visita' as const,
          titulo: quem ? `Visita a ${quem}` : 'Visita',
          quem, quemId: r.patient_id, hora: hora(r.requested_time),
          detalhe: r.status === 'pending' ? 'Ainda por confirmar.' : undefined,
        }]
      }),
    },
    {
      nome: 'Consultas', chave: `ano:consultas:${ano}`,
      // `speciality` e não `specialty`: a coluna está escrita à inglesa. Com
      // o nome americano o PostgREST recusa a consulta INTEIRA e as consultas
      // desapareciam todas do calendário sem uma linha de erro.
      ler: () => filtro(supabase.from('appointments')
        .select('id, patient_id, title, date, time, speciality, status, location')
        .gte('date', de).lte('date', ate)),
      paraMarcas: rows => rows.flatMap(r => {
        const d = dia(r.date)
        if (!d || r.status === 'cancelled') return []
        const quem = nomeDe.get(r.patient_id)
        return [{
          id: `consulta-${r.id}`, data: d, origem: 'consulta' as const,
          titulo: r.title || r.speciality || 'Consulta',
          quem, quemId: r.patient_id, hora: hora(r.time),
          detalhe: r.location || undefined,
        }]
      }),
    },
    {
      // Sem o ano na chave, de propósito: a consulta é a mesma seja qual for
      // o ano que se está a ver (filtra-se depois, em memória). Com o ano na
      // chave, andar para trás e para a frente repetia a chamada — e no plano
      // gratuito do Supabase o que custa é o número de chamadas.
      nome: 'Prazos das ocorrências', chave: 'ano:prazos',
      // `select('*')` porque `prazo` e `responsavel` são colunas novas
      // (sprint161) e o PostgREST recusa a consulta INTEIRA quando se nomeia
      // uma coluna que ainda não existe — devolvia `data: null`, que é
      // indistinguível de «não há prazos nenhuns».
      ler: () => filtro(supabase.from('incidents').select('*').neq('status', 'closed')),
      paraMarcas: rows => rows.flatMap(r => {
        const d = dia(r.prazo)
        if (!d || d < de || d > ate) return []
        const quem = nomeDe.get(r.patient_id)
        return [{
          id: `prazo-${r.id}`, data: d, origem: 'prazo' as const,
          titulo: `Fechar: ${r.type || 'ocorrência'}`,
          quem, quemId: r.patient_id,
          detalhe: r.responsavel ? `A cargo de ${r.responsavel}.` : undefined,
        }]
      }),
    },
    {
      nome: 'Validades do stock', chave: `ano:validades:${ano}`,
      ler: () => filtro(supabase.from('stock_items')
        .select('id, name, expiry_date, quantity')
        .gte('expiry_date', de).lte('expiry_date', ate)),
      paraMarcas: rows => rows.flatMap(r => {
        const d = dia(r.expiry_date)
        return d ? [{
          id: `val-${r.id}`, data: d, origem: 'validade' as const,
          titulo: `Caduca: ${r.name || 'artigo'}`,
          detalhe: r.quantity ? `${r.quantity} em existência.` : undefined,
        }] : []
      }),
    },
    {
      nome: 'Documentos', chave: `ano:documentos:${ano}`,
      // A coluna chama-se `name`, não `title`.
      ler: () => filtro(supabase.from('documents')
        .select('id, name, category, expiry_date, patient_id')
        .gte('expiry_date', de).lte('expiry_date', ate)),
      paraMarcas: rows => rows.flatMap(r => {
        const d = dia(r.expiry_date)
        if (!d) return []
        const quem = nomeDe.get(r.patient_id)
        return [{
          id: `doc-${r.id}`, data: d, origem: 'documento' as const,
          titulo: `Caduca: ${r.name || 'documento'}`, quem, quemId: r.patient_id,
          detalhe: r.category || undefined,
        }]
      }),
    },
    {
      nome: 'Entradas previstas', chave: `ano:inscricoes:${ano}`,
      ler: () => filtro(supabase.from('candidaturas')
        .select('id, nome, desejada_em').eq('estado', 'em_espera')
        .gte('desejada_em', de).lte('desejada_em', ate)),
      paraMarcas: rows => rows.flatMap(r => {
        const d = dia(r.desejada_em)
        return d ? [{
          id: `insc-${r.id}`, data: d, origem: 'inscricao' as const,
          titulo: `${r.nome} gostaria de entrar`, quem: r.nome,
        }] : []
      }),
    },
    {
      nome: 'Marcado à mão', chave: 'ano:marcas',
      // Sem intervalo de datas: as anuais podem estar guardadas com uma data
      // de 2019 e têm de aparecer em 2031. São poucas.
      ler: () => filtro(supabase.from('calendario_marcas').select('*')),
      paraMarcas: rows => rows.flatMap(r => {
        const original = dia(r.data)
        if (!original) return []
        let data = original, movida: string | undefined
        if (r.repete === 'anual') {
          const posto = noAno(original, ano)
          if (!posto) return []
          data = posto.data; movida = posto.movida
        } else if (!original.startsWith(`${ano}-`)) {
          // Uma marca de vários dias que atravessa a passagem do ano continua
          // a contar: começa em dezembro e acaba em janeiro.
          const fim = dia(r.ate)
          if (!(fim && original < de && fim >= de)) return []
          data = de
        }
        const quem = nomeDe.get(r.patient_id)
        const fim = dia(r.ate)
        return [{
          id: `marca-${r.id}`, data, movida, origem: 'manual' as const,
          titulo: r.titulo, hora: hora(r.hora), quem, quemId: r.patient_id,
          // A cor que a casa escolheu. Um nome que não conheçamos cai na da
          // origem, que é o que acontecia a todas elas até agora.
          cor: CORES_GUARDADAS[String(r.cor || '')] || undefined,
          detalhe: [r.detalhe, fim && fim !== original ? `Até ${fim}.` : null]
            .filter(Boolean).join(' ') || undefined,
        }]
      }),
    },
  ]

  const resultados = await Promise.all(fontes.map(async f => {
    try {
      const { data, error } = await leituraPartilhada(f.chave, f.ler)
      if (error) return { nome: f.nome, marcas: [] as Marca[], falhou: true }
      return { nome: f.nome, marcas: f.paraMarcas(data || []), falhou: false }
    } catch {
      return { nome: f.nome, marcas: [] as Marca[], falhou: true }
    }
  }))

  // ── Os aniversários, das pessoas que já lemos ───────────────────────────
  const aniversarios: Marca[] = []
  for (const p of linhas) {
    const nascimento = dia(p.date_of_birth)
    if (nascimento) {
      const posto = noAno(nascimento, ano)
      if (posto) {
        const anos = idadeQueFaz(nascimento, ano)
        aniversarios.push({
          id: `nasc-${p.id}`, data: posto.data, movida: posto.movida,
          origem: 'aniversario', titulo: anos ? `${p.name} faz ${anos}` : `Aniversário de ${p.name}`,
          quem: p.name, quemId: p.id,
        })
      }
    }
    // Anos de casa. Não se assinala o dia da entrada como um aniversário —
    // no primeiro ano ainda não faz um ano de nada.
    const entrada = dia(p.admission_date)
    if (entrada) {
      const anos = idadeQueFaz(entrada, ano)
      const posto = noAno(entrada, ano)
      if (posto && anos && anos >= 1) {
        aniversarios.push({
          id: `entr-${p.id}`, data: posto.data, movida: posto.movida,
          origem: 'entrada', titulo: `${p.name} — ${anos} ${anos === 1 ? 'ano' : 'anos'} de casa`,
          quem: p.name, quemId: p.id,
        })
      }
    }
  }

  const marcas = [
    ...aniversarios,
    ...feriados(ano),
    ...resultados.flatMap(r => r.marcas),
  ].sort((a, b) => a.data.localeCompare(b.data) || (a.hora || '99').localeCompare(b.hora || '99'))

  return {
    marcas,
    falharam: [
      ...((pessoas as any).error ? ['Pessoas'] : []),
      ...resultados.filter(r => r.falhou).map(r => r.nome),
    ],
  }
}
