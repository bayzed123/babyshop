import { describe, expect, it } from "vitest";
import { ageRangeCode, formatInvoiceNo, formatSku, INVOICE_PATTERN, SKU_PATTERN } from "../../worker/src/lib/sku";
import { bdDateStamp } from "../../worker/src/lib/http";

describe("SKU numbering", () => {
  it("follows BBY-<Category>-<AgeRange>-<Sequence>", () => {
    expect(formatSku("CLO", "0-6m", 33)).toBe("BBY-CLO-0-6M-0033");
    expect(formatSku("toy", "1-3y", 7)).toBe("BBY-TOY-1-3Y-0007");
    expect(formatSku("DIA", null, 12345)).toBe("BBY-DIA-ALL-12345");
  });
  it("maps age ranges to codes and rejects unknown ones", () => {
    expect(ageRangeCode("6-12m")).toBe("6-12M");
    expect(ageRangeCode("3-5y")).toBe("3-5Y");
    expect(ageRangeCode("teen")).toBe("ALL");
  });
  it("matches the documented SKU pattern", () => {
    expect(SKU_PATTERN.test("BBY-CLO-0-6M-0033")).toBe(true);
    expect(SKU_PATTERN.test("BBY-CLO-0-6M-33")).toBe(false);
    expect(SKU_PATTERN.test("clo-0033")).toBe(false);
  });
});

describe("invoice numbering", () => {
  it("formats INV-BBY-YYYYMMDD-####", () => {
    expect(formatInvoiceNo("20260926", 7)).toBe("INV-BBY-20260926-0007");
    expect(INVOICE_PATTERN.test("INV-BBY-20260926-0007")).toBe(true);
  });
  it("uses the Bangladesh calendar day (UTC+6)", () => {
    expect(bdDateStamp(new Date("2026-09-26T17:59:00Z"))).toBe("20260926");
    expect(bdDateStamp(new Date("2026-09-26T18:01:00Z"))).toBe("20260927");
  });
});
