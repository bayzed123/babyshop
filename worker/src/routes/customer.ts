/**
 * Customer accounts — register/login with mobile number, password reset by SMS code, profile, order history,
 * saved addresses, wishlist, gift registries, return requests, referral code and reorder reminders.
 */
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../env";
import { ApiError, body, E, SQL_NOW } from "../lib/http";
import { bdPhone, loginSchema, registerSchema, registryItemSchema, registrySchema, returnRequestSchema, savedAddressSchema } from "../lib/schemas";
import { hashPassword, randomCode, randomDigits, randomToken, safeEqualStr, verifyPassword } from "../lib/crypto";
import { CUSTOMER_COOKIE, CUSTOMER_TTL, getSetting, loadZones, rateLimit, verifyTurnstile } from "../lib/store";
import { optionalCustomer, requireCustomer } from "../middleware";
import { renderTemplate, sendSms } from "../lib/notify";
import { resolveZone } from "../lib/pricing";
import { PRODUCT_CARD_COLUMNS, toCard, type CardRow } from "./public";

const app = new Hono<AppEnv>();

async function startSession(c: Context<AppEnv>, cust: { id: number; name: string; phone: string }) {
  const token = randomToken();
  await c.env.KV.put(`s:c:${token}`, JSON.stringify({ id: cust.id, name: cust.name, phone: cust.phone }), { expirationTtl: CUSTOMER_TTL });
  setCookie(c, CUSTOMER_COOKIE, token, { httpOnly: true, secure: c.env.ENVIRONMENT !== "development", sameSite: "Lax", path: "/", maxAge: CUSTOMER_TTL });
}

