# White-label setup guide

This guide rebrands the shop for another business (a new name, logo, colours, domain, products and payment
accounts), or sets up a second copy for a new client. It lists **every file and line to change**, **every secret**
and **where to get each one (direct links)**.

> **Line numbers** below are correct for this version of the code. If files have changed since, print the current
> ones with:
>
> ```bash
> node scripts/whitelabel.mjs                     # every brand setting: file:line (from–to) and current value
> ```

---

## 0. The three layers — change the easiest one first

| Layer | What you change | Needs code / redeploy? |
|---|---|---|
| **A. Admin panel** | shop name, logo, phone, address, social links, announcement bar, banners, popup, categories, products, delivery zones and fees, coupons, payment on/off, message templates, Pixel / GA4 / Clarity IDs | ❌ No: saved instantly |
| **B. Brand files** | default name, domain, order/SKU/invoice prefixes, colours, fonts, icons, starter catalogue | ✅ Yes: edit files, push to `main` (auto-deploys) |
| **C. Accounts & secrets** | Cloudflare account, Worker name, custom domain, bKash / SSLCommerz / courier / SMS / WhatsApp / email keys | ✅ GitHub secrets/variables, then re-run **Deploy** |

**Same business, just a new look?** Layer A is usually enough.
**A new client?** Do all three in a **separate copy of the repository** (section 6).

---

## 1. Checklist (in order)

1. ☐ Copy the repository for the new client (section 6), or work on this one.
2. ☐ Edit `worker/src/brand.json` (section 3). This is the most important file.
3. ☐ Rename the Cloudflare resources in `worker/wrangler.toml`, or set the `WORKER_NAME` variable instead (section 4).
4. ☐ Replace the logo, icons and social-share image (section 5).
5. ☐ Replace the starter catalogue in `scripts/seed-data.mjs`. This only matters for a **new, empty** database (section 4.4).
6. ☐ Add the GitHub secrets and variables (section 7).
7. ☐ Push to `main`. CI runs, then **Deploy**.
8. ☐ In the admin panel, finish Layer A (section 2).
9. ☐ Check for leftovers: `node scripts/whitelabel.mjs --find "Zamil" --find "জামিল" --find "zamil"`
10. ☐ Run **Actions → Doctor → Run workflow**. Everything should be ✅ (section 9).

---

## 2. Layer A — admin panel (no code)

Admin: `https://<your-shop>/admin/` (sign in as Super Admin).

| What | Where in the admin |
|---|---|
| Shop name (English/Bangla), phone, WhatsApp, email, address, city, opening hours, Facebook/Instagram/TikTok links, top announcement bar | **Settings → Store information** |
| Logo | **Banners & logo → Shop logo → Upload new logo** (square PNG/JPG/WebP, at least 512×512) |
| Hero slider, offer banner, marketing cards, popup | **Banners & logo → Add new** |
| Categories (on/off, new, order) | **Categories** |
| Products, prices, photos, stock, free delivery | **Products** |
| Delivery areas and charges | **Delivery zones** |
| Coupons (amount, percent, free delivery) | **Coupons & discounts** |
| Cash on Delivery / bKash / Nagad / card on or off, manual bKash/Nagad numbers | **Settings → Payment methods** |
| SMS / WhatsApp / email message wording | **Settings → Customer messages**, **WhatsApp quick replies** |
| Meta Pixel ID, GA4 Measurement ID, Google Ads ID + label, Microsoft Clarity ID, Cloudflare Web Analytics token | **Settings → Ads & tracking** |
| Staff accounts | **Staff & roles** |

Values saved here **override** `brand.json`, and they survive every future deploy.

---

## 3. Layer B — `worker/src/brand.json` (one file, most branding)

Everything below is read by the Worker, the storefront HTML (filled in at build time), the invoice PDF,
the SEO data and the Doctor.

