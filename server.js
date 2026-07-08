import express from 'express';
import session from 'express-session';
import multer from 'multer';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');

await mkdir(DATA_DIR, { recursive: true });
await mkdir(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'bbc-cms-local-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

// Static files — explicitly scoped to avoid exposing .env and server source
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
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

async function readJSON(file, fallback = []) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function writeJSON(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// --- AUTH ---
// Default credentials: admin / password123 — change before production
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password123') {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session?.authenticated });
});

// --- MENU ---
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

// --- GALLERY ---
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bits & Bytes CMS running on port ${PORT}`));
