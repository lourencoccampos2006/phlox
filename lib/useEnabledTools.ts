'use client'

import { useState, useEffect, useCallback } from 'react'
import { toolsForMode, defaultToolIds, TOOLS, type ToolMode, type Tool } from '@/lib/toolRegistry'

// Visibilidade adaptativa: por defeito mostramos só os tools "default" do modo;
// o utilizador adiciona/remove extras (guardado por dispositivo). Reset volta ao default.

export function useEnabledTools(mode: ToolMode) {
  const key = `phlox-tools-${mode}`
  const [enabledIds, setEnabledIds] = useState<string[] | null>(null)

  useEffect(() => {
    try { const s = localStorage.getItem(key); setEnabledIds(s ? JSON.parse(s) : null) }
    catch { setEnabledIds(null) }
  }, [key])

  const all = toolsForMode(mode)
  const defaults = defaultToolIds(mode)
  const enabled = enabledIds ?? defaults
  const customised = enabledIds !== null

  const isOn = useCallback((id: string) => enabled.includes(id), [enabled])

  const persist = (next: string[]) => {
    setEnabledIds(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }
  const toggle = useCallback((id: string) => {
    const next = enabled.includes(id) ? enabled.filter(x => x !== id) : [...enabled, id]
    persist(next)
  }, [enabled]) // eslint-disable-line
  const reset = useCallback(() => {
    setEnabledIds(null)
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }, [key])

  const enabledTools: Tool[] = all.filter(t => enabled.includes(t.id))
  return { all, defaults, enabled, enabledTools, isOn, toggle, reset, customised }
}

export { TOOLS }
