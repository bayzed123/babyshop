// Public gift registry: relatives see what's wanted and already bought, and gift an item in one tap.
// The parents' address is never shown — it's used on the server at checkout.
import { t, L, lang, money, num, date } from "../i18n.js";
import { $$, api, html, icon, errMsg, cart, toast } from "../core.js";
import { emptyState } from "../ui.js";

export default async function registry(el, { params, navigate }) {
  let d;
  try {
    d = await api(`/registries/${params.slug}`);
  } catch (e) {
    el.innerHTML = String(html`<div class="container section">${emptyState(e.status === 404 ? t("notFound") : errMsg(e))}</div>`);
    return;
  }
  const r = d.registry;
  el.innerHTML = String(html`<div class="container section">
    <div class="registry-hero">
      <span class="eyebrow">${icon("gift")} ${t(`event_${r.event_type}`)}${r.event_date ? ` · ${date(r.event_date)}` : ""}</span>
      <h1>${r.title}</h1>
      <p>${r.message ?? (lang() === "bn" ? `${r.owner_name} এর পছন্দের তালিকা থেকে উপহার বেছে নিন।` : `Choose a gift from ${r.owner_name}'s list.`)}</p>
      ${r.ships_to_parent ? html`<p class="small">${icon("truck")} ${t("registryShipNote")}</p>` : ""}
    </div>
    ${r.status !== "active" ? html`<p class="note-card">${t("registryClosed")}</p>` : ""}
    ${d.items.length ? html`<div class="grid products">${d.items.map((i) => {
      const done = i.quantity_purchased >= i.quantity_wanted;
      const price = i.price_override ?? (i.sale_price && i.sale_price < i.price ? i.sale_price : i.price);
      const variantId = i.variant_id && i.stock > 0 ? i.variant_id : i.any_variant_id;
      return html`<article class="card product-card ${done ? "done" : ""}">
        <a class="thumb" href="/product/${i.slug}"><img src="${i.images[0]}" alt="" loading="lazy" width="400" height="400">${done ? html`<span class="tag ok">${t("fulfilled")}</span>` : ""}</a>
        <div class="body"><h3><a href="/product/${i.slug}">${L(i, "name")}</a></h3>
          ${i.size && i.size !== "Standard" ? html`<p class="small muted">${i.size}${i.color ? ` · ${i.color}` : ""}</p>` : ""}
          <p class="small">${t("wanted")}: <b>${num(i.quantity_wanted)}</b> · ${t("bought")}: <b>${num(i.quantity_purchased)}</b></p>
          <div class="price-row"><b class="price">${money(price)}</b></div>
          ${!done && r.status === "active" && variantId ? html`<button class="btn primary block" type="button" data-gift="${variantId}" data-name-en="${i.name_en}" data-name-bn="${i.name_bn}" data-img="${i.images[0]}" data-price="${price}" data-slug="${i.slug}" data-pid="${i.product_id}">${icon("gift")} ${t("giftThis")}</button>` : ""}
        </div></article>`;
    })}</div>` : emptyState(t("registryEmpty"))}
  </div>`);
  $$("[data-gift]", el).forEach((b) => b.addEventListener("click", () => {
    cart.clear();
    cart.add({ variantId: Number(b.dataset.gift), productId: Number(b.dataset.pid), slug: b.dataset.slug, name_en: b.dataset.nameEn, name_bn: b.dataset.nameBn, size: "Standard", color: "", image: b.dataset.img, unitPrice: Number(b.dataset.price) }, 1);
    toast(t("added"));
    navigate(`/checkout?registry=${encodeURIComponent(r.slug)}`);
  }));
}
