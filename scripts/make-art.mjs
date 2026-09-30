#!/usr/bin/env node
/**
 * Generates the brand logo, favicon and the illustrated placeholder product images (pastel "blob" style) into
 * public/img. Real product photos uploaded in the admin replace these. Optional PNG renders (app icons and the
 * social-share cover) use the pre-installed Chromium through Playwright when available.
 *
 * Usage: node scripts/make-art.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { products } from "./seed-data.mjs";
import brand from "../worker/src/brand.json" with { type: "json" };

const C = brand.colors;
const INK = C.ink;
const PASTEL = { yellow: C.yellow, mint: C.mint, lavender: C.lavender, peach: C.peach, sky: C.sky, pink: C.pink };
const DEEP = { yellow: "#F4C542", mint: "#6CC7A1", lavender: "#A993DE", peach: "#F59F7E", sky: "#7DB9E8", pink: "#EE8FB0" };

const blob = (fill) => `<path d="M400 90c120 0 250 60 290 180s10 250-70 330-230 130-350 90S80 540 90 410s70-230 150-280 100-40 160-40z" fill="${fill}"/>`;
const sparkles = (c) => `<g fill="${c}" opacity=".8"><path d="M140 170l8 22 22 8-22 8-8 22-8-22-22-8 22-8z"/><path d="M660 610l6 16 16 6-16 6-6 16-6-16-16-6 16-6z"/><circle cx="650" cy="190" r="9"/><circle cx="170" cy="620" r="7"/></g>`;
const face = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${INK}"><circle cx="-26" cy="0" r="8"/><circle cx="26" cy="0" r="8"/><path d="M-16 24q16 16 32 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><circle cx="-44" cy="20" r="9" fill="#F7A6B8" opacity=".7"/><circle cx="44" cy="20" r="9" fill="#F7A6B8" opacity=".7"/></g>`;

const ART = {
  romper: (d) => `<path d="M300 230h200l70 60-40 60-40-30v170c0 40-30 60-60 60h-60c-30 0-60-20-60-60V320l-40 30-40-60z" fill="${d}"/><path d="M360 230q40 50 80 0" fill="none" stroke="#fff" stroke-width="12"/><g fill="#fff"><circle cx="400" cy="330" r="10"/><circle cx="400" cy="380" r="10"/><circle cx="400" cy="430" r="10"/></g>`,
  set: (d) => `<rect x="230" y="260" width="180" height="230" rx="40" fill="${d}"/><rect x="430" y="330" width="140" height="190" rx="30" fill="#fff" stroke="${d}" stroke-width="10"/><path d="M270 230q70-80 140 0" fill="${d}" opacity=".6"/><circle cx="500" cy="280" r="40" fill="${d}" opacity=".6"/>`,
  frock: (d) => `<path d="M340 220h120l20 90 110 230H210l110-230z" fill="${d}"/><path d="M320 300h160" stroke="#fff" stroke-width="14"/><g fill="#fff" opacity=".7"><circle cx="330" cy="440" r="14"/><circle cx="400" cy="470" r="14"/><circle cx="470" cy="440" r="14"/></g>`,
  swaddle: (d) => `<path d="M260 260l280-40 60 280-280 60z" fill="${d}"/><path d="M300 300l220-30M320 380l220-30M340 460l220-30" stroke="#fff" stroke-width="10" opacity=".7"/><path d="M470 250l10 26 26 10-26 10-10 26-10-26-26-10 26-10z" fill="#fff"/>`,
  bottle: (d) => `<rect x="330" y="300" width="140" height="260" rx="40" fill="#fff" stroke="${d}" stroke-width="12"/><rect x="330" y="400" width="140" height="160" rx="40" fill="${d}" opacity=".5"/><rect x="340" y="260" width="120" height="50" rx="14" fill="${d}"/><path d="M370 260q30-110 60 0z" fill="#F5D6B8"/><path d="M350 350h40M350 400h40M350 450h40" stroke="${d}" stroke-width="8"/>`,
  bib: (d) => `<path d="M300 250a100 100 0 0 0 200 0h40c0 60-10 120 30 180 20 40 0 110-70 110H300c-70 0-90-70-70-110 40-60 30-120 30-180z" fill="${d}"/><path d="M290 470h220" stroke="#fff" stroke-width="14"/>${face(400, 380, 0.8)}`,
  diaper: (d) => `<path d="M230 290h340c0 150-60 230-170 230S230 440 230 290z" fill="#fff" stroke="${d}" stroke-width="14"/><rect x="230" y="270" width="340" height="40" rx="18" fill="${d}"/><circle cx="330" cy="400" r="16" fill="${d}" opacity=".5"/><circle cx="470" cy="400" r="16" fill="${d}" opacity=".5"/>`,
  wipes: (d) => `<rect x="240" y="300" width="320" height="200" rx="40" fill="${d}"/><rect x="330" y="280" width="140" height="60" rx="20" fill="#fff"/><path d="M360 300q40-60 80 0" fill="#fff"/><path d="M290 440h220" stroke="#fff" stroke-width="12" opacity=".7"/>`,
  clothdiaper: (d) => `<path d="M250 300h300c0 130-60 200-150 200s-150-70-150-200z" fill="${d}"/>`,
  teddy: (d) => `<circle cx="310" cy="250" r="55" fill="${d}"/><circle cx="490" cy="250" r="55" fill="${d}"/><circle cx="400" cy="330" r="120" fill="${d}"/><ellipse cx="400" cy="520" rx="130" ry="100" fill="${d}"/><ellipse cx="400" cy="370" rx="50" ry="36" fill="#fff" opacity=".7"/>${face(400, 320, 1)}<path d="M360 420h80l-40 30z" fill="#F7A6B8"/>`,
  rings: (d) => `<rect x="392" y="200" width="16" height="360" rx="8" fill="#C9A27A"/><rect x="280" y="540" width="240" height="30" rx="15" fill="#C9A27A"/><rect x="300" y="480" width="200" height="56" rx="28" fill="#EE8FB0"/><rect x="315" y="425" width="170" height="54" rx="27" fill="#F59F7E"/><rect x="330" y="372" width="140" height="52" rx="26" fill="#F4C542"/><rect x="345" y="322" width="110" height="50" rx="25" fill="#6CC7A1"/><rect x="360" y="276" width="80" height="46" rx="23" fill="#7DB9E8"/><circle cx="400" cy="240" r="34" fill="${d}"/>`,
  cube: (d) => `<path d="M400 200l180 90v200l-180 90-180-90V290z" fill="${d}"/><path d="M400 380l180-90M400 380v200M400 380L220 290" stroke="#fff" stroke-width="10"/><circle cx="310" cy="420" r="30" fill="#fff"/><circle cx="490" cy="420" r="30" fill="#fff" opacity=".8"/><path d="M380 270h40" stroke="#fff" stroke-width="12" stroke-linecap="round"/>`,
  puzzle: (d) => `<g><rect x="230" y="230" width="160" height="160" rx="18" fill="${d}"/><rect x="410" y="230" width="160" height="160" rx="18" fill="#F4C542"/><rect x="230" y="410" width="160" height="160" rx="18" fill="#EE8FB0"/><rect x="410" y="410" width="160" height="160" rx="18" fill="#7DB9E8"/></g><g font-family="'Baloo Da 2',Arial,sans-serif" font-weight="800" font-size="110" fill="#fff" text-anchor="middle"><text x="310" y="350">অ</text><text x="490" y="350">A</text><text x="310" y="530">আ</text><text x="490" y="530">B</text></g>`,
  net: (d) => `<path d="M220 520q180-420 360 0z" fill="${d}" opacity=".35"/><path d="M220 520q180-420 360 0" fill="none" stroke="${d}" stroke-width="12"/><path d="M280 520q120-300 240 0M340 520q60-220 120 0" fill="none" stroke="${d}" stroke-width="6" opacity=".6"/><rect x="200" y="510" width="400" height="50" rx="25" fill="${d}"/>`,
  bedding: (d) => `<rect x="220" y="330" width="360" height="200" rx="40" fill="${d}"/><rect x="250" y="280" width="140" height="90" rx="40" fill="#fff" stroke="${d}" stroke-width="10"/><g fill="#fff" opacity=".85"><path d="M430 420a30 30 0 0 1 58-6 24 24 0 1 1 6 46h-60a20 20 0 1 1-4-40z"/><path d="M300 470a24 24 0 0 1 46-5 20 20 0 1 1 4 38h-48a16 16 0 1 1-2-33z"/></g>`,
  tub: (d) => `<path d="M200 360h400l-30 150c-8 40-40 60-80 60H310c-40 0-72-20-80-60z" fill="${d}"/><rect x="190" y="340" width="420" height="40" rx="20" fill="#fff" stroke="${d}" stroke-width="10"/><g fill="#fff" opacity=".9"><circle cx="330" cy="300" r="30"/><circle cx="390" cy="260" r="22"/><circle cx="450" cy="300" r="34"/><circle cx="510" cy="270" r="18"/></g>`,
  shampoo: (d) => `<rect x="320" y="270" width="160" height="300" rx="50" fill="${d}"/><rect x="370" y="220" width="60" height="60" rx="12" fill="#fff" stroke="${d}" stroke-width="10"/><path d="M400 220v-40h50" fill="none" stroke="${d}" stroke-width="14" stroke-linecap="round"/><rect x="345" y="370" width="110" height="110" rx="24" fill="#fff"/>${face(400, 415, 0.6)}`,
  towel: (d) => `<path d="M260 320q140-160 280 0v230H260z" fill="${d}"/><ellipse cx="320" cy="210" rx="30" ry="70" fill="${d}"/><ellipse cx="480" cy="210" rx="30" ry="70" fill="${d}"/><ellipse cx="400" cy="360" rx="80" ry="60" fill="#fff" opacity=".85"/>${face(400, 350, 0.7)}`,
  hamper: (d) => `<path d="M230 360h340l-40 200H270z" fill="#E7C08F"/><path d="M250 400h300M260 450h280M270 500h260" stroke="#C9A27A" stroke-width="8"/><path d="M280 360q120-200 240 0" fill="none" stroke="#C9A27A" stroke-width="16"/><circle cx="340" cy="330" r="46" fill="${d}"/><rect x="400" y="290" width="90" height="80" rx="16" fill="#6CC7A1"/><circle cx="470" cy="300" r="26" fill="#F4C542"/>`,
  giftbox: (d) => `<rect x="250" y="340" width="300" height="220" rx="20" fill="${d}"/><rect x="230" y="300" width="340" height="70" rx="18" fill="${d}"/><rect x="385" y="300" width="30" height="260" fill="#EE8FB0"/><path d="M400 300c-80-90-150-20-60 0M400 300c80-90 150-20 60 0" fill="none" stroke="#EE8FB0" stroke-width="16"/><text x="400" y="480" font-family="'Baloo Da 2',Arial,sans-serif" font-size="90" font-weight="800" fill="#fff" text-anchor="middle">1</text>`,
};

export function productSvg(art, color) {
  const bg = PASTEL[color] ?? C.yellow;
  const deep = DEEP[color] ?? DEEP.yellow;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img"><rect width="800" height="800" fill="#FFFDF7"/>${blob(bg)}${sparkles(deep)}${(ART[art] ?? ART.giftbox)(deep)}</svg>`;
}

/** Logo concept: a soft yellow bubble with a smiling star "Z" — friendly, trustworthy, not childish. */
export function logoSvg(size = 512) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}"><rect width="512" height="512" rx="128" fill="${C.yellow}"/><path d="M256 56c96 0 176 44 196 140s-20 200-100 240-190 30-250-30S30 270 70 170 160 56 256 56z" fill="#FFF6D6"/><path d="M168 176h176l-150 176h160" fill="none" stroke="${C.primary}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/><circle cx="384" cy="148" r="22" fill="${DEEP.pink}"/><circle cx="130" cy="380" r="14" fill="${DEEP.mint}"/></svg>`;
}

