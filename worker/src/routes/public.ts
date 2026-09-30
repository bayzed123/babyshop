/** Public storefront API — config, catalogue, home page, reviews, back-in-stock, newsletter, events relay, gift finder, registries, landing pages, push. */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { body, clientIp, E, intParam, likeText, parseJson, validate } from "../lib/http";
import { eventSchema, newsletterSchema, reviewSchema, stockNotifySchema } from "../lib/schemas";
import { expandCategoryIds, getSetting, loadZones, rateLimit } from "../lib/store";
import { discountPercent } from "../lib/pricing";
import { AGE_LABELS, AGE_RANGES, isAgeRange } from "../lib/sku";
import { bkashConfigured, sslczConfigured } from "../lib/payments";
import { smsConfigured } from "../lib/notify";
import { sendCapi } from "../lib/marketing";
import { pushConfigured } from "../lib/push";
import { optionalCustomer } from "../middleware";
import { BRAND } from "../brand";

const app = new Hono<AppEnv>();

/** OTP can be used when an SMS gateway is connected (or in local development, where codes are shown on screen). */
export const otpAvailable = (env: AppEnv["Bindings"]) => smsConfigured(env) || env.ENVIRONMENT === "development";

// ---------- Store configuration ----------
app.get("/config", async (c) => {
  const [store, payments, integrations, fraud, referral, tax, zones] = await Promise.all([
    getSetting(c.env, "store"),
    getSetting(c.env, "payments"),
    getSetting(c.env, "integrations"),
    getSetting(c.env, "fraud"),
    getSetting(c.env, "referral"),
    getSetting(c.env, "tax"),
    loadZones(c.env),
  ]);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    brand: BRAND,
    store,
    ageRanges: AGE_RANGES.map((k) => ({ code: k, ...AGE_LABELS[k] })),
    integrations: {
      metaPixelId: integrations.metaPixelId,
      ga4Id: integrations.ga4Id,
      googleAdsId: integrations.googleAdsId,
      googleAdsLabel: integrations.googleAdsLabel,
      clarityId: integrations.clarityId,
      cfBeacon: integrations.cfBeacon,
    },
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
    otp: { available: otpAvailable(c.env), required: fraud.requireOtp && otpAvailable(c.env) },
    referral: { enabled: referral.enabled, friendDiscount: referral.friendDiscount, reward: referral.reward, minOrder: referral.minOrder },
    tax: { enabled: tax.enabled, rate: tax.rate, inclusive: tax.inclusive },
    push: { publicKey: pushConfigured(c.env) ? c.env.VAPID_PUBLIC_KEY : null },
    payments: {
      COD: { enabled: payments.cod.enabled },
      bKash: { enabled: payments.bkash.enabled, mode: payments.bkash.mode === "api" && bkashConfigured(c.env) ? "api" : "manual", number: payments.bkash.manualNumber, accountType: payments.bkash.accountType },
      Nagad: { enabled: payments.nagad.enabled, mode: "manual", number: payments.nagad.manualNumber, accountType: payments.nagad.accountType },
      Rocket: { enabled: payments.rocket.enabled, mode: "manual", number: payments.rocket.manualNumber, accountType: payments.rocket.accountType },
      Card: { enabled: payments.card.enabled && sslczConfigured(c.env) },
    },
    zones: zones.map((z) => ({ code: z.code, name_en: z.name_en, name_bn: z.name_bn, fee: z.fee, free_shipping_min: z.free_shipping_min, eta_en: z.eta_en, eta_bn: z.eta_bn })),
  });
});

