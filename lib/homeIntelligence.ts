// lib/homeIntelligence.ts
// Saudação + atalhos por modo, usados pelo sistema de módulos do /inicio
// (lib/inicioModules.ts, components/inicio/*). O antigo "foco único"
// determinístico (pickFocus/HomeData) saiu na reconstrução do /inicio DO
// ZERO em 2026-07-21 — cada módulo mostra o seu próprio estado agora,
// autonomamente, em vez de um objeto central a decidir UMA coisa a mostrar.

import { ptHour } from '@/lib/ptTime'

export interface QuickAction { href: string; icon: string; label: string; sub: string }

function greetWord(): string {
  const h = ptHour()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}

export function homeGreeting(firstName: string): string {
  return `${greetWord()}${firstName ? `, ${firstName}` : ''}`
}

// ─── Ações secundárias — sempre disponíveis, por modo ───────────────────────
export function quickActions(mode: string): QuickAction[] {
  if (mode === 'student') return [
    { href: '/arena', icon: 'trophy', label: 'Treinar casos', sub: 'Arena' },
    { href: '/study', icon: 'cards', label: 'Flashcards', sub: 'Rever' },
    { href: '/tutor', icon: 'spark', label: 'Tutor', sub: 'Tirar dúvidas' },
    { href: '/aprender', icon: 'book', label: 'Tudo para estudar', sub: 'O meu progresso' },
  ]
  if (mode === 'caregiver') return [
    { href: '/familia', icon: 'family', label: 'A minha família', sub: 'Cada pessoa' },
    { href: '/scan', icon: 'camera', label: 'Foto à receita', sub: 'Organizar' },
    { href: '/interactions', icon: 'shield', label: 'É seguro juntar?', sub: 'Verificar' },
    { href: '/ai', icon: 'spark', label: 'Tenho uma dúvida', sub: 'Perguntar' },
  ]
  return [
    { href: '/mymeds', icon: 'pill', label: 'Os meus comprimidos', sub: 'Lista e horários' },
    { href: '/scan', icon: 'camera', label: 'Foto à receita', sub: 'Organizar' },
    { href: '/ai', icon: 'spark', label: 'Tenho uma dúvida', sub: 'Perguntar' },
    { href: '/saude-agora', icon: 'heart', label: 'Não me sinto bem', sub: 'O que fazer' },
  ]
}
