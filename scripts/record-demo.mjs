import { chromium } from '@playwright/test';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const port = Number(process.env.RECORD_PORT ?? 5323);
const baseURL = `http://127.0.0.1:${port}`;
const outDir = '/opt/cursor/artifacts';
const filename = process.env.RECORD_FILE ?? 'realistic-3d-parts-demo.mp4';
const stepCount = Number(process.env.RECORD_STEPS ?? 10);
const clickDelayMs = Number(process.env.RECORD_DELAY_MS ?? 900);

await mkdir(outDir, { recursive: true });

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: 'inherit' });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('main', { name: '3D assembly viewport' }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByText('1/14').waitFor({ state: 'visible', timeout: 10_000 });
  await page.click('body');
  await page.waitForTimeout(1500);

  for (let i = 0; i < stepCount; i += 1) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(clickDelayMs);
  }

  await page.waitForTimeout(1200);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const tempPath = await video.path();
    const webmPath = path.join(outDir, `${filename}.webm`);
    const finalPath = path.join(outDir, filename);
    await rename(tempPath, webmPath);
    await runFfmpeg(['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', finalPath]);
    await unlink(webmPath).catch(() => undefined);
    console.log(`Saved ${finalPath}`);
  }
}
