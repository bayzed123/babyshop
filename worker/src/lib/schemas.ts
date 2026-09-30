/** Request validation (Zod). Every message is bilingual so the admin and storefront can show it inline. */
import { z } from "zod";
import { normalizeBdPhone } from "./http";
import { salePriceFor } from "./pricing";
import { AGE_RANGES } from "./sku";

export const bdPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizeBdPhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX) / সঠিক মোবাইল নম্বর দিন" });
      return z.NEVER;
    }
    return p;
  });

const text = (max: number) => z.string().trim().max(max);
const reqText = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const money = z.coerce.number().int().min(0).max(10_000_000);
const flag = z.union([z.boolean(), z.number()]).transform((v) => (v ? 1 : 0));
const email = z.union([z.literal(""), z.email()]).optional().nullable().transform((v) => v || null);
const isoDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: "Enter a valid date / সঠিক তারিখ দিন" });
const idList = z.array(z.coerce.number().int().positive()).default([]);
const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "Use lowercase letters, numbers and dashes only / শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও ড্যাশ" });
/** SKU: letters, digits and dashes, stored upper-case. Blank = generated automatically. */
const skuText = z
  .string()
  .trim()
  .toUpperCase()
  .max(60)
  .regex(/^[A-Z0-9-]*$/, "Use letters, numbers and dashes only / শুধু অক্ষর, সংখ্যা ও ড্যাশ ব্যবহার করুন")
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
const ageRange = z.enum(AGE_RANGES);

export const address = z.object({
  division_id: z.coerce.number().int().positive(),
  district_id: z.coerce.number().int().positive(),
  upazila_id: z.coerce.number().int().positive(),
  division: reqText(60),
  district: reqText(60),
  upazila: reqText(80),
  area: z.string().trim().min(5, "Add house, road and area so the courier can find you / বাড়ি, রোড ও এলাকা লিখুন").max(300),
});

const utm = z
  .object({ source: text(100).optional(), medium: text(100).optional(), campaign: text(150).optional() })
  .optional()
  .default({});

const cartItems = z
  .array(z.object({ variantId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(20) }))
  .min(1)
  .max(50);

// ---------------------------------------------------------------- storefront
export const checkoutSchema = z.object({
  customer: z.object({ name: reqText(80), phone: bdPhone, email }),
  /** Optional only for gift-registry orders shipped to the parents' saved address. */
  address: address.optional(),
  items: cartItems,
  couponCode: text(40).optional(),
  paymentMethod: z.enum(["COD", "bKash", "Nagad", "Rocket", "Card"]),
  paymentRef: text(60).optional(), // TrxID for manual MFS payments
  note: text(500).optional(),
  giftMessage: text(300).optional(),
  registrySlug: text(60).optional(),
  reminderOptIn: z.boolean().default(false),
  lang: z.enum(["bn", "en"]).default("bn"),
  turnstileToken: z.string().optional(),
  otpToken: z.string().max(100).optional(),
  sessionId: z.string().trim().max(64).optional(),
  utm,
  adRef: text(120).optional(),
  fbp: text(200).optional(),
  fbc: text(300).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const quoteSchema = z.object({
  items: cartItems,
  address: z.object({ division_id: z.coerce.number().int().positive(), district_id: z.coerce.number().int().positive(), upazila_id: z.coerce.number().int().positive() }).optional(),
  couponCode: text(40).optional(),
  phone: z.string().optional(),
  registrySlug: text(60).optional(),
});

/** Abandoned-checkout autosave (sent on field blur, debounced). Everything is optional — it's a draft. */
export const draftSchema = z.object({
  sessionId: z.string().trim().min(16).max(64),
  name: text(80).optional(),
  phone: z.string().trim().max(20).optional(),
  email: text(120).optional(),
  division: text(60).optional(),
  district: text(60).optional(),
  upazila: text(80).optional(),
  area: text(300).optional(),
  items: z.array(z.object({ variantId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(20) })).max(50).default([]),
  lastStep: z.enum(["cart", "contact", "address", "payment"]).default("contact"),
  utm,
  lang: z.enum(["bn", "en"]).default("bn"),
  fbp: text(200).optional(),
  fbc: text(300).optional(),
});

export const otpSendSchema = z.object({ phone: bdPhone, turnstileToken: z.string().optional(), lang: z.enum(["bn", "en"]).default("bn") });
export const otpVerifySchema = z.object({ phone: bdPhone, code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code / ৬ সংখ্যার কোড দিন") });

export const reviewSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: reqText(60),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(5).max(1000),
  orderNo: text(40).optional(),
  token: text(80).optional(),
});

export const registerSchema = z.object({
  name: reqText(80),
  phone: bdPhone,
  email,
  password: z.string().min(8).max(128),
  turnstileToken: z.string().optional(),
});

export const loginSchema = z.object({
  phone: bdPhone,
  password: z.string().min(1).max(128),
  turnstileToken: z.string().optional(),
});

export const savedAddressSchema = address.extend({
  label: text(30).default("Home"),
  recipient_name: reqText(80),
  phone: bdPhone,
  is_default: flag.default(0),
});

export const registrySchema = z.object({
  title: reqText(120),
  event_type: z.enum(["baby_shower", "birthday", "aqiqah", "welcome_baby", "other"]).default("baby_shower"),
  event_date: isoDate,
  baby_name: optText(80),
  message: optText(600),
  ship_to_parent: flag.default(1),
  address_id: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["active", "closed"]).default("active"),
});

export const registryItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  note: optText(200),
});

