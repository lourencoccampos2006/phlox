// lib/primaryNav.ts
// Os 4 destinos principais por modo — fonte única partilhada pela barra
// inferior (mobile, components/BottomNav.tsx) e pela barra secundária de
// desktop (components/Header.tsx), para nunca divergirem uma da outra.

export interface PrimaryNavItem { href: string; label: string; icon: string }

export const PRIMARY_NAV: Record<string, PrimaryNavItem[]> = {
  personal: [
    { href: '/inicio', label: 'Início', icon: 'home' },
    { href: '/mymeds', label: 'Medicação', icon: 'pill' },
    { href: '/sintomas', label: 'Saúde', icon: 'heart' },
    { href: '/settings', label: 'Perfil', icon: 'user' },
  ],
  caregiver: [
    { href: '/inicio', label: 'Início', icon: 'home' },
    { href: '/familia', label: 'Família', icon: 'family' },
    { href: '/mymeds', label: 'Medicação', icon: 'pill' },
    { href: '/settings', label: 'Perfil', icon: 'user' },
  ],
  student: [
    { href: '/inicio', label: 'Início', icon: 'home' },
    { href: '/study', label: 'Estudar', icon: 'book' },
    { href: '/arena', label: 'Arena', icon: 'trophy' },
    { href: '/settings', label: 'Perfil', icon: 'user' },
  ],
}
