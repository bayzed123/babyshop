// Reusable storefront pieces: product cards, rating stars, age chips, size chart, loading/empty/error states.
import { t, L, money, num, lang, tt } from "./i18n.js";
import { html, raw, icon, wishlist, toast, overlay, cart } from "./core.js";
import { track } from "./track.js";

export const AGE_LABELS = {
  "0-6m": { en: "0–6 months", bn: "০–৬ মাস" },
  "6-12m": { en: "6–12 months", bn: "৬–১২ মাস" },
  "1-3y": { en: "1–3 years", bn: "১–৩ বছর" },
  "3-5y": { en: "3–5 years", bn: "৩–৫ বছর" },
};
export const AGE_COLORS = { "0-6m": "peach", "6-12m": "mint", "1-3y": "lavender", "3-5y": "yellow" };
export const ageLabel = (a) => (AGE_LABELS[a] ? tt(AGE_LABELS[a]) : t("allAges"));

export const stars = (n, size = "sm") =>
  raw(`<span class="stars ${size}" aria-label="${Number(n).toFixed(1)} / 5">${[1, 2, 3, 4, 5].map((i) => `<svg class="icon ${i <= Math.round(n) ? "on" : ""}" aria-hidden="true"><use href="#i-star"/></svg>`).join("")}</span>`);

export const ageChips = (ages) => html`<span class="age-chips">${(ages ?? []).map((a) => html`<span class="chip ${AGE_COLORS[a] ?? ""}">${ageLabel(a)}</span>`)}</span>`;

export function productCard(p) {
  const saved = wishlist.ids().has(p.id);
  const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
  return html`<article class="card product-card">
    <a class="thumb" href="/product/${p.slug}" aria-label="${L(p, "name")}">
      <img src="${p.images?.[0] ?? "/img/logo.svg"}" alt="" loading="lazy" width="400" height="400">
      ${p.discount_percent ? html`<span class="tag sale">-${num(p.discount_percent)}%</span>` : ""}
      ${!p.in_stock ? html`<span class="tag soldout">${t("outOfStock")}</span>` : ""}
      ${p.delivery_mode === "free" ? html`<span class="tag free-ship">${icon("truck")} ${t("freeDelivery")}</span>` : ""}
    </a>
    <button class="wish ${saved ? "on" : ""}" type="button" data-wish="${p.id}" aria-pressed="${saved}" aria-label="${t("wishlist")}">${icon("heart")}</button>
    <div class="body">
      ${ageChips(p.age_ranges)}
      <h3><a href="/product/${p.slug}">${L(p, "name")}</a></h3>
      ${p.rating_count ? html`<div class="rating">${stars(p.rating_avg)} <span class="muted small">(${num(p.rating_count)})</span></div>` : ""}
      <div class="price-row"><b class="price">${money(price)}</b>${price < p.price ? html`<s class="muted">${money(p.price)}</s>` : ""}</div>
    </div>
  </article>`;
}

export const productGrid = (items) => html`<div class="grid products">${items.map(productCard)}</div>`;
export const skeletonGrid = (n = 8) => raw(`<div class="grid products">${Array.from({ length: n }, () => '<div class="card skel-card"><div class="skel sq"></div><div class="skel line"></div><div class="skel line short"></div></div>').join("")}</div>`);
export const emptyState = (title, sub = "", action = "") => html`<div class="state"><div class="blob-icon">${icon("search")}</div><h3>${title}</h3>${sub ? html`<p class="muted">${sub}</p>` : ""}${action}</div>`;
export const errorState = (msg) => html`<div class="state"><p class="error-box">${msg}</p><button class="btn" type="button" data-retry>${t("retry")}</button></div>`;

/** Wires wishlist hearts inside a container (event delegation). */
export function bindCards(root) {
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-wish]");
    if (!b) return;
    e.preventDefault();
    const on = await wishlist.toggle(Number(b.dataset.wish));
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

/** Adds a variant to the cart and fires AddToCart (Pixel + Conversions API relay + GA4). */
export function addToCart(product, variant, qty = 1) {
  const unitPrice = variant.price_override ?? (product.sale_price && product.sale_price < product.price ? product.sale_price : product.price);
  cart.add({ variantId: variant.id, productId: product.id, slug: product.slug, sku: variant.sku, name_en: product.name_en, name_bn: product.name_bn, size: variant.size, color: variant.color, image: product.images?.[0], unitPrice }, qty);
  track("AddToCart", { value: unitPrice * qty, items: [{ sku: variant.sku, name: product.name_en, price: unitPrice, quantity: qty }] });
  toast(t("added"));
}

// ---------- Size / growth chart (ADJUSTABLE: typical Bangladeshi baby-clothing sizes) ----------
const CLOTHING_CHART = [
  ["0–3 M", "3–6 kg", "50–62 cm", "0-6m"],
  ["3–6 M", "6–8 kg", "62–68 cm", "0-6m"],
  ["6–9 M", "8–9 kg", "68–74 cm", "6-12m"],
  ["9–12 M", "9–10 kg", "74–80 cm", "6-12m"],
  ["12–18 M", "10–11 kg", "80–86 cm", "1-3y"],
  ["1–2 Y", "11–12.5 kg", "86–92 cm", "1-3y"],
  ["2–3 Y", "12.5–14 kg", "92–98 cm", "1-3y"],
  ["3–4 Y", "14–16 kg", "98–104 cm", "3-5y"],
  ["4–5 Y", "16–18 kg", "104–110 cm", "3-5y"],
];
export const sizeChartTable = () => html`<table class="table size-table">
  <thead><tr><th>${t("size")}</th><th>${lang() === "bn" ? "ওজন" : "Weight"}</th><th>${lang() === "bn" ? "উচ্চতা" : "Height"}</th><th>${t("ageRange")}</th></tr></thead>
  <tbody>${CLOTHING_CHART.map(([s, w, h, a]) => html`<tr><td><b>${s}</b></td><td>${w}</td><td>${h}</td><td>${ageLabel(a)}</td></tr>`)}</tbody></table>
  <p class="small muted">${lang() === "bn" ? "দুই সাইজের মাঝামাঝি হলে বড়টি নিন — সোনামণিরা দ্রুত বড় হয়!" : "Between sizes? Go one up — little ones grow fast!"}</p>`;
export const openSizeChart = () => overlay("modal", { title: t("sizeChart"), body: sizeChartTable() });

export const STATUS_STEPS = ["pending", "confirmed", "packed", "shipped", "delivered"];
