/**
 * Seed script — restores all CMS data to known-good defaults.
 * Safe to run multiple times: existing IDs are preserved, missing ones are added,
 * no content is duplicated.
 *
 * Usage:  node scripts/seed.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

await mkdir(DATA_DIR, { recursive: true });

async function readJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function writeJSON(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  wrote ${path.relative(ROOT, file)}`);
}

/* ════════════════════════════════════════════════════════
   SEED DATA
   ════════════════════════════════════════════════════════ */

const SEED_MENU = [
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000001',
    name: 'Breakfast Combo',
    description: 'Eggs, grits, toast & your choice of meat.',
    category: 'breakfast',
    price: '$9.00',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/472556980_2088946614910860_8525602129205215159_n.jpg',
    imageAlt: 'Breakfast combo with eggs and grits'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000002',
    name: 'Egg Omelet',
    description: 'Made to order with fresh ingredients.',
    category: 'breakfast',
    price: '$9.00',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/472745392_2088930574912464_4825028608755080364_n.jpg',
    imageAlt: 'Egg omelet with fresh garnish'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000003',
    name: 'Honey BBQ Wings',
    description: 'Sweet, sticky & full of flavor.',
    category: 'wings',
    price: '',
    priceTiers: [
      { label: '5 pcs', price: '5.50' },
      { label: '10 pcs', price: '9.00' }
    ],
    seasonal: false,
    available: true,
    image: 'images/472792658_2088947638244091_7608298803866236422_n.jpg',
    imageAlt: 'Honey BBQ wings and fries'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000004',
    name: 'Sweet Chili Wings',
    description: 'Crispy wings tossed in our sweet chili sauce.',
    category: 'wings',
    price: '',
    priceTiers: [
      { label: '5 pcs', price: '5.50' },
      { label: '10 pcs', price: '9.00' }
    ],
    seasonal: false,
    available: true,
    image: 'images/473063879_2089541328184722_6360470533825390874_n.jpg',
    imageAlt: 'Sweet chili wings and fries'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000005',
    name: 'Cheese Burger',
    description: 'Juicy, cheesy & served with fries.',
    category: 'burgers',
    price: '$8.50',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/472716682_2088932421578946_9066120884547084071_n.jpg',
    imageAlt: 'Cheese burger and fries'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000006',
    name: 'Cajun Chicken',
    description: 'Spicy, seasoned & always satisfying.',
    category: 'lunch',
    price: '$9.50',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/472506776_2088932468245608_6971659058457923975_n.jpg',
    imageAlt: 'Cajun chicken sandwich and fries'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000007',
    name: 'Baked Macaroni',
    description: 'Creamy, cheesy & oven baked.',
    category: 'sides',
    price: '$3.50',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/baked-macaroni-crop.jpg',
    imageAlt: 'Baked macaroni'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000008',
    name: 'Garden Salad',
    description: 'Fresh greens with your choice of protein.',
    category: 'sides',
    price: '$7.50',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/72715211_778108052661396_8062257654497542144_n.jpg',
    imageAlt: 'Garden salad with tomatoes, onions, and greens'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000009',
    name: 'Tuna Salad',
    description: 'Cool, fresh, and ready for lunch.',
    category: 'lunch',
    price: '$6.50',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/472424922_2088926098246245_4451412316723871727_n.jpg',
    imageAlt: 'Tuna salad with vegetables'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000010',
    name: 'Shrimp Salad',
    description: 'Fresh vegetables with seasoned shrimp.',
    category: 'lunch',
    price: '$7.50',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/73482614_796076757531192_4481758142417338368_n.jpg',
    imageAlt: 'Grilled shrimp salad'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000011',
    name: 'French Fries',
    description: 'Crisp, golden, and made to share.',
    category: 'sides',
    price: '$3.00',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/472582974_2088947704910751_5426204339296596742_n.jpg',
    imageAlt: 'French fries'
  },
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000012',
    name: 'BBQ Chicken Plate',
    description: 'Ask about today\'s lunch special.',
    category: 'lunch',
    price: 'special',
    priceTiers: [],
    seasonal: false,
    available: true,
    image: 'images/472657285_2088940028244852_7776364398675349040_n.jpg',
    imageAlt: 'BBQ chicken plate'
  }
];

