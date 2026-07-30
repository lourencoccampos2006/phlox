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
  await page.evaluate(() => localStorage.setItem('phlox-clinic-institution', 'nursing_home'));

  await page.goto(`${BASE}/incidents`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  await page.locator('button', { hasText: /Nova Ocorrência/ }).click();
  await page.waitForTimeout(400);

  const marker = 'QA-INCIDENT-' + Date.now();
  const rootCauseMarker = 'QA-ROOTCAUSE-' + Date.now();
  const outcomeMarker = 'QA-OUTCOME-' + Date.now();

  // patient select is inside the modal - find select with the person label
  const modal = page.locator('text=Nova Ocorrência').locator('..').locator('..');
  const selects = page.locator('select');
  // First select in modal = patient, second = type, third = severity (order per JSX)
  await selects.nth(0).selectOption({ index: 1 }); // primeiro utente/residente real
  await selects.nth(1).selectOption('fall').catch(() => {});
  await selects.nth(2).selectOption('major').catch(() => {}); // gravidade grave -> deve disparar modal de notificação à família

  await page.locator('textarea').first().fill(marker + ' — queda na casa de banho durante a noite'); // descrição
  await page.locator('input[placeholder*="Sem lesões"]').fill(outcomeMarker).catch(() => {});
  // outcome field placeholder actual: "Ex: Sem lesões, vigilância 24h, ida ao hospital..."
  const outcomeInput = page.locator('input[placeholder*="vigilância 24h"]');
  if (await outcomeInput.count()) await outcomeInput.fill(outcomeMarker);
  const rootCauseTextarea = page.locator('textarea[placeholder*="causa"]');
  if (await rootCauseTextarea.count()) await rootCauseTextarea.fill(rootCauseMarker);

  await page.screenshot({ path: 'C:/Users/Fernando/AppData/Local/Temp/claude/c--Users-Fernando-phlox/28e84895-7416-407a-b6bb-71a95e1b293f/scratchpad/shots/incident_form_filled.png' });

  // click save button ("Registar ocorrência" for new incidents)
  const saveBtn = page.locator('button', { hasText: /Registar ocorrência|Guardar alterações/ });
  console.log('save buttons found:', await saveBtn.count());
  await saveBtn.first().click();
  await page.waitForTimeout(1500);
  console.log('after save, consoleErrors:', consoleErrors, 'pageErrors:', pageErrors);

  // Check if family-notify modal opened (since severity=major)
  const notifyModalVisible = await page.locator('text=/comunica|família/i').count();
  console.log('possible family-notify modal elements found:', notifyModalVisible);
  await page.screenshot({ path: 'C:/Users/Fernando/AppData/Local/Temp/claude/c--Users-Fernando-phlox/28e84895-7416-407a-b6bb-71a95e1b293f/scratchpad/shots/incident_after_save.png' });
  // close any modal by pressing Escape / clicking outside, best-effort
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  // reload and verify persistence
  await page.goto(`${BASE}/incidents`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const bodyAfterReload = await page.locator('body').innerText();
  console.log('marker present in list after reload:', bodyAfterReload.includes(marker.split(' —')[0]));

  // Open the incident (find its card and click it) to verify investigation fields persisted
  const card = page.locator(`text=${marker.split(' —')[0]}`).first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(600);
    const detailText = await page.locator('body').innerText();
    console.log('outcome marker present in detail:', detailText.includes(outcomeMarker));
    console.log('root cause marker present in detail:', detailText.includes(rootCauseMarker));

    // Now EDIT it
    const editBtn = page.locator('button', { hasText: /Editar/ });
    await editBtn.click();
    await page.waitForTimeout(500);
    const editMarker = 'QA-EDITED-' + Date.now();
    await page.locator('textarea').first().fill(editMarker);
    // change status via select in detail view isn't available in edit form; status changes via updateStatus buttons in detail view instead.
    const saveBtn2 = page.locator('button', { hasText: /Guardar alterações/ });
    await saveBtn2.first().click();
    await page.waitForTimeout(1200);
    console.log('after edit save, consoleErrors:', consoleErrors, 'pageErrors:', pageErrors);

    await page.goto(`${BASE}/incidents`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const bodyAfterEdit = await page.locator('body').innerText();
    console.log('edited description present after reload:', bodyAfterEdit.includes(editMarker));
    console.log('OLD description still present (should be FALSE if edit truly replaced it):', bodyAfterEdit.includes(marker.split(' —')[0]));
  } else {
    console.log('COULD NOT FIND the created incident card by marker text — investigate');
  }

  await browser.close();
})();
