// Admin: sign-in & 2FA, roles, product CRUD with SKUs and documented certifications, CSV, settings, jobs.
import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import adminLogin from "../fixtures/admin-login.request.json";
import adminLoginResponse from "../fixtures/admin-login.response.json";
import { call, cookieOf, setSetting, superAdmin } from "./helpers";
import { SKU_PATTERN } from "../../worker/src/lib/sku";

let admin = "";
let processor = "";

const product = (over: Record<string, unknown> = {}) => ({
  slug: `test-sippy-cup-${Math.random().toString(36).slice(2, 7)}`,
  name_en: "Sippy Cup",
  name_bn: "সিপি কাপ",
  category_id: 4, // Feeding & Nursing (FED)
  price: 450,
  age_ranges: ["6-12m", "1-3y"],
  status: "active",
  variants: [
    { size: "Standard", color: "Mint", age_range: "6-12m", stock: 5 },
    { size: "Standard", color: "Peach", age_range: "1-3y", stock: 0 },
  ],
  ...over,
});

describe("sign-in and two-factor", () => {
  it("requires Super Admins to finish 2FA setup before anything else works", async () => {
    await call("/api/admin/auth/bootstrap", { method: "POST", json: { token: "test-bootstrap-token-0123456789", name: "Owner", ...adminLogin } });
    const login = await call("/api/admin/auth/login", { method: "POST", json: adminLogin });
    expect(Object.keys(login.data).sort()).toEqual(Object.keys(adminLoginResponse).sort());
    expect(login.data.needs2fa).toBe(true);
    const blocked = await call("/api/admin/orders", { cookie: cookieOf(login.res) });
    expect(blocked.res.status).toBe(403);
    expect(blocked.data.code).toBe("needs_2fa");
  });

  it("asks for the authenticator code once 2FA is on", async () => {
    admin = await superAdmin();
    const noCode = await call("/api/admin/auth/login", { method: "POST", json: adminLogin });
    expect(noCode.res.status).toBe(401);
    expect(noCode.data.code).toBe("totp_required");
    const bad = await call("/api/admin/auth/login", { method: "POST", json: { ...adminLogin, totp: "000000" } });
    expect(bad.data.code).toBe("totp_invalid");
    const me = await call("/api/admin/auth/me", { cookie: admin });
    expect(me.data.admin.totp_enabled).toBe(true);
  });

  it("lets an Order Processor sign in with phone + SMS code", async () => {
    const staff = await call("/api/admin/staff", { method: "POST", cookie: admin, json: { name: "Rina", email: "rina", phone: "01800000001", role: "order_processor", is_active: 1 } });
    expect(staff.res.status).toBe(201);
    const req = await call("/api/admin/auth/otp/request", { method: "POST", json: { phone: "01800000001" } });
    expect(req.data.devCode).toMatch(/^\d{6}$/);
    const ok = await call("/api/admin/auth/otp/verify", { method: "POST", json: { phone: "01800000001", code: req.data.devCode } });
    expect(ok.res.status).toBe(200);
    processor = cookieOf(ok.res);
    // Managers can't use SMS sign-in.
    await call("/api/admin/staff", { method: "POST", cookie: admin, json: { name: "Mona", email: "mona", phone: "01800000002", role: "manager", is_active: 1, password: "Manager-Pass-123" } });
    const mgr = await call("/api/admin/auth/otp/request", { method: "POST", json: { phone: "01800000002" } });
    expect(mgr.data.devCode).toBeUndefined();
  });

  it("enforces roles on the API, not just in the UI", async () => {
    expect((await call("/api/admin/orders", { cookie: processor })).res.status).toBe(200);
    expect((await call("/api/admin/products", { method: "POST", cookie: processor, json: product() })).res.status).toBe(403);
    expect((await call("/api/admin/settings/store", { method: "PUT", cookie: processor, json: {} })).res.status).toBe(403);
    expect((await call("/api/admin/staff", { cookie: processor })).res.status).toBe(403);
  });
});

