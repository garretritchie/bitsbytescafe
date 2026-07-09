import express from 'express';
import session from 'express-session';
import multer from 'multer';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { readFileSync as readFileSyncFs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createPasswordCredential, verifyPasswordCredential } from './scripts/admin-password-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const MENU_FILE   = path.join(DATA_DIR, 'menu.json');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');
const CMS_FILE    = path.join(DATA_DIR, 'cms-data.json');

// ── Load .env if env vars are missing ──────────────────────────────────────
try {
  const envText = readFileSyncFs(path.join(__dirname, '.env'), 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.trim().replace(/^\uFEFF/, '').match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

await mkdir(DATA_DIR, { recursive: true }).catch(() => {});
await mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});

// ── Supabase ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// ── Express setup ───────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'bbc-cms-local-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, sameSite: 'lax' }
}));

// Static files
app.use('/images',  express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.get('/script.js',  (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

// ── Multer ──────────────────────────────────────────────────────────────────
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.tmp`);
  }
});
const upload    = multer({ storage: diskStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Helpers ─────────────────────────────────────────────────────────────────
async function readJSON(file, fallback = []) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}

function escH(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const s = h < 12 ? 'am' : 'pm', h12 = h % 12 || 12;
  return m === 0 ? `${h12}${s}` : `${h12}:${String(m).padStart(2,'0')}${s}`;
}
function hoursFeature(hours) {
  const open = (hours||[]).filter(h => !h.closed);
  if (!open.length) return 'Temporarily closed';
  const first = open[0], last = open[open.length-1];
  const range = first.day === last.day ? first.day : `${first.day.slice(0,3)} - ${last.day.slice(0,3)}`;
  return `${range}: ${fmt12(first.open)} - ${fmt12(first.close)}`;
}
function footerHoursHtml(hours) {
  const openDays   = (hours||[]).filter(h => !h.closed);
  const closedDays = (hours||[]).filter(h => h.closed);
  let html = '';
  if (openDays.length) {
    const f = openDays[0], l = openDays[openDays.length-1];
    const dr = f.day === l.day ? escH(f.day) : `${escH(f.day.slice(0,3))} - ${escH(l.day.slice(0,3))}`;
    html += `<p>${dr}<br>${escH(fmt12(f.open))} - ${escH(fmt12(f.close))}</p>`;
  }
  if (closedDays.length) {
    const label = closedDays.length === 1 ? escH(closedDays[0].day)
      : `${escH(closedDays[0].day.slice(0,3))} - ${escH(closedDays[closedDays.length-1].day.slice(0,3))}`;
    html += `<p>${label}<br>Closed</p>`;
  }
  return html;
}
function toTel(p)  { return (p||'').replace(/[^\d+]/g,''); }
function toWaMe(p) { return `https://wa.me/${(p||'').replace(/\D/g,'')}`; }

// ── CMS data (Supabase with JSON fallback) ──────────────────────────────────
const DEFAULT_CMS = {
  hero: { heading:'Fresh bites.', headingSpan:'Friendly bytes.',
    subheading:'Delicious, affordable breakfast, lunch, coffee, and comfort food with local Bahamian flavor.',
    image:'images/74604694_795940760878125_3195495164743254016_n.jpg' },
  hours: [
    {day:'Monday',open:'07:00',close:'16:00',closed:false},
    {day:'Tuesday',open:'07:00',close:'16:00',closed:false},
    {day:'Wednesday',open:'07:00',close:'16:00',closed:false},
    {day:'Thursday',open:'07:00',close:'16:00',closed:false},
    {day:'Friday',open:'07:00',close:'16:00',closed:false},
    {day:'Saturday',open:'07:00',close:'16:00',closed:false},
    {day:'Sunday',open:'',close:'',closed:true}
  ],
  contact:{ phone:'(242) 603-2487', whatsapp:'(242) 825-2983', email:'',
    addressLine1:'Shirley Street', addressCity:'Nassau, Bahamas' }
};

async function getCmsData() {
  try {
    const { data } = await supabase.from('site_settings').select('*').maybeSingle();
    if (data) {
      return {
        hero: { heading: data.hero_heading, headingSpan: data.hero_heading_span,
          subheading: data.hero_subheading, image: data.hero_image_url },
        hours: data.opening_hours || DEFAULT_CMS.hours,
        contact: { phone: data.primary_phone, whatsapp: data.whatsapp, email: data.email,
          addressLine1: data.address_line1, addressCity: data.address_city }
      };
    }
  } catch {}
  return readJSON(CMS_FILE, DEFAULT_CMS);
}

async function renderIndex(cms) {
  let html = await readFile(path.join(__dirname, 'index.template.html'), 'utf8').catch(() =>
    readFile(path.join(__dirname, 'index.html'), 'utf8'));
  const r = {
    '{{SEO_HEAD}}':          '',
    '{{HERO_HEADING}}':      escH(cms.hero.heading),
    '{{HERO_HEADING_SPAN}}': escH(cms.hero.headingSpan),
    '{{HERO_SUBHEADING}}':   escH(cms.hero.subheading),
    '{{HERO_IMAGE}}':        escH(cms.hero.image),
    '{{HOURS_FEATURE}}':     escH(hoursFeature(cms.hours)),
    '{{PHONE_DISPLAY}}':     escH(cms.contact.phone),
    '{{PHONE_TEL}}':         escH(toTel(cms.contact.phone)),
    '{{WHATSAPP_DISPLAY}}':  escH(cms.contact.whatsapp),
    '{{WHATSAPP_WAME}}':     toWaMe(cms.contact.whatsapp),
    '{{ADDRESS_LINE1}}':     escH(cms.contact.addressLine1),
    '{{ADDRESS_CITY}}':      escH(cms.contact.addressCity),
    '{{FOOTER_HOURS_HTML}}': footerHoursHtml(cms.hours)
  };
  for (const [k, v] of Object.entries(r)) html = html.replaceAll(k, v);
  return html;
}

// ── Auth ────────────────────────────────────────────────────────────────────
const ADMIN_TOKEN = Buffer.from('admin:password123').toString('base64');

function getAuthCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)bbc_auth=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  if (req.headers['x-admin-token'] === ADMIN_TOKEN) return next();
  if (getAuthCookie(req) === ADMIN_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Activity log helper ─────────────────────────────────────────────────────
async function logActivity(action, entityType, entityId, summary, metadata = {}) {
  try {
    await supabase.from('admin_activity_log').insert({
      action, entity_type: entityType, entity_id: String(entityId||''),
      summary, metadata
    });
  } catch {}
}

// ── Admin pages ─────────────────────────────────────────────────────────────
app.get('/admin/login', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/admin/');
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});
app.get('/admin/cms', (req, res) => {
  if (!req.session?.authenticated) return res.redirect('/admin/login');
  res.sendFile(path.join(__dirname, 'admin', 'cms.html'));
});
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ── Public pages ─────────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  try {
    const cms = await getCmsData();
    res.set('Content-Type','text/html; charset=utf-8').send(await renderIndex(cms));
  } catch { res.sendFile(path.join(__dirname, 'index.html')); }
});
app.get('/preview', async (req, res) => {
  try {
    const cms = await getCmsData();
    res.set('Content-Type','text/html; charset=utf-8').set('Cache-Control','no-store').send(await renderIndex(cms));
  } catch { res.sendFile(path.join(__dirname, 'index.html')); }
});

