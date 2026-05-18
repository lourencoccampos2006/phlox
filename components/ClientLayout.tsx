'use client'

import { useAuth } from '@/components/AuthContext'
import Sidebar from '@/components/Sidebar'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  return (
    <>
      <Sidebar />
      <div className="phlox-main" style={user ? { paddingLeft: 'var(--phlox-sb, 220px)' } : undefined}>
        {children}
      </div>
    </>
  )
}
