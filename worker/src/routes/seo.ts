/**
 * SEO & media: sitemap.xml, robots.txt, the Google Merchant Center / Facebook catalogue feed, server-side
 * meta + Open Graph + Product JSON-LD for product/category/registry/landing pages (so link previews and Google
 * see real content), the WhatsApp click-to-chat entry point (/wa) and R2 media delivery.
 */
import { Hono, type Context } from "hono";
import type { AppEnv } from "../env";
import { parseJson } from "../lib/http";
import { getSetting, publicUrl } from "../lib/store";
import { BRAND } from "../brand";
import { VALID_CERT_SQL } from "./public";

const app = new Hono<AppEnv>();
type C = Context<AppEnv>;
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const base = (c: C) => publicUrl(c.env, c.req.url);
const abs = (b: string, u: string) => (u.startsWith("http") ? u : b + u);

app.get("/robots.txt", (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /checkout\nDisallow: /account\nDisallow: /order/\n\nSitemap: ${base(c)}/sitemap.xml\n`, 200, { "cache-control": "public, max-age=86400" }),
);

app.get("/sitemap.xml", async (c) => {
  const b = base(c);
  const [products, cats] = await Promise.all([
    c.env.DB.prepare("SELECT slug, updated_at FROM products WHERE status = 'active' AND deleted_at IS NULL ORDER BY id").all<{ slug: string; updated_at: string }>(),
    c.env.DB.prepare("SELECT slug, updated_at FROM categories WHERE is_active = 1 AND deleted_at IS NULL").all<{ slug: string; updated_at: string }>(),
  ]);
  const urls = [
    { loc: `${b}/`, pri: "1.0" },
    { loc: `${b}/shop`, pri: "0.9" },
    { loc: `${b}/gift-finder`, pri: "0.7" },
    { loc: `${b}/about`, pri: "0.5" },
    { loc: `${b}/contact`, pri: "0.5" },
    ...cats.results.map((x) => ({ loc: `${b}/shop/${x.slug}`, lastmod: x.updated_at.slice(0, 10), pri: "0.8" })),
    ...products.results.map((x) => ({ loc: `${b}/product/${x.slug}`, lastmod: x.updated_at.slice(0, 10), pri: "0.7" })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls
    .map(
      (u) =>
        `  <url><loc>${esc(u.loc)}</loc>${"lastmod" in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.pri}</priority>` +
        `<xhtml:link rel="alternate" hreflang="bn" href="${esc(u.loc)}?lang=bn"/><xhtml:link rel="alternate" hreflang="en" href="${esc(u.loc)}?lang=en"/></url>`,
    )
    .join("\n")}\n</urlset>\n`;
  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
});

/** Google age_group values for our age ranges. */
const googleAge = (ages: string) => (ages.includes(",3-5y,") || ages.includes(",1-3y,") ? (ages.includes(",0-6m,") || ages.includes(",6-12m,") ? "infant" : "toddler") : ages ? "infant" : "kids");

/**
 * Product feed for Google Merchant Center (free listings / Shopping) and the Facebook & Instagram Shop catalogue.
 * One item per variant (SKU), grouped by item_group_id.
 */
