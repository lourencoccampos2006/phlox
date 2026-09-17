// lib/memoriaDocumentos.ts
// ─────────────────────────────────────────────────────────────────────────────
// A impressão digital de um documento, e o que se faz com ela.
//
// ── O PROBLEMA ─────────────────────────────────────────────────────────────
// Analisar duas vezes o mesmo relatório dava dois textos diferentes. É o que um
// modelo de linguagem faz — cada chamada é nova. Mas para quem está a tentar
// perceber um exame isso mina a confiança toda: se a resposta muda, qual delas
// é verdade?
//
// A solução não é baixar a temperatura (continuaria a variar). É guardar a
// PRIMEIRA leitura com o sha-256 do conteúdo e devolvê-la quando o mesmo
// documento voltar. A resposta passa a ser estável porque é literalmente a
// mesma, não porque o modelo se portou bem.
//
// ── O QUE SE GUARDA, E QUANDO ──────────────────────────────────────────────
// Só com a memória LIGADA (profiles.memoria_documentos). Desligada, não se
// grava nada — nem a análise, nem a impressão digital — e cada leitura é nova.
// É desligada mesmo, não "escondida".
// ─────────────────────────────────────────────────────────────────────────────

/** sha-256 do conteúdo, em hexadecimal.
 *
 *  Feito no browser: o ficheiro já lá está e não vale a pena mandá-lo para o
 *  servidor só para o medir. Funciona com o base64 de uma imagem/PDF ou com o
 *  texto colado — o que conta é ser o MESMO input a dar o MESMO hash. */
export async function impressaoDigital(conteudo: string): Promise<string> {
  // `crypto.subtle` exige contexto seguro (https ou localhost). Sem ele, não
  // há memória — e é melhor não haver do que haver uma chave fraca a agrupar
  // documentos diferentes debaixo da mesma leitura.
  if (typeof crypto === 'undefined' || !crypto.subtle) return ''
  try {
    const bytes = new TextEncoder().encode(conteudo)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return '' }
}

export interface PreferenciasMemoria {
  memoria: boolean
  guardarNoCofre: boolean
  temCofre: boolean
}

/** Lê as escolhas da pessoa. Tolerante: enquanto o sprint146 não for aplicado,
 *  devolve memória LIGADA e cofre desligado — que é o comportamento de
 *  omissão — em vez de rebentar. */
export async function lerPreferencias(supabase: any, userId: string, plano: string): Promise<PreferenciasMemoria> {
  const temCofre = ['pro', 'clinic'].includes(plano)
  try {
    const { data, error } = await supabase
      .from('profiles').select('memoria_documentos, guardar_no_cofre').eq('id', userId).maybeSingle()
    if (error) return { memoria: true, guardarNoCofre: false, temCofre }
    return {
      memoria: data?.memoria_documentos !== false,
      guardarNoCofre: temCofre && data?.guardar_no_cofre === true,
      temCofre,
    }
  } catch {
    return { memoria: true, guardarNoCofre: false, temCofre }
  }
}

/** A leitura que já foi feita deste documento, se houver. */
export async function leituraAnterior(supabase: any, userId: string, hash: string): Promise<any | null> {
  if (!hash) return null
  try {
    const { data, error } = await supabase
      .from('documentos_memoria').select('analise, criado_em')
      .eq('user_id', userId).eq('hash', hash).maybeSingle()
    if (error || !data?.analise) return null
    return { ...data.analise, _lidoEm: data.criado_em, _daMemoria: true }
  } catch { return null }
}

/** Guarda a leitura. Só é chamada com a memória ligada — a decisão é de quem
 *  chama, para o sítio da decisão ser um só e não estar espalhado. */
export async function guardarLeitura(
  supabase: any,
  args: { userId: string; hash: string; analise: any; origem?: string; perfilId?: string | null; noCofre?: boolean },
): Promise<void> {
  if (!args.hash || !args.analise) return
  try {
    await supabase.from('documentos_memoria').upsert({
      user_id: args.userId,
      profile_id: args.perfilId || null,
      hash: args.hash,
      tipo: args.analise.kind || null,
      titulo: args.analise.title || null,
      resumo: args.analise.emDuasLinhas || null,
      analise: args.analise,
      origem: args.origem || 'scan',
      no_cofre: !!args.noCofre,
    }, { onConflict: 'user_id,hash' })
  } catch { /* a memória nunca pode travar a leitura */ }
}

/** Uma frase honesta para mostrar quando a resposta vem da memória.
 *  Sem isto, a pessoa não percebe porque é que desta vez foi instantâneo. */
export function explicarMemoria(lidoEm?: string): string {
  if (!lidoEm) return 'Já tinha lido este documento — é a mesma leitura de antes.'
  const d = new Date(lidoEm)
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000)
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`
  return `Já tinha lido este documento ${quando} — para a resposta não mudar, é a mesma leitura.`
}
