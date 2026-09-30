/**
 * Inventory, settings, uploads (photos + certificate documents), audit log, notification bell, staff presence,
 * roles, category ordering, global search, staff 2FA reset, back-in-stock waiting list and AI description drafts.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../env";
import { body, E, intParam, likeText, SQL_NOW, validate } from "../../lib/http";
import { stockAdjustSchema } from "../../lib/schemas";
import { perm } from "../../middleware";
import { audit, expandCategoryIds, getSetting, putSetting } from "../../lib/store";
import { PERMISSIONS, ROLE_LABELS, ROLE_MATRIX } from "../../lib/rbac";
import { bkashConfigured, nagadConfigured, sslczConfigured } from "../../lib/payments";
import { pathaoConfigured, steadfastConfigured } from "../../lib/couriers";
import { emailConfigured, smsConfigured, whatsappConfigured } from "../../lib/notify";
import { pushConfigured } from "../../lib/push";
import { SETTING_DEFAULTS, type SettingKey } from "../../lib/settings";
import { csvResponse } from "./crud";

const app = new Hono<AppEnv>();

// ---------- Inventory ----------
app.get("/inventory", perm("inventory.read"), async (c) => {
  const q = c.req.query();
  const where = ["p.deleted_at IS NULL"];
  const args: unknown[] = [];
  if (q.q) {
    const like = likeText(q.q);
    where.push("(p.name_en LIKE ? OR p.name_bn LIKE ? OR v.sku LIKE ?)");
    args.push(like, like, like);
  }
  if (q.stock === "low") where.push("v.stock <= v.low_stock_threshold AND v.stock > 0");
  if (q.stock === "out") where.push("v.stock = 0");
  const w = where.join(" AND ");
  const sql = `SELECT v.id, v.product_id, v.sku, v.size, v.color, v.age_range, v.stock, v.low_stock_threshold, p.name_en, p.name_bn, p.slug, p.status,
      (SELECT COUNT(*) FROM stock_notify_requests s WHERE s.product_id = p.id AND (s.variant_id IS NULL OR s.variant_id = v.id) AND s.notified_at IS NULL) AS waiting
    FROM product_variants v JOIN products p ON p.id = v.product_id WHERE ${w} ORDER BY v.stock ASC, p.name_en`;
  if (q.format === "csv") {
    const rows = await c.env.DB.prepare(`${sql} LIMIT 20000`).bind(...args).all<Record<string, unknown>>();
    return csvResponse("inventory", rows.results, ["sku", "name_en", "size", "color", "age_range", "stock", "low_stock_threshold", "waiting", "status"]);
  }
  const limit = intParam(q.limit, 50, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM product_variants v JOIN products p ON p.id = v.product_id WHERE ${w}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(`${sql} LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all(),
  ]);
  const total = count?.n ?? 0;
  return c.json({ items: rows.results, total, page, pages: Math.ceil(total / limit) });
});

app.post("/inventory/adjust", perm("inventory.adjust"), async (c) => {
  const b = await body(c, z.object({ items: z.array(stockAdjustSchema).min(1).max(200) }));
  const actor = c.get("admin")!.name;
  const stmts: D1PreparedStatement[] = [];
  for (const it of b.items) {
    const change = it.mode === "set" ? "? - stock" : it.mode === "add" ? "?" : "-MIN(stock, ?)";
    const after = it.mode === "set" ? "?" : it.mode === "add" ? "stock + ?" : "MAX(0, stock - ?)";
    stmts.push(
      c.env.DB.prepare(`INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) SELECT product_id, id, sku, ${change}, ${after}, ?, ?, ? FROM product_variants WHERE id = ?`).bind(
        it.quantity, it.quantity, it.reason, it.note ?? null, actor, it.variantId,
      ),
      c.env.DB.prepare(`UPDATE product_variants SET stock = ${after}, updated_at = ${SQL_NOW} WHERE id = ?`).bind(it.quantity, it.variantId),
    );
  }
  await c.env.DB.batch(stmts);
  await audit(c, "stock_adjust", "inventory", null, b.items);
  return c.json({ ok: true, en: `Stock updated for ${b.items.length} item(s).`, bn: `${b.items.length}টি আইটেমের স্টক আপডেট হয়েছে।` });
});

app.get("/inventory/log", perm("inventory.read"), async (c) => {
  const q = c.req.query();
  const where = ["1=1"];
  const args: unknown[] = [];
  if (q.variant_id) {
    where.push("l.variant_id = ?");
    args.push(Number(q.variant_id));
  }
  if (q.reason) {
    where.push("l.reason = ?");
    args.push(q.reason);
  }
  if (q.q) {
    where.push("(l.sku LIKE ? OR p.name_en LIKE ? OR l.note LIKE ?)");
    const like = likeText(q.q);
    args.push(like, like, like);
  }
  const w = where.join(" AND ");
  const sql = `SELECT l.*, p.name_en, v.size, v.color FROM inventory_log l LEFT JOIN products p ON p.id = l.product_id LEFT JOIN product_variants v ON v.id = l.variant_id WHERE ${w} ORDER BY l.id DESC`;
  if (q.format === "csv") {
    const rows = await c.env.DB.prepare(`${sql} LIMIT 20000`).bind(...args).all<Record<string, unknown>>();
    return csvResponse("stock-log", rows.results, ["created_at", "sku", "name_en", "size", "change", "stock_after", "reason", "note", "actor"]);
  }
  const limit = intParam(q.limit, 50, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM inventory_log l LEFT JOIN products p ON p.id = l.product_id WHERE ${w}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(`${sql} LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all(),
  ]);
  const total = count?.n ?? 0;
  return c.json({ items: rows.results, total, page, pages: Math.ceil(total / limit) });
});

/** Everyone waiting for a back-in-stock message. */
app.get("/stock-notify", perm("inventory.read"), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.phone, s.email, s.created_at, s.notified_at, p.id AS product_id, p.name_en, p.name_bn, v.sku, v.size, COALESCE(v.stock, (SELECT SUM(stock) FROM product_variants x WHERE x.product_id = p.id)) AS stock
       FROM stock_notify_requests s JOIN products p ON p.id = s.product_id LEFT JOIN product_variants v ON v.id = s.variant_id ORDER BY s.notified_at IS NOT NULL, s.id DESC LIMIT 500`,
  ).all();
  return c.json({ items: results });
});

// ---------- Categories: drag-to-reorder ----------
app.put("/categories/reorder", perm("categories.write"), async (c) => {
  const b = await body(c, z.object({ items: z.array(z.object({ id: z.number().int().positive(), parent_id: z.number().int().positive().nullable(), sort_order: z.number().int().min(0) })).max(500) }));
  await c.env.DB.batch(
    b.items.map((it) =>
      c.env.DB.prepare(`UPDATE categories SET parent_id = ?, sort_order = ?, updated_at = ${SQL_NOW} WHERE id = ? AND (? IS NULL OR ? != id)`).bind(it.parent_id, it.sort_order, it.id, it.parent_id, it.parent_id),
    ),
  );
  await audit(c, "reorder", "category", null, { count: b.items.length });
  return c.json({ ok: true, en: "Order saved.", bn: "ক্রম সংরক্ষণ করা হয়েছে।" });
});

/**
 * One-tap Active / Inactive for a category. Turning a category off also turns off its sub-categories
 * (unless include_sub is false), so a hidden parent never leaves orphaned children in the menu.
 * Inactive categories disappear from the shop menu, home tiles, category page and sitemap; their
 * products stay on sale (set a product to Draft to hide it).
 */
app.put("/categories/:id{[0-9]+}/status", perm("categories.write"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, z.object({ is_active: z.boolean(), include_sub: z.boolean().default(true) }));
  const cat = await c.env.DB.prepare("SELECT id, parent_id, name_en, name_bn FROM categories WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: number; parent_id: number | null; name_en: string; name_bn: string }>();
  if (!cat) throw E.notFound("Category");
  const ids = b.include_sub ? await expandCategoryIds(c.env, [id]) : [id];
  await c.env.DB.prepare(`UPDATE categories SET is_active = ?, updated_at = ${SQL_NOW} WHERE id IN (${ids.map(() => "?").join(",")}) AND deleted_at IS NULL`)
    .bind(b.is_active ? 1 : 0, ...ids)
    .run();
  await audit(c, b.is_active ? "activate" : "deactivate", "category", id, { ids });
  const subs = ids.length - 1;
  let en = b.is_active ? `"${cat.name_en}" is active and shows in the shop.` : `"${cat.name_en}" is inactive and hidden from the shop.`;
  let bn = b.is_active ? `"${cat.name_bn}" চালু — দোকানে দেখাবে।` : `"${cat.name_bn}" বন্ধ — দোকানে দেখাবে না।`;
  if (subs > 0) {
    en += ` ${subs} sub-categor${subs === 1 ? "y was" : "ies were"} updated too.`;
    bn += ` ${subs}টি সাব-ক্যাটাগরিও আপডেট হয়েছে।`;
  }
  if (b.is_active && cat.parent_id) {
    const parent = await c.env.DB.prepare("SELECT is_active, name_en, name_bn FROM categories WHERE id = ?").bind(cat.parent_id).first<{ is_active: number; name_en: string; name_bn: string }>();
    if (parent && !parent.is_active) {
      en += ` Its parent "${parent.name_en}" is inactive, so it stays hidden until you turn that on.`;
      bn += ` এর মূল ক্যাটাগরি "${parent.name_bn}" বন্ধ আছে, তাই সেটি চালু না করা পর্যন্ত এটি দেখাবে না।`;
    }
  }
  return c.json({ ok: true, ids, en, bn });
});

// ---------- Settings ----------
const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];
const num = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const bool = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true"), z.number().transform(Boolean)]);
/** Typed validation for the settings whose values drive business rules. */
const SETTING_SCHEMAS: Partial<Record<SettingKey, z.ZodType>> = {
  fraud: z.object({ requireOtp: bool, autoConfirmTrusted: bool, trustedMinDelivered: num(1, 50), velocityWindowMin: num(5, 1440), velocityMaxPerPhone: num(1, 50), velocityMaxPerAddress: num(1, 50), velocityMaxPerIp: num(1, 100), courierCheck: bool }),
  abandoned: z.object({ minutes: num(5, 1440), retentionDays: num(1, 365), autoRecovery: bool, recoveryDelayMin: num(10, 2880), recoveryDiscount: num(0, 5000), recoveryValidHours: num(1, 720) }),
  automation: z.object({ reviewRequests: bool, reviewRequestDays: num(1, 30), reorderReminders: bool, reorderLeadDays: num(0, 30) }),
  tax: z.object({ enabled: bool, rate: z.coerce.number().min(0).max(30), inclusive: bool, bin: z.string().max(40) }),
  referral: z.object({ enabled: bool, friendDiscount: num(0, 5000), reward: num(0, 5000), minOrder: num(0, 100000) }),
};

app.get("/settings", perm("settings.read"), async (c) => {
  const entries = await Promise.all(SETTING_KEYS.map(async (k) => [k, await getSetting(c.env, k)] as const));
  return c.json({
    settings: Object.fromEntries(entries),
    defaults: SETTING_DEFAULTS,
    // Secrets are never returned — only whether each integration is configured.
    connected: {
      bkashApi: bkashConfigured(c.env),
      nagadApi: nagadConfigured(c.env),
      sslcommerz: sslczConfigured(c.env),
      steadfast: steadfastConfigured(c.env),
      pathao: pathaoConfigured(c.env),
      fraudCheck: Boolean(c.env.FRAUD_CHECK_API_URL),
      sms: smsConfigured(c.env),
      whatsapp: whatsappConfigured(c.env),
      email: emailConfigured(c.env),
      push: pushConfigured(c.env),
      metaCapi: Boolean(c.env.META_CAPI_TOKEN),
      turnstile: Boolean(c.env.TURNSTILE_SECRET),
      r2: Boolean(c.env.MEDIA),
      ai: Boolean(c.env.AI),
    },
  });
});

app.put("/settings/:key", perm("settings.manage"), async (c) => {
  const key = c.req.param("key") as SettingKey;
  if (!SETTING_KEYS.includes(key)) throw E.notFound("Setting");
  let value = await body(c, z.record(z.string(), z.unknown()));
  if (JSON.stringify(value).length > 30000) throw E.badRequest("Settings are too large.", "সেটিংস অনেক বড়।");
  // API secrets belong in Wrangler secrets, never in the database.
  if (/secret|password|api_?key|token/i.test(JSON.stringify(Object.keys(value)))) throw E.badRequest("API keys must be stored as Wrangler secrets, not here.", "API কী এখানে নয়, Wrangler secret হিসেবে রাখুন।");
  const schema = SETTING_SCHEMAS[key];
  if (schema) value = validate(schema, { ...SETTING_DEFAULTS[key], ...value }) as Record<string, unknown>;
  const before = await getSetting(c.env, key);
  await putSetting(c.env, key, value);
  await audit(c, "update", "settings", key, { before, after: value });
  return c.json({ ok: true, en: "Settings saved.", bn: "সেটিংস সংরক্ষণ করা হয়েছে।" });
});

// ---------- Uploads → R2 (photos and certificate documents) ----------
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": "pdf" };

app.post("/uploads", perm("products.write"), async (c) => {
  const form = await c.req.parseBody();
  const file = form["file"];
  const folder = String(form["folder"] ?? "products").replace(/[^a-z0-9-]/g, "") || "products";
  const isDoc = folder === "certificates";
  if (!(file instanceof File)) throw E.badRequest(isDoc ? "Choose the certificate file (PDF or photo)." : "Choose an image to upload.", isDoc ? "সার্টিফিকেট ফাইল (PDF বা ছবি) বেছে নিন।" : "আপলোড করার জন্য একটি ছবি বেছে নিন।");
  const ext = (isDoc ? DOC_TYPES : IMAGE_TYPES)[file.type];
  if (!ext) throw E.badRequest(isDoc ? "Certificates must be a PDF, JPG, PNG or WebP file." : "Only JPG, PNG, WebP or AVIF images are allowed.", isDoc ? "সার্টিফিকেট PDF, JPG, PNG বা WebP হতে হবে।" : "শুধু JPG, PNG, WebP বা AVIF ছবি দেওয়া যাবে।");
  const max = isDoc ? 10 : 5;
  if (file.size > max * 1024 * 1024) throw E.badRequest(`File is too large (max ${max} MB).`, `ফাইলটি অনেক বড় (সর্বোচ্চ ${max} MB)।`);
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  if (c.env.MEDIA) {
    await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
  } else {
    await c.env.KV.put(`media:${key}`, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  }
  await audit(c, "upload", isDoc ? "certificate_document" : "media", key, { size: file.size, name: file.name });
  return c.json({ url: `/media/${key}`, key, name: file.name }, 201);
});

// ---------- Audit log ----------
app.get("/audit", perm("audit.view"), async (c) => {
  const q = c.req.query();
  const where = ["1=1"];
  const args: unknown[] = [];
  for (const [p, col] of [["entity", "entity"], ["action", "action"], ["admin_id", "admin_id"]] as const) {
    if (q[p]) {
      where.push(`${col} = ?`);
      args.push(q[p]);
    }
  }
  if (q.q) {
    where.push("(admin_name LIKE ? OR entity_id LIKE ? OR details LIKE ?)");
    const like = likeText(q.q);
    args.push(like, like, like);
  }
  const w = where.join(" AND ");
  if (q.format === "csv") {
    const rows = await c.env.DB.prepare(`SELECT * FROM audit_log WHERE ${w} ORDER BY id DESC LIMIT 20000`).bind(...args).all<Record<string, unknown>>();
    return csvResponse("audit-log", rows.results, ["created_at", "admin_name", "action", "entity", "entity_id", "details", "ip"]);
  }
  const limit = intParam(q.limit, 50, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE ${w}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT * FROM audit_log WHERE ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all(),
  ]);
  const total = count?.n ?? 0;
  return c.json({ items: rows.results, total, page, pages: Math.ceil(total / limit) });
});

// ---------- Notification bell (new orders, low stock, new reviews) ----------
app.get("/notifications", perm("dashboard.view"), async (c) => {
  const since = validate(z.object({ since: z.string().optional() }), c.req.query()).since ?? new Date(Date.now() - 3 * 86400_000).toISOString();
  const [orders, low, reviews, returns] = await Promise.all([
    c.env.DB.prepare("SELECT id, order_no, customer_name, total, risk_level, created_at FROM orders WHERE created_at > ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 10").bind(since).all(),
    c.env.DB.prepare(
      "SELECT v.id, v.sku, p.id AS product_id, p.name_en, p.name_bn, v.size, v.stock FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.stock <= v.low_stock_threshold AND p.status = 'active' AND p.deleted_at IS NULL ORDER BY v.stock LIMIT 10",
    ).all(),
    c.env.DB.prepare("SELECT r.id, r.name, r.rating, r.created_at, p.name_en FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.status = 'pending' AND r.deleted_at IS NULL ORDER BY r.id DESC LIMIT 10").all(),
    c.env.DB.prepare("SELECT r.id, r.reason, r.created_at, o.order_no FROM return_requests r JOIN orders o ON o.id = r.order_id WHERE r.status = 'requested' ORDER BY r.id DESC LIMIT 10").all(),
  ]);
  return c.json({ newOrders: orders.results, lowStock: low.results, pendingReviews: reviews.results, returnRequests: returns.results });
});

// ---------- Staff presence (who is online) ----------
app.post("/presence", async (c) => {
  const a = c.get("admin")!;
  await c.env.KV.put(`presence:${a.id}`, JSON.stringify({ id: a.id, name: a.name, role: a.role, at: new Date().toISOString(), page: c.req.query("page") ?? "" }), { expirationTtl: 120 });
  const list = await c.env.KV.list({ prefix: "presence:" });
  const online = (await Promise.all(list.keys.map((k) => c.env.KV.get(k.name, "json")))).filter(Boolean);
  return c.json({ online });
});

app.get("/roles", async (c) => c.json({ permissions: PERMISSIONS, matrix: ROLE_MATRIX, labels: ROLE_LABELS }));

/** Super Admin resets a staff member's authenticator (lost phone) — they set it up again at next sign-in. */
app.post("/staff/:id{[0-9]+}/reset-2fa", perm("staff.manage"), async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(`UPDATE admins SET totp_secret = NULL, totp_enabled = 0, updated_at = ${SQL_NOW} WHERE id = ?`).bind(id).run();
  await c.env.KV.put(`staff:revoked:${id}`, String(Date.now()), { expirationTtl: 60 * 60 * 13 });
  await audit(c, "reset_2fa", "staff", id);
  return c.json({ ok: true, en: "Two-step sign-in was reset. They'll set it up again at their next sign-in.", bn: "দুই-ধাপের সাইন-ইন রিসেট হয়েছে। পরের সাইন-ইনে আবার সেটআপ করবেন।" });
});

// ---------- Global search (right sidebar) ----------
app.get("/search", perm("dashboard.view"), async (c) => {
  const term = (c.req.query("q") ?? "").trim();
  if (term.length < 2) return c.json({ orders: [], products: [], customers: [] });
  const like = likeText(term);
  const digits = term.replace(/\D/g, "");
  const phone = digits.length >= 5 ? `%${digits.replace(/^(?:00)?880/, "0")}%` : like;
  const [orders, products, customers] = await Promise.all([
    c.env.DB.prepare(
      `SELECT o.id, o.order_no, o.invoice_no, o.customer_name, o.customer_phone, o.total, o.status, o.created_at FROM orders o
        WHERE o.deleted_at IS NULL AND (o.order_no LIKE ? OR o.invoice_no LIKE ? OR o.customer_phone LIKE ? OR o.customer_name LIKE ? OR o.payment_ref LIKE ? OR o.tracking_id LIKE ?
          OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.sku LIKE ?)) ORDER BY o.id DESC LIMIT 8`,
    )
      .bind(like, like, phone, like, like, like, like)
      .all(),
    c.env.DB.prepare(
      `SELECT p.id, p.name_en, p.name_bn, p.slug, p.price, p.sale_price, (SELECT v.sku FROM product_variants v WHERE v.product_id = p.id AND v.sku LIKE ? LIMIT 1) AS variant_sku
         FROM products p WHERE p.deleted_at IS NULL AND (p.name_en LIKE ? OR p.name_bn LIKE ? OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.sku LIKE ?)) LIMIT 6`,
    )
      .bind(like, like, like, like)
      .all(),
    c.env.DB.prepare("SELECT id, name, phone, email, total_orders, risk_level FROM customers WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ? OR email LIKE ?) LIMIT 6").bind(like, phone, like).all(),
  ]);
  return c.json({ orders: orders.results, products: products.results, customers: customers.results });
});

// ---------- Workers AI: bilingual product description draft (optional) ----------
app.post("/ai/describe", perm("products.write"), async (c) => {
  if (!c.env.AI) throw E.badRequest("AI is not enabled for this store.", "এই দোকানে AI চালু নেই।");
  const b = await body(c, z.object({ name: z.string().min(2).max(160), material: z.string().max(200).optional(), category: z.string().max(80).optional(), age: z.string().max(40).optional(), notes: z.string().max(400).optional() }));
  const prompt = `Write a warm, honest product description for a baby & kids shop in Bangladesh.
Product: ${b.name}
Category: ${b.category ?? ""}
Age: ${b.age ?? ""}
Material: ${b.material ?? ""}
Notes: ${b.notes ?? ""}
Return strict JSON: {"en": "<2-3 sentences in simple English>", "bn": "<same meaning in natural Bangla>"}.
Never claim safety certifications, "BPA-free", "non-toxic" or medical benefits unless they are in the notes.`;
  const run = c.env.AI.run as unknown as (model: string, input: unknown) => Promise<{ response?: string }>;
  const out = await run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "user", content: prompt }], max_tokens: 400 });
  let parsed: { en?: string; bn?: string } = {};
  try {
    parsed = JSON.parse(/\{[\s\S]*\}/.exec(out.response ?? "")?.[0] ?? "{}");
  } catch {
    /* fall through */
  }
  return c.json({ en: parsed.en ?? out.response ?? "", bn: parsed.bn ?? "" });
});

export default app;