describe("products, SKUs and certifications", () => {
  it("generates unique SKUs in the BBY-<CAT>-<AGE>-<####> format", async () => {
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: product() });
    expect(r.res.status).toBe(201);
    expect(r.data.skus).toHaveLength(2);
    for (const sku of r.data.skus) expect(sku).toMatch(SKU_PATTERN);
    expect(r.data.skus[0]).toMatch(/^BBY-FED-6-12M-\d{4}$/);
    expect(r.data.skus[1]).toMatch(/^BBY-FED-1-3Y-\d{4}$/);
    const again = await call("/api/admin/products", { method: "POST", cookie: admin, json: product() });
    expect(new Set([...r.data.skus, ...again.data.skus]).size).toBe(4);
  });

  it("keeps SKUs unique at the database level", async () => {
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ variants: [{ sku: "BBY-CLO-0-6M-0001", stock: 1 }] }) });
    expect(r.res.status).toBe(409);
    expect(r.data.fields[0].field).toBe("sku");
    await expect(env.DB.prepare("INSERT INTO product_variants (product_id, sku) VALUES (1, 'BBY-CLO-0-6M-0001')").run()).rejects.toThrow(/UNIQUE/);
  });

  it("cannot save a certification badge without its supporting document", async () => {
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ certifications: [{ type: "bpa_free", issuer: "Lab", document_url: "" }] }) });
    expect(r.res.status).toBe(422);
    expect(r.data.fields[0].field).toBe("certifications.0.document_url");
    // …and the database refuses it too.
    await expect(env.DB.prepare("INSERT INTO certifications (product_id, type, document_url) VALUES (1, 'bpa_free', '  ')").run()).rejects.toThrow(/CHECK/);
  });

  it("shows only documented, unexpired certifications to shoppers", async () => {
    const up = new FormData();
    up.append("folder", "certificates");
    up.append("file", new File([new Uint8Array([37, 80, 68, 70])], "bpa-report.pdf", { type: "application/pdf" }));
    const upload = await call("/api/admin/uploads", { method: "POST", cookie: admin, body: up });
    expect(upload.res.status).toBe(201);
    expect(upload.data.url).toMatch(/^\/media\/certificates\//);
    const p = product({ certifications: [{ type: "bpa_free", issuer: "Test Lab", document_url: upload.data.url, document_name: "bpa-report.pdf" }, { type: "safety_tested", document_url: upload.data.url, valid_until: "2020-01-01" }] });
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: p });
    expect(r.res.status).toBe(201);
    const pub = await call(`/api/products/${p.slug}`);
    expect(pub.data.certifications.map((c: any) => c.type)).toEqual(["bpa_free"]);
    const doc = await call(upload.data.url, { raw: true });
    expect(doc.res.status).toBe(200);
    await doc.res.arrayBuffer();
  });

  it("keeps SKUs when a product is edited and blocks removing sold options", async () => {
    const created = await call("/api/admin/products", { method: "POST", cookie: admin, json: product() });
    const detail = await call(`/api/admin/products/${created.data.id}`, { cookie: admin });
    const variants = detail.data.item.variants.map((v: any) => ({ id: v.id, sku: "", size: v.size, color: v.color, age_range: v.age_range, stock: v.stock + 1 }));
    const saved = await call(`/api/admin/products/${created.data.id}`, { method: "PUT", cookie: admin, json: { ...product({ slug: detail.data.item.slug }), variants } });
    expect(saved.res.status).toBe(200);
    expect(saved.data.skus).toEqual(created.data.skus);
    const romper = await call("/api/admin/products/1", { cookie: admin });
    await env.DB.prepare(
      "INSERT INTO orders (order_no, public_token, customer_name, customer_phone, division_id, district_id, upazila_id, division, district, upazila, area, zone_code, subtotal, total, payment_method) VALUES ('T-1','t','A','01700000000',6,47,9026,'D','D','M','x','dhaka_city',1,1,'COD')",
    ).run();
    await env.DB.prepare("INSERT INTO order_items (order_id, product_id, variant_id, sku, name_en, name_bn, quantity, unit_price, line_total) VALUES ((SELECT id FROM orders WHERE order_no='T-1'), 1, ?, 'x', 'x', 'x', 1, 1, 1)")
      .bind(romper.data.item.variants[0].id)
      .run();
    const it = romper.data.item;
    const removeSold = await call("/api/admin/products/1", {
      method: "PUT",
      cookie: admin,
      json: { ...it, age_ranges: it.age_ranges, sale_price: it.sale_price, variants: it.variants.slice(1).map((v: any) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, age_range: v.age_range, stock: v.stock })), certifications: [] },
    });
    expect(removeSold.res.status).toBe(409);
  });

  it("exports and re-imports products as CSV", async () => {
    const csv = await call("/api/admin/products?format=csv", { cookie: admin });
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
    const header = csv.data.replace(/^﻿/, "").split("\r\n")[0];
    expect(header).toContain("variant_sku");
    const body = `slug,name_en,name_bn,category_code,price,age_ranges,status,variant_sku,size,color,variant_age_range,stock\r\nimported-rattle,Soft Rattle,নরম ঝুনঝুনি,TOY,300,0-6m|6-12m,active,,Standard,Yellow,0-6m,12\r\nbad-row,No Category,x,ZZZ,100,,active,,Standard,,,1\r\n`;
    const imp = await call("/api/admin/products/import", { method: "POST", cookie: admin, body, headers: { "content-type": "text/csv" } });
    expect(imp.data.results).toEqual([{ slug: "imported-rattle", ok: true }, { slug: "bad-row", ok: false, error: expect.stringContaining("Unknown category") }]);
    const p = await call("/api/products/imported-rattle");
    expect(p.data.variants[0].sku).toMatch(/^BBY-TOY-0-6M-\d{4}$/);
  });

  it("notifies everyone waiting once an item is back in stock", async () => {
    const created = await call("/api/admin/products", { method: "POST", cookie: admin, json: product() });
    const detail = await call(`/api/admin/products/${created.data.id}`, { cookie: admin });
    const outOfStock = detail.data.item.variants.find((v: any) => v.stock === 0);
    const req = await call("/api/stock-notify", { method: "POST", json: { productId: created.data.id, variantId: outOfStock.id, phone: "01711000001" } });
    expect(req.res.status).toBe(201);
    await call("/api/admin/inventory/adjust", { method: "POST", cookie: admin, json: { items: [{ variantId: outOfStock.id, mode: "add", quantity: 3, reason: "restock" }] } });
    const n = await call(`/api/admin/products/${created.data.id}/notify-waiting`, { method: "POST", cookie: admin });
    expect(n.data.sent).toBe(1);
    const log = await call(`/api/admin/inventory/log?variant_id=${outOfStock.id}`, { cookie: admin });
    expect(log.data.items[0]).toMatchObject({ change: 3, stock_after: 3, reason: "restock" });
  });
});

