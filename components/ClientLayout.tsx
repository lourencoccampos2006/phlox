'use client'

import BottomTabBar from '@/components/BottomTabBar'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="phlox-main">
        {children}
      </div>
      <BottomTabBar />
    </>
  )
}
