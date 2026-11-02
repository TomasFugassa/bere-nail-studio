import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';

const executablePath = [
  process.env.DEMO_BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((candidate) => candidate && existsSync(candidate));
if (!executablePath)
  throw new Error(
    'No se encontró Edge o Chrome. Configurá DEMO_BROWSER_PATH para ejecutar la revisión.',
  );
const output = path.resolve('qa-output');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const report = {
  url: process.env.DEMO_TEST_URL || 'http://127.0.0.1:4321',
  errors: [],
  failedResponses: [],
  viewports: [],
  accessibility: [],
  interactions: [],
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400)
      report.failedResponses.push({ status: response.status(), url: response.url() });
  });
  const response = await page.goto(report.url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('h1').count(), 1);
  const entries = await page
    .locator('.photo-button')
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        id: button.dataset.photoId,
        number: button.dataset.photoNumber,
        title: button.dataset.photoTitle,
        category: button.closest('.gallery-item').dataset.category,
      })),
    );
  assert.ok(entries.length > 0);
  assert.deepEqual(
    await page.locator('.photo-index').allTextContents(),
    entries.map((_, i) => String(i + 1).padStart(2, '0')),
  );
  assert.equal(
    await page.locator('meta[name="robots"]').getAttribute('content'),
    'noindex, nofollow, noarchive',
  );
  for (const filter of ['sutil', 'color', 'arte', 'all']) {
    const expected =
      filter === 'all' ? entries.length : entries.filter((e) => e.category === filter).length;
    await page.locator(`[data-filter="${filter}"]`).click();
    assert.equal(await page.locator('.gallery-item:visible').count(), expected);
    assert.equal(await page.locator('#photo-count').textContent(), String(expected));
  }
  report.interactions.push(
    'Filtros y numeración comprobados con ' + entries.length + ' diseños actuales',
  );
  const selectedIndex = Math.min(2, entries.length - 1),
    selected = entries[selectedIndex],
    next = entries[(selectedIndex + 1) % entries.length],
    reference = entries[Math.min(6, entries.length - 1)];
  await page.locator(`[data-photo-id="${selected.id}"]`).click();
  assert.equal(await page.locator('#photo-dialog').evaluate((n) => n.open), true);
  await page.locator('#dialog-image').evaluate((image) => image.decode());
  assert.equal(await page.locator('#dialog-title').textContent(), selected.title);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#dialog-title').textContent(), next.title);
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    (id) => document.activeElement?.getAttribute('data-photo-id') === id,
    selected.id,
  );
  await page.locator(`[data-photo-id="${reference.id}"]`).click();
  await page.locator('#use-reference').click();
  assert.equal(
    await page.locator('#reference-name').textContent(),
    reference.number + ' · ' + reference.title,
  );
  report.interactions.push('Visor, flechas, foco y referencia con número público');
  const options = await page
    .locator('#service option')
    .evaluateAll((nodes) => nodes.map((n) => n.value).filter(Boolean));
  const chosen = options.includes('SoftGel') ? 'SoftGel' : options[0];
  await page.locator('#service').selectOption(chosen);
  await page.locator('#idea').fill('Quiero un detalle dorado & delicado.');
  await page.evaluate(() => {
    window.__demoOpen = null;
    window.open = (url) => {
      window.__demoOpen = String(url);
      return null;
    };
  });
  await page.locator('#inquiry-form button[type="submit"]').click();
  const opened = await page.evaluate(() => window.__demoOpen);
  assert.equal(opened, null, 'La demostración no debe abrir un contacto externo');
  assert.match(await page.locator('#form-status').textContent(), /no se envía/i);
  await page.locator('#clear-reference').click();
  assert.equal(await page.locator('#selected-reference').isVisible(), false);
  report.interactions.push(
    'Consulta de demostración sin envío ni contacto externo',
  );
  await page.locator('.service-row summary').first().click();
  assert.equal(
    await page
      .locator('.service-row')
      .first()
      .evaluate((element) => element.open),
    true,
  );
  const inquiry = await page.locator('.service-inquiry').first().getAttribute('data-service');
  await page.locator('.service-inquiry').first().click();
  assert.equal(
    await page.locator('#service').inputValue(),
    inquiry === 'Semipermanente' ? 'Esmaltado semipermanente' : inquiry,
  );
  await page.locator('.service-row summary').first().click();
  await page.evaluate(() => {
    document.querySelector('#inquiry-form').reset();
    document.querySelector('#form-status').textContent = '';
  });

  for (const width of [1440, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('body *')]
        .map((element) => ({
          element: element.tagName,
          class: element.className?.baseVal ?? element.className,
          right: element.getBoundingClientRect().right,
        }))
        .filter((element) => element.right > innerWidth + 1)
        .slice(0, 12),
    }));
    report.viewports.push({ width, ...dimensions });
    if (dimensions.document > width)
      await page.screenshot({ path: path.join(output, `layout-${width}.png`), fullPage: true });
    assert.ok(
      dimensions.document <= width,
      `Desborde horizontal a ${width}px: ${JSON.stringify(dimensions)}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.menu-toggle').click();
  assert.equal(await page.locator('#mobile-nav').isVisible(), true);
  await page.locator('#mobile-nav a[href="#coleccion"]').click();
  assert.equal(await page.locator('#mobile-nav').isVisible(), false);
  report.interactions.push('Menú móvil: abrir, navegar y cerrar');

  for (const [name, width, height] of [
    ['mobile', 390, 844],
    ['desktop', 1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async () => {
      for (const image of document.querySelectorAll('img')) {
        image.loading = 'eager';
        await image.decode().catch(() => {});
      }
      await document.fonts.ready;
      window.scrollTo(0, 0);
    });
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    report.accessibility.push({
      viewport: name,
      violations: accessibility.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        elements: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
      })),
    });
    await page.screenshot({ path: path.join(output, `${name}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(output, `${name}-cover.png`) });
  }
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  assert.equal(report.failedResponses.length, 0, JSON.stringify(report.failedResponses));
  assert.equal(
    report.accessibility.flatMap((item) => item.violations).length,
    0,
    JSON.stringify(report.accessibility),
  );
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        viewports: report.viewports.length,
        accessibility: '0 violations',
        interactions: report.interactions,
        screenshots: output,
      },
      null,
      2,
    ),
  );
} catch (error) {
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
}
