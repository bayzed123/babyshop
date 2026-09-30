-- 0002: free-delivery options and more banner types.
--  * products.delivery_mode: 'zone' = delivery charge auto-calculated from the customer's area (default),
--    'free' = this product ships free (a cart of only free-delivery products pays no delivery charge).
--  * coupons.type gains 'free_delivery' (removes the delivery charge; value may be 0).
--  * banners.placement gains 'offer', 'marketing' and 'popup'; old 'promo' banners become 'offer'.
-- SQLite can't alter a CHECK constraint, so coupons and banners are rebuilt (nothing references them by key).

ALTER TABLE products ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'zone' CHECK (delivery_mode IN ('zone','free'));

CREATE TABLE coupons_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  code                TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description         TEXT,
  kind                TEXT NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard','recovery','referral_reward')),
  type                TEXT NOT NULL CHECK (type IN ('percent','flat','free_delivery')),
  value               INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0 AND (type = 'free_delivery' OR value > 0)),
  min_order           INTEGER NOT NULL DEFAULT 0,
  max_discount        INTEGER,
  starts_at           TEXT,
  expires_at          TEXT,
  usage_limit         INTEGER,
  per_customer_limit  INTEGER,
  used_count          INTEGER NOT NULL DEFAULT 0,
  category_ids        TEXT NOT NULL DEFAULT '[]',
  customer_phone      TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at          TEXT
);
INSERT INTO coupons_new (id, code, description, kind, type, value, min_order, max_discount, starts_at, expires_at, usage_limit, per_customer_limit, used_count, category_ids, customer_phone, is_active, created_at, updated_at, deleted_at)
  SELECT id, code, description, kind, type, value, min_order, max_discount, starts_at, expires_at, usage_limit, per_customer_limit, used_count, category_ids, customer_phone, is_active, created_at, updated_at, deleted_at FROM coupons;
DROP TABLE coupons;
ALTER TABLE coupons_new RENAME TO coupons;

CREATE TABLE banners_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  placement    TEXT NOT NULL DEFAULT 'hero' CHECK (placement IN ('hero','offer','marketing','popup')),
  title_en     TEXT NOT NULL,
  title_bn     TEXT NOT NULL,
  subtitle_en  TEXT,
  subtitle_bn  TEXT,
  cta_en       TEXT,
  cta_bn       TEXT,
  link_url     TEXT,
  image_url    TEXT,
  color        TEXT,
  starts_at    TEXT,
  ends_at      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at   TEXT
);
INSERT INTO banners_new (id, placement, title_en, title_bn, subtitle_en, subtitle_bn, cta_en, cta_bn, link_url, image_url, color, starts_at, ends_at, sort_order, is_active, created_at, updated_at, deleted_at)
  SELECT id, CASE placement WHEN 'promo' THEN 'offer' ELSE placement END, title_en, title_bn, subtitle_en, subtitle_bn, cta_en, cta_bn, link_url, image_url, color, starts_at, ends_at, sort_order, is_active, created_at, updated_at, deleted_at FROM banners;
DROP TABLE banners;
ALTER TABLE banners_new RENAME TO banners;
CREATE INDEX idx_banners_live ON banners(placement, is_active, deleted_at);