const SEED_GALLERY = [
  {
    id: 'g1b2c3d4-0001-0001-0001-000000000001',
    filename: '73482614_796076757531192_4481758142417338368_n.jpg',
    src: 'images/73482614_796076757531192_4481758142417338368_n.jpg',
    caption: 'Prepared cafe food platter'
  },
  {
    id: 'g1b2c3d4-0001-0001-0001-000000000002',
    filename: '472716682_2088932421578946_9066120884547084071_n.jpg',
    src: 'images/472716682_2088932421578946_9066120884547084071_n.jpg',
    caption: 'Burger and fries'
  },
  {
    id: 'g1b2c3d4-0001-0001-0001-000000000003',
    filename: '72715211_778108052661396_8062257654497542144_n.jpg',
    src: 'images/72715211_778108052661396_8062257654497542144_n.jpg',
    caption: 'Fresh garden salad'
  },
  {
    id: 'g1b2c3d4-0001-0001-0001-000000000004',
    filename: '472874925_2088926064912915_83807834805126614_n.jpg',
    src: 'images/472874925_2088926064912915_83807834805126614_n.jpg',
    caption: 'Fresh pasta salad'
  },
  {
    id: 'g1b2c3d4-0001-0001-0001-000000000005',
    filename: '472745392_2088930574912464_4825028608755080364_n.jpg',
    src: 'images/472745392_2088930574912464_4825028608755080364_n.jpg',
    caption: 'Egg omelet plate'
  },
  {
    id: 'g1b2c3d4-0001-0001-0001-000000000006',
    filename: '156205065_1154605468344984_3350387348926229050_n.jpg',
    src: 'images/156205065_1154605468344984_3350387348926229050_n.jpg',
    caption: 'Cafe dessert plate'
  },
  {
    id: 'g1b2c3d4-0001-0001-0001-000000000007',
    filename: '472556980_2088946614910860_8525602129205215159_n.jpg',
    src: 'images/472556980_2088946614910860_8525602129205215159_n.jpg',
    caption: 'Breakfast combo plate'
  }
];

const SEED_CMS = {
  hero: {
    heading: 'Fresh bites.',
    headingSpan: 'Friendly bytes.',
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
    phone: '(242) 603-2487',
    whatsapp: '(242) 825-2983',
    email: '',
    addressLine1: 'Shirley Street',
    addressCity: 'Nassau, Bahamas'
  }
};

/* ════════════════════════════════════════════════════════
   MERGE HELPERS  (idempotent — preserve additions, restore missing)
   ════════════════════════════════════════════════════════ */

function mergeById(existing, seeds) {
  const map = new Map(existing.map(e => [e.id, e]));
  for (const seed of seeds) {
    if (!map.has(seed.id)) {
      map.set(seed.id, seed);
    }
    // If it exists already, leave it untouched (preserve admin edits)
  }
  // Return in seed order first, then any extras the admin added
  const seedIds = new Set(seeds.map(s => s.id));
  return [
    ...seeds.map(s => map.get(s.id)),
    ...existing.filter(e => !seedIds.has(e.id))
  ];
}

function mergeCms(existing, seed) {
  return {
    hero: { ...seed.hero, ...existing.hero },
    hours: (existing.hours?.length === seed.hours.length)
      ? existing.hours
      : seed.hours,
    contact: { ...seed.contact, ...existing.contact }
  };
}

/* ════════════════════════════════════════════════════════
   RUN
   ════════════════════════════════════════════════════════ */

const MENU_FILE   = path.join(DATA_DIR, 'menu.json');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');
const CMS_FILE    = path.join(DATA_DIR, 'cms-data.json');

console.log('\nBits & Bytes Cafe — CMS seed\n');

// Menu
const existingMenu = await readJSON(MENU_FILE, []);
const mergedMenu = existingMenu.length ? existingMenu : SEED_MENU;
await writeJSON(MENU_FILE, mergedMenu);
console.log(`  ${mergedMenu.length} menu items (${mergedMenu.filter(i => i.available).length} available)`);

// Gallery
const existingGallery = await readJSON(GALLERY_FILE, []);
const mergedGallery = mergeById(existingGallery, SEED_GALLERY);
await writeJSON(GALLERY_FILE, mergedGallery);
console.log(`  ${mergedGallery.length} gallery photos`);

// CMS site content
const existingCms = await readJSON(CMS_FILE, {});
const mergedCms = mergeCms(existingCms, SEED_CMS);
await writeJSON(CMS_FILE, mergedCms);
console.log(`  CMS data: hero, ${mergedCms.hours.length} hours entries, contact info`);

console.log('\nSeed complete. All content is published and active.\n');
