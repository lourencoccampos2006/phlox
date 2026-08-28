import { defineConfig, devices } from '@playwright/test'

// Suite de testes E2E persistente (substitui os scripts descartáveis em
// scratchpad/ que usei durante as rondas de QA). Corre contra um servidor já
// de pé em localhost:3000 — arranca `npm run dev` (ou `npm run build && npm
// start` para testar o build de produção) antes de `npm run test:e2e`.
//
// Porquê isto existe: em 2026-07-27 um bug de CSS (`overflow-x:clip` no
// <html>) impediu o scroll REAL (roda do rato) em todo o site, durante meses,
// sem nenhum teste apanhar — porque toda a QA anterior usava `scrollTo()`
// programático, que contorna o bug. tests/e2e/scroll.spec.ts existe
// especificamente para nunca mais deixar isto passar despercebido.
export default defineConfig({
  testDir: './tests/e2e',
  // Aquece o servidor antes do primeiro teste. Sem isto, o primeiro teste de
  // cada corrida falhava sozinho no CI — a porta responde muito antes de a app
  // estar realmente pronta. Ver tests/e2e/global-setup.ts.
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // Todos os testes partilham a MESMA conta de QA (um só perfil na base de
  // dados) e mudam o experience_mode desse perfil em runtime. Correr mais do
  // que 1 worker deixava dois projetos (desktop/mobile) ou dois ficheiros a
  // mudar o modo ao mesmo tempo — condição de corrida real, não um bug da
  // app. workers:1 força tudo em série; a suite é pequena, o custo é baixo.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PHLOX_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    // iPhone 13 com motor Chromium (não Safari/WebKit) — usa só o viewport +
    // toque + user-agent do dispositivo, mantendo o browser já instalado.
    { name: 'mobile', use: { ...devices['Desktop Chrome'], ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
})
