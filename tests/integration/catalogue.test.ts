// Storefront catalogue, age filtering, delivery fees, SEO and feeds.
import { describe, expect, it } from "vitest";
import productListFixture from "../fixtures/product-list.response.json";
import { address, call } from "./helpers";

describe("catalogue", () => {
  it("lists active products with the fixture's shape", async () => {
    const { res, data } = await call("/api/products?limit=2&sort=newest");
    expect(res.status).toBe(200);
    expect(Object.keys(data).sort()).toEqual(Object.keys(productListFixture).sort());
    expect(Object.keys(data.items[0]).sort()).toEqual(Object.keys(productListFixture.items[0]!).sort());
  });

  it("filters by age range correctly across the catalogue", async () => {
    const all = await call("/api/products?limit=48");
    for (const age of ["0-6m", "6-12m", "1-3y", "3-5y"]) {
      const { data } = await call(`/api/products?age=${age}&limit=48`);
      const expected = all.data.items.filter((p: any) => p.age_ranges.includes(age)).length;
      expect(data.total).toBe(expected);
      expect(data.items.every((p: any) => p.age_ranges.includes(age))).toBe(true);
    }
    const two = await call("/api/products?age=0-6m,3-5y&limit=48");
    expect(two.data.items.every((p: any) => p.age_ranges.includes("0-6m") || p.age_ranges.includes("3-5y"))).toBe(true);
    // "1-3y" must not match "11-3y"-style substrings — codes are delimited.
    const facets = await call("/api/facets");
    expect(facets.data.ages.map((a: any) => a.code)).toEqual(["0-6m", "6-12m", "1-3y", "3-5y"]);
  });

  it("filters by category (with sub-categories), brand and price", async () => {
    const clothing = await call("/api/products?category=baby-clothing&limit=48");
    expect(clothing.data.total).toBe(3);
    const brand = await call("/api/products?brand=PlayJoy&limit=48");
    expect(brand.data.items.every((p: any) => p.brand === "PlayJoy")).toBe(true);
    const cheap = await call("/api/products?max=600&limit=48");
    expect(cheap.data.items.every((p: any) => (p.sale_price ?? p.price) <= 600)).toBe(true);
  });

  it("shows real stock and no certification badges until documents exist", async () => {
    const { data } = await call("/api/products/soft-cotton-romper");
    expect(data.product.name_bn).toContain("রম্পার");
    expect(data.certifications).toEqual([]);
    expect(data.variants.length).toBe(8);
    expect(data.variants.some((v: any) => v.stock === 0)).toBe(true);
    expect(data.product.size_chart).toBe("clothing");
  });

  it("calculates tiered delivery fees by upazila, district, division and default", async () => {
    const q = (a: { division_id: number; district_id: number; upazila_id: number }, subtotal = 500) =>
      call(`/api/delivery-fee?division_id=${a.division_id}&district_id=${a.district_id}&upazila_id=${a.upazila_id}&subtotal=${subtotal}`);
    expect((await q(address.mirpur)).data).toMatchObject({ zone: { code: "dhaka_city" }, fee: 70 });
    expect((await q(address.mirpur, 2500)).data.fee).toBe(0);
    expect((await q(address.savar)).data).toMatchObject({ zone: { code: "dhaka_suburbs" }, fee: 100 });
    expect((await q({ division_id: 6, district_id: 44, upazila_id: 342 })).data.zone.code).toBe("dhaka_division");
    expect((await q(address.chattogram)).data).toMatchObject({ zone: { code: "outside" }, fee: 130 });
  });

  it("quotes a cart on the server", async () => {
    const { data } = await call("/api/cart/quote", { method: "POST", json: { items: [{ variantId: 1, quantity: 2 }], address: address.mirpur } });
    expect(data).toMatchObject({ subtotal: 1180, deliveryFee: 70, total: 1250 });
    expect(data.lines[0].sku).toMatch(/^BBY-CLO-0-6M-\d{4}$/);
  });

  it("serves SEO pages, sitemap, robots and the shopping feed", async () => {
    const page = await call("/product/soft-cotton-romper");
    expect(page.res.headers.get("content-type")).toContain("text/html");
    expect(page.data).toContain('"@type":"Product"');
    expect(page.data).toContain('"priceCurrency":"BDT"');
    const sm = await call("/sitemap.xml");
    expect(sm.data).toContain("/product/soft-cotton-romper");
    const robots = await call("/robots.txt");
    expect(robots.data).toContain("Sitemap:");
    const feed = await call("/feeds/google.xml");
    expect(feed.data).toContain("<g:id>BBY-CLO-0-6M-0001</g:id>");
    expect(feed.data).toContain("<g:price>650.00 BDT</g:price>");
  });

  it("recommends in-stock gifts by age and budget", async () => {
    const { data } = await call("/api/recommend?age=1-3y&budget=1500");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((p: any) => p.age_ranges.includes("1-3y") && (p.sale_price ?? p.price) <= 1500 && p.in_stock)).toBe(true);
  });

  it("carries a click-to-WhatsApp ad reference", async () => {
    const res = await call("/wa?ref=AD42&product=diaper-pants", { raw: true, redirect: "manual" });
    expect(res.res.status).toBe(302);
    expect(decodeURIComponent(res.res.headers.get("location")!)).toContain("[ref:AD42]");
  });
});
