'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'

// Perfil da instituição (plano clínico) — DB-backed, com cache local para pintura instantânea.
// Personaliza a plataforma: nome, logo, cor de acento, horários, contactos, diretor.

export interface InstitutionProfile {
  name?: string | null
  short_name?: string | null
  type?: string | null
  logo_url?: string | null
  accent_color?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  director?: string | null
  nif?: string | null
  total_beds?: number | null
  shift_manha_start?: string | null; shift_manha_end?: string | null
  shift_tarde_start?: string | null; shift_tarde_end?: string | null
  shift_noite_start?: string | null; shift_noite_end?: string | null
}

const CACHE_KEY = 'phlox-institution-profile'

export function useInstitutionProfile() {
  const { user, supabase } = useAuth() as any
  const [profile, setProfile] = useState<InstitutionProfile | null>(null)

  useEffect(() => {
    if (!user) return
    try { const c = localStorage.getItem(CACHE_KEY); if (c) setProfile(JSON.parse(c)) } catch { /* ignore */ }
    supabase.from('institution_settings').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: InstitutionProfile | null }) => {
        if (data) {
          setProfile(data)
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
        }
      })
      .catch(() => { /* tabela ainda não criada — ignora */ })
  }, [user, supabase])

  return profile
}
