/**
 * Every owner-editable setting with its default. Settings live in the D1 `settings` table (JSON values),
 * cached in KV for 60 seconds, and are edited in Admin → System Settings.
 *
 * ADJUSTABLE defaults (confirm with the owner): delivery fees live in delivery_zones; the fraud thresholds,
 * abandoned-checkout window, VAT rate and referral amounts below are sensible starting points only.
 */
import { BRAND } from "../brand";

export type Bi = { en: string; bn: string };

export const DEFAULT_STORE = {
  name_en: BRAND.name.en,
  name_bn: BRAND.name.bn,
  phone: BRAND.contact.phone,
  whatsapp: BRAND.contact.whatsapp,
  email: BRAND.contact.email,
  address_en: BRAND.location.address.en,
  address_bn: BRAND.location.address.bn,
  city_en: BRAND.location.city.en,
  city_bn: BRAND.location.city.bn,
  hours_en: BRAND.contact.hours.en,
  hours_bn: BRAND.contact.hours.bn,
  facebook_url: BRAND.social.facebook,
  instagram_url: BRAND.social.instagram,
  tiktok_url: BRAND.social.tiktok,
  logo_url: "",
  announcement_en: "Free delivery inside Dhaka on orders over ৳2,000 · Cash on Delivery everywhere",
  announcement_bn: "ঢাকার ভেতরে ৳২,০০০+ অর্ডারে ফ্রি ডেলিভারি · সারা দেশে ক্যাশ অন ডেলিভারি",
};
export type StoreSettings = typeof DEFAULT_STORE;

export interface PaymentSettings {
  cod: { enabled: boolean };
  bkash: { enabled: boolean; mode: "manual" | "api"; manualNumber: string; accountType: string };
  nagad: { enabled: boolean; mode: "manual" | "api"; manualNumber: string; accountType: string };
  rocket: { enabled: boolean; mode: "manual"; manualNumber: string; accountType: string };
  card: { enabled: boolean; provider: "sslcommerz" };
}
export const DEFAULT_PAYMENTS: PaymentSettings = {
  cod: { enabled: true },
  bkash: { enabled: false, mode: "manual", manualNumber: "", accountType: "Personal" },
  nagad: { enabled: false, mode: "manual", manualNumber: "", accountType: "Personal" },
  rocket: { enabled: false, mode: "manual", manualNumber: "", accountType: "Personal" },
  card: { enabled: false, provider: "sslcommerz" },
};

export const DEFAULT_NOTIFICATIONS = { sms: true, whatsapp: false, email: true, push: true, ownerPhone: "" };
export type NotificationSettings = typeof DEFAULT_NOTIFICATIONS;

/** Customer message templates. Placeholders: {name} {order_no} {invoice_no} {total} {courier} {tracking} {store} {link} {code} {product} {coupon}. */
export const DEFAULT_TEMPLATES: Record<string, Bi> = {
  placed: { en: "Hi {name}, we got your order {order_no} (Tk {total}). We'll confirm it shortly. — {store}", bn: "{name}, আপনার অর্ডার {order_no} (৳{total}) পেয়েছি। শীঘ্রই কনফার্ম করা হবে। — {store}" },
  confirmed: { en: "Order {order_no} is confirmed (invoice {invoice_no}). We're packing it with care! — {store}", bn: "অর্ডার {order_no} কনফার্ম হয়েছে (ইনভয়েস {invoice_no})। যত্ন করে প্যাক করছি! — {store}" },
  packed: { en: "Order {order_no} is packed and will be handed to the courier soon. — {store}", bn: "অর্ডার {order_no} প্যাক করা হয়েছে, শীঘ্রই কুরিয়ারে যাবে। — {store}" },
  shipped: { en: "Order {order_no} is on its way with {courier}. Tracking: {tracking}. — {store}", bn: "অর্ডার {order_no} {courier} এ পাঠানো হয়েছে। ট্র্যাকিং: {tracking}। — {store}" },
  out_for_delivery: { en: "Order {order_no} is out for delivery today. Please keep Tk {total} ready if paying cash. — {store}", bn: "অর্ডার {order_no} আজ ডেলিভারি হবে। ক্যাশে দিলে ৳{total} প্রস্তুত রাখুন। — {store}" },
  delivered: { en: "Order {order_no} was delivered. Thank you for shopping with {store}!", bn: "অর্ডার {order_no} ডেলিভারি হয়েছে। {store} থেকে কেনার জন্য ধন্যবাদ!" },
  cancelled: { en: "Order {order_no} has been cancelled. Questions? Call us. — {store}", bn: "অর্ডার {order_no} বাতিল করা হয়েছে। প্রশ্ন থাকলে কল করুন। — {store}" },
  refused: { en: "Our courier could not deliver order {order_no}. Please call us if this was a mistake. — {store}", bn: "অর্ডার {order_no} ডেলিভারি নেওয়া হয়নি। ভুল হলে আমাদের কল করুন। — {store}" },
  returned: { en: "We received the return for order {order_no}. Your refund is being processed. — {store}", bn: "অর্ডার {order_no} এর রিটার্ন পেয়েছি। রিফান্ড প্রক্রিয়াধীন। — {store}" },
  otp: { en: "{code} is your {store} verification code. It expires in 10 minutes.", bn: "{store} যাচাই কোড: {code}। ১০ মিনিটের মধ্যে ব্যবহার করুন।" },
  abandoned: { en: "Hi {name}, your cart at {store} is still waiting. Finish your order here: {link} {coupon}", bn: "{name}, {store} এ আপনার কার্ট অপেক্ষা করছে। এখানে অর্ডার শেষ করুন: {link} {coupon}" },
  review_request: { en: "Hi {name}, how is your order {order_no}? A quick review helps other parents: {link} — {store}", bn: "{name}, অর্ডার {order_no} কেমন লাগলো? একটি রিভিউ অন্য বাবা-মায়েদের সাহায্য করবে: {link} — {store}" },
  reorder: { en: "Hi {name}, running low on {product}? Reorder in one tap: {link} — {store}", bn: "{name}, {product} কি শেষ হয়ে আসছে? এক ক্লিকে আবার অর্ডার করুন: {link} — {store}" },
  back_in_stock: { en: "Good news! {product} is back in stock at {store}: {link}", bn: "সুখবর! {product} আবার স্টকে এসেছে — {store}: {link}" },
  referral_reward: { en: "Thank you for recommending {store}! Your reward code {coupon} is ready to use.", bn: "{store} কে রেফার করার জন্য ধন্যবাদ! আপনার রিওয়ার্ড কোড {coupon} ব্যবহার করুন।" },
};