// ---------- Catalogue ----------
app.get("/categories", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.parent_id, c.slug, c.code, c.name_en, c.name_bn, c.description_en, c.description_bn, c.color, c.sort_order,
            COALESCE(c.image_url, (SELECT json_extract(p.images, '$[0]') FROM products p
               WHERE p.status = 'active' AND p.deleted_at IS NULL AND (p.category_id = c.id OR p.category_id IN (SELECT id FROM categories x WHERE x.parent_id = c.id))
               ORDER BY p.is_featured DESC, p.sold_count DESC LIMIT 1)) AS image_url,
            (SELECT COUNT(*) FROM products p WHERE (p.category_id = c.id OR p.category_id IN (SELECT id FROM categories x WHERE x.parent_id = c.id)) AND p.status = 'active' AND p.deleted_at IS NULL) AS product_count
       FROM categories c WHERE c.deleted_at IS NULL AND c.is_active = 1 ORDER BY c.sort_order, c.id`,
  ).all();
  c.header("Cache-Control", "public, max-age=120");
  return c.json({ categories: results });
});

const csv = (max: number) => z.string().max(max).optional().transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));
const listQuery = z.object({
  category: z.string().max(80).optional(),
  q: z.string().max(100).optional(),
  age: csv(60),
  brand: csv(300),
  min: z.coerce.number().int().min(0).optional(),
  max: z.coerce.number().int().min(0).optional(),
  in_stock: z.enum(["0", "1"]).optional(),
  on_sale: z.enum(["0", "1"]).optional(),
  gift: z.enum(["0", "1"]).optional(),
  featured: z.enum(["0", "1"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "popular", "rating"]).default("newest"),
  page: z.string().optional(),
  limit: z.string().optional(),
  ids: z.string().max(500).optional(),
});

export const PRODUCT_CARD_COLUMNS = `p.id, p.slug, p.name_en, p.name_bn, p.brand, p.price, p.sale_price, p.images, p.age_ranges, p.rating_avg, p.rating_count,
  p.sold_count, p.is_featured, p.is_gift, p.created_at, p.category_id,
  (SELECT COALESCE(SUM(stock),0) FROM product_variants v WHERE v.product_id = p.id) AS stock,
  (SELECT COUNT(*) FROM certifications ce WHERE ce.product_id = p.id AND ce.is_active = 1 AND length(ce.document_url) > 0 AND (ce.valid_until IS NULL OR ce.valid_until >= date('now'))) AS cert_count`;

export type CardRow = { id: number; images: string; price: number; sale_price: number | null; stock: number; age_ranges: string } & Record<string, unknown>;
export function toCard(r: CardRow) {
  return {
    ...r,
    images: parseJson<string[]>(r.images, []).slice(0, 2),
    age_ranges: r.age_ranges.split(",").filter(Boolean),
    discount_percent: discountPercent(r.price, r.sale_price),
    in_stock: r.stock > 0,
  };
}

interface Filter {
  where: string[];
  args: unknown[];
}

/** Builds WHERE clauses shared by the listing and its facet counts. */
async function buildFilter(env: AppEnv["Bindings"], f: z.infer<typeof listQuery>, skip: "age" | "brand" | null = null): Promise<Filter | null> {
  const where = ["p.status = 'active'", "p.deleted_at IS NULL"];
  const args: unknown[] = [];
  if (f.category) {
    const cat = await env.DB.prepare("SELECT id FROM categories WHERE slug = ? AND deleted_at IS NULL AND is_active = 1").bind(f.category).first<{ id: number }>();
    if (!cat) return null;
    const ids = await expandCategoryIds(env, [cat.id]);
    where.push(`p.category_id IN (${ids.map(() => "?").join(",")})`);
    args.push(...ids);
  }
  if (f.q) {
    const like = likeText(f.q);
    where.push("(p.name_en LIKE ? OR p.name_bn LIKE ? OR p.tags LIKE ? OR p.brand LIKE ? OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.sku LIKE ?))");
    args.push(like, like, like, like, like);
  }
  const ages = f.age.filter(isAgeRange);
  if (ages.length && skip !== "age") {
    // Age ranges are stored as ",0-6m,6-12m," so each LIKE matches one exact code.
    where.push(`(${ages.map(() => "p.age_ranges LIKE ?").join(" OR ")})`);
    args.push(...ages.map((a) => `%,${a},%`));
  }
  if (f.brand.length && skip !== "brand") {
    where.push(`p.brand IN (${f.brand.map(() => "?").join(",")})`);
    args.push(...f.brand);
  }
  if (f.min != null) {
    where.push("COALESCE(p.sale_price, p.price) >= ?");
    args.push(f.min);
  }
  if (f.max != null) {
    where.push("COALESCE(p.sale_price, p.price) <= ?");
    args.push(f.max);
  }
  if (f.in_stock === "1") where.push("EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)");
  if (f.on_sale === "1") where.push("p.sale_price IS NOT NULL AND p.sale_price < p.price");
  if (f.gift === "1") where.push("p.is_gift = 1");
  if (f.featured === "1") where.push("p.is_featured = 1");
  if (f.ids) {
    const ids = f.ids.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
    if (!ids.length) return null;
    where.push(`p.id IN (${ids.map(() => "?").join(",")})`);
    args.push(...ids);
  }
  return { where, args };
}

app.get("/products", async (c) => {
  const f = validate(listQuery, c.req.query());
  const flt = await buildFilter(c.env, f);
  if (!flt) return c.json({ items: [], total: 0, page: 1, pages: 0 });
  const order = {
    newest: "p.created_at DESC",
    price_asc: "COALESCE(p.sale_price, p.price) ASC",
    price_desc: "COALESCE(p.sale_price, p.price) DESC",
    popular: "p.sold_count DESC",
    rating: "p.rating_avg DESC, p.rating_count DESC",
  }[f.sort];
  const limit = intParam(f.limit, 12, 1, 48);
  const page = intParam(f.page, 1, 1, 10000);
  const w = flt.where.join(" AND ");
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${w}`).bind(...flt.args).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE ${w} ORDER BY ${order}, p.id DESC LIMIT ? OFFSET ?`)
      .bind(...flt.args, limit, (page - 1) * limit)
      .all<CardRow>(),
  ]);
  const total = count?.n ?? 0;
  c.header("Cache-Control", "public, max-age=30");
  return c.json({ items: rows.results.map(toCard), total, page, pages: Math.ceil(total / limit) });
});

/** Filter options with live counts for the listing sidebar (age, brand, price range). */
app.get("/facets", async (c) => {
  const f = validate(listQuery, c.req.query());
  const [fAge, fBrand, fAll] = await Promise.all([buildFilter(c.env, f, "age"), buildFilter(c.env, f, "brand"), buildFilter(c.env, { ...f, min: undefined, max: undefined })]);
  if (!fAge || !fBrand || !fAll) return c.json({ ages: [], brands: [], price: { min: 0, max: 0 } });
  const ageCounts = await Promise.all(
    AGE_RANGES.map((a) =>
      c.env.DB.prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${fAge.where.join(" AND ")} AND p.age_ranges LIKE ?`)
        .bind(...fAge.args, `%,${a},%`)
        .first<{ n: number }>()
        .then((r) => ({ code: a, ...AGE_LABELS[a], count: r?.n ?? 0 })),
    ),
  );
  const [brands, price] = await Promise.all([
    c.env.DB.prepare(`SELECT p.brand AS name, COUNT(*) AS count FROM products p WHERE ${fBrand.where.join(" AND ")} AND p.brand IS NOT NULL AND p.brand != '' GROUP BY p.brand ORDER BY p.brand`)
      .bind(...fBrand.args)
      .all<{ name: string; count: number }>(),
    c.env.DB.prepare(`SELECT MIN(COALESCE(p.sale_price,p.price)) AS min, MAX(COALESCE(p.sale_price,p.price)) AS max FROM products p WHERE ${fAll.where.join(" AND ")}`)
      .bind(...fAll.args)
      .first<{ min: number | null; max: number | null }>(),
  ]);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({ ages: ageCounts, brands: brands.results, price: { min: price?.min ?? 0, max: price?.max ?? 0 } });
});

