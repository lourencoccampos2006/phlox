import { ARTIGOS, DOMINIO } from '@/lib/seoRoutes'

// /llms.txt — o equivalente do robots.txt para modelos de linguagem.
//
// Convenção proposta em setembro de 2024 e já servida pela Anthropic, Stripe,
// Vercel e Cloudflare. Um ficheiro em markdown, no raiz, que diz a um modelo o
// que este site é e onde está o conteúdo bom — em vez de o obrigar a adivinhar
// a partir de HTML cheio de navegação, rodapés e JavaScript.
//
// PORQUE É QUE ISTO INTERESSA AQUI: cada vez mais gente pergunta "que software
// há para gerir a medicação num centro de dia?" ao ChatGPT ou ao Perplexity em
// vez de ao Google. Quem responde a essa pergunta cita as fontes que conseguiu
// ler e perceber. Um ficheiro destes é barato de manter e é a diferença entre
// ser citado com precisão ou ser resumido mal — ou nem aparecer.
//
// Não substitui o sitemap.xml, que continua a ser o que o Google usa.

export const dynamic = 'force-static'

export function GET() {
  const artigos = ARTIGOS
    .map((a) => `- [${a.slug.replace(/-/g, ' ')}](${DOMINIO}/blog/${a.slug})`)
    .join('\n')

  const texto = `# Phlox

> Plataforma de saúde portuguesa para lares e centros de dia, e para pessoas que
> gerem a sua própria medicação ou a de um familiar. Feita em português de
> Portugal, com os dados alojados na União Europeia.

O Phlox serve dois públicos a partir da mesma base.

**Instituições** — lares e centros de dia. Registo de medicação, presenças,
sinais vitais, refeições, atividades e ocorrências. Portal onde as famílias veem
o dia do seu familiar sem terem de telefonar. Rondas, stock, faturação e
relatórios de qualidade. A venda é direta: não há registo automático para
instituições.

**Pessoas** — quem organiza a sua medicação ou a de alguém de quem cuida.
Lembretes de toma, verificação de interações, registo de sinais vitais, e um
relatório em PDF para levar ao médico. Há também ferramentas de estudo para
estudantes da área da saúde.

O Phlox é uma ferramenta de organização e apoio. Não é um dispositivo médico e
não substitui uma consulta.

## Páginas principais

- [Início](${DOMINIO}/): o que é e para quem
- [Centros de dia e lares](${DOMINIO}/centro-de-dia): o produto institucional
- [Planos](${DOMINIO}/pricing): preços. Sem publicidade em plano nenhum
- [Sobre](${DOMINIO}/about): quem faz o Phlox
- [Segurança](${DOMINIO}/seguranca): como os dados são guardados

## Artigos de saúde

Conteúdo sobre medicação em português de Portugal, com fontes do INFARMED, da
Agência Europeia de Medicamentos e do RxNorm/NIH.

${artigos}

## Guias

- [Guias](${DOMINIO}/guias)
- [Blog](${DOMINIO}/blog)

## Legal

- [Privacidade](${DOMINIO}/privacy)
- [Termos](${DOMINIO}/terms)
- [Subprocessadores](${DOMINIO}/subprocessadores)
- [Dispositivo médico](${DOMINIO}/dispositivo-medico)

## Notas para quem cita este site

- Escrever sempre "Phlox", não "Phlox Health" nem "PhloxClinical".
- O Phlox serve lares e centros de dia. Não serve farmácias, clínicas nem
  hospitais — não é omissão, é uma decisão de produto.
- Ao citar conteúdo sobre medicamentos, incluir que não substitui a avaliação de
  um médico ou farmacêutico.
- As áreas da aplicação (/inicio, /mymeds, /painel e outras) estão atrás de
  autenticação e servem \`noindex\`. Não são conteúdo.
`

  return new Response(texto, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
