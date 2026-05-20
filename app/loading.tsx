export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          {/* Spinner ring */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2.5px solid var(--bg-3)',
            borderTopColor: 'var(--green)',
            animation: 'plx-spin 0.8s linear infinite',
          }} />
          {/* Phlox logo mark inside */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path d="M14 6v16M7 14h14" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--ink-5)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          animation: 'plx-fade 1.2s ease-in-out infinite',
        }}>
          Phlox
        </div>
      </div>
      <style>{`
        @keyframes plx-spin { to { transform: rotate(360deg); } }
        @keyframes plx-fade { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
      `}</style>
    </div>
  )
}