/** Only genuinely held, documented and unexpired certifications are ever shown to shoppers. */
export const VALID_CERT_SQL = "is_active = 1 AND length(trim(document_url)) > 0 AND (valid_until IS NULL OR valid_until >= date('now'))";

app.get("/products/:slug", async (c) => {
  const p = await c.env.DB.prepare("SELECT * FROM products WHERE slug = ? AND status = 'active' AND deleted_at IS NULL")
    .bind(c.req.param("slug"))
    .first<Record<string, unknown> & { id: number; category_id: number | null; images: string; price: number; sale_price: number | null; age_ranges: string }>();
  if (!p) throw E.notFound("Product");
  const ages = p.age_ranges.split(",").filter(Boolean);
  const [variants, certs, reviews, related, upsell, crumbs] = await Promise.all([
    c.env.DB.prepare("SELECT id, sku, size, color, age_range, stock, price_override, low_stock_threshold FROM product_variants WHERE product_id = ? ORDER BY sort_order, id").bind(p.id).all(),
    c.env.DB.prepare(`SELECT type, issuer, certificate_no, valid_until FROM certifications WHERE product_id = ? AND ${VALID_CERT_SQL} ORDER BY id`).bind(p.id).all(),
    c.env.DB.prepare("SELECT id, name, rating, body, reply, verified_purchase, created_at FROM reviews WHERE product_id = ? AND status = 'approved' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20").bind(p.id).all(),
    c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.category_id = ? AND p.id != ? AND p.status='active' AND p.deleted_at IS NULL ORDER BY p.sold_count DESC LIMIT 8`)
      .bind(p.category_id, p.id)
      .all<CardRow>(),
    // Upsell: other categories, same age group (e.g. a bib with a feeding bottle).
    ages.length
      ? c.env.DB.prepare(
          `SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE (p.category_id IS NULL OR p.category_id != ?) AND p.id != ? AND p.status='active' AND p.deleted_at IS NULL
             AND (${ages.map(() => "p.age_ranges LIKE ?").join(" OR ")}) ORDER BY p.is_featured DESC, p.sold_count DESC LIMIT 6`,
        )
          .bind(p.category_id ?? 0, p.id, ...ages.map((a) => `%,${a},%`))
          .all<CardRow>()
      : Promise.resolve({ results: [] as CardRow[] }),
    c.env.DB.prepare(
      `WITH RECURSIVE chain(id, parent_id, slug, name_en, name_bn, depth) AS (
         SELECT id, parent_id, slug, name_en, name_bn, 0 FROM categories WHERE id = ?
         UNION ALL SELECT c.id, c.parent_id, c.slug, c.name_en, c.name_bn, chain.depth + 1 FROM categories c JOIN chain ON c.id = chain.parent_id)
       SELECT slug, name_en, name_bn FROM chain ORDER BY depth DESC`,
    )
      .bind(p.category_id ?? 0)
      .all(),
  ]);
  c.header("Cache-Control", "public, max-age=20");
  return c.json({
    product: { ...p, images: parseJson<string[]>(p.images, []), age_ranges: ages, discount_percent: discountPercent(p.price, p.sale_price) },
    variants: variants.results,
    certifications: certs.results,
    reviews: reviews.results,
    related: related.results.map(toCard),
    upsell: upsell.results.map(toCard),
    breadcrumbs: crumbs.results,
  });
});

// ---------- Home page ----------
app.get("/home", async (c) => {
  const now = new Date().toISOString();
  const card = (where: string, order: string, limit = 8) =>
    c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.status = 'active' AND p.deleted_at IS NULL ${where} ORDER BY ${order} LIMIT ${limit}`).all<CardRow>();
  const [banners, newArrivals, bestSellers, gifts, testimonials] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, placement, title_en, title_bn, subtitle_en, subtitle_bn, cta_en, cta_bn, link_url, image_url, color FROM banners
        WHERE deleted_at IS NULL AND is_active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?) ORDER BY placement, sort_order, id`,
    )
      .bind(now, now)
      .all(),
    card("", "p.created_at DESC"),
    card("AND p.sold_count > 0", "p.sold_count DESC"),
    card("AND p.is_gift = 1", "p.is_featured DESC, p.rating_avg DESC", 12),
    c.env.DB.prepare(
      `SELECT r.id, r.name, r.rating, r.body, r.verified_purchase, p.name_en AS product_en, p.name_bn AS product_bn, p.slug
         FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.status = 'approved' AND r.deleted_at IS NULL AND r.rating >= 4 ORDER BY r.created_at DESC LIMIT 6`,
    ).all(),
  ]);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    banners: banners.results,
    newArrivals: newArrivals.results.map(toCard),
    bestSellers: bestSellers.results.map(toCard),
    gifts: gifts.results.map(toCard),
    testimonials: testimonials.results,
  });
});

// ---------- Reviews ----------
app.post("/reviews", optionalCustomer, async (c) => {
  await rateLimit(c, "review", 5, 3600);
  const r = await body(c, reviewSchema);
  const exists = await c.env.DB.prepare("SELECT id FROM products WHERE id = ? AND deleted_at IS NULL").bind(r.productId).first();
  if (!exists) throw E.notFound("Product");
  // "Verified purchase" only when the review comes from a delivered order link (order number + private token).
  let orderId: number | null = null;
  if (r.orderNo && r.token) {
    const o = await c.env.DB.prepare(
      "SELECT o.id FROM orders o WHERE o.order_no = ? AND o.public_token = ? AND o.status = 'delivered' AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.product_id = ?)",
    )
      .bind(r.orderNo, r.token, r.productId)
      .first<{ id: number }>();
    orderId = o?.id ?? null;
  }
  await c.env.DB.prepare("INSERT INTO reviews (product_id, order_id, customer_id, name, rating, body, status, verified_purchase) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)")
    .bind(r.productId, orderId, c.get("customer")?.id ?? null, r.name, r.rating, r.body, orderId ? 1 : 0)
    .run();
  return c.json({ ok: true, en: "Thank you! Your review will appear after a quick check.", bn: "ধন্যবাদ! যাচাইয়ের পর আপনার রিভিউ দেখানো হবে।" }, 201);
});

// ---------- Back-in-stock "notify me" ----------
app.post("/stock-notify", async (c) => {
  await rateLimit(c, "stock-notify", 10, 3600);
  const b = await body(c, stockNotifySchema);
  const p = await c.env.DB.prepare("SELECT id FROM products WHERE id = ? AND deleted_at IS NULL").bind(b.productId).first();
  if (!p) throw E.notFound("Product");
  const dupe = await c.env.DB.prepare(
    "SELECT id FROM stock_notify_requests WHERE product_id = ? AND COALESCE(variant_id,0) = ? AND notified_at IS NULL AND (phone = ? OR email = ?)",
  )
    .bind(b.productId, b.variantId ?? 0, b.phone ?? "-", b.email ?? "-")
    .first();
  if (!dupe) {
    await c.env.DB.prepare("INSERT INTO stock_notify_requests (product_id, variant_id, phone, email, lang) VALUES (?, ?, ?, ?, ?)")
      .bind(b.productId, b.variantId ?? null, b.phone, b.email, b.lang)
      .run();
  }
  return c.json({ ok: true, en: "We'll let you know as soon as it's back.", bn: "স্টকে এলেই আপনাকে জানাবো।" }, 201);
});

app.post("/newsletter", async (c) => {
  await rateLimit(c, "newsletter", 5, 3600);
  const b = await body(c, newsletterSchema);
  await c.env.DB.prepare("INSERT OR IGNORE INTO newsletter_subscribers (contact, lang) VALUES (?, ?)").bind(b.contact, b.lang).run();
  return c.json({ ok: true, en: "Thanks for subscribing!", bn: "সাবস্ক্রাইব করার জন্য ধন্যবাদ!" }, 201);
});

// ---------- Conversions API relay (browser events that only happen client-side) ----------
app.post("/events", async (c) => {
  await rateLimit(c, "events", 120, 300);
  const b = await body(c, eventSchema);
  c.executionCtx.waitUntil(
    sendCapi(c.env, {
      name: b.name,
      eventId: b.eventId,
      sourceUrl: b.url,
      user: { ip: clientIp(c), userAgent: c.req.header("user-agent"), fbp: b.fbp, fbc: b.fbc, phone: c.get("customer")?.phone },
      custom: b.value != null ? { value: b.value, content_ids: b.contentIds, content_type: "product", num_items: b.numItems } : undefined,
    }),
  );
  return c.json({ ok: true }, 202);
});

// ---------- Gift finder (age + budget; Workers AI refines the pick when available) ----------
const recommendQuery = z.object({
  age: z.enum(AGE_RANGES),
  budget: z.coerce.number().int().min(100).max(100000).default(2000),
  occasion: z.string().max(40).optional(),
  note: z.string().max(200).optional(),
});

app.get("/recommend", async (c) => {
  await rateLimit(c, "recommend", 30, 300);
  const q = validate(recommendQuery, c.req.query());
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_CARD_COLUMNS}, p.tags FROM products p WHERE p.status = 'active' AND p.deleted_at IS NULL AND p.age_ranges LIKE ? AND COALESCE(p.sale_price, p.price) <= ?
       AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)
     ORDER BY p.is_gift DESC, p.rating_avg DESC, p.sold_count DESC LIMIT 24`,
  )
    .bind(`%,${q.age},%`, q.budget)
    .all<CardRow & { tags: string; name_en: string }>();
  let picks = results.slice(0, 6);
  let reason: { en: string; bn: string } = {
    en: `Popular gifts for ${AGE_LABELS[q.age].en} under ৳${q.budget}, in stock now.`,
    bn: `${AGE_LABELS[q.age].bn} বয়সের জন্য ৳${q.budget} এর মধ্যে জনপ্রিয় উপহার, এখন স্টকে আছে।`,
  };
  let ai = false;
  if (c.env.AI && results.length > 3 && (q.note || q.occasion)) {
    try {
      const list = results.map((r) => `${r.id}: ${r.name_en} (৳${r.sale_price ?? r.price}; ${r.tags})`).join("\n");
      const run = c.env.AI.run as unknown as (model: string, input: unknown) => Promise<{ response?: string }>;
      const out = await run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "You help parents in Bangladesh choose baby gifts. Reply ONLY with JSON: {\"ids\":[up to 6 product ids from the list],\"reason\":\"one short friendly sentence\"}. Never invent ids." },
          { role: "user", content: `Child age: ${AGE_LABELS[q.age].en}. Budget: ${q.budget} Taka. Occasion: ${q.occasion ?? "gift"}. Notes: ${q.note ?? "-"}.\nProducts:\n${list}` },
        ],
        max_tokens: 200,
      });
      const json = JSON.parse(/\{[\s\S]*\}/.exec(out.response ?? "")?.[0] ?? "{}") as { ids?: number[]; reason?: string };
      const chosen = (json.ids ?? []).map((id) => results.find((r) => r.id === Number(id))).filter((r): r is (typeof results)[number] => Boolean(r));
      if (chosen.length) {
        picks = chosen.slice(0, 6);
        if (json.reason) reason = { en: json.reason.slice(0, 200), bn: reason.bn };
        ai = true;
      }
    } catch (e) {
      console.warn("AI recommend fell back to rules", e);
    }
  }
  return c.json({ items: picks.map(({ tags: _tags, ...r }) => toCard(r as CardRow)), reason, ai });
});

