#!/usr/bin/env node
/**
 * Build: copies the storefront (public/) and admin (admin/) into dist/ for Workers Static Assets, fills in brand
 * placeholders and cache-busting build IDs, writes security headers, the PWA manifest, and the seed SQL
 * (dist-seed/seed.sql) with auto-generated SKUs.
 *
 * Usage: node scripts/build.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import brand from "../worker/src/brand.json" with { type: "json" };
import { banners, categories, coupons, landingPages, products, zones } from "./seed-data.mjs";

const BUILD_ID = Date.now().toString(36);
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
cpSync("admin", "dist/admin", { recursive: true });

// ---------------------------------------------------------------- brand placeholders
const jsonLdStore = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: brand.name.en,
  alternateName: brand.name.bn,
  description: brand.description.en,
  url: `https://${brand.domain}/`,
  logo: `https://${brand.domain}/img/icon-512.png`,
  image: `https://${brand.domain}/img/og-cover.png`,
  telephone: brand.contact.phone,
  email: brand.contact.email,
  priceRange: "৳৳",
  currenciesAccepted: "BDT",
  paymentAccepted: "Cash on Delivery, bKash, Nagad, Rocket, Card",
  address: { "@type": "PostalAddress", streetAddress: brand.location.address.en, addressLocality: brand.location.city.en, postalCode: brand.location.postcode, addressCountry: "BD" },
  geo: { "@type": "GeoCoordinates", latitude: brand.location.lat, longitude: brand.location.lng },
  areaServed: { "@type": "Country", name: "Bangladesh" },
  openingHours: "Mo-Su 10:00-21:00",
};
const vars = {
  BUILD_ID,
  BRAND_NAME_EN: brand.name.en,
  BRAND_NAME_BN: brand.name.bn,
  TAGLINE_EN: brand.tagline.en,
  TAGLINE_BN: brand.tagline.bn,
  DESCRIPTION_EN: brand.description.en,
  DOMAIN: brand.domain,
  THEME_COLOR: brand.colors.theme,
  PHONE: brand.contact.phone,
  DEFAULT_LANG: brand.defaultLang,
  JSONLD_STORE: JSON.stringify(jsonLdStore).replace(/</g, "\\u003c"),
  CSS_VARS: Object.entries(brand.colors).map(([k, v]) => `--${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`).join(";"),
};
const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(html|js|css|webmanifest)$/.test(f)) writeFileSync(p, fill(readFileSync(p, "utf8")));
  }
}
walk("dist");

// ---------------------------------------------------------------- PWA manifest
writeFileSync(
  "dist/manifest.webmanifest",
  JSON.stringify({
    name: brand.name.en,
    short_name: brand.name.en,
    description: brand.description.en,
    start_url: "/?utm_source=pwa",
    display: "standalone",
    background_color: "#FFFDF7",
    theme_color: brand.colors.theme,
    lang: brand.defaultLang,
    icons: [
      { src: "/img/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  }),
);

// ---------------------------------------------------------------- security & cache headers (static assets)
const csp = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://connect.facebook.net https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms https://static.cloudflareinsights.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://www.facebook.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.clarity.ms https://cloudflareinsights.com",
  "frame-src https://challenges.cloudflare.com https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://sandbox.sslcommerz.com https://securepay.sslcommerz.com",
].join("; ");
writeFileSync(
  "dist/_headers",
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=(self)
  Content-Security-Policy: ${csp}

/admin/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-cache

/js/*
  Cache-Control: public, max-age=31536000, immutable
/css/*
  Cache-Control: public, max-age=31536000, immutable
/img/*
  Cache-Control: public, max-age=604800
/data/*
  Cache-Control: public, max-age=604800
/sw.js
  Cache-Control: no-cache
`,
);

// ---------------------------------------------------------------- seed SQL
const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const lines = ["-- Generated by scripts/build.mjs from scripts/seed-data.mjs. Safe to run once on an empty database."];
const catBySlug = new Map(categories.map((c) => [c.slug, c]));
categories.forEach((c, i) => {
  lines.push(
    `INSERT INTO categories (slug, code, parent_id, name_en, name_bn, description_en, description_bn, color, sort_order) VALUES (${q(c.slug)}, ${q(c.code)}, ${c.parent ? `(SELECT id FROM categories WHERE slug = ${q(c.parent)})` : "NULL"}, ${q(c.en)}, ${q(c.bn)}, ${q(c.descEn)}, ${q(c.descBn)}, ${q(c.color)}, ${i});`,
  );
});
for (const z of zones) {
  lines.push(
    `INSERT INTO delivery_zones (code, name_en, name_bn, fee, free_shipping_min, division_ids, district_ids, upazila_ids, eta_en, eta_bn, is_default, sort_order) VALUES (${q(z.code)}, ${q(z.en)}, ${q(z.bn)}, ${z.fee}, ${q(z.free ?? null)}, ${q(JSON.stringify(z.divisions ?? []))}, ${q(JSON.stringify(z.districts ?? []))}, ${q(JSON.stringify(z.upazilas ?? []))}, ${q(z.etaEn)}, ${q(z.etaBn)}, ${z.isDefault ? 1 : 0}, ${z.sort});`,
  );
}
const seq = {};
const ageCode = (a) => (a ? a.toUpperCase() : "ALL");
for (const p of products) {
  const cat = catBySlug.get(p.cat);
  const code = cat.code;
  const ages = p.ages.length ? `,${p.ages.join(",")},` : "";
  const img = `/img/products/${p.slug}.svg`;
  lines.push(
    `INSERT INTO products (slug, name_en, name_bn, description_en, description_bn, category_id, brand, price, sale_price, discount_type, age_ranges, material_en, material_bn, care_en, care_bn, size_chart, is_consumable, reorder_days, is_gift, tags, images, status, is_featured) VALUES (${q(p.slug)}, ${q(p.en)}, ${q(p.bn)}, ${q(p.descEn)}, ${q(p.descBn)}, (SELECT id FROM categories WHERE slug = ${q(p.cat)}), ${q(p.brand)}, ${p.price}, ${q(p.sale ?? null)}, 'none', ${q(ages)}, ${q(p.materialEn)}, ${q(p.materialBn)}, ${q(p.careEn)}, ${q(p.careBn)}, ${q(p.sizeChart ?? null)}, ${p.consumable ? 1 : 0}, ${q(p.reorder ?? null)}, ${p.gift ? 1 : 0}, ${q([p.cat, p.brand].join(","))}, ${q(JSON.stringify([img]))}, 'active', ${p.featured ? 1 : 0});`,
  );
  p.variants.forEach((v, i) => {
    const age = v.age ?? (p.ages.length === 1 ? p.ages[0] : null);
    seq[code] = (seq[code] ?? 0) + 1;
    const sku = `${brand.skuPrefix}-${code}-${ageCode(age)}-${String(seq[code]).padStart(4, "0")}`;
    lines.push(
      `INSERT INTO product_variants (product_id, sku, size, color, age_range, stock, low_stock_threshold, sort_order) VALUES ((SELECT id FROM products WHERE slug = ${q(p.slug)}), ${q(sku)}, ${q(v.size)}, ${q(v.color ?? "")}, ${q(age)}, ${v.stock}, 3, ${i});`,
    );
    if (v.stock > 0) lines.push(`INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) SELECT product_id, id, sku, stock, stock, 'initial', 'Starter stock (sample)', 'seed' FROM product_variants WHERE sku = ${q(sku)};`);
  });
}
for (const [code, n] of Object.entries(seq)) lines.push(`INSERT INTO counters (name, value) VALUES (${q(`sku:${code}`)}, ${n});`);
for (const b of banners) {
  lines.push(
    `INSERT INTO banners (placement, title_en, title_bn, subtitle_en, subtitle_bn, cta_en, cta_bn, link_url, color, sort_order) VALUES (${q(b.placement)}, ${q(b.titleEn)}, ${q(b.titleBn)}, ${q(b.subEn)}, ${q(b.subBn)}, ${q(b.ctaEn)}, ${q(b.ctaBn)}, ${q(b.link)}, ${q(b.color)}, ${b.sort});`,
  );
}
for (const c of coupons) lines.push(`INSERT INTO coupons (code, description, type, value, min_order, per_customer_limit) VALUES (${q(c.code)}, ${q(c.description)}, ${q(c.type)}, ${c.value}, ${c.min}, ${q(c.perCustomer ?? null)});`);
for (const l of landingPages) {
  lines.push(
    `INSERT INTO landing_pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, offer_en, offer_bn, product_id, color, cta_en, cta_bn) VALUES (${q(l.slug)}, ${q(l.titleEn)}, ${q(l.titleBn)}, ${q(l.subEn)}, ${q(l.subBn)}, ${q(l.offerEn)}, ${q(l.offerBn)}, (SELECT id FROM products WHERE slug = ${q(l.product)}), ${q(l.color)}, 'Order now — Cash on Delivery', 'এখনই অর্ডার করুন — ক্যাশ অন ডেলিভারি');`,
  );
}
mkdirSync("dist-seed", { recursive: true });
writeFileSync("dist-seed/seed.sql", lines.join("\n") + "\n");

if (!existsSync("dist/index.html")) throw new Error("public/index.html is missing");
console.log(`✔ Built dist/ (build ${BUILD_ID}) and dist-seed/seed.sql (${products.length} products, ${Object.values(seq).reduce((a, b) => a + b, 0)} SKUs)`);
