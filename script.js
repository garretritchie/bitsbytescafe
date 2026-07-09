/* ── SHARED STATE ── */
const lightbox = document.querySelector('.lightbox');
const lightboxImage = document.querySelector('.lightbox img');
const lightboxClose = document.querySelector('.lightbox-close');
const menuModal = document.querySelector('.menu-modal');
const menuModalClose = document.querySelector('.menu-modal-close');
const menuModalImage = document.querySelector('.menu-modal-image');
const menuModalCategory = document.querySelector('.menu-modal-category');
const menuModalTitle = document.querySelector('#menu-modal-title');
const menuModalDescription = document.querySelector('.menu-modal-description');
const menuModalPrice = document.querySelector('.menu-modal-price');
const currentYear = document.querySelector('[data-current-year]');
const backToTop = document.querySelector('.back-to-top');
const MENU_IMAGE_FALLBACK = 'images/menu-photo-unavailable.svg';
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const CATEGORY_LABELS = {
  'breakfast': 'Breakfast',
  'sandwiches-wraps-burgers': 'Sandwiches, Wraps & Burgers',
  'chicken-wings': 'Chicken Wings',
  'lunch': 'Lunch',
  'sides-salads': 'Sides & Salads',
  'other': 'Other'
};
const CATEGORY_TEASERS = {
  'breakfast': 'Morning plates, omelets, pancakes, French toast, and breakfast sandwiches.',
  'sandwiches-wraps-burgers': 'Sandwiches, wraps, subs, burgers, and hearty handheld favorites.',
  'chicken-wings': 'Plain or flavored wings by size, plus dinner options.',
  'lunch': 'Main dishes, dinner plates, seafood, vegetarian plates, and a la carte lunch options.',
  'sides-salads': 'Rice, baked macaroni, fries, plantains, side salads, garden salads, and more.'
};

if (currentYear) currentYear.textContent = new Date().getFullYear();

/* ── ANALYTICS ── */
function getVisitorId() {
  let id = localStorage.getItem('bbc_vid');
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bbc_vid', id); }
  return id;
}

function trackEvent(eventType, metadata = {}) {
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: eventType,
      page_path: window.location.pathname,
      referrer: document.referrer || '',
      visitor_id: getVisitorId(),
      metadata
    })
  }).catch(() => {});
}

trackEvent('page_view');

document.querySelectorAll('[data-share-platform]').forEach(link => {
  link.addEventListener('click', () => {
    const platform = link.getAttribute('data-share-platform');
    trackEvent('social_share_click', { platform });
  });
});


/* ── LIGHTBOX ── */
function openLightbox(src, alt) {
  lightboxImage.src = src;
  lightboxImage.alt = alt || 'Bits and Bytes Cafe photo';
  lightbox.hidden = false;
  lightboxClose.focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.src = TRANSPARENT_PIXEL;
  lightboxImage.alt = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  if (e.key === 'Escape' && !menuModal.hidden) closeMenuModal();
});

function formatPriceHtml(price) {
  const text = String(price || '');
  const match = text.match(/^(.*?)(\s*\+\s*VAT)$/i);
  if (!match) return escHtml(text);
  return `${escHtml(match[1].trim())} <sup>+ VAT</sup>`;
}

function shortDescription(description) {
  const text = String(description || '').trim();
  if (!text) return '';
  const firstSentence = text.match(/^[^.!?]+[.!?]/);
  return firstSentence ? firstSentence[0] : text;
}

function openMenuModal(item) {
  const imgSrc = assetUrl(item.image || MENU_IMAGE_FALLBACK);
  const imgAlt = item.image ? (item.imageAlt || item.name) : 'Photo Unavailable';
  menuModalImage.src = imgSrc;
  menuModalImage.alt = imgAlt;
  menuModalCategory.textContent = CATEGORY_LABELS[item.category] || item.category || 'Menu';
  menuModalTitle.textContent = item.name;
  menuModalDescription.textContent = item.description || 'Ask our team for current options and availability.';
  menuModalPrice.innerHTML = formatPriceHtml(formatPrice(item));
  menuModal.hidden = false;
  menuModalClose.focus();
}

