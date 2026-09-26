// Checkout → fraud checks → confirmation gates → invoice → delivery outcomes, plus abandoned-checkout capture.
import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import createOrderFixture from "../fixtures/create-order.request.json";
import createOrderResponse from "../fixtures/create-order.response.json";
import { address, call, otpToken, setSetting, stockOf, superAdmin, variantId } from "./helpers";
import { INVOICE_PATTERN } from "../../worker/src/lib/sku";

let admin = "";
const ROMPER = "BBY-CLO-0-6M-0001";

beforeAll(async () => {
  admin = await superAdmin();
  // Plenty of stock for the many test orders below.
  await env.DB.prepare("UPDATE product_variants SET stock = 500 WHERE sku = ?").bind(ROMPER).run();
});

async function placeOrder(overrides: Record<string, unknown> = {}, phone = "01711223344") {
  return call("/api/orders", { method: "POST", json: { ...createOrderFixture, customer: { name: "Nusrat Jahan", phone, email: "" }, ...overrides } });
}

async function orderId(orderNo: string) {
  return (await env.DB.prepare("SELECT id FROM orders WHERE order_no = ?").bind(orderNo).first<{ id: number }>())!.id;
}

describe("checkout", () => {
  it("rejects requests without the CSRF header", async () => {
    const { exports } = await import("cloudflare:workers");
    const res = await exports.default.fetch(new Request("https://shop.test/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(createOrderFixture) }));
    expect(res.status).toBe(403);
  });

  it("returns bilingual field errors", async () => {
    const { res, data } = await placeOrder({}, "12345");
    expect(res.status).toBe(422);
    expect(data.code).toBe("validation");
    expect(data.fields[0].field).toBe("customer.phone");
  });

  it("requires phone verification for COD when SMS is available", async () => {
    const { res, data } = await placeOrder({}, "01799990001");
    expect(res.status).toBe(422);
    expect(data.code).toBe("otp_required");
  });

  it("places a verified COD order with SKUs, UTM attribution and a Purchase event id", async () => {
    const before = await stockOf(ROMPER);
    const token = await otpToken("01799990002");
    const { res, data } = await placeOrder({ otpToken: token, sessionId: "sess-verified-0000000002" }, "01799990002");
    expect(res.status).toBe(201);
    expect(Object.keys(data).sort()).toEqual(Object.keys(createOrderResponse).sort());
    expect(data.status).toBe("pending"); // a first-time customer is not auto-confirmed
    expect(data.purchaseEventId).toBe(`purchase-${data.orderNo}`);
    expect(data.items[0].sku).toBe(ROMPER);
    expect(await stockOf(ROMPER)).toBe(before - 2);
    const o = await env.DB.prepare("SELECT otp_verified, risk_level, utm_source, utm_campaign, invoice_no FROM orders WHERE order_no = ?").bind(data.orderNo).first<Record<string, unknown>>();
    expect(o).toMatchObject({ otp_verified: 1, risk_level: "medium", utm_source: "facebook", utm_campaign: "eid-baby-sale", invoice_no: null });
    // The server-side event is sent in the background (waitUntil), so give it a moment.
    let ev: Record<string, unknown> | null = null;
    for (let i = 0; i < 40 && !ev; i++) {
      await new Promise((r) => setTimeout(r, 25));
      ev = await env.DB.prepare("SELECT event_name, event_id, status FROM marketing_events WHERE event_id = ?").bind(data.purchaseEventId).first();
    }
    expect(ev).toMatchObject({ event_name: "Purchase", status: "skipped" }); // Pixel/CAPI not connected in tests
  });
});

describe("confirmation gates", () => {
  let unverified = "";
  beforeAll(async () => {
    await setSetting(admin, "fraud", { requireOtp: false });
    const { res, data } = await placeOrder({}, "01799990003");
    expect(res.status).toBe(201);
    unverified = data.orderNo;
  });

  it("blocks confirming an unverified COD order until a call is logged", async () => {
    const id = await orderId(unverified);
    const blocked = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "confirmed" } });
    expect(blocked.res.status).toBe(409);
    expect(blocked.data.code).toBe("needs_confirmation");

    const noAnswer = await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "no_answer" } });
    expect(noAnswer.data.order.status).toBe("confirmation_attempted");

    const confirmed = await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "confirmed", note: "Spoke to mother" } });
    expect(confirmed.res.status).toBe(200);
    expect(confirmed.data.order.status).toBe("confirmed");
    expect(confirmed.data.order.confirmation_method).toBe("call");
    expect(confirmed.data.order.invoice_no).toMatch(INVOICE_PATTERN);

    const detail = await call(`/api/admin/orders/${id}`, { cookie: admin });
    expect(detail.data.attempts.map((a: any) => a.outcome)).toEqual(["no_answer", "confirmed"]);
    expect(detail.data.contact.tel).toBe("tel:01799990003");
    expect(detail.data.contact.whatsapp.confirmed.url).toContain("https://wa.me/8801799990003");
  });

  it("issues sequential invoice numbers and a PDF invoice", async () => {
    const token = await otpToken("01799990004");
    const second = await placeOrder({ otpToken: token }, "01799990004");
    const id2 = await orderId(second.data.orderNo);
    const c2 = await call(`/api/admin/orders/${id2}/status`, { method: "POST", cookie: admin, json: { status: "confirmed" } });
    expect(c2.res.status).toBe(200);
    expect(c2.data.order.confirmation_method).toBe("otp");
    const first = await env.DB.prepare("SELECT invoice_no FROM orders WHERE order_no = ?").bind(unverified).first<{ invoice_no: string }>();
    const n1 = Number(first!.invoice_no.split("-").pop());
    const n2 = Number(c2.data.order.invoice_no.split("-").pop());
    expect(n2).toBe(n1 + 1);

    const pdf = await call(`/api/admin/orders/${id2}/invoice.pdf`, { cookie: admin, raw: true });
    expect(pdf.res.headers.get("content-type")).toBe("application/pdf");
    const text = new TextDecoder().decode(await pdf.res.arrayBuffer());
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toContain(c2.data.order.invoice_no);
    expect(text).toContain(ROMPER);

    // Customers can download it with their private link too.
    const pub = await call(`/api/orders/${second.data.orderNo}/invoice.pdf?token=${second.data.token}`, { raw: true });
    expect(pub.res.headers.get("content-type")).toBe("application/pdf");
    await pub.res.arrayBuffer();
  });

  it("requires a confirmation call before shipping a non-trusted COD order", async () => {
    const token = await otpToken("01799990005");
    const o = await placeOrder({ otpToken: token }, "01799990005");
    const id = await orderId(o.data.orderNo);
    await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "confirmed" } });
    await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "packed" } });
    const ship = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "shipped", courier: "RedX", trackingId: "RX123" } });
    expect(ship.res.status).toBe(409);
    expect(ship.data.code).toBe("needs_call");
    await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "confirmed" } });
    const ok = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "shipped", courier: "RedX", trackingId: "RX123" } });
    expect(ok.res.status).toBe(200);
    expect(ok.data.order.tracking_id).toBe("RX123");
  });
});