| Line | Key | What it controls | Example |
|---|---|---|---|
| 2 | `slug` | internal short name | `"rupa-fashion"` |
| 3 | `name.en` / `name.bn` | shop name in the title bar, header, invoices, emails, push notifications and admin | `{ "en": "Rupa Fashion", "bn": "রূপা ফ্যাশন" }` |
| 4 | `tagline.en` / `tagline.bn` | line under the logo and in the page title | `"Style for every day"` |
| 5–8 | `description.en` / `.bn` | Google / Facebook share description | 1–2 sentences |
| 9 | `domain` | your domain without `https://` (SEO, sitemap, links in messages) | `"rupafashion.com"` |
| 10 | `defaultLang` | first-visit language: `"bn"` or `"en"` | `"bn"` |
| 11 | `orderPrefix` | order numbers `ZSB-260930-7K2Q` | `"RPF"` |
| 12 | `skuPrefix` | product SKUs `BBY-CLO-0-6M-0001` | `"RPF"` |
| 13 | `invoicePrefix` | invoice numbers `INV-BBY-20260930-0001` | `"INV-RPF"` |
| 14–20 | `location` | city, street address, postcode, map pin (lat/lng) for Google | Dhaka / Chattogram … |
| 21–26 | `contact` | phone (`+8801…`), WhatsApp (`8801…`, no `+`), email, opening hours | |
| 27 | `social` | Facebook / Instagram / TikTok page URLs | `"https://facebook.com/rupafashion"` |
| 28–39 | `colors` | pastel tile colours, `primary` (buttons, links), `primaryDark` (hover), `ink` (text), `theme` (mobile browser bar). **Applied to both the shop and the admin** | `"primary": "#8E3B8E"` |

> ⚠️ Change the **order / SKU / invoice prefixes before the first real order**. Numbers already issued keep their old prefix.

---

## 4. Layer B — other files

### 4.1 Cloudflare names — `worker/wrangler.toml`

| Line | Now | Change to | Note |
|---|---|---|---|
| 5 | `name = "zamil-shop-bd"` | `name = "rupa-fashion"` | Worker name, which is also the `workers.dev` address |
| 19 | `PUBLIC_URL = ""` | `PUBLIC_URL = "https://rupafashion.com"` | or set the GitHub **variable** `PUBLIC_URL` instead (preferred) |
| 23 | `database_name = "zamil-shop-bd-db"` | `"rupa-fashion-db"` | must be `<worker name>-db` |
| 24 | `database_id = "0000…"` | leave as is | filled in automatically by the deploy |
| 29 | `id = "0000…"` (KV) | leave as is | filled in automatically |
| 33 | `bucket_name = "zamil-shop-bd-media"` | `"rupa-fashion-media"` | must be `<worker name>-media` |
| 49–52 | `# routes = [ … zamilshopbd.com … ]` | remove the `#` and put your domain | only after the domain is on Cloudflare (section 8) |
| 43 | `crons = ["*/10 * * * *", "0 21 * * *"]` | usually keep | background jobs + 03:00 BD backup |

> **Shortcut:** instead of editing lines 5, 23 and 33, set the GitHub **variable** `WORKER_NAME = rupa-fashion`. The deploy
> then uses `rupa-fashion`, `rupa-fashion-db`, `rupa-fashion-kv` and `rupa-fashion-media` for you.

### 4.2 CI default and package name

| File | Line | Now | Change to |
|---|---|---|---|
| `.github/workflows/deploy.yml` | 38 | `WORKER_NAME: ${{ vars.WORKER_NAME \|\| 'zamil-shop-bd' }}` | `'rupa-fashion'` (or just set the variable) |
| `.github/workflows/doctor.yml` | 37 | same | same |
| `package.json` | 2 | `"name": "zamil-shop-bd"` | `"rupa-fashion"` (cosmetic) |
| `package.json` | 5 | `"description": "Zamil Shop BD — …"` | your description (cosmetic) |

### 4.3 Fonts and extra colours (optional)

| File | Line | What |
|---|---|---|
| `public/index.html` | 29 | Google Fonts link for the shop (now *Baloo Da 2*, which covers Bangla + English) |
| `public/css/store.css` | 11 | `--font:` the font family name used by the shop |
| `public/css/store.css` | 5–10 | full palette. Lines 5 and 7–8 are overridden by `brand.json` `colors`. Change `--accent` (line 7, sale badges) and the `-d` darker tones (line 6) here |
| `admin/index.html` | 12 | Google Fonts link for the admin |
| `admin/css/admin.css` | 22 | admin font family |
| `worker/src/lib/settings.ts` | 28–29 | default announcement bar text (easier: **Admin → Settings → Store information**) |

