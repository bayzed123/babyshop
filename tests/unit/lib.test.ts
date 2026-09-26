import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hashPassword, totpAt, verifyPassword, verifyTotp } from "../../worker/src/lib/crypto";
import { parseCsv, toCsv } from "../../worker/src/lib/csv";
import { PdfDoc, pdfSafe } from "../../worker/src/lib/pdf";
import { normalizeBdPhone } from "../../worker/src/lib/http";
import { certificationSchema, productSchema } from "../../worker/src/lib/schemas";
import { buildUserData, capiPhone } from "../../worker/src/lib/marketing";

describe("two-factor codes (RFC 6238)", () => {
  const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
  it("round-trips base32", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(new TextDecoder().decode(base32Decode(secret))).toBe("12345678901234567890");
  });
  it("matches the RFC test vector and accepts ±1 step", async () => {
    expect(await totpAt(secret, 1)).toBe("287082");
    expect(await verifyTotp(secret, "287082", 59_000)).toBe(true);
    expect(await verifyTotp(secret, "287082", 89_000)).toBe(true);
    expect(await verifyTotp(secret, "000000", 59_000)).toBe(false);
  });
});

describe("passwords", () => {
  it("hashes with PBKDF2 and verifies", async () => {
    const h = await hashPassword("Correct-Horse-9");
    expect(h.startsWith("pbkdf2$100000$")).toBe(true);
    expect(await verifyPassword("Correct-Horse-9", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});

describe("CSV", () => {
  it("round-trips quotes, commas, newlines and Bangla", () => {
    const csv = toCsv([{ a: 'He said "hi"', b: "x,y", c: "লাইন\nদুই" }]);
    expect(parseCsv(csv)).toEqual([{ a: 'He said "hi"', b: "x,y", c: "লাইন\nদুই" }]);
  });
  it("neutralises spreadsheet formulas", () => {
    expect(toCsv([{ a: "=HYPERLINK(1)" }])).toContain("'=HYPERLINK");
  });
});

describe("PDF invoice writer", () => {
  it("produces a valid-looking PDF with an xref table", () => {
    const d = new PdfDoc();
    d.text(40, 40, "Invoice ৳1,200 — test");
    const bytes = d.toBytes();
    const s = new TextDecoder().decode(bytes);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("xref");
    expect(s.trim().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("(Invoice Tk 1,200 - test)");
    const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
  });
  it("keeps text ASCII-safe", () => {
    expect(pdfSafe("মা ৳500")).toBe(" Tk 500");
  });
});

describe("validation", () => {
  it("normalises Bangladeshi mobile numbers", () => {
    expect(normalizeBdPhone("+880 1711-223344")).toBe("01711223344");
    expect(normalizeBdPhone("01211223344")).toBeNull();
  });
  it("blocks a certification badge without its document", () => {
    expect(certificationSchema.safeParse({ type: "bpa_free", document_url: "" }).success).toBe(false);
    expect(certificationSchema.safeParse({ type: "bpa_free" }).success).toBe(false);
    expect(certificationSchema.safeParse({ type: "bpa_free", document_url: "/media/certificates/x.pdf" }).success).toBe(true);
  });
  it("requires a reorder cycle for consumables", () => {
    const base = { slug: "x", name_en: "X", name_bn: "X", category_id: 1, price: 100, variants: [{ stock: 1 }] };
    expect(productSchema.safeParse({ ...base, is_consumable: 1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, is_consumable: 1, reorder_days: 10 }).success).toBe(true);
  });
});

describe("Conversions API hashing", () => {
  it("hashes phone numbers in E.164 form", async () => {
    expect(capiPhone("01711223344")).toBe("8801711223344");
    const u = await buildUserData({ phone: "01711223344", email: " A@B.com " });
    expect((u.ph as string[])[0]).toMatch(/^[a-f0-9]{64}$/);
    expect((u.em as string[])[0]).toBe("fb98d44ad7501a959f3f4f4a3f004fe2d9e581ea6207e218c4b02c08a4d75adf");
  });
});
