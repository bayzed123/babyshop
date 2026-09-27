// Content pages: About, Contact (location, phone, WhatsApp, map), size guide, policies and a friendly 404.
// ADJUSTABLE: policy wording is a plain-language starting point — have it reviewed before launch.
import { t, lang, tt } from "../i18n.js";
import { html, icon, config } from "../core.js";
import { sizeChartTable, emptyState } from "../ui.js";

const POLICIES = {
  returns: {
    en: ["Returns within 7 days of delivery for unused items in original packaging (tags on, seal unbroken for feeding, bath and diaper products).", "Wrong size? We'll exchange it — we cover the courier fee the first time.", "Damaged or wrong item? Tell us within 48 hours with a photo; we replace or refund in full.", "Refunds go back by bKash/Nagad or bank within 5 working days after we receive the item.", "For hygiene reasons, opened diapers, wipes, teats and skincare can't be returned unless faulty."],
    bn: ["ডেলিভারির ৭ দিনের মধ্যে অব্যবহৃত পণ্য আসল প্যাকেটে ফেরত দেওয়া যাবে (ট্যাগ লাগানো, ফিডিং/গোসল/ডায়াপার পণ্যের সিল অক্ষত)।", "সাইজ মেলেনি? বদলে দেবো — প্রথমবার কুরিয়ার চার্জ আমাদের।", "ক্ষতিগ্রস্ত বা ভুল পণ্য? ৪৮ ঘণ্টার মধ্যে ছবিসহ জানান; বদলে দেবো বা পুরো টাকা ফেরত দেবো।", "পণ্য হাতে পাওয়ার ৫ কর্মদিবসের মধ্যে বিকাশ/নগদ বা ব্যাংকে টাকা ফেরত।", "স্বাস্থ্যগত কারণে খোলা ডায়াপার, ওয়াইপস, নিপল ও স্কিনকেয়ার ত্রুটি ছাড়া ফেরত নেওয়া হয় না।"],
  },
  delivery: {
    en: ["Cash on Delivery all over Bangladesh. Pay the courier when your parcel arrives.", "Delivery fees are calculated automatically at checkout from your division, district and upazila.", "Dhaka City: usually 1–2 days. Elsewhere: 2–5 days.", "We call or SMS to confirm new orders before they ship — this keeps fake orders away and prices low.", "Track any order from the Track order page with your order number and mobile number."],
    bn: ["সারা বাংলাদেশে ক্যাশ অন ডেলিভারি। পার্সেল হাতে পেয়ে কুরিয়ারকে টাকা দিন।", "চেকআউটে আপনার বিভাগ, জেলা ও উপজেলা অনুযায়ী ডেলিভারি চার্জ নিজে থেকে হিসাব হয়।", "ঢাকা সিটি: সাধারণত ১–২ দিন। অন্যান্য এলাকা: ২–৫ দিন।", "পাঠানোর আগে নতুন অর্ডার কল বা SMS এ কনফার্ম করা হয় — এতে ভুয়া অর্ডার কমে, দামও কম থাকে।", "অর্ডার নম্বর ও মোবাইল নম্বর দিয়ে “অর্ডার ট্র্যাক” পেজ থেকে যেকোনো অর্ডার দেখুন।"],
  },
  privacy: {
    en: ["We collect only what we need to deliver your order: name, mobile number, address and, optionally, email.", "If you start checkout but don't finish, we save what you typed so we can help you complete it; it's deleted automatically after 30 days.", "We use analytics and advertising tags (Meta, Google, Microsoft Clarity) to improve the shop and measure ads. Phone and email are hashed before being shared with ad platforms.", "We never see or store card numbers — card payments happen on SSLCommerz's secure page.", "Ask us any time to see or delete your data: call or WhatsApp us."],
    bn: ["অর্ডার পৌঁছাতে যা দরকার শুধু তাই নিই: নাম, মোবাইল নম্বর, ঠিকানা এবং ঐচ্ছিক ইমেইল।", "চেকআউট শুরু করে শেষ না করলে, সাহায্য করতে আপনার লেখা তথ্য সংরক্ষণ করা হয়; ৩০ দিন পর নিজে থেকেই মুছে যায়।", "দোকান উন্নত করতে ও বিজ্ঞাপন মাপতে অ্যানালিটিক্স ও বিজ্ঞাপন ট্যাগ (মেটা, গুগল, মাইক্রোসফট ক্ল্যারিটি) ব্যবহার করি। ফোন ও ইমেইল হ্যাশ করে পাঠানো হয়।", "কার্ডের নম্বর আমরা কখনো দেখি বা রাখি না — কার্ড পেমেন্ট হয় SSLCommerz এর নিরাপদ পেজে।", "আপনার তথ্য দেখতে বা মুছতে যেকোনো সময় কল বা হোয়াটসঅ্যাপ করুন।"],
  },
};