// ── Auth API ──────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const normalized = String(username || '').trim().toLowerCase();
  const email = normalized === 'admin' ? 'admin@bitsbytes.local' : normalized;
  const { data: profile, error: profileError } = await supabase.from('admin_user_profiles')
    .select('email,status,password_hash,password_salt')
    .eq('email', email)
    .maybeSingle();
  if (profileError && /password_hash|password_salt/i.test(profileError.message || '')) {
    if (normalized === 'admin' && password === 'password123') {
      res.setHeader('Set-Cookie', `bbc_auth=${encodeURIComponent(ADMIN_TOKEN)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${8*60*60}`);
      if (req.headers['content-type']?.includes('application/json')) {
        return res.json({ ok: true });
      }
      return res.redirect('/admin/');
    }
    if (req.headers['content-type']?.includes('application/json')) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.redirect('/admin/login?error=1');
  }
  const authenticated = profile?.status === 'active' && (
    await verifyPasswordCredential(password || '', profile) ||
    (!profile.password_hash && normalized === 'admin' && password === 'password123')
  );

  if (authenticated) {
    // Set persistent HTTP-only cookie (works across stateless serverless invocations)
    res.setHeader('Set-Cookie', `bbc_auth=${encodeURIComponent(ADMIN_TOKEN)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${8*60*60}`);
    if (req.session) {
      req.session.authenticated = true;
      req.session.save(async () => {
        await logActivity('admin_login', 'auth', 'admin', 'Admin logged in');
        // Respond with JSON or redirect depending on caller
        if (req.headers['content-type']?.includes('application/json')) {
          res.json({ ok: true });
        } else {
          res.redirect('/admin/');
        }
      });
    } else {
      logActivity('admin_login', 'auth', 'admin', 'Admin logged in').catch(() => {});
      if (req.headers['content-type']?.includes('application/json')) {
        res.json({ ok: true });
      } else {
        res.redirect('/admin/');
      }
    }
  } else {
    if (req.headers['content-type']?.includes('application/json')) {
      res.status(401).json({ error: 'Invalid credentials' });
    } else {
      res.redirect('/admin/login?error=1');
    }
  }
});
app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'bbc_auth=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  if (req.session) {
    req.session.destroy(() => res.redirect('/admin/login'));
  } else {
    res.redirect('/admin/login');
  }
});
app.get('/api/auth/status', (req, res) => {
  const authenticated = !!req.session?.authenticated || getAuthCookie(req) === ADMIN_TOKEN;
  res.json({ authenticated, token: ADMIN_TOKEN });
});