app.post("/auth/register", async (c) => {
  await rateLimit(c, "register", 5, 3600);
  const b = await body(c, registerSchema);
  await verifyTurnstile(c, b.turnstileToken);
  const existing = await c.env.DB.prepare("SELECT id, password_hash FROM customers WHERE phone = ?").bind(b.phone).first<{ id: number; password_hash: string | null }>();
  if (existing?.password_hash) throw E.conflict("An account with this mobile number already exists. Please sign in.", "এই মোবাইল নম্বরে আগেই অ্যাকাউন্ট আছে। সাইন ইন করুন।");
  const hash = await hashPassword(b.password);
  let id: number;
  if (existing) {
    // A guest who ordered before claims their record, so past orders appear in their history.
    await c.env.DB.prepare(`UPDATE customers SET name = ?, email = COALESCE(?, email), password_hash = ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(b.name, b.email, hash, existing.id).run();
    await c.env.DB.prepare("UPDATE orders SET customer_id = ? WHERE customer_phone = ? AND customer_id IS NULL").bind(existing.id, b.phone).run();
    id = existing.id;
  } else {
    const r = await c.env.DB.prepare("INSERT INTO customers (name, phone, email, password_hash) VALUES (?, ?, ?, ?)").bind(b.name, b.phone, b.email, hash).run();
    id = Number(r.meta.last_row_id);
  }
  await startSession(c, { id, name: b.name, phone: b.phone });
  return c.json({ ok: true, customer: { id, name: b.name, phone: b.phone } }, 201);
});

app.post("/auth/login", async (c) => {
  await rateLimit(c, "cust-login", 10, 900);
  const b = await body(c, loginSchema);
  await verifyTurnstile(c, b.turnstileToken);
  const cust = await c.env.DB.prepare("SELECT id, name, phone, password_hash, is_blocked FROM customers WHERE phone = ? AND deleted_at IS NULL")
    .bind(b.phone)
    .first<{ id: number; name: string; phone: string; password_hash: string | null; is_blocked: number }>();
  if (!cust || !(await verifyPassword(b.password, cust.password_hash))) {
    throw new ApiError(401, "bad_credentials", "Mobile number or password is incorrect.", "মোবাইল নম্বর বা পাসওয়ার্ড সঠিক নয়।");
  }
  if (cust.is_blocked) throw new ApiError(403, "blocked", "This account is paused. Please call us for help.", "এই অ্যাকাউন্টটি বন্ধ আছে। সাহায্যের জন্য কল করুন।");
  await c.env.DB.prepare(`UPDATE customers SET last_login_at = ${SQL_NOW} WHERE id = ?`).bind(cust.id).run();
  await startSession(c, cust);
  return c.json({ ok: true, customer: { id: cust.id, name: cust.name, phone: cust.phone } });
});

app.post("/auth/logout", async (c) => {
  const token = getCookie(c, CUSTOMER_COOKIE);
  if (token) await c.env.KV.delete(`s:c:${token}`);
  deleteCookie(c, CUSTOMER_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// Password reset via a 6-digit SMS code (KV, 10 minutes, max 5 tries).
app.post("/auth/reset/request", async (c) => {
  await rateLimit(c, "reset", 5, 3600);
  const { phone, lang } = await body(c, z.object({ phone: bdPhone, lang: z.enum(["bn", "en"]).default("bn") }));
  const cust = await c.env.DB.prepare("SELECT id FROM customers WHERE phone = ? AND password_hash IS NOT NULL AND deleted_at IS NULL").bind(phone).first();
  let devCode: string | undefined;
  if (cust) {
    const code = randomDigits(6);
    await c.env.KV.put(`otp:reset:${phone}`, JSON.stringify({ code, tries: 0 }), { expirationTtl: 600 });
    const msg = (await renderTemplate(c.env, "otp", lang, { code })) ?? code;
    c.executionCtx.waitUntil(sendSms(c.env, phone, msg, "otp"));
    if (c.env.ENVIRONMENT === "development") devCode = code;
  }
  // Same answer whether or not the number exists (prevents account enumeration).
  return c.json({ ok: true, en: "If this number has an account, we've sent a 6-digit code by SMS.", bn: "এই নম্বরে অ্যাকাউন্ট থাকলে ৬ সংখ্যার একটি কোড SMS এ পাঠানো হয়েছে।", devCode });
});

app.post("/auth/reset/confirm", async (c) => {
  await rateLimit(c, "reset-confirm", 10, 3600);
  const b = await body(c, z.object({ phone: bdPhone, code: z.string().regex(/^\d{6}$/), password: z.string().min(8).max(128) }));
  const key = `otp:reset:${b.phone}`;
  const raw = await c.env.KV.get(key);
  const stored = raw ? (JSON.parse(raw) as { code: string; tries: number }) : null;
  if (!stored || stored.tries >= 5) throw E.badRequest("The code has expired. Please request a new one.", "কোডের মেয়াদ শেষ। নতুন কোড চান।");
  if (!safeEqualStr(stored.code, b.code)) {
    await c.env.KV.put(key, JSON.stringify({ ...stored, tries: stored.tries + 1 }), { expirationTtl: 600 });
    throw E.badRequest("The code is not correct.", "কোডটি সঠিক নয়।");
  }
  await c.env.KV.delete(key);
  await c.env.DB.prepare(`UPDATE customers SET password_hash = ?, phone_verified_at = ${SQL_NOW}, updated_at = ${SQL_NOW} WHERE phone = ?`).bind(await hashPassword(b.password), b.phone).run();
  return c.json({ ok: true, en: "Password updated. Please sign in.", bn: "পাসওয়ার্ড পরিবর্তন হয়েছে। সাইন ইন করুন।" });
});

/** Who is signed in (null for guests) — lets the storefront check without triggering a 401. */
app.get("/session", optionalCustomer, async (c) => {
  const s = c.get("customer");
  if (!s) return c.json({ customer: null });
  const cust = await c.env.DB.prepare("SELECT id, name, phone, email, reminder_opt_in, created_at FROM customers WHERE id = ? AND deleted_at IS NULL").bind(s.id).first();
  return c.json({ customer: cust ?? null });
});

// ---------------------------------------------------------------- signed-in account
const me = new Hono<AppEnv>();
me.use("*", requireCustomer);
const cid = (c: Context<AppEnv>) => c.get("customer")!.id;

me.get("/", async (c) => {
  const cust = await c.env.DB.prepare("SELECT id, name, phone, email, reminder_opt_in, created_at FROM customers WHERE id = ?").bind(cid(c)).first();
  if (!cust) throw E.unauthorized();
  return c.json({ customer: cust });
});

me.put("/", async (c) => {
  const b = await body(
    c,
    z.object({
      name: z.string().trim().min(1).max(80),
      email: z.union([z.literal(""), z.email()]).optional().transform((v) => v || null),
      reminder_opt_in: z.boolean().optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).max(128).optional(),
    }),
  );
  if (b.newPassword) {
    const row = await c.env.DB.prepare("SELECT password_hash FROM customers WHERE id = ?").bind(cid(c)).first<{ password_hash: string }>();
    if (!(await verifyPassword(b.currentPassword ?? "", row?.password_hash))) throw E.badRequest("Current password is incorrect.", "বর্তমান পাসওয়ার্ড সঠিক নয়।");
    await c.env.DB.prepare("UPDATE customers SET password_hash = ? WHERE id = ?").bind(await hashPassword(b.newPassword), cid(c)).run();
  }
  await c.env.DB.prepare(`UPDATE customers SET name = ?, email = ?, reminder_opt_in = COALESCE(?, reminder_opt_in), updated_at = ${SQL_NOW} WHERE id = ?`)
    .bind(b.name, b.email, b.reminder_opt_in == null ? null : b.reminder_opt_in ? 1 : 0, cid(c))
    .run();
  if (b.reminder_opt_in === false) {
    await c.env.DB.prepare("UPDATE reorder_reminders SET status = 'cancelled' WHERE phone = ? AND status = 'scheduled'").bind(c.get("customer")!.phone).run();
  }
  return c.json({ ok: true, en: "Saved.", bn: "সংরক্ষণ করা হয়েছে।" });
});

me.get("/orders", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.order_no, o.invoice_no, o.public_token, o.status, o.total, o.payment_method, o.payment_status, o.created_at, o.delivered_at, o.courier_partner, o.tracking_id,
            (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count,
            (SELECT image FROM order_items WHERE order_id = o.id LIMIT 1) AS image,
            (SELECT status FROM return_requests WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS return_status
       FROM orders o WHERE (o.customer_id = ? OR o.customer_phone = ?) AND o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 100`,
  )
    .bind(cid(c), c.get("customer")!.phone)
    .all();
  return c.json({ orders: results });
});

// ---------- Addresses ----------
me.get("/addresses", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC").bind(cid(c)).all();
  return c.json({ addresses: results });
});

