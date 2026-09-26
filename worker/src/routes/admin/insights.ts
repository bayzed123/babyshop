/**
 * Dashboard home (KPIs, monthly chart, "Needs your attention today", Health Check, first-run checklist)
 * and Reports. All "day" boundaries use Bangladesh time (UTC+6).
 */
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../env";
import { validate } from "../../lib/http";
import { perm } from "../../middleware";
import { audit, getSetting } from "../../lib/store";
import { bkashConfigured, sslczConfigured } from "../../lib/payments";
import { pathaoConfigured, steadfastConfigured } from "../../lib/couriers";
import { emailConfigured, smsConfigured, whatsappConfigured } from "../../lib/notify";
import { pushConfigured } from "../../lib/push";
import { csvResponse } from "./crud";

const app = new Hono<AppEnv>();
const BD = "'+6 hours'";
/** Revenue counts orders that are still alive (not cancelled / refused / returned). */
const LIVE = "o.deleted_at IS NULL AND o.status NOT IN ('cancelled','refused','returned')";

app.get("/dashboard", perm("dashboard.view"), async (c) => {
  const db = c.env.DB;
  const [today, yesterday, month, lastMonth, pendingCod, lowStock, registries, chart, recent, top, abandonedOpen] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders o WHERE ${LIVE} AND date(o.created_at, ${BD}) = date('now', ${BD})`).first<{ orders: number; revenue: number }>(),
    db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders o WHERE ${LIVE} AND date(o.created_at, ${BD}) = date('now', ${BD}, '-1 day')`).first<{ orders: number; revenue: number }>(),
    db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders o WHERE ${LIVE} AND strftime('%Y-%m', o.created_at, ${BD}) = strftime('%Y-%m', 'now', ${BD})`).first<{ orders: number; revenue: number }>(),
    db.prepare(`SELECT COALESCE(SUM(total),0) AS revenue FROM orders o WHERE ${LIVE} AND strftime('%Y-%m', o.created_at, ${BD}) = strftime('%Y-%m', 'now', ${BD}, 'start of month', '-1 month')`).first<{ revenue: number }>(),
    // Pending COD = cash still to be collected: COD orders not yet delivered and not closed.
    db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS amount FROM orders WHERE payment_method = 'COD' AND payment_status = 'pending' AND status IN ('pending','confirmation_attempted','confirmed','packed','shipped') AND deleted_at IS NULL").first<{ n: number; amount: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.stock <= v.low_stock_threshold AND p.deleted_at IS NULL AND p.status = 'active'").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM registries WHERE status = 'active' AND deleted_at IS NULL").first<{ n: number }>(),
    db.prepare(
      `SELECT strftime('%Y-%m', o.created_at, ${BD}) AS month, COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS revenue
         FROM orders o WHERE ${LIVE} AND o.created_at >= date('now', 'start of month', '-11 months') GROUP BY month ORDER BY month`,
    ).all<{ month: string; orders: number; revenue: number }>(),
    db.prepare("SELECT id, order_no, customer_name, customer_phone, district, total, payment_method, payment_status, status, risk_level, created_at FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 8").all(),
    db.prepare(
      `SELECT i.product_id, i.name_en, i.name_bn, MAX(i.image) AS image, SUM(i.quantity) AS qty, SUM(i.line_total) AS revenue
         FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${LIVE} AND o.created_at >= datetime('now', '-30 days')
        GROUP BY i.product_id ORDER BY qty DESC LIMIT 6`,
    ).all(),
    abandonedCount(c),
  ]);
  const series: { month: string; orders: number; revenue: number }[] = [];
  const d = new Date(Date.now() + 6 * 3600_000);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
    series.push(chart.results.find((r) => r.month === m) ?? { month: m, orders: 0, revenue: 0 });
  }
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
  return c.json({
    kpis: {
      todayOrders: { value: today?.orders ?? 0, change: pct(today?.orders ?? 0, yesterday?.orders ?? 0) },
      todayRevenue: { value: today?.revenue ?? 0, change: pct(today?.revenue ?? 0, yesterday?.revenue ?? 0) },
      monthRevenue: { value: month?.revenue ?? 0, orders: month?.orders ?? 0, change: pct(month?.revenue ?? 0, lastMonth?.revenue ?? 0) },
      pendingCod: { value: pendingCod?.n ?? 0, amount: pendingCod?.amount ?? 0 },
      lowStock: { value: lowStock?.n ?? 0 },
      activeRegistries: { value: registries?.n ?? 0 },
      abandoned: { value: abandonedOpen },
    },
    salesChart: series,
    recentOrders: recent.results,
    topProducts: top.results,
  });
});

async function abandonedCount(c: Context<AppEnv>): Promise<number> {
  const ab = await getSetting(c.env, "abandoned");
  const cutoff = new Date(Date.now() - ab.minutes * 60_000).toISOString();
  const r = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM abandoned_checkouts WHERE status = 'open' AND phone IS NOT NULL AND updated_at < ?").bind(cutoff).first<{ n: number }>();
  return r?.n ?? 0;
}

/** One prioritised list for a busy owner each morning. */
app.get("/attention", perm("dashboard.view"), async (c) => {
  const ab = await getSetting(c.env, "abandoned");
  const cutoff = new Date(Date.now() - ab.minutes * 60_000).toISOString();
  const [calls, abandoned, lowStock, reviews, returns, waiting, unpaidMfs] = await Promise.all([
    c.env.DB.prepare(
      `SELECT o.id, o.order_no, o.customer_name, o.customer_phone, o.total, o.status, o.risk_level, o.otp_verified, o.created_at,
              (SELECT COUNT(*) FROM order_confirmation_attempts a WHERE a.order_id = o.id) AS attempts
         FROM orders o WHERE o.deleted_at IS NULL AND (o.status IN ('pending','confirmation_attempted')
           OR (o.status IN ('confirmed','packed') AND o.payment_status != 'paid' AND o.risk_level != 'low'
               AND NOT EXISTS (SELECT 1 FROM order_confirmation_attempts a WHERE a.order_id = o.id AND a.outcome = 'confirmed')))
        ORDER BY CASE o.risk_level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, o.created_at LIMIT 30`,
    ).all(),
    c.env.DB.prepare("SELECT id, name, phone, cart_total, last_step, updated_at FROM abandoned_checkouts WHERE status = 'open' AND phone IS NOT NULL AND updated_at < ? ORDER BY updated_at DESC LIMIT 20").bind(cutoff).all(),
    c.env.DB.prepare(
      "SELECT v.id, v.sku, v.size, v.stock, v.low_stock_threshold, p.id AS product_id, p.name_en, p.name_bn FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.stock <= v.low_stock_threshold AND p.status = 'active' AND p.deleted_at IS NULL ORDER BY v.stock LIMIT 20",
    ).all(),
    c.env.DB.prepare("SELECT r.id, r.name, r.rating, r.body, p.name_en AS product FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.status = 'pending' AND r.deleted_at IS NULL ORDER BY r.created_at LIMIT 20").all(),
    c.env.DB.prepare("SELECT r.id, r.reason, r.created_at, o.order_no, o.id AS order_id, o.customer_name FROM return_requests r JOIN orders o ON o.id = r.order_id WHERE r.status = 'requested' ORDER BY r.created_at LIMIT 20").all(),
    c.env.DB.prepare(
      `SELECT p.id, p.name_en, p.name_bn, COUNT(*) AS n FROM stock_notify_requests s JOIN products p ON p.id = s.product_id
        WHERE s.notified_at IS NULL AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = s.product_id AND v.stock > 0 AND (s.variant_id IS NULL OR s.variant_id = v.id))
        GROUP BY p.id LIMIT 20`,
    ).all(),
    c.env.DB.prepare("SELECT id, order_no, customer_name, payment_method, payment_ref, total FROM orders WHERE payment_method IN ('bKash','Nagad','Rocket') AND payment_status = 'pending' AND payment_ref IS NOT NULL AND status NOT IN ('cancelled','refused','returned') AND deleted_at IS NULL LIMIT 20").all(),
  ]);
  return c.json({
    confirmationCalls: calls.results,
    abandoned: abandoned.results,
    lowStock: lowStock.results,
    pendingReviews: reviews.results,
    returnRequests: returns.results,
    backInStock: waiting.results,
    paymentsToVerify: unpaidMfs.results,
  });
});

type Line = { key: string; ok: boolean | "partial"; en: string; bn: string; help_en?: string; help_bn?: string };

/** Plain-language "what's live" strip. */
app.get("/health", perm("dashboard.view"), async (c) => {
  const e = c.env;
  const [payments, integ, lastBackup, capiFail] = await Promise.all([
    getSetting(e, "payments"),
    getSetting(e, "integrations"),
    e.KV.get("backup:last"),
    e.DB.prepare("SELECT COUNT(*) AS n FROM marketing_events WHERE status = 'failed' AND created_at >= datetime('now', '-1 day')").first<{ n: number }>(),
  ]);
  const mfs = [payments.bkash.enabled && (payments.bkash.manualNumber || bkashConfigured(e)) ? "bKash" : "", payments.nagad.enabled && payments.nagad.manualNumber ? "Nagad" : "", payments.rocket.enabled && payments.rocket.manualNumber ? "Rocket" : ""].filter(Boolean);
  const courier = [steadfastConfigured(e) ? "Steadfast" : "", pathaoConfigured(e) ? "Pathao" : ""].filter(Boolean);
  const fb = integ.metaPixelId && e.META_CAPI_TOKEN ? true : integ.metaPixelId ? "partial" : false;
  const lines: Line[] = [
    { key: "payment", ok: payments.cod.enabled || mfs.length > 0, en: `Payment: Cash on Delivery ${payments.cod.enabled ? "on" : "off"}${mfs.length ? `, ${mfs.join(", ")} connected` : ", mobile banking not connected yet"}`, bn: `পেমেন্ট: ক্যাশ অন ডেলিভারি ${payments.cod.enabled ? "চালু" : "বন্ধ"}${mfs.length ? `, ${mfs.join(", ")} যুক্ত` : ", মোবাইল ব্যাংকিং এখনো যুক্ত হয়নি"}` },
    { key: "card", ok: payments.card.enabled && sslczConfigured(e), en: `Card payment: ${sslczConfigured(e) ? (payments.card.enabled ? "connected" : "ready, switched off") : "not connected yet"}`, bn: `কার্ড পেমেন্ট: ${sslczConfigured(e) ? (payments.card.enabled ? "যুক্ত" : "প্রস্তুত, বন্ধ আছে") : "এখনো যুক্ত হয়নি"}` },
    { key: "courier", ok: courier.length > 0, en: `Courier: ${courier.length ? `${courier.join(", ")} connected` : "not connected yet (tracking IDs can be typed by hand)"}`, bn: `কুরিয়ার: ${courier.length ? `${courier.join(", ")} যুক্ত` : "এখনো যুক্ত হয়নি (ট্র্যাকিং আইডি হাতে লেখা যাবে)"}` },
    { key: "sms", ok: smsConfigured(e), en: `SMS: ${smsConfigured(e) ? "connected" : "not connected yet — order messages and phone verification are off"}`, bn: `SMS: ${smsConfigured(e) ? "যুক্ত" : "এখনো যুক্ত হয়নি — অর্ডার মেসেজ ও ফোন যাচাই বন্ধ"}` },
    { key: "whatsapp", ok: whatsappConfigured(e) ? true : integ.whatsappConnected ? "partial" : false, en: `WhatsApp: ${whatsappConfigured(e) ? "connected (automatic messages)" : integ.whatsappConnected ? "chat button on (automatic messages not connected)" : "not connected yet"}`, bn: `হোয়াটসঅ্যাপ: ${whatsappConfigured(e) ? "যুক্ত (স্বয়ংক্রিয় মেসেজ)" : integ.whatsappConnected ? "চ্যাট বাটন চালু (স্বয়ংক্রিয় মেসেজ যুক্ত নয়)" : "এখনো যুক্ত হয়নি"}` },
    { key: "facebook", ok: fb, en: `Facebook tracking: ${fb === true ? "connected (browser + server)" : fb ? "browser only — add the Conversions API token" : "not connected yet"}${capiFail?.n ? ` · ${capiFail.n} failed in 24h` : ""}`, bn: `ফেসবুক ট্র্যাকিং: ${fb === true ? "যুক্ত (ব্রাউজার + সার্ভার)" : fb ? "শুধু ব্রাউজার — Conversions API টোকেন যোগ করুন" : "এখনো যুক্ত হয়নি"}` },
    { key: "google", ok: Boolean(integ.ga4Id), en: `Google Analytics: ${integ.ga4Id ? "connected" : "not connected yet"}${integ.googleAdsId ? " · Google Ads conversions on" : ""}`, bn: `গুগল অ্যানালিটিক্স: ${integ.ga4Id ? "যুক্ত" : "এখনো যুক্ত হয়নি"}` },
    { key: "clarity", ok: Boolean(integ.clarityId), en: `Microsoft Clarity (heatmaps): ${integ.clarityId ? "connected" : "not connected yet"}`, bn: `মাইক্রোসফট ক্ল্যারিটি (হিটম্যাপ): ${integ.clarityId ? "যুক্ত" : "এখনো যুক্ত হয়নি"}` },
    { key: "fraud", ok: Boolean(e.FRAUD_CHECK_API_URL), en: `Courier fraud check: ${e.FRAUD_CHECK_API_URL ? "connected" : "not connected yet — we still use your own delivery history"}`, bn: `কুরিয়ার ফ্রড চেক: ${e.FRAUD_CHECK_API_URL ? "যুক্ত" : "এখনো যুক্ত হয়নি — আপনার নিজের ডেলিভারি রেকর্ড ব্যবহার হচ্ছে"}` },
    { key: "bots", ok: Boolean(e.TURNSTILE_SECRET), en: `Bot protection at checkout: ${e.TURNSTILE_SECRET ? "on" : "off (limits still apply)"}`, bn: `চেকআউটে বট সুরক্ষা: ${e.TURNSTILE_SECRET ? "চালু" : "বন্ধ (সীমা প্রযোজ্য)"}` },
    { key: "email", ok: emailConfigured(e), en: `Email: ${emailConfigured(e) ? "connected" : "not connected yet"}`, bn: `ইমেইল: ${emailConfigured(e) ? "যুক্ত" : "এখনো যুক্ত হয়নি"}` },
    { key: "push", ok: pushConfigured(e), en: `App notifications: ${pushConfigured(e) ? "connected" : "not connected yet"}`, bn: `অ্যাপ নোটিফিকেশন: ${pushConfigured(e) ? "যুক্ত" : "এখনো যুক্ত হয়নি"}` },
    { key: "backup", ok: Boolean(lastBackup), en: `Backups: ${lastBackup ? `last copy ${lastBackup.slice(0, 16).replace("T", " ")} UTC` : "no copy yet (runs every night)"}`, bn: `ব্যাকআপ: ${lastBackup ? `শেষ কপি ${lastBackup.slice(0, 16).replace("T", " ")} UTC` : "এখনো কপি হয়নি (প্রতি রাতে চলে)"}` },
  ];
  return c.json({ lines });
});

/** First-run checklist: each step is one simple action. */
app.get("/onboarding", perm("dashboard.view"), async (c) => {
  const [product, zone, payments, store, integ, ob] = await Promise.all([
    c.env.DB.prepare("SELECT 1 FROM audit_log WHERE entity = 'product' AND action IN ('create','import') LIMIT 1").first(),
    c.env.DB.prepare("SELECT 1 FROM audit_log WHERE entity = 'delivery_zone' AND action IN ('create','update') LIMIT 1").first(),
    c.env.DB.prepare("SELECT value FROM settings WHERE key = 'payments'").first<{ value: string }>(),
    c.env.DB.prepare("SELECT 1 FROM settings WHERE key = 'store'").first(),
    getSetting(c.env, "integrations"),
    getSetting(c.env, "onboarding"),
  ]);
  const steps = [
    { key: "store", done: Boolean(store), link: "#/settings/store", en: "Check your shop name, phone and address", bn: "দোকানের নাম, ফোন ও ঠিকানা দেখে নিন" },
    { key: "product", done: Boolean(product), link: "#/products/new", en: "Add your first product", bn: "প্রথম পণ্য যোগ করুন" },
    { key: "zone", done: Boolean(zone), link: "#/zones", en: "Set a delivery area and fee", bn: "ডেলিভারি এলাকা ও চার্জ ঠিক করুন" },
    { key: "payment", done: Boolean(payments), link: "#/settings/payments", en: "Connect a payment method (Cash on Delivery, bKash, Nagad…)", bn: "পেমেন্ট পদ্ধতি যুক্ত করুন (ক্যাশ অন ডেলিভারি, বিকাশ, নগদ…)" },
    { key: "whatsapp", done: whatsappConfigured(c.env) || integ.whatsappConnected, link: "#/settings/integrations", en: "Connect WhatsApp", bn: "হোয়াটসঅ্যাপ যুক্ত করুন" },
  ];
  return c.json({ steps, dismissed: ob.dismissed, complete: steps.every((s) => s.done) });
});

// ---------------------------------------------------------------- reports
const range = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  group: z.enum(["day", "month", "category", "product", "payment", "zone", "campaign"]).default("day"),
  format: z.enum(["json", "csv"]).default("json"),
});

function dateWhere(from?: string, to?: string): { sql: string; args: string[] } {
  const f = from ?? new Date(Date.now() + 6 * 3600_000 - 29 * 86400_000).toISOString().slice(0, 10);
  const t = to ?? new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
  return { sql: `date(o.created_at, ${BD}) BETWEEN ? AND ?`, args: [f, t] };
}

async function respond(c: Context<AppEnv>, name: string, rows: Record<string, unknown>[], format: string, extra: Record<string, unknown> = {}) {
  if (format === "csv") {
    await audit(c, "export", "report", name, { rows: rows.length });
    return csvResponse(name, rows);
  }
  return c.json({ rows, ...extra });
}

app.get("/reports/sales", perm("reports.view"), async (c) => {
  const q = validate(range, c.req.query());
  const w = dateWhere(q.from, q.to);
  const sql = {
    day: `SELECT date(o.created_at, ${BD}) AS label, COUNT(*) AS orders, SUM(o.subtotal) AS merchandise, SUM(o.discount) AS discounts, SUM(o.delivery_fee) AS delivery, SUM(o.total) AS revenue FROM orders o WHERE ${LIVE} AND ${w.sql} GROUP BY label ORDER BY label`,
    month: `SELECT strftime('%Y-%m', o.created_at, ${BD}) AS label, COUNT(*) AS orders, SUM(o.subtotal) AS merchandise, SUM(o.discount) AS discounts, SUM(o.delivery_fee) AS delivery, SUM(o.total) AS revenue FROM orders o WHERE ${LIVE} AND ${w.sql} GROUP BY label ORDER BY label`,
    category: `SELECT COALESCE(c.name_en, 'Uncategorised') AS label, COUNT(DISTINCT o.id) AS orders, SUM(i.quantity) AS units, SUM(i.line_total) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN categories c ON c.id = i.category_id WHERE ${LIVE} AND ${w.sql} GROUP BY label ORDER BY revenue DESC`,
    product: `SELECT i.name_en AS label, MIN(i.sku) AS sku, COUNT(DISTINCT o.id) AS orders, SUM(i.quantity) AS units, SUM(i.line_total) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${LIVE} AND ${w.sql} GROUP BY i.product_id ORDER BY revenue DESC LIMIT 200`,
    payment: `SELECT o.payment_method AS label, COUNT(*) AS orders, SUM(o.total) AS revenue, SUM(CASE WHEN o.payment_status = 'paid' THEN o.total ELSE 0 END) AS collected FROM orders o WHERE ${LIVE} AND ${w.sql} GROUP BY label ORDER BY revenue DESC`,
    zone: `SELECT o.zone_code AS label, COUNT(*) AS orders, SUM(o.delivery_fee) AS delivery, SUM(o.total) AS revenue FROM orders o WHERE ${LIVE} AND ${w.sql} GROUP BY label ORDER BY orders DESC`,
    // Revenue by ad campaign (UTM) — not just by product.
    campaign: `SELECT COALESCE(o.utm_source, '(direct)') AS source, COALESCE(o.utm_medium, '') AS medium, COALESCE(o.utm_campaign, '') AS label, COUNT(*) AS orders, SUM(o.total) AS revenue,
                 SUM(CASE WHEN o.status = 'delivered' THEN o.total ELSE 0 END) AS delivered_revenue FROM orders o WHERE ${LIVE} AND ${w.sql} GROUP BY source, medium, label ORDER BY revenue DESC`,
  }[q.group];
  const { results } = await c.env.DB.prepare(sql).bind(...w.args).all<Record<string, unknown>>();
  const totals = await c.env.DB.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS revenue, COALESCE(AVG(o.total),0) AS aov FROM orders o WHERE ${LIVE} AND ${w.sql}`).bind(...w.args).first();
  return respond(c, `sales-by-${q.group}`, results, q.format, { totals });
});