app.get("/feeds/:name{(google|facebook|products)\\.xml}", async (c) => {
  const b = base(c);
  const store = await getSetting(c.env, "store");
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.slug, p.name_en, p.description_en, p.brand, p.price, p.sale_price, p.images, p.age_ranges, c.name_en AS category,
            v.sku, v.size, v.color, v.stock, v.price_override
       FROM products p JOIN product_variants v ON v.product_id = p.id LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active' AND p.deleted_at IS NULL ORDER BY p.id, v.sort_order, v.id`,
  ).all<{ id: number; slug: string; name_en: string; description_en: string | null; brand: string | null; price: number; sale_price: number | null; images: string; age_ranges: string; category: string | null; sku: string; size: string; color: string; stock: number; price_override: number | null }>();
  const items = results.map((r) => {
    const imgs = parseJson<string[]>(r.images, []).map((i) => abs(b, i));
    const regular = r.price_override ?? r.price;
    const sale = r.price_override ? null : r.sale_price;
    const title = [r.name_en, r.size !== "Standard" ? r.size : "", r.color].filter(Boolean).join(" - ");
    return `  <item>
    <g:id>${esc(r.sku)}</g:id>
    <g:item_group_id>${r.id}</g:item_group_id>
    <g:title>${esc(title.slice(0, 150))}</g:title>
    <g:description>${esc((r.description_en ?? r.name_en).slice(0, 4900))}</g:description>
    <g:link>${esc(`${b}/product/${r.slug}`)}</g:link>
    ${imgs[0] ? `<g:image_link>${esc(imgs[0])}</g:image_link>` : ""}
    ${imgs.slice(1, 10).map((i) => `<g:additional_image_link>${esc(i)}</g:additional_image_link>`).join("")}
    <g:availability>${r.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>
    <g:price>${regular}.00 BDT</g:price>
    ${sale ? `<g:sale_price>${sale}.00 BDT</g:sale_price>` : ""}
    <g:brand>${esc(r.brand || store.name_en)}</g:brand>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>
    <g:mpn>${esc(r.sku)}</g:mpn>
    <g:age_group>${googleAge(r.age_ranges)}</g:age_group>
    ${r.size && r.size !== "Standard" ? `<g:size>${esc(r.size)}</g:size>` : ""}
    ${r.color ? `<g:color>${esc(r.color)}</g:color>` : ""}
    <g:google_product_category>537</g:google_product_category>
    ${r.category ? `<g:product_type>${esc(r.category)}</g:product_type>` : ""}
    <g:shipping><g:country>BD</g:country><g:service>Courier</g:service><g:price>70.00 BDT</g:price></g:shipping>
  </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n  <title>${esc(store.name_en)}</title>\n  <link>${esc(b)}</link>\n  <description>${esc(BRAND.description.en)}</description>\n${items.join("\n")}\n</channel>\n</rss>\n`;
  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=1800" });
});

// ---------- WhatsApp click-to-chat with attribution ----------
/**
 * /wa?ref=AD123&product=slug → opens WhatsApp with a pre-filled message carrying "[ref:AD123]".
 * The WhatsApp Cloud API webhook reads that tag (or Meta's own referral object for Click-to-WhatsApp ads)
 * and later orders from that phone are attributed to the ad.
 */
app.get("/wa", async (c) => {
  const store = await getSetting(c.env, "store");
  const ref = (c.req.query("ref") ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  const product = (c.req.query("product") ?? "").replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const lang = c.req.query("lang") === "en" ? "en" : "bn";
  let text = lang === "bn" ? "আসসালামু আলাইকুম, আমি একটি পণ্য সম্পর্কে জানতে চাই।" : "Hi! I'd like to know about a product.";
  if (product) text += ` ${base(c)}/product/${product}`;
  if (ref) {
    text += ` [ref:${ref}]`;
    c.executionCtx.waitUntil(c.env.DB.prepare("INSERT INTO wa_leads (phone, ad_ref, source_url, first_text) VALUES (NULL, ?, ?, 'click')").bind(ref, c.req.header("referer") ?? null).run());
  }
  return c.redirect(`https://wa.me/${store.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, 302);
});

// ---------- Server-rendered meta for shareable pages ----------
interface Meta {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  jsonLd: unknown[];
  noindex?: boolean;
}

async function shell(c: C, meta: Meta): Promise<Response> {
  const res = await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
  if (!res.ok) return res;
  const rewriter = new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(meta.title) })
    .on('meta[name="description"]', { element: (el) => void el.setAttribute("content", meta.description) })
    .on('meta[property="og:title"]', { element: (el) => void el.setAttribute("content", meta.title) })
    .on('meta[property="og:description"]', { element: (el) => void el.setAttribute("content", meta.description) })
    .on('meta[property="og:image"]', { element: (el) => void el.setAttribute("content", meta.image) })
    .on('meta[property="og:url"]', { element: (el) => void el.setAttribute("content", meta.url) })
    .on('meta[property="og:type"]', { element: (el) => void el.setAttribute("content", meta.type) })
    .on('meta[name="twitter:title"]', { element: (el) => void el.setAttribute("content", meta.title) })
    .on('meta[name="twitter:description"]', { element: (el) => void el.setAttribute("content", meta.description) })
    .on('meta[name="twitter:image"]', { element: (el) => void el.setAttribute("content", meta.image) })
    .on('link[rel="canonical"]', { element: (el) => void el.setAttribute("href", meta.url) })
    .on("head", {
      element: (el) => {
        if (meta.noindex) el.append('<meta name="robots" content="noindex">', { html: true });
        for (const ld of meta.jsonLd) el.append(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`, { html: true });
      },
    });
  const out = rewriter.transform(res);
  const headers = new Headers(out.headers);
  headers.set("cache-control", "public, max-age=60");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(out.body, { status: 200, headers });
}

