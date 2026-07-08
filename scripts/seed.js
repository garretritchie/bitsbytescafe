/**
 * Supabase seed script — reads JSON data files and upserts all site content
 * into the Supabase database. Safe to run multiple times (idempotent).
 *
 * Usage: node scripts/seed.js
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env manually (no dotenv dependency)
try {
  const envText = await readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function readJSON(file, fallback = []) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}

function log(msg) { console.log(`  ${msg}`); }
function err(msg) { console.error(`  ERROR: ${msg}`); }

const DATA = {
  menu:    path.join(ROOT, 'data', 'menu.json'),
  gallery: path.join(ROOT, 'data', 'gallery.json'),
  cms:     path.join(ROOT, 'data', 'cms-data.json'),
};

const DEFAULT_CMS = {
  hero: {
    heading: 'Fresh bites.', headingSpan: 'Friendly bytes.',
    subheading: 'Delicious, affordable breakfast, lunch, coffee, and comfort food with local Bahamian flavor.',
    image: 'images/74604694_795940760878125_3195495164743254016_n.jpg'
  },
  hours: [
    { day: 'Monday',    open: '07:00', close: '16:00', closed: false },
    { day: 'Tuesday',   open: '07:00', close: '16:00', closed: false },
    { day: 'Wednesday', open: '07:00', close: '16:00', closed: false },
    { day: 'Thursday',  open: '07:00', close: '16:00', closed: false },
    { day: 'Friday',    open: '07:00', close: '16:00', closed: false },
    { day: 'Saturday',  open: '07:00', close: '16:00', closed: false },
    { day: 'Sunday',    open: '',      close: '',      closed: true  }
  ],
  contact: {
    phone: '(242) 603-2487', whatsapp: '(242) 825-2983',
    email: '', addressLine1: 'Shirley Street', addressCity: 'Nassau, Bahamas'
  }
};

const CATEGORY_DEFS = [
  { name: 'Breakfast',                   slug: 'breakfast',               description: 'Morning breakfast plates, combos, and sandwiches', display_order: 1 },
  { name: 'Sandwiches, Wraps & Burgers', slug: 'sandwiches-wraps-burgers', description: 'Sandwiches, wraps, subs, and burgers',               display_order: 2 },
  { name: 'Chicken Wings',               slug: 'chicken-wings',            description: 'Fresh chicken wings in various flavors and sizes',   display_order: 3 },
  { name: 'Lunch',                       slug: 'lunch',                    description: 'Dinner plates, curries, and main meals',              display_order: 4 },
  { name: 'Sides & Salads',             slug: 'sides-salads',             description: 'Rice, sides, salads, and small bites',               display_order: 5 },
];

const SOCIAL_LINKS = [
  { platform: 'facebook',  url: 'https://www.facebook.com/bitsbytescafe',  label: '@bitsbytescafe',  display_order: 1 },
  { platform: 'instagram', url: 'https://www.instagram.com/bitsbytescafe', label: '@bitsbytescafe',  display_order: 2 },
  { platform: 'tiktok',    url: 'https://www.tiktok.com/@bitsandbytes242', label: '@bitsandbytes242', display_order: 3 },
];

console.log('\nBits & Bytes Cafe — Supabase seed\n');

// ── 1. Site settings ───────────────────────────────────────────────────────
const cmsData = await readJSON(DATA.cms, DEFAULT_CMS);
const { count: settingsCount } = await supabase.from('site_settings').select('*', { count: 'exact', head: true });
if (settingsCount === 0) {
  const { error } = await supabase.from('site_settings').insert({
    site_name:         'Bits & Bytes Cafe',
    tagline:           'Fresh bites. Friendly bytes.',
    description:       cmsData.hero?.subheading || DEFAULT_CMS.hero.subheading,
    primary_phone:     cmsData.contact?.phone      || DEFAULT_CMS.contact.phone,
    whatsapp:          cmsData.contact?.whatsapp   || DEFAULT_CMS.contact.whatsapp,
    email:             cmsData.contact?.email      || '',
    address_line1:     cmsData.contact?.addressLine1 || DEFAULT_CMS.contact.addressLine1,
    address_city:      cmsData.contact?.addressCity  || DEFAULT_CMS.contact.addressCity,
    hero_heading:      cmsData.hero?.heading     || DEFAULT_CMS.hero.heading,
    hero_heading_span: cmsData.hero?.headingSpan || DEFAULT_CMS.hero.headingSpan,
    hero_subheading:   cmsData.hero?.subheading  || DEFAULT_CMS.hero.subheading,
    hero_image_url:    cmsData.hero?.image       || DEFAULT_CMS.hero.image,
    opening_hours:     cmsData.hours             || DEFAULT_CMS.hours,
    facebook_url:      'https://www.facebook.com/bitsbytescafe',
    instagram_url:     'https://www.instagram.com/bitsbytescafe',
    tiktok_url:        'https://www.tiktok.com/@bitsandbytes242',
  });
  if (error) err(`site_settings: ${error.message}`);
  else log('site_settings: inserted 1 row');
} else {
  log('site_settings: already exists, skipped');
}

// ── 2. Menu categories ─────────────────────────────────────────────────────
const { data: existingCats } = await supabase.from('menu_categories').select('id, slug');
const existingCatSlugs = new Set((existingCats || []).map(c => c.slug));
const catIdMap = {};
for (const c of (existingCats || [])) catIdMap[c.slug] = c.id;

const catsToInsert = CATEGORY_DEFS.filter(c => !existingCatSlugs.has(c.slug));
if (catsToInsert.length) {
  const { data: inserted, error } = await supabase.from('menu_categories').insert(catsToInsert.map(c => ({ ...c, is_active: true }))).select('id, slug');
  if (error) err(`menu_categories: ${error.message}`);
  else {
    for (const c of (inserted || [])) catIdMap[c.slug] = c.id;
    log(`menu_categories: inserted ${inserted?.length ?? 0} rows`);
  }
} else {
  log(`menu_categories: all ${CATEGORY_DEFS.length} already exist, skipped`);
}

// ── 3. Menu items ──────────────────────────────────────────────────────────
const menuData = await readJSON(DATA.menu, []);
const { count: itemCount } = await supabase.from('menu_items').select('*', { count: 'exact', head: true });
if (itemCount === 0 && menuData.length) {
  const rows = menuData.map((item, i) => ({
    category_id:   catIdMap[item.category] || null,
    name:          item.name,
    description:   item.description || '',
    price:         item.price || '',
    price_tiers:   item.priceTiers || [],
    image_url:     item.image || '',
    image_alt:     item.imageAlt || item.name,
    is_available:  item.available !== false,
    is_seasonal:   item.seasonal === true,
    is_featured:   false,
    display_order: i,
  }));
  // Insert in batches of 25 to stay under payload limits
  let total = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);
    const { data: ins, error } = await supabase.from('menu_items').insert(batch).select('id');
    if (error) { err(`menu_items batch ${i}: ${error.message}`); break; }
    total += ins?.length ?? 0;
  }
  log(`menu_items: inserted ${total} rows`);
} else if (itemCount > 0) {
  log(`menu_items: ${itemCount} already exist, skipped`);
} else {
  log('menu_items: no data in menu.json');
}

// ── 4. Gallery / media_assets ──────────────────────────────────────────────
const galleryData = await readJSON(DATA.gallery, []);
const { count: galleryCount } = await supabase.from('media_assets').select('*', { count: 'exact', head: true }).eq('usage_type', 'gallery');
if (galleryCount === 0 && galleryData.length) {
  const rows = galleryData.map((g, i) => ({
    file_name:     g.filename || '',
    file_url:      g.src || '',
    file_type:     'image',
    caption:       g.caption || '',
    alt_text:      g.caption || '',
    usage_type:    'gallery',
    display_order: i,
  }));
  const { data: ins, error } = await supabase.from('media_assets').insert(rows).select('id');
  if (error) err(`media_assets: ${error.message}`);
  else log(`media_assets: inserted ${ins?.length ?? 0} rows`);
} else if (galleryCount > 0) {
  log(`media_assets: ${galleryCount} gallery items already exist, skipped`);
}

// ── 5. Social links ────────────────────────────────────────────────────────
for (const link of SOCIAL_LINKS) {
  const { count } = await supabase.from('social_links').select('*', { count: 'exact', head: true }).eq('platform', link.platform);
  if (count === 0) {
    const { error } = await supabase.from('social_links').insert({ ...link, is_active: true });
    if (error) err(`social_links ${link.platform}: ${error.message}`);
    else log(`social_links: inserted ${link.platform}`);
  }
}

// ── 6. Admin user profile ──────────────────────────────────────────────────
const { count: userCount } = await supabase.from('admin_user_profiles').select('*', { count: 'exact', head: true });
if (userCount === 0) {
  const { error } = await supabase.from('admin_user_profiles').insert({
    first_name: 'Admin', last_name: '', email: 'admin@bitsbytes.local', role: 'admin', status: 'active'
  });
  if (error) err(`admin_user_profiles: ${error.message}`);
  else log('admin_user_profiles: inserted admin user');
} else {
  log('admin_user_profiles: already exists, skipped');
}

console.log('\nSeed complete.\n');