// ── Config (public, for admin SPA) ──────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const { count, error } = await supabase.from('menu_categories').select('*', { count: 'exact', head: true });
    res.json({ ok: true, db: error ? 'error' : 'connected', categories: count || 0, supabaseUrl: SUPABASE_URL ? 'set' : 'MISSING' });
  } catch (err) {
    res.json({ ok: false, error: err.message, supabaseUrl: SUPABASE_URL ? 'set' : 'MISSING' });
  }
});

// ── Dashboard summary ─────────────────────────────────────────────────────────
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [
      { count: totalItems },
      { count: availableItems },
      { count: activeSpecials },
      { count: totalUsers },
      { data: recentActivity },
      { data: recentEvents }
    ] = await Promise.all([
      supabase.from('menu_items').select('*', { count:'exact', head:true }),
      supabase.from('menu_items').select('*', { count:'exact', head:true }).eq('is_available', true),
      supabase.from('specials').select('*', { count:'exact', head:true }).eq('is_active', true),
      supabase.from('admin_user_profiles').select('*', { count:'exact', head:true }),
      supabase.from('admin_activity_log').select('*').order('created_at', { ascending:false }).limit(10),
      supabase.from('analytics_events').select('*').eq('event_type','page_view')
        .gte('created_at', new Date(Date.now()-7*24*60*60*1000).toISOString()).order('created_at',{ascending:false}).limit(200)
    ]);

    const shareCount = (await supabase.from('analytics_events').select('*',{count:'exact',head:true}).eq('event_type','social_share_click')).count || 0;

    res.json({ totalItems, availableItems, activeSpecials, totalUsers,
      recentActivity: recentActivity||[], recentPageViews: (recentEvents||[]).length, totalShares: shareCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Menu Categories ───────────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('menu_categories').select('*').order('display_order');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const { data, error } = await supabase.from('menu_categories').insert({
      name: b.name?.trim(), slug: b.slug?.trim()||b.name?.toLowerCase().replace(/\s+/g,'-'),
      description: b.description?.trim()||'', display_order: parseInt(b.display_order)||0
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logActivity('content_created','category',data.id,`Category "${data.name}" created`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const { data, error } = await supabase.from('menu_categories').update({
      name: b.name?.trim(), slug: b.slug?.trim(), description: b.description?.trim()||'',
      display_order: parseInt(b.display_order)||0, is_active: b.is_active !== false && b.is_active !== 'false',
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logActivity('content_updated','category',data.id,`Category "${data.name}" updated`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('menu_categories').update({ is_active:false, updated_at:new Date().toISOString() }).eq('id',req.params.id).select().single();
    await logActivity('content_disabled','category',req.params.id,`Category disabled`);
    res.json({ ok:true, data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Menu Items ────────────────────────────────────────────────────────────────
app.get('/api/menu', async (req, res) => {
  try {
    const { data, error } = await supabase.from('menu_items')
      .select('*, menu_categories(name, slug)')
      .order('display_order');
    if (error) throw error;
    const items = (data||[]).map(item => ({
      id: item.id, name: item.name, description: item.description,
      category: item.menu_categories?.slug || '',
      categoryId: item.category_id, categoryName: item.menu_categories?.name || '',
      price: item.price, priceTiers: item.price_tiers || [],
      available: item.is_available, seasonal: item.is_seasonal, featured: item.is_featured,
      image: item.image_url, imageAlt: item.image_alt,
      displayOrder: item.display_order, tags: item.tags || []
    }));
    res.json(items);
  } catch (err) {
    // Fallback to JSON
    res.json(await readJSON(MENU_FILE, []));
  }
});

app.post('/api/menu', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const b = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (b.existingImage||'');
    const { data, error } = await supabase.from('menu_items').insert({
      category_id: b.categoryId||null, name: b.name?.trim()||'',
      description: b.description?.trim()||'', price: b.price?.trim()||'',
      price_tiers: b.priceTiers ? JSON.parse(b.priceTiers) : [],
      image_url: imageUrl, image_alt: b.imageAlt?.trim()||b.name?.trim()||'',
      is_available: b.available !== 'false', is_seasonal: b.seasonal === 'true',
      is_featured: b.featured === 'true',
      display_order: parseInt(b.displayOrder)||0
    }).select('*, menu_categories(name, slug)').single();
    if (error) throw error;
    await logActivity('content_created','menu_item',data.id,`Menu item "${data.name}" created`);
    res.json({ ...data, category: data.menu_categories?.slug||'', available: data.is_available,
      seasonal: data.is_seasonal, image: data.image_url, imageAlt: data.image_alt,
      priceTiers: data.price_tiers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/menu/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const b = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (b.existingImage||'');
    const { data, error } = await supabase.from('menu_items').update({
      category_id: b.categoryId||null, name: b.name?.trim(),
      description: b.description?.trim()||'', price: b.price?.trim()||'',
      price_tiers: b.priceTiers ? JSON.parse(b.priceTiers) : [],
      image_url: imageUrl, image_alt: b.imageAlt?.trim()||b.name?.trim()||'',
      is_available: b.available !== 'false', is_seasonal: b.seasonal === 'true',
      is_featured: b.featured === 'true',
      display_order: parseInt(b.displayOrder)||0,
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select('*, menu_categories(name, slug)').single();
    if (error) throw error;
    await logActivity('content_updated','menu_item',data.id,`Menu item "${data.name}" updated`);
    res.json({ ...data, category: data.menu_categories?.slug||'', available: data.is_available,
      seasonal: data.is_seasonal, image: data.image_url, imageAlt: data.image_alt,
      priceTiers: data.price_tiers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/menu/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('menu_items').select('name').eq('id',req.params.id).single();
    await supabase.from('menu_items').update({ is_available:false, updated_at:new Date().toISOString() }).eq('id',req.params.id);
    await logActivity('content_disabled','menu_item',req.params.id,`Menu item "${data?.name}" disabled`);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Specials ──────────────────────────────────────────────────────────────────
app.get('/api/specials', async (req, res) => {
  try {
    const { data, error } = await supabase.from('specials').select('*').order('display_order');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data||[]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/specials', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const { data, error } = await supabase.from('specials').insert({
      title: b.title?.trim(), description: b.description?.trim()||'',
      image_url: b.image_url||'', start_date: b.start_date||null, end_date: b.end_date||null,
      is_active: b.is_active !== false && b.is_active !== 'false',
      display_order: parseInt(b.display_order)||0,
      cta_label: b.cta_label||'', cta_url: b.cta_url||''
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logActivity('content_created','special',data.id,`Special "${data.title}" created`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/specials/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const { data, error } = await supabase.from('specials').update({
      title: b.title?.trim(), description: b.description?.trim()||'',
      image_url: b.image_url||'', start_date: b.start_date||null, end_date: b.end_date||null,
      is_active: b.is_active !== false && b.is_active !== 'false',
      display_order: parseInt(b.display_order)||0,
      cta_label: b.cta_label||'', cta_url: b.cta_url||'',
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logActivity('content_updated','special',data.id,`Special "${data.title}" updated`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/specials/:id', requireAuth, async (req, res) => {
  try {
    await supabase.from('specials').update({ is_active:false, updated_at:new Date().toISOString() }).eq('id',req.params.id);
    await logActivity('content_disabled','special',req.params.id,'Special disabled');
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Site Settings ─────────────────────────────────────────────────────────────
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('site_settings').select('*').maybeSingle();
    res.json(data || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const { data: existing } = await supabase.from('site_settings').select('id').maybeSingle();
    const payload = {
      site_name: b.site_name, tagline: b.tagline, description: b.description,
      primary_phone: b.primary_phone, secondary_phone: b.secondary_phone||'',
      whatsapp: b.whatsapp, email: b.email||'',
      address_line1: b.address_line1, address_city: b.address_city,
      google_maps_url: b.google_maps_url||'',
      hero_heading: b.hero_heading, hero_heading_span: b.hero_heading_span,
      hero_subheading: b.hero_subheading, hero_image_url: b.hero_image_url||'',
      opening_hours: b.opening_hours||[],
      facebook_url: b.facebook_url||'', instagram_url: b.instagram_url||'',
      tiktok_url: b.tiktok_url||'', whatsapp_url: b.whatsapp_url||'',
      updated_at: new Date().toISOString()
    };
    let result;
    if (existing?.id) {
      result = await supabase.from('site_settings').update(payload).eq('id',existing.id).select().single();
    } else {
      result = await supabase.from('site_settings').insert(payload).select().single();
    }
    if (result.error) throw result.error;
    await logActivity('content_updated','site_settings',result.data.id,'Site settings updated');
    res.json(result.data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/hero-image', requireAuth, memUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const filename = `hero-${Date.now()}.webp`;
    await sharp(req.file.buffer).resize({ width:1400, withoutEnlargement:true }).webp({ quality:82 }).toFile(path.join(UPLOADS_DIR,filename));
    const imageUrl = `uploads/${filename}`;
    const { data: existing } = await supabase.from('site_settings').select('id').maybeSingle();
    if (existing?.id) {
      await supabase.from('site_settings').update({ hero_image_url:imageUrl, updated_at:new Date().toISOString() }).eq('id',existing.id);
    }
    res.json({ ok:true, image:imageUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Website Sections ──────────────────────────────────────────────────────────
app.get('/api/sections', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('website_sections').select('*').order('display_order');
    res.json(data||[]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/sections/:key', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const { data: existing } = await supabase.from('website_sections').select('id').eq('section_key',req.params.key).maybeSingle();
    const payload = { section_key:req.params.key, title:b.title||'', subtitle:b.subtitle||'',
      body:b.body||'', button_label:b.button_label||'', button_url:b.button_url||'',
      image_url:b.image_url||'', display_order:parseInt(b.display_order)||0,
      is_active:b.is_active!==false, metadata:b.metadata||{}, updated_at:new Date().toISOString() };
    let result;
    if (existing?.id) {
      result = await supabase.from('website_sections').update(payload).eq('id',existing.id).select().single();
    } else {
      result = await supabase.from('website_sections').insert(payload).select().single();
    }
    if (result.error) return res.status(500).json({ error: result.error.message });
    await logActivity('content_updated','section',req.params.key,`Section "${req.params.key}" updated`);
    res.json(result.data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Social Links ──────────────────────────────────────────────────────────────
app.get('/api/social-links', async (req, res) => {
  try {
    const { data } = await supabase.from('social_links').select('*').order('display_order');
    res.json(data||[]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/social-links', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const { data, error } = await supabase.from('social_links').insert({
      platform:b.platform?.trim(), url:b.url?.trim(), label:b.label?.trim()||'',
      display_order:parseInt(b.display_order)||0
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/social-links/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const { data, error } = await supabase.from('social_links').update({
      platform:b.platform?.trim(), url:b.url?.trim(), label:b.label?.trim()||'',
      display_order:parseInt(b.display_order)||0,
      is_active:b.is_active!==false && b.is_active!=='false'
    }).eq('id',req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/social-links/:id', requireAuth, async (req, res) => {
  try {
    await supabase.from('social_links').delete().eq('id',req.params.id);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Gallery / Media Assets ────────────────────────────────────────────────────
app.get('/api/gallery', async (req, res) => {
  try {
    const { data, error } = await supabase.from('media_assets').select('*').eq('usage_type','gallery').order('display_order');
    if (error) throw error;
    res.json((data||[]).map(a => ({ id:a.id, filename:a.file_name, src:a.file_url, caption:a.caption||a.alt_text||'' })));
  } catch {
    res.json(await readJSON(GALLERY_FILE, []));
  }
});

app.post('/api/gallery', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const { data, error } = await supabase.from('media_assets').insert({
      file_name: req.file.filename, file_url: `/uploads/${req.file.filename}`,
      file_type: 'image', caption: req.body.caption?.trim()||'',
      alt_text: req.body.caption?.trim()||'', usage_type: 'gallery'
    }).select().single();
    if (error) throw error;
    res.json({ id:data.id, filename:data.file_name, src:data.file_url, caption:data.caption });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/gallery/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('media_assets').update({
      caption: req.body.caption?.trim()||'', alt_text: req.body.caption?.trim()||'',
      updated_at: new Date().toISOString()
    }).eq('id',req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ id:data.id, filename:data.file_name, src:data.file_url, caption:data.caption });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/gallery/:id', requireAuth, async (req, res) => {
  try {
    const { data: item } = await supabase.from('media_assets').select('file_url,file_name').eq('id',req.params.id).single();
    if (item?.file_url?.startsWith('/uploads/') && item?.file_name) {
      try { await unlink(path.join(UPLOADS_DIR, item.file_name)); } catch {}
    }
    await supabase.from('media_assets').delete().eq('id',req.params.id);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin Users ───────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('admin_user_profiles')
      .select('id, first_name, last_name, email, role, status, last_login, notes, created_at, updated_at')
      .order('created_at');
    res.json(data||[]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const passwordFields = b.password_hash && b.password_salt
      ? { password_hash: b.password_hash, password_salt: b.password_salt, password_updated_at: b.password_updated_at || new Date().toISOString() }
      : await createPasswordCredential(b.password || '');
    const { data, error } = await supabase.from('admin_user_profiles').insert({
      first_name:b.first_name?.trim()||'', last_name:b.last_name?.trim()||'',
      email:b.email?.trim()?.toLowerCase(), role:b.role||'staff', status:b.status||'active',
      notes:b.notes?.trim()||'', ...passwordFields
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logActivity('user_created','user',data.id,`Admin user "${data.email}" added`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const passwordFields = b.password_hash && b.password_salt
      ? { password_hash: b.password_hash, password_salt: b.password_salt, password_updated_at: b.password_updated_at || new Date().toISOString() }
      : (b.password ? await createPasswordCredential(b.password) : {});
    const { data, error } = await supabase.from('admin_user_profiles').update({
      first_name:b.first_name?.trim()||'', last_name:b.last_name?.trim()||'',
      email:b.email?.trim()?.toLowerCase(), role:b.role||'staff',
      status:b.status||'active', notes:b.notes?.trim()||'',
      updated_at: new Date().toISOString(), ...passwordFields
    }).eq('id',req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logActivity('user_updated','user',data.id,`Admin user "${data.email}" updated`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('admin_user_profiles').update({
      status:'disabled', updated_at:new Date().toISOString()
    }).eq('id',req.params.id).select().single();
    await logActivity('user_disabled','user',req.params.id,`Admin user disabled`);
    res.json({ ok:true, data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
app.post('/api/analytics/event', async (req, res) => {
  try {
    const { event_type, page_path, referrer, visitor_id, metadata } = req.body;
    if (!event_type) return res.status(400).json({ error: 'event_type required' });
    await supabase.from('analytics_events').insert({
      event_type, page_path: page_path||'/', referrer: referrer||'',
      user_agent: req.headers['user-agent']?.slice(0,500)||'',
      visitor_id: visitor_id||'', metadata: metadata||{}
    });
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/analytics', requireAuth, async (req, res) => {
  try {
    const range = req.query.range || '7d';
    let since;
    const now = new Date();
    if (range === 'today') { since = new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString(); }
    else if (range === '7d') { since = new Date(now - 7*24*60*60*1000).toISOString(); }
    else if (range === '30d') { since = new Date(now - 30*24*60*60*1000).toISOString(); }
    // else 'all' → no filter

    let query = supabase.from('analytics_events').select('event_type,page_path,visitor_id,created_at,metadata');
    if (since) query = query.gte('created_at', since);
    const { data: events } = await query.order('created_at', { ascending:false });
    const all = events || [];

    const pageViews = all.filter(e => e.event_type === 'page_view');
    const shareClicks = all.filter(e => e.event_type === 'social_share_click');
    const uniqueVisitors = new Set(pageViews.map(e => e.visitor_id).filter(Boolean)).size;

    const pageCounts = {};
    pageViews.forEach(e => { pageCounts[e.page_path || '/'] = (pageCounts[e.page_path||'/']||0)+1; });
    const topPages = Object.entries(pageCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([path,count])=>({path,count}));

    const fbShares = shareClicks.filter(e=>e.metadata?.platform==='facebook').length;
    const waShares = shareClicks.filter(e=>e.metadata?.platform==='whatsapp').length;

    // Traffic by day (last 14 days max)
    const dayCounts = {};
    pageViews.forEach(e => {
      const day = e.created_at?.slice(0,10);
      if (day) dayCounts[day] = (dayCounts[day]||0)+1;
    });
    const trafficByDay = Object.entries(dayCounts).sort().slice(-14).map(([date,count])=>({date,count}));

    res.json({ totalPageViews: pageViews.length, uniqueVisitors, totalShares: shareClicks.length,
      fbShares, waShares, topPages, trafficByDay,
      recentEvents: all.slice(0,20) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Activity Log ──────────────────────────────────────────────────────────────
app.get('/api/activity-log', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('admin_activity_log').select('*').order('created_at',{ascending:false}).limit(50);
    res.json(data||[]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Seed on startup ──────────────────────────────────────────────────────────
async function seedIfEmpty() {
  try {
    const { count: catCount } = await supabase.from('menu_categories').select('*',{count:'exact',head:true});
    if (catCount > 0) return;

    const cmsData = await readJSON(CMS_FILE, DEFAULT_CMS);
    const menuData = await readJSON(MENU_FILE, []);
    const galleryData = await readJSON(GALLERY_FILE, []);

    // site_settings
    const { count: settingsCount } = await supabase.from('site_settings').select('*',{count:'exact',head:true});
    if (settingsCount === 0) {
      await supabase.from('site_settings').insert({
        primary_phone: cmsData.contact?.phone||'(242) 603-2487',
        whatsapp: cmsData.contact?.whatsapp||'(242) 825-2983',
        email: cmsData.contact?.email||'',
        address_line1: cmsData.contact?.addressLine1||'Shirley Street',
        address_city: cmsData.contact?.addressCity||'Nassau, Bahamas',
        hero_heading: cmsData.hero?.heading||'Fresh bites.',
        hero_heading_span: cmsData.hero?.headingSpan||'Friendly bytes.',
        hero_subheading: cmsData.hero?.subheading||'',
        hero_image_url: cmsData.hero?.image||'',
        opening_hours: cmsData.hours || DEFAULT_CMS.hours
      });
    }

    // categories
    const catDefs = [
      { name:'Breakfast', slug:'breakfast', display_order:1 },
      { name:'Sandwiches, Wraps & Burgers', slug:'sandwiches-wraps-burgers', display_order:2 },
      { name:'Chicken Wings', slug:'chicken-wings', display_order:3 },
      { name:'Lunch', slug:'lunch', display_order:4 },
      { name:'Sides & Salads', slug:'sides-salads', display_order:5 }
    ];
    const { data: cats } = await supabase.from('menu_categories').insert(catDefs).select();
    const catIdMap = {};
    for (const c of (cats||[])) catIdMap[c.slug] = c.id;

    // menu items
    if (menuData.length) {
      const items = menuData.map((item, i) => ({
        category_id: catIdMap[item.category]||null,
        name: item.name, description: item.description||'', price: item.price||'',
        price_tiers: item.priceTiers||[], image_url: item.image||'',
        image_alt: item.imageAlt||item.name, is_available: item.available!==false,
        is_seasonal: item.seasonal===true, display_order: i
      }));
      await supabase.from('menu_items').insert(items);
    }

    // social links
    await supabase.from('social_links').insert([
      { platform:'facebook',  url:'https://www.facebook.com/bitsbytescafe',  label:'@bitsbytescafe', display_order:1 },
      { platform:'instagram', url:'https://www.instagram.com/bitsbytescafe', label:'@bitsbytescafe', display_order:2 },
      { platform:'tiktok',    url:'https://www.tiktok.com/@bitsandbytes242', label:'@bitsandbytes242', display_order:3 }
    ]);

    // gallery → media_assets
    if (galleryData.length) {
      await supabase.from('media_assets').insert(galleryData.map((g,i) => ({
        file_name: g.filename||'', file_url: g.src||'', file_type:'image',
        caption: g.caption||'', alt_text: g.caption||'', usage_type:'gallery', display_order:i
      })));
    }

    // initial admin user profile
    await supabase.from('admin_user_profiles').insert({
      first_name:'Admin', last_name:'', email:'admin@bitsbytes.local', role:'admin', status:'active'
    });

    console.log('Seeded initial data from JSON files');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

const PORT = process.env.PORT || 3000;

// ── Catch-all for unknown /api routes — always returns JSON, never HTML ─────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.baseUrl}${req.path}` });
});

// Global error handler — ensures all unhandled errors return JSON, not HTML
app.use((err, req, res, next) => {
  console.error('Unhandled route error:', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Startup validation
if (!SUPABASE_URL) {
  console.error('WARNING: SUPABASE_URL is not set. Database operations will fail.');
}

app.listen(PORT, async () => {
  console.log(`Bits & Bytes CMS running on port ${PORT}`);
  console.log(`Supabase: ${SUPABASE_URL ? 'configured' : 'NOT CONFIGURED'}`);
  await seedIfEmpty();
});