### 4.4 Starter catalogue — `scripts/seed-data.mjs`

This is used **only when the database is empty** (the first deploy of a new copy). On a live shop, edit everything in the admin instead.

| Lines | Block | What |
|---|---|---|
| 13–26 | `categories` | category slug, 3-letter SKU code, English/Bangla names, tile colour, parent |
| 31–36 | `zones` | delivery zones: fee, free-delivery-over amount, which divisions/districts/upazilas |
| 47–96 | `rideOnProducts` | the 6 ride-on toys (photos in `public/img/products/*.webp`) |
| 98–233 | `products` | all other starter products: name, price, sale price, sizes/colours/ages, stock, `delivery: "free"` |
| 235–263 | `banners` | starter hero / offer / marketing / popup banners |
| 265 | `coupons` | starter coupon `WELCOME100` |
| 267–273 | `landingPages` | campaign landing pages |

After editing, run `node scripts/build.mjs` (it regenerates `dist-seed/seed.sql` and any missing product illustrations).

---

## 5. Images to replace

| File | Size | Used for |
|---|---|---|
| `public/img/logo.svg` | square, any size (SVG) | default logo in the header, footer and admin (overridden by **Admin → Banners & logo → Shop logo**) |
| `public/img/icon-192.png` | 192 × 192 PNG | phone home-screen icon, notifications |
| `public/img/icon-512.png` | 512 × 512 PNG | install icon, Google logo in search results |
| `public/favicon.ico` | 192 × 192 (or 32 × 32) | browser tab icon |
| `public/img/og-cover.png` | 1200 × 630 PNG | picture shown when the shop link is shared on Facebook / WhatsApp |
| `public/img/og-cover.svg` | 1200 × 630 | source of the share picture (contains the old name) |
| `public/img/products/*` | square, ≥ 800 × 800 | starter product photos (real photos are uploaded in **Admin → Products**) |

---

## 6. A new client: a separate copy of the shop

1. On GitHub, create a new **private** repository and push this code to it (or use **Use this template** if the repo is marked as a template).
2. In the new repo, add the secrets (section 7). Use the **client's own Cloudflare account**, or the same account with a **different `WORKER_NAME`**.
3. Edit `brand.json`, images and the seed (sections 3–5), then push to `main`.
4. The first deploy creates a new D1 database, KV and R2, loads the starter catalogue and creates the Super Admin from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
5. Open `https://<worker-name>.<your-subdomain>.workers.dev/admin/`, sign in, and set up two-step sign-in (an authenticator app).

---

## 7. Secrets, variables and where to get them

