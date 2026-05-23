'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function RondaRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/turno') }, [r])
  return null
}
