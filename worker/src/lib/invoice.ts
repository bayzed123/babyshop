/** Invoice PDF: itemised SKUs, quantities, unit prices, discounts, delivery fee, optional VAT line and total. */
import type { OrderRow } from "./orders";
import { PdfDoc, type Rgb } from "./pdf";
import { BRAND } from "../brand";
import type { StoreSettings, TaxSettings } from "./settings";

export interface InvoiceItem {
  sku: string;
  name_en: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

const tk = (v: number) => `Tk ${v.toLocaleString("en-US")}`;
const INK: Rgb = [53, 48, 74];
const MUTED: Rgb = [110, 104, 128];
const MINT: Rgb = [42, 122, 104];

export function invoicePdf(o: OrderRow, items: InvoiceItem[], store: StoreSettings, tax: TaxSettings): Uint8Array {
  const doc = new PdfDoc();
  const L = 44, R = doc.width - 44;
  // Header band
  doc.rect(0, 0, doc.width, 96, [255, 233, 168]);
  doc.text(L, 44, store.name_en || BRAND.name.en, { size: 22, bold: true, color: INK });
  doc.text(L, 64, BRAND.tagline.en, { size: 10, color: MUTED });
  doc.text(R, 40, "INVOICE", { size: 20, bold: true, color: MINT, align: "right" });
  doc.text(R, 60, o.invoice_no ?? `Order ${o.order_no}`, { size: 11, bold: true, color: INK, align: "right" });
  doc.text(R, 76, `Date: ${(o.confirmed_at ?? o.created_at).slice(0, 10)}`, { size: 9, color: MUTED, align: "right" });

  let y = 124;
  doc.text(L, y, "FROM", { size: 8, bold: true, color: MUTED });
  doc.text(310, y, "BILL / SHIP TO", { size: 8, bold: true, color: MUTED });
  y += 14;
  const from = [store.name_en, store.address_en, `${store.city_en}, Bangladesh`, `Phone: ${store.phone}`, store.email, tax.enabled && tax.bin ? `BIN: ${tax.bin}` : ""].filter(Boolean);
  const to = [o.customer_name, `Phone: ${o.customer_phone}`, o.area, `${o.upazila}, ${o.district}`, `${o.division} Division, Bangladesh`];
  let yf = y, yt = y;
  for (const l of from) yf = doc.paragraph(L, yf, l, 240, { size: 9.5, color: INK });
  for (const l of to) yt = doc.paragraph(310, yt, l, 240, { size: 9.5, color: INK });
  y = Math.max(yf, yt) + 8;

  const meta = [
    ["Order no.", o.order_no],
    ["Payment", `${o.payment_method} (${o.payment_status})${o.payment_ref ? ` - Ref ${o.payment_ref}` : ""}`],
    ["Courier", o.courier_partner ? `${o.courier_partner}${o.tracking_id ? ` - ${o.tracking_id}` : ""}` : "-"],
  ];
  for (const [k, v] of meta) {
    doc.text(L, y, k!, { size: 9, bold: true, color: MUTED });
    doc.text(L + 70, y, v!, { size: 9, color: INK });
    y += 14;
  }
  y += 8;

  // Items table
  const cols = { sku: L + 6, item: L + 120, qty: 400, unit: 470, total: R - 6 };
  const header = () => {
    doc.rect(L, y - 12, R - L, 20, [196, 238, 220]);
    doc.text(cols.sku, y + 2, "SKU", { size: 9, bold: true, color: INK });
    doc.text(cols.item, y + 2, "Item", { size: 9, bold: true, color: INK });
    doc.text(cols.qty, y + 2, "Qty", { size: 9, bold: true, color: INK, align: "right" });
    doc.text(cols.unit, y + 2, "Unit price", { size: 9, bold: true, color: INK, align: "right" });
    doc.text(cols.total, y + 2, "Amount", { size: 9, bold: true, color: INK, align: "right" });
    y += 22;
  };
  header();
  for (const it of items) {
    if (y > doc.height - 170) {
      doc.addPage();
      y = 60;
      header();
    }
    const opt = [it.size && it.size !== "Standard" ? it.size : "", it.color ?? ""].filter(Boolean).join(", ");
    doc.text(cols.sku, y, it.sku, { size: 8.5, color: INK });
    const yEnd = doc.paragraph(cols.item, y, `${it.name_en}${opt ? ` (${opt})` : ""}`, 220, { size: 9, color: INK, lineHeight: 12 });
    doc.text(cols.qty, y, String(it.quantity), { size: 9, color: INK, align: "right" });
    doc.text(cols.unit, y, tk(it.unit_price), { size: 9, color: INK, align: "right" });
    doc.text(cols.total, y, tk(it.line_total), { size: 9, color: INK, align: "right" });
    y = Math.max(y + 14, yEnd) + 4;
    doc.line(L, y - 8, R, y - 8);
  }

  // Totals
  y += 6;
  const row = (label: string, value: string, bold = false) => {
    doc.text(cols.unit, y, label, { size: bold ? 11 : 9.5, bold, color: bold ? INK : MUTED, align: "right" });
    doc.text(cols.total, y, value, { size: bold ? 11 : 9.5, bold, color: INK, align: "right" });
    y += bold ? 18 : 15;
  };
  row("Subtotal", tk(o.subtotal));
  if (o.discount) row(`Discount${o.coupon_code ? ` (${o.coupon_code})` : o.referral_code ? ` (referral ${o.referral_code})` : ""}`, `- ${tk(o.discount)}`);
  row("Delivery fee", o.delivery_fee ? tk(o.delivery_fee) : "Free");
  if (o.vat_amount) row(tax.inclusive ? `VAT ${tax.rate}% (included)` : `VAT ${tax.rate}%`, tk(o.vat_amount));
  doc.line(360, y - 8, R, y - 8, MINT, 1.2);
  y += 2;
  row("Total", tk(o.total), true);
  if (o.refund_amount) row("Refunded", `- ${tk(o.refund_amount)}`);
  if (o.payment_method === "COD" && o.payment_status !== "paid") {
    doc.text(L, y, `Cash on Delivery: please pay ${tk(o.total)} to the courier.`, { size: 9.5, bold: true, color: MINT });
    y += 14;
  }
  if (o.gift_message) y = doc.paragraph(L, y + 6, `Gift message: "${o.gift_message}"`, R - L, { size: 9.5, color: INK });

  doc.line(L, doc.height - 64, R, doc.height - 64);
  doc.text(L, doc.height - 48, `Thank you for shopping with ${store.name_en}!  ${store.phone}  |  ${BRAND.domain}`, { size: 8.5, color: MUTED });
  doc.text(R, doc.height - 48, "Computer-generated invoice", { size: 8, color: MUTED, align: "right" });
  return doc.toBytes(`Invoice ${o.invoice_no ?? o.order_no}`);
}