**Where to add them:** GitHub → your repository → **Settings → Secrets and variables → Actions**
(for this repo: <https://github.com/bayzed123/babyshop/settings/secrets/actions>).
Secrets go in the *Secrets* tab and variables in the *Variables* tab. On every deploy, `scripts/sync-secrets.mjs`
copies the integration secrets into the Worker. Nothing is ever printed or committed.

### 7.1 Required (the deploy fails without these)

| Secret | What | Where to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | lets GitHub deploy to Cloudflare | <https://dash.cloudflare.com/profile/api-tokens> → **Create Token** → template **Edit Cloudflare Workers**. Then **add** permissions: *Account · D1 · Edit*, *Account · Workers KV Storage · Edit*, *Account · Workers R2 Storage · Edit*. Account Resources: your account |
| `CLOUDFLARE_ACCOUNT_ID` | which Cloudflare account | <https://dash.cloudflare.com/> → **Workers & Pages** → *Account ID* on the right (32 characters). Help: <https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/> |

### 7.2 First Super Admin (recommended for the first deploy)

| Secret | What | Where to get it |
|---|---|---|
| `ADMIN_USERNAME` | sign-in ID of the first Super Admin (e.g. `owner`) | you choose |
| `ADMIN_PASSWORD` | at least 10 characters | you choose (use a password manager) |
| `ADMIN_NAME` | display name (optional) | you choose |
| `BOOTSTRAP_TOKEN` | only if you create the admin **without** CI (`POST /api/admin/auth/bootstrap`). **Delete it afterwards** | generate one: `openssl rand -hex 24` |

### 7.3 Repository variables (Variables tab, not secret)

| Variable | What | Example |
|---|---|---|
| `WORKER_NAME` | Worker and resource names (section 4.1) | `rupa-fashion` |
| `PUBLIC_URL` | your custom domain once it works | `https://rupafashion.com` |

### 7.4 Payments (optional; Cash on Delivery and manual bKash/Nagad numbers work without any)

| Secret | What | Where to get it |
|---|---|---|
| `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` | bKash Tokenized Checkout (automatic payment) | Apply for **bKash Payment Gateway (Tokenized Checkout)**: <https://www.bkash.com/page/tokenized_checkout>. Your bKash Key Account Manager sends the live username, password, app key and app secret after verification. Sandbox credentials and API docs: <https://developer.bka.sh> |
| `BKASH_BASE_URL` | which bKash server | sandbox (default): `https://tokenized.sandbox.bka.sh/v1.2.0-beta` · live: `https://tokenized.pay.bka.sh/v1.2.0-beta` |
| `SSLCZ_STORE_ID`, `SSLCZ_STORE_PASSWD` | SSLCommerz: Visa / Mastercard / Amex and all mobile banking in one page | Sandbox: <https://developer.sslcommerz.com/registration/> (instant) · live: apply at <https://sslcommerz.com> (needs trade license) |
| `SSLCZ_SANDBOX` | `true` = test payments, `false` = real | `false` when you go live |
| `NAGAD_MERCHANT_ID`, `NAGAD_MERCHANT_PRIVATE_KEY`, `NAGAD_PG_PUBLIC_KEY` | Nagad automatic payment (**reserved**: manual Nagad works today) | Nagad merchant: <https://nagad.com.bd> → Merchant |

**IPN / callback URL to register with SSLCommerz:** `https://<your-domain>/api/payments/sslcommerz/ipn`

### 7.5 Couriers (optional)

| Secret | What | Where to get it |
|---|---|---|
| `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY` | book Steadfast parcels from the admin | Steadfast merchant dashboard <https://portal.packzy.com> → **API** section (API Key + Secret Key). If it isn't shown, ask Steadfast support to enable API access |
| `STEADFAST_WEBHOOK_TOKEN` | lets Steadfast send delivery status back | you choose (`openssl rand -hex 24`), then in the Steadfast panel set webhook `https://<your-domain>/api/webhooks/steadfast` with this token as **Bearer** |
| `PATHAO_CLIENT_ID`, `PATHAO_CLIENT_SECRET` | Pathao courier API | Sign in at <https://merchant.pathao.com>, then open <https://merchant.pathao.com/courier/developer-api> (older accounts: <https://parcel.pathao.com/courier/developer-api>) → *Merchant API Credentials* |
| `PATHAO_USERNAME`, `PATHAO_PASSWORD` | your Pathao merchant login email + password | the account you use at merchant.pathao.com |
| `PATHAO_STORE_ID` | which pickup store | <https://merchant.pathao.com> → **Stores** → the number of your store |
| `PATHAO_WEBHOOK_SECRET` | verifies Pathao status updates | Pathao **Developer's API → Webhook**: URL `https://<your-domain>/api/webhooks/pathao`, copy the secret |
| `REDX_API_TOKEN` | RedX (**reserved**) | <https://redx.com.bd> merchant panel → API |
| `FRAUD_CHECK_API_URL`, `FRAUD_CHECK_API_KEY` | courier success/return history by phone number (fake-order check) | any courier-history provider. The phone is sent as `?phone=` and the key as a Bearer token. The provider must return delivered/returned counts |

### 7.6 Messages (optional; strongly recommended: SMS for the phone code at checkout)

| Secret | What | Where to get it |
|---|---|---|
| `SMS_API_KEY` | SMS gateway key (checkout code, order updates) | BulkSMSBD: <https://bulksmsbd.net> → dashboard → **API** (or any gateway with the same `api_key / senderid / number / message` form) |
| `SMS_SENDER_ID` | approved sender name or number | the same SMS dashboard → **Sender ID** (masking needs approval) |
| `SMS_API_URL` | only for a different gateway | default `https://bulksmsbd.net/api/smsapi` |
| `WHATSAPP_TOKEN` | WhatsApp Cloud API permanent token | <https://business.facebook.com/settings/system-users> → add a system user → **Generate token** (permissions `whatsapp_business_messaging`, `whatsapp_business_management`) |
| `WHATSAPP_PHONE_ID` | the sending number's ID | <https://developers.facebook.com/apps> → your app → **WhatsApp → API Setup** → *Phone number ID* |
| `WHATSAPP_APP_SECRET` | verifies incoming WhatsApp messages | same app → **App settings → Basic** → *App secret* |
| `WHATSAPP_VERIFY_TOKEN` | webhook handshake | you choose, then **WhatsApp → Configuration → Webhook**: URL `https://<your-domain>/api/webhooks/whatsapp` and the same verify token |
| `RESEND_API_KEY` | email (order confirmation, password reset) | <https://resend.com/api-keys> (first verify your domain at <https://resend.com/domains>) |
| `EMAIL_FROM` | sender | `Rupa Fashion <orders@rupafashion.com>` (must be on the verified domain) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | phone/browser push notifications | run once: `npx web-push generate-vapid-keys` and copy the two keys |
| `VAPID_SUBJECT` | contact for push services | `mailto:you@rupafashion.com` |

### 7.7 Marketing and protection (optional)

| Secret | What | Where to get it |
|---|---|---|
| `META_CAPI_TOKEN` | Facebook Conversions API (server-side Purchase events) | <https://business.facebook.com/events_manager2> → your Pixel → **Settings** → *Conversions API* → **Generate access token** |
| `META_TEST_EVENT_CODE` | only while testing (**remove after**) | same Pixel → **Test events** tab |
| `GA4_API_SECRET` | GA4 Measurement Protocol (**reserved**) | <https://analytics.google.com> → Admin → **Data streams** → your web stream → *Measurement Protocol API secrets* |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Cloudflare bot check on sign-up/checkout | <https://dash.cloudflare.com/?to=/:account/turnstile> → **Add widget** → your domain |

**Not secrets** (enter in **Admin → Settings → Ads & tracking**): Meta Pixel ID (Events Manager), GA4 Measurement ID
`G-…` (Analytics → Data streams), Google Ads conversion ID/label (<https://ads.google.com> → Goals → Conversions),
Microsoft Clarity ID (<https://clarity.microsoft.com> → Settings), Cloudflare Web Analytics token
(<https://dash.cloudflare.com/?to=/:account/web-analytics>).

Admin → **Settings → Connected services & backups** shows a ✅/❌ for each integration after the deploy.

---

## 8. Custom domain

1. Add the domain to Cloudflare (<https://dash.cloudflare.com/> → **Add a domain**) and change the nameservers at your registrar.
2. In `worker/wrangler.toml`, lines 49–52, remove the `#` and put your domain:
   ```toml
   routes = [
     { pattern = "rupafashion.com", custom_domain = true },
     { pattern = "www.rupafashion.com", custom_domain = true }
   ]
   ```
3. Set the GitHub variable `PUBLIC_URL = https://rupafashion.com`, and `brand.json` line 9 `"domain": "rupafashion.com"`.
4. Push to `main`. Help: <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
5. Update the webhook URLs you registered (Steadfast, Pathao, WhatsApp, SSLCommerz) to the new domain.

---

## 9. Verify

```bash
node scripts/whitelabel.mjs --find "Zamil" --find "জামিল" --find "zamil"   # should list only comments/docs you don't care about
node scripts/build.mjs && npx tsc --noEmit && npx vitest run                  # tests still pass
```

- A test fixture still names the old brand: `tests/fixtures/product-list.response.json` line 8 (`"brand": "Zamil Kids"`). Update it if you rename the starter product brand in `seed-data.mjs`.
- GitHub → **Actions → Doctor → Run workflow**. The Summary tab lists every check, with the exact fix for anything ❌.
- Open the shop on a phone. Check the name, logo, colours, one order with Cash on Delivery, and the invoice PDF prefix.
