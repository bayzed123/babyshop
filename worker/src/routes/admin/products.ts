/**
 * Admin product management — products with age ranges, size variants, auto-generated SKUs, documented safety
 * certifications, images, CSV import/export, back-in-stock notifications and Trash.
 */
import { Hono, type Context } from "hono";
import type { AppEnv } from "../../env";
import { ApiError, E, intParam, likeText, parseJson, SQL_NOW, validate } from "../../lib/http";
import { productSchema, type ProductInput } from "../../lib/schemas";
import { perm } from "../../middleware";
import { audit, expandCategoryIds, publicUrl } from "../../lib/store";
import { can } from "../../lib/rbac";
import { parseCsv } from "../../lib/csv";
import { formatSku, generateSku, isAgeRange } from "../../lib/sku";
import { sendEmail, sendTemplate } from "../../lib/notify";
import { csvResponse } from "./crud";

const app = new Hono<AppEnv>();

app.get("/", perm("products.read"), async (c) => {
  const q = c.req.query();
  const where: string[] = [q.trash === "1" ? "p.deleted_at IS NOT NULL" : "p.deleted_at IS NULL"];
  const args: unknown[] = [];
  if (q.q) {
    const like = likeText(q.q);
    where.push("(p.name_en LIKE ? OR p.name_bn LIKE ? OR p.slug LIKE ? OR p.tags LIKE ? OR p.brand LIKE ? OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.sku LIKE ?))");
    args.push(like, like, like, like, like, like);
  }
  if (q.status) {
    where.push("p.status = ?");
    args.push(q.status);
  }
  if (q.category_id) {
    const ids = await expandCategoryIds(c.env, [Number(q.category_id)]);
    where.push(`p.category_id IN (${ids.map(() => "?").join(",")})`);
    args.push(...ids);
  }
  if (q.age && isAgeRange(q.age)) {
    where.push("p.age_ranges LIKE ?");
    args.push(`%,${q.age},%`);
  }
  if (q.stock === "out") where.push("NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)");
  if (q.stock === "low") where.push("EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock <= v.low_stock_threshold)");
  if (q.waiting === "1") where.push("EXISTS (SELECT 1 FROM stock_notify_requests s WHERE s.product_id = p.id AND s.notified_at IS NULL)");
  const sorts: Record<string, string> = { newest: "p.created_at DESC", name: "p.name_en ASC", price_asc: "p.price ASC", price_desc: "p.price DESC", sold: "p.sold_count DESC", stock: "stock ASC" };
  const sort = sorts[q.sort ?? "newest"] ?? sorts.newest;
  const w = where.join(" AND ");
  const cols = `p.id, p.slug, p.name_en, p.name_bn, p.brand, p.price, p.sale_price, p.discount_type, p.discount_value, p.age_ranges, p.status, p.images, p.is_featured, p.is_gift, p.delivery_mode, p.sold_count, p.rating_avg, p.created_at, p.updated_at,
      c.name_en AS category_name, c.name_bn AS category_name_bn,
      (SELECT COALESCE(SUM(stock),0) FROM product_variants v WHERE v.product_id = p.id) AS stock,
      (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
      (SELECT GROUP_CONCAT(sku, ' ') FROM product_variants v WHERE v.product_id = p.id) AS skus,
      (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.stock <= v.low_stock_threshold) AS low_variants,
      (SELECT COUNT(*) FROM certifications ce WHERE ce.product_id = p.id AND ce.is_active = 1) AS cert_count,
      (SELECT COUNT(*) FROM stock_notify_requests s WHERE s.product_id = p.id AND s.notified_at IS NULL) AS waiting`;
  if (q.format === "csv") return exportCsv(c, w, args);
  const limit = intParam(q.limit, 20, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${w}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT ${cols} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${w} ORDER BY ${sort}, p.id DESC LIMIT ? OFFSET ?`)
      .bind(...args, limit, (page - 1) * limit)
      .all<{ images: string; age_ranges: string }>(),
  ]);
  const total = count?.n ?? 0;
  return c.json({
    items: rows.results.map((r) => ({ ...r, image: parseJson<string[]>(r.images, [])[0] ?? null, images: undefined, age_ranges: r.age_ranges.split(",").filter(Boolean) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

app.get("/:id{[0-9]+}", perm("products.read"), async (c) => {
  const id = Number(c.req.param("id"));
  const p = await c.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<{ images: string; age_ranges: string }>();
  if (!p) throw E.notFound("Product");
  const [v, certs, waiting] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM certifications WHERE product_id = ? ORDER BY id").bind(id).all(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM stock_notify_requests WHERE product_id = ? AND notified_at IS NULL").bind(id).first<{ n: number }>(),
  ]);
  return c.json({ item: { ...p, images: parseJson<string[]>(p.images, []), age_ranges: p.age_ranges.split(",").filter(Boolean), variants: v.results, certifications: certs.results, waiting: waiting?.n ?? 0 } });
});

/** Suggests the next SKU for a category + age range (the form shows it before saving). */
app.get("/sku-preview", perm("products.write"), async (c) => {
  const cat = await c.env.DB.prepare("SELECT code FROM categories WHERE id = ?").bind(Number(c.req.query("category_id") ?? 0)).first<{ code: string }>();
  if (!cat) throw E.badRequest("Choose a category first.", "আগে ক্যাটাগরি বেছে নিন।");
  const row = await c.env.DB.prepare("SELECT value FROM counters WHERE name = ?").bind(`sku:${cat.code}`).first<{ value: number }>();
  return c.json({ sku: formatSku(cat.code, c.req.query("age"), (row?.value ?? 0) + 1) });
});

const PRODUCT_COLS = [
  "slug", "name_en", "name_bn", "description_en", "description_bn", "category_id", "brand", "price", "sale_price", "discount_type", "discount_value",
  "age_ranges", "material_en", "material_bn", "care_en", "care_bn", "size_chart", "is_consumable", "reorder_days", "is_gift", "tags", "images",
  "status", "is_featured", "meta_title", "meta_description", "delivery_mode",
] as const;

function productParams(p: ProductInput): unknown[] {
  const ages = p.age_ranges.length ? `,${[...new Set(p.age_ranges)].join(",")},` : "";
  return [
    p.slug, p.name_en, p.name_bn, p.description_en, p.description_bn, p.category_id, p.brand, p.price, p.sale_price ?? null, p.discount_type, p.discount_value,
    ages, p.material_en, p.material_bn, p.care_en, p.care_bn, p.size_chart ?? null, p.is_consumable, p.reorder_days, p.is_gift, p.tags, JSON.stringify(p.images),
    p.status, p.is_featured, p.meta_title, p.meta_description, p.delivery_mode,
  ];
}

function dbError(e: unknown): never {
  const m = String(e);
  if (m.includes("UNIQUE") && m.includes("product_variants.sku"))
    throw new ApiError(409, "duplicate", "This SKU is already used by another product. Leave it blank to generate a new one.", "এই SKU অন্য পণ্যে ব্যবহৃত হয়েছে। খালি রাখলে নতুন SKU তৈরি হবে।", [{ field: "sku", en: "Already in use.", bn: "আগেই ব্যবহৃত।" }]);
  if (m.includes("UNIQUE") && m.includes("products.slug"))
    throw new ApiError(409, "duplicate", "Another product already uses this web address (slug).", "অন্য একটি পণ্যে এই ওয়েব ঠিকানা (slug) ব্যবহৃত হয়েছে।", [{ field: "slug", en: "Already in use.", bn: "আগেই ব্যবহৃত।" }]);
  if (m.includes("CHECK") && m.includes("document_url"))
    throw new ApiError(422, "validation", "Attach the certificate document before enabling this badge.", "ব্যাজ চালু করার আগে সার্টিফিকেট ডকুমেন্ট যুক্ত করুন।");
  throw e;
}

async function categoryCode(c: Context<AppEnv>, id: number): Promise<string> {
  const cat = await c.env.DB.prepare("SELECT code FROM categories WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ code: string }>();
  if (!cat) throw new ApiError(422, "validation", "Choose a category.", "একটি ক্যাটাগরি বেছে নিন।", [{ field: "category_id", en: "Choose a category.", bn: "ক্যাটাগরি বেছে নিন।" }]);
  return cat.code;
}

/** Every variant gets a SKU: typed ones are kept (upper-cased), blank ones are generated as BBY-<CAT>-<AGE>-<####>. */
async function assignSkus(c: Context<AppEnv>, p: ProductInput, catCode: string): Promise<void> {
  const taken = new Set(p.variants.map((v) => v.sku).filter((s): s is string => Boolean(s)));
  for (const v of p.variants) {
    if (!v.age_range && p.age_ranges.length === 1) v.age_range = p.age_ranges[0]!;
    if (!v.sku) {
      v.sku = await generateSku(c.env, catCode, v.age_range, taken);
      taken.add(v.sku);
    }
  }
}

function certStatements(c: Context<AppEnv>, productRef: { id?: number; slug?: string }, p: ProductInput, actor: string): D1PreparedStatement[] {
  const pid = productRef.id != null ? "?" : "(SELECT id FROM products WHERE slug = ?)";
  const pidVal = productRef.id ?? productRef.slug;
  const out: D1PreparedStatement[] = [];
  const types = p.certifications.map((x) => x.type);
  out.push(
    c.env.DB.prepare(`DELETE FROM certifications WHERE product_id = ${pid}${types.length ? ` AND type NOT IN (${types.map(() => "?").join(",")})` : ""}`).bind(pidVal, ...types),
  );
  for (const ce of p.certifications) {
    out.push(
      c.env.DB.prepare(
        `INSERT INTO certifications (product_id, type, issuer, certificate_no, document_url, document_name, valid_until, is_active, added_by)
         VALUES (${pid}, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id, type) DO UPDATE SET issuer = excluded.issuer, certificate_no = excluded.certificate_no, document_url = excluded.document_url,
           document_name = excluded.document_name, valid_until = excluded.valid_until, is_active = excluded.is_active, updated_at = ${SQL_NOW}`,
      ).bind(pidVal, ce.type, ce.issuer, ce.certificate_no, ce.document_url, ce.document_name, ce.valid_until, ce.is_active, actor),
    );
  }
  return out;
}

app.post("/", perm("products.write"), async (c) => {
  const p = validate(productSchema, await c.req.json().catch(() => ({})));
  const code = await categoryCode(c, p.category_id);
  await assignSkus(c, p, code);
  const actor = c.get("admin")!.name;
  const stmts: D1PreparedStatement[] = [c.env.DB.prepare(`INSERT INTO products (${PRODUCT_COLS.join(", ")}) VALUES (${PRODUCT_COLS.map(() => "?").join(", ")})`).bind(...productParams(p))];
  p.variants.forEach((v, i) => {
    stmts.push(
      c.env.DB.prepare(
        "INSERT INTO product_variants (product_id, sku, size, color, age_range, stock, price_override, low_stock_threshold, sort_order) VALUES ((SELECT id FROM products WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(p.slug, v.sku, v.size, v.color, v.age_range ?? null, v.stock, v.price_override ?? null, v.low_stock_threshold, i),
    );
    if (v.stock > 0)
      stmts.push(
        c.env.DB.prepare(
          "INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) SELECT v.product_id, v.id, v.sku, ?, ?, 'initial', 'Initial stock', ? FROM product_variants v WHERE v.sku = ?",
        ).bind(v.stock, v.stock, actor, v.sku),
      );
  });
  stmts.push(...certStatements(c, { slug: p.slug }, p, actor));
  try {
    await c.env.DB.batch(stmts);
  } catch (e) {
    dbError(e);
  }
  const row = await c.env.DB.prepare("SELECT id FROM products WHERE slug = ?").bind(p.slug).first<{ id: number }>();
  await audit(c, "create", "product", row!.id, { name: p.name_en, skus: p.variants.map((v) => v.sku), certifications: p.certifications.map((x) => x.type) });
  return c.json({ id: row!.id, skus: p.variants.map((v) => v.sku), en: "Product created.", bn: "পণ্য তৈরি হয়েছে।" }, 201);
});

app.put("/:id{[0-9]+}", perm("products.write"), async (c) => {
  const id = Number(c.req.param("id"));
  const p = validate(productSchema, await c.req.json().catch(() => ({})));
  const code = await categoryCode(c, p.category_id);
  const before = await c.env.DB.prepare("SELECT name_en, price, sale_price, status FROM products WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!before) throw E.notFound("Product");
  const existing = await c.env.DB.prepare("SELECT id, sku, stock FROM product_variants WHERE product_id = ?").bind(id).all<{ id: number; sku: string; stock: number }>();
  const existingById = new Map(existing.results.map((v) => [v.id, v]));
  // Existing variants keep their SKU when the field is left blank.
  for (const v of p.variants) if (!v.sku && v.id && existingById.has(v.id)) v.sku = existingById.get(v.id)!.sku;
  await assignSkus(c, p, code);
  const keep = new Set(p.variants.filter((v) => v.id && existingById.has(v.id)).map((v) => v.id!));
  const actor = c.get("admin")!.name;

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(`UPDATE products SET ${PRODUCT_COLS.map((k) => `${k} = ?`).join(", ")}, updated_at = ${SQL_NOW} WHERE id = ?`).bind(...productParams(p), id),
  ];
  for (const old of existing.results) {
    if (keep.has(old.id)) continue;
    const used = await c.env.DB.prepare("SELECT 1 FROM order_items WHERE variant_id = ? LIMIT 1").bind(old.id).first();
    if (used) throw E.conflict(`Option ${old.sku} is part of past orders, so it can't be removed. Set its stock to 0 instead.`, `${old.sku} অপশনটি আগের অর্ডারে আছে, তাই মোছা যাবে না। স্টক ০ করে দিন।`);
    stmts.push(c.env.DB.prepare("DELETE FROM product_variants WHERE id = ?").bind(old.id));
  }
  p.variants.forEach((v, i) => {
    const old = v.id ? existingById.get(v.id) : undefined;
    if (old) {
      stmts.push(
        c.env.DB.prepare(`UPDATE product_variants SET sku=?, size=?, color=?, age_range=?, stock=?, price_override=?, low_stock_threshold=?, sort_order=?, updated_at=${SQL_NOW} WHERE id = ? AND product_id = ?`).bind(
          v.sku, v.size, v.color, v.age_range ?? null, v.stock, v.price_override ?? null, v.low_stock_threshold, i, old.id, id,
        ),
      );
      if (old.stock !== v.stock)
        stmts.push(
          c.env.DB.prepare("INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) VALUES (?, ?, ?, ?, ?, 'adjustment', 'Edited in product form', ?)").bind(
            id, old.id, v.sku, v.stock - old.stock, v.stock, actor,
          ),
        );
    } else {
      stmts.push(
        c.env.DB.prepare("INSERT INTO product_variants (product_id, sku, size, color, age_range, stock, price_override, low_stock_threshold, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
          id, v.sku, v.size, v.color, v.age_range ?? null, v.stock, v.price_override ?? null, v.low_stock_threshold, i,
        ),
      );
    }
  });
  stmts.push(...certStatements(c, { id }, p, actor));
  try {
    await c.env.DB.batch(stmts);
  } catch (e) {
    dbError(e);
  }
  await audit(c, "update", "product", id, { before, after: { name_en: p.name_en, price: p.price, sale_price: p.sale_price, status: p.status }, certifications: p.certifications.map((x) => x.type) });
  const waiting = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM stock_notify_requests s WHERE s.product_id = ? AND s.notified_at IS NULL AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = s.product_id AND v.stock > 0 AND (s.variant_id IS NULL OR s.variant_id = v.id))",
  )
    .bind(id)
    .first<{ n: number }>();
  return c.json({ id, skus: p.variants.map((v) => v.sku), waitingInStock: waiting?.n ?? 0, en: "Product saved.", bn: "পণ্য সংরক্ষণ করা হয়েছে।" });
});

