// Products: list with stock health, certification and "waiting" counts, CSV import/export, and the editor with
// photos, bilingual copy, age ranges, size variants with automatic SKUs (BBY-[Cat]-[Age]-[Seq]) and safety
// certifications. Hard rule: a certification badge can't be switched on until its document is attached.
import { t, num, money, lang, tt } from "../i18n.js";
import { html, raw, icon, api, $, $$, can, toast, msg, errMsg, listTable, slideOver, pill, confirmDialog, debounce, showErrors, uploadImage, uploadDoc, exportCsv } from "../core.js";
import { categoryOptions } from "../resources.js";

const L = (en, bn) => (lang() === "bn" ? bn : en);
const AGES = [["0-6m", "0–6 months", "০–৬ মাস"], ["6-12m", "6–12 months", "৬–১২ মাস"], ["1-3y", "1–3 years", "১–৩ বছর"], ["3-5y", "3–5 years", "৩–৫ বছর"]];
export const CERT_LABELS = {
  bpa_free: { en: "BPA-free", bn: "বিপিএ-মুক্ত" },
  safety_tested: { en: "Safety tested", bn: "নিরাপত্তা পরীক্ষিত" },
  age_appropriate: { en: "Age-appropriate", bn: "বয়স উপযোগী" },
  non_toxic: { en: "Non-toxic", bn: "বিষমুক্ত" },
  organic_cotton: { en: "Organic cotton", bn: "অর্গানিক সুতি" },
  dermatologically_tested: { en: "Dermatologically tested", bn: "চর্মরোগ বিশেষজ্ঞ পরীক্ষিত" },
  bsti: { en: "BSTI certified", bn: "বিএসটিআই সনদপ্রাপ্ত" },
  ce: { en: "CE marked", bn: "CE চিহ্নিত" },
  en71: { en: "EN 71 (toy safety)", bn: "EN 71 (খেলনা নিরাপত্তা)" },
  astm_f963: { en: "ASTM F963 (toy safety)", bn: "ASTM F963 (খেলনা নিরাপত্তা)" },
  oeko_tex: { en: "OEKO-TEX", bn: "OEKO-TEX" },
};