app.get("/reports/best-sellers", perm("reports.view"), async (c) => {
  const q = validate(range, c.req.query());
  const w = dateWhere(q.from, q.to);
  const { results } = await c.env.DB.prepare(
    `SELECT i.sku, i.name_en AS product, i.size, SUM(i.quantity) AS units, SUM(i.line_total) AS revenue,
            (SELECT stock FROM product_variants v WHERE v.id = i.variant_id) AS stock_now
       FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${LIVE} AND ${w.sql} GROUP BY i.sku ORDER BY units DESC LIMIT 100`,
  )
    .bind(...w.args)
    .all<Record<string, unknown>>();
  return respond(c, "best-sellers", results, q.format);
});

/** Outcomes kept separate on purpose: cancelled ≠ refused at delivery ≠ returned. */
app.get("/reports/outcomes", perm("reports.view"), async (c) => {
  const q = validate(range, c.req.query());
  const w = dateWhere(q.from, q.to);
  const { results } = await c.env.DB.prepare(
    `SELECT COALESCE(o.courier_partner, '(not shipped)') AS label, COUNT(*) AS orders,
            SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
            SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN o.status = 'refused' THEN 1 ELSE 0 END) AS refused_at_delivery,
            SUM(CASE WHEN o.status = 'returned' THEN 1 ELSE 0 END) AS returned,
            ROUND(100.0 * SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN o.status IN ('delivered','refused','returned') THEN 1 ELSE 0 END), 0), 1) AS success_rate
       FROM orders o WHERE o.deleted_at IS NULL AND ${w.sql} GROUP BY label ORDER BY orders DESC`,
  )
    .bind(...w.args)
    .all<Record<string, unknown>>();
  return respond(c, "delivery-outcomes", results, q.format);
});

