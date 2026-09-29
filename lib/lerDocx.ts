// lib/lerDocx.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tirar o texto de um .docx, sem biblioteca nenhuma.
//
// ── PORQUE É QUE ISTO EXISTE ────────────────────────────────────────────────
// O Fernando disse «deveria de conseguir ENVIAR-SE uma template». Quem trabalha
// num lar tem a ficha de inscrição num Word, não num campo de texto — pedir
// que a copiem e colem é pedir-lhes que façam o trabalho que o programa devia
// fazer.
//
// ── PORQUE É QUE NÃO USEI UMA BIBLIOTECA ───────────────────────────────────
// As que fazem isto (mammoth, docxtemplater) trazem um leitor de ZIP inteiro
// atrás e pesam centenas de kilobytes. Isto serve para ler UM ficheiro, uma
// vez, quando alguém carrega num botão — não justifica engordar o pacote que
// todos os outros ecrãs também carregam.
//
// Um .docx é um ZIP; o texto está em `word/document.xml`. O `DecompressionStream`
// que o browser já tem descomprime; o resto é ler o cabeçalho do ZIP, que são
// uns bytes fixos.
//
// ── E QUANDO FALHA ──────────────────────────────────────────────────────────
// Falha de propósito, com uma frase que diz o que fazer («guarde como .txt ou
// cole o texto»). Um leitor de ZIP escrito à mão não vai abrir tudo — um .doc
// antigo, um ficheiro protegido, um .docx escrito por um programa esquisito.
// O que NUNCA pode acontecer é devolver meio texto como se fosse o texto
// todo: o modelo ficava truncado e ninguém daria por isso até o documento sair
// da impressora sem metade das cláusulas.
// ─────────────────────────────────────────────────────────────────────────────

export class DocxIlegivel extends Error {
  constructor(porque: string) {
    super(porque)
    this.name = 'DocxIlegivel'
  }
}

/** Lê um inteiro pequeno, byte a byte, do fim para o princípio. */
const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u32 = (b: Uint8Array, i: number) =>
  (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000

/**
 * Encontra uma entrada do ZIP pelo nome e devolve os bytes comprimidos.
 *
 * Percorre a lista central (no fim do ficheiro), que é a única fonte fiável
 * dos tamanhos — os cabeçalhos locais podem tê-los a zero quando o ficheiro
 * foi escrito em streaming, e foi isso que me fez ler zero bytes na primeira
 * tentativa.
 */
function entradaDoZip(bytes: Uint8Array, nome: string): { dados: Uint8Array; metodo: number } {
  // A "End of central directory" tem uma assinatura fixa e está nos últimos
  // 64 KiB. Procura-se de trás para a frente.
  const fim = Math.max(0, bytes.length - 65557)
  let eocd = -1
  for (let i = bytes.length - 22; i >= fim; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i; break
    }
  }
  if (eocd < 0) throw new DocxIlegivel('Não parece ser um ficheiro .docx.')

  const total = u16(bytes, eocd + 10)
  let p = u32(bytes, eocd + 16)

  for (let n = 0; n < total; n++) {
    if (bytes[p] !== 0x50 || bytes[p + 1] !== 0x4b || bytes[p + 2] !== 0x01 || bytes[p + 3] !== 0x02) {
      throw new DocxIlegivel('O ficheiro está danificado.')
    }
    const metodo = u16(bytes, p + 10)
    const comprimido = u32(bytes, p + 20)
    const nomeLen = u16(bytes, p + 28)
    const extraLen = u16(bytes, p + 30)
    const comentLen = u16(bytes, p + 32)
    const offset = u32(bytes, p + 42)
    const esteNome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nomeLen))

    if (esteNome === nome) {
      // O cabeçalho local tem tamanho variável por causa do nome e dos extras.
      const nomeLocal = u16(bytes, offset + 26)
      const extraLocal = u16(bytes, offset + 28)
      const inicio = offset + 30 + nomeLocal + extraLocal
      return { dados: bytes.subarray(inicio, inicio + comprimido), metodo }
    }
    p += 46 + nomeLen + extraLen + comentLen
  }
  throw new DocxIlegivel('Não encontrei o texto dentro do ficheiro.')
}

async function descomprimir(dados: Uint8Array, metodo: number): Promise<string> {
  // 0 = guardado sem comprimir; 8 = deflate. Os .docx usam quase sempre o 8.
  if (metodo === 0) return new TextDecoder().decode(dados)
  if (metodo !== 8) throw new DocxIlegivel('O ficheiro usa uma compressão que não sei ler.')
  if (typeof DecompressionStream === 'undefined') {
    throw new DocxIlegivel('Este navegador não consegue abrir .docx. Cole o texto.')
  }
  const fluxo = new Blob([dados as unknown as BlobPart]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(fluxo).text()
}

/**
 * O XML de um documento Word em texto corrido.
 *
 * `<w:p>` é um parágrafo e `<w:br/>` é uma quebra de linha — os dois viram
 * mudanças de linha. Todo o resto das etiquetas desaparece. Não tenta ser
 * fiel ao Word: tenta dar o texto que a pessoa escreveu, que é o que um
 * modelo precisa.
 */
export function textoDoXml(xml: string): string {
  return xml
    // Uma quebra de parágrafo tem de sobreviver ao despir das etiquetas.
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\s*\/?>/g, '\n')
    .replace(/<w:tab\s*\/?>/g, '\t')
    // Só agora se tiram as etiquetas, senão as palavras de parágrafos
    // diferentes ficavam colados umas às outras.
    .replace(/<[^>]+>/g, '')
    // As cinco entidades do XML. O `&amp;` fica para o fim, senão
    // `&amp;lt;` virava `<`.
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    // O Word enche o XML de espaços; três linhas vazias seguidas não
    // querem dizer nada.
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** O texto de um .docx que alguém enviou. Rebenta com uma frase útil. */
export async function lerDocx(ficheiro: File | Blob): Promise<string> {
  const bytes = new Uint8Array(await ficheiro.arrayBuffer())
  if (bytes.length < 22) throw new DocxIlegivel('O ficheiro está vazio.')
  // Um .docx começa sempre por «PK». Um .doc antigo não, e dizê-lo à pessoa
  // poupa-lhe a dúvida de perceber porque é que não funcionou.
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new DocxIlegivel('Isto parece um .doc antigo. Guarde-o como .docx ou .txt.')
  }
  const { dados, metodo } = entradaDoZip(bytes, 'word/document.xml')
  const texto = textoDoXml(await descomprimir(dados, metodo))
  if (!texto) throw new DocxIlegivel('O documento não tem texto que eu consiga ler.')
  return texto
}

/** O que se aceita: .docx pelo leitor de cima, .txt e .md tal e qual. */
export async function lerModelo(ficheiro: File): Promise<string> {
  const nome = ficheiro.name.toLowerCase()
  if (nome.endsWith('.docx')) return lerDocx(ficheiro)
  if (nome.endsWith('.txt') || nome.endsWith('.md')) return (await ficheiro.text()).trim()
  if (nome.endsWith('.doc')) {
    throw new DocxIlegivel('O formato .doc antigo não dá. Guarde como .docx ou .txt.')
  }
  if (nome.endsWith('.pdf')) {
    throw new DocxIlegivel('De um PDF não se consegue tirar o texto de forma fiável. Cole-o à mão.')
  }
  throw new DocxIlegivel('Aceito .docx, .txt e .md.')
}