export default async function products(view, { id, query }) {
  const state = { q: query.get("q") ?? "", status: "", category_id: "", age: "", stock: query.get("stock") ?? "", waiting: "", sort: "newest", page: 1, trash: "" };
  const cats = await categoryOptions().catch(() => []);
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("products")}</h1>
      <button class="btn" id="export">${icon("download")} ${t("exportCsv")}</button>
      ${can("products.write") ? html`<label class="btn">${icon("upload")} ${t("importCsv")}<input type="file" accept=".csv,text/csv" id="import" hidden></label><a class="btn primary" href="#/products/new">${icon("plus")} ${t("add")}</a>` : ""}</div>
    <div class="card">
      <div class="toolbar">
        <input class="input" id="pq" type="search" value="${state.q}" placeholder="${L("Name, SKU, brand, tag…", "নাম, SKU, ব্র্যান্ড, ট্যাগ…")}" aria-label="${t("searchPlaceholder")}">
        <select class="input" id="pcat" aria-label="${t("categories")}"><option value="">${t("categories")}: ${t("all")}</option>${cats.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
        <select class="input" id="page" aria-label="${t("ageRanges")}"><option value="">${L("Age", "বয়স")}: ${t("all")}</option>${AGES.map(([v, en, bn]) => html`<option value="${v}">${L(en, bn)}</option>`)}</select>
        <select class="input" id="pstatus" aria-label="${t("status")}"><option value="">${t("status")}: ${t("all")}</option><option value="active">${L("Active", "চালু")}</option><option value="draft">${L("Draft", "ড্রাফট")}</option><option value="archived">${L("Archived", "আর্কাইভ")}</option></select>
        <select class="input" id="pstock" aria-label="Stock"><option value="">${L("Stock", "স্টক")}: ${t("all")}</option><option value="low" ${state.stock === "low" ? raw("selected") : ""}>${t("lowOnly")}</option><option value="out" ${state.stock === "out" ? raw("selected") : ""}>${t("outOnly")}</option></select>
        <select class="input" id="psort" aria-label="Sort"><option value="newest">${L("Newest", "নতুন")}</option><option value="name">A–Z</option><option value="sold">${L("Best selling", "বেশি বিক্রি")}</option><option value="stock">${L("Lowest stock", "কম স্টক")}</option><option value="price_asc">${L("Price", "দাম")} ↑</option><option value="price_desc">${L("Price", "দাম")} ↓</option></select>
        <button class="chip" id="pwait" aria-pressed="false">🔔 ${t("waiting")}</button>
        ${can("products.delete") ? html`<button class="chip" id="ptrash" aria-pressed="false">${icon("trash")} ${t("trash")}</button>` : ""}
      </div>
      <div id="list"></div>
    </div>`);

  let rows = [];
  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Photo", bn: "ছবি" }, render: (p) => (p.image ? html`<img class="thumb" src="${p.image}" alt="" loading="lazy">` : "—") },
      { label: { en: "Product", bn: "পণ্য" }, render: (p) => html`<b>${lang() === "bn" ? p.name_bn : p.name_en}</b>${p.is_featured ? " ★" : ""}${p.is_gift ? " 🎁" : ""}<br><span class="muted small">${(p.skus ?? "").split(" ").slice(0, 2).join(" ")}${p.variant_count > 2 ? " …" : ""} · ${lang() === "bn" ? p.category_name_bn ?? "" : p.category_name ?? ""}</span>${p.age_ranges.length ? html`<br><span class="muted small">${p.age_ranges.join(" · ")}</span>` : ""}` },
      { label: { en: "Price", bn: "দাম" }, render: (p) => html`<b>${money(p.sale_price ?? p.price)}</b>${p.sale_price ? html` <s class="muted small">${money(p.price)}</s>` : ""}${p.delivery_mode === "free" ? html`<br><span class="small" style="color:#11704B">🚚 ${L("Free delivery", "ফ্রি ডেলিভারি")}</span>` : ""}` },
      { label: { en: "Stock", bn: "স্টক" }, render: (p) => html`${p.stock <= 0 ? pill("cancelled", L("Out", "শেষ")) : p.low_variants ? pill("pending", `${num(p.stock)} · ${num(p.low_variants)} ${L("low", "কম")}`) : pill("active", num(p.stock))}${p.waiting ? html`<br><span class="small">🔔 ${num(p.waiting)} ${t("waiting")}</span>` : ""}` },
      { label: { en: "Badges", bn: "ব্যাজ" }, render: (p) => (p.cert_count ? html`<span title="${t("docAttached")}">🛡 ${num(p.cert_count)}</span>` : html`<span class="muted">—</span>`) },
      { label: { en: "Sold", bn: "বিক্রি" }, render: (p) => num(p.sold_count) },
      { label: { en: "Status", bn: "অবস্থা" }, render: (p) => pill(p.status) },
    ],
    rowAttrs: (p) => `class="clickable" data-open="${p.id}"`,
    actions: (p) => (state.trash
      ? html`<button class="btn sm" data-restore="${p.id}">${icon("restore")} ${t("restore")}</button>${can("trash.purge") ? html` <button class="btn sm" data-purge="${p.id}">${t("deleteForever")}</button>` : ""}`
      : html`${can("products.write") ? html`<button class="btn sm" data-dup="${p.id}" aria-label="${t("duplicate")}" title="${t("duplicate")}">${icon("copy")}</button> ` : ""}<a class="btn sm" href="/product/${p.slug}" target="_blank" rel="noopener" aria-label="${t("viewShop")}" title="${t("viewShop")}">${icon("external")}</a> ${can("products.delete") ? html`<button class="btn sm" data-del="${p.id}" aria-label="${t("delete")}">${icon("trash")}</button>` : ""}`),
  });
  const qs = (extra = {}) => new URLSearchParams(Object.entries({ ...state, ...extra }).filter(([, v]) => v !== ""));
  async function load() {
    table.loading();
    try { const res = await api(`/products?${qs({ limit: "20" })}`); rows = res.items; table.render(res, { onPage: (p) => { state.page = p; load(); } }); }
    catch (e) { table.error(e, load); }
  }
  view.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-del],[data-dup],[data-restore],[data-purge],[data-open]");
    if (!el || e.target.closest("a")) return;
    e.stopPropagation();
    const row = rows.find((r) => r.id === Number(el.dataset.del ?? el.dataset.dup ?? el.dataset.restore ?? el.dataset.purge ?? el.dataset.open));
    if (!row) return;
    try {
      if (el.dataset.del) { if (!(await confirmDialog(t("confirmDelete", { name: row.name_en })))) return; toast(msg(await api(`/products/${row.id}`, { method: "DELETE" }))); return load(); }
      if (el.dataset.dup) { const r = await api(`/products/${row.id}/duplicate`, { method: "POST" }); toast(msg(r)); location.hash = `#/products/${r.id}`; return; }
      if (el.dataset.restore) { toast(msg(await api(`/products/${row.id}/restore`, { method: "POST" }))); return load(); }
      if (el.dataset.purge) { if (!(await confirmDialog(t("confirmPurge", { name: row.name_en })))) return; toast(msg(await api(`/products/${row.id}?purge=1`, { method: "DELETE" }))); return load(); }
      if (el.dataset.open && !state.trash) location.hash = `#/products/${row.id}`;
    } catch (err) { toast(errMsg(err), "err"); }
  });
  $("#pq", view).addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  for (const [sel, key] of [["#pcat", "category_id"], ["#page", "age"], ["#pstatus", "status"], ["#pstock", "stock"], ["#psort", "sort"]]) $(sel, view).onchange = (e) => { state[key] = e.target.value; state.page = 1; load(); };
  $("#pwait", view).onclick = (e) => { state.waiting = state.waiting ? "" : "1"; e.currentTarget.setAttribute("aria-pressed", String(Boolean(state.waiting))); load(); };
  $("#ptrash", view)?.addEventListener("click", (e) => { state.trash = state.trash ? "" : "1"; e.currentTarget.setAttribute("aria-pressed", String(Boolean(state.trash))); load(); });
  $("#export", view).onclick = async () => { try { await exportCsv(`/products?${qs()}`, "products"); } catch (err) { toast(errMsg(err), "err"); } };
  $("#import", view)?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!(await confirmDialog(`${t("importCsv")}: ${file.name} — ${L("One row per option (SKU). Rows with the same slug become one product. Blank SKUs are created automatically. Certifications are never imported — attach each document in the product form.", "প্রতিটি অপশনের (SKU) জন্য একটি সারি। একই slug এর সারিগুলো এক পণ্য হবে। খালি SKU অটো তৈরি হবে। সার্টিফিকেট ইমপোর্ট হয় না — পণ্যের ফর্মে ডকুমেন্ট যুক্ত করুন।")}`, { danger: false }))) return;
    try {
      const r = await api("/products/import", { method: "POST", raw: await file.text(), headers: { "content-type": "text/csv" } });
      toast(msg(r));
      for (const x of r.results.filter((x) => !x.ok).slice(0, 5)) toast(`${x.slug}: ${x.error}`, "err");
      load();
    } catch (err) { toast(errMsg(err), "err"); }
    e.target.value = "";
  });

  await load();
  if (id && view.isConnected) editor(id === "new" ? null : Number(id), cats, load);
}

