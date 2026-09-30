// Gift registries (baby shower / aqiqah / birthday): progress per registry, items bought, gift orders and
// a share link. Staff can close a registry once the event has passed.
import { t, num, money, dt, lang } from "../i18n.js";
import { html, icon, api, $, can, toast, msg, errMsg, listTable, pill, debounce, exportCsv, slideOver } from "../core.js";

export default async function registries(view, { id }) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const state = { status: "", q: "", page: 1 };
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("registries")}</h1><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button></div>
    <div class="card"><div class="toolbar">
      <input class="input" id="rq" type="search" placeholder="${L("Title, baby name, parent, phone…", "শিরোনাম, শিশুর নাম, অভিভাবক, ফোন…")}" aria-label="${t("searchPlaceholder")}">
      <select class="input" id="rs" aria-label="${t("status")}"><option value="">${t("status")}: ${t("all")}</option><option value="active">${L("Active", "চালু")}</option><option value="closed">${L("Closed", "বন্ধ")}</option></select>
    </div><div id="list"></div></div>`);
  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Registry", bn: "রেজিস্ট্রি" }, render: (r) => html`<b>${r.title}</b><br><span class="muted small">${r.event_type}${r.baby_name ? ` · ${r.baby_name}` : ""}</span>` },
      { label: { en: "Parent", bn: "অভিভাবক" }, render: (r) => html`${r.owner_name}<br><a class="small" href="tel:${r.owner_phone}">${r.owner_phone}</a>` },
      { label: { en: "Event date", bn: "অনুষ্ঠানের তারিখ" }, render: (r) => dt(r.event_date) },
      { label: { en: "Progress", bn: "অগ্রগতি" }, render: (r) => html`${num(r.purchased)}/${num(r.wanted)} ${L("gifted", "উপহার")}<div class="bar"><i style="width:${r.wanted ? Math.round((r.purchased / r.wanted) * 100) : 0}%"></i></div><span class="muted small">${num(r.orders)} ${t("orders_")}</span>` },
      { label: { en: "Status", bn: "অবস্থা" }, render: (r) => pill(r.status === "active" ? "active" : "inactive", r.status) },
    ],
    rowAttrs: (r) => `class="clickable" data-open="${r.id}"`,
    actions: (r) => html`<a class="btn sm" href="/registry/${r.slug}" target="_blank" rel="noopener" aria-label="${t("viewShop")}">${icon("external")}</a>`,
  });
  const qs = (x = {}) => new URLSearchParams(Object.entries({ ...state, ...x }).filter(([, v]) => v !== ""));
  async function load() {
    table.loading();
    try { table.render(await api(`/registries?${qs({ limit: "20" })}`), { onPage: (p) => { state.page = p; load(); } }); } catch (e) { table.error(e, load); }
  }
  async function open(rid) {
    let r;
    try { r = (await api(`/registries/${rid}`)).item; } catch (e) { return toast(errMsg(e), "err"); }
    const { panel, close } = slideOver({
      wide: true,
      title: r.title,
      body: html`<dl class="kv"><dt>${L("Parent", "অভিভাবক")}</dt><dd>${r.owner_name} · <a href="tel:${r.owner_phone}">${r.owner_phone}</a></dd><dt>${L("Event", "অনুষ্ঠান")}</dt><dd>${r.event_type} · ${dt(r.event_date)}</dd>
          ${r.baby_name ? html`<dt>${L("Baby", "শিশু")}</dt><dd>${r.baby_name}</dd>` : ""}<dt>${L("Share link", "শেয়ার লিংক")}</dt><dd><a href="${r.share_url}" target="_blank" rel="noopener">${r.share_url}</a></dd>
          <dt>${L("Delivery", "ডেলিভারি")}</dt><dd>${r.ship_to_parent ? L("Gifts are sent to the parent's address", "উপহার অভিভাবকের ঠিকানায় যাবে") : L("Gift givers enter their own address", "উপহারদাতা নিজের ঠিকানা দেবেন")}</dd></dl>
        <div class="card"><h3>${t("items")}</h3>${r.items.length ? r.items.map((i) => html`<div class="item-row"><span></span><span><b>${lang() === "bn" ? i.name_bn : i.name_en}</b><br><span class="muted small">${i.sku ?? ""} ${i.size ?? ""} · ${L("stock", "স্টক")} ${num(i.stock ?? 0)}</span></span><b>${num(i.quantity_purchased)}/${num(i.quantity_wanted)}</b></div>`) : html`<p class="muted">${t("noItems")}</p>`}</div>
        <div class="card"><h3>${L("Gift orders", "উপহারের অর্ডার")}</h3>${r.orders.length ? r.orders.map((o) => html`<p><a href="#/orders/${o.id}"><b>${o.order_no}</b></a> · ${o.customer_name} · ${money(o.total)} · ${pill(o.status, t(`s_${o.status}`))}${o.gift_message ? html`<br><span class="small">🎁 “${o.gift_message}”</span>` : ""}</p>`) : html`<p class="muted">—</p>`}</div>`,
      footer: can("registries.write") ? html`<button class="btn" data-close>${t("close")}</button><button class="btn ${r.status === "active" ? "" : "primary"}" id="toggle">${r.status === "active" ? L("Close registry", "রেজিস্ট্রি বন্ধ করুন") : L("Reopen", "আবার খুলুন")}</button>` : "",
    });
    const onClose = () => { if (location.hash.startsWith("#/registries/")) history.replaceState(null, "", "#/registries"); };
    panel.querySelector("[data-close]").addEventListener("click", onClose);
    $("#toggle", panel)?.addEventListener("click", async () => {
      try { toast(msg(await api(`/registries/${r.id}`, { method: "PUT", body: { status: r.status === "active" ? "closed" : "active" } }))); close(); onClose(); load(); } catch (e) { toast(errMsg(e), "err"); }
    });
  }
  view.addEventListener("click", (e) => { if (e.target.closest("a")) return; const o = e.target.closest("[data-open]"); if (o) location.hash = `#/registries/${o.dataset.open}`; });
  $("#rq", view).addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  $("#rs", view).onchange = (e) => { state.status = e.target.value; state.page = 1; load(); };
  $("#csv", view).onclick = async () => { try { await exportCsv(`/registries?${qs()}`, "registries"); } catch (err) { toast(errMsg(err), "err"); } };
  await load();
  if (id) open(Number(id));
}