async function saveAddress(c: Context<AppEnv>, id: number | null) {
  const a = await body(c, savedAddressSchema);
  const customer = cid(c);
  const zone = resolveZone(await loadZones(c.env), a.division_id, a.district_id, a.upazila_id);
  if (a.is_default) await c.env.DB.prepare("UPDATE addresses SET is_default = 0 WHERE customer_id = ?").bind(customer).run();
  if (id) {
    const r = await c.env.DB.prepare(
      "UPDATE addresses SET label=?, recipient_name=?, phone=?, division_id=?, district_id=?, upazila_id=?, division=?, district=?, upazila=?, area=?, zone_code=?, is_default=? WHERE id=? AND customer_id=?",
    )
      .bind(a.label, a.recipient_name, a.phone, a.division_id, a.district_id, a.upazila_id, a.division, a.district, a.upazila, a.area, zone?.code ?? null, a.is_default, id, customer)
      .run();
    if (!r.meta.changes) throw E.notFound("Address");
    return c.json({ ok: true, id });
  }
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM addresses WHERE customer_id = ?").bind(customer).first<{ n: number }>();
  if ((count?.n ?? 0) >= 10) throw E.badRequest("You can save up to 10 addresses.", "সর্বোচ্চ ১০টি ঠিকানা সংরক্ষণ করা যায়।");
  const r = await c.env.DB.prepare(
    "INSERT INTO addresses (customer_id, label, recipient_name, phone, division_id, district_id, upazila_id, division, district, upazila, area, zone_code, is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  )
    .bind(customer, a.label, a.recipient_name, a.phone, a.division_id, a.district_id, a.upazila_id, a.division, a.district, a.upazila, a.area, zone?.code ?? null, a.is_default || (count?.n ?? 0) === 0 ? 1 : 0)
    .run();
  return c.json({ ok: true, id: Number(r.meta.last_row_id) }, 201);
}
me.post("/addresses", (c) => saveAddress(c, null));
me.put("/addresses/:id{[0-9]+}", (c) => saveAddress(c, Number(c.req.param("id"))));
me.delete("/addresses/:id{[0-9]+}", async (c) => {
  const id = Number(c.req.param("id"));
  const used = await c.env.DB.prepare("SELECT 1 FROM registries WHERE address_id = ? AND deleted_at IS NULL AND status = 'active'").bind(id).first();
  if (used) throw E.badRequest("This address is used by an active gift registry. Change the registry first.", "এই ঠিকানাটি একটি চালু গিফট রেজিস্ট্রিতে ব্যবহার হচ্ছে। আগে রেজিস্ট্রি পরিবর্তন করুন।");
  await c.env.DB.prepare("DELETE FROM addresses WHERE id = ? AND customer_id = ?").bind(id, cid(c)).run();
  return c.json({ ok: true });
});

// ---------- Wishlist ----------
me.get("/wishlist", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_CARD_COLUMNS} FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.customer_id = ? AND p.deleted_at IS NULL AND p.status = 'active' ORDER BY w.created_at DESC`,
  )
    .bind(cid(c))
    .all<CardRow>();
  return c.json({ items: results.map(toCard) });
});
me.post("/wishlist/:productId{[0-9]+}", async (c) => {
  await c.env.DB.prepare("INSERT OR IGNORE INTO wishlist (customer_id, product_id) SELECT ?, id FROM products WHERE id = ?").bind(cid(c), Number(c.req.param("productId"))).run();
  return c.json({ ok: true });
});
me.delete("/wishlist/:productId{[0-9]+}", async (c) => {
  await c.env.DB.prepare("DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?").bind(cid(c), Number(c.req.param("productId"))).run();
  return c.json({ ok: true });
});

// ---------- Gift registries ----------
async function ownRegistry(c: Context<AppEnv>, id: number) {
  const r = await c.env.DB.prepare("SELECT * FROM registries WHERE id = ? AND customer_id = ? AND deleted_at IS NULL").bind(id, cid(c)).first<{ id: number; slug: string }>();
  if (!r) throw E.notFound("Registry");
  return r;
}

me.get("/registries", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, (SELECT COUNT(*) FROM registry_items i WHERE i.registry_id = r.id) AS item_count,
            (SELECT COALESCE(SUM(quantity_purchased),0) FROM registry_items i WHERE i.registry_id = r.id) AS gifts_bought
       FROM registries r WHERE r.customer_id = ? AND r.deleted_at IS NULL ORDER BY r.id DESC`,
  )
    .bind(cid(c))
    .all();
  return c.json({ registries: results });
});

