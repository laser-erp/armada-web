#!/usr/bin/env node
/**
 * Локальные снимки редизайна (часть 2), без staging/prod.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import playwright from '../../scripts/node_modules/playwright/index.js';

const { chromium } = playwright;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WP = path.join(__dirname, '..');
const OUT = path.join(WP, '..', 'docs', 'qa-runs', '2026-10-17_редизайн', 'screens');

function previewContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function startLocalPreviewServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      if (urlPath === '/a' || urlPath === '/a/') urlPath = '/index.html';
      if (urlPath === '/v' || urlPath === '/v/') urlPath = '/index.html';
      const filePath = path.join(WP, urlPath.replace(/^\//, '') || 'index.html');
      if (!filePath.startsWith(WP) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': previewContentType(filePath) });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function chromiumLaunchOpts() {
  const candidates = [
    '/opt/pw-browsers/chromium',
    '/opt/pw-browsers/chromium/chrome',
    '/opt/google/chrome/chrome',
    '/usr/local/bin/google-chrome',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return { executablePath: p };
  }
  return {};
}

async function waitTheme(page) {
  await page.waitForFunction(
    () => typeof armadaApplyDefaultAppTheme === 'function' || typeof applyArmadaTheme === 'function',
    { timeout: 45000 },
  );
  await page.evaluate(() => {
    if (document.documentElement.getAttribute('data-armada-theme')) return;
    if (typeof armadaSyncEntryBranding === 'function') armadaSyncEntryBranding();
    else if (typeof armadaApplyDefaultAppTheme === 'function') armadaApplyDefaultAppTheme();
  });
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-armada-theme') != null,
    { timeout: 15000 },
  );
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
}

async function showAdminShell(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.screen.show').forEach((el) => el.classList.remove('show'));
    document.getElementById('splash')?.classList.remove('show');
    const shell = document.getElementById('shell');
    shell?.classList.add('wide');
    document.getElementById('admin')?.classList.add('show');
    if (typeof armadaApplyDefaultAppTheme === 'function') armadaApplyDefaultAppTheme();
  });
  await page.waitForSelector('#admin.show', { timeout: 5000 });
}

async function showDriverShell(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.screen.show').forEach((el) => el.classList.remove('show'));
    document.getElementById('splash')?.classList.remove('show');
    document.getElementById('driver')?.classList.add('show');
    if (typeof armadaApplyDefaultAppTheme === 'function') armadaApplyDefaultAppTheme();
  });
  await page.waitForSelector('#driver.show', { timeout: 5000 });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, base } = await startLocalPreviewServer();
  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOpts() });
  try {
    const page = await browser.newPage();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.waitForURL(/landing\.html/, { timeout: 30000 });
    await waitTheme(page);
    await shot(page, 'part2-roles-390.png');

    await page.goto(`${base}/a/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#admin-pin.show', { timeout: 30000 });
    await waitTheme(page);
    await shot(page, 'part2-admin-login-390.png');

    await page.goto(`${base}/v/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#driver-login.show', { timeout: 30000 });
    await waitTheme(page);
    await shot(page, 'part2-driver-login-390.png');

    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await showAdminShell(page);
    await shot(page, 'part2-admin-kanban-shell-390.png');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.waitForURL(/landing\.html/, { timeout: 30000 });
    await waitTheme(page);
    await shot(page, 'part2-roles-1440.png');

    await showAdminShell(page);
    await shot(page, 'part2-admin-kanban-1440.png');

    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await showDriverShell(page);
    await shot(page, 'part2-driver-home-1440.png');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