function closeMenuModal() {
  menuModal.hidden = true;
  menuModalImage.src = TRANSPARENT_PIXEL;
  menuModalImage.alt = '';
}

menuModalClose.addEventListener('click', closeMenuModal);
menuModal.addEventListener('click', (e) => { if (e.target === menuModal) closeMenuModal(); });

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

async function fetchJson(staticUrl, apiUrl) {
  try {
    const res = await fetch(staticUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  } catch {
    const res = await fetch(apiUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API fallback failed ${res.status}`);
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
    if (!categoryOrder.has(item.category)) categoryOrder.set(item.category, categorySortValue(item, categoryOrder.size));
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
function categorySortValue(item, fallback) {
  const order = Number(item.categoryDisplayOrder ?? item.category_display_order);
  return Number.isFinite(order) ? order : fallback;
}

function orderedCategories(items) {
  const categories = new Map();
  items.forEach((item, index) => {
    if (!item.category || categories.has(item.category)) return;
    categories.set(item.category, {
      category: item.category,
      order: categorySortValue(item, index)
    });
  });
  return [...categories.values()]
    .sort((a, b) => a.order - b.order || a.category.localeCompare(b.category))
    .map(({ category }) => category);
}

function orderMenuFilterButtons(items) {
  const filter = document.querySelector('.menu-filter');
  if (!filter) return;
  const buttons = new Map([...filter.querySelectorAll('[data-menu-filter]')].map(btn => [btn.getAttribute('data-menu-filter'), btn]));
  const allButton = buttons.get('all');
  filter.innerHTML = '';
  if (allButton) filter.appendChild(allButton);
  orderedCategories(items).forEach(category => {
    const button = buttons.get(category);
    if (button) filter.appendChild(button);
  });
}

function setupMenuFilter(onChange) {
  const filterButtons = document.querySelectorAll('[data-menu-filter]');

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-menu-filter');
      filterButtons.forEach(b => b.classList.toggle('is-active', b === btn));
      onChange(filter);
    });
  });
}

function minCategoryPrice(items) {
  const prices = items
    .map(item => String(formatPrice(item)).match(/\$(\d+(?:\.\d{2})?)/))
    .filter(Boolean)
    .map(match => Number(match[1]))
    .filter(price => Number.isFinite(price));

  if (prices.length === 0) return '';
  return `Starting at $${Math.min(...prices).toFixed(2)} + VAT`;
}

function categorySummaries(items) {
  return orderedCategories(items)
    .map(category => {
      const categoryItems = items.filter(item => item.category === category);
      if (categoryItems.length === 0) return null;
      const thumbnailItem = categoryItems.find(item => item.image) || categoryItems[0];
      return {
        category,
        count: categoryItems.length,
        price: minCategoryPrice(categoryItems),
        thumbnail: thumbnailItem.image || '',
        thumbnailAlt: thumbnailItem.imageAlt || thumbnailItem.name
      };
    })
    .filter(Boolean);
}

function renderCategoryCards(grid, visible, selectCategory) {
  grid.classList.add('is-category-view');
  grid.innerHTML = categorySummaries(visible).map(summary => {
    const label = CATEGORY_LABELS[summary.category] || summary.category;
    const imgSrc = assetUrl(summary.thumbnail || MENU_IMAGE_FALLBACK);
    const countLabel = summary.count === 1 ? '1 item' : `${summary.count} items`;
    const sizeClass = summary.category === 'breakfast' || summary.category === 'lunch' ? 'category-card-large' : 'category-card-small';
    return `
      <article class="category-card ${sizeClass}" data-category-card="${escHtml(summary.category)}" role="button" tabindex="0" aria-label="View ${escHtml(label)} menu">
        <img src="${escHtml(imgSrc)}" alt="${escHtml(summary.thumbnailAlt || label)}" loading="lazy" class="${summary.thumbnail ? '' : 'menu-fallback-image'}">
        <div>
          <span>${escHtml(countLabel)}</span>
          <h3>${escHtml(label)}</h3>
          <p>${escHtml(CATEGORY_TEASERS[summary.category] || 'Browse this menu category.')}</p>
          <strong>${formatPriceHtml(summary.price)}</strong>
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('[data-category-card]').forEach((card) => {
    const openCategory = () => selectCategory(card.getAttribute('data-category-card'));
    card.addEventListener('click', openCategory);
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openCategory();
    });
  });
}

function renderItemCards(grid, items) {
  grid.classList.remove('is-category-view');
  grid.innerHTML = items.map(item => {
    const price = formatPriceHtml(formatPrice(item));
    const seasonal = item.seasonal
      ? '<span class="seasonal-badge" style="display:inline-block;padding:2px 8px;background:#fff3e8;color:#f36c13;border-radius:999px;font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.4px;margin-top:4px">Seasonal</span>'
      : '';
    const imgSrc = assetUrl(item.image || MENU_IMAGE_FALLBACK);
    const imgAlt = item.image ? (item.imageAlt || item.name) : 'Photo Unavailable';
    const teaser = shortDescription(item.description);
    return `
      <article class="plate-card" data-menu-category="${escHtml(item.category)}" data-menu-detail="${escHtml(item.id)}" role="button" tabindex="0" aria-label="View details for ${escHtml(item.name)}">
        <img src="${escHtml(imgSrc)}" alt="${escHtml(imgAlt)}" loading="lazy" class="${item.image ? '' : 'menu-fallback-image'}">
        <div>
          <h3>${escHtml(item.name)}</h3>
          ${teaser ? `<p>${escHtml(teaser)}</p>` : ''}
          ${seasonal}
        </div>
        <footer>
          <strong>${price}</strong>
          <span class="plate-card-details">Details</span>
        </footer>
      </article>`;
  }).join('');
}

/* ── RENDER MENU ── */
async function renderMenu() {
  const grid = document.querySelector('.popular-grid');
  if (!grid) return;

  try {
    const items = await fetchJson('/data/menu.json', '/api/menu');
    const visible = sortMenuItemsForDisplay(items.filter(i => i.available));

    if (visible.length === 0) {
      grid.innerHTML = '<p style="color:#62666d;font-size:0.9rem;padding:16px 0">Menu coming soon.</p>';
      return;
    }

    const itemMap = new Map(visible.map(item => [String(item.id), item]));
    orderMenuFilterButtons(visible);

    function bindItemCards() {
      grid.querySelectorAll('[data-menu-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = itemMap.get(btn.getAttribute('data-menu-detail'));
          if (item) openMenuModal(item);
        });
        btn.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const item = itemMap.get(btn.getAttribute('data-menu-detail'));
          if (item) openMenuModal(item);
        });
      });
    }

    function selectCategory(category) {
      document.querySelectorAll('[data-menu-filter]').forEach(btn => {
        btn.classList.toggle('is-active', btn.getAttribute('data-menu-filter') === category);
      });
      renderItemCards(grid, visible.filter(item => item.category === category));
      bindItemCards();
    }

    renderCategoryCards(grid, visible, selectCategory);
    setupMenuFilter((filter) => {
      if (filter === 'all') {
        renderCategoryCards(grid, visible, selectCategory);
        return;
      }
      renderItemCards(grid, visible.filter(item => item.category === filter));
      bindItemCards();
    });
  } catch {
    grid.innerHTML = '<p style="color:#62666d;font-size:0.9rem;padding:16px 0">Could not load menu. Please refresh.</p>';
  }
}

/* ── RENDER GALLERY ── */
async function renderGallery() {
  const grid = document.querySelector('.gallery-grid');
  if (!grid) return;

  try {
    const items = await fetchJson('/data/gallery.json', '/api/gallery');

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
