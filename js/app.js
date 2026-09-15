/**
 * app.js — CyberGear application entry point
 */

import { store }                                  from './modules/store.js';
import { initCatalog, getFilteredProducts }       from './modules/catalog.js';
import { initCart }                               from './modules/cart.js';
import { initCheckout }                           from './modules/checkout.js';
import { $$, debounce }                           from './utils/helpers.js';
import { showToast }                              from './utils/toast.js';
import PRODUCTS                                   from './data/products.js';

/** Same breakpoint as the filters drawer in filters.css */
const DRAWER_MQ = window.matchMedia('(max-width: 1024px)');

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initCatalog();
  initCart();
  initCheckout();

  initLayers();
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
// 0. LAYERS — overlay + page scroll lock
// --------------------------------------------------------------------------

/**
 * Cart, filters drawer and checkout all need the overlay / scroll lock.
 * Previously each module toggled body.style.overflow and overlay.hidden on
 * its own, so they kept overwriting each other. Now it's derived from state
 * in one place.
 */
function initLayers() {
  const overlay = document.querySelector('[data-js="overlay"]');

  store.subscribe(({ ui }) => {
    const drawerOpen = ui.cartOpen || ui.filtersOpen;
    if (overlay) overlay.hidden = !drawerOpen;
    document.body.style.overflow = (drawerOpen || ui.checkoutOpen) ? 'hidden' : '';
  }, 'ui');
}

/**
 * Brings the catalog into view — used after picking a category or typing a
 * search on small screens, where the hero pushes results below the fold.
 */
function revealCatalog() {
  const catalog = document.querySelector('[data-js="catalog"]');
  if (!catalog) return;

  const { top } = catalog.getBoundingClientRect();
  if (top > window.innerHeight * 0.5 || top < 0) {
    catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

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
      if (document.activeElement === thumbMin || document.activeElement === inputMin) {
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
      const value = parseInt(inputMax.value, 10);
      thumbMax.value = priceToPercent(Number.isNaN(value) ? PRICE_MAX : value);
      const prices = updateSliderUI();
      dispatchToStore(prices);
    });
  }

  // "Reset all" clears the price in the store — bring the slider back too
  store.subscribe(({ filters }) => {
    const isDefault = filters.priceMin === 0 && filters.priceMax === Infinity;
    const uiIsDefault = thumbMin.value === '0' && thumbMax.value === '100';
    const isDragging = [thumbMin, thumbMax, inputMin, inputMax].includes(document.activeElement);

    if (isDefault && !uiIsDefault && !isDragging) {
      thumbMin.value = 0;
      thumbMax.value = 100;
      updateSliderUI();
    }
  }, 'filters');
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

  // Delegated: the "Reset filters" button in the catalog empty state is
  // detached from the DOM while products are shown
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-js="filters-reset"]')) store.resetFilters();
  });

  // Checkboxes always mirror the store — covers reset, header nav and footer links
  store.subscribe(syncFiltersUI, 'filters');
}