app.post("/:id{[0-9]+}/duplicate", perm("products.write"), async (c) => {
  const id = Number(c.req.param("id"));
  const p = await c.env.DB.prepare("SELECT p.*, c.code FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?").bind(id).first<Record<string, unknown> & { slug: string; code: string | null }>();
  if (!p) throw E.notFound("Product");
  const variants = await c.env.DB.prepare("SELECT size, color, age_range, price_override, low_stock_threshold, sort_order FROM product_variants WHERE product_id = ?").bind(id).all<{ size: string; color: string; age_range: string | null; price_override: number | null; low_stock_threshold: number; sort_order: number }>();
  const slug = `${p.slug}-copy-${Date.now().toString(36).slice(-4)}`;
  const cols = PRODUCT_COLS.filter((k) => !["slug", "name_en", "name_bn", "status", "is_featured"].includes(k));
  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(`INSERT INTO products (slug, name_en, name_bn, status, is_featured, ${cols.join(", ")}) SELECT ?, name_en || ' (copy)', name_bn || ' (কপি)', 'draft', 0, ${cols.join(", ")} FROM products WHERE id = ?`).bind(slug, id),
  ];
  for (const v of variants.results) {
    const sku = await generateSku(c.env, p.code ?? "GEN", v.age_range);
    stmts.push(
      c.env.DB.prepare("INSERT INTO product_variants (product_id, sku, size, color, age_range, stock, price_override, low_stock_threshold, sort_order) VALUES ((SELECT id FROM products WHERE slug = ?), ?, ?, ?, ?, 0, ?, ?, ?)").bind(
        slug, sku, v.size, v.color, v.age_range, v.price_override, v.low_stock_threshold, v.sort_order,
      ),
    );
  }
  await c.env.DB.batch(stmts);
  const row = await c.env.DB.prepare("SELECT id FROM products WHERE slug = ?").bind(slug).first<{ id: number }>();
  await audit(c, "duplicate", "product", row!.id, { from: id });
  return c.json({ id: row!.id, en: "Copy created as a draft (stock 0, no certificates — attach them again).", bn: "ড্রাফট হিসেবে কপি তৈরি হয়েছে (স্টক ০, সার্টিফিকেট নেই — আবার যুক্ত করুন)।" }, 201);
});

