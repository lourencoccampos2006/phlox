'use client'

import { useState, useEffect, useCallback } from 'react'
import { toolsForMode, defaultToolIds, defaultClinicalToolIds, TOOLS, type ToolMode, type InstType, type Tool } from '@/lib/toolRegistry'

// Visibilidade adaptativa: por defeito mostramos só os tools "default" do modo;
// o utilizador adiciona/remove extras (guardado por dispositivo). Reset volta ao default.
//
// 2026-06-01: estendido para o modo `clinical`. Quando mode === 'clinical', a
// chave do localStorage é por instituição (ex: phlox-tools-clinical-hospital).
// Isto permite que um utilizador com 2 instituições (hospital + clínica) tenha
// 2 conjuntos distintos de ferramentas ativas, sem mistura.

export function useEnabledTools(mode: ToolMode, inst?: InstType) {
  const key = mode === 'clinical' && inst
    ? `phlox-tools-clinical-${inst}`
    : `phlox-tools-${mode}`
  const [enabledIds, setEnabledIds] = useState<string[] | null>(null)

  useEffect(() => {
    try { const s = localStorage.getItem(key); setEnabledIds(s ? JSON.parse(s) : null) }
    catch { setEnabledIds(null) }
  }, [key])

  const all = toolsForMode(mode)
  const defaults = mode === 'clinical' && inst
    ? defaultClinicalToolIds(inst)
    : defaultToolIds(mode)
  const enabled = enabledIds ?? defaults
  const customised = enabledIds !== null

  const isOn = useCallback((id: string) => enabled.includes(id), [enabled])

  const persist = (next: string[]) => {
    setEnabledIds(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
    // Avisa outros listeners do mesmo separador (storage event só dispara entre tabs)
    try { window.dispatchEvent(new CustomEvent('phlox-tools-changed', { detail: { key } })) } catch { /* noop */ }
  }
  const toggle = useCallback((id: string) => {
    const next = enabled.includes(id) ? enabled.filter(x => x !== id) : [...enabled, id]
    persist(next)
  }, [enabled]) // eslint-disable-line
  const reset = useCallback(() => {
    setEnabledIds(null)
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent('phlox-tools-changed', { detail: { key } })) } catch { /* noop */ }
  }, [key])

  // Reage a mudanças no mesmo tab (toggle vindo de outro componente)
  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<{ key: string }>
      if (ce.detail?.key === key) {
        try { const s = localStorage.getItem(key); setEnabledIds(s ? JSON.parse(s) : null) } catch { /* noop */ }
      }
    }
    window.addEventListener('phlox-tools-changed', handler as EventListener)
    return () => window.removeEventListener('phlox-tools-changed', handler as EventListener)
  }, [key])

  const enabledTools: Tool[] = all.filter(t => enabled.includes(t.id))
  return { all, defaults, enabled, enabledTools, isOn, toggle, reset, customised }
}

export { TOOLS }
