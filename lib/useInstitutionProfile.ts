'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { getActiveOrgId } from '@/lib/orgContext'

// Perfil "da instituição" para branding do layout clínico.
// Prioridade: organização ativa (multi-org) → institution_settings (legado).
// O hook combina os dois para que o branding continue a funcionar mesmo em
// utilizadores antigos que tinham só institution_settings preenchido.

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

    let cancelled = false
    ;(async () => {
      // 1) Tenta a organização ativa (nova arquitectura multi-org)
      const orgId = getActiveOrgId()
      let merged: InstitutionProfile = {}

      if (orgId) {
        try {
          const { data } = await supabase
            .from('organizations')
            .select('name, short_name, kind, logo_url, accent_color, address, phone, email, director, total_beds, vat_number')
            .eq('id', orgId)
            .maybeSingle()
          if (data) {
            merged = {
              name: data.name,
              short_name: data.short_name,
              type: data.kind,
              logo_url: data.logo_url,
              accent_color: data.accent_color,
              address: data.address,
              phone: data.phone,
              email: data.email,
              director: data.director,
              nif: data.vat_number,
              total_beds: data.total_beds,
            }
          }
        } catch { /* coluna em falta noutro esquema — tenta selecção mínima */
          try {
            const { data } = await supabase
              .from('organizations')
              .select('name, kind')
              .eq('id', orgId)
              .maybeSingle()
            if (data) merged = { name: data.name, type: data.kind }
          } catch { /* ignore */ }
        }
      }

      // 2) Fallback / complemento: institution_settings (legado, por user)
      try {
        const { data } = await supabase.from('institution_settings').select('*').eq('user_id', user.id).maybeSingle()
        if (data) {
          merged = { ...data, ...Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null && v !== undefined && v !== '')) }
        }
      } catch { /* tabela ainda não criada — ignora */ }

      if (cancelled) return
      if (Object.keys(merged).length > 0) {
        setProfile(merged)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(merged)) } catch { /* ignore */ }
      }
    })()

    // Reage a mudança de org activa
    const onOrgChange = () => { /* re-corre o effect via state */ setProfile(p => ({ ...(p || {}) })) }
    window.addEventListener('phlox-org-changed', onOrgChange)
    return () => { cancelled = true; window.removeEventListener('phlox-org-changed', onOrgChange) }
  }, [user, supabase])

  return profile
}
