#!/usr/bin/env node
// Standing verification for `src/theme/admin-chip-registers.css` (Task 1 of
// docs/plans/2026-08-24-assets-register.md): renders the three chip registers (quiet, warning,
// outline) against both admin themes and both zebra grounds, and measures contrast via a 1x1
// canvas `getImageData` readback -- `getComputedStyle` alone returns unresolved
// `oklch()`/`color-mix()` strings in this Chromium, not an `rgb()` string a naive regex could
// parse (docs/HISTORY.md's events-probe-settle entry). The composited approach (fill the ground
// color into the canvas first, then fill the target color on top with the canvas 2D context's
// default `source-over` compositing) also correctly resolves the outline register's translucent
// border, which has a real compositing step against the ground unlike the two opaque tinted
// fills.
//
// This file is read as plain source text (not through Vite/SvelteKit's own resolution): it is a
// plain CSS file with no `$theme` alias, no PostCSS/Tailwind `@source` processing, and no
// `color-mix()`/custom-property transform, so reading the file directly reproduces exactly what
// a consuming page's own `<link>`/bundled stylesheet would resolve to. The one piece this harness
// pulls from elsewhere is `StatusChip`'s own scoped `<style>` block, extracted from the package's
// shipped `.svelte` source below, so the measured cascade includes StatusChip's own declarations
// (notably `.status-chip-bounded { background-color: transparent }`) and not just this site's
// overrides layered on top of nothing.
//
// Two standards, two register families:
//   - TINTED (quiet, warning): every one of the 3 registers x 2 grounds (unstriped
//     `--color-base-100`, the `.table-zebra` even row's `--color-base-200`) x 2 themes
//     (cairn-admin, cairn-admin-dark) chip/ground measurements lands inside 1.16-1.47:1, the band
//     `docs/design-benchmark/decisions.md` sets for a chip that should recede into its row rather
//     than compete with it. (This band applies to quiet and warning only; outline is excluded
//     from it below since it carries no fill to measure a ground-contrast ratio against.)
//   - OUTLINE: no ground-contrast band applies. Instead the border's own composited color must
//     measure >= 3:1 against the row ground (both themes, both stripes), matching StatusChip's
//     own `bounded` register and the events page's Hidden chip.
//   - WARNING INK: because the warning and quiet tinted grounds are luminance-identical in dark
//     theme (the 40%/10% percentage asymmetry needed to land both in the recede-into-the-row band
//     also makes them indistinguishable from each other there), the warning register's ink must
//     itself measure >= 4.5:1 against its own chip ground (both themes, both stripes, though the
//     chip's own background is a fixed literal color so the two stripes read identically today --
//     the per-stripe measurement stands so a future change that makes it stripe-dependent stays
//     covered), and must differ from the quiet register's own (unstyled, default) ink -- a simple
//     channel-delta check, so a
//     regression back to identical inks fails loudly instead of only showing up as a hue that
//     happens to read fine in isolation.
//
// Run with `node scripts/verify-chip-registers.mjs`.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CAIRN_ADMIN_CSS = join(
  REPO_ROOT,
  'node_modules/@glw907/cairn-cms/dist/components/cairn-admin.css'
);
const STATUS_CHIP_SVELTE = join(
  REPO_ROOT,
  'node_modules/@glw907/cairn-cms/dist/admin-toolkit/StatusChip.svelte'
);
const SITE_CSS = join(REPO_ROOT, 'src/theme/admin-chip-registers.css');

const GROUND_LOW = 1.16;
const GROUND_HIGH = 1.47;
const BORDER_FLOOR = 3;
const INK_FLOOR = 4.5;