describe("categories, settings and housekeeping", () => {
  it("creates nested categories and saves drag-to-reorder", async () => {
    const c = await call("/api/admin/categories", { method: "POST", cookie: admin, json: { slug: "teethers", code: "TOY", parent_id: 6, name_en: "Teethers", name_bn: "টিথার" } });
    expect(c.res.status).toBe(201);
    const r = await call("/api/admin/categories/reorder", { method: "PUT", cookie: admin, json: { items: [{ id: c.data.id, parent_id: 6, sort_order: 0 }] } });
    expect(r.res.status).toBe(200);
    const del = await call("/api/admin/categories/4", { method: "DELETE", cookie: admin });
    expect(del.res.status).toBe(409); // still has products
  });

  it("switches a category Active ⇄ Inactive in one tap, with its sub-categories", async () => {
    const slugs = async () => ((await call("/api/categories")).data.categories as { slug: string }[]).map((c) => c.slug);
    expect(await slugs()).toEqual(expect.arrayContaining(["toys-learning", "soft-toys", "learning-toys"]));
    expect((await call("/api/products?category=toys-learning")).data.total).toBeGreaterThan(0);

    expect((await call("/api/admin/categories/6/status", { method: "PUT", cookie: processor, json: { is_active: false } })).res.status).toBe(403);
    const off = await call("/api/admin/categories/6/status", { method: "PUT", cookie: admin, json: { is_active: false } });
    expect(off.res.status).toBe(200);
    expect(off.data.ids.length).toBeGreaterThanOrEqual(3); // parent + its sub-categories
    expect(off.data.en).toMatch(/inactive/);
    const after = await slugs();
    expect(after).not.toContain("toys-learning");
    expect(after).not.toContain("soft-toys");
    expect((await call("/api/products?category=toys-learning")).data.total).toBe(0);
    // Products themselves stay on sale.
    expect((await call("/api/products/plush-teddy-bear")).res.status).toBe(200);
    const listed = await call("/api/admin/categories?is_active=0", { cookie: admin });
    expect(listed.data.items.map((c: { slug: string }) => c.slug)).toEqual(expect.arrayContaining(["toys-learning", "soft-toys"]));

    const on = await call("/api/admin/categories/6/status", { method: "PUT", cookie: admin, json: { is_active: true } });
    expect(on.res.status).toBe(200);
    expect(await slugs()).toEqual(expect.arrayContaining(["toys-learning", "soft-toys", "learning-toys"]));
    const audit = await env.DB.prepare("SELECT action FROM audit_log WHERE entity = 'category' AND entity_id = '6' ORDER BY id").all<{ action: string }>();
    expect(audit.results.map((r) => r.action)).toEqual(expect.arrayContaining(["deactivate", "activate"]));
  });

  it("creates a new category as Inactive from the form (blank optional fields) and turns it on", async () => {
    // Exactly what the admin form sends when the optional fields, including "Tile colour", are left blank.
    const form = { name_en: "Baby Carriers", name_bn: "বেবি ক্যারিয়ার", slug: "baby-carriers", code: "BAB", parent_id: null, description_en: "", description_bn: "", image_url: "", color: "", sort_order: 0, is_active: 0 };
    const created = await call("/api/admin/categories", { method: "POST", cookie: admin, json: form });
    expect(created.res.status).toBe(201);
    const row = await env.DB.prepare("SELECT color, is_active FROM categories WHERE id = ?").bind(created.data.id).first<{ color: string | null; is_active: number }>();
    expect(row).toEqual({ color: null, is_active: 0 });
    const slugs = async () => ((await call("/api/categories")).data.categories as { slug: string }[]).map((c) => c.slug);
    expect(await slugs()).not.toContain("baby-carriers");
    await call(`/api/admin/categories/${created.data.id}/status`, { method: "PUT", cookie: admin, json: { is_active: true } });
    expect(await slugs()).toContain("baby-carriers");
  });

  it("refuses API secrets in database-backed settings and validates rule settings", async () => {
    const bad = await call("/api/admin/settings/integrations", { method: "PUT", cookie: admin, json: { metaPixelId: "1", apiToken: "x" } });
    expect(bad.res.status).toBe(400);
    const invalid = await call("/api/admin/settings/fraud", { method: "PUT", cookie: admin, json: { velocityMaxPerPhone: 0 } });
    expect(invalid.res.status).toBe(422);
    await setSetting(admin, "tax", { enabled: true, rate: 5, inclusive: true, bin: "000123456-0101" });
    const s = await call("/api/admin/settings", { cookie: admin });
    expect(s.data.settings.tax).toMatchObject({ enabled: true, rate: 5 });
    expect(JSON.stringify(s.data)).not.toMatch(/SECRET|PASSWD/);
  });

  it("runs background jobs: recovery messages and retention purge", async () => {
    await setSetting(admin, "abandoned", { autoRecovery: true, recoveryDelayMin: 10, recoveryDiscount: 50 });
    await env.DB.prepare("INSERT INTO abandoned_checkouts (session_id, name, phone, cart, cart_total, updated_at) VALUES ('sess-job-000000000001', 'Liza', '01711000002', '[]', 500, ?)")
      .bind(new Date(Date.now() - 2 * 3600_000).toISOString())
      .run();
    await env.DB.prepare("INSERT INTO abandoned_checkouts (session_id, phone, updated_at) VALUES ('sess-old-0000000000001', '01711000003', '2020-01-01T00:00:00.000Z')").run();
    const r = await call("/api/admin/jobs/run", { method: "POST", cookie: admin });
    expect(r.data.result.purged).toBe(1);
    const row = await env.DB.prepare("SELECT recovery_sent_at FROM abandoned_checkouts WHERE session_id = 'sess-job-000000000001'").first<{ recovery_sent_at: string | null }>();
    expect(row!.recovery_sent_at).not.toBeNull();
    const coupon = await env.DB.prepare("SELECT kind, value, customer_phone FROM coupons WHERE kind = 'recovery'").first();
    expect(coupon).toMatchObject({ kind: "recovery", value: 50, customer_phone: "01711000002" });
  });

  it("records every admin action in the audit log", async () => {
    const log = await call("/api/admin/audit?entity=product", { cookie: admin });
    expect(log.data.items.some((x: any) => x.action === "create")).toBe(true);
    const csv = await call("/api/admin/audit?format=csv", { cookie: admin });
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
  });

  it("guides first-time setup with a checklist", async () => {
    const o = await call("/api/admin/onboarding", { cookie: admin });
    expect(o.data.steps.map((s: any) => s.key)).toEqual(["store", "product", "zone", "payment", "whatsapp"]);
    expect(o.data.steps.find((s: any) => s.key === "product").done).toBe(true);
  });
});
