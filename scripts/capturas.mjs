// Genera las capturas de docs/capturas con Playwright.
// Requisitos: `npm run build && npx vite preview --port 4105` corriendo, y playwright-core del repo de herramientas.
import { chromium } from '/home/tony/Documentos/Trabajo/prototipos/_tools/node_modules/playwright-core/index.mjs';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4105/';
const OUT = path.resolve('docs/capturas');
fs.mkdirSync(OUT, { recursive: true });
const root = `${os.homedir()}/.cache/ms-playwright`;
const dir = fs.readdirSync(root).find((d) => d.startsWith('chromium-'));
const exe = `${root}/${dir}/chrome-linux64/chrome`;
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : '/usr/bin/google-chrome', args: ['--no-sandbox'] });

async function abrir(w, h, ruta) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`${BASE}#/${ruta}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  return { ctx, page };
}
async function foto(nombre, w, h, ruta, { full = false, antes } = {}) {
  const { ctx, page } = await abrir(w, h, ruta);
  if (antes) await antes(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, nombre), fullPage: full });
  console.log('ok', nombre);
  await ctx.close();
}

const D = [1440, 900];
await foto('01-tablero.png', ...D, 'tablero', { full: true });
await foto('02-agenda.png', ...D, 'agenda');
await foto('02b-agenda-nuevo-turno.png', ...D, 'agenda', {
  antes: async (p) => {
    await p.getByRole('button', { name: 'Nuevo turno' }).click();
    await p.getByLabel('Buscar paciente').fill('co');
    await p.locator('ul button').first().click();
    await p.locator('select').nth(0).selectOption({ label: 'NS-4102 · RM de encéfalo con contraste (45 min)' }).catch(() => {});
    await p.locator('button', { hasText: /^\d\d:\d\d$/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
  },
});
await foto('02c-agenda-detalle-whatsapp.png', ...D, 'agenda', {
  antes: async (p) => {
    await p.locator('button[aria-label*="Confirmado"]').first().click();
    await p.waitForTimeout(300);
  },
});
await foto('03-recepcion.png', ...D, 'recepcion', { full: true });
await foto('04-autorizaciones.png', ...D, 'autorizaciones');
await foto('05-facturacion.png', ...D, 'facturacion');
await foto('05b-facturacion-lote.png', ...D, 'facturacion', {
  antes: async (p) => {
    await p.getByRole('tab', { name: /Lotes y conciliación/ }).click();
    await p.getByRole('button', { name: 'Abrir' }).first().click();
    await p.waitForTimeout(300);
  },
});
await foto('06-honorarios.png', ...D, 'honorarios');
await foto('07-insumos.png', ...D, 'insumos');
await foto('08-reportes.png', ...D, 'reportes', { full: true });
const M = [390, 844];
await foto('09-movil-tablero.png', ...M, 'tablero');
await foto('10-movil-recepcion.png', ...M, 'recepcion');
await foto('11-movil-agenda.png', ...M, 'agenda', {
  antes: async (p) => {
    await p.getByRole('button', { name: 'Centro' }).click();
  },
});
await browser.close();
