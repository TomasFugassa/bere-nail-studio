import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const executablePath = [process.env.DEMO_BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((file) => file && existsSync(file));
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
  const file = ['presentacion/Estudio Demo-propuesta-privada.mp4', 'presentacion/Estudio Demo-propuesta-privada.webm'].find(existsSync);
  assert.ok(file, 'No se encontró el video generado.');
  const bytes = readFileSync(file);
  const metadata = await page.evaluate(async ({ base64, type }) => {
    const raw = atob(base64); const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    const video = document.createElement('video'); window.demoVideo = video; video.muted = true;
    video.src = URL.createObjectURL(new Blob([bytes], { type })); document.body.append(video);
    await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; });
    if (!Number.isFinite(video.duration)) {
      video.currentTime = 100000;
      await new Promise((resolve) => { video.onseeked = resolve; });
    }
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  }, { base64: bytes.toString('base64'), type: file.endsWith('mp4') ? 'video/mp4' : 'video/webm' });
  assert.equal(metadata.width, 1280); assert.equal(metadata.height, 920);
  assert.ok(metadata.duration > 50 && metadata.duration < 100, JSON.stringify(metadata));
  for (const time of [2, 19, 49, 57]) {
    const frame = await page.evaluate(async (time) => {
      const video = window.demoVideo;
      await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = time; });
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0); return canvas.toDataURL('image/png').split(',')[1];
    }, time);
    writeFileSync(`qa-output/video-frame-${time}.png`, Buffer.from(frame, 'base64'));
  }
  await page.goto('http://127.0.0.1:4321', { waitUntil: 'networkidle' });
  await page.locator('[data-photo-id="03"]').click();
  await page.locator('#dialog-image').evaluate((image) => {
    image.dispatchEvent(new TouchEvent('touchstart', { touches: [new Touch({ identifier: 1, target: image, clientX: 260, clientY: 200 })] }));
    image.dispatchEvent(new TouchEvent('touchend', { changedTouches: [new Touch({ identifier: 1, target: image, clientX: 100, clientY: 210 })] }));
  });
  assert.equal(await page.locator('#dialog-title').textContent(), 'Efecto mariposa');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('.reveal')].every((element) => element.classList.contains('revealed')));
  const report = { file, ...metadata, bytes: bytes.length, swipe: 'PASS', reducedMotion: 'PASS' };
  writeFileSync('qa-output/video-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