describe("distinct outcomes: cancelled, refused at delivery, returned", () => {
  async function shippedOrder(phone: string) {
    const token = await otpToken(phone);
    const o = await placeOrder({ otpToken: token, items: [{ variantId: await variantId("BBY-DIA-6-12M-0002"), quantity: 1 }] }, phone);
    const id = await orderId(o.data.orderNo);
    await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "confirmed" } });
    await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "packed" } });
    const s = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "shipped", courier: "Steadfast", trackingId: `SF-${phone}` } });
    expect(s.res.status).toBe(200);
    return { id, orderNo: o.data.orderNo as string, token: o.data.token as string };
  }

  it("declining on the call cancels the order and puts stock back", async () => {
    const before = await stockOf(ROMPER);
    const o = await placeOrder({}, "01799990006");
    expect(await stockOf(ROMPER)).toBe(before - 2);
    const id = await orderId(o.data.orderNo);
    const r = await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "declined" } });
    expect(r.data.order.status).toBe("cancelled");
    expect(await stockOf(ROMPER)).toBe(before);
    const cust = await env.DB.prepare("SELECT cancelled_count, refused_or_returned_count FROM customers WHERE phone = '01799990006'").first();
    expect(cust).toMatchObject({ cancelled_count: 1, refused_or_returned_count: 0 });
  });

  it("refused at delivery is recorded separately and restocks", async () => {
    const sku = "BBY-DIA-6-12M-0002";
    const before = await stockOf(sku);
    const { id } = await shippedOrder("01799990007");
    expect(await stockOf(sku)).toBe(before - 1);
    const cannotCancel = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "cancelled" } });
    expect(cannotCancel.res.status).toBe(409);
    const refused = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "refused", note: "Customer not home, refused on call" } });
    expect(refused.data.order.status).toBe("refused");
    expect(await stockOf(sku)).toBe(before);
    const cust = await env.DB.prepare("SELECT refused_or_returned_count, cancelled_count FROM customers WHERE phone = '01799990007'").first();
    expect(cust).toMatchObject({ refused_or_returned_count: 1, cancelled_count: 0 });
  });

  it("a delivered order can be returned through a customer return request", async () => {
    const phone = "01799990008";
    const { id, orderNo } = await shippedOrder(phone);
    const d = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "delivered" } });
    expect(d.data.order.payment_status).toBe("paid");
    // Customer signs up with the same phone (claims the guest order) and requests a return.
    const reg = await call("/api/auth/register", { method: "POST", json: { name: "Rafi", phone, password: "Parent-pass-1" } });
    const cust = reg.res.headers.get("set-cookie")!.split(";")[0]!;
    const rr = await call("/api/me/returns", { method: "POST", cookie: cust, json: { orderNo, reason: "wrong_size", details: "Too small" } });
    expect(rr.res.status).toBe(201);
    const list = await call("/api/admin/returns?status=requested", { cookie: admin });
    const ret = list.data.items.find((x: any) => x.order_no === orderNo);
    await call(`/api/admin/returns/${ret.id}`, { method: "PUT", cookie: admin, json: { status: "approved" } });
    await call(`/api/admin/returns/${ret.id}`, { method: "PUT", cookie: admin, json: { status: "received" } });
    const refund = await call(`/api/admin/returns/${ret.id}`, { method: "PUT", cookie: admin, json: { status: "refunded", refund_amount: 500, refund_method: "bKash" } });
    expect(refund.res.status).toBe(200);
    const o = await env.DB.prepare("SELECT status, refund_amount, payment_status FROM orders WHERE id = ?").bind(id).first();
    expect(o).toMatchObject({ status: "returned", refund_amount: 500, payment_status: "partially_refunded" });
    const report = await call("/api/admin/reports/outcomes", { cookie: admin });
    const sf = report.data.rows.find((r: any) => r.label === "Steadfast");
    expect(sf).toMatchObject({ refused_at_delivery: 1, returned: 1 });
  });
});

