# Testes E2E do Phlox

Suite persistente (Playwright) — substitui os scripts descartáveis que antes viviam
em `scratchpad/` e nunca sobreviviam entre sessões. Existe porque, em 2026-07-27,
um bug de CSS deixou o site inteiro sem scroll real durante meses sem que nenhuma
QA manual apanhasse — cada ronda de testes era escrita de novo, e o método usado
(`scrollTo()` programático) escondia exatamente esse bug.

## Correr os testes

```bash
npm run dev            # num terminal — o servidor tem de estar de pé em localhost:3000
npm run test:e2e       # noutro terminal
npm run test:e2e:ui    # modo interativo (vê cada passo no browser)
```

Para testar o build de produção real (recomendado antes de um push importante):

```bash
npm run build && npm start   # num terminal
npm run test:e2e             # noutro
```

## O que cada ficheiro cobre

- **`scroll.spec.ts`** — scroll REAL (`page.mouse.wheel()`, nunca `scrollTo()`) em
  páginas públicas, pessoais e clínicas. É o guarda de regressão do bug de 2026-07-27.
- **`clinical-flow.spec.ts`** — o guião do demo: cockpit → registar um sinal vital →
  confirmar que persiste após reload → medicação → famílias. Inclui também o teste
  de que `/painel` não vaza para modo pessoal.
- **`mobile-layout.spec.ts`** — sem overflow horizontal e com padding lateral real
  no telemóvel (guarda de regressão do bug de layout desktop-first de 2026-07-27).
- **`security.spec.ts`** — smoke tests leves: rotas de cron rejeitam pedidos sem
  segredo, rotas institucionais exigem autenticação, o portal família nunca deixa
  escapar detalhe técnico.

## Convenções

- Todos os testes correm **em série** (`workers: 1` em `playwright.config.ts`) —
  partilham a mesma conta de QA (`tests/e2e/helpers/auth.ts`), e correr em paralelo
  causa condições de corrida reais ao mudar o `experience_mode` desse perfil.
- `tests/e2e/helpers/auth.ts` tem `login`/`setMode`/`setInstitution`/`loginAs` —
  usa sempre estes em vez de reimplementar o login em cada spec.
- A conta de QA (`qa1781881827891@phloxqa.pt`) não tem dados reais de utentes —
  é segura para os testes escreverem/apagarem à vontade.
- Nunca uses `page.textContent()` para verificar texto renderizado — inclui o
  conteúdo bruto de `<script>` (payload de hidratação do Next.js) e dá falsos
  negativos. Usa `page.locator(...).innerText()`.
