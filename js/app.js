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
import { initStudio }                             from './modules/studio.js';
import { normalizePriceRange, PRICE_LIMIT }       from './utils/price-range.js';

/** Same breakpoint as the filters drawer in filters.css */
const DRAWER_MQ = window.matchMedia('(max-width: 1024px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

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
  initStudio();

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
  const inertBranches = new Set();
  let activeLayer = null;

  store.subscribe(({ ui }) => {
    const drawerOpen = ui.cartOpen || ui.filtersOpen;
    if (overlay) overlay.hidden = !drawerOpen;
    document.body.style.overflow = (drawerOpen || ui.checkoutOpen || ui.productOpen || ui.infoOpen) ? 'hidden' : '';
    inertBranches.forEach(element => { element.inert = false; });
    inertBranches.clear();
    activeLayer = ui.checkoutOpen ? document.querySelector('[data-js="checkout-modal"]')
      : ui.cartOpen ? document.querySelector('[data-js="cart-drawer"]')
      : ui.filtersOpen ? document.querySelector('[data-js="filters-panel"]') : null;
    // The filters live inside main, so disable sibling branches along their
    // ancestry rather than disabling main and accidentally disabling the drawer.
    let branch = activeLayer;
    while (branch && branch !== document.body) {
      [...branch.parentElement.children].forEach(sibling => {
        if (sibling === branch || sibling === overlay || sibling.matches('script, dialog, .toast-container') || sibling.inert) return;
        sibling.inert = true;
        inertBranches.add(sibling);
      });
      branch = branch.parentElement;
    }
  }, 'ui');

  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !activeLayer) return;
    const focusable = [...activeLayer.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
      .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    const outside = !activeLayer.contains(document.activeElement);
    if (outside || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
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
    catalog.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'instant' : 'smooth', block: 'start' });
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
  const range = document.querySelector('[data-js="price-range"]');
  if (!range) return;
  const thumbMin = range.querySelector('[data-js="range-min"]');
  const thumbMax = range.querySelector('[data-js="range-max"]');
  const fill = range.querySelector('[data-js="price-fill"]');
  const inputMin = document.querySelector('[data-js="price-min"]');
  const inputMax = document.querySelector('[data-js="price-max"]');
  const histogram = document.querySelector('[data-js="price-histogram"]');
  const presets = [...document.querySelectorAll('[data-price-preset]')];
  let timer;
  const bins = Array.from({ length: 20 }, (_, index) => PRODUCTS.filter(product => product.price / 100 >= index * 25 && product.price / 100 < (index + 1) * 25).length);
  const highest = Math.max(...bins, 1);
  histogram.replaceChildren(...bins.map((count, index) => {
    const bar = document.createElement('span');
    bar.style.setProperty('--bar-height', `${Math.max(5, count / highest * 100)}%`);
    bar.dataset.price = index * 25 + 12.5;
    return bar;
  }));
  function paint(min, max) {
    thumbMin.value = inputMin.value = min;
    thumbMax.value = inputMax.value = max;
    thumbMin.setAttribute('aria-valuetext', `$${min}`);
    thumbMax.setAttribute('aria-valuetext', max === PRICE_LIMIT ? '$500 or more' : `$${max}`);
    fill.style.setProperty('--range-min', min / PRICE_LIMIT * 100);
    fill.style.setProperty('--range-max', max / PRICE_LIMIT * 100);
    thumbMin.style.zIndex = min > PRICE_LIMIT / 2 ? '2' : '1';
    histogram.querySelectorAll('span').forEach(bar => bar.classList.toggle('is-outside', Number(bar.dataset.price) < min || Number(bar.dataset.price) > max));
    presets.forEach(button => button.setAttribute('aria-pressed', String(min === 0 && max === Number(button.dataset.pricePreset))));
  }
  function commit(min, max) {
    clearTimeout(timer);
    store.setFilters({ priceMin: min * 100, priceMax: max === PRICE_LIMIT ? Infinity : max * 100 });
  }
  function change(source, immediate) {
    const numeric = source === inputMin || source === inputMax;
    const { min, max } = normalizePriceRange(numeric ? inputMin.value : thumbMin.value, numeric ? inputMax.value : thumbMax.value, source === inputMin || source === thumbMin ? 'min' : 'max');
    paint(min, max);
    clearTimeout(timer);
    if (immediate) commit(min, max);
    else timer = setTimeout(() => commit(min, max), 100);
  }
  [thumbMin, thumbMax].forEach(thumb => {
    thumb.addEventListener('input', () => change(thumb, false));
    thumb.addEventListener('change', () => change(thumb, true));
  });
  [inputMin, inputMax].forEach(input => {
    input.max = PRICE_LIMIT;
    input.addEventListener('change', () => change(input, true));
  });
  presets.forEach(button => button.addEventListener('click', () => {
    const max = button.getAttribute('aria-pressed') === 'true' ? PRICE_LIMIT : Number(button.dataset.pricePreset);
    commit(0, max);
  }));
  store.subscribe(({ filters }) => {
    clearTimeout(timer);
    paint(filters.priceMin / 100, filters.priceMax === Infinity ? PRICE_LIMIT : filters.priceMax / 100);
  }, 'filters');
  paint(0, PRICE_LIMIT);
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
  let closingAnimation = null;

  store.subscribe((state) => {
    const isOpen = state.ui.cartOpen;
    if (isOpen === wasOpen) return;
    wasOpen = isOpen;

    closingAnimation?.cancel();
    closingAnimation = null;
    cartBtn.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) {
      cartDrawer.hidden = false;
      setTimeout(() => { if (store.getState().ui.cartOpen && !store.getState().ui.checkoutOpen) headerClose?.focus(); }, 50);
    } else {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        closingAnimation = cartDrawer.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { duration: 230, easing: 'cubic-bezier(.4,0,1,1)' });
        closingAnimation.onfinish = () => { cartDrawer.hidden = true; };
      } else cartDrawer.hidden = true;
      cartBtn.focus({ preventScroll: true });
    }
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
    store.setFilters({ categories: category === 'all' ? [] : [category], savedOnly: false });
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
      store.setFilters({ savedOnly: false });
      selectCategory(link.dataset.category);
      document.querySelector('[data-js="catalog"]')
        ?.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'instant' : 'smooth', block: 'start' });
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
  let transitionTimer;

  const openFilters = () => {
    clearTimeout(transitionTimer);
    filtersPanel.classList.add('filters--animated');
    filtersPanel.setAttribute('role', 'dialog');
    filtersPanel.setAttribute('aria-modal', 'true');
    filtersPanel.classList.add('filters--open');
    openBtn?.setAttribute('aria-expanded', 'true');
    if (closeBtn) closeBtn.hidden = false;
    store.setUi({ filtersOpen: true });
    setTimeout(() => closeBtn?.focus(), 50);
  };

  const closeFilters = () => {
    if (!store.getState().ui.filtersOpen) return;
    filtersPanel.classList.remove('filters--open');
    transitionTimer = setTimeout(() => filtersPanel.classList.remove('filters--animated'), 400);
    openBtn?.setAttribute('aria-expanded', 'false');
    if (closeBtn) closeBtn.hidden = true;
    store.setUi({ filtersOpen: false });
    filtersPanel.removeAttribute('role');
    filtersPanel.removeAttribute('aria-modal');
    openBtn?.focus({ preventScroll: true });
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
      const count = getFilteredProducts(PRODUCTS, state.filters, state.sortBy, state.wishlist).length;
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
