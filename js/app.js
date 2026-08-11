/**
 * app.js — CyberGear application entry point
 */

import { store }                                  from './modules/store.js';
import { initCatalog, getFilteredProducts }       from './modules/catalog.js';
import { initCart }                               from './modules/cart.js';
import { initCheckout }                           from './modules/checkout.js';
import { $$, debounce }                           from './utils/helpers.js';
import PRODUCTS                                   from './data/products.js';

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initCatalog();
  initCart();
  initCheckout();
  
  initStickyHeader();
  initPriceRangeSlider();
  initFilters();
  initFilterGroupToggles();
  initSortSelect();
  initViewToggle();
  initCartToggle();
  initSearchToggle();
  initNavCategories();
  initFiltersDrawer();
  initCategoryCounters();
  initConnectivityCounters();
  initAddToCartToast();

  console.info('[CyberGear] App initialized ✓');
});

// --------------------------------------------------------------------------
// 1. STICKY HEADER
// --------------------------------------------------------------------------

function initStickyHeader() {
  const header = document.querySelector('[data-js="header"]');
  if (!header) return;

  let ticking = false;

  function updateHeader() {
    header.classList.toggle('header--scrolled', window.scrollY > 10);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (ticking) return;
    requestAnimationFrame(updateHeader);
    ticking = true;
  }, { passive: true });

  updateHeader();
}

// --------------------------------------------------------------------------
// 2. PRICE RANGE SLIDER
// --------------------------------------------------------------------------

function initPriceRangeSlider() {
  const rangeContainer = document.querySelector('[data-js="price-range"]');
  if (!rangeContainer) return;

  const thumbMin = rangeContainer.querySelector('[data-js="range-min"]');
  const thumbMax = rangeContainer.querySelector('[data-js="range-max"]');
  const fillEl   = rangeContainer.querySelector('[data-js="price-fill"]');
  const inputMin = document.querySelector('[data-js="price-min"]');
  const inputMax = document.querySelector('[data-js="price-max"]');

  if (!thumbMin || !thumbMax || !fillEl) return;

  const PRICE_MIN = 0;
  const PRICE_MAX = 500; // catalog currently tops out at $439 (Audeze Maxwell) — adjust if pricier items are added

  const percentToPrice = (pct) =>
    Math.round(PRICE_MIN + (pct / 100) * (PRICE_MAX - PRICE_MIN));

  const priceToPercent = (price) =>
    Math.round(((price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100);

  function updateSliderUI() {
    let minVal = parseInt(thumbMin.value, 10);
    let maxVal = parseInt(thumbMax.value, 10);
    const GAP  = 1;

    if (minVal >= maxVal - GAP) {
      if (document.activeElement === thumbMin) {
        minVal = maxVal - GAP;
        thumbMin.value = minVal;
      } else {
        maxVal = minVal + GAP;
        thumbMax.value = maxVal;
      }
    }

    fillEl.style.setProperty('--range-min', minVal);
    fillEl.style.setProperty('--range-max', maxVal);

    const priceMin = percentToPrice(minVal);
    const priceMax = percentToPrice(maxVal);
    if (inputMin) inputMin.value = priceMin;
    if (inputMax) inputMax.value = priceMax;
    return { priceMin, priceMax };
  }

  const dispatchToStore = debounce(({ priceMin, priceMax }) => {
    store.setFilters({
      priceMin: priceMin * 100,
      priceMax: priceMax === PRICE_MAX ? Infinity : priceMax * 100,
    });
  }, 200);

  function onThumbInput() {
    const prices = updateSliderUI();
    dispatchToStore(prices);
  }

  thumbMin.addEventListener('input', onThumbInput);
  thumbMax.addEventListener('input', onThumbInput);

  if (inputMin) {
    inputMin.addEventListener('change', () => {
      thumbMin.value = priceToPercent(parseInt(inputMin.value, 10) || PRICE_MIN);
      const prices = updateSliderUI();
      dispatchToStore(prices);
    });
  }

  if (inputMax) {
    inputMax.addEventListener('change', () => {
      thumbMax.value = priceToPercent(parseInt(inputMax.value, 10) || PRICE_MAX);
      const prices = updateSliderUI();
      dispatchToStore(prices);
    });
  }

  updateSliderUI();
}

// --------------------------------------------------------------------------
// 3. FILTERS
// --------------------------------------------------------------------------

function initFilters() {
  const filtersPanel = document.querySelector('[data-js="filters-panel"]');
  if (!filtersPanel) return;

  filtersPanel.addEventListener('change', (e) => {
    const checkbox = e.target.closest('[data-js="filter-checkbox"]');
    if (!checkbox) return;

    const filterType = checkbox.dataset.filter;

    switch (filterType) {
      case 'category':
        handleArrayFilter('categories', checkbox.value, checkbox.checked);
        break;
      case 'connectivity':
        handleArrayFilter('connectivity', checkbox.value, checkbox.checked);
        break;
      case 'rgb':
        store.setFilters({ rgb: checkbox.checked });
        break;
    }
  });

  $$('[data-js="filters-reset"]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.resetFilters();
      syncFiltersUI(); 
    });
  });

  store.subscribe((state) => {
    if (state.filters.categories.length === 0) {
      syncCategoryCheckboxes([]);
    }
  }, 'filters');
}