export const returnRequestSchema = z.object({
  orderNo: reqText(40),
  reason: z.enum(["wrong_size", "damaged", "wrong_item", "not_as_described", "changed_mind", "other"]),
  details: optText(1000),
});

export const stockNotifySchema = z
  .object({
    productId: z.coerce.number().int().positive(),
    variantId: z.coerce.number().int().positive().optional().nullable(),
    phone: z.string().trim().optional(),
    email: z.union([z.literal(""), z.email()]).optional(),
    lang: z.enum(["bn", "en"]).default("bn"),
  })
  .transform((v, ctx) => {
    const phone = v.phone ? normalizeBdPhone(v.phone) : null;
    if (v.phone && !phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid mobile number / সঠিক মোবাইল নম্বর দিন" });
    if (!phone && !v.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a mobile number or email / মোবাইল নম্বর বা ইমেইল দিন" });
    return { ...v, phone, email: v.email || null };
  });

export const newsletterSchema = z.object({ contact: reqText(120), lang: z.enum(["bn", "en"]).default("bn") }).transform((v, ctx) => {
  const phone = normalizeBdPhone(v.contact);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact);
  if (!phone && !isEmail) ctx.addIssue({ code: "custom", path: ["contact"], message: "Enter an email or mobile number / ইমেইল বা মোবাইল নম্বর দিন" });
  return { contact: phone ?? v.contact.toLowerCase(), lang: v.lang };
});

export const eventSchema = z.object({
  name: z.enum(["PageView", "ViewContent", "AddToCart", "InitiateCheckout"]),
  eventId: z.string().trim().min(8).max(80),
  url: z.string().max(500).optional(),
  value: z.coerce.number().min(0).max(10_000_000).optional(),
  contentIds: z.array(z.string().max(60)).max(50).optional(),
  numItems: z.coerce.number().int().min(0).max(1000).optional(),
  fbp: text(200).optional(),
  fbc: text(300).optional(),
});

// ---------------------------------------------------------------- admin
export const adminLoginId = z.string().trim().toLowerCase().min(3).max(120).regex(/^[a-z0-9._@+-]+$/, "Use letters, numbers, dot, dash or underscore");

export const adminLoginSchema = z.object({
  email: adminLoginId,
  password: z.string().min(1).max(128),
  totp: z.string().trim().optional(),
  turnstileToken: z.string().optional(),
});

export const variantSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  sku: skuText,
  size: text(40).default("Standard").transform((v) => v || "Standard"),
  color: text(40).default(""),
  age_range: ageRange.optional().nullable().or(z.literal("").transform(() => null)),
  stock: z.coerce.number().int().min(0).max(100000),
  price_override: money.optional().nullable(),
  low_stock_threshold: z.coerce.number().int().min(0).max(1000).default(3),
});

export const CERT_TYPES = ["bpa_free", "safety_tested", "age_appropriate", "non_toxic", "organic_cotton", "dermatologically_tested", "bsti", "ce", "en71", "astm_f963", "oeko_tex"] as const;

/**
 * A certification badge can't be saved without its supporting document (hard requirement). The same rule
 * is enforced again by a CHECK constraint on certifications.document_url.
 */
export const certificationSchema = z.object({
  type: z.enum(CERT_TYPES),
  issuer: optText(120),
  certificate_no: optText(80),
  document_url: z
    .string({ error: "Attach the certificate document before enabling this badge / ব্যাজ চালু করার আগে সার্টিফিকেট ডকুমেন্ট যুক্ত করুন" })
    .trim()
    .min(1, "Attach the certificate document before enabling this badge / ব্যাজ চালু করার আগে সার্টিফিকেট ডকুমেন্ট যুক্ত করুন")
    .max(500),
  document_name: optText(200),
  valid_until: isoDate,
  is_active: flag.default(1),
});

