// lib/clinicalIcons.ts
// Fonte ÚNICA do ícone (do conjunto próprio components/Icon.tsx) de cada
// ferramenta institucional, por rota. Assim a sidebar, o cockpit e o blueprint
// mostram todos o MESMO ícone de linha — nunca emoji, que variam por
// dispositivo e dão ar amador. (R0.2, 2026-07-23.)

// Mapa por prefixo de rota → nome do ícone.
const BY_HREF: Record<string, string> = {
  '/painel': 'grid',
  '/patients': 'users',
  '/residentes': 'users',
  '/mar': 'pill',
  '/care-log': 'note',
  '/activities': 'target',
  '/family': 'family',
  '/incidents': 'alert',
  '/assessments': 'clipboard',
  '/equipa': 'calendar',
  '/painel-dono': 'building',
  '/radar': 'clipboard',
  '/guardiao': 'shield',
  '/carga': 'scale',
  '/autonomia': 'route',
  '/documentos': 'note',
  '/interactions': 'search',
  '/calculos': 'calculator',
  '/reconciliacao': 'refresh',
  '/stock': 'package',
  '/agenda': 'calendar',
  '/rastreios': 'flask',
  '/feridas': 'bandage',
  '/faturacao': 'euro',
  '/vigia': 'shield',
  '/ronda-guiada': 'route',
  '/nutricao': 'flask',
  '/hidratacao': 'flask',
  '/tarefas-equipa': 'check',
  '/vitals': 'heart',
  '/scan': 'camera',
  '/ai': 'spark',
  '/tendencias': 'chart',
  '/refeicoes': 'meal',
  '/apoio-servicos': 'shirt',
  '/preparacao-medicacao': 'layers',
  '/apoio-psicossocial': 'compass',
}

// Casos especiais por query string (ex.: /equipa?tab=mural = mural da equipa).
function specialCase(href: string): string | null {
  if (href.includes('/equipa') && href.includes('mural')) return 'megaphone'
  if (href.includes('/equipa') && href.includes('cobertura')) return 'refresh'
  if (href.includes('/painel-dono') && href.includes('qualidade')) return 'chart'
  return null
}

/** Ícone (nome, para <Icon name=...>) da ferramenta institucional nesta rota. */
export function iconForHref(href: string): string {
  const special = specialCase(href)
  if (special) return special
  const path = href.split('?')[0].split('#')[0]
  if (BY_HREF[path]) return BY_HREF[path]
  // prefixo (ex.: /patients/123 → users)
  const hit = Object.keys(BY_HREF).find(k => path === k || path.startsWith(k + '/'))
  return hit ? BY_HREF[hit] : 'grid'
}
