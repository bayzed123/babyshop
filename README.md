# Zamil Shop BD — জামিল শপ বিডি

*Little joys, safely delivered.* A bilingual (বাংলা + English), mobile-first baby & kids shop for Bangladesh:
storefront, admin dashboard and API on **one Cloudflare Worker** (Hono + TypeScript) backed by **D1, KV and R2**,
deployed from GitHub with GitHub Actions.

| | |
|---|---|
| Storefront | `/` — shop by age (0–6 m, 6–12 m, 1–3 y, 3–5 y), gift finder, gift registry, campaign landing pages, PWA |
| Admin | `/admin/` — owner-friendly dashboard: "Needs your attention today", Health Check, one-tap call/WhatsApp |
| API | `/api/*` (storefront) and `/api/admin/*` (staff, role-checked) |
| Payments | Cash on Delivery (default), bKash, Nagad, Rocket (manual TrxID or API), cards via SSLCommerz |
| Couriers | Steadfast (primary), Pathao, RedX — tracking, status webhooks incl. *Out for delivery* |

## Highlights

- **SKU on every variant** — `BBY-[Cat]-[Age]-[Seq]`, e.g. `BBY-CLO-0-6M-0033`, generated automatically, unique at database level.
- **Invoice on every confirmed order** — `INV-BBY-YYYYMMDD-####`, sequential per day, with a PDF invoice (SKUs, quantities, discounts, delivery, optional VAT).
- **Certification integrity** — a safety badge (BPA-free, EN 71, BSTI …) can't be saved without its certificate document: enforced in the form, the API schema **and** a database `CHECK` constraint. The seed data contains no certificates, reviews or sales counts.
- **Fake-order protection** — SMS OTP at checkout, courier fraud-check lookup, 🟢 Trusted / 🟡 New / 🔴 Verify badges with a plain-language reason, trusted-customer fast lane, velocity flags (phone / address / IP), Cloudflare Turnstile. A COD order can't be confirmed without OTP or a logged "Customer confirmed" call; anything above Trusted needs a logged call before dispatch.
- **Abandoned checkouts** — autosaved on field blur, shown after 30 min with call / WhatsApp / recovery-link actions, purged after the retention period.
- **Ads & tracking** — Meta Pixel + Conversions API with a shared `event_id` (hashed phone/email), GA4 e-commerce events, Google Ads conversion, Microsoft Clarity, UTM capture → revenue by campaign, click-to-WhatsApp `ref` attribution.
- **Premium** — recovery automation, review requests, reorder reminders for consumables, back-in-stock alerts, return self-service, refer-a-friend, admin 2FA, Google Merchant / Facebook catalogue feeds, web push, optional VAT, honest urgency ("only X left" only from real stock).
- **Distinct outcomes** — *Cancelled*, *Refused at delivery* and *Returned* are separate statuses (stock goes back for all three; only the latter two affect risk).

## Quick start (local)

```bash
nvm use 22                      # Node 20+ works
npm ci
cp worker/.dev.vars.example worker/.dev.vars
npm run build                   # storefront + admin into dist/, seed SQL into dist-seed/
npm run db:migrate:local
npm run db:seed:local
node scripts/create-admin.mjs "Owner" owner super_admin 'A-Long-Password-123' > .admin.sql
npx wrangler d1 execute DB --local -c worker/wrangler.toml --file=.admin.sql && rm .admin.sql
npm run dev                     # http://localhost:8787  ·  admin: http://localhost:8787/admin/
```

In development (`ENVIRONMENT=development`) SMS codes are shown on screen as `DEV code: 123456`, so checkout and staff phone sign-in work without an SMS gateway.

## Tests

```bash
npm run typecheck               # build + tsc --noEmit
npm test                        # Vitest in the Workers runtime (unit + integration, local D1/KV/R2)
npm run test:e2e                # Playwright: storefront checkout + admin call logging, mobile and desktop
```

## Deploy

Push to `main` → GitHub Actions tests everything, finds-or-creates D1/KV/R2, migrates, seeds on first run, creates the
first Super Admin, deploys and syncs integration secrets. Only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are
required. Step-by-step: **[docs/SETUP.md](docs/SETUP.md)**.

## Documentation

| Document | What's in it |
|---|---|
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | The full A–Z specification (sections 1–20): architecture diagram, data model tables, API, flows, glossary, assumptions |
| [docs/SETUP.md](docs/SETUP.md) | Local development, Cloudflare + GitHub setup, secrets, custom domain, going live checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | NIST CSF mapping, controls, incident response, D1 backup & restore |
| [docs/BUILD-PROMPT.md](docs/BUILD-PROMPT.md) | The original build brief this project implements |

## Assumptions to confirm (ADJUSTABLE)

The brief left these open; sensible defaults were chosen and are easy to change:

- **Location:** Dhaka (placeholder address "Mirpur 10") — edit in `worker/src/brand.json` and Admin → Settings → Shop information.
- **Contact details, social links, domain (`zamilshopbd.com`)** are placeholders.
- **Delivery fees:** ৳70 inside Dhaka City (free over ৳2,000), ৳100 Dhaka suburbs, ৳120 rest of Dhaka Division, ৳130 elsewhere — Admin → Delivery zones.
- **Fraud thresholds:** Trusted after 3 delivered orders with no refusals; velocity window 60 min (2 per phone, 3 per address, 4 per IP); abandoned after 30 min, deleted after 30 days.
- **Referral:** friend gets ৳100 off a first order over ৳800; referrer gets a ৳100 coupon after delivery. **VAT** is off (5 % inclusive when switched on).
- **Starter catalogue** of 19 sample products with generated illustrations — replace with real photos and prices. Infant formula is deliberately not seeded (Bangladesh Breast-milk Substitutes Act 2013 restricts its promotion).
- **Courier fraud-check provider** is not named in the brief; any HTTP lookup returning total/delivered/returned counts works (`FRAUD_CHECK_API_URL`).