export const productSchema = z
  .object({
    slug,
    name_en: reqText(160),
    name_bn: reqText(160),
    description_en: optText(5000),
    description_bn: optText(5000),
    category_id: z.coerce.number().int().positive(),
    brand: optText(80),
    price: money.refine((v) => v > 0, { message: "Price must be more than 0 / দাম ০ এর বেশি হতে হবে" }),
    sale_price: money.optional().nullable(),
    discount_type: z.enum(["none", "percent", "flat"]).default("none"),
    discount_value: money.default(0),
    age_ranges: z.array(ageRange).default([]),
    material_en: optText(300),
    material_bn: optText(300),
    care_en: optText(600),
    care_bn: optText(600),
    size_chart: z.enum(["clothing", "shoes"]).optional().nullable().or(z.literal("").transform(() => null)),
    is_consumable: flag.default(0),
    reorder_days: z.coerce.number().int().min(3).max(180).optional().nullable(),
    is_gift: flag.default(0),
    tags: text(300).default(""),
    images: z.array(z.string().trim().max(500)).max(12).default([]),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    is_featured: flag.default(0),
    meta_title: optText(160),
    meta_description: optText(320),
    variants: z.array(variantSchema).min(1).max(200),
    certifications: z.array(certificationSchema).max(11).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.discount_type === "percent" && (p.discount_value < 1 || p.discount_value > 90)) {
      ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Discount must be 1–90% / ছাড় ১–৯০% হতে হবে" });
    }
    if (p.discount_type === "flat" && (p.discount_value < 1 || p.discount_value >= p.price)) {
      ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Discount must be less than the price / ছাড় দামের চেয়ে কম হতে হবে" });
    }
    if (p.discount_type === "none" && p.sale_price != null && p.sale_price > 0 && p.sale_price >= p.price) {
      ctx.addIssue({ code: "custom", path: ["sale_price"], message: "Sale price must be lower than the regular price / ছাড়ের দাম আসল দামের চেয়ে কম হতে হবে" });
    }
    if (p.is_consumable && !p.reorder_days) {
      ctx.addIssue({ code: "custom", path: ["reorder_days"], message: "Enter how many days one pack usually lasts / একটি প্যাক সাধারণত কত দিন চলে লিখুন" });
    }
    const seen = new Set<string>();
    p.variants.forEach((v, i) => {
      const k = `${v.size}|${v.color}|${v.age_range ?? ""}`.toLowerCase();
      if (seen.has(k)) ctx.addIssue({ code: "custom", path: ["variants", i, "size"], message: "Duplicate option / একই অপশন দুবার দেওয়া হয়েছে" });
      seen.add(k);
    });
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      if (!v.sku) return;
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Each option needs its own SKU / প্রতিটি অপশনের আলাদা SKU দরকার" });
      skus.add(v.sku);
    });
    const types = new Set<string>();
    p.certifications.forEach((c, i) => {
      if (types.has(c.type)) ctx.addIssue({ code: "custom", path: ["certifications", i, "type"], message: "This badge is listed twice / এই ব্যাজ দুবার দেওয়া হয়েছে" });
      types.add(c.type);
    });
  })
  .transform((p) => ({
    ...p,
    sale_price: salePriceFor(p.price, p.discount_type, p.discount_value, p.sale_price || null),
    discount_value: p.discount_type === "none" ? 0 : p.discount_value,
    reorder_days: p.is_consumable ? p.reorder_days ?? null : null,
  }));
export type ProductInput = z.infer<typeof productSchema>;

/** Optional pastel tile colour; the form's blank "—" choice arrives as "" and means "no colour". */
const tileColor = z
  .enum(["yellow", "mint", "lavender", "peach", "sky", "pink"])
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const categorySchema = z.object({
  slug,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, "2–4 capital letters used in SKUs, e.g. CLO / SKU-তে ব্যবহৃত ২–৪টি বড় হাতের অক্ষর, যেমন CLO"),
  parent_id: z.coerce.number().int().positive().optional().nullable(),
  name_en: reqText(80),
  name_bn: reqText(80),
  description_en: optText(1000),
  description_bn: optText(1000),
  image_url: optText(500),
  color: tileColor,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: flag.default(1),
});

