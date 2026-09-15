// lib/camadas.ts
// ─────────────────────────────────────────────────────────────────────────────
// As camadas do ecrã, num sítio só.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// A barra de navegação inferior (mobile) está a `z-index: 120`. Seis modais
// espalhados pela aplicação estavam a 60 ou 70 — por baixo dela. No
// computador ninguém reparava, porque a barra não aparece; no telemóvel a
// barra ficava POR CIMA do modal e comia-lhe o fundo. No /vault isso tapava
// exatamente o botão "Guardar": a pessoa preenchia tudo e não tinha como
// gravar.
//
// Um número solto escrito à mão em cada ficheiro não tem como estar certo —
// quem escreve o modal não sabe de cor o z-index da barra. Aqui estão todos,
// em ordem, e a ordem lê-se.
// ─────────────────────────────────────────────────────────────────────────────

export const CAMADA = {
  /** conteúdo normal da página */
  base: 0,
  /** cabeçalhos e barras que acompanham o scroll */
  barraSuperior: 100,
  /** a barra de navegação inferior no telemóvel (components/BottomNav.tsx) */
  barraInferior: 120,
  /** o fundo escurecido de um modal — TEM de tapar as barras */
  fundoModal: 200,
  /** o corpo do modal, logo acima do seu fundo */
  modal: 201,
  /** menus que saem de um botão dentro de um modal */
  menuSobreModal: 250,
  /** avisos que aparecem por cima de tudo e desaparecem sozinhos */
  toast: 400,
} as const

/** Um modal a sério: tapa tudo, incluindo a barra inferior.
 *  Usar em vez de escrever `zIndex` à mão. */
export const estiloFundoModal = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(11,17,32,0.55)',
  zIndex: CAMADA.fundoModal,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
}
