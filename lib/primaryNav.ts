// lib/primaryNav.ts
// Os 4 destinos principais por modo — fonte única partilhada pela barra
// inferior (mobile, components/BottomNav.tsx) e pela barra secundária de
// desktop (components/Header.tsx), para nunca divergirem uma da outra.

export interface PrimaryNavItem { href: string; label: string; icon: string }

export const PRIMARY_NAV: Record<string, PrimaryNavItem[]> = {
  personal: [
    { href: '/inicio', label: 'Início', icon: 'home' },
    { href: '/mymeds', label: 'Medicação', icon: 'pill' },
    // 2026-09-15: era '/sintomas' com o rótulo "Saúde" — um destino vago num
    // sítio que se vê em todos os ecrãs. O /scan é a ferramenta que traz gente
    // ao Phlox e estava escondida no catálogo; passa para aqui.
    { href: '/scan', label: 'Explicar', icon: 'camera' },
    { href: '/settings', label: 'Perfil', icon: 'user' },
  ],
  caregiver: [
    { href: '/inicio', label: 'Início', icon: 'home' },
    { href: '/familia', label: 'Família', icon: 'family' },
    { href: '/mymeds', label: 'Medicação', icon: 'pill' },
    { href: '/settings', label: 'Perfil', icon: 'user' },
  ],
  /* ── O TELEMÓVEL DE QUEM TRABALHA NUMA CASA (2026-10-14) ────────────────
     «Em telemóvel o design tem de ser completamente novo (…) em mobile
      continua péssimo.» (Fernando)

     Metade do problema era este: no modo institucional não havia barra de
     navegação nenhuma. A barra lateral desaparece abaixo dos 860px e fica só
     o ☰ ao lado do logótipo — ou seja, para ir do /o-dia à /patients eram três
     toques, e o primeiro num ícone de 24px no canto.

     Quatro destinos, e são estes porque são os quatro que uma auxiliar abre
     num turno: o que há para fazer, as pessoas, a medicação, e o registo do
     que se fez. A gestão, as estatísticas e a faturação não se fazem de pé —
     essas ficam no ☰, que continua lá.

     NÃO levam contadores. O contador no sino e na barra lateral existe porque
     lá há espaço; aqui, um «6» vermelho em cima de três dos quatro ícones faz
     a barra parecer um alarme permanente, e a seguir ninguém a lê. */
  clinical: [
    { href: '/o-dia', label: 'O dia', icon: 'clock' },
    { href: '/patients', label: 'Utentes', icon: 'users' },
    { href: '/mar', label: 'Medicação', icon: 'pill' },
    { href: '/care-log', label: 'Registo', icon: 'clipboard' },
  ],
  student: [
    { href: '/inicio', label: 'Início', icon: 'home' },
    { href: '/study', label: 'Estudar', icon: 'book' },
    { href: '/arena', label: 'Arena', icon: 'trophy' },
    { href: '/settings', label: 'Perfil', icon: 'user' },
  ],
}