function ogCover() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630"><rect width="1200" height="630" fill="#FFFDF7"/><circle cx="1040" cy="120" r="220" fill="${C.mint}"/><circle cx="140" cy="560" r="200" fill="${C.lavender}"/><circle cx="980" cy="560" r="120" fill="${C.peach}"/><g transform="translate(90 150) scale(.5)">${logoSvg().replace(/<\/?svg[^>]*>/g, "")}</g><text x="380" y="270" font-family="'Baloo Da 2',Arial,sans-serif" font-size="92" font-weight="800" fill="${INK}">${brand.name.en}</text><text x="380" y="350" font-family="'Baloo Da 2',Arial,sans-serif" font-size="44" fill="${INK}" opacity=".8">${brand.tagline.en}</text><text x="380" y="420" font-family="Arial,sans-serif" font-size="30" fill="${C.primary}" font-weight="700">Baby &amp; kids · 0–5 years · Cash on Delivery</text></svg>`;
}

mkdirSync("public/img/products", { recursive: true });
for (const p of products) if (!p.images) writeFileSync(`public/img/products/${p.slug}.svg`, productSvg(p.art, p.color)); // ride-ons use rendered photos
writeFileSync("public/img/logo.svg", logoSvg());
writeFileSync("public/img/og-cover.svg", ogCover());
writeFileSync("admin/icon.svg", logoSvg());
console.log(`✔ ${products.length} product images, logo, og cover`);

// Optional PNG renders (PWA icons, social cover) with the pre-installed Chromium.
try {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const shot = async (svg, w, h, out) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0">${svg.replace(/<svg /, `<svg width="${w}" height="${h}" `)}</body></html>`);
    await page.screenshot({ path: out, omitBackground: true });
  };
  await shot(logoSvg(), 192, 192, "public/img/icon-192.png");
  await shot(logoSvg(), 512, 512, "public/img/icon-512.png");
  await shot(ogCover(), 1200, 630, "public/img/og-cover.png");
  await browser.close();
  console.log("✔ PNG icons and og-cover.png rendered");
} catch (e) {
  console.warn("⚠ PNG render skipped:", String(e).split("\n")[0]);
}
