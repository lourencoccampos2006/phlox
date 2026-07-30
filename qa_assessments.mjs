import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const QA_EMAIL = 'qa1781881827891@phloxqa.pt';
const QA_PASSWORD = 'QaPhlox2026!';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', QA_EMAIL);
  await page.fill('input[type="password"]', QA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/inicio|\/painel/, { timeout: 20000 }).catch(() => {});
  await page.locator('button', { hasText: /^Aceitar$/ }).first().click({ timeout: 2000 }).catch(() => {});
  await page.evaluate(() => localStorage.setItem('phlox-clinic-institution', 'day_care'));

  await page.goto(`${BASE}/assessments`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // Select patient
  const patientSelect = page.locator('select').first();
  await patientSelect.selectOption({ label: /João Silva/ }).catch(async () => {
    // fallback: select by index 1 (first real patient after the placeholder)
    await patientSelect.selectOption({ index: 1 });
  });
  await page.waitForTimeout(400);

  const marker1 = 'QA-BARTHEL-' + Date.now();
  // Select first Barthel option (Alimentação = Independente, 10pts) on all items to get a distinctive high score
  // Click radio labeled with the max option per item, to make total score deterministic-ish.
  // Simpler: click first radio in every item group visible.
  const radios = await page.locator('input[type="radio"]').all();
  console.log('radio count:', radios.length);
  // choose highest-value radio per group by clicking the LAST option label of each item (usually highest)
  const itemBlocks = await page.locator('div').filter({ hasText: /Alimentação|Banho|Higiene pessoal|Vestir|Intestinos|Bexiga|Uso da sanita|Transferência|Deambulação|Subir escadas/ });
  // Instead: click every radio input directly, selecting the LAST one in each name-group via evaluate
  const scoreSummary = await page.evaluate(() => {
    const groups = {};
    document.querySelectorAll('input[type=radio]').forEach(r => {
      const name = r.name;
      if (!groups[name]) groups[name] = [];
      groups[name].push(r);
    });
    let total = 0;
    Object.values(groups).forEach(arr => {
      const last = arr[arr.length - 1]; // highest value option (best independence)
      last.click();
      total += parseInt(last.value, 10);
    });
    return { groups: Object.keys(groups).length, total };
  });
  console.log('scoreSummary', scoreSummary);
  await page.waitForTimeout(300);

  await page.fill('textarea', marker1);
  const liveScoreText = await page.locator('text=Guardar avaliação').first().innerText().catch(() => '');
  console.log('save button text:', liveScoreText);

  await page.locator('button', { hasText: /Guardar avaliação/ }).click();
  await page.waitForTimeout(1500);
  console.log('after save 1, consoleErrors:', consoleErrors, 'pageErrors:', pageErrors);

  // reload and verify persistence
  await page.goto(`${BASE}/assessments`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await patientSelect.selectOption({ label: /João Silva/ }).catch(async () => { await patientSelect.selectOption({ index: 1 }); });
  await page.waitForTimeout(600);
  const bodyAfterReload1 = await page.locator('body').innerText();
  console.log('marker1 present after reload:', bodyAfterReload1.includes(marker1));

  // Now add SECOND assessment with a LOWER score (all lowest options) to trigger trend arrow (worse)
  const marker2 = 'QA-BARTHEL-LOW-' + Date.now();
  const scoreSummary2 = await page.evaluate(() => {
    const groups = {};
    document.querySelectorAll('input[type=radio]').forEach(r => {
      const name = r.name;
      if (!groups[name]) groups[name] = [];
      groups[name].push(r);
    });
    let total = 0;
    Object.values(groups).forEach(arr => {
      const first = arr[0]; // lowest value (dependent)
      first.click();
      total += parseInt(first.value, 10);
    });
    return { groups: Object.keys(groups).length, total };
  });
  console.log('scoreSummary2 (low)', scoreSummary2);
  await page.locator('textarea').fill(marker2);
  // check live trend indicator shown BEFORE saving (vs last record)
  const bodyBeforeSave2 = await page.locator('body').innerText();
  const trendMatch = bodyBeforeSave2.match(/(▲|▼|→)[^\n]*vs\.[^\n]*/);
  console.log('live trend before save2:', trendMatch ? trendMatch[0] : 'NONE FOUND');

  await page.locator('button', { hasText: /Guardar avaliação/ }).click();
  await page.waitForTimeout(1500);
  console.log('after save 2, consoleErrors:', consoleErrors, 'pageErrors:', pageErrors);

  await page.goto(`${BASE}/assessments`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await patientSelect.selectOption({ label: /João Silva/ }).catch(async () => { await patientSelect.selectOption({ index: 1 }); });
  await page.waitForTimeout(600);
  const bodyAfterReload2 = await page.locator('body').innerText();
  console.log('marker2 present after reload:', bodyAfterReload2.includes(marker2));
  const trendArrowInHistory = bodyAfterReload2.match(/[▲▼→][ +-]?\d+/g);
  console.log('trend arrows found in history list:', trendArrowInHistory);

  await page.screenshot({ path: 'C:/Users/Fernando/AppData/Local/Temp/claude/c--Users-Fernando-phlox/28e84895-7416-407a-b6bb-71a95e1b293f/scratchpad/shots/assessments_after_2_saves.png', fullPage: true });

  await browser.close();
})();