describe("trusted fast lane & velocity checks", () => {
  it("auto-confirms a verified order from a customer with 3+ delivered orders", async () => {
    const phone = "01799990009";
    for (let i = 0; i < 3; i++) {
      await env.DB.prepare(
        `INSERT INTO orders (order_no, public_token, customer_name, customer_phone, division_id, district_id, upazila_id, division, district, upazila, area, zone_code, subtotal, total, payment_method, payment_status, status)
         VALUES (?, 't', 'Old', ?, 6, 47, 9026, 'Dhaka', 'Dhaka', 'Mirpur', 'x', 'dhaka_city', 500, 570, 'COD', 'paid', 'delivered')`,
      )
        .bind(`OLD-${phone}-${i}`, phone)
        .run();
      await env.DB.prepare("UPDATE orders SET created_at = ? WHERE order_no = ?")
        .bind(new Date(Date.now() - (40 + i) * 86400_000).toISOString(), `OLD-${phone}-${i}`)
        .run();
    }
    const token = await otpToken(phone);
    const { data } = await placeOrder({ otpToken: token }, phone);
    expect(data.status).toBe("confirmed");
    const o = await env.DB.prepare("SELECT confirmation_method, risk_level, invoice_no FROM orders WHERE order_no = ?").bind(data.orderNo).first<Record<string, string>>();
    expect(o).toMatchObject({ confirmation_method: "trusted", risk_level: "low" });
    expect(o!.invoice_no).toMatch(INVOICE_PATTERN);
  });

  it("flags several orders from one phone in a short window", async () => {
    const phone = "01799990010";
    await placeOrder({}, phone);
    await placeOrder({}, phone);
    const third = await placeOrder({}, phone);
    const o = await env.DB.prepare("SELECT flags FROM orders WHERE order_no = ?").bind(third.data.orderNo).first<{ flags: string }>();
    expect(JSON.parse(o!.flags)).toContain("velocity_phone");
    const flagged = await call("/api/admin/orders?flagged=1", { cookie: admin });
    expect(flagged.data.items.some((x: any) => x.order_no === third.data.orderNo)).toBe(true);
  });
});