/**
 * Collapsible filter groups (Price / Category / Connectivity).
 * The HTML/CSS for this already existed (aria-expanded, chevron rotation,
 * max-height transition on .filter-group__body) — it just had no JS behind it.
 */
function initFilterGroupToggles() {
  $$('[data-js="filter-toggle"]').forEach(btn => {
    const body = document.getElementById(btn.getAttribute('aria-controls'));
    if (!body) return;

    // Once an "open" transition finishes, let the body size itself
    // naturally again (so content changes later don't get clipped).
    body.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'max-height' && btn.getAttribute('aria-expanded') === 'true') {
        body.style.maxHeight = 'none';
      }
    });

    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isExpanded));

      if (isExpanded) {
        // Lock in the current rendered height first (in case it's
        // currently 'none'), force a reflow, then collapse to 0 —
        // without the forced reflow the two writes get batched and
        // the transition never gets a starting point to animate from.
        body.style.maxHeight = body.scrollHeight + 'px';
        void body.offsetHeight;
        body.style.maxHeight = '0px';
      } else {
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  });
}

/**
 * Updates an array filter (categories, connectivity).
 */
function handleArrayFilter(filterKey, value, checked) {
  const current = store.getState().filters[filterKey];
  const updated = checked
    ? [...current, value]               
    : current.filter(v => v !== value); 

  store.setFilters({ [filterKey]: updated });
}

function syncFiltersUI() {
  const state = store.getState();

  $$('[data-js="filter-checkbox"]').forEach(input => {
    const filterType = input.dataset.filter;
    if (filterType === 'category') {
      input.checked = state.filters.categories.includes(input.value);
    } else if (filterType === 'connectivity') {
      input.checked = state.filters.connectivity.includes(input.value);
    } else if (filterType === 'rgb') {
      input.checked = state.filters.rgb;
    }
  });
}

function syncCategoryCheckboxes(activeCategories) {
  $$('[data-js="filter-checkbox"][data-filter="category"]').forEach(input => {
    input.checked = activeCategories.includes(input.value);
  });
}

// --------------------------------------------------------------------------
// 4. SORTING
// --------------------------------------------------------------------------

function initSortSelect() {
  const sortSelect = document.querySelector('[data-js="sort-select"]');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', (e) => {
    store.setSortBy(e.target.value);
  });

  sortSelect.value = store.getState().sortBy;
}

// --------------------------------------------------------------------------
// 5. GRID VIEW TOGGLE
// --------------------------------------------------------------------------

