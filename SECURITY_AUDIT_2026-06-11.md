# Auditoria de Segurança — Phlox (2026-06-11)

Auditoria profunda a nível de aplicação + supply-chain. Foco: proteção de dados
clínicos antes de apresentar a plataforma a um cliente institucional (lar/ERPI).

## Resultado global: **PASS** (após correções)

| Área                         | Antes      | Depois | Crítico | Médio |
|------------------------------|------------|--------|---------|-------|
| Autenticação (JWT)           | **FALHA**  | Pass   | 2 → 0   | 0     |
| IDOR / multi-tenant (FHIR)   | **FALHA**  | Pass   | 7 → 0   | 0     |
| Portal família (fail-open)   | **FALHA**  | Pass   | 1 → 0   | 0     |
| Criptografia (RNG)           | Aviso      | Pass   | 0       | 3 → 0 |
| Supply-chain (npm/CI)        | Pass       | Pass   | 0       | 1     |
| Segredos no repositório      | Pass       | Pass   | 0       | 0     |

---

## CRÍTICO — corrigido

### 1. JWT forjado → acesso a qualquer conta
`lib/planGate.ts` (`getUserPlan`, usado por dezenas de rotas) e `app/api/pulse/route.ts`
descodificavam o JWT (base64) e confiavam no `sub` **sem verificar a assinatura**.
Como várias rotas usam a service-role key (que ignora RLS) com esse `userId`, um
atacante podia forjar um token com o `sub` de outra pessoa e ler/escrever os dados
dela (PII, exportações, KPIs de negócio).
**Fix:** validar o token via `supabase.auth.getUser(token)` antes de confiar no id.

### 2. IDOR cross-tenant em toda a API FHIR
Com uma API key (`pk_live_…`), `lib/fhirAuth.ts` devolvia um cliente service-role e
as 7 rotas FHIR filtravam só por um `patient` vindo do pedido — **sem confirmar
posse**. Qualquer chave lia/escrevia doentes de **qualquer clínica** (demografia,
vitais, análises, prescrições, alergias, vacinas).
**Fix:** novo `resolveOwnedPatient()` em `fhirAuth.ts` que confirma que o doente
pertence ao dono da chave; aplicado a `Patient`, `Patient/[id]`, `Observation`,
`MedicationRequest`, `Immunization`, `AllergyIntolerance`, `Encounter` (leitura e
escrita). Upsert de `Patient` por SNS/NIF agora também é scoped ao dono.

### 3. Portal família abria sem verificação (fail-open)
`app/api/family-portal/route.ts`: se o residente não tivesse contactos telefónicos
registados, o portal abria só com o código (`Math.random`, 6 chars). Expunha fotos,
mensagens e humor do residente a quem obtivesse/adivinhasse o código.
**Fix:** sem contacto verificável, o portal fica **fechado por defeito**
(`noContacts`) e pede à instituição para registar o contacto. Acesso real = código
+ últimos 4 dígitos do telefone (2 fatores).

---

## MÉDIO — corrigido

### Criptografia previsível em ids/códigos de acesso
- `app/family/page.tsx` — código família: `Math.random` → `crypto.getRandomValues` (8 chars).
- `app/api/link/generate/route.ts` — código de partilha de medicação → CSPRNG.
- `app/api/share/route.ts` — id de resultado clínico partilhado → CSPRNG.

Não-sensíveis (uniqueness apenas, deixados como estão): `lib/ics.ts` (UID de
calendário), `lib/saves.ts` (id local), `app/api/referral/route.ts` (código de
referral sem acesso a dados).

---

## A vigiar (não bloqueante)
- `npm audit`: 1 vulnerabilidade moderada (PostCSS XSS) transitiva via Next.js.
  `audit fix --force` faria downgrade do Next para v9 (break grave) → **não aplicar**.
  É ferramenta de build, sem caminho exploitável em runtime. Resolve-se quando o
  Next publicar patch.
- `app/api/share` POST: insert público (rate-limited) — risco de spam/storage, não IDOR.

## Verificado OK (sem ação)
- Sem segredos hardcoded no código; `.env*` no `.gitignore`; sem `.env` no git.
- Lockfile presente; sem deps em `latest`/`*`.
- Webhooks (Stripe HMAC, lab token), health-pass (token+PIN), share viewer
  (código+expiração), cron (CRON_SECRET) — públicos por design, com verificação.
- Rotas service-role com PII (`health-import`, `export-me`, `benchmark`, `reach`,
  `sign`, `stripe/cancel`, `v1/sales`) — filtram por userId **verificado**.