app.delete("/:id{[0-9]+}", perm("products.delete"), async (c) => {
  const id = Number(c.req.param("id"));
  if (c.req.query("purge") === "1") {
    if (!can(c.get("admin")!.role, "trash.purge")) throw E.forbidden();
    const r = await c.env.DB.prepare("SELECT deleted_at FROM products WHERE id = ?").bind(id).first<{ deleted_at: string | null }>();
    if (!r?.deleted_at) throw E.badRequest("Move the product to Trash first.", "আগে পণ্যটি ট্র্যাশে পাঠান।");
    const used = await c.env.DB.prepare("SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1").bind(id).first();
    if (used) throw E.conflict("This product appears in past orders, so it stays in Trash for your records.", "এই পণ্যটি আগের অর্ডারে আছে, তাই রেকর্ডের জন্য ট্র্যাশেই থাকবে।");
    await c.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    await audit(c, "purge", "product", id);
    return c.json({ ok: true, en: "Deleted permanently.", bn: "স্থায়ীভাবে মুছে ফেলা হয়েছে।" });
  }
  const r = await c.env.DB.prepare(`UPDATE products SET deleted_at = ${SQL_NOW}, status = 'archived' WHERE id = ? AND deleted_at IS NULL`).bind(id).run();
  if (!r.meta.changes) throw E.notFound("Product");
  await audit(c, "delete", "product", id);
  return c.json({ ok: true, en: "Moved to Trash. It is hidden from the shop.", bn: "ট্র্যাশে পাঠানো হয়েছে। দোকানে আর দেখাবে না।" });
});

