#!/usr/bin/env node
/**
 * Staging: регистрация собственника + вход /o/ → кабинет собственника (6 вкладок).
 * PIN только из env OWNER_STAGING_PIN (при повторном прогоне с OWNER_STAGING_PHONE).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import playwright from '../../scripts/node_modules/playwright/index.js';

const { chromium } = playwright;

const STAGING = process.env.STAGING_BASE || 'https://staging.app.armada.sx';
/** Локальный фронт при проверке до деплоя (API остаётся STAGING, если не задан OWNER_TEST_API_BASE). */
const WEB_BASE = process.env.OWNER_TEST_WEB_BASE || STAGING;
const API_BASE = process.env.OWNER_TEST_API_BASE || STAGING;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WP = path.join(__dirname, '..');
const ART = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts';

function previewContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

function startLocalPreviewServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      if (urlPath === '/o' || urlPath === '/o/' || urlPath === '/v' || urlPath === '/v/') urlPath = '/index.html';
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
      const port = server.address().port;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function chromiumLaunchOpts() {
  const candidates = [
    '/opt/pw-browsers/chromium',
    '/opt/pw-browsers/chromium/chrome',
    '/opt/pw-browsers/chromium-*/chrome-linux/chrome',
  ];
  for (const p of candidates) {
    if (p.includes('*')) continue;
    if (fs.existsSync(p)) return { executablePath: p };
  }
  return {};
}

const LOCAL_MOCK = process.env.OWNER_TEST_LOCAL_MOCK === '1';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function mockOwnerJwt(name) {
  const payload = {
    role: 'owner_driver',
    driverName: name,
    companyId: 'co-mock',
    spaceId: 'sp-mock',
    exp: Math.floor(Date.now() / 1000) + 86400,
  };
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`;
}

async function wireLocalApiMock(page, creds) {
  const token = mockOwnerJwt(creds.name);
  await page.route(/http:\/\/127\.0\.0\.1:8787\/.*/, async (route) => {
    const u = new URL(route.request().url());
    const method = route.request().method();
    if (u.pathname === '/auth/verify-owner-driver' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token,
          driver: {
            id: 'drv-mock',
            name: creds.name,
            phone: creds.phone,
            companyId: 'co-mock',
            spaceId: 'sp-mock',
            accountKind: 'owner_driver',
          },
        }),
      });
      return;
    }
    if (u.pathname === '/state' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pb-mock',
          payload: { dataEpoch: 1, drivers: [], companies: [], spaces: [], orders: [] },
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function registerViaApi() {
  const suffix = String(Date.now()).slice(-6);
  const phone = process.env.OWNER_STAGING_PHONE || `+7900${suffix}`;
  const pin = process.env.OWNER_STAGING_PIN || String(100000 + (Number(suffix) % 899999)).padStart(6, '0').slice(0, 6);
  const name = process.env.OWNER_STAGING_NAME || `ТЕСТ QA Собственник ${suffix}`;
  if (LOCAL_MOCK) return { phone, pin, name };
  const res = await fetch(`${API_BASE}/armada-api/auth/register-owner-driver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name,
      phone,
      pin,
      firmName: `ИП ${name}`,
      plate: `А${suffix.slice(0, 3)}ВС77`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) {
    throw new Error(`register ${res.status}: ${data.message || data.error || 'fail'}`);
  }
  return { phone, pin, name };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  let webBase = WEB_BASE;
  let localServer = null;
  if (LOCAL_MOCK) {
    localServer = await startLocalPreviewServer();
    webBase = localServer.base;
  }
  const creds = await registerViaApi();
  const { phone, pin } = creds;
  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOpts() });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (LOCAL_MOCK) {
    await wireLocalApiMock(page, creds);
  } else if (WEB_BASE.replace(/\/$/, '') !== API_BASE.replace(/\/$/, '')) {
    await page.route(/http:\/\/127\.0\.0\.1:8787\/.*/, async (route) => {
      const u = new URL(route.request().url());
      const target = `${API_BASE.replace(/\/$/, '')}/armada-api${u.pathname}${u.search}`;
      const res = await route.fetch({ url: target, headers: route.request().headers() });
      await route.fulfill({ response: res });
    });
  }
  await page.goto(`${webBase}/o/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('#owner-login-phone', phone);
  await page.fill('#owner-login-pin', pin);
  await page.click('#owner-login-ok');
  await page.waitForTimeout(12000);
  const loginErr = await page.locator('#owner-login-error').textContent().catch(() => '');
  const driverCls = await page.locator('#driver').getAttribute('class').catch(() => '');
  if (loginErr) throw new Error(`login error: ${loginErr}`);
  if (!String(driverCls || '').includes('show')) {
    await page.screenshot({ path: path.join(ART, 'owner-o-staging-login-stuck.png'), fullPage: true });
    throw new Error(`driver screen not shown (class=${driverCls})`);
  }
  await page.waitForTimeout(1500);
  const nav = await page.$('.owner-driver-nav');
  const hiredNav = await page.$('#btn-eto');
  if (!nav) {
    await page.screenshot({ path: path.join(ART, 'owner-o-staging-fail.png'), fullPage: true });
    throw new Error('owner-driver-nav not found (hired UI?)');
  }
  const tabs = await page.$$eval('.owner-driver-nav button', (els) => els.map((e) => e.textContent.trim()));
  if (tabs.length < 5) throw new Error(`expected owner tabs, got: ${tabs.join('|')}`);
  if (hiredNav && (await page.locator('#btn-eto').isVisible().catch(() => false))) {
    throw new Error('hired driver ETO tab visible in owner cabinet');
  }
  await page.screenshot({ path: path.join(ART, 'owner-o-staging-after-login.png'), fullPage: true });
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  if (!(await page.$('.owner-driver-nav'))) {
    throw new Error('owner-driver-nav missing after F5');
  }
  if (await page.locator('#btn-eto').isVisible().catch(() => false)) {
    throw new Error('hired ETO visible after F5');
  }
  const empty = await page.$('.owner-driver-empty');
  if (!empty) {
    const hint = await page.textContent('#owner-driver-view');
    if (hint && !/Нет рейсов|Главная/.test(hint)) {
      console.warn('warn: empty state hint not found, home:', (hint || '').slice(0, 120));
    }
  }
  await browser.close();
  if (localServer) localServer.server.close();
  console.log('owner-o-staging-login: ok', { phone: phone.replace(/\d(?=\d{4})/g, '*') });
}

main().catch((e) => {
  console.error('owner-o-staging-login: FAIL', e.message || e);
  process.exit(1);
});
