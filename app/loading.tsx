export default function Loading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Phlox logo mark animado */}
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none" style={{ animation: 'phlox-pulse 1.4s ease-in-out infinite' }}>
          <rect width="28" height="28" rx="6" fill="var(--green)" opacity="0.15"/>
          <path d="M14 6v16M7 14h14" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          A carregar
        </div>
      </div>
      <style>{`
        @keyframes phlox-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
