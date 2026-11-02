import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const executablePath = [process.env.DEMO_BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((file) => file && existsSync(file));
const browser = await chromium.launch({ executablePath, headless: true });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.resolve('presentacion');
mkdirSync(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) { image.loading = 'eager'; await image.decode().catch(() => {}); } });
  // External links and WhatsApp are intercepted; recording never contacts the business.
  await page.evaluate(() => { window.open = () => null; });
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobile = await mobileContext.newPage();
  await mobile.goto('http://127.0.0.1:4321', { waitUntil: 'networkidle' });
  await mobile.evaluate(() => document.fonts.ready);
  const render = await browser.newPage();
  const format = await render.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 800; document.body.append(canvas);
    window.demoCanvas = canvas; window.demoContext = canvas.getContext('2d');
    const audio = new AudioContext(); const mix = audio.createMediaStreamDestination();
    const master = audio.createGain(); master.gain.value = .17; master.connect(mix);
    const notes = [130.81,164.81,196,261.63,196,164.81,146.83,174.61,220,293.66,220,174.61];
    for (let phrase=0; phrase<7; phrase++) notes.forEach((hz, index) => { const osc=audio.createOscillator(), gain=audio.createGain(); osc.type='sine'; osc.frequency.value=hz; gain.gain.value=.0001; osc.connect(gain); gain.connect(master); osc.start(); const t=audio.currentTime+phrase*12+index*1.0; gain.gain.setTargetAtTime(.18,t,.09); gain.gain.setTargetAtTime(.0001,t+.68,.12); });
    window.demoAudio=audio;
    const formats = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9'];
    const mimeType = formats.find((mime) => MediaRecorder.isTypeSupported(mime));
    if (!mimeType) throw new Error('No hay codificador de video disponible.');
    window.demoChunks = [];
    window.demoRecorder = new MediaRecorder(new MediaStream([...canvas.captureStream(24).getVideoTracks(), ...mix.stream.getAudioTracks()]), { mimeType, videoBitsPerSecond: 1800000 });
    window.demoRecorder.ondataavailable = (event) => { if (event.data.size) window.demoChunks.push(event.data); };
    window.demoRecorder.start(1000); return mimeType;
  });
  let source = page;
  let caption = 'Estudio Demo · Galería, servicios y consultas';
  let running = true;
  let frames = 0;
  const pump = (async () => {
    while (running) {
      const shot = await source.screenshot({ type: 'jpeg', quality: 82 });
      const narrow = source === mobile;
      await render.evaluate(async ({ jpeg, caption, narrow }) => {
        const image = new Image(); image.src = 'data:image/jpeg;base64,' + jpeg; await image.decode();
        const ctx = window.demoContext; ctx.fillStyle = '#f7f2e9'; ctx.fillRect(0, 0, 1280, 800);
        if (narrow) {
          ctx.fillStyle = '#352127'; ctx.font = '52px Georgia'; ctx.fillText('También en', 95, 300); ctx.font = 'italic 60px Georgia'; ctx.fillStyle = '#d01957'; ctx.fillText('tu celular.', 95, 375);
          ctx.fillStyle = '#64555b'; ctx.font = '20px Arial'; ctx.fillText('La misma web, adaptada a cada pantalla.', 95, 435);
          ctx.drawImage(image, 780, 12, 360, 779);
          ctx.strokeStyle = '#352127'; ctx.lineWidth = 2; ctx.strokeRect(779, 11, 362, 781);
        } else ctx.drawImage(image, 0, 0, 1280, 800);
      }, { jpeg: shot.toString('base64'), caption, narrow });
      frames++; await delay(65);
    }
  })();
  const show = async (text, selector, hold = 3500) => {
    caption = text;
    if (selector) await source.locator(selector).evaluate((element) => element.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await delay(hold);
  };
  await show(caption, null, 5500);
  await show('Una colección de tus trabajos, con filtros por estilo', '#coleccion', 4500);
  await page.locator('[data-filter="arte"]').click(); await delay(2500);
  await page.locator('[data-filter="all"]').click();
  await page.locator('[data-photo-id="03"]').click();
  caption = 'Cada diseño se puede explorar y elegir como inspiración'; await delay(3500);
  await page.locator('.dialog-next').click(); await delay(2500);
  await page.locator('#use-reference').click();
  caption = 'La referencia elegida acompaña la consulta'; await delay(3500);
  await page.locator('#service').selectOption('SoftGel');
  await page.locator('#idea').fill('Me gustaría algo en celeste para una ocasión especial.'); await delay(1800);
  await page.locator('#inquiry-form button[type="submit"]').click();
  caption = 'Mensaje preparado para WhatsApp · El turno se confirma conversando'; await delay(3500);
  await show('Tus servicios, ordenados y fáciles de consultar', '#servicios', 3000);
  await page.locator('.service-row summary').first().click(); await delay(3500);
  await show('Un espacio para la identidad y la historia de Estudio Demo', '#estudio', 4000);
  source = mobile;
  await show('La misma experiencia, también en tu celular', null, 5000);
  await show('La colección también se explora desde el celular', '#coleccion', 4000);
  await mobile.locator('[data-photo-id="07"]').click();
  await show('Fotos ampliadas y selección de referencia desde el celular', null, 3500);
  source = page; await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await show('Estudio Demo · Tu próximo diseño empieza con una idea', null, 4500);
  running = false; await pump;
  const base64 = await render.evaluate(async () => {
    await new Promise((resolve) => { window.demoRecorder.onstop = resolve; window.demoRecorder.stop(); });
    const bytes = new Uint8Array(await new Blob(window.demoChunks).arrayBuffer());
    let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  });
  const file = path.join(output, `Estudio Demo-recorrido-musical.${format.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
  writeFileSync(file, Buffer.from(base64, 'base64'));
  console.log(JSON.stringify({ file, format, frames, bytes: Buffer.from(base64, 'base64').length }));
} finally { await browser.close(); }