async function saveRegistry(c: Context<AppEnv>, id: number | null) {
  const b = await body(c, registrySchema);
  if (b.address_id) {
    const own = await c.env.DB.prepare("SELECT 1 FROM addresses WHERE id = ? AND customer_id = ?").bind(b.address_id, cid(c)).first();
    if (!own) throw E.badRequest("Choose one of your saved addresses.", "আপনার সংরক্ষিত ঠিকানা থেকে একটি বেছে নিন।");
  }
  if (id) {
    await ownRegistry(c, id);
    await c.env.DB.prepare(`UPDATE registries SET title=?, event_type=?, event_date=?, baby_name=?, message=?, ship_to_parent=?, address_id=?, status=?, updated_at=${SQL_NOW} WHERE id=?`)
      .bind(b.title, b.event_type, b.event_date, b.baby_name, b.message, b.ship_to_parent, b.address_id ?? null, b.status, id)
      .run();
    return c.json({ ok: true, id });
  }
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM registries WHERE customer_id = ? AND deleted_at IS NULL").bind(cid(c)).first<{ n: number }>();
  if ((count?.n ?? 0) >= 5) throw E.badRequest("You can have up to 5 registries.", "সর্বোচ্চ ৫টি রেজিস্ট্রি রাখা যায়।");
  const slug = `${b.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "registry"}-${randomCode(6).toLowerCase()}`;
  const r = await c.env.DB.prepare("INSERT INTO registries (slug, customer_id, title, event_type, event_date, baby_name, message, ship_to_parent, address_id, status) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(slug, cid(c), b.title, b.event_type, b.event_date, b.baby_name, b.message, b.ship_to_parent, b.address_id ?? null, b.status)
    .run();
  return c.json({ ok: true, id: Number(r.meta.last_row_id), slug }, 201);
}
me.post("/registries", (c) => saveRegistry(c, null));
me.put("/registries/:id{[0-9]+}", (c) => saveRegistry(c, Number(c.req.param("id"))));
me.delete("/registries/:id{[0-9]+}", async (c) => {
  const r = await ownRegistry(c, Number(c.req.param("id")));
  await c.env.DB.prepare(`UPDATE registries SET deleted_at = ${SQL_NOW} WHERE id = ?`).bind(r.id).run();
  return c.json({ ok: true });
});
me.post("/registries/:id{[0-9]+}/items", async (c) => {
  const r = await ownRegistry(c, Number(c.req.param("id")));
  const b = await body(c, registryItemSchema);
  const p = await c.env.DB.prepare("SELECT id FROM products WHERE id = ? AND status = 'active' AND deleted_at IS NULL").bind(b.productId).first();
  if (!p) throw E.notFound("Product");
  const existing = await c.env.DB.prepare("SELECT id FROM registry_items WHERE registry_id = ? AND product_id = ? AND COALESCE(variant_id,0) = ?").bind(r.id, b.productId, b.variantId ?? 0).first<{ id: number }>();
  if (existing) {
    await c.env.DB.prepare("UPDATE registry_items SET quantity_wanted = quantity_wanted + ?, note = COALESCE(?, note) WHERE id = ?").bind(b.quantity, b.note, existing.id).run();
  } else {
    await c.env.DB.prepare("INSERT INTO registry_items (registry_id, product_id, variant_id, quantity_wanted, note) VALUES (?, ?, ?, ?, ?)").bind(r.id, b.productId, b.variantId ?? null, b.quantity, b.note).run();
  }
  return c.json({ ok: true, en: "Added to your registry.", bn: "রেজিস্ট্রিতে যোগ হয়েছে।" }, 201);
});
me.delete("/registries/:id{[0-9]+}/items/:itemId{[0-9]+}", async (c) => {
  const r = await ownRegistry(c, Number(c.req.param("id")));
  await c.env.DB.prepare("DELETE FROM registry_items WHERE id = ? AND registry_id = ?").bind(Number(c.req.param("itemId")), r.id).run();
  return c.json({ ok: true });
});

// ---------- Return requests (self-service, within 7 days of delivery) ----------
me.post("/returns", async (c) => {
  await rateLimit(c, "returns", 10, 3600);
  const b = await body(c, returnRequestSchema);
  const o = await c.env.DB.prepare("SELECT id, status, delivered_at FROM orders WHERE order_no = ? AND (customer_id = ? OR customer_phone = ?) AND deleted_at IS NULL")
    .bind(b.orderNo, cid(c), c.get("customer")!.phone)
    .first<{ id: number; status: string; delivered_at: string | null }>();
  if (!o) throw E.notFound("Order");
  if (o.status !== "delivered" || !o.delivered_at) throw E.badRequest("Returns can be requested after the order is delivered.", "ডেলিভারির পরেই রিটার্নের অনুরোধ করা যায়।");
  if (Date.now() - Date.parse(o.delivered_at) > 7 * 86400_000) throw E.badRequest("The 7-day return window for this order has passed. Please call us.", "এই অর্ডারের ৭ দিনের রিটার্ন সময় শেষ। আমাদের কল করুন।");
  const open = await c.env.DB.prepare("SELECT 1 FROM return_requests WHERE order_id = ? AND status IN ('requested','approved','received')").bind(o.id).first();
  if (open) throw E.conflict("A return request for this order is already in progress.", "এই অর্ডারের রিটার্ন অনুরোধ ইতিমধ্যে চলছে।");
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO return_requests (order_id, customer_id, reason, details) VALUES (?, ?, ?, ?)").bind(o.id, cid(c), b.reason, b.details),
    c.env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, 'delivered', ?, 'customer')").bind(o.id, `Return requested: ${b.reason}`),
  ]);
  return c.json({ ok: true, en: "Return request sent. We'll call you within 1 working day.", bn: "রিটার্নের অনুরোধ পাঠানো হয়েছে। ১ কর্মদিবসের মধ্যে আমরা কল করবো।" }, 201);
});