/** Pre-written, editable WhatsApp messages behind the one-tap buttons on each order. */
export const DEFAULT_WA_TEMPLATES: Record<string, Bi> = {
  confirm: { en: "Assalamu alaikum {name}! This is {store}. Can you confirm your order {order_no} (Tk {total}) to {area}?", bn: "আসসালামু আলাইকুম {name}! {store} থেকে বলছি। {area} ঠিকানায় আপনার অর্ডার {order_no} (৳{total}) কনফার্ম করবেন?" },
  confirmed: DEFAULT_TEMPLATES.confirmed!,
  shipped: DEFAULT_TEMPLATES.shipped!,
  out_for_delivery: DEFAULT_TEMPLATES.out_for_delivery!,
};

export const DEFAULT_FRAUD = {
  /** Checkout asks for an SMS code before the order is placed (unverified numbers are never auto-confirmed). */
  requireOtp: true,
  /** Trusted customers with a verified number skip the manual confirmation call. */
  autoConfirmTrusted: true,
  trustedMinDelivered: 3,
  /** Velocity: flag when the same phone / address / IP places this many orders within the window. */
  velocityWindowMin: 60,
  velocityMaxPerPhone: 2,
  velocityMaxPerAddress: 3,
  velocityMaxPerIp: 4,
  /** Look the phone up with the courier fraud checker when an order is opened. */
  courierCheck: true,
};
export type FraudSettings = typeof DEFAULT_FRAUD;

export const DEFAULT_ABANDONED = {
  minutes: 30,
  retentionDays: 30,
  autoRecovery: false,
  recoveryDelayMin: 60,
  /** Optional Taka discount for the recovery link (0 = none), valid for recoveryValidHours. */
  recoveryDiscount: 0,
  recoveryValidHours: 48,
};
export type AbandonedSettings = typeof DEFAULT_ABANDONED;

export const DEFAULT_AUTOMATION = {
  reviewRequests: true,
  reviewRequestDays: 3,
  reorderReminders: true,
  reorderLeadDays: 3,
};
export type AutomationSettings = typeof DEFAULT_AUTOMATION;

export const DEFAULT_TAX = { enabled: false, rate: 5, inclusive: true, bin: "" };
export type TaxSettings = typeof DEFAULT_TAX;

export const DEFAULT_REFERRAL = { enabled: true, friendDiscount: 100, reward: 100, minOrder: 800 };
export type ReferralSettings = typeof DEFAULT_REFERRAL;

/** Non-secret tracking IDs. The Conversions API token is a Worker secret (META_CAPI_TOKEN). */
export const DEFAULT_INTEGRATIONS = {
  metaPixelId: "",
  ga4Id: "",
  googleAdsId: "",
  googleAdsLabel: "",
  clarityId: "",
  cfBeacon: "",
  whatsappConnected: false,
};
export type IntegrationSettings = typeof DEFAULT_INTEGRATIONS;

export const SETTING_DEFAULTS = {
  store: DEFAULT_STORE,
  payments: DEFAULT_PAYMENTS,
  notifications: DEFAULT_NOTIFICATIONS,
  templates: DEFAULT_TEMPLATES,
  wa_templates: DEFAULT_WA_TEMPLATES,
  fraud: DEFAULT_FRAUD,
  abandoned: DEFAULT_ABANDONED,
  automation: DEFAULT_AUTOMATION,
  tax: DEFAULT_TAX,
  referral: DEFAULT_REFERRAL,
  integrations: DEFAULT_INTEGRATIONS,
  onboarding: { dismissed: false },
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;
