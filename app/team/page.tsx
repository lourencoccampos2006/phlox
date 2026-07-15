'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TeamRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/equipa?tab=escalas') }, [router])
  return null
}