/**
 * Collapsible filter groups (Price / Category / Connectivity).
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
    ? [...new Set([...current, value])]
    : current.filter(v => v !== value);

  store.setFilters({ [filterKey]: updated });
}

function syncFiltersUI(state = store.getState()) {
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

// --------------------------------------------------------------------------
// 4. SORTING
// --------------------------------------------------------------------------

function initSortSelect() {
  const sortSelect = document.querySelector('[data-js="sort-select"]');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', (e) => {
    store.setSortBy(e.target.value);
  });

  store.subscribe(({ sortBy }) => {
    if (sortSelect.value !== sortBy) sortSelect.value = sortBy;
  }, 'filters');
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
  const cartBtn     = document.querySelector('[data-js="cart-toggle"]');
  const cartDrawer  = document.querySelector('[data-js="cart-drawer"]');
  const closeBtns   = $$('[data-js="cart-close"]');
  const headerClose = cartDrawer?.querySelector('.cart__close-btn');
  const overlay     = document.querySelector('[data-js="overlay"]');
  const cartCount   = document.querySelector('[data-js="cart-count"]');

  if (!cartBtn || !cartDrawer) return;

  // Only move focus when the drawer actually opens/closes — every other UI
  // update (search, view mode, filters) used to yank focus to the cart button
  let wasOpen = false;

  store.subscribe((state) => {
    const isOpen = state.ui.cartOpen;
    if (isOpen === wasOpen) return;
    wasOpen = isOpen;

    cartDrawer.hidden = !isOpen;
    cartBtn.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) setTimeout(() => headerClose?.focus(), 50);
    else cartBtn.focus({ preventScroll: true });
  }, 'ui');

  let prevCount = null;

  store.subscribe((state) => {
    if (!cartCount) return;
    const count = state.cart.reduce((s, i) => s + i.quantity, 0);

    if (count > 0) {
      cartCount.textContent = count > 99 ? '99+' : count;
      cartCount.hidden      = false;

      // Pulse only when the number really changed (not on load / promo apply)
      if (prevCount !== null && count !== prevCount) {
        cartCount.classList.remove('header__cart-count--updated');
        void cartCount.offsetWidth;
        cartCount.classList.add('header__cart-count--updated');
        setTimeout(() => cartCount.classList.remove('header__cart-count--updated'), 600);
      }
    } else {
      cartCount.hidden = true;
    }
    prevCount = count;

    cartBtn.setAttribute('aria-label',
      count > 0 ? `Open cart, ${count} items` : 'Open cart'
    );
  }, 'cart');

  cartBtn.addEventListener('click', () => store.setUi({ cartOpen: true }));
  // Includes the "Browse catalog" button in the empty state, which had no handler
  closeBtns.forEach(btn => btn.addEventListener('click', () => store.setUi({ cartOpen: false })));
  overlay?.addEventListener('click', () => {
    if (store.getState().ui.cartOpen) store.setUi({ cartOpen: false });
  });

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
    if (store.getState().filters.searchQuery) store.setFilters({ searchQuery: '' });
  };

  searchBtn.addEventListener('click', () =>
    store.getState().ui.searchOpen ? close() : open()
  );

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    // Mobile keyboards: "Go/Search" key just hides the keyboard and shows results
    if (e.key === 'Enter') {
      searchInput.blur();
      revealCatalog();
    }
  });

  searchInput?.addEventListener('input', debounce((e) => {
    const query = e.target.value.trim().toLowerCase();
    store.setFilters({ searchQuery: query });
    if (query) revealCatalog();
  }, 300));

  // "Reset all" also clears the search query — clear the field to match
  store.subscribe(({ filters }) => {
    if (!searchInput || filters.searchQuery) return;
    if (document.activeElement !== searchInput && searchInput.value.trim()) {
      searchInput.value = '';
    }
  }, 'filters');
}

// --------------------------------------------------------------------------
// 8. NAVIGATION CATEGORIES
// --------------------------------------------------------------------------

function initNavCategories() {
  const navLinks = $$('[data-js="nav-category"]');

  const selectCategory = (category) => {
    store.setFilters({ categories: category === 'all' ? [] : [category] });
  };

  navLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      selectCategory(btn.dataset.category);
      revealCatalog();
    });
  });

  // Footer "Shop" links point at the same categories
  $$('[data-js="footer-category"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (link.dataset.sort) store.setSortBy(link.dataset.sort);
      selectCategory(link.dataset.category);
      document.querySelector('[data-js="catalog"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Active state follows the store, so checkbox filters and "Reset all"
  // keep the header nav in sync as well
  store.subscribe(({ filters }) => {
    const { categories } = filters;
    const active = categories.length === 0 ? 'all'
      : categories.length === 1 ? categories[0]
      : null;

    navLinks.forEach(link => {
      const isActive = link.dataset.category === active;
      link.classList.toggle('header__nav-link--active', isActive);
      link.setAttribute('aria-current', String(isActive));
    });
  }, 'filters');
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
    if (closeBtn) closeBtn.hidden = false;
    store.setUi({ filtersOpen: true });
    setTimeout(() => closeBtn?.focus(), 50);
  };

  const closeFilters = () => {
    if (!store.getState().ui.filtersOpen) return;
    filtersPanel.classList.remove('filters--open');
    openBtn?.setAttribute('aria-expanded', 'false');
    if (closeBtn) closeBtn.hidden = true;
    store.setUi({ filtersOpen: false });
  };

  openBtn?.addEventListener('click',  openFilters);
  closeBtn?.addEventListener('click', closeFilters);
  overlay?.addEventListener('click',  closeFilters);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFilters();
  });

  // Rotating a tablet / resizing to desktop turns the drawer back into a
  // sidebar — don't leave the overlay and scroll lock behind
  DRAWER_MQ.addEventListener('change', (e) => {
    if (!e.matches) closeFilters();
  });

  const applyBtn     = document.querySelector('[data-js="filters-apply"]');
  const applyCountEl = document.querySelector('[data-js="filters-apply-count"]');

  if (applyBtn && applyCountEl) {
    store.subscribe((state) => {
      const count = getFilteredProducts(PRODUCTS, state.filters, state.sortBy).length;
      applyCountEl.textContent = count;
    }, 'filters');

    applyBtn.addEventListener('click', () => {
      closeFilters();
      revealCatalog();
    });
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

function initAddToCartToast() {
  const grid = document.querySelector('[data-js="product-grid"]');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-js="add-to-cart"]');
    if (!btn || btn.disabled) return;

    const card = btn.closest('[data-js="product-card"]');
    const name = btn.dataset.productName
      || card?.querySelector('.product-card__name')?.textContent.trim()
      || 'Item';

    showToast(`${name} added to cart`, 'success');
  });
}
