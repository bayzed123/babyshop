// Inventory: every option (SKU) with its stock, quick +/− adjustments, bulk stock update, CSV export, the
// adjustment log and the list of customers waiting for back-in-stock messages.
import { t, num, dt, lang } from "../i18n.js";
import { html, raw, icon, api, $, $$, can, toast, msg, errMsg, listTable, pill, debounce, exportCsv } from "../core.js";

export default async function inventory(view, { query }) {
  const state = { q: query.get("q") ?? "", stock: query.get("stock") ?? "", page: 1 };
  const pending = new Map(); // variantId → new stock (bulk edit)
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("inventory")}</h1><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button><button class="btn" id="csv-log">${icon("download")} ${t("stockLog")}</button>${can("inventory.adjust") ? html`<button class="btn primary" id="bulk-save" hidden>${t("save")} (<span id="bulk-n">0</span>)</button>` : ""}</div>
    <div class="card"><div class="toolbar">
      <input class="input" id="iq" type="search" value="${state.q}" placeholder="${t("searchPlaceholder")}" aria-label="${t("searchPlaceholder")}">
      <div class="chips">${[["", t("all")], ["low", t("lowOnly")], ["out", t("outOnly")]].map(([v, l]) => html`<button class="chip" data-stock="${v}" aria-pressed="${state.stock === v}">${l}</button>`)}</div>
      <select class="input" id="reason" aria-label="${t("reason")}" style="flex:0 1 220px"><option value="restock">${t("restock")}</option><option value="adjustment">${t("adjustment")}</option><option value="return">${t("returnR")}</option></select>
    </div><div id="list"></div></div>
    <div class="card"><h2>${t("stockLog")}</h2><div id="log"></div></div>
    <div class="card"><h2>🔔 ${t("backInStock")}</h2><div id="waiting"></div></div>`);

  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Product", bn: "পণ্য" }, render: (v) => html`<b>${lang() === "bn" ? v.name_bn : v.name_en}</b><br><span class="muted small">SKU ${v.sku}</span>${v.status !== "active" ? html` ${pill(v.status)}` : ""}` },
      { label: { en: "Option", bn: "অপশন" }, render: (v) => html`${v.size}${v.color ? ` · ${v.color}` : ""}${v.age_range ? html`<br><span class="muted small">${v.age_range}</span>` : ""}` },
      { label: { en: "Stock", bn: "স্টক" }, render: (v) => (v.stock === 0 ? pill("cancelled", "0") : v.stock <= v.low_stock_threshold ? pill("pending", num(v.stock)) : pill("active", num(v.stock))) + (v.waiting ? ` 🔔${num(v.waiting)}` : "") },
      { label: { en: "New stock", bn: "নতুন স্টক" }, render: (v) => (can("inventory.adjust") ? raw(`<input class="input" type="number" min="0" inputmode="numeric" data-set="${v.id}" value="${pending.get(v.id) ?? ""}" placeholder="${v.stock}" style="max-width:110px;min-height:40px">`) : "—") },
    ],
    actions: (v) => (can("inventory.adjust") ? html`<button class="btn sm" data-add="${v.id}" data-n="-1" aria-label="-1">−1</button> <button class="btn sm" data-add="${v.id}" data-n="1" aria-label="+1">+1</button> <button class="btn sm" data-add="${v.id}" data-n="5">+5</button>` : ""),
  });
  const load = async () => {
    table.loading();
    const qs = new URLSearchParams(Object.entries({ ...state, limit: "30" }).filter(([, v]) => v !== ""));
    try { table.render(await api(`/inventory?${qs}`), { onPage: (p) => { state.page = p; load(); } }); } catch (e) { table.error(e, load); }
  };
  const loadLog = async () => {
    try {
      const r = await api("/inventory/log?limit=15");
      if (!r.items.length) { $("#log", view).innerHTML = String(html`<p class="muted">${t("noItems")}</p>`); return; }
      $("#log", view).innerHTML = String(html`<table class="table"><thead><tr><th>${t("date")}</th><th>${t("products")}</th><th>±</th><th>${lang() === "bn" ? "পরে" : "After"}</th><th>${t("reason")}</th><th>${lang() === "bn" ? "কে" : "By"}</th></tr></thead><tbody>${r.items.map((l) => html`<tr><td data-label="${t("date")}">${dt(l.created_at, true)}</td><td data-label="${t("products")}">${l.name_en ?? "—"} <span class="muted small">${l.sku ?? ""} ${l.size ?? ""}</span></td><td data-label="±"><b style="color:${l.change < 0 ? "var(--bad)" : "var(--ok)"}">${l.change > 0 ? "+" : ""}${num(l.change)}</b></td><td data-label="${lang() === "bn" ? "পরে" : "After"}">${num(l.stock_after)}</td><td data-label="${t("reason")}">${l.reason}${l.note ? html` · <span class="muted small">${l.note}</span>` : ""}</td><td data-label="${lang() === "bn" ? "কে" : "By"}">${l.actor}</td></tr>`)}</tbody></table>`);
    } catch { $("#log", view).innerHTML = ""; }
  };
  const loadWaiting = async () => {
    try {
      const r = await api("/stock-notify");
      const open = r.items.filter((x) => !x.notified_at);
      $("#waiting", view).innerHTML = open.length ? String(html`<table class="table"><thead><tr><th>${t("date")}</th><th>${t("products")}</th><th>${t("phone")}</th><th>${lang() === "bn" ? "এখন স্টক" : "Stock now"}</th></tr></thead><tbody>${open.slice(0, 50).map((x) => html`<tr><td data-label="${t("date")}">${dt(x.created_at)}</td><td data-label="${t("products")}"><a href="#/products/${x.product_id}">${lang() === "bn" ? x.name_bn : x.name_en}</a> <span class="muted small">${x.sku ?? ""} ${x.size ?? ""}</span></td><td data-label="${t("phone")}">${x.phone ?? x.email ?? ""}</td><td data-label="${lang() === "bn" ? "এখন স্টক" : "Stock now"}">${x.stock > 0 ? pill("active", num(x.stock)) : pill("cancelled", "0")}</td></tr>`)}</tbody></table>`) : String(html`<p class="muted">${t("noItems")}</p>`);
    } catch { $("#waiting", view).innerHTML = ""; }
  };
  const adjust = async (items) => {
    try { toast(msg(await api("/inventory/adjust", { method: "POST", body: { items } }))); pending.clear(); syncBulk(); load(); loadLog(); }
    catch (err) { toast(errMsg(err), "err"); }
  };
  const syncBulk = () => { const b = $("#bulk-save", view); if (b) { b.hidden = pending.size === 0; $("#bulk-n", view).textContent = num(pending.size); } };

  view.addEventListener("click", (e) => {
    const s = e.target.closest("[data-stock]");
    if (s) { state.stock = s.dataset.stock; state.page = 1; $$("[data-stock]", view).forEach((b) => b.setAttribute("aria-pressed", String(b === s))); return load(); }
    const a = e.target.closest("[data-add]");
    if (a) { const n = Number(a.dataset.n); return adjust([{ variantId: Number(a.dataset.add), mode: n < 0 ? "remove" : "add", quantity: Math.abs(n), reason: $("#reason", view).value }]); }
    if (e.target.closest("#bulk-save")) adjust([...pending].map(([variantId, q]) => ({ variantId, mode: "set", quantity: q, reason: $("#reason", view).value })));
  });
  view.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-set]");
    if (!inp) return;
    inp.value === "" ? pending.delete(Number(inp.dataset.set)) : pending.set(Number(inp.dataset.set), Math.max(0, Number(inp.value)));
    syncBulk();
  });
  $("#iq", view).addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  $("#csv", view).onclick = async () => { try { await exportCsv(`/inventory?${new URLSearchParams(Object.entries(state).filter(([k, v]) => v !== "" && k !== "page"))}`, "inventory"); } catch (err) { toast(errMsg(err), "err"); } };
  $("#csv-log", view).onclick = async () => { try { await exportCsv("/inventory/log", "stock-log"); } catch (err) { toast(errMsg(err), "err"); } };
  await Promise.all([load(), loadLog(), loadWaiting()]);
}
