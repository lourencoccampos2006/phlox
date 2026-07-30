import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3001';
const QA_EMAIL = 'qa1781881827891@phloxqa.pt';
const QA_PASSWORD = 'QaPhlox2026!';
const SHOT_DIR = 'C:/Users/Fernando/AppData/Local/Temp/claude/c--Users-Fernando-phlox/28e84895-7416-407a-b6bb-71a95e1b293f/scratchpad/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const ROUTES = [
  '/ronda-guiada',
  '/assessments',
  '/care-plans',
  '/activities',
  '/incidents',
  '/documentos',
  '/consentimentos',
  '/stock',
  '/vigia',
  '/radar',
  '/equipa?tab=mural',
  '/reconciliacao',
  '/interactions',
  '/calculos',
  '/family',
  '/familia',
  '/painel',
  '/painel-dono',
];

async function testRoute(page, path, institution) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)); };
  const onError = (err) => pageErrors.push(String(err.message || err).slice(0, 300));
  page.on('console', onConsole);
  page.on('pageerror', onError);

  let status = null;
  let finalUrl = null;
  let bodyText = '';
  let navError = null;
  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 45000 });
    status = resp ? resp.status() : null;
    await page.waitForTimeout(1800); // deixa client fetches assentarem
    finalUrl = page.url();
    bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
  } catch (e) {
    navError = String(e.message || e).slice(0, 300);
  }

  page.off('console', onConsole);
  page.off('pageerror', onError);

  const safeName = path.replace(/[^a-z0-9]/gi, '_') + '_' + institution;
  let shotPath = null;
  try {
    shotPath = `${SHOT_DIR}/${safeName}.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
  } catch {}

  return { path, institution, status, finalUrl, navError, consoleErrors, pageErrors, bodyPreview: bodyText, shotPath };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', QA_EMAIL);
  await page.fill('input[type="password"]', QA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/inicio|\/painel/, { timeout: 20000 }).catch(() => {});
  await page.locator('button', { hasText: /^Aceitar$/ }).first().click({ timeout: 2000 }).catch(() => {});

  for (const institution of ['day_care', 'nursing_home']) {
    await page.evaluate((inst) => localStorage.setItem('phlox-clinic-institution', inst), institution);
    for (const route of ROUTES) {
      const r = await testRoute(page, route, institution);
      results.push(r);
      console.log(`[${institution}] ${route} -> status=${r.status} url=${r.finalUrl} navErr=${r.navError} consoleErr=${r.consoleErrors.length} pageErr=${r.pageErrors.length}`);
      if (r.consoleErrors.length) console.log('    consoleErrors:', JSON.stringify(r.consoleErrors));
      if (r.pageErrors.length) console.log('    pageErrors:', JSON.stringify(r.pageErrors));
    }
  }

  fs.writeFileSync(`${SHOT_DIR}/sweep_results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  console.log('DONE');
})();