app.post("/:id{[0-9]+}/restore", perm("products.delete"), async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("UPDATE products SET deleted_at = NULL, status = 'draft' WHERE id = ?").bind(id).run();
  await audit(c, "restore", "product", id);
  return c.json({ ok: true, en: "Restored as a draft. Set it to Active to show it in the shop.", bn: "ড্রাফট হিসেবে ফিরিয়ে আনা হয়েছে। দোকানে দেখাতে 'Active' করুন।" });
});

// ---------- Back-in-stock ----------
/** Sends "back in stock" to everyone waiting for an option that now has stock. */
app.post("/:id{[0-9]+}/notify-waiting", perm("products.write"), async (c) => {
  const id = Number(c.req.param("id"));
  const p = await c.env.DB.prepare("SELECT slug, name_en, name_bn FROM products WHERE id = ? AND status = 'active' AND deleted_at IS NULL").bind(id).first<{ slug: string; name_en: string; name_bn: string }>();
  if (!p) throw E.badRequest("Only active products can send back-in-stock messages.", "শুধু চালু পণ্যের জন্য স্টকে ফেরার মেসেজ পাঠানো যায়।");
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.phone, s.email, s.lang FROM stock_notify_requests s WHERE s.product_id = ? AND s.notified_at IS NULL
       AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = s.product_id AND v.stock > 0 AND (s.variant_id IS NULL OR s.variant_id = v.id))`,
  )
    .bind(id)
    .all<{ id: number; phone: string | null; email: string | null; lang: string }>();
  const link = `${publicUrl(c.env, c.req.url)}/product/${p.slug}`;
  let sent = 0;
  for (const r of results) {
    const product = r.lang === "en" ? p.name_en : p.name_bn;
    if (r.phone) await sendTemplate(c.env, r.phone, "back_in_stock", r.lang, { product, link });
    else if (r.email) await sendEmail(c.env, r.email, `${p.name_en} is back in stock`, `Good news! ${p.name_en} is back in stock: ${link}`, "back_in_stock");
    await c.env.DB.prepare(`UPDATE stock_notify_requests SET notified_at = ${SQL_NOW} WHERE id = ?`).bind(r.id).run();
    sent++;
  }
  await audit(c, "notify_waiting", "product", id, { sent });
  return c.json({ sent, en: `Sent to ${sent} waiting customer(s).`, bn: `${sent} জন অপেক্ষমাণ গ্রাহককে পাঠানো হয়েছে।` });
});

// ---------- CSV export / import ----------
const CSV_COLUMNS = [
  "slug", "name_en", "name_bn", "category_code", "brand", "price", "sale_price", "age_ranges", "status", "is_consumable", "reorder_days", "is_gift", "tags",
  "material_en", "material_bn", "description_en", "description_bn", "images", "delivery_mode", "variant_sku", "size", "color", "variant_age_range", "stock", "price_override",
];

async function exportCsv(c: Context<AppEnv>, where: string, args: unknown[]) {
  const { results } = await c.env.DB.prepare(
    `SELECT p.slug, p.name_en, p.name_bn, c.code AS category_code, p.brand, p.price, p.sale_price, p.age_ranges, p.status, p.is_consumable, p.reorder_days, p.is_gift, p.tags,
            p.material_en, p.material_bn, p.description_en, p.description_bn, p.images, p.delivery_mode, v.sku AS variant_sku, v.size, v.color, v.age_range AS variant_age_range, v.stock, v.price_override
       FROM products p LEFT JOIN categories c ON c.id = p.category_id JOIN product_variants v ON v.product_id = p.id WHERE ${where} ORDER BY p.id, v.sort_order, v.id LIMIT 20000`,
  )
    .bind(...args)
    .all<Record<string, unknown> & { images: string; age_ranges: string }>();
  await audit(c, "export", "product", null, { rows: results.length });
  return csvResponse(
    "products",
    results.map((r) => ({ ...r, images: parseJson<string[]>(r.images, []).join(" | "), age_ranges: r.age_ranges.split(",").filter(Boolean).join(" | ") })),
    CSV_COLUMNS,
  );
}

/**
 * CSV import: one row per option (SKU). Rows with the same slug form one product. Existing products (matched by
 * slug) are updated; options are matched by SKU. Blank SKUs are generated. Certifications are never imported —
 * each needs its document attached in the product form.
 */
app.post("/import", perm("products.write"), async (c) => {
  const text = await c.req.text();
  if (text.length > 2_000_000) throw E.badRequest("The file is too large (max 2 MB).", "ফাইলটি অনেক বড় (সর্বোচ্চ ২ MB)।");
  const rows = parseCsv(text);
  if (!rows.length) throw E.badRequest("The file is empty.", "ফাইলটি খালি।");
  const cats = await c.env.DB.prepare("SELECT id, code, slug FROM categories WHERE deleted_at IS NULL").all<{ id: number; code: string; slug: string }>();
  const catBy = (v: string) => cats.results.find((x) => x.code === v.toUpperCase() || x.slug === v.toLowerCase());
  const groups = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const slug = (r.slug ?? "").trim().toLowerCase();
    if (!slug) continue;
    groups.set(slug, [...(groups.get(slug) ?? []), r]);
  }
  const results: { slug: string; ok: boolean; error?: string }[] = [];
  for (const [slug, list] of groups) {
    const f = list[0]!;
    try {
      const cat = catBy(f.category_code ?? f.category_slug ?? "");
      if (!cat) throw new Error(`Unknown category "${f.category_code ?? ""}"`);
      const existing = await c.env.DB.prepare("SELECT id FROM products WHERE slug = ?").bind(slug).first<{ id: number }>();
      const oldVariants = existing ? (await c.env.DB.prepare("SELECT id, sku FROM product_variants WHERE product_id = ?").bind(existing.id).all<{ id: number; sku: string }>()).results : [];
      const oldCerts = existing ? (await c.env.DB.prepare("SELECT type, issuer, certificate_no, document_url, document_name, valid_until, is_active FROM certifications WHERE product_id = ?").bind(existing.id).all()).results : [];
      const payload = {
        slug,
        name_en: f.name_en,
        name_bn: f.name_bn || f.name_en,
        description_en: f.description_en,
        description_bn: f.description_bn,
        category_id: cat.id,
        brand: f.brand,
        price: f.price,
        sale_price: f.sale_price || null,
        age_ranges: (f.age_ranges ?? "").split(/[|,]/).map((s) => s.trim()).filter(Boolean),
        status: f.status || "draft",
        is_consumable: f.is_consumable === "1" || f.is_consumable?.toLowerCase() === "yes" ? 1 : 0,
        reorder_days: f.reorder_days || null,
        is_gift: f.is_gift === "1" || f.is_gift?.toLowerCase() === "yes" ? 1 : 0,
        tags: f.tags ?? "",
        material_en: f.material_en,
        material_bn: f.material_bn,
        images: (f.images ?? "").split("|").map((s) => s.trim()).filter(Boolean),
        delivery_mode: (f.delivery_mode ?? "").trim().toLowerCase() === "free" ? "free" : "zone",
        certifications: oldCerts,
        variants: list.map((r) => ({
          id: oldVariants.find((v) => v.sku === (r.variant_sku ?? "").toUpperCase())?.id,
          sku: r.variant_sku || null,
          size: r.size || "Standard",
          color: r.color ?? "",
          age_range: r.variant_age_range || null,
          stock: r.stock || 0,
          price_override: r.price_override || null,
        })),
      };
      const p = validate(productSchema, payload);
      await assignSkus(c, p, cat.code);
      const actor = `${c.get("admin")!.name} (import)`;
      const stmts: D1PreparedStatement[] = [];
      if (existing) {
        stmts.push(c.env.DB.prepare(`UPDATE products SET ${PRODUCT_COLS.map((k) => `${k} = ?`).join(", ")}, updated_at = ${SQL_NOW} WHERE id = ?`).bind(...productParams(p), existing.id));
      } else {
        stmts.push(c.env.DB.prepare(`INSERT INTO products (${PRODUCT_COLS.join(", ")}) VALUES (${PRODUCT_COLS.map(() => "?").join(", ")})`).bind(...productParams(p)));
      }
      p.variants.forEach((v, i) => {
        if (v.id) {
          stmts.push(
            c.env.DB.prepare(`UPDATE product_variants SET size=?, color=?, age_range=?, stock=?, price_override=?, sort_order=?, updated_at=${SQL_NOW} WHERE id = ?`).bind(v.size, v.color, v.age_range ?? null, v.stock, v.price_override ?? null, i, v.id),
          );
        } else {
          stmts.push(
            c.env.DB.prepare("INSERT INTO product_variants (product_id, sku, size, color, age_range, stock, price_override, sort_order) VALUES ((SELECT id FROM products WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?)").bind(
              slug, v.sku, v.size, v.color, v.age_range ?? null, v.stock, v.price_override ?? null, i,
            ),
          );
        }
        stmts.push(
          c.env.DB.prepare("INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) SELECT product_id, id, sku, 0, stock, 'import', 'CSV import', ? FROM product_variants WHERE sku = ?").bind(actor, v.sku),
        );
      });
      await c.env.DB.batch(stmts);
      results.push({ slug, ok: true });
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.en}${e.fields?.length ? ` (${e.fields.map((x) => `${x.field}: ${x.en}`).join("; ")})` : ""}` : String(e instanceof Error ? e.message : e);
      results.push({ slug, ok: false, error: msg.slice(0, 300) });
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  await audit(c, "import", "product", null, { ok: okCount, failed: results.length - okCount });
  return c.json({ results, en: `${okCount} of ${results.length} product(s) imported.`, bn: `${results.length}টির মধ্যে ${okCount}টি পণ্য ইমপোর্ট হয়েছে।` });
});

export default app;