me.get("/returns", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT r.id, r.reason, r.details, r.status, r.refund_amount, r.admin_note, r.created_at, o.order_no FROM return_requests r JOIN orders o ON o.id = r.order_id WHERE r.customer_id = ? ORDER BY r.id DESC",
  )
    .bind(cid(c))
    .all();
  return c.json({ returns: results });
});

// ---------- Referral (give-and-get) ----------
me.get("/referral", async (c) => {
  const settings = await getSetting(c.env, "referral");
  if (!settings.enabled) return c.json({ enabled: false });
  let row = await c.env.DB.prepare("SELECT code, uses, rewards_earned, reward, friend_discount FROM referral_codes WHERE customer_id = ?").bind(cid(c)).first();
  if (!row) {
    const first = c.get("customer")!.name.split(" ")[0]!.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "FRIEND";
    const code = `${first}${randomCode(4)}`;
    await c.env.DB.prepare("INSERT OR IGNORE INTO referral_codes (code, customer_id, reward, friend_discount) VALUES (?, ?, ?, ?)").bind(code, cid(c), settings.reward, settings.friendDiscount).run();
    row = await c.env.DB.prepare("SELECT code, uses, rewards_earned, reward, friend_discount FROM referral_codes WHERE customer_id = ?").bind(cid(c)).first();
  }
  const rewards = await c.env.DB.prepare("SELECT code, value, expires_at, used_count FROM coupons WHERE kind = 'referral_reward' AND customer_phone = ? AND deleted_at IS NULL ORDER BY id DESC").bind(c.get("customer")!.phone).all();
  return c.json({ enabled: true, referral: row, rewards: rewards.results, minOrder: settings.minOrder });
});

// ---------- Reorder reminders ----------
me.get("/reminders", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, product_id, name_en, name_bn, due_at, status FROM reorder_reminders WHERE phone = ? ORDER BY due_at DESC LIMIT 50").bind(c.get("customer")!.phone).all();
  return c.json({ reminders: results });
});
me.delete("/reminders/:id{[0-9]+}", async (c) => {
  await c.env.DB.prepare("UPDATE reorder_reminders SET status = 'cancelled' WHERE id = ? AND phone = ? AND status = 'scheduled'").bind(Number(c.req.param("id")), c.get("customer")!.phone).run();
  return c.json({ ok: true });
});

app.route("/me", me);
export default app;

