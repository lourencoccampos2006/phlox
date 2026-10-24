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
  '/o-dia': 'clock',
  // ── As rotas novas (2026-10-07) ────────────────────────────────────────
  // Sem entrada aqui, `iconForHref` devolve 'grid' — e quatro ferramentas
  // diferentes no menu ficavam com o mesmo quadradinho. Um ícone repetido
  // é pior do que nenhum: ensina a não olhar para a coluna da esquerda.
  '/passagem': 'refresh',
  '/casa': 'building',
  '/inqueritos': 'chat',
  '/inscricoes': 'clipboard',
  '/calendario-do-ano': 'calendar',
  '/estatisticas': 'chart',
  '/care-log': 'note',
  '/activities': 'target',
  '/family': 'family',
  '/incidents': 'alert',
  '/assessments': 'clipboard',
  '/equipa': 'calendar',
  '/painel-dono': 'building',
  '/radar': 'search',
  '/guardiao': 'shield',
  '/carga': 'layers',
  '/autonomia': 'route',
  '/historico': 'book',
  '/documentos': 'note',
  '/stock': 'package',
  '/agenda': 'calendar',
  '/feridas': 'bandage',
  '/faturacao': 'euro',
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
