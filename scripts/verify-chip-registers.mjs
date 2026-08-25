#!/usr/bin/env node
// Standing verification for `src/theme/admin-chip-registers.css` (Task 1 of
// docs/plans/2026-08-24-assets-register.md): renders the three chip registers (quiet, warning,
// outline) against both admin themes and both zebra grounds, and measures chip/ground contrast
// via a 1x1 canvas `getImageData` readback -- `getComputedStyle` alone returns unresolved
// `oklch()`/`color-mix()` strings in this Chromium, not an `rgb()` string a naive regex could
// parse (docs/HISTORY.md's events-probe-settle entry). The composited approach (fill the ground
// color into the canvas first, then fill the target color on top with the canvas 2D context's
// default `source-over` compositing) also correctly resolves the outline register's translucent
// border, which has a real compositing step against the ground unlike the two opaque tinted
// fills.
//
// Standard: every one of the 3 registers x 2 grounds (unstriped `--color-base-100`, the
// `.table-zebra` even row's `--color-base-200`) x 2 themes (cairn-admin, cairn-admin-dark)
// measurements lands inside 1.16-1.47:1, the band `docs/design-benchmark/decisions.md` sets for
// a chip that should recede into its row rather than compete with it. Run with `node
// scripts/verify-chip-registers.mjs`.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CAIRN_ADMIN_CSS = join(
  REPO_ROOT,
  'node_modules/@glw907/cairn-cms/dist/components/cairn-admin.css'
);
const SITE_CSS = join(REPO_ROOT, 'src/theme/admin-chip-registers.css');

const LOW = 1.16;
const HIGH = 1.47;

function statusChip({ wrapperClass, tone, register }) {
  const registerClass = register === 'quiet' ? 'status-chip-quiet' : 'status-chip-bounded';
  return `<span class="${wrapperClass}"><span class="badge badge-outline badge-sm status-chip ${registerClass}"><span class="status status-${tone} status-sm"></span><span class="status-chip-label">Label</span></span></span>`;
}

function buildHtml(theme) {
  const registers = [
    { wrapperClass: 'asc-admin-chip-quiet', tone: 'neutral', register: 'quiet', id: 'quiet' },
    { wrapperClass: 'asc-admin-chip-warning', tone: 'warning', register: 'quiet', id: 'warning' },
    { wrapperClass: 'asc-admin-chip-outline', tone: 'neutral', register: 'bounded', id: 'outline' }
  ];

  const cells = (rowId) =>
    registers
      .map((r) => `<td id="${r.id}-${rowId}">${statusChip(r)}</td>`)
      .join('\n');

  return `<!doctype html>
<html data-theme="${theme}">
<head>
<style>${readFileSync(CAIRN_ADMIN_CSS, 'utf8')}</style>
<style>${readFileSync(SITE_CSS, 'utf8')}</style>
</head>
<body style="margin:0">
  <div id="ground" style="background-color: var(--color-base-100); padding: 1rem;">
    <table class="table table-zebra">
      <tbody>
        <tr id="row-unstriped">${cells('unstriped')}</tr>
        <tr id="row-striped">${cells('striped')}</tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

async function measure(page) {
  return page.evaluate(() => {
    function canvasColor(cssColor, groundCssColor) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // Paint the ground first, then the target color on top: canvas 2D's default
      // `source-over` compositing correctly alpha-blends a translucent target (the outline
      // register's border) the same way the browser paints it over whatever sits behind it.
      // An opaque target (the two tinted fills) simply overwrites the ground pixel, so this
      // one method covers both cases.
      ctx.fillStyle = groundCssColor;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    }

    function relativeLuminance([r, g, b]) {
      const channel = (c) => {
        const cs = c / 255;
        return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
      };
      const [R, G, B] = [channel(r), channel(g), channel(b)];
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }

    function contrast(c1, c2) {
      const L1 = relativeLuminance(c1);
      const L2 = relativeLuminance(c2);
      const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
      return (hi + 0.05) / (lo + 0.05);
    }

    const groundUnstriped = getComputedStyle(document.getElementById('ground')).backgroundColor;
    const groundStriped = getComputedStyle(document.getElementById('row-striped')).backgroundColor;

    const results = [];
    for (const [label, prop] of [
      ['quiet', 'backgroundColor'],
      ['warning', 'backgroundColor'],
      ['outline', 'borderTopColor']
    ]) {
      for (const [stripe, ground] of [
        ['unstriped', groundUnstriped],
        ['striped', groundStriped]
      ]) {
        const chip = document.querySelector(`#${label}-${stripe} .status-chip`);
        const cssVal = getComputedStyle(chip)[prop];
        const chipColor = canvasColor(cssVal, ground);
        const groundColor = canvasColor(ground, ground);
        results.push({ register: label, stripe, contrast: contrast(chipColor, groundColor) });
      }
    }
    return results;
  });
}

const browser = await chromium.launch();
const page = await browser.newPage();

let allPass = true;
const rows = [];

for (const theme of ['cairn-admin', 'cairn-admin-dark']) {
  await page.setContent(buildHtml(theme));
  const results = await measure(page);
  for (const r of results) {
    const pass = r.contrast >= LOW && r.contrast <= HIGH;
    allPass = allPass && pass;
    rows.push({ theme, ...r, pass });
  }
}

await browser.close();

console.log(`Band: ${LOW}-${HIGH}:1\n`);
for (const row of rows) {
  const mark = row.pass ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${row.theme.padEnd(16)} ${row.register.padEnd(8)} ${row.stripe.padEnd(10)} ${row.contrast.toFixed(3)}:1`
  );
}

if (!allPass) {
  console.error('\nOne or more chip/ground contrast measurements fell outside the band.');
  process.exit(1);
}

console.log(`\nAll ${rows.length} measurements inside the band.`);
