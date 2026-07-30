import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const QA_EMAIL = 'qa1781881827891@phloxqa.pt';
const QA_PASSWORD = 'QaPhlox2026!';
const SUPA_URL = 'https://elahnkznndfwrkruitpw.supabase.co';
const SUPA_ANON = 'sb_publishable_7Ddrk8uTykun41jknXi_IA_UF0XiYbF';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', QA_EMAIL);
    await page.fill('input[type="password"]', QA_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/inicio|\/painel/, { timeout: 20000 }).catch(() => {});
    console.log('URL after login:', page.url());

    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem('phlox-auth');
      if (!raw) return null;
      const j = JSON.parse(raw);
      return { token: j?.access_token, uid: j?.user?.id };
    });
    console.log('auth:', auth ? { uid: auth.uid, tokenLen: auth.token?.length } : null);

    // Check current profile experience_mode
    const profile = await page.evaluate(async ({ url, anon, token, uid }) => {
      const res = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}&select=experience_mode,org_id,org_role,plan`, {
        headers: { apikey: anon, Authorization: `Bearer ${token}` },
      });
      return { status: res.status, body: await res.text() };
    }, { url: SUPA_URL, anon: SUPA_ANON, token: auth.token, uid: auth.uid });
    console.log('profile GET:', profile);

    // Check org_members for this uid (read-only, RLS-scoped to self presumably)
    const orgMember = await page.evaluate(async ({ url, anon, token, uid }) => {
      const res = await fetch(`${url}/rest/v1/org_members?user_id=eq.${uid}&select=*`, {
        headers: { apikey: anon, Authorization: `Bearer ${token}` },
      });
      return { status: res.status, body: await res.text() };
    }, { url: SUPA_URL, anon: SUPA_ANON, token: auth.token, uid: auth.uid });
    console.log('org_members GET:', orgMember);

  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await browser.close();
  }
})();