describe("abandoned checkout capture", () => {
  it("autosaves partial details, surfaces them after the window, and links a later order", async () => {
    const sid = "sess-abandoned-000000000001";
    const d = await call("/api/checkout/draft", {
      method: "POST",
      json: { sessionId: sid, name: "Shirin", phone: "01799990011", district: "Dhaka", upazila: "Mirpur", items: [{ variantId: 1, quantity: 1 }], lastStep: "address", utm: { source: "facebook", campaign: "retarget" } },
    });
    expect(d.data.leadEventId).toBe(`lead-${sid}`);
    // Not abandoned yet (still inside the 30-minute window)…
    let list = await call("/api/admin/abandoned", { cookie: admin });
    expect(list.data.items.some((x: any) => x.session_id === sid)).toBe(false);
    // …pretend 45 minutes passed.
    await env.DB.prepare("UPDATE abandoned_checkouts SET updated_at = ? WHERE session_id = ?").bind(new Date(Date.now() - 45 * 60_000).toISOString(), sid).run();
    list = await call("/api/admin/abandoned", { cookie: admin });
    const row = list.data.items.find((x: any) => x.session_id === sid);
    expect(row).toMatchObject({ name: "Shirin", phone: "01799990011", last_step: "address", cart_total: 590 });
    expect(row.cart[0].sku).toBe(ROMPER);
    expect(row.whatsapp).toContain("wa.me/8801799990011");

    const csv = await call("/api/admin/abandoned?format=csv", { cookie: admin });
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
    expect(csv.data).toContain("01799990011");

    const resume = await call(`/api/checkout/resume/${sid}`);
    expect(resume.data.items).toEqual([{ variantId: 1, quantity: 1 }]);

    await placeOrder({ sessionId: sid }, "01799990011");
    const after = await env.DB.prepare("SELECT status, order_id FROM abandoned_checkouts WHERE session_id = ?").bind(sid).first<{ status: string; order_id: number }>();
    expect(after!.status).toBe("recovered");
    expect(after!.order_id).toBeGreaterThan(0);
  });

  it("staff can mark an abandoned checkout as not interested", async () => {
    const sid = "sess-abandoned-000000000002";
    await call("/api/checkout/draft", { method: "POST", json: { sessionId: sid, name: "Tuli", phone: "01799990012", items: [], lastStep: "contact" } });
    await env.DB.prepare("UPDATE abandoned_checkouts SET updated_at = ? WHERE session_id = ?").bind(new Date(Date.now() - 3600_000).toISOString(), sid).run();
    const row = (await call("/api/admin/abandoned", { cookie: admin })).data.items.find((x: any) => x.session_id === sid);
    const r = await call(`/api/admin/abandoned/${row.id}`, { method: "POST", cookie: admin, json: { action: "ignored" } });
    expect(r.res.status).toBe(200);
    const ignored = await call("/api/admin/abandoned?status=ignored", { cookie: admin });
    expect(ignored.data.items.some((x: any) => x.session_id === sid)).toBe(true);
  });
});