const spa = (c: C) => c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));

app.get("/product/:slug", async (c) => {
  const b = base(c);
  const p = await c.env.DB.prepare(
    `SELECT p.id, p.slug, p.name_en, p.name_bn, p.description_en, p.meta_title, p.meta_description, p.price, p.sale_price, p.images, p.brand, p.rating_avg, p.rating_count, p.age_ranges,
            c.name_en AS category, c.slug AS category_slug,
            (SELECT COALESCE(SUM(stock),0) FROM product_variants v WHERE v.product_id = p.id) AS stock,
            (SELECT sku FROM product_variants v WHERE v.product_id = p.id ORDER BY v.sort_order, v.id LIMIT 1) AS sku
       FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.slug = ? AND p.status = 'active' AND p.deleted_at IS NULL`,
  )
    .bind(c.req.param("slug"))
    .first<{ id: number; slug: string; name_en: string; name_bn: string; description_en: string | null; meta_title: string | null; meta_description: string | null; price: number; sale_price: number | null; images: string; brand: string | null; rating_avg: number; rating_count: number; age_ranges: string; category: string | null; category_slug: string | null; stock: number; sku: string | null }>();
  if (!p) return spa(c);
  const [reviews, certs] = await Promise.all([
    c.env.DB.prepare("SELECT name, rating, body, created_at FROM reviews WHERE product_id = ? AND status = 'approved' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5").bind(p.id).all<{ name: string; rating: number; body: string; created_at: string }>(),
    c.env.DB.prepare(`SELECT type FROM certifications WHERE product_id = ? AND ${VALID_CERT_SQL}`).bind(p.id).all<{ type: string }>(),
  ]);
  const url = `${b}/product/${p.slug}`;
  const images = parseJson<string[]>(p.images, []).map((i) => abs(b, i));
  const price = p.sale_price ?? p.price;
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name_en,
    alternateName: p.name_bn,
    image: images,
    description: p.description_en ?? p.name_en,
    sku: p.sku ?? String(p.id),
    brand: { "@type": "Brand", name: p.brand || BRAND.name.en },
    category: p.category ?? undefined,
    audience: { "@type": "PeopleAudience", suggestedMaxAge: p.age_ranges.includes("3-5y") ? 5 : p.age_ranges.includes("1-3y") ? 3 : 1 },
    // Only certifications with an attached, unexpired document are ever published.
    ...(certs.results.length ? { additionalProperty: certs.results.map((x) => ({ "@type": "PropertyValue", name: "certification", value: x.type })) } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BDT",
      price,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: BRAND.name.en },
      shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "BD" } },
    },
  };
  if (p.rating_count > 0) {
    product.aggregateRating = { "@type": "AggregateRating", ratingValue: Number(p.rating_avg.toFixed(1)), reviewCount: p.rating_count };
    product.review = reviews.results.map((r) => ({ "@type": "Review", author: { "@type": "Person", name: r.name }, reviewRating: { "@type": "Rating", ratingValue: r.rating }, reviewBody: r.body, datePublished: r.created_at.slice(0, 10) }));
  }
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${b}/` },
      ...(p.category_slug ? [{ "@type": "ListItem", position: 2, name: p.category, item: `${b}/shop/${p.category_slug}` }] : []),
      { "@type": "ListItem", position: p.category_slug ? 3 : 2, name: p.name_en, item: url },
    ],
  };
  return shell(c, {
    title: p.meta_title || `${p.name_en} — ৳${price} | ${BRAND.name.en}`,
    description: (p.meta_description || p.description_en || `${p.name_en} (${p.name_bn}). Cash on Delivery across Bangladesh.`).slice(0, 300),
    image: images[0] ?? `${b}/img/og-cover.png`,
    url,
    type: "product",
    jsonLd: [product, crumbs],
  });
});

app.get("/shop/:slug", async (c) => {
  const b = base(c);
  const cat = await c.env.DB.prepare("SELECT slug, name_en, name_bn, description_en FROM categories WHERE slug = ? AND deleted_at IS NULL").bind(c.req.param("slug")).first<{ slug: string; name_en: string; name_bn: string; description_en: string | null }>();
  if (!cat) return spa(c);
  const { results } = await c.env.DB.prepare(
    "SELECT p.slug, p.name_en FROM products p JOIN categories c ON c.id = p.category_id WHERE (c.slug = ? OR c.parent_id = (SELECT id FROM categories WHERE slug = ?)) AND p.status='active' AND p.deleted_at IS NULL ORDER BY p.sold_count DESC LIMIT 20",
  )
    .bind(cat.slug, cat.slug)
    .all<{ slug: string; name_en: string }>();
  return shell(c, {
    title: `${cat.name_en} (${cat.name_bn}) | ${BRAND.name.en}`,
    description: cat.description_en ?? `Shop ${cat.name_en} for babies and kids at ${BRAND.name.en}. Cash on Delivery across Bangladesh.`,
    image: `${b}/img/og-cover.png`,
    url: `${b}/shop/${cat.slug}`,
    type: "website",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: cat.name_en,
        itemListElement: results.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${b}/product/${p.slug}`, name: p.name_en })),
      },
    ],
  });
});