export const customerSchema = z.object({
  name: reqText(80),
  phone: bdPhone,
  email,
  is_blocked: flag.default(0),
  notes: optText(2000),
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, { message: "Letters, numbers, - and _ only / শুধু অক্ষর, সংখ্যা, - ও _" })
      .transform((v) => v.toUpperCase()),
    description: optText(200),
    type: z.enum(["percent", "flat"]),
    value: z.coerce.number().int().min(1).max(1_000_000),
    min_order: money.default(0),
    max_discount: money.optional().nullable(),
    starts_at: isoDate,
    expires_at: isoDate,
    usage_limit: z.coerce.number().int().min(1).optional().nullable(),
    per_customer_limit: z.coerce.number().int().min(1).optional().nullable(),
    category_ids: idList,
    is_active: flag.default(1),
  })
  .superRefine((c, ctx) => {
    if (c.type === "percent" && c.value > 90) ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage cannot exceed 90% / শতাংশ ৯০% এর বেশি হতে পারবে না" });
    if (c.starts_at && c.expires_at && Date.parse(c.expires_at) <= Date.parse(c.starts_at))
      ctx.addIssue({ code: "custom", path: ["expires_at"], message: "Expiry must be after the start date / মেয়াদ শেষের তারিখ শুরুর পরে হতে হবে" });
  });

export const bannerSchema = z.object({
  placement: z.enum(["hero", "promo"]),
  title_en: reqText(120),
  title_bn: reqText(120),
  subtitle_en: optText(240),
  subtitle_bn: optText(240),
  cta_en: optText(40),
  cta_bn: optText(40),
  link_url: optText(500),
  image_url: optText(500),
  color: tileColor,
  starts_at: isoDate,
  ends_at: isoDate,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: flag.default(1),
});

export const landingSchema = z.object({
  slug,
  title_en: reqText(120),
  title_bn: reqText(120),
  subtitle_en: optText(300),
  subtitle_bn: optText(300),
  offer_en: optText(200),
  offer_bn: optText(200),
  image_url: optText(500),
  product_id: z.coerce.number().int().positive().optional().nullable(),
  coupon_code: optText(30),
  cta_en: optText(40),
  cta_bn: optText(40),
  color: tileColor,
  is_active: flag.default(1),
});

export const reviewModerationSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  reply: optText(1000),
  name: reqText(60).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  body: z.string().trim().min(1).max(1000).optional(),
  product_id: z.coerce.number().int().positive().optional(),
});

export const zoneSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/, { message: "lowercase_with_underscores" }),
  name_en: reqText(80),
  name_bn: reqText(80),
  fee: money,
  free_shipping_min: money.optional().nullable(),
  division_ids: idList,
  district_ids: idList,
  upazila_ids: idList,
  eta_en: optText(60),
  eta_bn: optText(60),
  is_default: flag.default(0),
  is_active: flag.default(1),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export const staffSchema = z.object({
  name: reqText(80),
  email: adminLoginId,
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (!v) return null;
      const p = normalizeBdPhone(v);
      if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid mobile number / সঠিক মোবাইল নম্বর দিন" });
      return p;
    }),
  role: z.enum(["super_admin", "manager", "order_processor", "viewer"]),
  is_active: flag.default(1),
  password: z.string().min(10).max(128).optional(),
});

export const ORDER_STATUSES = ["pending", "confirmation_attempted", "confirmed", "packed", "shipped", "delivered", "cancelled", "refused", "returned"] as const;

export const statusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: text(500).optional(),
  courier: z.enum(["Steadfast", "Pathao", "RedX"]).optional(),
  trackingId: text(80).optional(),
  createConsignment: z.boolean().optional(),
  notify: z.boolean().default(true),
});

export const attemptSchema = z.object({
  outcome: z.enum(["no_answer", "confirmed", "declined"]),
  method: z.enum(["call", "whatsapp", "sms"]).default("call"),
  note: text(500).optional(),
});

export const orderEditSchema = z.object({
  customer_name: reqText(80).optional(),
  customer_phone: bdPhone.optional(),
  customer_email: email,
  area: reqText(300).optional(),
  admin_notes: optText(2000),
  payment_status: z.enum(["pending", "paid", "failed", "refunded", "partially_refunded"]).optional(),
  payment_ref: optText(60),
  courier_partner: z.enum(["Steadfast", "Pathao", "RedX"]).optional().nullable(),
  tracking_id: optText(80),
  courier_status: optText(60),
});

export const refundSchema = z.object({
  amount: z.coerce.number().int().min(1),
  note: reqText(500),
});

export const stockAdjustSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  mode: z.enum(["set", "add", "remove"]),
  quantity: z.coerce.number().int().min(0).max(100000),
  reason: z.enum(["restock", "adjustment", "return"]).default("adjustment"),
  note: text(300).optional(),
});

export const returnUpdateSchema = z.object({
  status: z.enum(["approved", "rejected", "received", "refunded"]),
  refund_amount: z.coerce.number().int().min(0).optional(),
  refund_method: optText(60),
  admin_note: optText(1000),
});

export const abandonedUpdateSchema = z.object({
  action: z.enum(["contacted", "recovered", "ignored", "reopen", "send_recovery"]),
  note: text(300).optional(),
});