function initViewToggle() {
  const gridBtn = document.querySelector('[data-js="view-grid"]');
  const listBtn = document.querySelector('[data-js="view-list"]');
  const grid    = document.querySelector('[data-js="product-grid"]');

  if (!gridBtn || !listBtn || !grid) return;

  function setView(mode) {
    const isGrid = mode === 'grid';

    grid.classList.toggle('catalog__grid--list', !isGrid);

    gridBtn.setAttribute('aria-pressed', String(isGrid));
    listBtn.setAttribute('aria-pressed', String(!isGrid));
    gridBtn.classList.toggle('catalog__view-btn--active', isGrid);
    listBtn.classList.toggle('catalog__view-btn--active', !isGrid);

    store.setUi({ viewMode: mode });
  }

  gridBtn.addEventListener('click', () => setView('grid'));
  listBtn.addEventListener('click', () => setView('list'));
}

// --------------------------------------------------------------------------
// 6. CART TOGGLE
// --------------------------------------------------------------------------

function initCartToggle() {
  const cartBtn    = document.querySelector('[data-js="cart-toggle"]');
  const cartDrawer = document.querySelector('[data-js="cart-drawer"]');
  const cartClose  = document.querySelector('[data-js="cart-close"]');
  const overlay    = document.querySelector('[data-js="overlay"]');
  const cartCount  = document.querySelector('[data-js="cart-count"]');

  if (!cartBtn || !cartDrawer) return;

  store.subscribe((state) => {
    const isOpen = state.ui.cartOpen;
    cartDrawer.hidden      = !isOpen;
    if (overlay) overlay.hidden = !isOpen;
    cartBtn.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
    
    if (isOpen) setTimeout(() => cartClose?.focus(), 50);
    else cartBtn.focus();
  }, 'ui');

  store.subscribe((state) => {
    if (!cartCount) return;
    const count = state.cart.reduce((s, i) => s + i.quantity, 0);

    if (count > 0) {
      cartCount.textContent = count > 99 ? '99+' : count;
      cartCount.hidden      = false;

      cartCount.classList.remove('header__cart-count--updated');
      void cartCount.offsetWidth; 
      cartCount.classList.add('header__cart-count--updated');
      setTimeout(() => cartCount.classList.remove('header__cart-count--updated'), 600);
    } else {
      cartCount.hidden = true;
    }

    cartBtn.setAttribute('aria-label',
      count > 0 ? `Open cart, ${count} items` : 'Open cart'
    );
  }, 'cart');

  cartBtn.addEventListener('click', ()  => store.setUi({ cartOpen: true }));
  cartClose?.addEventListener('click', () => store.setUi({ cartOpen: false }));
  overlay?.addEventListener('click',   () => store.setUi({ cartOpen: false }));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && store.getState().ui.cartOpen) {
      store.setUi({ cartOpen: false });
    }
  });
}

// --------------------------------------------------------------------------
// 7. SEARCH
// --------------------------------------------------------------------------

function initSearchToggle() {
  const searchBtn   = document.querySelector('[data-js="search-toggle"]');
  const searchPanel = document.querySelector('[data-js="search-panel"]');
  const searchInput = document.querySelector('[data-js="search-input"]');
  if (!searchBtn || !searchPanel) return;

  const open = () => {
    searchPanel.hidden = false;
    searchBtn.setAttribute('aria-expanded', 'true');
    store.setUi({ searchOpen: true });
    setTimeout(() => searchInput?.focus(), 50);
  };

  const close = () => {
    searchPanel.hidden = true;
    searchBtn.setAttribute('aria-expanded', 'false');
    store.setUi({ searchOpen: false });
    if (searchInput) searchInput.value = '';
    store.setFilters({ searchQuery: '' });
  };

  searchBtn.addEventListener('click', () =>
    store.getState().ui.searchOpen ? close() : open()
  );

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  searchInput?.addEventListener('input', debounce((e) => {
    store.setFilters({ searchQuery: e.target.value.trim().toLowerCase() });
  }, 300));
}

// --------------------------------------------------------------------------
// 8. NAVIGATION CATEGORIES
// --------------------------------------------------------------------------

function initNavCategories() {
  const navLinks = $$('[data-js="nav-category"]');

  navLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;

      navLinks.forEach(link => {
        const isActive = link === btn;
        link.classList.toggle('header__nav-link--active', isActive);
        link.setAttribute('aria-current', isActive ? 'true' : 'false');
      });

      const newCategories = category === 'all' ? [] : [category];
      syncCategoryCheckboxes(newCategories);

      store.setFilters({ categories: newCategories });
    });
  });
}

