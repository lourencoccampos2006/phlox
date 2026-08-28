import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL_UPDATED } from '@/lib/legal'

// ── ESTA PÁGINA MUDOU DE FUNDO (2026-08-28) ───────────────────────────────
// Era um gestor de consentimento com botões de "aceitar publicidade" e uma
// tabela de categorias de cookies. Deixou de fazer sentido: a publicidade saiu
// do produto e com ela o único terceiro que punha cookies.
//
// O que aqui está agora foi MEDIDO, não presumido. Com um browser limpo, a
// visitar /, /blog, /pricing e /centro-de-dia:
//     cookies: nenhum · localStorage: vazio · terceiros contactados: nenhum
// Depois de iniciar sessão:
//     cookies: nenhum · localStorage: phlox-auth, phlox-local-owner
//
// Ambas as entradas são estritamente necessárias para o serviço que o
// utilizador pediu (manter a sessão aberta), e por isso estão isentas de
// consentimento na ePrivacy. Não havendo nada a consentir, o banner foi
// removido — pedir consentimento para coisa nenhuma é ruído, e este site já
// teve um banner de cookies a engolir cliques em toda a página.
//
// Se algum dia voltar a entrar analítica de terceiros, publicidade ou
// incorporações externas, isto tem de ser revisto e o banner reposto. O
// mecanismo está no histórico do git (lib/consent.ts, components/CookieBanner.tsx).

export const metadata: Metadata = {
  title: 'Cookies — Phlox',
  description: 'O Phlox não usa cookies. O que fica guardado no seu dispositivo, e porquê.',
  alternates: { canonical: 'https://phloxclinical.com/cookies' },
}

const GUARDADO = [
  {
    chave: 'phlox-auth',
    quando: 'Depois de iniciar sessão',
    porque: 'Guarda a sua sessão para não ter de escrever a palavra-passe a cada página. Apaga-se ao terminar sessão.',
  },
  {
    chave: 'phlox-local-owner',
    quando: 'Depois de iniciar sessão',
    porque: 'Identifica de quem são os dados guardados neste dispositivo, para que a conta seguinte a usar o mesmo browser não veja os da anterior.',
  },
]

export default function CookiesPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>
          Política de Cookies
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Cookies
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 26 }}>
          Última atualização: {LEGAL_UPDATED}
        </p>

        <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginBottom: 28 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>
            O Phlox não usa cookies.
          </div>
          <p style={{ fontSize: 14.5, color: 'var(--ink-3)', lineHeight: 1.75, margin: 0 }}>
            Nem para publicidade, nem para análise, nem para seguir ninguém entre
            sites. Não há publicidade no Phlox, em plano nenhum, e nenhuma página
            contacta serviços de terceiros. Por isso também não lhe pedimos
            consentimento para nada.
          </p>
        </div>

        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.015em' }}>
          O que fica guardado no seu dispositivo
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 18 }}>
          Enquanto navega sem sessão iniciada, nada. Depois de entrar na sua
          conta, o browser guarda dois valores — necessários para o serviço
          funcionar, e por isso isentos de consentimento:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 30 }}>
          {GUARDADO.map((g) => (
            <div key={g.chave} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '15px 17px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                {g.chave}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.65 }}>{g.porque}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 7, fontFamily: 'var(--font-mono)' }}>{g.quando}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.015em' }}>
          Como apagar
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 30 }}>
          Terminar sessão apaga os dois. Limpar os dados do site nas definições do
          browser tem o mesmo efeito. Nenhum deles sobrevive a isso, porque não há
          cookie nenhum a repô-los.
        </p>

        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.7 }}>
          Para saber que fornecedores tratam dados em nosso nome, veja os{' '}
          <Link href="/subprocessadores" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>subprocessadores</Link>{' '}
          e a <Link href="/privacy" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>política de privacidade</Link>.
        </p>
      </div>
    </div>
  )
}