export default async function pages(el, { params, notFound }) {
  const cfg = await config();
  const s = cfg.store;
  const addr = lang() === "bn" ? s.address_bn : s.address_en;
  if (notFound) {
    el.innerHTML = String(html`<div class="container section">${emptyState(t("notFound"), "", html`<a class="btn primary" href="/">${t("backHome")}</a>`)}</div>`);
    return;
  }
  if (params.policy) {
    const titles = { returns: "returnsPolicy", delivery: "deliveryPolicy", privacy: "privacyPolicy" };
    el.innerHTML = String(html`<div class="container section narrow prose"><h1>${t(titles[params.policy])}</h1><ul class="checks">${POLICIES[params.policy][lang()].map((x) => html`<li>${icon("check")} <span>${x}</span></li>`)}</ul></div>`);
    return;
  }
  if (params.page === "size-guide") {
    el.innerHTML = String(html`<div class="container section narrow"><h1>${t("sizeGuidePage")}</h1>${sizeChartTable()}</div>`);
    return;
  }
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cfg.brand.location.lat},${cfg.brand.location.lng}`)}`;
  const contactCard = html`<div class="card pad contact-card">
    <h2>${t("visitUs")}</h2>
    <ul class="info-list">
      <li>${icon("pin")}<span>${addr}, ${lang() === "bn" ? "বাংলাদেশ" : "Bangladesh"} · <a href="${map}" target="_blank" rel="noopener">${lang() === "bn" ? "ম্যাপে দেখুন" : "Open in Maps"}</a></span></li>
      <li>${icon("phone")}<a href="tel:${s.phone}">${s.phone}</a></li>
      <li>${icon("whatsapp")}<a href="/wa?lang=${lang()}">${t("chatWhatsApp")}</a></li>
      <li>${icon("clock")}<span>${lang() === "bn" ? s.hours_bn : s.hours_en}</span></li>
    </ul></div>`;
  if (params.page === "contact") {
    el.innerHTML = String(html`<div class="container section narrow"><h1>${t("contact")}</h1>${contactCard}</div>`);
    return;
  }
  el.innerHTML = String(html`<div class="container section narrow prose">
    <h1>${t("about")}</h1>
    <p class="lead">${tt(cfg.brand.tagline)}</p>
    <p>${lang() === "bn"
      ? `${s.name_bn} ${s.city_bn}-ভিত্তিক একটি ছোট পারিবারিক দোকান। নবজাতক থেকে ৫ বছরের সোনামণিদের জন্য আমরা নরম পোশাক, বয়স উপযোগী খেলনা, ফিডিং, ডায়াপার, নার্সারি ও গোসলের জিনিস বাছাই করি — যেমনটা নিজের সন্তানের জন্য বাছতাম।`
      : `${s.name_en} is a small, family-run shop in ${s.city_en}. We pick soft clothing, age-appropriate toys, feeding, diaper, nursery and bath essentials for little ones up to 5 — the way we'd choose for our own children.`}</p>
    <h2>${lang() === "bn" ? "আমাদের প্রতিশ্রুতি" : "Our promises"}</h2>
    <ul class="checks">
      <li>${icon("shield")} <span>${lang() === "bn" ? "সেফটি ব্যাজ শুধু তখনই দেখাই যখন সার্টিফিকেটের কাগজ আমাদের কাছে আছে — সাজানোর জন্য কখনো নয়।" : "We only show a safety badge when we hold the certificate document — never as decoration."}</span></li>
      <li>${icon("check")} <span>${lang() === "bn" ? "“মাত্র কয়েকটি বাকি” লেখা থাকলে সেটা আসল স্টক থেকে আসে — বানানো নয়।" : "When we say “only a few left”, it's our real stock count — never made up."}</span></li>
      <li>${icon("cash")} <span>${lang() === "bn" ? "সারা দেশে ক্যাশ অন ডেলিভারি, সহজ রিটার্ন।" : "Cash on Delivery across Bangladesh and easy returns."}</span></li>
    </ul>
    ${contactCard}
  </div>`);
}
