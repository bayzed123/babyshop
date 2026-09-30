// Gift finder: age + budget (+ occasion/notes) → in-stock gift ideas. Workers AI refines the pick when enabled.
import { t, lang, tt } from "../i18n.js";
import { $, api, html, icon, raw, errMsg } from "../core.js";
import { productGrid, bindCards, AGE_LABELS, AGE_COLORS, skeletonGrid, emptyState } from "../ui.js";

export default async function giftfinder(el, { query }) {
  const age = query.get("age") ?? "0-6m";
  el.innerHTML = String(html`<div class="container section">
    <div class="gift-guide"><div class="gift-guide-text">
      <span class="eyebrow">${icon("gift")} ${t("giftFinder")}</span><h1>${t("giftFinderTitle")}</h1><p>${t("giftFinderSub")}</p>
      <form id="gf" class="stack">
        <fieldset class="age-pick"><legend>${t("ageRange")}</legend>${Object.entries(AGE_LABELS).map(([k, l]) => html`<label class="chip lg ${AGE_COLORS[k]}"><input type="radio" name="age" value="${k}" ${k === age ? raw("checked") : ""}> ${tt(l)}</label>`)}</fieldset>
        <div class="form-grid">
          <label class="field"><span>${t("budget")}</span><input class="input" type="number" name="budget" min="100" step="100" value="${query.get("budget") ?? 2000}"></label>
          <label class="field"><span>${t("occasion")}</span><select class="input" name="occasion">${["baby_shower", "aqiqah", "birthday", "welcome_baby", "other"].map((k) => html`<option value="${k}">${t(`event_${k}`)}</option>`)}</select></label>
        </div>
        <label class="field"><span>${t("anythingElse")}</span><input class="input" name="note" maxlength="200" placeholder="${lang() === "bn" ? "যেমন: খেলনা পছন্দ, রং হলুদ" : "e.g. loves music, prefers yellow"}"></label>
        <button class="btn primary lg" type="submit">${t("showGifts")}</button>
      </form></div>
      <div id="gf-results" class="gift-guide-items"></div></div></div>`);
  const out = $("#gf-results", el);
  bindCards(out);
  const run = async () => {
    const f = $("#gf", el);
    out.innerHTML = String(skeletonGrid(4));
    try {
      const p = new URLSearchParams({ age: f.age.value, budget: f.budget.value || "2000", occasion: f.occasion.value, note: f.note.value });
      if (!f.note.value) p.delete("note");
      const r = await api(`/recommend?${p}`);
      out.innerHTML = r.items.length
        ? String(html`<p class="note-card small">${icon("sparkle")} ${tt(r.reason)}</p>${productGrid(r.items)}`)
        : String(emptyState(t("noResults"), t("noResultsSub")));
    } catch (e) {
      out.innerHTML = String(html`<p class="error-box">${errMsg(e)}</p>`);
    }
  };
  $("#gf", el).addEventListener("submit", (e) => { e.preventDefault(); run(); });
  run();
}