app.get("/reports/customers", perm("reports.view"), async (c) => {
  const q = validate(range, c.req.query());
  const w = dateWhere(q.from, q.to);
  const { results } = await c.env.DB.prepare(
    `SELECT o.customer_name AS name, o.customer_phone AS phone, MAX(o.district) AS district, COUNT(*) AS orders, SUM(o.total) AS spent, MAX(o.created_at) AS last_order
       FROM orders o WHERE ${LIVE} AND ${w.sql} GROUP BY o.customer_phone ORDER BY spent DESC LIMIT 100`,
  )
    .bind(...w.args)
    .all<Record<string, unknown>>();
  return respond(c, "best-customers", results, q.format);
});

app.get("/reports/abandoned", perm("reports.view"), async (c) => {
  const q = validate(range, c.req.query());
  const f = q.from ?? new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const t = q.to ?? new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
  const { results } = await c.env.DB.prepare(
    `SELECT date(created_at, ${BD}) AS label, COUNT(*) AS started,
            SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) AS with_phone,
            SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'recovered' THEN 1 ELSE 0 END) AS recovered,
            SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) AS not_interested,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS still_open,
            SUM(CASE WHEN status = 'recovered' THEN cart_total ELSE 0 END) AS recovered_value
       FROM abandoned_checkouts WHERE date(created_at, ${BD}) BETWEEN ? AND ? GROUP BY label ORDER BY label`,
  )
    .bind(f, t)
    .all<Record<string, unknown>>();
  return respond(c, "checkout-funnel", results, q.format);
});

export default app;
