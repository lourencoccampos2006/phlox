// Ver a nota em app/painel/loading.tsx: sem isto, clicar num link não dá sinal
// nenhum de que alguma coisa está a acontecer.
export default function Loading() {
  return (
    <div style={{ padding: '26px clamp(16px,3vw,32px) 60px' }} aria-busy="true" aria-label="A carregar">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ width: 'min(320px,70%)', height: 30, background: 'var(--bg-3)', borderRadius: 5, marginBottom: 22 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ height: 62, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