app.get("/registry/:slug", async (c) => {
  const b = base(c);
  const r = await c.env.DB.prepare("SELECT slug, title, message FROM registries WHERE slug = ? AND deleted_at IS NULL").bind(c.req.param("slug")).first<{ slug: string; title: string; message: string | null }>();
  if (!r) return spa(c);
  return shell(c, { title: `${r.title} — Gift registry | ${BRAND.name.en}`, description: r.message ?? "Choose a gift for the little one.", image: `${b}/img/og-cover.png`, url: `${b}/registry/${r.slug}`, type: "website", jsonLd: [], noindex: true });
});

app.get("/lp/:slug", async (c) => {
  const b = base(c);
  const lp = await c.env.DB.prepare("SELECT slug, title_en, subtitle_en, image_url FROM landing_pages WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL").bind(c.req.param("slug")).first<{ slug: string; title_en: string; subtitle_en: string | null; image_url: string | null }>();
  if (!lp) return spa(c);
  return shell(c, { title: `${lp.title_en} | ${BRAND.name.en}`, description: lp.subtitle_en ?? BRAND.description.en, image: lp.image_url ? abs(b, lp.image_url) : `${b}/img/og-cover.png`, url: `${b}/lp/${lp.slug}`, type: "website", jsonLd: [], noindex: true });
});

// ---------- R2 media (photos, certificate documents) with long-lived caching ----------
app.get("/media/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/media\//, ""));
  if (!key || key.includes("..") || key.startsWith("backups/")) return c.notFound();
  const cache = "public, max-age=31536000, immutable";
  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(key);
    if (obj) {
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      headers.set("cache-control", cache);
      if (key.startsWith("certificates/")) headers.set("x-robots-tag", "noindex");
      return new Response(obj.body, { headers });
    }
  }
  const kv = await c.env.KV.getWithMetadata<{ contentType?: string }>(`media:${key}`, "arrayBuffer");
  if (!kv.value) return c.notFound();
  return new Response(kv.value, { headers: { "content-type": kv.metadata?.contentType ?? "application/octet-stream", "cache-control": cache } });
});

export default app;