// ---------- Public gift registry ----------
app.get("/registries/:slug", async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT r.id, r.slug, r.title, r.event_type, r.event_date, r.baby_name, r.message, r.status, r.ship_to_parent, r.address_id, c.name AS owner_name,
            a.district AS district
       FROM registries r JOIN customers c ON c.id = r.customer_id LEFT JOIN addresses a ON a.id = r.address_id
      WHERE r.slug = ? AND r.deleted_at IS NULL`,
  )
    .bind(c.req.param("slug"))
    .first<Record<string, unknown> & { id: number; owner_name: string; ship_to_parent: number; address_id: number | null }>();
  if (!r) throw E.notFound("Registry");
  const { results } = await c.env.DB.prepare(
    `SELECT ri.id, ri.product_id, ri.variant_id, ri.quantity_wanted, ri.quantity_purchased, ri.note, p.slug, p.name_en, p.name_bn, p.price, p.sale_price, p.images,
            v.size, v.color, v.stock, v.price_override,
            (SELECT id FROM product_variants x WHERE x.product_id = p.id AND x.stock > 0 ORDER BY x.sort_order, x.id LIMIT 1) AS any_variant_id
       FROM registry_items ri JOIN products p ON p.id = ri.product_id LEFT JOIN product_variants v ON v.id = ri.variant_id
      WHERE ri.registry_id = ? AND p.deleted_at IS NULL ORDER BY ri.id`,
  )
    .bind(r.id)
    .all<Record<string, unknown> & { images: string }>();
  // Only the parent's first name and district are public; the full address is used only at checkout on the server.
  const { address_id: _a, ...pub } = r;
  return c.json({
    registry: { ...pub, owner_name: r.owner_name.split(" ")[0], ships_to_parent: Boolean(r.ship_to_parent && r.address_id) },
    items: results.map((i) => ({ ...i, images: parseJson<string[]>(i.images, []).slice(0, 1) })),
  });
});

// ---------- Campaign landing pages ----------
app.get("/lp/:slug", async (c) => {
  const lp = await c.env.DB.prepare("SELECT * FROM landing_pages WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL").bind(c.req.param("slug")).first<Record<string, unknown> & { id: number; product_id: number | null }>();
  if (!lp) throw E.notFound("Page");
  c.executionCtx.waitUntil(c.env.DB.prepare("UPDATE landing_pages SET views = views + 1 WHERE id = ?").bind(lp.id).run());
  let product: unknown = null;
  let variants: unknown[] = [];
  if (lp.product_id) {
    const p = await c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.id = ? AND p.status = 'active' AND p.deleted_at IS NULL`).bind(lp.product_id).first<CardRow>();
    if (p) {
      product = toCard(p);
      variants = (await c.env.DB.prepare("SELECT id, sku, size, color, age_range, stock, price_override FROM product_variants WHERE product_id = ? ORDER BY sort_order, id").bind(p.id).all()).results;
    }
  }
  return c.json({ page: lp, product, variants });
});

