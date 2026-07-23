'use client'

// Icon — conjunto único de ícones de linha do Phlox. Consistente em todo o lado
// (início, barras, cartões). Sem depender de emoji (que variam por dispositivo).

import type { CSSProperties } from 'react'

const PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" /></>,
  pill: <><rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(45 12 12)" /><path d="M8.5 8.5l7 7" /></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></>,
  heart: <><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></>,
  family: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.2" /><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 15c2.3 0 4 1.6 4 4" /></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9.5 12l1.8 1.8L15 10" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3M9 16h6M10 20h4M12 16v4" /></>,
  cards: <><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v12" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M19 17H6a2 2 0 0 0-2 2" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.2 2.2L16 9.5" /></>,
  chevron: <><path d="M9 18l6-6-6-6" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9.5a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2-2.6 3.5" /><circle cx="12" cy="17.4" r="0.6" fill="currentColor" stroke="none" /></>,
  search: <><circle cx="11" cy="11" r="7.5" /><path d="M21 21l-4.3-4.3" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  flame: <><path d="M12 3c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1.5-1-2-1-3.5 2 1 3 3 3 5.5a5 5 0 0 1-10 0c0-4 3-6 3-8 0-1 0-1.5 2-2z" /></>,
  sliders: <><path d="M5 6h14M5 12h14M5 18h14" /><circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1.8" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="1.8" fill="currentColor" stroke="none" /></>,
  briefcase: <><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 5-5 2 2-5z" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  dots: <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  scale: <><path d="M12 3v18M12 6l-6 0M12 6l6 0M4 6l2.5 6a2.6 2.6 0 0 0 5 0L9 6M15 6l2.5 6a2.6 2.6 0 0 0 5 0L20 6M7 21h10" /></>,
  package: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5L12 12l8-4.5M12 12v9" /></>,
  download: <><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  // ── Conjunto clínico/institucional (R0.2, 2026-07-23) — substituem emoji ──
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6" /><path d="M16.5 5.4a3 3 0 0 1 0 5.7" /><path d="M18 14.5c2 .5 3.5 2.3 3.5 4.5" /></>,
  alert: <><path d="M12 4.5 21 19.5H3z" /><path d="M12 10v4.2" /><circle cx="12" cy="17.2" r="0.7" fill="currentColor" stroke="none" /></>,
  note: <><path d="M14 3.5H5.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V9z" /><path d="M14 3.5V9h5.5" /><path d="M8 13h7M8 16.5h5" /></>,
  edit: <><path d="M4.5 20H8L19 9l-3.5-3.5L4.5 16.5z" /><path d="M14 6.5l3.5 3.5" /></>,
  clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V5" /><path d="M9 11.5h6M9 15h4" /></>,
  building: <><path d="M4 21V6.5L12 3l8 3.5V21" /><path d="M3 21h18" /><path d="M9.5 21v-4.5h5V21" /><circle cx="8.5" cy="9" r="0.6" fill="currentColor" stroke="none" /><circle cx="12" cy="9" r="0.6" fill="currentColor" stroke="none" /><circle cx="15.5" cy="9" r="0.6" fill="currentColor" stroke="none" /><circle cx="8.5" cy="12.5" r="0.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12.5" r="0.6" fill="currentColor" stroke="none" /><circle cx="15.5" cy="12.5" r="0.6" fill="currentColor" stroke="none" /></>,
  chart: <><path d="M4 4v16h16" /><path d="M8 17v-5M12.5 17V8M17 17v-3" /></>,
  calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 6.5h8" /><circle cx="9" cy="12.5" r="0.9" fill="currentColor" stroke="none" /><circle cx="12" cy="12.5" r="0.9" fill="currentColor" stroke="none" /><circle cx="15" cy="12.5" r="0.9" fill="currentColor" stroke="none" /><circle cx="9" cy="16.5" r="0.9" fill="currentColor" stroke="none" /><circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" /><circle cx="15" cy="16.5" r="0.9" fill="currentColor" stroke="none" /></>,
  refresh: <><path d="M20 11.5a8 8 0 1 0-2.1 6.1" /><path d="M20 5.5v6h-6" /></>,
  store: <><path d="M4 9.5 5.5 4.5h13L20 9.5" /><path d="M4 9.5a2.4 2.4 0 0 0 4.7 0 2.4 2.4 0 0 0 4.6 0 2.4 2.4 0 0 0 4.7 0" /><path d="M5 11.3V20h14v-8.7" /><path d="M9.5 20v-4.5h5V20" /></>,
  chat: <><path d="M4 5.5h16v10.5H10l-4 3.3V16H4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  cart: <><circle cx="9.5" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M3 4.5h2.2l2 10.5h10l1.8-7.5H6.7" /></>,
  inbox: <><path d="M4 13l2.4-8.2a1 1 0 0 1 1-.8h9.2a1 1 0 0 1 1 .8L20 13v5.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M4 13h4l1.5 2.5h5L16 13h4" /></>,
  stethoscope: <><path d="M5 3.5v4.5a4 4 0 0 0 8 0V3.5" /><path d="M5 3.5H3.6M13 3.5h1.4" /><path d="M9 16.5v.5a4 4 0 0 0 8 0v-2.2" /><circle cx="18.5" cy="12.5" r="2.3" /></>,
  flask: <><path d="M9.5 3h5M10.5 3v6l-5 8.4A2 2 0 0 0 7.2 20.5h9.6a2 2 0 0 0 1.7-3.1L13.5 9V3" /><path d="M8 15h8" /></>,
  bandage: <><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M9.5 9.5l5 5" /><circle cx="10.5" cy="12" r="0.5" fill="currentColor" stroke="none" /><circle cx="12" cy="10.5" r="0.5" fill="currentColor" stroke="none" /><circle cx="12" cy="13.5" r="0.5" fill="currentColor" stroke="none" /><circle cx="13.5" cy="12" r="0.5" fill="currentColor" stroke="none" /></>,
  euro: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.6a4.3 4.3 0 1 0 0 6.8" /><path d="M6.7 10.8h6M6.7 13.4h5" /></>,
  megaphone: <><path d="M4 10v4a1 1 0 0 0 1 1h2l7 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M17.5 9.2a4 4 0 0 1 0 5.6" /></>,
  route: <><circle cx="6.5" cy="6" r="2.2" /><circle cx="17.5" cy="18" r="2.2" /><path d="M8.7 6h5.3a3 3 0 0 1 0 6H10a3 3 0 0 0 0 6h5.3" /></>,
  bolt: <><path d="M13 3 5 13.5h5L9 21l8-11h-5z" /></>,
}

interface Props { name: string; size?: number; stroke?: number; color?: string; style?: CSSProperties }

export default function Icon({ name, size = 24, stroke = 1.9, color = 'currentColor', style }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      {PATHS[name] || PATHS.grid}
    </svg>
  )
}