// --------------------------------------------------------------------------
// 9. MOBILE FILTERS DRAWER
// --------------------------------------------------------------------------

function initFiltersDrawer() {
  const openBtn      = document.querySelector('[data-js="filters-open"]');
  const closeBtn     = document.querySelector('[data-js="filters-close"]');
  const filtersPanel = document.querySelector('[data-js="filters-panel"]');
  const overlay      = document.querySelector('[data-js="overlay"]');

  if (!filtersPanel) return;

  const openFilters = () => {
    filtersPanel.classList.add('filters--open');
    openBtn?.setAttribute('aria-expanded', 'true');
    store.setUi({ filtersOpen: true });
    
    if (closeBtn) closeBtn.hidden = false;
    if (overlay && !store.getState().ui.cartOpen) {
      overlay.hidden = false;
    }
    document.body.style.overflow = 'hidden';
  };

  const closeFilters = () => {
    filtersPanel.classList.remove('filters--open');
    openBtn?.setAttribute('aria-expanded', 'false');
    store.setUi({ filtersOpen: false });
    
    if (closeBtn) closeBtn.hidden = true;
    if (overlay && !store.getState().ui.cartOpen) {
      overlay.hidden = true;
    }
    document.body.style.overflow = '';
  };

  openBtn?.addEventListener('click',  openFilters);
  closeBtn?.addEventListener('click', closeFilters);

  overlay?.addEventListener('click', () => {
    if (store.getState().ui.filtersOpen) closeFilters();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && store.getState().ui.filtersOpen) closeFilters();
  });

  const applyBtn      = document.querySelector('[data-js="filters-apply"]');
  const applyCountEl  = document.querySelector('[data-js="filters-apply-count"]');

  if (applyBtn && applyCountEl) {
    store.subscribe((state) => {
      const isMobile = window.matchMedia('(max-width: 1024px)').matches;
      applyBtn.hidden = !isMobile;

      const count = getFilteredProducts(PRODUCTS, state.filters, state.sortBy).length;
      applyCountEl.textContent = count;
    }, 'filters');

    applyBtn.addEventListener('click', closeFilters);
  }
}

// --------------------------------------------------------------------------
// 10. PRODUCT COUNTERS
// --------------------------------------------------------------------------

function initCategoryCounters() {
  const counts = PRODUCTS.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});

  Object.entries(counts).forEach(([category, count]) => {
    const el = document.querySelector(`[data-js="filter-count-${category}"]`);
    if (el) el.textContent = count;
  });
}

function initConnectivityCounters() {
  const counts = { wired: 0, wireless: 0 };

  PRODUCTS.forEach(product => {
    const conn = product.specs?.connectivity;
    if (!conn) return;

    if (conn === 'both') {
      counts.wired++;
      counts.wireless++;
    } else if (conn in counts) {
      counts[conn]++;
    }
  });

  Object.entries(counts).forEach(([value, count]) => {
    const checkbox = document.querySelector(
      `[data-js="filter-checkbox"][data-filter="connectivity"][value="${value}"]`
    );
    const countEl = checkbox?.closest('.filter-checkbox')?.querySelector('.filter-checkbox__count');
    if (countEl) countEl.textContent = count;
  });
}

// --------------------------------------------------------------------------
// 11. TOAST NOTIFICATIONS
// --------------------------------------------------------------------------

export function showToast(message, type = 'success') {
  const container = document.querySelector('[data-js="toast-container"]');
  if (!container) return;

  const icon = type === 'success' ? '✓' : '✕';

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${icon}</span>
    <p class="toast__text">${message}</p>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function initAddToCartToast() {
  const grid = document.querySelector('[data-js="product-grid"]');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-js="add-to-cart"]');
    if (!btn) return;

    const card = btn.closest('[data-js="product-card"]');
    const name = btn.dataset.productName
      || card?.querySelector('.product-card__name')?.textContent.trim()
      || 'Item';

    showToast(`${name} added to cart`, 'success');
  });
}