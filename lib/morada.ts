// lib/morada.ts
// ─────────────────────────────────────────────────────────────────────────────
// Partir uma morada portuguesa escrita à mão nas suas peças.
//
// Existe por causa de um bug concreto: o /api/geocode procurava o código
// postal com `\b\d{4}\b` e, numa morada como "Rua das Flores 1234", apanhava o
// NÚMERO DA PORTA. Depois procurava "1234" no mapa e aterrava do outro lado do
// país — daí o "às vezes o código postal dá errado".
//
// A regra aqui é estrita: só a forma completa NNNN-NNN é código postal. Um
// número de quatro dígitos solto numa morada portuguesa é quase sempre a porta,
// e na dúvida é melhor não ter código postal nenhum do que ter um errado.
//
// O objetivo declarado é que **rua + localidade cheguem**. Por isso o que sai
// daqui alimenta uma pesquisa ESTRUTURADA (street=, city=), que é a que acerta
// com moradas escritas por pessoas — e não uma linha de texto livre atirada ao
// motor de busca.
// ─────────────────────────────────────────────────────────────────────────────

export interface MoradaPartida {
  /** "Rua das Flores, 12" — a via e o número, se houver. */
  rua: string
  /** "2745-123", ou vazio. NUNCA um número de porta. */
  codigoPostal: string
  /** "Queluz" — a terra. */
  localidade: string
  /** o que a pessoa escreveu, normalizado. */
  bruto: string
}

/** Palavras que começam uma via — servem para não confundir a rua com a terra
 *  quando a morada não tem vírgulas nem código postal. */
const INICIO_DE_VIA = /^(r\.?|rua|av\.?|avenida|tv\.?|travessa|pr\.?|praceta|praça|praca|lg\.?|largo|estr\.?|estrada|cc\.?|calçada|calcada|beco|bairro|urb\.?|urbanização|urbanizacao|quinta|caminho|alameda|rotunda|impasse|azinhaga|vila)\b/i

/** NNNN-NNN, com ou sem o hífen, mas sempre os sete dígitos. */
const CODIGO_POSTAL = /\b(\d{4})\s*[-–]\s*(\d{3})\b/

export function separarMorada(texto?: string | null): MoradaPartida {
  const bruto = String(texto || '').replace(/\s+/g, ' ').trim()
  if (!bruto) return { rua: '', codigoPostal: '', localidade: '', bruto: '' }

  const m = bruto.match(CODIGO_POSTAL)

  if (m) {
    const codigoPostal = `${m[1]}-${m[2]}`
    const corte = bruto.indexOf(m[0])
    const antes = bruto.slice(0, corte)
    const depois = bruto.slice(corte + m[0].length)
    return {
      rua: limpar(antes),
      codigoPostal,
      // Tudo o que vem depois do código postal é a terra — até à primeira
      // vírgula, que costuma abrir o concelho ou o distrito.
      localidade: limpar(depois.split(/[,\n]/)[0] || ''),
      bruto,
    }
  }

  // Sem código postal: a vírgula é a única pista de onde acaba a rua.
  const partes = bruto.split(',').map(p => p.trim()).filter(Boolean)

  if (partes.length >= 2) {
    const ultima = partes[partes.length - 1]
    // "Rua das Flores, 12" não tem localidade nenhuma — o último pedaço é o
    // número da porta. Nesse caso é tudo rua.
    if (/^(n\.?º?\s*)?\d{1,4}\s*[a-zA-Z]?$/.test(ultima)) {
      return { rua: limpar(bruto), codigoPostal: '', localidade: '', bruto }
    }
    return { rua: limpar(partes.slice(0, -1).join(', ')), codigoPostal: '', localidade: limpar(ultima), bruto }
  }

  // Uma linha só. Se começa por "Rua", "Av.", etc., é uma via sem terra;
  // caso contrário é só o nome de um sítio.
  return INICIO_DE_VIA.test(bruto)
    ? { rua: limpar(bruto), codigoPostal: '', localidade: '', bruto }
    : { rua: '', codigoPostal: '', localidade: limpar(bruto), bruto }
}

function limpar(s: string): string {
  return s.replace(/^[\s,.;–-]+|[\s,.;–-]+$/g, '').trim()
}

/** A etiqueta de zona que agrupa as paragens na folha do motorista.
 *  Usa o código postal quando ele existe A SÉRIO; senão, a terra. */
export function zonaDaMoradaPartida(m: MoradaPartida): string {
  if (!m.bruto) return 'Sem morada registada'
  if (m.codigoPostal) {
    const quatro = m.codigoPostal.slice(0, 4)
    return m.localidade ? `${quatro} · ${m.localidade.slice(0, 24)}` : quatro
  }
  if (m.localidade) return m.localidade.slice(0, 28)
  return m.rua.slice(0, 28) || 'Sem morada registada'
}

/** O que vale a pena mostrar a quem escreveu a morada, para perceber se o
 *  sistema a entendeu como devia. */
export function descreverMorada(m: MoradaPartida): string {
  const p = [m.rua, m.codigoPostal, m.localidade].filter(Boolean)
  return p.join(' · ')
}
