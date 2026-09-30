// Declarative definitions for the simpler admin modules. The generic view (views/resource.js) turns each one
// into a searchable, filterable list (with CSV export) and create/edit slide-overs, delete→Trash and restore.
import { t, tt, num, money, dt, lang } from "./i18n.js";
import { html, pill, api, raw, riskBadge, toast, msg } from "./core.js";

const L = (en, bn) => ({ en, bn });
const yes = (v) => (v ? pill("active", t("yesNo_1")) : pill("inactive", t("yesNo_0")));
const COLORS = [["yellow", L("Soft yellow", "হালকা হলুদ")], ["mint", L("Mint", "মিন্ট")], ["lavender", L("Lavender", "ল্যাভেন্ডার")], ["peach", L("Peach", "পিচ")], ["sky", L("Sky", "আকাশি")], ["pink", L("Pink", "গোলাপি")]];

let catOptions;
export const categoryOptions = async () =>
  (catOptions ??= api("/categories?limit=200&sort=sort_order").then((r) => r.items.map((c) => [c.id, (c.parent_name ? `${c.parent_name} › ` : "") + (lang() === "bn" ? c.name_bn : c.name_en)])));
let prodOptions;
const productOptions = async () => (prodOptions ??= api("/products?limit=200&status=active").then((r) => r.items.map((p) => [p.id, lang() === "bn" ? p.name_bn : p.name_en])));
let geo;
const geoData = async () => (geo ??= fetch("/data/bd-geo.json").then((r) => r.json()));

