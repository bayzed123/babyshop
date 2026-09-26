/**
 * Scheduled jobs (Cron Triggers in wrangler.toml).
 *  Every 10 minutes: abandoned-checkout recovery messages, retention purge, reorder reminders, review requests.
 *  Nightly (21:00 UTC): a JSON copy of every table to R2 (backups/YYYY-MM-DD.json), keeping 30 days.
 */
import type { Env } from "./env";
import { SQL_NOW } from "./lib/http";
import { getSetting, publicUrl } from "./lib/store";
import { sendTemplate } from "./lib/notify";
import { sendRecovery } from "./routes/admin/ops";
import { BRAND } from "./brand";

export async function runFrequentJobs(env: Env): Promise<Record<string, number>> {
  const base = publicUrl(env) || `https://${BRAND.domain}`;
  const [ab, automation] = await Promise.all([getSetting(env, "abandoned"), getSetting(env, "automation")]);
  const out = { recovery: 0, purged: 0, reminders: 0, reviews: 0 };

  // 1. Automatic abandoned-checkout recovery (opt-in in Settings).
  if (ab.autoRecovery) {
    const cutoff = new Date(Date.now() - Math.max(ab.recoveryDelayMin, ab.minutes) * 60_000).toISOString();
    const since = new Date(Date.now() - 3 * 86400_000).toISOString();
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.session_id, a.name, a.phone, a.lang FROM abandoned_checkouts a
        WHERE a.status = 'open' AND a.phone IS NOT NULL AND a.recovery_sent_at IS NULL AND a.updated_at < ? AND a.updated_at > ?
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_phone = a.phone AND o.created_at > a.created_at)
        LIMIT 25`,
    )
      .bind(cutoff, since)
      .all<{ id: number; session_id: string; name: string | null; phone: string; lang: string }>();
    for (const r of results) if (await sendRecovery(env, r, base)) out.recovery++;
  }

  // 2. Retention: abandoned sessions are deleted after the retention period (personal data minimisation).
  const purgeBefore = new Date(Date.now() - ab.retentionDays * 86400_000).toISOString();
  const purged = await env.DB.prepare("DELETE FROM abandoned_checkouts WHERE updated_at < ?").bind(purgeBefore).run();
  out.purged = purged.meta.changes ?? 0;

  // 3. Reorder reminders for consumables (customers opted in at checkout).
  if (automation.reorderReminders) {
    const { results } = await env.DB.prepare(
      `SELECT r.id, r.phone, r.lang, r.name_en, r.name_bn, r.order_id, p.slug, c.name
         FROM reorder_reminders r JOIN products p ON p.id = r.product_id LEFT JOIN customers c ON c.phone = r.phone
        WHERE r.status = 'scheduled' AND r.due_at <= ? AND COALESCE(c.reminder_opt_in, 1) = 1 AND p.deleted_at IS NULL LIMIT 50`,
    )
      .bind(new Date().toISOString())
      .all<{ id: number; phone: string; lang: string; name_en: string; name_bn: string; order_id: number; slug: string; name: string | null }>();
    for (const r of results) {
      await sendTemplate(env, r.phone, "reorder", r.lang, { name: (r.name ?? "").split(" ")[0], product: r.lang === "en" ? r.name_en : r.name_bn, link: `${base}/product/${r.slug}?utm_source=reminder&utm_medium=sms&utm_campaign=reorder` }, r.order_id);
      await env.DB.prepare(`UPDATE reorder_reminders SET status = 'sent', sent_at = ${SQL_NOW} WHERE id = ?`).bind(r.id).run();
      out.reminders++;
    }
  }

  // 4. Post-delivery review requests.
  if (automation.reviewRequests) {
    const before = new Date(Date.now() - automation.reviewRequestDays * 86400_000).toISOString();
    const after = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { results } = await env.DB.prepare(
      "SELECT id, order_no, public_token, customer_name, customer_phone, lang FROM orders WHERE status = 'delivered' AND review_requested_at IS NULL AND delivered_at <= ? AND delivered_at >= ? AND deleted_at IS NULL LIMIT 50",
    )
      .bind(before, after)
      .all<{ id: number; order_no: string; public_token: string; customer_name: string; customer_phone: string; lang: string }>();
    for (const o of results) {
      await env.DB.prepare(`UPDATE orders SET review_requested_at = ${SQL_NOW} WHERE id = ?`).bind(o.id).run();
      await sendTemplate(env, o.customer_phone, "review_request", o.lang, { name: o.customer_name.split(" ")[0], order_no: o.order_no, link: `${base}/order/${o.order_no}?token=${o.public_token}#review` }, o.id);
      out.reviews++;
    }
  }
  return out;
}

const BACKUP_TABLES = [
  "settings", "counters", "admins", "categories", "products", "product_variants", "certifications", "banners", "customers", "addresses", "wishlist",
  "delivery_zones", "coupons", "referral_codes", "landing_pages", "registries", "registry_items", "orders", "order_items", "order_status_history",
  "order_confirmation_attempts", "return_requests", "abandoned_checkouts", "reviews", "inventory_log", "stock_notify_requests", "reorder_reminders",
  "newsletter_subscribers", "wa_leads", "audit_log",
];

/** Nightly logical backup to R2 (D1 Time Travel also keeps 30 days of point-in-time history). */
export async function runBackup(env: Env): Promise<string | null> {
  if (!env.MEDIA) return null;
  const dump: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 5000) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${t} LIMIT 5000 OFFSET ?`).bind(offset).all();
      rows.push(...results);
      if (results.length < 5000) break;
    }
    dump[t] = rows;
  }
  const day = new Date().toISOString().slice(0, 10);
  const key = `backups/${day}.json`;
  await env.MEDIA.put(key, JSON.stringify({ createdAt: new Date().toISOString(), tables: dump }), { httpMetadata: { contentType: "application/json" } });
  await env.KV.put("backup:last", new Date().toISOString());
  // Keep the newest 30 copies.
  const list = await env.MEDIA.list({ prefix: "backups/" });
  const old = list.objects.map((o) => o.key).sort().slice(0, -30);
  if (old.length) await env.MEDIA.delete(old);
  return key;
}
