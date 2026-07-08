/* ── SHARED STATE ── */
const lightbox = document.querySelector('.lightbox');
const lightboxImage = document.querySelector('.lightbox img');
const lightboxClose = document.querySelector('.lightbox-close');
const currentYear = document.querySelector('[data-current-year]');
const backToTop = document.querySelector('.back-to-top');
const MENU_IMAGE_FALLBACK = 'images/menu-photo-unavailable.svg';

if (currentYear) currentYear.textContent = new Date().getFullYear();

/* ── LIGHTBOX ── */
function openLightbox(src, alt) {
  lightboxImage.src = src;
  lightboxImage.alt = alt || 'Bits and Bytes Cafe photo';
  lightbox.hidden = false;
  lightboxClose.focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.removeAttribute('src');
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });

backToTop?.addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ── HELPERS ── */
function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPrice(item) {
  if (item.priceTiers && item.priceTiers.length > 0) {
    const prices = item.priceTiers.map(t => parseFloat(t.price)).filter(p => !isNaN(p));
    if (prices.length > 0) return `from $${Math.min(...prices).toFixed(2)}`;
  }
  return item.price || '';
}

async function fetchJson(primaryUrl, fallbackUrl) {
  try {
    const res = await fetch(primaryUrl);
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  } catch {
    const res = await fetch(fallbackUrl);
    if (!res.ok) throw new Error(`Fallback failed ${res.status}`);
    return res.json();
  }
}

function assetUrl(src) {
  if (!src) return '';
  if (/^(https?:|data:|blob:|\/)/.test(src)) return src;
  return src.replace(/^\/+/, '');
}

function sortMenuItemsForDisplay(items) {
  const categoryOrder = new Map();
  items.forEach((item) => {
    if (!categoryOrder.has(item.category)) categoryOrder.set(item.category, categoryOrder.size);
  });

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const categoryDiff = categoryOrder.get(a.item.category) - categoryOrder.get(b.item.category);
      if (categoryDiff !== 0) return categoryDiff;

      const photoDiff = Number(Boolean(b.item.image)) - Number(Boolean(a.item.image));
      if (photoDiff !== 0) return photoDiff;

      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/* ── MENU FILTER ── */
function setupMenuFilter() {
  const filterButtons = document.querySelectorAll('[data-menu-filter]');
  const cards = document.querySelectorAll('[data-menu-category]');

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-menu-filter');
      filterButtons.forEach(b => b.classList.toggle('is-active', b === btn));
      cards.forEach((card) => {
        const cat = card.getAttribute('data-menu-category');
        card.hidden = filter !== 'all' && cat !== filter;
      });
    });
  });
}

/* ── RENDER MENU ── */
async function renderMenu() {
  const grid = document.querySelector('.popular-grid');
  if (!grid) return;

  try {
    const items = await fetchJson('/api/menu', '/data/menu.json');
    const visible = sortMenuItemsForDisplay(items.filter(i => i.available));

    if (visible.length === 0) {
      grid.innerHTML = '<p style="color:#62666d;font-size:0.9rem;padding:16px 0">Menu coming soon.</p>';
      return;
    }

    grid.innerHTML = visible.map(item => {
      const price = escHtml(formatPrice(item));
      const seasonal = item.seasonal
        ? '<span class="seasonal-badge" style="display:inline-block;padding:2px 8px;background:#fff3e8;color:#f36c13;border-radius:999px;font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.4px;margin-top:4px">Seasonal</span>'
        : '';
      const imgSrc = assetUrl(item.image || MENU_IMAGE_FALLBACK);
      const imgAlt = item.image ? (item.imageAlt || item.name) : 'Photo Unavailable';
      return `
        <article class="plate-card" data-menu-category="${escHtml(item.category)}">
          <img src="${escHtml(imgSrc)}" alt="${escHtml(imgAlt)}" loading="lazy" class="${item.image ? '' : 'menu-fallback-image'}">
          <div>
            <h3>${escHtml(item.name)}</h3>
            ${item.description ? `<p>${escHtml(item.description)}</p>` : ''}
            ${seasonal}
          </div>
          <strong>${price}</strong>
        </article>`;
    }).join('');

    setupMenuFilter();
  } catch {
    grid.innerHTML = '<p style="color:#62666d;font-size:0.9rem;padding:16px 0">Could not load menu. Please refresh.</p>';
  }
}

/* ── RENDER GALLERY ── */
async function renderGallery() {
  const grid = document.querySelector('.gallery-grid');
  if (!grid) return;

  try {
    const items = await fetchJson('/api/gallery', '/data/gallery.json');

    if (items.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = items.map(item => `
      <button type="button" data-photo="${escHtml(assetUrl(item.src))}">
        <img src="${escHtml(assetUrl(item.src))}" alt="${escHtml(item.caption || 'Bits and Bytes Cafe photo')}" loading="lazy">
      </button>`).join('');

    grid.querySelectorAll('[data-photo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const src = btn.getAttribute('data-photo');
        const img = btn.querySelector('img');
        openLightbox(src, img?.alt);
      });
    });
  } catch {
    // Fail silently — gallery is non-critical
  }
}

/* ── INIT ── */
renderMenu();
renderGallery();
