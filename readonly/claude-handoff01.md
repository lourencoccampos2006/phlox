# Phlox Clinical — Contexto Completo para Novo Chat

## O que é o Phlox Clinical

Plataforma farmacológica e clínica portuguesa. Quatro modos de experiência:
- **Clínico** — ferramentas profissionais para farmacêuticos, médicos, enfermeiros
- **Student** — competição, simulação OSCE, inteligência colectiva
- **Cuidador** — gestão de medicação familiar
- **Pessoal** — saúde própria

**Stack:** Next.js 16.2.3 (Turbopack) + Supabase + Stripe + Groq API + Gemini API
**Deploy:** Vercel (antigo Cloudflare Workers — não voltar para lá, bundle > 3 MB)
**URL:** https://phlox-pi.vercel.app
**Supabase Auth:** URL configurado para o Vercel. Login com Google funciona.

---

## Regras de código que NUNCA podes quebrar

### 1. A biblioteca AI (`lib/ai.ts`)
Só existem 4 funções exportadas:
```typescript
aiComplete(messages, options)      // retorna AIResponse { text: string, provider: string, model: string }
aiJSON<T>(messages, options)       // retorna T directamente (já parsed)
callGeminiVision(...)              // para imagens
callGeminiVisionJSON<T>(...)       // para imagens com JSON
```

**CRÍTICO:** `aiComplete` retorna `.text` — NUNCA `.content`. `.content` é de `AIMessage` (input), não de `AIResponse` (output). Este erro apareceu dezenas de vezes. Sempre `result.text`.

### 2. Não usar SDKs de AI
`lib/ai.ts` usa `fetch` directamente para Groq e Gemini. Não importar `groq-sdk`, `@anthropic-ai/sdk`, `@google/generative-ai` — já foram removidos do package.json por causarem problemas de bundle size.

### 3. TypeScript strict
- `.catch(() => {})` sem parâmetro dá erro → usar `.catch((_e: any) => {})`
- Await dentro de `.then()` não funciona → usar `async/await` com `Promise.all`
- `gap: 8'` com apóstrofe rogue → verificar sempre inline styles

### 4. Planos e gates
```typescript
type Plan = 'free' | 'student' | 'pro' | 'clinic'
// Em API routes:
const { plan } = await getUserPlan(req)
if (plan === 'free') return planGateResponse('student', 'Nome da Feature')
if (plan === 'free' || plan === 'student') return planGateResponse('pro', 'Nome da Feature')
```

### 5. Preços Stripe (variáveis de ambiente no Vercel)
```
NEXT_PUBLIC_STRIPE_STUDENT_MONTHLY = price_1TOL3xBq0eVzwb9ftyDEzSjz  (3,99€/mês)
NEXT_PUBLIC_STRIPE_STUDENT_ANNUAL  = price_1TOL5OBq0eVzwb9fkDCd4FDh  (2,99€/mês)
NEXT_PUBLIC_STRIPE_PRO_MONTHLY     = price_1TOL6FBq0eVzwb9fluopYZ4A  (14,99€/mês)
NEXT_PUBLIC_STRIPE_PRO_ANNUAL      = price_1TOL7ABq0eVzwb9fSdomK2I9  (11,99€/mês)
Institucional: 89€/mês (contacto directo, sem Stripe automático)
```

---

## Base de dados — Supabase

### Migrations executadas (por ordem)
- `002-experience-mode.sql` — profiles com experience_mode, onboarded
- `003-mar-records.sql` — MAR (medication administration records)
- `004-student-tracking.sql` — study_sessions, quiz_results, phlox_alerts, consult_records, adherence_records
- `005-teams-arena.sql` — patient_channels, channel_messages, handovers, arena_challenges, arena_attempts, clinical_consults, grand_round_*
- `006-health-records.sql` — lab_records, vaccine_records, vital_records, health_documents, connect_messages, connect_handle em profiles
- `007-fixes.sql` — **CRÍTICO: corre sempre que há problemas** — remove FK de arena_attempts.challenge_id, adiciona metadata a channel_messages, expande CHECK de types, cria todas as tabelas de saúde se não existirem, recria a view arena_leaderboard

