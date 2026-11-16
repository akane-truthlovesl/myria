// Shared harness: serves the project straight from disk through request interception
// (no network listener is opened anywhere) and exposes small helpers.
import puppeteer from 'puppeteer-core';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const ROOT = process.env.MYRIA_ROOT || '/home/xrdpuser/Desktop/game_3';
export const ORIGIN = 'http://myria.test';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
export async function open(urlPath = '/index.html', { w = 1280, h = 720, dpr = 1, args = [], touch = false, root = ROOT } = {}) {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', ...args] });
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
  await page.setRequestInterception(true);
  page.on('request', async req => {
    const u = new URL(req.url());
    if (u.origin !== ORIGIN) return req.continue();
    let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root)) return req.respond({ status: 403, body: 'no' });
    try { const body = await readFile(file); req.respond({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', headers: { 'cache-control': 'no-store' }, body }); }
    catch { req.respond({ status: 404, body: 'not found' }); }
  });
  await page.goto(ORIGIN + urlPath, { waitUntil: 'load' });
  return { browser, page, logs };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function errs(logs) { return logs.filter(l => (l.startsWith('[error]') || l.startsWith('[pageerror]') || l.startsWith('[warn')) && !l.includes('404') && !l.includes('GPU stall')).slice(0, 25).join('\n'); }
