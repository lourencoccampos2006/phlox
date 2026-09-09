// Esqueleto do painel enquanto ele carrega.
//
// Sem um loading.tsx, o Next mantém a página ANTERIOR no ecrã até a nova estar
// pronta — sem sinal nenhum de que algo avança. Era isso, mais do que os
// milissegundos, que fazia a aplicação parecer lenta: clicava-se e não
// acontecia nada. Isto usa as molduras dos próprios cartões, para parecer a
// página a chegar e não um spinner a girar.

const cartao = (span: number, altura: number) => (
  <div style={{
    gridColumn: `span ${span}`, background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)', height: altura,
  }} />
)

export default function Loading() {
  return (
    <div style={{ padding: '26px clamp(18px,2.6vw,34px) 80px' }} aria-busy="true" aria-label="A carregar o painel">
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div style={{ width: 190, height: 10, background: 'var(--bg-3)', borderRadius: 3 }} />
          <div style={{ width: 'min(460px,80%)', height: 34, background: 'var(--bg-3)', borderRadius: 5, marginTop: 14 }} />
        </div>
        <div style={{ height: 96, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 16 }}>
          {cartao(12, 150)}{cartao(7, 230)}{cartao(5, 230)}{cartao(4, 200)}{cartao(8, 200)}
        </div>
      </div>
    </div>
  )
}