// ---------- Web Push (PWA) ----------
app.post("/push/subscribe", optionalCustomer, async (c) => {
  await rateLimit(c, "push", 10, 3600);
  const b = await body(
    c,
    z.object({
      endpoint: z.url().max(1000),
      keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }).optional(),
      phone: z.string().max(20).optional(),
      promo: z.boolean().default(false),
    }),
  );
  const phone = c.get("customer")?.phone ?? (b.phone ? b.phone.replace(/\D/g, "").replace(/^880/, "0") : null);
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, phone, customer_id, promo_opt_in) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET phone = COALESCE(excluded.phone, push_subscriptions.phone), customer_id = COALESCE(excluded.customer_id, push_subscriptions.customer_id), promo_opt_in = excluded.promo_opt_in`,
  )
    .bind(b.endpoint, b.keys?.p256dh ?? null, b.keys?.auth ?? null, phone && /^01\d{9}$/.test(phone) ? phone : null, c.get("customer")?.id ?? null, b.promo ? 1 : 0)
    .run();
  return c.json({ ok: true }, 201);
});

/** The service worker calls this after a push "tickle" to fetch the message it should show. */
app.get("/push/latest", async (c) => {
  const endpoint = c.req.query("endpoint") ?? "";
  const row = await c.env.DB.prepare("SELECT last_message FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).first<{ last_message: string | null }>();
  return c.json(parseJson(row?.last_message, { title: BRAND.name.en, body: "", url: "/" }));
});

export default app;
