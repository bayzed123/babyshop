/**
 * SKU and invoice numbering (hard requirement).
 *
 *   SKU      BBY-<CategoryCode>-<AgeRangeCode>-<Sequence>   e.g. BBY-CLO-0-6M-0033
 *   Invoice  INV-BBY-<YYYYMMDD>-<####>                        e.g. INV-BBY-20260926-0007
 *
 * Sequences come from the `counters` table (one atomic UPDATE … RETURNING), SKUs are unique in the database
 * (uq_variants_sku) and invoice numbers are unique (uq_orders_invoice), restart at 0001 every Bangladesh day,
 * and are assigned once — when the order is confirmed.
 */
import type { Env } from "../env";
import { BRAND } from "../brand";
import { bdDateStamp } from "./http";
import { nextCounter } from "./store";

export const AGE_RANGES = ["0-6m", "6-12m", "1-3y", "3-5y"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export const AGE_LABELS: Record<AgeRange, { en: string; bn: string }> = {
  "0-6m": { en: "0–6 months", bn: "০–৬ মাস" },
  "6-12m": { en: "6–12 months", bn: "৬–১২ মাস" },
  "1-3y": { en: "1–3 years", bn: "১–৩ বছর" },
  "3-5y": { en: "3–5 years", bn: "৩–৫ বছর" },
};

export const isAgeRange = (v: unknown): v is AgeRange => typeof v === "string" && (AGE_RANGES as readonly string[]).includes(v);

/** "0-6m" → "0-6M"; no age range → "ALL". */
export function ageRangeCode(age: string | null | undefined): string {
  return isAgeRange(age) ? age.toUpperCase() : "ALL";
}

export function formatSku(categoryCode: string, age: string | null | undefined, seq: number, prefix = BRAND.skuPrefix): string {
  const cat = categoryCode.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "GEN";
  return `${prefix}-${cat}-${ageRangeCode(age)}-${String(seq).padStart(4, "0")}`;
}

export const SKU_PATTERN = /^[A-Z]{2,5}-[A-Z]{2,4}-(0-6M|6-12M|1-3Y|3-5Y|ALL)-\d{4,}$/;

/** Generates the next free SKU for a category + age range. Skips numbers already taken by hand-typed SKUs. */
export async function generateSku(env: Env, categoryCode: string, age: string | null | undefined, taken: Set<string> = new Set()): Promise<string> {
  const cat = categoryCode.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "GEN";
  for (let i = 0; i < 20; i++) {
    const sku = formatSku(cat, age, await nextCounter(env, `sku:${cat}`));
    if (taken.has(sku)) continue;
    const exists = await env.DB.prepare("SELECT 1 FROM product_variants WHERE sku = ?").bind(sku).first();
    if (!exists) return sku;
  }
  throw new Error("Could not find a free SKU number");
}

export function formatInvoiceNo(dateStamp: string, seq: number, prefix = BRAND.invoicePrefix): string {
  return `${prefix}-${dateStamp}-${String(seq).padStart(4, "0")}`;
}

export const INVOICE_PATTERN = /^INV-[A-Z]{2,5}-\d{8}-\d{4,}$/;

/** Gives a confirmed order its invoice number (idempotent — an order keeps the number it already has). */
export async function assignInvoiceNo(env: Env, orderId: number): Promise<string> {
  const existing = await env.DB.prepare("SELECT invoice_no FROM orders WHERE id = ?").bind(orderId).first<{ invoice_no: string | null }>();
  if (existing?.invoice_no) return existing.invoice_no;
  const stamp = bdDateStamp();
  const invoiceNo = formatInvoiceNo(stamp, await nextCounter(env, `inv:${stamp}`));
  const r = await env.DB.prepare("UPDATE orders SET invoice_no = ? WHERE id = ? AND invoice_no IS NULL").bind(invoiceNo, orderId).run();
  if (!r.meta.changes) {
    const again = await env.DB.prepare("SELECT invoice_no FROM orders WHERE id = ?").bind(orderId).first<{ invoice_no: string | null }>();
    return again?.invoice_no ?? invoiceNo;
  }
  return invoiceNo;
}