### Tabelas principais
```
profiles          — id, user_id, plan, experience_mode, onboarded, display_name, 
                    connect_handle (UNIQUE), connect_visible, professional_role, 
                    institution, speciality, arena_public
personal_meds     — medicação do utilizador pessoal
family_profiles   — perfis de família
family_profile_meds
patients          — doentes clínicos (para modo Pro)
patient_meds
patient_channels  — canais Ward por doente
channel_messages  — mensagens Ward (tipos: note,alert,handover,decision,question,answer,vital,task; metadata jsonb)
arena_challenges  — casos gerados por AI
arena_attempts    — tentativas (sem FK em challenge_id desde 007)
arena_leaderboard — VIEW agregada de XP
clinical_consults — Connect inter-profissional
connect_messages  — threads de consultas Connect
grand_round_cases, grand_round_comments, grand_round_votes, grand_round_diagnoses
lab_records, vaccine_records, vital_records, health_documents
study_sessions, quiz_results, adherence_records, consult_records
```

### RLS importante
- `arena_attempts`: política "all see arena attempts" (SELECT public) + "user owns attempts" (ALL por user_id) — ambas necessárias para leaderboard funcionar
- `channel_messages`: política baseada em org_id — utilizadores sem org vêem apenas os seus canais
- `profiles`: "visible profiles readable" para Connect directory (connect_visible = true OR id = auth.uid())

---

## Arquitectura de componentes

### `lib/experienceMode.ts`
Define os menus de cada modo. Estrutura:
```typescript
ROUTE_GROUPS: Record<ExperienceMode, RouteGroup[]>
// Cada modo tem 2 colunas, máx 8 ferramentas por coluna
// Nunca duplicar ferramentas entre colunas
```

### `components/Header.tsx`
- Desktop: logo + nav links + menu dropdown com ROUTE_GROUPS
- Mobile: hamburger → MobileDrawer com tools + 4 links fixos (Registo, Importar, Definições, Progresso)
- Autenticado: barra de navegação com Dashboard, Registo de Saúde, Importar, Definições
- Não autenticado: botões Login + CTA Grátis

### Dashboard (`app/dashboard/page.tsx`)
4 componentes separados: `ProDashboard`, `StudentDashboard`, `CaregiverDashboard`, `PersonalDashboard`
O modo é determinado por `user.experience_mode` (guardado no perfil Supabase)

---

## Features implementadas

### Pro / Institucional
| Feature | Rota | Estado |
|---------|------|--------|
| Phlox Ward | /teams | ✅ Real-time Supabase |
| Phlox Connect | /connect | ✅ Directory + threads real-time |
| Phlox Rounds | /rounds | ✅ PCNE + relatório AI |
| Phlox Consulta | /consulta | ✅ Briefing + resumo |
| Phlox Care Plan | /plano | ✅ |
| Grand Round | /grand-round | ✅ Novo |
| Reconciliação | /reconciliacao | ✅ |
| MAR Digital | /mar | ✅ |

### Student
| Feature | Rota | Estado |
|---------|------|--------|
| Phlox Arena | /arena | ✅ Ligas Bronze→Diamante, XP real |
| Phlox OSCE | /osce | ✅ 6 cursos, AI como doente |
| Phlox Hive | /hive | ✅ Inteligência colectiva |
| Turno Virtual | /shift | ✅ 16 especialidades |
| Study / Flashcards | /study | ✅ SRS real |
| AI Tutor | /tutor | ✅ Socrático 4 fases |
| Grand Round | /grand-round | ✅ Partilhado com Pro |
| Progresso | /progresso | ✅ XP Arena + estudo |

### Todos os modos
| Feature | Rota | Estado |
|---------|------|--------|
| Registo de Saúde | /registo | ✅ Análises+vacinas+vitais+docs |
| Importar | /importar | ✅ MySNS PDF + texto |
| Timeline | /timeline | ✅ Self+família+doentes |
| Monitor Adesão | /adherencia | ✅ |
| Definições | /settings | ✅ Perfil+Connect+Conta |

### Ferramentas gratuitas (sem login)
- /interactions — verificar interações
- /bula — tradutor de bula
- /dose-crianca — calculadora pediátrica

---

## Erros comuns e soluções

### "result.content is not a function / undefined"
→ `aiComplete` retorna `.text` não `.content`. Substituir `result.content` por `result.text`

### Arena XP não actualiza / Ward não envia mensagens
→ Correr `007-fixes.sql` no Supabase. Remove FK de arena_attempts, adiciona metadata a channel_messages, expande CHECK de types

### Cloudflare 1102 (CPU exceeded)
→ Não usar Cloudflare Workers Free. Deploy no Vercel.

### Cloudflare "exceeded size limit of 3 MiB"
→ O bundle tem ~11 MB. Não é possível no Cloudflare Free. Usar Vercel.

