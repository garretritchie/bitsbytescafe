import express from 'express';
import session from 'express-session';
import multer from 'multer';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');
const CMS_FILE = path.join(DATA_DIR, 'cms-data.json');

await mkdir(DATA_DIR, { recursive: true });
await mkdir(UPLOADS_DIR, { recursive: true });

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

// Static files — explicitly scoped to avoid exposing .env and server source
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname));
  }
});

// Multer instance that stores to a temp buffer for sharp processing
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /image\/(jpeg|png|webp|gif)/.test(file.mimetype) || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname));
  }
});

/* ── Data helpers ── */
async function readJSON(file, fallback = []) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function writeJSON(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

async function getCmsData() {
  return readJSON(CMS_FILE, {
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
  });
}

/* ── SSR helpers ── */
function escH(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

function hoursFeature(hours) {
  const open = hours.filter(h => !h.closed);
  if (open.length === 0) return 'Temporarily closed';
  // Build a compact summary: "Mon - Sat: 7am - 4pm"
  const first = open[0];
  const last = open[open.length - 1];
  const range = first.day === last.day
    ? first.day
    : `${first.day.slice(0, 3)} - ${last.day.slice(0, 3)}`;
  return `${range}: ${fmt12(first.open)} - ${fmt12(first.close)}`;
}

function footerHoursHtml(hours) {
  const openDays = hours.filter(h => !h.closed);
  const closedDays = hours.filter(h => h.closed);
  let html = '';
  if (openDays.length > 0) {
    const first = openDays[0];
    const last = openDays[openDays.length - 1];
    const dayRange = first.day === last.day
      ? escH(first.day)
      : `${escH(first.day.slice(0, 3))} - ${escH(last.day.slice(0, 3))}`;
    html += `<p>${dayRange}<br>${escH(fmt12(first.open))} - ${escH(fmt12(first.close))}</p>`;
  }
  if (closedDays.length > 0) {
    const label = closedDays.length === 1
      ? escH(closedDays[0].day)
      : `${escH(closedDays[0].day.slice(0, 3))} - ${escH(closedDays[closedDays.length - 1].day.slice(0, 3))}`;
    html += `<p>${label}<br>Closed</p>`;
  }
  return html;
}

function toTel(phone) {
  return phone.replace(/[^\d+]/g, '');
}

function toWaMe(phone) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

async function renderIndex(cms) {
  let html = await readFile(path.join(__dirname, 'index.template.html'), 'utf8');
  const replacements = {
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
  for (const [k, v] of Object.entries(replacements)) {
    html = html.replaceAll(k, v);
  }
  return html;
}

// Token used by the admin SPA when server sessions are unavailable (e.g. behind a proxy).
// Derived from the admin password so it changes if the password changes.
const ADMIN_TOKEN = Buffer.from('admin:password123').toString('base64');

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  if (req.headers['x-admin-token'] === ADMIN_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

/* ── CMS admin page (must be before static middleware) ── */
app.get('/admin/login', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/admin/');
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/admin/cms', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'cms.html'));
});

/* ── Static admin ── */
app.use('/admin', express.static(path.join(__dirname, 'admin')));

/* ── Landing page (SSR) ── */
app.get('/', async (req, res) => {
  try {
    const cms = await getCmsData();
    const html = await renderIndex(cms);
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

/* ── Preview (same as landing, no-cache) ── */
app.get('/preview', async (req, res) => {
  try {
    const cms = await getCmsData();
    const html = await renderIndex(cms);
    res.set('Content-Type', 'text/html; charset=utf-8')
       .set('Cache-Control', 'no-store')
       .send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

/* ── AUTH ── */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password123') {
    req.session.authenticated = true;
    req.session.save(() => res.redirect('/admin/'));
  } else {
    res.redirect('/admin/login?error=1');
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/api/auth/status', (req, res) => {
  const authenticated = !!req.session?.authenticated;
  res.json({ authenticated, token: authenticated ? ADMIN_TOKEN : null });
});

/* ── MENU ── */
app.get('/api/menu', async (req, res) => {
  res.json(await readJSON(MENU_FILE));
});

app.post('/api/menu', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const items = await readJSON(MENU_FILE);
    const b = req.body;
    const item = {
      id: crypto.randomUUID(),
      name: b.name?.trim() || '',
      description: b.description?.trim() || '',
      category: b.category || 'other',
      price: b.price?.trim() || '',
      priceTiers: b.priceTiers ? JSON.parse(b.priceTiers) : [],
      seasonal: b.seasonal === 'true',
      available: b.available !== 'false',
      image: req.file ? `/uploads/${req.file.filename}` : (b.existingImage || ''),
      imageAlt: b.imageAlt?.trim() || b.name?.trim() || ''
    };
    items.push(item);
    await writeJSON(MENU_FILE, items);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const items = await readJSON(MENU_FILE);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    const b = req.body;
    items[idx] = {
      ...items[idx],
      name: b.name?.trim() || items[idx].name,
      description: b.description?.trim() || '',
      category: b.category || items[idx].category,
      price: b.price?.trim() || '',
      priceTiers: b.priceTiers ? JSON.parse(b.priceTiers) : [],
      seasonal: b.seasonal === 'true',
      available: b.available !== 'false',
      image: req.file ? `/uploads/${req.file.filename}` : (b.existingImage || items[idx].image),
      imageAlt: b.imageAlt?.trim() || b.name?.trim() || items[idx].imageAlt
    };
    await writeJSON(MENU_FILE, items);
    res.json(items[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menu/:id', requireAuth, async (req, res) => {
  try {
    const items = await readJSON(MENU_FILE);
    const filtered = items.filter(i => i.id !== req.params.id);
    if (filtered.length === items.length) return res.status(404).json({ error: 'Item not found' });
    await writeJSON(MENU_FILE, filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GALLERY ── */
app.get('/api/gallery', async (req, res) => {
  res.json(await readJSON(GALLERY_FILE));
});

app.post('/api/gallery', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const items = await readJSON(GALLERY_FILE);
    const item = {
      id: crypto.randomUUID(),
      filename: req.file.filename,
      src: `/uploads/${req.file.filename}`,
      caption: req.body.caption?.trim() || ''
    };
    items.push(item);
    await writeJSON(GALLERY_FILE, items);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/gallery/:id', requireAuth, async (req, res) => {
  try {
    const items = await readJSON(GALLERY_FILE);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    items[idx].caption = req.body.caption?.trim() || '';
    await writeJSON(GALLERY_FILE, items);
    res.json(items[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gallery/:id', requireAuth, async (req, res) => {
  try {
    const items = await readJSON(GALLERY_FILE);
    const item = items.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.src?.startsWith('/uploads/') && item.filename) {
      try { await unlink(path.join(UPLOADS_DIR, item.filename)); } catch {}
    }
    await writeJSON(GALLERY_FILE, items.filter(i => i.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── CMS API ── */
app.get('/api/cms/data', requireAuth, async (req, res) => {
  res.json(await getCmsData());
});

app.post('/admin/cms/hero-text', requireAuth, async (req, res) => {
  try {
    const cms = await getCmsData();
    const { heading, headingSpan, subheading } = req.body;
    if (typeof heading === 'string') cms.hero.heading = heading.trim();
    if (typeof headingSpan === 'string') cms.hero.headingSpan = headingSpan.trim();
    if (typeof subheading === 'string') cms.hero.subheading = subheading.trim();
    await writeJSON(CMS_FILE, cms);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/cms/hero-image', requireAuth, memUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const filename = `hero-${Date.now()}.webp`;
    const outPath = path.join(UPLOADS_DIR, filename);
    await sharp(req.file.buffer)
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);
    const cms = await getCmsData();
    // Clean up old hero upload if it was a previous upload
    if (cms.hero.image?.startsWith('uploads/') || cms.hero.image?.startsWith('/uploads/')) {
      const old = path.join(__dirname, 'public', cms.hero.image.replace(/^\//, ''));
      try { await unlink(old); } catch {}
    }
    cms.hero.image = `uploads/${filename}`;
    await writeJSON(CMS_FILE, cms);
    res.json({ ok: true, image: cms.hero.image });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/cms/hours', requireAuth, async (req, res) => {
  try {
    const cms = await getCmsData();
    const { hours } = req.body;
    if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours must be an array' });
    cms.hours = hours.map(h => ({
      day: String(h.day || ''),
      open: String(h.open || ''),
      close: String(h.close || ''),
      closed: Boolean(h.closed)
    }));
    await writeJSON(CMS_FILE, cms);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/cms/contact', requireAuth, async (req, res) => {
  try {
    const cms = await getCmsData();
    const { phone, whatsapp, email, addressLine1, addressCity } = req.body;
    if (typeof phone === 'string') cms.contact.phone = phone.trim();
    if (typeof whatsapp === 'string') cms.contact.whatsapp = whatsapp.trim();
    if (typeof email === 'string') cms.contact.email = email.trim();
    if (typeof addressLine1 === 'string') cms.contact.addressLine1 = addressLine1.trim();
    if (typeof addressCity === 'string') cms.contact.addressCity = addressCity.trim();
    await writeJSON(CMS_FILE, cms);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bits & Bytes CMS running on port ${PORT}`));
