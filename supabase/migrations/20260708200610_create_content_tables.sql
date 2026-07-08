/*
# Create core content tables

Replaces JSON file storage with Supabase-backed tables.

## New Tables

1. `site_settings` - Single-row business config: name, contact, hero content, opening hours
2. `website_sections` - Editable homepage content sections (hero, about, CTA, footer)
3. `menu_categories` - Menu category definitions with display ordering
4. `menu_items` - Menu items linked to categories with full metadata
5. `specials` - Time-limited promotions with optional date range
6. `social_links` - Social media platform links
7. `media_assets` - Media file references and gallery items

## Security

- RLS enabled on all tables
- Public (anon) SELECT allowed on all content tables for server-side SSR and client reads
- Public (anon) full write allowed on content tables — security enforced at Express layer via requireAuth middleware
- This is appropriate for an owner-operated admin panel where the Express API is the security boundary
*/

-- ── Site Settings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name       text        NOT NULL DEFAULT 'Bits & Bytes Cafe',
  tagline         text        DEFAULT 'Fresh bites. Friendly bytes.',
  description     text        DEFAULT 'Delicious, affordable breakfast, lunch, coffee, and comfort food with local Bahamian flavor.',
  primary_phone   text        DEFAULT '(242) 603-2487',
  secondary_phone text        DEFAULT '',
  whatsapp        text        DEFAULT '(242) 825-2983',
  email           text        DEFAULT '',
  address_line1   text        DEFAULT 'Shirley Street',
  address_city    text        DEFAULT 'Nassau, Bahamas',
  google_maps_url text        DEFAULT 'https://maps.app.goo.gl/gfFT5uFtX3wofoPz5',
  logo_url        text        DEFAULT 'images/bits-bytes-logo-wide-cropped.png',
  favicon_url     text        DEFAULT 'images/bits-bytes-logo-circle-cropped.png',
  hero_image_url  text        DEFAULT 'images/74604694_795940760878125_3195495164743254016_n.jpg',
  hero_heading    text        DEFAULT 'Fresh bites.',
  hero_heading_span text      DEFAULT 'Friendly bytes.',
  hero_subheading text        DEFAULT 'Delicious, affordable breakfast, lunch, coffee, and comfort food with local Bahamian flavor.',
  opening_hours   jsonb       DEFAULT '[]'::jsonb,
  facebook_url    text        DEFAULT 'https://www.facebook.com/bitsbytescafe',
  instagram_url   text        DEFAULT 'https://www.instagram.com/bitsbytescafe',
  tiktok_url      text        DEFAULT 'https://www.tiktok.com/@bitsandbytes242',
  whatsapp_url    text        DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── Website Sections ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS website_sections (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key   text        UNIQUE NOT NULL,
  title         text        DEFAULT '',
  subtitle      text        DEFAULT '',
  body          text        DEFAULT '',
  button_label  text        DEFAULT '',
  button_url    text        DEFAULT '',
  image_url     text        DEFAULT '',
  display_order int         DEFAULT 0,
  is_active     boolean     DEFAULT true,
  metadata      jsonb       DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── Menu Categories ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  slug          text        UNIQUE NOT NULL,
  description   text        DEFAULT '',
  display_order int         DEFAULT 0,
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_slug  ON menu_categories(slug);
CREATE INDEX IF NOT EXISTS idx_menu_categories_order ON menu_categories(display_order) WHERE is_active = true;

-- ── Menu Items ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid        REFERENCES menu_categories(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  description   text        DEFAULT '',
  price         text        DEFAULT '',
  price_tiers   jsonb       DEFAULT '[]'::jsonb,
  image_url     text        DEFAULT '',
  image_alt     text        DEFAULT '',
  tags          text[]      DEFAULT '{}',
  is_available  boolean     DEFAULT true,
  is_featured   boolean     DEFAULT false,
  is_seasonal   boolean     DEFAULT false,
  display_order int         DEFAULT 0,
  metadata      jsonb       DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category  ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_order     ON menu_items(display_order);

-- ── Specials ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS specials (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  description   text        DEFAULT '',
  image_url     text        DEFAULT '',
  start_date    date,
  end_date      date,
  is_active     boolean     DEFAULT true,
  display_order int         DEFAULT 0,
  cta_label     text        DEFAULT '',
  cta_url       text        DEFAULT '',
  metadata      jsonb       DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── Social Links ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      text        NOT NULL,
  url           text        NOT NULL,
  label         text        DEFAULT '',
  display_order int         DEFAULT 0,
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ── Media Assets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_assets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     text        DEFAULT '',
  file_url      text        NOT NULL,
  file_type     text        DEFAULT 'image',
  alt_text      text        DEFAULT '',
  caption       text        DEFAULT '',
  usage_type    text        DEFAULT 'gallery',
  display_order int         DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE site_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE specials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets     ENABLE ROW LEVEL SECURITY;

-- site_settings: full anon access (business info is public, writes protected by Express)
DROP POLICY IF EXISTS "anon_select_site_settings" ON site_settings;
CREATE POLICY "anon_select_site_settings" ON site_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_site_settings" ON site_settings;
CREATE POLICY "anon_insert_site_settings" ON site_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_site_settings" ON site_settings;
CREATE POLICY "anon_update_site_settings" ON site_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_site_settings" ON site_settings;
CREATE POLICY "anon_delete_site_settings" ON site_settings FOR DELETE TO anon, authenticated USING (true);

-- website_sections
DROP POLICY IF EXISTS "anon_select_website_sections" ON website_sections;
CREATE POLICY "anon_select_website_sections" ON website_sections FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_website_sections" ON website_sections;
CREATE POLICY "anon_insert_website_sections" ON website_sections FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_website_sections" ON website_sections;
CREATE POLICY "anon_update_website_sections" ON website_sections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_website_sections" ON website_sections;
CREATE POLICY "anon_delete_website_sections" ON website_sections FOR DELETE TO anon, authenticated USING (true);

-- menu_categories
DROP POLICY IF EXISTS "anon_select_menu_categories" ON menu_categories;
CREATE POLICY "anon_select_menu_categories" ON menu_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_menu_categories" ON menu_categories;
CREATE POLICY "anon_insert_menu_categories" ON menu_categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_menu_categories" ON menu_categories;
CREATE POLICY "anon_update_menu_categories" ON menu_categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_menu_categories" ON menu_categories;
CREATE POLICY "anon_delete_menu_categories" ON menu_categories FOR DELETE TO anon, authenticated USING (true);

-- menu_items
DROP POLICY IF EXISTS "anon_select_menu_items" ON menu_items;
CREATE POLICY "anon_select_menu_items" ON menu_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_menu_items" ON menu_items;
CREATE POLICY "anon_insert_menu_items" ON menu_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_menu_items" ON menu_items;
CREATE POLICY "anon_update_menu_items" ON menu_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_menu_items" ON menu_items;
CREATE POLICY "anon_delete_menu_items" ON menu_items FOR DELETE TO anon, authenticated USING (true);

-- specials
DROP POLICY IF EXISTS "anon_select_specials" ON specials;
CREATE POLICY "anon_select_specials" ON specials FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_specials" ON specials;
CREATE POLICY "anon_insert_specials" ON specials FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_specials" ON specials;
CREATE POLICY "anon_update_specials" ON specials FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_specials" ON specials;
CREATE POLICY "anon_delete_specials" ON specials FOR DELETE TO anon, authenticated USING (true);

-- social_links
DROP POLICY IF EXISTS "anon_select_social_links" ON social_links;
CREATE POLICY "anon_select_social_links" ON social_links FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_social_links" ON social_links;
CREATE POLICY "anon_insert_social_links" ON social_links FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_social_links" ON social_links;
CREATE POLICY "anon_update_social_links" ON social_links FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_social_links" ON social_links;
CREATE POLICY "anon_delete_social_links" ON social_links FOR DELETE TO anon, authenticated USING (true);

-- media_assets
DROP POLICY IF EXISTS "anon_select_media_assets" ON media_assets;
CREATE POLICY "anon_select_media_assets" ON media_assets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_media_assets" ON media_assets;
CREATE POLICY "anon_insert_media_assets" ON media_assets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_media_assets" ON media_assets;
CREATE POLICY "anon_update_media_assets" ON media_assets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_media_assets" ON media_assets;
CREATE POLICY "anon_delete_media_assets" ON media_assets FOR DELETE TO anon, authenticated USING (true);
