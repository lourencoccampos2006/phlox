import { MetadataRoute } from 'next'
import { PRIVADAS, DOMINIO } from '@/lib/seoRoutes'

// IMPORTANTE: este é o ÚNICO robots do site. Não criar public/robots.txt — o
// ficheiro estático ganharia a este e os dois entrariam em conflito.
//
// ── PORQUE É QUE ISTO BLOQUEIA TÃO POUCA COISA AGORA ──────────────────────
// A versão anterior bloqueava ~230 rotas de aplicação, para o Google não ver um
// mar de páginas finas. A intenção estava certa, o mecanismo estava errado:
//
//   `Disallow` diz "não rastreies". NÃO diz "tira do índice".
//
// As páginas que já estavam indexadas ficaram lá — e como o Google deixou de as
// poder rastrear, nunca mais lá voltou para descobrir que deviam sair. O site
// ficou com o pior dos dois mundos: as páginas finas continuaram no índice, e as
// páginas boas (as ferramentas) deixaram de poder entrar.
//
// Agora a aplicação é rastreável e serve `X-Robots-Tag: noindex` (ver os
// cabeçalhos em next.config.ts, gerados da mesma lista em lib/seoRoutes.ts).
// O Google volta lá, lê a instrução, e remove-as de vez.
//
// Aqui ficam só as coisas que nunca foram páginas: endpoints, autenticação,
// administração.

// ── OS ROBÔS DE IA ────────────────────────────────────────────────────────
// Cada vez mais gente pergunta "que software há para gerir medicação num centro
// de dia?" ao ChatGPT ou ao Perplexity em vez de ao Google. Ser citado nessas
// respostas traz visitas de quem já tem o problema — é o tráfego mais
// qualificado que há.
//
// Estes são os robôs de PESQUISA: vão buscar a página quando alguém faz uma
// pergunta, e citam a fonte. Ficam explicitamente autorizados no conteúdo.
//
// Os robôs de TREINO (GPTBot, ClaudeBot, CCBot) são outra conversa: alimentam
// modelos, não devolvem visitas, e a decisão de os deixar entrar é do Fernando.
// Não estão listados aqui, o que quer dizer que caem na regra `*` — ou seja,
// entram. Para os barrar, acrescentar uma regra própria com `disallow: '/'`.
const ROBOS_DE_PESQUISA = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-User']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVADAS,
      },
      ...ROBOS_DE_PESQUISA.map((robo) => ({
        userAgent: robo,
        allow: '/',
        disallow: PRIVADAS,
      })),
    ],
    sitemap: `${DOMINIO}/sitemap.xml`,
    host: DOMINIO,
  }
}
