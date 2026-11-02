import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

export async function reviewManualBooking({ page, context, url, api, cookie, report, output }) {
  assert.equal((await api('/api/admin?view=availability')).status, 401);
  assert.equal((await api('/api/admin', { action: 'create-booking' })).status, 401);
  assert.equal(
    (await api('/api/admin', { action: 'create-booking' }, cookie, 'https://otro.example')).status,
    403,
  );
  const original = (await api('/api/admin', null, cookie)).data.content;
  const workingDate = original.booking.windows[0].date;
  const patch = async (changes) => {
    const content = (await api('/api/admin', null, cookie)).data.content;
    const response = await api(
      '/api/admin',
      { action: 'save', content: { ...content, booking: { ...content.booking, ...changes } } },
      cookie,
    );
    assert.equal(response.status, 200);
  };
  await patch({ windows: [] });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-tab="agenda"]').click();
  await page.getByRole('button', { name: 'Agendar turno', exact: true }).click();
  await page.getByText('Todavía no hay horarios publicados.', { exact: false }).waitFor();
  assert.ok(await page.locator('#editor-dialog button[type="submit"]').isDisabled());
  await page.getByRole('button', { name: 'Ir a horarios', exact: true }).click();
  assert.equal(await page.locator('#editor-dialog').evaluate((d) => d.open), false);
  await page.getByRole('heading', { name: 'Tus horarios', exact: true }).waitFor();
  await patch({ windows: original.booking.windows });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-tab="agenda"]').click();
  await page.getByRole('button', { name: 'Agendar turno', exact: true }).click();
  await page.locator('#manual-service').selectOption('softgel');
  await page.waitForFunction(() => !document.querySelector('#manual-date').disabled);
  await page.locator('#manual-date').selectOption(workingDate);
  await page.locator('#manual-slots button[data-start]').first().waitFor();
  const chosen = await page
    .locator('#manual-slots button[data-start]')
    .first()
    .getAttribute('data-start');
  await page.locator('#manual-slots button[data-start]').first().click();
  await page.getByLabel('Nombre del cliente', { exact: true }).fill('Cliente agendado por administración');
  await page.getByLabel('Celular / WhatsApp', { exact: true }).fill('099654321');
  const ax = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  report.accessibility.push({
    page: 'alta manual de turno',
    violations: ax.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  });
  for (const [width, height] of [
    [1440, 780],
    [390, 650],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    const bounds = await page.locator('#editor-dialog').boundingBox();
    const submit = await page.locator('#editor-dialog button[type="submit"]').boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height + 1);
    assert.ok(submit.y >= 0 && submit.y + submit.height <= height - 4, 'Guardar visible');
    assert.equal(
      await page.locator('.form-content').evaluate((n) => n.scrollWidth > n.clientWidth + 1),
      false,
      'Formulario sin desborde horizontal',
    );
    await page.screenshot({ path: path.join(output, 'agendar-turno-' + width + '.png') });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const collision = await api('/api/booking', {
    requestKey: randomUUID(),
    serviceId: 'softgel',
    start: Number(chosen),
    name: 'Reserva simultánea web',
    phone: '099112233',
  });
  assert.equal(collision.status, 201);
  await page.locator('#editor-dialog button[type="submit"]').click();
  await page
    .getByText('Ese espacio ya no está disponible. La lista se actualizó; elegí otro horario.', {
      exact: true,
    })
    .waitFor();
  assert.ok(await page.locator('#editor-dialog button[type="submit"]').isDisabled());
  assert.equal(await page.locator('#manual-slots button[data-start="' + chosen + '"]').count(), 0);
  await page.locator('#manual-slots button[data-start]').first().click();
  const newStart = Number(
    await page.locator('#manual-slots button[aria-pressed="true"]').getAttribute('data-start'),
  );
  await page.locator('#editor-dialog button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('#editor-dialog').open);
  await page.locator('.booking-row').filter({ hasText: 'Cliente agendado por administración' }).waitFor();
  let state = (await api('/api/admin', null, cookie)).data;
  const added = state.bookings.find((b) => b.name === 'Cliente agendado por administración');
  assert.equal(added.start, newStart);
  assert.equal(added.status, 'confirmed');
  assert.equal(added.end - added.start, 75 * 60000);
  const publicSlots = (await api('/api/availability?service=softgel&date=' + workingDate)).data
    .slots;
  assert.ok(!publicSlots.some((s) => s.start === newStart));
  await page.locator('[data-tab="clients"]').click();
  await page.getByLabel('Buscar clientes').fill('Cliente agendado');
  await page.locator('.client-card').filter({ hasText: 'Cliente agendado por administración' }).click();
  assert.ok((await page.locator('#dialog-body').textContent()).includes('SoftGel'));
  await page.locator('#close-editor').click();
  await api('/api/admin', { action: 'booking', id: added.id, status: 'cancelled' }, cookie);
  await api('/api/booking', { action: 'cancel', token: collision.data.token });
  assert.ok(
    (await api('/api/availability?service=softgel&date=' + workingDate)).data.slots.some(
      (s) => s.start === newStart,
    ),
  );
  await patch({ enabled: false });
  const availability = (
    await api('/api/admin?view=availability&service=semi&date=' + workingDate, null, cookie)
  ).data;
  const payload = {
    action: 'create-booking',
    requestKey: randomUUID(),
    serviceId: 'semi',
    start: availability.slots[0].start,
    name: 'Turno con agenda pública pausada',
    phone: '099887766',
  };
  assert.equal((await api('/api/booking', { ...payload, administrator: true })).status, 409);
  const paused = await api('/api/admin', payload, cookie);
  assert.equal(paused.status, 201);
  assert.equal((await api('/api/admin', payload, cookie)).data.booking.id, paused.data.booking.id);
  await api(
    '/api/admin',
    { action: 'booking', id: paused.data.booking.id, status: 'cancelled' },
    cookie,
  );
  const current = (await api('/api/admin', null, cookie)).data.content;
  await api(
    '/api/admin',
    { action: 'save', content: { ...original, version: current.version } },
    cookie,
  );
  await page.reload({ waitUntil: 'networkidle' });
  report.checks.push(
    'Alta manual desde Agenda: cliente e historial compartidos, horarios libres, duración y descanso, choque con reserva web y recuperación, cancelación, permisos, reintento, agenda pública pausada y formulario móvil sin recortes',
  );
}