export const RESOURCES = {
  customers: {
    endpoint: "/customers",
    perm: "customers",
    csv: true,
    title: L("Customers", "গ্রাহক"),
    nameOf: (r) => r.name,
    filters: [
      { name: "risk_level", label: L("Risk", "ঝুঁকি"), options: [["", L("Everyone", "সবাই")], ["low", L("🟢 Trusted", "🟢 বিশ্বস্ত")], ["medium", L("🟡 New", "🟡 নতুন")], ["high", L("🔴 Verify before shipping", "🔴 পাঠানোর আগে যাচাই")]] },
      { name: "is_blocked", label: L("Status", "অবস্থা"), options: [["", L("All", "সব")], ["0", L("Active", "চালু")], ["1", L("Blocked", "ব্লক করা")]] },
    ],
    columns: [
      { label: L("Name", "নাম"), render: (r) => html`<b>${r.name}</b>${r.has_account ? html` <span class="pill active">${lang() === "bn" ? "অ্যাকাউন্ট" : "Account"}</span>` : ""}<br><span class="muted small">${r.email ?? ""}</span>` },
      { label: L("Phone", "ফোন"), render: (r) => html`<a href="tel:${r.phone}">${r.phone}</a>` },
      { label: L("Risk", "ঝুঁকি"), render: (r) => riskBadge(r.risk_level, r.risk_badge, r.risk_reason) },
      { label: L("Delivered / Refused·Returned / Cancelled", "ডেলিভারি / নেননি·ফেরত / বাতিল"), render: (r) => `${num(r.delivered_count)} / ${num(r.refused_or_returned_count)} / ${num(r.cancelled_count)}` },
      { label: L("Spent", "মোট কেনা"), render: (r) => money(r.total_spent) },
      { label: L("Status", "অবস্থা"), render: (r) => (r.is_blocked ? pill("blocked", lang() === "bn" ? "ব্লক" : "Blocked") : pill("active", t("active"))) },
    ],
    fields: async () => [
      { name: "name", label: L("Full name", "পুরো নাম"), required: true },
      { name: "phone", label: L("Mobile number", "মোবাইল নম্বর"), required: true, placeholder: "01XXXXXXXXX" },
      { name: "email", label: L("Email", "ইমেইল"), type: "email" },
      { name: "is_blocked", label: L("Block this customer (they can't order or sign in)", "এই গ্রাহককে ব্লক করুন (অর্ডার বা সাইন ইন করতে পারবেন না)"), type: "checkbox", span: 2 },
      { name: "notes", label: L("Internal notes (only staff can see)", "অভ্যন্তরীণ নোট (শুধু স্টাফ দেখবেন)"), type: "textarea", span: 2 },
    ],
    rowActions: (r) => html`<button class="btn sm" data-act="toggle-block">${r.is_blocked ? (lang() === "bn" ? "আনব্লক" : "Unblock") : lang() === "bn" ? "ব্লক" : "Block"}</button>`,
    onAction: async (act, r) => {
      if (act === "toggle-block") return api(`/customers/${r.id}`, { method: "PUT", body: { name: r.name, phone: r.phone, email: r.email ?? "", notes: r.notes ?? "", is_blocked: r.is_blocked ? 0 : 1 } });
    },
    detail: (r) => html`<p>${riskBadge(r.risk_level, r.risk_badge, r.risk_reason)} <span class="muted small">${r.risk_reason ? tt(r.risk_reason) : ""}</span></p>
      <h3>${t("orders")}</h3>${(r.orders ?? []).length ? html`<table class="table">${r.orders.map((o) => html`<tr><td data-label="#"><a href="#/orders/${o.id}">${o.order_no}</a></td><td data-label="${t("status")}">${pill(o.status, t(`s_${o.status}`))}</td><td data-label="${t("total")}">${money(o.total)}</td><td data-label="${t("date")}">${dt(o.created_at)}</td></tr>`)}</table>` : html`<p class="muted">—</p>`}
      ${(r.addresses ?? []).length ? html`<h3>${lang() === "bn" ? "সংরক্ষিত ঠিকানা" : "Saved addresses"}</h3>${r.addresses.map((a) => html`<p class="small"><b>${a.label}</b>: ${a.area}, ${a.upazila}, ${a.district}</p>`)}` : ""}
      ${(r.registries ?? []).length ? html`<h3>${t("registries")}</h3>${r.registries.map((g) => html`<p class="small"><a href="/registry/${g.slug}" target="_blank">${g.title}</a> ${pill(g.status)}</p>`)}` : ""}`,
  },

  coupons: {
    endpoint: "/coupons",
    perm: "coupons",
    csv: true,
    title: L("Coupons & discounts", "কুপন ও ছাড়"),
    nameOf: (r) => r.code,
    filters: [
      { name: "type", label: L("Type", "ধরন"), options: [["", L("All types", "সব ধরন")], ["percent", L("Percentage", "শতাংশ")], ["flat", L("Flat amount", "নির্দিষ্ট টাকা")]] },
      { name: "kind", label: L("Made by", "কে তৈরি করেছে"), options: [["", L("All", "সব")], ["standard", L("Staff", "স্টাফ")], ["recovery", L("Cart recovery", "কার্ট রিকভারি")], ["referral_reward", L("Referral reward", "রেফারেল রিওয়ার্ড")]] },
    ],
    columns: [
      { label: L("Code", "কোড"), render: (r) => html`<b style="letter-spacing:.06em">${r.code}</b><br><span class="muted small">${r.description ?? ""}</span>` },
      { label: L("Discount", "ছাড়"), render: (r) => (r.type === "percent" ? `${num(r.value)}%` : money(r.value)) + (r.max_discount ? ` (≤ ${money(r.max_discount)})` : "") },
      { label: L("Min. order", "সর্বনিম্ন অর্ডার"), render: (r) => money(r.min_order) },
      { label: L("Used", "ব্যবহৃত"), render: (r) => `${num(r.used_count)}${r.usage_limit ? ` / ${num(r.usage_limit)}` : ""}` },
      { label: L("Expires", "মেয়াদ"), render: (r) => (r.expires_at ? dt(r.expires_at) : "—") },
      { label: L("Status", "অবস্থা"), render: (r) => (r.expires_at && Date.parse(r.expires_at) < Date.now() ? pill("inactive", lang() === "bn" ? "মেয়াদোত্তীর্ণ" : "Expired") : yes(r.is_active)) },
    ],
    fields: async () => [
      { name: "code", label: L("Coupon code", "কুপন কোড"), required: true, placeholder: "EID25", hint: L("Customers type this at checkout.", "গ্রাহক চেকআউটে এটি লিখবেন।") },
      { name: "description", label: L("Description (for staff)", "বিবরণ (স্টাফের জন্য)") },
      { name: "type", label: L("Discount type", "ছাড়ের ধরন"), type: "select", options: [["percent", L("Percentage (%)", "শতাংশ (%)")], ["flat", L("Flat amount (৳)", "নির্দিষ্ট টাকা (৳)")]], required: true },
      { name: "value", label: L("Discount value", "ছাড়ের পরিমাণ"), type: "number", required: true, min: 1 },
      { name: "min_order", label: L("Minimum order (৳)", "সর্বনিম্ন অর্ডার (৳)"), type: "money", default: 0 },
      { name: "max_discount", label: L("Maximum discount (৳, optional)", "সর্বোচ্চ ছাড় (৳, ঐচ্ছিক)"), type: "money" },
      { name: "starts_at", label: L("Starts", "শুরু"), type: "date" },
      { name: "expires_at", label: L("Expires", "শেষ"), type: "date" },
      { name: "usage_limit", label: L("Total uses allowed (optional)", "মোট কতবার ব্যবহার করা যাবে (ঐচ্ছিক)"), type: "number", min: 1 },
      { name: "per_customer_limit", label: L("Uses per customer (optional)", "প্রতি গ্রাহক কতবার (ঐচ্ছিক)"), type: "number", min: 1 },
      { name: "category_ids", label: L("Only for these categories (empty = whole shop)", "শুধু এই ক্যাটাগরিতে (খালি রাখলে পুরো দোকানে)"), type: "multiselect", options: await categoryOptions(), span: 2, hint: L("Hold Ctrl/⌘ (or long-press on phone) to select several.", "একাধিক বাছতে Ctrl/⌘ চেপে ধরুন (ফোনে লম্বা চাপ দিন)।") },
      { name: "is_active", label: L("Coupon is active", "কুপন চালু আছে"), type: "checkbox", default: 1, span: 2 },
    ],
  },

  banners: {
    endpoint: "/banners",
    perm: "banners",
    title: L("Homepage banners", "হোমপেজ ব্যানার"),
    nameOf: (r) => r.title_en,
    filters: [{ name: "placement", label: L("Placement", "অবস্থান"), options: [["", L("All", "সব")], ["hero", L("Hero slider", "হিরো স্লাইডার")], ["promo", L("Promo strip", "প্রোমো")]] }],
    columns: [
      { label: L("Image", "ছবি"), render: (r) => (r.image_url ? html`<img class="thumb" src="${r.image_url}" alt="">` : "—") },
      { label: L("Title", "শিরোনাম"), render: (r) => html`<b>${lang() === "bn" ? r.title_bn : r.title_en}</b><br><span class="muted small">${r.link_url ?? ""}</span>` },
      { label: L("Placement", "অবস্থান"), render: (r) => pill(r.placement) },
      { label: L("Showing", "দেখাচ্ছে"), render: (r) => yes(r.is_active && (!r.ends_at || Date.parse(r.ends_at) > Date.now()) && (!r.starts_at || Date.parse(r.starts_at) <= Date.now())) },
    ],
    fields: async () => [
      { name: "placement", label: L("Where to show", "কোথায় দেখাবে"), type: "select", options: [["hero", L("Hero slider (top of home page)", "হিরো স্লাইডার (হোমপেজের উপরে)")], ["promo", L("Promo strip", "প্রোমো")]], required: true, span: 2 },
      { name: "title_en", label: L("Title (English)", "শিরোনাম (ইংরেজি)"), required: true },
      { name: "title_bn", label: L("Title (Bangla)", "শিরোনাম (বাংলা)"), required: true },
      { name: "subtitle_en", label: L("Subtitle (English)", "উপশিরোনাম (ইংরেজি)") },
      { name: "subtitle_bn", label: L("Subtitle (Bangla)", "উপশিরোনাম (বাংলা)") },
      { name: "cta_en", label: L("Button text (English)", "বাটনের লেখা (ইংরেজি)") },
      { name: "cta_bn", label: L("Button text (Bangla)", "বাটনের লেখা (বাংলা)") },
      { name: "link_url", label: L("Button link", "বাটনের লিংক"), placeholder: "/shop?age=0-6m", span: 2 },
      { name: "image_url", label: L("Image", "ছবি"), type: "image", span: 2 },
      { name: "color", label: L("Background colour", "পেছনের রং"), type: "select", options: COLORS },
      { name: "sort_order", label: L("Order (smaller shows first)", "ক্রম (ছোট সংখ্যা আগে)"), type: "number", default: 0 },
      { name: "starts_at", label: L("Start showing", "দেখানো শুরু"), type: "date" },
      { name: "ends_at", label: L("Stop showing", "দেখানো বন্ধ"), type: "date" },
      { name: "is_active", label: L("Active", "চালু"), type: "checkbox", default: 1 },
    ],
  },

  landing: {
    endpoint: "/landing",
    perm: "landing",
    title: L("Campaign landing pages", "ক্যাম্পেইন ল্যান্ডিং পেজ"),
    intro: L("A simple page for one ad: one headline, one offer, one button — no menus to distract. Share /lp/<address> in your ad; orders are tracked to the campaign.", "একটি বিজ্ঞাপনের জন্য সহজ পেজ: একটি শিরোনাম, একটি অফার, একটি বাটন — কোনো মেনু নেই। বিজ্ঞাপনে /lp/<ঠিকানা> দিন; অর্ডার ক্যাম্পেইনে গণনা হবে।"),
    nameOf: (r) => r.title_en,
    filters: [],
    columns: [
      { label: L("Page", "পেজ"), render: (r) => html`<b>${lang() === "bn" ? r.title_bn : r.title_en}</b><br><a class="small" href="/lp/${r.slug}" target="_blank">/lp/${r.slug}</a>` },
      { label: L("Product", "পণ্য"), render: (r) => r.product_name ?? "—" },
      { label: L("Views", "ভিউ"), render: (r) => num(r.views) },
      { label: L("Orders", "অর্ডার"), render: (r) => num(r.orders) },
      { label: L("Active", "চালু"), render: (r) => yes(r.is_active) },
    ],
    fields: async () => [
      { name: "slug", label: L("Web address", "ওয়েব ঠিকানা"), required: true, placeholder: "eid-diaper-deal", hint: L("lowercase-with-dashes → /lp/eid-diaper-deal", "ছোট হাতের ইংরেজি ও ড্যাশ") },
      { name: "product_id", label: L("Product (button adds it to the cart)", "পণ্য (বাটন কার্টে যোগ করবে)"), type: "select", numeric: true, allowEmpty: true, options: await productOptions() },
      { name: "title_en", label: L("Headline (English)", "শিরোনাম (ইংরেজি)"), required: true },
      { name: "title_bn", label: L("Headline (Bangla)", "শিরোনাম (বাংলা)"), required: true },
      { name: "subtitle_en", label: L("Sub-headline (English)", "উপশিরোনাম (ইংরেজি)") },
      { name: "subtitle_bn", label: L("Sub-headline (Bangla)", "উপশিরোনাম (বাংলা)") },
      { name: "offer_en", label: L("Offer (English)", "অফার (ইংরেজি)") },
      { name: "offer_bn", label: L("Offer (Bangla)", "অফার (বাংলা)") },
      { name: "coupon_code", label: L("Coupon applied automatically (optional)", "স্বয়ংক্রিয় কুপন (ঐচ্ছিক)") },
      { name: "color", label: L("Background colour", "পেছনের রং"), type: "select", options: COLORS },
      { name: "cta_en", label: L("Button text (English)", "বাটনের লেখা (ইংরেজি)") },
      { name: "cta_bn", label: L("Button text (Bangla)", "বাটনের লেখা (বাংলা)") },
      { name: "image_url", label: L("Image (optional — product photo is used otherwise)", "ছবি (ঐচ্ছিক)"), type: "image", span: 2 },
      { name: "is_active", label: L("Active", "চালু"), type: "checkbox", default: 1 },
    ],
  },

  reviews: {
    endpoint: "/reviews",
    perm: "reviews",
    writePerm: "reviews.moderate",
    csv: true,
    title: L("Reviews", "রিভিউ"),
    nameOf: (r) => `${r.name} — ${r.product_name}`,
    noCreate: true,
    filters: [{ name: "status", label: L("Status", "অবস্থা"), options: [["", L("All", "সব")], ["pending", L("Waiting", "অপেক্ষমাণ")], ["approved", L("Approved", "অনুমোদিত")], ["rejected", L("Rejected", "বাতিল")]] }],
    columns: [
      { label: L("Review", "রিভিউ"), render: (r) => html`<span style="color:#D98A12">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>${r.verified_purchase ? html` <span class="pill active">${lang() === "bn" ? "যাচাইকৃত ক্রেতা" : "Verified buyer"}</span>` : ""}<br>${r.body}${r.reply ? html`<br><span class="muted small">↳ ${r.reply}</span>` : ""}` },
      { label: L("By", "লিখেছেন"), render: (r) => html`<b>${r.name}</b><br><span class="muted small">${dt(r.created_at)}</span>` },
      { label: L("Product", "পণ্য"), render: (r) => html`<a href="/product/${r.product_slug}" target="_blank" rel="noopener">${r.product_name}</a>` },
      { label: L("Status", "অবস্থা"), render: (r) => pill(r.status) },
    ],
    fields: async () => [
      { name: "status", label: L("Status", "অবস্থা"), type: "select", options: [["pending", L("Waiting", "অপেক্ষমাণ")], ["approved", L("Approved — show on the website", "অনুমোদিত — ওয়েবসাইটে দেখাবে")], ["rejected", L("Rejected — hide", "বাতিল — লুকানো")]], span: 2 },
      { name: "reply", label: L("Public reply from the shop (optional)", "দোকানের পক্ষ থেকে উত্তর (ঐচ্ছিক)"), type: "textarea", span: 2 },
    ],
    rowActions: (r) => html`${r.status !== "approved" ? html`<button class="btn sm" data-act="approved">✓ ${t("approve")}</button>` : ""} ${r.status !== "rejected" ? html`<button class="btn sm" data-act="rejected">✕ ${t("reject")}</button>` : ""}`,
    onAction: (act, r) => api(`/reviews/${r.id}`, { method: "PUT", body: { status: act } }),
  },

  zones: {
    endpoint: "/zones",
    perm: "zones",
    title: L("Delivery areas & fees", "ডেলিভারি এলাকা ও চার্জ"),
    nameOf: (r) => r.name_en,
    filters: [],
    intro: L("The most specific rule wins: an upazila/thana rule beats a district rule, a district beats a division, and the default zone covers everywhere else. Fees here are shown live at checkout.", "সবচেয়ে নির্দিষ্ট নিয়মটি প্রযোজ্য: উপজেলা/থানা → জেলা → বিভাগ → ডিফল্ট জোন। এখানের চার্জ চেকআউটে সরাসরি দেখানো হয়।"),
    columns: [
      { label: L("Zone", "জোন"), render: (r) => html`<b>${lang() === "bn" ? r.name_bn : r.name_en}</b><br><span class="muted small">${r.code}${r.is_default ? " · default" : ""}</span>` },
      { label: L("Fee", "চার্জ"), render: (r) => money(r.fee) },
      { label: L("Free over", "যত টাকার উপরে ফ্রি"), render: (r) => (r.free_shipping_min ? money(r.free_shipping_min) : "—") },
      { label: L("Covers", "এলাকা"), render: (r) => (r.is_default ? (lang() === "bn" ? "বাকি সব এলাকা" : "Everywhere else") : [r.division_ids.length ? `${num(r.division_ids.length)} ${lang() === "bn" ? "বিভাগ" : "divisions"}` : "", r.district_ids.length ? `${num(r.district_ids.length)} ${lang() === "bn" ? "জেলা" : "districts"}` : "", r.upazila_ids.length ? `${num(r.upazila_ids.length)} ${lang() === "bn" ? "উপজেলা" : "upazilas"}` : ""].filter(Boolean).join(", ")) },
      { label: L("Delivery time", "ডেলিভারির সময়"), render: (r) => (lang() === "bn" ? r.eta_bn : r.eta_en) ?? "—" },
    ],
    fields: async () => {
      const g = await geoData();
      const nm = (en, bn) => (lang() === "bn" ? bn : en);
      const dname = Object.fromEntries(g.districts.map(([id, , en, bn]) => [id, nm(en, bn)]));
      return [
        { name: "name_en", label: L("Zone name (English)", "জোনের নাম (ইংরেজি)"), required: true },
        { name: "name_bn", label: L("Zone name (Bangla)", "জোনের নাম (বাংলা)"), required: true },
        { name: "code", label: L("Short code", "শর্ট কোড"), required: true, placeholder: "dhaka_city", hint: L("lowercase_with_underscores", "ছোট হাতের ইংরেজি ও _") },
        { name: "fee", label: L("Delivery fee (৳)", "ডেলিভারি চার্জ (৳)"), type: "money", required: true },
        { name: "free_shipping_min", label: L("Free delivery on orders over (৳, optional)", "এর বেশি অর্ডারে ফ্রি ডেলিভারি (৳, ঐচ্ছিক)"), type: "money" },
        { name: "sort_order", label: L("Order", "ক্রম"), type: "number", default: 0 },
        { name: "eta_en", label: L("Delivery time (English)", "ডেলিভারির সময় (ইংরেজি)"), placeholder: "2–3 days" },
        { name: "eta_bn", label: L("Delivery time (Bangla)", "ডেলিভারির সময় (বাংলা)"), placeholder: "২–৩ দিন" },
        { name: "division_ids", label: L("Whole divisions", "পুরো বিভাগ"), type: "multiselect", options: g.divisions.map(([id, en, bn]) => [id, nm(en, bn)]), span: 2 },
        { name: "district_ids", label: L("Districts", "জেলা"), type: "multiselect", options: g.districts.map(([id, , en, bn]) => [id, nm(en, bn)]).sort((a, b) => a[1].localeCompare(b[1])), span: 2 },
        { name: "upazila_ids", label: L("Specific upazilas / thanas", "নির্দিষ্ট উপজেলা / থানা"), type: "multiselect", options: g.upazilas.map(([id, d, en, bn]) => [id, `${nm(en, bn)} (${dname[d]})`]).sort((a, b) => a[1].localeCompare(b[1])), span: 2 },
        { name: "is_default", label: L("Default zone (used when nothing else matches)", "ডিফল্ট জোন (অন্য কিছু না মিললে)"), type: "checkbox" },
        { name: "is_active", label: L("Active", "চালু"), type: "checkbox", default: 1 },
      ];
    },
  },

  staff: {
    endpoint: "/staff",
    perm: "staff",
    writePerm: "staff.manage",
    deletePerm: "staff.manage",
    title: L("Staff & roles", "স্টাফ ও রোল"),
    intro: L("Super Admins and Managers sign in with a password plus a code from their phone's authenticator app. Order Processors and Viewers can simply sign in with their mobile number and an SMS code.", "সুপার অ্যাডমিন ও ম্যানেজার পাসওয়ার্ড + অথেন্টিকেটর অ্যাপের কোড দিয়ে সাইন ইন করেন। অর্ডার প্রসেসর ও ভিউয়ার শুধু মোবাইল নম্বর ও SMS কোড দিয়ে সাইন ইন করতে পারেন।"),
    nameOf: (r) => r.name,
    filters: [{ name: "role", label: L("Role", "রোল"), options: [["", L("All", "সব")], ["super_admin", "Super Admin"], ["manager", "Manager"], ["order_processor", "Order Processor"], ["viewer", "Viewer"]] }],
    columns: [
      { label: L("Name", "নাম"), render: (r) => html`<b>${r.name}</b><br><span class="muted small">${r.email}${r.phone ? ` · ${r.phone}` : ""}</span>` },
      { label: L("Role", "রোল"), render: (r) => pill("confirmed", r.role.replace("_", " ")) },
      { label: L("2-step", "২-ধাপ"), render: (r) => (r.totp_enabled ? pill("active", "✓") : ["super_admin", "manager"].includes(r.role) ? pill("pending", lang() === "bn" ? "প্রথম সাইন-ইনে" : "at first sign-in") : "—") },
      { label: L("Last seen", "শেষ দেখা"), render: (r) => dt(r.last_seen_at ?? r.last_login_at, true) },
      { label: L("Status", "অবস্থা"), render: (r) => yes(r.is_active) },
    ],
    fields: async () => [
      { name: "name", label: L("Name", "নাম"), required: true },
      { name: "email", label: L("Username or email (to sign in)", "ইউজারনেম বা ইমেইল (সাইন ইনের জন্য)"), required: true },
      { name: "phone", label: L("Mobile number (for SMS sign-in)", "মোবাইল নম্বর (SMS সাইন-ইনের জন্য)"), placeholder: "01XXXXXXXXX" },
      { name: "role", label: L("Role", "রোল"), type: "select", required: true, options: [["order_processor", L("Order Processor — handles orders", "অর্ডার প্রসেসর — অর্ডার সামলান")], ["manager", L("Manager — everything except staff & settings", "ম্যানেজার — স্টাফ ও সেটিংস ছাড়া সব")], ["viewer", L("Read-only Viewer", "শুধু দেখতে পারবেন")], ["super_admin", L("Super Admin — full control", "সুপার অ্যাডমিন — সম্পূর্ণ নিয়ন্ত্রণ")]] },
      { name: "password", label: L("Password (min 10 characters; leave empty to keep)", "পাসওয়ার্ড (কমপক্ষে ১০ অক্ষর; পরিবর্তন না করলে খালি রাখুন)"), type: "password", span: 2 },
      { name: "is_active", label: L("Can sign in", "সাইন ইন করতে পারবেন"), type: "checkbox", default: 1, span: 2 },
    ],
    rowActions: (r) => (r.totp_enabled ? html`<button class="btn sm" data-act="reset2fa">${t("reset2fa")}</button>` : ""),
    onAction: async (act, r) => {
      if (act === "reset2fa") { const x = await api(`/staff/${r.id}/reset-2fa`, { method: "POST" }); toast(msg(x)); }
    },
    extra: async () => {
      const r = await api("/roles");
      const roles = Object.keys(r.matrix);
      const groups = [...new Set(r.permissions.map((p) => p.split(".")[0]))];
      return html`<div class="card" style="margin-top:20px"><h2>${t("roleMatrix")}</h2><div style="overflow-x:auto"><table class="table"><thead><tr><th></th>${roles.map((ro) => html`<th>${tt(r.labels[ro])}</th>`)}</tr></thead>
        <tbody>${groups.map((g) => html`<tr><td data-label=""><b>${g}</b></td>${roles.map((ro) => html`<td data-label="${tt(r.labels[ro])}">${r.permissions.filter((p) => p.startsWith(g + ".")).map((p) => raw(r.matrix[ro].includes(p) ? `<span class="pill active" style="margin:2px">${p.split(".")[1]}</span>` : ""))}</td>`)}</tr>`)}</tbody></table></div></div>`;
    },
  },
};