### await inside .then()
→ Erro silencioso. Substituir por async/await com Promise.all

### connect_visible / connect_handle não funciona
→ Correr `006-health-records.sql` e `007-fixes.sql`. Verificar que o utilizador tem connect_handle definido E connect_visible = true

### PDF import falha
→ `file.text()` não funciona em PDFs binários. Ler como ArrayBuffer → base64 → enviar com flag `pdf_base64`

### Login redirige para workers.dev
→ Supabase > Authentication > URL Configuration > Site URL → URL do Vercel

---

## Monetização

### Planos actuais
- **Grátis** — 3 ferramentas sem conta, limites diários
- **Student** — 3,99€/mês — Arena, OSCE, Hive, Study, Tutor, todos os modos
- **Pro** — 14,99€/mês — Student + Ward, Connect, Rounds, Care Plan, Consulta, doentes ilimitados
- **Institucional** — 89€/mês — Pro para toda a equipa, utilizadores ilimitados, contacto directo

### Próximos 30 dias (roadmap fase 1)
1. Activar Stripe com Price IDs reais (já estão nas env vars do Vercel)
2. Testar fluxo completo de pagamento
3. 5 beta users Pro (farmacêuticos conhecidos)
4. 1 artigo SEO/semana (já existe /blog/dose-paracetamol-crianca e /blog/ibuprofeno-varfarina)
5. 1 farmácia piloto com Ward + Connect
6. LinkedIn: posts sobre Ward e Connect (substituem o WhatsApp clínico)

### Revenue targets
- Agosto 2026: ~1.400€/mês MRR
- Dezembro 2026: ~5.900€/mês MRR
- Dezembro 2027: ~29.000€/mês MRR

---

## Melhorias guardadas para fase seguinte (não implementar agora)

1. **Integração SNS** — requer acordo SPMS (6-18 meses). Por agora: importação PDF do MySNS (já implementado em /importar)
2. **Phlox Examinador** — formato exacto dos exames nacionais portugueses (Internato, MEDS)
3. **Phlox Mentor** — acompanhamento personalizado de semanas de estudo
4. **Protocol Builder institucional** — farmacêutico cria protocolos internos da instituição
5. **Sifarma/SClínico integration** — API de integração, requer acordo empresarial
6. **App nativa iOS/Android** — fase 2, Expo/React Native
7. **Expansão Espanha/Brasil** — fase 3
8. **SMS adherência** — Twilio, ~fase 2

---

## Design system

Ficheiro: `app/globals.css`

**Fontes:**
- Headings: `var(--font-serif)` (Lora)
- Body: `var(--font-sans)` (Syne)
- Mono/labels: `var(--font-mono)` (JetBrains Mono)

**Regras de design:**
- Zero emojis como ícones de produto — usar SVG inline
- Eyebrow: `font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.18em` com linha antes via `::before`
- Cards: `background: white; border: 1px solid var(--border); border-radius: var(--r-md)` — sem sombra por defeito, só no hover
- Accent bars em vez de emojis (3px top border colorida)
- Fundo escuro `#0f172a` para secções Student e CTAs finais

**Classes CSS disponíveis:**
`.badge`, `.badge-green`, `.badge-blue`, `.badge-purple`, `.badge-amber`, `.badge-red`, `.badge-mono`
`.eyebrow`, `.rule`, `.card`, `.card-dark`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-green`, `.btn-sm`, `.btn-lg`
`.feature-pill`, `.source-pill`, `.alert-strip`, `.alert-strip-red`, `.alert-strip-amber`, `.alert-strip-green`, `.alert-strip-blue`
`.timeline-item`, `.timeline-dot`, `.timeline-line`, `.timeline-content`
`.data-table`, `.live-dot`

---

## Contexto do fundador

- Lourenço Campos, estudante de farmácia em Portugal
- Quer perfeição — não aceitar mediocridade
- Prefere honestidade directa sobre concordância passiva
- Foco em utilidade real no trabalho (profissionais) e competição séria (estudantes)
- Não quer "site de IA genérico" — quer identidade editorial forte
- Próxima grande meta: 1 farmácia piloto a usar o Ward diariamente

---

## Convenção de ficheiros neste chat

Quando partilhares ficheiros do repo, o assistente deve:
1. Ler o ficheiro real antes de editar
2. Usar `sed -n 'X,Yp'` para ler secções específicas
3. Verificar bugs antes de afirmar que algo está correcto
4. Nunca assumir que um fix funcionou sem verificar o ficheiro após editar