describe("order list exports & bulk actions", () => {
  it("exports orders and customers to CSV", async () => {
    const orders = await call("/api/admin/orders?format=csv", { cookie: admin });
    expect(orders.res.headers.get("content-type")).toContain("text/csv");
    expect(orders.data.split("\n")[0]).toContain("invoice_no");
    const customers = await call("/api/admin/customers?format=csv", { cookie: admin });
    expect(customers.data.split("\n")[0]).toContain("risk_level");
  });

  it("marks several orders in one step and reports which ones could not move", async () => {
    const ids: number[] = [];
    for (const phone of ["01799990013", "01799990014"]) {
      const token = await otpToken(phone);
      const o = await placeOrder({ otpToken: token }, phone);
      ids.push(await orderId(o.data.orderNo));
    }
    const confirmed = await call("/api/admin/orders/bulk-status", { method: "POST", cookie: admin, json: { ids, status: "confirmed" } });
    expect(confirmed.data.done).toEqual(ids);
    const shipped = await call("/api/admin/orders/bulk-status", { method: "POST", cookie: admin, json: { ids, status: "shipped", courier: "RedX" } });
    // Not packed yet → both stay put, with a plain reason each.
    expect(shipped.data.failed.length).toBe(2);
    expect(shipped.data.failed[0].reason).toMatch(/cannot be moved/);
  });

  it("tracks an order with the phone number and masks it", async () => {
    const { data } = await placeOrder({}, "01799990015");
    const t = await call(`/api/orders/track?order=${data.orderNo}&phone=01799990015`);
    expect(t.data.order.customer_phone).toBe("017*****015");
    expect(t.data.order.status_label.en).toBe("Pending");
    const wrong = await call(`/api/orders/track?order=${data.orderNo}&phone=01700000000`);
    expect(wrong.res.status).toBe(404);
  });

  it("reports revenue by campaign", async () => {
    const r = await call("/api/admin/reports/sales?group=campaign", { cookie: admin });
    expect(r.data.rows.some((x: any) => x.label === "eid-baby-sale" && x.source === "facebook")).toBe(true);
  });

  it("dashboard shows KPIs, attention list and health check", async () => {
    const d = await call("/api/admin/dashboard", { cookie: admin });
    expect(d.data.kpis.pendingCod.value).toBeGreaterThan(0);
    expect(d.data.salesChart.length).toBe(12);
    const a = await call("/api/admin/attention", { cookie: admin });
    expect(a.data.confirmationCalls.length).toBeGreaterThan(0);
    const h = await call("/api/admin/health", { cookie: admin });
    expect(h.data.lines.find((l: any) => l.key === "facebook").en).toContain("not connected yet");
  });
});

describe("gift registry", () => {
  it("lets a parent share a registry and a relative buy from it without seeing the address", async () => {
    const reg = await call("/api/auth/register", { method: "POST", json: { name: "Mitu Akter", phone: "01799990016", password: "Parent-pass-1" } });
    const cust = reg.res.headers.get("set-cookie")!.split(";")[0]!;
    const addr = await call("/api/me/addresses", { method: "POST", cookie: cust, json: { ...address.mirpur, recipient_name: "Mitu Akter", phone: "01799990016", label: "Home" } });
    const r = await call("/api/me/registries", { method: "POST", cookie: cust, json: { title: "Baby shower for Mitu", event_type: "baby_shower", address_id: addr.data.id, ship_to_parent: 1 } });
    expect(r.res.status).toBe(201);
    const bottle = await variantId("BBY-FED-ALL-0001");
    await call(`/api/me/registries/${r.data.id}/items`, { method: "POST", cookie: cust, json: { productId: (await env.DB.prepare("SELECT product_id FROM product_variants WHERE id = ?").bind(bottle).first<{ product_id: number }>())!.product_id, variantId: bottle, quantity: 2 } });
    const pub = await call(`/api/registries/${r.data.slug}`);
    expect(pub.data.registry.owner_name).toBe("Mitu");
    expect(JSON.stringify(pub.data)).not.toContain("Section 10");
    expect(pub.data.registry.ships_to_parent).toBe(true);

    await setSetting(admin, "fraud", { requireOtp: false });
    const order = await call("/api/orders", {
      method: "POST",
      json: { customer: { name: "Aunt Rupa", phone: "01799990017" }, items: [{ variantId: bottle, quantity: 1 }], paymentMethod: "COD", registrySlug: r.data.slug, giftMessage: "Welcome, little one!" },
    });
    expect(order.res.status).toBe(201);
    const o = await env.DB.prepare("SELECT area, upazila, registry_id, gift_message FROM orders WHERE order_no = ?").bind(order.data.orderNo).first();
    expect(o).toMatchObject({ area: address.mirpur.area, upazila: "Mirpur", gift_message: "Welcome, little one!" });
    const after = await call(`/api/registries/${r.data.slug}`);
    expect(after.data.items[0].quantity_purchased).toBe(1);
    const adminList = await call("/api/admin/registries", { cookie: admin });
    expect(adminList.data.items.find((x: any) => x.slug === r.data.slug)).toMatchObject({ wanted: 2, purchased: 1, orders: 1 });
  });
});