// Extract StatusChip's own scoped `<style>` block so the measured cascade includes its
// declarations (e.g. `.status-chip-bounded { background-color: transparent }`), not just this
// site's overrides layered on top of an incomplete page.
function statusChipScopedCss() {
  const source = readFileSync(STATUS_CHIP_SVELTE, 'utf8');
  const match = source.match(/<style>([\s\S]*?)<\/style>/);
  if (!match) {
    throw new Error('Could not find a <style> block in StatusChip.svelte');
  }
  return match[1];
}

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
    registers.map((r) => `<td id="${r.id}-${rowId}">${statusChip(r)}</td>`).join('\n');

  return `<!doctype html>
<html data-theme="${theme}">
<head>
<style>${readFileSync(CAIRN_ADMIN_CSS, 'utf8')}</style>
<style>${statusChipScopedCss()}</style>
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
      // An opaque target (the tinted fills and the inks) simply overwrites the ground pixel, so
      // this one method covers all cases.
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

    const groundResults = [];
    for (const [label, prop] of [
      ['quiet', 'backgroundColor'],
      ['warning', 'backgroundColor']
    ]) {
      for (const [stripe, ground] of [
        ['unstriped', groundUnstriped],
        ['striped', groundStriped]
      ]) {
        const chip = document.querySelector(`#${label}-${stripe} .status-chip`);
        const cssVal = getComputedStyle(chip)[prop];
        const chipColor = canvasColor(cssVal, ground);
        const groundColor = canvasColor(ground, ground);
        groundResults.push({ register: label, stripe, contrast: contrast(chipColor, groundColor) });
      }
    }

    const borderResults = [];
    for (const [stripe, ground] of [
      ['unstriped', groundUnstriped],
      ['striped', groundStriped]
    ]) {
      const chip = document.querySelector(`#outline-${stripe} .status-chip`);
      const cssVal = getComputedStyle(chip).borderTopColor;
      const borderColor = canvasColor(cssVal, ground);
      const groundColor = canvasColor(ground, ground);
      borderResults.push({ stripe, contrast: contrast(borderColor, groundColor) });
    }

    const inkResults = [];
    const inkColorsByStripe = { quiet: {}, warning: {} };
    for (const label of ['quiet', 'warning']) {
      for (const stripe of ['unstriped', 'striped']) {
        const chip = document.querySelector(`#${label}-${stripe} .status-chip`);
        // Composite against the chip's own resolved ground (not the page ground): the
        // register's tinted fill, not the row underneath it, is what the ink actually sits on.
        const chipGroundCss = getComputedStyle(chip).backgroundColor;
        const inkCss = getComputedStyle(chip).color;
        const chipGround = canvasColor(chipGroundCss, chipGroundCss);
        const ink = canvasColor(inkCss, chipGroundCss);
        inkColorsByStripe[label][stripe] = ink;
        if (label === 'warning') {
          inkResults.push({ stripe, contrast: contrast(ink, chipGround) });
        }
      }
    }

    // Compare the two registers' unstriped ink (their fixed literal background-color override
    // does not vary by stripe, so either stripe would give the same delta): the point of this
    // check is that the two registers no longer share one ink, not how it varies across rows.
    const inkColors = { quiet: inkColorsByStripe.quiet.unstriped, warning: inkColorsByStripe.warning.unstriped };
    const inkDelta = inkColors.quiet.reduce(
      (sum, channel, i) => sum + Math.abs(channel - inkColors.warning[i]),
      0
    );

    return { groundResults, borderResults, inkResults, inkDelta, inkColors };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage();

let allPass = true;
const groundRows = [];
const borderRows = [];
const inkRows = [];
let inkDeltaRow = null;

for (const theme of ['cairn-admin', 'cairn-admin-dark']) {
  await page.setContent(buildHtml(theme));
  const { groundResults, borderResults, inkResults, inkDelta, inkColors } = await measure(page);

  for (const r of groundResults) {
    const pass = r.contrast >= GROUND_LOW && r.contrast <= GROUND_HIGH;
    allPass = allPass && pass;
    groundRows.push({ theme, ...r, pass });
  }

  for (const r of borderResults) {
    const pass = r.contrast >= BORDER_FLOOR;
    allPass = allPass && pass;
    borderRows.push({ theme, ...r, pass });
  }

  for (const r of inkResults) {
    const pass = r.contrast >= INK_FLOOR;
    allPass = allPass && pass;
    inkRows.push({ theme, ...r, pass });
  }

  const inkDiffers = inkDelta > 0;
  allPass = allPass && inkDiffers;
  inkDeltaRow = {
    theme,
    quiet: inkColors.quiet,
    warning: inkColors.warning,
    delta: inkDelta,
    pass: inkDiffers
  };
  // Print per-theme so both themes' ink-differs assertions show up, not just the last one.
  console.log(
    `${inkDiffers ? 'PASS' : 'FAIL'}  ${theme.padEnd(16)} ink-differs   quiet=rgb(${inkColors.quiet.join(',')}) warning=rgb(${inkColors.warning.join(',')}) delta=${inkDelta}`
  );
}

await browser.close();

console.log(`\nGround band (quiet, warning): ${GROUND_LOW}-${GROUND_HIGH}:1\n`);
for (const row of groundRows) {
  const mark = row.pass ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${row.theme.padEnd(16)} ${row.register.padEnd(8)} ${row.stripe.padEnd(10)} ${row.contrast.toFixed(3)}:1`
  );
}

console.log(`\nBorder floor (outline): >= ${BORDER_FLOOR}:1\n`);
for (const row of borderRows) {
  const mark = row.pass ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${row.theme.padEnd(16)} outline  ${row.stripe.padEnd(10)} ${row.contrast.toFixed(3)}:1`
  );
}

console.log(`\nInk floor (warning, vs its own chip ground): >= ${INK_FLOOR}:1\n`);
for (const row of inkRows) {
  const mark = row.pass ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${row.theme.padEnd(16)} warning ink ${row.stripe.padEnd(10)} ${row.contrast.toFixed(3)}:1`
  );
}

const totalMeasurements = groundRows.length + borderRows.length + inkRows.length + 2;

if (!allPass) {
  console.error('\nOne or more chip register measurements failed its standard.');
  process.exit(1);
}

console.log(`\nAll ${totalMeasurements} measurements passed their respective standard.`);