const blankVariant = () => ({ sku: "", size: "Standard", color: "", age_range: "", stock: 0, price_override: null, low_stock_threshold: 3 });
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const offerOf = (p) => (p.discount_type && p.discount_type !== "none" ? p.discount_type : p.sale_price ? "manual" : "none");

async function editor(id, cats, reload) {
  let p = { status: "draft", images: [], variants: [blankVariant()], certifications: [], age_ranges: [], tags: "", is_featured: 0, is_gift: 0, is_consumable: 0, discount_type: "none", discount_value: 0 };
  if (id) { try { p = (await api(`/products/${id}`)).item; } catch (e) { return toast(errMsg(e), "err"); } }
  const images = [...p.images];
  const variants = p.variants.map((v) => ({ ...v }));
  const certs = p.certifications.map((c) => ({ ...c }));
  const ro = !can("products.write");
  const F = (name, label, attrs = "", tag = "input", span = false) =>
    tag === "textarea"
      ? html`<label class="field" style="grid-column:1/-1"><span>${label}</span><textarea class="input" name="${name}" rows="4" ${raw(attrs)}>${p[name] ?? ""}</textarea></label>`
      : html`<label class="field" ${span ? raw('style="grid-column:1/-1"') : ""}><span>${label}</span><input class="input" name="${name}" value="${p[name] ?? ""}" ${raw(attrs)}></label>`;

  const { panel, close } = slideOver({
    wide: true,
    title: id ? `${t("edit")}: ${p.name_en}` : `${t("add")} — ${t("products")}`,
    body: html`<form id="pf" novalidate><fieldset style="border:0;padding:0;margin:0" ${ro ? raw("disabled") : ""}>
      <div class="card"><h3>${t("basics")}</h3><div class="grid2">
        ${F("name_en", "Name (English) *", 'required maxlength="160"')}${F("name_bn", "নাম (বাংলা) *", 'required maxlength="160"')}
        ${F("slug", L("Web address (slug) *", "ওয়েব ঠিকানা (slug) *"), 'required pattern="[a-z0-9-]+"')}${F("brand", L("Brand", "ব্র্যান্ড"), 'maxlength="80"')}
        <label class="field"><span>${t("categories")} *</span><select class="input" name="category_id" required><option value="">—</option>${cats.map(([v, l]) => html`<option value="${v}" ${p.category_id === v ? raw("selected") : ""}>${l}</option>`)}</select></label>
        <label class="field"><span>${t("status")}</span><select class="input" name="status">${[["active", L("Active — visible in shop", "চালু — দোকানে দেখাবে")], ["draft", L("Draft — hidden", "ড্রাফট — লুকানো")], ["archived", L("Archived", "আর্কাইভ")]].map(([v, l]) => html`<option value="${v}" ${p.status === v ? raw("selected") : ""}>${l}</option>`)}</select></label>
        ${F("tags", L("Tags (comma separated)", "ট্যাগ (কমা দিয়ে)"))}
        <div class="field"><span>${t("ageRanges")}</span><div class="chips">${AGES.map(([v, en, bn]) => html`<label class="check"><input type="checkbox" name="age_ranges" value="${v}" ${p.age_ranges.includes(v) ? raw("checked") : ""}> ${L(en, bn)}</label>`)}</div></div>
        <label class="check"><input type="checkbox" name="is_featured" ${p.is_featured ? raw("checked") : ""}> ${L("Feature on home page", "হোমপেজে ফিচার করুন")}</label>
        <label class="check"><input type="checkbox" name="is_gift" ${p.is_gift ? raw("checked") : ""}> ${t("giftItem")}</label>
      </div></div>

      <div class="card"><h3>${t("pricing")}</h3><div class="grid2">
        ${F("price", L("Regular price (৳) *", "আসল দাম (৳) *"), 'type="number" min="1" required inputmode="numeric"')}
        <label class="field"><span>${L("Discount", "ছাড়")}</span><select class="input" name="offer">${[
          ["none", L("No discount", "কোনো ছাড় নেই")], ["percent", L("% off", "% ছাড়")], ["flat", L("৳ off (fixed amount)", "৳ ছাড় (নির্দিষ্ট টাকা)")], ["manual", L("Set a sale price", "ছাড়ের দাম নিজে লিখুন")],
        ].map(([v, l]) => html`<option value="${v}" ${offerOf(p) === v ? raw("selected") : ""}>${l}</option>`)}</select></label>
        <label class="field" data-show="percent flat"><span>${L("Discount amount", "ছাড়ের পরিমাণ")}</span><input class="input" name="discount_value" type="number" min="1" inputmode="numeric" value="${p.discount_value || ""}"></label>
        <label class="field" data-show="manual"><span>${L("Sale price (৳)", "ছাড়ের দাম (৳)")}</span><input class="input" name="sale_price" type="number" min="0" inputmode="numeric" value="${p.sale_price ?? ""}"></label>
        <label class="field" style="grid-column:1/-1"><span>${L("Delivery", "ডেলিভারি")}</span><select class="input" name="delivery_mode">
          <option value="zone" ${p.delivery_mode !== "free" ? raw("selected") : ""}>${L("Delivery charge — calculated automatically from the customer's area", "ডেলিভারি চার্জ — গ্রাহকের এলাকা অনুযায়ী অটো হিসাব")}</option>
          <option value="free" ${p.delivery_mode === "free" ? raw("selected") : ""}>${L("Free delivery — no delivery charge is shown or taken", "ফ্রি ডেলিভারি — কোনো ডেলিভারি চার্জ দেখাবে না বা নেওয়া হবে না")}</option></select>
          <span class="hint">${L("If a cart mixes free and charged items, the area's delivery charge applies.", "কার্টে ফ্রি ও চার্জযুক্ত পণ্য একসাথে থাকলে এলাকার ডেলিভারি চার্জ প্রযোজ্য হবে।")}</span></label>
      </div></div>

      <div class="card"><h3>${t("images")}</h3><p class="muted small">${t("firstIsCover")}</p><div class="images" id="imgs"></div>
        <label class="btn sm" style="margin-top:10px">${icon("upload")} ${t("uploadImage")}<input type="file" accept="image/*" multiple id="img-up" hidden></label></div>

      <div class="card"><h3>${t("variants")}</h3><p class="muted small">SKU: ${t("skuAuto")}</p><div class="variants" id="vars"></div>
        <button type="button" class="btn sm" id="add-var" style="margin-top:10px">${icon("plus")} ${t("addVariant")}</button></div>

      <div class="card"><h3>🛡 ${t("certifications")}</h3><p class="muted small">${t("certHelp")}</p><div id="certs"></div>
        <button type="button" class="btn sm" id="add-cert">${icon("plus")} ${L("Add a badge", "ব্যাজ যোগ করুন")}</button></div>

      <div class="card"><div class="card-title"><h3 style="margin:0">${t("descriptions")}</h3><button type="button" class="btn sm" id="ai">${icon("sparkle")} ${t("aiWrite")}</button></div><div class="grid2">
        ${F("description_en", "Description (English)", 'maxlength="5000"', "textarea")}${F("description_bn", "বিবরণ (বাংলা)", 'maxlength="5000"', "textarea")}
        ${F("material_en", "Material (English)")}${F("material_bn", "উপাদান (বাংলা)")}
        ${F("care_en", "Care (English)")}${F("care_bn", "যত্ন (বাংলা)")}
        <label class="field"><span>${t("sizeChart")}</span><select class="input" name="size_chart"><option value="">—</option><option value="clothing" ${p.size_chart === "clothing" ? raw("selected") : ""}>${L("Clothing", "পোশাক")}</option><option value="shoes" ${p.size_chart === "shoes" ? raw("selected") : ""}>${L("Shoes", "জুতা")}</option></select></label>
        <span></span>
        <label class="check"><input type="checkbox" name="is_consumable" ${p.is_consumable ? raw("checked") : ""}> ${t("consumable")}</label>
        ${F("reorder_days", t("reorderDays"), 'type="number" min="3" max="180" inputmode="numeric"')}
      </div></div>

      <div class="card"><h3>${t("seo")}</h3><div class="grid2">${F("meta_title", "Meta title", 'maxlength="160"', "input", true)}${F("meta_description", "Meta description", 'maxlength="320"', "textarea")}</div></div>
      </fieldset></form>`,
    footer: html`<button class="btn" data-close>${t("cancel")}</button>
      ${id && p.waiting && can("products.write") ? html`<button class="btn" id="notify">🔔 ${t("notifyWaiting", { n: num(p.waiting) })}</button>` : ""}
      ${id ? html`<a class="btn" href="/product/${p.slug}" target="_blank" rel="noopener">${icon("external")} ${t("viewShop")}</a>` : ""}
      ${ro ? "" : html`<button class="btn primary" type="submit" form="pf">${t("save")}</button>`}`,
  });
  const form = $("#pf", panel);
  const onClose = () => { if (location.hash.startsWith("#/products/")) history.replaceState(null, "", "#/products"); };
  panel.querySelector("[data-close]").addEventListener("click", onClose);

  // --- slug follows the English name until edited by hand
  let slugTouched = Boolean(id);
  form.slug.addEventListener("input", () => (slugTouched = true));
  form.name_en.addEventListener("input", () => { if (!slugTouched) form.slug.value = slugify(form.name_en.value); });

  // --- offer fields
  const syncOffer = () => $$("[data-show]", form).forEach((el) => (el.hidden = !el.dataset.show.split(" ").includes(form.offer.value)));
  form.offer.onchange = syncOffer;
  syncOffer();

  // --- photos
  const drawImages = () => {
    $("#imgs", panel).innerHTML = String(html`${images.map((u, i) => html`<figure><img src="${u}" alt="">${i === 0 ? html`<span class="first">${L("Cover", "কভার")}</span>` : html`<button type="button" class="sm" data-cover="${i}" style="right:36px" aria-label="${L("Make cover", "কভার করুন")}">★</button>`}<button type="button" data-rm-img="${i}" aria-label="${t("delete")}">×</button></figure>`)}`);
  };
  drawImages();
  $("#img-up", panel).addEventListener("change", async (e) => {
    for (const f of e.target.files) {
      try { toast(t("uploading")); images.push((await uploadImage(f, "products")).url); drawImages(); } catch (err) { toast(errMsg(err), "err"); }
    }
    e.target.value = "";
  });
  $("#imgs", panel).addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm-img]");
    if (rm) { images.splice(Number(rm.dataset.rmImg), 1); return drawImages(); }
    const cv = e.target.closest("[data-cover]");
    if (cv) { const [x] = images.splice(Number(cv.dataset.cover), 1); images.unshift(x); drawImages(); }
  });

  // --- variants with SKU preview
  let skuHint = "";
  const refreshSkuHint = async () => {
    const cat = form.category_id.value;
    if (!cat) { skuHint = ""; return drawVariants(); }
    const ages = $$('[name="age_ranges"]:checked', form).map((x) => x.value);
    try { skuHint = (await api(`/products/sku-preview?category_id=${cat}${ages.length === 1 ? `&age=${ages[0]}` : ""}`)).sku; } catch { skuHint = ""; }
    drawVariants();
  };
  const drawVariants = () => {
    $("#vars", panel).innerHTML = String(html`${variants.map((v, i) => html`<div class="variant" data-i="${i}">
      <label class="field"><span>SKU</span><input class="input" data-k="sku" value="${v.sku ?? ""}" placeholder="${skuHint ? `${L("auto", "অটো")}: ${skuHint}` : L("auto", "অটো")}" style="text-transform:uppercase" maxlength="60" ${v.id && v.sku ? raw("readonly") : ""}></label>
      <label class="field"><span>${L("Size", "সাইজ")}</span><input class="input" data-k="size" value="${v.size ?? ""}" maxlength="40"></label>
      <label class="field"><span>${L("Colour", "রং")}</span><input class="input" data-k="color" value="${v.color ?? ""}" maxlength="40"></label>
      <label class="field"><span>${L("Age", "বয়স")}</span><select class="input" data-k="age_range"><option value="">—</option>${AGES.map(([a, en, bn]) => html`<option value="${a}" ${v.age_range === a ? raw("selected") : ""}>${L(en, bn)}</option>`)}</select></label>
      <label class="field"><span>${L("Stock", "স্টক")}</span><input class="input" data-k="stock" type="number" min="0" inputmode="numeric" value="${v.stock ?? 0}"></label>
      <label class="field"><span>${L("Price ৳ (optional)", "দাম ৳ (ঐচ্ছিক)")}</span><input class="input" data-k="price_override" type="number" min="1" inputmode="numeric" value="${v.price_override ?? ""}"></label>
      <button type="button" class="icon-btn" data-rm-var="${i}" aria-label="${t("delete")}" ${variants.length === 1 ? raw("disabled") : ""}>${icon("trash")}</button></div>`)}`);
  };
  drawVariants();
  refreshSkuHint();
  form.category_id.addEventListener("change", refreshSkuHint);
  $$('[name="age_ranges"]', form).forEach((x) => x.addEventListener("change", refreshSkuHint));
  $("#vars", panel).addEventListener("input", (e) => {
    const row = e.target.closest("[data-i]");
    if (!row || !e.target.dataset.k) return;
    const k = e.target.dataset.k;
    variants[Number(row.dataset.i)][k] = ["stock", "price_override"].includes(k) ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value;
  });
  $("#vars", panel).addEventListener("change", (e) => { if (e.target.dataset.k === "age_range") variants[Number(e.target.closest("[data-i]").dataset.i)].age_range = e.target.value; });
  $("#vars", panel).addEventListener("click", (e) => { const b = e.target.closest("[data-rm-var]"); if (b) { variants.splice(Number(b.dataset.rmVar), 1); drawVariants(); } });
  $("#add-var", panel).onclick = () => { const last = variants.at(-1) ?? blankVariant(); variants.push({ ...blankVariant(), color: last.color, age_range: last.age_range }); drawVariants(); };

  // --- certifications: each row needs its document before the badge can be switched on
  const drawCerts = () => {
    const used = new Set(certs.map((c) => c.type));
    $("#certs", panel).innerHTML = String(certs.length ? html`${certs.map((c, i) => html`<div class="cert-row" data-ci="${i}">
      <label class="field"><span>${L("Badge", "ব্যাজ")}</span><select class="input" data-ck="type">${Object.entries(CERT_LABELS).filter(([k]) => k === c.type || !used.has(k)).map(([k, l]) => html`<option value="${k}" ${c.type === k ? raw("selected") : ""}>${tt(l)}</option>`)}</select></label>
      <label class="field"><span>${L("Issued by", "প্রদানকারী")}</span><input class="input" data-ck="issuer" value="${c.issuer ?? ""}" maxlength="120"></label>
      <label class="field"><span>${L("Certificate no.", "সনদ নং")}</span><input class="input" data-ck="certificate_no" value="${c.certificate_no ?? ""}" maxlength="80"></label>
      <label class="field"><span>${L("Valid until", "মেয়াদ")}</span><input class="input" type="date" data-ck="valid_until" value="${c.valid_until ?? ""}"></label>
      <button type="button" class="icon-btn" data-rm-cert="${i}" aria-label="${t("delete")}">${icon("trash")}</button>
      <div style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <label class="btn sm">${icon("upload")} ${t("attachDoc")}<input type="file" accept="application/pdf,image/*" data-doc="${i}" hidden></label>
        ${c.document_url ? html`<a class="cert-doc" href="${c.document_url}" target="_blank" rel="noopener">✓ ${t("docAttached")}: ${c.document_name || c.document_url.split("/").pop()}</a>` : html`<span class="cert-doc missing">✗ ${t("docMissing")}</span>`}
        <label class="check" style="margin:0"><input type="checkbox" data-ck="is_active" ${c.document_url ? "" : raw("disabled")} ${c.document_url && c.is_active ? raw("checked") : ""}> ${L("Show badge in shop", "দোকানে ব্যাজ দেখান")}</label>
      </div></div>`)}` : html`<p class="muted small">${L("No badges. That's fine — only add one when you have the certificate.", "কোনো ব্যাজ নেই। ঠিক আছে — সার্টিফিকেট থাকলেই শুধু যোগ করুন।")}</p>`);
    $("#add-cert", panel).hidden = certs.length >= Object.keys(CERT_LABELS).length;
  };
  drawCerts();
  $("#add-cert", panel).onclick = () => {
    const free = Object.keys(CERT_LABELS).find((k) => !certs.some((c) => c.type === k));
    if (free) { certs.push({ type: free, issuer: "", certificate_no: "", valid_until: "", document_url: "", document_name: "", is_active: 0 }); drawCerts(); }
  };
  $("#certs", panel).addEventListener("input", (e) => {
    const row = e.target.closest("[data-ci]"), k = e.target.dataset.ck;
    if (!row || !k || k === "is_active" || k === "type") return;
    certs[Number(row.dataset.ci)][k] = e.target.value;
  });
  $("#certs", panel).addEventListener("change", async (e) => {
    const row = e.target.closest("[data-ci]");
    if (!row) return;
    const c = certs[Number(row.dataset.ci)];
    if (e.target.dataset.ck === "type") { c.type = e.target.value; return drawCerts(); }
    if (e.target.dataset.ck === "is_active") { c.is_active = e.target.checked && c.document_url ? 1 : 0; return; }
    if (e.target.dataset.doc != null && e.target.files[0]) {
      try { toast(t("uploading")); const r = await uploadDoc(e.target.files[0]); c.document_url = r.url; c.document_name = r.name ?? e.target.files[0].name; c.is_active = 1; drawCerts(); toast(t("docAttached")); }
      catch (err) { toast(errMsg(err), "err"); }
    }
  });
  $("#certs", panel).addEventListener("click", (e) => { const b = e.target.closest("[data-rm-cert]"); if (b) { certs.splice(Number(b.dataset.rmCert), 1); drawCerts(); } });

  // --- AI draft (optional; only if Workers AI is enabled)
  $("#ai", panel).onclick = async (e) => {
    const b = e.currentTarget;
    if (!form.name_en.value.trim()) return toast(L("Type the product name first.", "আগে পণ্যের নাম লিখুন।"), "err");
    b.disabled = true; b.textContent = t("aiWorking");
    try {
      const r = await api("/ai/describe", { method: "POST", body: { name: form.name_en.value, material: form.material_en.value || undefined, category: form.category_id.selectedOptions[0]?.textContent, age: $$('[name="age_ranges"]:checked', form).map((x) => x.value).join(", ") || undefined } });
      if (r.en && !form.description_en.value) form.description_en.value = r.en;
      if (r.bn && !form.description_bn.value) form.description_bn.value = r.bn;
      toast(L("Draft added — please check it before saving.", "খসড়া যোগ হয়েছে — সংরক্ষণের আগে দেখে নিন।"));
    } catch (err) { toast(errMsg(err), "err"); }
    b.disabled = false; b.innerHTML = String(html`${icon("sparkle")} ${t("aiWrite")}`);
  };

  $("#notify", panel)?.addEventListener("click", async () => { try { toast(msg(await api(`/products/${id}/notify-waiting`, { method: "POST" }))); } catch (err) { toast(errMsg(err), "err"); } });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Client-side copy of the hard rule (the server and the database enforce it too).
    const missing = certs.findIndex((c) => !c.document_url);
    if (missing >= 0) {
      toast(`${tt(CERT_LABELS[certs[missing].type])}: ${t("docMissing")}`, "err");
      $(`[data-ci="${missing}"]`, panel)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const fd = new FormData(form);
    const offer = fd.get("offer");
    const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
    const body = {
      name_en: fd.get("name_en"), name_bn: fd.get("name_bn"), slug: fd.get("slug"), brand: fd.get("brand") || null,
      category_id: Number(fd.get("category_id")) || 0, status: fd.get("status"), tags: fd.get("tags") ?? "",
      age_ranges: fd.getAll("age_ranges"), is_featured: fd.get("is_featured") ? 1 : 0, is_gift: fd.get("is_gift") ? 1 : 0,
      price: Number(fd.get("price")) || 0,
      delivery_mode: fd.get("delivery_mode") === "free" ? "free" : "zone",
      discount_type: offer === "percent" || offer === "flat" ? offer : "none",
      discount_value: offer === "percent" || offer === "flat" ? Number(fd.get("discount_value")) || 0 : 0,
      sale_price: offer === "manual" ? numOrNull(fd.get("sale_price")) : null,
      images,
      description_en: fd.get("description_en") || null, description_bn: fd.get("description_bn") || null,
      material_en: fd.get("material_en") || null, material_bn: fd.get("material_bn") || null, care_en: fd.get("care_en") || null, care_bn: fd.get("care_bn") || null,
      size_chart: fd.get("size_chart") || null, is_consumable: fd.get("is_consumable") ? 1 : 0, reorder_days: numOrNull(fd.get("reorder_days")),
      meta_title: fd.get("meta_title") || null, meta_description: fd.get("meta_description") || null,
      variants: variants.map((v) => ({ id: v.id, sku: (v.sku || "").trim().toUpperCase() || null, size: v.size, color: v.color, age_range: v.age_range || null, stock: Number(v.stock) || 0, price_override: v.price_override || null, low_stock_threshold: v.low_stock_threshold ?? 3 })),
      certifications: certs.map((c) => ({ type: c.type, issuer: c.issuer || null, certificate_no: c.certificate_no || null, document_url: c.document_url, document_name: c.document_name || null, valid_until: c.valid_until || null, is_active: c.is_active ? 1 : 0 })),
    };
    const btn = panel.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = t("saving");
    try {
      const r = await api(id ? `/products/${id}` : "/products", { method: id ? "PUT" : "POST", body });
      toast(msg(r));
      if (r.skus?.length) toast(`SKU: ${r.skus.join(", ")}`);
      if (r.waitingInStock) toast(t("notifyWaiting", { n: num(r.waitingInStock) }));
      close(); onClose(); reload();
    } catch (err) {
      btn.disabled = false; btn.textContent = t("save");
      // variants.0.sku → mark the right input
      for (const f of err.data?.fields ?? []) {
        const m = /^(variants|certifications)\.(\d+)\.(\w+)$/.exec(f.field);
        if (!m) continue;
        const el = m[1] === "variants" ? $(`[data-i="${m[2]}"] [data-k="${m[3]}"]`, panel) : $(`[data-ci="${m[2]}"] [data-ck="${m[3]}"]`, panel) ?? $(`[data-ci="${m[2]}"] .cert-doc`, panel);
        el?.classList.add("invalid");
      }
      showErrors(form, err);
      toast(errMsg(err), "err");
    }
  });
}
