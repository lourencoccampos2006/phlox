'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function PainelRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/cockpit') }, [r])
  return null
}
