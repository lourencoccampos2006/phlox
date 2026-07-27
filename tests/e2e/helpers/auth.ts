import type { Page } from '@playwright/test'

// Conta de QA dedicada (sem dados reais de utentes) — a mesma usada em todas
// as rondas de QA manuais deste projeto. O anon key é uma chave PÚBLICA por
// desenho do Supabase (é enviada ao browser em todas as páginas) — não é um
// segredo, por isso vive aqui sem risco.
export const QA_EMAIL = 'qa1781881827891@phloxqa.pt'
export const QA_PASSWORD = 'QaPhlox2026!'
const SUPA_URL = 'https://elahnkznndfwrkruitpw.supabase.co'
const SUPA_ANON = 'sb_publishable_7Ddrk8uTykun41jknXi_IA_UF0XiYbF'

export type ExperienceMode = 'personal' | 'caregiver' | 'student' | 'clinical'
export type InstitutionKind = 'day_care' | 'nursing_home' | 'pharmacy_community' | 'clinic' | 'health_center'

async function getAuth(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('phlox-auth')
    if (!raw) return null
    const j = JSON.parse(raw)
    return { token: j?.access_token as string, uid: j?.user?.id as string }
  })
}

/** Inicia sessão com a conta de QA e espera aterrar em /inicio ou /painel. */
export async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', QA_EMAIL)
  await page.fill('input[type="password"]', QA_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/inicio|\/painel/, { timeout: 20_000 }).catch(() => {})
}

/** Muda o modo de experiência da conta de QA via REST direto ao Supabase (mesmo
 * mecanismo usado pelo PersonaSwitcher que existiu no produto). */
export async function setMode(page: Page, mode: ExperienceMode) {
  const auth = await getAuth(page)
  if (!auth) throw new Error('setMode: sem sessão — chama login(page) primeiro')
  await page.evaluate(
    async ({ url, anon, token, uid, mode }) => {
      await fetch(`${url}/rest/v1/profiles?id=eq.${uid}`, {
        method: 'PATCH',
        headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ experience_mode: mode }),
      })
    },
    { url: SUPA_URL, anon: SUPA_ANON, token: auth.token, uid: auth.uid, mode }
  )
}

/** Define o tipo de instituição (só importa em modo clínico). */
export async function setInstitution(page: Page, kind: InstitutionKind) {
  await page.evaluate((k) => localStorage.setItem('phlox-clinic-institution', k), kind)
}

/** Login + modo + instituição num só passo — o caso mais comum nos specs. */
export async function loginAs(page: Page, mode: ExperienceMode, institution?: InstitutionKind) {
  await login(page)
  await setMode(page, mode)
  if (institution) await setInstitution(page, institution)
}

/** Fecha o banner de cookies se aparecer (não falha se não aparecer). */
export async function dismissCookieBanner(page: Page) {
  await page.locator('button', { hasText: /^Aceitar$/ }).first().click({ timeout: 1500 }).catch(() => {})
}
